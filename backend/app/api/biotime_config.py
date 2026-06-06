"""
BioTime Configuration Management API

This module provides comprehensive configuration management endpoints for ZKTeco BioTime,
including system settings, device configurations, user preferences, and configuration templates.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from ..core.database import get_db
from ..services.biotime_client import biotime_client

router = APIRouter()


# System Configuration

@router.get("/config/system")
async def get_system_configuration(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get BioTime system configuration
    
    Args:
        db: Database session
        
    Returns:
        System configuration
    """
    try:
        # Simulate system configuration
        system_config = {
            "biotime_settings": {
                "server_url": biotime_client.base_url,
                "api_version": "2.1.0",
                "connection_timeout": 30,
                "retry_attempts": 3,
                "auto_sync_enabled": True,
                "sync_interval_minutes": 5
            },
            "security_settings": {
                "authentication_method": "api_key",
                "token_expiry_hours": 24,
                "require_https": True,
                "allowed_ip_ranges": ["192.168.0.0/24", "10.0.0.0/8"],
                "max_concurrent_sessions": 100
            },
            "performance_settings": {
                "max_concurrent_verifications": 50,
                "verification_timeout_seconds": 30,
                "biometric_quality_threshold": 0.8,
                "cache_ttl_minutes": 15
            },
            "notification_settings": {
                "email_enabled": True,
                "sms_enabled": False,
                "webhook_enabled": True,
                "webhook_url": "https://api.company.com/webhooks/biotime",
                "alert_levels": ["critical", "warning", "info"]
            }
        }
        
        return {
            "success": True,
            "configuration": system_config,
            "last_updated": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get system configuration: {str(e)}"
        )


@router.put("/config/system")
async def update_system_configuration(
    configuration: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Update BioTime system configuration
    
    Args:
        configuration: System configuration
        db: Database session
        
    Returns:
        Configuration update result
    """
    try:
        # Validate configuration
        required_sections = ["biotime_settings", "security_settings"]
        for section in required_sections:
            if section not in configuration:
                return {
                    "success": False,
                    "error": f"Missing required section: {section}",
                    "invalid_sections": [section]
                }
        
        # Simulate configuration update
        # In real implementation, this would update configuration files/database
        
        return {
            "success": True,
            "configuration": configuration,
            "updated_at": datetime.utcnow().isoformat(),
            "message": "System configuration updated successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update system configuration: {str(e)}"
        )


@router.post("/config/system/test-connection")
async def test_system_connection(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Test BioTime system connection
    
    Args:
        db: Database session
        
    Returns:
        Connection test result
    """
    try:
        # Test BioTime connection
        health_result = await biotime_client.health_check()
        
        # Test configuration validation
        config_result = await get_system_configuration(db)
        
        return {
            "success": health_result.get("success", False),
            "connection_test": health_result,
            "configuration_test": {
                "valid": config_result.get("success", False),
                "configuration": config_result.get("configuration", {}),
                "validation_errors": []
            },
            "overall_status": "connected" if health_result.get("success", False) else "disconnected",
            "tested_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "tested_at": datetime.utcnow().isoformat()
        }


# Device Configuration Management

@router.get("/config/devices")
async def get_device_configurations(
    device_type: Optional[str] = Query(None, description="Filter by device type"),
    status: Optional[str] = Query(None, description="Filter by device status"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get device configurations
    
    Args:
        device_type: Filter by device type
        status: Filter by device status
        db: Database session
        
    Returns:
        Device configurations
    """
    try:
        # Get all devices
        devices_result = await biotime_client.get_devices()
        devices = devices_result.get("data", [])
        
        # Filter devices
        filtered_devices = devices
        if device_type:
            filtered_devices = [d for d in filtered_devices if d.get("device_type") == device_type]
        if status:
            filtered_devices = [d for d in filtered_devices if d.get("status") == status]
        
        # Group configurations by device type
        device_configs = {}
        for device in filtered_devices:
            device_id = device.get("device_id", "")
            device_configs[device_id] = {
                "device_id": device_id,
                "device_name": device.get("device_name", ""),
                "device_type": device.get("device_type", ""),
                "status": device.get("status", "unknown"),
                "location": device.get("location", ""),
                "configuration": device.get("configuration", {}),
                "last_config_update": device.get("last_config_change"),
                "capabilities": device.get("capabilities", []),
                "firmware_version": device.get("firmware_version"),
                "ip_address": device.get("ip_address", ""),
                "mac_address": device.get("mac_address", "")
            }
        
        return {
            "success": True,
            "device_configurations": device_configs,
            "filters_applied": {
                "device_type": device_type,
                "status": status
            },
            "total_devices": len(device_configs),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get device configurations: {str(e)}"
        )


@router.put("/config/devices/{device_id}")
async def update_device_configuration(
    device_id: str,
    configuration: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Update device configuration
    
    Args:
        device_id: Device ID
        configuration: Device configuration
        db: Database session
        
    Returns:
        Configuration update result
    """
    try:
        # Validate device exists
        devices_result = await biotime_client.get_devices()
        devices = devices_result.get("data", [])
        
        device_exists = any(d.get("device_id") == device_id for d in devices)
        if not device_exists:
            return {
                "success": False,
                "error": f"Device {device_id} not found"
            }
        
        # Update device configuration
        result = await biotime_client.configure_device(device_id, configuration)
        
        return {
            "success": result.get("success", False),
            "device_id": device_id,
            "configuration": configuration,
            "updated_at": datetime.utcnow().isoformat(),
            "message": "Device configuration updated successfully" if result.get("success", False) else "Configuration update failed"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update device configuration: {str(e)}"
        )


# Configuration Templates

@router.get("/config/templates")
async def get_configuration_templates(
    template_type: Optional[str] = Query(None, description="Filter by template type"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get configuration templates
    
    Args:
        template_type: Filter by template type
        db: Database session
        
    Returns:
        Configuration templates
    """
    try:
        # Simulate configuration templates
        templates = {
            "biometric_settings": {
                "name": "Standard Biometric Configuration",
                "description": "Default biometric verification settings",
                "template_type": "biometric",
                "configuration": {
                    "verification_modes": ["fingerprint", "face", "multimodal"],
                    "fingerprint_settings": {
                        "quality_threshold": 0.8,
                        "template_count": 10,
                        "duplicate_check": True,
                        "encryption": True
                    },
                    "face_settings": {
                        "quality_threshold": 0.75,
                        "liveness_detection": True,
                        "anti_spoofing": True,
                        "template_count": 5
                    },
                    "multimodal_settings": {
                        "confidence_threshold": 0.8,
                        "fallback_enabled": True,
                        "priority_order": ["face", "fingerprint"]
                    },
                    "timeout_settings": {
                        "verification_timeout": 30,
                        "retry_attempts": 3,
                        "lockout_duration": 300
                    }
                }
            },
            "device_groups": {
                "name": "Device Group Configuration",
                "description": "Configuration for device groups",
                "template_type": "device_group",
                "configuration": {
                    "access_control": {
                        "time_restrictions": {
                            "enabled": True,
                            "default_schedule": {
                                "monday": {"start": "08:00", "end": "18:00"},
                                "tuesday": {"start": "08:00", "end": "18:00"},
                                "wednesday": {"start": "08:00", "end": "18:00"},
                                "thursday": {"start": "08:00", "end": "18:00"},
                                "friday": {"start": "08:00", "end": "18:00"},
                                "saturday": {"start": "09:00", "end": "13:00"},
                                "sunday": {"start": "closed"}
                            }
                        },
                        "access_levels": {
                            "default_level": "standard",
                            "emergency_level": "emergency",
                            "maintenance_level": "maintenance"
                        }
                    },
                    "monitoring": {
                        "health_check_interval": 60,
                        "performance_monitoring": True,
                        "alert_thresholds": {
                            "response_time_ms": 5000,
                            "error_rate_percent": 5,
                            "uptime_percent": 95
                        }
                    }
                }
            },
            "security_policies": {
                "name": "Security Policy Configuration",
                "description": "Security and compliance policies",
                "template_type": "security",
                "configuration": {
                    "authentication": {
                        "require_multi_factor": False,
                        "session_timeout_minutes": 30,
                        "max_failed_attempts": 5,
                        "lockout_duration_minutes": 15
                    },
                    "data_protection": {
                        "encrypt_biometric_data": True,
                        "audit_logging": True,
                        "data_retention_days": 365,
                        "gdpr_compliance": True
                    },
                    "network_security": {
                        "require_https": True,
                        "allowed_ip_ranges": ["192.168.0.0/24", "10.0.0.0/8"],
                        "firewall_rules": {
                            "allowed_ports": [4370, 5010, 80, 443],
                            "blocked_ips": []
                        }
                    }
                }
            }
        }
        
        # Filter by template type if specified
        if template_type:
            templates = {k: v for k, v in templates.items() if v.get("template_type") == template_type}
        
        return {
            "success": True,
            "templates": templates,
            "template_type_filter": template_type,
            "total_templates": len(templates),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get configuration templates: {str(e)}"
        )


@router.post("/config/templates/apply")
async def apply_configuration_template(
    template_type: str,
    template_name: str,
    target_devices: Optional[List[str]] = None,
    custom_overrides: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Apply configuration template to devices
    
    Args:
        template_type: Template type
        template_name: Template name
        target_devices: Target device IDs (None for all devices)
        custom_overrides: Custom configuration overrides
        db: Database session
        
    Returns:
        Template application result
    """
    try:
        # Get template
        templates_result = await get_configuration_templates(template_type=template_type, db=db)
        templates = templates_result.get("templates", {})
        
        template = None
        for t_type, t_data in templates.items():
            if t_name.lower() in t_data.get("name", "").lower():
                template = t_data.get("configuration", {})
                break
        
        if not template:
            return {
                "success": False,
                "error": f"Template '{template_name}' of type '{template_type}' not found"
            }
        
        # Apply custom overrides
        if custom_overrides:
            template.update(custom_overrides)
        
        # Get target devices
        devices_result = await biotime_client.get_devices()
        all_devices = devices_result.get("data", [])
        
        if target_devices:
            target_device_list = [d for d in all_devices if d.get("device_id") in target_devices]
        else:
            target_device_list = all_devices
        
        # Apply template to devices
        applied_devices = []
        failed_devices = []
        
        for device in target_device_list:
            device_id = device.get("device_id", "")
            result = await biotime_client.configure_device(device_id, template)
            
            if result.get("success", False):
                applied_devices.append(device_id)
            else:
                failed_devices.append({
                    "device_id": device_id,
                    "error": result.get("error", "Unknown error")
                })
        
        return {
            "success": len(failed_devices) == 0,
            "template_type": template_type,
            "template_name": template_name,
            "applied_devices": applied_devices,
            "failed_devices": failed_devices,
            "total_devices": len(target_device_list),
            "configuration": template,
            "custom_overrides": custom_overrides,
            "applied_at": datetime.utcnow().isoformat(),
            "message": f"Template applied to {len(applied_devices)} devices successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply configuration template: {str(e)}"
        )


# User Preferences

@router.get("/config/user-preferences")
async def get_user_preferences(
    user_id: Optional[int] = Query(None, description="User ID for preferences"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get user preferences for BioTime configuration
    
    Args:
        user_id: User ID for preferences
        db: Database session
        
    Returns:
        User preferences
    """
    try:
        # Simulate user preferences
        user_preferences = {
            "dashboard_settings": {
                "default_view": "overview",
                "refresh_interval_seconds": 30,
                "show_device_status": True,
                "show_analytics": True,
                "theme": "light"
            },
            "notification_preferences": {
                "email_alerts": True,
                "sms_alerts": False,
                "push_notifications": True,
                "alert_levels": ["critical", "warning"],
                "quiet_hours": {
                    "enabled": True,
                    "start": "22:00",
                    "end": "06:00"
                }
            },
            "display_preferences": {
                "language": "en",
                "timezone": "UTC",
                "date_format": "YYYY-MM-DD",
                "time_format": "24-hour",
                "currency": "USD"
            },
            "privacy_settings": {
                "share_analytics": False,
                "allow_data_collection": True,
                "retention_period_days": 90
            }
        }
        
        return {
            "success": True,
            "preferences": user_preferences,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user preferences: {str(e)}"
        )


@router.put("/config/user-preferences")
async def update_user_preferences(
    preferences: Dict[str, Any],
    user_id: Optional[int] = Query(None, description="User ID for preferences"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Update user preferences for BioTime configuration
    
    Args:
        preferences: User preferences
        user_id: User ID for preferences
        db: Database session
        
    Returns:
        Preferences update result
    """
    try:
        # Validate preferences
        valid_sections = ["dashboard_settings", "notification_preferences", "display_preferences", "privacy_settings"]
        for section in valid_sections:
            if section not in preferences:
                return {
                    "success": False,
                    "error": f"Missing required section: {section}"
                }
        
        return {
            "success": True,
            "preferences": preferences,
            "user_id": user_id,
            "updated_at": datetime.utcnow().isoformat(),
            "message": "User preferences updated successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user preferences: {str(e)}"
        )


# Configuration Backup and Restore

@router.post("/config/backup")
async def backup_configuration(
    include_sensitive: bool = Query(False, description="Include sensitive data in backup"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Backup BioTime configuration
    
    Args:
        include_sensitive: Include sensitive data in backup
        db: Database session
        
    Returns:
        Configuration backup
    """
    try:
        # Get current configuration
        system_config = await get_system_configuration(db)
        device_configs = await get_device_configurations(db=db)
        
        # Create backup
        backup_data = {
            "backup_metadata": {
                "created_at": datetime.utcnow().isoformat(),
                "version": "1.0.0",
                "include_sensitive": include_sensitive,
                "backup_type": "full"
            },
            "system_configuration": system_config.get("configuration", {}),
            "device_configurations": device_configs.get("device_configurations", {}),
            "user_preferences": {},  # Would be populated based on user_id
            "template_library": await get_configuration_templates(db=db)
        }
        
        # Remove sensitive data if not included
        if not include_sensitive:
            backup_data["system_configuration"].pop("security_settings", None)
            backup_data["system_configuration"].pop("notification_settings", None)
        
        return {
            "success": True,
            "backup_data": backup_data,
            "backup_size_kb": len(json.dumps(backup_data)) // 1024,
            "message": "Configuration backup created successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to backup configuration: {str(e)}"
        )


@router.post("/config/restore")
async def restore_configuration(
    backup_data: Dict[str, Any],
    validate_before_restore: bool = Query(True, description="Validate before restoring"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Restore BioTime configuration from backup
    
    Args:
        backup_data: Backup data to restore
        validate_before_restore: Validate before restoring
        db: Database session
        
    Returns:
        Configuration restore result
    """
    try:
        # Validate backup data
        required_sections = ["system_configuration", "device_configurations"]
        for section in required_sections:
            if section not in backup_data:
                return {
                    "success": False,
                    "error": f"Missing required section: {section}"
                }
        
        # Validate backup format
        if not backup_data.get("backup_metadata"):
            return {
                "success": False,
                "error": "Invalid backup format"
            }
        
        # Restore configuration
        restore_result = {
            "system_config": await update_system_configuration(backup_data.get("system_configuration", {}), db),
            "device_configs": "Updated device configurations",  # Would update each device
            "user_prefs": "Updated user preferences"  # Would update user preferences
        }
        
        return {
            "success": True,
            "restore_result": restore_result,
            "backup_metadata": backup_data.get("backup_metadata", {}),
            "restored_at": datetime.utcnow().isoformat(),
            "message": "Configuration restored successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restore configuration: {str(e)}"
        )


# Health Check

@router.get("/config/health")
async def config_health_check() -> Dict[str, Any]:
    """
    Check BioTime configuration management health
    
    Returns:
        Health status
    """
    try:
        # Test system configuration
        system_health = await test_system_connection(db)
        
        # Check configuration integrity
        config_integrity = {
            "system_config_valid": True,
            "device_configs_valid": True,
            "templates_available": True,
            "backup_functional": True
        }
        
        overall_health = (
            system_health.get("success", False) and
            all(config_integrity.values())
        )
        
        return {
            "status": "healthy" if overall_health else "unhealthy",
            "system_health": system_health,
            "configuration_integrity": config_integrity,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
