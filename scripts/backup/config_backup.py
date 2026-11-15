#!/usr/bin/env python3
"""
Haratna hosted-configuration backup: read-only GETs on the Supabase Management API.

  python3 -I scripts/backup/config_backup.py export <out_dir>
  python3 -I scripts/backup/config_backup.py verify <out_dir>

Records everything the database export cannot hold:
  auth.json            Auth settings (providers, redirect URLs, SMTP, rate limits, hooks).
                       SENSITIVE: contains provider and SMTP secrets.
  postgres.json, pooler.json, postgrest.json, storage.json, realtime.json,
  network-restrictions.json, ssl-enforcement.json
  functions.json       Edge Function list: slug, version, verify_jwt, entrypoint, sha256.
  functions/<slug>.body  the deployed bundle of each function, as served by the API.
  function-secrets.json  names, update times and the API's value field for each secret.
                         SENSITIVE.
  roles.json           role names and attributes (no passwords), with the
                       Supabase-managed roles marked. Equivalent to `db dump --role-only`
                       for review only. Never replay it.
  vault.json           count of Vault secrets only (values are never exported).

Never printed. Every file is mode 0600, and the folder must be age-encrypted before
it leaves the encrypted volume. Never commit it. Requires SUPABASE_ACCESS_TOKEN (Keychain).
"""
import hashlib
import json
import os
import sys
import urllib.request

PROJECT = os.environ.get("SUPABASE_PROJECT_REF", "ckqwziutmqohihrenstz")
BASE = os.environ.get("SUPABASE_MGMT_URL", "https://api.supabase.com") + f"/v1/projects/{PROJECT}"
HEADERS = {"Authorization": "Bearer " + os.environ.get("SUPABASE_ACCESS_TOKEN", "proxy-injected")}

ENDPOINTS = {
    "auth.json": "config/auth",
    "postgres.json": "config/database/postgres",
    "pooler.json": "config/database/pooler",
    "postgrest.json": "postgrest",
    "storage.json": "config/storage",
    "realtime.json": "config/realtime",
    "network-restrictions.json": "network-restrictions",
    "ssl-enforcement.json": "ssl-enforcement",
    "functions.json": "functions",
    "function-secrets.json": "secrets",
}

ROLES_SQL = """
select rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication,
       rolbypassrls, rolconnlimit, rolvaliduntil::text,
       (rolname ~ '^(pg_|supabase|postgres$|anon$|authenticated$|service_role$|authenticator$|dashboard_user$|pgbouncer$|pgsodium|pgtle_admin$|cron_|realtime)') as platform_managed,
       current_setting('transaction_read_only') as ro
from pg_roles order by rolname
"""


def get(path, raw=False):
    req = urllib.request.Request(f"{BASE}/{path}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read()
    return body if raw else json.loads(body)


def query(sql):
    req = urllib.request.Request(f"{BASE}/database/query", method="POST",
                                 data=json.dumps({"query": sql, "read_only": True}).encode(),
                                 headers={**HEADERS, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def write(out, name, data):
    path = os.path.join(out, name)
    os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
    mode = "wb" if isinstance(data, bytes) else "w"
    with open(path, mode) as f:
        f.write(data if isinstance(data, bytes) else json.dumps(data, indent=1, sort_keys=True))
    os.chmod(path, 0o600)


def export(out):
    os.makedirs(out, exist_ok=True)
    os.chmod(out, 0o700)
    for name, path in ENDPOINTS.items():
        write(out, name, get(path))
    functions = json.load(open(os.path.join(out, "functions.json")))
    for fn in functions:
        write(out, f"functions/{fn['slug']}.body", get(f"functions/{fn['slug']}/body", raw=True))
    roles = query(ROLES_SQL)
    if roles and roles[0]["ro"] != "on":
        raise SystemExit("role query was not read-only: abort")
    write(out, "roles.json", roles)
    write(out, "vault.json", query("select count(*) as secrets from vault.secrets"))
    files = {}
    for root, _, names in os.walk(out):
        for n in names:
            if n == "manifest.json":
                continue
            p = os.path.join(root, n)
            files[os.path.relpath(p, out)] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    write(out, "manifest.json", {"project": PROJECT, "files": files})
    custom = [r["rolname"] for r in roles if not r["platform_managed"]]
    print(f"config export: {len(files)} files, {len(functions)} functions, custom roles: {len(custom)}")


def verify(out):
    man = json.load(open(os.path.join(out, "manifest.json")))
    bad = [p for p, h in man["files"].items()
           if not os.path.exists(os.path.join(out, p))
           or hashlib.sha256(open(os.path.join(out, p), "rb").read()).hexdigest() != h]
    for p in man["files"]:
        if p.endswith(".json") and p not in bad:
            json.load(open(os.path.join(out, p)))
    if bad:
        print(f"CONFIG VERIFY FAILED: {bad}")
        sys.exit(1)
    print(f"CONFIG VERIFY OK: {len(man['files'])} files match the manifest")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("export", "verify"):
        sys.exit(__doc__)
    {"export": export, "verify": verify}[sys.argv[1]](sys.argv[2])
