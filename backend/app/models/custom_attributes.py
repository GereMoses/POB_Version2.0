"""
Custom Attributes Database Models
Supports dynamic custom fields for personnel management
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base
import enum


class AttributeType(str, enum.Enum):
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


class ValidationRule(str, enum.Enum):
    REQUIRED = "REQUIRED"
    OPTIONAL = "OPTIONAL"
    MIN_LENGTH = "MIN_LENGTH"
    MAX_LENGTH = "MAX_LENGTH"
    MIN_VALUE = "MIN_VALUE"
    MAX_VALUE = "MAX_VALUE"
    EMAIL_FORMAT = "EMAIL_FORMAT"
    PHONE_FORMAT = "PHONE_FORMAT"
    REGEX_PATTERN = "REGEX_PATTERN"


class CustomAttribute(Base):
    """Custom attribute definitions"""
    __tablename__ = "custom_attributes"
    
    id = Column(Integer, primary_key=True, index=True)
    attribute_code = Column(String(50), unique=True, nullable=False, index=True)
    attribute_name = Column(String(100), nullable=False, index=True)
    attribute_type = Column(Enum(AttributeType), nullable=False)
    description = Column(Text, nullable=True)
    
    # Validation rules
    validation_rules = Column(JSON, nullable=True)  # List of validation rules
    default_value = Column(JSON, nullable=True)  # Default value for new personnel
    
    # Display options
    display_options = Column(JSON, nullable=True)  # Options for SELECT/MULTI_SELECT
    placeholder_text = Column(String(100), nullable=True)  # Placeholder for form input
    
    # Category and grouping
    category = Column(String(50), nullable=True, index=True)  # Personal, Professional, Medical, Emergency
    group_name = Column(String(50), nullable=True, index=True)  # Group related attributes
    sort_order = Column(Integer, default=0)  # Display order
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    is_required = Column(Boolean, default=False, index=True)
    is_searchable = Column(Boolean, default=True, index=True)
    is_visible_in_list = Column(Boolean, default=True, index=True)
    
    # Permissions
    read_permissions = Column(JSON, nullable=True)  # Roles that can read this attribute
    write_permissions = Column(JSON, nullable=True)  # Roles that can write this attribute
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    attribute_values = relationship("CustomAttributeValue", back_populates="attribute")


class CustomAttributeValue(Base):
    """Custom attribute values for personnel"""
    __tablename__ = "custom_attribute_values"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False, index=True)
    attribute_id = Column(Integer, ForeignKey("custom_attributes.id"), nullable=False, index=True)
    value_text = Column(Text, nullable=True)  # For TEXT type
    value_number = Column(Float, nullable=True)  # For NUMBER type
    value_date = Column(DateTime(timezone=True), nullable=True)  # For DATE type
    value_boolean = Column(Boolean, nullable=True)  # For BOOLEAN type
    value_json = Column(JSON, nullable=True)  # For complex data types
    file_path = Column(String(500), nullable=True)  # For FILE type
    file_name = Column(String(255), nullable=True)  # Original file name
    file_size = Column(Integer, nullable=True)  # File size in bytes
    mime_type = Column(String(100), nullable=True)  # File MIME type
    
    # Validation status
    is_valid = Column(Boolean, default=True)  # Whether the value passes validation
    validation_errors = Column(JSON, nullable=True)  # Validation error messages
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    personnel = relationship("Personnel")
    attribute = relationship("CustomAttribute", back_populates="attribute_values")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])


class AttributeTemplate(Base):
    """Custom attribute templates"""
    __tablename__ = "attribute_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    template_name = Column(String(100), nullable=False, index=True)
    template_code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Template configuration
    attributes = Column(JSON, nullable=False)  # List of attribute definitions
    category = Column(String(50), nullable=True, index=True)  # Template category
    is_system_template = Column(Boolean, default=False)  # System vs user template
    is_active = Column(Boolean, default=True, index=True)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime(timezone=True), nullable=True)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])


class AttributeValidation(Base):
    """Attribute validation rules and results"""
    __tablename__ = "attribute_validations"
    
    id = Column(Integer, primary_key=True, index=True)
    attribute_value_id = Column(Integer, ForeignKey("custom_attribute_values.id"), nullable=False, index=True)
    validation_rule = Column(Enum(ValidationRule), nullable=False)
    validation_parameters = Column(JSON, nullable=True)  # Parameters for validation (min_length, regex, etc.)
    is_valid = Column(Boolean, default=False)  # Validation result
    error_message = Column(Text, nullable=True)  # Error message if validation fails
    validated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    attribute_value = relationship("CustomAttributeValue")


# Add relationships to Personnel model
# Personnel.custom_attributes = relationship("CustomAttributeValue", back_populates="personnel")
