"""
MTD (Medical, Training, Development) Models
POB Version 2.0 - HSE Compliance Module
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, Date, Numeric, SmallInteger, BigInteger, ForeignKey, ARRAY, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import INTERVAL
from ..core.database import Base


class MTDMedicalRecord(Base):
    """Medical Records for Employees and Visitors"""
    __tablename__ = "mtd_medical_record"
    
    id = Column(BigInteger, primary_key=True)
    person_type = Column(SmallInteger, nullable=False)  # 0=employee,1=visitor
    emp_id = Column(Integer, ForeignKey("personnel_employee.id", ondelete="CASCADE"))
    visitor_id = Column(BigInteger, ForeignKey("vis_visitor.id", ondelete="CASCADE"))
    blood_group = Column(String(3))
    height_cm = Column(Integer)
    weight_kg = Column(Numeric(5, 2))
    bmi = Column(Numeric(4, 2), nullable=True)
    medical_conditions = Column(Text)
    allergies = Column(Text)
    disabilities = Column(Text)
    fit_status = Column(SmallInteger, default=0)  # 0=fit,1=restricted,2=unfit
    restrictions = Column(Text)
    doctor_name = Column(String(100))
    last_checkup = Column(Date)
    next_due = Column(Date)
    cert_path = Column(String(255))
    updated_by = Column(Integer, ForeignKey("auth_user.id"))
    updated_time = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    employee = relationship("PersonnelEmployee", foreign_keys=[emp_id])
    visitor = relationship("Visitor", foreign_keys=[visitor_id])
    updater = relationship("AuthUser", foreign_keys=[updated_by])
    
    @property
    def fit_status_text(self) -> str:
        status_map = {0: "Fit", 1: "Restricted", 2: "Unfit"}
        return status_map.get(self.fit_status, "Unknown")
    
    @property
    def is_expired(self) -> bool:
        if self.next_due:
            return self.next_due < date.today()
        return False
    
    @property
    def days_to_expiry(self) -> Optional[int]:
        if self.next_due:
            delta = self.next_due - date.today()
            return delta.days
        return None


class MTDCertType(Base):
    """Certification Types"""
    __tablename__ = "mtd_cert_type"
    
    id = Column(Integer, primary_key=True)
    cert_name = Column(String(100), nullable=False, unique=True)
    validity_days = Column(Integer, nullable=False)
    is_critical = Column(Boolean, default=False)
    required_for_dept = Column(ARRAY(Integer))
    required_for_position = Column(ARRAY(Integer))
    required_for_vendor = Column(ARRAY(Integer))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    certifications = relationship("MTDCertification", back_populates="cert_type")


class MTDCertification(Base):
    """Personnel Certifications"""
    __tablename__ = "mtd_certification"
    
    id = Column(BigInteger, primary_key=True)
    person_type = Column(SmallInteger, nullable=False)  # 0=employee,1=visitor
    emp_id = Column(Integer, ForeignKey("personnel_employee.id", ondelete="CASCADE"))
    visitor_id = Column(BigInteger, ForeignKey("vis_visitor.id", ondelete="CASCADE"))
    cert_type_id = Column(Integer, ForeignKey("mtd_cert_type.id"), nullable=False)
    cert_no = Column(String(100))
    issuer = Column(String(100))
    issue_date = Column(Date, nullable=False)
    expiry_date = Column(Date)  # Will be calculated automatically
    cert_path = Column(String(255))
    status = Column(SmallInteger, default=0)  # 0=valid,1=expiring,2=expired
    verified_by = Column(Integer, ForeignKey("auth_user.id"))
    verified_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    employee = relationship("PersonnelEmployee", foreign_keys=[emp_id])
    visitor = relationship("Visitor", foreign_keys=[visitor_id])
    cert_type = relationship("MTDCertType", back_populates="certifications")
    verifier = relationship("AuthUser", foreign_keys=[verified_by])
    
    @property
    def status_text(self) -> str:
        status_map = {0: "Valid", 1: "Expiring", 2: "Expired"}
        return status_map.get(self.status, "Unknown")
    
    @property
    def is_expired(self) -> bool:
        if self.expiry_date:
            return self.expiry_date < date.today()
        return False
    
    @property
    def days_to_expiry(self) -> Optional[int]:
        if self.expiry_date:
            delta = self.expiry_date - date.today()
            return delta.days
        return None


class MTDPPEType(Base):
    """PPE Types"""
    __tablename__ = "mtd_ppe_type"
    
    id = Column(Integer, primary_key=True)
    ppe_name = Column(String(100), nullable=False)
    lifespan_days = Column(Integer)
    requires_calibration = Column(Boolean, default=False)
    calib_interval_days = Column(Integer)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    issues = relationship("MTDPPEIssue", back_populates="ppe_type")


class MTDPPEIssue(Base):
    """PPE Issue Records"""
    __tablename__ = "mtd_ppe_issue"
    
    id = Column(BigInteger, primary_key=True)
    emp_id = Column(Integer, ForeignKey("personnel_employee.id", ondelete="CASCADE"), nullable=False)
    ppe_type_id = Column(Integer, ForeignKey("mtd_ppe_type.id"), nullable=False)
    serial_no = Column(String(100))
    issue_date = Column(Date, default=date.today)
    due_return_date = Column(Date)
    return_date = Column(Date)
    condition_out = Column(SmallInteger)  # 0=new,1=good,2=fair
    condition_in = Column(SmallInteger)
    last_calib_date = Column(Date)
    next_calib_date = Column(Date)
    status = Column(SmallInteger, default=0)  # 0=issued,1=returned,2=lost,3=expired
    notes = Column(Text)
    issued_by = Column(Integer, ForeignKey("auth_user.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    employee = relationship("PersonnelEmployee", foreign_keys=[emp_id])
    ppe_type = relationship("MTDPPEType", back_populates="issues")
    issuer = relationship("AuthUser", foreign_keys=[issued_by])
    
    @property
    def status_text(self) -> str:
        status_map = {0: "Issued", 1: "Returned", 2: "Lost", 3: "Expired"}
        return status_map.get(self.status, "Unknown")
    
    @property
    def condition_text(self) -> str:
        condition_map = {0: "New", 1: "Good", 2: "Fair"}
        return condition_map.get(self.condition_out, "Unknown")
    
    @property
    def is_overdue(self) -> bool:
        if self.due_return_date and self.status == 0:  # Still issued
            return self.due_return_date < date.today()
        return False
    
    @property
    def calibration_due(self) -> bool:
        if self.next_calib_date:
            return self.next_calib_date <= date.today()
        return False


class MTDInductionTemplate(Base):
    """Induction Templates"""
    __tablename__ = "mtd_induction_template"
    
    id = Column(Integer, primary_key=True)
    template_name = Column(String(100), nullable=False)
    video_path = Column(String(255))
    slides_path = Column(String(255))
    quiz_questions = Column(JSON)  # [{q:"", a:[], correct:0}]
    passing_score = Column(Integer, default=80)
    validity_days = Column(Integer, default=365)
    required_for_type = Column(SmallInteger)  # 0=employee,1=contractor,2=visitor
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    records = relationship("MTDInductionRecord", back_populates="template")


class MTDInductionRecord(Base):
    """Induction Completion Records"""
    __tablename__ = "mtd_induction_record"
    
    id = Column(BigInteger, primary_key=True)
    person_type = Column(SmallInteger, nullable=False)  # 0=employee,1=visitor
    emp_id = Column(Integer, ForeignKey("personnel_employee.id", ondelete="CASCADE"))
    visitor_id = Column(BigInteger, ForeignKey("vis_visitor.id", ondelete="CASCADE"))
    template_id = Column(Integer, ForeignKey("mtd_induction_template.id"), nullable=False)
    taken_date = Column(Date, default=date.today)
    score = Column(Integer)
    passed = Column(Boolean)
    valid_until = Column(Date)  # Will be calculated automatically
    signed_doc = Column(String(255))
    trainer_emp_id = Column(Integer, ForeignKey("personnel_employee.id"))
    quiz_answers = Column(JSON)  # Store answers for audit
    completion_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    employee = relationship("PersonnelEmployee", foreign_keys=[emp_id])
    visitor = relationship("Visitor", foreign_keys=[visitor_id])
    template = relationship("MTDInductionTemplate", back_populates="records")
    trainer = relationship("PersonnelEmployee", foreign_keys=[trainer_emp_id])
    
    @property
    def is_valid(self) -> bool:
        if self.valid_until:
            return self.valid_until >= date.today()
        return False
    
    @property
    def days_to_expiry(self) -> Optional[int]:
        if self.valid_until:
            delta = self.valid_until - date.today()
            return delta.days
        return None


class MTDComplianceLog(Base):
    """Compliance Tracking Log"""
    __tablename__ = "mtd_compliance_log"
    
    id = Column(BigInteger, primary_key=True)
    check_time = Column(DateTime, default=datetime.utcnow)
    emp_id = Column(Integer, ForeignKey("personnel_employee.id", ondelete="CASCADE"))
    cert_type_id = Column(Integer, ForeignKey("mtd_cert_type.id", ondelete="SET NULL"))
    record_type = Column(String(50))  # medical, certification, ppe, induction
    record_id = Column(BigInteger)
    status = Column(SmallInteger)  # 0=compliant,1=expiring,2=non-compliant
    action_taken = Column(String(100))  # "Suspended", "Notified", "Warning"
    details = Column(Text)
    created_by = Column(Integer, ForeignKey("auth_user.id"))
    
    # Relationships
    employee = relationship("PersonnelEmployee", foreign_keys=[emp_id])
    cert_type = relationship("MTDCertType", foreign_keys=[cert_type_id])
    creator = relationship("AuthUser", foreign_keys=[created_by])
    
    @property
    def status_text(self) -> str:
        status_map = {0: "Compliant", 1: "Expiring", 2: "Non-Compliant"}
        return status_map.get(self.status, "Unknown")


class MTDAuditLog(Base):
    """Audit Log for GDPR Compliance"""
    __tablename__ = "mtd_audit_log"
    
    id = Column(BigInteger, primary_key=True)
    access_time = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("auth_user.id", ondelete="SET NULL"))
    record_type = Column(String(50))  # medical_record, certification, induction
    record_id = Column(BigInteger)
    action = Column(String(20))  # view, edit, create, delete, export
    ip_address = Column(String(45))
    user_agent = Column(Text)
    details = Column(Text)
    
    # Relationships
    user = relationship("AuthUser", foreign_keys=[user_id])
    
    @property
    def action_text(self) -> str:
        action_map = {
            "view": "Viewed",
            "edit": "Edited", 
            "create": "Created",
            "delete": "Deleted",
            "export": "Exported"
        }
        return action_map.get(self.action, self.action)
