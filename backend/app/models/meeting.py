"""
Meeting Management Models
BioTime 9.5 Meeting Room Booking + POB Extensions
"""

from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Text, Boolean, SmallInteger, DateTime, Date, BigInteger, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSON
from app.core.database import Base

class MeetingRoom(Base):
    """Meeting rooms table"""
    __tablename__ = "mtg_room"
    
    id = Column(Integer, primary_key=True, index=True)
    room_name = Column(String(100), nullable=False, unique=True, index=True)
    capacity = Column(Integer, nullable=False)
    location = Column(String(100))
    area_id = Column(Integer, ForeignKey("personnel_area.id"))
    door_id = Column(Integer, ForeignKey("acc_door.id"))
    equipment = Column(Text)  # JSON array of equipment
    status = Column(SmallInteger, default=0)  # 0=available,1=maintenance
    require_approval = Column(Boolean, default=False)
    mustering_zone_id = Column(Integer, ForeignKey("zones.id"))
    is_emergency_assembly = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    area = relationship("PersonnelArea", back_populates="meeting_rooms")
    door = relationship("AccDoor", back_populates="meeting_room")
    mustering_zone = relationship("Zone", foreign_keys=[mustering_zone_id])
    bookings = relationship("MeetingBooking", back_populates="room", cascade="all, delete-orphan")
    equipment_items = relationship("MeetingEquipment", back_populates="room", cascade="all, delete-orphan")

class MeetingBooking(Base):
    """Meeting bookings table"""
    __tablename__ = "mtg_booking"
    
    id = Column(BigInteger, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("mtg_room.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False, index=True)
    organizer_emp_id = Column(Integer, ForeignKey("personnel_employee.id"), nullable=False, index=True)
    attendee_count = Column(Integer, default=0)
    agenda = Column(Text)
    attachments = Column(Text)  # JSON array of file paths
    repeat_type = Column(SmallInteger, default=0)  # 0=none,1=daily,2=weekly,3=monthly
    repeat_until = Column(Date)
    status = Column(SmallInteger, default=0, index=True)  # 0=pending,1=approved,2=rejected,3=completed,4=cancelled
    approval_by = Column(Integer, ForeignKey("personnel_employee.id"))
    approval_time = Column(DateTime(timezone=True))
    approval_note = Column(String(255))
    meeting_code = Column(String(20), nullable=False, index=True)
    qr_code = Column(String(100))
    __table_args__ = (
        UniqueConstraint('qr_code', name='_meeting_booking_qr_code_uc'),
        {'comment': 'Unique constraint on meeting QR code'}
    )
    auto_unlock = Column(Boolean, default=True)
    created_time = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    updated_time = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    room = relationship("MeetingRoom", back_populates="bookings")
    organizer = relationship("PersonnelEmployee", foreign_keys=[organizer_emp_id], back_populates="organized_meetings")
    approver = relationship("PersonnelEmployee", foreign_keys=[approval_by], back_populates="approved_meetings")
    attendees = relationship("MeetingAttendee", back_populates="booking", cascade="all, delete-orphan")
    attendance_records = relationship("MeetingAttendance", back_populates="booking", cascade="all, delete-orphan")
    minutes = relationship("MeetingMinutes", back_populates="booking", cascade="all, delete-orphan")
    action_items = relationship("MeetingActionItem", back_populates="booking", cascade="all, delete-orphan")

class MeetingAttendee(Base):
    """Meeting attendees table"""
    __tablename__ = "mtg_attendee"
    
    id = Column(BigInteger, primary_key=True, index=True)
    booking_id = Column(BigInteger, ForeignKey("mtg_booking.id"), nullable=False, index=True)
    attendee_type = Column(SmallInteger, nullable=False)  # 0=employee,1=visitor,2=external
    emp_id = Column(Integer, ForeignKey("personnel_employee.id"))
    visitor_id = Column(BigInteger, ForeignKey("vis_visitor.id"))
    ext_name = Column(String(100))
    ext_email = Column(String(100))
    ext_phone = Column(String(20))
    is_required = Column(Boolean, default=True)
    pre_reg_id = Column(BigInteger, ForeignKey("vis_pre_registration.id"))
    invitation_sent = Column(Boolean, default=False)
    invitation_sent_time = Column(DateTime(timezone=True))
    
    # Relationships
    booking = relationship("MeetingBooking", back_populates="attendees")
    employee = relationship("PersonnelEmployee", back_populates="meeting_attendances")
    visitor = relationship("Visitor", back_populates="meeting_attendances")
    pre_registration = relationship("VisitorPreRegistration", back_populates="meeting_attendee")
    attendance_records = relationship("MeetingAttendance", back_populates="attendee", cascade="all, delete-orphan")

class MeetingAttendance(Base):
    """Meeting attendance table"""
    __tablename__ = "mtg_attendance"
    
    id = Column(BigInteger, primary_key=True, index=True)
    booking_id = Column(BigInteger, ForeignKey("mtg_booking.id"), nullable=False, index=True)
    attendee_id = Column(BigInteger, ForeignKey("mtg_attendee.id"), nullable=False, index=True)
    check_in_time = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    check_out_time = Column(DateTime(timezone=True))
    device_sn = Column(String(20), ForeignKey("iclock_terminal.sn"))
    verify_type = Column(SmallInteger)  # 1=card,15=face,25=palm,100=manual
    status = Column(SmallInteger, default=0)  # 0=present,1=late,2=absent
    notes = Column(Text)
    
    # Relationships
    booking = relationship("MeetingBooking", back_populates="attendance_records")
    attendee = relationship("MeetingAttendee", back_populates="attendance_records")
    device = relationship("IClockTerminal", back_populates="meeting_attendances")

class MeetingMinutes(Base):
    """Meeting minutes table"""
    __tablename__ = "mtg_minutes"
    
    id = Column(BigInteger, primary_key=True, index=True)
    booking_id = Column(BigInteger, ForeignKey("mtg_booking.id"), nullable=False, index=True)
    minutes_path = Column(String(255))
    uploaded_by = Column(Integer, ForeignKey("personnel_employee.id"), nullable=False)
    uploaded_time = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    file_size = Column(BigInteger)
    file_type = Column(String(10))
    
    # Relationships
    booking = relationship("MeetingBooking", back_populates="minutes")
    uploader = relationship("PersonnelEmployee", back_populates="uploaded_meeting_minutes")

class MeetingActionItem(Base):
    """Meeting action items table"""
    __tablename__ = "mtg_action_item"
    
    id = Column(BigInteger, primary_key=True, index=True)
    booking_id = Column(BigInteger, ForeignKey("mtg_booking.id"), nullable=False, index=True)
    action_desc = Column(String(500), nullable=False)
    assignee_emp_id = Column(Integer, ForeignKey("personnel_employee.id"), nullable=False, index=True)
    due_date = Column(Date)
    status = Column(SmallInteger, default=0, index=True)  # 0=open,1=done,2=overdue
    completed_time = Column(DateTime(timezone=True))
    created_time = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    created_by = Column(Integer, ForeignKey("personnel_employee.id"))
    
    # Relationships
    booking = relationship("MeetingBooking", back_populates="action_items")
    assignee = relationship("PersonnelEmployee", foreign_keys=[assignee_emp_id], back_populates="assigned_meeting_actions")
    creator = relationship("PersonnelEmployee", foreign_keys=[created_by], back_populates="created_meeting_actions")

class MeetingEquipment(Base):
    """Meeting equipment table"""
    __tablename__ = "mtg_equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    equip_name = Column(String(100), nullable=False, index=True)
    equip_type = Column(String(50))
    room_id = Column(Integer, ForeignKey("mtg_room.id"), index=True)
    status = Column(SmallInteger, default=0)  # 0=available,1=maintenance
    serial_no = Column(String(50))
    purchase_date = Column(Date)
    warranty_expiry = Column(Date)
    last_maintenance = Column(Date)
    notes = Column(Text)
    
    # Relationships
    room = relationship("MeetingRoom", back_populates="equipment_items")
