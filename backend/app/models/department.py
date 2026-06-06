from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class Department(Base):
    __tablename__ = "departments"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(100), nullable=False, index=True)
    code        = Column(String(20), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # operations | maintenance | safety | security | administration | logistics
    # technical | medical | training | contractor | management | support
    department_type = Column(String(50), nullable=True)

    # active | inactive | temporary | under_review
    status     = Column(String(20), nullable=True, default="active")
    is_active  = Column(Boolean, nullable=False, default=True)

    # Hierarchy
    parent_id  = Column(Integer, ForeignKey("departments.id"), nullable=True)
    level      = Column(Integer, nullable=True, default=1)
    sort_order = Column(Integer, nullable=True, default=0)

    # Assignments
    zone_id    = Column(Integer, ForeignKey("zones.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("personnel.id"), nullable=True)

    # Contact
    contact_person = Column(String(100), nullable=True)
    contact_email  = Column(String(100), nullable=True)
    contact_phone  = Column(String(20), nullable=True)

    # Capacity
    max_personnel           = Column(Integer, nullable=True)
    current_personnel_count = Column(Integer, nullable=True, default=0)

    # Budget (NUMERIC 15,2)
    budget_allocated = Column(Numeric(15, 2), nullable=True)
    budget_used      = Column(Numeric(15, 2), nullable=True, default=0)

    # Safety & compliance
    safety_critical              = Column(Boolean, nullable=True, default=False)
    security_clearance_required  = Column(Boolean, nullable=True, default=False)
    required_certifications      = Column(JSON, nullable=True)
    safety_protocols             = Column(JSON, nullable=True)
    access_levels                = Column(JSON, nullable=True)

    # ZKTeco integration
    zkteco_department_id = Column(Integer, nullable=True)   # BioTime dept ID (INTEGER in DB)
    zkteco_sync_enabled  = Column(Boolean, nullable=True, default=True)
    last_sync_at         = Column(DateTime(timezone=False), nullable=True)

    # Attendance: fallback shift used when employees have no direct schedule assignment
    default_shift_id     = Column(Integer, ForeignKey("att_shift.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=False), server_default=func.now())
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    parent   = relationship("Department", remote_side=[id], back_populates="children")
    children = relationship("Department", back_populates="parent")
    manager  = relationship("Personnel", foreign_keys=[manager_id])
    personnel_assignments = relationship("DepartmentPersonnel", back_populates="department")
    zone           = relationship("Zone", foreign_keys=[zone_id])
    created_by_user = relationship("User", foreign_keys=[created_by])
    updated_by_user = relationship("User", foreign_keys=[updated_by])


class DepartmentPersonnel(Base):
    __tablename__ = "department_personnel"

    id            = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    personnel_id  = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)

    role       = Column(String(100), nullable=False)
    position   = Column(String(100), nullable=True)
    is_primary = Column(Boolean, default=False)
    is_manager = Column(Boolean, default=False)

    assigned_at   = Column(DateTime(timezone=False), server_default=func.now())
    unassigned_at = Column(DateTime(timezone=False), nullable=True)

    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=False), nullable=True)
    status      = Column(String(20), default="active")

    created_at = Column(DateTime(timezone=False), server_default=func.now())
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    department        = relationship("Department", back_populates="personnel_assignments")
    approved_by_user  = relationship("User", foreign_keys=[approved_by])
