"""
Medical Fitness Tracking Service

This service handles medical fitness tracking, monitoring, and alerts for personnel,
including fitness assessments, medical examinations, and health compliance tracking.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..models.personnel import Personnel
from ..core.database import get_db


class MedicalFitnessService:
    """Service for managing medical fitness tracking"""
    
    def __init__(self):
        # Standard medical fitness categories for oil & gas
        self.fitness_categories = [
            "MEDICAL_EXAMINATION",
            "FITNESS_ASSESSMENT",
            "DRUG_TEST",
            "ALCOHOL_TEST",
            "VISION_TEST",
            "HEARING_TEST",
            "BLOOD_PRESSURE",
            "HEART_RATE",
            "RESPIRATORY",
            "PSYCHOLOGICAL_EVALUATION",
            "SAFETY_TRAINING",
            "MEDICAL_CLEARANCE"
        ]
        
        # Standard medical conditions that require monitoring
        self.monitored_conditions = [
            "HYPERTENSION",
            "DIABETES",
            "HEART_DISEASE",
            "RESPIRATORY_CONDITIONS",
            "EPILEPSY",
            "MENTAL_HEALTH",
            "CHRONIC_ILLNESS",
            "MEDICATION_DEPENDENCY",
            "PREGNANCY",
            "IMPAIRED_VISION",
            "HEARING_IMPAIRMENT"
        ]
        
        # Medical fitness status levels
        self.fitness_status_levels = {
            "FIT": "Medically fit for duty",
            "FIT_WITH_RESTRICTIONS": "Fit with specific restrictions",
            "TEMPORARILY_UNFIT": "Temporarily unfit for duty",
            "UNFIT": "Unfit for duty",
            "PENDING_EVALUATION": "Awaiting medical evaluation"
        }
    
    async def create_medical_fitness_record(
        self,
        personnel_id: int,
        fitness_data: Dict[str, Any],
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Create medical fitness record for personnel
        
        Args:
            personnel_id: Personnel ID
            fitness_data: Fitness assessment details
            db: Database session
            
        Returns:
            Created fitness record information
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Validate required fields
        required_fields = ["assessment_type", "exam_date", "examining_doctor", "fitness_status"]
        for field in required_fields:
            if not fitness_data.get(field):
                raise ValueError(f"Missing required field: {field}")
        
        # Create fitness record
        fitness_record = {
            "id": f"fitness_{datetime.now(timezone.utc).timestamp()}",
            "assessment_type": fitness_data.get('assessment_type'),
            "exam_date": fitness_data.get('exam_date'),
            "examining_doctor": fitness_data.get('examining_doctor'),
            "medical_facility": fitness_data.get('medical_facility'),
            "fitness_status": fitness_data.get('fitness_status'),
            "valid_until": fitness_data.get('valid_until'),
            "restrictions": fitness_data.get('restrictions', []),
            "findings": fitness_data.get('findings', ''),
            "recommendations": fitness_data.get('recommendations', ''),
            "next_exam_date": fitness_data.get('next_exam_date'),
            "attachments": fitness_data.get('attachments', []),
            "notes": fitness_data.get('notes', ''),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update personnel medical fitness date
        personnel.medical_fitness_date = datetime.fromisoformat(fitness_data['exam_date'].replace('Z', '+00:00')) if isinstance(fitness_data['exam_date'], str) else fitness_data['exam_date']
        
        # Update emergency contact medical information
        if not personnel.emergency_contact:
            personnel.emergency_contact = {
                "contacts": [],
                "medical_conditions": fitness_data.get('medical_conditions', ''),
                "blood_group": fitness_data.get('blood_group', ''),
                "allergies": fitness_data.get('allergies', ''),
                "medications": fitness_data.get('medications', ''),
                "special_instructions": fitness_data.get('special_instructions', ''),
                "fitness_records": []
            }
        
        # Add fitness record to emergency contact
        if 'fitness_records' not in personnel.emergency_contact:
            personnel.emergency_contact['fitness_records'] = []
        personnel.emergency_contact['fitness_records'].append(fitness_record)
        
        # Update medical information
        if fitness_data.get('medical_conditions'):
            personnel.emergency_contact['medical_conditions'] = fitness_data['medical_conditions']
        if fitness_data.get('blood_group'):
            personnel.emergency_contact['blood_group'] = fitness_data['blood_group']
            personnel.blood_group = fitness_data['blood_group']
        if fitness_data.get('allergies'):
            personnel.emergency_contact['allergies'] = fitness_data['allergies']
        if fitness_data.get('medications'):
            personnel.emergency_contact['medications'] = fitness_data['medications']
        if fitness_data.get('special_instructions'):
            personnel.emergency_contact['special_instructions'] = fitness_data['special_instructions']
        
        db.commit()
        db.refresh(personnel)
        
        return {
            "success": True,
            "fitness_record_id": fitness_record["id"],
            "personnel_id": personnel_id,
            "assessment_type": fitness_record["assessment_type"],
            "fitness_status": fitness_record["fitness_status"],
            "valid_until": fitness_record["valid_until"],
            "message": "Medical fitness record created successfully"
        }
    
    async def get_personnel_fitness_records(
        self,
        personnel_id: int,
        assessment_type: Optional[str] = None,
        status: Optional[str] = None,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get personnel medical fitness records
        
        Args:
            personnel_id: Personnel ID
            assessment_type: Filter by assessment type (optional)
            status: Filter by fitness status (optional)
            db: Database session
            
        Returns:
            List of fitness records
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        fitness_records = []
        
        # Get fitness records from emergency contact
        if personnel.emergency_contact and personnel.emergency_contact.get('fitness_records'):
            fitness_records = personnel.emergency_contact['fitness_records']
        
        # Apply filters
        if assessment_type:
            fitness_records = [
                record for record in fitness_records
                if record.get('assessment_type') == assessment_type
            ]
        
        if status:
            fitness_records = [
                record for record in fitness_records
                if record.get('fitness_status') == status
            ]
        
        # Sort by exam date descending
        fitness_records.sort(
            key=lambda x: x.get('exam_date', '0000-01-01'),
            reverse=True
        )
        
        return fitness_records
    
    async def get_fitness_expiry_alerts(
        self,
        days_ahead: int = 30,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get fitness records expiring within specified days
        
        Args:
            days_ahead: Number of days ahead to check
            db: Database session
            
        Returns:
            List of expiring fitness records
        """
        if db is None:
            db = next(get_db())
        
        # Calculate expiry threshold
        expiry_threshold = datetime.now(timezone.utc) + timedelta(days=days_ahead)
        
        expiring_records = []
        
        # Get all personnel with fitness records
        personnel_list = db.query(Personnel).filter(
            Personnel.emergency_contact.isnot(None)
        ).all()
        
        for person in personnel_list:
            if person.emergency_contact and person.emergency_contact.get('fitness_records'):
                for record in person.emergency_contact['fitness_records']:
                    if record.get('valid_until'):
                        try:
                            valid_until = datetime.fromisoformat(record['valid_until'].replace('Z', '+00:00'))
                            if valid_until <= expiry_threshold and valid_until >= datetime.now(timezone.utc):
                                days_to_expiry = (valid_until - datetime.now(timezone.utc)).days
                                expiring_records.append({
                                    "personnel_id": person.id,
                                    "badge_id": person.badge_id,
                                    "full_name": person.full_name,
                                    "company": person.company,
                                    "fitness_record": record,
                                    "days_to_expiry": days_to_expiry
                                })
                        except ValueError:
                            # Handle invalid date format
                            continue
        
        # Sort by days to expiry
        expiring_records.sort(key=lambda x: x['days_to_expiry'])
        
        return expiring_records
    
    async def get_fitness_compliance_report(
        self,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get medical fitness compliance report
        
        Args:
            db: Database session
            
        Returns:
            Fitness compliance statistics
        """
        if db is None:
            db = next(get_db())
        
        # Get all personnel
        total_personnel = db.query(Personnel).count()
        
        # Initialize statistics
        stats = {
            "total_personnel": total_personnel,
            "personnel_with_fitness_records": 0,
            "total_fitness_records": 0,
            "fitness_status_distribution": {},
            "assessment_type_distribution": {},
            "expiring_soon_30_days": 0,
            "expiring_soon_90_days": 0,
            "expired_records": 0,
            "unfit_personnel": 0,
            "fit_personnel": 0,
            "medical_conditions_summary": {},
            "compliance_rate": 0.0,
            "expiring_records": []
        }
        
        # Calculate dates
        now = datetime.now(timezone.utc)
        thirty_days_ahead = now + timedelta(days=30)
        ninety_days_ahead = now + timedelta(days=90)
        
        personnel_with_fitness = 0
        total_fitness_records = 0
        fit_count = 0
        unfit_count = 0
        expiring_30 = 0
        expiring_90 = 0
        expired_count = 0
        fitness_status_counts = {}
        assessment_type_counts = {}
        medical_conditions_counts = {}
        expiring_records = []
        
        # Get personnel with fitness records
        personnel_list = db.query(Personnel).filter(
            Personnel.emergency_contact.isnot(None)
        ).all()
        
        for person in personnel_list:
            if person.emergency_contact and person.emergency_contact.get('fitness_records'):
                personnel_with_fitness += 1
                
                for record in person.emergency_contact['fitness_records']:
                    total_fitness_records += 1
                    
                    # Count fitness status
                    status = record.get('fitness_status', 'UNKNOWN')
                    fitness_status_counts[status] = fitness_status_counts.get(status, 0) + 1
                    
                    # Count assessment types
                    assessment_type = record.get('assessment_type', 'UNKNOWN')
                    assessment_type_counts[assessment_type] = assessment_type_counts.get(assessment_type, 0) + 1
                    
                    # Check expiry
                    if record.get('valid_until'):
                        try:
                            valid_until = datetime.fromisoformat(record['valid_until'].replace('Z', '+00:00'))
                            if valid_until < now:
                                expired_count += 1
                            elif valid_until <= thirty_days_ahead:
                                expiring_30 += 1
                                expiring_records.append({
                                    "personnel_id": person.id,
                                    "badge_id": person.badge_id,
                                    "full_name": person.full_name,
                                    "fitness_record": record,
                                    "days_to_expiry": (valid_until - now).days
                                })
                            elif valid_until <= ninety_days_ahead:
                                expiring_90 += 1
                        except ValueError:
                            # Handle invalid date format
                            pass
                    
                    # Count fitness status for personnel
                    if status == 'FIT':
                        fit_count += 1
                    elif status in ['UNFIT', 'TEMPORARILY_UNFIT']:
                        unfit_count += 1
        
        # Count medical conditions
        for person in personnel_list:
            if person.emergency_contact:
                conditions = person.emergency_contact.get('medical_conditions', '')
                if conditions:
                    # Split conditions by comma and count
                    condition_list = [c.strip() for c in conditions.split(',') if c.strip()]
                    for condition in condition_list:
                        medical_conditions_counts[condition] = medical_conditions_counts.get(condition, 0) + 1
        
        # Update statistics
        stats.update({
            "personnel_with_fitness_records": personnel_with_fitness,
            "total_fitness_records": total_fitness_records,
            "fitness_status_distribution": fitness_status_counts,
            "assessment_type_distribution": assessment_type_counts,
            "expiring_soon_30_days": expiring_30,
            "expiring_soon_90_days": expiring_90,
            "expired_records": expired_count,
            "fit_personnel": fit_count,
            "unfit_personnel": unfit_count,
            "medical_conditions_summary": medical_conditions_counts,
            "compliance_rate": round((personnel_with_fitness / total_personnel * 100) if total_personnel > 0 else 0, 2),
            "expiring_records": expiring_records[:10]  # Top 10 expiring
        })
        
        return stats
    
    async def update_fitness_status(
        self,
        personnel_id: int,
        fitness_record_id: str,
        fitness_status: str,
        notes: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Update fitness status
        
        Args:
            personnel_id: Personnel ID
            fitness_record_id: Fitness record ID
            fitness_status: New fitness status
            notes: Update notes (optional)
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
        
        if not personnel.emergency_contact or not personnel.emergency_contact.get('fitness_records'):
            raise ValueError("No fitness records found for personnel")
        
        # Find and update fitness record
        record_found = False
        for record in personnel.emergency_contact['fitness_records']:
            if record['id'] == fitness_record_id:
                record['fitness_status'] = fitness_status
                record['updated_at'] = datetime.now(timezone.utc).isoformat()
                if notes:
                    record['notes'] += f" | Updated: {notes}"
                record_found = True
                break
        
        if not record_found:
            raise ValueError(f"Fitness record with ID {fitness_record_id} not found")
        
        db.commit()
        
        return {
            "success": True,
            "fitness_record_id": fitness_record_id,
            "new_status": fitness_status,
            "message": "Fitness status updated successfully"
        }
    
    async def create_medical_alert(
        self,
        personnel_id: int,
        alert_type: str,
        message: str,
        severity: str = "MEDIUM",
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Create medical alert for personnel
        
        Args:
            personnel_id: Personnel ID
            alert_type: Alert type
            message: Alert message
            severity: Alert severity (LOW, MEDIUM, HIGH, CRITICAL)
            db: Database session
            
        Returns:
            Alert creation result
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        # Create medical alert
        medical_alert = {
            "id": f"alert_{datetime.now(timezone.utc).timestamp()}",
            "alert_type": alert_type,
            "message": message,
            "severity": severity,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "SYSTEM",
            "resolved": False,
            "resolved_at": None,
            "resolved_by": None
        }
        
        # Store alert in emergency contact
        if not personnel.emergency_contact:
            personnel.emergency_contact = {
                "contacts": [],
                "medical_conditions": "",
                "blood_group": "",
                "allergies": "",
                "medications": "",
                "special_instructions": "",
                "fitness_records": [],
                "medical_alerts": []
            }
        
        if 'medical_alerts' not in personnel.emergency_contact:
            personnel.emergency_contact['medical_alerts'] = []
        
        personnel.emergency_contact['medical_alerts'].append(medical_alert)
        
        db.commit()
        
        return {
            "success": True,
            "alert_id": medical_alert["id"],
            "personnel_id": personnel_id,
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "timestamp": medical_alert["created_at"]
        }
    
    async def get_medical_alerts(
        self,
        personnel_id: Optional[int] = None,
        severity: Optional[str] = None,
        resolved: Optional[bool] = None,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Get medical alerts
        
        Args:
            personnel_id: Filter by personnel ID (optional)
            severity: Filter by severity (optional)
            resolved: Filter by resolved status (optional)
            db: Database session
            
        Returns:
            List of medical alerts
        """
        if db is None:
            db = next(get_db())
        
        alerts = []
        
        if personnel_id:
            # Get alerts for specific personnel
            personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
            if personnel and personnel.emergency_contact and personnel.emergency_contact.get('medical_alerts'):
                alerts = personnel.emergency_contact['medical_alerts']
        else:
            # Get all alerts
            personnel_list = db.query(Personnel).filter(
                Personnel.emergency_contact.isnot(None)
            ).all()
            
            for person in personnel_list:
                if person.emergency_contact and person.emergency_contact.get('medical_alerts'):
                    for alert in person.emergency_contact['medical_alerts']:
                        alert['personnel_id'] = person.id
                        alert['badge_id'] = person.badge_id
                        alert['full_name'] = person.full_name
                        alerts.append(alert)
        
        # Apply filters
        if severity:
            alerts = [alert for alert in alerts if alert.get('severity') == severity]
        
        if resolved is not None:
            alerts = [alert for alert in alerts if alert.get('resolved') == resolved]
        
        # Sort by creation date descending
        alerts.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return alerts
    
    async def get_medical_summary(
        self,
        personnel_id: int,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive medical summary for personnel
        
        Args:
            personnel_id: Personnel ID
            db: Database session
            
        Returns:
            Medical summary
        """
        if db is None:
            db = next(get_db())
        
        # Get personnel record
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise ValueError(f"Personnel with ID {personnel_id} not found")
        
        emergency_info = personnel.emergency_contact or {}
        
        # Get fitness records
        fitness_records = emergency_info.get('fitness_records', [])
        
        # Get medical alerts
        medical_alerts = emergency_info.get('medical_alerts', [])
        
        # Get latest fitness status
        current_fitness_status = None
        latest_fitness_expiry = None
        if fitness_records:
            # Sort by exam date
            fitness_records.sort(key=lambda x: x.get('exam_date', ''), reverse=True)
            current_fitness_status = fitness_records[0].get('fitness_status')
            if fitness_records[0].get('valid_until'):
                try:
                    latest_fitness_expiry = datetime.fromisoformat(fitness_records[0]['valid_until'].replace('pending', '+00:00'))
                except ValueError:
                    pass
        
        return {
            "personnel_id": personnel_id,
            "badge_id": personnel.badge_id,
            "full_name": personnel.full_name,
            "medical_fitness_date": personnel.medical_fitness_date,
            "blood_group": emergency_info.get('blood_group', ''),
            "medical_conditions": emergency_info.get('medical_conditions', ''),
            "allergies": emergency_info.get('allergies', ''),
            "medications": emergency_info.get('medications', ''),
            "special_instructions": emergency_info.get('special_instructions', ''),
            "current_fitness_status": current_fitness_status,
            "latest_fitness_expiry": latest_fitness_expiry.isoformat() if latest_fitness_expiry else None,
            "fitness_records_count": len(fitness_records),
            "medical_alerts_count": len(medical_alerts),
            "active_medical_alerts": len([a for a in medical_alerts if not a.get('resolved', False)]),
            "fitness_records": fitness_records,
            "medical_alerts": medical_alerts
        }


# Create singleton instance
medical_fitness_service = MedicalFitnessService()
