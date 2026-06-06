"""
ZKTeco ADMS Integration Service for Multi-State Nigerian Deployment
Handles ZKTeco ADMS cloud platform integration for centralized reader management
"""

import asyncio
import aiohttp
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.config import settings
from ..models.device import Device, DeviceStatus, DeviceType
from ..models.personnel import Personnel

logger = logging.getLogger(__name__)

class ZKTecoADMSIntegration:
    """ZKTeco ADMS Integration Service for Multi-State Management"""

    def __init__(self):
        self.adms_server = settings.ZKTECO_ADMS_SERVER
        self.adms_port = settings.ZKTECO_ADMS_PORT
        self.company_id = settings.ZKTECO_COMPANY_ID
        self.adms_token = settings.ZKTECO_ADMS_TOKEN
        self.timeout = settings.ZKTECO_TIMEOUT

    async def authenticate_adms(self) -> Dict[str, Any]:
        """Authenticate with ZKTeco ADMS platform"""
        try:
            auth_data = {
                "company_id": self.company_id,
                "token": self.adms_token,
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.adms_server}:{self.adms_port}/api/v1/auth/login",
                    json=auth_data,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "token": result.get("token"),
                            "company_id": result.get("company_id"),
                            "expires_at": result.get("expires_at")
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"ADMS authentication failed: {response.status}"
                        }
        except Exception as e:
            logger.error(f"ADMS authentication error: {e}")
            return {
                "success": False,
                "error": f"ADMS authentication error: {str(e)}"
            }
    
    async def get_state_readers(self, state_code: str) -> Dict[str, Any]:
        """Get all readers assigned to a specific state from ADMS"""
        try:
            headers = {
                "Authorization": f"Bearer {self.adms_token}",
                "Content-Type": "application/json"
            }
            
            params = {
                "state_code": state_code,
                "include_devices": True,
                "include_personnel": True
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.adms_server}:{self.adms_port}/api/v1/devices/state/{state_code}",
                    headers=headers,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "state_code": state_code,
                            "readers": result.get("readers", []),
                            "personnel": result.get("personnel", []),
                            "total_devices": result.get("total_devices", 0),
                            "online_devices": result.get("online_devices", 0),
                            "offline_devices": result.get("offline_devices", 0)
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Failed to fetch state readers: {response.status}"
                        }
        except Exception as e:
            logger.error(f"Error fetching state readers: {e}")
            return {
                "success": False,
                "error": f"Error fetching state readers: {str(e)}"
            }
    
    async def get_all_states_readers(self) -> Dict[str, Any]:
        """Get readers across all states from ADMS"""
        try:
            headers = {
                "Authorization": f"Bearer {self.adms_token}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.adms_server}:{self.adms_port}/api/v1/devices/all-states",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "states": result.get("states", {}),
                            "total_states": result.get("total_states", 0),
                            "summary": {
                                "total_devices": result.get("summary", {}).get("total_devices", 0),
                                "online_devices": result.get("summary", {}).get("online_devices", 0),
                                "offline_devices": result.get("summary", {}).get("offline_devices", 0)
                            }
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Failed to fetch all states readers: {response.status}"
                        }
        except Exception as e:
            logger.error(f"Error fetching all states readers: {e}")
            return {
                "success": False,
                "error": f"Error fetching all states readers: {str(e)}"
            }
    
    async def sync_device_to_adms(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sync local device to ADMS platform"""
        try:
            headers = {
                "Authorization": f"Bearer {self.adms_token}",
                "Content-Type": "application/json"
            }
            
            # Prepare device data for ADMS
            adms_device_data = {
                "device_id": device_data.get("device_id"),
                "name": device_data.get("name"),
                "serial_number": device_data.get("serial_number"),
                "model": device_data.get("model"),
                "manufacturer": device_data.get("manufacturer"),
                "ip_address": device_data.get("ip_address"),
                "port": device_data.get("port", 4370),
                "mac_address": device_data.get("mac_address"),
                "location": device_data.get("location"),
                "zone": device_data.get("zone"),
                "building": device_data.get("building"),
                "floor": device_data.get("floor"),
                "state": device_data.get("state"),
                "device_type": device_data.get("device_type", "BIOMETRIC_READER"),
                "status": device_data.get("status", "OFFLINE"),
                "firmware_version": device_data.get("firmware_version"),
                "hardware_version": device_data.get("hardware_version"),
                "zkteco_device_id": device_data.get("zkteco_device_id"),
                "zkteco_config": device_data.get("zkteco_config", {}),
                "site_id": device_data.get("site_id"),
                "last_seen": device_data.get("last_seen"),
                "battery_level": device_data.get("battery_level"),
                "signal_strength": device_data.get("signal_strength"),
                "access_mode": device_data.get("access_mode", "normal"),
                "authorized_personnel": device_data.get("authorized_personnel", []),
                "access_schedule": device_data.get("access_schedule", {}),
                "encryption_enabled": device_data.get("encryption_enabled", True),
                "settings": device_data.get("settings", {}),
                "custom_fields": device_data.get("custom_fields", {})
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.adms_server}:{self.adms_port}/api/v1/devices/sync",
                    headers=headers,
                    json=adms_device_data,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "device_id": result.get("device_id"),
                            "sync_status": result.get("sync_status", "synced"),
                            "sync_timestamp": result.get("sync_timestamp"),
                            "adms_device_id": result.get("adms_device_id")
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Failed to sync device to ADMS: {response.status}"
                        }
        except Exception as e:
            logger.error(f"Error syncing device to ADMS: {e}")
            return {
                "success": False,
                "error": f"Error syncing device to ADMS: {str(e)}"
            }
    
    async def get_device_status_from_adms(self, device_id: str) -> Dict[str, Any]:
        """Get real-time device status from ADMS"""
        try:
            headers = {
                "Authorization": f"Bearer {self.adms_token}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.adms_server}:{self.adms_port}/api/v1/devices/{device_id}/status",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)  # Short timeout for status
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "device_id": device_id,
                            "status": result.get("status"),
                            "last_heartbeat": result.get("last_heartbeat"),
                            "connectivity": result.get("connectivity"),
                            "active_sessions": result.get("active_sessions", 0),
                            "error_count": result.get("error_count", 0),
                            "last_error": result.get("last_error")
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Failed to get device status: {response.status}"
                        }
        except Exception as e:
            logger.error(f"Error getting device status from ADMS: {e}")
            return {
                "success": False,
                "error": f"Error getting device status from ADMS: {str(e)}"
            }
    
    async def get_state_compliance_report(self, state_code: str) -> Dict[str, Any]:
        """Get compliance report for a specific state"""
        try:
            headers = {
                "Authorization": f"Bearer {self.adms_token}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.adms_server}:{self.adms_port}/api/v1/reports/state/{state_code}/compliance",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "state_code": state_code,
                            "compliance": result.get("compliance", {}),
                            "generated_at": result.get("generated_at"),
                            "report_period": result.get("report_period", "30_days")
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Failed to get compliance report: {response.status}"
                        }
        except Exception as e:
            logger.error(f"Error getting compliance report: {e}")
            return {
                "success": False,
                "error": f"Error getting compliance report: {str(e)}"
            }
    
    async def deploy_device_template(self, state_code: str, template_type: str) -> Dict[str, Any]:
        """Deploy device template to a specific state"""
        try:
            headers = {
                "Authorization": f"Bearer {self.adms_token}",
                "Content-Type": "application/json"
            }
            
            template_data = {
                "state_code": state_code,
                "template_type": template_type,  # "OFFICE", "PRODUCTION", "SAFETY", "RESTRICTED"
                "deployment_config": {
                    "auto_discovery": True,
                    "bulk_assignment": True,
                    "sync_interval": 300  # 5 minutes
                }
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.adms_server}:{self.adms_port}/api/v1/devices/deploy-template",
                    headers=headers,
                    json=template_data,
                    timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "deployment_id": result.get("deployment_id"),
                            "template_type": template_type,
                            "state_code": state_code,
                            "status": result.get("status", "pending"),
                            "estimated_completion": result.get("estimated_completion")
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Failed to deploy template: {response.status}"
                        }
        except Exception as e:
            logger.error(f"Error deploying template: {e}")
            return {
                "success": False,
                "error": f"Error deploying template: {str(e)}"
            }

# Global ADMS service instance
zkteco_adms_integration = ZKTecoADMSIntegration()
