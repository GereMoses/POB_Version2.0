"""
Pure-Python C3 driver via the `zkaccess-c3` library (import name `c3`).

This is the STANDALONE path for the ZKTeco C3-200/C3-400 (and inBio) panels: a
native-Python implementation of the C3 PULL protocol over TCP — no plcommpro.dll,
no Windows, no Wine, no sidecar. Runs inside the POB Docker container. POB replaces
"ESS" as the software talking to the panels, so it is the sole reader.

License note: `zkaccess-c3` is GPLv3 (embedded per project decision).

We adapt its records to POB's existing `C3Event` so the ingest/zone engine is
unchanged. Field mapping is taken from the library's real API (introspected, not
guessed): EventRecord{card_no, pin, port_nr(=door), event_type, in_out_state,
time_second}; InOutDirection ENTRY=0 / EXIT=3.
"""

from __future__ import annotations

import logging
from typing import List

from .c3_controller import C3Event

logger = logging.getLogger(__name__)


def sdk_available() -> bool:
    """True if the pure-Python zkaccess-c3 library is importable."""
    try:
        import c3  # noqa: F401
        return True
    except Exception:
        return False


def _to_c3event(rec) -> C3Event:
    from c3 import consts
    from c3.rtlog import C3DateTime
    ts = None
    if getattr(rec, "time_second", 0):
        try:
            ts = C3DateTime.from_value(rec.time_second)
        except Exception:
            ts = None
    # Normalise the library's InOutDirection (ENTRY=0, EXIT=3) to POB's 0/1 convention
    in_out = 1 if rec.in_out_state == consts.InOutDirection.EXIT else 0
    return C3Event(
        time=ts,
        card_no=str(rec.card_no) if getattr(rec, "card_no", 0) else None,
        pin=str(rec.pin) if getattr(rec, "pin", 0) else None,
        door_id=int(getattr(rec, "port_nr", 0) or 0),
        event_type=int(rec.event_type),
        in_out=in_out,
        verify_type=int(getattr(rec, "verified", 0) or 0),
        raw={"src": "zkaccess-c3"},
    )


class ZKAccessC3Client:
    """Context-manager wrapper over zkaccess-c3 for one panel."""

    def __init__(self, ip: str, port: int = 4370, password: str = ""):
        self.ip, self.port, self.password = ip, port or 4370, password or ""
        self._c3 = None

    def __enter__(self) -> "ZKAccessC3Client":
        self.connect()
        return self

    def __exit__(self, *exc) -> None:
        self.disconnect()

    def connect(self) -> None:
        from c3 import C3
        self._c3 = C3(self.ip, self.port)
        ok = self._c3.connect(self.password or None)
        if not ok:
            raise ConnectionError(f"zkaccess-c3: could not connect to {self.ip}:{self.port}")

    def disconnect(self) -> None:
        try:
            if self._c3 is not None:
                self._c3.disconnect()
        finally:
            self._c3 = None

    def get_rt_log(self) -> List[C3Event]:
        """Realtime access events (door/alarm status records are filtered out)."""
        records = self._c3.get_rt_log()
        return [_to_c3event(r) for r in records if getattr(r, "is_event", lambda: False)()]

    def open_door(self, door_id: int = 1, duration: int = 5) -> bool:
        from c3 import consts
        from c3.controldevice import ControlDeviceOutput
        self._c3.control_device(
            ControlDeviceOutput(int(door_id), consts.ControlOutputAddress.DOOR_OUTPUT, int(duration))
        )
        return True

    def info(self) -> dict:
        c = self._c3
        return {"serial": getattr(c, "serial_number", None), "name": getattr(c, "device_name", None),
                "firmware": getattr(c, "firmware_version", None), "doors": getattr(c, "nr_of_locks", None)}


def test_connection(ip: str, port: int = 4370, password: str = "") -> dict:
    """Best-effort connect + realtime-log read via the pure-Python driver. Never raises."""
    try:
        with ZKAccessC3Client(ip, port, password) as c:
            events = c.get_rt_log()
            meta = c.info()
        return {"success": True, "message": "Connected via zkaccess-c3 (standalone)",
                "events_buffered": len(events), **meta}
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc)}


def probe(ip: str, port: int = 4370, password: str = "") -> dict:
    """Step-by-step diagnostics via the pure-Python driver (the real one in prod):
    TCP reachable → C3 driver present → session handshake → realtime-log sample.
    Never raises; returns the same shape the Probe modal renders."""
    import socket
    report = {"ip": ip, "port": port, "steps": [], "driver": "zkaccess-c3 (pure Python)"}

    def step(name, ok, detail=""):
        report["steps"].append({"step": name, "ok": ok, "detail": str(detail)[:400]})

    try:
        with socket.create_connection((ip, port), timeout=4):
            step("tcp_connect", True, f"{ip}:{port} reachable")
    except Exception as exc:  # noqa: BLE001
        step("tcp_connect", False, exc)
        report["summary"] = "Panel not reachable on the LAN — check IP/port/firewall."
        return report

    if not sdk_available():
        step("c3_driver", False, "zkaccess-c3 not importable")
        report["summary"] = "The pure-Python C3 driver is missing (unexpected — check the image build)."
        return report
    step("c3_driver", True, "pure-Python zkaccess-c3 driver available")

    try:
        with ZKAccessC3Client(ip, port, password) as c:
            step("connect", True, "session established")
            events = c.get_rt_log()
            meta = c.info()
            report["rtlog_parsed_count"] = len(events)
            step("get_rtlog", True,
                 f"{len(events)} event(s)"
                 + (f"; device serial {meta.get('serial')}, fw {meta.get('firmware')}" if meta.get('serial') else ""))
        report["summary"] = ("Connected via the pure-Python C3 driver. "
                             "Present a card at a reader and re-probe to see live events.")
    except Exception as exc:  # noqa: BLE001
        step("connect", False, exc)
        report["summary"] = f"Reachable, but the C3 session failed: {exc}"
    return report
