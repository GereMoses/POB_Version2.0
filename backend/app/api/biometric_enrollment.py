"""
Biometric Enrollment API
REST API endpoints for biometric template enrollment and verification
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from ..core.database import get_db
from ..services.biometric_enrollment_service import biometric_enrollment_service
from ..schemas.biometric_enrollment import (
    BiometricEnrollmentRequest, FingerprintEnrollmentRequest, FaceEnrollmentRequest, PalmEnrollmentRequest,
    EnrollmentSessionResponse, EnrollmentProgressResponse, BiometricVerificationRequest,
    BiometricVerificationResponse, EnrollmentStatisticsResponse, DeviceStatusResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/biometric-enrollment", tags=["Biometric Enrollment"])


@router.post("/start-session", response_model=dict)
async def start_enrollment_session(
    request: BiometricEnrollmentRequest,
    db: Session = Depends(get_db)
):
    """
    Start a new biometric enrollment session
    
    Args:
        request: Biometric enrollment request data
        db: Database session
        
    Returns:
        Session initiation result
    """
    try:
        result = await biometric_enrollment_service.start_enrollment_session(request, db)
        if result["success"]:
            return {
                "success": True,
                "session_id": result["session_id"],
                "status": result["status"],
                "message": result["message"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to start enrollment session")
            )
    except Exception as e:
        logger.error(f"Error in start_enrollment_session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/enroll-fingerprint", response_model=dict)
async def enroll_fingerprint(
    request: FingerprintEnrollmentRequest,
    db: Session = Depends(get_db)
):
    """
    Enroll fingerprint biometric template
    
    Args:
        request: Fingerprint enrollment request
        db: Database session
        
    Returns:
        Fingerprint enrollment result
    """
    try:
        result = await biometric_enrollment_service.enroll_fingerprint(request, db)
        if result["success"]:
            return {
                "success": True,
                "session_id": result["session_id"],
                "template_id": result["template_id"],
                "status": result["status"],
                "message": result["message"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to enroll fingerprint")
            )
    except Exception as e:
        logger.error(f"Error in enroll_fingerprint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/enroll-face", response_model=dict)
async def enroll_face(
    request: FaceEnrollmentRequest,
    db: Session = Depends(get_db)
):
    """
    Enroll face biometric template
    
    Args:
        request: Face enrollment request
        db: Database session
        
    Returns:
        Face enrollment result
    """
    try:
        result = await biometric_enrollment_service.enroll_face(request, db)
        if result["success"]:
            return {
                "success": True,
                "session_id": result["session_id"],
                "template_id": result["template_id"],
                "status": result["status"],
                "message": result["message"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to enroll face")
            )
    except Exception as e:
        logger.error(f"Error in enroll_face: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/enroll-palm", response_model=dict)
async def enroll_palm(
    request: PalmEnrollmentRequest,
    db: Session = Depends(get_db)
):
    """
    Enroll palm vein biometric template
    
    Args:
        request: Palm enrollment request
        db: Database session
        
    Returns:
        Palm enrollment result
    """
    try:
        result = await biometric_enrollment_service.enroll_palm(request, db)
        if result["success"]:
            return {
                "success": True,
                "session_id": result["session_id"],
                "template_id": result["template_id"],
                "status": result["status"],
                "message": result["message"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to enroll palm")
            )
    except Exception as e:
        logger.error(f"Error in enroll_palm: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/progress/{session_id}", response_model=dict)
async def get_enrollment_progress(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Get enrollment session progress
    
    Args:
        session_id: Enrollment session ID
        db: Database session
        
    Returns:
        Enrollment progress information
    """
    try:
        result = await biometric_enrollment_service.get_enrollment_progress(session_id, db)
        if result["success"]:
            return {
                "success": True,
                "session_id": result["session_id"],
                "status": result["status"],
                "progress_percentage": result["progress_percentage"],
                "current_step": result["current_step"],
                "templates_collected": result["templates_collected"],
                "templates_required": result["templates_required"],
                "quality_score": result["quality_score"],
                "estimated_time_remaining": result["estimated_time_remaining"],
                "next_action": result["next_action"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "Enrollment session not found")
            )
    except Exception as e:
        logger.error(f"Error in get_enrollment_progress: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/verify", response_model=dict)
async def verify_biometric(
    request: BiometricVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Verify biometric data
    
    Args:
        request: Biometric verification request
        db: Database session
        
    Returns:
        Biometric verification result
    """
    try:
        result = await biometric_enrollment_service.verify_biometric(request, db)
        if result["success"]:
            return {
                "success": True,
                "verification_id": result["verification_id"],
                "personnel_id": result["personnel_id"],
                "is_successful": result["is_successful"],
                "confidence_score": result["confidence_score"],
                "response_time_ms": result["response_time_ms"],
                "verified_at": result["verified_at"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Biometric verification failed")
            )
    except Exception as e:
        logger.error(f"Error in verify_biometric: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/statistics", response_model=dict)
async def get_enrollment_statistics(
    db: Session = Depends(get_db)
):
    """
    Get enrollment statistics
    
    Args:
        db: Database session
        
    Returns:
        Enrollment statistics
    """
    try:
        result = await biometric_enrollment_service.get_enrollment_statistics(db)
        if result["success"]:
            return {
                "success": True,
                "data": result["data"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to get statistics")
            )
    except Exception as e:
        logger.error(f"Error in get_enrollment_statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/personnel/{personnel_id}/templates", response_model=dict)
async def get_personnel_templates(
    personnel_id: int,
    template_type: Optional[str] = Query(None, description="Filter by template type"),
    db: Session = Depends(get_db)
):
    """
    Get biometric templates for personnel
    
    Args:
        personnel_id: Personnel ID
        template_type: Optional template type filter
        db: Database session
        
    Returns:
        Personnel biometric templates
    """
    try:
        result = await biometric_enrollment_service.get_personnel_templates(
            personnel_id, template_type, db
        )
        if result["success"]:
            return {
                "success": True,
                "data": result["data"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "Personnel templates not found")
            )
    except Exception as e:
        logger.error(f"Error in get_personnel_templates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.delete("/templates/{template_id}", response_model=dict)
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete/deactivate biometric template
    
    Args:
        template_id: Template ID
        db: Database session
        
    Returns:
        Template deletion result
    """
    try:
        result = await biometric_enrollment_service.delete_template(template_id, db)
        if result["success"]:
            return {
                "success": True,
                "message": result["message"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "Template not found")
            )
    except Exception as e:
        logger.error(f"Error in delete_template: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/active-sessions", response_model=dict)
async def get_active_sessions(
    db: Session = Depends(get_db)
):
    """
    Get all active enrollment sessions
    
    Args:
        db: Database session
        
    Returns:
        Active enrollment sessions
    """
    try:
        from ..models.biometric_templates import BiometricEnrollmentSession
        
        active_sessions = db.query(BiometricEnrollmentSession).filter(
            BiometricEnrollmentSession.status.in_(["INITIATED", "IN_PROGRESS"])
        ).all()
        
        return {
            "success": True,
            "data": [
                {
                    "session_id": session.session_id,
                    "personnel_id": session.personnel_id,
                    "template_type": session.template_type,
                    "device_serial": session.device_serial,
                    "status": session.status,
                    "progress_percentage": session.progress_percentage,
                    "current_step": session.current_step,
                    "started_at": session.started_at.isoformat(),
                    "last_activity": session.last_activity.isoformat()
                }
                for session in active_sessions
            ]
        }
    except Exception as e:
        logger.error(f"Error in get_active_sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/cancel-session/{session_id}", response_model=dict)
async def cancel_enrollment_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Cancel enrollment session
    
    Args:
        session_id: Session ID to cancel
        db: Database session
        
    Returns:
        Session cancellation result
    """
    try:
        from ..models.biometric_templates import BiometricEnrollmentSession
        from datetime import datetime
        
        session = db.query(BiometricEnrollmentSession).filter(
            BiometricEnrollmentSession.session_id == session_id
        ).first()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Enrollment session not found"
            )
        
        session.status = "CANCELLED"
        session.completed_at = datetime.utcnow()
        db.commit()
        
        # Remove from active sessions
        if session_id in biometric_enrollment_service.active_sessions:
            del biometric_enrollment_service.active_sessions[session_id]
        
        logger.info(f"Enrollment session {session_id} cancelled")
        
        return {
            "success": True,
            "message": "Enrollment session cancelled successfully"
        }
        
    except Exception as e:
        logger.error(f"Error in cancel_enrollment_session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
