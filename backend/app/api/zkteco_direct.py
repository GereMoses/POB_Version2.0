"""
ZKTeco Direct IP Connection API

Provides REST endpoints for managing ZKTeco readers connected by IP address
via the ZKLib protocol (TCP port 4370).  Works with the Huros H1 and other
ZKTeco access/attendance terminals that support the ZK SDK protocol.

All routes live under /api/v1/zkteco/direct/...
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.device import Device, DeviceStatus, DeviceType
from ..models.biotime_models import IClockTerminal
from ..services.zkteco.direct_connection import zkteco_direct

router = APIRouter(prefix="/direct", tags=["ZKTeco Direct IP"])


# ─────────────────────────────────────────── #
# Request / Response schemas                  #
# ─────────────────────────────────────────── #

class DeviceRegisterRequest(BaseModel):
    ip_address: str = Field(..., description="Reader IP address")
    port: int = Field(4370, description="ZKLib port (default 4370)")
    name: str = Field(..., description="Friendly name for this reader")
    zone_id: Optional[int] = None
    location_description: Optional[str] = None
    device_password: int = Field(0, description="ZKTeco device communication password (0 if not set)")
    connection_mode: str = Field(
        "direct",
        description="'adms' — device pushes events; 'direct' — server polls via ZKLib; 'both' — dual mode",
    )
    auto_poll: bool = Field(True, description="Automatically poll this device for attendance records")
    skip_connection_test: bool = Field(
        False,
        description="Register without verifying ZKLib connectivity — use for ADMS/push-mode devices "
                    "where port 4370 is blocked but the device will connect inbound via ADMS.",
    )
    poll_interval_sec: int = Field(300, ge=60, description="Seconds between automatic polls (min 60)")


class PollConfigRequest(BaseModel):
    connection_mode: Optional[str] = Field(None, description="adms | direct | both")
    auto_poll: Optional[bool] = None
    poll_interval_sec: Optional[int] = Field(None, ge=60)


class UserSetRequest(BaseModel):
    uid: int = Field(..., description="Numeric slot on device (1 – 30000)")
    name: str = Field(..., max_length=24)
    user_id: str = Field(..., description="Badge / employee ID")
    privilege: int = Field(0, description="0=user, 2=enroller, 6=manager, 14=admin")
    password: str = Field("", description="PIN shown on device keypad")
    group_id: str = Field("")
    card: int = Field(0, description="RFID card number")
    device_password: int = 0


class UserDeleteRequest(BaseModel):
    uid: int
    device_password: int = 0


class SyncPersonnelRequest(BaseModel):
    personnel_ids: Optional[List[int]] = Field(None, description="Subset to sync; omit for all active")
    device_password: int = 0


class TimeSyncRequest(BaseModel):
    target_time: Optional[datetime] = Field(None, description="ISO datetime; omit for current UTC")
    device_password: int = 0


class DoorOpenRequest(BaseModel):
    hold_seconds: int = Field(5, ge=1, le=60, description="Seconds to hold relay open")
    device_password: int = 0


class DeviceControlRequest(BaseModel):
    device_password: int = 0


# ─────────────────────────────────────────── #
# Helper                                      #
# ─────────────────────────────────────────── #

def _get_device_by_id(device_id: int, db: Session) -> Device:
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not device.ip_address:
        raise HTTPException(status_code=400, detail="Device has no IP address configured")
    return device


def _ok(result: dict):
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result.get("error", "Device communication failed"),
        )
    return result


# ─────────────────────────────────────────── #
# Device registration                         #
# ─────────────────────────────────────────── #

@router.post("/devices", summary="Register a ZKTeco reader by IP address")
async def register_device(
    body: DeviceRegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register a ZKTeco reader so the system can talk to it directly.
    A test connection is performed immediately; the endpoint fails if the
    reader cannot be reached.
    """
    # Test connection first (skip if explicitly requested — e.g. ADMS-only devices
    # where port 4370 is blocked but the device will connect inbound via ADMS).
    probe: dict = {}
    if body.skip_connection_test or body.connection_mode == "adms":
        # No ZKLib test — device is ADMS-push only
        probe = {"connected": False, "serial_number": None}
    else:
        probe = await zkteco_direct.test_connection(
            body.ip_address, body.port, password=body.device_password
        )
        if not probe.get("connected"):
            raise HTTPException(
                status_code=502,
                detail=f"Cannot reach reader at {body.ip_address}:{body.port} — {probe.get('error')}",
            )

    sn = probe.get("serial_number") or f"ADMS-{body.ip_address.replace('.', '-')}"
    device_id = f"ZK-{sn}"

    # Upsert into devices table — check by device_id first, then by serial_number.
    # Devices registered via the discovery/scan flow may have no device_id but the
    # same serial_number, which caused "Record already exists" on re-registration.
    existing = (
        db.query(Device).filter(Device.device_id == device_id).first()
        or db.query(Device).filter(Device.serial_number == sn).first()
    )
    if existing:
        existing.device_id         = device_id          # ensure device_id is stamped
        existing.ip_address        = body.ip_address
        existing.port              = body.port
        existing.name              = body.name
        existing.zone_id           = body.zone_id
        existing.location_description = body.location_description
        existing.status            = DeviceStatus.ONLINE
        existing.last_seen         = datetime.utcnow()
        existing.firmware_version  = probe.get("firmware")
        existing.connection_mode   = body.connection_mode
        existing.auto_poll         = body.auto_poll
        existing.poll_interval_sec = body.poll_interval_sec
        db.commit()
        db.refresh(existing)
        device = existing
    else:
        device = Device(
            device_id=device_id,
            name=body.name,
            serial_number=sn,
            model=probe.get("device_name", "ZKTeco"),
            manufacturer="ZKTeco",
            device_type=DeviceType.BIOMETRIC_READER,
            firmware_version=probe.get("firmware"),
            ip_address=body.ip_address,
            port=body.port,
            zone_id=body.zone_id,
            location_description=body.location_description,
            status=DeviceStatus.ONLINE,
            last_seen=datetime.utcnow(),
            supported_biometrics={"fingerprint": True, "face": True, "card": True},
            connection_mode=body.connection_mode,
            auto_poll=body.auto_poll,
            poll_interval_sec=body.poll_interval_sec,
        )
        db.add(device)
        db.commit()
        db.refresh(device)

    # Upsert IClockTerminal so the terminal list shows the device as online
    now = datetime.utcnow()
    fw = probe.get("firmware") or ""
    platform = probe.get("platform") or ""
    hw_device_name = (probe.get("device_name") or "").strip() or platform or "ZKTeco"

    term = db.query(IClockTerminal).filter(IClockTerminal.sn == sn).first()
    if not term:
        term = IClockTerminal(
            sn=sn,
            alias=body.name,
            ip_address=body.ip_address,
            state=1,
            last_activity=now,
            device_name=hw_device_name,
            device_model=platform,
            fw_ver=fw,
        )
        db.add(term)
    else:
        term.alias = body.name
        term.ip_address = body.ip_address
        term.state = 1
        term.last_activity = now
        term.device_name = hw_device_name
        term.device_model = platform
        term.fw_ver = fw
    db.commit()

    return {
        "success": True,
        "device_id": device.id,
        "device_key": device_id,
        "serial_number": sn,
        "firmware": probe.get("firmware"),
        "device_name": probe.get("device_name"),
        "mac": probe.get("mac"),
        "ip": body.ip_address,
        "port": body.port,
    }


@router.get("/devices", summary="List all IP-registered ZKTeco readers")
def list_devices(db: Session = Depends(get_db)):
    devices = (
        db.query(Device)
        .filter(Device.device_id.like("ZK-%"))
        .order_by(Device.name)
        .all()
    )
    return {
        "devices": [
            {
                "id": d.id,
                "device_id": d.device_id,
                "name": d.name,
                "serial_number": d.serial_number,
                "ip_address": d.ip_address,
                "port": d.port,
                "status": d.status,
                "zone_id": d.zone_id,
                "location": d.location_description,
                "firmware": d.firmware_version,
                "last_seen": d.last_seen,
            }
            for d in devices
        ],
        "count": len(devices),
    }


# ─────────────────────────────────────────── #
# Connection test                             #
# ─────────────────────────────────────────── #

@router.get("/devices/{device_id}/ping", summary="Test live connection to reader")
async def ping_device(device_id: int, db: Session = Depends(get_db)):
    """Open a connection and return real-time device info (serial, firmware, counts)."""
    device = _get_device_by_id(device_id, db)
    result = await zkteco_direct.test_connection(device.ip_address, device.port)

    # Update status in devices table
    now = datetime.utcnow()
    device.status = DeviceStatus.ONLINE if result.get("connected") else DeviceStatus.OFFLINE
    if result.get("connected"):
        device.last_seen = now
    db.commit()

    # Update last_activity + device info on IClockTerminal
    if device.serial_number and result.get("connected"):
        term = db.query(IClockTerminal).filter(IClockTerminal.sn == device.serial_number).first()
        if term:
            term.last_activity = now
            platform = result.get("platform") or ""
            hw_name = (result.get("device_name") or "").strip() or platform or "ZKTeco"
            term.device_name = hw_name
            term.device_model = platform
            term.fw_ver = result.get("firmware") or term.fw_ver
            db.commit()

    return result


# ─────────────────────────────────────────── #
# Users on device                             #
# ─────────────────────────────────────────── #

@router.get("/devices/{device_id}/users", summary="Read all users stored on the device")
async def get_device_users(device_id: int, db: Session = Depends(get_db)):
    device = _get_device_by_id(device_id, db)
    return _ok(await zkteco_direct.get_users(device.ip_address, device.port))


@router.post("/devices/{device_id}/users", summary="Create or update a user on the device")
async def set_device_user(
    device_id: int, body: UserSetRequest, db: Session = Depends(get_db)
):
    device = _get_device_by_id(device_id, db)
    return _ok(
        await zkteco_direct.set_user(
            ip=device.ip_address,
            port=device.port,
            uid=body.uid,
            name=body.name,
            privilege=body.privilege,
            password=body.password,
            group_id=body.group_id,
            user_id=body.user_id,
            card=body.card,
            device_password=body.device_password,
        )
    )


@router.delete("/devices/{device_id}/users/{uid}", summary="Delete a user from the device")
async def delete_device_user(
    device_id: int, uid: int, device_password: int = 0, db: Session = Depends(get_db)
):
    device = _get_device_by_id(device_id, db)
    return _ok(
        await zkteco_direct.delete_user(
            ip=device.ip_address, uid=uid, port=device.port, device_password=device_password
        )
    )


# ─────────────────────────────────────────── #
# Personnel sync (DB → device)                #
# ─────────────────────────────────────────── #

@router.post("/devices/{device_id}/sync-personnel", summary="Push all active personnel to the device")
async def sync_personnel(
    device_id: int, body: SyncPersonnelRequest, db: Session = Depends(get_db)
):
    """
    Reads active Personnel records from the database and writes each one as a
    user on the ZKTeco reader.  Optionally restrict to a specific list of IDs.
    """
    device = _get_device_by_id(device_id, db)
    return _ok(
        await zkteco_direct.sync_personnel_from_db(
            ip=device.ip_address,
            port=device.port,
            device_password=body.device_password,
            personnel_ids=body.personnel_ids,
            db=db,
        )
    )


# ─────────────────────────────────────────── #
# Attendance / access log pull                #
# ─────────────────────────────────────────── #

@router.get("/devices/{device_id}/attendance", summary="Pull attendance records from device")
async def pull_attendance(
    device_id: int,
    since: Optional[datetime] = None,
    device_password: int = 0,
    db: Session = Depends(get_db),
):
    """
    Pull all (or post-*since*) attendance records from the device's internal log.
    Records are returned as-is; use POST /api/v1/attendance for saving them.
    """
    device = _get_device_by_id(device_id, db)
    return _ok(
        await zkteco_direct.get_attendance(
            ip=device.ip_address,
            port=device.port,
            device_password=device_password,
            since=since,
        )
    )


@router.delete("/devices/{device_id}/attendance", summary="Erase all attendance records on device")
async def clear_attendance(
    device_id: int, body: DeviceControlRequest, db: Session = Depends(get_db)
):
    device = _get_device_by_id(device_id, db)
    return _ok(
        await zkteco_direct.clear_attendance(
            ip=device.ip_address, port=device.port, device_password=body.device_password
        )
    )


# ─────────────────────────────────────────── #
# Device control                              #
# ─────────────────────────────────────────── #

@router.post("/devices/{device_id}/sync-time", summary="Synchronise device clock to server time")
async def sync_device_time(
    device_id: int, body: TimeSyncRequest, db: Session = Depends(get_db)
):
    from ..services.zkteco.live_capture import with_device_released
    device = _get_device_by_id(device_id, db)
    return _ok(
        await with_device_released(
            device_id,
            zkteco_direct.sync_time(
                ip=device.ip_address,
                port=device.port or 4370,
                device_password=body.device_password,
                target_time=body.target_time,
            ),
        )
    )


@router.post("/devices/{device_id}/open-door", summary="Remotely unlock the door relay")
async def open_door(
    device_id: int, body: DoorOpenRequest, db: Session = Depends(get_db)
):
    """
    Sends an unlock command to the reader.  The relay stays open for
    *hold_seconds* (1–60).  Supported on access-control terminals with a Wiegand
    output such as the ZKTeco Huros H1.
    """
    device = _get_device_by_id(device_id, db)
    return _ok(
        await zkteco_direct.open_door(
            ip=device.ip_address,
            port=device.port,
            device_password=body.device_password,
            hold_seconds=body.hold_seconds,
        )
    )


@router.post("/devices/{device_id}/restart", summary="Remotely restart the device")
async def restart_device(
    device_id: int, body: DeviceControlRequest, db: Session = Depends(get_db)
):
    device = _get_device_by_id(device_id, db)
    return _ok(
        await zkteco_direct.restart_device(
            ip=device.ip_address, port=device.port, device_password=body.device_password
        )
    )


@router.post("/devices/{device_id}/disable", summary="Disable local authentication on device")
async def disable_device(
    device_id: int, body: DeviceControlRequest, db: Session = Depends(get_db)
):
    """Lock the reader so no local biometric/card auth is processed (emergency lockdown)."""
    device = _get_device_by_id(device_id, db)
    return _ok(
        await zkteco_direct.disable_device(
            ip=device.ip_address, port=device.port, device_password=body.device_password
        )
    )


@router.post("/devices/{device_id}/enable", summary="Re-enable local authentication on device")
async def enable_device(
    device_id: int, body: DeviceControlRequest, db: Session = Depends(get_db)
):
    device = _get_device_by_id(device_id, db)
    return _ok(
        await zkteco_direct.enable_device(
            ip=device.ip_address, port=device.port, device_password=body.device_password
        )
    )


# ─────────────────────────────────────────── #
# Quick ad-hoc connect (no DB registration)   #
# ─────────────────────────────────────────── #

class QuickConnectRequest(BaseModel):
    ip_address: str
    port: int = 4370
    device_password: int = 0


@router.post("/quick-ping", summary="Test a reader by IP without registering it")
async def quick_ping(body: QuickConnectRequest):
    """Useful for discovery: test whether a reader is reachable before registering."""
    return await zkteco_direct.test_connection(
        body.ip_address, body.port, password=body.device_password
    )


@router.post("/quick-get-time", summary="Read device clock by IP (no registration needed)")
async def quick_get_time(body: QuickConnectRequest, db: Session = Depends(get_db)):
    from ..services.zkteco.live_capture import with_device_released
    # Look up device_id so we can release the live-capture connection if needed
    dev = db.query(Device).filter(Device.ip_address == body.ip_address).first()
    coro = zkteco_direct.get_time(body.ip_address, body.port, device_password=body.device_password)
    if dev:
        result = await with_device_released(dev.id, coro)
    else:
        result = await coro
    return _ok(result)


@router.post("/quick-sync-time", summary="Sync device clock to server time by IP")
async def quick_sync_time(body: QuickConnectRequest, db: Session = Depends(get_db)):
    from ..services.zkteco.live_capture import with_device_released
    from ..api.adms_protocol import queue_command
    dev = db.query(Device).filter(Device.ip_address == body.ip_address).first()

    # Try ZKLib direct sync first
    coro = zkteco_direct.sync_time(ip=body.ip_address, port=body.port, device_password=body.device_password)
    if dev:
        result = await with_device_released(dev.id, coro)
    else:
        result = await coro

    if result.get("success"):
        return result

    # ZKLib failed — fall back to the ADMS clock-sync command queue.
    sn = (dev.serial_number if dev else None) or body.ip_address
    term = db.query(IClockTerminal).filter(IClockTerminal.sn == sn).first()
    if not term and dev and dev.serial_number:
        term = db.query(IClockTerminal).filter(IClockTerminal.sn == dev.serial_number).first()
    if not term:
        # Last resort: look up by IP
        term = db.query(IClockTerminal).filter(IClockTerminal.ip_address == body.ip_address).first()

    if term:
        # Strict plane separation: a direct-only reader doesn't poll the ADMS queue,
        # so don't black-hole a command — report the ZKLib failure instead.
        from .adms_protocol import queue_clock_sync, _is_direct_only
        if _is_direct_only(term.sn, db):
            raise HTTPException(status_code=502, detail=(
                f"Direct (ZKLib) sync failed: {result.get('error')}. Reader is "
                "direct-only and does not poll for ADMS commands — nothing queued."))
        correct_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        try:
            # SET OPTIONS DateTime=<enc> — push firmware rejects "DATE TIME <str>".
            queue_clock_sync(term.sn, db)
            return {
                "success": True,
                "method": "adms_queued",
                "set_to": correct_time,
                "device_reports": f"queued for next heartbeat (ADMS)",
            }
        except Exception as qe:
            raise HTTPException(status_code=502, detail=f"ZKLib: {result.get('error')} | ADMS queue: {qe}")

    raise HTTPException(status_code=502, detail=result.get("error"))


# ─────────────────────────────────────────── #
# Polling configuration                       #
# ─────────────────────────────────────────── #

@router.patch("/devices/{device_id}/poll-config", summary="Update connection mode and polling settings")
def update_poll_config(
    device_id: int, body: PollConfigRequest, db: Session = Depends(get_db)
):
    """
    Change how the system connects to this device:

    - **connection_mode = adms** — device pushes events; server never polls (use for ADMS-capable devices)
    - **connection_mode = direct** — server polls via ZKLib; no ADMS expected (use for non-ADMS devices)
    - **connection_mode = both** — ADMS push + periodic pull as backup (dual-mode devices)

    Set **auto_poll = true** and **poll_interval_sec** to enable automatic background polling.
    """
    device = _get_device_by_id(device_id, db)
    if body.connection_mode is not None:
        if body.connection_mode not in ("adms", "direct", "both"):
            raise HTTPException(400, "connection_mode must be adms, direct, or both")
        device.connection_mode = body.connection_mode
    if body.auto_poll is not None:
        device.auto_poll = body.auto_poll
    if body.poll_interval_sec is not None:
        device.poll_interval_sec = body.poll_interval_sec
    db.commit()
    return {
        "success": True,
        "device_id": device_id,
        "connection_mode": device.connection_mode,
        "auto_poll": device.auto_poll,
        "poll_interval_sec": device.poll_interval_sec,
        "last_attendance_pull": device.last_attendance_pull,
    }


@router.post("/devices/{device_id}/poll-now", summary="Manually trigger an attendance pull right now")
async def poll_now(
    device_id: int,
    device_password: int = 0,
    db: Session = Depends(get_db),
):
    """
    Immediately pull attendance records from the device and save new ones to the database.
    Works for both poll-mode and ADMS devices (useful for catching up after downtime).
    The response includes how many records were pulled and how many were new.
    """
    from ..services.zkteco.device_poller import poll_device

    device = _get_device_by_id(device_id, db)
    result = await poll_device(device, db)
    if not result.get("success"):
        raise HTTPException(502, detail=result.get("error", "Poll failed"))
    return result
