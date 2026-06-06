"""
Resignation Management Pydantic Schemas
Request and response models for resignation workflow API
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ResignationType(str, Enum):
    VOLUNTARY = "VOLUNTARY"
    INVOLUNTARY = "INVOLUNTARY"
    RETIREMENT = "RETIREMENT"
    TERMINATION = "TERMINATION"
    CONTRACT_END = "CONTRACT_END"


class ResignationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TaskType(str, Enum):
    EXIT_INTERVIEW = "EXIT_INTERVIEW"
    HANDOVER = "HANDOVER"
    FINANCIAL = "FINANCIAL"
    ASSET_RETURN = "ASSET_RETURN"
    SYSTEM_ACCESS = "SYSTEM_ACCESS"


class ResignationCreate(BaseModel):
    """Request to create resignation"""
    personnel_id: int = Field(..., description="Personnel ID")
    resignation_type: ResignationType = Field(..., description="Type of resignation")
    resignation_date: datetime = Field(..., description="Resignation date")
    last_working_day: datetime = Field(..., description="Last working day")
    reason: str = Field(..., min_length=10, max_length=500, description="Resignation reason")
    detailed_reason: Optional[str] = Field(None, max_length=1000, description="Detailed resignation reason")
    
    # Exit interview
    exit_interview_date: Optional[datetime] = Field(None, description="Exit interview date")
    
    # Handover information
    handover_checklist: Optional[Dict[str, Any]] = Field(None, description="Handover checklist")
    
    # Financial information
    financial_clearance_notes: Optional[str] = Field(None, max_length=500, description="Financial clearance notes")
    
    # Asset return information
    assets_return_checklist: Optional[Dict[str, Any]] = Field(None, description="Asset return checklist")
    
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")


class ResignationUpdate(BaseModel):
    """Request to update resignation"""
    resignation_type: Optional[ResignationType] = Field(None, description="Type of resignation")
    status: Optional[ResignationStatus] = Field(None, description="Resignation status")
    resignation_date: Optional[datetime] = Field(None, description="Resignation date")
    last_working_day: Optional[datetime] = Field(None, description="Last working day")
    reason: Optional[str] = Field(None, min_length=10, max_length=500, description="Resignation reason")
    detailed_reason: Optional[str] = Field(None, max_length=1000, description="Detailed resignation reason")
    
    # Exit interview
    exit_interview_date: Optional[datetime] = Field(None, description="Exit interview date")
    exit_interview_notes: Optional[str] = Field(None, max_length=1000, description="Exit interview notes")
    
    # Handover process
    handover_completed: Optional[bool] = Field(None, description="Handover completed")
    handover_date: Optional[datetime] = Field(None, description="Handover date")
    handover_notes: Optional[str] = Field(None, max_length=1000, description="Handover notes")
    handover_checklist: Optional[Dict[str, Any]] = Field(None, description="Handover checklist")
    
    # Financial clearance
    financial_clearance_completed: Optional[bool] = Field(None, description="Financial clearance completed")
    financial_clearance_date: Optional[datetime] = Field(None, description="Financial clearance date")
    financial_clearance_notes: Optional[str] = Field(None, max_length=500, description="Financial clearance notes")
    
    # Asset return
    assets_returned: Optional[bool] = Field(None, description="Assets returned")
    assets_return_date: Optional[datetime] = Field(None, description="Assets return date")
    assets_return_notes: Optional[str] = Field(None, max_length=1000, description="Assets return notes")
    assets_return_checklist: Optional[Dict[str, Any]] = Field(None, description="Asset return checklist")
    
    # System access
    system_access_revoked: Optional[bool] = Field(None, description="System access revoked")
    system_access_revoked_date: Optional[datetime] = Field(None, description="System access revoked date")
    device_access_removed: Optional[bool] = Field(None, description="Device access removed")
    
    # Approval
    rejection_reason: Optional[str] = Field(None, max_length=500, description="Rejection reason")
    
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")


class ResignationResponse(BaseModel):
    """Resignation response model"""
    id: int
    personnel_id: int
    resignation_type: ResignationType
    status: ResignationStatus
    resignation_date: datetime
    last_working_day: datetime
    reason: str
    detailed_reason: Optional[str]
    
    # Exit interview
    exit_interview_date: Optional[datetime]
    exit_interview_conducted_by: Optional[int]
    exit_interview_notes: Optional[str]
    
    # Handover process
    handover_completed: bool
    handover_date: Optional[datetime]
    handover_conducted_by: Optional[int]
    handover_notes: Optional[str]
    handover_checklist: Optional[Dict[str, Any]]
    
    # Financial clearance
    financial_clearance_completed: bool
    financial_clearance_date: Optional[datetime]
    financial_clearance_conducted_by: Optional[int]
    financial_clearance_notes: Optional[str]
    
    # Asset return
    assets_returned: bool
    assets_return_date: Optional[datetime]
    assets_return_conducted_by: Optional[int]
    assets_return_notes: Optional[str]
    assets_return_checklist: Optional[Dict[str, Any]]
    
    # System access
    system_access_revoked: bool
    system_access_revoked_date: Optional[datetime]
    system_access_revoked_by: Optional[int]
    device_access_removed: bool
    
    # Final approval
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    
    # Completion
    completed_at: Optional[datetime]
    completed_by: Optional[int]
    
    # Audit
    created_by: int
    created_at: datetime
    updated_at: datetime
    notes: Optional[str]
    
    # Personnel info
    personnel_name: Optional[str]
    personnel_badge_id: Optional[str]
    personnel_department: Optional[str]
    personnel_position: Optional[str]
    
    # Progress tracking
    completion_percentage: Optional[float] = 0.0
    tasks_completed: Optional[int] = 0
    total_tasks: Optional[int] = 0


class ResignationTaskCreate(BaseModel):
    """Request to create resignation task"""
    resignation_id: int = Field(..., description="Resignation ID")
    task_name: str = Field(..., min_length=1, max_length=100, description="Task name")
    task_type: TaskType = Field(..., description="Task type")
    description: Optional[str] = Field(None, max_length=500, description="Task description")
    is_required: Optional[bool] = Field(True, description="Task is required")
    checklist_items: Optional[Dict[str, Any]] = Field(None, description="Task checklist items")
    due_date: Optional[datetime] = Field(None, description="Task due date")


class ResignationTaskResponse(BaseModel):
    """Resignation task response model"""
    id: int
    resignation_id: int
    task_name: str
    task_type: TaskType
    description: Optional[str]
    
    # Task status
    is_required: bool
    is_completed: bool
    completion_date: Optional[datetime]
    completed_by: Optional[int]
    completion_notes: Optional[str]
    
    # Task configuration
    checklist_items: Optional[Dict[str, Any]]
    due_date: Optional[datetime]
    
    # Audit
    created_at: datetime
    updated_at: datetime


class ResignationDocumentCreate(BaseModel):
    """Request to upload resignation document"""
    resignation_id: int = Field(..., description="Resignation ID")
    document_type: str = Field(..., min_length=1, max_length=50, description="Document type")
    document_name: str = Field(..., min_length=1, max_length=255, description="Document name")
    description: Optional[str] = Field(None, max_length=500, description="Document description")
    is_required: Optional[bool] = Field(True, description="Document is required")


class ResignationDocumentResponse(BaseModel):
    """Resignation document response model"""
    id: int
    resignation_id: int
    document_type: str
    document_name: str
    document_path: str
    file_size: Optional[int]
    mime_type: Optional[str]
    description: Optional[str]
    is_required: bool
    uploaded_by: Optional[int]
    uploaded_at: datetime
    is_verified: Optional[bool]
    verified_by: Optional[int]
    verified_at: Optional[datetime]
    verification_notes: Optional[str]


class ResignationTemplateCreate(BaseModel):
    """Request to create resignation template"""
    template_name: str = Field(..., min_length=1, max_length=100, description="Template name")
    template_code: str = Field(..., min_length=1, max_length=20, description="Template code")
    resignation_type: ResignationType = Field(..., description="Resignation type")
    default_tasks: Dict[str, Any] = Field(..., description="Default tasks")
    required_documents: Dict[str, Any] = Field(..., description="Required documents")
    approval_workflow: Optional[Dict[str, Any]] = Field(None, description="Approval workflow")
    notification_settings: Optional[Dict[str, Any]] = Field(None, description="Notification settings")
    description: Optional[str] = Field(None, max_length=500, description="Template description")
    is_default: Optional[bool] = Field(False, description="Is default template")


class ResignationTemplateResponse(BaseModel):
    """Resignation template response model"""
    id: int
    template_name: str
    template_code: str
    resignation_type: ResignationType
    default_tasks: Dict[str, Any]
    required_documents: Dict[str, Any]
    approval_workflow: Optional[Dict[str, Any]]
    notification_settings: Optional[Dict[str, Any]]
    description: Optional[str]
    is_active: bool
    is_default: bool
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime


class ResignationStatisticsResponse(BaseModel):
    """Resignation statistics response"""
    total_resignations: int
    pending_resignations: int
    approved_resignations: int
    processing_resignations: int
    completed_resignations: int
    
    # By type
    resignations_by_type: Dict[str, int]
    
    # By month
    resignations_by_month: Dict[str, int]
    
    # Average processing time
    average_processing_days: Optional[float]
    
    # Completion rates
    task_completion_rate: Optional[float]
    document_submission_rate: Optional[float]


class ResignationSearchResponse(BaseModel):
    """Resignation search response"""
    resignations: List[ResignationResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class BulkResignationAction(BaseModel):
    """Bulk resignation action request"""
    resignation_ids: List[int] = Field(..., max_items=50, description="List of resignation IDs")
    action: str = Field(..., description="Action to perform: APPROVE, REJECT, CANCEL")
    reason: Optional[str] = Field(None, max_length=500, description="Action reason")
    notes: Optional[str] = Field(None, max_length=500, description="Action notes")


class BulkResignationResponse(BaseModel):
    """Bulk resignation action response"""
    total_resignations: int
    successful_actions: int
    failed_actions: int
    action_results: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]


class DeviceCommandRequest(BaseModel):
    """Device command for resignation"""
    device_serial: str = Field(..., description="Device serial number")
    command: str = Field(..., description="Command to send")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Command parameters")
    timeout_seconds: Optional[int] = Field(30, ge=1, le=300, description="Command timeout")


class DeviceCommandResponse(BaseModel):
    """Device command response"""
    command_id: str
    device_serial: str
    command: str
    status: str
    response_data: Optional[Dict[str, Any]]
    error_message: Optional[str]
    executed_at: datetime
    response_time_ms: Optional[int]
