#!/usr/bin/env python3
"""
ZKTeco PULL SDK sidecar — run this on a WINDOWS host that has `plcommpro.dll`.

WHY
---
The PULL SDK 2.2.1.4 package ships a Windows DLL only (no Linux .so). The POB
backend runs on Linux and therefore can't load the DLL directly. This tiny,
dependency-free service (Python standard library only) loads `plcommpro.dll` on a
Windows machine on the same LAN as the C3 panels and exposes it over HTTP. Point
the backend at it with `ZK_SDK_SIDECAR_URL=http://<win-host>:8770`.

It returns the RAW RTLog text; the POB backend parses it with the authoritative
parser (`c3_controller._parse_rtlog_text`), so parsing logic lives in one place.

RUN (on the Windows box, in a terminal):
    set ZK_SDK_SIDECAR_TOKEN=some-shared-secret        (optional but recommended)
    set ZK_PULLSDK_PATH=C:\\path\\to\\plcommpro.dll     (optional; default name used)
    python c3_sdk_sidecar.py --port 8770

ENDPOINTS
    GET  /health                      -> {"ok": true, "sdk_loaded": bool}
    POST /rtlog     {ip,port,passwd}  -> {"raw": "<rtlog text>", "count": n}
    POST /open-door {ip,port,passwd,door,duration} -> {"ok": bool}
"""

import os
import json
import ctypes
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

_LIB = None


def _load():
    global _LIB
    if _LIB is not None:
        return _LIB
    name = os.environ.get("ZK_PULLSDK_PATH", "plcommpro.dll")
    lib = ctypes.CDLL(name)
    lib.Connect.argtypes = [ctypes.c_char_p]; lib.Connect.restype = ctypes.c_void_p
    lib.Disconnect.argtypes = [ctypes.c_void_p]; lib.Disconnect.restype = None
    lib.GetRTLog.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]; lib.GetRTLog.restype = ctypes.c_int
    for ext in ("GetRTLogExt",):
        if hasattr(lib, ext):
            getattr(lib, ext).argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
            getattr(lib, ext).restype = ctypes.c_int
    lib.ControlDevice.argtypes = [ctypes.c_void_p, ctypes.c_long, ctypes.c_long,
                                  ctypes.c_long, ctypes.c_long, ctypes.c_long, ctypes.c_char_p]
    lib.ControlDevice.restype = ctypes.c_int
    _LIB = lib
    return lib


def _conn(ip, port, passwd):
    return f"protocol=TCP,ipaddress={ip},port={port},timeout=4000,passwd={passwd}".encode()


def _rtlog(ip, port, passwd):
    lib = _load()
    h = lib.Connect(_conn(ip, port, passwd))
    if not h:
        raise ConnectionError("Connect failed (PullLastError %s)" %
                              (lib.PullLastError() if hasattr(lib, "PullLastError") else "?"))
    try:
        buf = ctypes.create_string_buffer(64 * 1024)
        fn = getattr(lib, "GetRTLogExt", None) or lib.GetRTLog
        n = fn(ctypes.c_void_p(h), buf, len(buf))
        return buf.value.decode("utf-8", "replace"), (n if n and n > 0 else 0)
    finally:
        lib.Disconnect(ctypes.c_void_p(h))


def _open_door(ip, port, passwd, door, duration):
    lib = _load()
    h = lib.Connect(_conn(ip, port, passwd))
    if not h:
        raise ConnectionError("Connect failed")
    try:
        # OperationID=1 output, Param1=door, Param2=1 lock output, Param3=duration
        return lib.ControlDevice(ctypes.c_void_p(h), 1, int(door), 1, int(duration), 0, b"") >= 0
    finally:
        lib.Disconnect(ctypes.c_void_p(h))


class Handler(BaseHTTPRequestHandler):
    def _auth_ok(self):
        want = os.environ.get("ZK_SDK_SIDECAR_TOKEN")
        if not want:
            return True
        return self.headers.get("Authorization") == f"Bearer {want}"

    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            try:
                _load(); loaded = True
            except Exception:
                loaded = False
            return self._send(200, {"ok": True, "sdk_loaded": loaded})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self._auth_ok():
            return self._send(401, {"error": "unauthorized"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n) or b"{}")
        except Exception as e:
            return self._send(400, {"error": f"bad body: {e}"})
        try:
            if self.path == "/rtlog":
                raw, cnt = _rtlog(data["ip"], data.get("port", 4370), data.get("passwd", ""))
                return self._send(200, {"raw": raw, "count": cnt})
            if self.path == "/open-door":
                ok = _open_door(data["ip"], data.get("port", 4370), data.get("passwd", ""),
                                data.get("door", 1), data.get("duration", 5))
                return self._send(200, {"ok": bool(ok)})
            self._send(404, {"error": "not found"})
        except Exception as e:
            self._send(502, {"error": str(e)})

    def log_message(self, *a):  # quieter
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8770)
    args = ap.parse_args()
    print(f"ZKTeco PULL SDK sidecar on {args.host}:{args.port} "
          f"(token {'set' if os.environ.get('ZK_SDK_SIDECAR_TOKEN') else 'NOT set'})")
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
