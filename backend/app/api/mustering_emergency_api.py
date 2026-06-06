"""
Mustering and Emergency Management API
Implements mustering events, emergency lockdown, and real-time headcount tracking
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date
import json
import asyncio
import logging

from app.core.database import get_db
from app.models.biotime_models import (
    MusteringEvent, MusteringLog, PersonnelEmployee,
    IClockTerminal, EmergencyDevice, AuthUser, BaseOperationLog
)
from app.models.zone import Zone
from app.core.dependencies import get_current_user
from app.models.user import User as AuthUser
try:
    from app.api.biotime_auth import log_operation
except Exception:
    async def log_operation(*args, **kwargs): pass

# Router
router = APIRouter()

# Configure logging
logger = logging.getLogger(__name__)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.mustering_data = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                # Remove dead connections
                self.active_connections.remove(connection)

manager = ConnectionManager()

# Pydantic Models
class MusteringEventCreate(BaseModel):
    zone_id: int
    event_type: int  # 0=drill, 1=emergency, 2=lockdown
    description: Optional[str] = None

class MusteringEventResponse(BaseModel):
    id: int
    zone_id: int
    event_type: int
    start_time: datetime
    end_time: Optional[datetime] = None
    status: int  # 0=active, 1=completed, 2=cancelled
    initiated_by: Optional[int] = None
    description: Optional[str] = None
    created_at: datetime

class MusteringLogCreate(BaseModel):
    event_id: int
    emp_code: str
    device_sn: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None

class MusteringLogResponse(BaseModel):
    id: int
    event_id: int
    emp_code: str
    check_time: datetime
    device_sn: Optional[str] = None
    status: int  # 0=missing, 1=safe, 2=injured
    location: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

_MUSTER_ZONE_TYPE_MAP = {0: "LOCATION", 1: "EMERGENCY", 2: "SAFE_HAVEN"}
_MUSTER_ZONE_TYPE_REV = {"LOCATION": 0, "EMERGENCY": 1, "SAFE_HAVEN": 2, "MUSTER_POINT": 0}

class MusteringZoneCreate(BaseModel):
    name: str
    capacity: Optional[int] = None
    evac_point: Optional[str] = None
    evac_gps: Optional[str] = None
    reader_sn: Optional[str] = None
    description: Optional[str] = None
    zone_type: int = 0  # 0=normal/muster_point, 1=emergency, 2=safe_haven

class MusteringZoneResponse(BaseModel):
    id: int
    name: str
    capacity: Optional[int] = None
    evac_point: Optional[str] = None
    evac_gps: Optional[str] = None
    reader_sn: Optional[str] = None
    zone_type: int  # kept as int for API backwards-compatibility
    created_at: datetime
    updated_at: Optional[datetime] = None

class EmergencyLockdownRequest(BaseModel):
    action: str  # "lock_all" or "unlock_all"
    zones: Optional[List[int]] = None  # Specific zones to lock/unlock

class HeadcountResponse(BaseModel):
    event_id: int
    zone_id: int
    total_expected: int
    total_safe: int
    total_missing: int
    total_injured: int
    completion_percentage: float
    last_updated: datetime

# Helper Functions
def calculate_headcount(event_id: int, db: Session) -> Dict[str, Any]:
    """Calculate real-time headcount for a mustering event"""
    
    # Get event details
    event = db.query(MusteringEvent).filter(MusteringEvent.id == event_id).first()
    if not event:
        return None
    
    # Get all logs for this event
    logs = db.query(MusteringLog).filter(MusteringLog.event_id == event_id).all()
    
    # Count by status
    total_safe = len([log for log in logs if log.status == 1])
    total_missing = len([log for log in logs if log.status == 0])
    total_injured = len([log for log in logs if log.status == 2])
    
    # Get expected personnel count (simplified - in real system would use zone assignments)
    total_expected = db.query(PersonnelEmployee).filter(
        PersonnelEmployee.status == 0  # Active employees
    ).count()
    
    # Calculate completion percentage
    total_accounted = total_safe + total_injured
    completion_percentage = (total_accounted / total_expected * 100) if total_expected > 0 else 0
    
    return {
        "event_id": event_id,
        "zone_id": event.zone_id,
        "total_expected": total_expected,
        "total_safe": total_safe,
        "total_missing": total_missing,
        "total_injured": total_injured,
        "completion_percentage": round(completion_percentage, 2),
        "last_updated": datetime.utcnow()
    }

async def broadcast_headcount_update(event_id: int, db: Session):
    """Broadcast headcount update to all WebSocket clients"""
    headcount = calculate_headcount(event_id, db)
    if headcount:
        await manager.broadcast(json.dumps({
            "type": "headcount_update",
            "data": headcount
        }))

# API Endpoints

# Mustering Event Management

@router.post("/mustering/api/events/", response_model=MusteringEventResponse)
async def create_mustering_event(
    event_data: MusteringEventCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start mustering event
    """
    # Validate zone exists
    zone = db.query(Zone).filter(Zone.id == event_data.zone_id).first()
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mustering zone not found"
        )
    
    # Create mustering event
    new_event = MusteringEvent(
        zone_id=event_data.zone_id,
        event_type=event_data.event_type,
        start_time=datetime.utcnow(),
        status=0,  # Active
        initiated_by=current_user.id,
        description=event_data.description
    )
    
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    # Log event creation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="CREATE_MUSTERING_EVENT",
        table_name="mustering_event",
        record_id=new_event.id,
        new_values=str(event_data.dict())
    )
    
    # Broadcast new event
    await manager.broadcast(json.dumps({
        "type": "muster_event_started",
        "data": {
            "event_id": new_event.id,
            "zone_id": new_event.zone_id,
            "event_type": new_event.event_type,
            "description": new_event.description
        }
    }))
    
    return MusteringEventResponse(
        id=new_event.id,
        zone_id=new_event.zone_id,
        event_type=new_event.event_type,
        start_time=new_event.start_time,
        end_time=new_event.end_time,
        status=new_event.status,
        initiated_by=new_event.initiated_by,
        description=new_event.description,
        created_at=new_event.created_at
    )

@router.get("/mustering/api/events/", response_model=List[MusteringEventResponse])
async def list_mustering_events(
    status: Optional[int] = Query(None, description="Filter by status (0=active, 1=completed, 2=cancelled)"),
    zone_id: Optional[int] = Query(None, description="Filter by zone ID"),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List mustering events
    """
    query = db.query(MusteringEvent)
    
    if status is not None:
        query = query.filter(MusteringEvent.status == status)
    
    if zone_id is not None:
        query = query.filter(MusteringEvent.zone_id == zone_id)
    
    events = query.order_by(MusteringEvent.start_time.desc()).all()
    
    return [
        MusteringEventResponse(
            id=event.id,
            zone_id=event.zone_id,
            event_type=event.event_type,
            start_time=event.start_time,
            end_time=event.end_time,
            status=event.status,
            initiated_by=event.initiated_by,
            description=event.description,
            created_at=event.created_at
        )
        for event in events
    ]

@router.get("/mustering/api/events/{event_id}/headcount/", response_model=HeadcountResponse)
async def get_event_headcount(
    event_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get real-time headcount for mustering event
    """
    headcount = calculate_headcount(event_id, db)
    
    if not headcount:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mustering event not found"
        )
    
    return HeadcountResponse(**headcount)

@router.post("/mustering/api/events/{event_id}/complete/")
async def complete_mustering_event(
    event_id: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete mustering event
    """
    event = db.query(MusteringEvent).filter(MusteringEvent.id == event_id).first()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mustering event not found"
        )
    
    if event.status != 0:  # Not active
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is not active"
        )
    
    # Complete event
    event.status = 1  # Completed
    event.end_time = datetime.utcnow()
    db.commit()
    
    # Log completion
    log_operation(
        db=db,
        user_id=current_user.id,
        action="COMPLETE_MUSTERING_EVENT",
        table_name="mustering_event",
        record_id=event_id
    )
    
    # Broadcast completion
    await manager.broadcast(json.dumps({
        "type": "muster_event_completed",
        "data": {
            "event_id": event_id,
            "final_headcount": calculate_headcount(event_id, db)
        }
    }))
    
    return {"message": "Mustering event completed successfully"}

# Mustering Log Management

@router.get("/mustering/api/logs/", response_model=List[MusteringLogResponse])
async def list_mustering_logs(
    event_id: Optional[int] = Query(None, description="Filter by event ID"),
    status: Optional[int] = Query(None, description="Filter by status (0=missing, 1=safe, 2=injured)"),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List mustering logs
    """
    query = db.query(MusteringLog)
    
    if event_id is not None:
        query = query.filter(MusteringLog.event_id == event_id)
    
    if status is not None:
        query = query.filter(MusteringLog.status == status)
    
    logs = query.order_by(MusteringLog.check_time.desc()).all()
    
    return [
        MusteringLogResponse(
            id=log.id,
            event_id=log.event_id,
            emp_code=log.emp_code,
            check_time=log.check_time,
            device_sn=log.device_sn,
            status=log.status,
            location=log.location,
            notes=log.notes,
            created_at=log.created_at
        )
        for log in logs
    ]

@router.post("/mustering/api/logs/", response_model=MusteringLogResponse)
async def create_mustering_log(
    log_data: MusteringLogCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create mustering log entry
    """
    # Validate event exists and is active
    event = db.query(MusteringEvent).filter(MusteringEvent.id == log_data.event_id).first()
    if not event or event.status != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or inactive mustering event"
        )
    
    # Validate employee exists
    employee = db.query(PersonnelEmployee).filter(
        PersonnelEmployee.emp_code == log_data.emp_code
    ).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Create log entry
    new_log = MusteringLog(
        event_id=log_data.event_id,
        emp_code=log_data.emp_code,
        check_time=datetime.utcnow(),
        device_sn=log_data.device_sn,
        status=0,  # Default to missing, will be updated when confirmed safe
        location=log_data.location,
        notes=log_data.notes
    )
    
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    
    # Broadcast headcount update
    await broadcast_headcount_update(log_data.event_id, db)
    
    return MusteringLogResponse(
        id=new_log.id,
        event_id=new_log.event_id,
        emp_code=new_log.emp_code,
        check_time=new_log.check_time,
        device_sn=new_log.device_sn,
        status=new_log.status,
        location=new_log.location,
        notes=new_log.notes,
        created_at=new_log.created_at
    )

@router.put("/mustering/api/logs/{log_id}/status/")
async def update_mustering_log_status(
    log_id: int,
    status: int,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update mustering log status (mark as safe/injured)
    """
    log = db.query(MusteringLog).filter(MusteringLog.id == log_id).first()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mustering log not found"
        )
    
    # Update status
    old_status = log.status
    log.status = status
    db.commit()
    
    # Log status update
    log_operation(
        db=db,
        user_id=current_user.id,
        action="UPDATE_MUSTERING_STATUS",
        table_name="mustering_log",
        record_id=log_id,
        old_values=f"status: {old_status}",
        new_values=f"status: {status}"
    )
    
    # Broadcast headcount update
    await broadcast_headcount_update(log.event_id, db)
    
    return {"message": "Mustering log status updated successfully"}

# Mustering Zone Management
# These endpoints now operate on the unified zones table (zone_type in
# MUSTER_POINT / EMERGENCY / SAFE_HAVEN) instead of the legacy mustering_zone table.

def _zone_to_muster_response(zone: Zone) -> MusteringZoneResponse:
    zone_type_int = _MUSTER_ZONE_TYPE_REV.get(zone.zone_type, 0)
    return MusteringZoneResponse(
        id=zone.id,
        name=zone.name,
        capacity=zone.max_capacity,
        evac_point=zone.evac_point,
        evac_gps=zone.evac_gps,
        reader_sn=zone.reader_sn,
        zone_type=zone_type_int,
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )

@router.get("/mustering/api/zones/", response_model=List[MusteringZoneResponse])
async def list_mustering_zones(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List mustering/emergency zones (zone_type in MUSTER_POINT, EMERGENCY, SAFE_HAVEN)."""
    zones = db.query(Zone).filter(
        Zone.zone_type.in_(["MUSTER_POINT", "EMERGENCY", "SAFE_HAVEN", "LOCATION"]),
        Zone.is_active == True,
    ).all()
    return [_zone_to_muster_response(z) for z in zones]

@router.post("/mustering/api/zones/", response_model=MusteringZoneResponse)
async def create_mustering_zone(
    zone_data: MusteringZoneCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new mustering/emergency zone in the unified zones table."""
    import re as _re
    zone_type_str = _MUSTER_ZONE_TYPE_MAP.get(zone_data.zone_type, "MUSTER_POINT")

    # Generate a unique code from the name
    base_code = _re.sub(r"[^A-Z0-9]", "", zone_data.name.upper())[:12] or "MZ"
    existing = {r[0] for r in db.execute(__import__("sqlalchemy").text("SELECT code FROM zones")).fetchall()}
    code = base_code
    n = 1
    while code in existing:
        code = f"{base_code}{n}"
        n += 1

    new_zone = Zone(
        name=zone_data.name,
        code=code,
        zone_type=zone_type_str,
        max_capacity=zone_data.capacity,
        evac_point=zone_data.evac_point,
        evac_gps=zone_data.evac_gps,
        reader_sn=zone_data.reader_sn,
        description=zone_data.description,
        status="ACTIVE",
        is_active=True,
    )
    db.add(new_zone)
    db.commit()
    db.refresh(new_zone)

    await log_operation(
        db=db,
        user_id=current_user.id,
        action="CREATE_MUSTERING_ZONE",
        table_name="zones",
        record_id=new_zone.id,
        new_values=str(zone_data.dict()),
    )

    return _zone_to_muster_response(new_zone)

# Emergency Management

@router.post("/emergency/api/lockdown/")
async def emergency_lockdown(
    request: EmergencyLockdownRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger emergency lockdown
    """
    if request.action not in ["lock_all", "unlock_all"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Must be 'lock_all' or 'unlock_all'"
        )
    
    # Get target terminals
    if request.zones:
        # Get terminals in specific zones
        terminals = db.query(IClockTerminal).filter(
            IClockTerminal.area_id.in_(request.zones)
        ).all()
    else:
        # Get all terminals
        terminals = db.query(IClockTerminal).all()
    
    # Send lockdown commands to terminals
    command = "LOCKDOWN" if request.action == "lock_all" else "UNLOCK"
    
    for terminal in terminals:
        # In real implementation, this would send actual commands to terminals
        logger.info(f"Sending {command} command to terminal {terminal.sn}")
        
        # Log command
        log_operation(
            db=db,
            user_id=current_user.id,
            action="EMERGENCY_LOCKDOWN",
            table_name="iclock_terminal",
            record_id=terminal.id,
            new_values=f"command: {command}"
        )
    
    # Broadcast emergency notification
    await manager.broadcast(json.dumps({
        "type": "emergency_lockdown",
        "data": {
            "action": request.action,
            "zones": request.zones,
            "timestamp": datetime.utcnow().isoformat(),
            "initiated_by": current_user.username
        }
    }))
    
    return {
        "message": f"Emergency {request.action} command sent successfully",
        "terminals_affected": len(terminals),
        "zones_affected": request.zones or "all"
    }

@router.get("/emergency/api/status/")
async def get_emergency_status(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get emergency system status
    """
    # Get active mustering events
    active_events = db.query(MusteringEvent).filter(MusteringEvent.status == 0).all()
    
    # Get emergency devices status
    emergency_devices = db.query(EmergencyDevice).all()
    
    return {
        "active_events": len(active_events),
        "active_events_details": [
            {
                "id": event.id,
                "zone_id": event.zone_id,
                "event_type": event.event_type,
                "start_time": event.start_time,
                "description": event.description
            }
            for event in active_events
        ],
        "emergency_devices": [
            {
                "id": device.id,
                "terminal_sn": device.terminal_sn,
                "device_type": device.device_type,
                "zone_id": device.zone_id,
                "status": device.status,
                "last_heartbeat": device.last_heartbeat
            }
            for device in emergency_devices
        ],
        "system_status": "active" if active_events else "normal"
    }

# WebSocket endpoint for real-time updates

@router.websocket("/ws/mustering/")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time mustering updates
    """
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
