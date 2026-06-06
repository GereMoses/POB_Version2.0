from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal


# BioTime-compatible leave type catalogue (mirrors att_leavetype concept)
LEAVE_TYPE_CATALOGUE: List[Dict[str, Any]] = [
    {"code": "annual",        "name": "Annual Leave",        "color": "blue",     "paid": True,  "default_days": 21},
    {"code": "sick",          "name": "Sick Leave",          "color": "red",      "paid": True,  "default_days": 10},
    {"code": "maternity",     "name": "Maternity Leave",     "color": "pink",     "paid": True,  "default_days": 90},
    {"code": "paternity",     "name": "Paternity Leave",     "color": "cyan",     "paid": True,  "default_days": 14},
    {"code": "compassionate", "name": "Compassionate Leave", "color": "purple",   "paid": True,  "default_days": 5},
    {"code": "unpaid",        "name": "Unpaid Leave",        "color": "orange",   "paid": False, "default_days": 0},
    {"code": "study",         "name": "Study Leave",         "color": "green",    "paid": True,  "default_days": 5},
    {"code": "military",      "name": "Military Leave",      "color": "geekblue", "paid": True,  "default_days": 30},
    {"code": "personal",      "name": "Personal Leave",      "color": "default",  "paid": False, "default_days": 3},
    {"code": "other",         "name": "Other",               "color": "default",  "paid": False, "default_days": 0},
]

LEAVE_TYPE_MAP = {lt["code"]: lt for lt in LEAVE_TYPE_CATALOGUE}


# ── Leave Request schemas ─────────────────────────────────────────────────────

class LeaveManagementCreate(BaseModel):
    personnel_id: int
    leave_type: str = Field(..., min_length=1, max_length=50)
    start_date: date
    end_date: date
    days_count: Decimal = Field(..., ge=0.5, le=365)
    reason: Optional[str] = Field(None, max_length=500)

    @model_validator(mode='after')
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError('End date must be on or after start date')
        return self


class LeaveManagementUpdate(BaseModel):
    leave_type: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    days_count: Optional[Decimal] = Field(None, ge=0.5, le=365)
    reason: Optional[str] = Field(None, max_length=500)


class LeaveManagementResponse(BaseModel):
    id: int
    personnel_id: int
    leave_type: str
    start_date: date
    end_date: date
    days_count: Decimal
    reason: Optional[str] = None
    status: str
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Enriched at query time from the personnel relationship
    personnel_name: Optional[str] = None
    personnel_emp_code: Optional[str] = None

    class Config:
        from_attributes = True


class LeaveApprovalRequest(BaseModel):
    rejection_reason: Optional[str] = Field(None, max_length=500)


# ── Leave Balance schemas ─────────────────────────────────────────────────────

class LeaveBalanceCreate(BaseModel):
    personnel_id: int
    leave_type: str = Field(..., min_length=1, max_length=50)
    year: int = Field(..., ge=2020, le=2100)
    total_days: Decimal = Field(default=0, ge=0)
    used_days: Decimal = Field(default=0, ge=0)
    balance_days: Decimal = Field(default=0, ge=0)
    carry_forward_days: Decimal = Field(default=0, ge=0)
    accrual_rate: Optional[Decimal] = Field(None, ge=0)


class LeaveBalanceUpdate(BaseModel):
    total_days: Optional[Decimal] = Field(None, ge=0)
    used_days: Optional[Decimal] = Field(None, ge=0)
    balance_days: Optional[Decimal] = Field(None, ge=0)
    carry_forward_days: Optional[Decimal] = Field(None, ge=0)
    accrual_rate: Optional[Decimal] = Field(None, ge=0)


class LeaveBalanceResponse(BaseModel):
    id: int
    personnel_id: int
    leave_type: str
    year: int
    total_days: Decimal
    used_days: Decimal
    balance_days: Decimal
    carry_forward_days: Decimal
    accrual_rate: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime
    personnel_name: Optional[str] = None
    personnel_emp_code: Optional[str] = None

    class Config:
        from_attributes = True


# ── Blackout Period schemas ───────────────────────────────────────────────────

class LeaveBlackoutCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    start_date: date
    end_date: date
    reason: Optional[str] = Field(None, max_length=500)
    applies_to: str = Field(default="all", max_length=50)
    department_id: Optional[int] = None

    @model_validator(mode='after')
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError('End date must be on or after start date')
        return self


class LeaveBlackoutUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reason: Optional[str] = Field(None, max_length=500)
    applies_to: Optional[str] = Field(None, max_length=50)
    department_id: Optional[int] = None


class LeaveBlackoutResponse(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    reason: Optional[str] = None
    applies_to: str
    department_id: Optional[int] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
