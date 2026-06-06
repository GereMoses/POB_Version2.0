"""
Position Management Pydantic Schemas
Request and response models for position management API
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class PositionType(str, Enum):
    EXECUTIVE = "EXECUTIVE"
    MANAGER = "MANAGER"
    SUPERVISOR = "SUPERVISOR"
    STAFF = "STAFF"
    CONTRACTOR = "CONTRACTOR"


class JobCategory(str, Enum):
    TECHNICAL = "TECHNICAL"
    OPERATIONS = "OPERATIONS"
    SAFETY = "SAFETY"
    ADMIN = "ADMIN"
    SUPPORT = "SUPPORT"


class AssignmentType(str, Enum):
    PRIMARY = "PRIMARY"
    SECONDARY = "SECONDARY"
    ACTING = "ACTING"


class AssignmentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"


class PositionCreate(BaseModel):
    """Request to create a new position"""
    position_code: str = Field(..., min_length=1, max_length=20, description="Unique position code")
    position_name: str = Field(..., min_length=1, max_length=100, description="Position name")
    description: Optional[str] = Field(None, max_length=500, description="Position description")
    
    # Hierarchy
    parent_id: Optional[int] = Field(None, description="Parent position ID")
    level: Optional[int] = Field(1, ge=1, description="Organizational level")
    sort_order: Optional[int] = Field(0, description="Display order")
    
    # Department linkage
    department_id: Optional[int] = Field(None, description="Department ID")
    
    # Position properties
    position_type: Optional[PositionType] = Field(None, description="Type of position")
    job_category: Optional[JobCategory] = Field(None, description="Job category")
    grade_level: Optional[str] = Field(None, max_length=10, description="Grade/level classification")
    
    # Requirements
    required_certifications: Optional[List[str]] = Field(None, description="Required certifications")
    required_skills: Optional[List[str]] = Field(None, description="Required skills")
    min_experience_years: Optional[int] = Field(0, ge=0, description="Minimum experience in years")
    education_level: Optional[str] = Field(None, max_length=50, description="Required education level")
    
    # Compensation
    salary_range_min: Optional[float] = Field(None, ge=0, description="Minimum salary")
    salary_range_max: Optional[float] = Field(None, ge=0, description="Maximum salary")
    currency: Optional[str] = Field("USD", max_length=3, description="Currency code")
    
    # Status
    is_safety_critical: Optional[bool] = Field(False, description="Safety critical position")
    requires_background_check: Optional[bool] = Field(False, description="Requires background check")
    
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")


class PositionUpdate(BaseModel):
    """Request to update an existing position"""
    position_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    
    # Hierarchy
    parent_id: Optional[int] = Field(None)
    level: Optional[int] = Field(None, ge=1)
    sort_order: Optional[int] = Field(None)
    
    # Department linkage
    department_id: Optional[int] = Field(None)
    
    # Position properties
    position_type: Optional[PositionType] = Field(None)
    job_category: Optional[JobCategory] = Field(None)
    grade_level: Optional[str] = Field(None, max_length=10)
    
    # Requirements
    required_certifications: Optional[List[str]] = Field(None)
    required_skills: Optional[List[str]] = Field(None)
    min_experience_years: Optional[int] = Field(None, ge=0)
    education_level: Optional[str] = Field(None, max_length=50)
    
    # Compensation
    salary_range_min: Optional[float] = Field(None, ge=0)
    salary_range_max: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=3)
    
    # Status
    is_active: Optional[bool] = Field(None)
    is_safety_critical: Optional[bool] = Field(None)
    requires_background_check: Optional[bool] = Field(None)
    
    notes: Optional[str] = Field(None, max_length=500)


class PositionResponse(BaseModel):
    """Position response model"""
    id: int
    position_code: str
    position_name: str
    description: Optional[str]
    
    # Hierarchy
    parent_id: Optional[int]
    level: int
    sort_order: int
    parent_name: Optional[str] = None
    
    # Department linkage
    department_id: Optional[int]
    department_name: Optional[str] = None
    
    # Position properties
    position_type: Optional[PositionType]
    job_category: Optional[JobCategory]
    grade_level: Optional[str]
    
    # Requirements
    required_certifications: Optional[List[str]]
    required_skills: Optional[List[str]]
    min_experience_years: int
    education_level: Optional[str]
    
    # Compensation
    salary_range_min: Optional[float]
    salary_range_max: Optional[float]
    currency: Optional[str]
    
    # Status
    is_active: bool
    is_safety_critical: bool
    requires_background_check: bool
    
    # Audit
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]
    updated_by: Optional[int]
    notes: Optional[str]
    
    # Statistics
    personnel_count: Optional[int] = 0
    child_positions_count: Optional[int] = 0


class PositionAssignmentCreate(BaseModel):
    """Request to create position assignment"""
    personnel_id: int = Field(..., description="Personnel ID")
    position_id: int = Field(..., description="Position ID")
    department_id: Optional[int] = Field(None, description="Department ID")
    
    # Assignment details
    assignment_type: Optional[AssignmentType] = Field(AssignmentType.PRIMARY, description="Assignment type")
    start_date: datetime = Field(..., description="Assignment start date")
    end_date: Optional[datetime] = Field(None, description="Assignment end date")
    
    notes: Optional[str] = Field(None, max_length=500, description="Assignment notes")


class PositionAssignmentResponse(BaseModel):
    """Position assignment response model"""
    id: int
    personnel_id: int
    position_id: int
    department_id: Optional[int]
    
    # Assignment details
    assignment_type: AssignmentType
    start_date: datetime
    end_date: Optional[datetime]
    status: AssignmentStatus
    is_current: bool
    
    # Personnel info
    personnel_name: Optional[str]
    personnel_badge_id: Optional[str]
    
    # Position info
    position_name: Optional[str]
    position_code: Optional[str]
    
    # Department info
    department_name: Optional[str]
    department_code: Optional[str]
    
    # Assignment authority
    assigned_by: Optional[int]
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    
    # Audit
    created_at: datetime
    updated_at: datetime
    notes: Optional[str]


class PositionTemplateCreate(BaseModel):
    """Request to create position template"""
    template_name: str = Field(..., min_length=1, max_length=100)
    template_code: str = Field(..., min_length=1, max_length=20)
    position_type: Optional[PositionType] = Field(None)
    job_category: Optional[JobCategory] = Field(None)
    
    # Template data
    template_data: Dict[str, Any] = Field(..., description="Position template configuration")
    default_requirements: Optional[Dict[str, Any]] = Field(None, description="Default requirements")
    
    is_system_template: Optional[bool] = Field(False, description="System template")


class PositionTemplateResponse(BaseModel):
    """Position template response model"""
    id: int
    template_name: str
    template_code: str
    position_type: Optional[PositionType]
    job_category: Optional[JobCategory]
    
    # Template data
    template_data: Dict[str, Any]
    default_requirements: Optional[Dict[str, Any]]
    
    # Usage tracking
    usage_count: int
    last_used: Optional[datetime]
    
    # Status
    is_active: bool
    is_system_template: bool
    
    # Audit
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime


class PositionLevelCreate(BaseModel):
    """Request to create position level"""
    level_code: str = Field(..., min_length=1, max_length=10)
    level_name: str = Field(..., min_length=1, max_length=50)
    level_number: int = Field(..., ge=1, description="Level number (1, 2, 3, etc.)")
    description: Optional[str] = Field(None, max_length=500)
    
    # Level properties
    level_type: Optional[str] = Field(None, max_length=20, description="Type of level")
    authority_level: Optional[int] = Field(1, ge=1, description="Authority weight")
    can_approve: Optional[bool] = Field(False, description="Can approve requests")
    can_manage: Optional[bool] = Field(False, description="Can manage others")


class PositionLevelResponse(BaseModel):
    """Position level response model"""
    id: int
    level_code: str
    level_name: str
    level_number: int
    description: Optional[str]
    
    # Level properties
    level_type: Optional[str]
    authority_level: int
    can_approve: bool
    can_manage: bool
    
    # Status
    is_active: bool
    
    # Audit
    created_at: datetime
    updated_at: datetime
    
    # Statistics
    positions_count: Optional[int] = 0


class PositionHierarchyResponse(BaseModel):
    """Position hierarchy response"""
    id: int
    position_code: str
    position_name: str
    level: int
    parent_id: Optional[int]
    is_active: bool
    children: List['PositionHierarchyResponse'] = []


class PositionStatisticsResponse(BaseModel):
    """Position statistics response"""
    total_positions: int
    active_positions: int
    inactive_positions: int
    
    # By type
    positions_by_type: Dict[str, int]
    
    # By category
    positions_by_category: Dict[str, int]
    
    # By level
    positions_by_level: Dict[str, int]
    
    # Safety critical
    safety_critical_positions: int
    
    # Department distribution
    positions_by_department: Dict[str, int]
    
    # Assignments
    total_assignments: int
    active_assignments: int
    pending_assignments: int
    
    # Vacancies
    vacant_positions: int
    critical_vacancies: int


class BulkPositionCreate(BaseModel):
    """Bulk position creation request"""
    positions: List[PositionCreate] = Field(..., max_items=50, description="List of positions to create")


class BulkPositionResponse(BaseModel):
    """Bulk position creation response"""
    total_positions: int
    successful_creations: int
    failed_creations: int
    created_positions: List[PositionResponse]
    errors: List[Dict[str, Any]]


class PositionSearchResponse(BaseModel):
    """Position search response"""
    positions: List[PositionResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool
