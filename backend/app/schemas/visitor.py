"""
Visitor Management Schemas - BioTime 9.5 Compatible + POB Extensions
Pydantic schemas for visitor API request/response models
"""

from datetime import date, datetime, time
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

from app.schemas.base import APIResponse


# Visitor Type Schemas
class VisitorTypeBase(BaseModel):
    type_name: str = Field(..., max_length=50)
    access_level_id: Optional[int] = None
    badge_template: Optional[str] = Field(None, max_length=100)
    induction_required: bool = False
    default_visit_hours: int = 8
    auto_checkout: bool = True
    mustering_zone_id: Optional[int] = None
    contractor_visitor: bool = False
    safety_induction_required: bool = False


class VisitorTypeCreate(VisitorTypeBase):
    pass


class VisitorTypeUpdate(BaseModel):
    type_name: Optional[str] = Field(None, max_length=50)
    access_level_id: Optional[int] = None
    badge_template: Optional[str] = Field(None, max_length=100)
    induction_required: Optional[bool] = None
    default_visit_hours: Optional[int] = None
    auto_checkout: Optional[bool] = None
    mustering_zone_id: Optional[int] = None
    contractor_visitor: Optional[bool] = None
    safety_induction_required: Optional[bool] = None
    is_active: Optional[bool] = None


class VisitorType(VisitorTypeBase):
    id: int
    created_time: datetime
    is_active: bool

    class Config:
        from_attributes = True


# Visitor Schemas
class VisitorBase(BaseModel):
    full_name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    company: Optional[str] = Field(None, max_length=100)
    id_type: Optional[int] = None  # 0=NIC,1=Passport,2=License
    id_no: Optional[str] = Field(None, max_length=50)
    visitor_type_id: Optional[int] = None
    vendor_id: Optional[int] = None
    safety_induction_done: bool = False


class VisitorCreate(VisitorBase):
    pass


class VisitorUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    company: Optional[str] = Field(None, max_length=100)
    id_type: Optional[int] = None
    id_no: Optional[str] = Field(None, max_length=50)
    visitor_type_id: Optional[int] = None
    vendor_id: Optional[int] = None
    safety_induction_done: Optional[bool] = None
    photo: Optional[str] = None
    signature: Optional[str] = None


class Visitor(VisitorBase):
    id: int
    visitor_code: str
    photo: Optional[str] = None
    signature: Optional[str] = None
    is_blacklist: bool
    blacklist_reason: Optional[str] = None
    induction_doc: Optional[str] = None
    created_time: datetime
    updated_time: datetime
    visitor_type: Optional[VisitorType] = None

    class Config:
        from_attributes = True


# Pre-Registration Schemas
class VisitorPreRegistrationBase(BaseModel):
    host_emp_id: int
    visit_date: date
    visit_time_start: Optional[time] = None
    visit_time_end: Optional[time] = None
    purpose: Optional[str] = Field(None, max_length=255)
    area_id: Optional[int] = None
    vehicle_no: Optional[str] = Field(None, max_length=20)
    safety_induction_done: bool = False
    contractor_visitor: bool = False


class VisitorPreRegistrationCreate(VisitorPreRegistrationBase):
    visitor_data: Optional[VisitorCreate] = None  # For walk-in visitors
    visitor_id: Optional[int] = None  # For existing visitors


class VisitorPreRegistrationUpdate(BaseModel):
    status: Optional[int] = None
    approval_note: Optional[str] = Field(None, max_length=255)
    safety_induction_done: Optional[bool] = None
    visit_time_start: Optional[time] = None
    visit_time_end: Optional[time] = None
    purpose: Optional[str] = Field(None, max_length=255)
    area_id: Optional[int] = None


class VisitorPreRegistration(VisitorPreRegistrationBase):
    id: int
    visitor_id: Optional[int] = None
    qr_code: str
    status: int
    approval_time: Optional[datetime] = None
    approval_by: Optional[int] = None
    approval_note: Optional[str] = None
    induction_doc: Optional[str] = None
    created_by: Optional[int] = None
    created_time: datetime
    updated_time: datetime
    visitor: Optional[Visitor] = None

    class Config:
        from_attributes = True


# Visit Log Schemas
class VisitorVisitLogBase(BaseModel):
    visitor_id: int
    pre_reg_id: Optional[int] = None
    host_emp_id: Optional[int] = None
    area_id: Optional[int] = None
    mustering_zone_id: Optional[int] = None


class VisitorCheckIn(BaseModel):
    pre_reg_id: Optional[int] = None
    visitor_data: Optional[VisitorCreate] = None  # For walk-in
    host_emp_id: Optional[int] = None
    area_id: Optional[int] = None
    device_sn: Optional[str] = None


class VisitorCheckOut(BaseModel):
    visitor_code: Optional[str] = None
    card_no: Optional[str] = None
    device_sn: Optional[str] = None


class VisitorVisitLog(VisitorVisitLogBase):
    id: int
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    card_no: Optional[str] = None
    device_sn: Optional[str] = None
    badge_printed: bool
    status: int
    mustering_status: Optional[int] = None
    overstay_alert_sent: bool
    created_by: Optional[int] = None
    created_time: datetime
    visitor: Optional[Visitor] = None
    pre_registration: Optional[VisitorPreRegistration] = None

    class Config:
        from_attributes = True


# Blacklist Schemas
class VisitorBlacklistBase(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    id_no: str = Field(..., max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    reason: str = Field(..., max_length=255)


class VisitorBlacklistCreate(VisitorBlacklistBase):
    pass


class VisitorBlacklistUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    reason: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class VisitorBlacklist(VisitorBlacklistBase):
    id: int
    added_by: Optional[int] = None
    added_time: datetime
    is_active: bool

    class Config:
        from_attributes = True


# Approval Schemas
class VisitorApprovalRequest(BaseModel):
    status: int  # 1=approved, 2=rejected
    note: Optional[str] = Field(None, max_length=255)


# QR Code Schema
class VisitorQRResponse(BaseModel):
    qr_code: str
    visitor_name: str
    company: Optional[str] = None
    host_name: Optional[str] = None
    visit_date: date
    visit_time_start: Optional[time] = None
    visit_time_end: Optional[time] = None
    purpose: Optional[str] = None
    status: int


# Report Schemas
class VisitorDailyReport(BaseModel):
    date: date
    total_visitors: int
    checked_in: int
    checked_out: int
    on_site: int
    overstay: int
    by_type: List[dict]
    by_host: List[dict]


class VisitorOverstayReport(BaseModel):
    visitor_id: int
    visitor_name: str
    company: Optional[str] = None
    host_name: Optional[str] = None
    check_in_time: datetime
    hours_overdue: float
    contact_info: dict


# API Response Wrappers
class VisitorTypeResponse(APIResponse):
    data: Optional[VisitorType] = None


class VisitorTypeListResponse(APIResponse):
    data: Optional[List[VisitorType]] = None


class VisitorResponse(APIResponse):
    data: Optional[Visitor] = None


class VisitorListResponse(APIResponse):
    data: Optional[List[Visitor]] = None


class VisitorPreRegistrationResponse(APIResponse):
    data: Optional[VisitorPreRegistration] = None


class VisitorPreRegistrationListResponse(APIResponse):
    data: Optional[List[VisitorPreRegistration]] = None


class VisitorVisitLogResponse(APIResponse):
    data: Optional[VisitorVisitLog] = None


class VisitorVisitLogListResponse(APIResponse):
    data: Optional[List[VisitorVisitLog]] = None


class VisitorBlacklistResponse(APIResponse):
    data: Optional[VisitorBlacklist] = None


class VisitorBlacklistListResponse(APIResponse):
    data: Optional[List[VisitorBlacklist]] = None


class VisitorQRResponse(APIResponse):
    data: Optional[VisitorQRResponse] = None


class VisitorQRResponseWrapper(APIResponse):
    data: Optional[VisitorQRResponse] = None


class VisitorDailyReportResponse(APIResponse):
    data: Optional[VisitorDailyReport] = None


class VisitorOverstayReportListResponse(APIResponse):
    data: Optional[List[VisitorOverstayReport]] = None
