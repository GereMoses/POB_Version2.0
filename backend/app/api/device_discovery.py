"""
Device Auto-Discovery API
─────────────────────────
Exposes the backend's automatic device detection to the UI so users never
need to type an IP address.

Two discovery paths:

ADMS (push-mode) devices:
  When a ZKTeco reader is configured to push events to this server it
  auto-registers itself at /iclock/cdata with its real IP address.  It
  lands in STATE_PENDING and must be approved before attendance is
  processed.  These endpoints let admins approve or reject those devices.

Direct / ZKLib devices:
  The background heartbeat already scans known subnets every 60 s.
  POST /scan triggers an on-demand scan of the same subnets.
  GET  /scan-status returns progress + found devices.

Routes (all under /api/v1/device-management/discovery):
  GET  /pending                 — ADMS devices awaiting approval
  POST /approve/{sn}            — approve a pending ADMS terminal
  POST /reject/{sn}             — reject a pending ADMS terminal
  POST /scan                    — trigger an immediate network scan
  GET  /scan-status             — current scan progress + results
  GET  /subnets                 — subnets that will be scanned
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.database import get_db, SessionLocal
from ..core.dependencies import get_current_user

router = APIRouter(
    prefix="/device-management/discovery",
    tags=["Device Auto-Discovery"],
)
logger = logging.getLogger(__name__)

# ── Scan state (in-process; good enough for single-leader deployments) ─────────
# Redis would be better for multi-worker, but the leader lock means only one
# worker runs the scanner, so this dict is always on the correct process.
_scan_state: Dict[str, Any] = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "subnets_scanned": [],
    "total_ips": 0,
    "probed": 0,
    "found": [],        # list of {"ip", "sn", "name", "registered_at"}
    "error": None,
}


# ─────────────────────────────────────────────────────────────────────────────
# Pending ADMS devices
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/pending")
async def list_pending_devices(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return all ADMS terminals in STATE_PENDING (state=0) — devices that have
    connected to the server but not yet been approved by an admin.

    For each terminal we also return the matching row from the devices table
    so the UI can show connection mode, last-seen time, etc.
    """
    rows = db.execute(text("""
        SELECT
            t.sn,
            t.ip_address,
            t.alias,
            t.device_name,
            t.fw_ver,
            t.platform,
            t.mac_address,
            t.pushver,
            t.user_count,
            t.fp_count,
            t.face_count,
            t.last_activity,
            t.state,
            d.id            AS device_id,
            d.name          AS device_name_ui,
            d.connection_mode,
            d.status        AS device_status,
            d.last_seen
        FROM iclock_terminal t
        LEFT JOIN devices d ON d.serial_number = t.sn
        WHERE t.state = 0           -- STATE_PENDING
        ORDER BY t.last_activity DESC NULLS LAST
    """)).fetchall()

    return {
        "count": len(rows),
        "pending": [
            {
                "sn":              r.sn,
                "ip_address":      r.ip_address,
                "alias":           r.alias or r.device_name or f"Terminal-{r.sn}",
                "device_name":     r.device_name,
                "firmware":        r.fw_ver,
                "platform":        r.platform,
                "mac_address":     r.mac_address,
                "push_version":    r.pushver,
                "user_count":      r.user_count,
                "fp_count":        r.fp_count,
                "face_count":      r.face_count,
                "last_seen":       r.last_activity.isoformat() if r.last_activity else None,
                "connection_mode": r.connection_mode or "adms",
                "device_id":       r.device_id,
            }
            for r in rows
        ],
    }


class ApproveBody(BaseModel):
    name: Optional[str] = None          # friendly label; defaults to alias/SN
    connection_mode: str = "adms"       # adms | direct | both
    auto_poll: bool = False
    poll_interval_sec: int = 300
    zone_id: Optional[int] = None
    reader_purpose: str = "ATTENDANCE"  # ATTENDANCE | ACCESS_ENTRY | ACCESS_EXIT | MUSTERING


@router.post("/approve/{sn}")
async def approve_pending_device(
    sn: str,
    body: ApproveBody,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Approve a pending ADMS terminal.  Sets iclock_terminal.state = 1 (APPROVED)
    so attendance records from this device start being processed.
    Also upserts a matching row in the devices table if one doesn't exist.
    """
    terminal = db.execute(text(
        "SELECT sn, ip_address, alias, device_name, fw_ver, mac_address FROM iclock_terminal WHERE sn = :sn"
    ), {"sn": sn}).fetchone()

    if not terminal:
        raise HTTPException(status_code=404, detail=f"Terminal {sn} not found")

    # Approve the terminal
    db.execute(text(
        "UPDATE iclock_terminal SET state = 1 WHERE sn = :sn"
    ), {"sn": sn})

    # Approving a device through the UI clears any prior deletion suppression.
    from .adms_protocol import unsuppress_device
    unsuppress_device(db, sn)

    # Upsert matching devices row
    friendly_name = (body.name or "").strip() or terminal.alias or terminal.device_name or f"ZKTeco-{sn}"
    existing_device = db.execute(text(
        "SELECT id FROM devices WHERE serial_number = :sn"
    ), {"sn": sn}).fetchone()

    # reader_purpose lives on iclock_terminal, not on devices
    if existing_device:
        db.execute(text("""
            UPDATE devices
            SET name = :name, connection_mode = :cm, auto_poll = :ap,
                poll_interval_sec = :pi, zone_id = :zid,
                ip_address = :ip, status = 'ONLINE'
            WHERE serial_number = :sn
        """), {
            "name": friendly_name,
            "cm":   body.connection_mode,
            "ap":   body.auto_poll,
            "pi":   body.poll_interval_sec,
            "zid":  body.zone_id,
            "ip":   terminal.ip_address,
            "sn":   sn,
        })
    else:
        db.execute(text("""
            INSERT INTO devices
                (name, serial_number, ip_address, port, connection_mode,
                 auto_poll, poll_interval_sec, zone_id, status)
            VALUES
                (:name, :sn, :ip, 4370, :cm, :ap, :pi, :zid, 'ONLINE')
            ON CONFLICT (serial_number) DO UPDATE SET
                name = EXCLUDED.name, ip_address = EXCLUDED.ip_address,
                connection_mode = EXCLUDED.connection_mode,
                auto_poll = EXCLUDED.auto_poll, status = 'ONLINE'
        """), {
            "name": friendly_name,
            "sn":   sn,
            "ip":   terminal.ip_address,
            "cm":   body.connection_mode,
            "ap":   body.auto_poll,
            "pi":   body.poll_interval_sec,
            "zid":  body.zone_id,
        })

    # Store reader_purpose on iclock_terminal where the column actually lives
    db.execute(text("""
        UPDATE iclock_terminal SET reader_purpose = :rp WHERE sn = :sn
    """), {"rp": body.reader_purpose, "sn": sn})

    db.commit()
    logger.info("Device %s approved by %s", sn, current_user.username)
    return {"success": True, "sn": sn, "message": f"Terminal {sn} approved and ready"}


@router.post("/reject/{sn}")
async def reject_pending_device(
    sn: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Reject a pending ADMS terminal (state = 2). The device will receive ERROR on next push."""
    result = db.execute(text(
        "UPDATE iclock_terminal SET state = 2 WHERE sn = :sn AND state = 0"
    ), {"sn": sn})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"Terminal {sn} not found or not in pending state")
    db.commit()
    logger.info("Device %s rejected by %s", sn, current_user.username)
    return {"success": True, "sn": sn, "message": f"Terminal {sn} rejected"}


# ─────────────────────────────────────────────────────────────────────────────
# On-demand network scan
# ─────────────────────────────────────────────────────────────────────────────

class ConfigureDeviceBody(BaseModel):
    name: str
    reader_purpose: str = "ATTENDANCE"   # ATTENDANCE | ACCESS_ENTRY | ACCESS_EXIT | MUSTERING
    connection_mode: str = "direct"      # direct | adms | both
    auto_poll: bool = True
    poll_interval_sec: int = 300
    zone_id: Optional[int] = None
    comm_key: str = "0"                  # ZKTeco device communication password
    ip_address: Optional[str] = None    # required for upsert if auto-registration failed
    port: int = 4370


@router.patch("/configure/{sn}")
async def configure_discovered_device(
    sn: str,
    body: ConfigureDeviceBody,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Configure (or register) a device found by the network scanner.
    Does an UPSERT: updates the existing devices row when the scanner
    already auto-registered it, or inserts a new row if auto-registration
    failed silently during the scan.  ip_address must be provided when
    the device is not yet in the database.
    """
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    # reader_purpose lives on iclock_terminal, not devices — keep params separate
    device_params = {
        "name": name,
        "cm":   body.connection_mode,
        "ap":   body.auto_poll,
        "pi":   body.poll_interval_sec,
        "zid":  body.zone_id,
        "sn":   sn,
    }

    # If the scan found a new IP, carry it through so the poller connects correctly
    ip_clause = ", ip_address = :ip" if body.ip_address else ""
    ip_val    = {"ip": body.ip_address} if body.ip_address else {}

    # Try to update an existing row first
    result = db.execute(text(f"""
        UPDATE devices
        SET name              = :name,
            connection_mode   = :cm,
            auto_poll         = :ap,
            poll_interval_sec = :pi,
            zone_id           = :zid,
            status            = 'ONLINE'
            {ip_clause}
        WHERE serial_number = :sn
        RETURNING id
    """), {**device_params, **ip_val}).fetchone()

    if not result:
        # Auto-registration failed during scan — insert the row now
        if not body.ip_address:
            raise HTTPException(
                status_code=404,
                detail=f"Device {sn} not found and no IP provided to register it.",
            )
        db.execute(text("""
            INSERT INTO devices
                (name, serial_number, ip_address, port, connection_mode,
                 auto_poll, poll_interval_sec, zone_id, status)
            VALUES
                (:name, :sn, :ip, :port, :cm, :ap, :pi, :zid, 'online')
            ON CONFLICT (serial_number) DO UPDATE SET
                name              = EXCLUDED.name,
                ip_address        = EXCLUDED.ip_address,
                connection_mode   = EXCLUDED.connection_mode,
                auto_poll         = EXCLUDED.auto_poll,
                poll_interval_sec = EXCLUDED.poll_interval_sec,
                zone_id           = EXCLUDED.zone_id,
                status            = 'ONLINE'
        """), {**device_params, "ip": body.ip_address, "port": body.port})

    # Upsert iclock_terminal so the device always appears in the device list UI.
    # For ADMS devices the row already exists and we just update metadata.
    # For ZKLib-direct devices discovered by scan the row may not exist yet — create it.
    db.execute(text("""
        INSERT INTO iclock_terminal
            (sn, alias, ip_address, state, connection_mode, reader_purpose, comm_key,
             last_activity, heartbeat_interval, att_stamp, op_stamp, pushver)
        VALUES
            (:sn, :name, :ip, 1, :cm, :rp, :ck,
             now(), 30, 0, 0, '1.0')
        ON CONFLICT (sn) DO UPDATE SET
            alias          = EXCLUDED.alias,
            ip_address     = COALESCE(EXCLUDED.ip_address, iclock_terminal.ip_address),
            reader_purpose = EXCLUDED.reader_purpose,
            connection_mode= EXCLUDED.connection_mode,
            comm_key       = EXCLUDED.comm_key
    """), {
        "sn":  sn,
        "name": name,
        "ip":  body.ip_address,
        "cm":  body.connection_mode,
        "rp":  body.reader_purpose,
        "ck":  body.comm_key,
    })

    db.commit()
    logger.info("Device %s configured by %s: name=%s purpose=%s", sn, current_user.username, name, body.reader_purpose)
    return {
        "success": True,
        "sn":      sn,
        "name":    name,
        "message": f"Device '{name}' added to device list",
    }


@router.get("/adms-info")
async def get_adms_info(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return the ADMS push URL that device admins must configure on ZKTeco readers.
    Displayed in the Auto-Detect panel so admins know exactly what to enter on the reader.

    Source of truth is the UI-editable `adms.server_url` parameter (sys_parameters),
    set via PUT /api/device/adms-config. This lets admins change the public address
    from the UI with immediate effect — no .env edit or restart. We fall back to the
    PUBLIC_HOST env var, then app settings, then a placeholder.

    Note: this only changes what admins are told to enter on readers. Readers store
    the address in their own firmware, so a changed public IP still requires either
    re-entering it on each reader OR (recommended) configuring readers with a stable
    domain name / DDNS hostname so the IP can change behind it without touching readers.
    """
    import os
    from ..core.config import settings

    # 1. UI-set value (full URL or bare host), stored in sys_parameters.
    server_url = (db.execute(
        text("SELECT param_value FROM sys_parameters WHERE param_key = 'adms.server_url'")
    ).scalar() or "").strip()

    if server_url:
        # Normalise to a full cdata URL whether the admin saved a bare host,
        # a base URL, or the full endpoint.
        base = server_url.rstrip("/")
        adms_url = base if "/iclock/" in base else f"{base}/iclock/cdata"
        if not adms_url.startswith(("http://", "https://")):
            adms_url = f"http://{adms_url}"
    else:
        host = os.getenv("PUBLIC_HOST", "") or getattr(settings, "PUBLIC_HOST", "") \
            or "YOUR_SERVER_IP_OR_HOSTNAME"
        adms_url = f"http://{host}/iclock/cdata"

    return {
        "adms_url":  adms_url,
        "adms_port": 80,
        "configured": bool(server_url),
        "note":      "On each ZKTeco reader go to: Cloud Settings → Server → set Server Address to this URL. "
                     "Tip: use a domain name / DDNS hostname here so the public IP can change without "
                     "reconfiguring readers.",
    }


@router.get("/subnets")
async def list_scan_subnets(
    current_user=Depends(get_current_user),
):
    """
    Return the subnets that will be scanned, the server's detected local IPs,
    and a warning when running in Docker bridge mode where the LAN is not visible.
    """
    import os, ipaddress as _ipaddress
    try:
        from ..services.zkteco.device_heartbeat import (
            _db_get_subnets_to_scan,
            _get_local_interface_subnets,
        )
        local_iface_subnets = await asyncio.get_event_loop().run_in_executor(
            None, _get_local_interface_subnets
        )
        subnets = await asyncio.get_event_loop().run_in_executor(None, _db_get_subnets_to_scan)

        local_ips = [ip for ip, _ in local_iface_subnets]

        # Warn when every detected local IP is a Docker internal address
        # (172.16-31.x.x / 10.x.x.x private ranges used by Docker bridge).
        docker_ranges = [
            _ipaddress.IPv4Network("172.16.0.0/12"),  # Docker bridge default pool
            _ipaddress.IPv4Network("10.0.0.0/8"),     # Docker overlay / custom networks
        ]

        def _is_docker_internal(ip: str) -> bool:
            try:
                addr = _ipaddress.IPv4Address(ip)
                return any(addr in net for net in docker_ranges)
            except Exception:
                return False

        in_docker_bridge = bool(local_ips) and all(_is_docker_internal(ip) for ip in local_ips)

        warning = None
        if in_docker_bridge:
            warning = (
                "Server appears to be inside a Docker bridge network — only Docker-internal IPs "
                "were detected. The backend container must use 'network_mode: host' (Linux) so "
                "it can see the real LAN interfaces. Alternatively set DEVICE_SCAN_SUBNETS to "
                "your LAN range (e.g. 192.168.1.0/24)."
            )

        return {
            "subnets":   [str(s) for s in subnets],
            "count":     len(subnets),
            "local_ips": local_ips,
            "warning":   warning,
            "note":      (
                "Set DEVICE_SCAN_SUBNETS=10.x.x.0/24 env var to add extra ranges. "
                "On Linux with host networking the server auto-detects its own LAN."
            ),
        }
    except Exception as exc:
        return {"subnets": [], "count": 0, "error": str(exc)}


@router.post("/scan")
async def trigger_network_scan(
    current_user=Depends(get_current_user),
):
    """
    Trigger an immediate ZKLib network scan on all known subnets.
    Results are available at GET /scan-status.
    Safe to call while the background scan is running — it will not start a duplicate.
    """
    if _scan_state["running"]:
        return {
            "started": False,
            "message": "Scan already in progress",
            "status": _scan_state,
        }

    # Start scan as a background task so the HTTP response returns immediately
    asyncio.create_task(_run_discovery_scan())
    return {
        "started": True,
        "message": "Network scan started — poll /scan-status for progress",
    }


@router.get("/scan-status")
async def get_scan_status(
    current_user=Depends(get_current_user),
):
    """Return current scan progress and any devices found so far."""
    return {
        "running":          _scan_state["running"],
        "started_at":       _scan_state["started_at"],
        "finished_at":      _scan_state["finished_at"],
        "subnets_scanned":  _scan_state["subnets_scanned"],
        "total_ips":        _scan_state["total_ips"],
        "probed":           _scan_state["probed"],
        "found_count":      len(_scan_state["found"]),
        "found":            _scan_state["found"],
        "error":            _scan_state["error"],
        "progress_pct": (
            round(_scan_state["probed"] / _scan_state["total_ips"] * 100)
            if _scan_state["total_ips"] > 0 else 0
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Internal scan runner
# ─────────────────────────────────────────────────────────────────────────────

async def _run_discovery_scan() -> None:
    """
    Async scan runner — mirrors device_heartbeat._scan_subnets() but writes
    results to _scan_state for the API to surface.
    Probes up to 30 IPs concurrently.
    """
    import ipaddress
    from ..services.zkteco.device_heartbeat import (
        _db_get_subnets_to_scan,
        _tcp_reachable,
        _fetch_sn_sync,
        _db_register_new_device,
        ZKTECO_PORT,
    )

    _scan_state["running"]         = True
    _scan_state["started_at"]      = datetime.now(timezone.utc).isoformat()
    _scan_state["finished_at"]     = None
    _scan_state["error"]           = None
    _scan_state["found"]           = []
    _scan_state["probed"]          = 0
    _scan_state["subnets_scanned"] = []

    try:
        loop = asyncio.get_event_loop()

        # Gather subnets — probe ALL hosts (including known IPs) so devices whose
        # DHCP address changed are automatically re-discovered.
        subnets = await loop.run_in_executor(None, _db_get_subnets_to_scan)

        # Snapshot of known SNs so we can label results as "ip updated" vs "new"
        db = SessionLocal()
        try:
            known_rows = db.execute(text(
                "SELECT ip_address, serial_number FROM devices WHERE ip_address IS NOT NULL"
            )).fetchall()
            known_ips = {r[0] for r in known_rows}
            known_sns = {r[1] for r in known_rows if r[1]}
        finally:
            db.close()

        if not subnets:
            _scan_state["error"] = (
                "No subnets to scan. The server could not detect any network interfaces. "
                "Set DEVICE_SCAN_SUBNETS=192.168.x.0/24 in the environment."
            )
            return

        all_ips = []
        for net in subnets:
            _scan_state["subnets_scanned"].append(str(net))
            all_ips.extend(str(host) for host in net.hosts())

        _scan_state["total_ips"] = len(all_ips)
        logger.info("Discovery scan: probing %d IPs across %d subnets", len(all_ips), len(subnets))

        now = datetime.now(timezone.utc)
        SEM = asyncio.Semaphore(30)  # max 30 concurrent probes

        async def _probe_one(ip: str) -> None:
            async with SEM:
                try:
                    if await _tcp_reachable(ip, ZKTECO_PORT):
                        sn = await loop.run_in_executor(None, _fetch_sn_sync, ip)
                        if sn and not sn.startswith("IP-"):
                            await loop.run_in_executor(None, _db_register_new_device, ip, sn, now)
                            _scan_state["found"].append({
                                "ip":            ip,
                                "sn":            sn,
                                "name":          f"ZKTeco-{ip}",
                                "registered_at": now.isoformat(),
                                "already_known": ip in known_ips or sn in known_sns,
                            })
                            logger.info("Discovery scan: found ZKTeco %s at %s", sn, ip)
                except Exception as exc:
                    logger.debug("Discovery scan: probe %s error: %s", ip, exc)
                finally:
                    _scan_state["probed"] += 1

        await asyncio.gather(*[_probe_one(ip) for ip in all_ips], return_exceptions=True)

    except Exception as exc:
        logger.error("Discovery scan failed: %s", exc)
        _scan_state["error"] = str(exc)
    finally:
        _scan_state["running"]     = False
        _scan_state["finished_at"] = datetime.now(timezone.utc).isoformat()
        logger.info(
            "Discovery scan complete: %d found, %d probed, %d subnets",
            len(_scan_state["found"]), _scan_state["probed"],
            len(_scan_state["subnets_scanned"]),
        )
