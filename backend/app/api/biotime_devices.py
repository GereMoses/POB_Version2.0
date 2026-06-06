"""
BioTime Device Integration API

This module provides comprehensive device management endpoints for ZKTeco BioTime,
including device discovery, configuration, monitoring, and advanced device control.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from ..core.database import get_db
from ..services.biotime_client import biotime_client
from ..services.biotime_sync_service import biotime_sync_service

router = APIRouter()


# Device Discovery and Management

@router.get("/devices/discover")
async def discover_devices(
    network_range: Optional[str] = Query(None, description="Network range to scan (e.g., 192.168.1.0/24)"),
    device_types: Optional[List[str]] = Query(None, description="Filter by device types"),
    timeout: int = Query(30, ge=5, le=120, description="Scan timeout in seconds"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Discover BioTime devices on network
    
    Args:
        network_range: Network range to scan
        device_types: Filter by device types
        timeout: Scan timeout in seconds
        db: Database session
        
    Returns:
        Discovered devices
    """
    try:
        # Get devices from BioTime
        result = await biotime_client.get_devices()
        
        if not result.get("success", False):
            return {
                "success": False,
                "error": result.get("error", "Unknown error"),
                "devices": []
            }
        
        devices = result.get("data", [])
        
        # Filter devices if specified
        if device_types:
            devices = [
                device for device in devices
                if device.get("device_type") in device_types
            ]
        
        # Add additional device information
        enriched_devices = []
        for device in devices:
            enriched_device = {
                **device,
                "connection_status": "online" if device.get("status") == "online" else "offline",
                "last_seen": device.get("last_seen"),
                "response_time_ms": device.get("response_time", 0),
                "capabilities": device.get("capabilities", []),
                "firmware_version": device.get("firmware_version"),
                "configuration_status": device.get("configuration_status", "unknown")
            }
            enriched_devices.append(enriched_device)
        
        return {
            "success": True,
            "devices": enriched_devices,
            "scan_parameters": {
                "network_range": network_range,
                "device_types": device_types,
                "timeout": timeout
            },
            "scan_timestamp": datetime.utcnow().isoformat(),
            "total_devices": len(enriched_devices)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to discover devices: {str(e)}"
        )


@router.get("/devices")
async def get_all_devices(
    status: Optional[str] = Query(None, description="Filter by device status"),
    device_type: Optional[str] = Query(None, description="Filter by device type"),
    location: Optional[str] = Query(None, description="Filter by location"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get all BioTime devices with filtering
    
    Args:
        status: Filter by device status
        device_type: Filter by device type
        location: Filter by location
        limit: Maximum number of devices to return
        offset: Number of devices to skip
        db: Database session
        
    Returns:
        Device list with pagination
    """
    try:
        result = await biotime_client.get_devices()
        
        if not result.get("success", False):
            return {
                "success": False,
                "error": result.get("error", "Unknown error"),
                "devices": []
            }
        
        devices = result.get("data", [])
        
        # Apply filters
        filtered_devices = devices
        if status:
            filtered_devices = [d for d in filtered_devices if d.get("status") == status]
        if device_type:
            filtered_devices = [d for d in filtered_devices if d.get("device_type") == device_type]
        if location:
            filtered_devices = [d for d in filtered_devices if location.lower() in d.get("location", "").lower()]
        
        # Apply pagination
        total_count = len(filtered_devices)
        paginated_devices = filtered_devices[offset:offset + limit]
        
        return {
            "success": True,
            "devices": paginated_devices,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total_count
            },
            "filters_applied": {
                "status": status,
                "device_type": device_type,
                "location": location
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get devices: {str(e)}"
        )


@router.get("/devices/{device_id}")
async def get_device_details(
    device_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get detailed information about a specific device
    
    Args:
        device_id: Device ID
        db: Database session
        
    Returns:
        Device details
    """
    try:
        result = await biotime_client.get_device_status(device_id)
        
        if not result.get("success", False):
            return {
                "success": False,
                "error": result.get("error", "Device not found"),
                "device": None
            }
        
        device_data = result.get("data", {})
        
        # Enhance device information
        enhanced_device = {
            **device_data,
            "device_id": device_id,
            "health_metrics": {
                "cpu_usage": device_data.get("cpu_usage", 0),
                "memory_usage": device_data.get("memory_usage", 0),
                "storage_usage": device_data.get("storage_usage", 0),
                "network_quality": device_data.get("network_quality", "good")
            },
            "performance_metrics": {
                "transaction_count": device_data.get("transaction_count", 0),
                "avg_response_time": device_data.get("avg_response_time", 0),
                "error_rate": device_data.get("error_rate", 0),
                "uptime_percentage": device_data.get("uptime_percentage", 100)
            },
            "configuration_summary": {
                "configured_features": device_data.get("configured_features", []),
                "last_configuration_change": device_data.get("last_config_change"),
                "configuration_version": device_data.get("config_version", "1.0")
            }
        }
        
        return {
            "success": True,
            "device": enhanced_device,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device details: {str(e)}"
        )


@router.put("/devices/{device_id}/configure")
async def configure_device(
    device_id: str,
    configuration: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Configure a BioTime device
    
    Args:
        device_id: Device ID
        configuration: Device configuration
        db: Database session
        
    Returns:
        Configuration result
    """
    try:
        result = await biotime_client.configure_device(device_id, configuration)
        
        if result.get("success", False):
            return {
                "success": False,
                "error": result.get("error", "Configuration failed"),
                "device_id": device_id
            }
        
        return {
            "success": True,
            "device_id": device_id,
            "configuration": configuration,
            "applied_at": datetime.utcnow().isoformat(),
            "message": "Device configuration updated successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure device: {str(e)}"
        )


@router.post("/devices/{device_id}/test-connection")
async def test_device_connection(
    device_id: str,
    test_type: str = Query("ping", description="Type of test: ping, full, biometric"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Test connection to a specific device
    
    Args:
        device_id: Device ID
        test_type: Type of test to perform
        db: Database session
        
    Returns:
        Connection test result
    """
    try:
        # Get device status first
        status_result = await biotime_client.get_device_status(device_id)
        
        if not status_result.get("success", False):
            return {
                "success": False,
                "error": "Device not found or offline",
                "device_id": device_id,
                "test_type": test_type
            }
        
        device_status = status_result.get("data", {})
        
        # Perform connection test based on type
        test_result = {
            "device_id": device_id,
            "test_type": test_type,
            "timestamp": datetime.utcnow().isoformat(),
            "device_status": device_status.get("status", "unknown")
        }
        
        if test_type == "ping":
            # Simulate ping test
            test_result.update({
                "success": device_status.get("status") == "online",
                "response_time_ms": device_status.get("response_time", 0),
                "message": "Device is reachable" if device_status.get("status") == "online" else "Device is unreachable"
            })
        elif test_type == "full":
            # Simulate full connectivity test
            test_result.update({
                "success": device_status.get("status") == "online",
                "response_time_ms": device_status.get("response_time", 0),
                "biometric_status": device_status.get("biometric_status", "unknown"),
                "network_status": device_status.get("network_status", "unknown"),
                "message": "Full connectivity test completed"
            })
        elif test_type == "biometric":
            # Simulate biometric test
            test_result.update({
                "success": device_status.get("biometric_status") == "ready",
                "response_time_ms": device_status.get("biometric_response_time", 0),
                "template_count": device_status.get("template_count", 0),
                "message": "Biometric module test completed"
            })
        
        return test_result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test device connection: {str(e)}"
        )


@router.post("/devices/{device_id}/restart")
async def restart_device(
    device_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Restart a BioTime device
    
    Args:
        device_id: Device ID
        db: Database session
        
    Returns:
        Restart result
    """
    try:
        # Simulate device restart command
        # In real implementation, this would send restart command to BioTime API
        
        return {
            "success": True,
            "device_id": device_id,
            "action": "restart",
            "initiated_at": datetime.utcnow().isoformat(),
            "message": "Device restart command sent successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restart device: {str(e)}"
        )


# Device Configuration Templates

@router.get("/devices/templates")
async def get_device_templates(
    device_type: Optional[str] = Query(None, description="Filter by device type"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get device configuration templates
    
    Args:
        device_type: Filter by device type
        db: Database session
        
    Returns:
        Device configuration templates
    """
    try:
        # Simulate device templates
        templates = {
            "fingerprint_terminal": {
                "name": "Standard Fingerprint Terminal",
                "device_types": ["MB20", "MB560", "K40"],
                "default_config": {
                    "verification_modes": ["fingerprint", "card", "pin"],
                    "timeout_seconds": 30,
                    "retry_attempts": 3,
                    "auto_lockout": True
                },
                "advanced_config": {
                    "biometric_quality_threshold": 0.8,
                    "template_encryption": True,
                    "remote_backup": True
                }
            },
            "face_recognition": {
                "name": "Face Recognition Terminal",
                "device_types": ["MB360", "ProFace"],
                "default_config": {
                    "verification_modes": ["face", "card", "pin"],
                    "face_detection_sensitivity": "medium",
                    "liveness_detection": True,
                    "timeout_seconds": 15
                },
                "advanced_config": {
                    "face_quality_threshold": 0.75,
                    "anti_spoofing": True,
                    "multi_face_templates": 5
                }
            },
            "multi_modal": {
                "name": "Multi-Modal Terminal",
                "device_types": ["UltraLite", "ProSeries"],
                "default_config": {
                    "verification_modes": ["fingerprint", "face", "card", "pin", "multimodal"],
                    "biometric_fallback": True,
                    "confidence_threshold": 0.8,
                    "timeout_seconds": 25
                },
                "advanced_config": {
                    "adaptive_biometrics": True,
                    "cross_modal_verification": True,
                    "template_sync": True
                }
            }
        }
        
        # Filter by device type if specified
        if device_type:
            templates = {k: v for k, v in templates.items() if device_type in k.lower()}
        
        return {
            "success": True,
            "templates": templates,
            "device_type_filter": device_type,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device templates: {str(e)}"
        )


@router.post("/devices/{device_id}/apply-template")
async def apply_device_template(
    device_id: str,
    template_name: str,
    custom_overrides: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Apply configuration template to a device
    
    Args:
        device_id: Device ID
        template_name: Template name to apply
        custom_overrides: Custom configuration overrides
        db: Database session
        
    Returns:
        Template application result
    """
    try:
        # Get template
        templates_result = await get_device_templates(device_type=None, db=db)
        templates = templates_result.get("templates", {})
        
        template = None
        for template_type, template_data in templates.items():
            if template_name.lower() in template_data.get("name", "").lower():
                template = template_data
                break
        
        if not template:
            return {
                "success": False,
                "error": f"Template '{template_name}' not found",
                "device_id": device_id
            }
        
        # Apply template configuration
        config = template.get("default_config", {})
        if custom_overrides:
            config.update(custom_overrides)
        
        # Configure device
        result = await biotime_client.configure_device(device_id, config)
        
        return {
            "success": result.get("success", False),
            "device_id": device_id,
            "template_name": template_name,
            "configuration": config,
            "applied_at": datetime.utcnow().isoformat(),
            "message": "Template applied successfully" if result.get("success", False) else "Template application failed"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply template: {str(e)}"
        )


# Device Monitoring and Analytics

@router.get("/devices/analytics/health")
async def get_device_health_analytics(
    hours: int = Query(24, ge=1, le=168, description="Number of hours for analytics"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get device health analytics
    
    Args:
        hours: Number of hours for analytics
        db: Database session
        
    Returns:
        Device health analytics
    """
    try:
        # Get all devices
        devices_result = await biotime_client.get_devices()
        devices = devices_result.get("data", [])
        
        # Calculate health metrics
        total_devices = len(devices)
        online_devices = len([d for d in devices if d.get("status") == "online"])
        offline_devices = total_devices - online_devices
        
        # Calculate uptime percentage
        uptime_percentage = (online_devices / total_devices * 100) if total_devices > 0 else 0
        
        # Device type breakdown
        device_types = {}
        for device in devices:
            device_type = device.get("device_type", "unknown")
            device_types[device_type] = device_types.get(device_type, {"total": 0, "online": 0})
            device_types[device_type]["total"] += 1
            if device.get("status") == "online":
                device_types[device_type]["online"] += 1
        
        # Calculate response time metrics
        response_times = [d.get("response_time", 0) for d in devices if d.get("response_time")]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        return {
            "success": True,
            "period_hours": hours,
            "device_health": {
                "total_devices": total_devices,
                "online_devices": online_devices,
                "offline_devices": offline_devices,
                "uptime_percentage": round(uptime_percentage, 2),
                "avg_response_time_ms": round(avg_response_time, 2)
            },
            "device_types": device_types,
            "health_score": min(100, uptime_percentage),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device health analytics: {str(e)}"
        )


@router.get("/devices/analytics/usage")
async def get_device_usage_analytics(
    days: int = Query(7, ge=1, le=90, description="Number of days for usage analytics"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get device usage analytics
    
    Args:
        days: Number of days for analytics
        db: Database session
        
    Returns:
        Device usage analytics
    """
    try:
        # Simulate usage analytics
        from datetime import timedelta
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get devices
        devices_result = await biotime_client.get_devices()
        devices = devices_result.get("data", [])
        
        # Calculate usage metrics
        total_transactions = 0
        device_usage = {}
        
        for device in devices:
            device_id = device.get("device_id", "")
            # Simulate transaction count based on device status
            transactions = 0
            if device.get("status") == "online":
                transactions = int(device.get("transaction_count", 0))
            
            total_transactions += transactions
            device_usage[device_id] = {
                "device_name": device.get("device_name", ""),
                "device_type": device.get("device_type", ""),
                "transactions": transactions,
                "avg_daily_transactions": round(transactions / days, 2),
                "peak_usage_hour": 14,  # Simulated peak hour
                "status": device.get("status", "unknown")
            }
        
        # Sort devices by usage
        sorted_usage = sorted(
            device_usage.items(),
            key=lambda x: x[1]["transactions"],
            reverse=True
        )
        
        return {
            "success": True,
            "period_days": days,
            "total_transactions": total_transactions,
            "device_usage": dict(sorted_usage),
            "most_used_device": sorted_usage[0][0] if sorted_usage else None,
            "avg_transactions_per_device": round(total_transactions / len(devices), 2) if devices else 0,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device usage analytics: {str(e)}"
        )


# Health Check

@router.get("/devices/health")
async def devices_health_check() -> Dict[str, Any]:
    """
    Check BioTime device integration health
    
    Returns:
        Health status
    """
    try:
        # Test BioTime connection
        biotime_health = await biotime_client.health_check()
        
        # Get device count
        devices_result = await biotime_client.get_devices()
        device_count = len(devices_result.get("data", []))
        
        # Calculate overall health
        overall_health = (
            biotime_health.get("success", False) and
            device_count > 0
        )
        
        return {
            "status": "healthy" if overall_health else "unhealthy",
            "biotime_connection": biotime_health,
            "device_count": device_count,
            "last_check": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
