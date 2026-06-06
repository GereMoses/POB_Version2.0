"""
Visitor Management Models - BioTime 9.5 Compatible + POB Extensions
Implements complete visitor management with pre-registration, check-in/out, 
blacklist, host approval, and mustering integration.
"""

from datetime import date, datetime, time
from typing import Optional
from sqlalchemy import (
    Column, Integer, BigInteger, String, Boolean, Text, Date, Time, 
    DateTime, SmallInteger, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class VisitorType(Base):
    """Visitor type configuration - BioTime compatible with POB extensions"""
    __tablename__ = "vis_type"
    
    id = Column(Integer, primary_key=True, index=True)
    type_name = Column(String(50), nullable=False, index=True)  # Contractor, VIP, Interview
    access_level_id = Column(Integer, ForeignKey("acc_level.id"), nullable=True)
    badge_template = Column(String(100), nullable=True)
    induction_required = Column(Boolean, default=False)
    default_visit_hours = Column(Integer, default=8)
    auto_checkout = Column(Boolean, default=True)
    mustering_zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    contractor_visitor = Column(Boolean, default=False)  # POB extension
    safety_induction_required = Column(Boolean, default=False)  # POB extension
    created_time = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    # Relationships
    mustering_zone = relationship("Zone", foreign_keys=[mustering_zone_id])
    visitors = relationship("Visitor", back_populates="visitor_type")


class Visitor(Base):
    """Visitor master data - BioTime compatible"""
    __tablename__ = "vis_visitor"
    
    id = Column(BigInteger, primary_key=True, index=True)
    visitor_code = Column(String(20), nullable=False, index=True)  # VIS20260506001
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True, index=True)
    email = Column(String(100), nullable=True, index=True)
    company = Column(String(100), nullable=True)
    id_type = Column(SmallInteger, nullable=True)  # 0=NIC,1=Passport,2=License
    id_no = Column(String(50), nullable=True, index=True)
    photo = Column(String(255), nullable=True)
    signature = Column(String(255), nullable=True)
    visitor_type_id = Column(Integer, ForeignKey("vis_type.id"), nullable=True)
    is_blacklist = Column(Boolean, default=False, index=True)
    blacklist_reason = Column(String(255), nullable=True)
    vendor_id = Column(Integer, nullable=True)  # POB extension — vendor FK disabled (table mismatch)
    safety_induction_done = Column(Boolean, default=False)  # POB
    induction_doc = Column(String(255), nullable=True)  # POB
    created_time = Column(DateTime(timezone=True), server_default=func.now())
    updated_time = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    visitor_type = relationship("VisitorType", back_populates="visitors")
    # vendor relationship disabled — vendor_id FK references deprecated table
    pre_registrations = relationship("VisitorPreRegistration", back_populates="visitor")
    visit_logs = relationship("VisitorVisitLog", back_populates="visitor")
    meeting_attendances = relationship("MeetingAttendee", back_populates="visitor")


class VisitorPreRegistration(Base):
    """Visitor pre-registration - BioTime compatible with POB extensions"""
    __tablename__ = "vis_pre_registration"
    
    id = Column(BigInteger, primary_key=True, index=True)
    visitor_id = Column(BigInteger, ForeignKey("vis_visitor.id"), nullable=True)
    host_emp_id = Column(Integer, ForeignKey("personnel_employee.id"), nullable=False, index=True)
    visit_date = Column(Date, nullable=False, index=True)
    visit_time_start = Column(Time, nullable=True)
    visit_time_end = Column(Time, nullable=True)
    purpose = Column(String(255), nullable=True)
    area_id = Column(Integer, ForeignKey("personnel_area.id"), nullable=True)
    vehicle_no = Column(String(20), nullable=True)
    qr_code = Column(String(100), nullable=False, index=True)  # UUID
    status = Column(SmallInteger, default=0, index=True)  # 0=pending,1=approved,2=rejected,3=checked_in,4=checked_out,5=expired
    approval_time = Column(DateTime(timezone=True), nullable=True)
    approval_by = Column(Integer, ForeignKey("personnel_employee.id"), nullable=True)
    approval_note = Column(String(255), nullable=True)
    safety_induction_done = Column(Boolean, default=False)  # POB
    induction_doc = Column(String(255), nullable=True)  # POB
    contractor_visitor = Column(Boolean, default=False)  # POB
    created_by = Column(Integer, ForeignKey("auth_user.id"), nullable=True)
    created_time = Column(DateTime(timezone=True), server_default=func.now())
    updated_time = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    visitor = relationship("Visitor", back_populates="pre_registrations")
    host_employee = relationship("PersonnelEmployee", foreign_keys=[host_emp_id])
    meeting_attendee = relationship("MeetingAttendee", back_populates="pre_registration", uselist=False)
    approver = relationship("PersonnelEmployee", foreign_keys=[approval_by])
    area = relationship("PersonnelArea")
    creator = relationship("AuthUser", foreign_keys=[created_by])
    visit_logs = relationship("VisitorVisitLog", back_populates="pre_registration")


class VisitorVisitLog(Base):
    """Visitor check-in/out log - BioTime compatible with POB extensions"""
    __tablename__ = "vis_visit_log"
    
    id = Column(BigInteger, primary_key=True, index=True)
    visitor_id = Column(BigInteger, ForeignKey("vis_visitor.id"), nullable=False, index=True)
    pre_reg_id = Column(BigInteger, ForeignKey("vis_pre_registration.id"), nullable=True, index=True)
    host_emp_id = Column(Integer, ForeignKey("personnel_employee.id"), nullable=True, index=True)
    check_in_time = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    check_out_time = Column(DateTime(timezone=True), nullable=True, index=True)
    card_no = Column(String(20), nullable=True, index=True)  # temp card issued
    device_sn = Column(String(20), ForeignKey("iclock_terminal.sn"), nullable=True)  # check-in kiosk
    badge_printed = Column(Boolean, default=False)
    status = Column(SmallInteger, default=0, index=True)  # 0=in,1=out,2=overstay
    area_id = Column(Integer, ForeignKey("personnel_area.id"), nullable=True)
    mustering_zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)  # POB
    mustering_status = Column(SmallInteger, nullable=True)  # POB: null,0=missing,1=safe during event
    overstay_alert_sent = Column(Boolean, default=False)  # POB
    created_by = Column(Integer, ForeignKey("auth_user.id"), nullable=True)
    created_time = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    visitor = relationship("Visitor", back_populates="visit_logs")
    pre_registration = relationship("VisitorPreRegistration", back_populates="visit_logs")
    host_employee = relationship("PersonnelEmployee")
    device = relationship("IClockTerminal", foreign_keys=[device_sn], primaryjoin="VisitorVisitLog.device_sn == IClockTerminal.sn")
    area = relationship("PersonnelArea")
    mustering_zone = relationship("Zone", foreign_keys=[mustering_zone_id])
    creator = relationship("AuthUser", foreign_keys=[created_by])


class VisitorBlacklist(Base):
    """Visitor blacklist - BioTime compatible"""
    __tablename__ = "vis_blacklist"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=True)
    id_no = Column(String(50), nullable=False, index=True)
    phone = Column(String(20), nullable=True, index=True)
    email = Column(String(100), nullable=True, index=True)
    reason = Column(String(255), nullable=False)
    added_by = Column(Integer, ForeignKey("auth_user.id"), nullable=True)
    added_time = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    added_by_user = relationship("AuthUser", foreign_keys=[added_by])


# Indexes for performance
Index('idx_vis_visitor_code', 'visitor_code')
Index('idx_vis_visitor_phone', 'phone')
Index('idx_vis_visitor_id_no', 'id_no')
Index('idx_vis_visitor_blacklist', 'is_blacklist')
Index('idx_vis_pre_reg_qr', 'qr_code')
Index('idx_vis_pre_reg_status_date', 'status', 'visit_date')
Index('idx_vis_visit_log_checkin', 'check_in_time')
Index('idx_vis_visit_log_status', 'status')
Index('idx_vis_visit_log_card_no', 'card_no')
Index('idx_vis_blacklist_id_no', 'id_no')
Index('idx_vis_blacklist_phone', 'phone')
