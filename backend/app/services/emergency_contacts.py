"""
Emergency Contact Management Service

This service handles emergency contact information management for personnel,
including contact details, emergency notifications, and contact verification.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..models.personnel import Personnel
from ..core.database import get_db


class EmergencyContactService:
    """Service for managing emergency contact information"""
    
    def __init__(self):
        # Standard emergency contact types
        self.contact_types = [
            "PRIMARY",
            "SECONDARY", 
            "MEDICAL",
            "NEXT_OF_KIN",
            "SUPERVISOR",
            "COMPANY_CONTACT",
            "EMERGENCY_SERVICES"
        ]
        
        # Standard emergency services
        self.emergency_services = {
            "POLICE": "999",
            "AMBULANCE": "998",
            "FIRE": "997",
            "COAST_GUARD": "998",
            "MEDICAL_EMERGENCY": "112",
            "SECURITY": "911"
        }
    
    async def add_emergency_contact(
        self,
        personnel_id: int,
        contact_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Add emergency contact to personnel record
        
        Args:
            personnel_id: Personnel ID
            contact_data: Contact details
            db: Database session
            
        Returns:
            Added contact information
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Validate contact data
        required_fields = ["full_name", "relationship", "phone"]
        for field in required_fields:
            if not contact_data.get(field):
                raise ValueError(f"Missing required field: {field}")
        
        # Create contact record
        contact_record = {
            "id": f"contact_{datetime.now(timezone.utc).timestamp()}",
            "full_name": contact_data.get('full_name'),
            "relationship": contact_data.get('relationship'),
            "phone": contact_data.get('phone'),
            "mobile": contact_data.get('mobile'),
            "email": contact_data.get('email'),
            "address": contact_data.get('address'),
            "city": contact_data.get('city'),
            "country": contact_data.get('country'),
            "postal_code": contact_data.get('postal_code'),
            "contact_type": contact_data.get('contact_type', 'PRIMARY'),
            "is_primary": contact_data.get('is_primary', False),
            "is_verified": contact_data.get('is_verified', False),
            "verification_date": contact_data.get('verification_date'),
            "notes": contact_data.get('notes'),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update personnel emergency contacts
        if not personnel.emergency_contact:
            personnel.emergency_contact = {
                "contacts": [],
                "medical_conditions": contact_data.get('medical_conditions', ''),
                "blood_group": contact_data.get('blood_group', ''),
                "allergies": contact_data.get('allergies', ''),
                "medications": contact_data.get('medications', ''),
                "special_instructions": contact_data.get('special_instructions', '')
            }
        
        # If setting as primary, clear existing primary
        if contact_record.get('is_primary'):
            for contact in personnel.emergency_contact.get('contacts', []):
                contact['is_primary'] = False
        
        personnel.emergency_contact['contacts'].append(contact_record)
        
        # Update medical information if provided
        if contact_data.get('medical_conditions'):
            personnel.emergency_contact['medical_conditions'] = contact_data['medical_conditions']
        if contact_data.get('blood_group'):
            personnel.emergency_contact['blood_group'] = contact_data['blood_group']
        if contact_data.get('allergies'):
            personnel.emergency_contact['allergies'] = contact_data['allergies']
        if contact_data.get('medications'):
            personnel.emergency_contact['medications'] = contact_data['medications']
        if contact_data.get('special_instructions'):
            personnel.emergency_contact['special_instructions'] = contact_data['special_instructions']
        
        db.commit()
        db.refresh(personnel)
        
        return {
            "success": True,
            "contact_id": contact_record["id"],
            "personnel_id": personnel_id,
            "full_name": contact_record["full_name"],
            "relationship": contact_record["relationship"],
            "contact_type": contact_record["contact_type"],
            "is_primary": contact_record["is_primary"],
            "message": "Emergency contact added successfully"
        }
    
    async def update_emergency_contact(
        self,
        personnel_id: int,
        contact_id: str,
        contact_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Update emergency contact information
        
        Args:
            personnel_id: Personnel ID
            contact_id: Contact ID
            contact_data: Updated contact details
            db: Database session
            
        Returns:
            Updated contact information
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        if not personnel.emergency_contact or not personnel.emergency_contact.get('contacts'):
            raise ValueError("No emergency contacts found for personnel")
        
        # Find and update contact
        contact_found = False
        for contact in personnel.emergency_contact['contacts']:
            if contact['id'] == contact_id:
                # Update contact fields
                contact.update({
                    **{k: v for k, v in contact_data.items() if k != 'id'},
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })
                contact_found = True
                break
        
        if not contact_found:
            raise ValueError(f"Emergency contact with ID {contact_id} not found")
        
        db.commit()
        db.refresh(personnel)
        
        return {
            "success": True,
            "contact_id": contact_id,
            "message": "Emergency contact updated successfully"
        }
    
    async def delete_emergency_contact(
        self,
        personnel_id: int,
        contact_id: str,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Delete emergency contact
        
        Args:
            personnel_id: Personnel ID
            contact_id: Contact ID
            db: Database session
            
        Returns:
            Delete result
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        if not personnel.emergency_contact or not personnel.emergency_contact.get('contacts'):
            raise ValueError("No emergency contacts found for personnel")
        
        # Remove contact
        original_count = len(personnel.emergency_contact['contacts'])
        personnel.emergency_contact['contacts'] = [
            contact for contact in personnel.emergency_contact['contacts']
            if contact['id'] != contact_id
        ]
        
        if len(personnel.emergency_contact['contacts']) == original_count:
            raise ValueError(f"Emergency contact with ID {contact_id} not found")
        
        db.commit()
        
        return {
            "success": True,
            "contact_id": contact_id,
            "message": "Emergency contact deleted successfully"
        }
    
    async def get_personnel_emergency_contacts(
        self,
        personnel_id: int,
        contact_type: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get personnel emergency contacts
        
        Args:
            personnel_id: Personnel ID
            contact_type: Filter by contact type (optional)
            db: Database session
            
        Returns:
            Emergency contact information
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        emergency_info = personnel.emergency_contact or {"contacts": []}
        
        # Filter by contact type if specified
        if contact_type:
            emergency_info['contacts'] = [
                contact for contact in emergency_info['contacts']
                if contact.get('contact_type') == contact_type
            ]
        
        # Sort by is_primary first, then by contact_type
        emergency_info['contacts'].sort(key=lambda x: (
            not x.get('is_primary', False),
            x.get('contact_type', 'OTHER')
        ))
        
        return emergency_info
    
    async def get_primary_emergency_contact(
        self,
        personnel_id: int,
        db: Session = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get primary emergency contact for personnel
        
        Args:
            personnel_id: Personnel ID
            db: Database session
            
        Returns:
            Primary contact information or None
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        if not personnel.emergency_contact or not personnel.emergency_contact.get('contacts'):
            return None
        
        # Find primary contact
        for contact in personnel.emergency_contact['contacts']:
            if contact.get('is_primary'):
                return contact
        
        # If no primary, return first contact
        if personnel.emergency_contact['contacts']:
            return personnel.emergency_contact['contacts'][0]
        
        return None
    
    async def update_medical_information(
        self,
        personnel_id: int,
        medical_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Update medical information for personnel
        
        Args:
            personnel_id: Personnel ID
            medical_data: Medical information
            db: Database session
            
        Returns:
            Update result
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Initialize emergency contact if not exists
        if not personnel.emergency_contact:
            personnel.emergency_contact = {
                "contacts": [],
                "medical_conditions": "",
                "blood_group": "",
                "allergies": "",
                "medications": "",
                "special_instructions": ""
            }
        
        # Update medical information
        if 'medical_conditions' in medical_data:
            personnel.emergency_contact['medical_conditions'] = medical_data['medical_conditions']
        if 'blood_group' in medical_data:
            personnel.emergency_contact['blood_group'] = medical_data['blood_group']
        if 'allergies' in medical_data:
            personnel.emergency_contact['allergies'] = medical_data['allergies']
        if 'medications' in medical_data:
            personnel.emergency_contact['medications'] = medical_data['medications']
        if 'special_instructions' in medical_data:
            personnel.emergency_contact['special_instructions'] = medical_data['special_instructions']
        
        # Update blood group in main personnel record
        if 'blood_group' in medical_data:
            personnel.blood_group = medical_data['blood_group']
        
        db.commit()
        db.refresh(personnel)
        
        return {
            "success": True,
            "personnel_id": personnel_id,
            "message": "Medical information updated successfully"
        }
    
    async def get_emergency_contact_summary(
        self,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get emergency contact summary statistics
        
        Args:
            db: Database session
            
        Returns:
            Emergency contact summary
        """
        if db is None:
            db = next(get_db())
        
        # Get all personnel with emergency contacts
        personnel_with_contacts = db.query(Personnel).filter(
            Personnel.emergency_contact.isnot(None)
        ).all()
        
        # Initialize summary
        summary = {
            "total_personnel": db.query(Personnel).count(),
            "personnel_with_emergency_contacts": len(personnel_with_contacts),
            "total_emergency_contacts": 0,
            "primary_contacts": 0,
            "verified_contacts": 0,
            "contact_types": {},
            "medical_info_complete": 0,
            "blood_group_distribution": {},
            "missing_primary_contacts": []
        }
        
        # Aggregate data
        for person in personnel_with_contacts:
            emergency_info = person.emergency_contact
            
            if emergency_info and emergency_info.get('contacts'):
                summary['total_emergency_contacts'] += len(emergency_info['contacts'])
                
                # Count contact types
                for contact in emergency_info['contacts']:
                    contact_type = contact.get('contact_type', 'OTHER')
                    summary['contact_types'][contact_type] = summary['contact_types'].get(contact_type, 0) + 1
                    
                    # Count primary contacts
                    if contact.get('is_primary'):
                        summary['primary_contacts'] += 1
                    
                    # Count verified contacts
                    if contact.get('is_verified'):
                        summary['verified_contacts'] += 1
                
                # Check for complete medical info
                medical_complete = all([
                    emergency_info.get('medical_conditions'),
                    emergency_info.get('blood_group'),
                    emergency_info.get('allergies'),
                    emergency_info.get('medications')
                ])
                if medical_complete:
                    summary['medical_info_complete'] += 1
                
                # Count blood groups
                blood_group = emergency_info.get('blood_group')
                if blood_group:
                    summary['blood_group_distribution'][blood_group] = summary['blood_group_distribution'].get(blood_group, 0) + 1
                
                # Check for missing primary contact
                has_primary = any(contact.get('is_primary') for contact in emergency_info.get('contacts', []))
                if not has_primary:
                    summary['missing_primary_contacts'].append({
                        "personnel_id": person.id,
                        "badge_id": person.badge_id,
                        "full_name": person.full_name
                    })
        
        # Calculate percentages
        if summary['total_personnel'] > 0:
            summary['contact_coverage_percentage'] = round(
                (summary['personnel_with_emergency_contacts'] / summary['total_personnel']) * 100, 2
            )
        else:
            summary['contact_coverage_percentage'] = 0
        
        return summary
    
    async def verify_emergency_contact(
        self,
        personnel_id: int,
        contact_id: str,
        verified_by: str,
        verification_notes: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Verify emergency contact
        
        Args:
            personnel_id: Personnel ID
            contact_id: Contact ID
            verified_by: Person who verified
            verification_notes: Verification notes (optional)
            db: Database session
            
        Returns:
            Verification result
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        if not personnel.emergency_contact or not personnel.emergency_contact.get('contacts'):
            raise ValueError("No emergency contacts found for personnel")
        
        # Find and verify contact
        contact_found = False
        for contact in personnel.emergency_contact['contacts']:
            if contact['id'] == contact_id:
                contact['is_verified'] = True
                contact['verification_date'] = datetime.now(timezone.utc).isoformat()
                contact['verified_by'] = verified_by
                contact['verification_notes'] = verification_notes
                contact_found = True
                break
        
        if not contact_found:
            raise ValueError(f"Emergency contact with ID {contact_id} not found")
        
        db.commit()
        
        return {
            "success": True,
            "contact_id": contact_id,
            "verified_by": verified_by,
            "verification_date": datetime.now(timezone.utc).isoformat(),
            "message": "Emergency contact verified successfully"
        }
    
    async def get_emergency_services_contacts(
        self,
        country: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get emergency services contact information
        
        Args:
            country: Country code (optional)
            db: Database session
            
        Returns:
            Emergency services contacts
        """
        # Return standard emergency services
        return {
            "emergency_services": self.emergency_services,
            "country": country or "Default",
            "note": "These are standard emergency numbers. Please verify local emergency numbers for your specific location.",
            "last_updated": datetime.now(timezone.utc).isoformat()
        }


# Create singleton instance
emergency_contact_service = EmergencyContactService()
