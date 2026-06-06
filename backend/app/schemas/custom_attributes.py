"""
Custom Attributes Pydantic Schemas
Request and response models for custom attributes management API
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class AttributeType(str, Enum):
    TEXT = "TEXT"
    NUMBER = "NUMBER"
    DATE = "DATE"
    BOOLEAN = "BOOLEAN"
    SELECT = "SELECT"
    MULTI_SELECT = "MULTI_SELECT"
    FILE = "FILE"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    URL = "URL"


class ValidationRule(str, Enum):
    REQUIRED = "REQUIRED"
    OPTIONAL = "OPTIONAL"
    MIN_LENGTH = "MIN_LENGTH"
    MAX_LENGTH = "MAX_LENGTH"
    MIN_VALUE = "MIN_VALUE"
    MAX_VALUE = "MAX_VALUE"
    EMAIL_FORMAT = "EMAIL_FORMAT"
    PHONE_FORMAT = "PHONE_FORMAT"
    REGEX_PATTERN = "REGEX_PATTERN"


class CustomAttributeCreate(BaseModel):
    """Request to create custom attribute"""
    attribute_code: str = Field(..., min_length=1, max_length=50, description="Unique attribute code")
    attribute_name: str = Field(..., min_length=1, max_length=100, description="Attribute name")
    attribute_type: AttributeType = Field(..., description="Data type")
    description: Optional[str] = Field(None, max_length=500, description="Attribute description")
    
    # Validation rules
    validation_rules: Optional[List[Dict[str, Any]]] = Field(None, description="Validation rules")
    default_value: Optional[Dict[str, Any]] = Field(None, description="Default value")
    
    # Display options
    display_options: Optional[Dict[str, Any]] = Field(None, description="Display options for SELECT/MULTI_SELECT")
    placeholder_text: Optional[str] = Field(None, max_length=100, description="Placeholder text")
    
    # Category and grouping
    category: Optional[str] = Field(None, max_length=50, description="Attribute category")
    group_name: Optional[str] = Field(None, max_length=50, description="Group name")
    sort_order: Optional[int] = Field(0, description="Display order")
    
    # Status
    is_required: Optional[bool] = Field(False, description="Attribute is required")
    is_searchable: Optional[bool] = Field(True, description="Attribute is searchable")
    is_visible_in_list: Optional[bool] = Field(True, description="Attribute visible in list")
    
    # Permissions
    read_permissions: Optional[List[str]] = Field(None, description="Roles that can read this attribute")
    write_permissions: Optional[List[str]] = Field(None, description="Roles that can write this attribute")
    
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes")


class CustomAttributeUpdate(BaseModel):
    """Request to update custom attribute"""
    attribute_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    
    # Validation rules
    validation_rules: Optional[List[Dict[str, Any]]] = Field(None)
    default_value: Optional[Dict[str, Any]] = Field(None)
    
    # Display options
    display_options: Optional[Dict[str, Any]] = Field(None)
    placeholder_text: Optional[str] = Field(None, max_length=100)
    
    # Category and grouping
    category: Optional[str] = Field(None, max_length=50)
    group_name: Optional[str] = Field(None, max_length=50)
    sort_order: Optional[int] = Field(None)
    
    # Status
    is_active: Optional[bool] = Field(None)
    is_required: Optional[bool] = Field(None)
    is_searchable: Optional[bool] = Field(None)
    is_visible_in_list: Optional[bool] = Field(None)
    
    # Permissions
    read_permissions: Optional[List[str]] = Field(None)
    write_permissions: Optional[List[str]] = Field(None)
    
    notes: Optional[str] = Field(None, max_length=500)


class CustomAttributeResponse(BaseModel):
    """Custom attribute response model"""
    id: int
    attribute_code: str
    attribute_name: str
    attribute_type: AttributeType
    description: Optional[str]
    
    # Validation rules
    validation_rules: Optional[List[Dict[str, Any]]]
    default_value: Optional[Dict[str, Any]]
    
    # Display options
    display_options: Optional[Dict[str, Any]]
    placeholder_text: Optional[str]
    
    # Category and grouping
    category: Optional[str]
    group_name: Optional[str]
    sort_order: int
    
    # Status
    is_active: bool
    is_required: bool
    is_searchable: bool
    is_visible_in_list: bool
    
    # Permissions
    read_permissions: Optional[List[str]]
    write_permissions: Optional[List[str]]
    
    # Audit
    created_by: Optional[int]
    updated_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    notes: Optional[str]
    
    # Statistics
    usage_count: Optional[int] = 0
    last_used: Optional[datetime] = None


class CustomAttributeValueCreate(BaseModel):
    """Request to create/update attribute value"""
    personnel_id: int = Field(..., description="Personnel ID")
    attribute_id: int = Field(..., description="Attribute ID")
    
    # Value based on type
    value_text: Optional[str] = Field(None, description="Text value")
    value_number: Optional[float] = Field(None, description="Number value")
    value_date: Optional[datetime] = Field(None, description="Date value")
    value_boolean: Optional[bool] = Field(None, description="Boolean value")
    value_json: Optional[Dict[str, Any]] = Field(None, description="JSON value for complex data")
    
    notes: Optional[str] = Field(None, max_length=500, description="Value notes")


class CustomAttributeValueResponse(BaseModel):
    """Custom attribute value response model"""
    id: int
    personnel_id: int
    attribute_id: int
    attribute_code: str
    attribute_name: str
    attribute_type: AttributeType
    
    # Value based on type
    value_text: Optional[str]
    value_number: Optional[float]
    value_date: Optional[datetime]
    value_boolean: Optional[bool]
    value_json: Optional[Dict[str, Any]]
    file_path: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    mime_type: Optional[str]
    
    # Validation status
    is_valid: bool
    validation_errors: Optional[List[str]]
    
    # Audit trail
    created_by: Optional[int]
    updated_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    notes: Optional[str]
    
    # Personnel info
    personnel_name: Optional[str]
    personnel_badge_id: Optional[str]


class AttributeTemplateCreate(BaseModel):
    """Request to create attribute template"""
    template_name: str = Field(..., min_length=1, max_length=100, description="Template name")
    template_code: str = Field(..., min_length=1, max_length=50, description="Template code")
    description: Optional[str] = Field(None, max_length=500, description="Template description")
    attributes: List[Dict[str, Any]] = Field(..., description="List of attribute definitions")
    category: Optional[str] = Field(None, max_length=50, description="Template category")
    is_system_template: Optional[bool] = Field(False, description="System template")


class AttributeTemplateResponse(BaseModel):
    """Attribute template response model"""
    id: int
    template_name: str
    template_code: str
    description: Optional[str]
    attributes: List[Dict[str, Any]]
    category: Optional[str]
    is_system_template: bool
    is_active: bool
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    usage_count: int
    last_used: Optional[datetime]
    notes: Optional[str]


class BulkAttributeCreate(BaseModel):
    """Bulk attribute creation request"""
    attributes: List[CustomAttributeCreate] = Field(..., max_items=50, description="List of attributes to create")


class BulkAttributeResponse(BaseModel):
    """Bulk attribute creation response"""
    total_attributes: int
    successful_creations: int
    failed_creations: int
    created_attributes: List[CustomAttributeResponse]
    errors: List[Dict[str, Any]]


class AttributeSearchResponse(BaseModel):
    """Attribute search response"""
    attributes: List[CustomAttributeResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class AttributeValidationRequest(BaseModel):
    """Request to validate attribute value"""
    attribute_value_id: int = Field(..., description="Attribute value ID")
    validation_rules: Optional[List[Dict[str, Any]]] = Field(None, description="Validation rules to apply")


class AttributeValidationResponse(BaseModel):
    """Attribute validation response model"""
    id: int
    attribute_value_id: int
    validation_results: List[Dict[str, Any]]
    is_valid: bool
    validated_at: datetime


class FileUploadResponse(BaseModel):
    """File upload response model"""
    file_path: str
    file_name: str
    file_size: int
    mime_type: str
    upload_url: Optional[str] = None


class AttributeStatisticsResponse(BaseModel):
    """Attribute statistics response"""
    total_attributes: int
    active_attributes: int
    attributes_by_type: Dict[str, int]
    attributes_by_category: Dict[str, int]
    total_values: int
    validation_errors: int
    template_usage: Dict[str, int]
    most_used_attributes: List[Dict[str, Any]]

