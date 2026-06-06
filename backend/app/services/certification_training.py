"""
Certification and Training Tracking Service

This service handles personnel certification and training tracking including
certification management, training records, expiry monitoring, and compliance tracking.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

# Import models with proper error handling
try:
    from ..models.personnel import Personnel
except ImportError:
    Personnel = None

try:
    from ..models.certification import Certification
except ImportError:
    Certification = None

from ..core.database import get_db


class CertificationTrainingService:
    """Service for managing personnel certification and training tracking"""
    
    def __init__(self):
        # Standard certification types for oil & gas industry
        self.standard_certifications = [
            "H2S Certified",
            "Fire Fighting",
            "First Aid/CPR",
            "Welding Certified",
            "Electrical Safety",
            "Confined Space Entry",
            "Working at Height",
            "Rigging & Slinging",
            "Lifting Operations",
            "Safety Officer",
            "OPITO Certified",
            "NOPSEMA Certified",
            "Medical Fitness",
            "Security Clearance",
            "Defensive Driving",
            "Helicopter Underwater Escape Training (HUET)",
            "Banksmen & Slinger"
        ]
        
        # Standard training types
        self.standard_training = [
            "Safety Induction",
            "Emergency Response",
            "Environmental Awareness",
            "Manual Handling",
            "Permit to Work",
            "Lockout/Tagout",
            "Risk Assessment",
            "Incident Investigation",
            "Leadership Training",
            "Communication Skills",
            "Technical Skills Update",
            "Equipment Operation"
        ]
    
    async def add_personnel_certification(
        self,
        personnel_id: int,
        certification_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Add certification to personnel record
        
        Args:
            personnel_id: Personnel ID
            certification_data: Certification details
            db: Database session
            
        Returns:
            Added certification information
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Create certification record
        certification = Certification(
            personnel_id=personnel_id,
            certification_name=certification_data.get('certification_name'),
            certification_type=certification_data.get('certification_type', 'PROFESSIONAL'),
            issuing_authority=certification_data.get('issuing_authority'),
            certificate_number=certification_data.get('certificate_number'),
            issue_date=certification_data.get('issue_date'),
            expiry_date=certification_data.get('expiry_date'),
            status=certification_data.get('status', 'ACTIVE'),
            notes=certification_data.get('notes'),
            attachments=certification_data.get('attachments', [])
        )
        
        db.add(certification)
        db.commit()
        db.refresh(certification)
        
        # Update personnel certifications list
        if not personnel.certifications:
            personnel.certifications = []
        
        personnel.certifications.append({
            "id": certification.id,
            "certification_name": certification.certification_name,
            "certification_type": certification.certification_type,
            "issuing_authority": certification.issuing_authority,
            "certificate_number": certification.certificate_number,
            "issue_date": certification.issue_date.isoformat() if certification.issue_date else None,
            "expiry_date": certification.expiry_date.isoformat() if certification.expiry_date else None,
            "status": certification.status,
            "notes": certification.notes,
            "attachments": certification.attachments
        })
        
        db.commit()
        
        return {
            "success": True,
            "certification_id": certification.id,
            "personnel_id": personnel_id,
            "certification_name": certification.certification_name,
            "status": certification.status,
            "expiry_date": certification.expiry_date,
            "message": "Certification added successfully"
        }
    
    async def add_training_record(
        self,
        personnel_id: int,
        training_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Add training record to personnel
        
        Args:
            personnel_id: Personnel ID
            training_data: Training details
            db: Database session
            
        Returns:
            Added training record information
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Create training record
        training_record = {
            "id": f"training_{datetime.now(timezone.utc).timestamp()}",
            "training_name": training_data.get('training_name'),
            "training_type": training_data.get('training_type', 'INTERNAL'),
            "provider": training_data.get('provider'),
            "start_date": training_data.get('start_date'),
            "end_date": training_data.get('end_date'),
            "duration_hours": training_data.get('duration_hours'),
            "status": training_data.get('status', 'COMPLETED'),
            "score": training_data.get('score'),
            "instructor": training_data.get('instructor'),
            "location": training_data.get('location'),
            "notes": training_data.get('notes'),
            "attachments": training_data.get('attachments', []),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update personnel training records
        if not personnel.training_records:
            personnel.training_records = []
        
        personnel.training_records.append(training_record)
        db.commit()
        
        return {
            "success": True,
            "training_id": training_record["id"],
            "personnel_id": personnel_id,
            "training_name": training_record["training_name"],
            "status": training_record["status"],
            "completion_date": training_record["end_date"],
            "message": "Training record added successfully"
        }
    
    async def get_personnel_certifications(
        self,
        personnel_id: int,
        status: Optional[str] = None,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get personnel certifications
        
        Args:
            personnel_id: Personnel ID
            status: Filter by status (optional)
            db: Database session
            
        Returns:
            List of certifications
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        certifications = personnel.certifications or []
        
        # Filter by status if provided
        if status:
            certifications = [cert for cert in certifications if cert.get('status') == status]
        
        # Sort by expiry date
        certifications.sort(key=lambda x: x.get('expiry_date', '9999-12-31'), reverse=True)
        
        return certifications
    
    async def get_personnel_training_records(
        self,
        personnel_id: int,
        training_type: Optional[str] = None,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get personnel training records
        
        Args:
            personnel_id: Personnel ID
            training_type: Filter by training type (optional)
            db: Database session
            
        Returns:
            List of training records
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        training_records = personnel.training_records or []
        
        # Filter by training type if provided
        if training_type:
            training_records = [training for training in training_records if training.get('training_type') == training_type]
        
        # Sort by completion date
        training_records.sort(key=lambda x: x.get('end_date', '0000-01-01'), reverse=True)
        
        return training_records
    
    async def get_expiring_certifications(
        self,
        days_ahead: int = 30,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get certifications expiring within specified days
        
        Args:
            days_ahead: Number of days ahead to check
            db: Database session
            
        Returns:
            List of expiring certifications
        """
        if db is None:
            db = next(get_db())
        
        # Calculate expiry threshold
        expiry_threshold = datetime.now(timezone.utc) + timedelta(days=days_ahead)
        
        expiring_certifications = []
        
        # Get all personnel with certifications
        personnel_list = db.query(Personnel).filter(
            Personnel.certifications.isnot(None)
        ).all()
        
        for person in personnel_list:
            if person.certifications:
                for cert in person.certifications:
                    if cert.get('expiry_date'):
                        expiry_date = datetime.fromisoformat(cert['expiry_date'].replace('Z', '+00:00'))
                        if expiry_date <= expiry_threshold and expiry_date >= datetime.now(timezone.utc):
                            days_to_expiry = (expiry_date - datetime.now(timezone.utc)).days
                            expiring_certifications.append({
                                "personnel_id": person.id,
                                "badge_id": person.badge_id,
                                "full_name": person.full_name,
                                "company": person.company,
                                "certification": cert,
                                "days_to_expiry": days_to_expiry
                            })
        
        # Sort by days to expiry
        expiring_certifications.sort(key=lambda x: x['days_to_expiry'])
        
        return expiring_certifications
    
    async def get_certification_compliance_report(
        self,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get certification compliance report
        
        Args:
            db: Database session
            
        Returns:
            Compliance report statistics
        """
        if db is None:
            db = next(get_db())
        
        # Get all personnel
        total_personnel = db.query(Personnel).count()
        
        # Statistics
        stats = {
            "total_personnel": total_personnel,
            "personnel_with_certifications": 0,
            "total_certifications": 0,
            "active_certifications": 0,
            "expired_certifications": 0,
            "expiring_soon_30_days": 0,
            "expiring_soon_90_days": 0,
            "certification_types": {},
            "compliance_rate": 0.0,
            "expiring_certifications": []
        }
        
        # Calculate dates
        now = datetime.now(timezone.utc)
        thirty_days_ahead = now + timedelta(days=30)
        ninety_days_ahead = now + timedelta(days=90)
        
        personnel_with_certs = 0
        total_certs = 0
        active_certs = 0
        expired_certs = 0
        expiring_30 = 0
        expiring_90 = 0
        cert_types = {}
        expiring_certs = []
        
        # Get personnel with certifications
        personnel_list = db.query(Personnel).filter(
            Personnel.certifications.isnot(None)
        ).all()
        
        for person in personnel_list:
            if person.certifications:
                personnel_with_certs += 1
                
                for cert in person.certifications:
                    total_certs += 1
                    
                    # Count certification types
                    cert_name = cert.get('certification_name', 'Unknown')
                    cert_types[cert_name] = cert_types.get(cert_name, 0) + 1
                    
                    # Check status
                    status = cert.get('status', 'ACTIVE')
                    if status == 'ACTIVE':
                        active_certs += 1
                        
                        # Check expiry
                        if cert.get('expiry_date'):
                            expiry_date = datetime.fromisoformat(cert['expiry_date'].replace('Z', '+00:00'))
                            if expiry_date < now:
                                expired_certs += 1
                            elif expiry_date <= thirty_days_ahead:
                                expiring_30 += 1
                                expiring_certs.append({
                                    "personnel_id": person.id,
                                    "badge_id": person.badge_id,
                                    "full_name": person.full_name,
                                    "certification": cert,
                                    "days_to_expiry": (expiry_date - now).days
                                })
                            elif expiry_date <= ninety_days_ahead:
                                expiring_90 += 1
                    else:
                        expired_certs += 1
        
        # Update statistics
        stats.update({
            "personnel_with_certifications": personnel_with_certs,
            "total_certifications": total_certs,
            "active_certifications": active_certs,
            "expired_certifications": expired_certs,
            "expiring_soon_30_days": expiring_30,
            "expiring_soon_90_days": expiring_90,
            "certification_types": cert_types,
            "compliance_rate": round((personnel_with_certs / total_personnel * 100) if total_personnel > 0 else 0, 2),
            "expiring_certifications": expiring_certs[:10]  # Top 10 expiring
        })
        
        return stats
    
    async def update_certification_status(
        self,
        personnel_id: int,
        certification_id: str,
        status: str,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Update certification status
        
        Args:
            personnel_id: Personnel ID
            certification_id: Certification ID
            status: New status
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
        
        # Find and update certification
        if personnel.certifications:
            for cert in personnel.certifications:
                if str(cert.get('id')) == str(certification_id):
                    cert['status'] = status
                    cert['updated_at'] = datetime.now(timezone.utc).isoformat()
                    db.commit()
                    
                    return {
                        "success": True,
                        "certification_id": certification_id,
                        "new_status": status,
                        "message": "Certification status updated successfully"
                    }
        
        raise ValueError(f"Certification with ID {certification_id} not found")
    
    async def delete_certification(
        self,
        personnel_id: int,
        certification_id: str,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Delete certification from personnel record
        
        Args:
            personnel_id: Personnel ID
            certification_id: Certification ID
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
        
        # Find and remove certification
        if personnel.certifications:
            original_count = len(personnel.certifications)
            personnel.certifications = [
                cert for cert in personnel.certifications 
                if str(cert.get('id')) != str(certification_id)
            ]
            
            if len(personnel.certifications) < original_count:
                db.commit()
                return {
                    "success": True,
                    "certification_id": certification_id,
                    "message": "Certification deleted successfully"
                }
        
        raise ValueError(f"Certification with ID {certification_id} not found")


# Create singleton instance
certification_training_service = CertificationTrainingService()
