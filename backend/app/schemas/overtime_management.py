from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import date, datetime, time
from decimal import Decimal


OVERTIME_TYPE_CATALOGUE = [
    {"code": "daily",   "name": "Daily Overtime",   "description": "Hours beyond daily threshold"},
    {"code": "weekly",  "name": "Weekly Overtime",  "description": "Hours beyond weekly threshold"},
    {"code": "weekend", "name": "Weekend Overtime",  "description": "Work performed on weekends"},
    {"code": "holiday", "name": "Holiday Overtime",  "description": "Work performed on public holidays"},
    {"code": "special", "name": "Special Overtime",  "description": "Specially authorised overtime"},
]


# ── Overtime Request schemas ──────────────────────────────────────────────────

class OvertimeManagementCreate(BaseModel):
    personnel_id: int
    overtime_type: str = Field(..., min_length=1, max_length=20)
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    hours_worked: Optional[Decimal] = Field(None, ge=0)
    overtime_hours: Optional[Decimal] = Field(None, ge=0)
    reason: Optional[str] = Field(None, max_length=500)
    compensation_type: Optional[str] = Field(None, max_length=20)  # pay|time_off|mixed

    @model_validator(mode='after')
    def validate_times(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError('end_time must be after start_time')
        return self


class OvertimeManagementUpdate(BaseModel):
    overtime_type: Optional[str] = Field(None, max_length=20)
    date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    hours_worked: Optional[Decimal] = Field(None, ge=0)
    overtime_hours: Optional[Decimal] = Field(None, ge=0)
    reason: Optional[str] = Field(None, max_length=500)
    compensation_type: Optional[str] = Field(None, max_length=20)


class OvertimeManagementResponse(BaseModel):
    id: int
    personnel_id: int
    overtime_type: str
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    hours_worked: Optional[Decimal] = None
    overtime_hours: Optional[Decimal] = None
    reason: Optional[str] = None
    status: str
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    compensation_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Enriched at query time
    personnel_name: Optional[str] = None
    personnel_emp_code: Optional[str] = None

    class Config:
        from_attributes = True


class OvertimeApprovalRequest(BaseModel):
    rejection_reason: Optional[str] = Field(None, max_length=500)


# ── Overtime Rule schemas ─────────────────────────────────────────────────────

class OvertimeRuleCreate(BaseModel):
    rule_name: str = Field(..., min_length=2, max_length=100)
    rule_type: str = Field(..., min_length=1, max_length=20)          # daily|weekly|weekend|holiday|special
    daily_threshold_hours: Optional[Decimal] = Field(None, ge=0)
    weekly_threshold_hours: Optional[Decimal] = Field(None, ge=0)
    monthly_threshold_hours: Optional[Decimal] = Field(None, ge=0)
    rate_multiplier: Decimal = Field(default=Decimal("1.5"), gt=0)
    max_daily_hours: Optional[Decimal] = Field(None, ge=0)
    max_weekly_hours: Optional[Decimal] = Field(None, ge=0)
    max_monthly_hours: Optional[Decimal] = Field(None, ge=0)
    requires_approval: bool = True
    applies_to: str = Field(default="all", max_length=20)             # all|STAFF|CONTRACTOR
    is_active: bool = True


class OvertimeRuleUpdate(BaseModel):
    rule_name: Optional[str] = Field(None, min_length=2, max_length=100)
    rule_type: Optional[str] = Field(None, max_length=20)
    daily_threshold_hours: Optional[Decimal] = Field(None, ge=0)
    weekly_threshold_hours: Optional[Decimal] = Field(None, ge=0)
    monthly_threshold_hours: Optional[Decimal] = Field(None, ge=0)
    rate_multiplier: Optional[Decimal] = Field(None, gt=0)
    max_daily_hours: Optional[Decimal] = Field(None, ge=0)
    max_weekly_hours: Optional[Decimal] = Field(None, ge=0)
    max_monthly_hours: Optional[Decimal] = Field(None, ge=0)
    requires_approval: Optional[bool] = None
    applies_to: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


class OvertimeRuleResponse(BaseModel):
    id: int
    rule_name: str
    rule_type: str
    daily_threshold_hours: Optional[Decimal] = None
    weekly_threshold_hours: Optional[Decimal] = None
    monthly_threshold_hours: Optional[Decimal] = None
    rate_multiplier: Decimal
    max_daily_hours: Optional[Decimal] = None
    max_weekly_hours: Optional[Decimal] = None
    max_monthly_hours: Optional[Decimal] = None
    requires_approval: bool
    applies_to: str
    is_active: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
