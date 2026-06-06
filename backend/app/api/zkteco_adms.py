"""
ZKTeco ADMS API Endpoints for Multi-State Nigerian Deployment
Provides centralized reader management through ZKTeco ADMS cloud platform
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from ..core.database import get_db
from ..services.zkteco_adms_integration import zkteco_adms_integration
from ..core.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/adms/authenticate")
async def authenticate_adms(db: Session = Depends(get_db)):
    """Authenticate with ZKTeco ADMS platform"""
    try:
        result = await zkteco_adms_integration.authenticate_adms()
        return result
    except Exception as e:
        logger.error(f"ADMS authentication error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"ADMS authentication failed: {str(e)}"
        )

@router.get("/adms/states/{state_code}/readers")
async def get_state_readers(
    state_code: str,
    db: Session = Depends(get_db)
):
    """Get all readers assigned to a specific state from ADMS"""
    try:
        result = await zkteco_adms_integration.get_state_readers(state_code)
        return result
    except Exception as e:
        logger.error(f"Error fetching state readers: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch state readers: {str(e)}"
        )

@router.get("/adms/states/all")
async def get_all_states_readers(db: Session = Depends(get_db)):
    """Get readers across all states from ADMS"""
    try:
        result = await zkteco_adms_integration.get_all_states_readers()
        return result
    except Exception as e:
        logger.error(f"Error fetching all states readers: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch all states readers: {str(e)}"
        )

@router.post("/adms/devices/sync")
async def sync_device_to_adms(
    device_data: dict,
    db: Session = Depends(get_db)
):
    """Sync local device to ADMS platform"""
    try:
        result = await zkteco_adms_integration.sync_device_to_adms(device_data)
        return result
    except Exception as e:
        logger.error(f"Error syncing device to ADMS: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync device to ADMS: {str(e)}"
        )

@router.get("/adms/devices/{device_id}/status")
async def get_device_status_from_adms(
    device_id: str,
    db: Session = Depends(get_db)
):
    """Get real-time device status from ADMS"""
    try:
        result = await zkteco_adms_integration.get_device_status_from_adms(device_id)
        return result
    except Exception as e:
        logger.error(f"Error getting device status from ADMS: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get device status from ADMS: {str(e)}"
        )

@router.get("/adms/states/{state_code}/compliance")
async def get_state_compliance_report(
    state_code: str,
    db: Session = Depends(get_db)
):
    """Get compliance report for a specific state"""
    try:
        result = await zkteco_adms_integration.get_state_compliance_report(state_code)
        return result
    except Exception as e:
        logger.error(f"Error getting compliance report: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get compliance report: {str(e)}"
        )

@router.post("/adms/devices/deploy-template")
async def deploy_device_template(
    state_code: str,
    template_type: str,
    db: Session = Depends(get_db)
):
    """Deploy device template to a specific state"""
    try:
        result = await zkteco_adms_integration.deploy_device_template(state_code, template_type)
        return result
    except Exception as e:
        logger.error(f"Error deploying template: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to deploy template: {str(e)}"
        )

@router.get("/adms/dashboard")
async def get_adms_dashboard(db: Session = Depends(get_db)):
    """Get comprehensive ADMS dashboard data"""
    try:
        # Get all states data
        states_result = await zkteco_adms_integration.get_all_states_readers()
        
        dashboard_data = {
            "total_states": states_result.get("total_states", 0),
            "total_devices": states_result.get("summary", {}).get("total_devices", 0),
            "online_devices": states_result.get("summary", {}).get("online_devices", 0),
            "offline_devices": states_result.get("summary", {}).get("offline_devices", 0),
            "states": states_result.get("states", {}),
            "last_sync": states_result.get("last_sync", None),
            "adms_status": "connected" if states_result.get("success") else "disconnected"
        }
        
        return dashboard_data
    except Exception as e:
        logger.error(f"Error getting ADMS dashboard: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get ADMS dashboard: {str(e)}"
        )
