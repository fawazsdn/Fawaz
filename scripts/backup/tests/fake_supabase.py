"""Fake Management + Storage API for offline tests of the backup scripts (no real data)."""
import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

OBJECTS = {("avatars", "u1/a.jpg"): b"\xff\xd8fake-jpeg", ("community-media", "u2/p/1.jpg"): b"photo-bytes-123"}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, obj, raw=False):
        body = obj if raw else json.dumps(obj).encode()
        self.send_response(200); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        sql = json.loads(self.rfile.read(int(self.headers["Content-Length"])))["query"]
        if "from storage.objects" in sql:
            self.send([{"bucket": b, "name": n, "size": len(v), "mimetype": "image/jpeg", "updated_at": "2026-11-15", "ro": "on"} for (b, n), v in OBJECTS.items()])
        elif "from storage.buckets" in sql:
            self.send([{"id": "avatars", "name": "avatars", "public": True, "file_size_limit": None, "allowed_mime_types": None}])
        elif "from pg_roles" in sql:
            self.send([{"rolname": "anon", "platform_managed": True, "ro": "on"}, {"rolname": "haratna_backup", "platform_managed": False, "ro": "on"}])
        elif "vault.secrets" in sql:
            self.send([{"secrets": 0}])
        else:
            self.send_error(400)

    def do_GET(self):
        p = self.path
        if p.startswith("/storage/v1/object/authenticated/"):
            assert self.headers["apikey"] == "fake-service-key"
            from urllib.parse import unquote
            b, n = unquote(p.split("/authenticated/", 1)[1]).split("/", 1)
            return self.send(OBJECTS[(b, n)], raw=True)
        if p.endswith("/functions"):
            return self.send([{"slug": "delete-account", "version": 1}, {"slug": "delete-account-v2", "version": 1}])
        if "/functions/" in p and p.endswith("/body"):
            return self.send(b"bundle", raw=True)
        return self.send({"fake": True})


HTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
