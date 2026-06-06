"""
Enhanced Emergency Models - POB v2.0
Extended emergency system with AI-powered features, predictive analytics,
and advanced safety capabilities
"""

from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, SmallInteger, ForeignKey, BigInteger, Text, Float, Time, ARRAY, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base
import enum

class EmergencyThreatLevel(enum.Enum):
    LOW = 0
    MEDIUM = 1
    HIGH = 2
    CRITICAL = 3

class EmergencySeverity(enum.Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3

class EmergencyType(enum.Enum):
    LOCKDOWN = 0
    FIRE = 1
    GAS = 2
    INTRUDER = 3
    MEDICAL = 4
    ALL_CLEAR = 5
    EVACUATION = 6
    SHELTER_IN_PLACE = 7
    CHEMICAL_SPILL = 8
    SECURITY_BREACH = 9

class EmergencyStatus(enum.Enum):
    ACTIVE = 0
    RESOLVED = 1
    CANCELLED = 2
    MONITORING = 3
    ESCALATED = 4

class EmergencyScope(enum.Enum):
    GLOBAL = 0
    ZONE = 1
    DOOR = 2
    BUILDING = 3

class EmergencyInitiatedType(enum.Enum):
    MANUAL_UI = 0
    PANIC_BUTTON = 1
    FIRE_PANEL = 2
    API = 3
    AI_DETECTED = 4
    AUTOMATED = 5

class NotificationChannel(enum.Enum):
    SMS = 0
    EMAIL = 1
    WHATSAPP = 2
    PUSH = 3
    PA = 4
    SIREN = 5
    DIGITAL_DISPLAY = 6

class NotificationStatus(enum.Enum):
    PENDING = 0
    SENT = 1
    FAILED = 2
    DELIVERED = 3
    ACKNOWLEDGED = 4

class RecipientType(enum.Enum):
    USER = 0
    DEPT = 1
    ALL = 2
    ROLE = 3
    LOCATION = 4

class PanicType(enum.Enum):
    SOFT_UI = 0
    HARD_AUX = 1
    MOBILE_APP = 2
    VOICE_COMMAND = 3

class DeviceStatus(enum.Enum):
    OFFLINE = 0
    ONLINE = 1
    FAULT = 2
    MAINTENANCE = 3
    TESTING = 4

class MaintenanceType(enum.Enum):
    ROUTINE = 0
    MAJOR = 1
    INSPECTION = 2
    REPAIR = 3
    EMERGENCY = 4

class TransportType(enum.Enum):
    HELICOPTER = 0
    VESSEL = 1
    VEHICLE = 2
    DRONE = 3

class TransportStatus(enum.Enum):
    SCHEDULED = 0
    BOARDING = 1
    IN_TRANSIT = 2
    ARRIVED = 3
    CANCELLED = 4
    DELAYED = 5

class EmergencyEventEnhanced(Base):
    """Enhanced emergency event tracking with AI features"""
    __tablename__ = "emergency_event_enhanced"
    
    id = Column(BigInteger, primary_key=True, index=True)
    event_type = Column(SmallInteger, nullable=False, index=True)  # EmergencyType enum
    status = Column(SmallInteger, default=EmergencyStatus.ACTIVE.value, index=True)  # EmergencyStatus enum
    scope = Column(SmallInteger, default=EmergencyScope.GLOBAL.value)  # EmergencyScope enum
    severity = Column(SmallInteger, default=EmergencySeverity.NORMAL.value)  # EmergencySeverity enum
    
    # Target arrays with JSONB for better performance
    zone_ids = Column(ARRAY(Integer))  # Array of zones.id
    door_ids = Column(ARRAY(Integer))  # Array of acc_door.id
    building_ids = Column(ARRAY(Integer))  # Array of building IDs
    personnel_ids = Column(ARRAY(Integer))  # Array of personnel IDs
    
    # Timestamps
    start_time = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    end_time = Column(DateTime(timezone=True))
    estimated_resolution = Column(DateTime(timezone=True))
    actual_resolution = Column(DateTime(timezone=True))
    
    # Initiation tracking
    initiated_by = Column(Integer, ForeignKey("auth_user.id"))
    initiated_type = Column(SmallInteger, default=EmergencyInitiatedType.MANUAL_UI.value)  # EmergencyInitiatedType enum
    trigger_source = Column(String(100))  # "Web UI", "Panic Button Gate-01", "AI Detection", "API:FirePanel"
    confidence_score = Column(Float, default=0.0)  # AI confidence score
    
    # Enhanced details
    reason = Column(Text)
    description = Column(Text)
    impact_assessment = Column(JSONB)  # AI impact assessment
    risk_factors = Column(JSONB)  # AI-identified risk factors
    mitigation_actions = Column(JSONB)  # Mitigation actions taken
    
    # AI and analytics
    ai_detected = Column(Boolean, default=False)
    ai_predictions = Column(JSONB)  # AI predictions before event
    ai_recommendations = Column(JSONB)  # AI-generated recommendations
    pattern_anomalies = Column(JSONB)  # Pattern anomalies detected
    
    # Integration points
    mustering_event_id = Column(BigInteger, ForeignKey("mustering_event.id"))
    incident_report_id = Column(BigInteger)  # Link to incident reports
    external_system_id = Column(String(100))  # External system reference
    
    # Performance metrics
    response_time = Column(Float)  # Response time in seconds
    resolution_time = Column(Float)  # Resolution time in seconds
    cost_impact = Column(Float)  # Estimated cost impact
    disruption_level = Column(SmallInteger)  # 1-5 scale
    
    # Enhanced actions with detailed tracking
    actions = Column(JSONB)  # Detailed action log with timestamps and results
    command_queue = Column(JSONB)  # Device command queue
    notification_log = Column(JSONB)  # Detailed notification log
    
    # Compliance and audit
    compliance_required = Column(Boolean, default=True)
    compliance_notes = Column(Text)
    audit_trail = Column(JSONB)  # Enhanced audit trail
    regulatory_reports = Column(JSONB)  # Regulatory reporting data
    
    # Geographic and environmental data
    weather_conditions = Column(JSONB)  # Weather at time of event
    environmental_factors = Column(JSONB)  # Environmental factors
    
    # Personnel impact
    affected_personnel = Column(JSONB)  # Personnel affected
    injuries = Column(JSONB)  # Injury reports
    evacuations = Column(JSONB)  # Evacuation data
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    initiator = relationship("AuthUser")
    mustering_event = relationship("MusteringEvent")
    notifications = relationship("EmergencyNotificationEnhanced", back_populates="emergency_event")
    panic_logs = relationship("EmergencyPanicLogEnhanced", back_populates="emergency_event")
    device_commands = relationship("EmergencyDeviceCommand", back_populates="emergency_event")

class EmergencyDeviceEnhanced(Base):
    """Enhanced emergency devices with AI monitoring and predictive maintenance"""
    __tablename__ = "emergency_device_enhanced"
    
    id = Column(Integer, primary_key=True, index=True)
    terminal_sn = Column(String(20), ForeignKey("iclock_terminal.sn"), unique=True, nullable=False)
    device_type = Column(SmallInteger, nullable=False)  # 1=Siren,2=Strobe,3=Lock,4=Speaker,5=PanicButton,6=Camera,7=Sensor
    zone_id = Column(Integer, ForeignKey("zones.id"))
    building_id = Column(Integer)  # Building association
    
    # Enhanced status and monitoring
    status = Column(SmallInteger, default=DeviceStatus.OFFLINE.value, index=True)  # DeviceStatus enum
    health_score = Column(Float, default=1.0)  # 0.0 to 1.0 health score
    last_maintenance = Column(DateTime(timezone=True))
    next_maintenance = Column(DateTime(timezone=True))
    
    # Performance metrics
    response_time_avg = Column(Float, default=0.0)  # Average response time
    uptime_percentage = Column(Float, default=100.0)  # Uptime percentage
    failure_count = Column(Integer, default=0)  # Number of failures
    test_results = Column(JSONB)  # Test result history
    
    # AI monitoring
    ai_monitored = Column(Boolean, default=True)
    predictive_maintenance = Column(JSONB)  # AI maintenance predictions
    performance_anomalies = Column(JSONB)  # Performance anomalies
    usage_patterns = Column(JSONB)  # Usage pattern analysis
    
    # Device configuration
    location_description = Column(String(200))
    installation_date = Column(Date)
    manufacturer = Column(String(100))
    model = Column(String(100))
    firmware_version = Column(String(50))
    serial_number = Column(String(100))
    
    # Capabilities
    capabilities = Column(JSONB)  # Device capabilities
    supported_commands = Column(JSONB)  # Supported command types
    integration_points = Column(JSONB)  # Integration endpoints
    
    # Testing and calibration
    test_schedule = Column(String(50))  # cron "0 12 * * 0"
    last_test = Column(DateTime(timezone=True))
    test_results_history = Column(JSONB)  # Historical test results
    calibration_data = Column(JSONB)  # Calibration information
    
    # Environmental factors
    operating_temperature_min = Column(Float)
    operating_temperature_max = Column(Float)
    humidity_tolerance_min = Column(Float)
    humidity_tolerance_max = Column(Float)
    power_requirements = Column(JSONB)  # Power requirements
    
    # Communication
    network_config = Column(JSONB)  # Network configuration
    communication_protocols = Column(JSONB)  # Supported protocols
    encryption_keys = Column(JSONB)  # Encryption keys (encrypted)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    terminal = relationship("IClockTerminal")
    zone = relationship("Zone", foreign_keys=[zone_id])
    commands = relationship("EmergencyDeviceCommand", back_populates="device")
    maintenance_records = relationship("EmergencyDeviceMaintenance", back_populates="device")

class EmergencyNotificationEnhanced(Base):
    """Enhanced emergency notifications with advanced delivery tracking"""
    __tablename__ = "emergency_notification_enhanced"
    
    id = Column(BigInteger, primary_key=True, index=True)
    emergency_event_id = Column(BigInteger, ForeignKey("emergency_event_enhanced.id"), nullable=False, index=True)
    
    # Notification details
    channel = Column(SmallInteger, nullable=False, index=True)  # NotificationChannel enum
    recipient_type = Column(SmallInteger)  # RecipientType enum
    recipient_id = Column(Integer)
    recipient_addr = Column(String(255))  # phone/email/push token
    recipient_name = Column(String(100))  # Recipient name for logging
    
    # Message content
    message = Column(Text)
    message_template = Column(String(100))  # Template used
    template_variables = Column(JSONB)  # Template variables used
    personalization_data = Column(JSONB)  # Personalization data
    
    # Enhanced status tracking
    status = Column(SmallInteger, default=NotificationStatus.PENDING.value, index=True)  # NotificationStatus enum
    priority = Column(SmallInteger, default=0)  # 0=Low, 1=Normal, 2=High, 3=Urgent
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    queued_at = Column(DateTime(timezone=True))
    sent_time = Column(DateTime(timezone=True))
    delivered_time = Column(DateTime(timezone=True))
    acknowledged_at = Column(DateTime(timezone=True))
    read_time = Column(DateTime(timezone=True))
    
    # Delivery tracking
    delivery_attempts = Column(Integer, default=0)
    last_attempt_status = Column(String(50))
    delivery_provider = Column(String(50))  # SMS provider, email service, etc.
    tracking_id = Column(String(100))  # External tracking ID
    
    # Performance metrics
    delivery_time = Column(Float)  # Total delivery time in seconds
    cost = Column(Float, default=0.0)  # Cost of notification
    engagement_metrics = Column(JSONB)  # Open rates, click rates, etc.
    
    # Enhanced features
    retry_policy = Column(JSONB)  # Retry configuration
    escalation_rules = Column(JSONB)  # Escalation logic
    acknowledgment_required = Column(Boolean, default=False)
    response_tracking = Column(JSONB)  # Response tracking data
    
    # Compliance and audit
    compliance_required = Column(Boolean, default=True)
    audit_log = Column(JSONB)  # Detailed audit log
    regulatory_compliance = Column(JSONB)  # Regulatory compliance data
    
    # Error handling
    error_codes = Column(JSONB)  # Error codes encountered
    error_details = Column(Text)  # Detailed error information
    recovery_actions = Column(JSONB)  # Recovery actions taken
    
    # Relationships
    emergency_event = relationship("EmergencyEventEnhanced", back_populates="notifications")

class EmergencyPanicLogEnhanced(Base):
    """Enhanced panic button activation log with AI analysis"""
    __tablename__ = "emergency_panic_log_enhanced"
    
    id = Column(BigInteger, primary_key=True, index=True)
    terminal_sn = Column(String(20))
    device_type = Column(SmallInteger)  # PanicType enum
    emp_code = Column(String(20))  # if authenticated
    location = Column(String(100))
    geolocation = Column(JSONB)  # GPS coordinates
    emergency_event_id = Column(BigInteger, ForeignKey("emergency_event_enhanced.id"))
    
    # Enhanced panic data
    panic_time = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    panic_type = Column(SmallInteger)  # PanicType enum
    severity = Column(SmallInteger, default=1)  # 1-5 severity scale
    confidence = Column(Float, default=1.0)  # Confidence in panic detection
    
    # Context and environment
    environmental_conditions = Column(JSONB)  # Environmental factors
    nearby_personnel = Column(JSONB)  # Personnel in vicinity
    security_context = Column(JSONB)  # Security context
    
    # AI analysis
    ai_detected = Column(Boolean, default=False)
    ai_confidence = Column(Float, default=0.0)
    ai_risk_assessment = Column(JSONB)  # AI risk assessment
    false_alarm_probability = Column(Float, default=0.0)
    
    # Resolution tracking
    resolved_by = Column(Integer, ForeignKey("auth_user.id"))
    resolved_time = Column(DateTime(timezone=True))
    resolution_method = Column(String(50))  # How it was resolved
    verification_required = Column(Boolean, default=True)
    verified_by = Column(Integer, ForeignKey("auth_user.id"))
    verified_time = Column(DateTime(timezone=True))
    
    # Impact assessment
    impact_assessment = Column(JSONB)  # Impact on operations
    disruption_duration = Column(Integer)  # Duration in seconds
    cost_impact = Column(Float, default=0.0)
    personnel_impacted = Column(JSONB)  # Personnel affected
    
    # Follow-up actions
    follow_up_required = Column(Boolean, default=True)
    follow_up_actions = Column(JSONB)  # Actions taken
    investigation_required = Column(Boolean, default=False)
    investigation_results = Column(JSONB)  # Investigation findings
    
    # Audio and video evidence
    audio_recording = Column(String(255))  # Path to audio recording
    video_recording = Column(String(255))  # Path to video recording
    sensor_data = Column(JSONB)  # Sensor data from devices
    
    # Compliance and audit
    regulatory_report = Column(Boolean, default=False)
    audit_findings = Column(JSONB)  # Audit findings
    compliance_notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    emergency_event = relationship("EmergencyEventEnhanced", back_populates="panic_logs")
    resolver = relationship("AuthUser", foreign_keys=[resolved_by])

class EmergencyDeviceCommand(Base):
    """Emergency device command tracking with enhanced monitoring"""
    __tablename__ = "emergency_device_command"
    
    id = Column(BigInteger, primary_key=True, index=True)
    emergency_event_id = Column(BigInteger, ForeignKey("emergency_event_enhanced.id"))
    device_id = Column(Integer, ForeignKey("emergency_device_enhanced.id"))
    
    # Command details
    command_type = Column(String(50))  # Command type
    command_data = Column(JSONB)  # Command parameters
    command_priority = Column(SmallInteger, default=0)  # 0=Low,1=Normal,2=High,3=Urgent
    
    # Status tracking
    status = Column(String(20), default="QUEUED")  # QUEUED, SENT, EXECUTED, FAILED, TIMEOUT
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    sent_at = Column(DateTime(timezone=True))
    executed_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Performance metrics
    queue_time = Column(Float)  # Time in queue
    execution_time = Column(Float)  # Time to execute
    total_time = Column(Float)  # Total processing time
    
    # Response tracking
    device_response = Column(JSONB)  # Device response data
    acknowledgment = Column(JSONB)  # Device acknowledgment
    confirmation_data = Column(JSONB)  # Confirmation details
    
    # Error handling
    error_code = Column(String(50))
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Enhanced features
    batch_id = Column(String(50))  # For batch operations
    parent_command = Column(BigInteger, ForeignKey("emergency_device_command.id"))  # For chained commands
    
    # Audit and compliance
    operator_id = Column(Integer, ForeignKey("auth_user.id"))
    audit_log = Column(JSONB)
    compliance_data = Column(JSONB)
    
    # Relationships
    emergency_event = relationship("EmergencyEventEnhanced", back_populates="device_commands")
    device = relationship("EmergencyDeviceEnhanced", back_populates="commands")

class EmergencyDeviceMaintenance(Base):
    """Enhanced device maintenance with predictive scheduling"""
    __tablename__ = "emergency_device_maintenance"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("emergency_device_enhanced.id"), nullable=False)
    
    # Maintenance details
    maintenance_type = Column(SmallInteger, nullable=False)  # MaintenanceType enum
    description = Column(Text, nullable=False)
    priority = Column(SmallInteger, default=1)  # 1=Low,2=Normal,3=High,4=Urgent
    
    # Scheduling
    scheduled_date = Column(DateTime(timezone=True), nullable=False)
    estimated_duration = Column(Integer, default=60)  # Duration in minutes
    actual_duration = Column(Integer)  # Actual duration in minutes
    
    # Status tracking
    status = Column(String(20), default="SCHEDULED")  # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, DELAYED
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Personnel
    technician = Column(String(100))
    technician_id = Column(Integer, ForeignKey("personnel_employee.id"))
    supervisor = Column(String(100))
    supervisor_id = Column(Integer, ForeignKey("personnel_employee.id"))
    
    # Work details
    work_performed = Column(Text)  # Description of work performed
    parts_used = Column(JSONB)  # List of parts used
    tools_used = Column(JSONB)  # List of tools used
    measurements = Column(JSONB)  # Measurements taken
    
    # Cost tracking
    labor_cost = Column(Float, default=0.0)
    parts_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    cost_center = Column(String(50))
    
    # Quality control
    quality_check = Column(Boolean, default=True)
    quality_score = Column(Float, default=0.0)  # 0.0 to 1.0
    inspection_notes = Column(Text)
    approved_by = Column(Integer, ForeignKey("auth_user.id"))
    approved_time = Column(DateTime(timezone=True))
    
    # Follow-up
    next_maintenance = Column(DateTime(timezone=True))
    warranty_expiry = Column(Date)
    maintenance_interval = Column(Integer)  # Days until next maintenance
    
    # Enhanced features
    predictive_maintenance = Column(Boolean, default=False)
    ai_recommended = Column(Boolean, default=False)
    performance_impact = Column(JSONB)  # Impact on device performance
    risk_assessment = Column(JSONB)  # Risk assessment
    
    # Documentation
    work_order_id = Column(String(100))
    photos_before = Column(JSONB)  # Photos before work
    photos_after = Column(JSONB)  # Photos after work
    documentation = Column(JSONB)  # Maintenance documentation
    
    # Compliance and audit
    compliance_required = Column(Boolean, default=True)
    audit_findings = Column(JSONB)
    regulatory_compliance = Column(JSONB)
    
    # Relationships
    device = relationship("EmergencyDeviceEnhanced", back_populates="maintenance_records")
    technician_personnel = relationship("PersonnelEmployee", foreign_keys=[technician_id])
    supervisor_personnel = relationship("PersonnelEmployee", foreign_keys=[supervisor_id])
    approver = relationship("AuthUser", foreign_keys=[approved_by])

# Enhanced relationships for existing models
from app.models.biotime_models import IClockTerminal, AccDoor, MusteringEvent, AuthUser, PersonnelEmployee

# Add relationships to existing models
IClockTerminal.emergency_devices_enhanced = relationship("EmergencyDeviceEnhanced", foreign_keys="[EmergencyDeviceEnhanced.terminal_sn]", primaryjoin="IClockTerminal.sn == EmergencyDeviceEnhanced.terminal_sn")
PersonnelEmployee.maintenance_assignments = relationship("EmergencyDeviceMaintenance", foreign_keys=[EmergencyDeviceMaintenance.technician_id])
AuthUser.device_maintenance_approvals = relationship("EmergencyDeviceMaintenance", foreign_keys=[EmergencyDeviceMaintenance.approved_by])
AuthUser.panic_resolutions = relationship("EmergencyPanicLogEnhanced", foreign_keys=[EmergencyPanicLogEnhanced.resolved_by])
