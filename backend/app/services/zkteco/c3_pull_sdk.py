"""
ZKTeco C3 access panels via the OFFICIAL PULL SDK (libplcommpro) — not a hand-rolled
wire protocol.

WHY
---
C3-100/200/400 (and inBio) speak ZKTeco's PULL SDK protocol. Rather than guess the
binary framing, this binds ZKTeco's own shared library (`libplcommpro.so` on Linux,
`plcommpro.dll` on Windows) through ctypes — the same library ZKAccess/ZKBioSecurity
use. That library implements the protocol correctly, so we don't have to.

The SDK's public C API (stable across releases):
    long Connect(const char* params)
    void Disconnect(long handle)
    int  GetRTLog(long handle, char* buffer, int buffersize)
    int  ControlDevice(long h, long op, long p1, long p2, long p3, long p4, char* opts)
    int  PullLastError(void)
Connection string: "protocol=TCP,ipaddress=<ip>,port=<port>,timeout=4000,passwd=<pw>"

DEPLOYMENT
----------
Obtain the PULL SDK from ZKTeco (freely provided) and make the library available to
the backend container. Point to it with env `ZK_PULLSDK_PATH` (default tries common
names). If the library is absent, every call degrades to a clear error — nothing
crashes, and the rest of POB is unaffected.

RTLOG FORMAT — FROM THE OFFICIAL DOC (not guessed)
--------------------------------------------------
Per the PULL SDK protocol doc v2.0 (Appendix 7/8), realtime events are TEXT:
  • GetRTLog:    positional CSV, records split by \\r\\n —
                 time, pin, cardno, eventaddr(door), eventtype, inoutstatus, verifytype
                 (a record whose index-4 field == 255 is a door/alarm STATE record).
  • GetRTLogExt: key=value, tab-separated, prefixed type=rtlog | type=rtstate.
`_parse_rtlog_text` (in c3_controller) implements both authoritatively; `probe()`
still dumps the raw text for on-site confirmation.

WINDOWS-ONLY LIBRARY
--------------------
The PULL SDK 2.2.1.4 package ships `plcommpro.dll` (x86/x64) only — no Linux `.so`.
Since the POB backend runs on Linux, run the small sidecar (`c3_sdk_sidecar.py`) on
a Windows host on the LAN and set `ZK_SDK_SIDECAR_URL`; the ingest will fetch events
over HTTP. If a Linux `libplcommpro.so` is ever obtained, the ctypes path here works
directly. See PULL_SDK_README.md.
"""

from __future__ import annotations

import os
import socket
import logging
from typing import List, Dict, Optional

from .c3_controller import C3Event, _parse_rtlog_text  # reuse the event type + kv parser

logger = logging.getLogger(__name__)

_DEFAULT_LIB_NAMES = ["libplcommpro.so", "libplcommpro.so.1", "plcommpro.so",
                      "libzkaccess.so", "plcommpro.dll"]


class SDKUnavailable(RuntimeError):
    """Raised when the ZKTeco PULL SDK shared library cannot be loaded."""


def _load_sdk():
    """Load libplcommpro via ctypes with the documented C signatures."""
    import ctypes
    path = os.environ.get("ZK_PULLSDK_PATH")
    candidates = [path] if path else []
    candidates += _DEFAULT_LIB_NAMES
    last_err = None
    for name in candidates:
        if not name:
            continue
        try:
            lib = ctypes.CDLL(name)
        except OSError as e:
            last_err = e
            continue
        # Declare the real PULL SDK signatures
        lib.Connect.argtypes = [ctypes.c_char_p]
        lib.Connect.restype = ctypes.c_void_p
        lib.Disconnect.argtypes = [ctypes.c_void_p]
        lib.Disconnect.restype = None
        lib.GetRTLog.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
        lib.GetRTLog.restype = ctypes.c_int
        # GetRTLogExt returns the PUSH key=value form (preferred — explicit type=rtlog)
        try:
            lib.GetRTLogExt.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
            lib.GetRTLogExt.restype = ctypes.c_int
        except AttributeError:
            pass
        lib.ControlDevice.argtypes = [ctypes.c_void_p, ctypes.c_long, ctypes.c_long,
                                      ctypes.c_long, ctypes.c_long, ctypes.c_long, ctypes.c_char_p]
        lib.ControlDevice.restype = ctypes.c_int
        try:
            lib.PullLastError.restype = ctypes.c_int
        except AttributeError:
            pass
        logger.info("ZKTeco PULL SDK loaded: %s", name)
        return lib
    raise SDKUnavailable(
        "libplcommpro not found. Install ZKTeco's PULL SDK and set ZK_PULLSDK_PATH "
        f"(tried: {', '.join(c for c in candidates if c)}). Last error: {last_err}"
    )


def _conn_string(ip: str, port: int = 4370, password: str = "") -> str:
    return f"protocol=TCP,ipaddress={ip},port={port},timeout=4000,passwd={password}"


def parse_rtlog(raw: str) -> Dict:
    """Parse GetRTLog / GetRTLogExt text into events. Both documented formats
    (positional comma + key=value tab) are handled authoritatively per the PULL SDK
    protocol doc v2.0 (Appendix 7/8), so parsing is not a guess."""
    return {"events": _parse_rtlog_text(raw), "provisional": False}


class PullSDKClient:
    """Thin context-manager wrapper over the official SDK for one panel."""

    def __init__(self, ip: str, port: int = 4370, password: str = "", buffer_size: int = 64 * 1024):
        self.ip, self.port, self.password = ip, port, password
        self.buffer_size = buffer_size
        self._lib = None
        self._h = None

    def __enter__(self) -> "PullSDKClient":
        self.connect()
        return self

    def __exit__(self, *exc) -> None:
        self.disconnect()

    def connect(self) -> None:
        import ctypes
        self._lib = _load_sdk()
        h = self._lib.Connect(_conn_string(self.ip, self.port, self.password).encode())
        if not h:
            err = self._lib.PullLastError() if hasattr(self._lib, "PullLastError") else "?"
            raise ConnectionError(f"PULL SDK Connect failed for {self.ip}:{self.port} (error {err})")
        self._h = ctypes.c_void_p(h)

    def disconnect(self) -> None:
        try:
            if self._lib and self._h:
                self._lib.Disconnect(self._h)
        finally:
            self._h = None

    def get_rt_log_raw(self) -> str:
        import ctypes
        buf = ctypes.create_string_buffer(self.buffer_size)
        # Prefer GetRTLogExt (explicit type=rtlog/rtstate key=value); fall back to GetRTLog.
        fn = getattr(self._lib, "GetRTLogExt", None) or self._lib.GetRTLog
        n = fn(self._h, buf, self.buffer_size)
        if n < 0:
            raise IOError(f"{getattr(fn, '__name__', 'GetRTLog')} returned {n}")
        return buf.value.decode("utf-8", errors="replace")

    def get_rt_log(self) -> List[C3Event]:
        return parse_rtlog(self.get_rt_log_raw())["events"]

    def open_door(self, door_id: int = 1, duration: int = 5) -> bool:
        # ControlDevice op 1 = output(open door); p1=door, p2=1(door output addr), p3=seconds
        rc = self._lib.ControlDevice(self._h, 1, int(door_id), 1, int(duration), 0, b"")
        return rc >= 0


# ── High-level helpers ─────────────────────────────────────────────────────────
def sdk_available() -> bool:
    try:
        _load_sdk()
        return True
    except SDKUnavailable:
        return False


def probe(ip: str, port: int = 4370, password: str = "") -> Dict:
    """Non-destructive diagnostics against a real panel. Never raises. Dumps the RAW
    RTLog so the exact record format is confirmed against the device, not assumed."""
    report: Dict = {"ip": ip, "port": port, "steps": []}

    def step(name, ok, detail=""):
        report["steps"].append({"step": name, "ok": ok, "detail": str(detail)[:400]})

    # 1) TCP reachability
    try:
        with socket.create_connection((ip, port), timeout=4):
            step("tcp_connect", True, f"{ip}:{port} reachable")
    except Exception as e:  # noqa: BLE001
        step("tcp_connect", False, e)
        report["summary"] = "Panel not reachable on the LAN — check IP/port/firewall."
        return report

    # 2) SDK library present
    try:
        _load_sdk()
        step("sdk_library", True, "libplcommpro loaded")
    except SDKUnavailable as e:
        step("sdk_library", False, e)
        report["summary"] = ("TCP works but the ZKTeco PULL SDK library isn't installed. "
                             "Add libplcommpro and set ZK_PULLSDK_PATH.")
        return report

    # 3) Connect + read a realtime-log sample (raw)
    try:
        with PullSDKClient(ip, port, password) as c:
            step("sdk_connect", True, "handshake OK")
            raw = c.get_rt_log_raw()
            parsed = parse_rtlog(raw)
            report["rtlog_raw"] = raw[:2000]
            report["rtlog_parsed_count"] = len(parsed["events"])
            report["rtlog_provisional"] = parsed["provisional"]
            step("get_rtlog", True,
                 f"{len(parsed['events'])} event(s) parsed"
                 + (" — positional format, confirm field order" if parsed["provisional"] else ""))
        report["summary"] = "Connected via the official PULL SDK. Present a card and re-probe to see live events."
    except Exception as e:  # noqa: BLE001
        step("sdk_connect", False, e)
        report["summary"] = f"SDK loaded and TCP works, but the panel session failed: {e}"
    return report
