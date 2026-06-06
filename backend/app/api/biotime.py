"""
BioTime Integration API Endpoints

This module provides comprehensive API endpoints for ZKTeco BioTime integration,
including personnel synchronization, biometric management, attendance processing,
and real-time verification capabilities.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import io

from ..core.database import get_db
from ..services.biotime_sync_service import biotime_sync_service
from ..services.biotime_client import biotime_client

router = APIRouter()


# Configuration Management

@router.post("/configure")
async def configure_biotime(
    base_url: str,
    api_key: str
) -> Dict[str, Any]:
    """
    Configure BioTime API connection settings
    
    Args:
        base_url: BioTime server base URL
        api_key: BioTime API key
        
    Returns:
        Configuration result
    """
    try:
        biotime_client.configure(base_url, api_key)
        
        # Test connection
        health_check = await biotime_client.health_check()
        
        return {
            "success": health_check.get("success", False),
            "message": "BioTime configuration updated successfully" if health_check.get("success") else "Configuration saved but connection failed",
            "base_url": base_url,
            "connection_status": health_check,
            "configured_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure BioTime: {str(e)}"
        )


@router.get("/configuration")
async def get_biotime_configuration() -> Dict[str, Any]:
    """
    Get current BioTime configuration
    
    Returns:
        Current configuration status
    """
    try:
        health_status = await biotime_client.health_check()
        sync_status = await biotime_sync_service.get_sync_status()
        
        return {
            "success": True,
            "configured": biotime_client.api_key is not None,
            "base_url": biotime_client.base_url,
            "connection_status": health_status,
            "sync_status": sync_status,
            "last_check": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get BioTime configuration: {str(e)}"
        )


# Personnel Synchronization

@router.post("/sync/personnel/from-biotime")
async def sync_personnel_from_biotime(
    force_sync: bool = Query(False, description="Force full sync regardless of last sync time"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync personnel data from BioTime to POB system
    
    Args:
        force_sync: Force full sync regardless of last sync time
        db: Database session
        
    Returns:
        Sync result with statistics
    """
    try:
        result = await biotime_sync_service.sync_personnel_from_biotime(db, force_sync=force_sync)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync personnel from BioTime: {str(e)}"
        )


@router.post("/sync/personnel/to-biotime")
async def sync_personnel_to_biotime(
    personnel_ids: Optional[List[int]] = Query(None, description="Specific personnel IDs to sync"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync personnel data from POB to BioTime
    
    Args:
        personnel_ids: Specific personnel IDs to sync (None for all)
        db: Database session
        
    Returns:
        Sync result with statistics
    """
    try:
        result = await biotime_sync_service.sync_personnel_to_biotime(db, personnel_ids=personnel_ids)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync personnel to BioTime: {str(e)}"
        )


@router.get("/sync/status")
async def get_sync_status() -> Dict[str, Any]:
    """
    Get current BioTime synchronization status
    
    Returns:
        Sync status information
    """
    try:
        result = await biotime_sync_service.get_sync_status()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sync status: {str(e)}"
        )


@router.post("/sync/full")
async def force_full_sync(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Force full synchronization with BioTime
    
    Args:
        db: Database session
        
    Returns:
        Full sync result
    """
    try:
        result = await biotime_sync_service.force_full_sync(db)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to force full sync: {str(e)}"
        )


# Biometric Management

@router.post("/biometric/enroll")
async def enroll_biometric(
    personnel_id: int,
    biometric_type: str = Query(..., description="Type of biometric (fingerprint, face)"),
    template_data: Dict[str, Any] = ...,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Enroll biometric template for personnel and sync with BioTime
    
    Args:
        personnel_id: Personnel ID
        biometric_type: Type of biometric (fingerprint, face)
        template_data: Template data
        db: Database session
        
    Returns:
        Enrollment result
    """
    try:
        result = await biotime_sync_service.enroll_biometric_template(
            personnel_id=personnel_id,
            biometric_type=biometric_type,
            template_data=template_data,
            db=db
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enroll biometric: {str(e)}"
        )


@router.post("/biometric/verify")
async def verify_biometric(
    personnel_id: int,
    biometric_data: Dict[str, Any] = ...,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Real-time biometric verification
    
    Args:
        personnel_id: Personnel ID
        biometric_data: Biometric data for verification
        db: Database session
        
    Returns:
        Verification result
    """
    try:
        result = await biotime_sync_service.verify_biometric_realtime(
            personnel_id=personnel_id,
            biometric_data=biometric_data,
            db=db
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify biometric: {str(e)}"
        )


@router.get("/biometric/templates/{personnel_id}")
async def get_biometric_templates(
    personnel_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get biometric templates for personnel
    
    Args:
        personnel_id: Personnel ID
        db: Database session
        
    Returns:
        Biometric templates
    """
    try:
        from ..models.personnel import Personnel
        
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Personnel not found"
            )
        
        templates = {
            "fingerprint_templates": personnel.fingerprint_templates or [],
            "face_template": personnel.face_template,
            "biometric_enrolled": personnel.biometric_enrolled,
            "biometric_data": personnel.biometric_data or {}
        }
        
        return {
            "success": True,
            "personnel_id": personnel_id,
            "templates": templates
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get biometric templates: {str(e)}"
        )


@router.delete("/biometric/templates/{template_id}")
async def delete_biometric_template(
    template_id: str,
    personnel_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Delete biometric template
    
    Args:
        template_id: Template ID
        personnel_id: Personnel ID
        db: Database session
        
    Returns:
        Deletion result
    """
    try:
        from ..models.personnel import Personnel
        
        personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
        if not personnel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Personnel not found"
            )
        
        # Remove template from local database
        if personnel.fingerprint_templates:
            personnel.fingerprint_templates = [
                t for t in personnel.fingerprint_templates 
                if t.get("id") != template_id
            ]
        
        if template_id == "face_template":
            personnel.face_template = None
        
        # Update biometric enrollment status
        if not personnel.fingerprint_templates and not personnel.face_template:
            personnel.biometric_enrolled = False
        
        personnel.updated_at = datetime.utcnow()
        db.commit()
        
        # TODO: Delete from BioTime when API is available
        
        return {
            "success": True,
            "message": "Biometric template deleted successfully",
            "template_id": template_id
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete biometric template: {str(e)}"
        )


# Attendance Integration

@router.post("/attendance/sync")
async def sync_attendance_from_biotime(
    date_from: Optional[datetime] = Query(None, description="Start date for attendance sync"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Sync attendance records from BioTime to POB system
    
    Args:
        date_from: Start date for attendance sync
        db: Database session
        
    Returns:
        Sync result with statistics
    """
    try:
        result = await biotime_sync_service.sync_attendance_from_biotime(db, date_from=date_from)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync attendance from BioTime: {str(e)}"
        )


@router.get("/attendance/report")
async def get_attendance_report(
    report_type: str = Query("daily", description="Type of report: daily, weekly, monthly"),
    date_from: datetime = Query(..., description="Start date for report"),
    date_to: datetime = Query(..., description="End date for report"),
    personnel_ids: Optional[List[int]] = Query(None, description="Filter by personnel IDs"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate attendance report from BioTime
    
    Args:
        report_type: Type of report
        date_from: Start date for report
        date_to: End date for report
        personnel_ids: Filter by personnel IDs
        db: Database session
        
    Returns:
        Attendance report
    """
    try:
        result = await biotime_client.get_attendance_report(
            report_type=report_type,
            from_date=date_from,
            to_date=date_to,
            filters={"personnel_ids": personnel_ids} if personnel_ids else {}
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate attendance report: {str(e)}"
        )


# Device Integration

@router.get("/devices")
async def get_biotime_devices() -> Dict[str, Any]:
    """
    Get all BioTime devices
    
    Returns:
        Device list
    """
    try:
        result = await biotime_client.get_devices()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get BioTime devices: {str(e)}"
        )


@router.get("/devices/{device_id}/status")
async def get_device_status(
    device_id: str
) -> Dict[str, Any]:
    """
    Get BioTime device status
    
    Args:
        device_id: Device ID
        
    Returns:
        Device status
    """
    try:
        result = await biotime_client.get_device_status(device_id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device status: {str(e)}"
        )


@router.put("/devices/{device_id}/configure")
async def configure_device(
    device_id: str,
    config: Dict[str, Any] = ...,
) -> Dict[str, Any]:
    """
    Configure BioTime device
    
    Args:
        device_id: Device ID
        config: Device configuration
        
    Returns:
        Configuration result
    """
    try:
        result = await biotime_client.configure_device(device_id, config)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure device: {str(e)}"
        )


# Access Control

@router.get("/access/levels")
async def get_access_levels() -> Dict[str, Any]:
    """
    Get access levels from BioTime
    
    Returns:
        Access levels
    """
    try:
        result = await biotime_client.get_access_levels()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get access levels: {str(e)}"
        )


@router.post("/access/assign")
async def assign_access_level(
    employee_id: str,
    access_level_id: str
) -> Dict[str, Any]:
    """
    Assign access level to personnel in BioTime
    
    Args:
        employee_id: Employee ID
        access_level_id: Access level ID
        
    Returns:
        Assignment result
    """
    try:
        result = await biotime_client.assign_access_level(employee_id, access_level_id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign access level: {str(e)}"
        )


@router.post("/access/revoke")
async def revoke_access(
    employee_id: str,
    device_id: str
) -> Dict[str, Any]:
    """
    Revoke access for personnel in BioTime
    
    Args:
        employee_id: Employee ID
        device_id: Device ID
        
    Returns:
        Revocation result
    """
    try:
        result = await biotime_client.revoke_access(employee_id, device_id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke access: {str(e)}"
        )


# Reporting and Analytics

@router.get("/reports/biometric-usage")
async def get_biometric_usage_report(
    date_from: datetime = Query(..., description="Start date for report"),
    date_to: datetime = Query(..., description="End date for report"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get biometric usage report from BioTime
    
    Args:
        date_from: Start date for report
        date_to: End date for report
        db: Database session
        
    Returns:
        Biometric usage report
    """
    try:
        result = await biotime_client.get_biometric_usage_report(date_from, date_to)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get biometric usage report: {str(e)}"
        )


@router.get("/analytics/sync-performance")
async def get_sync_performance(
    days: int = Query(30, ge=1, le=365, description="Number of days for analytics"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get synchronization performance analytics
    
    Args:
        days: Number of days for analytics
        db: Database session
        
    Returns:
        Sync performance analytics
    """
    try:
        sync_status = await biotime_sync_service.get_sync_status()
        
        # Calculate performance metrics
        performance_data = {
            "sync_health": sync_status.get("biotime_connection", {}).get("success", False),
            "last_syncs": sync_status.get("last_sync_summary", {}),
            "error_rate": 0,
            "avg_sync_time": 0,
            "total_synced_records": sync_status.get("last_sync_summary", {}).get("total_synced", 0)
        }
        
        return {
            "success": True,
            "period_days": days,
            "performance": performance_data,
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sync performance: {str(e)}"
        )


# Health and Diagnostics

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Check BioTime integration health
    
    Returns:
        Health status
    """
    try:
        biotime_health = await biotime_client.health_check()
        sync_status = await biotime_sync_service.get_sync_status()
        
        overall_health = (
            biotime_health.get("success", False) and
            sync_status.get("sync_status", {}).get("biotime_connection", {}).get("success", False)
        )
        
        return {
            "status": "healthy" if overall_health else "unhealthy",
            "biotime_connection": biotime_health,
            "sync_status": sync_status,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/test-connection")
async def test_biotime_connection() -> Dict[str, Any]:
    """
    Test BioTime API connection
    
    Returns:
        Connection test result
    """
    try:
        result = await biotime_client.health_check()
        
        return {
            "success": result.get("success", False),
            "message": "BioTime connection successful" if result.get("success") else "BioTime connection failed",
            "connection_details": result,
            "tested_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "BioTime connection test failed",
            "tested_at": datetime.utcnow().isoformat()
        }
