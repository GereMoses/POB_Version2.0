"""
BioTime Enhanced Database Models - FIXED VERSION

This module contains enhanced database models for improved ZKTeco BioTime compatibility,
including biometric template management, device groups, access schedules, and synchronization tracking.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum
import datetime

class BiometricTemplateType(str, enum.Enum):
    FINGERPRINT = "fingerprint"
    FACE = "face"
    CARD = "card"
    IRIS = "iris"
    PALM = "palm"
    MULTIMODAL = "multimodal"

class DeviceGroupType(str, enum.Enum):
    ACCESS_CONTROL = "access_control"
    MONITORING = "monitoring"
    ATTENDANCE = "attendance"
    BIOMETRIC = "biometric"
    EMERGENCY = "emergency"

class AccessScheduleType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"
    HOLIDAY = "holiday"
    EMERGENCY = "emergency"

class SyncStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CONFLICT = "conflict"
    CANCELLED = "cancelled"

class BioTimeBiometricTemplate(Base):
    """Enhanced biometric template management for BioTime compatibility"""
    __tablename__ = "biotime_biometric_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    template_type = Column(String(20), nullable=False)  # fingerprint, face, card, iris, palm, multimodal
    template_id = Column(String(100), nullable=False, index=True)  # BioTime template ID
    quality_score = Column(Float, nullable=False, default=0.0)  # BioTime quality score (0-1)
    enrollment_date = Column(DateTime(timezone=True), nullable=False)
    last_used = Column(DateTime(timezone=True), nullable=True)
    device_id = Column(String(50), nullable=True)  # BioTime device ID
    biotime_template_hash = Column(String(255), nullable=True)  # BioTime template hash
    template_data = Column(JSON, nullable=True)  # Full template data
    is_active = Column(Boolean, default=True, server_default='true')
    backup_count = Column(Integer, default=0)  # Number of backup templates
    verification_count = Column(Integer, default=0)  # Number of successful verifications
    failure_count = Column(Integer, default=0)  # Number of failed verifications
    last_verification_score = Column(Float, nullable=True)  # Last verification confidence score
    
    # BioTime specific fields
    biotime_template_version = Column(String(20), nullable=True)  # BioTime template version
    biotime_device_type = Column(String(50), nullable=True)  # BioTime device type
    biotime_enrollment_method = Column(String(50), nullable=True)  # Enrollment method used
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    personnel = relationship("Personnel")

class BioTimeDeviceGroup(Base):
    """Device group management for BioTime compatibility"""
    __tablename__ = "biotime_device_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String(100), nullable=False, unique=True)
    group_type = Column(String(50), nullable=False)  # access_control, monitoring, attendance, biometric, emergency
    device_ids = Column(JSON, nullable=False)  # Array of device IDs
    configuration = Column(JSON, nullable=True)  # Group-specific configuration
    is_active = Column(Boolean, default=True, server_default='true')
    
    # Group management
    parent_group_id = Column(Integer, ForeignKey("biotime_device_groups.id"), nullable=True)
    priority = Column(Integer, default=0)  # Group priority for operations
    description = Column(Text, nullable=True)
    
    # BioTime specific fields
    biotime_group_id = Column(String(100), nullable=True)  # BioTime group ID
    biotime_sync_enabled = Column(Boolean, default=True, server_default='true')
    biotime_last_sync = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    parent_group = relationship("BioTimeDeviceGroup", remote_side=[id], back_populates="child_groups", overlaps="child_groups")
    child_groups = relationship("BioTimeDeviceGroup", foreign_keys=[parent_group_id], back_populates="parent_group", overlaps="parent_group")
    devices = relationship("BioTimeDevice", back_populates="device_group")

class BioTimeAccessSchedule(Base):
    """Time-based access schedules for BioTime compatibility"""
    __tablename__ = "biotime_access_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    schedule_name = Column(String(100), nullable=False)
    schedule_type = Column(String(20), nullable=False)  # daily, weekly, monthly, custom, holiday, emergency
    
    # Schedule timing
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    monday_enabled = Column(Boolean, default=True, server_default='true')
    tuesday_enabled = Column(Boolean, default=True, server_default='true')
    wednesday_enabled = Column(Boolean, default=True, server_default='true')
    thursday_enabled = Column(Boolean, default=True, server_default='true')
    friday_enabled = Column(Boolean, default=True, server_default='true')
    saturday_enabled = Column(Boolean, default=False, server_default='false')
    sunday_enabled = Column(Boolean, default=False, server_default='false')
    
    # Daily time ranges
    monday_start_time = Column(String(5), nullable=True)  # HH:MM
    monday_end_time = Column(String(5), nullable=True)    # HH:MM
    tuesday_start_time = Column(String(5), nullable=True)
    tuesday_end_time = Column(String(5), nullable=True)
    wednesday_start_time = Column(String(5), nullable=True)
    wednesday_end_time = Column(String(5), nullable=True)
    thursday_start_time = Column(String(5), nullable=True)
    thursday_end_time = Column(String(5), nullable=True)
    friday_start_time = Column(String(5), nullable=True)
    friday_end_time = Column(String(5), nullable=True)
    saturday_start_time = Column(String(5), nullable=True)
    saturday_end_time = Column(String(5), nullable=True)
    sunday_start_time = Column(String(5), nullable=True)
    sunday_end_time = Column(String(5), nullable=True)
    
    # Access control
    personnel_ids = Column(JSON, nullable=False)  # Personnel IDs for this schedule
    device_group_ids = Column(JSON, nullable=False)  # Device groups for this schedule
    access_levels = Column(JSON, nullable=False)  # Access levels for this schedule
    
    # BioTime specific fields
    biotime_schedule_id = Column(String(100), nullable=True)  # BioTime schedule ID
    biotime_sync_enabled = Column(Boolean, default=True, server_default='true')
    biotime_last_sync = Column(DateTime(timezone=True), nullable=True)
    
    # Schedule overrides
    holiday_overrides = Column(JSON, nullable=True)  # Holiday schedule overrides
    emergency_override = Column(JSON, nullable=True)  # Emergency access override
    temporary_override = Column(JSON, nullable=True)  # Temporary schedule override
    
    # Metadata
    is_active = Column(Boolean, default=True, server_default='true')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships disabled — access_levels/personnel_ids are JSON columns, not FKs

class BioTimeSyncLogEntry(Base):
    """Enhanced synchronization logging for BioTime compatibility"""
    __tablename__ = "biotime_sync_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    sync_type = Column(String(50), nullable=False)  # personnel, attendance, biometric, configuration
    sync_direction = Column(String(20), nullable=False)  # to_biotime, from_biotime, bidirectional
    
    # Sync timing
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    
    # Sync statistics
    total_records = Column(Integer, default=0)
    successful_records = Column(Integer, default=0)
    failed_records = Column(Integer, default=0)
    conflict_records = Column(Integer, default=0)
    skipped_records = Column(Integer, default=0)
    
    # Sync details
    sync_details = Column(JSON, nullable=True)  # Detailed sync information
    error_details = Column(JSON, nullable=True)  # Error information if any
    conflict_resolution = Column(JSON, nullable=True)  # Conflict resolution details
    
    # BioTime specific fields
    biotime_sync_id = Column(String(100), nullable=True)  # BioTime sync operation ID
    biotime_api_version = Column(String(20), nullable=True)  # BioTime API version used
    biotime_server_url = Column(String(255), nullable=True)  # BioTime server URL
    biotime_last_successful_sync = Column(DateTime(timezone=True), nullable=True)
    
    # Sync status
    status = Column(String(20), default=SyncStatus.PENDING.value)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    # personnel relationship disabled — back_populates not defined on Personnel

class BioTimeDevice(Base):
    """Enhanced device management for BioTime compatibility"""
    __tablename__ = "biotime_devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), nullable=False, unique=True, index=True)  # BioTime device ID
    device_name = Column(String(100), nullable=False)
    device_type = Column(String(50), nullable=False)  # MB20, MB560, MB360, K40, etc.
    
    # Device configuration
    manufacturer = Column(String(100), nullable=True)  # ZKTeco, third-party
    model = Column(String(100), nullable=True)
    firmware_version = Column(String(50), nullable=True)
    hardware_version = Column(String(50), nullable=True)
    serial_number = Column(String(100), nullable=True)
    
    # Network configuration
    ip_address = Column(String(45), nullable=True)
    mac_address = Column(String(17), nullable=True)
    port = Column(Integer, nullable=True)  # Device port
    network_type = Column(String(20), nullable=True)  # lan, wifi, 4g, vpn
    biotime_device_id = Column(String(100), nullable=True)  # BioTime device identifier
    biotime_configuration = Column(JSON, nullable=True)  # BioTime-specific configuration
    biotime_last_config_sync = Column(DateTime(timezone=True), nullable=True)
    biotime_api_version = Column(String(20), nullable=True)  # BioTime API version
    
    # Device capabilities
    supported_biometric_types = Column(JSON, nullable=True)  # Array of supported biometric types
    max_templates_per_type = Column(JSON, nullable=True)  # Max templates per biometric type
    supported_verification_methods = Column(JSON, nullable=True)  # Array of supported methods
    anti_passback_enabled = Column(Boolean, default=False, server_default='false')
    multi_factor_enabled = Column(Boolean, default=False, server_default='false')
    
    # Device status
    status = Column(String(20), nullable=False)  # online, offline, maintenance, error
    last_seen = Column(DateTime(timezone=True), nullable=True)
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)
    battery_level = Column(Integer, nullable=True)  # For wireless devices
    signal_strength = Column(Integer, nullable=True)  # For wireless devices
    
    # Device groups
    device_group_id = Column(Integer, ForeignKey("biotime_device_groups.id"), nullable=True)
    
    # BioTime specific fields
    biotime_device_id = Column(String(100), nullable=True)  # BioTime device identifier
    biotime_configuration = Column(JSON, nullable=True)  # BioTime-specific configuration
    biotime_last_config_sync = Column(DateTime(timezone=True), nullable=True)
    biotime_api_version = Column(String(20), nullable=True)  # BioTime API version
    
    # Location and deployment
    location = Column(String(100), nullable=True)
    zone = Column(String(100), nullable=True)
    installation_date = Column(DateTime(timezone=True), nullable=True)
    warranty_expiry = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    is_active = Column(Boolean, default=True, server_default='true')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    device_group = relationship("BioTimeDeviceGroup", back_populates="devices")

class BioTimeAccessLevel(Base):
    """Enhanced access level management for BioTime compatibility"""
    __tablename__ = "biotime_access_levels"
    
    id = Column(Integer, primary_key=True, index=True)
    level_name = Column(String(100), nullable=False, unique=True)
    level_code = Column(String(20), nullable=False, unique=True)
    
    # Access level configuration
    priority = Column(Integer, nullable=False)  # Higher number = higher priority
    time_restrictions = Column(JSON, nullable=True)  # Time-based restrictions
    location_restrictions = Column(JSON, nullable=True)  # Location-based restrictions
    device_restrictions = Column(JSON, nullable=True)  # Device-based restrictions
    
    # Biometric requirements
    required_biometric_types = Column(JSON, nullable=True)  # Required biometric types
    min_biometric_quality = Column(Float, default=0.8)  # Minimum biometric quality
    multi_factor_required = Column(Boolean, default=False, server_default='false')
    
    # Access permissions
    access_permissions = Column(JSON, nullable=True)  # Array of access permissions
    door_permissions = Column(JSON, nullable=True)  # Array of door permissions
    area_permissions = Column(JSON, nullable=True)  # Array of area permissions
    
    # Personnel assignments
    personnel_ids = Column(JSON, nullable=False)  # Personnel IDs with this access level
    device_group_ids = Column(JSON, nullable=False)  # Device groups with this access level
    
    # BioTime specific fields
    biotime_access_level_id = Column(String(100), nullable=True)  # BioTime access level ID
    biotime_configuration = Column(JSON, nullable=True)  # BioTime-specific configuration
    biotime_last_sync = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    is_active = Column(Boolean, default=True, server_default='true')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships disabled — device_groups/personnel use JSON arrays, not FK columns

class BioTimeConflictResolution(Base):
    """Conflict resolution tracking for BioTime synchronization"""
    __tablename__ = "biotime_conflict_resolutions"
    
    id = Column(Integer, primary_key=True, index=True)
    conflict_id = Column(String(100), nullable=False, unique=True, index=True)
    
    # Conflict details
    conflict_type = Column(String(50), nullable=False)  # personnel_data, biometric_template, attendance_record
    conflict_description = Column(Text, nullable=False)
    detected_at = Column(DateTime(timezone=True), nullable=False)
    
    # Resolution details
    resolution_strategy = Column(String(50), nullable=False)  # manual, automatic, merge, overwrite
    resolution_details = Column(JSON, nullable=True)  # Detailed resolution information
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Impact assessment
    impact_level = Column(String(20), nullable=False)  # low, medium, high, critical
    affected_records = Column(JSON, nullable=True)  # Array of affected record IDs
    prevention_measures = Column(JSON, nullable=True)  # Prevention measures for future
    
    # BioTime specific fields
    biotime_conflict_id = Column(String(100), nullable=True)  # BioTime conflict identifier
    biotime_resolution_data = Column(JSON, nullable=True)  # BioTime resolution data
    
    # Metadata
    status = Column(String(20), default=SyncStatus.PENDING.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    resolver = relationship("User")
