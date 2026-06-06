"""
Certification Models for Oil & Gas Personnel Management
Handles certification tracking, compliance, and industry standards
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum


class CertificationType(str, enum.Enum):
    OPITO = "OPITO"
    NOPSEMA = "NOPSEMA"
    COMPANY = "COMPANY"
    OTHER = "OTHER"


class CertificationStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    SUSPENDED = "suspended"
    REVOKED = "revoked"


class Certification(Base):
    __tablename__ = "certifications"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    
    # Certification Details
    name = Column(String(255), nullable=False, index=True)
    certification_type = Column(Enum(CertificationType), default=CertificationType.COMPANY)
    issuer = Column(String(255), nullable=False, index=True)
    certificate_number = Column(String(100), unique=True, nullable=False, index=True)
    
    # Dates
    issue_date = Column(DateTime(timezone=True), nullable=False)
    expire_date = Column(DateTime(timezone=True), nullable=False, index=True)
    verified_date = Column(DateTime(timezone=True), nullable=True)
    
    # Status and Verification
    status = Column(Enum(CertificationStatus), default=CertificationStatus.ACTIVE)
    verified = Column(Boolean, default=False)
    verification_data = Column(Text, nullable=True)
    
    # Additional Information
    description = Column(Text, nullable=True)
    requirements = Column(Text, nullable=True)
    training_provider = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    
    # File Attachments
    certificate_file = Column(String(500), nullable=True)
    verification_file = Column(String(500), nullable=True)
    
    # Metadata
    notes = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    # personnel = relationship("Personnel", back_populates="certifications")  # Temporarily commented out
    
    def __repr__(self):
        return f"<Certification(id={self.id}, name='{self.name}', personnel_id={self.personnel_id})>"


class CertificationTemplate(Base):
    __tablename__ = "certification_templates"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    
    # Template Details
    name = Column(String(255), nullable=False, unique=True)
    certification_type = Column(Enum(CertificationType), nullable=False)
    issuer = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Validity Period
    validity_days = Column(Integer, nullable=False, default=365)
    renewal_required = Column(Boolean, default=True)
    
    # Requirements
    requirements = Column(Text, nullable=True)
    prerequisites = Column(Text, nullable=True)
    
    # Applicability
    personnel_types = Column(String(100), nullable=True)  # STAFF,CONTRACTOR,VISITOR
    roles = Column(String(500), nullable=True)  # Comma-separated list of roles
    locations = Column(String(500), nullable=True)  # Comma-separated list of locations
    
    # Compliance Settings
    is_mandatory = Column(Boolean, default=False)
    compliance_weight = Column(Integer, default=1)  # Weight in compliance scoring
    
    # Notification Settings
    expiry_notification_days = Column(Integer, default=30)
    renewal_notification_days = Column(Integer, default=60)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<CertificationTemplate(id={self.id}, name='{self.name}', type='{self.certification_type}')>"


class CertificationAudit(Base):
    __tablename__ = "certification_audits"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    certification_id = Column(Integer, ForeignKey("certifications.id"), nullable=False)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    
    # Audit Details
    action = Column(String(50), nullable=False)  # CREATED, UPDATED, EXPIRED, VERIFIED, REVOKED
    old_values = Column(Text, nullable=True)
    new_values = Column(Text, nullable=True)
    
    # User Information
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    performed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Additional Information
    reason = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Relationships
    certification = relationship("Certification")
    personnel = relationship("Personnel")
    
    def __repr__(self):
        return f"<CertificationAudit(id={self.id}, action='{self.action}', certification_id={self.certification_id})>"
