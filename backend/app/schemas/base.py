"""
Base schemas for API responses
Common response models used across the application
"""

from typing import Generic, TypeVar, Optional, Any, List
from pydantic import BaseModel
from pydantic.generics import GenericModel

T = TypeVar('T')

class APIResponse(GenericModel, Generic[T]):
    """Standard API response wrapper"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None
    errors: Optional[List[str]] = None
    
    class Config:
        from_attributes = True

class PaginatedResponse(GenericModel, Generic[T]):
    """Paginated response wrapper"""
    success: bool = True
    data: List[T] = []
    total: int = 0
    page: int = 1
    per_page: int = 10
    pages: int = 0
    
    class Config:
        from_attributes = True

class BaseSchema(BaseModel):
    """Base schema with common fields"""
    
    class Config:
        from_attributes = True
        populate_by_name = True

class TimestampedSchema(BaseSchema):
    """Base schema with timestamp fields"""
    id: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ErrorResponse(BaseModel):
    """Standard error response"""
    success: bool = False
    message: str
    error_code: Optional[str] = None
    details: Optional[dict] = None
    
    class Config:
        from_attributes = True

class SuccessResponse(BaseModel):
    """Standard success response"""
    success: bool = True
    message: str
    data: Optional[Any] = None
    
    class Config:
        from_attributes = True
