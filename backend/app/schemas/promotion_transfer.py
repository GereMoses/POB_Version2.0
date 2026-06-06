from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


TRANSFER_TYPES  = ["promotion", "department", "location", "position", "role", "lateral"]
TRANSFER_STATUSES = ["pending", "approved", "rejected", "completed", "cancelled"]


# ── Request schemas ───────────────────────────────────────────────────────────

class PromotionTransferCreate(BaseModel):
    personnel_id:       int
    transfer_type:      str             = Field(..., max_length=20)
    status:             str             = "pending"
    effective_date:     Optional[date]  = None
    from_department_id: Optional[int]   = None
    to_department_id:   Optional[int]   = None
    from_position_id:   Optional[int]   = None
    to_position_id:     Optional[int]   = None
    from_location:      Optional[str]   = Field(None, max_length=100)
    to_location:        Optional[str]   = Field(None, max_length=100)
    salary_change:      Optional[Decimal] = None
    reason:             Optional[str]   = None
    requested_by:       Optional[int]   = None


class PromotionTransferUpdate(BaseModel):
    transfer_type:      Optional[str]     = Field(None, max_length=20)
    status:             Optional[str]     = Field(None, max_length=20)
    effective_date:     Optional[date]    = None
    from_department_id: Optional[int]     = None
    to_department_id:   Optional[int]     = None
    from_position_id:   Optional[int]     = None
    to_position_id:     Optional[int]     = None
    from_location:      Optional[str]     = Field(None, max_length=100)
    to_location:        Optional[str]     = Field(None, max_length=100)
    salary_change:      Optional[Decimal] = None
    reason:             Optional[str]     = None
    rejection_reason:   Optional[str]     = None


# ── Response schema ───────────────────────────────────────────────────────────

class PromotionTransferResponse(BaseModel):
    id:                 int
    personnel_id:       int
    transfer_type:      str
    status:             str
    effective_date:     Optional[date]    = None
    from_department_id: Optional[int]     = None
    to_department_id:   Optional[int]     = None
    from_position_id:   Optional[int]     = None
    to_position_id:     Optional[int]     = None
    from_location:      Optional[str]     = None
    to_location:        Optional[str]     = None
    salary_change:      Optional[Decimal] = None
    reason:             Optional[str]     = None
    requested_by:       Optional[int]     = None
    approved_by:        Optional[int]     = None
    approved_at:        Optional[datetime] = None
    rejection_reason:   Optional[str]     = None
    created_at:         datetime
    updated_at:         datetime
    # enriched
    personnel_name:       Optional[str] = None
    personnel_emp_code:   Optional[str] = None
    personnel_type:       Optional[str] = None
    personnel_company:    Optional[str] = None
    from_department_name: Optional[str] = None
    to_department_name:   Optional[str] = None
    from_position_name:   Optional[str] = None
    to_position_name:     Optional[str] = None
    requester_name:       Optional[str] = None
    approver_name:        Optional[str] = None

    class Config:
        from_attributes = True
