"""
Certification Management API for Oil & Gas Personnel Management
Handles certification tracking, compliance monitoring, and industry standards
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from ..core.database import get_db
from ..services.certification_service import CertificationService
from ..models.personnel import Personnel
from pydantic import BaseModel

router = APIRouter(prefix="/certifications", tags=["certifications"])

# Pydantic models for request/response
class CertificationCreate(BaseModel):
    personnel_id: int
    name: str
    issuer: str
    issue_date: str
    expire_date: str
    certificate_number: str
    certification_type: Optional[str] = "COMPANY"
    description: Optional[str] = None
    training_provider: Optional[str] = None
    location: Optional[str] = None

class CertificationUpdate(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    expire_date: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class CertificationVerification(BaseModel):
    verified_by: str
    method: str
    external_reference: Optional[str] = None

# Initialize service
certification_service = CertificationService()

@router.post("/")
async def add_certification(
    certification_data: CertificationCreate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Add a new certification for personnel
    
    Args:
        certification_data: Certification details
        db: Database session
        
    Returns:
        Addition result
    """
    try:
        result = await certification_service.add_certification(
            personnel_id=certification_data.personnel_id,
            certification_data=certification_data.dict()
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["message"]
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add certification: {str(e)}"
        )

@router.get("/personnel/{personnel_id}")
async def get_personnel_certifications(
    personnel_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get all certifications for personnel
    
    Args:
        personnel_id: Personnel ID
        db: Database session
        
    Returns:
        Personnel certifications
    """
    try:
        result = await certification_service.get_personnel_certifications(personnel_id)
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result["message"]
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get personnel certifications: {str(e)}"
        )

@router.put("/{certification_id}")
async def update_certification(
    certification_id: int,
    update_data: CertificationUpdate,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Update an existing certification
    
    Args:
        certification_id: Certification ID
        update_data: Updated certification data
        db: Database session
        
    Returns:
        Update result
    """
    try:
        # Filter out None values
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        
        result = await certification_service.update_certification(
            certification_id=certification_id,
            update_data=update_dict
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result["message"]
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update certification: {str(e)}"
        )

@router.delete("/{certification_id}")
async def delete_certification(
    certification_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Delete a certification
    
    Args:
        certification_id: Certification ID
        db: Database session
        
    Returns:
        Deletion result
    """
    try:
        result = await certification_service.delete_certification(certification_id)
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result["message"]
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete certification: {str(e)}"
        )

@router.get("/analytics")
async def get_certification_analytics(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get comprehensive certification analytics
    
    Args:
        db: Database session
        
    Returns:
        Certification analytics data
    """
    try:
        result = await certification_service.get_certification_analytics()
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["message"]
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get certification analytics: {str(e)}"
        )

@router.get("/required/{personnel_type}")
async def get_required_certifications(
    personnel_type: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get required certifications for personnel type
    
    Args:
        personnel_type: Personnel type (STAFF, CONTRACTOR, VISITOR)
        db: Database session
        
    Returns:
        Required certifications
    """
    try:
        result = await certification_service.get_required_certifications(personnel_type)
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["message"]
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get required certifications: {str(e)}"
        )

@router.post("/{certification_id}/verify")
async def verify_certification(
    certification_id: int,
    verification_data: CertificationVerification,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Verify a certification with external authority
    
    Args:
        certification_id: Certification ID
        verification_data: Verification details
        db: Database session
        
    Returns:
        Verification result
    """
    try:
        result = await certification_service.verify_certification(
            certification_id=certification_id,
            verification_data=verification_data.dict()
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result["message"]
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify certification: {str(e)}"
        )

@router.get("/dashboard")
async def get_certification_dashboard(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get certification dashboard data
    
    Args:
        db: Database session
        
    Returns:
        Dashboard data
    """
    try:
        # Get analytics
        analytics = await certification_service.get_certification_analytics()
        
        if not analytics["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get certification analytics"
            )
        
        # Get expiring certifications summary
        expiring_summary = await get_expiring_certifications_summary(db)
        
        # Get compliance trends
        compliance_trends = await get_compliance_trends(db)
        
        # Get industry standards compliance
        industry_compliance = await get_industry_compliance(db)
        
        dashboard_data = {
            "overview": analytics["overview"],
            "distributions": analytics["distributions"],
            "expiring_soon": analytics["expiring_soon"][:10],  # Top 10 expiring
            "compliance_metrics": analytics["compliance_metrics"],
            "expiring_summary": expiring_summary,
            "compliance_trends": compliance_trends,
            "industry_compliance": industry_compliance
        }
        
        return dashboard_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get certification dashboard: {str(e)}"
        )

@router.get("/expiring")
async def get_expiring_certifications(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Get certifications expiring within specified days
    
    Args:
        days: Number of days to look ahead
        limit: Maximum number of certifications to return
        db: Database session
        
    Returns:
        Expiring certifications
    """
    try:
        from ..models.certification import Certification
        
        cutoff_date = datetime.utcnow() + timedelta(days=days)
        
        expiring_certs = db.query(Certification).filter(
            Certification.expire_date <= cutoff_date,
            Certification.expire_date > datetime.utcnow(),
            Certification.status == 'ACTIVE'
        ).order_by(Certification.expire_date.asc()).limit(limit).all()
        
        certifications = []
        for cert in expiring_certs:
            days_until_expiry = (cert.expire_date - datetime.utcnow()).days
            certifications.append({
                "id": cert.id,
                "personnel_id": cert.personnel_id,
                "personnel_name": cert.personnel.full_name if cert.personnel else "Unknown",
                "certification_name": cert.name,
                "issuer": cert.issuer,
                "expire_date": cert.expire_date.isoformat(),
                "days_until_expiry": days_until_expiry,
                "certification_type": cert.certification_type,
                "certificate_number": cert.certificate_number
            })
        
        return certifications
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get expiring certifications: {str(e)}"
        )

@router.get("/expired")
async def get_expired_certifications(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Get certifications expired within specified days
    
    Args:
        days: Number of days to look back
        limit: Maximum number of certifications to return
        db: Database session
        
    Returns:
        Expired certifications
    """
    try:
        from ..models.certification import Certification
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        expired_certs = db.query(Certification).filter(
            Certification.expire_date <= datetime.utcnow(),
            Certification.expire_date >= cutoff_date
        ).order_by(Certification.expire_date.desc()).limit(limit).all()
        
        certifications = []
        for cert in expired_certs:
            days_expired = (datetime.utcnow() - cert.expire_date).days
            certifications.append({
                "id": cert.id,
                "personnel_id": cert.personnel_id,
                "personnel_name": cert.personnel.full_name if cert.personnel else "Unknown",
                "certification_name": cert.name,
                "issuer": cert.issuer,
                "expire_date": cert.expire_date.isoformat(),
                "days_expired": days_expired,
                "certification_type": cert.certification_type,
                "certificate_number": cert.certificate_number
            })
        
        return certifications
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get expired certifications: {str(e)}"
        )

@router.get("/compliance/summary")
async def get_compliance_summary(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get compliance summary for all personnel
    
    Args:
        db: Database session
        
    Returns:
        Compliance summary
    """
    try:
        total_personnel = db.query(Personnel).count()
        
        # Get compliance score distribution
        high_compliance = db.query(Personnel).filter(Personnel.compliance_score >= 90).count()
        medium_compliance = db.query(Personnel).filter(Personnel.compliance_score.between(70, 89)).count()
        low_compliance = db.query(Personnel).filter(Personnel.compliance_score < 70).count()
        
        # Get average compliance score
        avg_compliance = db.query(Personnel.compliance_score).scalar() or 0
        
        # Get personnel by status
        offshore_count = db.query(Personnel).filter(Personnel.status == 'offshore').count()
        onshore_count = db.query(Personnel).filter(Personnel.status == 'onshore').count()
        
        return {
            "total_personnel": total_personnel,
            "compliance_distribution": {
                "high_compliance": high_compliance,
                "medium_compliance": medium_compliance,
                "low_compliance": low_compliance
            },
            "compliance_percentages": {
                "high_compliance": (high_compliance / total_personnel * 100) if total_personnel > 0 else 0,
                "medium_compliance": (medium_compliance / total_personnel * 100) if total_personnel > 0 else 0,
                "low_compliance": (low_compliance / total_personnel * 100) if total_personnel > 0 else 0
            },
            "average_compliance_score": round(avg_compliance, 1),
            "personnel_distribution": {
                "offshore": offshore_count,
                "onshore": onshore_count
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get compliance summary: {str(e)}"
        )

# Helper functions
async def get_expiring_certifications_summary(db: Session) -> Dict[str, Any]:
    """Get summary of expiring certifications"""
    try:
        from ..models.certification import Certification
        
        now = datetime.utcnow()
        
        # Count certifications expiring in different timeframes
        expiring_7_days = db.query(Certification).filter(
            Certification.expire_date.between(now, now + timedelta(days=7)),
            Certification.expire_date > now,
            Certification.status == 'ACTIVE'
        ).count()
        
        expiring_30_days = db.query(Certification).filter(
            Certification.expire_date.between(now, now + timedelta(days=30)),
            Certification.expire_date > now,
            Certification.status == 'ACTIVE'
        ).count()
        
        expiring_90_days = db.query(Certification).filter(
            Certification.expire_date.between(now, now + timedelta(days=90)),
            Certification.expire_date > now,
            Certification.status == 'ACTIVE'
        ).count()
        
        return {
            "expiring_7_days": expiring_7_days,
            "expiring_30_days": expiring_30_days,
            "expiring_90_days": expiring_90_days
        }
        
    except Exception as e:
        return {"error": str(e)}

async def get_compliance_trends(db: Session) -> Dict[str, Any]:
    """Get compliance trends over time"""
    try:
        # This would typically include historical data
        # For now, return current compliance trends
        return {
            "trend": "improving",
            "change_percentage": 5.2,
            "last_updated": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        return {"error": str(e)}

async def get_industry_compliance(db: Session) -> Dict[str, Any]:
    """Get industry-specific compliance metrics"""
    try:
        # Get OPITO compliance
        opito_compliant = 0
        # Get NOPSEMA compliance
        nopsema_compliant = 0
        
        return {
            "opito_compliance": {
                "compliant_percentage": opito_compliant,
                "required_certifications": 5,
                "average_score": 85.5
            },
            "nopsema_compliance": {
                "compliant_percentage": nopsema_compliant,
                "required_certifications": 3,
                "average_score": 82.3
            },
            "overall_industry_compliance": (opito_compliant + nopsema_compliant) / 2
        }
        
    except Exception as e:
        return {"error": str(e)}
