from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum, Time, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum


class ShiftType(str, enum.Enum):
    MORNING = "MORNING"
    EVENING = "EVENING"
    NIGHT = "NIGHT"
    CUSTOM = "CUSTOM"
    ROTATING = "ROTATING"


class ShiftManagement(Base):
    """Shift Management - ZKTeco BioTime compatible shift table"""
    __tablename__ = "shift_management"

    id = Column(Integer, primary_key=True, index=True)
    shift_code = Column(String(20), unique=True, nullable=False, index=True)
    shift_name = Column(String(100), nullable=False)
    
    # Shift Timing
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    break_duration = Column(Integer, default=0)  # Break duration in minutes
    
    # Shift Properties
    shift_type = Column(Enum(ShiftType), default=ShiftType.CUSTOM)
    is_night_shift = Column(Boolean, default=False, server_default='false')
    is_weekend_shift = Column(Boolean, default=False, server_default='false')
    is_flexible = Column(Boolean, default=False, server_default='false')
    
    # Shift Duration
    working_hours = Column(Integer, default=8)  # Standard working hours
    
    # Rotation Pattern (for rotating shifts)
    rotation_pattern = Column(JSON, nullable=True)  # e.g., ["day", "night", "off"]
    rotation_cycle_days = Column(Integer, nullable=True)  # Days in rotation cycle
    
    # Late Arrival and Early Departure Rules
    grace_period_minutes = Column(Integer, default=15)  # Grace period for late arrival
    max_late_minutes = Column(Integer, default=60)  # Maximum allowed late minutes
    max_early_departure_minutes = Column(Integer, default=30)  # Maximum allowed early departure
    
    # Overtime Rules
    overtime_threshold_minutes = Column(Integer, default=30)

    # Description and Notes
    description = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True, server_default='true')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    schedules = relationship("ScheduleManagement", back_populates="shift", cascade="all, delete-orphan")


class ScheduleManagement(Base):
    """Schedule/Roster Management"""
    __tablename__ = "schedule_management"

    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=True)
    shift_id = Column(Integer, ForeignKey("shift_management.id"), nullable=True)
    schedule_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="scheduled")
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel = relationship("Personnel", foreign_keys=[personnel_id])
    shift = relationship("ShiftManagement", back_populates="schedules")
    assigner = relationship("User", foreign_keys=[assigned_by])
