"""
Vendor/Contractor Management Database Models
Supports vendor and contractor management for personnel operations
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum


class VendorType(str, enum.Enum):
    SERVICE_PROVIDER = "SERVICE_PROVIDER"
    EQUIPMENT_SUPPLIER = "EQUIPMENT_SUPPLIER"
    CONSULTING_FIRM = "CONSULTING_FIRM"
    STAFFING_AGENCY = "STAFFING_AGENCY"
    TRAINING_PROVIDER = "TRAINING_PROVIDER"
    SOFTWARE_VENDOR = "SOFTWARE_VENDOR"
    MAINTENANCE_PROVIDER = "MAINTENANCE_PROVIDER"


class VendorStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    UNDER_REVIEW = "UNDER_REVIEW"
    BLACKLISTED = "BLACKLISTED"


class ComplianceStatus(str, enum.Enum):
    COMPLIANT = "COMPLIANT"
    PENDING_REVIEW = "PENDING_REVIEW"
    NON_COMPLIANT = "NON_COMPLIANT"
    EXPIRED = "EXPIRED"
    SUSPENDED = "SUSPENDED"


class ContractStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    TERMINATED = "TERMINATED"
    RENEWAL_PENDING = "RENEWAL_PENDING"
    SUSPENDED = "SUSPENDED"


class Vendor(Base):
    """Vendor information"""
    __tablename__ = "vendors"
    
    id = Column(Integer, primary_key=True, index=True)
    vendor_code = Column(String(50), unique=True, nullable=False, index=True)
    vendor_name = Column(String(200), nullable=False, index=True)
    vendor_type = Column(Enum(VendorType), nullable=False, index=True)
    status = Column(Enum(VendorStatus), default=VendorStatus.ACTIVE, index=True)
    
    # Contact information
    contact_person = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    mobile = Column(String(20), nullable=True)
    fax = Column(String(20), nullable=True)
    
    # Address
    address_line1 = Column(String(200), nullable=True)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    
    # Business information
    business_registration = Column(String(100), nullable=True)
    tax_id = Column(String(50), nullable=True)
    website = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    
    # Services and capabilities
    services_offered = Column(JSON, nullable=True)  # List of services
    service_areas = Column(JSON, nullable=True)  # Geographic coverage
    certifications = Column(JSON, nullable=True)  # Vendor certifications
    
    # Financial information
    payment_terms = Column(String(100), nullable=True)
    credit_limit = Column(Float, nullable=True)
    currency = Column(String(3), default="USD")
    
    # Compliance and risk
    compliance_status = Column(Enum(ComplianceStatus), default=ComplianceStatus.PENDING_REVIEW)
    last_compliance_check = Column(DateTime(timezone=True), nullable=True)
    next_compliance_due = Column(DateTime(timezone=True), nullable=True)
    risk_rating = Column(String(10), nullable=True)  # LOW, MEDIUM, HIGH, CRITICAL
    
    # Performance metrics
    performance_score = Column(Float, default=0.0)
    total_contracts = Column(Integer, default=0)
    active_contracts = Column(Integer, default=0)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    contracts = relationship("VendorContract", back_populates="vendor")
    contractors = relationship("Contractor", back_populates="vendor")
    compliance_records = relationship("VendorCompliance", back_populates="vendor")


class VendorContract(Base):
    """Vendor contracts"""
    __tablename__ = "vendor_contracts"
    
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    contract_number = Column(String(50), unique=True, nullable=False, index=True)
    contract_name = Column(String(200), nullable=False)
    contract_type = Column(String(50), nullable=False)  # SERVICE, SUPPLY, MAINTENANCE, etc.
    status = Column(Enum(ContractStatus), default=ContractStatus.DRAFT, index=True)
    
    # Contract dates
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    renewal_date = Column(DateTime(timezone=True), nullable=True)
    notice_period_days = Column(Integer, default=30)
    
    # Financial terms
    total_value = Column(Float, nullable=True)
    currency = Column(String(3), default="USD")
    payment_terms = Column(String(100), nullable=True)
    billing_frequency = Column(String(20), nullable=True)  # MONTHLY, QUARTERLY, ANNUALLY
    
    # Service level agreement
    sla_requirements = Column(JSON, nullable=True)  # SLA specifications
    penalty_clauses = Column(JSON, nullable=True)  # Penalty for non-compliance
    
    # Scope and deliverables
    scope_of_work = Column(Text, nullable=True)
    deliverables = Column(JSON, nullable=True)  # List of deliverables
    key_performance_indicators = Column(JSON, nullable=True)
    
    # Contract management
    contract_manager = Column(Integer, ForeignKey("users.id"), nullable=True)
    legal_reviewer = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Performance tracking
    performance_score = Column(Float, default=0.0)
    compliance_score = Column(Float, default=0.0)
    last_performance_review = Column(DateTime(timezone=True), nullable=True)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    vendor = relationship("Vendor", back_populates="contracts")
    contract_manager_user = relationship("User", foreign_keys=[contract_manager])
    legal_reviewer_user = relationship("User", foreign_keys=[legal_reviewer])
    approver_user = relationship("User", foreign_keys=[approved_by])
    contract_assignments = relationship("ContractAssignment", back_populates="contract")


class Contractor(Base):
    """Contractor information"""
    __tablename__ = "contractors"
    
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True, index=True)
    contractor_code = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    
    # Personal information
    date_of_birth = Column(DateTime(timezone=True), nullable=True)
    national_id = Column(String(50), nullable=True)
    passport_number = Column(String(50), nullable=True)
    work_permit_number = Column(String(50), nullable=True)
    work_permit_expiry = Column(DateTime(timezone=True), nullable=True)
    
    # Professional information
    job_title = Column(String(100), nullable=True)
    specialization = Column(String(100), nullable=True)
    experience_years = Column(Integer, default=0)
    hourly_rate = Column(Float, nullable=True)
    daily_rate = Column(Float, nullable=True)
    currency = Column(String(3), default="USD")
    
    # Skills and certifications
    skills = Column(JSON, nullable=True)  # List of skills
    certifications = Column(JSON, nullable=True)  # Professional certifications
    security_clearance = Column(String(50), nullable=True)
    
    # Status and availability
    status = Column(String(20), default="ACTIVE", index=True)
    availability_status = Column(String(20), default="AVAILABLE")  # AVAILABLE, ON_ASSIGNMENT, UNAVAILABLE
    preferred_work_locations = Column(JSON, nullable=True)
    
    # Compliance and background
    background_check_status = Column(String(20), default="PENDING")
    background_check_date = Column(DateTime(timezone=True), nullable=True)
    medical_clearance_status = Column(String(20), default="PENDING")
    medical_clearance_date = Column(DateTime(timezone=True), nullable=True)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    vendor = relationship("Vendor", back_populates="contractors")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    assignments = relationship("ContractAssignment", back_populates="contractor")
    compliance_records = relationship("ContractorCompliance", back_populates="contractor")


class ContractAssignment(Base):
    """Contractor assignments to projects/personnel"""
    __tablename__ = "contract_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("vendor_contracts.id"), nullable=False, index=True)
    contractor_id = Column(Integer, ForeignKey("contractors.id"), nullable=False, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=True, index=True)
    
    # Assignment details
    project_name = Column(String(200), nullable=True)
    project_code = Column(String(50), nullable=True)
    role = Column(String(100), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # Assignment dates
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)
    actual_end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Financial details
    hourly_rate = Column(Float, nullable=True)
    daily_rate = Column(Float, nullable=True)
    overtime_rate = Column(Float, nullable=True)
    currency = Column(String(3), default="USD")
    
    # Status tracking
    status = Column(String(20), default="ACTIVE", index=True)
    performance_rating = Column(String(10), nullable=True)  # EXCELLENT, GOOD, AVERAGE, POOR
    completion_status = Column(String(20), default="IN_PROGRESS")  # IN_PROGRESS, COMPLETED, TERMINATED
    
    # Assignment management
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    contract = relationship("VendorContract")
    contractor = relationship("Contractor")
    personnel = relationship("Personnel")
    department = relationship("Department")
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])
    supervisor_user = relationship("User", foreign_keys=[supervisor_id])
    approver_user = relationship("User", foreign_keys=[approved_by])


class VendorCompliance(Base):
    """Vendor compliance records"""
    __tablename__ = "vendor_compliance"
    
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    compliance_type = Column(String(50), nullable=False)  # FINANCIAL, LEGAL, SAFETY, QUALITY
    compliance_status = Column(Enum(ComplianceStatus), nullable=False, index=True)
    
    # Compliance details
    compliance_date = Column(DateTime(timezone=True), nullable=False)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    certifying_authority = Column(String(100), nullable=True)
    certificate_number = Column(String(100), nullable=True)
    
    # Assessment details
    assessment_score = Column(Float, nullable=True)
    assessment_notes = Column(Text, nullable=True)
    corrective_actions = Column(JSON, nullable=True)  # Required corrective actions
    follow_up_date = Column(DateTime(timezone=True), nullable=True)
    
    # Documents
    certificate_path = Column(String(500), nullable=True)
    supporting_documents = Column(JSON, nullable=True)
    
    # Audit trail
    assessed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    vendor = relationship("Vendor", back_populates="compliance_records")
    assessor = relationship("User", foreign_keys=[assessed_by])


class ContractorCompliance(Base):
    """Contractor compliance records"""
    __tablename__ = "contractor_compliance"
    
    id = Column(Integer, primary_key=True, index=True)
    contractor_id = Column(Integer, ForeignKey("contractors.id"), nullable=False, index=True)
    compliance_type = Column(String(50), nullable=False)  # BACKGROUND, MEDICAL, SECURITY, TRAINING
    compliance_status = Column(Enum(ComplianceStatus), nullable=False, index=True)
    
    # Compliance details
    compliance_date = Column(DateTime(timezone=True), nullable=False)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    certifying_authority = Column(String(100), nullable=True)
    certificate_number = Column(String(100), nullable=True)
    
    # Assessment details
    assessment_score = Column(Float, nullable=True)
    assessment_notes = Column(Text, nullable=True)
    requirements_met = Column(JSON, nullable=True)  # List of requirements and status
    next_review_date = Column(DateTime(timezone=True), nullable=True)
    
    # Documents
    certificate_path = Column(String(500), nullable=True)
    supporting_documents = Column(JSON, nullable=True)
    
    # Audit trail
    assessed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    contractor = relationship("Contractor", back_populates="compliance_records")
    assessor = relationship("User", foreign_keys=[assessed_by])


# Add relationship to Personnel model
# Personnel.contract_assignments = relationship("ContractAssignment", back_populates="personnel")
