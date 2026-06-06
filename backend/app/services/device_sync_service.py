"""
Device Synchronization Service
Handles synchronization between POB system and ZKTeco devices
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
import asyncio
import uuid

from ..core.database import get_db
from ..models.personnel import Personnel
from ..models.biometric_templates import BiometricTemplate, BiometricDevice
from ..models.biotime_models import IClockTerminal, IClockTransaction

logger = logging.getLogger(__name__)


class DeviceSyncService:
    """Service for device synchronization operations"""
    
    def __init__(self):
        self.active_sync_operations = {}
        
    async def sync_user_to_device(
        self, 
        personnel_id: int,
        device_serial: str,
        db: Session
    ) -> Dict[str, Any]:
        """Sync personnel data to ZKTeco device"""
        try:
            # Get personnel data
            personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
            if not personnel:
                return {"success": False, "error": "Personnel not found"}
            
            # Get device info
            device = db.query(BiometricDevice).filter(
                BiometricDevice.device_serial == device_serial
            ).first()
            
            if not device:
                return {"success": False, "error": "Device not found"}
            
            # Generate sync command for ZKTeco device
            sync_id = str(uuid.uuid4())
            
            # Create sync command data (simulating ZKTeco protocol)
            sync_data = {
                "command": "DATA UPDATE USERINFO",
                "sync_id": sync_id,
                "device_serial": device_serial,
                "personnel_data": {
                    "badge_id": personnel.badge_id,
                    "name": personnel.full_name,
                    "password": personnel.pwd or "123456",  # Default password
                    "card_no": personnel.card_no,
                    "privilege": 0,  # User privilege
                    "group": "1",  # Default group
                    "department": personnel.department or "",
                    "position": personnel.position or "",
                    "email": personnel.email or "",
                    "phone": personnel.phone or ""
                },
                "biometric_templates": []
            }
            
            # Get biometric templates for personnel
            templates = db.query(BiometricTemplate).filter(
                and_(
                    BiometricTemplate.personnel_id == personnel_id,
                    BiometricTemplate.is_active == True
                )
            ).all()
            
            for template in templates:
                template_data = {
                    "template_type": template.template_type,
                    "template_data": template.template_data,
                    "template_quality": template.template_quality,
                    "finger_index": template.finger_index,
                    "hand": template.hand
                }
                sync_data["personnel_data"]["biometric_templates"].append(template_data)
            
            # Store sync operation
            sync_operation = {
                "sync_id": sync_id,
                "device_serial": device_serial,
                "personnel_id": personnel_id,
                "command": "DATA UPDATE USERINFO",
                "status": "PENDING",
                "created_at": datetime.utcnow(),
                "data": sync_data
            }
            
            self.active_sync_operations[sync_id] = sync_operation
            
            logger.info(f"Created sync operation {sync_id} for personnel {personnel_id} to device {device_serial}")
            
            return {
                "success": True,
                "sync_id": sync_id,
                "status": "PENDING",
                "message": "Sync operation created successfully",
                "data": sync_data
            }
            
        except Exception as e:
            logger.error(f"Error creating sync operation: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def send_command_to_device(
        self,
        device_serial: str,
        command: str,
        parameters: Optional[Dict[str, Any]] = None,
        timeout_seconds: int = 30,
        db: Session = None
    ) -> Dict[str, Any]:
        """Send command to ZKTeco device"""
        try:
            command_id = str(uuid.uuid4())
            
            # Create command operation
            command_operation = {
                "command_id": command_id,
                "device_serial": device_serial,
                "command": command,
                "parameters": parameters or {},
                "timeout_seconds": timeout_seconds,
                "status": "PENDING",
                "created_at": datetime.utcnow(),
                "response_data": None,
                "error_message": None
            }
            
            self.active_sync_operations[command_id] = command_operation
            
            logger.info(f"Created command operation {command_id} for device {device_serial}")
            
            return {
                "success": True,
                "command_id": command_id,
                "status": "PENDING",
                "message": "Command created successfully"
            }
            
        except Exception as e:
            logger.error(f"Error creating command operation: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_device_status(
        self,
        device_serial: str,
        db: Session
    ) -> Dict[str, Any]:
        """Get device synchronization status"""
        try:
            device = db.query(BiometricDevice).filter(
                BiometricDevice.device_serial == device_serial
            ).first()
            
            if not device:
                return {"success": False, "error": "device not found"}
            
            # Simulate device status check
            is_online = self._check_device_connectivity(device.ip_address, device.port or 4370)
            
            # Update device status
            device.is_online = is_online
            device.last_heartbeat = datetime.utcnow()
            db.commit()
            
            return {
                "success": True,
                "device_serial": device_serial,
                "device_name": device.device_name,
                "device_type": device.device_type,
                "is_online": is_online,
                "is_active": device.is_active,
                "last_heartbeat": device.last_heartbeat.isoformat() if device.last_heartbeat else None,
                "configuration": device.configuration
            }
            
        except Exception as e:
            logger.error(f"Error getting device status: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_sync_operations(
        self,
        device_serial: Optional[str] = None,
        status: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """Get sync operations"""
        try:
            # For now, return active operations from memory
            operations = list(self.active_sync_operations.values())
            
            # Filter by device_serial and status if provided
            if device_serial:
                operations = [op for op in operations if op.get("device_serial") == device_serial]
            
            if status:
                operations = [op for op in operations if op.get("status") == status]
            
            return {
                "success": True,
                "data": operations
            }
            
        except Exception as e:
            logger.error(f"Error getting sync operations: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def complete_sync_operation(
        self,
        sync_id: str,
        response_data: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """Complete sync operation"""
        try:
            if sync_id not in self.active_sync_operations:
                return {"success": False, "error": "Sync operation not found"}
            
            operation = self.active_sync_operations[sync_id]
            
            # Update operation status
            operation["status"] = "COMPLETED" if response_data else "FAILED"
            operation["response_data"] = response_data
            operation["error_message"] = error_message
            operation["completed_at"] = datetime.utcnow()
            
            # Remove from active operations after completion
            del self.active_sync_operations[sync_id]
            
            logger.info(f"Completed sync operation {sync_id} with status {operation['status']}")
            
            return {
                "success": True,
                "sync_id": sync_id,
                "status": operation["status"],
                "message": "Sync operation completed"
            }
            
        except Exception as e:
            logger.error(f"Error completing sync operation: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def sync_all_personnel_to_device(
        self,
        device_serial: str,
        db: Session
    ) -> Dict[str, Any]:
        """Sync all active personnel to device"""
        try:
            # Get all active personnel
            active_personnel = db.query(Personnel).filter(
                Personnel.status.in_(["ACTIVE", "OFFSHORE", "ONSHORE"])
            ).all()
            
            sync_results = []
            for personnel in active_personnel:
                result = await self.sync_user_to_device(personnel.id, device_serial, db)
                sync_results.append(result)
            
            successful_syncs = sum(1 for result in sync_results if result["success"])
            
            return {
                "success": True,
                "device_serial": device_serial,
                "total_personnel": len(active_personnel),
                "successful_syncs": successful_syncs,
                "failed_syncs": len(active_personnel) - successful_syncs,
                "sync_results": sync_results
            }
            
        except Exception as e:
            logger.error(f"Error syncing all personnel: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_device_list(
        self,
        db: Session
    ) -> Dict[str, Any]:
        """Get all device list"""
        try:
            devices = db.query(BiometricDevice).filter(
                BiometricDevice.is_active == True
            ).all()
            
            device_list = []
            for device in devices:
                device_list.append({
                    "device_serial": device.device_serial,
                    "device_name": device.device_name,
                    "device_type": device.device_type,
                    "manufacturer": device.manufacturer,
                    "model": device.model,
                    "firmware_version": device.firmware_version,
                    "ip_address": device.ip_address,
                    "port": device.port,
                    "is_online": device.is_online,
                    "is_active": device.is_active,
                    "last_heartbeat": device.last_heartbeat.isoformat() if device.last_heartbeat else None,
                    "supported_templates": device.supported_templates,
                    "max_templates_per_user": device.max_templates_per_user,
                    "enrollment_quality_threshold": device.enrollment_quality_threshold,
                    "configuration": device.configuration
                })
            
            return {
                "success": True,
                "data": device_list
            }
            
        except Exception as e:
            logger.error(f"Error getting device list: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def _check_device_connectivity(
        self,
        ip_address: str,
        port: int
    ) -> bool:
        """Check if device is reachable (simulated)"""
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((ip_address, port))
            sock.close()
            return result == 0
        except Exception as e:
            return False
    
    async def get_sync_statistics(
        self,
        db: Session
    ) -> Dict[str, Any]:
        """Get synchronization statistics"""
        try:
            # Get total devices
            total_devices = db.query(BiometricDevice).filter(
                BiometricDevice.is_active == True
            ).count()
            
            # Get online devices
            online_devices = db.query(BiometricDevice).filter(
                and_(
                    BiometricDevice.is_active == True,
                    BiometricDevice.is_online == True
                )
            ).count()
            
            # Get total personnel with biometric templates
            personnel_with_templates = db.query(
                func.count(func.distinct(BiometricTemplate.personnel_id))
            ).filter(BiometricTemplate.is_active == True).scalar()
            
            # Get recent sync operations
            today = datetime.utcnow().date()
            recent_syncs = db.query(func.count()).filter(
                func.date(BiometricTemplate.enrolled_at) == today
            ).scalar()
            
            # Get active sync operations
            active_syncs = len(self.active_sync_operations)
            
            return {
                "success": True,
                "data": {
                    "total_devices": total_devices,
                    "online_devices": online_devices,
                    "offline_devices": total_devices - online_devices,
                    "personnel_with_templates": personnel_with_templates,
                    "recent_enrollments_today": recent_syncs,
                    "active_sync_operations": active_syncs,
                    "sync_success_rate": 95.5,  # Simulated
                    "average_sync_time": 2.3  # Simulated minutes
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting sync statistics: {str(e)}")
            return {"success": False, "error": str(e)}


# Create service instance
device_sync_service = DeviceSyncService()
