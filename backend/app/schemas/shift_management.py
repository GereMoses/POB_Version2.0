from pydantic import BaseModel, Field, validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import time, datetime
from enum import Enum


class ShiftType(str, Enum):
    MORNING = "MORNING"
    EVENING = "EVENING"
    NIGHT = "NIGHT"
    CUSTOM = "CUSTOM"
    ROTATING = "ROTATING"


class ShiftManagementBase(BaseModel):
    shift_code: str = Field(..., min_length=2, max_length=20, description="Unique shift code")
    shift_name: str = Field(..., min_length=2, max_length=100, description="Shift name")
    start_time: time = Field(..., description="Shift start time")
    end_time: time = Field(..., description="Shift end time")
    break_duration: int = Field(default=0, ge=0, le=120, description="Break duration in minutes")
    shift_type: ShiftType = Field(default=ShiftType.CUSTOM, description="Type of shift")
    is_night_shift: bool = Field(default=False, description="Is this a night shift")
    is_weekend_shift: bool = Field(default=False, description="Is this a weekend shift")
    is_flexible: bool = Field(default=False, description="Is this a flexible shift")
    working_hours: int = Field(default=8, ge=1, le=24, description="Standard working hours")
    rotation_pattern: Optional[List[str]] = Field(None, description="Rotation pattern for rotating shifts")
    rotation_cycle_days: Optional[int] = Field(None, ge=1, description="Days in rotation cycle")
    grace_period_minutes: int = Field(default=15, ge=0, le=60, description="Grace period for late arrival")
    max_late_minutes: int = Field(default=60, ge=0, le=180, description="Maximum allowed late minutes")
    max_early_departure_minutes: int = Field(default=30, ge=0, le=120, description="Maximum allowed early departure")
    overtime_threshold_minutes: int = Field(default=30, ge=0, le=120, description="Minutes before overtime kicks in")
    description: Optional[str] = Field(None, max_length=500, description="Shift description")
    is_active: bool = Field(default=True, description="Is shift active")

    @validator('rotation_pattern')
    def validate_rotation_pattern(cls, v, values):
        if v and values.get('shift_type') != ShiftType.ROTATING:
            raise ValueError('Rotation pattern only applicable for rotating shifts')
        return v


class ShiftManagementCreate(ShiftManagementBase):
    @model_validator(mode='after')
    def validate_times(self):
        if not self.is_night_shift and self.start_time and self.end_time:
            if self.end_time <= self.start_time:
                raise ValueError('End time must be after start time (use is_night_shift=true for overnight shifts)')
        return self


class ShiftManagementUpdate(BaseModel):
    shift_name: Optional[str] = Field(None, min_length=2, max_length=100)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_duration: Optional[int] = Field(None, ge=0, le=120)
    shift_type: Optional[ShiftType] = None
    is_night_shift: Optional[bool] = None
    is_weekend_shift: Optional[bool] = None
    is_flexible: Optional[bool] = None
    working_hours: Optional[int] = Field(None, ge=1, le=24)
    rotation_pattern: Optional[List[str]] = None
    rotation_cycle_days: Optional[int] = Field(None, ge=1)
    grace_period_minutes: Optional[int] = Field(None, ge=0, le=60)
    max_late_minutes: Optional[int] = Field(None, ge=0, le=180)
    max_early_departure_minutes: Optional[int] = Field(None, ge=0, le=120)
    overtime_threshold_minutes: Optional[int] = Field(None, ge=0, le=120)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class ShiftManagementResponse(ShiftManagementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScheduleManagementBase(BaseModel):
    personnel_id: int = Field(..., description="Personnel ID")
    shift_id: int = Field(..., description="Shift ID")
    schedule_date: datetime = Field(..., description="Schedule date and time")
    status: str = Field(default="scheduled", description="Schedule status")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")


class ScheduleManagementCreate(ScheduleManagementBase):
    pass


class ScheduleManagementUpdate(BaseModel):
    shift_id: Optional[int] = None
    schedule_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=1000)


class ScheduleSwapRequest(BaseModel):
    original_personnel_id: int = Field(..., description="Original personnel ID")
    swapped_with_personnel_id: int = Field(..., description="Personnel to swap with")
    swap_reason: Optional[str] = Field(None, max_length=500, description="Reason for swap")


class ScheduleManagementResponse(ScheduleManagementBase):
    id: int
    assigned_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShiftAssignment(BaseModel):
    personnel_id: int = Field(..., description="Personnel ID")
    shift_id: int = Field(..., description="Shift ID")
    start_date: datetime = Field(..., description="Assignment start date")
    end_date: Optional[datetime] = Field(None, description="Assignment end date")
    notes: Optional[str] = Field(None, max_length=500, description="Assignment notes")


class ShiftAssignmentResponse(BaseModel):
    id: int
    personnel_id: int
    shift_id: int
    start_date: datetime
    end_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
