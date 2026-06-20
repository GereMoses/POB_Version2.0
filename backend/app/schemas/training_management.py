from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


TRAINING_CATEGORIES: List[str] = [
    "safety", "technical", "compliance", "soft_skills",
    "leadership", "induction", "refresher", "certification",
]

TRAINING_STATUSES: List[str] = [
    "enrolled", "in_progress", "completed", "failed", "cancelled", "certified",
]


# ── Course schemas ────────────────────────────────────────────────────────────

class TrainingCourseCreate(BaseModel):
    course_code: str = Field(..., min_length=2, max_length=20)
    course_name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    duration_hours: Optional[int] = Field(None, ge=1)
    category: Optional[str] = Field(None, max_length=50)
    is_mandatory: bool = False
    valid_period_months: Optional[int] = Field(None, ge=1)


class TrainingCourseUpdate(BaseModel):
    course_name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    duration_hours: Optional[int] = Field(None, ge=1)
    category: Optional[str] = Field(None, max_length=50)
    is_mandatory: Optional[bool] = None
    valid_period_months: Optional[int] = Field(None, ge=1)


class TrainingCourseResponse(BaseModel):
    id: int
    course_code: str
    course_name: str
    description: Optional[str] = None
    duration_hours: Optional[int] = None
    category: Optional[str] = None
    is_mandatory: bool
    valid_period_months: Optional[int] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    enrollment_count: Optional[int] = None

    class Config:
        from_attributes = True


# ── Enrollment schemas ────────────────────────────────────────────────────────

class TrainingEnrollmentCreate(BaseModel):
    personnel_id: int
    course_id: int
    enrollment_date: date
    status: str = "enrolled"
    score: Optional[Decimal] = Field(None, ge=0, le=100)
    certificate_url: Optional[str] = Field(None, max_length=255)


class TrainingEnrollmentUpdate(BaseModel):
    status: Optional[str] = None
    score: Optional[Decimal] = Field(None, ge=0, le=100)
    completion_date: Optional[date] = None
    expiry_date: Optional[date] = None
    certificate_url: Optional[str] = Field(None, max_length=255)


class TrainingCompleteRequest(BaseModel):
    score: Optional[Decimal] = Field(None, ge=0, le=100)
    certificate_url: Optional[str] = Field(None, max_length=255)
    completion_date: Optional[date] = None


class TrainingEnrollmentResponse(BaseModel):
    id: int
    personnel_id: int
    course_id: int
    enrollment_date: Optional[date] = None
    completion_date: Optional[date] = None
    expiry_date: Optional[date] = None
    status: str
    score: Optional[Decimal] = None
    certificate_url: Optional[str] = None
    personnel_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Enriched fields
    personnel_name: Optional[str] = None
    personnel_emp_code: Optional[str] = None
    personnel_company: Optional[str] = None
    course_name: Optional[str] = None
    course_code: Optional[str] = None
    course_category: Optional[str] = None
    is_mandatory: Optional[bool] = None
    valid_period_months: Optional[int] = None
    department_id:   Optional[int] = None
    department_name: Optional[str] = None
    # Computed
    cert_status: Optional[str] = None   # valid|expiring|expired|no_expiry

    class Config:
        from_attributes = True


# ── Compliance report schemas ─────────────────────────────────────────────────

class ComplianceRecord(BaseModel):
    personnel_id: int
    personnel_name: str
    personnel_emp_code: str
    personnel_type: str
    personnel_company:  Optional[str] = None
    department_id:      Optional[int] = None
    department_name:    Optional[str] = None
    course_id: int
    course_name: str
    course_code: str
    category: Optional[str] = None
    issue: str   # never_enrolled | expired | expiring_soon | failed
    expiry_date: Optional[date] = None
    days_until_expiry: Optional[int] = None
