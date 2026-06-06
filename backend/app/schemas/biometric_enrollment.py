"""
Biometric Enrollment Pydantic Schemas
Request and response models for biometric enrollment API
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class BiometricType(str, Enum):
    FINGERPRINT = "FINGERPRINT"
    FACE = "FACE"
    PALM = "PALM"


class EnrollmentStatus(str, Enum):
    INITIATED = "INITIATED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class HandType(str, Enum):
    LEFT = "LEFT"
    RIGHT = "RIGHT"


class BiometricEnrollmentRequest(BaseModel):
    """Request to start biometric enrollment"""
    personnel_id: int = Field(..., description="Personnel ID")
    template_type: BiometricType = Field(..., description="Type of biometric template")
    device_serial: Optional[str] = Field(None, description="Device serial number")
    quality_threshold: Optional[float] = Field(70.0, ge=0.0, le=100.0, description="Minimum quality threshold")
    notes: Optional[str] = Field(None, max_length=500, description="Enrollment notes")


class FingerprintEnrollmentRequest(BaseModel):
    """Request for fingerprint enrollment"""
    personnel_id: int = Field(..., description="Personnel ID")
    device_serial: Optional[str] = Field(None, description="Device serial number")
    finger_index: int = Field(..., ge=0, le=9, description="Finger index (0-9)")
    hand: HandType = Field(..., description="Hand (LEFT/RIGHT)")
    quality_threshold: Optional[float] = Field(70.0, ge=0.0, le=100.0, description="Minimum quality threshold")
    notes: Optional[str] = Field(None, max_length=500, description="Enrollment notes")


class FaceEnrollmentRequest(BaseModel):
    """Request for face enrollment"""
    personnel_id: int = Field(..., description="Personnel ID")
    device_serial: Optional[str] = Field(None, description="Device serial number")
    quality_threshold: Optional[float] = Field(70.0, ge=0.0, le=100.0, description="Minimum quality threshold")
    notes: Optional[str] = Field(None, max_length=500, description="Enrollment notes")


class PalmEnrollmentRequest(BaseModel):
    """Request for palm vein enrollment"""
    personnel_id: int = Field(..., description="Personnel ID")
    device_serial: Optional[str] = Field(None, description="Device serial number")
    hand: HandType = Field(..., description="Hand (LEFT/RIGHT)")
    quality_threshold: Optional[float] = Field(70.0, ge=0.0, le=100.0, description="Minimum quality threshold")
    notes: Optional[str] = Field(None, max_length=500, description="Enrollment notes")


class BiometricTemplateResponse(BaseModel):
    """Biometric template response"""
    id: int
    personnel_id: int
    template_type: BiometricType
    template_quality: float
    finger_index: Optional[int] = None
    hand: Optional[HandType] = None
    device_serial: Optional[str] = None
    is_active: bool
    is_verified: bool
    verification_count: int
    enrolled_at: datetime
    updated_at: datetime
    notes: Optional[str] = None


class EnrollmentSessionResponse(BaseModel):
    """Enrollment session response"""
    id: int
    session_id: str
    personnel_id: int
    template_type: BiometricType
    device_serial: Optional[str]
    status: EnrollmentStatus
    progress_percentage: float
    current_step: Optional[str]
    templates_collected: int
    templates_required: int
    quality_threshold: float
    error_message: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    last_activity: datetime


class EnrollmentProgressResponse(BaseModel):
    """Enrollment progress response"""
    session_id: str
    status: EnrollmentStatus
    progress_percentage: float
    current_step: Optional[str]
    templates_collected: int
    templates_required: int
    quality_score: Optional[float] = None
    estimated_time_remaining: Optional[int] = None  # seconds
    next_action: Optional[str] = None


class DeviceCommandRequest(BaseModel):
    """Device command request"""
    device_serial: str = Field(..., description="Device serial number")
    command: str = Field(..., description="Command to send")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Command parameters")
    timeout_seconds: Optional[int] = Field(30, ge=1, le=300, description="Command timeout")


class DeviceCommandResponse(BaseModel):
    """Device command response"""
    command_id: str
    device_serial: str
    command: str
    status: str  # SENT, EXECUTED, FAILED, TIMEOUT
    response_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    executed_at: datetime
    response_time_ms: Optional[int] = None


class BiometricVerificationRequest(BaseModel):
    """Biometric verification request"""
    personnel_id: Optional[int] = Field(None, description="Personnel ID (if known)")
    template_data: Optional[str] = Field(None, description="Template data for verification")
    template_type: BiometricType = Field(..., description="Type of biometric verification")
    device_serial: str = Field(..., description="Device serial number")
    verification_method: Optional[str] = Field(None, description="Verification method")
    location: Optional[str] = Field(None, description="Verification location")
    purpose: Optional[str] = Field("ACCESS", description="Verification purpose")


class BiometricVerificationResponse(BaseModel):
    """Biometric verification response"""
    verification_id: int
    personnel_id: Optional[int]
    is_successful: bool
    confidence_score: Optional[float]
    response_time_ms: Optional[int]
    template_used: Optional[int]
    error_code: Optional[str]
    error_message: Optional[str]
    verified_at: datetime


class DeviceStatusResponse(BaseModel):
    """Device status response"""
    device_serial: str
    device_name: str
    device_type: str
    manufacturer: str
    model: str
    firmware_version: Optional[str]
    ip_address: Optional[str]
    port: Optional[int]
    is_online: bool
    is_active: bool
    last_heartbeat: Optional[datetime]
    supported_templates: List[str]
    max_templates_per_user: int
    enrollment_quality_threshold: float
    configuration: Optional[Dict[str, Any]]


class EnrollmentStatisticsResponse(BaseModel):
    """Enrollment statistics response"""
    total_personnel: int
    enrolled_personnel: int
    fingerprint_templates: int
    face_templates: int
    palm_templates: int
    active_sessions: int
    completed_sessions_today: int
    failed_sessions_today: int
    average_enrollment_time: Optional[float]  # minutes
    quality_distribution: Dict[str, int]  # quality ranges


class BulkEnrollmentRequest(BaseModel):
    """Bulk enrollment request for multiple personnel"""
    personnel_ids: List[int] = Field(..., max_items=50, description="List of personnel IDs")
    template_type: BiometricType = Field(..., description="Type of biometric template")
    device_serial: Optional[str] = Field(None, description="Device serial number")
    quality_threshold: Optional[float] = Field(70.0, ge=0.0, le=100.0, description="Minimum quality threshold")
    notes: Optional[str] = Field(None, max_length=500, description="Bulk enrollment notes")


class BulkEnrollmentResponse(BaseModel):
    """Bulk enrollment response"""
    bulk_session_id: str
    total_personnel: int
    successful_enrollments: int
    failed_enrollments: int
    enrollment_results: List[EnrollmentSessionResponse]
    started_at: datetime
    estimated_completion_time: Optional[datetime]


class DeviceConfigurationRequest(BaseModel):
    """Device configuration request"""
    device_serial: str = Field(..., description="Device serial number")
    configuration: Dict[str, Any] = Field(..., description="Device configuration parameters")
    restart_device: Optional[bool] = Field(False, description="Restart device after configuration")


class DeviceConfigurationResponse(BaseModel):
    """Device configuration response"""
    device_serial: str
    configuration_status: str  # APPLIED, FAILED, PENDING
    previous_configuration: Optional[Dict[str, Any]]
    new_configuration: Dict[str, Any]
    applied_at: Optional[datetime]
    error_message: Optional[str]
