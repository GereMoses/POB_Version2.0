"""
Device Synchronization API
REST API endpoints for device synchronization and management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from ..core.database import get_db
from ..services.device_sync_service import device_sync_service
from ..schemas.biometric_enrollment import DeviceCommandRequest, DeviceCommandResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/device-sync", tags=["Device Synchronization"])


@router.post("/sync-user/{personnel_id}", response_model=dict)
async def sync_user_to_device(
    personnel_id: int,
    device_serial: str = Query(..., description="Device serial number"),
    db: Session = Depends(get_db)
):
    """
    Sync personnel data to ZKTeco device
    
    Args:
        personnel_id: Personnel ID to sync
        device_serial: Device serial number
        db: Database session
        
    Returns:
        Sync operation result
    """
    try:
        result = await device_sync_service.sync_user_to_device(personnel_id, device_serial, db)
        if result["success"]:
            return {
                "success": True,
                "sync_id": result["sync_id"],
                "status": result["status"],
                "message": result["message"],
                "data": result["data"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to sync user to device")
            )
    except Exception as e:
        logger.error(f"Error in sync_user_to_device: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/sync-all/{device_serial}", response_model=dict)
async def sync_all_personnel_to_device(
    device_serial: str,
    db: Session = Depends(get_db)
):
    """
    Sync all active personnel to ZKTeco device
    
    Args:
        device_serial: Device serial number
        db: Database session
        
    Returns:
        Bulk sync result
    """
    try:
        result = await device_sync_service.sync_all_personnel_to_device(device_serial, db)
        if result["success"]:
            return {
                "success": True,
                "device_serial": result["device_serial"],
                "total_personnel": result["total_personnel"],
                "successful_syncs": result["successful_syncs"],
                "failed_syncs": result["failed_syncs"],
                "sync_results": result["sync_results"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to sync all personnel to device"
            )
    except Exception as e:
        logger.error(f"Error in sync_all_personnel_to_device: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/send-command", response_model=dict)
async def send_command_to_device(
    request: DeviceCommandRequest,
    db: Session = Depends(get_db)
):
    """
    Send command to ZKTeco device
    
    Args:
        request: Device command request
        db: Database session
        
    Returns:
        Command result
    """
    try:
        result = await device_sync_service.send_command_to_device(
            request.device_serial,
            request.command,
            request.parameters,
            request.timeout_seconds,
            db
        )
        
        if result["success"]:
            return {
                "success": True,
                "command_id": result["command_id"],
                "status": result["status"],
                "message": "Command sent successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to send command to device")
            )
    except Exception as e:
        logger.error(f"Error in send_command_to_device: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/device-status/{device_serial}", response_model=dict)
async def get_device_status(
    device_serial: str,
    db: Session = Depends(get_db)
):
    """
    Get device status and connectivity
    
    Args:
        device_serial: Device serial number
        db: Database session
        
    Returns:
        Device status information
    """
    try:
        result = await device_sync_service.get_device_status(device_serial, db)
        if result["success"]:
            return {
                "success": True,
                "data": result
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "Device not found")
            )
    except Exception as e:
        logger.error(f"Error in get_device_status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/devices", response_model=dict)
async def get_device_list(
    db: Session = Depends(get_db)
):
    """
    Get all registered devices
    
    Args:
        db: Database session
        
    Returns:
        List of devices
    """
    try:
        result = await device_sync_service.get_device_list(db)
        if result["success"]:
            return {
                "success": True,
                "data": result["data"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to get device list")
            )
    except Exception as e:
        logger.error(f"Error in get_device_list: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/sync-operations", response_model=dict)
async def get_sync_operations(
    device_serial: Optional[str] = Query(None, description="Filter by device serial"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db)
):
    """
    Get synchronization operations
    
    Args:
        device_serial: Optional device serial filter
        status: Optional status filter
        db: Database session
        
    Returns:
        List of sync operations
    """
    try:
        result = await device_sync_service.get_sync_operations(device_serial, status, db)
        return {
            "success": True,
            "data": result["data"]
        }
    except Exception as e:
        logger.error(f"Error in get_sync_operations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/complete-sync/{sync_id}", response_model=dict)
async def complete_sync_operation(
    sync_id: str,
    response_data: Optional[dict] = None,
    error_message: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Complete synchronization operation
    
    Args:
        sync_id: Sync operation ID
        response_data: Response data from device
        error_message: Error message
        db: Database session
        
    Returns:
        Operation completion result
    """
    try:
        result = await device_sync_service.complete_sync_operation(
            sync_id, response_data, error_message, db
        )
        
        if result["success"]:
            return {
                "success": True,
                "sync_id": sync_id,
                "status": result["status"],
                "message": result["message"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("error", "Failed to complete sync operation")
            )
    except Exception as e:
        logger.error(f"Error in complete_sync_operation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/statistics", response_model=dict)
async def get_sync_statistics(
    db: Session = Depends(get_db)
):
    """
    Get synchronization statistics
    
    Args:
        db: Database session
        
    Returns:
        Sync statistics
    """
    try:
        result = await device_sync_service.get_sync_statistics(db)
        if result["success"]:
            return {
                "success": True,
                "data": result["data"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to get sync statistics")
            )
    except Exception as e:
        logger.error(f"Error in get_sync_statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.post("/configure-device/{device_serial}", response_model=dict)
async def configure_device(
    device_serial: str,
    configuration: dict,
    restart_device: Optional[bool] = False,
    db: Session = Depends(get_db)
):
    """
    Configure device settings
    
    Args:
        device_serial: Device serial number
        configuration: Device configuration
        restart_device: Whether to restart device after configuration
        db: Database session
        
    Returns:
        Configuration result
    """
    try:
        from ..models.biometric_templates import BiometricDevice
        
        device = db.query(BiometricDevice).filter(
            BiometricDevice.device_serial == device_serial
        ).first()
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found"
            )
        
        # Update device configuration
        device.configuration = configuration
        device.updated_at = datetime.utcnow()
        db.commit()
        
        # Send restart command if requested
        if restart_device:
            await device_sync_service.send_command_to_device(
                device_serial, "RESTART", {}, 10, db
            )
        
        logger.info(f"Device {device_serial} configured successfully")
        
        return {
            "success": True,
            "message": "Device configured successfully",
            "configuration_status": "APPLIED"
        }
        
    except Exception as e:
        logger.error(f"Error in configure_device: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.delete("/device/{device_serial}", response_model=dict)
async def delete_device(
    device_serial: str,
    db: Session = Depends(get_db)
):
    """
    Delete/deactivate device
    
    Args:
        device_serial: Device serial number to delete
        db: Database session
        
    Returns:
        Deletion result
    """
    try:
        from ..models.biometric_templates import BiometricDevice
        
        device = db.query(BiometricDevice).filter(
            BiometricDevice.device_serial == device_serial
        ).first()
        
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found"
            )
        
        # Soft delete by deactivating
        device.is_active = False
        db.commit()
        
        logger.info(f"Device {device_serial} deactivated")
        
        return {
            "success": True,
            "message": "Device deactivated successfully"
        }
        
    except Exception as e:
        logger.error(f"Error in delete_device: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )
