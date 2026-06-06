"""
Onboarding Management Database Models
Supports employee onboarding workflow and process management
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum


class OnboardingStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class OnboardingType(str, enum.Enum):
    NEW_HIRE = "NEW_HIRE"
    REHIRE = "REHIRE"
    INTERNAL_TRANSFER = "INTERNAL_TRANSFER"
    PROMOTION = "PROMOTION"
    CONTRACT_RENEWAL = "CONTRACT_RENEWAL"


class TaskType(str, enum.Enum):
    DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD"
    TRAINING = "TRAINING"
    REVIEW = "REVIEW"
    APPROVAL = "APPROVAL"
    BACKGROUND_CHECK = "BACKGROUND_CHECK"
    MEDICAL_CHECK = "MEDICAL_CHECK"
    ASSET_RETURN = "ASSET_RETURN"
    SYSTEM_ACCESS = "SYSTEM_ACCESS"


class TaskPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Onboarding(Base):
    """Employee onboarding records"""
    __tablename__ = "onboardings"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    onboarding_type = Column(Enum(OnboardingType), nullable=False)
    status = Column(Enum(OnboardingStatus), default=OnboardingStatus.NOT_STARTED, index=True)
    
    # Timeline
    start_date = Column(DateTime(timezone=True), nullable=False)
    planned_end_date = Column(DateTime(timezone=True), nullable=False)
    actual_end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Onboarding details
    job_title = Column(String(200), nullable=False)
    job_description = Column(Text, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    reporting_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    buddy_id = Column(Integer, ForeignKey("personnel.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Template and configuration
    template_id = Column(Integer, ForeignKey("onboarding_templates.id"), nullable=True)
    template_data = Column(JSON, nullable=True)  # Template configuration
    custom_fields = Column(JSON, nullable=True)  # Custom field overrides
    
    # Progress tracking
    completion_percentage = Column(Float, default=0.0)
    last_progress_update = Column(DateTime(timezone=True), nullable=True)
    
    # Approval workflow
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Completion
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    exit_interview_date = Column(DateTime(timezone=True), nullable=True)
    exit_interview_conducted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    personnel = relationship("Personnel", foreign_keys="[Onboarding.personnel_id]")
    department = relationship("Department", foreign_keys="[Onboarding.department_id]")
    position = relationship("Position", foreign_keys="[Onboarding.position_id]")
    template = relationship("OnboardingTemplate", back_populates="onboardings")
    reporting_to_user = relationship("User", foreign_keys="[Onboarding.reporting_to]")
    buddy = relationship("Personnel", foreign_keys="[Onboarding.buddy_id]")
    manager = relationship("User", foreign_keys="[Onboarding.manager_id]")
    reviewer = relationship("User", foreign_keys="[Onboarding.reviewed_by]")
    approver = relationship("User", foreign_keys="[Onboarding.approved_by]")
    completer = relationship("User", foreign_keys="[Onboarding.completed_by]")
    exit_interviewer = relationship("User", foreign_keys="[Onboarding.exit_interview_conducted_by]")

    # Task relationships
    tasks = relationship("OnboardingTask", back_populates="onboarding")
    documents = relationship("OnboardingDocument", back_populates="onboarding")
    notifications = relationship("OnboardingNotification", back_populates="onboarding")
    checklists = relationship("OnboardingChecklist", back_populates="onboarding")


class OnboardingTask(Base):
    """Onboarding tasks"""
    __tablename__ = "onboarding_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    onboarding_id = Column(Integer, ForeignKey("onboardings.id"), nullable=False, index=True)
    task_name = Column(String(100), nullable=False, index=True)
    task_type = Column(Enum(TaskType), nullable=False)
    description = Column(Text, nullable=True)
    
    # Task configuration
    is_required = Column(Boolean, default=True, index=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    
    # Status tracking
    status = Column(String(20), default="PENDING", index=True)
    completion_date = Column(DateTime(timezone=True), nullable=True)
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    completion_notes = Column(Text, nullable=True)
    
    # Checklist items
    checklist_items = Column(JSON, nullable=True)  # Task-specific checklist
    completed_items = Column(JSON, nullable=True)
    
    # Dependencies
    depends_on_tasks = Column(JSON, nullable=True)  # Tasks that must be completed first
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    onboarding = relationship("Onboarding", back_populates="tasks")
    creator = relationship("User", foreign_keys=[created_by])
    completer = relationship("User", foreign_keys=[completed_by])


class OnboardingDocument(Base):
    """Onboarding documents"""
    __tablename__ = "onboarding_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    onboarding_id = Column(Integer, ForeignKey("onboardings.id"), nullable=False, index=True)
    document_type = Column(String(50), nullable=False, index=True)
    document_name = Column(String(255), nullable=False)
    document_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    
    # Document metadata
    is_required = Column(Boolean, default=True, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Verification
    is_verified = Column(Boolean, default=False)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verification_notes = Column(Text, nullable=True)
    
    # Relationships
    onboarding = relationship("Onboarding", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by])
    verifier = relationship("User", foreign_keys=[verified_by])


class OnboardingTemplate(Base):
    """Onboarding process templates"""
    __tablename__ = "onboarding_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    template_name = Column(String(100), nullable=False, index=True)
    template_code = Column(String(50), unique=True, nullable=False, index=True)
    onboarding_type = Column(Enum(OnboardingType), nullable=False)
    description = Column(Text, nullable=True)
    
    # Template configuration
    default_tasks = Column(JSON, nullable=False)  # Default tasks for this template
    required_documents = Column(JSON, nullable=True)  # Required documents
    approval_workflow = Column(JSON, nullable=True)  # Approval workflow steps
    
    # Timeline configuration
    default_duration_days = Column(Integer, default=30)  # Default onboarding duration
    reminder_settings = Column(JSON, nullable=True)  # Reminder configuration
    
    # Template properties
    is_active = Column(Boolean, default=True, index=True)
    is_default = Column(Boolean, default=False)  # Default template for type
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime(timezone=True), nullable=True)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    onboardings = relationship("Onboarding", back_populates="template")


class OnboardingNotification(Base):
    """Onboarding process notifications"""
    __tablename__ = "onboarding_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    onboarding_id = Column(Integer, ForeignKey("onboardings.id"), nullable=False, index=True)
    notification_type = Column(String(50), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Notification content
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Status
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Delivery
    sent_via = Column(String(20), nullable=True)  # EMAIL, SMS, IN_APP, PUSH
    sent_at = Column(DateTime(timezone=True), nullable=True)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    onboarding = relationship("Onboarding", back_populates="notifications")
    recipient = relationship("User", foreign_keys=[recipient_id])


class OnboardingChecklist(Base):
    """Onboarding checklist items"""
    __tablename__ = "onboarding_checklists"
    
    id = Column(Integer, primary_key=True, index=True)
    onboarding_id = Column(Integer, ForeignKey("onboardings.id"), nullable=False, index=True)
    checklist_name = Column(String(100), nullable=False, index=True)
    checklist_type = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Checklist configuration
    is_required = Column(Boolean, default=True, index=True)
    checklist_items = Column(JSON, nullable=True)  # Checklist items configuration
    sort_order = Column(Integer, default=0)
    
    # Status
    is_completed = Column(Boolean, default=False, index=True)
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completion_notes = Column(Text, nullable=True)
    
    # Dependencies
    depends_on_tasks = Column(JSON, nullable=True)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    onboarding = relationship("Onboarding", back_populates="checklists")
    creator = relationship("User", foreign_keys=[created_by])
    completer = relationship("User", foreign_keys=[completed_by])


# Add relationships to Personnel model
# Personnel.onboardings = relationship("Onboarding", back_populates="tasks")
# Personnel.custom_field_values = relationship("CustomAttributeValue", back_populates="onboarding")
# Personnel.onboarding_documents = relationship("OnboardingDocument", back_populates="onboarding")
