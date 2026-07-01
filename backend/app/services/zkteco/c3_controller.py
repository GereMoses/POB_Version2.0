"""
ZKTeco C3 / InBio access-controller driver (C3 "PULL" protocol over TCP 4370).

WHY THIS EXISTS
---------------
InBio-460 and C3-100/200/400 access *controllers* do NOT speak the standalone
T&A protocol that pyzk (`from zk import ZK`) implements, and they are not ADMS
push devices. They speak ZKTeco's access-control "PULL SDK" protocol — a binary
request/response framing over TCP port 4370. POB therefore needs its own client.

CONFIRMED HARDWARE (customer, 2026-07-01): ZKTeco **C3-200** (2-door) and
**C3-400** (4-door). Both speak the C3 PULL SDK protocol over TCP 4370.

SCOPE / STATUS
--------------
This is the Phase-2 scaffold. The architecture, connection management, realtime-
log TEXT parsing and POB integration wiring are complete and correct. The BINARY
FRAME ENCODING (`_build_frame` / `_parse_frame`) below is a FIRST CUT and is NOT
yet confirmed against the real C3 PULL SDK wire format — the constants are marked
`# VERIFY`. Do NOT treat them as authoritative. To finalise correctly (and without
guessing) use ONE of:
  1. Test against the now-available C3-200/C3-400 on the LAN and capture the real
     frames (a probe harness can be added), or
  2. Implement against ZKTeco's official PULL SDK / C3 access-control protocol
     document, or wrap the official PULL SDK (plcommpro) where a Windows host is
     available.
Nothing here runs automatically: the poller is opt-in and every call is wrapped so
a wrong frame can only ever return an error, never crash the backend.

Once verified against hardware we wire `poll_rt_events()` into a background task
that feeds events through the SAME access-control plumbing the direct readers use
(`_handle_zone_access` → zones + `acc_event`).
"""

from __future__ import annotations

import socket
import struct
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ── C3 protocol constants (VERIFY against a real C3-400 / InBio-460) ───────────
_C3_START = 0xAA          # VERIFY: frame start marker
_C3_END   = 0x55          # VERIFY: frame end marker
_C3_PORT  = 4370

# Command bytes (VERIFY): the C3 PULL protocol multiplexes operations; these are
# the documented control/realtime ops. Treat as the single place to correct.
CMD_CONNECT      = 0x76   # VERIFY: open session
CMD_DISCONNECT   = 0x02   # VERIFY: close session
CMD_GET_RTLOG    = 0x0B   # VERIFY: read buffered realtime events
CMD_CONTROL      = 0x05   # VERIFY: ControlDevice (open door / output)
CMD_DATA_QUERY   = 0x04   # VERIFY: GetDeviceData (users, params)


def _crc16(payload: bytes) -> int:
    """CRC16 over the frame body. ZK access panels use CRC16; exact poly is
    VERIFY-on-hardware. CCITT (0x1021) first cut."""
    crc = 0x0000
    for b in payload:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return crc & 0xFFFF


# ── Parsed realtime event ─────────────────────────────────────────────────────
@dataclass
class C3Event:
    """One access event from the controller's realtime log (RTLOG)."""
    time: Optional[datetime]
    card_no: Optional[str]
    pin: Optional[str]          # emp_code / user PIN if the panel reports it
    door_id: int
    event_type: int             # ZKTeco event code (0 = normal verify-open, …)
    in_out: int                 # 0 = entry, 1 = exit (panel-configured)
    verify_type: int
    raw: Dict[str, str] = field(default_factory=dict)


@dataclass
class C3Config:
    ip: str
    port: int = _C3_PORT
    password: str = ""          # comm password if the panel has one
    timeout: float = 5.0


def _parse_ts(v: str):
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            continue
    return None


def _parse_rtlog_text(blob: str) -> List[C3Event]:
    """Parse ZKTeco C3 PULL SDK realtime-log text into access events. Handles BOTH
    documented formats (Pull SDK protocol doc v2.0, Appendix 7/8):

      • GetRTLogExt — key=value, tab-separated, e.g.:
          type=rtlog\\ttime=...\\tpin=1001\\tcardno=1234567\\teventaddr=1\\t
          event=0\\tinoutstatus=0\\tverifytype=1
        (type=rtstate rows are door/alarm status — skipped.)

      • GetRTLog — POSITIONAL, comma-separated, records split by \\r\\n:
          time, pin, cardno, eventaddr(door), eventtype, inoutstatus, verifytype
        A record whose 5th field (index 4) == 255 is a door/alarm STATE record
        (not an access event) and is skipped.

    Mapping: door_id←eventaddr, event_type←event, in_out←inoutstatus
    (0=in/ENTRY, 1=out/EXIT, 2=none), plus pin, cardno, verifytype, time.
    """
    events: List[C3Event] = []
    for line in blob.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = line.strip()
        if not line:
            continue

        if "=" in line:                                   # key=value (GetRTLogExt/PUSH)
            sep = "\t" if "\t" in line else ","
            kv: Dict[str, str] = {}
            for part in line.split(sep):
                if "=" in part:
                    k, v = part.split("=", 1)
                    kv[k.strip().lower()] = v.strip()
            if kv.get("type") == "rtstate":               # door/alarm state, not an event
                continue

            def _int(*keys, default=0):
                for k in keys:
                    if kv.get(k) not in (None, ""):
                        try:
                            return int(kv[k])
                        except ValueError:
                            pass
                return default

            events.append(C3Event(
                time=_parse_ts(kv.get("time") or kv.get("logtime") or ""),
                card_no=kv.get("cardno") or kv.get("card") or None,
                pin=kv.get("pin") or kv.get("userid") or None,
                door_id=_int("eventaddr", "doorid", "door", default=1),
                event_type=_int("event", "eventtype", default=0),
                in_out=_int("inoutstatus", "inoutstate", "inout", default=0),
                verify_type=_int("verifytype", "verify", default=0),
                raw=kv,
            ))
        elif "," in line:                                 # positional (GetRTLog)
            f = [p.strip() for p in line.split(",")]
            if len(f) < 7:
                continue
            if f[4] == "255":                             # door/alarm STATE record
                continue

            def _fi(v, default=0):
                try:
                    return int(v)
                except (ValueError, TypeError):
                    return default

            events.append(C3Event(
                time=_parse_ts(f[0]),
                pin=f[1] or None,
                card_no=f[2] or None,
                door_id=_fi(f[3], 1),
                event_type=_fi(f[4], 0),
                in_out=_fi(f[5], 0),
                verify_type=_fi(f[6], 0),
                raw={"positional": line},
            ))
    return events


class C3Controller:
    """Thin client for one C3/InBio controller. Use as a context manager:

        with C3Controller(C3Config(ip="192.168.1.50")) as c3:
            for ev in c3.get_rt_log():
                ...
    """

    def __init__(self, cfg: C3Config):
        self.cfg = cfg
        self._sock: Optional[socket.socket] = None
        self._session = 0

    # ── transport (VERIFY against hardware) ───────────────────────────────────
    def _build_frame(self, command: int, data: bytes = b"") -> bytes:
        """Encode a C3 request frame. VERIFY layout:
           START | CMD | LEN(2,LE) | SESSION(2,LE) | DATA | CRC16(2,LE) | END"""
        body = struct.pack("<BH H", command, len(data), self._session) + data
        crc = _crc16(body)
        return bytes([_C3_START]) + body + struct.pack("<H", crc) + bytes([_C3_END])

    def _parse_frame(self, raw: bytes) -> bytes:
        """Return the data payload from a response frame, or raise on a bad frame.
        VERIFY: mirrors `_build_frame`."""
        if len(raw) < 8 or raw[0] != _C3_START or raw[-1] != _C3_END:
            raise C3Error(f"bad frame: {raw[:16]!r}…")
        command, length, session = struct.unpack("<BH H", raw[1:6])
        data = raw[6:6 + length]
        self._session = session or self._session
        return data

    def _txn(self, command: int, data: bytes = b"") -> bytes:
        if not self._sock:
            raise C3Error("not connected")
        self._sock.sendall(self._build_frame(command, data))
        self._sock.settimeout(self.cfg.timeout)
        resp = self._sock.recv(64 * 1024)
        return self._parse_frame(resp)

    # ── lifecycle ─────────────────────────────────────────────────────────────
    def connect(self) -> None:
        self._sock = socket.create_connection((self.cfg.ip, self.cfg.port), timeout=self.cfg.timeout)
        try:
            self._txn(CMD_CONNECT, self.cfg.password.encode())
        except Exception as exc:                       # keep socket for diagnostics
            logger.warning("C3 %s: handshake failed (transport needs verification): %s", self.cfg.ip, exc)
            raise

    def disconnect(self) -> None:
        try:
            if self._sock:
                try:
                    self._txn(CMD_DISCONNECT)
                except Exception:
                    pass
                self._sock.close()
        finally:
            self._sock = None

    def __enter__(self) -> "C3Controller":
        self.connect()
        return self

    def __exit__(self, *exc) -> None:
        self.disconnect()

    # ── operations ────────────────────────────────────────────────────────────
    def get_rt_log(self) -> List[C3Event]:
        """Read and parse buffered realtime access events."""
        data = self._txn(CMD_GET_RTLOG)
        return _parse_rtlog_text(data.decode("utf-8", errors="replace"))

    def open_door(self, door_id: int = 1, duration: int = 5) -> bool:
        """ControlDevice → open (unlock) a door for `duration` seconds.
        VERIFY payload format for ControlDevice operation."""
        payload = f"ControlDevice operationid=1 doorid={door_id} duration={duration}".encode()
        self._txn(CMD_CONTROL, payload)
        return True


class C3Error(Exception):
    pass


# ── High-level helpers used by the API / poller ───────────────────────────────
def test_connection(ip: str, port: int = _C3_PORT, password: str = "", timeout: float = 5.0) -> dict:
    """Best-effort reachability + handshake test. Never raises."""
    try:
        with C3Controller(C3Config(ip=ip, port=port, password=password, timeout=timeout)) as c3:
            sample = c3.get_rt_log()
        return {"success": True, "message": "Connected to controller", "events_buffered": len(sample)}
    except Exception as exc:
        return {"success": False, "error": str(exc),
                "note": "C3 transport is a first cut — verify protocol constants against this panel."}


def open_door(ip: str, door_id: int = 1, duration: int = 5,
              port: int = _C3_PORT, password: str = "", timeout: float = 5.0) -> dict:
    try:
        with C3Controller(C3Config(ip=ip, port=port, password=password, timeout=timeout)) as c3:
            c3.open_door(door_id, duration)
        return {"success": True, "message": f"Door {door_id} opened for {duration}s"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}
