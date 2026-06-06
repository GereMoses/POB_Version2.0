from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Numeric, Date, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class BenefitPlan(Base):
    """Benefit plan catalogue — matches benefit_plans table exactly."""
    __tablename__ = "benefit_plans"

    id          = Column(Integer, primary_key=True, index=True)
    plan_code   = Column(String(20), unique=True, nullable=False, index=True)
    plan_name   = Column(String(100), nullable=False)

    # health_insurance | dental | life | pension | housing_allowance | transportation | meal_allowance | other
    benefit_type  = Column(String(50), nullable=True)
    description   = Column(Text, nullable=True)

    # all_employees | full_time_only | part_time_only | per_department | tenure_based
    eligibility   = Column(String(20), default="all_employees")

    # Contributions stored as percentages (NUMERIC 5,2 → up to 999.99%)
    employer_contribution = Column(Numeric(5, 2), default=0)
    employee_contribution = Column(Numeric(5, 2), default=0)
    max_coverage          = Column(Numeric(10, 2), nullable=True)
    currency              = Column(String(3), default="USD")

    enrollment_period_start = Column(Date, nullable=True)
    enrollment_period_end   = Column(Date, nullable=True)
    effective_date          = Column(Date, nullable=True)

    is_active  = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by])


class EmployeeBenefit(Base):
    """Employee benefit enrollments — matches employee_benefits table exactly."""
    __tablename__ = "employee_benefits"

    id           = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    plan_id      = Column(Integer, ForeignKey("benefit_plans.id"), nullable=False, index=True)

    enrollment_date = Column(Date, nullable=True)
    effective_date  = Column(Date, nullable=True)
    coverage_amount = Column(Numeric(10, 2), nullable=True)

    # JSON array of dependent objects: [{name, relationship, dob}, ...]
    dependents = Column(JSON, nullable=True)

    # active | inactive | waived | cancelled
    status = Column(String(20), default="active", index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personnel = relationship("Personnel", foreign_keys=[personnel_id])
    plan      = relationship("BenefitPlan", foreign_keys=[plan_id])
