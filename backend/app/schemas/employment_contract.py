from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

CONTRACT_TYPES    = ["permanent", "fixed_term", "contractor", "intern", "apprentice", "temporary"]
CONTRACT_STATUSES = ["draft", "active", "expired", "terminated", "suspended", "renewed"]
PAY_FREQUENCIES   = ["monthly", "bi_weekly", "weekly", "daily"]


class EmploymentContractCreate(BaseModel):
    personnel_id:       int
    contract_number:    Optional[str]   = Field(None, max_length=50)   # auto-generated if blank
    contract_type:      str             = Field(..., max_length=20)
    status:             str             = "draft"
    start_date:         Optional[date]  = None
    end_date:           Optional[date]  = None
    probation_end_date: Optional[date]  = None
    salary:             Optional[Decimal] = None
    currency:           str             = "USD"
    payment_frequency:  Optional[str]   = Field(None, max_length=20)
    working_hours:      Optional[int]   = None
    job_title:          Optional[str]   = Field(None, max_length=100)
    department_id:      Optional[int]   = None
    position_id:        Optional[int]   = None
    terms:              Optional[str]   = None
    signed_by:          Optional[int]   = None
    signed_date:        Optional[date]  = None
    document_url:       Optional[str]   = Field(None, max_length=255)


class EmploymentContractUpdate(BaseModel):
    contract_type:      Optional[str]   = Field(None, max_length=20)
    status:             Optional[str]   = Field(None, max_length=20)
    start_date:         Optional[date]  = None
    end_date:           Optional[date]  = None
    probation_end_date: Optional[date]  = None
    salary:             Optional[Decimal] = None
    currency:           Optional[str]   = Field(None, max_length=3)
    payment_frequency:  Optional[str]   = Field(None, max_length=20)
    working_hours:      Optional[int]   = None
    job_title:          Optional[str]   = Field(None, max_length=100)
    department_id:      Optional[int]   = None
    position_id:        Optional[int]   = None
    terms:              Optional[str]   = None
    signed_by:          Optional[int]   = None
    signed_date:        Optional[date]  = None
    document_url:       Optional[str]   = Field(None, max_length=255)


class EmploymentContractResponse(BaseModel):
    id:                 int
    personnel_id:       int
    contract_number:    Optional[str]   = None
    contract_type:      str
    status:             str
    start_date:         Optional[date]  = None
    end_date:           Optional[date]  = None
    probation_end_date: Optional[date]  = None
    salary:             Optional[Decimal] = None
    currency:           str             = "USD"
    payment_frequency:  Optional[str]   = None
    working_hours:      Optional[int]   = None
    job_title:          Optional[str]   = None
    department_id:      Optional[int]   = None
    position_id:        Optional[int]   = None
    terms:              Optional[str]   = None
    signed_by:          Optional[int]   = None
    signed_date:        Optional[date]  = None
    document_url:       Optional[str]   = None
    created_at:         datetime
    updated_at:         datetime
    # enriched
    personnel_name:     Optional[str]   = None
    personnel_emp_code: Optional[str]   = None
    personnel_type:     Optional[str]   = None
    personnel_company:  Optional[str]   = None
    department_name:    Optional[str]   = None
    position_name:      Optional[str]   = None
    signer_name:        Optional[str]   = None
    # ZKTeco / lifecycle computed
    days_until_expiry:  Optional[int]   = None   # None for non-active or no end_date
    is_in_probation:    Optional[bool]  = None
    is_expiring_soon:   Optional[bool]  = None   # end_date within 30 days
    zkteco_access:      Optional[str]   = None   # "granted" | "revoked" | "pending" | "warning"

    class Config:
        from_attributes = True
