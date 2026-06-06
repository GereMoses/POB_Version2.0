"""
Custom exceptions for the application
Common exception classes used across the application
"""

from typing import Optional, Any, Dict, List

class BaseCustomException(Exception):
    """Base custom exception"""
    
    def __init__(self, message: str, error_code: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)

class ValidationError(BaseCustomException):
    """Validation error exception"""
    
    def __init__(self, message: str, field: Optional[str] = None, value: Optional[Any] = None):
        details = {}
        if field:
            details['field'] = field
        if value is not None:
            details['value'] = str(value)
        super().__init__(message, error_code='VALIDATION_ERROR', details=details)

class NotFoundError(BaseCustomException):
    """Resource not found exception"""
    
    def __init__(self, resource: str, identifier: Optional[str] = None):
        message = f"{resource} not found"
        if identifier:
            message += f" with identifier: {identifier}"
        details = {'resource': resource}
        if identifier:
            details['identifier'] = identifier
        super().__init__(message, error_code='NOT_FOUND', details=details)

class AuthenticationError(BaseCustomException):
    """Authentication error exception"""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, error_code='AUTHENTICATION_ERROR')

class AuthorizationError(BaseCustomException):
    """Authorization error exception"""
    
    def __init__(self, message: str = "Access denied"):
        super().__init__(message, error_code='AUTHORIZATION_ERROR')

class ConflictError(BaseCustomException):
    """Conflict error exception"""
    
    def __init__(self, message: str, resource: Optional[str] = None, conflict_details: Optional[Dict[str, Any]] = None):
        details = {}
        if resource:
            details['resource'] = resource
        if conflict_details:
            details.update(conflict_details)
        super().__init__(message, error_code='CONFLICT_ERROR', details=details)

class BusinessLogicError(BaseCustomException):
    """Business logic error exception"""
    
    def __init__(self, message: str, operation: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        details = {}
        if operation:
            details['operation'] = operation
        if context:
            details.update(context)
        super().__init__(message, error_code='BUSINESS_LOGIC_ERROR', details=details)

class ExternalServiceError(BaseCustomException):
    """External service error exception"""
    
    def __init__(self, message: str, service: Optional[str] = None, status_code: Optional[int] = None):
        details = {}
        if service:
            details['service'] = service
        if status_code:
            details['status_code'] = status_code
        super().__init__(message, error_code='EXTERNAL_SERVICE_ERROR', details=details)

class DatabaseError(BaseCustomException):
    """Database error exception"""
    
    def __init__(self, message: str, operation: Optional[str] = None, table: Optional[str] = None):
        details = {}
        if operation:
            details['operation'] = operation
        if table:
            details['table'] = table
        super().__init__(message, error_code='DATABASE_ERROR', details=details)

class ConfigurationError(BaseCustomException):
    """Configuration error exception"""
    
    def __init__(self, message: str, parameter: Optional[str] = None):
        details = {}
        if parameter:
            details['parameter'] = parameter
        super().__init__(message, error_code='CONFIGURATION_ERROR', details=details)

class RateLimitError(BaseCustomException):
    """Rate limit error exception"""
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: Optional[int] = None):
        details = {}
        if retry_after:
            details['retry_after'] = retry_after
        super().__init__(message, error_code='RATE_LIMIT_ERROR', details=details)

class FileUploadError(BaseCustomException):
    """File upload error exception"""
    
    def __init__(self, message: str, filename: Optional[str] = None, file_type: Optional[str] = None):
        details = {}
        if filename:
            details['filename'] = filename
        if file_type:
            details['file_type'] = file_type
        super().__init__(message, error_code='FILE_UPLOAD_ERROR', details=details)
