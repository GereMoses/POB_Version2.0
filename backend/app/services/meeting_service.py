"""
Meeting Management Service
BioTime 9.5 Meeting Room Booking + POB Extensions
"""

from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from fastapi import HTTPException, status
import json
import uuid
import qrcode
import os
from io import BytesIO

from app.core.database import get_db
from app.models.meeting import (
    MeetingRoom, MeetingBooking, MeetingAttendee, MeetingAttendance,
    MeetingMinutes, MeetingActionItem, MeetingEquipment
)
from app.models.visitor import Visitor, VisitorPreRegistration
from app.models.biotime_models import AccDoor, IClockTerminal, AccUserAuthorize, PersonnelEmployee

class MeetingService:
    """Comprehensive meeting management service"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # Room Management
    async def get_rooms(self, include_inactive: bool = False) -> List[Dict[str, Any]]:
        """Get all meeting rooms"""
        query = self.db.query(MeetingRoom)
        if not include_inactive:
            query = query.filter(MeetingRoom.status == 0)
        
        rooms = query.all()
        return [self._format_room(room) for room in rooms]
    
    async def get_room_by_id(self, room_id: int) -> Optional[Dict[str, Any]]:
        """Get room by ID"""
        room = self.db.query(MeetingRoom).filter(MeetingRoom.id == room_id).first()
        return self._format_room(room) if room else None
    
    async def create_room(self, room_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new meeting room"""
        # Check if room name exists
        existing = self.db.query(MeetingRoom).filter(
            MeetingRoom.room_name == room_data['room_name']
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Room name already exists"
            )
        
        # Check door uniqueness if specified
        if room_data.get('door_id'):
            existing_door = self.db.query(MeetingRoom).filter(
                MeetingRoom.door_id == room_data['door_id']
            ).first()
            if existing_door:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Door is already assigned to another room"
                )
        
        room = MeetingRoom(**room_data)
        self.db.add(room)
        self.db.commit()
        self.db.refresh(room)
        
        return self._format_room(room)
    
    async def update_room(self, room_id: int, room_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update meeting room"""
        room = self.db.query(MeetingRoom).filter(MeetingRoom.id == room_id).first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found"
            )
        
        # Check door uniqueness if changing
        if 'door_id' in room_data and room_data['door_id'] != room.door_id:
            existing_door = self.db.query(MeetingRoom).filter(
                and_(
                    MeetingRoom.door_id == room_data['door_id'],
                    MeetingRoom.id != room_id
                )
            ).first()
            if existing_door:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Door is already assigned to another room"
                )
        
        for key, value in room_data.items():
            if hasattr(room, key):
                setattr(room, key, value)
        
        self.db.commit()
        self.db.refresh(room)
        
        return self._format_room(room)
    
    async def delete_room(self, room_id: int) -> bool:
        """Delete meeting room"""
        room = self.db.query(MeetingRoom).filter(MeetingRoom.id == room_id).first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found"
            )
        
        # Check if room has bookings
        has_bookings = self.db.query(MeetingBooking).filter(
            MeetingBooking.room_id == room_id
        ).first()
        if has_bookings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete room with existing bookings"
            )
        
        self.db.delete(room)
        self.db.commit()
        return True
    
    async def get_room_calendar(self, room_id: int, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Get room calendar bookings"""
        bookings = self.db.query(MeetingBooking).filter(
            and_(
                MeetingBooking.room_id == room_id,
                MeetingBooking.start_time >= start_date,
                MeetingBooking.end_time <= end_date,
                MeetingBooking.status.in_([0, 1, 3])  # pending, approved, completed
            )
        ).all()
        
        return [self._format_booking_calendar(booking) for booking in bookings]
    
    async def check_room_availability(
        self, 
        start_time: datetime, 
        end_time: datetime, 
        capacity: int = 0,
        exclude_booking_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Check available rooms for time slot"""
        query = self.db.query(MeetingRoom).filter(MeetingRoom.status == 0)
        
        if capacity > 0:
            query = query.filter(MeetingRoom.capacity >= capacity)
        
        rooms = query.all()
        available_rooms = []
        
        for room in rooms:
            # Check for conflicting bookings
            conflict_query = self.db.query(MeetingBooking).filter(
                and_(
                    MeetingBooking.room_id == room.id,
                    MeetingBooking.status.in_([0, 1]),  # pending, approved
                    or_(
                        and_(MeetingBooking.start_time <= start_time, MeetingBooking.end_time > start_time),
                        and_(MeetingBooking.start_time < end_time, MeetingBooking.end_time >= end_time),
                        and_(MeetingBooking.start_time >= start_time, MeetingBooking.end_time <= end_time)
                    )
                )
            )
            
            if exclude_booking_id:
                conflict_query = conflict_query.filter(MeetingBooking.id != exclude_booking_id)
            
            has_conflict = conflict_query.first()
            
            if not has_conflict:
                available_rooms.append(self._format_room(room))
        
        return available_rooms
    
    # Booking Management
    async def get_bookings(
        self, 
        room_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[int] = None,
        organizer_id: Optional[int] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get meeting bookings"""
        query = self.db.query(MeetingBooking)
        
        if room_id:
            query = query.filter(MeetingBooking.room_id == room_id)
        if start_date:
            query = query.filter(MeetingBooking.start_time >= start_date)
        if end_date:
            query = query.filter(MeetingBooking.end_time <= end_date)
        if status is not None:
            query = query.filter(MeetingBooking.status == status)
        if organizer_id:
            query = query.filter(MeetingBooking.organizer_emp_id == organizer_id)
        
        bookings = query.order_by(MeetingBooking.start_time.desc()).limit(limit).all()
        return [self._format_booking(booking) for booking in bookings]
    
    async def get_booking_by_id(self, booking_id: int) -> Optional[Dict[str, Any]]:
        """Get booking with full details"""
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        if not booking:
            return None
        
        formatted = self._format_booking(booking)
        formatted['attendees'] = await self.get_booking_attendees(booking_id)
        formatted['room'] = await self.get_room_by_id(booking.room_id)
        
        return formatted
    
    async def create_booking(self, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new meeting booking"""
        # Validate time
        if booking_data['end_time'] <= booking_data['start_time']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End time must be after start time"
            )
        
        # Check duration (max 8 hours unless admin)
        duration = booking_data['end_time'] - booking_data['start_time']
        if duration > timedelta(hours=8):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Meeting duration cannot exceed 8 hours"
            )
        
        # Check room availability
        room = self.db.query(MeetingRoom).filter(MeetingRoom.id == booking_data['room_id']).first()
        if not room:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found"
            )
        
        # Check for conflicts
        conflicts = self.db.query(MeetingBooking).filter(
            and_(
                MeetingBooking.room_id == booking_data['room_id'],
                MeetingBooking.status.in_([0, 1]),  # pending, approved
                or_(
                    and_(MeetingBooking.start_time <= booking_data['start_time'], 
                         MeetingBooking.end_time > booking_data['start_time']),
                    and_(MeetingBooking.start_time < booking_data['end_time'], 
                         MeetingBooking.end_time >= booking_data['end_time']),
                    and_(MeetingBooking.start_time >= booking_data['start_time'], 
                         MeetingBooking.end_time <= booking_data['end_time'])
                )
            )
        ).first()
        
        if conflicts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Room is already booked for this time slot"
            )
        
        # Generate meeting code and QR
        meeting_code = self._generate_meeting_code()
        qr_code = self._generate_qr_code(meeting_code)
        
        # Set initial status
        initial_status = 0 if room.require_approval else 1  # pending if approval required
        
        booking = MeetingBooking(
            meeting_code=meeting_code,
            qr_code=qr_code,
            status=initial_status,
            **booking_data
        )
        
        self.db.add(booking)
        self.db.commit()
        self.db.refresh(booking)
        
        # If no approval required, process attendees
        if initial_status == 1:
            await self._process_attendee_access(booking.id)
        
        return await self.get_booking_by_id(booking.id)
    
    async def update_booking(self, booking_id: int, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update meeting booking"""
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Check if booking can be modified
        if booking.start_time <= datetime.now() + timedelta(minutes=30):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot modify booking less than 30 minutes before start time"
            )
        
        # Validate time changes
        if 'start_time' in booking_data or 'end_time' in booking_data:
            new_start = booking_data.get('start_time', booking.start_time)
            new_end = booking_data.get('end_time', booking.end_time)
            
            if new_end <= new_start:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="End time must be after start time"
                )
            
            # Check for conflicts if time changed
            if new_start != booking.start_time or new_end != booking.end_time:
                conflicts = self.db.query(MeetingBooking).filter(
                    and_(
                        MeetingBooking.room_id == booking.room_id,
                        MeetingBooking.status.in_([0, 1]),
                        MeetingBooking.id != booking_id,
                        or_(
                            and_(MeetingBooking.start_time <= new_start, 
                                 MeetingBooking.end_time > new_start),
                            and_(MeetingBooking.start_time < new_end, 
                                 MeetingBooking.end_time >= new_end),
                            and_(MeetingBooking.start_time >= new_start, 
                                 MeetingBooking.end_time <= new_end)
                        )
                    )
                ).first()
                
                if conflicts:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Room is already booked for this time slot"
                    )
        
        for key, value in booking_data.items():
            if hasattr(booking, key):
                setattr(booking, key, value)
        
        self.db.commit()
        self.db.refresh(booking)
        
        return await self.get_booking_by_id(booking.id)
    
    async def cancel_booking(self, booking_id: int, reason: str, user_id: int) -> Dict[str, Any]:
        """Cancel meeting booking"""
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Check if can cancel
        if booking.start_time <= datetime.now() + timedelta(minutes=30):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel booking less than 30 minutes before start time"
            )
        
        emp_exists = self.db.query(PersonnelEmployee.id).filter(PersonnelEmployee.id == user_id).first()
        booking.status = 4  # cancelled
        booking.approval_note = reason
        booking.approval_by = user_id if emp_exists else None
        booking.approval_time = datetime.now()
        
        self.db.commit()
        
        # Revoke access for attendees
        await self._revoke_attendee_access(booking_id)
        
        return await self.get_booking_by_id(booking.id)
    
    async def approve_booking(self, booking_id: int, approve_status: int, note: str, user_id: int) -> Dict[str, Any]:
        """Approve or reject booking"""
        if approve_status not in [1, 2]:  # approved, rejected
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid approval status"
            )
        
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        if booking.status != 0:  # not pending
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking is not pending approval"
            )
        
        emp_exists = self.db.query(PersonnelEmployee.id).filter(PersonnelEmployee.id == user_id).first()
        booking.status = approve_status
        booking.approval_by = user_id if emp_exists else None
        booking.approval_time = datetime.now()
        booking.approval_note = note
        
        self.db.commit()
        
        # If approved, process attendee access
        if approve_status == 1:
            await self._process_attendee_access(booking_id)
        
        return await self.get_booking_by_id(booking.id)
    
    async def complete_booking(self, booking_id: int) -> Dict[str, Any]:
        """Mark booking as completed"""
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        if booking.status != 1:  # not approved
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking must be approved to complete"
            )
        
        booking.status = 3  # completed
        self.db.commit()
        
        return await self.get_booking_by_id(booking.id)
    
    # Attendee Management
    async def get_booking_attendees(self, booking_id: int) -> List[Dict[str, Any]]:
        """Get booking attendees"""
        attendees = self.db.query(MeetingAttendee).filter(
            MeetingAttendee.booking_id == booking_id
        ).all()
        
        return [self._format_attendee(attendee) for attendee in attendees]
    
    async def add_attendees(self, booking_id: int, attendees_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add attendees to booking"""
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Check capacity
        current_count = self.db.query(MeetingAttendee).filter(
            MeetingAttendee.booking_id == booking_id
        ).count()
        
        new_total = current_count + len(attendees_data)
        room = self.db.query(MeetingRoom).filter(MeetingRoom.id == booking.room_id).first()
        
        if new_total > room.capacity * 1.1:  # 10% buffer
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attendee count exceeds room capacity"
            )
        
        added_attendees = []
        
        for attendee_data in attendees_data:
            # Check for duplicates
            existing = self.db.query(MeetingAttendee).filter(
                and_(
                    MeetingAttendee.booking_id == booking_id,
                    or_(
                        and_(MeetingAttendee.attendee_type == 0, 
                             MeetingAttendee.emp_id == attendee_data.get('emp_id')),
                        and_(MeetingAttendee.attendee_type == 1, 
                             MeetingAttendee.visitor_id == attendee_data.get('visitor_id')),
                        and_(MeetingAttendee.attendee_type == 2, 
                             MeetingAttendee.ext_email == attendee_data.get('ext_email'))
                    )
                )
            ).first()
            
            if existing:
                continue  # Skip duplicate
            
            attendee = MeetingAttendee(
                booking_id=booking_id,
                **attendee_data
            )
            self.db.add(attendee)
            added_attendees.append(attendee)
        
        self.db.commit()
        
        # Update attendee count
        booking.attendee_count = self.db.query(MeetingAttendee).filter(
            MeetingAttendee.booking_id == booking_id
        ).count()
        self.db.commit()
        
        # If booking is approved, process access for new attendees
        if booking.status == 1:
            for attendee in added_attendees:
                await self._process_single_attendee_access(booking.id, attendee.id)
        
        return [self._format_attendee(attendee) for attendee in added_attendees]
    
    async def remove_attendee(self, booking_id: int, attendee_id: int) -> bool:
        """Remove attendee from booking"""
        attendee = self.db.query(MeetingAttendee).filter(
            and_(
                MeetingAttendee.booking_id == booking_id,
                MeetingAttendee.id == attendee_id
            )
        ).first()
        
        if not attendee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendee not found"
            )
        
        # Revoke access
        await self._revoke_single_attendee_access(attendee)
        
        self.db.delete(attendee)
        
        # Update attendee count
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        booking.attendee_count = self.db.query(MeetingAttendee).filter(
            MeetingAttendee.booking_id == booking_id
        ).count()
        
        self.db.commit()
        return True
    
    # Check-in Management
    async def check_in_attendee(
        self, 
        meeting_code: Optional[str] = None,
        qr_code: Optional[str] = None,
        emp_code: Optional[str] = None,
        room_id: Optional[int] = None,
        device_sn: Optional[str] = None,
        verify_type: int = 100  # manual check-in
    ) -> Dict[str, Any]:
        """Check in attendee to meeting"""
        
        # Find booking
        booking = None
        if meeting_code:
            booking = self.db.query(MeetingBooking).filter(
                MeetingBooking.meeting_code == meeting_code
            ).first()
        elif qr_code:
            booking = self.db.query(MeetingBooking).filter(
                MeetingBooking.qr_code == qr_code
            ).first()
        elif emp_code and room_id:
            # Find current meeting in room
            now = datetime.now()
            booking = self.db.query(MeetingBooking).filter(
                and_(
                    MeetingBooking.room_id == room_id,
                    MeetingBooking.start_time <= now,
                    MeetingBooking.end_time >= now,
                    MeetingBooking.status == 1  # approved
                )
            ).first()
        
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found or not active"
            )
        
        # Find attendee
        attendee = None
        if emp_code:
            # Find employee
            employee = self.db.query(PersonnelEmployee).filter(
                PersonnelEmployee.emp_code == emp_code
            ).first()
            if employee:
                attendee = self.db.query(MeetingAttendee).filter(
                    and_(
                        MeetingAttendee.booking_id == booking.id,
                        MeetingAttendee.attendee_type == 0,  # employee
                        MeetingAttendee.emp_id == employee.id
                    )
                ).first()
        
        if not attendee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendee not found for this meeting"
            )
        
        # Check if already checked in
        existing = self.db.query(MeetingAttendance).filter(
            and_(
                MeetingAttendance.booking_id == booking.id,
                MeetingAttendance.attendee_id == attendee.id
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked in"
            )
        
        # Determine status
        now = datetime.now()
        status = 0  # present
        if now > booking.start_time + timedelta(minutes=15):
            status = 1  # late
        
        # Create attendance record
        attendance = MeetingAttendance(
            booking_id=booking.id,
            attendee_id=attendee.id,
            check_in_time=now,
            device_sn=device_sn,
            verify_type=verify_type,
            status=status
        )
        
        self.db.add(attendance)
        self.db.commit()
        
        # Auto-unlock door if first check-in and auto_unlock enabled
        if booking.auto_unlock and not device_sn:
            await self._unlock_room_door(booking.room_id)
        
        return {
            "booking_id": booking.id,
            "meeting_code": booking.meeting_code,
            "attendee_name": self._get_attendee_name(attendee),
            "check_in_time": now.isoformat(),
            "status": "present" if status == 0 else "late"
        }
    
    async def check_out_attendee(self, attendance_id: int) -> Dict[str, Any]:
        """Check out attendee"""
        attendance = self.db.query(MeetingAttendance).filter(
            MeetingAttendance.id == attendance_id
        ).first()
        
        if not attendance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found"
            )
        
        if attendance.check_out_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already checked out"
            )
        
        attendance.check_out_time = datetime.now()
        self.db.commit()
        
        return {"message": "Checked out successfully"}
    
    # Minutes and Action Items
    async def upload_minutes(self, booking_id: int, minutes_path: str, uploaded_by: int) -> Dict[str, Any]:
        """Upload meeting minutes"""
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        emp_exists = self.db.query(PersonnelEmployee.id).filter(PersonnelEmployee.id == uploaded_by).first()
        if not emp_exists:
            emp_fallback = self.db.query(PersonnelEmployee.id).first()
            uploaded_by = emp_fallback.id if emp_fallback else uploaded_by
        minutes = MeetingMinutes(
            booking_id=booking_id,
            minutes_path=minutes_path,
            uploaded_by=uploaded_by,
            file_size=os.path.getsize(minutes_path) if os.path.exists(minutes_path) else 0,
            file_type=os.path.splitext(minutes_path)[1].lower().replace('.', '')
        )
        
        self.db.add(minutes)
        self.db.commit()
        
        return {"message": "Minutes uploaded successfully"}
    
    async def add_action_item(self, booking_id: int, action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Add action item"""
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        created_by = action_data.get('created_by')
        if created_by:
            emp_exists = self.db.query(PersonnelEmployee.id).filter(PersonnelEmployee.id == created_by).first()
            if not emp_exists:
                action_data['created_by'] = None
        action = MeetingActionItem(
            booking_id=booking_id,
            **action_data
        )
        
        self.db.add(action)
        self.db.commit()
        self.db.refresh(action)
        
        return self._format_action_item(action)
    
    async def update_action_item(self, action_id: int, action_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update action item"""
        action = self.db.query(MeetingActionItem).filter(
            MeetingActionItem.id == action_id
        ).first()
        
        if not action:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Action item not found"
            )
        
        for key, value in action_data.items():
            if hasattr(action, key):
                setattr(action, key, value)
        
        # Set completed time if status changed to done
        if action_data.get('status') == 1 and action.status != 1:
            action.completed_time = datetime.now()
        
        self.db.commit()
        self.db.refresh(action)
        
        return self._format_action_item(action)
    
    # Equipment Management
    async def get_equipment(self, room_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get meeting equipment"""
        query = self.db.query(MeetingEquipment)
        if room_id:
            query = query.filter(MeetingEquipment.room_id == room_id)
        
        equipment = query.all()
        return [self._format_equipment(eq) for eq in equipment]
    
    async def create_equipment(self, equipment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create equipment"""
        equipment = MeetingEquipment(**equipment_data)
        self.db.add(equipment)
        self.db.commit()
        self.db.refresh(equipment)
        
        return self._format_equipment(equipment)
    
    # Reports
    async def get_utilization_report(
        self, 
        start_date: date, 
        end_date: date,
        room_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """Get room utilization report"""
        query = self.db.query(MeetingBooking).filter(
            and_(
                MeetingBooking.start_time >= start_date,
                MeetingBooking.end_time <= end_date,
                MeetingBooking.status == 1  # approved
            )
        )
        
        if room_ids:
            query = query.filter(MeetingBooking.room_id.in_(room_ids))
        
        bookings = query.all()
        
        # Calculate utilization by room
        room_utilization = {}
        total_hours = 0
        
        for booking in bookings:
            room_id = booking.room_id
            duration = (booking.end_time - booking.start_time).total_seconds() / 3600
            
            if room_id not in room_utilization:
                room_utilization[room_id] = {
                    'room_name': booking.room.room_name if booking.room else 'Unknown',
                    'total_hours': 0,
                    'booking_count': 0
                }
            
            room_utilization[room_id]['total_hours'] += duration
            room_utilization[room_id]['booking_count'] += 1
            total_hours += duration
        
        # Calculate working hours in period
        working_days = (end_date - start_date).days + 1
        working_hours = working_days * 8  # 8 hours per day
        
        return {
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'working_hours': working_hours,
                'working_days': working_days
            },
            'total_meeting_hours': total_hours,
            'overall_utilization': (total_hours / (working_hours * len(room_utilization))) * 100 if room_utilization else 0,
            'room_utilization': room_utilization
        }
    
    async def get_attendance_report(self, booking_id: int) -> Dict[str, Any]:
        """Get meeting attendance report"""
        booking = self.db.query(MeetingBooking).filter(MeetingBooking.id == booking_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        attendees = self.db.query(MeetingAttendee).filter(
            MeetingAttendee.booking_id == booking_id
        ).all()
        
        attendance_records = {}
        for attendee in attendees:
            attendance = self.db.query(MeetingAttendance).filter(
                and_(
                    MeetingAttendance.booking_id == booking_id,
                    MeetingAttendance.attendee_id == attendee.id
                )
            ).first()
            
            attendance_records[attendee.id] = {
                'attendee': self._format_attendee(attendee),
                'attendance': self._format_attendance(attendance) if attendance else None
            }
        
        return {
            'booking': self._format_booking(booking),
            'attendance_records': attendance_records,
            'summary': {
                'total_attendees': len(attendees),
                'checked_in': len([r for r in attendance_records.values() if r['attendance']]),
                'no_show': len([r for r in attendance_records.values() if not r['attendance']])
            }
        }
    
    # Helper methods
    def _safe_json_list(self, val) -> list:
        if not val:
            return []
        try:
            return json.loads(val)
        except (json.JSONDecodeError, ValueError):
            import ast
            try:
                return ast.literal_eval(val)
            except (ValueError, SyntaxError):
                return []

    def _format_room(self, room) -> Dict[str, Any]:
        """Format room data"""
        return {
            'id': room.id,
            'room_name': room.room_name,
            'capacity': room.capacity,
            'location': room.location,
            'area_id': room.area_id,
            'door_id': room.door_id,
            'equipment': self._safe_json_list(room.equipment),
            'status': room.status,
            'require_approval': room.require_approval,
            'mustering_zone_id': room.mustering_zone_id,
            'is_emergency_assembly': room.is_emergency_assembly,
            'created_at': room.created_at.isoformat() if room.created_at else None,
            'updated_at': room.updated_at.isoformat() if room.updated_at else None
        }
    
    def _format_booking(self, booking) -> Dict[str, Any]:
        """Format booking data"""
        try:
            room = booking.room
            room_data = {'id': room.id, 'room_name': room.room_name} if room else None
        except Exception:
            room_data = None
        try:
            org = booking.organizer
            full_name = f"{org.first_name or ''} {org.last_name}".strip() if org else None
            org_data = {'id': org.id, 'full_name': full_name} if org else None
        except Exception:
            org_data = None
        return {
            'id': booking.id,
            'room_id': booking.room_id,
            'room': room_data,
            'title': booking.title,
            'start_time': booking.start_time.isoformat(),
            'end_time': booking.end_time.isoformat(),
            'organizer_emp_id': booking.organizer_emp_id,
            'organizer': org_data,
            'attendee_count': booking.attendee_count,
            'agenda': booking.agenda,
            'attachments': self._safe_json_list(booking.attachments),
            'repeat_type': booking.repeat_type,
            'repeat_until': booking.repeat_until.isoformat() if booking.repeat_until else None,
            'status': booking.status,
            'approval_by': booking.approval_by,
            'approval_time': booking.approval_time.isoformat() if booking.approval_time else None,
            'approval_note': booking.approval_note,
            'meeting_code': booking.meeting_code,
            'qr_code': booking.qr_code,
            'auto_unlock': booking.auto_unlock,
            'created_time': booking.created_time.isoformat() if booking.created_time else None,
            'updated_time': booking.updated_time.isoformat() if booking.updated_time else None
        }
    
    def _format_booking_calendar(self, booking) -> Dict[str, Any]:
        """Format booking for calendar view"""
        return {
            'id': booking.id,
            'title': booking.title,
            'start': booking.start_time.isoformat(),
            'end': booking.end_time.isoformat(),
            'status': booking.status,
            'meeting_code': booking.meeting_code
        }
    
    def _format_attendee(self, attendee) -> Dict[str, Any]:
        """Format attendee data"""
        data = {
            'id': attendee.id,
            'booking_id': attendee.booking_id,
            'attendee_type': attendee.attendee_type,
            'is_required': attendee.is_required,
            'pre_reg_id': attendee.pre_reg_id,
            'invitation_sent': attendee.invitation_sent,
            'invitation_sent_time': attendee.invitation_sent_time.isoformat() if attendee.invitation_sent_time else None
        }
        
        if attendee.attendee_type == 0 and attendee.emp_id:
            employee = self.db.query(PersonnelEmployee).filter(
                PersonnelEmployee.id == attendee.emp_id
            ).first()
            if employee:
                data['employee'] = {
                    'id': employee.id,
                    'emp_code': employee.emp_code,
                    'full_name': f"{employee.first_name or ''} {employee.last_name}".strip(),
                    'email': getattr(employee, 'email', None)
                }
        
        elif attendee.attendee_type == 1 and attendee.visitor_id:
            visitor = self.db.query(Visitor).filter(Visitor.id == attendee.visitor_id).first()
            if visitor:
                data['visitor'] = {
                    'id': visitor.id,
                    'full_name': visitor.full_name,
                    'email': visitor.email,
                    'phone': visitor.phone
                }
        
        elif attendee.attendee_type == 2:
            data['external'] = {
                'name': attendee.ext_name,
                'email': attendee.ext_email,
                'phone': attendee.ext_phone
            }
        
        return data
    
    def _format_attendance(self, attendance) -> Dict[str, Any]:
        """Format attendance data"""
        if not attendance:
            return None
        
        return {
            'id': attendance.id,
            'booking_id': attendance.booking_id,
            'attendee_id': attendance.attendee_id,
            'check_in_time': attendance.check_in_time.isoformat() if attendance.check_in_time else None,
            'check_out_time': attendance.check_out_time.isoformat() if attendance.check_out_time else None,
            'device_sn': attendance.device_sn,
            'verify_type': attendance.verify_type,
            'status': attendance.status,
            'notes': attendance.notes
        }
    
    def _format_action_item(self, action) -> Dict[str, Any]:
        """Format action item data"""
        return {
            'id': action.id,
            'booking_id': action.booking_id,
            'action_desc': action.action_desc,
            'assignee_emp_id': action.assignee_emp_id,
            'due_date': action.due_date.isoformat() if action.due_date else None,
            'status': action.status,
            'completed_time': action.completed_time.isoformat() if action.completed_time else None,
            'created_time': action.created_time.isoformat() if action.created_time else None,
            'created_by': action.created_by
        }
    
    def _format_equipment(self, equipment) -> Dict[str, Any]:
        """Format equipment data"""
        return {
            'id': equipment.id,
            'equip_name': equipment.equip_name,
            'equip_type': equipment.equip_type,
            'room_id': equipment.room_id,
            'status': equipment.status,
            'serial_no': equipment.serial_no,
            'purchase_date': equipment.purchase_date.isoformat() if equipment.purchase_date else None,
            'warranty_expiry': equipment.warranty_expiry.isoformat() if equipment.warranty_expiry else None,
            'last_maintenance': equipment.last_maintenance.isoformat() if equipment.last_maintenance else None,
            'notes': equipment.notes
        }
    
    def _generate_meeting_code(self) -> str:
        """Generate unique meeting code"""
        date_str = datetime.now().strftime("%Y%m%d")
        
        # Get count for today
        count = self.db.query(MeetingBooking).filter(
            MeetingBooking.meeting_code.like(f"MTG{date_str}%")
        ).count()
        
        return f"MTG{date_str}{count + 1:03d}"
    
    def _generate_qr_code(self, meeting_code: str) -> str:
        """Generate QR code for meeting"""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(meeting_code)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Save to uploads directory
        qr_path = f"uploads/meeting_qr/{meeting_code}.png"
        os.makedirs(os.path.dirname(qr_path), exist_ok=True)
        img.save(qr_path)
        
        return qr_path
    
    def _get_attendee_name(self, attendee) -> str:
        """Get attendee display name"""
        if attendee.attendee_type == 0 and attendee.emp_id:
            employee = self.db.query(PersonnelEmployee).filter(
                PersonnelEmployee.id == attendee.emp_id
            ).first()
            return f"{employee.first_name or ''} {employee.last_name}".strip() if employee else "Unknown Employee"
        elif attendee.attendee_type == 1 and attendee.visitor_id:
            visitor = self.db.query(Visitor).filter(Visitor.id == attendee.visitor_id).first()
            return visitor.full_name if visitor else "Unknown Visitor"
        elif attendee.attendee_type == 2:
            return attendee.ext_name or "External"
        return "Unknown"
    
    async def _process_attendee_access(self, booking_id: int):
        """Process access for all attendees"""
        attendees = self.db.query(MeetingAttendee).filter(
            MeetingAttendee.booking_id == booking_id
        ).all()
        
        for attendee in attendees:
            await self._process_single_attendee_access(booking_id, attendee.id)
    
    async def _process_single_attendee_access(self, booking_id: int, attendee_id: int):
        """Process access for single attendee"""
        attendee = self.db.query(MeetingAttendee).filter(
            MeetingAttendee.id == attendee_id
        ).first()
        
        booking = self.db.query(MeetingBooking).filter(
            MeetingBooking.id == booking_id
        ).first()
        
        if not attendee or not booking:
            return
        
        # Create temporary access for employees
        if attendee.attendee_type == 0 and attendee.emp_id:
            # This would integrate with access control system
            # For now, just log the action
            pass
        
        # Visitor attendees: pre-registration is managed separately by the visitor module
        elif attendee.attendee_type == 1 and attendee.visitor_id:
            pass
    
    async def _revoke_attendee_access(self, booking_id: int):
        """Revoke access for all attendees"""
        attendees = self.db.query(MeetingAttendee).filter(
            MeetingAttendee.booking_id == booking_id
        ).all()
        
        for attendee in attendees:
            await self._revoke_single_attendee_access(attendee)
    
    async def _revoke_single_attendee_access(self, attendee):
        """Revoke access for single attendee"""
        # This would integrate with access control system
        # For now, just log the action
        pass
    
    async def _unlock_room_door(self, room_id: int):
        """Unlock room door"""
        room = self.db.query(MeetingRoom).filter(MeetingRoom.id == room_id).first()
        if room and room.door_id:
            # This would send RELAY_ON command to door
            # For now, just log the action
            pass

    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get meeting dashboard statistics"""
        now = datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end   = now.replace(hour=23, minute=59, second=59, microsecond=999999)

        total_rooms     = self.db.query(MeetingRoom).count()
        available_rooms = self.db.query(MeetingRoom).filter(MeetingRoom.status == 0).count()
        today_bookings  = self.db.query(MeetingBooking).filter(
            MeetingBooking.start_time >= today_start,
            MeetingBooking.start_time <= today_end,
        ).count()
        pending_approvals = self.db.query(MeetingBooking).filter(MeetingBooking.status == 0).count()
        active_meetings   = self.db.query(MeetingBooking).filter(
            MeetingBooking.status == 1,
            MeetingBooking.start_time <= now,
            MeetingBooking.end_time   >= now,
        ).count()

        return {
            "total_rooms":      total_rooms,
            "available_rooms":  available_rooms,
            "today_bookings":   today_bookings,
            "pending_approvals": pending_approvals,
            "active_meetings":  active_meetings,
        }

    async def get_booking_minutes(self, booking_id: int) -> List[Dict[str, Any]]:
        """Get meeting minutes for a booking"""
        records = self.db.query(MeetingMinutes).filter(
            MeetingMinutes.booking_id == booking_id
        ).order_by(MeetingMinutes.uploaded_time.desc()).all()
        return [
            {
                "id":            r.id,
                "booking_id":    r.booking_id,
                "minutes_path":  r.minutes_path,
                "uploaded_by":   r.uploaded_by,
                "uploaded_time": r.uploaded_time.isoformat() if r.uploaded_time else None,
                "file_size":     r.file_size,
                "file_type":     r.file_type,
            }
            for r in records
        ]

    async def get_booking_actions(self, booking_id: int) -> List[Dict[str, Any]]:
        """Get action items for a booking"""
        actions = self.db.query(MeetingActionItem).filter(
            MeetingActionItem.booking_id == booking_id
        ).order_by(MeetingActionItem.created_time.desc()).all()
        result = []
        for a in actions:
            item = self._format_action_item(a)
            # Add assignee name
            if a.assignee_emp_id:
                emp = self.db.query(PersonnelEmployee).filter(
                    PersonnelEmployee.id == a.assignee_emp_id
                ).first()
                item['assignee'] = {
                    'full_name': f"{emp.first_name or ''} {emp.last_name}".strip() if emp else '—',
                    'id': a.assignee_emp_id
                }
            result.append(item)
        return result

    async def update_equipment(self, equipment_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update meeting equipment"""
        eq = self.db.query(MeetingEquipment).filter(MeetingEquipment.id == equipment_id).first()
        if not eq:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
        for k, v in data.items():
            if hasattr(eq, k):
                setattr(eq, k, v)
        self.db.commit()
        self.db.refresh(eq)
        return self._format_equipment(eq)

    async def delete_equipment(self, equipment_id: int) -> bool:
        """Delete meeting equipment"""
        eq = self.db.query(MeetingEquipment).filter(MeetingEquipment.id == equipment_id).first()
        if not eq:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
        self.db.delete(eq)
        self.db.commit()
        return True
