"""
Access-Control Controllers API.

Manages the LAN access panels (ZKTeco inBio / C3) and their reader ports for zone
entry/exit. Kept separate from the ADMS / Horus H1 device endpoints on purpose:
different hardware, different protocol (C3 PULL, not ADMS push), different topology
(one IP → many door readers).
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.access_controller import AccessController, AccessReader
from ..models.zone import Zone
from ..schemas.access_controller import (
    AccessControllerCreate, AccessControllerUpdate, AccessControllerOut,
    AccessReaderCreate, AccessReaderUpdate, AccessReaderOut,
)
from ..services.zkteco import c3_controller as c3
from ..services.access_controller_ingest import poll_controller_once, learn_controller_ports

router = APIRouter(prefix="/access-controllers", tags=["Access Control Controllers"])


# ── ZKTeco C3 model specs (from the official datasheet — not assumptions) ───────
# reader_ports is the number of Wiegand reader ports on the panel. Note the real
# constraint that shapes zone entry/exit tracking:
#   • C3-100 / C3-200 have 2 reader ports PER door → IN + OUT reader per door
#     (card-read on both entry AND exit → full bidirectional zone tracking).
#   • C3-400 has 4 reader ports for 4 doors → 1 reader PER door (entry only);
#     exits are by push-button/REX, so exit is NOT a card read. For bidirectional
#     tracking on a C3-400 you must run it in 2-door mode (IN+OUT on 2 doors).
C3_MODELS = {
    "C3-100": {"doors": 1, "reader_ports": 2, "inputs": 2,  "outputs": 2,
               "readers_per_door": 2, "card_capacity": 30000, "log_capacity": 100000},
    "C3-200": {"doors": 2, "reader_ports": 4, "inputs": 6,  "outputs": 4,
               "readers_per_door": 2, "card_capacity": 30000, "log_capacity": 100000},
    "C3-400": {"doors": 4, "reader_ports": 4, "inputs": 12, "outputs": 8,
               "readers_per_door": 1, "card_capacity": 30000, "log_capacity": 100000},
}


# ── serialization ─────────────────────────────────────────────────────────────
def _reader_out(reader: AccessReader, db: Session) -> AccessReaderOut:
    out = AccessReaderOut.model_validate(reader)
    if reader.zone_id:
        zone = db.query(Zone).filter(Zone.id == reader.zone_id).first()
        out.zone_name = zone.name if zone else None
    return out


def _controller_out(ctrl: AccessController, db: Session) -> AccessControllerOut:
    out = AccessControllerOut.model_validate(ctrl)
    out.readers = [_reader_out(r, db) for r in ctrl.readers]
    return out


def _default_readers(door_count: int, model: str = None) -> List[AccessReader]:
    """Auto-seed reader ports. Uses the real per-model layout for known C3 panels:
    C3-100/200 → IN+OUT per door; C3-400 → 1 (entry) reader per door (exit by button).
    Unknown models default to IN+OUT per door. Operators can add/remove ports or use
    Learn mode to match the actual wiring."""
    spec = C3_MODELS.get((model or "").upper())
    per_door = spec["readers_per_door"] if spec else 2
    readers: List[AccessReader] = []
    for door in range(1, door_count + 1):
        readers.append(AccessReader(door_no=door, direction="ENTRY", name=f"Door {door} Entry"))
        if per_door >= 2:
            readers.append(AccessReader(door_no=door, direction="EXIT", name=f"Door {door} Exit"))
    return readers


@router.get("/models", summary="Known ZKTeco C3 model specs (datasheet)")
def list_models():
    return C3_MODELS


# ── controllers CRUD ──────────────────────────────────────────────────────────
@router.get("", response_model=List[AccessControllerOut])
def list_controllers(db: Session = Depends(get_db)):
    return [_controller_out(c, db) for c in db.query(AccessController).order_by(AccessController.name).all()]


@router.post("", response_model=AccessControllerOut, status_code=status.HTTP_201_CREATED)
def create_controller(body: AccessControllerCreate, db: Session = Depends(get_db)):
    if db.query(AccessController).filter(AccessController.ip_address == body.ip_address).first():
        raise HTTPException(status_code=409, detail=f"A controller with IP {body.ip_address} already exists")

    data = body.model_dump(exclude={"readers"})
    ctrl = AccessController(**data)
    if body.readers:
        ctrl.readers = [AccessReader(**r.model_dump()) for r in body.readers]
    else:
        ctrl.readers = _default_readers(body.door_count, body.model)
    db.add(ctrl)
    db.commit()
    db.refresh(ctrl)
    return _controller_out(ctrl, db)


@router.get("/{controller_id}", response_model=AccessControllerOut)
def get_controller(controller_id: int, db: Session = Depends(get_db)):
    ctrl = db.query(AccessController).filter(AccessController.id == controller_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Controller not found")
    return _controller_out(ctrl, db)


@router.put("/{controller_id}", response_model=AccessControllerOut)
def update_controller(controller_id: int, body: AccessControllerUpdate, db: Session = Depends(get_db)):
    ctrl = db.query(AccessController).filter(AccessController.id == controller_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Controller not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(ctrl, key, value)
    db.commit()
    db.refresh(ctrl)
    return _controller_out(ctrl, db)


@router.delete("/{controller_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_controller(controller_id: int, db: Session = Depends(get_db)):
    ctrl = db.query(AccessController).filter(AccessController.id == controller_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Controller not found")
    db.delete(ctrl)
    db.commit()


# ── readers ───────────────────────────────────────────────────────────────────
@router.post("/{controller_id}/readers", response_model=AccessReaderOut, status_code=status.HTTP_201_CREATED)
def add_reader(controller_id: int, body: AccessReaderCreate, db: Session = Depends(get_db)):
    ctrl = db.query(AccessController).filter(AccessController.id == controller_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Controller not found")
    dup = db.query(AccessReader).filter(
        AccessReader.controller_id == controller_id,
        AccessReader.door_no == body.door_no,
        AccessReader.direction == body.direction,
    ).first()
    if dup:
        raise HTTPException(status_code=409,
                            detail=f"Door {body.door_no} {body.direction} reader already exists on this controller")
    reader = AccessReader(controller_id=controller_id, **body.model_dump())
    db.add(reader)
    db.commit()
    db.refresh(reader)
    return _reader_out(reader, db)


@router.put("/readers/{reader_id}", response_model=AccessReaderOut)
def update_reader(reader_id: int, body: AccessReaderUpdate, db: Session = Depends(get_db)):
    """Update a reader port — primarily used to assign its zone (entry/exit mapping)."""
    reader = db.query(AccessReader).filter(AccessReader.id == reader_id).first()
    if not reader:
        raise HTTPException(status_code=404, detail="Reader not found")
    if body.zone_id is not None and body.zone_id != 0:
        if not db.query(Zone).filter(Zone.id == body.zone_id).first():
            raise HTTPException(status_code=400, detail=f"Zone {body.zone_id} not found")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(reader, key, (None if key == "zone_id" and value == 0 else value))
    db.commit()
    db.refresh(reader)
    return _reader_out(reader, db)


@router.delete("/readers/{reader_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reader(reader_id: int, db: Session = Depends(get_db)):
    reader = db.query(AccessReader).filter(AccessReader.id == reader_id).first()
    if not reader:
        raise HTTPException(status_code=404, detail="Reader not found")
    db.delete(reader)
    db.commit()


# ── operations (C3 PULL protocol — transport pending hardware verification) ─────
@router.post("/{controller_id}/test")
def test_controller(controller_id: int, db: Session = Depends(get_db)):
    """Probe LAN reachability + C3 handshake. Updates the controller's status."""
    ctrl = db.query(AccessController).filter(AccessController.id == controller_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Controller not found")
    result = c3.test_connection(ctrl.ip_address, ctrl.port or 4370, ctrl.comm_password or "")
    ctrl.status = "online" if result.get("success") else "error"
    ctrl.last_error = None if result.get("success") else result.get("error")
    db.commit()
    return result


@router.post("/{controller_id}/doors/{door_no}/open")
def open_door(controller_id: int, door_no: int, duration: int = 5, db: Session = Depends(get_db)):
    ctrl = db.query(AccessController).filter(AccessController.id == controller_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Controller not found")
    return c3.open_door(ctrl.ip_address, door_no, duration, ctrl.port or 4370, ctrl.comm_password or "")


@router.post("/{controller_id}/poll")
def poll_controller(controller_id: int, db: Session = Depends(get_db)):
    """On-demand pull of buffered realtime events → zone occupancy engine."""
    ctrl = db.query(AccessController).filter(AccessController.id == controller_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Controller not found")
    return poll_controller_once(ctrl, db)


@router.post("/{controller_id}/learn")
def learn_ports(controller_id: int, db: Session = Depends(get_db)):
    """Learn mode: badge at each reader and see which port fired. Auto-registers
    ports as they fire; does NOT affect zone occupancy. Used to map physical
    readers to zones with certainty before going live."""
    ctrl = db.query(AccessController).filter(AccessController.id == controller_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Controller not found")
    return learn_controller_ports(ctrl, db)
