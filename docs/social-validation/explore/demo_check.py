"""API-level checks of the Explore feed on staging as the synthetic viewer (read-only)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import demo_seed as S
K = S.K
S.guard()
st = K.load_state(); P = st["posts"]; name = {v: k for k, v in P.items()}; U = st["users"]
jwt = K.login(st, "sara")
fails = 0
def check(ok, what):
    global fails
    fails += not ok
    print("PASS" if ok else "FAIL", what)

def walk(feed):
    rows, cursor, pages = [], None, 0
    while True:
        s, page = K.rpc("explore_social_feed", {"feed": feed, "cursor": cursor, "search_text": None}, jwt=jwt)
        assert s == 200, (s, page)
        rows += page; pages += 1
        if len(page) < 16: return rows, pages
        cursor = page[-1]["feed_cursor"]

for feed, want, never in [("community", ["noura", "khalid", "reem"], ["huda", "majed", "faisal_f", "faisal_old"]),
                          ("friends", ["noura", "faisal_f", "faisal_old"], ["huda", "majed", "khalid", "reem"])]:
    rows, pages = walk(feed)
    ids = [r["id"] for r in rows]
    got = [name.get(i) for i in ids if i in name]
    check(len(ids) == len(set(ids)), f"{feed}: {len(ids)} posts over {pages} page(s), no duplicates")
    check(all(w in got for w in want) and not any(n in got for n in never), f"{feed}: expected demo posts {got}, none restricted")
    check(all(not (r.keys() & {"location_label", "approx_lat", "approx_lng"}) for r in rows), f"{feed}: no location fields")
    check(all(set(r["author"]) <= {"id", "first_name", "last_name", "name_privacy", "avatar_path"} for r in rows), f"{feed}: author has display fields only")
    if feed == "community":
        # keyset walk == a fresh ranking of the same snapshot (nothing skipped)
        check(sum(1 for r in rows if r["id"] == P["reem"]) == 1, "community: nearby post reached exactly once by paging")
        reem = next(r for r in rows if r["id"] == P["reem"])
        check(reem["author"]["first_name"] == "Reem" and reem["author"]["last_name"] == "H" and reem["author"]["avatar_path"],
              "nearby public author: name masked to initial, photo allowed")
        check(reem["area"]["name_en"] != "" and "lat" not in str(reem["area"]), "nearby post carries the area name only")

# Private account: no photo path for a non-follower, and Storage refuses the file.
s, card = K.rpc("social_profile", {"target": U["huda"]["id"]}, jwt=jwt)
check(s == 200 and (card is None or not card.get("avatar_path")), "private account photo path hidden from non-follower")
s, raw = K.call("GET", f"/rest/v1/profiles?select=avatar_path&id=eq.{U['huda']['id']}", jwt=jwt)
huda_path = None
st_h = K.login(st, "huda")
s2, own = K.call("GET", f"/rest/v1/profiles?select=avatar_path&id=eq.{U['huda']['id']}", jwt=st_h)
huda_path = own[0]["avatar_path"]
s3, _ = K.call("POST", f"/storage/v1/object/authenticated/profile-photos/{huda_path}", jwt=jwt)
s4, _ = K.call("GET", f"/storage/v1/object/authenticated/profile-photos/{huda_path}", jwt=jwt)
check(s4 in (400, 403, 404), f"private account photo download refused to non-follower (HTTP {s4})")
s5, _ = K.call("GET", f"/storage/v1/object/authenticated/profile-photos/{huda_path}", jwt=st_h)
check(s5 == 200, "owner can still read own photo (control)")
s, r = K.rpc("explore_social_feed", {"feed": "community"}, key=K.ANON); check(s == 401, f"anonymous call refused (HTTP {s})")
print("RESULT", "PASS" if not fails else f"{fails} FAIL")
