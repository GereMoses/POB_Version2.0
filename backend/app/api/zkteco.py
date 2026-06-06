"""
ZKTeco Integration API Endpoints

This module provides REST API endpoints for integrating with ZKTeco biometric devices,
including personnel synchronization, biometric data capture, and verification.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from ..core.database import get_db
from ..services.zkteco.biometric_service import biometric_service

router = APIRouter(tags=["ZKTeco"])


# Pydantic models for API requests/responses
class BiometricCaptureRequest(BaseModel):
    device_identifier: str
    badge_id: str
    biometric_type: str = "fingerprint"


class BiometricVerificationRequest(BaseModel):
    device_ip: str
    badge_id: str
    biometric_data: Dict[str, Any]
    biometric_type: str = "fingerprint"


class PersonnelSyncRequest(BaseModel):
    device_ip: str
    device_port: int = 4370
    personnel_ids: Optional[List[int]] = None


@router.post("/biometric/capture")
async def capture_biometric_data(
    request: BiometricCaptureRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Capture biometric data from ZKTeco device via ADMS
    
    Args:
        request: Biometric capture request
        db: Database session
        
    Returns:
        Capture result with biometric templates
    """
    result = await biometric_service.capture_biometric_data(
        device_identifier=request.device_identifier,
        badge_id=request.badge_id,
        biometric_type=request.biometric_type
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Biometric capture failed")
        )
    
    return result


@router.post("/biometric/verify")
async def verify_biometric_data(
    request: BiometricVerificationRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Verify biometric data against stored templates
    
    Args:
        request: Biometric verification request
        db: Database session
        
    Returns:
        Verification result with confidence score
    """
    result = await biometric_service.verify_biometric(
        device_ip=request.device_ip,
        badge_id=request.badge_id,
        biometric_data=request.biometric_data,
        biometric_type=request.biometric_type
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Biometric verification failed")
        )
    
    return result


@router.post("/personnel/sync")
async def sync_personnel_to_device(
    request: PersonnelSyncRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Synchronize personnel data to ZKTeco device
    
    Args:
        request: Personnel sync request
        db: Database session
        
    Returns:
        Sync result with personnel count
    """
    result = await biometric_service.sync_personnel_to_device(
        device_ip=request.device_ip,
        device_port=request.device_port,
        personnel_ids=request.personnel_ids
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Personnel sync failed")
        )
    
    return result


@router.get("/device/{device_ip}/biometric-status")
async def get_device_biometric_status(
    device_ip: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get biometric status from ZKTeco device
    
    Args:
        device_ip: IP address of ZKTeco device
        db: Database session
        
    Returns:
        Device biometric status information
    """
    result = await biometric_service.get_device_biometric_status(device_ip)
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result.get("error", "Device not found or not accessible")
        )
    
    return result


@router.get("/personnel/{badge_id}/biometric-info")
async def get_personnel_biometric_info(
    badge_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get biometric information for a personnel
    
    Args:
        badge_id: Badge ID of personnel
        db: Database session
        
    Returns:
        Personnel biometric information
    """
    from ..models.personnel import Personnel
    
    personnel = db.query(Personnel).filter(Personnel.badge_id == badge_id).first()
    if not personnel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Personnel not found"
        )
    
    return {
        "personnel_id": personnel.id,
        "badge_id": personnel.badge_id,
        "full_name": personnel.full_name,
        "has_fingerprint": bool(personnel.fingerprint_templates),
        "fingerprint_count": len(personnel.fingerprint_templates) if personnel.fingerprint_templates else 0,
        "has_face": bool(personnel.face_template),
        "biometric_data": personnel.biometric_data or {},
        "last_seen": personnel.last_seen
    }


@router.post("/personnel/{badge_id}/biometric-delete")
async def delete_personnel_biometric(
    badge_id: str,
    biometric_type: str = Query(..., description="Type of biometric to delete: fingerprint, face, all"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Delete biometric data for a personnel
    
    Args:
        badge_id: Badge ID of personnel
        biometric_type: Type of biometric to delete
        db: Database session
        
    Returns:
        Deletion result
    """
    from ..models.personnel import Personnel
    
    personnel = db.query(Personnel).filter(Personnel.badge_id == badge_id).first()
    if not personnel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Personnel not found"
        )
    
    try:
        if biometric_type == "fingerprint":
            personnel.fingerprint_templates = None
            if personnel.biometric_data:
                personnel.biometric_data.pop("fingerprint_captured", None)
                personnel.biometric_data.pop("fingerprint_device", None)
        elif biometric_type == "face":
            personnel.face_template = None
            if personnel.biometric_data:
                personnel.biometric_data.pop("face_captured", None)
                personnel.biometric_data.pop("face_device", None)
        elif biometric_type == "all":
            personnel.fingerprint_templates = None
            personnel.face_template = None
            personnel.biometric_data = None
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid biometric_type. Must be: fingerprint, face, or all"
            )
        
        db.commit()
        db.refresh(personnel)
        
        return {
            "success": True,
            "message": f"Successfully deleted {biometric_type} biometric data",
            "badge_id": badge_id,
            "biometric_type": biometric_type
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete biometric data: {str(e)}"
        )


@router.get("/devices")
async def get_available_devices(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get list of available ZKTeco devices
    
    Args:
        db: Database session
        
    Returns:
        List of available ZKTeco devices
    """
    try:
        # Get devices from ZKTeco API
        devices = await biometric_service.get_available_devices()
        
        return {
            "success": True,
            "devices": devices,
            "total_count": len(devices)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve devices: {str(e)}"
        )


@router.get("/sync-status")
async def get_sync_status(
    device_ip: Optional[str] = Query(None, description="Filter by device IP"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get synchronization status for devices
    
    Args:
        device_ip: Optional device IP filter
        db: Database session
        
    Returns:
        Sync status information
    """
    sync_status = biometric_service.sync_status
    
    if device_ip:
        if device_ip in sync_status:
            return {
                "device_ip": device_ip,
                "status": sync_status[device_ip]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No sync status found for device"
            )
    
    return {
        "sync_status": sync_status,
        "total_devices": len(sync_status),
        "timestamp": str(biometric_service.sync_status)
    }
