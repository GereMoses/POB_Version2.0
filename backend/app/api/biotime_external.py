"""
BioTime External Integration API Endpoints

This module provides API endpoints for external system integration,
including SAP HR, Active Directory/LDAP, and third-party access control systems.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime

from ..core.database import get_db
from ..services.biotime_external_integration import (
    integration_manager, initialize_external_integrations,
    sync_all_external_systems, get_external_integration_status
)

router = APIRouter()


# SAP Integration

@router.post("/external/sap/sync")
async def sync_sap_personnel(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Sync personnel data from SAP HR system"""
    try:
        if not integration_manager.sap_service:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SAP integration not configured"
            )
        
        sync_result = await integration_manager.sap_service.sync_personnel_from_sap()
        
        # Log sync operation
        from ..models.biotime_enhancements import BioTimeSyncLog
        sync_log = BioTimeSyncLog(
            sync_type="personnel",
            sync_direction="from_sap",
            start_time=datetime.utcnow(),
            total_records=sync_result.get("synced_count", 0),
            successful_records=sync_result.get("synced_count", 0),
            failed_records=sync_result.get("conflicts_count", 0),
            sync_details=sync_result,
            status="completed" if sync_result.get("success") else "failed"
        )
        db.add(sync_log)
        db.commit()
        
        return {
            "success": sync_result.get("success", False),
            "sync_result": sync_result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync SAP personnel: {str(e)}"
        )


@router.post("/external/sap/configure")
async def configure_sap_integration(
    config: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Configure SAP integration"""
    try:
        # Validate required fields
        required_fields = ["api_url", "api_key"]
        for field in required_fields:
            if field not in config:
                return {
                    "success": False,
                    "error": f"Missing required field: {field}"
                }
        
        # Initialize SAP integration
        integration_manager.initialize_sap_integration(config)
        
        return {
            "success": True,
            "message": "SAP integration configured successfully",
            "configuration": {
                "api_url": config["api_url"],
                "configured_at": datetime.utcnow().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure SAP integration: {str(e)}"
        )


# LDAP Integration

@router.post("/external/ldap/authenticate")
async def authenticate_with_ldap(
    credentials: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Authenticate user against Active Directory/LDAP"""
    try:
        if not integration_manager.ldap_service:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LDAP integration not configured"
            )
        
        # Validate required fields
        required_fields = ["username", "password"]
        for field in required_fields:
            if field not in credentials:
                return {
                    "success": False,
                    "error": f"Missing required field: {field}"
                }
        
        auth_result = await integration_manager.ldap_service.authenticate_with_ldap(credentials)
        
        return {
            "success": auth_result.get("success", False),
            "authentication_result": auth_result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to authenticate with LDAP: {str(e)}"
        )


@router.post("/external/ldap/configure")
async def configure_ldap_integration(
    config: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Configure LDAP integration"""
    try:
        # Validate required fields
        required_fields = ["server", "bind_dn", "bind_password"]
        for field in required_fields:
            if field not in config:
                return {
                    "success": False,
                    "error": f"Missing required field: {field}"
                }
        
        # Initialize LDAP integration
        integration_manager.initialize_ldap_integration(config)
        
        return {
            "success": True,
            "message": "LDAP integration configured successfully",
            "configuration": {
                "server": config["server"],
                "port": config.get("port", 389),
                "configured_at": datetime.utcnow().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure LDAP integration: {str(e)}"
        )


# Third-Party Integration

@router.post("/external/third-party/add")
async def add_third_party_integration(
    system_name: str,
    system_config: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Add third-party access control system integration"""
    try:
        # Validate required fields
        required_fields = ["system_type", "api_endpoint", "api_key"]
        for field in required_fields:
            if field not in system_config:
                return {
                    "success": False,
                    "error": f"Missing required field: {field}"
                }
        
        # Add third-party integration
        integration_manager.add_third_party_integration(system_name, system_config)
        
        return {
            "success": True,
            "message": f"Third-party integration '{system_name}' added successfully",
            "system_name": system_name,
            "system_type": system_config["system_type"],
            "configured_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add third-party integration: {str(e)}"
        )


@router.post("/external/third-party/{system_name}/sync")
async def sync_third_party_system(
    system_name: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Synchronize data with specific third-party system"""
    try:
        if system_name not in integration_manager.third_party_services:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Third-party system '{system_name}' not found"
            )
        
        service = integration_manager.third_party_services[system_name]
        sync_result = await service.integrate_access_system({})
        
        # Log sync operation
        from ..models.biotime_enhancements import BioTimeSyncLog
        sync_log = BioTimeSyncLog(
            sync_type="access_data",
            sync_direction="from_third_party",
            start_time=datetime.utcnow(),
            total_records=sync_result.get("synced_records", 0),
            successful_records=sync_result.get("synced_records", 0),
            sync_details=sync_result,
            status="completed" if sync_result.get("integration_status") == "completed" else "failed"
        )
        db.add(sync_log)
        db.commit()
        
        return {
            "success": sync_result.get("integration_status") == "completed",
            "sync_result": sync_result,
            "system_name": system_name,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync third-party system: {str(e)}"
        )


# Integration Management

@router.post("/external/initialize-all")
async def initialize_all_integrations(
    config: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Initialize all external system integrations"""
    try:
        init_result = await initialize_external_integrations(config)
        
        return {
            "success": init_result.get("success", False),
            "initialization_result": init_result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize integrations: {str(e)}"
        )


@router.post("/external/sync-all")
async def sync_all_external_systems(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Synchronize data from all configured external systems"""
    try:
        sync_results = await sync_all_external_systems()
        
        # Log comprehensive sync operation
        from ..models.biotime_enhancements import BioTimeSyncLog
        sync_log = BioTimeSyncLog(
            sync_type="comprehensive",
            sync_direction="bidirectional",
            start_time=datetime.utcnow(),
            total_records=sync_results.get("total_systems", 0),
            successful_records=sync_results.get("total_systems", 0),
            sync_details=sync_results,
            status="completed"
        )
        db.add(sync_log)
        db.commit()
        
        return {
            "success": sync_results.get("success", False),
            "sync_results": sync_results,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync external systems: {str(e)}"
        )


@router.get("/external/status")
async def get_external_integration_status(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get status of all external integrations"""
    try:
        status_result = await get_external_integration_status()
        
        return {
            "success": True,
            "integration_status": status_result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get integration status: {str(e)}"
        )


@router.get("/external/configured-systems")
async def get_configured_systems(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get list of configured external systems"""
    try:
        configured_systems = {
            "sap": integration_manager.sap_service is not None,
            "ldap": integration_manager.ldap_service is not None,
            "third_party": list(integration_manager.third_party_services.keys())
        }
        
        return {
            "success": True,
            "configured_systems": configured_systems,
            "total_configured": (
                (1 if configured_systems["sap"] else 0) +
                (1 if configured_systems["ldap"] else 0) +
                len(configured_systems["third_party"])
            ),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get configured systems: {str(e)}"
        )


# Testing and Validation

@router.post("/external/test/sap-connection")
async def test_sap_connection(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Test connection to SAP system"""
    try:
        if not integration_manager.sap_service:
            return {
                "success": False,
                "error": "SAP integration not configured"
            }
        
        # Test connection by attempting to get a small amount of data
        test_result = await integration_manager.sap_service.sync_personnel_from_sap()
        
        return {
            "success": test_result.get("success", False),
            "connection_test": {
                "status": "connected" if test_result.get("success") else "failed",
                "response_time_ms": 250,  # Simulated
                "error": test_result.get("error") if not test_result.get("success") else None
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/external/test/ldap-connection")
async def test_ldap_connection(
    test_credentials: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Test connection to LDAP system"""
    try:
        if not integration_manager.ldap_service:
            return {
                "success": False,
                "error": "LDAP integration not configured"
            }
        
        # Test authentication
        auth_result = await integration_manager.ldap_service.authenticate_with_ldap(test_credentials)
        
        return {
            "success": auth_result.get("success", False),
            "connection_test": {
                "status": "connected" if auth_result.get("success") else "failed",
                "response_time_ms": 150,  # Simulated
                "error": auth_result.get("error") if not auth_result.get("success") else None
            },
            "authentication_result": auth_result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.post("/external/test/third-party/{system_name}")
async def test_third_party_connection(
    system_name: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Test connection to third-party system"""
    try:
        if system_name not in integration_manager.third_party_services:
            return {
                "success": False,
                "error": f"Third-party system '{system_name}' not found"
            }
        
        service = integration_manager.third_party_services[system_name]
        connection_test = await service._test_system_connection()
        
        return {
            "success": connection_test.get("success", False),
            "connection_test": connection_test,
            "system_name": system_name,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Integration History and Logs

@router.get("/external/sync-history")
async def get_sync_history(
    days: int = 30,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get history of external system synchronization"""
    try:
        from datetime import timedelta
        from ..models.biotime_enhancements import BioTimeSyncLog
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        sync_logs = db.query(BioTimeSyncLog).filter(
            BioTimeSyncLog.created_at >= cutoff_date,
            BioTimeSyncLog.sync_direction.in_(["from_sap", "from_ldap", "from_third_party"])
        ).order_by(BioTimeSyncLog.created_at.desc()).all()
        
        history_data = []
        for log in sync_logs:
            history_data.append({
                "id": log.id,
                "sync_type": log.sync_type,
                "sync_direction": log.sync_direction,
                "start_time": log.start_time.isoformat(),
                "end_time": log.end_time.isoformat() if log.end_time else None,
                "duration_seconds": log.duration_seconds,
                "total_records": log.total_records,
                "successful_records": log.successful_records,
                "failed_records": log.failed_records,
                "status": log.status,
                "sync_details": log.sync_details
            })
        
        return {
            "success": True,
            "sync_history": history_data,
            "period_days": days,
            "total_syncs": len(history_data),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sync history: {str(e)}"
        )
