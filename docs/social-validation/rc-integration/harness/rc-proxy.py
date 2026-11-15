# Loopback fault-injection proxy for the RC Simulator run (synthetic stack only).
# Forwards 127.0.0.1:55430 -> 127.0.0.1:55421 (local Supabase). Modes via GET /_qa/<mode>:
#   online     forward everything
#   offline    drop every connection without forwarding (pre-commit failure)
#   droprpc    forward publish_post / add_post_comment, let the server COMMIT,
#              then drop the response (lost response after commit); other calls pass
#   uploadone  allow one more Storage upload, then drop further uploads unforwarded
#   slowrpc    forward publish_post / add_post_comment (commits), answer 4 s later
#   nofunc     answer those two RPCs as PostgREST does for a missing function
#              (server without 20261110090000), without forwarding
# GET /_qa/cleanup runs the local cleanup-post-photos function (service key from env).
# Logs method, path and status only (no headers, no bodies) to rc-proxy.log.
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.client import HTTPConnection
import json, os, socket, threading, time

UPSTREAM = ('127.0.0.1', 55421)
LOG = __file__.replace('.py', '.log')
state = {'mode': 'online', 'uploads_left': 0, 'hits': 0}
lock = threading.Lock()
DROP_RPC = ('/rest/v1/rpc/publish_post', '/rest/v1/rpc/add_post_comment')


def log(line):
    with open(LOG, 'a') as f:
        f.write(f"{time.strftime('%H:%M:%S')} {line}\n")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def drop(self, why):
        log(f"DROP({why}) {self.command} {self.path.split('?')[0]}")
        self.connection.shutdown(socket.SHUT_RDWR)
        self.close_connection = True

    def handle_any(self):
        path = self.path.split('?')[0]
        if path == '/_qa/hits':
            data = str(state['hits']).encode(); state['hits'] = 0
            self.send_response(200); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
            return
        if path == '/_qa/cleanup':
            c = HTTPConnection('127.0.0.1', 54399, timeout=60)
            c.request('POST', '/', json.dumps({'olderThanHours': 1}),
                      {'Authorization': 'Bearer ' + os.environ['LOCAL_SERVICE_KEY'], 'Content-Type': 'application/json'})
            r = c.getresponse(); data = r.read(); c.close()
            log(f"CLEANUP {r.status} {data.decode()[:300]}")
            self.send_response(r.status); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
            return
        if path.startswith('/_qa/'):
            mode = path.rsplit('/', 1)[1]
            with lock:
                state['mode'] = mode
                if mode == 'uploadone':
                    state['uploads_left'] = 1
            log(f"MODE {mode}")
            self.send_response(204)
            self.end_headers()
            return
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))) or None
        state['hits'] += 1
        mode = state['mode']
        if mode == 'nofunc' and self.command == 'POST' and path in DROP_RPC:
            data = json.dumps({'code': 'PGRST202', 'details': None, 'hint': None,
                               'message': f"Could not find the function public.{path.rsplit('/', 1)[1]} in the schema cache"}).encode()
            log(f"NOFUNC 404 {path}")
            self.send_response(404); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
            return
        if mode == 'offline':
            return self.drop('offline')
        is_upload = self.command == 'POST' and path.startswith('/storage/v1/object/community-media/')
        if mode == 'uploadone' and is_upload:
            with lock:
                allowed = state['uploads_left'] > 0
                state['uploads_left'] -= 1
            if not allowed:
                return self.drop('upload-blocked')
        conn = HTTPConnection(*UPSTREAM, timeout=30)
        headers = {k: v for k, v in self.headers.items() if k.lower() not in ('host', 'connection', 'accept-encoding')}
        try:
            conn.request(self.command, self.path, body, headers)
            res = conn.getresponse()
            data = res.read()
            if mode == 'droprpc' and self.command == 'POST' and path in DROP_RPC and 200 <= res.status < 300:
                log(f"COMMITTED {res.status} {path} -> response dropped")
                return self.drop('after-commit')
            if mode == 'slowrpc' and self.command == 'POST' and path in DROP_RPC and 200 <= res.status < 300:
                log(f"COMMITTED {res.status} {path} -> answering in 4 s")
                time.sleep(4)
            log(f"{res.status} {self.command} {path}")
            self.send_response(res.status)
            for k, v in res.getheaders():
                if k.lower() not in ('connection', 'transfer-encoding', 'content-length'):
                    self.send_header(k, v)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        finally:
            conn.close()

    do_GET = do_POST = do_PATCH = do_DELETE = do_PUT = do_HEAD = do_OPTIONS = handle_any


ThreadingHTTPServer(('127.0.0.1', 55430), Handler).serve_forever()
