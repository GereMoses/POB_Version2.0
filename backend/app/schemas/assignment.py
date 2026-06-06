from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class AssignmentBase(BaseModel):
    department_id: int
    personnel_id: int
    role: str = Field(..., min_length=1, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    is_primary: bool = False
    is_manager: bool = False

class AssignmentCreate(AssignmentBase):
    assigned_by: Optional[int] = None

class AssignmentUpdate(BaseModel):
    role: Optional[str] = Field(None, min_length=1, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    is_primary: Optional[bool] = None
    is_manager: Optional[bool] = None
    status: Optional[str] = Field(None, pattern="^(active|transferred|resigned)$")

class BulkAssignmentCreate(BaseModel):
    department_id: int
    role: str = Field(..., min_length=1, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    personnel_ids: List[int] = Field(..., min_items=1)
    is_primary: bool = False
    is_manager: bool = False
    assigned_by: Optional[int] = None

class TransferCreate(BaseModel):
    personnel_id: int
    to_department_id: int
    reason: str = Field(..., min_length=5, max_length=500)
    effective_date: Optional[datetime] = None
    requested_by: Optional[int] = None

class TransferResponse(BaseModel):
    id: int
    personnel_id: int
    from_department_id: int
    to_department_id: int
    reason: str
    status: str
    requested_at: datetime
    effective_date: Optional[datetime]

class AssignmentResponse(BaseModel):
    id: int
    assignment_code: str
    department_id: int
    department_name: str
    department_code: str
    site_id: Optional[int]
    personnel_id: int
    badge_id: str
    full_name: str
    email: str
    phone: str
    company: str
    personnel_type: str
    personnel_status: str
    personnel_department: str
    role: str
    position: Optional[str]
    is_primary: bool
    is_manager: bool
    assignment_status: str
    assigned_at: datetime
    assigned_date: Optional[str]
    unassigned_at: Optional[datetime]
    unassigned_date: Optional[str]
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    # Display fields
    display_name: str
    display_department: str
    display_role: str
    display_assignment: str
    assignment_duration: str
    is_active: bool

    class Config:
        from_attributes = True

class AssignmentStats(BaseModel):
    total_personnel: int
    total_departments: int
    assigned_personnel: int
    unassigned_personnel: int
    active_assignments: int
    pending_transfers: int
    department_utilization: Dict[str, int]

class AssignmentHistory(BaseModel):
    id: int
    department: str
    role: str
    position: Optional[str]
    is_primary: bool
    status: str
    assigned_at: datetime
    unassigned_at: Optional[datetime]

class AssignmentAnalytics(BaseModel):
    total_assignments: int
    active_assignments: int
    primary_assignments: int
    department_breakdown: Dict[str, int]
    period: Dict[str, str]

class BulkAssignmentResult(BaseModel):
    personnel_id: int
    assignment_id: Optional[int]
    status: str
    error: Optional[str]

class BulkAssignmentResponse(BaseModel):
    message: str
    results: List[BulkAssignmentResult]
    success_count: int
    total_count: int

class TransferRequest(BaseModel):
    id: int
    personnel_id: int
    from_department: str
    to_department: str
    reason: str
    effective_date: Optional[datetime]
    status: str
    requested_at: datetime

class AssignmentExport(BaseModel):
    badge_id: str
    full_name: str
    department: str
    role: str
    position: str
    assignment_type: str
    status: str
    assigned_date: str
    unassigned_date: str

class AssignmentListResponse(BaseModel):
    assignments: List[AssignmentResponse]
    total: int
    page: int
    pages: int
