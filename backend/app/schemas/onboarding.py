"""
Onboarding Management Pydantic Schemas
Request and response models for onboarding workflow API
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class OnboardingType(str, Enum):
    NEW_HIRE = "NEW_HIRE"
    REHIRE = "REHIRE"
    INTERNAL_TRANSFER = "INTERNAL_TRANSFER"
    PROMOTION = "PROMOTION"
    CONTRACT_RENEWAL = "CONTRACT_RENEWAL"


class OnboardingStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TaskType(str, Enum):
    DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD"
    TRAINING = "TRAINING"
    REVIEW = "REVIEW"
    APPROVAL = "APPROVAL"
    BACKGROUND_CHECK = "BACKGROUND_CHECK"
    MEDICAL_CHECK = "MEDICAL_CHECK"
    ASSET_RETURN = "ASSET_RETURN"
    SYSTEM_ACCESS = "SYSTEM_ACCESS"


class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class OnboardingCreate(BaseModel):
    """Request to create onboarding"""
    personnel_id: int = Field(..., description="Personnel ID")
    onboarding_type: OnboardingType = Field(..., description="Type of onboarding")
    start_date: datetime = Field(..., description="Onboarding start date")
    planned_end_date: datetime = Field(..., description="Planned end date")
    job_title: str = Field(..., min_length=1, max_length=200, description="Job title")
    job_description: str = Field(..., min_length=10, max_length=2000, description="Job description")
    department_id: Optional[int] = Field(None, description="Department ID")
    position_id: Optional[int] = Field(None, description="Position ID")
    reporting_to: Optional[int] = Field(None, description="Reporting manager ID")
    buddy_id: Optional[int] = Field(None, description="Buddy ID")
    manager_id: Optional[int] = Field(None, description="Manager ID")
    template_id: Optional[int] = Field(None, description="Template ID")
    template_data: Optional[Dict[str, Any]] = Field(None, description="Template configuration")
    custom_fields: Optional[Dict[str, Any]] = Field(None, description="Custom field overrides")
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")


class OnboardingUpdate(BaseModel):
    """Request to update onboarding"""
    status: Optional[OnboardingStatus] = Field(None, description="Onboarding status")
    start_date: Optional[datetime] = Field(None, description="Onboarding start date")
    planned_end_date: Optional[datetime] = Field(None, description="Planned end date")
    job_title: Optional[str] = Field(None, min_length=1, max_length=200, description="Job title")
    job_description: Optional[str] = Field(None, min_length=10, max_length=2000, description="Job description")
    department_id: Optional[int] = Field(None, description="Department ID")
    position_id: Optional[int] = Field(None, description="Position ID")
    reporting_to: Optional[int] = Field(None, description="Reporting manager ID")
    buddy_id: Optional[int] = Field(None, description="Buddy ID")
    manager_id: Optional[int] = Field(None, description="Manager ID")
    template_id: Optional[int] = Field(None, description="Template ID")
    template_data: Optional[Dict[str, Any]] = Field(None, description="Template configuration")
    custom_fields: Optional[Dict[str, Any]] = Field(None, description="Custom field overrides")
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")
    
    # Approval workflow
    rejection_reason: Optional[str] = Field(None, max_length=500, description="Rejection reason")
    actual_end_date: Optional[datetime] = Field(None, description="Actual end date")
    completed_at: Optional[datetime] = Field(None, description="Completion date")
    completed_by: Optional[int] = Field(None, description="Completed by user ID")
    exit_interview_date: Optional[datetime] = Field(None, description="Exit interview date")


class OnboardingResponse(BaseModel):
    """Onboarding response model"""
    id: int
    personnel_id: int
    onboarding_type: OnboardingType
    status: OnboardingStatus
    start_date: datetime
    planned_end_date: datetime
    actual_end_date: Optional[datetime]
    job_title: str
    job_description: str
    department_id: Optional[int]
    position_id: Optional[int]
    reporting_to: Optional[int]
    buddy_id: Optional[int]
    manager_id: Optional[int]
    template_id: Optional[int]
    
    # Progress tracking
    completion_percentage: float
    last_progress_update: Optional[datetime]
    
    # Personnel info
    personnel_name: Optional[str]
    personnel_badge_id: Optional[str]
    personnel_department: Optional[str]
    personnel_position: Optional[str]
    
    # Timeline events
    submitted_at: Optional[datetime]
    reviewed_at: Optional[datetime]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    actual_end_date: Optional[datetime]
    completed_at: Optional[datetime]
    exit_interview_date: Optional[datetime]
    
    # Approval workflow
    approved_by: Optional[int]
    completed_by: Optional[int]
    
    # Audit trail
    created_by: int
    created_at: datetime
    updated_by: Optional[int]
    updated_at: datetime
    notes: Optional[str]


class OnboardingTaskCreate(BaseModel):
    """Request to create onboarding task"""
    onboarding_id: int = Field(..., description="Onboarding ID")
    task_name: str = Field(..., min_length=1, max_length=100, description="Task name")
    task_type: TaskType = Field(..., description="Task type")
    description: Optional[str] = Field(None, max_length=500, description="Task description")
    is_required: bool = Field(True, description="Task is required")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    priority: TaskPriority = Field(TaskPriority.MEDIUM, description="Task priority")
    checklist_items: Optional[List[Dict[str, Any]]] = Field(None, description="Checklist items")
    depends_on_tasks: Optional[List[int]] = Field(None, description="Task dependencies")
    notes: Optional[str] = Field(None, max_length=500, description="Task notes")


class OnboardingTaskResponse(BaseModel):
    """Onboarding task response model"""
    id: int
    onboarding_id: int
    task_name: str
    task_type: TaskType
    description: Optional[str]
    
    # Task status
    is_required: bool
    due_date: Optional[datetime]
    priority: TaskPriority
    
    # Status tracking
    status: str
    completion_date: Optional[datetime]
    completed_by: Optional[int]
    completion_notes: Optional[str]
    
    # Checklist items
    checklist_items: Optional[List[Dict[str, Any]]]
    completed_items: Optional[List[Dict[str, Any]]]
    
    # Dependencies
    depends_on_tasks: Optional[List[int]]
    
    # Audit trail
    created_at: datetime
    updated_at: datetime
    notes: Optional[str]


class OnboardingDocumentCreate(BaseModel):
    """Request to upload onboarding document"""
    onboarding_id: int = Field(..., description="Onboarding ID")
    document_type: str = Field(..., description="Document type")
    document_name: str = Field(..., min_length=1, max_length=255, description="Document name")
    description: Optional[str] = Field(None, max_length=500, description="Document description")
    is_required: bool = Field(True, description="Document is required")
    notes: Optional[str] = Field(None, max_length=500, description="Document notes")


class OnboardingDocumentResponse(BaseModel):
    """Onboarding document response model"""
    id: int
    onboarding_id: int
    document_type: str
    document_name: str
    document_path: str
    file_size: Optional[int]
    mime_type: str
    description: Optional[str]
    is_required: bool
    uploaded_by: Optional[int]
    uploaded_at: datetime
    is_verified: bool
    verified_by: Optional[int]
    verified_at: Optional[datetime]
    verification_notes: Optional[str]


class OnboardingTemplateCreate(BaseModel):
    """Request to create onboarding template"""
    template_name: str = Field(..., min_length=1, max_length=100, description="Template name")
    template_code: str = Field(..., min_length=1, max_length=20, description="Template code")
    onboarding_type: OnboardingType = Field(..., description="Onboarding type")
    description: Optional[str] = Field(None, max_length=500, description="Template description")
    default_tasks: List[Dict[str, Any]] = Field(..., description="Default tasks for this template")
    required_documents: List[Dict[str, Any]] = Field(..., description="Required documents")
    approval_workflow: Optional[Dict[str, Any]] = Field(None, description="Approval workflow")
    notification_settings: Optional[Dict[str, Any]] = Field(None, description="Notification settings")
    default_duration_days: int = Field(30, description="Default onboarding duration")
    is_system_template: bool = Field(False, description="System template")


class OnboardingTemplateResponse(BaseModel):
    """Onboarding template response model"""
    id: int
    template_name: str
    template_code: str
    onboarding_type: OnboardingType
    description: Optional[str]
    default_tasks: List[Dict[str, Any]]
    required_documents: List[Dict[str, Any]]
    approval_workflow: Optional[Dict[str, Any]]
    notification_settings: Optional[Dict[str, Any]]
    default_duration_days: int
    is_system_template: bool
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    usage_count: int
    last_used: Optional[datetime]
    notes: Optional[str]


class OnboardingStatisticsResponse(BaseModel):
    """Onboarding statistics response model"""
    total_onboardings: int
    active_onboardings: int
    completed_onboardings: int
    pending_approval: int
    pending_review: int
    
    # By type
    onboardings_by_type: Dict[str, int]
    
    # By status
    onboardings_by_status: Dict[str, int]
    
    # Timeline metrics
    average_duration_days: Optional[float]
    overdue_onboardings: int
    
    # Completion rates
    task_completion_rate: Optional[float]
    document_submission_rate: Optional[float]
    checklist_completion_rate: Optional[float]
    
    # Recent activity
    onboardings_this_week: int
    onboardings_this_month: int
    
    # Personnel breakdown
    onboardings_by_department: Dict[str, int]
    
    # Templates used
    template_usage: Dict[str, int]


class BulkOnboardingAction(BaseModel):
    """Bulk onboarding action request"""
    onboarding_ids: List[int] = Field(..., max_items=50, description="List of onboarding IDs")
    action: str = Field(..., description="Action to perform: APPROVE, REJECT, CANCEL")
    reason: Optional[str] = Field(None, max_length=500, description="Action reason")
    notes: Optional[str] = Field(None, max_length=500, description="Action notes")


class BulkOnboardingResponse(BaseModel):
    """Bulk onboarding action response"""
    total_onboardings: int
    successful_actions: int
    failed_actions: int
    action_results: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]


class OnboardingSearchResponse(BaseModel):
    """Onboarding search response model"""
    onboardings: List[OnboardingResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class ChecklistItemCreate(BaseModel):
    """Request to create checklist item"""
    item_name: str = Field(..., min_length=1, max_length=100, description="Checklist item name")
    description: Optional[str] = Field(None, max_length=500, description="Checklist item description")
    is_required: bool = Field(True, description="Checklist item is required")
    sort_order: int = Field(0, description="Display order")
