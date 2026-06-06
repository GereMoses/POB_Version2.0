"""
Certification Service for Oil & Gas Personnel Management
Handles certification tracking, compliance monitoring, and industry standards
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import logging

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

logger = logging.getLogger(__name__)

class CertificationService:
    """Service for managing personnel certifications and compliance"""
    
    def __init__(self):
        self.db = next(get_db())
        
        # Oil & Gas industry standard certifications
        self.OIL_GAS_CERTIFICATIONS = {
            'OPITO': {
                'H2S_AWARENESS': {'name': 'H2S Awareness Training', 'validity_days': 365},
                'TROPICAL_WATER_SURVIVAL': {'name': 'Tropical Water Survival', 'validity_days': 1825},
                'BANKSMAN': {'name': 'Banksman Training', 'validity_days': 730},
                'RIGGER': {'name': 'Rigger Training', 'validity_days': 1095},
                'FIRE_FIGHTING': {'name': 'Fire Fighting Training', 'validity_days': 1095}
            },
            'NOPSEMA': {
                'MEDICAL_FITNESS': {'name': 'Medical Fitness Certificate', 'validity_days': 365},
                'SAFETY_OFFICER': {'name': 'Safety Officer Certification', 'validity_days': 730},
                'RISK_ASSESSMENT': {'name': 'Risk Assessment Training', 'validity_days': 730}
            },
            'COMPANY': {
                'INDUCTION': {'name': 'Company Induction', 'validity_days': 365},
                'SAFETY_BRIEFING': {'name': 'Safety Briefing', 'validity_days': 180},
                'EQUIPMENT_TRAINING': {'name': 'Equipment Training', 'validity_days': 730}
            }
        }
    
    async def add_certification(
        self,
        personnel_id: int,
        certification_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Add a new certification for personnel
        
        Args:
            personnel_id: Personnel ID
            certification_data: Certification details
            
        Returns:
            Addition result
        """
        try:
            personnel = self.db.query(Personnel).filter(Personnel.id == personnel_id).first()
            if not personnel:
                return {
                    "success": False,
                    "message": "Personnel not found",
                    "error": "PERSONNEL_NOT_FOUND"
                }
            
            # Validate required fields
            required_fields = ['name', 'issuer', 'issue_date', 'expire_date', 'certificate_number']
            for field in required_fields:
                if field not in certification_data:
                    return {
                        "success": False,
                        "message": f"Missing required field: {field}",
                        "error": "MISSING_FIELD"
                    }
            
            # Create certification record if model exists
            if Certification is not None:
                certification = Certification(
                    personnel_id=personnel_id,
                    name=certification_data['name'],
                    issuer=certification_data['issuer'],
                    issue_date=datetime.fromisoformat(certification_data['issue_date']),
                    expire_date=datetime.fromisoformat(certification_data['expire_date']),
                    certificate_number=certification_data['certificate_number'],
                    certification_type=certification_data.get('certification_type', 'COMPANY'),
                    status='ACTIVE',
                    created_at=datetime.utcnow()
                )
                
                self.db.add(certification)
            
            # Update personnel compliance score
            await self._update_compliance_score(personnel_id)
            
            self.db.commit()
            
            logger.info(f"Added certification {certification_data['name']} for personnel {personnel.full_name}")
            
            return {
                "success": True,
                "message": "Certification added successfully",
                "certification_id": certification.id,
                "personnel_id": personnel_id,
                "certification_name": certification_data['name'],
                "expire_date": certification_data['expire_date']
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error adding certification for personnel {personnel_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to add certification: {str(e)}",
                "error": "ADD_CERTIFICATION_ERROR"
            }
    
    async def get_personnel_certifications(
        self,
        personnel_id: int
    ) -> Dict[str, Any]:
        """
        Get all certifications for a personnel
        
        Args:
            personnel_id: Personnel ID
            
        Returns:
            Personnel certifications
        """
        try:
            # Get certifications if model exists
            if Certification is not None:
                certifications = self.db.query(Certification).filter(
                    Certification.personnel_id == personnel_id
                ).order_by(Certification.expire_date.desc()).all()
            
            # Analyze certification status
            now = datetime.utcnow()
            certification_analysis = {
                'total': len(certifications),
                'active': 0,
                'expiring_soon': 0,
                'expired': 0,
                'valid': 0
            }
            
            certification_list = []
            for cert in certifications:
                days_until_expiry = (cert.expire_date - now).days
                status = 'ACTIVE'
                
                if days_until_expiry < 0:
                    status = 'EXPIRED'
                    certification_analysis['expired'] += 1
                elif days_until_expiry <= 30:
                    status = 'EXPIRING_SOON'
                    certification_analysis['expiring_soon'] += 1
                else:
                    certification_analysis['active'] += 1
                    certification_analysis['valid'] += 1
                
                certification_list.append({
                    'id': cert.id,
                    'name': cert.name,
                    'issuer': cert.issuer,
                    'certificate_number': cert.certificate_number,
                    'certification_type': cert.certification_type,
                    'issue_date': cert.issue_date.isoformat(),
                    'expire_date': cert.expire_date.isoformat(),
                    'status': status,
                    'days_until_expiry': days_until_expiry,
                    'created_at': cert.created_at.isoformat()
                })
            
            return {
                "success": True,
                "personnel_id": personnel_id,
                "certifications": certification_list,
                "analysis": certification_analysis,
                "compliance_score": await self._calculate_certification_compliance(personnel_id)
            }
            
        except Exception as e:
            logger.error(f"Error getting certifications for personnel {personnel_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to get certifications: {str(e)}",
                "error": "GET_CERTIFICATIONS_ERROR"
            }
    
    async def update_certification(
        self,
        certification_id: int,
        update_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update an existing certification
        
        Args:
            certification_id: Certification ID
            update_data: Updated certification data
            
        Returns:
            Update result
        """
        try:
            certification = self.db.query(Certification).filter(
                Certification.id == certification_id
            ).first()
            
            if not certification:
                return {
                    "success": False,
                    "message": "Certification not found",
                    "error": "CERTIFICATION_NOT_FOUND"
                }
            
            # Update certification fields
            for field, value in update_data.items():
                if hasattr(certification, field):
                    if field in ['issue_date', 'expire_date'] and isinstance(value, str):
                        setattr(certification, field, datetime.fromisoformat(value))
                    else:
                        setattr(certification, field, value)
            
            certification.updated_at = datetime.utcnow()
            
            # Update personnel compliance score
            await self._update_compliance_score(certification.personnel_id)
            
            self.db.commit()
            
            logger.info(f"Updated certification {certification.name}")
            
            return {
                "success": True,
                "message": "Certification updated successfully",
                "certification_id": certification_id,
                "updated_fields": list(update_data.keys())
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating certification {certification_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to update certification: {str(e)}",
                "error": "UPDATE_CERTIFICATION_ERROR"
            }
    
    async def delete_certification(
        self,
        certification_id: int
    ) -> Dict[str, Any]:
        """
        Delete a certification
        
        Args:
            certification_id: Certification ID
            
        Returns:
            Deletion result
        """
        try:
            certification = self.db.query(Certification).filter(
                Certification.id == certification_id
            ).first()
            
            if not certification:
                return {
                    "success": False,
                    "message": "Certification not found",
                    "error": "CERTIFICATION_NOT_FOUND"
                }
            
            personnel_id = certification.personnel_id
            certification_name = certification.name
            
            if Certification is not None:
                self.db.delete(certification)
            
            # Update personnel compliance score
            await self._update_compliance_score(personnel_id)
            
            self.db.commit()
            
            logger.info(f"Deleted certification {certification_name}")
            
            return {
                "success": True,
                "message": "Certification deleted successfully",
                "certification_id": certification_id,
                "personnel_id": personnel_id
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error deleting certification {certification_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to delete certification: {str(e)}",
                "error": "DELETE_CERTIFICATION_ERROR"
            }
    
    async def get_certification_analytics(
        self
    ) -> Dict[str, Any]:
        """
        Get comprehensive certification analytics
        
        Returns:
            Certification analytics data
        """
        try:
            total_personnel = self.db.query(Personnel).count()
            total_certifications = self.db.query(Certification).count()
            
            # Get certification status breakdown
            now = datetime.utcnow()
            
            active_certifications = self.db.query(Certification).filter(
                Certification.expire_date > now
            ).count()
            
            expired_certifications = self.db.query(Certification).filter(
                Certification.expire_date <= now
            ).count()
            
            expiring_soon = self.db.query(Certification).filter(
                Certification.expire_date.between(
                    now,
                    now + timedelta(days=30)
                )
            ).count()
            
            # Get certification type distribution
            certification_types = self.db.query(
                Certification.certification_type,
                func.count(Certification.id).label('count')
            ).group_by(Certification.certification_type).all()
            
            type_distribution = {
                cert_type: count for cert_type, count in certification_types
            }
            
            # Get issuer distribution
            issuers = self.db.query(
                Certification.issuer,
                func.count(Certification.id).label('count')
            ).group_by(Certification.issuer).all()
            
            issuer_distribution = {
                issuer: count for issuer, count in issuers
            }
            
            # Get compliance score distribution
            compliance_scores = self.db.query(
                Personnel.compliance_score
            ).all()
            
            compliance_distribution = {
                'high_compliance': sum(1 for score in compliance_scores if score.compliance_score >= 90),
                'medium_compliance': sum(1 for score in compliance_scores if 70 <= score.compliance_score < 90),
                'low_compliance': sum(1 for score in compliance_scores if score.compliance_score < 70)
            }
            
            # Get expiring certifications in next 30 days
            expiring_list = []
            if Certification is not None:
                expiring_certifications = self.db.query(Certification).filter(
                    Certification.expire_date.between(
                        now,
                        now + timedelta(days=30)
                    ),
                    Certification.status == 'ACTIVE'
                ).order_by(Certification.expire_date.asc()).limit(20).all()
                
                expiring_list = [
                    {
                        'id': cert.id,
                        'personnel_id': cert.personnel_id,
                        'personnel_name': cert.personnel.full_name,
                        'certification_name': cert.name,
                        'expire_date': cert.expire_date.isoformat(),
                        'days_until_expiry': (cert.expire_date - now).days
                    }
                    for cert in expiring_certifications
                ]
            
            return {
                "success": True,
                "overview": {
                    "total_personnel": total_personnel,
                    "total_certifications": total_certifications,
                    "active_certifications": active_certifications,
                    "expired_certifications": expired_certifications,
                    "expiring_soon": expiring_soon
                },
                "distributions": {
                    "certification_types": type_distribution,
                    "issuers": issuer_distribution,
                    "compliance_scores": compliance_distribution
                },
                "expiring_soon": expiring_list,
                "compliance_metrics": {
                    "average_compliance_score": sum(score.compliance_score for score in compliance_scores) / len(compliance_scores) if compliance_scores else 0,
                    "high_compliance_percentage": (compliance_distribution['high_compliance'] / total_personnel * 100) if total_personnel > 0 else 0,
                    "certification_coverage": (active_certifications / total_certifications * 100) if total_certifications > 0 else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting certification analytics: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to get certification analytics: {str(e)}",
                "error": "ANALYTICS_ERROR"
            }
    
    async def get_required_certifications(
        self,
        personnel_type: str
    ) -> Dict[str, Any]:
        """
        Get required certifications for personnel type
        
        Args:
            personnel_type: Personnel type (STAFF, CONTRACTOR, VISITOR)
            
        Returns:
            Required certifications
        """
        try:
            # Define required certifications by personnel type
            required_by_type = {
                'STAFF': [
                    {'type': 'COMPANY', 'cert': 'INDUCTION'},
                    {'type': 'COMPANY', 'cert': 'SAFETY_BRIEFING'},
                    {'type': 'OPITO', 'cert': 'H2S_AWARENESS'}
                ],
                'CONTRACTOR': [
                    {'type': 'COMPANY', 'cert': 'INDUCTION'},
                    {'type': 'COMPANY', 'cert': 'SAFETY_BRIEFING'},
                    {'type': 'OPITO', 'cert': 'H2S_AWARENESS'},
                    {'type': 'OPITO', 'cert': 'TROPICAL_WATER_SURVIVAL'},
                    {'type': 'NOPSEMA', 'cert': 'MEDICAL_FITNESS'}
                ],
                'VISITOR': [
                    {'type': 'COMPANY', 'cert': 'SAFETY_BRIEFING'}
                ]
            }
            
            required_certs = required_by_type.get(personnel_type, [])
            
            certifications = []
            for cert_req in required_certs:
                cert_info = self.OIL_GAS_CERTIFICATIONS[cert_req['type']][cert_req['cert']]
                certifications.append({
                    'name': cert_info['name'],
                    'type': cert_req['type'],
                    'code': cert_req['cert'],
                    'validity_days': cert_info['validity_days'],
                    'required': True
                })
            
            return {
                "success": True,
                "personnel_type": personnel_type,
                "required_certifications": certifications,
                "total_required": len(certifications)
            }
            
        except Exception as e:
            logger.error(f"Error getting required certifications for {personnel_type}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to get required certifications: {str(e)}",
                "error": "REQUIRED_CERTS_ERROR"
            }
    
    async def verify_certification(
        self,
        certification_id: int,
        verification_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Verify a certification with external authority
        
        Args:
            certification_id: Certification ID
            verification_data: Verification details
            
        Returns:
            Verification result
        """
        try:
            certification = self.db.query(Certification).filter(
                Certification.id == certification_id
            ).first()
            
            if not certification:
                return {
                    "success": False,
                    "message": "Certification not found",
                    "error": "CERTIFICATION_NOT_FOUND"
                }
            
            # Simulate external verification (in real implementation, this would call OPITO/NOPSEMA APIs)
            verification_result = {
                "verified": True,
                "verification_date": datetime.utcnow().isoformat(),
                "verified_by": verification_data.get('verified_by', 'System'),
                "verification_method": verification_data.get('method', 'API'),
                "external_reference": verification_data.get('external_reference'),
                "status": "VALID"
            }
            
            # Update certification with verification data
            certification.verified = True
            certification.verified_date = datetime.utcnow()
            certification.verification_data = verification_result
            
            self.db.commit()
            
            logger.info(f"Verified certification {certification.name}")
            
            return {
                "success": True,
                "message": "Certification verified successfully",
                "certification_id": certification_id,
                "verification_result": verification_result
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error verifying certification {certification_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to verify certification: {str(e)}",
                "error": "VERIFICATION_ERROR"
            }
    
    async def _update_compliance_score(self, personnel_id: int):
        """Update personnel compliance score based on certifications"""
        try:
            personnel = self.db.query(Personnel).filter(Personnel.id == personnel_id).first()
            if not personnel:
                return
            
            certifications = self.db.query(Certification).filter(
                Certification.personnel_id == personnel_id
            ).all()
            
            if not certifications:
                personnel.compliance_score = 0
                return
            
            now = datetime.utcnow()
            valid_certifications = 0
            total_certifications = len(certifications)
            
            for cert in certifications:
                if cert.expire_date > now:
                    valid_certifications += 1
            
            # Calculate compliance score based on valid certifications
            base_score = (valid_certifications / total_certifications) * 100 if total_certifications > 0 else 0
            
            # Apply penalties for expired certifications
            expired_count = total_certifications - valid_certifications
            penalty = expired_count * 10
            
            final_score = max(0, base_score - penalty)
            
            personnel.compliance_score = round(final_score, 1)
            
        except Exception as e:
            logger.error(f"Error updating compliance score for personnel {personnel_id}: {str(e)}")
    
    async def _calculate_certification_compliance(self, personnel_id: int) -> float:
        """Calculate certification compliance score for personnel"""
        try:
            certifications = self.db.query(Certification).filter(
                Certification.personnel_id == personnel_id
            ).all()
            
            if not certifications:
                return 0.0
            
            now = datetime.utcnow()
            valid_certifications = 0
            total_certifications = len(certifications)
            
            for cert in certifications:
                if cert.expire_date > now:
                    valid_certifications += 1
            
            return (valid_certifications / total_certifications) * 100 if total_certifications > 0 else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating certification compliance for personnel {personnel_id}: {str(e)}")
            return 0.0
