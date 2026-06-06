"""
BioTime Data Mapper

This module provides data mapping between POB system format and ZKTeco BioTime format,
ensuring seamless data transformation and compatibility between the two systems.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from ..models.personnel import Personnel, AttendanceLog

logger = logging.getLogger(__name__)


class BioTimeMapper:
    """Data mapper between POB and BioTime formats"""
    
    def map_pob_to_biotime_personnel(self, personnel: Personnel) -> Dict[str, Any]:
        """
        Map POB personnel data to BioTime format
        
        Args:
            personnel: POB Personnel model instance
            
        Returns:
            BioTime format personnel data
        """
        try:
            # Map basic personnel information
            biotime_data = {
                "employee_id": personnel.badge_id,
                "name": personnel.full_name,
                "email": personnel.email or "",
                "phone": personnel.phone or "",
                "company": personnel.company,
                "department": personnel.department or "",
                "position": personnel.role,
                "employee_type": personnel.personnel_type or "STAFF",
                "status": personnel.status.value if personnel.status else "active",
                "created_date": personnel.created_at.isoformat() if personnel.created_at else None,
                "updated_date": personnel.updated_at.isoformat() if personnel.updated_at else None
            }
            
            # Map biometric data
            if personnel.biometric_data:
                biometric_templates = {
                    "fingerprint": [],
                    "face": []
                }
                
                # Add fingerprint templates
                if personnel.fingerprint_templates:
                    for template in personnel.fingerprint_templates:
                        biometric_templates["fingerprint"].append({
                            "template": template.get("template", ""),
                            "quality": template.get("quality", 0),
                            "finger_index": template.get("finger_index", 0),
                            "enrollment_date": template.get("enrollment_date", datetime.utcnow().isoformat())
                        })
                
                # Add face template
                if personnel.face_template:
                    biometric_templates["face"].append({
                        "template": personnel.face_template,
                        "quality": personnel.biometric_data.get("face_quality", 0),
                        "enrollment_date": personnel.biometric_data.get("face_enrollment_date", datetime.utcnow().isoformat())
                    })
                
                biotime_data["biometric_templates"] = biometric_templates
                biotime_data["biometric_enrolled"] = personnel.biometric_enrolled
            
            # Map device access permissions
            device_access = []
            if personnel.current_zone_id:
                device_access.append({
                    "zone_id": personnel.current_zone_id,
                    "access_level": "standard",
                    "valid_from": personnel.created_at.isoformat() if personnel.created_at else None,
                    "valid_to": None
                })
            biotime_data["device_access"] = device_access
            
            # Map certifications
            if personnel.certifications:
                certifications = []
                for cert in personnel.certifications:
                    certifications.append({
                        "name": cert.get("name", ""),
                        "number": cert.get("number", ""),
                        "issuer": cert.get("issuer", ""),
                        "issue_date": cert.get("issue_date"),
                        "expiry_date": cert.get("expiry_date"),
                        "status": cert.get("status", "unknown")
                    })
                biotime_data["certifications"] = certifications
            
            # Map emergency information
            emergency_info = {}
            if personnel.emergency_contact:
                emergency_info["contacts"] = personnel.emergency_contact
            if personnel.blood_group:
                emergency_info["blood_group"] = personnel.blood_group
            if personnel.medical_conditions:
                emergency_info["medical_conditions"] = personnel.medical_conditions
            if emergency_info:
                biotime_data["emergency_info"] = emergency_info
            
            return biotime_data
            
        except Exception as e:
            logger.error(f"Error mapping POB to BioTime personnel: {str(e)}")
            raise
    
    def map_biotime_to_pob_personnel(self, biotime_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map BioTime personnel data to POB format
        
        Args:
            biotime_data: BioTime personnel data
            
        Returns:
            POB format personnel data
        """
        try:
            # Map basic personnel information
            pob_data = {
                "badge_id": biotime_data.get("employee_id", ""),
                "full_name": biotime_data.get("name", ""),
                "email": biotime_data.get("email"),
                "phone": biotime_data.get("phone"),
                "company": biotime_data.get("company", ""),
                "department": biotime_data.get("department"),
                "role": biotime_data.get("position", ""),
                "personnel_type": biotime_data.get("employee_type", "STAFF"),
                "status": biotime_data.get("status", "active"),
                "biometric_enrolled": biotime_data.get("biometric_enrolled", False)
            }
            
            # Map biometric data
            biometric_templates = biotime_data.get("biometric_templates", {})
            pob_biometric_data = {}
            pob_fingerprint_templates = []
            
            # Map fingerprint templates
            fingerprint_templates = biometric_templates.get("fingerprint", [])
            for template in fingerprint_templates:
                pob_fingerprint_templates.append({
                    "template": template.get("template", ""),
                    "quality": template.get("quality", 0),
                    "finger_index": template.get("finger_index", 0),
                    "enrollment_date": template.get("enrollment_date")
                })
            
            if pob_fingerprint_templates:
                pob_data["fingerprint_templates"] = pob_fingerprint_templates
                pob_biometric_data["last_fingerprint_enroll"] = max(
                    [t.get("enrollment_date") for t in pob_fingerprint_templates if t.get("enrollment_date")],
                    default=None
                )
            
            # Map face template
            face_templates = biometric_templates.get("face", [])
            if face_templates:
                face_template = face_templates[0]  # Take first face template
                pob_data["face_template"] = face_template.get("template", "")
                pob_biometric_data["face_quality"] = face_template.get("quality", 0)
                pob_biometric_data["last_face_enroll"] = face_template.get("enrollment_date")
            
            if pob_biometric_data:
                pob_data["biometric_data"] = pob_biometric_data
            
            # Map certifications
            certifications = biotime_data.get("certifications", [])
            if certifications:
                pob_certifications = []
                for cert in certifications:
                    pob_certifications.append({
                        "id": cert.get("id"),
                        "name": cert.get("name", ""),
                        "number": cert.get("number", ""),
                        "issuer": cert.get("issuer", ""),
                        "issue_date": cert.get("issue_date"),
                        "expiry_date": cert.get("expiry_date"),
                        "status": cert.get("status", "unknown"),
                        "verification_status": "pending"
                    })
                pob_data["certifications"] = pob_certifications
            
            # Map emergency information
            emergency_info = biotime_data.get("emergency_info", {})
            if emergency_info:
                if "contacts" in emergency_info:
                    pob_data["emergency_contact"] = emergency_info["contacts"]
                if "blood_group" in emergency_info:
                    pob_data["blood_group"] = emergency_info["blood_group"]
                if "medical_conditions" in emergency_info:
                    pob_data["medical_conditions"] = emergency_info["medical_conditions"]
            
            return pob_data
            
        except Exception as e:
            logger.error(f"Error mapping BioTime to POB personnel: {str(e)}")
            raise
    
    def map_pob_to_biotime_attendance(self, attendance: AttendanceLog) -> Dict[str, Any]:
        """
        Map POB attendance data to BioTime format
        
        Args:
            attendance: POB AttendanceLog model instance
            
        Returns:
            BioTime format attendance data
        """
        try:
            biotime_attendance = {
                "employee_id": attendance.personnel.badge_id if attendance.personnel else "",
                "timestamp": attendance.timestamp.isoformat() if attendance.timestamp else None,
                "device_id": attendance.device_id or "",
                "device_type": attendance.device_type or "",
                "punch_type": attendance.event_type.upper() if attendance.event_type else "CHECKIN",
                "verification_method": attendance.verification_method or "",
                "verification_score": attendance.verification_score,
                "network_type": attendance.network_type or ""
            }
            
            # Add raw data if available
            if attendance.raw_data:
                biotime_attendance["raw_data"] = attendance.raw_data
            
            return biotime_attendance
            
        except Exception as e:
            logger.error(f"Error mapping POB to BioTime attendance: {str(e)}")
            raise
    
    def map_biotime_to_pob_attendance(self, biotime_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map BioTime attendance data to POB format
        
        Args:
            biotime_data: BioTime attendance data
            
        Returns:
            POB format attendance data
        """
        try:
            # Convert BioTime punch type to POB event type
            punch_type = biotime_data.get("punch_type", "CHECKIN").upper()
            if punch_type in ["IN", "CHECKIN"]:
                event_type = "check_in"
            elif punch_type in ["OUT", "CHECKOUT"]:
                event_type = "check_out"
            else:
                event_type = punch_type.lower()
            
            pob_attendance = {
                "badge_id": biotime_data.get("employee_id", ""),
                "timestamp": biotime_data.get("timestamp"),
                "device_id": biotime_data.get("device_id", ""),
                "device_type": biotime_data.get("device_type", ""),
                "event_type": event_type,
                "verification_method": biotime_data.get("verification_method", ""),
                "verification_score": biotime_data.get("verification_score"),
                "network_type": biotime_data.get("network_type", ""),
                "raw_data": biotime_data.get("raw_data", {})
            }
            
            return pob_attendance
            
        except Exception as e:
            logger.error(f"Error mapping BioTime to POB attendance: {str(e)}")
            raise
    
    def map_biometric_template(self, template_data: Dict[str, Any], 
                           biometric_type: str) -> Dict[str, Any]:
        """
        Map biometric template data to BioTime format
        
        Args:
            template_data: Raw template data
            biometric_type: Type of biometric (fingerprint, face)
            
        Returns:
            BioTime format template data
        """
        try:
            biotime_template = {
                "template_type": biometric_type,
                "template_data": template_data.get("template", ""),
                "quality_score": template_data.get("quality", 0),
                "enrollment_date": datetime.utcnow().isoformat(),
                "status": "active"
            }
            
            if biometric_type == "fingerprint":
                biotime_template.update({
                    "finger_index": template_data.get("finger_index", 0),
                    "template_format": "iso_19794_2",
                    "image_data": template_data.get("image_data", "")
                })
            elif biometric_type == "face":
                biotime_template.update({
                    "template_format": "face_recognition_v2",
                    "confidence_threshold": template_data.get("confidence", 0.8),
                    "image_data": template_data.get("image_data", "")
                })
            
            return biotime_template
            
        except Exception as e:
            logger.error(f"Error mapping biometric template: {str(e)}")
            raise
    
    def map_access_level(self, access_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map access level data to BioTime format
        
        Args:
            access_data: Access level data
            
        Returns:
            BioTime format access level data
        """
        try:
            return {
                "level_id": access_data.get("level_id", ""),
                "level_name": access_data.get("level_name", ""),
                "description": access_data.get("description", ""),
                "permissions": access_data.get("permissions", []),
                "time_restrictions": access_data.get("time_restrictions", {}),
                "device_permissions": access_data.get("device_permissions", []),
                "is_active": access_data.get("is_active", True)
            }
            
        except Exception as e:
            logger.error(f"Error mapping access level: {str(e)}")
            raise
    
    def validate_biotime_data(self, data: Dict[str, Any], data_type: str) -> Dict[str, Any]:
        """
        Validate BioTime data format
        
        Args:
            data: Data to validate
            data_type: Type of data (personnel, attendance, biometric)
            
        Returns:
            Validation result
        """
        try:
            result = {
                "valid": True,
                "errors": [],
                "warnings": []
            }
            
            if data_type == "personnel":
                # Required fields for personnel
                required_fields = ["employee_id", "name"]
                for field in required_fields:
                    if not data.get(field):
                        result["valid"] = False
                        result["errors"].append(f"Missing required field: {field}")
                
                # Validate email format if provided
                if data.get("email"):
                    import re
                    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                    if not re.match(email_pattern, data["email"]):
                        result["valid"] = False
                        result["errors"].append("Invalid email format")
            
            elif data_type == "attendance":
                # Required fields for attendance
                required_fields = ["employee_id", "timestamp", "punch_type"]
                for field in required_fields:
                    if not data.get(field):
                        result["valid"] = False
                        result["errors"].append(f"Missing required field: {field}")
                
                # Validate timestamp format
                if data.get("timestamp"):
                    try:
                        datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
                    except ValueError:
                        result["valid"] = False
                        result["errors"].append("Invalid timestamp format")
            
            elif data_type == "biometric":
                # Required fields for biometric
                required_fields = ["template_type", "template_data"]
                for field in required_fields:
                    if not data.get(field):
                        result["valid"] = False
                        result["errors"].append(f"Missing required field: {field}")
                
                # Validate quality score
                quality = data.get("quality_score", 0)
                if not isinstance(quality, (int, float)) or quality < 0 or quality > 100:
                    result["valid"] = False
                    result["errors"].append("Quality score must be between 0 and 100")
            
            return result
            
        except Exception as e:
            logger.error(f"Error validating BioTime data: {str(e)}")
            return {
                "valid": False,
                "errors": [str(e)],
                "warnings": []
            }
