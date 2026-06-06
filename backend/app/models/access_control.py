"""
Access Control Models - BioTime 9.5 Compatible + POB Extensions
Complete Access Control system matching BioTime 9.5 AC with emergency features
"""

from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, SmallInteger, ForeignKey, BigInteger, Text, Float, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class AccessEventType(enum.Enum):
    NORMAL = 0
    DOOR_OPEN = 1
    DOOR_ALARM = 2
    ANTI_PASSBACK = 3
    DURESS = 4
    FIRE_UNLOCK = 5
    EMERGENCY_LOCK = 6
    MUSTERING_CHECK = 7

class EmergencyAction(enum.Enum):
    IGNORE = 0
    LOCK = 1
    UNLOCK = 2

class DoorSensorType(enum.Enum):
    NONE = 0
    NORMALLY_OPEN = 1
    NORMALLY_CLOSED = 2

class AntiPassbackMode(enum.Enum):
    NONE = 0
    ENTRY_EXIT = 1
    STRICT = 2

# Time Zone Management
class AccTimeZone(Base):
    """Access Control Time Zone - BioTime 9.5 Compatible"""
    __tablename__ = "acc_timezone"
    
    id = Column(Integer, primary_key=True, index=True)
    timezone_name = Column(String(50), nullable=False, unique=True)
    
    # Sunday intervals
    sun_time1 = Column(String(11))  # HH:MM-HH:MM format
    sun_time2 = Column(String(11))
    sun_time3 = Column(String(11))
    
    # Monday intervals
    mon_time1 = Column(String(11))
    mon_time2 = Column(String(11))
    mon_time3 = Column(String(11))
    
    # Tuesday intervals
    tue_time1 = Column(String(11))
    tue_time2 = Column(String(11))
    tue_time3 = Column(String(11))
    
    # Wednesday intervals
    wed_time1 = Column(String(11))
    wed_time2 = Column(String(11))
    wed_time3 = Column(String(11))
    
    # Thursday intervals
    thu_time1 = Column(String(11))
    thu_time2 = Column(String(11))
    thu_time3 = Column(String(11))
    
    # Friday intervals
    fri_time1 = Column(String(11))
    fri_time2 = Column(String(11))
    fri_time3 = Column(String(11))
    
    # Saturday intervals
    sat_time1 = Column(String(11))
    sat_time2 = Column(String(11))
    sat_time3 = Column(String(11))
    
    # Holiday intervals
    hol1_time1 = Column(String(11))
    hol1_time2 = Column(String(11))
    hol1_time3 = Column(String(11))
    hol2_time1 = Column(String(11))
    hol2_time2 = Column(String(11))
    hol2_time3 = Column(String(11))
    hol3_time1 = Column(String(11))
    hol3_time2 = Column(String(11))
    hol3_time3 = Column(String(11))
    
    # POB Extension
    emergency_override = Column(Boolean, default=False)  # Zone ignored during emergency
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    access_levels = relationship("AccLevelDoor", back_populates="timezone")

# Access Level Management - AccLevel is imported from biotime_models.py

class AccLevelDoor(Base):
    """Many-to-Many: Access Level to Door + Timezone"""
    __tablename__ = "acc_level_door"
    
    id = Column(Integer, primary_key=True, index=True)
    level_id = Column(Integer, ForeignKey("acc_level.id"), nullable=False)
    door_id = Column(Integer, ForeignKey("acc_door.id"), nullable=False)
    timezone_id = Column(Integer, ForeignKey("acc_timezone.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    access_level = relationship("AccLevel")
    door = relationship("AccDoor")
    timezone = relationship("AccTimeZone", back_populates="access_levels")

# Door Management - AccDoor is imported from biotime_models.py

# User Authorization - AccUserAuthorize is imported from biotime_models.py

# Access Events
class AccEvent(Base):
    """Access Control Events - BioTime 9.5 Compatible"""
    __tablename__ = "acc_event"
    
    id = Column(BigInteger, primary_key=True, index=True)
    event_time = Column(DateTime(timezone=True), nullable=False, index=True)
    terminal_sn = Column(String(20), nullable=False, index=True)
    door_id = Column(Integer, ForeignKey("acc_door.id"))
    emp_code = Column(String(20), index=True)
    emp_name = Column(String(50))
    event_type = Column(SmallInteger, nullable=False)  # AccessEventType enum values
    verify_type = Column(SmallInteger)  # 0=password, 1=fingerprint, 2=face, 3=card
    in_out = Column(SmallInteger)  # 0=in, 1=out
    description = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    door = relationship("AccDoor")

# Interlock Management
class AccInterlockGroup(Base):
    """Access Control Interlock Groups"""
    __tablename__ = "acc_interlock_group"
    
    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String(50), nullable=False, unique=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    door_assignments = relationship("AccInterlockDoor", back_populates="interlock_group")

class AccInterlockDoor(Base):
    """Many-to-Many: Interlock Group to Doors"""
    __tablename__ = "acc_interlock_door"
    
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("acc_interlock_group.id"), nullable=False)
    door_id = Column(Integer, ForeignKey("acc_door.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    interlock_group = relationship("AccInterlockGroup", back_populates="door_assignments")
    door = relationship("AccDoor")

# Linkage Management
class AccLinkage(Base):
    """Access Control Input-Output Linkage"""
    __tablename__ = "acc_linkage"
    
    id = Column(Integer, primary_key=True, index=True)
    terminal_sn = Column(String(20), nullable=False)
    input_type = Column(SmallInteger)  # 0=door_sensor, 1=aux_input, 2=fire
    output_action = Column(SmallInteger)  # 0=open_door, 1=alarm, 2=siren, 3=strobe
    output_door_id = Column(Integer, ForeignKey("acc_door.id"))
    output_terminal_sn = Column(String(20))  # For siren/strobe devices
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    output_door = relationship("AccDoor")

# Anti-passback Tracking
class AccAntiPassback(Base):
    """Access Control Anti-passback Tracking"""
    __tablename__ = "acc_antipassback"
    
    id = Column(BigInteger, primary_key=True, index=True)
    emp_code = Column(String(20), nullable=False, index=True)
    door_id = Column(Integer, ForeignKey("acc_door.id"), nullable=False)
    last_event_time = Column(DateTime(timezone=True), nullable=False)
    last_event_type = Column(SmallInteger, nullable=False)  # 0=in, 1=out
    last_terminal_sn = Column(String(20), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    door = relationship("AccDoor")

# First Card Open Tracking
class AccFirstCard(Base):
    """Access Control First Card Open Tracking"""
    __tablename__ = "acc_first_card"
    
    id = Column(BigInteger, primary_key=True, index=True)
    door_id = Column(Integer, ForeignKey("acc_door.id"), nullable=False)
    timezone_id = Column(Integer, ForeignKey("acc_timezone.id"), nullable=False)
    first_card_time = Column(DateTime(timezone=True), nullable=False)
    emp_code = Column(String(20), nullable=False)
    zone_end_time = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    door = relationship("AccDoor")
    timezone = relationship("AccTimeZone")
