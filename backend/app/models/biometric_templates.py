"""
Biometric Templates Database Models
Supports fingerprint, face, and palm vein biometric data storage
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class BiometricTemplate(Base):
    """Biometric templates for personnel"""
    __tablename__ = "biometric_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    template_type = Column(String(20), nullable=False, index=True)  # FINGERPRINT, FACE, PALM
    template_data = Column(Text, nullable=False)  # Encrypted biometric template
    template_quality = Column(Float, default=0.0)  # Quality score 0-100
    finger_index = Column(Integer, nullable=True)  # For fingerprints: 0-9
    hand = Column(String(10), nullable=True)  # LEFT, RIGHT for fingerprints
    device_serial = Column(String(50), nullable=True)  # Device used for enrollment
    enrollment_method = Column(String(20), nullable=True)  # ENROLLMENT, VERIFICATION
    
    # Status tracking
    is_active = Column(Boolean, default=True, index=True)
    is_verified = Column(Boolean, default=False)
    verification_count = Column(Integer, default=0)
    last_used = Column(DateTime(timezone=True), nullable=True)
    
    # Audit trail
    enrolled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    personnel = relationship("Personnel", back_populates="biometric_templates")
    enroller = relationship("User", foreign_keys=[enrolled_by])


class BiometricEnrollmentSession(Base):
    """Biometric enrollment sessions for tracking enrollment process"""
    __tablename__ = "biometric_enrollment_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    template_type = Column(String(20), nullable=False)  # FINGERPRINT, FACE, PALM
    device_serial = Column(String(50), nullable=True)
    
    # Session status
    status = Column(String(20), default="INITIATED")  # INITIATED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
    progress_percentage = Column(Float, default=0.0)
    current_step = Column(String(50), nullable=True)
    
    # Enrollment data
    templates_collected = Column(Integer, default=0)
    templates_required = Column(Integer, default=1)  # Usually 1 for face/palm, multiple for fingerprints
    quality_threshold = Column(Float, default=70.0)  # Minimum quality score
    
    # Error handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    personnel = relationship("Personnel")
    # templates relationship disabled — no direct FK between BiometricTemplate and BiometricEnrollmentSession


class BiometricDevice(Base):
    """Biometric device management"""
    __tablename__ = "biometric_devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_serial = Column(String(50), unique=True, nullable=False, index=True)
    device_name = Column(String(100), nullable=False)
    device_type = Column(String(20), nullable=False)  # FINGERPRINT, FACE, MULTIMODAL
    manufacturer = Column(String(50), nullable=True)  # ZKTeco, Suprema, etc.
    model = Column(String(50), nullable=True)
    firmware_version = Column(String(20), nullable=True)
    
    # Network configuration
    ip_address = Column(String(15), nullable=True, index=True)
    port = Column(Integer, nullable=True)
    communication_key = Column(String(50), nullable=True)
    
    # Capabilities
    supported_templates = Column(JSON, nullable=True)  # ["FINGERPRINT", "FACE", "PALM"]
    max_templates_per_user = Column(Integer, default=10)
    enrollment_quality_threshold = Column(Float, default=70.0)
    
    # Status
    is_online = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)
    
    # Configuration
    configuration = Column(JSON, nullable=True)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_sync = Column(DateTime(timezone=True), nullable=True)


class BiometricVerificationLog(Base):
    """Biometric verification logs for audit trail"""
    __tablename__ = "biometric_verification_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    template_type = Column(String(20), nullable=False)
    device_serial = Column(String(50), nullable=True)
    
    # Verification result
    is_successful = Column(Boolean, nullable=False)
    confidence_score = Column(Float, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    
    # Verification details
    verification_method = Column(String(20), nullable=True)  # 1:N, 1:1, etc.
    template_used = Column(Integer, ForeignKey("biometric_templates.id"), nullable=True)
    
    # Error handling
    error_code = Column(String(20), nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Location/Context
    location = Column(String(100), nullable=True)
    purpose = Column(String(50), nullable=True)  # ACCESS, ATTENDANCE, ENROLLMENT
    
    # Timestamps
    verified_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    personnel = relationship("Personnel")
    template = relationship("BiometricTemplate")


# Update Personnel model to include biometric templates relationship
# This should be added to the existing Personnel model
# biometric_templates = relationship("BiometricTemplate", back_populates="personnel")

# enrollment_session relationship removed — BiometricTemplate has no FK to biometric_enrollment_sessions
