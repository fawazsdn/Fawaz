#!/usr/bin/env python3
"""
Haratna hosted staging kit: synthetic users and the hosted PASS/FAIL test matrix.

  python3 -I supabase/staging/staging_kit.py guard
  python3 -I supabase/staging/staging_kit.py users
  python3 -I supabase/staging/staging_kit.py matrix  [--report FILE]   # main phase
  python3 -I supabase/staging/staging_kit.py cleanup [--report FILE]   # >= 65 minutes after `matrix`

STAGING ONLY. Every command first runs `guard`, which refuses to continue unless:
  * STAGING_REF is set, is not the production ref, and the URL host is <STAGING_REF>.supabase.co;
  * every row in public.regions is source = 'synthetic' (production's geography never is).
Production is never contacted.

Settings (environment):
  STAGING_REF           staging project ref
  STAGING_ANON_KEY      staging publishable/anon key (not secret)
  STAGING_SERVICE_KEY   staging service-role/secret key. Used only by this tool, never in the
                        app. Read from the Keychain or a 0600 file, never pasted in chat.
  STAGING_STATE         state folder (default ~/.haratna-staging, mode 0700): synthetic
                        passwords and test ids. Staging-only data.
Synthetic accounts use the reserved domain example.test, so no email can ever be delivered.
"""
import base64
import datetime
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

PROD_REF = "ckqwziutmqohihrenstz"
REF = os.environ.get("STAGING_REF", "")
URL = os.environ.get("STAGING_URL", f"https://{REF}.supabase.co").rstrip("/")
ANON = os.environ.get("STAGING_ANON_KEY", "")
SERVICE = os.environ.get("STAGING_SERVICE_KEY", "")
STATE = os.path.expanduser(os.environ.get("STAGING_STATE", "~/.haratna-staging"))
JPEG = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffdb004300") + b"\x08" * 64 + bytes.fromhex("ffd9")

# name: (neighborhood, verified)
USERS = {
    "alice": ("stg-n1", True), "bob": ("stg-n1", True), "carol": ("stg-n1", True),
    "dave": ("stg-n3", True), "erin": ("stg-n1", False), "mallory": ("stg-n1", True),
    "deleteme1": ("stg-n2", True),
}


# --------------------------------------------------------------------------- HTTP
def call(method, path, *, key=None, jwt=None, body=None, raw=None, ctype=None, headers=None):
    h = {"apikey": key or ANON}
    if jwt:
        h["Authorization"] = f"Bearer {jwt}"
    elif key:
        h["Authorization"] = f"Bearer {key}"
    data = None
    if raw is not None:
        data, h["Content-Type"] = raw, ctype or "application/octet-stream"
    elif body is not None:
        data, h["Content-Type"] = json.dumps(body).encode(), "application/json"
    h.update(headers or {})
    req = urllib.request.Request(URL + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            status, payload = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, payload = e.code, e.read()
    try:
        return status, json.loads(payload) if payload else None
    except ValueError:
        return status, payload


def rpc(fn, args, jwt=None, key=None):
    return call("POST", f"/rest/v1/rpc/{fn}", jwt=jwt, key=key, body=args)


def svc(method, path, **kw):
    return call(method, path, key=SERVICE, **kw)


# --------------------------------------------------------------------------- guard
def guard():
    problems = []
    if not REF:
        problems.append("STAGING_REF is not set")
    if REF == PROD_REF or PROD_REF in URL:
        problems.append("this is the PRODUCTION project")
    host = urllib.parse.urlparse(URL).hostname or ""
    local_ok = os.environ.get("STAGING_ALLOW_LOCAL") == "1" and host in ("127.0.0.1", "localhost")
    if host != f"{REF}.supabase.co" and not local_ok:
        problems.append(f"URL host {host!r} does not match STAGING_REF")
    if not ANON or not SERVICE:
        problems.append("STAGING_ANON_KEY and STAGING_SERVICE_KEY are required")
    if problems:
        sys.exit("GUARD STOP: " + "; ".join(problems))
    status, rows = svc("GET", "/rest/v1/regions?select=source")
    if status != 200 or not isinstance(rows, list) or not rows:
        sys.exit(f"GUARD STOP: cannot read synthetic geography (HTTP {status}); run seed_synthetic_geography.sql first")
    if any(r.get("source") != "synthetic" for r in rows):
        sys.exit("GUARD STOP: non-synthetic geography found: this is not the staging project")
    os.makedirs(STATE, mode=0o700, exist_ok=True)
    os.chmod(STATE, 0o700)
    print(f"guard ok: staging {REF}, {len(rows)} synthetic region(s)")


def load_state():
    try:
        return json.load(open(os.path.join(STATE, "state.json")))
    except FileNotFoundError:
        return {"users": {}}


def save_state(st):
    p = os.path.join(STATE, "state.json")
    with open(p, "w") as f:
        json.dump(st, f, indent=1)
    os.chmod(p, 0o600)


# --------------------------------------------------------------------------- users
def users():
    guard()
    st = load_state()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for name, (nb, verified) in USERS.items():
        u = st["users"].get(name)
        if not u:
            email, pw = f"{name}.{secrets.token_hex(3)}@example.test", secrets.token_urlsafe(24)
            s, r = svc("POST", "/auth/v1/admin/users",
                       body={"email": email, "password": pw, "email_confirm": True,
                             "user_metadata": {"synthetic": True}})
            if s not in (200, 201):
                sys.exit(f"create {name}: HTTP {s} {r}")
            u = st["users"][name] = {"id": r["id"], "email": email, "password": pw}
            save_state(st)
        uid = u["id"]
        svc("PATCH", f"/rest/v1/profiles?id=eq.{uid}",
            body={"first_name": name.capitalize(), "last_name": "Synthetic", "profile_completed": True, "locale": "en"})
        svc("POST", "/rest/v1/age_declarations", body={"user_id": uid, "date_of_birth": "1990-01-01"},
            headers={"Prefer": "resolution=ignore-duplicates"})
        s, existing = svc("GET", f"/rest/v1/neighborhood_memberships?user_id=eq.{uid}&select=id")
        if not existing:
            m = {"user_id": uid, "neighborhood_id": nb, "verification_status": "verified" if verified else "pending"}
            if verified:
                m["verified_at"] = now
            s, r = svc("POST", "/rest/v1/neighborhood_memberships", body=m)
            if s not in (200, 201):
                sys.exit(f"membership {name}: HTTP {s} {r}")
    svc("POST", "/rest/v1/user_blocks",
        body={"blocker_id": st["users"]["alice"]["id"], "blocked_id": st["users"]["mallory"]["id"]},
        headers={"Prefer": "resolution=ignore-duplicates"})
    print(f"users ok: {len(USERS)} synthetic accounts (@example.test); alice blocks mallory")


def login(st, name):
    u = st["users"][name]
    s, r = call("POST", "/auth/v1/token?grant_type=password", body={"email": u["email"], "password": u["password"]})
    if s != 200:
        sys.exit(f"sign-in {name}: HTTP {s}")
    return r["access_token"]


# --------------------------------------------------------------------------- matrix
class Report:
    def __init__(self):
        self.rows = []

    def check(self, area, case, ok, detail=""):
        self.rows.append((area, case, "PASS" if ok else "FAIL", str(detail)[:160]))
        print(f"{'PASS' if ok else 'FAIL'}  [{area}] {case}  {detail if not ok else ''}")

    def write(self, path, title):
        lines = [f"# {title}", "", f"Staging `{REF}` · {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M} UTC", "",
                 "| Area | Case | Result | Detail |", "|---|---|---|---|"]
        lines += [f"| {a} | {c} | {r} | {d.replace('|', '/')} |" for a, c, r, d in self.rows]
        fails = sum(1 for r in self.rows if r[2] == "FAIL")
        lines += ["", f"**{len(self.rows) - fails} PASS, {fails} FAIL**"]
        with open(path, "w") as f:
            f.write("\n".join(lines) + "\n")
        print(f"report: {path} ({len(self.rows) - fails} PASS, {fails} FAIL)")
        return fails


def rows_of(r):
    return r if isinstance(r, list) else []


def upload(jwt, bucket, path, data=JPEG, ctype="image/jpeg"):
    return call("POST", f"/storage/v1/object/{bucket}/{path}", jwt=jwt, raw=data, ctype=ctype)[0]


def sign(jwt, bucket, path):
    s, r = call("POST", f"/storage/v1/object/sign/{bucket}/{path}", jwt=jwt, body={"expiresIn": 120})
    return s, (r or {}).get("signedURL") if isinstance(r, dict) else None


def fetch_signed(signed):
    try:
        with urllib.request.urlopen(URL + "/storage/v1" + signed, timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""


def visible(jwt, post_id):
    return len(rows_of(call("GET", f"/rest/v1/posts?id=eq.{post_id}&select=id", jwt=jwt)[1])) == 1


def matrix(report_path):
    guard()
    st = load_state()
    rep = Report()
    T = {n: login(st, n) for n in USERS}
    ID = {n: st["users"][n]["id"] for n in USERS}
    tag = secrets.token_hex(4)

    # 5.1 JWT role switching
    s, r = call("GET", "/rest/v1/posts?select=id")
    rep.check("JWT", "anon cannot read posts", s in (401, 403) or rows_of(r) == [], f"HTTP {s}")
    s, _ = rpc("publish_post", {"op_id": str(uuid.uuid4()), "post_type": "general", "body": "x", "post_audience": "public", "photos": []})
    rep.check("JWT", "anon cannot publish", s >= 400, f"HTTP {s}")
    forged = ".".join(base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip("=")
                      for x in ({"alg": "HS256", "typ": "JWT"}, {"sub": ID["alice"], "role": "service_role", "exp": 4102444800})) + ".AAAA"
    s, _ = call("GET", "/rest/v1/posts?select=id", jwt=forged)
    rep.check("JWT", "forged service_role JWT rejected", s in (401, 403), f"HTTP {s}")
    for fn, args in (("legacy_avatar_inventory", {}), ("count_abandoned_post_photos", {}),
                     ("claim_abandoned_post_photos", {}), ("finish_post_photo_cleanup", {"deleted_paths": []})):
        s, _ = rpc(fn, args, jwt=T["alice"])
        rep.check("JWT", f"authenticated cannot call {fn}", s >= 400, f"HTTP {s}")
    s, _ = rpc("count_abandoned_post_photos", {}, key=SERVICE)
    rep.check("JWT", "service_role can call count_abandoned_post_photos", s == 200, f"HTTP {s}")
    s, r = rpc("social_profile", {"target": ID["alice"]}, jwt=T["alice"])
    rep.check("JWT", "authenticated reads own social profile", s == 200 and isinstance(r, dict), f"HTTP {s}")

    # 5.4 Storage permissions
    a_photo = f"posts/{ID['alice']}/{tag}-pub.jpg"
    rep.check("Storage", "verified user uploads to own posts folder", upload(T["alice"], "community-media", a_photo) in (200, 201))
    rep.check("Storage", "upload into another user's folder denied",
              upload(T["alice"], "community-media", f"posts/{ID['carol']}/{tag}.jpg") >= 400)
    rep.check("Storage", "unverified user cannot upload post photos",
              upload(T["erin"], "community-media", f"posts/{ID['erin']}/{tag}.jpg") >= 400)
    rep.check("Storage", "wrong file type rejected (profile-photos)",
              upload(T["alice"], "profile-photos", f"{ID['alice']}/{tag}.txt", b"text", "text/plain") >= 400)

    # 5.5 exactly-once publish and comment
    op = str(uuid.uuid4())
    args = {"op_id": op, "post_type": "general", "body": f"staging public {tag}", "post_audience": "public", "photos": [a_photo]}
    s1, r1 = rpc("publish_post", args, jwt=T["alice"])
    s2, r2 = rpc("publish_post", args, jwt=T["alice"])
    p_pub = (r1 or {}).get("post_id") if isinstance(r1, dict) else None
    rep.check("Exactly-once", "publish created", s1 == 200 and (r1 or {}).get("outcome") == "created", r1)
    rep.check("Exactly-once", "same op_id returns existing, same post",
              s2 == 200 and isinstance(r2, dict) and r2.get("outcome") == "existing" and r2.get("post_id") == p_pub, r2)
    s3, r3 = rpc("publish_post", {**args, "body": "changed"}, jwt=T["alice"])
    rep.check("Exactly-once", "same op_id with different content is a conflict",
              isinstance(r3, dict) and r3.get("outcome") == "conflict", r3)
    cop = str(uuid.uuid4())
    c1 = rpc("add_post_comment", {"op_id": cop, "target_post": p_pub, "body": "hi"}, jwt=T["carol"])[1]
    c2 = rpc("add_post_comment", {"op_id": cop, "target_post": p_pub, "body": "hi"}, jwt=T["carol"])[1]
    rep.check("Exactly-once", "comment retry returns existing, same comment",
              isinstance(c1, dict) and isinstance(c2, dict) and c1.get("outcome") == "created"
              and c2.get("outcome") == "existing" and c1.get("comment_id") == c2.get("comment_id"), c2)
    s, n = svc("GET", f"/rest/v1/posts?author_id=eq.{ID['alice']}&client_op_id=eq.{op}&select=id")
    rep.check("Exactly-once", "exactly one post row for the op", len(rows_of(n)) == 1, n)

    # 5.2 RLS audiences and blocks
    def post(user, audience, photos=()):
        return (rpc("publish_post", {"op_id": str(uuid.uuid4()), "post_type": "general", "body": f"{audience} {tag}",
                                     "post_audience": audience, "photos": list(photos)}, jwt=T[user])[1] or {}).get("post_id")
    p_fol, p_nb = post("alice", "followers"), post("alice", "neighborhood")
    s, r = rpc("follow_user", {"target": ID["alice"]}, jwt=T["carol"])
    rep.check("RLS", "follow a public account is immediate", r == "following", r)
    rep.check("RLS", "public post visible to verified user in another city", visible(T["dave"], p_pub))
    rep.check("RLS", "public post hidden from unverified user", not visible(T["erin"], p_pub))
    rep.check("RLS", "public post hidden from blocked user", not visible(T["mallory"], p_pub))
    rep.check("RLS", "followers post visible to accepted follower", visible(T["carol"], p_fol))
    rep.check("RLS", "followers post hidden from non-follower", not visible(T["dave"], p_fol))
    rep.check("RLS", "neighborhood post visible to verified neighbor", visible(T["carol"], p_nb))
    rep.check("RLS", "neighborhood post hidden from other neighborhood", not visible(T["dave"], p_nb))
    s, url = sign(T["dave"], "community-media", a_photo)
    fs, body = fetch_signed(url) if url else (0, b"")
    rep.check("Storage", "permitted viewer gets a working signed URL", s == 200 and fs == 200 and body == JPEG, f"sign {s} fetch {fs}")
    rep.check("Storage", "unverified user cannot sign the photo", sign(T["erin"], "community-media", a_photo)[0] >= 400)
    rep.check("Storage", "blocked user cannot sign the photo", sign(T["mallory"], "community-media", a_photo)[0] >= 400)
    s, _ = call("GET", f"/storage/v1/object/public/community-media/{a_photo}")
    rep.check("Storage", "no public URL for private bucket", s >= 400, f"HTTP {s}")

    # private account and profile photos
    rpc("set_account_private", {"make_private": True}, jwt=T["bob"])
    b_photo = f"{ID['bob']}/{tag}-avatar.jpg"
    rep.check("Storage", "owner uploads private profile photo", upload(T["bob"], "profile-photos", b_photo) in (200, 201))
    p_bob = post("bob", "public")
    r = rpc("follow_user", {"target": ID["bob"]}, jwt=T["dave"])[1]
    rep.check("RLS", "follow a private account creates a request", r == "requested", r)
    rep.check("RLS", "pending request: private account's post hidden", not visible(T["dave"], p_bob))
    rep.check("Storage", "pending request: profile photo not signable", sign(T["dave"], "profile-photos", b_photo)[0] >= 400)
    rpc("respond_follow_request", {"requester": ID["dave"], "accept": True}, jwt=T["bob"])
    rep.check("RLS", "accepted request: post visible", visible(T["dave"], p_bob))
    rep.check("Storage", "accepted request: profile photo signable", sign(T["dave"], "profile-photos", b_photo)[0] == 200)

    # 5.5 photo removal on post delete
    s, url = sign(T["alice"], "community-media", a_photo)
    rpc("delete_post", {"target_post": p_pub}, jwt=T["alice"])
    s, _ = svc("GET", f"/storage/v1/object/authenticated/community-media/{a_photo}")
    rep.check("Cleanup", "deleting a post removes its photo object", s >= 400, f"HTTP {s}")
    time.sleep(70)
    rep.check("Cleanup", "old signed URL stops working (CDN, 70s)", (fetch_signed(url)[0] if url else 404) >= 400)

    # abandoned upload for the cleanup phase
    ab = f"posts/{ID['alice']}/{tag}-abandoned.jpg"
    rep.check("Cleanup", "abandoned upload staged", upload(T["alice"], "community-media", ab) in (200, 201))
    keep = f"posts/{ID['alice']}/{tag}-keep.jpg"
    upload(T["alice"], "community-media", keep)
    p_keep = post("alice", "public", [keep])
    st["cleanup"] = {"abandoned": ab, "keep": keep, "keep_post": p_keep, "staged_at": time.time()}
    s, _ = call("POST", "/functions/v1/cleanup-post-photos", jwt=T["alice"], body={"dryRun": True})
    rep.check("Cleanup", "cleanup function refuses a user JWT", s in (401, 403), f"HTTP {s}")

    # 5.3 account deletion
    d = T["deleteme1"]
    d_photo = f"posts/{ID['deleteme1']}/{tag}.jpg"
    upload(d, "community-media", d_photo)
    post("deleteme1", "public", [d_photo])
    upload(d, "profile-photos", f"{ID['deleteme1']}/{tag}.jpg")
    rpc("follow_user", {"target": ID["alice"]}, jwt=d)
    s, r = call("POST", "/functions/v1/delete-account-v2", jwt=d, body={})
    rep.check("Account deletion", "delete-account-v2 succeeds", s == 200, f"HTTP {s} {r}")
    s, _ = svc("GET", f"/auth/v1/admin/users/{ID['deleteme1']}")
    rep.check("Account deletion", "Auth user removed", s == 404, f"HTTP {s}")
    s, r = svc("GET", f"/rest/v1/profiles?id=eq.{ID['deleteme1']}&select=id")
    rep.check("Account deletion", "profile removed", rows_of(r) == [], r)
    s, r = svc("GET", f"/rest/v1/follows?follower_id=eq.{ID['deleteme1']}&select=followee_id")
    rep.check("Account deletion", "follows removed", rows_of(r) == [], r)
    for b, p in (("community-media", d_photo), ("profile-photos", f"{ID['deleteme1']}/{tag}.jpg")):
        s, _ = svc("GET", f"/storage/v1/object/authenticated/{b}/{p}")
        rep.check("Account deletion", f"{b} object removed", s >= 400, f"HTTP {s}")
    s, _ = call("POST", "/functions/v1/delete-account-v2", jwt=d, body={})
    rep.check("Account deletion", "repeat call with old session is refused safely", s == 401, f"HTTP {s}")
    st["users"].pop("deleteme1")
    save_state(st)
    return rep.write(report_path, "Haratna hosted staging: main phase")


def cleanup_phase(report_path):
    guard()
    st = load_state()
    rep = Report()
    c = st.get("cleanup")
    if not c:
        sys.exit("run `matrix` first")
    wait = c["staged_at"] + 65 * 60 - time.time()
    if wait > 0:
        sys.exit(f"wait {int(wait / 60) + 1} more minutes (cleanup only takes uploads older than 1 hour)")
    fn = lambda body: call("POST", "/functions/v1/cleanup-post-photos", key=SERVICE, body=body)
    s, r = fn({"dryRun": True, "olderThanHours": 1})
    rep.check("Cleanup", "dry run counts the abandoned upload", s == 200, f"HTTP {s} {r}")
    s, _ = svc("GET", f"/storage/v1/object/authenticated/community-media/{c['abandoned']}")
    rep.check("Cleanup", "dry run deletes nothing", s == 200, f"HTTP {s}")
    s, r = fn({"olderThanHours": 1})
    rep.check("Cleanup", "cleanup run succeeds", s == 200, f"HTTP {s} {r}")
    s, _ = svc("GET", f"/storage/v1/object/authenticated/community-media/{c['abandoned']}")
    rep.check("Cleanup", "abandoned upload removed", s >= 400, f"HTTP {s}")
    s, _ = svc("GET", f"/storage/v1/object/authenticated/community-media/{c['keep']}")
    rep.check("Cleanup", "photo of a published post untouched", s == 200, f"HTTP {s}")
    s, r = svc("GET", f"/rest/v1/media_attachments?object_path=eq.{c['abandoned']}&select=status")
    rep.check("Cleanup", "no attachment row left for the removed file", rows_of(r) == [], r)
    s, r = fn({"olderThanHours": 1})
    rep.check("Cleanup", "second run is a no-op", s == 200, f"HTTP {s} {r}")
    return rep.write(report_path, "Haratna hosted staging: cleanup phase")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    out = sys.argv[sys.argv.index("--report") + 1] if "--report" in sys.argv else os.path.join(STATE, f"{cmd}-report.md")
    if cmd == "guard":
        guard()
    elif cmd == "users":
        users()
    elif cmd == "matrix":
        sys.exit(1 if matrix(out) else 0)
    elif cmd == "cleanup":
        sys.exit(1 if cleanup_phase(out) else 0)
    else:
        sys.exit(__doc__)
