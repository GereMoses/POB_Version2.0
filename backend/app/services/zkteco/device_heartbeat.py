"""
ZKTeco Device Heartbeat

Lightweight TCP reachability checker. Every 5 seconds it probes all direct-connected
devices concurrently — just a TCP connect/close on port 4370, no pyzk protocol
overhead. Updates devices.status and iclock_terminal.state immediately so the UI
reflects actual reachability without waiting for the full attendance-poll cycle.
"""

import asyncio
import logging
from datetime import datetime, timezone

from ...core.database import SessionLocal
from ...models.device import Device, DeviceStatus
from ...models.biotime_models import IClockTerminal

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = 5   # seconds between full sweeps
CONNECT_TIMEOUT = 3.0    # TCP connect timeout per device


async def _tcp_reachable(ip: str, port: int) -> bool:
    """Return True if a TCP connection to ip:port succeeds within CONNECT_TIMEOUT."""
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port),
            timeout=CONNECT_TIMEOUT,
        )
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False


def _db_update_device(device_id: int, sn: str, reachable: bool, now: datetime) -> None:
    """Synchronous DB update — run in a thread executor to avoid blocking the event loop."""
    # ADMS state constants (must match adms_protocol.py)
    STATE_PENDING  = 0  # awaiting admin approval — never written by heartbeat
    STATE_APPROVED = 1
    STATE_REJECTED = 2  # blocked by admin — never written by heartbeat
    STATE_OFFLINE  = 3

    new_status = DeviceStatus.ONLINE if reachable else DeviceStatus.OFFLINE
    db = SessionLocal()
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return
        prev_status = device.status
        device.status = new_status
        if reachable:
            device.last_seen = now
        term = db.query(IClockTerminal).filter(IClockTerminal.sn == sn).first()
        if term:
            # Never overwrite PENDING or REJECTED — those are admin-controlled states.
            # Only toggle between APPROVED (1) and OFFLINE (3) for already-approved devices.
            if term.state not in (STATE_PENDING, STATE_REJECTED):
                new_term_state = STATE_APPROVED if reachable else STATE_OFFLINE
                if term.state != new_term_state:
                    term.state = new_term_state
                if reachable:
                    term.last_activity = now
        db.commit()
        if prev_status != new_status:
            logger.info("Heartbeat: %s changed %s → %s", sn,
                        prev_status.value if prev_status else "unknown", new_status.value)
            if new_status == DeviceStatus.ONLINE:
                # Trigger immediate attendance pull
                try:
                    from ..device_poller import request_immediate_poll
                    request_immediate_poll(sn)
                except Exception:
                    pass
                # Queue an immediate DATE TIME command so the device corrects its
                # clock on the very next ADMS poll — don't wait for the hourly loop.
                try:
                    correct_time = now.strftime('%Y-%m-%d %H:%M:%S')
                    db2 = SessionLocal()
                    try:
                        from sqlalchemy import text as _text
                        db2.execute(_text(
                            "INSERT INTO iclock_devcmd "
                            "(sn, cmd_content, cmd_commit_time, status) "
                            "VALUES (:sn, :cmd, :now, 0)"
                        ), {"sn": sn, "cmd": f"DATE TIME {correct_time}", "now": now})
                        db2.commit()
                        logger.info("Heartbeat: queued DATE TIME for %s on reconnect", sn)
                    finally:
                        db2.close()
                except Exception as te:
                    logger.warning("Heartbeat: failed to queue DATE TIME for %s: %s", sn, te)
    except Exception as exc:
        logger.error("Heartbeat DB error for %s: %s", sn, exc)
        db.rollback()
    finally:
        db.close()


def _db_get_targets() -> list:
    """Synchronous DB read — run in a thread executor."""
    db = SessionLocal()
    try:
        candidates = (
            db.query(Device)
            .filter(Device.ip_address.isnot(None),
                    Device.connection_mode.in_(["direct", "both"]))
            .all()
        )
        return [(d.id, d.ip_address, d.port or 4370,
                 d.serial_number or f"IP-{d.ip_address}") for d in candidates]
    finally:
        db.close()


async def _check_one(device_id: int, ip: str, port: int, sn: str) -> None:
    """Probe a single device and update its DB state without blocking the event loop."""
    reachable = await _tcp_reachable(ip, port)
    now = datetime.now(timezone.utc)
    await asyncio.get_event_loop().run_in_executor(
        None, _db_update_device, device_id, sn, reachable, now
    )


def reset_stale_states() -> None:
    """
    Called once at startup. Marks every device OFFLINE so the heartbeat loop
    starts from a clean slate — prevents a device that was online before shutdown
    from appearing online when the server restarts and the device is actually off.
    """
    STATE_OFFLINE = 3
    db = SessionLocal()
    try:
        db.query(Device).update({"status": DeviceStatus.OFFLINE})
        # Also reset IClockTerminal state for non-pending/non-rejected terminals
        from sqlalchemy import text
        db.execute(text(
            "UPDATE iclock_terminal SET state = :offline "
            "WHERE state = 1"  # only reset APPROVED (1) → OFFLINE (3)
        ), {"offline": STATE_OFFLINE})
        db.commit()
        logger.info("Heartbeat: reset all device states to OFFLINE on startup")
    except Exception as exc:
        logger.error("Heartbeat: failed to reset states on startup: %s", exc)
        db.rollback()
    finally:
        db.close()


async def heartbeat_loop() -> None:
    """
    Main heartbeat loop. Probes all direct-connected devices concurrently
    every HEARTBEAT_INTERVAL seconds. All DB I/O runs in a thread executor
    so the async event loop stays unblocked for HTTP requests.
    """
    logger.info("Device heartbeat started — probing every %ds", HEARTBEAT_INTERVAL)
    while True:
        await asyncio.sleep(HEARTBEAT_INTERVAL)
        try:
            targets = await asyncio.get_event_loop().run_in_executor(None, _db_get_targets)

            if targets:
                results = await asyncio.gather(
                    *[_check_one(*t) for t in targets],
                    return_exceptions=True,
                )
                for t, r in zip(targets, results):
                    if isinstance(r, Exception):
                        logger.error("Heartbeat error for %s: %s", t[1], r)

        except asyncio.CancelledError:
            logger.info("Device heartbeat stopped")
            break
        except Exception as exc:
            logger.error("Heartbeat loop error: %s", exc)
