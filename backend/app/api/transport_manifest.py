"""
Transport Manifest & Reconciliation API
Helideck / gangway check-in reconciliation for accurate POB tracking.
"""

import logging
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.biotime_models import MusteringEvent, MusteringLog
from ..models.emergency import (
    ManifestEntry,
    Transport,
    TransportSchedule,
)
from ..models.personnel import Personnel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transport", tags=["Transport Manifest"])


# ─── Pydantic schemas ──────────────────────────────────────────────────────────

class FlightCreate(BaseModel):
    transport_identifier: str          # e.g. "ZS-HEL1" — created if not found
    transport_type: int = 3            # TransportType enum: 3 = HELICOPTER, 4 = VESSEL
    transport_operator: Optional[str] = None
    transport_capacity: int = 12

    schedule_type: str = "CHARTER"     # REGULAR, CHARTER, STANDBY
    departure_location: str
    arrival_location: str
    departure_time: datetime
    arrival_time: Optional[datetime] = None
    notes: Optional[str] = None


class ManifestEntryCreate(BaseModel):
    passenger_name: str
    direction: str = "INBOUND"         # INBOUND / OUTBOUND
    emp_code: Optional[str] = None
    company: Optional[str] = None
    id_number: Optional[str] = None
    personnel_id: Optional[int] = None
    remarks: Optional[str] = None


class ManifestEntryUpdate(BaseModel):
    status: str                        # CONFIRMED / NO_SHOW / OFFLOADED / MANIFESTED
    remarks: Optional[str] = None


class FlightStatusUpdate(BaseModel):
    status: str                        # SCHEDULED / CONFIRMED / CANCELLED / COMPLETED / IN_TRANSIT


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _schedule_to_dict(s: TransportSchedule) -> Dict[str, Any]:
    entries = s.manifest_entries or []
    confirmed  = sum(1 for e in entries if e.status == "CONFIRMED")
    no_show    = sum(1 for e in entries if e.status == "NO_SHOW")
    offloaded  = sum(1 for e in entries if e.status == "OFFLOADED")
    manifested = sum(1 for e in entries if e.status == "MANIFESTED")
    inbound    = sum(1 for e in entries if e.direction == "INBOUND")
    outbound   = sum(1 for e in entries if e.direction == "OUTBOUND")

    t = s.transport
    return {
        "id": s.id,
        "schedule_type": s.schedule_type,
        "departure_location": s.departure_location,
        "arrival_location": s.arrival_location,
        "departure_time": s.departure_time.isoformat() if s.departure_time else None,
        "arrival_time": s.arrival_time.isoformat() if s.arrival_time else None,
        "status": s.status,
        "transport": {
            "id": t.id,
            "identifier": t.identifier,
            "type": t.type,
            "operator": t.operator,
            "capacity": t.capacity,
        } if t else None,
        "pax_total": len(entries),
        "pax_confirmed": confirmed,
        "pax_no_show": no_show,
        "pax_offloaded": offloaded,
        "pax_manifested": manifested,
        "pax_inbound": inbound,
        "pax_outbound": outbound,
        "is_reconciled": manifested == 0 and len(entries) > 0,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _entry_to_dict(e: ManifestEntry) -> Dict[str, Any]:
    return {
        "id": e.id,
        "schedule_id": e.schedule_id,
        "passenger_name": e.passenger_name,
        "emp_code": e.emp_code,
        "company": e.company,
        "id_number": e.id_number,
        "direction": e.direction,
        "status": e.status,
        "personnel_id": e.personnel_id,
        "confirmed_at": e.confirmed_at.isoformat() if e.confirmed_at else None,
        "confirmed_by_id": e.confirmed_by_id,
        "remarks": e.remarks,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


# ─── Flight endpoints ──────────────────────────────────────────────────────────

@router.get("/flights")
async def list_flights(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    flight_status: Optional[str] = Query(None, alias="status"),
    direction: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> Dict[str, Any]:
    """List flights with optional date/status filters. Defaults to today ± 7 days."""
    if date_from is None:
        date_from = date.today() - timedelta(days=7)
    if date_to is None:
        date_to = date.today() + timedelta(days=7)

    q = (
        db.query(TransportSchedule)
        .options(
            joinedload(TransportSchedule.transport),
            joinedload(TransportSchedule.manifest_entries),
        )
        .filter(
            TransportSchedule.departure_time >= datetime.combine(date_from, datetime.min.time()),
            TransportSchedule.departure_time <= datetime.combine(date_to, datetime.max.time()),
        )
    )
    if flight_status:
        q = q.filter(TransportSchedule.status == flight_status.upper())

    schedules = q.order_by(TransportSchedule.departure_time).all()

    # Optional direction filter — filter schedules that have entries in that direction
    if direction:
        direction_up = direction.upper()
        schedules = [
            s for s in schedules
            if any(e.direction == direction_up for e in (s.manifest_entries or []))
            or not s.manifest_entries  # include empty flights too
        ]

    return {
        "flights": [_schedule_to_dict(s) for s in schedules],
        "total": len(schedules),
        "date_from": str(date_from),
        "date_to": str(date_to),
    }


@router.post("/flights", status_code=status.HTTP_201_CREATED)
async def create_flight(
    payload: FlightCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a new flight/voyage schedule, auto-creating the transport if not found."""
    transport = (
        db.query(Transport)
        .filter(Transport.identifier == payload.transport_identifier)
        .first()
    )
    if not transport:
        transport = Transport(
            identifier=payload.transport_identifier,
            type=payload.transport_type,
            operator=payload.transport_operator,
            capacity=payload.transport_capacity,
            is_available=True,
        )
        db.add(transport)
        db.flush()

    schedule = TransportSchedule(
        transport_id=transport.id,
        schedule_type=payload.schedule_type,
        departure_location=payload.departure_location,
        arrival_location=payload.arrival_location,
        departure_time=payload.departure_time,
        arrival_time=payload.arrival_time,
        status="SCHEDULED",
        special_requirements=payload.notes,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    schedule = (
        db.query(TransportSchedule)
        .options(
            joinedload(TransportSchedule.transport),
            joinedload(TransportSchedule.manifest_entries),
        )
        .filter(TransportSchedule.id == schedule.id)
        .one()
    )
    return _schedule_to_dict(schedule)


@router.get("/flights/{flight_id}")
async def get_flight(
    flight_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> Dict[str, Any]:
    schedule = (
        db.query(TransportSchedule)
        .options(
            joinedload(TransportSchedule.transport),
            joinedload(TransportSchedule.manifest_entries),
        )
        .filter(TransportSchedule.id == flight_id)
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Flight not found")
    return _schedule_to_dict(schedule)


@router.patch("/flights/{flight_id}/status")
async def update_flight_status(
    flight_id: int,
    payload: FlightStatusUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> Dict[str, Any]:
    schedule = db.query(TransportSchedule).filter(TransportSchedule.id == flight_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Flight not found")
    schedule.status = payload.status.upper()
    db.commit()
    return {"id": flight_id, "status": schedule.status}


# ─── Manifest endpoints ────────────────────────────────────────────────────────

@router.get("/flights/{flight_id}/manifest")
async def get_manifest(
    flight_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> Dict[str, Any]:
    schedule = db.query(TransportSchedule).filter(TransportSchedule.id == flight_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Flight not found")

    entries = (
        db.query(ManifestEntry)
        .filter(ManifestEntry.schedule_id == flight_id)
        .order_by(ManifestEntry.direction, ManifestEntry.passenger_name)
        .all()
    )
    return {
        "flight_id": flight_id,
        "entries": [_entry_to_dict(e) for e in entries],
        "total": len(entries),
    }


@router.post("/flights/{flight_id}/manifest", status_code=status.HTTP_201_CREATED)
async def add_manifest_entry(
    flight_id: int,
    payload: ManifestEntryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Add a passenger to the manifest. If emp_code given, auto-fills name from personnel."""
    schedule = db.query(TransportSchedule).filter(TransportSchedule.id == flight_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Flight not found")
    if schedule.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot add passengers to a {schedule.status} flight")

    personnel_id = payload.personnel_id
    passenger_name = payload.passenger_name.strip()

    # Auto-lookup by emp_code
    if payload.emp_code and not personnel_id:
        p = db.query(Personnel).filter(Personnel.emp_code == payload.emp_code).first()
        if p:
            personnel_id = p.id
            if not passenger_name:
                passenger_name = f"{p.first_name} {p.last_name}".strip()

    entry = ManifestEntry(
        schedule_id=flight_id,
        personnel_id=personnel_id,
        passenger_name=passenger_name,
        emp_code=payload.emp_code,
        company=payload.company,
        id_number=payload.id_number,
        direction=payload.direction.upper(),
        status="MANIFESTED",
        remarks=payload.remarks,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_to_dict(entry)


@router.patch("/flights/{flight_id}/manifest/{entry_id}")
async def update_manifest_entry(
    flight_id: int,
    entry_id: int,
    payload: ManifestEntryUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Confirm arrival, mark no-show, or offload a passenger."""
    entry = (
        db.query(ManifestEntry)
        .filter(ManifestEntry.id == entry_id, ManifestEntry.schedule_id == flight_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Manifest entry not found")

    new_status = payload.status.upper()
    allowed = {"MANIFESTED", "CONFIRMED", "NO_SHOW", "OFFLOADED"}
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")

    entry.status = new_status
    if payload.remarks is not None:
        entry.remarks = payload.remarks
    if new_status == "CONFIRMED":
        entry.confirmed_at = datetime.utcnow()
        entry.confirmed_by_id = getattr(current_user, "id", None)

        # Fixes #1 + #14: OUTBOUND departure clears zone/POB state and marks
        # the person safe/departed in any active mustering event so they don't
        # appear as MISSING after leaving the platform.
        if entry.direction == "OUTBOUND" and entry.personnel_id:
            db.query(Personnel).filter(Personnel.id == entry.personnel_id).update(
                {"current_zone_id": None, "is_onboard": False, "pob_location": None},
                synchronize_session=False,
            )
            if entry.emp_code:
                active_event = (
                    db.query(MusteringEvent).filter(MusteringEvent.status == 0).first()
                )
                if active_event:
                    active_log = (
                        db.query(MusteringLog)
                        .filter(
                            MusteringLog.event_id == active_event.id,
                            MusteringLog.emp_code == entry.emp_code,
                        )
                        .first()
                    )
                    if active_log and active_log.status != 1:
                        from ..services.mustering_service import MusteringService
                        MusteringService(db).mark_person_status(
                            active_event.id,
                            entry.emp_code,
                            status=1,
                            marked_by=getattr(current_user, "id", 0),
                        )
    elif new_status in ("NO_SHOW", "OFFLOADED"):
        entry.confirmed_at = None
        entry.confirmed_by_id = None

    db.commit()
    return _entry_to_dict(entry)


@router.delete("/flights/{flight_id}/manifest/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_manifest_entry(
    flight_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    entry = (
        db.query(ManifestEntry)
        .filter(ManifestEntry.id == entry_id, ManifestEntry.schedule_id == flight_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Manifest entry not found")
    db.delete(entry)
    db.commit()


# ─── POB impact summary ────────────────────────────────────────────────────────

@router.get("/pob-summary")
async def pob_summary(
    summary_date: Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> Dict[str, Any]:
    """POB delta for a given day (defaults to today): confirmed arrivals minus confirmed departures."""
    if summary_date is None:
        summary_date = date.today()

    day_start = datetime.combine(summary_date, datetime.min.time())
    day_end = datetime.combine(summary_date, datetime.max.time())

    flights_today = (
        db.query(TransportSchedule)
        .filter(
            TransportSchedule.departure_time >= day_start,
            TransportSchedule.departure_time <= day_end,
        )
        .all()
    )

    flight_ids = [f.id for f in flights_today]
    if not flight_ids:
        return {
            "date": str(summary_date),
            "confirmed_arrivals": 0,
            "confirmed_departures": 0,
            "no_shows": 0,
            "pob_delta": 0,
            "flights_today": 0,
            "discrepancies": [],
        }

    entries = (
        db.query(ManifestEntry)
        .filter(ManifestEntry.schedule_id.in_(flight_ids))
        .all()
    )

    confirmed_inbound  = [e for e in entries if e.status == "CONFIRMED" and e.direction == "INBOUND"]
    confirmed_outbound = [e for e in entries if e.status == "CONFIRMED" and e.direction == "OUTBOUND"]
    no_shows = [e for e in entries if e.status == "NO_SHOW"]

    # Discrepancies: passengers still MANIFESTED on completed / in-transit flights
    completed_ids = {f.id for f in flights_today if f.status in ("COMPLETED", "IN_TRANSIT")}
    unreconciled = [
        {
            "flight_id": e.schedule_id,
            "passenger_name": e.passenger_name,
            "emp_code": e.emp_code,
            "direction": e.direction,
        }
        for e in entries
        if e.status == "MANIFESTED" and e.schedule_id in completed_ids
    ]

    return {
        "date": str(summary_date),
        "confirmed_arrivals": len(confirmed_inbound),
        "confirmed_departures": len(confirmed_outbound),
        "no_shows": len(no_shows),
        "pob_delta": len(confirmed_inbound) - len(confirmed_outbound),
        "flights_today": len(flights_today),
        "discrepancies": unreconciled,
    }


# ─── Personnel search helper ───────────────────────────────────────────────────

@router.get("/personnel-search")
async def search_personnel(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Quick search for adding registered personnel to a manifest."""
    term = f"%{q}%"
    results = (
        db.query(Personnel)
        .filter(
            (Personnel.first_name + " " + Personnel.last_name).ilike(term)
            | Personnel.emp_code.ilike(term)
        )
        .filter(Personnel.status == "active")
        .limit(20)
        .all()
    )
    return [
        {
            "id": p.id,
            "emp_code": p.emp_code,
            "name": f"{p.first_name} {p.last_name}".strip(),
            "company": getattr(p, "company", None),
            "department": p.department if hasattr(p, "department") and isinstance(p.department, str) else None,
        }
        for p in results
    ]


# ─── Mustering reconciliation ──────────────────────────────────────────────────

@router.get("/flights/{flight_id}/reconcile")
async def reconcile_manifest_with_mustering(
    flight_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Cross-check the flight manifest against the current live mustering headcount.

    Returns three lists:
    - verified:        manifest passengers confirmed accounted for in mustering
    - missing_in_muster: on manifest but NOT yet checked in to any muster zone
    - extra_on_platform: in live muster but NOT on this manifest (unexpected personnel)

    A departure should only be authorised when missing_in_muster is empty.
    """
    schedule = db.query(TransportSchedule).filter(TransportSchedule.id == flight_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Flight schedule not found")

    # Manifest emp_codes for this flight
    manifest_emp_codes: set = {
        e.emp_code for e in (schedule.manifest_entries or [])
        if e.emp_code and e.status not in ("CANCELLED", "NO_SHOW", "OFFLOADED")
    }

    # Active mustering personnel — anyone with an open muster log entry (status=0=missing or 1=safe)
    muster_rows = db.execute(text("""
        SELECT DISTINCT ml.emp_code
        FROM mustering_log ml
        JOIN mustering_event me ON me.id = ml.event_id
        WHERE me.status = 0   -- active event only
    """)).fetchall()
    muster_emp_codes: set = {r[0] for r in muster_rows}

    # If no active muster, fall back to current POB (last seen on platform)
    if not muster_emp_codes:
        pob_rows = db.execute(text("""
            SELECT DISTINCT p.emp_code
            FROM personnel p
            WHERE p.status = 'ACTIVE'
              AND EXISTS (
                  SELECT 1 FROM iclock_transaction t
                  WHERE t.emp_code = p.emp_code
                    AND t.punch_time >= NOW() - INTERVAL '24 hours'
              )
        """)).fetchall()
        muster_emp_codes = {r[0] for r in pob_rows}
        headcount_source = "pob_24h"
    else:
        headcount_source = "active_muster"

    verified             = sorted(manifest_emp_codes & muster_emp_codes)
    missing_in_muster    = sorted(manifest_emp_codes - muster_emp_codes)
    extra_on_platform    = sorted(muster_emp_codes   - manifest_emp_codes)

    # Enrich missing list with names for the safety officer
    def _name(emp_code: str) -> str:
        row = db.execute(text(
            "SELECT first_name || ' ' || COALESCE(last_name,'') FROM personnel WHERE emp_code=:c LIMIT 1"
        ), {"c": emp_code}).fetchone()
        return row[0].strip() if row else emp_code

    return {
        "flight_id":        flight_id,
        "headcount_source": headcount_source,
        "reconciled":       len(missing_in_muster) == 0,
        "summary": {
            "manifest_total":   len(manifest_emp_codes),
            "verified":         len(verified),
            "missing_in_muster": len(missing_in_muster),
            "extra_on_platform": len(extra_on_platform),
        },
        "missing_in_muster": [
            {"emp_code": c, "name": _name(c)} for c in missing_in_muster
        ],
        "extra_on_platform": [
            {"emp_code": c, "name": _name(c)} for c in extra_on_platform
        ],
        "verified_emp_codes": verified,
        "generated_at": datetime.now().isoformat(),
    }
