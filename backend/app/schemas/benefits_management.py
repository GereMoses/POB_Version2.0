from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import date, datetime
from decimal import Decimal

BENEFIT_TYPES = [
    "health_insurance", "dental_insurance", "vision_insurance", "life_insurance",
    "pension", "retirement_401k", "paid_time_off", "sick_leave",
    "housing_allowance", "transportation", "meal_allowance",
    "disability_insurance", "tuition_reimbursement", "other",
]

ELIGIBILITY_TYPES = [
    "all_employees", "full_time_only", "part_time_only",
    "per_department", "tenure_based", "salary_based",
]

ENROLLMENT_STATUSES = ["active", "inactive", "waived", "cancelled"]


# ── Benefit Plan schemas ──────────────────────────────────────────────────────

class BenefitPlanCreate(BaseModel):
    plan_code:   Optional[str]      = Field(None, max_length=20)
    plan_name:   str                = Field(..., max_length=100)
    benefit_type: Optional[str]     = Field(None, max_length=50)
    description: Optional[str]     = None
    eligibility: str                = "all_employees"
    employer_contribution: Optional[Decimal] = None
    employee_contribution: Optional[Decimal] = None
    max_coverage: Optional[Decimal] = None
    currency:    str                = "USD"
    enrollment_period_start: Optional[date] = None
    enrollment_period_end:   Optional[date] = None
    effective_date: Optional[date]  = None
    is_active:   bool               = True


class BenefitPlanUpdate(BaseModel):
    plan_name:   Optional[str]      = Field(None, max_length=100)
    benefit_type: Optional[str]     = Field(None, max_length=50)
    description: Optional[str]     = None
    eligibility: Optional[str]     = Field(None, max_length=20)
    employer_contribution: Optional[Decimal] = None
    employee_contribution: Optional[Decimal] = None
    max_coverage: Optional[Decimal] = None
    currency:    Optional[str]      = Field(None, max_length=3)
    enrollment_period_start: Optional[date] = None
    enrollment_period_end:   Optional[date] = None
    effective_date: Optional[date]  = None
    is_active:   Optional[bool]     = None


class BenefitPlanResponse(BaseModel):
    id:           int
    plan_code:    Optional[str]     = None
    plan_name:    str
    benefit_type: Optional[str]     = None
    description:  Optional[str]     = None
    eligibility:  Optional[str]     = None
    employer_contribution: Optional[Decimal] = None
    employee_contribution: Optional[Decimal] = None
    max_coverage: Optional[Decimal] = None
    currency:     str               = "USD"
    enrollment_period_start: Optional[date] = None
    enrollment_period_end:   Optional[date] = None
    effective_date: Optional[date]  = None
    is_active:    bool              = True
    created_at:   datetime
    updated_at:   datetime
    # enriched
    enrollment_count: Optional[int] = None   # how many active enrollments

    class Config:
        from_attributes = True


# ── Employee Benefit (Enrollment) schemas ─────────────────────────────────────

class EmployeeBenefitCreate(BaseModel):
    personnel_id:    int
    plan_id:         int
    enrollment_date: Optional[date]    = None
    effective_date:  Optional[date]    = None
    coverage_amount: Optional[Decimal] = None
    dependents:      Optional[Any]     = None   # JSON list of dependents
    status:          str               = "active"


class EmployeeBenefitUpdate(BaseModel):
    enrollment_date: Optional[date]    = None
    effective_date:  Optional[date]    = None
    coverage_amount: Optional[Decimal] = None
    dependents:      Optional[Any]     = None
    status:          Optional[str]     = Field(None, max_length=20)


class EmployeeBenefitResponse(BaseModel):
    id:              int
    personnel_id:    int
    plan_id:         int
    enrollment_date: Optional[date]    = None
    effective_date:  Optional[date]    = None
    coverage_amount: Optional[Decimal] = None
    dependents:      Optional[Any]     = None
    status:          str               = "active"
    created_at:      datetime
    updated_at:      datetime
    # enriched
    personnel_name:     Optional[str] = None
    personnel_emp_code: Optional[str] = None
    personnel_type:     Optional[str] = None
    personnel_company:  Optional[str] = None
    plan_name:          Optional[str] = None
    benefit_type:       Optional[str] = None
    dependent_count:    Optional[int] = None

    class Config:
        from_attributes = True
