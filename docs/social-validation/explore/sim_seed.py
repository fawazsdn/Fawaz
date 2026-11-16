"""Write a synthetic staging session into the Simulator app's AsyncStorage. usage: sim_seed.py <session.json> <container> <bundle id> <locale>"""
import json, os, sys, urllib.request
sess = json.load(open(sys.argv[1])); container, bid, locale = sys.argv[2:5]
ref = os.environ["STAGING_REF"]; assert ref == "qcinkzciwjmiavptlfxy"
url = f"https://{ref}.supabase.co"; anon = os.environ["STAGING_ANON_KEY"]
req = urllib.request.Request(url + "/rest/v1/neighborhood_memberships?select=neighborhood_id,neighborhoods(city_id,region_id)&active=eq.true&verification_status=eq.verified",
                             headers={"apikey": anon, "Authorization": "Bearer " + sess["access_token"]})
m = json.load(urllib.request.urlopen(req, timeout=30))[0]
uid = sess["user"]["id"]
store = {"state": {"settings": {"locale": locale}, "session": {
    "onboardingCompleted": True, "profileCreated": True, "regionId": m["neighborhoods"]["region_id"],
    "cityId": m["neighborhoods"]["city_id"], "neighborhoodId": m["neighborhood_id"], "verification": "verified",
    "isAuthenticated": True, "supabaseUserId": uid, "authProvider": "email", "email": sess["user"]["email"]}}, "version": 2}
d = os.path.join(container, "Library/Application Support", bid, "RCTAsyncLocalStorage_V1")
os.makedirs(d, exist_ok=True)
for f in os.listdir(d):
    os.unlink(os.path.join(d, f))
fd = os.open(os.path.join(d, "manifest.json"), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as f:
    json.dump({f"sb-{ref}-auth-token": json.dumps(sess), "haratna-store": json.dumps(store)}, f)
print("seeded", locale, m["neighborhood_id"])
