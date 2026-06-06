"""
Access Control Schemas - BioTime 9.5 Compatible + POB Extensions
Pydantic schemas for Access Control API validation and serialization
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, time

# ================================
# TIME ZONE SCHEMAS
# ================================

class TimeZoneBase(BaseModel):
    timezone_name: str = Field(..., min_length=1, max_length=50)
    sun_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    sun_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    sun_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    mon_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    mon_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    mon_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    tue_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    tue_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    tue_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    wed_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    wed_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    wed_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    thu_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    thu_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    thu_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    fri_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    fri_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    fri_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    sat_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    sat_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    sat_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    hol1_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    hol1_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    hol1_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    hol2_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    hol2_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    hol2_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    hol3_time1: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    hol3_time2: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    hol3_time3: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    emergency_override: bool = False

class TimeZoneCreate(TimeZoneBase):
    pass

class TimeZoneUpdate(TimeZoneBase):
    timezone_name: Optional[str] = Field(None, min_length=1, max_length=50)

class TimeZoneResponse(TimeZoneBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ================================
# ACCESS LEVEL SCHEMAS
# ================================

class AccessLevelBase(BaseModel):
    level_name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    mustering_only: bool = False

class AccessLevelCreate(AccessLevelBase):
    pass

class AccessLevelUpdate(AccessLevelBase):
    level_name: Optional[str] = Field(None, min_length=1, max_length=50)

class AccessLevelResponse(AccessLevelBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ================================
# DOOR SCHEMAS
# ================================

class DoorBase(BaseModel):
    terminal_sn: str = Field(..., min_length=1, max_length=20)
    door_name: str = Field(..., min_length=1, max_length=50)
    relay_time: int = Field(5, ge=1, le=60)
    door_sensor_type: int = Field(0, ge=0, le=2)
    alarm_delay: int = Field(30, ge=0, le=300)
    open_duration: int = Field(15, ge=1, le=120)
    anti_passback: int = Field(0, ge=0, le=2)
    first_card_open: bool = False
    interlock_group: int = Field(0, ge=0)
    emergency_action: int = Field(0, ge=0, le=2)
    mustering_mode: bool = False
    fire_linkage: bool = False

class DoorCreate(DoorBase):
    pass

class DoorUpdate(DoorBase):
    terminal_sn: Optional[str] = Field(None, min_length=1, max_length=20)
    door_name: Optional[str] = Field(None, min_length=1, max_length=50)

class DoorResponse(DoorBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ================================
# EVENT SCHEMAS
# ================================

class EventBase(BaseModel):
    event_time: datetime
    terminal_sn: str
    door_id: Optional[int] = None
    emp_code: Optional[str] = None
    emp_name: Optional[str] = None
    event_type: int = Field(..., ge=0, le=7)
    verify_type: Optional[int] = None
    in_out: Optional[int] = Field(None, ge=0, le=1)
    description: Optional[str] = None

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ================================
# INTERLOCK SCHEMAS
# ================================

class InterlockGroupBase(BaseModel):
    group_name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    door_ids: Optional[List[int]] = []

class InterlockGroupCreate(InterlockGroupBase):
    pass

class InterlockGroupResponse(InterlockGroupBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ================================
# LINKAGE SCHEMAS
# ================================

class LinkageBase(BaseModel):
    terminal_sn: str = Field(..., min_length=1, max_length=20)
    input_type: Optional[int] = Field(None, ge=0, le=2)
    output_action: Optional[int] = Field(None, ge=0, le=3)
    output_door_id: Optional[int] = None
    output_terminal_sn: Optional[str] = Field(None, max_length=20)

class LinkageCreate(LinkageBase):
    pass

class LinkageResponse(LinkageBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ================================
# ANTI-PASSBACK SCHEMAS
# ================================

class AntiPassbackSettings(BaseModel):
    door_id: int
    anti_passback: int = Field(0, ge=0, le=2)
    reset_time: Optional[int] = Field(None, ge=0)

class AntiPassbackGlobalSettings(BaseModel):
    enabled: bool = False
    reset_time: int = Field(300, ge=0)  # 5 minutes default
    strict_mode: bool = False

# ================================
# FIRST-CARD SCHEMAS
# ================================

class FirstCardSettings(BaseModel):
    door_id: int
    first_card_open: bool = False
    timezone_id: Optional[int] = None

# ================================
# EMERGENCY SCHEMAS
# ================================

class EmergencyActionRequest(BaseModel):
    action: str = Field(..., pattern=r"^(lock|unlock)$")
    door_ids: List[int] = []
    reason: Optional[str] = None

class MusteringModeRequest(BaseModel):
    door_ids: List[int] = []
    mustering_mode: bool = True
    event_id: Optional[int] = None

# ================================
# REPORT SCHEMAS
# ================================

class EventReportFilters(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    door_ids: Optional[str] = None  # comma-separated
    event_types: Optional[str] = None  # comma-separated
    emp_codes: Optional[str] = None  # comma-separated

class EventReportResponse(BaseModel):
    total_events: int
    events: List[EventResponse]
    summary: Dict[str, Any]
    generated_at: datetime

class DoorStatusResponse(BaseModel):
    total_doors: int
    doors: List[Dict[str, Any]]
    generated_at: datetime
