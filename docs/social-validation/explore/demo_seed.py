"""Synthetic Explore demo data on Haratna STAGING only (for Simulator screenshots).

Reuses supabase/staging/staging_kit.py: its guard refuses production, any URL that isn't the
staging ref, and any project with a non-@example.test account; db() checks the staging DB marker.
State (synthetic passwords) goes to STAGING_STATE (0700), never printed.
usage: demo_seed.py seed | session <name> <out.json> | cleanup
"""
import io
import json
import os
import secrets
import sys
import time
import uuid

sys.path.insert(0, os.path.expanduser("~/Downloads/haratna-rc-worktrees/codex-recovery/supabase/staging"))
import staging_kit as K  # noqa: E402

HOME = "sa-district-10500227013"
NEARBY = "sa-district-10500227005"   # 12.6 km, same city
FAR_CITY = "sa-district-10100003001"  # Riyadh
# name: (neighborhood, first, last)
DEMO = {
    "sara": (HOME, "Sara", "M."), "noura": (HOME, "Noura", "T."), "khalid": (HOME, "Khalid", "A."),
    "majed": (HOME, "Majed", "S."), "reem": (NEARBY, "Reem", "H."), "huda": (NEARBY, "Huda", "K."),
    "faisal": (FAR_CITY, "Faisal", "R."),
}


def image(seed):
    from PIL import Image, ImageDraw, ImageFilter
    import random
    rnd = random.Random(seed)
    w = h = 1080
    top, bottom = [(214, 232, 220), (236, 226, 204), (205, 225, 233)][seed % 3], [(31, 94, 70), (164, 120, 72), (54, 103, 132)][seed % 3]
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    for _ in range(14):
        x, y, r = rnd.randint(0, w), rnd.randint(h // 3, h), rnd.randint(40, 160)
        d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(min(255, c + rnd.randint(-30, 30)) for c in bottom))
    img = img.filter(ImageFilter.GaussianBlur(6))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    return buf.getvalue()


def guard():
    """K.guard() plus one allowance: the owner's own TestFlight tester account (created
    2026-11-16 16:26 UTC through Haratna Staging build 14) may exist. Anything else non-synthetic
    still stops. The staging ref, URL host and DB marker checks are unchanged."""
    allowed = set(filter(None, os.environ.get("DEMO_ALLOWED_ACCOUNT_IDS", "").split(",")))
    s2, page = K.svc("GET", "/auth/v1/admin/users?per_page=1000")
    accounts = page.get("users", []) if isinstance(page, dict) else []
    if s2 != 200:
        sys.exit(f"GUARD STOP: cannot list Auth accounts (HTTP {s2})")
    real = [u for u in accounts if not str(u.get("email", "")).endswith("@example.test")]
    if len(real) > 1 or any(u["id"] not in allowed for u in real):
        sys.exit(f"GUARD STOP: unexpected non-synthetic account(s): {len(real)}")
    real_svc = K.svc
    def only_synthetic(method, path, **kw):   # never touch the allowed real account
        if any(a in path for a in allowed):
            sys.exit("GUARD STOP: refusing to act on the owner's account")
        return real_svc(method, path, **kw)
    K.svc = only_synthetic
    K.PUBLIC_GEOGRAPHY = False
    K.call("GET", "/rest/v1/regions?select=source")
    # K.guard() minus the account scan done above
    problems = []
    if not K.REF or K.REF == K.PROD_REF or K.PROD_REF in K.URL:
        problems.append("not staging")
    if K.urllib.parse.urlparse(K.URL).hostname != f"{K.REF}.supabase.co":
        problems.append("URL host does not match STAGING_REF")
    if problems:
        sys.exit("GUARD STOP: " + "; ".join(problems))
    os.makedirs(K.STATE, mode=0o700, exist_ok=True)
    os.chmod(K.STATE, 0o700)
    print(f"guard ok: staging {K.REF}, {len(accounts)} accounts ({len(real)} allowed owner account)")


def ok(status, what, body=None):
    if status not in (200, 201, 204):
        sys.exit(f"{what}: HTTP {status} {str(body)[:200]}")


def seed():
    guard()
    st = K.load_state()
    ids, jwt = {}, {}
    for name, (nb, first, last) in DEMO.items():
        u = st["users"].get(name)
        if not u:
            email, pw = f"demo-{name}.{secrets.token_hex(3)}@example.test", secrets.token_urlsafe(24)
            s, r = K.svc("POST", "/auth/v1/admin/users", body={"email": email, "password": pw, "email_confirm": True,
                                                                "user_metadata": {"synthetic": True, "demo": "explore"}})
            ok(s, f"create {name}", r)
            u = st["users"][name] = {"id": r["id"], "email": email, "password": pw}
            K.save_state(st)
        ids[name] = u["id"]
        r = K.db(f"""begin;
update public.profiles set first_name = {K.lit(first)}, last_name = {K.lit(last)}, profile_completed = true, locale = 'ar' where id = {K.lit(u['id'])};
insert into public.age_declarations(user_id, date_of_birth) values ({K.lit(u['id'])}, '1992-01-01') on conflict do nothing;
insert into public.neighborhood_memberships(user_id, neighborhood_id, verification_status, active, verified_at)
select {K.lit(u['id'])}, {K.lit(nb)}, 'verified', true, now()
where not exists (select 1 from public.neighborhood_memberships where user_id = {K.lit(u['id'])});
commit;
select count(*) as memberships from public.neighborhood_memberships where user_id = {K.lit(u['id'])} and verification_status = 'verified';""")
        if not (isinstance(r, list) and r and r[0].get("memberships") == 1):
            sys.exit(f"setup {name}: {r}")
        jwt[name] = K.login(st, name)
    if st.get("seeded"):
        print("already seeded"); return

    s, r = K.rpc("set_account_private", {"make_private": True}, jwt=jwt["huda"]); ok(s, "huda private", r)

    def post(name, body, audience, photo_seed=None, minutes_ago=0):
        photos = []
        if photo_seed is not None:
            path = f"posts/{ids[name]}/{uuid.uuid4()}.jpg"
            ok(K.upload(jwt[name], "community-media", path, data=image(photo_seed)), f"upload {name}")
            photos.append(path)
        s, r = K.rpc("publish_post", {"op_id": str(uuid.uuid4()), "post_type": "general", "body": body,
                                       "post_audience": audience, "photos": photos}, jwt=jwt[name])
        ok(s, f"post {name}", r)
        pid = r["post_id"]
        if minutes_ago:
            K.db(f"update public.posts set created_at = now() - interval '{int(minutes_ago)} minutes' where id = {K.lit(pid)}; select 1 as ok;")
        return pid

    p = {}
    p["faisal_old"] = post("faisal", "رحلة الصباح إلى وادي حنيفة كانت رائعة 🌿", "public", 2, minutes_ago=600)
    p["huda"] = post("huda", "منشور من حساب خاص — يجب ألا يظهر في المجتمع", "public", minutes_ago=200)
    p["majed"] = post("majed", "منشور من مستخدم محظور — يجب ألا يظهر", "public", minutes_ago=150)
    p["reem"] = post("reem", "افتتح مقهى جديد قرب حديقة الدانة الجنوبية، القهوة ممتازة ☕️", "public", 1, minutes_ago=90)
    p["khalid"] = post("khalid", "سوق المزارعين في الحي يوم الجمعة من ٤ إلى ٨ مساءً. أحضروا أكياسكم!", "neighborhood", 0, minutes_ago=45)
    p["faisal_f"] = post("faisal", "صور من تجمع الجيران الأسبوع الماضي، شكراً للجميع 🤍", "followers", 2, minutes_ago=30)
    p["noura"] = post("noura", "من يعرف ممشى مناسب للعائلات في الحي؟", "public", minutes_ago=10)

    for name, target in [("sara", "faisal"), ("sara", "noura")]:
        s, r = K.rpc("follow_user", {"target": ids[target]}, jwt=jwt[name]); ok(s, f"{name} follows {target}", r)
    s, r = K.call("POST", "/rest/v1/user_blocks", jwt=jwt["sara"], body={"blocker_id": ids["sara"], "blocked_id": ids["majed"]})
    ok(s, "sara blocks majed", r)
    for who, pid in [("khalid", p["noura"]), ("reem", p["noura"]), ("noura", p["khalid"]), ("sara", p["reem"])]:
        s, r = K.call("POST", "/rest/v1/post_reactions", jwt=jwt[who], body={"post_id": pid, "user_id": ids[who], "type": "like"})
        ok(s, f"{who} likes", r)
    for who, pid, body in [("khalid", p["noura"], "ممشى حديقة الحي ممتاز في المساء"), ("noura", p["khalid"], "فكرة رائعة!")]:
        s, r = K.rpc("add_post_comment", {"op_id": str(uuid.uuid4()), "target_post": pid, "body": body}, jwt=jwt[who])
        ok(s, f"{who} comments", r)
    st["seeded"], st["posts"] = True, p
    K.save_state(st)
    print("seeded:", {k: v[:8] for k, v in p.items()})


def session(name, out):
    guard()
    st = K.load_state()
    u = st["users"][name]
    s, r = K.call("POST", "/auth/v1/token?grant_type=password", body={"email": u["email"], "password": u["password"]})
    ok(s, "sign-in")
    r["expires_at"] = int(time.time()) + r["expires_in"]
    fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(r, f)
    print(f"session for {name} written (0600)")


def cleanup():
    guard()
    st = K.load_state()
    for name, u in list(st["users"].items()):
        s, _ = K.svc("DELETE", f"/auth/v1/admin/users/{u['id']}")
        print(name, "deleted" if s in (200, 204) else f"HTTP {s}")
    os.unlink(os.path.join(K.STATE, "state.json"))


if __name__ == "__main__":
    {"seed": lambda: seed(), "session": lambda: session(sys.argv[2], sys.argv[3]), "cleanup": lambda: cleanup()}[sys.argv[1]]()
