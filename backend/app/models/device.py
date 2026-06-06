"""
Device Models for Oil & Gas Personnel Management
Handles ZKTeco devices, access control, and biometric readers
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum


class DeviceType(str, enum.Enum):
    BIOMETRIC_READER = "biometric_reader"
    CARD_READER = "card_reader"
    TURNSTILE = "turnstile"
    DOOR_CONTROLLER = "door_controller"
    GATE_CONTROLLER = "gate_controller"


class DeviceStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"
    ERROR = "error"
    DISCONNECTED = "disconnected"


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    
    # Device Identification
    device_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    serial_number = Column(String(100), unique=True, nullable=True)
    model = Column(String(100), nullable=True)
    manufacturer = Column(String(100), nullable=True)
    
    # Device Type and Configuration
    device_type = Column(Enum(DeviceType), default=DeviceType.BIOMETRIC_READER)
    firmware_version = Column(String(50), nullable=True)
    hardware_version = Column(String(50), nullable=True)
    
    # Network Configuration
    ip_address = Column(String(45), nullable=True, index=True)
    port = Column(Integer, default=4370)
    mac_address = Column(String(17), nullable=True)
    
    # Zone Assignment (Primary Location Concept)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True, index=True)
    location_description = Column(String(255), nullable=True)  # Physical location description
    building = Column(String(100), nullable=True)
    floor = Column(String(50), nullable=True)
    
    # Status and Health
    status = Column(Enum(DeviceStatus), default=DeviceStatus.OFFLINE)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    battery_level = Column(Integer, nullable=True)  # For wireless devices
    signal_strength = Column(Integer, nullable=True)  # For wireless devices
    
    # Biometric Configuration
    supported_biometrics = Column(JSON, nullable=True)  # {"fingerprint": true, "face": false, "card": true}
    max_templates = Column(Integer, default=1000)
    current_templates = Column(Integer, default=0)
    
    # Access Control
    access_mode = Column(String(50), default="normal")  # normal, lockdown, emergency
    authorized_personnel = Column(JSON, nullable=True)  # List of personnel IDs
    access_schedule = Column(JSON, nullable=True)  # Schedule for access control
    
    # ZKTeco Specific
    zkteco_device_id = Column(String(50), nullable=True)  # ZKTeco device identifier
    zkteco_config = Column(JSON, nullable=True)  # ZKTeco specific configuration

    # Connection mode: 'adms' (device pushes), 'direct' (server polls via ZKLib), 'both'
    connection_mode = Column(String(10), nullable=False, default="adms")
    # Polling config (used when connection_mode is 'direct' or 'both')
    auto_poll = Column(Boolean, nullable=False, default=False)
    poll_interval_sec = Column(Integer, nullable=False, default=300)
    last_attendance_pull = Column(DateTime(timezone=True), nullable=True)

    # Security
    encryption_enabled = Column(Boolean, default=True)
    authentication_key = Column(String(255), nullable=True)
    
    # Maintenance
    last_maintenance = Column(DateTime(timezone=True), nullable=True)
    next_maintenance = Column(DateTime(timezone=True), nullable=True)
    maintenance_interval_days = Column(Integer, default=90)
    
    # Settings and Configuration
    settings = Column(JSON, nullable=True)
    custom_fields = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    access_logs = relationship("AccessLog", back_populates="device")
    device_events = relationship("DeviceEvent", back_populates="device")
    zone_assignment = relationship("Zone", back_populates="devices")
    zone_assignments = relationship("ZoneReaderAssignment", back_populates="reader")
    
    def __repr__(self):
        return f"<Device(id={self.id}, device_id='{self.device_id}', name='{self.name}')>"


class AccessLog(Base):
    __tablename__ = "access_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    
    # Personnel and Device Information
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=True, index=True)
    device_id = Column(String(100), ForeignKey("devices.device_id"), nullable=True, index=True)
    
    # Access Details
    event_type = Column(String(50), nullable=False, index=True)  # CHECK_IN, CHECK_OUT, ACCESS_DENIED, BIOMETRIC_ENROLLMENT
    access_granted = Column(Boolean, nullable=False, index=True)
    access_method = Column(String(50), nullable=True)  # FINGERPRINT, FACE, CARD, PASSWORD
    
    # Timestamps
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    duration = Column(Integer, nullable=True)  # Duration in seconds for check-in/out
    
    # Biometric Data (for enrollment events)
    biometric_data = Column(JSON, nullable=True)
    
    # Denial Reasons
    denial_reason = Column(String(255), nullable=True)
    error_code = Column(String(50), nullable=True)
    
    # Zone Information
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)
    
    # Additional Information
    notes = Column(Text, nullable=True)
    verification_method = Column(String(50), nullable=True)
    
    # Security Information
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Relationships
    # personnel = relationship("Personnel", back_populates="access_logs")  # Temporarily commented out
    device = relationship("Device", back_populates="access_logs")
    
    def __repr__(self):
        return f"<AccessLog(id={self.id}, personnel_id={self.personnel_id}, event_type='{self.event_type}')>"


class DeviceEvent(Base):
    __tablename__ = "device_events"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), ForeignKey("devices.device_id"), nullable=False, index=True)
    
    # Event Details
    event_type = Column(String(50), nullable=False, index=True)  # ONLINE, OFFLINE, ERROR, MAINTENANCE, CONFIG_CHANGE
    event_severity = Column(String(20), default="INFO")  # INFO, WARNING, ERROR, CRITICAL
    
    # Event Data
    event_data = Column(JSON, nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    
    # Timestamps
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    status = Column(String(20), default="ACTIVE")  # ACTIVE, RESOLVED, IGNORED
    
    # Additional Information
    description = Column(Text, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    # User Information
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    device = relationship("Device", back_populates="device_events")
    
    def __repr__(self):
        return f"<DeviceEvent(id={self.id}, device_id='{self.device_id}', event_type='{self.event_type}')>"


class DeviceSchedule(Base):
    __tablename__ = "device_schedules"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), ForeignKey("devices.device_id"), nullable=False, index=True)
    
    # Schedule Details
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Time Configuration
    monday_enabled = Column(Boolean, default=True)
    tuesday_enabled = Column(Boolean, default=True)
    wednesday_enabled = Column(Boolean, default=True)
    thursday_enabled = Column(Boolean, default=True)
    friday_enabled = Column(Boolean, default=True)
    saturday_enabled = Column(Boolean, default=False)
    sunday_enabled = Column(Boolean, default=False)
    
    # Time Ranges (JSON array of {"start": "08:00", "end": "17:00"})
    time_ranges = Column(JSON, nullable=True)
    
    # Access Configuration
    access_mode = Column(String(50), default="NORMAL")  # NORMAL, RESTRICTED, LOCKDOWN
    authorized_personnel = Column(JSON, nullable=True)  # Override device authorization
    
    # Status
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=1)  # Higher priority schedules override lower ones
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    device = relationship("Device")
    
    def __repr__(self):
        return f"<DeviceSchedule(id={self.id}, device_id='{self.device_id}', name='{self.name}')>"


class DeviceMaintenance(Base):
    __tablename__ = "device_maintenance"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), ForeignKey("devices.device_id"), nullable=False, index=True)
    
    # Maintenance Details
    maintenance_type = Column(String(50), nullable=False)  # ROUTINE, REPAIR, CALIBRATION, CLEANING
    description = Column(Text, nullable=True)
    
    # Schedule
    scheduled_date = Column(DateTime(timezone=True), nullable=False)
    estimated_duration = Column(Integer, nullable=True)  # Duration in minutes
    
    # Execution
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    actual_duration = Column(Integer, nullable=True)
    
    # Status
    status = Column(String(20), default="SCHEDULED")  # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, FAILED
    
    # Personnel
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    technician_notes = Column(Text, nullable=True)
    
    # Parts and Materials
    parts_used = Column(JSON, nullable=True)
    cost = Column(Integer, nullable=True)
    
    # Results
    test_results = Column(JSON, nullable=True)
    next_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    device = relationship("Device")
    
    def __repr__(self):
        return f"<DeviceMaintenance(id={self.id}, device_id='{self.device_id}', type='{self.maintenance_type}')>"
