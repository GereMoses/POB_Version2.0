"""
Custom Attributes Service
Handles dynamic custom fields for personnel management
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
import re
import asyncio

from ..core.database import get_db
from ..models.custom_attributes import (
    CustomAttribute, CustomAttributeValue, AttributeTemplate, AttributeValidation
)
from ..models.personnel import Personnel

logger = logging.getLogger(__name__)


class CustomAttributesService:
    """Service for custom attributes management operations"""
    
    def __init__(self):
        self.attribute_cache = {}
        
    async def get_attributes(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        attribute_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get custom attributes with filtering and pagination"""
        try:
            query = db.query(CustomAttribute)
            
            # Apply filters
            if search:
                query = query.filter(
                    or_(
                        CustomAttribute.attribute_name.ilike(f"%{search}%"),
                        CustomAttribute.attribute_code.ilike(f"%{search}%"),
                        CustomAttribute.description.ilike(f"%{search}%")
                    )
                )
            
            if category:
                query = query.filter(CustomAttribute.category == category)
            
            if attribute_type:
                query = query.filter(CustomAttribute.attribute_type == attribute_type)
            
            if is_active is not None:
                query = query.filter(CustomAttribute.is_active == is_active)
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            attributes = query.order_by(CustomAttribute.sort_order, CustomAttribute.attribute_name).offset(skip).limit(limit).all()
            
            # Enhance with statistics
            result_attributes = []
            for attribute in attributes:
                attribute_data = {
                    "id": attribute.id,
                    "attribute_code": attribute.attribute_code,
                    "attribute_name": attribute.attribute_name,
                    "attribute_type": attribute.attribute_type.value,
                    "description": attribute.description,
                    "validation_rules": attribute.validation_rules,
                    "default_value": attribute.default_value,
                    "display_options": attribute.display_options,
                    "placeholder_text": attribute.placeholder_text,
                    "category": attribute.category,
                    "group_name": attribute.group_name,
                    "sort_order": attribute.sort_order,
                    "is_active": attribute.is_active,
                    "is_required": attribute.is_required,
                    "is_searchable": attribute.is_searchable,
                    "is_visible_in_list": attribute.is_visible_in_list,
                    "read_permissions": attribute.read_permissions,
                    "write_permissions": attribute.write_permissions,
                    "created_by": attribute.created_by,
                    "updated_by": attribute.updated_by,
                    "created_at": attribute.created_at,
                    "updated_at": attribute.updated_at,
                    "notes": attribute.notes,
                    "usage_count": self._get_attribute_usage_count(attribute.id, db),
                    "last_used": self._get_last_used_date(attribute.id, db)
                }
                
                result_attributes.append(attribute_data)
            
            return {
                "success": True,
                "data": result_attributes,
                "total_count": total_count,
                "skip": skip,
                "limit": limit
            }
            
        except Exception as e:
            logger.error(f"Error getting attributes: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_attribute_by_id(
        self,
        attribute_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """Get attribute by ID"""
        try:
            attribute = db.query(CustomAttribute).filter(CustomAttribute.id == attribute_id).first()
            
            if not attribute:
                return {"success": False, "error": "Attribute not found"}
            
            attribute_data = {
                "id": attribute.id,
                "attribute_code": attribute.attribute_code,
                "attribute_name": attribute.attribute_name,
                "attribute_type": attribute.attribute_type.value,
                "description": attribute.description,
                "validation_rules": attribute.validation_rules,
                "default_value": attribute.default_value,
                "display_options": attribute.display_options,
                "placeholder_text": attribute.placeholder_text,
                "category": attribute.category,
                "group_name": attribute.group_name,
                "sort_order": attribute.sort_order,
                "is_active": attribute.is_active,
                "is_required": attribute.is_required,
                "is_searchable": attribute.is_searchable,
                "is_visible_in_list": attribute.is_visible_in_list,
                "read_permissions": attribute.read_permissions,
                "write_permissions": attribute.write_permissions,
                "created_by": attribute.created_by,
                "updated_by": attribute.updated_by,
                "created_at": attribute.created_at,
                "updated_at": attribute.updated_at,
                "notes": attribute.notes,
                "usage_count": self._get_attribute_usage_count(attribute.id, db),
                "last_used": self._get_last_used_date(attribute.id, db)
            }
            
            return {
                "success": True,
                "data": attribute_data
            }
            
        except Exception as e:
            logger.error(f"Error getting attribute: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def create_attribute(
        self,
        attribute_data: dict,
        db: Session,
        created_by: int = 1
    ) -> Dict[str, Any]:
        """Create new custom attribute"""
        try:
            # Check if attribute code already exists
            existing = db.query(CustomAttribute).filter(
                CustomAttribute.attribute_code == attribute_data["attribute_code"]
            ).first()
            
            if existing:
                return {"success": False, "error": "Attribute code already exists"}
            
            # Create attribute
            attribute = CustomAttribute(
                attribute_code=attribute_data["attribute_code"],
                attribute_name=attribute_data["attribute_name"],
                attribute_type=attribute_data["attribute_type"],
                description=attribute_data.get("description"),
                validation_rules=attribute_data.get("validation_rules"),
                default_value=attribute_data.get("default_value"),
                display_options=attribute_data.get("display_options"),
                placeholder_text=attribute_data.get("placeholder_text"),
                category=attribute_data.get("category"),
                group_name=attribute_data.get("group_name"),
                sort_order=attribute_data.get("sort_order", 0),
                is_required=attribute_data.get("is_required", False),
                is_searchable=attribute_data.get("is_searchable", True),
                is_visible_in_list=attribute_data.get("is_visible_in_list", True),
                read_permissions=attribute_data.get("read_permissions", []),
                write_permissions=attribute_data.get("write_permissions", []),
                created_by=created_by,
                notes=attribute_data.get("notes")
            )
            
            db.add(attribute)
            db.commit()
            db.refresh(attribute)
            
            logger.info(f"Created custom attribute {attribute_data['attribute_code']}")
            
            return {
                "success": True,
                "data": {
                    "id": attribute.id,
                    "attribute_code": attribute.attribute_code,
                    "attribute_name": attribute.attribute_name
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating attribute: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def update_attribute(
        self,
        attribute_id: int,
        update_data: dict,
        db: Session,
        updated_by: int = 1
    ) -> Dict[str, Any]:
        """Update existing attribute"""
        try:
            attribute = db.query(CustomAttribute).filter(CustomAttribute.id == attribute_id).first()
            
            if not attribute:
                return {"success": False, "error": "Attribute not found"}
            
            # Update fields
            for field, value in update_data.items():
                if hasattr(attribute, field):
                    setattr(attribute, field, value)
            
            attribute.updated_by = updated_by
            db.commit()
            
            logger.info(f"Updated attribute {attribute_id}")
            
            return {
                "success": True,
                "data": {
                    "id": attribute.id,
                    "attribute_code": attribute.attribute_code,
                    "attribute_name": attribute.attribute_name
                }
            }
            
        except Exception as e:
            logger.error(f"Error updating attribute: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def delete_attribute(
        self,
        attribute_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """Delete attribute (soft delete)"""
        try:
            attribute = db.query(CustomAttribute).filter(CustomAttribute.id == attribute_id).first()
            
            if not attribute:
                return {"success": False, "error": "Attribute not found"}
            
            # Check if attribute has values
            value_count = db.query(CustomAttributeValue).filter(
                CustomAttributeValue.attribute_id == attribute_id
            ).count()
            
            if value_count > 0:
                return {
                    "success": False,
                    "error": f"Cannot delete attribute with {value_count} existing values"
                }
            
            # Soft delete
            attribute.is_active = False
            db.commit()
            
            logger.info(f"Deleted attribute {attribute_id}")
            
            return {
                "success": True,
                "message": "Attribute deleted successfully"
            }
            
        except Exception as e:
            logger.error(f"Error deleting attribute: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_personnel_attributes(
        self,
        personnel_id: int,
        db: Session,
        attribute_ids: Optional[List[int]] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get personnel's custom attribute values"""
        try:
            query = db.query(CustomAttributeValue).filter(
                CustomAttributeValue.personnel_id == personnel_id
            )
            
            if attribute_ids:
                query = query.filter(CustomAttributeValue.attribute_id.in_(attribute_ids))
            
            if category:
                query = query.join(CustomAttribute).filter(
                    CustomAttribute.category == category
                )
            
            values = query.order_by(CustomAttribute.sort_order).all()
            
            result_values = []
            for value in values:
                value_data = {
                    "id": value.id,
                    "personnel_id": value.personnel_id,
                    "attribute_id": value.attribute_id,
                    "attribute_code": value.attribute.attribute_code,
                    "attribute_name": value.attribute.attribute_name,
                    "attribute_type": value.attribute.attribute_type.value,
                    
                    # Value based on type
                    "value_text": value.value_text,
                    "value_number": value.value_number,
                    "value_date": value.value_date,
                    "value_boolean": value.value_boolean,
                    "value_json": value.value_json,
                    "file_path": value.file_path,
                    "file_name": value.file_name,
                    "file_size": value.file_size,
                    "mime_type": value.mime_type,
                    
                    # Validation status
                    "is_valid": value.is_valid,
                    "validation_errors": value.validation_errors,
                    
                    # Audit trail
                    "created_by": value.created_by,
                    "updated_by": value.updated_by,
                    "created_at": value.created_at,
                    "updated_at": value.updated_at,
                    "notes": value.notes
                }
                
                result_values.append(value_data)
            
            return {
                "success": True,
                "data": result_values
            }
            
        except Exception as e:
            logger.error(f"Error getting personnel attributes: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def set_personnel_attribute(
        self,
        personnel_id: int,
        attribute_id: int,
        value_data: dict,
        db: Session,
        updated_by: int = 1
    ) -> Dict[str, Any]:
        """Set personnel attribute value"""
        try:
            # Get attribute for validation
            attribute = db.query(CustomAttribute).filter(CustomAttribute.id == attribute_id).first()
            
            if not attribute:
                return {"success": False, "error": "Attribute not found"}
            
            # Validate value
            validation_result = await self._validate_attribute_value(
                attribute, value_data, db
            )
            
            if not validation_result["is_valid"]:
                return {
                    "success": False,
                    "error": f"Validation failed: {validation_result['error']}"
                }
            
            # Check if value exists
            existing_value = db.query(CustomAttributeValue).filter(
                and_(
                    CustomAttributeValue.personnel_id == personnel_id,
                    CustomAttributeValue.attribute_id == attribute_id
                )
            ).first()
            
            # Create or update value
            if existing_value:
                # Update existing value
                for field, value in value_data.items():
                    if hasattr(existing_value, field) and field != "personnel_id" and field != "attribute_id":
                        setattr(existing_value, field, value)
                
                existing_value.updated_by = updated_by
                existing_value.updated_at = datetime.utcnow()
                db.commit()
                
                logger.info(f"Updated attribute value for personnel {personnel_id}, attribute {attribute_id}")
            else:
                # Create new value
                value_obj = self._create_value_object(attribute, value_data)
                
                attribute_value = CustomAttributeValue(
                    personnel_id=personnel_id,
                    attribute_id=attribute_id,
                    created_by=updated_by,
                    is_valid=validation_result["is_valid"],
                    validation_errors=validation_result.get("errors", [])
                )
                
                # Set value based on type
                for field, value in value_data.items():
                    if hasattr(attribute_value, field):
                        setattr(attribute_value, field, value)
                
                db.add(attribute_value)
                db.commit()
                db.refresh(attribute_value)
                
                logger.info(f"Created attribute value for personnel {personnel_id}, attribute {attribute_id}")
            
            return {
                "success": True,
                "data": {
                    "id": attribute_value.id if not existing_value else None,
                    "action": "updated" if existing_value else "created"
                }
            }
            
        except Exception as e:
            logger.error(f"Error setting personnel attribute: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def validate_attribute_value(
        self,
        attribute_value_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """Validate attribute value"""
        try:
            value_obj = db.query(CustomAttributeValue).filter(
                CustomAttributeValue.id == attribute_value_id
            ).first()
            
            if not value_obj:
                return {"success": False, "error": "Attribute value not found"}
            
            # Get attribute for validation rules
            attribute = db.query(CustomAttribute).filter(
                CustomAttribute.id == value_obj.attribute_id
            ).first()
            
            if not attribute:
                return {"success": False, "error": "Attribute not found"}
            
            validation_result = await self._validate_value_by_rules(
                value_obj, attribute.validation_rules
            )
            
            # Update validation status
            value_obj.is_valid = validation_result["is_valid"]
            value_obj.validation_errors = validation_result.get("errors", [])
            value_obj.validated_at = datetime.utcnow()
            db.commit()
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating attribute value: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def _validate_value_by_rules(
        self,
        value_obj: CustomAttributeValue,
        validation_rules: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Validate value against rules"""
        try:
            errors = []
            
            for rule in validation_rules:
                rule_type = rule.get("type")
                rule_value = rule.get("value")
                
                if rule_type == "REQUIRED":
                    if not self._has_value(value_obj):
                        errors.append(f"Field {rule.get('field')} is required")
                
                elif rule_type == "MIN_LENGTH":
                    min_length = rule.get("min_length")
                    if self._get_value_length(value_obj) < min_length:
                        errors.append(f"Field {rule.get('field')} must be at least {min_length} characters")
                
                elif rule_type == "MAX_LENGTH":
                    max_length = rule.get("max_length")
                    if self._get_value_length(value_obj) > max_length:
                        errors.append(f"Field {rule.get('field')} must not exceed {max_length} characters")
                
                elif rule_type == "EMAIL_FORMAT":
                    email_value = self._get_text_value(value_obj)
                    if not self._is_valid_email(email_value):
                        errors.append(f"Field {rule.get('field')} must be a valid email address")
                
                elif rule_type == "REGEX_PATTERN":
                    pattern = rule.get("pattern")
                    text_value = self._get_text_value(value_obj)
                    if not re.match(pattern, text_value):
                        errors.append(f"Field {rule.get('field')} format is invalid")
            
            return {
                "is_valid": len(errors) == 0,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error validating value by rules: {str(e)}")
            return {
                "is_valid": False,
                "errors": [f"Validation error: {str(e)}"]
            }
    
    def _create_value_object(self, attribute: CustomAttribute, value_data: dict) -> CustomAttributeValue:
        """Create value object based on attribute type"""
        value_obj = CustomAttributeValue()
        
        if attribute.attribute_type.value == "TEXT":
            value_obj.value_text = value_data.get("value_text")
        elif attribute.attribute_type.value == "NUMBER":
            value_obj.value_number = value_data.get("value_number")
        elif attribute.attribute_type.value == "DATE":
            value_obj.value_date = value_data.get("value_date")
        elif attribute.attribute_type.value == "BOOLEAN":
            value_obj.value_boolean = value_data.get("value_boolean")
        elif attribute.attribute_type.value == "JSON":
            value_obj.value_json = value_data.get("value_json")
        
        return value_obj
    
    def _has_value(self, value_obj: CustomAttributeValue) -> bool:
        """Check if value object has any value"""
        return any([
            value_obj.value_text,
            value_obj.value_number is not None,
            value_obj.value_date,
            value_obj.value_boolean is not None,
            value_obj.value_json
        ])
    
    def _get_value_length(self, value_obj: CustomAttributeValue) -> int:
        """Get length of text value"""
        return len(value_obj.value_text or "")
    
    def _get_text_value(self, value_obj: CustomAttributeValue) -> str:
        """Get text value"""
        return value_obj.value_text or ""
    
    def _is_valid_email(self, email: str) -> bool:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    def _get_attribute_usage_count(self, attribute_id: int, db: Session) -> int:
        """Get usage count for attribute"""
        try:
            return db.query(CustomAttributeValue).filter(
                CustomAttributeValue.attribute_id == attribute_id
            ).count()
        except Exception as e:
            logger.error(f"Error getting attribute usage count: {str(e)}")
            return 0
    
    def _get_last_used_date(self, attribute_id: int, db: Session) -> Optional[datetime]:
        """Get last used date for attribute"""
        try:
            last_value = db.query(CustomAttributeValue).filter(
                CustomAttributeValue.attribute_id == attribute_id
            ).order_by(desc(CustomAttributeValue.updated_at)).first()
            
            return last_value.updated_at if last_value else None
            
        except Exception as e:
            logger.error(f"Error getting last used date: {str(e)}")
            return None


# Create service instance
custom_attributes_service = CustomAttributesService()
