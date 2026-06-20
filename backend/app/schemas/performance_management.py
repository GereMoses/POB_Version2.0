from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


APPRAISAL_STATUSES = ["draft", "submitted", "in_progress", "completed", "approved", "rejected"]
PERFORMANCE_RATINGS = ["excellent", "very_good", "good", "satisfactory", "needs_improvement", "poor"]
CYCLE_STATUSES      = ["open", "closed", "draft"]


# ── Appraisal Cycle ───────────────────────────────────────────────────────────

class AppraisalCycleCreate(BaseModel):
    cycle_name:  str           = Field(..., min_length=2, max_length=100)
    cycle_code:  str           = Field(..., min_length=2, max_length=20)
    start_date:  date
    end_date:    date
    status:      Optional[str] = Field("open", max_length=20)
    description: Optional[str] = None


class AppraisalCycleUpdate(BaseModel):
    cycle_name:  Optional[str] = Field(None, min_length=2, max_length=100)
    start_date:  Optional[date] = None
    end_date:    Optional[date] = None
    status:      Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None


class AppraisalCycleResponse(BaseModel):
    id:          int
    cycle_name:  str
    cycle_code:  str
    start_date:  date
    end_date:    date
    status:      Optional[str] = None
    description: Optional[str] = None
    created_by:  Optional[int] = None
    created_at:  datetime
    updated_at:  datetime
    # enriched
    appraisal_count: Optional[int] = None

    class Config:
        from_attributes = True


# ── Performance Appraisal ─────────────────────────────────────────────────────

class PerformanceAppraisalCreate(BaseModel):
    personnel_id:          int
    cycle_id:              int
    reviewer_id:           Optional[int]     = None
    appraisal_date:        date
    status:                str               = "draft"
    overall_rating:        Optional[str]     = Field(None, max_length=20)
    goals_achieved:        Optional[Decimal] = Field(None, ge=0, le=100)
    performance_score:     Optional[Decimal] = Field(None, ge=0, le=100)
    strengths:             Optional[str]     = None
    areas_for_improvement: Optional[str]     = None
    comments:              Optional[str]     = None


class PerformanceAppraisalUpdate(BaseModel):
    reviewer_id:           Optional[int]     = None
    appraisal_date:        Optional[date]    = None
    status:                Optional[str]     = Field(None, max_length=20)
    overall_rating:        Optional[str]     = Field(None, max_length=20)
    goals_achieved:        Optional[Decimal] = Field(None, ge=0, le=100)
    performance_score:     Optional[Decimal] = Field(None, ge=0, le=100)
    strengths:             Optional[str]     = None
    areas_for_improvement: Optional[str]     = None
    comments:              Optional[str]     = None


class PerformanceAppraisalResponse(BaseModel):
    id:                    int
    personnel_id:          int
    cycle_id:              int
    reviewer_id:           Optional[int]     = None
    appraisal_date:        Optional[date]    = None
    status:                str
    overall_rating:        Optional[str]     = None
    goals_achieved:        Optional[Decimal] = None
    performance_score:     Optional[Decimal] = None
    strengths:             Optional[str]     = None
    areas_for_improvement: Optional[str]     = None
    comments:              Optional[str]     = None
    created_at:            datetime
    updated_at:            datetime
    # enriched
    personnel_name:        Optional[str] = None
    personnel_emp_code:    Optional[str] = None
    personnel_type:        Optional[str] = None
    personnel_company:     Optional[str] = None
    cycle_name:            Optional[str] = None
    cycle_code:            Optional[str] = None
    reviewer_name:         Optional[str] = None
    department_id:         Optional[int] = None
    department_name:       Optional[str] = None
    # training compliance snapshot pulled at appraisal time
    training_compliance:   Optional[int] = None  # % of mandatory courses certified
    expired_certs:         Optional[int] = None  # count of expired mandatory certs

    class Config:
        from_attributes = True
