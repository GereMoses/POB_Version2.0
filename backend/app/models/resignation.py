"""
Resignation Management Database Models
Supports employee resignation workflow and separation process
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum


class ResignationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ResignationType(str, enum.Enum):
    VOLUNTARY = "VOLUNTARY"
    INVOLUNTARY = "VOLUNTARY"
    RETIREMENT = "RETIREMENT"
    TERMINATION = "TERMINATION"
    CONTRACT_END = "CONTRACT_END"


class Resignation(Base):
    """Employee resignation records"""
    __tablename__ = "resignations"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    resignation_type = Column(Enum(ResignationType), nullable=False)
    status = Column(Enum(ResignationStatus), default=ResignationStatus.PENDING, index=True)
    
    # Resignation details
    resignation_date = Column(DateTime(timezone=True), nullable=False)
    last_working_day = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text, nullable=False)
    detailed_reason = Column(Text, nullable=True)
    
    # Exit process
    exit_interview_date = Column(DateTime(timezone=True), nullable=True)
    exit_interview_conducted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    exit_interview_notes = Column(Text, nullable=True)
    
    # Handover process
    handover_completed = Column(Boolean, default=False)
    handover_date = Column(DateTime(timezone=True), nullable=True)
    handover_conducted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    handover_notes = Column(Text, nullable=True)
    handover_checklist = Column(JSON, nullable=True)  # Handover checklist items
    
    # Financial clearance
    financial_clearance_completed = Column(Boolean, default=False)
    financial_clearance_date = Column(DateTime(timezone=True), nullable=True)
    financial_clearance_conducted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    financial_clearance_notes = Column(Text, nullable=True)
    
    # Asset return
    assets_returned = Column(Boolean, default=False)
    assets_return_date = Column(DateTime(timezone=True), nullable=True)
    assets_return_conducted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    assets_return_notes = Column(Text, nullable=True)
    assets_return_checklist = Column(JSON, nullable=True)  # Asset return checklist
    
    # System access
    system_access_revoked = Column(Boolean, default=False)
    system_access_revoked_date = Column(DateTime(timezone=True), nullable=True)
    system_access_revoked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    device_access_removed = Column(Boolean, default=False)  # Device access removed
    
    # Final approval
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Completion
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    personnel = relationship("Personnel", back_populates="resignations")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    exit_interviewer = relationship("User", foreign_keys=[exit_interview_conducted_by])
    handover_conductor = relationship("User", foreign_keys=[handover_conducted_by])
    financial_clearance_conductor = relationship("User", foreign_keys=[financial_clearance_conducted_by])
    assets_return_conductor = relationship("User", foreign_keys=[assets_return_conducted_by])
    system_access_revoker = relationship("User", foreign_keys=[system_access_revoked_by])
    completer = relationship("User", foreign_keys=[completed_by])
    tasks = relationship("ResignationTask", back_populates="resignation")
    documents = relationship("ResignationDocument", back_populates="resignation")
    notifications = relationship("ResignationNotification", back_populates="resignation")


class ResignationTask(Base):
    """Resignation process tasks"""
    __tablename__ = "resignation_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    resignation_id = Column(Integer, ForeignKey("resignations.id"), nullable=False, index=True)
    task_name = Column(String(100), nullable=False, index=True)
    task_type = Column(String(50), nullable=False)  # EXIT_INTERVIEW, HANDOVER, FINANCIAL, ASSET_RETURN, SYSTEM_ACCESS
    description = Column(Text, nullable=True)
    
    # Task status
    is_required = Column(Boolean, default=True, index=True)
    is_completed = Column(Boolean, default=False, index=True)
    completion_date = Column(DateTime(timezone=True), nullable=True)
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    completion_notes = Column(Text, nullable=True)
    
    # Task configuration
    checklist_items = Column(JSON, nullable=True)  # Task-specific checklist
    due_date = Column(DateTime(timezone=True), nullable=True)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    resignation = relationship("Resignation", back_populates="tasks")
    completer = relationship("User", foreign_keys=[completed_by])


class ResignationDocument(Base):
    """Resignation-related documents"""
    __tablename__ = "resignation_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    resignation_id = Column(Integer, ForeignKey("resignations.id"), nullable=False, index=True)
    document_type = Column(String(50), nullable=False, index=True)  # RESIGNATION_LETTER, EXIT_INTERVIEW, HANDOVER, CLEARANCE
    document_name = Column(String(255), nullable=False)
    document_path = Column(String(500), nullable=False)  # File storage path
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    
    # Document metadata
    description = Column(Text, nullable=True)
    is_required = Column(Boolean, default=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Verification
    is_verified = Column(Boolean, default=False)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verification_notes = Column(Text, nullable=True)
    
    # Relationships
    resignation = relationship("Resignation", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by])
    verifier = relationship("User", foreign_keys=[verified_by])


class ResignationTemplate(Base):
    """Resignation process templates"""
    __tablename__ = "resignation_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    template_name = Column(String(100), nullable=False, index=True)
    template_code = Column(String(20), unique=True, nullable=False, index=True)
    resignation_type = Column(Enum(ResignationType), nullable=False)
    
    # Template configuration
    default_tasks = Column(JSON, nullable=False)  # Default tasks for this template
    required_documents = Column(JSON, nullable=True)  # Required documents
    approval_workflow = Column(JSON, nullable=True)  # Approval workflow steps
    notification_settings = Column(JSON, nullable=True)  # Notification configuration
    
    # Template properties
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    is_default = Column(Boolean, default=False)  # Default template for resignation type
    
    # Audit
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])


class ResignationNotification(Base):
    """Resignation process notifications"""
    __tablename__ = "resignation_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    resignation_id = Column(Integer, ForeignKey("resignations.id"), nullable=False, index=True)
    notification_type = Column(String(50), nullable=False)  # CREATED, APPROVED, REJECTED, COMPLETED, TASK_ASSIGNED, TASK_COMPLETED
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Notification content
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Notification status
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Delivery
    sent_via = Column(String(20), nullable=True)  # EMAIL, SMS, IN_APP, PUSH
    sent_at = Column(DateTime(timezone=True), nullable=True)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    resignation = relationship("Resignation", back_populates="notifications")
    recipient = relationship("User", foreign_keys=[recipient_id])


# Add relationships to Personnel model
# Personnel.resignations = relationship("Resignation", back_populates="personnel")
