"""
ZKTeco Biometric Data Integration Service

This service handles the integration with ZKTeco devices for biometric data management,
including fingerprint templates, face recognition templates, and personnel synchronization.
"""

import asyncio
import json
import logging
import os
import aiohttp
from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.config import settings
from ...models.personnel import Personnel
from ...models.user import User

logger = logging.getLogger(__name__)


class ZKTecoBiometricService:
    """Service for managing ZKTeco biometric data integration"""
    
    def __init__(self):
        self.device_connections = {}  # Store active device connections
        self.sync_status = {}  # Track synchronization status
        
    async def sync_personnel_to_device(
        self, 
        device_ip: str, 
        device_port: int = 4370,
        personnel_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        Synchronize personnel data to ZKTeco device
        
        Args:
            device_ip: IP address of ZKTeco device
            device_port: Port number (default 4370)
            personnel_ids: List of personnel IDs to sync (None for all)
            
        Returns:
            Dict with sync results
        """
        try:
            # Get database session
            db = next(get_db())
            
            # Query personnel
            query = db.query(Personnel).join(User, Personnel.user_id == User.id, isouter=True)
            if personnel_ids:
                query = query.filter(Personnel.id.in_(personnel_ids))
            
            personnel_list = query.all()
            
            # Prepare data for ZKTeco device
            sync_data = []
            for person in personnel_list:
                personnel_data = {
                    "badge_id": person.badge_id,
                    "name": person.full_name,
                    "email": person.email or "",
                    "role": person.role,
                    "company": person.company,
                    "department": person.department or "",
                    "status": person.status.value,
                    "biometric_data": person.biometric_data or {},
                    "fingerprint_templates": person.fingerprint_templates or {},
                    "face_template": person.face_template
                }
                sync_data.append(personnel_data)
            
            # Simulate device communication (replace with actual ZKTeco API)
            result = await self._send_to_device(device_ip, device_port, sync_data)
            
            # Update sync status
            self.sync_status[device_ip] = {
                "last_sync": datetime.utcnow(),
                "status": "success",
                "personnel_count": len(personnel_list)
            }
            
            return {
                "success": True,
                "device_ip": device_ip,
                "synced_personnel": len(personnel_list),
                "timestamp": datetime.utcnow().isoformat(),
                "details": result
            }
            
        except Exception as e:
            logger.error(f"Failed to sync personnel to device {device_ip}: {str(e)}")
            self.sync_status[device_ip] = {
                "last_sync": datetime.utcnow(),
                "status": "error",
                "error": str(e)
            }
            return {
                "success": False,
                "device_ip": device_ip,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        finally:
            if 'db' in locals():
                db.close()
    
    async def capture_biometric_data(
        self, 
        device_identifier: str, 
        badge_id: str,
        biometric_type: str = "fingerprint"
    ) -> Dict[str, Any]:
        """
        Capture biometric data from ZKTeco device via ADMS
        
        Args:
            device_identifier: Device identifier or serial number
            badge_id: Badge ID of personnel
            biometric_type: Type of biometric (fingerprint, face)
            
        Returns:
            Dict with capture results
        """
        try:
            # Find personnel by badge_id
            db = next(get_db())
            personnel = db.query(Personnel).filter(Personnel.badge_id == badge_id).first()
            
            if not personnel:
                return {
                    "success": False,
                    "error": f"Personnel with badge_id {badge_id} not found"
                }
            
            # Capture biometric data via ADMS
            capture_result = await self._capture_from_device(device_identifier, badge_id, biometric_type)
            
            if capture_result["success"]:
                # Update personnel biometric data
                if biometric_type == "fingerprint":
                    if not personnel.fingerprint_templates:
                        personnel.fingerprint_templates = {}
                    personnel.fingerprint_templates.update(capture_result["templates"])
                elif biometric_type == "face":
                    personnel.face_template = capture_result["face_template"]
                
                # Update biometric_data JSON field
                if not personnel.biometric_data:
                    personnel.biometric_data = {}
                personnel.biometric_data[f"{biometric_type}_captured"] = datetime.utcnow().isoformat()
                personnel.biometric_data[f"{biometric_type}_device"] = capture_result.get('device_ip', device_identifier)
                
                db.commit()
                db.refresh(personnel)
                
                return {
                    "success": True,
                    "personnel_id": personnel.id,
                    "badge_id": badge_id,
                    "biometric_type": biometric_type,
                    "templates_count": len(capture_result.get("templates", {})),
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return capture_result
                
        except Exception as e:
            logger.error(f"Failed to capture biometric data: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        finally:
            if 'db' in locals():
                db.close()
    
    async def verify_biometric(
        self, 
        device_ip: str, 
        badge_id: str,
        biometric_data: Dict[str, Any],
        biometric_type: str = "fingerprint"
    ) -> Dict[str, Any]:
        """
        Verify biometric data against stored templates
        
        Args:
            device_ip: IP address of ZKTeco device
            badge_id: Badge ID of personnel
            biometric_data: Biometric data to verify
            biometric_type: Type of biometric (fingerprint, face)
            
        Returns:
            Dict with verification results
        """
        try:
            # Find personnel by badge_id
            db = next(get_db())
            personnel = db.query(Personnel).filter(Personnel.badge_id == badge_id).first()
            
            if not personnel:
                return {
                    "success": False,
                    "verified": False,
                    "error": f"Personnel with badge_id {badge_id} not found"
                }
            
            # Get stored templates
            stored_templates = None
            if biometric_type == "fingerprint" and personnel.fingerprint_templates:
                stored_templates = personnel.fingerprint_templates
            elif biometric_type == "face" and personnel.face_template:
                stored_templates = {"face_template": personnel.face_template}
            
            if not stored_templates:
                return {
                    "success": False,
                    "verified": False,
                    "error": f"No {biometric_type} templates found for personnel"
                }
            
            # Simulate verification (replace with actual ZKTeco API)
            verification_result = await self._verify_on_device(
                device_ip, 
                badge_id, 
                biometric_data, 
                stored_templates,
                biometric_type
            )
            
            # Update last_seen if verification successful
            if verification_result.get("verified", False):
                personnel.last_seen = datetime.utcnow()
                db.commit()
            
            return {
                "success": True,
                "verified": verification_result.get("verified", False),
                "confidence": verification_result.get("confidence", 0),
                "personnel_id": personnel.id,
                "badge_id": badge_id,
                "biometric_type": biometric_type,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to verify biometric data: {str(e)}")
            return {
                "success": False,
                "verified": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        finally:
            if 'db' in locals():
                db.close()
    
    async def get_device_biometric_status(self, device_ip: str) -> Dict[str, Any]:
        """
        Get biometric status from ZKTeco device
        
        Args:
            device_ip: IP address of ZKTeco device
            
        Returns:
            Dict with device biometric status
        """
        try:
            # Simulate device status check (replace with actual ZKTeco API)
            status = await self._get_device_status(device_ip)
            
            return {
                "success": True,
                "device_ip": device_ip,
                "biometric_enabled": status.get("biometric_enabled", False),
                "fingerprint_count": status.get("fingerprint_count", 0),
                "face_count": status.get("face_count", 0),
                "device_status": status.get("status", "unknown"),
                "last_sync": self.sync_status.get(device_ip, {}).get("last_sync"),
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get device biometric status: {str(e)}")
            return {
                "success": False,
                "device_ip": device_ip,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    # Private methods (to be replaced with actual ZKTeco API implementations)
    
    async def _send_to_device(self, device_ip: str, device_port: int, data: List[Dict]) -> Dict[str, Any]:
        """Push personnel records to a ZKTeco device via direct TCP (ZKLib)."""
        try:
            from .direct_connection import zkteco_direct
            db = next(get_db())
            personnel_ids = [d.get("id") for d in data if d.get("id")]
            result = await zkteco_direct.sync_personnel_from_db(
                ip=device_ip,
                port=device_port,
                personnel_ids=personnel_ids if personnel_ids else None,
                db=db,
            )
            return {
                "status": "success" if result.get("success") else "error",
                "uploaded_count": result.get("synced", 0),
                "errors": result.get("errors", []),
                "device_response": "OK" if result.get("success") else result.get("error", "failed"),
            }
        except Exception as e:
            logger.error(f"_send_to_device error ({device_ip}): {e}")
            return {"status": "error", "uploaded_count": 0, "device_response": str(e)}
    
    async def _capture_from_device(self, device_identifier: str, badge_id: str, biometric_type: str) -> Dict[str, Any]:
        """Capture biometric data using ZKTeco ADMS centralized management"""
        try:
            adms_server = settings.ZKTECO_ADMS_SERVER
            adms_port = settings.ZKTECO_ADMS_PORT
            company_id = settings.ZKTECO_COMPANY_ID
            access_token = settings.ZKTECO_ADMS_TOKEN

            if not company_id or not access_token:
                return {"success": False, "error": "ZKTECO_COMPANY_ID and ZKTECO_ADMS_TOKEN must be configured"}

            base_url = f"{adms_server}:{adms_port}/api/v1"

            async with aiohttp.ClientSession() as session:
                auth_url = f"{base_url}/auth/login"
                auth_data = {"company_id": company_id, "token": access_token}

                async with session.post(auth_url, json=auth_data) as auth_response:
                    if auth_response.status != 200:
                        return {"success": False, "error": "ADMS authentication failed"}
                    
                    auth_result = await auth_response.json()
                    session_token = auth_result.get("session_token")
                    if not session_token:
                        return {"success": False, "error": "Invalid ADMS session token"}
                
                # Step 2: Get available devices for this site/location
                devices_url = f"{base_url}/devices/list"
                headers = {"Authorization": f"Bearer {session_token}"}
                
                async with session.get(devices_url, headers=headers) as devices_response:
                    if devices_response.status != 200:
                        return {"success": False, "error": "Failed to get device list"}
                    
                    devices_data = await devices_response.json()
                    available_devices = devices_data.get("devices", [])
                    
                    # Find the specified device or use first available
                    target_device = None
                    for device in available_devices:
                        if device.get("identifier") == device_identifier or device.get("sn") == device_identifier:
                            target_device = device
                            break
                    
                    if not target_device and available_devices:
                        target_device = available_devices[0]  # Use first available device
                    
                    if not target_device:
                        return {"success": False, "error": "No biometric devices available"}
                
                device_sn = target_device.get("sn")
                device_ip = target_device.get("ip", "unknown")
                
                # Step 3: Initiate biometric enrollment through ADMS
                if biometric_type == "fingerprint":
                    # Start fingerprint enrollment
                    enrollment_url = f"{base_url}/biometric/fingerprint/enroll"
                    enrollment_data = {
                        "device_sn": device_sn,
                        "personnel_id": badge_id,
                        "finger_index": 1,  # Right thumb by default
                        "enrollment_type": "new"
                    }
                    
                    async with session.post(enrollment_url, headers=headers, json=enrollment_data) as enroll_response:
                        if enroll_response.status != 200:
                            return {"success": False, "error": "Failed to start fingerprint enrollment"}
                        
                        enroll_result = await enroll_response.json()
                        
                        if not enroll_result.get("success"):
                            return {"success": False, "error": enroll_result.get("message", "Enrollment failed")}
                    
                    # Wait for enrollment to complete (poll for status)
                    enrollment_id = enroll_result.get("enrollment_id")
                    max_wait_time = 60  # 60 seconds max wait
                    wait_interval = 2
                    elapsed_time = 0
                    
                    while elapsed_time < max_wait_time:
                        status_url = f"{base_url}/biometric/fingerprint/status/{enrollment_id}"
                        
                        async with session.get(status_url, headers=headers) as status_response:
                            if status_response.status == 200:
                                status_data = await status_response.json()
                                enrollment_status = status_data.get("status")
                                
                                if enrollment_status == "completed":
                                    # Get the captured template
                                    template_url = f"{base_url}/biometric/fingerprint/template/{enrollment_id}"
                                    
                                    async with session.get(template_url, headers=headers) as template_response:
                                        if template_response.status == 200:
                                            template_data = await template_response.json()
                                            
                                            return {
                                                "success": True,
                                                "templates": {
                                                    f"finger_1": template_data.get("template_data", "")
                                                },
                                                "quality": template_data.get("quality", 95),
                                                "template_id": template_data.get("template_id"),
                                                "device_sn": device_sn,
                                                "device_ip": device_ip,
                                                "enrollment_id": enrollment_id
                                            }
                                
                                elif enrollment_status == "failed":
                                    return {"success": False, "error": "Fingerprint enrollment failed"}
                        
                        await asyncio.sleep(wait_interval)
                        elapsed_time += wait_interval
                    
                    return {"success": False, "error": "Fingerprint enrollment timeout"}
                
                elif biometric_type == "face":
                    # Start face enrollment
                    enrollment_url = f"{base_url}/biometric/face/enroll"
                    enrollment_data = {
                        "device_sn": device_sn,
                        "personnel_id": badge_id,
                        "enrollment_type": "new"
                    }
                    
                    async with session.post(enrollment_url, headers=headers, json=enrollment_data) as enroll_response:
                        if enroll_response.status != 200:
                            return {"success": False, "error": "Failed to start face enrollment"}
                        
                        enroll_result = await enroll_response.json()
                        
                        if not enroll_result.get("success"):
                            return {"success": False, "error": enroll_result.get("message", "Face enrollment failed")}
                    
                    # Wait for face enrollment to complete
                    enrollment_id = enroll_result.get("enrollment_id")
                    max_wait_time = 30  # 30 seconds for face
                    wait_interval = 2
                    elapsed_time = 0
                    
                    while elapsed_time < max_wait_time:
                        status_url = f"{base_url}/biometric/face/status/{enrollment_id}"
                        
                        async with session.get(status_url, headers=headers) as status_response:
                            if status_response.status == 200:
                                status_data = await status_response.json()
                                enrollment_status = status_data.get("status")
                                
                                if enrollment_status == "completed":
                                    # Get the captured face template
                                    template_url = f"{base_url}/biometric/face/template/{enrollment_id}"
                                    
                                    async with session.get(template_url, headers=headers) as template_response:
                                        if template_response.status == 200:
                                            template_data = await template_response.json()
                                            
                                            return {
                                                "success": True,
                                                "face_template": template_data.get("template_data", ""),
                                                "quality": template_data.get("quality", 92),
                                                "template_id": template_data.get("template_id"),
                                                "device_sn": device_sn,
                                                "device_ip": device_ip,
                                                "enrollment_id": enrollment_id
                                            }
                                
                                elif enrollment_status == "failed":
                                    return {"success": False, "error": "Face enrollment failed"}
                        
                        await asyncio.sleep(wait_interval)
                        elapsed_time += wait_interval
                    
                    return {"success": False, "error": "Face enrollment timeout"}
                
                return {"success": False, "error": "Unsupported biometric type"}
            
        except Exception as e:
            logger.error(f"ZKTeco ADMS biometric capture error: {str(e)}")
            return {"success": False, "error": f"ADMS communication error: {str(e)}"}
    
    async def _verify_on_device(
        self,
        device_ip: str,
        badge_id: str,
        biometric_data: Dict,
        stored_templates: Dict,
        biometric_type: str
    ) -> Dict[str, Any]:
        """Verify biometric data via ZKTeco ADMS.

        Real verification is performed through the ADMS cloud API.  When ADMS
        credentials are not configured the call is refused outright so that
        access is never granted based on a stub response.
        """
        company_id = settings.ZKTECO_COMPANY_ID
        adms_token = settings.ZKTECO_ADMS_TOKEN

        if not company_id or not adms_token:
            logger.warning(
                "Biometric verification requested but ZKTECO_COMPANY_ID / "
                "ZKTECO_ADMS_TOKEN are not configured — refusing verification"
            )
            return {"verified": False, "confidence": 0.0, "error": "ADMS credentials not configured"}

        base_url = f"{settings.ZKTECO_ADMS_SERVER}:{settings.ZKTECO_ADMS_PORT}/api/v1"
        try:
            async with aiohttp.ClientSession() as session:
                auth_resp = await session.post(
                    f"{base_url}/auth/login",
                    json={"company_id": company_id, "token": adms_token},
                    timeout=aiohttp.ClientTimeout(total=settings.ZKTECO_TIMEOUT),
                )
                if auth_resp.status != 200:
                    return {"verified": False, "confidence": 0.0, "error": "ADMS authentication failed"}

                auth_result = await auth_resp.json()
                session_token = auth_result.get("session_token")
                if not session_token:
                    return {"verified": False, "confidence": 0.0, "error": "No ADMS session token"}

                headers = {"Authorization": f"Bearer {session_token}"}
                verify_resp = await session.post(
                    f"{base_url}/biometric/verify",
                    headers=headers,
                    json={
                        "device_ip": device_ip,
                        "personnel_id": badge_id,
                        "biometric_type": biometric_type,
                        "biometric_data": biometric_data,
                        "stored_templates": stored_templates,
                    },
                    timeout=aiohttp.ClientTimeout(total=settings.ZKTECO_TIMEOUT),
                )

                if verify_resp.status != 200:
                    return {"verified": False, "confidence": 0.0, "error": f"ADMS verify returned {verify_resp.status}"}

                result = await verify_resp.json()
                return {
                    "verified": result.get("verified", False),
                    "confidence": result.get("confidence", 0.0),
                }
        except Exception as e:
            logger.error(f"ADMS biometric verification error: {e}")
            return {"verified": False, "confidence": 0.0, "error": str(e)}
    
    async def get_available_devices(self) -> List[Dict[str, Any]]:
        """Get list of available ZKTeco devices from ADMS, falling back to local iclock_terminal."""
        try:
            adms_server = settings.ZKTECO_ADMS_SERVER
            adms_port = settings.ZKTECO_ADMS_PORT
            company_id = settings.ZKTECO_COMPANY_ID
            access_token = settings.ZKTECO_ADMS_TOKEN

            if not company_id or not access_token:
                logger.info("ZKTECO_COMPANY_ID/ZKTECO_ADMS_TOKEN not configured — using local terminals")
                return self._get_local_devices()
            
            # ADMS API endpoints
            base_url = f"{adms_server}:{adms_port}/api/v1"
            
            async with aiohttp.ClientSession() as session:
                # Step 1: Authenticate with ADMS
                auth_url = f"{base_url}/auth/login"
                auth_data = {
                    "company_id": company_id,
                    "token": access_token
                }
                
                async with session.post(auth_url, json=auth_data) as auth_response:
                    if auth_response.status != 200:
                        logger.warning("ADMS authentication failed — using local terminals")
                        return self._get_local_devices()

                    auth_result = await auth_response.json()
                    session_token = auth_result.get("session_token")
                    if not session_token:
                        return self._get_local_devices()

                # Step 2: Get device list from ADMS
                devices_url = f"{base_url}/devices/list"
                headers = {"Authorization": f"Bearer {session_token}"}

                async with session.get(devices_url, headers=headers) as devices_response:
                    if devices_response.status != 200:
                        return self._get_local_devices()
                    
                    devices_data = await devices_response.json()
                    available_devices = devices_data.get("devices", [])
                    
                    # Transform ADMS device data to frontend format
                    transformed_devices = []
                    for device in available_devices:
                        if device.get("status") == "online" and device.get("biometric_enabled", False):
                            transformed_devices.append({
                                "id": device.get("id"),
                                "sn": device.get("sn"),
                                "name": device.get("name"),
                                "identifier": device.get("identifier", device.get("sn")),
                                "location": device.get("location", "Unknown Site"),
                                "site": device.get("site_name", "Main Site"),
                                "status": device.get("status", "offline"),
                                "biometric_enabled": device.get("biometric_enabled", False),
                                "device_type": device.get("device_type", "biometric_terminal"),
                                "last_seen": device.get("last_seen"),
                                "firmware_version": device.get("firmware_version")
                            })
                    
                    return transformed_devices if transformed_devices else self._get_local_devices()

        except Exception as e:
            logger.error(f"Error getting ZKTeco ADMS devices: {str(e)}")
            return self._get_local_devices()

    def _get_local_devices(self) -> List[Dict[str, Any]]:
        """Return devices registered in the local iclock_terminal table."""
        try:
            from ...models.biotime_models import IClockTerminal
            db = next(get_db())
            try:
                terminals = db.query(IClockTerminal).all()
                devices = []
                for t in terminals:
                    devices.append({
                        "id": t.id,
                        "sn": t.sn,
                        "name": t.alias or t.sn,
                        "identifier": t.sn,
                        "location": "",
                        "site": "",
                        "status": "online" if t.state == 1 else "offline",
                        "biometric_enabled": True,
                        "device_type": "terminal",
                        "last_seen": t.last_activity.isoformat() if t.last_activity else None,
                        "firmware_version": t.fw_ver or "",
                        "ip_address": t.ip_address or "",
                    })
                return devices
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error querying local terminals: {e}")
            return []

    def _get_default_devices(self) -> List[Dict[str, Any]]:
        """Deprecated — use _get_local_devices instead."""
        return self._get_local_devices()

    async def _get_device_status(self, device_ip: str) -> Dict[str, Any]:
        """Return status from the local iclock_terminal record for this IP."""
        try:
            from ...models.biotime_models import IClockTerminal
            db = next(get_db())
            try:
                terminal = db.query(IClockTerminal).filter(
                    IClockTerminal.ip_address == device_ip
                ).first()
                if terminal:
                    return {
                        "status": "online" if terminal.state == 1 else "offline",
                        "biometric_enabled": True,
                        "fingerprint_count": terminal.fp_count or 0,
                        "face_count": terminal.face_count or 0,
                    }
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Could not query terminal status for {device_ip}: {e}")

        return {
            "status": "unknown",
            "biometric_enabled": False,
            "fingerprint_count": 0,
            "face_count": 0,
        }


# Create singleton instance
biometric_service = ZKTecoBiometricService()
