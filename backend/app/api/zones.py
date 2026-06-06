"""
Zone / Area Management API
"""
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional
import logging
import asyncio
import json

from sqlalchemy import text

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.zone import Zone, ZonePersonnelAssignment
from ..models.biotime_models import PersonnelArea as BioTimeArea
from ..core.websocket import zone_ws_connect, zone_ws_disconnect, broadcast_zone_update

logger = logging.getLogger(__name__)

router = APIRouter()


ZONE_TYPE_LABELS = {
    "LOCATION": "Location",
    "MUSTER_POINT": "Muster Point",
    "WORK_AREA": "Work Area",
    "OUTSIDE": "Outside Area",
    "TRANSIT": "In Transit",
    "RESTRICTED": "Restricted",
    "PUBLIC": "Public",
    "SAFE_HAVEN": "Safe Haven",
    "ACCOMMODATION": "Accommodation",
    "HELIPAD": "Helipad",
    "CONTROL_ROOM": "Control Room",
    "STORAGE": "Storage",
    "EMERGENCY": "Emergency",
}

DEFAULT_TILE_COLORS = {
    "LOCATION": "#52c41a",
    "MUSTER_POINT": "#52c41a",
    "WORK_AREA": "#f5222d",
    "OUTSIDE": "#595959",
    "TRANSIT": "#13c2c2",
    "RESTRICTED": "#6B1E35",
    "ACCOMMODATION": "#6B1E35",
    "SAFE_HAVEN": "#0078D4",
    "HELIPAD": "#0078D4",
    "CONTROL_ROOM": "#6B1E35",
    "STORAGE": "#8B4513",
    "EMERGENCY": "#f5222d",
    "PUBLIC": "#52c41a",
}

HAZARD_COLORS = {
    "LOW": "success",
    "MEDIUM": "warning",
    "HIGH": "error",
    "CRITICAL": "error",
}


def _to_dict(zone: Zone, db: Session) -> dict:
    assigned_count = db.query(ZonePersonnelAssignment).filter(
        ZonePersonnelAssignment.zone_id == zone.id,
        ZonePersonnelAssignment.status == "ACTIVE",
    ).count()

    ztype = (zone.zone_type or "").upper()
    zstatus = (zone.status or "").upper()

    return {
        "id": zone.id,
        "name": zone.name,
        "code": zone.code,
        "zone_type": ztype,
        "zone_type_label": ZONE_TYPE_LABELS.get(ztype, ztype),
        "description": zone.description,
        "status": zstatus,
        "state": zone.state,
        "address": zone.address,
        "latitude": zone.latitude,
        "longitude": zone.longitude,
        "max_capacity": zone.max_capacity,
        "current_occupancy": zone.current_occupancy or 0,
        "current_personnel_count": zone.current_personnel_count or 0,
        "hazard_level": (zone.hazard_level or "LOW").upper(),
        "safety_level": (zone.safety_level or "NORMAL").upper(),
        "access_level": (zone.access_level or "RESTRICTED").upper(),
        "device_count": zone.device_count or 0,
        "zone_manager_id": zone.zone_manager_id,
        "contact_person": zone.contact_person,
        "contact_phone": zone.contact_phone,
        "zkteco_sync_enabled": zone.zkteco_sync_enabled,
        "last_sync_at": zone.last_sync_at.isoformat() if zone.last_sync_at else None,
        "floor_plan_url": zone.floor_plan_url,
        "floor_plan_filename": zone.floor_plan_filename,
        "is_active": zone.is_active,
        "assigned_personnel": assigned_count,
        "occupancy_rate": round((zone.current_occupancy or 0) / zone.max_capacity * 100, 1) if zone.max_capacity else None,
        "parent_zone_id": zone.parent_zone_id,
        "display_color": zone.display_color or DEFAULT_TILE_COLORS.get(ztype),
        "tile_position": zone.tile_position or "auto",
        "created_at": zone.created_at.isoformat() if zone.created_at else None,
        "updated_at": zone.updated_at.isoformat() if zone.updated_at else None,
    }


# ── Static routes BEFORE /{zone_id} ──────────────────────────────────────────

@router.get("/meta/summary")
def get_summary(db: Session = Depends(get_db), _=Depends(get_current_user)):
    total = db.query(Zone).count()
    active = db.query(Zone).filter(Zone.is_active == True, Zone.status == "ACTIVE").count()

    by_type = {}
    for zt, c in db.query(Zone.zone_type, func.count(Zone.id)).group_by(Zone.zone_type).all():
        by_type[(zt or "unknown").upper()] = c

    by_status = {}
    for st, c in db.query(Zone.status, func.count(Zone.id)).group_by(Zone.status).all():
        by_status[(st or "unknown").upper()] = c

    by_hazard = {}
    for hl, c in db.query(Zone.hazard_level, func.count(Zone.id)).group_by(Zone.hazard_level).all():
        by_hazard[(hl or "unknown").upper()] = c

    zk_synced = db.query(Zone).filter(
        Zone.zkteco_sync_enabled == True,
        Zone.last_sync_at != None,
    ).count()
    zk_pending = db.query(Zone).filter(
        Zone.zkteco_sync_enabled == True,
        Zone.last_sync_at == None,
    ).count()

    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "zkteco_synced": zk_synced,
        "zkteco_pending": zk_pending,
        "by_type": by_type,
        "by_status": by_status,
        "by_hazard": by_hazard,
    }


@router.get("/meta/zkteco-compare")
def zkteco_compare(db: Session = Depends(get_db), _=Depends(get_current_user)):
    zones = db.query(Zone).filter(Zone.is_active == True).all()
    bt_areas = db.query(BioTimeArea).all()

    bt_codes = {(a.area_code or "").upper() for a in bt_areas}
    bt_names = {(a.area_name or "").upper() for a in bt_areas}

    matched, local_only = [], []
    for z in zones:
        code_match = z.code.upper() in bt_codes
        name_match = z.name.upper() in bt_names
        if code_match or name_match:
            matched.append({
                "zone_id": z.id, "zone_name": z.name, "zone_code": z.code,
                "code_match": code_match, "name_match": name_match,
            })
        else:
            local_only.append({"zone_id": z.id, "zone_name": z.name, "zone_code": z.code})

    zone_codes = {z.code.upper() for z in zones}
    zone_names = {z.name.upper() for z in zones}
    bt_only = [
        {"area_id": a.id, "area_name": a.area_name, "area_code": a.area_code}
        for a in bt_areas
        if (a.area_code or "").upper() not in zone_codes and (a.area_name or "").upper() not in zone_names
    ]

    return {
        "matched": matched,
        "local_only": local_only,
        "biotime_only": bt_only,
        "total_local": len(zones),
        "total_biotime": len(bt_areas),
        "total_matched": len(matched),
    }


@router.get("/types")
def get_zone_types(_=Depends(get_current_user)):
    return [{"value": k, "label": v} for k, v in ZONE_TYPE_LABELS.items()]


@router.get("/statuses")
def get_zone_statuses(_=Depends(get_current_user)):
    return [
        {"value": "ACTIVE", "label": "Active"},
        {"value": "INACTIVE", "label": "Inactive"},
        {"value": "MAINTENANCE", "label": "Maintenance"},
        {"value": "EMERGENCY", "label": "Emergency"},
        {"value": "LOCKDOWN", "label": "Lockdown"},
    ]


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    zones = db.query(Zone).order_by(Zone.name).all()

    # Single bulk query: count distinct employees currently "in" each zone.
    # Uses iclock_transaction (authoritative punch log) joined to iclock_terminal.zone_id.
    # punch_state IN (0,4) = Check-In / OT-In  →  person is inside.
    live_rows = db.execute(text("""
        SELECT term.zone_id, COUNT(DISTINCT latest.emp_code) AS cnt
        FROM (
            SELECT DISTINCT ON (t.emp_code)
                t.emp_code, t.punch_state, t.terminal_sn
            FROM iclock_transaction t
            ORDER BY t.emp_code, t.punch_time DESC
        ) latest
        JOIN iclock_terminal term ON term.sn = latest.terminal_sn
        WHERE latest.punch_state IN (0, 4)
          AND term.zone_id IS NOT NULL
        GROUP BY term.zone_id
    """)).fetchall()
    live_count_map = {r.zone_id: r.cnt for r in live_rows}

    # Last activity per zone (most recent punch on any terminal in that zone)
    last_rows = db.execute(text("""
        SELECT term.zone_id, t.emp_code, t.punch_time
        FROM (
            SELECT DISTINCT ON (term2.zone_id)
                term2.zone_id, t2.emp_code, t2.punch_time
            FROM iclock_transaction t2
            JOIN iclock_terminal term2 ON term2.sn = t2.terminal_sn
            WHERE term2.zone_id IS NOT NULL
            ORDER BY term2.zone_id, t2.punch_time DESC
        ) t
        JOIN iclock_terminal term ON term.zone_id = t.zone_id
        LIMIT 1
    """)).fetchall()
    # Simpler: one query per zone approach for last activity (small zone count)
    last_activity_map = {}
    for row in db.execute(text("""
        SELECT term.zone_id, MAX(t.punch_time) AS last_punch,
               (array_agg(t.emp_code ORDER BY t.punch_time DESC))[1] AS last_emp
        FROM iclock_transaction t
        JOIN iclock_terminal term ON term.sn = t.terminal_sn
        WHERE term.zone_id IS NOT NULL
        GROUP BY term.zone_id
    """)).fetchall():
        last_activity_map[row.zone_id] = (row.last_emp, row.last_punch)

    result = []
    for z in zones:
        reader_count = db.execute(text(
            "SELECT COUNT(*) FROM iclock_terminal WHERE zone_id = :zid"
        ), {"zid": z.id}).scalar() or 0

        d = _to_dict(z, db)
        # Override stored count with live transaction-based count
        live = live_count_map.get(z.id, 0)
        d["current_personnel_count"] = live
        d["current_occupancy"] = live
        d["reader_count"] = reader_count

        last_emp, last_punch = last_activity_map.get(z.id, (None, None))
        d["last_activity_time"] = last_punch.isoformat() if last_punch else None
        d["last_activity_emp"] = last_emp

        # Write live count back to DB so stored value stays in sync
        if z.current_personnel_count != live:
            z.current_personnel_count = live
            z.current_occupancy = live

        result.append(d)

    db.commit()
    return result


@router.get("/available-devices")
def get_available_devices(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.execute(text(
        "SELECT id, sn, alias, ip_address, zone_id, last_activity, state FROM iclock_terminal ORDER BY alias"
    )).fetchall()
    return [
        {
            "id": r.id,
            "sn": r.sn,
            "alias": r.alias or f"Terminal {r.sn}",
            "ip_address": r.ip_address,
            "zone_id": r.zone_id,
            "last_activity": r.last_activity.isoformat() if r.last_activity else None,
            "state": r.state,
            "already_assigned": r.zone_id is not None,
        }
        for r in rows
    ]


@router.get("/hierarchy")
def get_hierarchy(db: Session = Depends(get_db), _=Depends(get_current_user)):
    zones = db.query(Zone).filter(Zone.is_active == True).order_by(Zone.name).all()
    zone_dicts = [_to_dict(z, db) for z in zones]

    top_level = [zd for zd in zone_dicts if not zd.get("parent_zone_id")]
    by_parent: dict = {}
    for zd in zone_dicts:
        pid = zd.get("parent_zone_id")
        if pid:
            by_parent.setdefault(str(pid), []).append(zd)

    total_pob = sum(zd.get("current_personnel_count", 0) for zd in zone_dicts)
    return {"top_level": top_level, "by_parent": by_parent, "total_pob": total_pob}


@router.get("/public-list")
def get_public_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).filter(Zone.is_active == True).order_by(Zone.name).all()
    return [{"id": z.id, "name": z.name, "code": z.code, "zone_type": z.zone_type} for z in zones]


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list)
def get_zones(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    zone_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Zone)
    if search:
        q = q.filter(or_(
            Zone.name.ilike(f"%{search}%"),
            Zone.code.ilike(f"%{search}%"),
            Zone.description.ilike(f"%{search}%"),
        ))
    if zone_type:
        q = q.filter(Zone.zone_type.ilike(zone_type))
    if status:
        q = q.filter(Zone.status.ilike(status))
    if state:
        q = q.filter(Zone.state.ilike(state))
    if is_active is not None:
        q = q.filter(Zone.is_active == is_active)

    zones = q.order_by(Zone.name).offset(skip).limit(limit).all()
    return [_to_dict(z, db) for z in zones]


@router.get("/{zone_id}")
def get_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return _to_dict(zone, db)


@router.post("/", status_code=201)
def create_zone(
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if db.query(Zone).filter(Zone.code == body.get("code")).first():
        raise HTTPException(status_code=400, detail="Zone code already exists")

    zone = Zone(
        name=body["name"],
        code=body["code"],
        zone_type=(body.get("zone_type") or "WORK_AREA").upper(),
        description=body.get("description"),
        status=(body.get("status") or "ACTIVE").upper(),
        state=body.get("state"),
        address=body.get("address"),
        latitude=body.get("latitude"),
        longitude=body.get("longitude"),
        max_capacity=body.get("max_capacity"),
        hazard_level=(body.get("hazard_level") or "LOW").upper(),
        safety_level=(body.get("safety_level") or "NORMAL").upper(),
        access_level=(body.get("access_level") or "RESTRICTED").upper(),
        contact_person=body.get("contact_person"),
        contact_phone=body.get("contact_phone"),
        zkteco_sync_enabled=body.get("zkteco_sync_enabled", True),
        is_active=body.get("is_active", True),
        parent_zone_id=body.get("parent_zone_id"),
        display_color=body.get("display_color"),
        tile_position=body.get("tile_position", "auto"),
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return _to_dict(zone, db)


@router.put("/{zone_id}")
def update_zone(
    zone_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    upper_fields = {"zone_type", "status", "hazard_level", "safety_level", "access_level"}
    for field, value in body.items():
        if hasattr(zone, field) and field not in ("id", "created_at"):
            if field in upper_fields and value:
                value = value.upper()
            setattr(zone, field, value)

    db.commit()
    db.refresh(zone)
    return _to_dict(zone, db)


@router.patch("/{zone_id}/status")
def update_zone_status(
    zone_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Quick status-only update — no other fields touched."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    new_status = (body.get("status") or "").upper()
    if new_status not in {"ACTIVE", "INACTIVE", "MAINTENANCE", "EMERGENCY", "LOCKDOWN"}:
        raise HTTPException(status_code=400, detail="Invalid status value")
    zone.status = new_status
    db.commit()
    return {"success": True, "id": zone_id, "status": new_status}


@router.patch("/{zone_id}/position")
def update_zone_position(
    zone_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Quick tile-position-only update for the POB Dashboard layout."""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    new_pos = (body.get("tile_position") or "auto").lower()
    if new_pos not in {"auto", "left", "right", "top", "bottom"}:
        raise HTTPException(status_code=400, detail="Invalid tile_position value")
    zone.tile_position = new_pos
    db.commit()
    return {"success": True, "id": zone_id, "tile_position": new_pos}


def _delete_single_zone(db: Session, zone_id: int) -> None:
    """Delete one zone row and its dependent rows. Caller is responsible for commit."""
    db.execute(text("UPDATE iclock_terminal SET zone_id = NULL WHERE zone_id = :z"), {"z": zone_id})
    db.execute(text("UPDATE devices SET zone_id = NULL WHERE zone_id = :z"), {"z": zone_id})
    db.execute(text("UPDATE personnel SET current_zone_id = NULL WHERE current_zone_id = :z"), {"z": zone_id})
    db.execute(text("UPDATE zone_personnel_tracking SET previous_zone_id = NULL WHERE previous_zone_id = :z"), {"z": zone_id})
    db.execute(text("UPDATE access_logs SET zone_id = NULL WHERE zone_id = :z"), {"z": zone_id})
    db.execute(text("UPDATE pay_zone_allowance SET area_id = NULL WHERE area_id = :z"), {"z": zone_id})
    db.execute(text("DELETE FROM zone_personnel_tracking WHERE zone_id = :z"), {"z": zone_id})
    db.execute(text("DELETE FROM zone_reader_assignments WHERE zone_id = :z"), {"z": zone_id})
    db.execute(text("DELETE FROM zone_personnel_assignments WHERE zone_id = :z"), {"z": zone_id})
    db.execute(text("DELETE FROM zones WHERE id = :z"), {"z": zone_id})


def _cascade_delete_zone(db: Session, zone_id: int) -> int:
    """Recursively delete a zone and all its descendants. Returns total zones deleted."""
    children = db.query(Zone.id).filter(Zone.parent_zone_id == zone_id).all()
    total = 1
    for (child_id,) in children:
        total += _cascade_delete_zone(db, child_id)
    _delete_single_zone(db, zone_id)
    return total


@router.delete("/{zone_id}")
def delete_zone(
    zone_id: int,
    cascade: bool = False,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    sub_count = db.query(Zone).filter(Zone.parent_zone_id == zone_id).count()
    if sub_count > 0 and not cascade:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {sub_count} sub-zone(s) belong to this zone. Delete sub-zones first.",
        )

    zone_name = zone.name
    if cascade and sub_count > 0:
        total = _cascade_delete_zone(db, zone_id)
        db.commit()
        return {"message": f"Zone '{zone_name}' and {total - 1} sub-zone(s) deleted successfully"}

    _delete_single_zone(db, zone_id)
    db.commit()
    return {"message": f"Zone '{zone_name}' deleted successfully"}


@router.get("/{zone_id}/sub-zones")
def get_sub_zones(
    zone_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    children = db.query(Zone).filter(
        Zone.parent_zone_id == zone_id,
        Zone.is_active == True,
    ).order_by(Zone.name).all()
    return [_to_dict(z, db) for z in children]


@router.get("/{zone_id}/personnel")
def get_zone_personnel(
    zone_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    assignments = db.query(ZonePersonnelAssignment).filter(
        ZonePersonnelAssignment.zone_id == zone_id,
        ZonePersonnelAssignment.status == "ACTIVE",
    ).all()
    return [
        {
            "id": a.id,
            "personnel_id": a.personnel_id,
            "role": a.role,
            "access_level": a.access_level,
            "is_primary_zone": a.is_primary_zone,
            "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            "status": a.status,
        }
        for a in assignments
    ]


@router.get("/{zone_id}/readers")
def get_zone_readers(
    zone_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    rows = db.execute(text(
        "SELECT id, sn, alias, ip_address, last_activity, state, reader_purpose "
        "FROM iclock_terminal WHERE zone_id = :zid ORDER BY alias"
    ), {"zid": zone_id}).fetchall()
    return [
        {
            "reader_id": r.id,
            "sn": r.sn,
            "alias": r.alias or f"Terminal {r.sn}",
            "ip_address": r.ip_address,
            "last_activity": r.last_activity.isoformat() if r.last_activity else None,
            "state": r.state,
            "status": "active" if r.state == 1 else "offline",
            "reader_purpose": r.reader_purpose or "ATTENDANCE",
        }
        for r in rows
    ]


@router.post("/{zone_id}/assign-reader")
def assign_reader(
    zone_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    terminal_id = body.get("device_id")
    reader_purpose = body.get("reader_purpose", "ATTENDANCE").upper()
    valid_purposes = {"ATTENDANCE", "ACCESS_ENTRY", "ACCESS_EXIT", "MUSTERING", "POB", "EMERGENCY"}
    if reader_purpose not in valid_purposes:
        reader_purpose = "ATTENDANCE"

    terminal = db.execute(text(
        "SELECT id, sn, alias, zone_id FROM iclock_terminal WHERE id = :tid"
    ), {"tid": terminal_id}).fetchone()
    if not terminal:
        raise HTTPException(status_code=404, detail="Terminal not found")
    if terminal.zone_id == zone_id:
        raise HTTPException(status_code=400, detail="Terminal already assigned to this zone")

    old_zone_id = terminal.zone_id

    db.execute(text(
        "UPDATE iclock_terminal SET zone_id = :zid, reader_purpose = :rp WHERE id = :tid"
    ), {"zid": zone_id, "rp": reader_purpose, "tid": terminal_id})

    # Update device_count on the destination zone
    device_count = db.execute(text(
        "SELECT COUNT(*) FROM iclock_terminal WHERE zone_id = :zid"
    ), {"zid": zone_id}).scalar() or 0
    zone.device_count = device_count

    # Update device_count on the source zone (if this was a move)
    if old_zone_id is not None:
        old_zone = db.query(Zone).filter(Zone.id == old_zone_id).first()
        if old_zone:
            old_count = db.execute(text(
                "SELECT COUNT(*) FROM iclock_terminal WHERE zone_id = :zid"
            ), {"zid": old_zone_id}).scalar() or 0
            old_zone.device_count = old_count

    db.commit()
    moved = old_zone_id is not None and old_zone_id != zone_id
    return {
        "message": "Reader moved to zone" if moved else "Reader assigned to zone",
        "terminal_id": terminal_id,
        "zone_id": zone_id,
        "moved_from": old_zone_id if moved else None,
    }


@router.delete("/{zone_id}/readers/{reader_id}")
def remove_reader(
    zone_id: int,
    reader_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    terminal = db.execute(text(
        "SELECT id, zone_id FROM iclock_terminal WHERE id = :rid"
    ), {"rid": reader_id}).fetchone()
    if not terminal or terminal.zone_id != zone_id:
        raise HTTPException(status_code=404, detail="Terminal not assigned to this zone")

    db.execute(text(
        "UPDATE iclock_terminal SET zone_id = NULL WHERE id = :rid"
    ), {"rid": reader_id})

    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if zone:
        device_count = db.execute(text(
            "SELECT COUNT(*) FROM iclock_terminal WHERE zone_id = :zid"
        ), {"zid": zone_id}).scalar() or 0
        zone.device_count = device_count

    db.commit()
    return {"message": "Reader removed from zone"}


@router.get("/{zone_id}/current-personnel")
def get_current_personnel(
    zone_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT latest.emp_code, latest.event_type, latest.punch_time, latest.device_sn,
               p.first_name, p.last_name, p.photo_url
        FROM (
            SELECT DISTINCT ON (emp_code)
                emp_code, event_type, punch_time, device_sn
            FROM zone_personnel_tracking
            WHERE zone_id = :zid
            ORDER BY emp_code, punch_time DESC
        ) latest
        LEFT JOIN personnel p ON p.emp_code = latest.emp_code
        WHERE latest.event_type = 'CLOCK_IN'
        ORDER BY latest.punch_time DESC
    """), {"zid": zone_id}).fetchall()
    return [
        {
            "emp_code": r.emp_code,
            "full_name": f"{r.first_name or ''} {r.last_name or ''}".strip() or r.emp_code,
            "punch_time": r.punch_time.isoformat() if r.punch_time else None,
            "device_sn": r.device_sn,
            "photo_url": r.photo_url,
        }
        for r in rows
    ]


@router.get("/{zone_id}/tracking")
def get_tracking_log(
    zone_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT zpt.emp_code, zpt.event_type, zpt.punch_time, zpt.device_sn,
               p.first_name, p.last_name
        FROM zone_personnel_tracking zpt
        LEFT JOIN personnel p ON p.emp_code = zpt.emp_code
        WHERE zpt.zone_id = :zid
        ORDER BY zpt.punch_time DESC
        LIMIT :lim
    """), {"zid": zone_id, "lim": limit}).fetchall()
    return [
        {
            "emp_code": r.emp_code,
            "full_name": f"{r.first_name or ''} {r.last_name or ''}".strip() or r.emp_code,
            "event_type": r.event_type,
            "punch_time": r.punch_time.isoformat() if r.punch_time else None,
            "device_sn": r.device_sn,
        }
        for r in rows
    ]


@router.post("/{zone_id}/push-to-biotime")
def push_to_biotime(
    zone_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    existing = db.query(BioTimeArea).filter(
        or_(BioTimeArea.area_code == zone.code, BioTimeArea.area_name == zone.name)
    ).first()

    if existing:
        existing.area_code = zone.code
        existing.area_name = zone.name
        db.commit()
        return {"message": "BioTime area updated", "biotime_area_id": existing.id}

    bt = BioTimeArea(area_code=zone.code, area_name=zone.name)
    db.add(bt)
    db.commit()
    db.refresh(bt)

    zone.last_sync_at = func.now()
    db.commit()

    return {"message": "Zone pushed to BioTime", "biotime_area_id": bt.id}


# ── Live zone WebSocket ───────────────────────────────────────────────────────

@router.websocket("/ws")
async def zone_live_ws(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    WebSocket endpoint for live zone occupancy.
    On connect: sends a snapshot of all zone counts.
    Stays open: receives broadcast_zone_update() pushes whenever a reader swipe
    changes a zone's occupancy.
    """
    await zone_ws_connect(websocket)
    try:
        # Send initial snapshot so the dashboard populates instantly
        rows = db.execute(text(
            "SELECT id, name, current_personnel_count FROM zones WHERE is_active = true ORDER BY name"
        )).fetchall()
        snapshot = [
            {"type": "zone_snapshot", "zone_id": r.id,
             "count": int(r.current_personnel_count or 0), "zone_name": r.name}
            for r in rows
        ]
        await websocket.send_text(json.dumps(snapshot))

        # Keep connection open; broadcasts arrive via broadcast_zone_update()
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        zone_ws_disconnect(websocket)
    except Exception:
        zone_ws_disconnect(websocket)


@router.get("/{zone_id}/live-personnel")
def get_zone_live_personnel(
    zone_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Who is currently inside this zone — from zone_personnel_tracking."""
    rows = db.execute(text("""
        SELECT
            last.emp_code,
            last.punch_time   AS entry_time,
            last.device_sn,
            COALESCE(TRIM(p.first_name || ' ' || p.last_name), last.emp_code) AS full_name,
            p.photo_url,
            p.department,
            p.position
        FROM (
            SELECT DISTINCT ON (emp_code)
                emp_code, event_type, punch_time, device_sn
            FROM zone_personnel_tracking
            WHERE zone_id = :zid
            ORDER BY emp_code, punch_time DESC
        ) last
        LEFT JOIN personnel p ON p.emp_code = last.emp_code
        WHERE last.event_type = 'CLOCK_IN'
        ORDER BY last.punch_time DESC
    """), {"zid": zone_id}).fetchall()

    return [
        {
            "emp_code":  r.emp_code,
            "full_name": r.full_name,
            "entry_time": r.entry_time.isoformat() if r.entry_time else None,
            "device_sn": r.device_sn,
            "photo_url": r.photo_url,
            "department": r.department,
            "designation": r.position,
        }
        for r in rows
    ]
