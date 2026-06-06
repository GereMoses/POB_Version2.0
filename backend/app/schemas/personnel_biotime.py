"""
BioTime 9.5 Compatible Personnel Schemas
Pydantic models for BioTime 9.5 personnel data structures with POB extensions
"""

from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from enum import Enum

# Enums for BioTime compatibility
class GenderEnum(str, Enum):
    MALE = "M"
    FEMALE = "F"

class EmployeeStatusEnum(int, Enum):
    ACTIVE = 0
    RESIGNED = 1

class OnboardingStatusEnum(int, Enum):
    PENDING = 0
    IN_PROGRESS = 1
    COMPLETE = 2

class TaskStatusEnum(int, Enum):
    PENDING = 0
    SUBMITTED = 1
    APPROVED = 2
    REJECTED = 3

class AreaTypeEnum(int, Enum):
    OFFICE = 0
    SITE = 1
    RESTRICTED = 2
    MUSTERING = 3

class TaskCategoryEnum(str, Enum):
    DOCUMENT = "Document"
    TRAINING = "Training"
    MEDICAL = "Medical"
    PPE = "PPE"

# Base schemas
class BaseSchema(BaseModel):
    class Config:
        from_attributes = True

# Employee schemas
class EmployeeBase(BaseSchema):
    emp_code: Optional[str] = None
    first_name: Optional[str] = None
    last_name: str
    nickname: Optional[str] = None
    dept_id: Optional[int] = None
    position_id: Optional[int] = None
    area_id: Optional[int] = None
    hire_date: Optional[date] = None
    birthday: Optional[date] = None
    gender: Optional[GenderEnum] = None
    card_no: Optional[str] = None
    pwd: Optional[str] = None
    photo: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    status: EmployeeStatusEnum = EmployeeStatusEnum.ACTIVE
    is_admin: bool = False
    enroll_sn: Optional[str] = None
    enable_att: bool = True
    enable_overtime: bool = True
    enable_holiday: bool = True
    dev_privilege: int = 0
    super_ssn: Optional[str] = None
    
    # POB extensions
    contractor_flag: bool = False
    vendor_id: Optional[int] = None
    blood_group: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    onboarding_status: OnboardingStatusEnum = OnboardingStatusEnum.PENDING
    custom_fields: Optional[Dict[str, Any]] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseSchema):
    emp_code: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    nickname: Optional[str] = None
    dept_id: Optional[int] = None
    position_id: Optional[int] = None
    area_id: Optional[int] = None
    hire_date: Optional[date] = None
    birthday: Optional[date] = None
    gender: Optional[GenderEnum] = None
    card_no: Optional[str] = None
    pwd: Optional[str] = None
    photo: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    status: Optional[EmployeeStatusEnum] = None
    is_admin: Optional[bool] = None
    enroll_sn: Optional[str] = None
    enable_att: Optional[bool] = None
    enable_overtime: Optional[bool] = None
    enable_holiday: Optional[bool] = None
    dev_privilege: Optional[int] = None
    super_ssn: Optional[str] = None
    contractor_flag: Optional[bool] = None
    vendor_id: Optional[int] = None
    blood_group: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    onboarding_status: Optional[OnboardingStatusEnum] = None
    custom_fields: Optional[Dict[str, Any]] = None

class EmployeeResponse(EmployeeBase):
    id: int
    create_time: datetime
    update_time: datetime
    
    # Related data
    department: Optional[Dict[str, Any]] = None
    position: Optional[Dict[str, Any]] = None
    area: Optional[Dict[str, Any]] = None
    vendor: Optional[Dict[str, Any]] = None
    supervisor: Optional[Dict[str, Any]] = None
    
    # BioTime extensions
    biotime_employee_id: Optional[str] = None
    work_schedule: Optional[Dict[str, Any]] = None
    access_groups: Optional[List[Dict[str, Any]]] = None
    device_groups: Optional[List[Dict[str, Any]]] = None
    biometric_quality_score: Optional[float] = None
    last_sync_timestamp: Optional[datetime] = None
    timezone_preference: str = "UTC"
    language_preference: str = "en"

# Department schemas
class DepartmentBase(BaseSchema):
    dept_code: Optional[str] = None
    dept_name: str
    parent_id: Optional[int] = None
    mgr_ssn: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseSchema):
    dept_code: Optional[str] = None
    dept_name: Optional[str] = None
    parent_id: Optional[int] = None
    mgr_ssn: Optional[str] = None

class DepartmentResponse(DepartmentBase):
    id: int
    create_time: datetime
    update_time: datetime
    parent: Optional[Dict[str, Any]] = None
    manager: Optional[Dict[str, Any]] = None
    children: Optional[List[Dict[str, Any]]] = []

# Position schemas
class PositionBase(BaseSchema):
    position_code: Optional[str] = None
    position_name: str
    dept_id: Optional[int] = None

class PositionCreate(PositionBase):
    pass

class PositionUpdate(BaseSchema):
    position_code: Optional[str] = None
    position_name: Optional[str] = None
    dept_id: Optional[int] = None

class PositionResponse(PositionBase):
    id: int
    create_time: datetime
    update_time: datetime
    department: Optional[Dict[str, Any]] = None

# Area schemas
class AreaBase(BaseSchema):
    area_code: Optional[str] = None
    area_name: str
    area_type: AreaTypeEnum = AreaTypeEnum.OFFICE

class AreaCreate(AreaBase):
    pass

class AreaUpdate(BaseSchema):
    area_code: Optional[str] = None
    area_name: Optional[str] = None
    area_type: Optional[AreaTypeEnum] = None

class AreaResponse(AreaBase):
    id: int
    create_time: datetime
    update_time: datetime

# Resignation schemas
class ResignationBase(BaseSchema):
    emp_id: int
    resign_date: date
    reason: Optional[str] = None

class ResignationCreate(ResignationBase):
    pass

class ResignationResponse(ResignationBase):
    id: int
    operate_time: datetime
    employee: Optional[Dict[str, Any]] = None

# Vendor schemas
class VendorBase(BaseSchema):
    vendor_code: Optional[str] = None
    vendor_name: str
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    status: int = 0

class VendorCreate(VendorBase):
    pass

class VendorUpdate(BaseSchema):
    vendor_code: Optional[str] = None
    vendor_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contract_start: Optional[date] = None
    contract_end: Optional[date] = None
    status: Optional[int] = None

class VendorResponse(VendorBase):
    id: int
    create_time: datetime
    update_time: datetime
    contractors: Optional[List[Dict[str, Any]]] = []

# Onboarding schemas
class OnboardingTaskBase(BaseSchema):
    emp_id: int
    task_name: str
    category: Optional[TaskCategoryEnum] = None
    doc_path: Optional[str] = None
    required: bool = True
    due_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None

class OnboardingTaskCreate(OnboardingTaskBase):
    pass

class OnboardingTaskUpdate(BaseSchema):
    task_name: Optional[str] = None
    category: Optional[TaskCategoryEnum] = None
    doc_path: Optional[str] = None
    required: Optional[bool] = None
    due_date: Optional[date] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None

class OnboardingTaskResponse(OnboardingTaskBase):
    id: int
    status: TaskStatusEnum
    submitted_time: Optional[datetime] = None
    approved_by: Optional[int] = None
    approved_time: Optional[datetime] = None
    create_time: datetime
    update_time: datetime
    employee: Optional[Dict[str, Any]] = None
    approver: Optional[Dict[str, Any]] = None

# Onboarding Template schemas
class OnboardingTemplateItemBase(BaseSchema):
    task_name: str
    category: Optional[TaskCategoryEnum] = None
    required: bool = True
    days_to_complete: Optional[int] = None

class OnboardingTemplateBase(BaseSchema):
    template_name: str
    dept_id: Optional[int] = None
    position_id: Optional[int] = None
    is_contractor: bool = False

class OnboardingTemplateCreate(OnboardingTemplateBase):
    items: Optional[List[OnboardingTemplateItemBase]] = []

class OnboardingTemplateResponse(OnboardingTemplateBase):
    id: int
    create_time: datetime
    update_time: datetime
    items: Optional[List[OnboardingTaskResponse]] = []
    department: Optional[Dict[str, Any]] = None
    position: Optional[Dict[str, Any]] = None

# Biometric schemas
class BiometricEnrollmentRequest(BaseSchema):
    type: str  # finger, face, palm
    terminal_sn: str

class BiometricDataRequest(BaseSchema):
    type: str  # finger, face, palm
    template: str
    finger_id: Optional[int] = None
    face_id: Optional[int] = None
    palm_id: Optional[int] = None

# Response schemas for API
class BatchImportResponse(BaseSchema):
    success: bool
    total_records: int
    imported_records: int
    failed_records: int
    errors: List[Dict[str, Any]] = []

class DeviceSyncResponse(BaseSchema):
    success: bool
    message: str
    device_commands: List[Dict[str, Any]] = []

class OnboardingProgressResponse(BaseSchema):
    emp_id: int
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    overall_progress: float
    onboarding_status: OnboardingStatusEnum

# Validation schemas
@validator('emp_code', pre=True, always=True)
def generate_emp_code(cls, v, values):
    """Auto-generate emp_code if not provided"""
    if not v:
        import datetime
        year = datetime.datetime.now().year
        # This would need to be replaced with actual sequence logic
        v = f"EMP{year}{1:04d}"
    return v

@validator('contract_end', pre=True, always=True)
def validate_contract_end(cls, v, values):
    """Validate contract end date"""
    if v and values.get('contractor_flag'):
        if v < date.today():
            raise ValueError('Contract end date cannot be in the past for contractors')
    return v

@validator('email', pre=True, always=True)
def validate_email(cls, v):
    """Validate email format"""
    if v and '@' not in v:
        raise ValueError('Invalid email format')
    return v

@validator('mobile', pre=True, always=True)
def validate_mobile(cls, v):
    """Validate mobile phone format"""
    if v and not v.replace('-', '').replace('+', '').isdigit():
        raise ValueError('Mobile phone must contain only digits')
    return v
