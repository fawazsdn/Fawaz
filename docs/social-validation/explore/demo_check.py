import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import demo_seed as S
K = S.K
S.guard()
st = K.load_state(); P = st["posts"]; name = {v: k for k, v in P.items()}
jwt = K.login(st, "sara")
for feed, want, never in [("community", ["noura", "khalid", "reem"], ["huda", "majed", "faisal_f", "faisal_old"]),
                          ("friends", ["noura", "faisal_f", "faisal_old"], ["huda", "majed", "khalid", "reem"])]:
    s, rows = K.rpc("explore_social_feed", {"feed": feed, "page_offset": 0, "search_text": None}, jwt=jwt)
    got = [name.get(r["id"], "other:" + r["id"][:8]) for r in rows]
    demo = [g for g in got if not g.startswith("other")]
    leaks = [g for g in got if g in never]
    print(f"{feed}: HTTP {s}, {len(rows)} rows, demo order {demo}, others {len(got) - len(demo)}, leaks {leaks}",
          "PASS" if s == 200 and not leaks and all(w in demo for w in want) else "FAIL")
    keys = set().union(*(r.keys() for r in rows)) if rows else set()
    print("  location fields present:", sorted(keys & {"location_label", "approx_lat", "approx_lng"}))
s, rows = K.call("GET", "/rest/v1/notifications?select=id", jwt=jwt); print("notifications as sara:", s, len(rows))
s, r = K.rpc("explore_social_feed", {"feed": "community"}, key=K.ANON); print("anon call:", s)
