"""
Device control-plane resolution — ONE rule, shared by every command path.

Three mutually-exclusive planes; a command for a device must only ever travel its
own plane, never another:

  • adms        — reader polls /iclock/getrequest; commands are QUEUED (Horus T&A,
                  and any push-capable reader).
  • direct      — server opens a ZKLib/pyzk TCP session and runs the command NOW
                  (standalone networked F-series readers).
  • controller  — InBio/C3 access panel (C3/PULL protocol). No driver yet → every
                  generic command path must REFUSE it (so it's never queued or sent
                  ZKLib by mistake). Controller-specific endpoints handle it.

This is a leaf module (only sqlalchemy) so api/device_management, api/adms_protocol
and api/device_enrollment can all import it without circular imports.
"""

from typing import Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session

PLANE_ADMS       = "adms"
PLANE_DIRECT     = "direct"
PLANE_CONTROLLER = "controller"


def _modes(sn: str, db: Session) -> Tuple[str, str, str]:
    """Return (devices.connection_mode, iclock_terminal.connection_mode, ip)."""
    row = db.execute(text("""
        SELECT lower(coalesce(d.connection_mode, '')) AS dm,
               lower(coalesce(t.connection_mode, '')) AS tm,
               coalesce(d.ip_address, t.ip_address)   AS ip
        FROM (SELECT :sn AS sn) x
        LEFT JOIN devices         d ON d.serial_number = :sn
        LEFT JOIN iclock_terminal t ON t.sn            = :sn
        LIMIT 1
    """), {"sn": sn}).fetchone()
    if not row:
        return "", "", None
    return (row.dm or ""), (row.tm or ""), row.ip


def connection_mode(sn: str, db: Session) -> str:
    """Resolve a device's effective connection_mode. A 'controller' flag in EITHER
    table wins (mis-routing a panel is the dangerous case)."""
    dm, tm, _ = _modes(sn, db)
    if PLANE_CONTROLLER in (dm, tm):
        return PLANE_CONTROLLER
    return dm or tm or PLANE_ADMS


def plane_of(sn: str, db: Session) -> str:
    """The control plane a command must travel for this device."""
    dm, tm, ip = _modes(sn, db)
    if PLANE_CONTROLLER in (dm, tm):
        return PLANE_CONTROLLER
    mode = dm or tm or PLANE_ADMS
    return PLANE_DIRECT if (mode in ("direct", "both") and ip) else PLANE_ADMS


def is_controller(sn: str, db: Session) -> bool:
    return connection_mode(sn, db) == PLANE_CONTROLLER


def is_direct_only(sn: str, db: Session) -> bool:
    """True if the device is reachable ONLY by direct ZKLib TCP and does NOT poll
    /iclock/getrequest — so an ADMS command QUEUED for it would never be delivered.

    Used to refuse the ADMS-queue-only command endpoints (push-templates,
    push-timezones, push-access-levels, query-attlog) for such a reader instead of
    silently black-holing the command in iclock_devcmd.

    Note: 'both' is NOT direct-only — it polls getrequest too, so queued commands
    DO reach it. 'controller' is handled separately by is_controller()."""
    dm, tm, _ = _modes(sn, db)
    if PLANE_CONTROLLER in (dm, tm):
        return False
    mode = dm or tm or PLANE_ADMS
    return mode == PLANE_DIRECT
