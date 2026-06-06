"""
Meeting Management API
BioTime 9.5 Meeting Room Booking + POB Extensions
"""

import os
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
import asyncio
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.meeting_service import MeetingService
from app.models.meeting import (
    MeetingRoom, MeetingBooking, MeetingAttendee, MeetingAttendance,
    MeetingMinutes, MeetingActionItem, MeetingEquipment
)
from app.models.biotime_models import PersonnelEmployee
from app.models.visitor import Visitor, VisitorPreRegistration

router = APIRouter(prefix="/api/meeting", tags=["meeting"])

# Pydantic models for request/response
class RoomCreate(BaseModel):
    room_name: str
    capacity: int
    location: Optional[str] = None
    area_id: Optional[int] = None
    door_id: Optional[int] = None
    equipment: Optional[List[str]] = None
    status: Optional[int] = 0
    require_approval: Optional[bool] = False
    mustering_zone_id: Optional[int] = None
    is_emergency_assembly: Optional[bool] = False

class RoomUpdate(BaseModel):
    room_name: Optional[str] = None
    capacity: Optional[int] = None
    location: Optional[str] = None
    area_id: Optional[int] = None
    door_id: Optional[int] = None
    equipment: Optional[List[str]] = None
    status: Optional[int] = None
    require_approval: Optional[bool] = None
    mustering_zone_id: Optional[int] = None
    is_emergency_assembly: Optional[bool] = None

class AttendeeCreate(BaseModel):
    attendee_type: int  # 0=employee,1=visitor,2=external
    emp_id: Optional[int] = None
    visitor_id: Optional[int] = None
    ext_name: Optional[str] = None
    ext_email: Optional[EmailStr] = None
    ext_phone: Optional[str] = None
    is_required: Optional[bool] = True

class BookingCreate(BaseModel):
    room_id: int
    title: str
    start_time: datetime
    end_time: datetime
    organizer_emp_id: int
    agenda: Optional[str] = None
    attachments: Optional[List[str]] = None
    repeat_type: Optional[int] = 0
    repeat_until: Optional[date] = None
    auto_unlock: Optional[bool] = True
    attendees: Optional[List[AttendeeCreate]] = []

class BookingUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    agenda: Optional[str] = None
    attachments: Optional[List[str]] = None
    repeat_type: Optional[int] = None
    repeat_until: Optional[date] = None
    auto_unlock: Optional[bool] = None

class CheckInRequest(BaseModel):
    meeting_code: Optional[str] = None
    qr_code: Optional[str] = None
    emp_code: Optional[str] = None
    room_id: Optional[int] = None
    device_sn: Optional[str] = None
    verify_type: Optional[int] = 100

class ApprovalRequest(BaseModel):
    status: int  # 1=approved,2=rejected
    note: Optional[str] = None

class CancelRequest(BaseModel):
    reason: str

class ActionItemCreate(BaseModel):
    action_desc: str
    assignee_emp_id: int
    due_date: Optional[date] = None
    status: Optional[int] = 0

class ActionItemUpdate(BaseModel):
    action_desc: Optional[str] = None
    assignee_emp_id: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[int] = None

class EquipmentCreate(BaseModel):
    equip_name: str
    equip_type: Optional[str] = None
    room_id: Optional[int] = None
    status: Optional[int] = 0
    serial_no: Optional[str] = None
    purchase_date: Optional[date] = None
    warranty_expiry: Optional[date] = None
    last_maintenance: Optional[date] = None
    notes: Optional[str] = None

class EquipmentUpdate(BaseModel):
    equip_name: Optional[str] = None
    equip_type: Optional[str] = None
    room_id: Optional[int] = None
    status: Optional[int] = None
    serial_no: Optional[str] = None
    purchase_date: Optional[date] = None
    warranty_expiry: Optional[date] = None
    last_maintenance: Optional[date] = None
    notes: Optional[str] = None

# Dashboard endpoint
@router.get("/dashboard/")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get meeting dashboard statistics"""
    service = MeetingService(db)
    return await service.get_dashboard_stats()

# Room endpoints
@router.get("/rooms/", response_model=List[dict])
async def get_rooms(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Get all meeting rooms"""
    service = MeetingService(db)
    return await service.get_rooms(include_inactive)

@router.get("/rooms/{room_id}", response_model=dict)
async def get_room(room_id: int, db: Session = Depends(get_db)):
    """Get room by ID"""
    service = MeetingService(db)
    room = await service.get_room_by_id(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    return room

@router.post("/rooms/", response_model=dict)
async def create_room(room_data: RoomCreate, db: Session = Depends(get_db)):
    """Create new meeting room"""
    service = MeetingService(db)
    
    # Convert equipment list to JSON string
    room_dict = room_data.dict()
    if room_dict.get('equipment'):
        room_dict['equipment'] = str(room_dict['equipment'])
    
    return await service.create_room(room_dict)

@router.put("/rooms/{room_id}", response_model=dict)
async def update_room(
    room_id: int, 
    room_data: RoomUpdate, 
    db: Session = Depends(get_db)
):
    """Update meeting room"""
    service = MeetingService(db)
    
    # Convert equipment list to JSON string
    room_dict = room_data.dict(exclude_unset=True)
    if 'equipment' in room_dict and room_dict['equipment'] is not None:
        room_dict['equipment'] = str(room_dict['equipment'])
    
    return await service.update_room(room_id, room_dict)

@router.delete("/rooms/{room_id}")
async def delete_room(room_id: int, db: Session = Depends(get_db)):
    """Delete meeting room"""
    service = MeetingService(db)
    await service.delete_room(room_id)
    return {"message": "Room deleted successfully"}

@router.get("/rooms/{room_id}/calendar/")
async def get_room_calendar(
    room_id: int,
    start: datetime = Query(...),
    end: datetime = Query(...),
    db: Session = Depends(get_db)
):
    """Get room calendar bookings"""
    service = MeetingService(db)
    return await service.get_room_calendar(room_id, start, end)

@router.get("/rooms/availability/")
async def check_room_availability(
    start_time: datetime = Query(...),
    end_time: datetime = Query(...),
    capacity: int = Query(0),
    db: Session = Depends(get_db)
):
    """Check available rooms for time slot"""
    service = MeetingService(db)
    return await service.check_room_availability(start_time, end_time, capacity)

# Booking endpoints
@router.get("/bookings/", response_model=List[dict])
async def get_bookings(
    room_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status: Optional[int] = Query(None),
    organizer_id: Optional[int] = Query(None),
    limit: int = Query(100),
    db: Session = Depends(get_db)
):
    """Get meeting bookings"""
    service = MeetingService(db)
    return await service.get_bookings(room_id, start_date, end_date, status, organizer_id, limit)

@router.get("/bookings/{booking_id}", response_model=dict)
async def get_booking(booking_id: int, db: Session = Depends(get_db)):
    """Get booking with full details"""
    service = MeetingService(db)
    booking = await service.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    return booking

@router.post("/bookings/", response_model=dict)
async def create_booking(booking_data: BookingCreate, db: Session = Depends(get_db)):
    """Create new meeting booking"""
    service = MeetingService(db)
    
    # Convert booking data
    booking_dict = booking_data.dict()
    
    # Convert attendees and attachments to JSON strings
    if booking_dict.get('attendees'):
        attendees = booking_dict.pop('attendees')
    else:
        attendees = []
    
    if booking_dict.get('attachments'):
        booking_dict['attachments'] = str(booking_dict['attachments'])
    
    # Create booking
    booking = await service.create_booking(booking_dict)
    
    # Add attendees if provided
    if attendees:
        attendees_dict = [att.dict() for att in attendees]
        await service.add_attendees(booking['id'], attendees_dict)
    
    return await service.get_booking_by_id(booking['id'])

@router.put("/bookings/{booking_id}", response_model=dict)
async def update_booking(
    booking_id: int,
    booking_data: BookingUpdate,
    db: Session = Depends(get_db)
):
    """Update meeting booking"""
    service = MeetingService(db)
    
    # Convert booking data
    booking_dict = booking_data.dict(exclude_unset=True)
    
    # Convert attachments to JSON string
    if 'attachments' in booking_dict and booking_dict['attachments'] is not None:
        booking_dict['attachments'] = str(booking_dict['attachments'])
    
    return await service.update_booking(booking_id, booking_dict)

@router.post("/bookings/{booking_id}/cancel/")
async def cancel_booking(
    booking_id: int,
    cancel_data: CancelRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Cancel meeting booking"""
    service = MeetingService(db)
    return await service.cancel_booking(booking_id, cancel_data.reason, current_user.id)

@router.post("/bookings/{booking_id}/approve/")
async def approve_booking(
    booking_id: int,
    approval_data: ApprovalRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Approve or reject booking"""
    service = MeetingService(db)
    return await service.approve_booking(
        booking_id, 
        approval_data.status, 
        approval_data.note or "", 
        current_user.id
    )

@router.post("/bookings/{booking_id}/complete/")
async def complete_booking(
    booking_id: int,
    db: Session = Depends(get_db)
):
    """Mark booking as completed"""
    service = MeetingService(db)
    return await service.complete_booking(booking_id)

@router.get("/bookings/{booking_id}/qr/")
async def get_booking_qr(booking_id: int, db: Session = Depends(get_db)):
    """Get booking QR code image"""
    service = MeetingService(db)
    booking = await service.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    qr_path = booking.get('qr_code')
    if not qr_path or not os.path.exists(qr_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QR code not found"
        )
    
    return FileResponse(qr_path, media_type="image/png")

# Attendee endpoints
@router.get("/bookings/{booking_id}/attendees/", response_model=List[dict])
async def get_booking_attendees(booking_id: int, db: Session = Depends(get_db)):
    """Get booking attendees"""
    service = MeetingService(db)
    return await service.get_booking_attendees(booking_id)

@router.post("/bookings/{booking_id}/attendees/", response_model=List[dict])
async def add_attendees(
    booking_id: int,
    attendees_data: List[AttendeeCreate],
    db: Session = Depends(get_db)
):
    """Add attendees to booking"""
    service = MeetingService(db)
    attendees_dict = [att.dict() for att in attendees_data]
    return await service.add_attendees(booking_id, attendees_dict)

@router.delete("/bookings/{booking_id}/attendees/{attendee_id}")
async def remove_attendee(
    booking_id: int,
    attendee_id: int,
    db: Session = Depends(get_db)
):
    """Remove attendee from booking"""
    service = MeetingService(db)
    await service.remove_attendee(booking_id, attendee_id)
    return {"message": "Attendee removed successfully"}

@router.post("/bookings/{booking_id}/invite/")
async def invite_attendees(
    booking_id: int,
    invite_data: dict,
    db: Session = Depends(get_db)
):
    """Send invitations to external attendees"""
    # This would implement email invitations with .ics files
    return {"message": "Invitations sent successfully"}

# Check-in endpoints
@router.post("/check-in/")
async def check_in_attendee(
    check_in_data: CheckInRequest,
    db: Session = Depends(get_db)
):
    """Check in attendee to meeting"""
    service = MeetingService(db)
    return await service.check_in_attendee(
        meeting_code=check_in_data.meeting_code,
        qr_code=check_in_data.qr_code,
        emp_code=check_in_data.emp_code,
        room_id=check_in_data.room_id,
        device_sn=check_in_data.device_sn,
        verify_type=check_in_data.verify_type
    )

@router.post("/check-out/")
async def check_out_attendee(attendance_id: int, db: Session = Depends(get_db)):
    """Check out attendee"""
    service = MeetingService(db)
    return await service.check_out_attendee(attendance_id)

# Minutes endpoints
@router.get("/bookings/{booking_id}/minutes/", response_model=List[dict])
async def get_booking_minutes(booking_id: int, db: Session = Depends(get_db)):
    """Get booking minutes"""
    service = MeetingService(db)
    return await service.get_booking_minutes(booking_id)

@router.post("/bookings/{booking_id}/minutes/")
async def upload_minutes(
    booking_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Upload meeting minutes"""
    # Save file and create record
    upload_dir = "uploads/meeting_minutes"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = f"{upload_dir}/{booking_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    service = MeetingService(db)
    return await service.upload_minutes(booking_id, file_path, current_user.id)

# Action items endpoints
@router.get("/bookings/{booking_id}/actions/", response_model=List[dict])
async def get_booking_actions(booking_id: int, db: Session = Depends(get_db)):
    """Get booking action items"""
    service = MeetingService(db)
    return await service.get_booking_actions(booking_id)

@router.post("/bookings/{booking_id}/actions/", response_model=dict)
async def add_action_item(
    booking_id: int,
    action_data: ActionItemCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Add action item"""
    service = MeetingService(db)
    action_dict = action_data.dict()
    action_dict['created_by'] = current_user.id
    return await service.add_action_item(booking_id, action_dict)

@router.put("/actions/{action_id}", response_model=dict)
async def update_action_item(
    action_id: int,
    action_data: ActionItemUpdate,
    db: Session = Depends(get_db)
):
    """Update action item"""
    service = MeetingService(db)
    return await service.update_action_item(action_id, action_data.dict(exclude_unset=True))

# Equipment endpoints
@router.get("/equipment/", response_model=List[dict])
async def get_equipment(
    room_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get meeting equipment"""
    service = MeetingService(db)
    return await service.get_equipment(room_id)

@router.post("/equipment/", response_model=dict)
async def create_equipment(
    equipment_data: EquipmentCreate,
    db: Session = Depends(get_db)
):
    """Create equipment"""
    service = MeetingService(db)
    return await service.create_equipment(equipment_data.dict())

@router.put("/equipment/{equipment_id}", response_model=dict)
async def update_equipment(
    equipment_id: int,
    equipment_data: EquipmentUpdate,
    db: Session = Depends(get_db)
):
    """Update equipment"""
    service = MeetingService(db)
    return await service.update_equipment(equipment_id, equipment_data.dict(exclude_unset=True))

@router.delete("/equipment/{equipment_id}")
async def delete_equipment(equipment_id: int, db: Session = Depends(get_db)):
    """Delete equipment"""
    service = MeetingService(db)
    await service.delete_equipment(equipment_id)
    return {"message": "Equipment deleted successfully"}

# Reports endpoints
@router.get("/reports/utilization/")
async def get_utilization_report(
    start_date: date = Query(...),
    end_date: date = Query(...),
    room_ids: Optional[str] = Query(None),  # Comma-separated list
    db: Session = Depends(get_db)
):
    """Get room utilization report"""
    service = MeetingService(db)
    
    room_id_list = None
    if room_ids:
        room_id_list = [int(x.strip()) for x in room_ids.split(',') if x.strip()]
    
    return await service.get_utilization_report(start_date, end_date, room_id_list)

@router.get("/reports/attendance/{booking_id}")
async def get_attendance_report(booking_id: int, db: Session = Depends(get_db)):
    """Get meeting attendance report"""
    service = MeetingService(db)
    return await service.get_attendance_report(booking_id)

@router.get("/reports/no-show/")
async def get_no_show_report(
    emp_id: Optional[int] = Query(None),
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db)
):
    """Get no-show report"""
    # Implementation would calculate no-show statistics
    return {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        },
        "no_shows": []
    }

@router.get("/reports/mustering-overlap/")
async def get_mustering_overlap_report(
    event_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Get meetings active during emergency event"""
    # Implementation would find meetings during muster events
    return {
        "event_id": event_id,
        "overlapping_meetings": []
    }

# WebSocket endpoint for live updates
@router.websocket("/ws/rooms/{room_id}")
async def websocket_room_updates(websocket: WebSocket, room_id: int):
    """WebSocket for live room booking updates"""
    await websocket.accept()
    
    try:
        while True:
            # Send live updates about room bookings, check-ins, etc.
            await websocket.send_json({
                "type": "heartbeat",
                "timestamp": datetime.now().isoformat()
            })
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        pass

