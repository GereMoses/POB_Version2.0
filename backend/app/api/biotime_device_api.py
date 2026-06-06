"""
BioTime 9.5 Compatible Device API and ADMS Protocol
Implements device management and ADMS PUSH protocol endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import logging

from app.core.database import get_db
from app.models.biotime_models import IClockTerminal, IClockTransaction, PersonnelEmployee, BaseOperationLog
from app.api.biotime_auth import get_current_user, AuthUser, log_operation

# Router
router = APIRouter()

# Configure logging
logger = logging.getLogger(__name__)

# Pydantic Models
class TerminalCreate(BaseModel):
    sn: str
    alias: Optional[str] = None
    ip_address: Optional[str] = None
    area_id: Optional[int] = None
    zone_id: Optional[int] = None
    reader_purpose: Optional[str] = 'ATTENDANCE'  # ATTENDANCE | ACCESS_ENTRY | ACCESS_EXIT
    device_type: Optional[int] = 0
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    comm_key: Optional[str] = "0"
    fw_ver: Optional[str] = None

class TerminalUpdate(BaseModel):
    alias: Optional[str] = None
    ip_address: Optional[str] = None
    area_id: Optional[int] = None
    zone_id: Optional[int] = None
    reader_purpose: Optional[str] = None  # ATTENDANCE | ACCESS_ENTRY | ACCESS_EXIT
    device_type: Optional[int] = None
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    comm_key: Optional[str] = None
    fw_ver: Optional[str] = None
    state: Optional[int] = None

class TerminalResponse(BaseModel):
    id: int
    sn: str
    alias: Optional[str] = None
    ip_address: Optional[str] = None
    area_id: Optional[int] = None
    zone_id: Optional[int] = None
    reader_purpose: Optional[str] = 'ATTENDANCE'
    device_type: Optional[int] = 0
    device_name: Optional[str] = None
    device_model: Optional[str] = None
    last_activity: Optional[datetime] = None
    state: int
    comm_key: Optional[str] = None
    fw_ver: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class DeviceCommandRequest(BaseModel):
    sn: str
    cmd: str  # REBOOT, DATA UPDATE USERINFO, CHECK, etc.

class DeviceCommandResponse(BaseModel):
    id: int
    sn: str
    cmd: str
    status: str  # pending, sent, acknowledged, failed
    created_at: datetime
    sent_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None

# In-memory command queue (in production, use Redis)
command_queue = {}

# Helper Functions
def parse_adms_data(data: str) -> dict:
    """Parse ADMS protocol data"""
    lines = data.strip().split('\n')
    parsed = {}
    
    for line in lines:
        if '=' in line:
            key, value = line.split('=', 1)
            parsed[key.strip()] = value.strip()
    
    return parsed

def format_adms_response(response_data: dict) -> str:
    """Format response for ADMS protocol"""
    lines = []
    for key, value in response_data.items():
        lines.append(f"{key}={value}")
    return '\n'.join(lines)

def process_attendance_data(data: dict, db: Session) -> bool:
    """Process attendance data from ADMS"""
    try:
        # Extract attendance information
        emp_code = data.get('PIN')
        punch_time_str = data.get('Time')
        verify_type = data.get('Verify', '0')
        work_code = data.get('WorkCode', '0')
        
        if not emp_code or not punch_time_str:
            logger.warning(f"Missing required attendance data: {data}")
            return False
        
        # Parse punch time
        try:
            punch_time = datetime.strptime(punch_time_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            logger.warning(f"Invalid punch time format: {punch_time_str}")
            return False
        
        # Determine punch state (simplified logic)
        punch_state = 0  # Default to check-in
        if 'Mode' in data:
            mode = data['Mode']
            if mode == '1':
                punch_state = 1  # Check-out
            elif mode == '2':
                punch_state = 2  # Break-out
            elif mode == '3':
                punch_state = 3  # Break-in
        
        # Create transaction
        new_transaction = IClockTransaction(
            emp_code=emp_code,
            punch_time=punch_time,
            punch_state=punch_state,
            verify_type=int(verify_type),
            work_code=int(work_code),
            terminal_sn=data.get('SN'),
            area_alias=data.get('Area')
        )
        
        db.add(new_transaction)
        db.commit()
        
        logger.info(f"Processed attendance: {emp_code} at {punch_time}")
        return True
        
    except Exception as e:
        logger.error(f"Error processing attendance data: {e}")
        return False

# Device Management Endpoints

@router.get("/iclock/api/terminals/", response_model=List[TerminalResponse])
async def list_terminals(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all terminals
    BioTime compatible endpoint: GET /iclock/api/terminals/
    """
    terminals = db.query(IClockTerminal).all()
    
    return [
        TerminalResponse(
            id=terminal.id,
            sn=terminal.sn,
            alias=terminal.alias,
            ip_address=terminal.ip_address,
            area_id=terminal.area_id,
            zone_id=terminal.zone_id,
            reader_purpose=terminal.reader_purpose or 'ATTENDANCE',
            device_type=terminal.device_type,
            device_name=terminal.device_name,
            device_model=terminal.device_model,
            last_activity=terminal.last_activity,
            state=terminal.state,
            comm_key=terminal.comm_key,
            fw_ver=terminal.fw_ver,
            created_at=terminal.created_at,
            updated_at=terminal.updated_at
        )
        for terminal in terminals
    ]

@router.post("/iclock/api/terminals/", response_model=TerminalResponse)
async def create_terminal(
    terminal_data: TerminalCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create or update terminal
    BioTime compatible endpoint: POST /iclock/api/terminals/
    """
    # Check if terminal already exists
    existing_terminal = db.query(IClockTerminal).filter(
        IClockTerminal.sn == terminal_data.sn
    ).first()
    
    if existing_terminal:
        # Update existing terminal
        update_data = terminal_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing_terminal, field, value)
        
        existing_terminal.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_terminal)
        
        # Log update operation
        log_operation(
            db=db,
            user_id=current_user.id,
            action="UPDATE",
            table_name="iclock_terminal",
            record_id=existing_terminal.id,
            new_values=str(update_data)
        )
        
        terminal = existing_terminal
    else:
        # Create new terminal
        new_terminal = IClockTerminal(**terminal_data.dict())
        db.add(new_terminal)
        db.commit()
        db.refresh(new_terminal)
        
        # Log creation operation
        log_operation(
            db=db,
            user_id=current_user.id,
            action="CREATE",
            table_name="iclock_terminal",
            record_id=new_terminal.id,
            new_values=str(terminal_data.dict())
        )
        
        terminal = new_terminal
    
    return TerminalResponse(
        id=terminal.id,
        sn=terminal.sn,
        alias=terminal.alias,
        ip_address=terminal.ip_address,
        area_id=terminal.area_id,
        last_activity=terminal.last_activity,
        state=terminal.state,
        comm_key=terminal.comm_key,
        fw_ver=terminal.fw_ver,
        created_at=terminal.created_at,
        updated_at=terminal.updated_at
    )

@router.get("/iclock/api/terminals/{terminal_sn}", response_model=TerminalResponse)
async def get_terminal(
    terminal_sn: str,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get terminal by serial number
    BioTime compatible endpoint: GET /iclock/api/terminals/{sn}/
    """
    terminal = db.query(IClockTerminal).filter(IClockTerminal.sn == terminal_sn).first()
    
    if not terminal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terminal not found"
        )
    
    return TerminalResponse(
        id=terminal.id,
        sn=terminal.sn,
        alias=terminal.alias,
        ip_address=terminal.ip_address,
        area_id=terminal.area_id,
        last_activity=terminal.last_activity,
        state=terminal.state,
        comm_key=terminal.comm_key,
        fw_ver=terminal.fw_ver,
        created_at=terminal.created_at,
        updated_at=terminal.updated_at
    )

@router.post("/iclock/api/devcmd/")
async def send_device_command(
    command_data: DeviceCommandRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send command to device
    BioTime compatible endpoint: POST /iclock/api/devcmd/
    """
    # Validate terminal exists
    terminal = db.query(IClockTerminal).filter(IClockTerminal.sn == command_data.sn).first()
    
    if not terminal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terminal not found"
        )
    
    # Generate command ID
    command_id = len(command_queue) + 1
    
    # Add to command queue
    command_queue[command_id] = {
        "sn": command_data.sn,
        "cmd": command_data.cmd,
        "status": "pending",
        "created_at": datetime.utcnow(),
        "created_by": current_user.id
    }
    
    # Log command creation
    log_operation(
        db=db,
        user_id=current_user.id,
        action="SEND_COMMAND",
        table_name="iclock_terminal",
        record_id=terminal.id,
        new_values=f"cmd: {command_data.cmd}"
    )
    
    return {
        "id": command_id,
        "sn": command_data.sn,
        "cmd": command_data.cmd,
        "status": "pending",
        "message": "Command queued for device"
    }

# ADMS Protocol Endpoints (Device Initiated - No Auth Required)

@router.get("/iclock/cdata", response_class=PlainTextResponse)
async def adms_cdata(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    ADMS PUSH endpoint for device data
    Device sends heartbeat and attendance data
    BioTime compatible endpoint: GET /iclock/cdata
    """
    try:
        # Get query parameters
        sn = request.query_params.get('SN')
        options = request.query_params.get('options', '')
        
        if not sn:
            logger.warning("ADMS request missing SN parameter")
            return "ERROR=Missing SN parameter"
        
        # Get request body (POST data)
        body = await request.body()
        data_str = body.decode('utf-8') if body else ""
        
        # Parse incoming data
        if data_str:
            parsed_data = parse_adms_data(data_str)
            
            # Process attendance data if present
            if 'PIN' in parsed_data and 'Time' in parsed_data:
                if process_attendance_data(parsed_data, db):
                    logger.info(f"Processed attendance from device {sn}")
                else:
                    logger.warning(f"Failed to process attendance from device {sn}")
        
        # Update terminal last activity
        terminal = db.query(IClockTerminal).filter(IClockTerminal.sn == sn).first()
        if terminal:
            terminal.last_activity = datetime.utcnow()
            terminal.state = 1  # Online
            db.commit()
        else:
            # Auto-register new terminal
            logger.info(f"Auto-registering new terminal: {sn}")
            new_terminal = IClockTerminal(
                sn=sn,
                alias=f"Terminal {sn}",
                state=1,
                last_activity=datetime.utcnow()
            )
            db.add(new_terminal)
            db.commit()
        
        # Check for pending commands
        pending_commands = []
        for cmd_id, cmd_data in command_queue.items():
            if cmd_data["sn"] == sn and cmd_data["status"] == "pending":
                pending_commands.append(f"C:{cmd_id}:{cmd_data['cmd']}")
                cmd_data["status"] = "sent"
                cmd_data["sent_at"] = datetime.utcnow()
        
        # Return response
        if pending_commands:
            response = "\n".join(pending_commands)
        else:
            response = "OK"
        
        return PlainTextResponse(content=response)
        
    except Exception as e:
        logger.error(f"Error in ADMS cdata endpoint: {e}")
        return PlainTextResponse(content="ERROR=Internal server error")

@router.get("/iclock/getrequest", response_class=PlainTextResponse)
async def adms_getrequest(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    ADMS polling endpoint for device commands
    Device polls for pending commands
    BioTime compatible endpoint: GET /iclock/getrequest
    """
    try:
        # Get query parameters
        sn = request.query_params.get('SN')
        
        if not sn:
            return "ERROR=Missing SN parameter"
        
        # Check for pending commands
        pending_commands = []
        commands_to_remove = []
        
        for cmd_id, cmd_data in command_queue.items():
            if cmd_data["sn"] == sn and cmd_data["status"] == "sent":
                pending_commands.append(f"C:{cmd_id}:{cmd_data['cmd']}")
                commands_to_remove.append(cmd_id)
        
        # Remove sent commands from queue
        for cmd_id in commands_to_remove:
            del command_queue[cmd_id]
        
        # Return commands or NONE
        if pending_commands:
            response = "\n".join(pending_commands)
        else:
            response = "NONE"
        
        return PlainTextResponse(content=response)
        
    except Exception as e:
        logger.error(f"Error in ADMS getrequest endpoint: {e}")
        return PlainTextResponse(content="ERROR=Internal server error")

@router.post("/iclock/devicecmd", response_class=PlainTextResponse)
async def adms_devicecmd(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    ADMS command result endpoint
    Device returns command execution results
    BioTime compatible endpoint: POST /iclock/devicecmd
    """
    try:
        # Get query parameters
        sn = request.query_params.get('SN')
        
        if not sn:
            return "ERROR=Missing SN parameter"
        
        # Get request body
        body = await request.body()
        data_str = body.decode('utf-8') if body else ""
        
        # Parse command result
        if data_str:
            parsed_data = parse_adms_data(data_str)
            
            # Find and update command in queue
            cmd_id_str = parsed_data.get('ID')
            if cmd_id_str:
                cmd_id = int(cmd_id_str)
                if cmd_id in command_queue:
                    command_queue[cmd_id]["status"] = "acknowledged"
                    command_queue[cmd_id]["acknowledged_at"] = datetime.utcnow()
                    command_queue[cmd_id]["return_code"] = parsed_data.get('Return', '0')
                    
                    logger.info(f"Command {cmd_id} acknowledged by device {sn}")
        
        return "OK"
        
    except Exception as e:
        logger.error(f"Error in ADMS devicecmd endpoint: {e}")
        return PlainTextResponse(content="ERROR=Internal server error")

@router.get("/iclock/api/device-status/{sn}")
async def get_device_status(
    sn: str,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get device status
    BioTime compatible endpoint: GET /iclock/api/device-status/{sn}/
    """
    terminal = db.query(IClockTerminal).filter(IClockTerminal.sn == sn).first()
    
    if not terminal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Terminal not found"
        )
    
    # Get recent transactions
    recent_txns = db.query(IClockTransaction).filter(
        IClockTransaction.terminal_sn == sn
    ).order_by(IClockTransaction.punch_time.desc()).limit(10).all()
    
    return {
        "terminal": {
            "id": terminal.id,
            "sn": terminal.sn,
            "alias": terminal.alias,
            "ip_address": terminal.ip_address,
            "state": terminal.state,
            "last_activity": terminal.last_activity,
            "comm_key": terminal.comm_key,
            "fw_ver": terminal.fw_ver
        },
        "recent_transactions": [
            {
                "id": txn.id,
                "emp_code": txn.emp_code,
                "punch_time": txn.punch_time,
                "punch_state": txn.punch_state,
                "verify_type": txn.verify_type,
                "upload_time": txn.upload_time
            }
            for txn in recent_txns
        ],
        "pending_commands": len([cmd for cmd in command_queue.values() 
                              if cmd["sn"] == sn and cmd["status"] in ["pending", "sent"]])
    }
