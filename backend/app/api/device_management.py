"""
Device Management API - BioTime 9.5 Compatible
Comprehensive device CRUD, commands, firmware, and real-time monitoring
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text, func, and_, or_
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import logging
import json
import os
import uuid

from ..core.database import get_db
from ..core.dependencies import get_current_user
from ..models.user import User
from ..models.biotime_models import IClockTerminal, IClockTransaction, PersonnelEmployee
from ..models.device import Device, DeviceStatus, DeviceSchedule, DeviceMaintenance

# Router
router = APIRouter()

# Configure logging
logger = logging.getLogger(__name__)

# Constants
DEVICE_ONLINE_THRESHOLD_MINUTES = 2   # 2× a 30s heartbeat interval before marking offline
COMMAND_TIMEOUT_MINUTES = 10
FIRMWARE_UPLOAD_DIR = "uploads/firmware"

# Pydantic Models
class DeviceCreate(BaseModel):
    sn: str = Field(..., min_length=1, max_length=20, description="Device serial number")
    alias: Optional[str] = Field(None, max_length=100, description="Device alias/name")
    ip_address: Optional[str] = Field(None, description="Device IP address")
    area_id: Optional[int] = Field(None, description="Area ID (T&A readers)")
    comm_key: Optional[str] = Field("0", max_length=20, description="Communication key")
    device_type: Optional[int] = Field(0, ge=0, le=3, description="Device type: 0=Attendance,1=Access,2=Mustering,3=Emergency")
    zone_id: Optional[int] = Field(None, description="Zone ID (Access Control readers)")
    reader_purpose: Optional[str] = Field("ATTENDANCE", description="ATTENDANCE | ACCESS_ENTRY | ACCESS_EXIT | MUSTERING | POB | EMERGENCY")
    device_name: Optional[str] = Field(None, max_length=50, description="Device name")
    device_model: Optional[str] = Field(None, max_length=50, description="Device model")
    connection_mode: Optional[str] = Field("adms", description="adms | direct | both")

_PURPOSE_TO_DEVICE_TYPE = {
    "ATTENDANCE":   0,
    "ACCESS_ENTRY": 1,
    "ACCESS_EXIT":  1,
    "MUSTERING":    2,
    "POB":          1,
    "EMERGENCY":    3,
}

class DeviceUpdate(BaseModel):
    model_config = {"coerce_numbers_to_str": False, "str_strip_whitespace": True}

    alias: Optional[str] = Field(None, max_length=100)
    ip_address: Optional[str] = Field(None)
    area_id: Optional[int] = Field(None)
    comm_key: Optional[str] = Field(None, max_length=20)
    device_type: Optional[int] = Field(None, ge=0, le=3)
    zone_id: Optional[int] = Field(None)
    reader_purpose: Optional[str] = Field(None, description="ATTENDANCE | ACCESS_ENTRY | ACCESS_EXIT | MUSTERING | POB | EMERGENCY")
    device_name: Optional[str] = Field(None, max_length=50)
    device_model: Optional[str] = Field(None, max_length=50)
    connection_mode: Optional[str] = Field(None, description="adms | direct | both")
    state: Optional[int] = Field(None, ge=0, le=1)

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        # Coerce string integers sent from plain HTML <input type="number">
        if isinstance(obj, dict):
            for field in ("zone_id", "area_id", "device_type", "state"):
                v = obj.get(field)
                if isinstance(v, str):
                    obj[field] = int(v) if v.strip() else None
        return super().model_validate(obj, *args, **kwargs)

class DeviceResponse(BaseModel):
    id: int
    sn: str
    alias: Optional[str]
    ip_address: Optional[str]
    area_id: Optional[int]
    comm_key: Optional[str]
    device_name: Optional[str]
    device_model: Optional[str]
    fw_version: Optional[str]   # alias for fw_ver — kept for frontend compatibility
    platform: Optional[str]
    mac_address: Optional[str]
    oem_vendor: Optional[str]
    user_count: int
    fp_count: int
    face_count: int
    palm_count: int
    log_count: int
    device_type: int
    zone_id: Optional[int]
    reader_purpose: str = "ATTENDANCE"
    connection_mode: str = "adms"
    is_auto_reg: bool
    state: int
    last_activity: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    status: str  # Online/Offline based on last_activity

class DeviceCommandRequest(BaseModel):
    sn: str = Field(..., description="Device serial number")
    cmd: str = Field(..., description="Command to send")
    command_type: Optional[str] = Field(None, description="Command type for categorization")

class DeviceCommandResponse(BaseModel):
    id: int
    sn: str
    cmd_content: str
    status: int  # 0=pending,1=sent,2=success,3=fail
    cmd_commit_time: datetime
    cmd_trans_time: Optional[datetime]
    cmd_return_time: Optional[datetime]
    cmd_return: Optional[str]

class BatchImportRequest(BaseModel):
    devices: List[Dict[str, Any]] = Field(..., description="List of devices to import")

class FirmwareUploadResponse(BaseModel):
    firmware_id: str
    filename: str
    file_size: int
    upload_time: datetime
    device_types: List[str]

class FirmwarePushRequest(BaseModel):
    firmware_id: str = Field(..., description="Firmware file ID")
    sn_list: List[str] = Field(..., description="List of device serial numbers")

# Helper Functions
def get_device_status(last_activity: Optional[datetime], state: Optional[int] = None) -> str:
    """
    Determine device status for ADMS terminals.
    ADMS state constants: 0=PENDING, 1=APPROVED, 2=REJECTED, 3=OFFLINE (heartbeat-set).
    REJECTED and OFFLINE states are treated as offline immediately.
    PENDING/APPROVED fall back to last_activity freshness.
    """
    # state=3 means heartbeat explicitly detected the device is unreachable
    # state=2 means admin rejected the device
    if state in (2, 3):
        return "Offline"

    if not last_activity:
        return "Offline"

    now = datetime.now(timezone.utc)
    if last_activity.tzinfo is None:
        last_activity = last_activity.replace(tzinfo=timezone.utc)
    time_diff = now - last_activity

    if time_diff.total_seconds() <= DEVICE_ONLINE_THRESHOLD_MINUTES * 60:
        return "Online"
    return "Offline"

def queue_command(db: Session, device_sn: str, command: str, user_id: Optional[int] = None):
    """Queue a command for a device"""
    try:
        # Insert command into iclock_devcmd table
        result = db.execute(text("""
            INSERT INTO iclock_devcmd (sn, cmd_content, cmd_commit_time, status)
            VALUES (:sn, :cmd_content, :commit_time, 0)
            RETURNING id
        """), {
            'sn': device_sn,
            'cmd_content': command,
            'commit_time': datetime.utcnow()
        })
        
        command_id = result.scalar()
        db.commit()
        
        logger.info(f"✅ Queued command '{command}' for device {device_sn} (ID: {command_id})")
        return command_id
        
    except Exception as e:
        logger.error(f"❌ Error queuing command: {e}")
        db.rollback()
        raise

def _build_adms_userinfo_cmd(row) -> str:
    """Build a proper ZKTeco ADMS DATA UPDATE USERINFO command (tab-separated fields)."""
    name = f"{row.first_name or ''} {row.last_name or ''}".strip() or row.emp_code
    card = getattr(row, 'card_no', '') or ''
    pwd  = getattr(row, 'pwd', '') or ''
    return (
        f"DATA UPDATE USERINFO\tPin={row.emp_code}\t"
        f"Name={name}\tCard={card}\tPrivilege=0\t"
        f"Password={pwd}\tGroup=1\tTimeZone=0\tVerify=0"
    )


def validate_device_exists(db: Session, device_sn: str) -> IClockTerminal:
    """Validate that device exists and return it"""
    device = db.query(IClockTerminal).filter(IClockTerminal.sn == device_sn).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_sn} not found"
        )
    return device

def get_real_time_device_stats(db: Session, device_sn: str) -> Dict[str, Any]:
    """Get real-time statistics for a device"""
    try:
        # Get recent transactions
        recent_txns = db.execute(text("""
            SELECT COUNT(*) as count, MAX(punch_time) as last_punch
            FROM iclock_transaction 
            WHERE terminal_sn = :sn 
            AND punch_time >= :since
        """), {
            'sn': device_sn,
            'since': datetime.utcnow() - timedelta(hours=24)
        }).fetchone()
        
        # Get pending commands
        pending_cmds = db.execute(text("""
            SELECT COUNT(*) as count
            FROM iclock_devcmd 
            WHERE sn = :sn AND status = 0
        """), {'sn': device_sn}).fetchone()
        
        return {
            'transactions_24h': recent_txns.count if recent_txns else 0,
            'last_punch': recent_txns.last_punch if recent_txns and recent_txns.last_punch else None,
            'pending_commands': pending_cmds.count if pending_cmds else 0
        }
        
    except Exception as e:
        logger.error(f"Error getting device stats: {e}")
        return {
            'transactions_24h': 0,
            'last_punch': None,
            'pending_commands': 0
        }

# Device CRUD Endpoints

@router.get("/api/device/areas/")
async def get_areas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all T&A areas (personnel_area table)."""
    rows = db.execute(text(
        "SELECT id, area_code, area_name FROM personnel_area ORDER BY area_name"
    )).fetchall()
    return [{"id": r.id, "area_code": r.area_code, "name": r.area_name} for r in rows]


@router.get("/api/device/terminals/", response_model=List[DeviceResponse])
async def get_terminals(
    search: Optional[str] = Query(None, description="Search by SN or alias"),
    area_id: Optional[int] = Query(None, description="Filter by area ID"),
    device_type: Optional[int] = Query(None, ge=0, le=3, description="Filter by device type"),
    status: Optional[str] = Query(None, description="Filter by status: online/offline"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=1000, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all terminals with filtering and pagination
    BioTime compatible endpoint
    """
    try:
        # Build query
        query = db.query(IClockTerminal)
        
        # Apply filters
        if search:
            search_filter = or_(
                IClockTerminal.sn.ilike(f"%{search}%"),
                IClockTerminal.alias.ilike(f"%{search}%"),
                IClockTerminal.device_name.ilike(f"%{search}%")
            )
            query = query.filter(search_filter)
        
        if area_id:
            query = query.filter(IClockTerminal.area_id == area_id)
        
        if device_type is not None:
            query = query.filter(IClockTerminal.device_type == device_type)
        
        # Apply pagination
        offset = (page - 1) * limit
        terminals = query.offset(offset).limit(limit).all()
        
        # Convert to response format
        device_responses = []
        for terminal in terminals:
            device_status = get_device_status(terminal.last_activity, getattr(terminal, "state", None))
            
            # Apply status filter if specified
            if status and device_status != status.lower():
                continue
            
            device_response = DeviceResponse(
                id=terminal.id,
                sn=terminal.sn,
                alias=getattr(terminal, 'alias', None),
                ip_address=getattr(terminal, 'ip_address', None),
                area_id=getattr(terminal, 'area_id', None),
                comm_key=getattr(terminal, 'comm_key', None),
                device_name=getattr(terminal, 'device_name', None),
                device_model=getattr(terminal, 'device_model', None),
                fw_version=getattr(terminal, 'fw_ver', None),
                platform=getattr(terminal, 'platform', None),
                mac_address=getattr(terminal, 'mac_address', None),
                oem_vendor=getattr(terminal, 'oem_vendor', None),
                user_count=getattr(terminal, 'user_count', 0) or 0,
                fp_count=getattr(terminal, 'fp_count', 0) or 0,
                face_count=getattr(terminal, 'face_count', 0) or 0,
                palm_count=getattr(terminal, 'palm_count', 0) or 0,
                log_count=getattr(terminal, 'log_count', 0) or 0,
                device_type=getattr(terminal, 'device_type', 0) or 0,
                zone_id=getattr(terminal, 'zone_id', None),
                reader_purpose=getattr(terminal, 'reader_purpose', None) or 'ATTENDANCE',
                connection_mode=getattr(terminal, 'connection_mode', 'adms') or 'adms',
                is_auto_reg=getattr(terminal, 'is_auto_reg', False) or False,
                state=terminal.state or 0,
                last_activity=terminal.last_activity,
                created_at=terminal.created_at,
                updated_at=terminal.updated_at,
                status=device_status
            )
            device_responses.append(device_response)
        
        return device_responses
        
    except Exception as e:
        logger.error(f"Error getting terminals: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch terminals"
        )

@router.post("/api/device/terminals/", response_model=DeviceResponse)
async def create_terminal(
    terminal_data: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new terminal
    BioTime compatible endpoint
    """
    try:
        # Check if terminal already exists
        existing = db.query(IClockTerminal).filter(IClockTerminal.sn == terminal_data.sn).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Terminal with SN {terminal_data.sn} already exists"
            )
        
        # Create new terminal
        new_terminal = IClockTerminal(
            sn=terminal_data.sn,
            alias=terminal_data.alias or f"Terminal {terminal_data.sn}",
            ip_address=terminal_data.ip_address,
            area_id=terminal_data.area_id,
            comm_key=terminal_data.comm_key,
            device_name=terminal_data.device_name,
            device_model=terminal_data.device_model,
            reader_purpose=terminal_data.reader_purpose or 'ATTENDANCE',
            connection_mode=terminal_data.connection_mode or 'adms',
            device_type=_PURPOSE_TO_DEVICE_TYPE.get(terminal_data.reader_purpose or 'ATTENDANCE',
                        terminal_data.device_type or 0),
            zone_id=terminal_data.zone_id,
            is_auto_reg=False,
            state=0,  # Initially offline
            user_count=0,
            fp_count=0,
            face_count=0,
            palm_count=0,
            log_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(new_terminal)
        db.commit()
        db.refresh(new_terminal)
        
        # Convert to response format
        device_status = get_device_status(new_terminal.last_activity, getattr(new_terminal, "state", None))
        
        return DeviceResponse(
            id=new_terminal.id,
            sn=new_terminal.sn,
            alias=new_terminal.alias,
            ip_address=new_terminal.ip_address,
            area_id=new_terminal.area_id,
            comm_key=new_terminal.comm_key,
            device_name=new_terminal.device_name,
            device_model=new_terminal.device_model,
            fw_version=new_terminal.fw_ver,
            platform=new_terminal.platform,
            mac_address=new_terminal.mac_address,
            oem_vendor=new_terminal.oem_vendor,
            user_count=new_terminal.user_count or 0,
            fp_count=new_terminal.fp_count or 0,
            face_count=new_terminal.face_count or 0,
            palm_count=new_terminal.palm_count or 0,
            log_count=new_terminal.log_count or 0,
            device_type=new_terminal.device_type or 0,
            zone_id=new_terminal.zone_id,
            reader_purpose=new_terminal.reader_purpose or 'ATTENDANCE',
            connection_mode=new_terminal.connection_mode or 'adms',
            is_auto_reg=new_terminal.is_auto_reg or False,
            state=new_terminal.state or 0,
            last_activity=new_terminal.last_activity,
            created_at=new_terminal.created_at,
            updated_at=new_terminal.updated_at,
            status=device_status
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating terminal: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create terminal"
        )

@router.get("/api/device/terminals/{device_id}", response_model=DeviceResponse)
async def get_terminal(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get terminal by ID"""
    try:
        terminal = db.query(IClockTerminal).filter(IClockTerminal.id == device_id).first()
        if not terminal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Terminal not found"
            )
        
        device_status = get_device_status(terminal.last_activity, getattr(terminal, "state", None))
        
        return DeviceResponse(
            id=terminal.id,
            sn=terminal.sn,
            alias=terminal.alias,
            ip_address=terminal.ip_address,
            area_id=terminal.area_id,
            comm_key=terminal.comm_key,
            device_name=terminal.device_name,
            device_model=terminal.device_model,
            fw_version=terminal.fw_ver,
            platform=terminal.platform,
            mac_address=terminal.mac_address,
            oem_vendor=terminal.oem_vendor,
            user_count=terminal.user_count or 0,
            fp_count=terminal.fp_count or 0,
            face_count=terminal.face_count or 0,
            palm_count=terminal.palm_count or 0,
            log_count=terminal.log_count or 0,
            device_type=terminal.device_type or 0,
            zone_id=terminal.zone_id,
            reader_purpose=terminal.reader_purpose or 'ATTENDANCE',
            connection_mode=terminal.connection_mode or 'adms',
            is_auto_reg=terminal.is_auto_reg or False,
            state=terminal.state or 0,
            last_activity=terminal.last_activity,
            created_at=terminal.created_at,
            updated_at=terminal.updated_at,
            status=device_status
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting terminal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch terminal"
        )

@router.put("/api/device/terminals/{device_id}", response_model=DeviceResponse)
async def update_terminal(
    device_id: int,
    terminal_data: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update terminal"""
    try:
        terminal = db.query(IClockTerminal).filter(IClockTerminal.id == device_id).first()
        if not terminal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Terminal not found"
            )
        
        # Update fields
        update_data = terminal_data.dict(exclude_unset=True)
        # Auto-derive device_type from reader_purpose when purpose is being changed
        if 'reader_purpose' in update_data:
            update_data['device_type'] = _PURPOSE_TO_DEVICE_TYPE.get(
                update_data['reader_purpose'], update_data.get('device_type', terminal.device_type or 0)
            )
        for field, value in update_data.items():
            setattr(terminal, field, value)

        terminal.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(terminal)
        
        device_status = get_device_status(terminal.last_activity, getattr(terminal, "state", None))
        
        return DeviceResponse(
            id=terminal.id,
            sn=terminal.sn,
            alias=terminal.alias,
            ip_address=terminal.ip_address,
            area_id=terminal.area_id,
            comm_key=terminal.comm_key,
            device_name=terminal.device_name,
            device_model=terminal.device_model,
            fw_version=terminal.fw_ver,
            platform=terminal.platform,
            mac_address=terminal.mac_address,
            oem_vendor=terminal.oem_vendor,
            user_count=terminal.user_count or 0,
            fp_count=terminal.fp_count or 0,
            face_count=terminal.face_count or 0,
            palm_count=terminal.palm_count or 0,
            log_count=terminal.log_count or 0,
            device_type=terminal.device_type or 0,
            zone_id=terminal.zone_id,
            reader_purpose=terminal.reader_purpose or 'ATTENDANCE',
            connection_mode=terminal.connection_mode or 'adms',
            is_auto_reg=terminal.is_auto_reg or False,
            state=terminal.state or 0,
            last_activity=terminal.last_activity,
            created_at=terminal.created_at,
            updated_at=terminal.updated_at,
            status=device_status
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating terminal: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update terminal"
        )

@router.delete("/api/device/terminals/{device_id}")
async def delete_terminal(
    device_id: int,
    force: bool = Query(False, description="Force delete even with transactions"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete terminal and clean up all referencing records."""
    try:
        terminal = db.query(IClockTerminal).filter(IClockTerminal.id == device_id).first()
        if not terminal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Terminal not found")

        sn = terminal.sn

        # Check transaction count — block non-forced deletes that have attendance history
        txn_count = db.execute(
            text("SELECT COUNT(*) FROM iclock_transaction WHERE terminal_sn = :sn"), {'sn': sn}
        ).scalar()
        if txn_count > 0 and not force:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete terminal with {txn_count} transactions. Use force=true to override.",
            )

        # ── Cascade cleanup ──────────────────────────────────────────────────
        # 1. Always delete device-specific records (each table uses its own FK column name)
        db.execute(text("DELETE FROM iclock_devcmd WHERE sn = :sn"), {'sn': sn})
        db.execute(text("DELETE FROM device_schedules WHERE device_id = :sn"), {'sn': sn})
        db.execute(text("DELETE FROM device_maintenance WHERE device_id = :sn"), {'sn': sn})

        # 2. Nullify informational FK references (SET NULL where allowed)
        nullable_refs = [
            ('acc_door',                  'terminal_sn'),
            ('mustering_log',             'device_sn'),
            ('emergency_device',          'terminal_sn'),
            ('emergency_device_enhanced', 'terminal_sn'),
            ('checkinout',                'terminal_sn'),
            ('vis_visit_log',             'device_sn'),
            ('mtg_attendance',            'device_sn'),
            ('iclock_operlog',            'terminal_sn'),
            ('iclock_bio_template',       'source_sn'),
        ]
        for tbl, col in nullable_refs:
            try:
                db.execute(text(f"UPDATE {tbl} SET {col} = NULL WHERE {col} = :sn"), {'sn': sn})
            except Exception:
                db.rollback()  # table may not exist — safe to skip

        # 3. Attendance transactions: delete on force, nullify otherwise
        if force:
            db.execute(text("DELETE FROM iclock_transaction WHERE terminal_sn = :sn"), {'sn': sn})
        else:
            try:
                db.execute(text("UPDATE iclock_transaction SET terminal_sn = NULL WHERE terminal_sn = :sn"), {'sn': sn})
            except Exception:
                db.execute(text("DELETE FROM iclock_transaction WHERE terminal_sn = :sn"), {'sn': sn})

        db.flush()

        # Also remove the matching Device row (and its zone assignments) if one exists
        try:
            device_row = db.execute(
                text("SELECT id FROM devices WHERE serial_number = :sn"), {'sn': sn}
            ).fetchone()
            if device_row:
                dev_id = device_row[0]
                db.execute(text("DELETE FROM zone_reader_assignments WHERE reader_id = :id"), {'id': dev_id})
                db.execute(text("DELETE FROM devices WHERE id = :id"), {'id': dev_id})
        except Exception as dev_err:
            logger.warning(f"Could not clean up devices row for {sn}: {dev_err}")
            db.rollback()

        db.delete(terminal)
        db.commit()

        return {"message": f"Terminal {sn} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting terminal {device_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete terminal")

@router.post("/api/device/terminals/batch-import/")
async def batch_import_terminals(
    import_data: BatchImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Batch import terminals from CSV data"""
    try:
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for device_data in import_data.devices:
            try:
                # Validate required fields
                if 'sn' not in device_data or not device_data['sn']:
                    errors.append(f"Missing SN for device: {device_data}")
                    skipped_count += 1
                    continue
                
                # Check if already exists
                existing = db.query(IClockTerminal).filter(IClockTerminal.sn == device_data['sn']).first()
                if existing:
                    skipped_count += 1
                    continue
                
                # Create terminal
                new_terminal = IClockTerminal(
                    sn=device_data['sn'],
                    alias=device_data.get('alias', f"Terminal {device_data['sn']}"),
                    ip_address=device_data.get('ip_address'),
                    area_id=device_data.get('area_id'),
                    comm_key=device_data.get('comm_key', '0'),
                    device_name=device_data.get('device_name'),
                    device_model=device_data.get('device_model'),
                    device_type=device_data.get('device_type', 0),
                    zone_id=device_data.get('zone_id'),
                    is_auto_reg=False,
                    state=0,
                    user_count=0,
                    fp_count=0,
                    face_count=0,
                    palm_count=0,
                    log_count=0,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                db.add(new_terminal)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Error importing {device_data.get('sn', 'unknown')}: {str(e)}")
                skipped_count += 1
        
        db.commit()
        
        return {
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error in batch import: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to import terminals"
        )

# Device Commands Endpoints

@router.get("/api/device/devcmd/", response_model=List[DeviceCommandResponse])
async def get_device_commands(
    sn: Optional[str] = Query(None, description="Filter by device serial number"),
    status: Optional[int] = Query(None, ge=0, le=3, description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get device command queue"""
    try:
        # Build query
        query = "SELECT id, sn, cmd_content, status, cmd_commit_time, cmd_trans_time, cmd_return_time, cmd_return FROM iclock_devcmd WHERE 1=1"
        params = {}
        
        if sn:
            query += " AND sn = :sn"
            params['sn'] = sn
        
        if status is not None:
            query += " AND status = :status"
            params['status'] = status
        
        query += " ORDER BY cmd_commit_time DESC LIMIT :limit OFFSET :offset"
        params['limit'] = limit
        params['offset'] = (page - 1) * limit
        
        result = db.execute(text(query), params)
        commands = []
        
        for row in result:
            command = DeviceCommandResponse(
                id=row.id,
                sn=row.sn,
                cmd_content=row.cmd_content,
                status=row.status,
                cmd_commit_time=row.cmd_commit_time,
                cmd_trans_time=row.cmd_trans_time,
                cmd_return_time=row.cmd_return_time,
                cmd_return=row.cmd_return
            )
            commands.append(command)
        
        return commands
        
    except Exception as e:
        logger.error(f"Error getting device commands: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch device commands"
        )

async def _execute_direct_command(device: Device, cmd: str) -> dict:
    """
    Execute a command immediately via ZKLib for direct-connect devices.
    Pauses live_capture so the device's single TCP slot is free, then reconnects.
    Returns {"success": bool, "message": str, "error": str|None}.
    """
    from ..services.zkteco.direct_connection import zkteco_direct
    from ..services.zkteco.live_capture import with_device_released
    ip = device.ip_address
    port = device.port or 4370
    cmd_upper = cmd.strip().upper()

    if cmd_upper in ("REBOOT", "RESTART"):
        coro = zkteco_direct.restart_device(ip, port)
    elif cmd_upper in ("UNLOCK", "OPEN", "OPEN DOOR"):
        coro = zkteco_direct.open_door(ip, port)
    elif cmd_upper in ("DISABLE", "LOCK"):
        coro = zkteco_direct.disable_device(ip, port)
    elif cmd_upper in ("ENABLE", "UNLOCK DEVICE"):
        coro = zkteco_direct.enable_device(ip, port)
    elif cmd_upper in ("SYNC TIME", "SYNCTIME", "SET TIME"):
        coro = zkteco_direct.sync_time(ip, port)
    elif cmd_upper in ("CHECK", "TEST", "PING", "TEST CONNECTION"):
        coro = zkteco_direct.test_connection(ip, port)
    elif cmd_upper in ("GET LOG", "GETALLLOG", "PULL LOG", "PULL ATTENDANCE"):
        coro = zkteco_direct.get_attendance(ip, port)
    elif cmd_upper in ("GET USERINFO", "GET USERS", "GETUSERINFO"):
        coro = zkteco_direct.get_users(ip, port)
    elif cmd_upper in ("CLEAR LOG", "CLEARATTLOG", "CLEAR ATTENDANCE"):
        coro = zkteco_direct.clear_attendance(ip, port)
    elif cmd_upper in ("INFO", "GET INFO", "GET TIME"):
        coro = zkteco_direct.get_time(ip, port)
    else:
        return {"success": False, "error": f"Command '{cmd}' not supported for direct devices. Supported: REBOOT, UNLOCK, DISABLE, ENABLE, SYNC TIME, CHECK, GET LOG, GET USERINFO, CLEAR LOG, INFO"}

    try:
        return await with_device_released(device.id, coro)
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@router.post("/api/device/devcmd/")
async def send_device_command(
    command_data: DeviceCommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send command to device — direct via ZKLib for direct-connect devices, queued for ADMS devices."""
    try:
        validate_device_exists(db, command_data.sn)

        # Check if this is a direct-connect device (ZKLib, not ADMS queue)
        direct_device = (
            db.query(Device)
            .filter(
                Device.serial_number == command_data.sn,
                Device.connection_mode.in_(["direct", "both"]),
                Device.ip_address.isnot(None),
            )
            .first()
        )

        if direct_device:
            result = await _execute_direct_command(direct_device, command_data.cmd)
            if not result.get("success"):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=result.get("error", "Command failed on device"),
                )
            # Record in devcmd as success so command history is visible
            db.execute(text("""
                INSERT INTO iclock_devcmd (sn, cmd_content, cmd_commit_time, cmd_trans_time, cmd_return_time, status)
                VALUES (:sn, :cmd, :now, :now, :now, 2)
            """), {"sn": command_data.sn, "cmd": command_data.cmd, "now": datetime.utcnow()})
            db.commit()
            return {
                "sn": command_data.sn,
                "cmd": command_data.cmd,
                "status": "success",
                "message": result.get("message", "Command executed successfully"),
            }

        # ADMS device — queue as normal (device will pick up on next /iclock/getrequest poll)
        command_id = queue_command(db, command_data.sn, command_data.cmd, current_user.id)
        return {
            "id": command_id,
            "sn": command_data.sn,
            "cmd": command_data.cmd,
            "status": "pending",
            "message": "Command queued — will be delivered on next device poll",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending device command: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send command"
        )


@router.delete("/api/device/devcmd/{command_id}")
async def delete_device_command(
    command_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a command record from the command history."""
    row = db.execute(
        text("SELECT id FROM iclock_devcmd WHERE id = :id"),
        {"id": command_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found")
    db.execute(text("DELETE FROM iclock_devcmd WHERE id = :id"), {"id": command_id})
    db.commit()
    return {"id": command_id, "deleted": True}


@router.post("/api/device/devcmd/sync-user/")
async def sync_user_to_device(
    sn: str,
    emp_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sync a single employee to the device.
    Direct-connect devices: pushed immediately via ZKLib.
    ADMS devices: queued for pickup on next device poll.
    """
    try:
        terminal = validate_device_exists(db, sn)

        # Check personnel table first (UI-created employees), then personnel_employee (bulk import)
        row = db.execute(text("""
            SELECT id, emp_code, first_name, last_name, NULL::text AS card_no, NULL::text AS pwd
            FROM personnel WHERE emp_code = :emp_code AND status = 'ACTIVE'
            UNION ALL
            SELECT id, emp_code, first_name, last_name, card_no, pwd
            FROM personnel_employee WHERE emp_code = :emp_code AND status = 0
            LIMIT 1
        """), {"emp_code": emp_code}).fetchone()

        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Employee {emp_code} not found")

        # Direct-connect: push via ZKLib immediately
        direct_device = (
            db.query(Device)
            .filter(
                Device.serial_number == sn,
                Device.connection_mode.in_(["direct", "both"]),
                Device.ip_address.isnot(None),
            )
            .first()
        )

        if direct_device:
            from ..services.zkteco.direct_connection import _make_zk, _run_sync
            from zk import const as zk_const

            ip = direct_device.ip_address
            port = direct_device.port or 4370
            name = f"{row.first_name or ''} {row.last_name or ''}".strip()[:24] or row.emp_code
            card = int(row.card_no) if row.card_no and row.card_no.isdigit() else 0
            uid = row.id

            def _push():
                zk = _make_zk(ip, port)
                conn = zk.connect()
                try:
                    conn.set_user(uid=uid, name=name, privilege=zk_const.USER_DEFAULT,
                                  password=row.pwd or "", group_id="",
                                  user_id=row.emp_code, card=card)
                finally:
                    conn.disconnect()

            direct_ok = False
            try:
                await _run_sync(_push)
                direct_ok = True
            except Exception as exc:
                logger.warning(f"Direct push failed for {sn}, falling back to ADMS queue: {exc}")

            if direct_ok:
                db.execute(text("""
                    INSERT INTO iclock_devcmd (sn, cmd_content, cmd_commit_time, cmd_trans_time, cmd_return_time, status)
                    VALUES (:sn, :cmd, :now, :now, :now, 2)
                """), {"sn": sn, "cmd": f"SYNC USER {emp_code}", "now": datetime.utcnow()})
                db.commit()
                return {"message": f"Employee {emp_code} pushed to device directly", "synced": 1, "method": "direct"}

        # ADMS fallback — queue command (also used when direct push fails)
        cmd_id = queue_command(db, sn, _build_adms_userinfo_cmd(row), current_user.id)
        return {"message": f"User {emp_code} sync queued for device {sn} (will deliver on next poll)",
                "commands_queued": 1, "command_ids": [cmd_id], "method": "adms"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing user to device: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to sync user to device")

@router.post("/api/device/devcmd/sync-all-users/")
async def sync_all_users_to_device(
    sn: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sync all active employees to the device.
    Direct-connect devices: pushed immediately via ZKLib.
    ADMS devices: queued for pickup on next device poll.
    """
    try:
        terminal = validate_device_exists(db, sn)

        # Fetch all active employees from both tables (personnel = UI-created, personnel_employee = bulk-imported)
        rows = db.execute(text("""
            SELECT id, emp_code, first_name, last_name, NULL::text AS card_no, NULL::text AS pwd
            FROM personnel
            WHERE status = 'ACTIVE' AND emp_code IS NOT NULL
            UNION ALL
            SELECT pe.id, pe.emp_code, pe.first_name, pe.last_name, pe.card_no, pe.pwd
            FROM personnel_employee pe
            WHERE pe.status = 0 AND pe.emp_code IS NOT NULL
              AND pe.emp_code NOT IN (SELECT emp_code FROM personnel WHERE emp_code IS NOT NULL)
            ORDER BY id
        """)).fetchall()

        if not rows:
            return {"message": "No active employees found to sync", "synced": 0}

        # Check if this is a direct-connect device — push via ZKLib immediately
        direct_device = (
            db.query(Device)
            .filter(
                Device.serial_number == sn,
                Device.connection_mode.in_(["direct", "both"]),
                Device.ip_address.isnot(None),
            )
            .first()
        )

        if direct_device:
            from ..services.zkteco.direct_connection import zkteco_direct, _make_zk, _run_sync
            from zk import const as zk_const

            ip = direct_device.ip_address
            port = direct_device.port or 4370
            employees_snapshot = list(rows)   # snapshot before async boundary
            errors = []
            synced = 0

            def _push():
                nonlocal synced
                zk = _make_zk(ip, port)
                conn = zk.connect()
                conn.disable_device()
                try:
                    for row in employees_snapshot:
                        try:
                            name = f"{row.first_name or ''} {row.last_name or ''}".strip()[:24] or row.emp_code
                            card = int(row.card_no) if row.card_no and row.card_no.isdigit() else 0
                            conn.set_user(
                                uid=row.id,
                                name=name,
                                privilege=zk_const.USER_DEFAULT,
                                password=row.pwd or "",
                                group_id="",
                                user_id=row.emp_code,
                                card=card,
                            )
                            synced += 1
                        except Exception as exc:
                            errors.append(f"{row.emp_code}: {exc}")
                finally:
                    conn.enable_device()
                    conn.disconnect()

            direct_ok = False
            try:
                await _run_sync(_push)
                direct_ok = True
            except Exception as exc:
                logger.warning(f"Direct push failed for {sn}, falling back to ADMS queue: {exc}")

            if direct_ok:
                db.execute(text("""
                    INSERT INTO iclock_devcmd (sn, cmd_content, cmd_commit_time, cmd_trans_time, cmd_return_time, status)
                    VALUES (:sn, :cmd, :now, :now, :now, 2)
                """), {"sn": sn, "cmd": f"SYNC ALL USERS ({synced} pushed)", "now": datetime.utcnow()})
                db.commit()
                return {
                    "message": f"Pushed {synced} of {len(rows)} employees to device directly",
                    "synced": synced,
                    "total": len(rows),
                    "errors": errors,
                    "method": "direct",
                }

        # ADMS fallback: check if terminal supports DATA UPDATE USERINFO (PushVer 2.x)
        # For PushVer 1.x, DATA UPDATE USERINFO is not supported — use ZKLib if IP available
        pushver = (terminal.pushver or "").strip() if hasattr(terminal, 'pushver') else ""
        terminal_ip = getattr(terminal, 'ip_address', None)

        if not pushver.startswith("2") and terminal_ip:
            # PushVer 1.x with known IP — try ZKLib directly
            from ..services.zkteco.direct_connection import zkteco_direct, _make_zk, _run_sync
            from zk import const as zk_const
            employees_snapshot = list(rows)
            errors = []
            synced = 0

            def _push_adms():
                import re
                nonlocal synced
                zk = _make_zk(terminal_ip, 4370)
                conn = zk.connect()
                # Build emp_code→uid map from device (use emp_code as user_id for proper matching)
                existing_users = conn.get_users()
                code_to_uid = {str(u.user_id): u.uid for u in (existing_users or []) if u.user_id}
                max_uid = max((u.uid for u in (existing_users or [])), default=0)
                conn.disable_device()
                try:
                    for row in employees_snapshot:
                        try:
                            name = f"{row.first_name or ''} {row.last_name or ''}".strip()[:24] or row.emp_code
                            card = int(row.card_no) if row.card_no and row.card_no.isdigit() else 0
                            uid = code_to_uid.get(row.emp_code)
                            if uid is None:
                                max_uid += 1
                                uid = max_uid
                            conn.set_user(
                                uid=uid,
                                name=name,
                                privilege=zk_const.USER_DEFAULT,
                                password=row.pwd or "",
                                group_id="",
                                user_id=row.emp_code,
                                card=card,
                            )
                            synced += 1
                        except Exception as exc:
                            errors.append(f"{row.emp_code}: {exc}")
                finally:
                    conn.enable_device()
                    conn.disconnect()

            try:
                await _run_sync(_push_adms)
                db.execute(text("""
                    INSERT INTO iclock_devcmd (sn, cmd_content, cmd_commit_time, cmd_trans_time, cmd_return_time, status)
                    VALUES (:sn, :cmd, :now, :now, :now, 2)
                """), {"sn": sn, "cmd": f"SYNC ALL USERS ({synced} pushed via ZKLib)", "now": datetime.utcnow()})
                db.commit()
                return {
                    "message": f"Pushed {synced} of {len(rows)} employees via ZKLib (PushVer 1.x device)",
                    "synced": synced,
                    "total": len(rows),
                    "errors": errors,
                    "method": "zklib",
                }
            except Exception as exc:
                logger.warning(f"ZKLib push failed for ADMS terminal {sn}: {exc}")
                # fall through to ADMS queue

        # Queue DATA UPDATE USERINFO commands (works for PushVer 2.x or as last resort)
        count = 0
        for row in rows:
            queue_command(db, sn, _build_adms_userinfo_cmd(row), current_user.id)
            count += 1

        return {
            "message": f"Queued {count} user sync commands for device {sn} (will deliver on next poll)",
            "employees_count": len(rows),
            "commands_queued": count,
            "method": "adms",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing all users to device: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync users to device"
        )

@router.post("/api/device/devcmd/sync-department/")
async def sync_department_to_device(
    sn: str,
    department: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sync all active employees in a department to the device."""
    try:
        terminal = validate_device_exists(db, sn)

        rows = db.execute(text("""
            SELECT p.id, p.emp_code, p.first_name, p.last_name, NULL::text AS card_no, NULL::text AS pwd
            FROM personnel p
            JOIN personnel_department pd ON pd.personnel_id = p.id
            JOIN departments d ON d.id = pd.department_id
            WHERE p.status = 'ACTIVE' AND p.emp_code IS NOT NULL
              AND LOWER(d.name) = LOWER(:dept)
            UNION ALL
            SELECT pe.id, pe.emp_code, pe.first_name, pe.last_name, pe.card_no, pe.pwd
            FROM personnel_employee pe
            WHERE pe.status = 0 AND pe.emp_code IS NOT NULL
              AND LOWER(pe.department) = LOWER(:dept)
              AND pe.emp_code NOT IN (SELECT emp_code FROM personnel WHERE emp_code IS NOT NULL)
            ORDER BY id
        """), {"dept": department}).fetchall()

        if not rows:
            return {"message": f"No active employees found in department '{department}'", "synced": 0}

        direct_device = (
            db.query(Device)
            .filter(
                Device.serial_number == sn,
                Device.connection_mode.in_(["direct", "both"]),
                Device.ip_address.isnot(None),
            )
            .first()
        )

        if direct_device:
            from ..services.zkteco.direct_connection import _make_zk, _run_sync
            from zk import const as zk_const

            ip = direct_device.ip_address
            port = direct_device.port or 4370
            snapshot = list(rows)
            errors = []
            synced = 0

            def _push():
                nonlocal synced
                zk = _make_zk(ip, port)
                conn = zk.connect()
                conn.disable_device()
                try:
                    for row in snapshot:
                        try:
                            name = f"{row.first_name or ''} {row.last_name or ''}".strip()[:24] or row.emp_code
                            card = int(row.card_no) if row.card_no and row.card_no.isdigit() else 0
                            conn.set_user(uid=row.id, name=name, privilege=zk_const.USER_DEFAULT,
                                          password=row.pwd or "", group_id="",
                                          user_id=row.emp_code, card=card)
                            synced += 1
                        except Exception as exc:
                            errors.append(f"{row.emp_code}: {exc}")
                finally:
                    conn.enable_device()
                    conn.disconnect()

            direct_ok = False
            try:
                await _run_sync(_push)
                direct_ok = True
            except Exception as exc:
                logger.warning(f"Direct push failed for {sn}, falling back to ADMS queue: {exc}")

            if direct_ok:
                db.execute(text("""
                    INSERT INTO iclock_devcmd (sn, cmd_content, cmd_commit_time, cmd_trans_time, cmd_return_time, status)
                    VALUES (:sn, :cmd, :now, :now, :now, 2)
                """), {"sn": sn, "cmd": f"SYNC DEPT {department} ({synced} pushed)", "now": datetime.utcnow()})
                db.commit()
                return {"message": f"Pushed {synced} of {len(rows)} employees from '{department}' to device directly",
                        "synced": synced, "total": len(rows), "errors": errors, "method": "direct"}

        # ADMS fallback — queue DATA UPDATE commands (also used when direct push fails)
        count = 0
        for row in rows:
            queue_command(db, sn, _build_adms_userinfo_cmd(row), current_user.id)
            count += 1
        return {"message": f"Queued {count} sync commands for department '{department}' (will deliver on next poll)",
                "commands_queued": count, "method": "adms"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing department to device: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to sync department to device")


@router.post("/api/device/devcmd/emergency/")
async def emergency_device_command(
    sn: str,
    action: str = Query(..., pattern="^(ON|OFF)$", description="Emergency action: ON or OFF"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send emergency device command"""
    try:
        # Validate device exists and is emergency type
        device = validate_device_exists(db, sn)
        
        if device.device_type != 3:  # Not emergency device
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Device {sn} is not an emergency device"
            )
        
        # Check user permissions (could implement role check here)
        # For now, assume authenticated user has permission
        
        # Queue emergency command
        cmd = f"EMERGENCY_{action}"
        command_id = queue_command(db, sn, cmd, current_user.id)
        
        # Update emergency device status
        db.execute(text("""
            UPDATE emergency_device 
            SET status = :status, last_heartbeat = :heartbeat
            WHERE terminal_sn = :sn
        """), {
            'status': 1 if action == "ON" else 0,
            'heartbeat': datetime.utcnow(),
            'sn': sn
        })
        db.commit()
        
        return {
            "id": command_id,
            "sn": sn,
            "action": action,
            "status": "pending",
            "message": f"Emergency {action} command queued for device {sn}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending emergency command: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send emergency command"
        )

# Real-time Monitoring Endpoints

@router.get("/api/device/real-time/")
async def get_real_time_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all devices with real-time stats for monitoring"""
    try:
        # Get all terminals
        terminals = db.query(IClockTerminal).all()
        
        devices = []
        for terminal in terminals:
            device_status = get_device_status(terminal.last_activity, getattr(terminal, "state", None))
            stats = get_real_time_device_stats(db, terminal.sn)
            
            device_data = {
                "id": terminal.id,
                "sn": terminal.sn,
                "alias": terminal.alias,
                "ip_address": terminal.ip_address,
                "device_type": getattr(terminal, 'device_type', 0),
                "zone_id": terminal.zone_id,
                "status": device_status,
                "last_activity": terminal.last_activity.isoformat() if terminal.last_activity else None,
                "user_count": terminal.user_count or 0,
                "fp_count": terminal.fp_count or 0,
                "face_count": terminal.face_count or 0,
                "fw_version": getattr(terminal, 'fw_ver', None),
                "platform": getattr(terminal, 'platform', None),
                "mac_address": getattr(terminal, 'mac_address', None),
                "oem_vendor": getattr(terminal, 'oem_vendor', None),
                "emergency_status": "off",
                "transactions_24h": stats['transactions_24h'],
                "last_punch": stats['last_punch'].isoformat() if stats['last_punch'] else None,
                "pending_commands": stats['pending_commands']
            }
            
            devices.append(device_data)
        
        return {
            "devices": devices,
            "total_count": len(devices),
            "online_count": len([d for d in devices if d['status'] == 'Online']),
            "offline_count": len([d for d in devices if d['status'] == 'Offline']),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting real-time devices: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch real-time devices"
        )

# Firmware Management Endpoints

@router.post("/api/device/firmware/upload/", response_model=FirmwareUploadResponse)
async def upload_firmware(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    device_types: Optional[str] = Query(None, description="Comma-separated device types"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload firmware file"""
    try:
        # Validate file
        if not file.filename or not file.filename.endswith('.bin'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .bin firmware files are allowed"
            )
        
        # Create upload directory if not exists
        os.makedirs(FIRMWARE_UPLOAD_DIR, exist_ok=True)
        
        # Generate unique filename
        firmware_id = str(uuid.uuid4())
        filename = f"{firmware_id}_{file.filename}"
        file_path = os.path.join(FIRMWARE_UPLOAD_DIR, filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Parse device types
        device_type_list = []
        if device_types:
            device_type_list = [dt.strip() for dt in device_types.split(',')]
        
        # TODO: Store firmware metadata in database
        
        return FirmwareUploadResponse(
            firmware_id=firmware_id,
            filename=filename,
            file_size=len(content),
            upload_time=datetime.utcnow(),
            device_types=device_type_list
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading firmware: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload firmware"
        )

@router.post("/api/device/firmware/push/")
async def push_firmware(
    push_request: FirmwarePushRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Push firmware to devices"""
    try:
        # Validate firmware exists (TODO: check database)
        firmware_path = os.path.join(FIRMWARE_UPLOAD_DIR, f"{push_request.firmware_id}_*.bin")
        
        # Validate devices exist
        valid_devices = []
        for sn in push_request.sn_list:
            try:
                validate_device_exists(db, sn)
                valid_devices.append(sn)
            except HTTPException:
                logger.warning(f"Device {sn} not found, skipping")
        
        if not valid_devices:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No valid devices found"
            )
        
        # Queue firmware update commands
        command_ids = []
        for sn in valid_devices:
            cmd_id = queue_command(db, sn, f"FIRMWARE UPDATE {push_request.firmware_id}", current_user.id)
            command_ids.append(cmd_id)
        
        return {
            "firmware_id": push_request.firmware_id,
            "devices_queued": len(valid_devices),
            "valid_devices": valid_devices,
            "command_ids": command_ids,
            "message": f"Firmware update queued for {len(valid_devices)} devices"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error pushing firmware: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to push firmware"
        )

# Utility Endpoints

@router.get("/api/device/health")
async def device_health_check(db: Session = Depends(get_db)):
    """Check device module health"""
    try:
        # Get device counts
        total_devices = db.query(IClockTerminal).count()
        online_devices = db.execute(text("""
            SELECT COUNT(*) FROM iclock_terminal 
            WHERE last_activity >= :since
        """), {
            'since': datetime.utcnow() - timedelta(minutes=DEVICE_ONLINE_THRESHOLD_MINUTES)
        }).scalar()
        
        # Get command queue stats
        pending_commands = db.execute(text("""
            SELECT COUNT(*) FROM iclock_devcmd WHERE status = 0
        """)).scalar()
        
        return {
            "status": "healthy",
            "total_devices": total_devices,
            "online_devices": online_devices,
            "offline_devices": total_devices - online_devices,
            "pending_commands": pending_commands,
            "uptime_percentage": round((online_devices / total_devices * 100) if total_devices > 0 else 0, 2),
            "last_check": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# ═══════════════════════════════════════════════════════════════════════════════
# LIVE TRANSACTION FEED
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/device/transactions/live/")
async def get_live_transactions(
    limit: int = Query(50, ge=1, le=200),
    terminal_sn: Optional[str] = Query(None),
    emp_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Recent punch transactions — the live feed shown in the Real-time Monitor."""
    try:
        where = "WHERE 1=1"
        params: dict = {"limit": limit}
        if terminal_sn:
            where += " AND t.terminal_sn = :sn"
            params["sn"] = terminal_sn
        if emp_code:
            where += " AND t.emp_code = :emp_code"
            params["emp_code"] = emp_code

        rows = db.execute(text(f"""
            SELECT
                t.id, t.emp_code, t.punch_time, t.punch_state, t.verify_type,
                t.terminal_sn, t.area_alias,
                COALESCE(e.first_name || ' ' || e.last_name, t.emp_code) AS emp_name,
                d.alias AS device_alias
            FROM iclock_transaction t
            LEFT JOIN personnel_employee e ON e.emp_code = t.emp_code
            LEFT JOIN iclock_terminal d ON d.sn = t.terminal_sn
            {where}
            ORDER BY t.punch_time DESC
            LIMIT :limit
        """), params).fetchall()

        PUNCH_STATE = {0: "Check-In", 1: "Check-Out", 2: "Break-Out", 3: "Break-In", 4: "OT-In", 5: "OT-Out"}
        VERIFY_TYPE = {0: "Password", 1: "Fingerprint", 2: "Face", 3: "Card", 15: "Multi"}

        return {"success": True, "data": [
            {
                "id": r[0],
                "emp_code": r[1],
                "punch_time": r[2].isoformat() if r[2] else None,
                "punch_state": r[3],
                "punch_state_label": PUNCH_STATE.get(r[3], "Unknown"),
                "verify_type": r[4],
                "verify_type_label": VERIFY_TYPE.get(r[4], "Unknown"),
                "terminal_sn": r[5],
                "area_alias": r[6],
                "emp_name": r[7],
                "device_alias": r[8] or r[5],
            }
            for r in rows
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# DEVICE SCHEDULES
# ═══════════════════════════════════════════════════════════════════════════════

class ScheduleCreate(BaseModel):
    terminal_sn: str
    name: str
    description: Optional[str] = None
    monday_enabled: bool = True
    tuesday_enabled: bool = True
    wednesday_enabled: bool = True
    thursday_enabled: bool = True
    friday_enabled: bool = True
    saturday_enabled: bool = False
    sunday_enabled: bool = False
    time_ranges: Optional[List[Dict[str, Any]]] = None
    access_mode: str = "NORMAL"
    is_active: bool = True
    priority: int = 1

class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    monday_enabled: Optional[bool] = None
    tuesday_enabled: Optional[bool] = None
    wednesday_enabled: Optional[bool] = None
    thursday_enabled: Optional[bool] = None
    friday_enabled: Optional[bool] = None
    saturday_enabled: Optional[bool] = None
    sunday_enabled: Optional[bool] = None
    time_ranges: Optional[List[Dict[str, Any]]] = None
    access_mode: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


@router.get("/api/device/schedules/")
async def list_schedules(
    terminal_sn: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        q = db.query(DeviceSchedule)
        if terminal_sn:
            q = q.filter(DeviceSchedule.device_id == terminal_sn)
        rows = q.order_by(DeviceSchedule.priority.desc(), DeviceSchedule.name).all()
        return {"success": True, "data": [
            {
                "id": r.id, "terminal_sn": r.device_id, "name": r.name,
                "description": r.description,
                "monday_enabled": r.monday_enabled, "tuesday_enabled": r.tuesday_enabled,
                "wednesday_enabled": r.wednesday_enabled, "thursday_enabled": r.thursday_enabled,
                "friday_enabled": r.friday_enabled, "saturday_enabled": r.saturday_enabled,
                "sunday_enabled": r.sunday_enabled,
                "time_ranges": r.time_ranges or [],
                "access_mode": r.access_mode, "is_active": r.is_active, "priority": r.priority,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/device/schedules/")
async def create_schedule(
    payload: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        sched = DeviceSchedule(
            device_id=payload.terminal_sn,
            name=payload.name, description=payload.description,
            monday_enabled=payload.monday_enabled, tuesday_enabled=payload.tuesday_enabled,
            wednesday_enabled=payload.wednesday_enabled, thursday_enabled=payload.thursday_enabled,
            friday_enabled=payload.friday_enabled, saturday_enabled=payload.saturday_enabled,
            sunday_enabled=payload.sunday_enabled,
            time_ranges=payload.time_ranges or [],
            access_mode=payload.access_mode,
            is_active=payload.is_active, priority=payload.priority,
        )
        db.add(sched)
        db.commit()
        db.refresh(sched)

        # Push schedule to device as SET OPTION
        days = ",".join([d for d, f in [
            ("MON", payload.monday_enabled), ("TUE", payload.tuesday_enabled),
            ("WED", payload.wednesday_enabled), ("THU", payload.thursday_enabled),
            ("FRI", payload.friday_enabled), ("SAT", payload.saturday_enabled),
            ("SUN", payload.sunday_enabled),
        ] if f])
        queue_command(db, payload.terminal_sn,
                      f"SET OPTION SCHEDULE={sched.id} NAME={payload.name} DAYS={days} MODE={payload.access_mode}",
                      current_user.id)

        return {"success": True, "data": {"id": sched.id, "name": sched.name}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/device/schedules/{sched_id}")
async def update_schedule(
    sched_id: int,
    payload: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sched = db.query(DeviceSchedule).filter(DeviceSchedule.id == sched_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    for k, v in payload.dict(exclude_none=True).items():
        setattr(sched, k, v)
    db.commit()
    return {"success": True}


@router.delete("/api/device/schedules/{sched_id}")
async def delete_schedule(
    sched_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import text as _text
    count = db.execute(_text("DELETE FROM device_schedules WHERE id = :id"), {"id": sched_id}).rowcount
    db.commit()
    if count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"success": True}


# ═══════════════════════════════════════════════════════════════════════════════
# MAINTENANCE TRACKING
# ═══════════════════════════════════════════════════════════════════════════════

class MaintenanceCreate(BaseModel):
    terminal_sn: str
    maintenance_type: str  # ROUTINE, REPAIR, CALIBRATION, CLEANING
    description: Optional[str] = None
    scheduled_date: str   # ISO format
    estimated_duration: Optional[int] = None
    technician_notes: Optional[str] = None
    parts_used: Optional[List[Dict[str, Any]]] = None
    cost: Optional[int] = None

class MaintenanceUpdate(BaseModel):
    maintenance_type: Optional[str] = None
    description: Optional[str] = None
    scheduled_date: Optional[str] = None
    estimated_duration: Optional[int] = None
    status: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    actual_duration: Optional[int] = None
    technician_notes: Optional[str] = None
    parts_used: Optional[List[Dict[str, Any]]] = None
    cost: Optional[int] = None
    test_results: Optional[Dict[str, Any]] = None
    next_maintenance_date: Optional[str] = None


@router.get("/api/device/maintenance/")
async def list_maintenance(
    terminal_sn: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        q = db.query(DeviceMaintenance)
        if terminal_sn:
            q = q.filter(DeviceMaintenance.device_id == terminal_sn)
        if status:
            q = q.filter(DeviceMaintenance.status == status.upper())
        rows = q.order_by(DeviceMaintenance.scheduled_date.desc()).all()

        alias_map = {t.sn: (t.alias or t.sn) for t in db.query(IClockTerminal).all()}

        return {"success": True, "data": [
            {
                "id": r.id, "terminal_sn": r.device_id,
                "device_alias": alias_map.get(r.device_id, r.device_id),
                "maintenance_type": r.maintenance_type, "description": r.description,
                "scheduled_date": r.scheduled_date.isoformat() if r.scheduled_date else None,
                "estimated_duration": r.estimated_duration,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "actual_duration": r.actual_duration,
                "technician_notes": r.technician_notes,
                "parts_used": r.parts_used or [],
                "cost": r.cost,
                "test_results": r.test_results or {},
                "next_maintenance_date": r.next_maintenance_date.isoformat() if r.next_maintenance_date else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _parse_dt(s: Optional[str]):
    """Parse ISO datetime string, tolerating the Z suffix Python <3.11 rejects."""
    if not s:
        return None
    from datetime import datetime as dt
    return dt.fromisoformat(s.replace("Z", "+00:00"))


@router.post("/api/device/maintenance/")
async def create_maintenance(
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        maint = DeviceMaintenance(
            device_id=payload.terminal_sn,
            maintenance_type=payload.maintenance_type,
            description=payload.description,
            scheduled_date=_parse_dt(payload.scheduled_date),
            estimated_duration=payload.estimated_duration,
            status="SCHEDULED",
            performed_by=current_user.id,
            technician_notes=payload.technician_notes,
            parts_used=payload.parts_used or [],
            cost=payload.cost,
        )
        db.add(maint)
        db.commit()
        db.refresh(maint)
        return {"success": True, "data": {"id": maint.id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/device/maintenance/{maint_id}")
async def update_maintenance(
    maint_id: int,
    payload: MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    maint = db.query(DeviceMaintenance).filter(DeviceMaintenance.id == maint_id).first()
    if not maint:
        raise HTTPException(status_code=404, detail="Record not found")

    data = payload.dict(exclude_none=True)
    for date_field in ["scheduled_date", "started_at", "completed_at", "next_maintenance_date"]:
        if date_field in data and data[date_field]:
            data[date_field] = _parse_dt(data[date_field])
    for k, v in data.items():
        setattr(maint, k, v)
    db.commit()
    return {"success": True}


@router.delete("/api/device/maintenance/{maint_id}")
async def delete_maintenance(
    maint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import text as _text
    count = db.execute(_text("DELETE FROM device_maintenance WHERE id = :id"), {"id": maint_id}).rowcount
    db.commit()
    if count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"success": True}


# ═══════════════════════════════════════════════════════════════════════════════
# EXTENDED COMMANDS  (OPEN DOOR / SET ACCESS / SET OPTION / BIODATA SYNC)
# ═══════════════════════════════════════════════════════════════════════════════

class ExtendedCommandRequest(BaseModel):
    sn: str
    command_type: str  # OPEN_DOOR | SET_ACCESS | SET_OPTION | BIODATA | ENROLL | LOCK | UNLOCK
    params: Dict[str, Any] = {}


@router.post("/api/device/devcmd/extended/")
async def send_extended_command(
    payload: ExtendedCommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Extended command dispatcher — maps high-level command types to
    the actual ADMS command strings queued for the device.
    """
    try:
        terminal = db.execute(
            text("SELECT id, sn, alias FROM iclock_terminal WHERE sn = :sn"),
            {"sn": payload.sn}
        ).fetchone()
        if not terminal:
            raise HTTPException(status_code=404, detail="Device not found")

        p = payload.params
        cmd_map = {
            "OPEN_DOOR":    f"OPEN DOOR {p.get('door_id', 1)}",
            "LOCK":         "DEVICE LOCK",
            "UNLOCK":       "DEVICE UNLOCK",
            "DISABLE":      "DISABLE",
            "ENABLE":       "ENABLE",
            "DELETE_USER":  f"DATA DELETE USERINFO\tPin={p.get('emp_code', '')}",
            "SET_ACCESS":   f"DATA UPDATE USERINFO\tPin={p.get('emp_code')}\tACCGROUP={p.get('acc_level_id', 0)}\tPRIVILEGE={p.get('privilege', 0)}",
            "SET_OPTION":   f"SET OPTION {p.get('key', 'LANGUAGE')}={p.get('value', '0')}",
            "BIODATA":      f"DATA UPDATE BIODATA PIN={p.get('emp_code', 'ALL')}",
            "ENROLL":       f"ENROLL FP PIN={p.get('emp_code', '')}",
            "ENROLL_FACE":  f"ENROLL FACE PIN={p.get('emp_code', '')}",
            "BLACKLIST":    f"DATA UPDATE USERINFO PIN={p.get('emp_code')} PRIVILEGE=0 ACCGROUP=-1",
        }

        cmd = cmd_map.get(payload.command_type)
        if not cmd:
            raise HTTPException(status_code=400, detail=f"Unknown command type: {payload.command_type}")

        # For DISABLE/ENABLE, try direct ZKLib first then fall back to ADMS queue
        if payload.command_type in ("DISABLE", "ENABLE"):
            direct_device = (
                db.query(Device)
                .filter(
                    Device.serial_number == payload.sn,
                    Device.connection_mode.in_(["direct", "both"]),
                    Device.ip_address.isnot(None),
                )
                .first()
            )
            if direct_device:
                result = await _execute_direct_command(direct_device, cmd)
                if result.get("success"):
                    return {"success": True, "data": {"sn": payload.sn, "command_type": payload.command_type, "status": "executed", "method": "direct"}}
                logger.warning(f"Direct {cmd} failed for {payload.sn}, queuing ADMS: {result.get('error')}")

        cmd_id = queue_command(db, payload.sn, cmd, current_user.id)

        return {"success": True, "data": {
            "command_id": cmd_id,
            "sn": payload.sn,
            "command_type": payload.command_type,
            "cmd_string": cmd,
            "status": "pending",
        }}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── ADMS Server Configuration ─────────────────────────────────────────────────

_ADMS_PARAM_URL  = 'adms.server_url'
_ADMS_PARAM_AUTO = 'adms.auto_register'


def _get_param(db: Session, key: str) -> Optional[str]:
    row = db.execute(
        text("SELECT param_value FROM sys_parameters WHERE param_key = :k"),
        {"k": key},
    ).fetchone()
    return row.param_value if row else None


def _set_param(db: Session, key: str, value: str, description: str = "") -> None:
    db.execute(text("""
        INSERT INTO sys_parameters (param_key, param_value, module, description, updated_at)
        VALUES (:k, :v, 'device', :d, NOW())
        ON CONFLICT (param_key) DO UPDATE
            SET param_value = :v, updated_at = NOW()
    """), {"k": key, "v": value, "d": description})
    db.commit()


@router.get("/api/device/adms-config")
async def get_adms_config(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the ADMS server URL that readers should be configured with."""
    server_url   = _get_param(db, _ADMS_PARAM_URL)
    auto_register = _get_param(db, _ADMS_PARAM_AUTO)
    return {
        "success": True,
        "data": {
            "server_url":    server_url or "",
            "auto_register": auto_register != "false",
            "endpoints": {
                "cdata":      "/iclock/cdata",
                "getrequest": "/iclock/getrequest",
                "devicecmd":  "/iclock/devicecmd",
            },
        },
    }


@router.put("/api/device/adms-config")
async def update_adms_config(
    body: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Save the ADMS server URL and auto-register toggle."""
    if "server_url" in body:
        url = (body["server_url"] or "").strip()
        _set_param(db, _ADMS_PARAM_URL, url, "URL readers use to reach this ADMS server")
    if "auto_register" in body:
        _set_param(db, _ADMS_PARAM_AUTO, "true" if body["auto_register"] else "false",
                   "Auto-register unknown devices on first heartbeat")
    return {"success": True, "message": "ADMS config saved"}
