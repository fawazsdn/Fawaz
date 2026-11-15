#!/usr/bin/env python3
"""
Haratna Storage backup: copies every object's bytes, read-only.

  python3 -I scripts/backup/storage_backup.py export <out_dir>
  python3 -I scripts/backup/storage_backup.py verify <out_dir>

export
  1. Lists objects from storage.objects through the Management API with a
     read-only query (bucket, name, size, mimetype). Metadata only.
  2. Downloads each object through the Storage API (GET only) and checks its
     size, then writes manifest.json with the sha256 of each file.
  Requires SUPABASE_ACCESS_TOKEN (Management API) and SUPABASE_SERVICE_KEY, the
  project's service-role or secret key, used only for GET requests. Both are
  read from the macOS Keychain by the wrapper script. Neither is printed or
  written to disk. This is owner-side tooling. It never runs in the app.

verify
  Recomputes every file's sha256 and size against the manifest.

Output contains private user photos. Write it only inside the encrypted volume
and encrypt it with age before it leaves that volume. Never commit it.
"""
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request

PROJECT = os.environ.get("SUPABASE_PROJECT_REF", "ckqwziutmqohihrenstz")
MGMT = os.environ.get("SUPABASE_MGMT_URL", "https://api.supabase.com") + f"/v1/projects/{PROJECT}/database/query"
STORAGE = os.environ.get("SUPABASE_STORAGE_URL", f"https://{PROJECT}.supabase.co") + "/storage/v1"


def mgmt_query(sql):
    req = urllib.request.Request(
        MGMT, method="POST",
        data=json.dumps({"query": sql, "read_only": True}).encode(),
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + os.environ.get("SUPABASE_ACCESS_TOKEN", "proxy-injected")})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def safe_rel(bucket, name):
    rel = os.path.normpath(os.path.join(bucket, name))
    if rel.startswith("..") or os.path.isabs(rel) or rel.split(os.sep)[0] != bucket:
        raise SystemExit(f"unsafe object path refused: {bucket}/{name!r}")
    return rel


def export(out):
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not key:
        raise SystemExit("SUPABASE_SERVICE_KEY is not set (the wrapper reads it from the Keychain)")
    os.makedirs(out, exist_ok=True)
    os.chmod(out, 0o700)
    rows = mgmt_query(
        "select bucket_id as bucket, name, coalesce((metadata->>'size')::bigint, -1) as size, "
        "metadata->>'mimetype' as mimetype, updated_at::text as updated_at, "
        "current_setting('transaction_read_only') as ro "
        "from storage.objects order by bucket_id, name")
    if rows and rows[0]["ro"] != "on":
        raise SystemExit("listing query was not read-only: abort")
    buckets = mgmt_query("select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id")
    files, total = {}, 0
    for row in rows:
        rel = safe_rel(row["bucket"], row["name"])
        url = f"{STORAGE}/object/authenticated/{urllib.parse.quote(row['bucket'])}/{urllib.parse.quote(row['name'])}"
        req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=300) as r:
            body = r.read()
        if row["size"] >= 0 and len(body) != row["size"]:
            raise SystemExit(f"size mismatch for {rel}: listed {row['size']}, got {len(body)}")
        dest = os.path.join(out, "objects", rel)
        os.makedirs(os.path.dirname(dest), mode=0o700, exist_ok=True)
        with open(dest, "wb") as f:
            f.write(body)
        os.chmod(dest, 0o600)
        files[rel] = {"sha256": hashlib.sha256(body).hexdigest(), "size": len(body),
                      "mimetype": row["mimetype"], "updated_at": row["updated_at"]}
        total += len(body)
    manifest = {"project": PROJECT, "buckets": buckets, "objects": files,
                "count": len(files), "bytes": total}
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1, sort_keys=True)
    os.chmod(os.path.join(out, "manifest.json"), 0o600)
    print(f"storage export: {len(files)} objects, {total} bytes, {len(buckets)} buckets")


def verify(out):
    man = json.load(open(os.path.join(out, "manifest.json")))
    bad = []
    for rel, info in man["objects"].items():
        path = os.path.join(out, "objects", rel)
        try:
            data = open(path, "rb").read()
        except FileNotFoundError:
            bad.append((rel, "missing"))
            continue
        if len(data) != info["size"] or hashlib.sha256(data).hexdigest() != info["sha256"]:
            bad.append((rel, "checksum"))
    if bad:
        print(f"STORAGE VERIFY FAILED: {len(bad)} object(s)")
        for b in bad:
            print("  ", b)
        sys.exit(1)
    print(f"STORAGE VERIFY OK: {man['count']} objects, {man['bytes']} bytes match the manifest")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("export", "verify"):
        sys.exit(__doc__)
    {"export": export, "verify": verify}[sys.argv[1]](sys.argv[2])
