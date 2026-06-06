"""
Device Heartbeat Monitoring Service
Continuously monitors device heartbeat status and updates database
"""

import asyncio
import logging
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

from .zkteco_adms_protocol import ZKTecoADMSProtocolAsync
from ..core.database import get_db

logger = logging.getLogger(__name__)


class DeviceHeartbeatService:
    """
    Monitor device heartbeat status
    - Continuously check device connectivity
    - Update device status in database
    - Send alerts on device failures
    - Track device uptime and downtime
    """
    
    def __init__(self, check_interval: int = 60):
        """
        Initialize heartbeat service
        
        Args:
            check_interval: Check interval in seconds (default: 60)
        """
        self.check_interval = check_interval
        self.running = False
        self.device_status: Dict[str, Dict] = {}
        self.alert_threshold = 3  # Number of consecutive failures before alert
        
    async def start_monitoring(self):
        """Start continuous device monitoring"""
        self.running = True
        logger.info("Starting device heartbeat monitoring service")
        
        while self.running:
            try:
                await self.monitor_all_devices()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in heartbeat monitoring: {e}")
                await asyncio.sleep(self.check_interval)
    
    def stop_monitoring(self):
        """Stop device monitoring"""
        self.running = False
        logger.info("Stopping device heartbeat monitoring service")
    
    async def monitor_all_devices(self):
        """Monitor all registered devices"""
        try:
            db = next(get_db())
            
            # Get all devices from database
            devices = self.get_all_devices(db)
            
            for device in devices:
                await self.check_device_status(device, db)
            
            db.close()
            
        except Exception as e:
            logger.error(f"Error monitoring devices: {e}")
    
    def get_all_devices(self, db: Session) -> List[Dict]:
        """
        Get all devices from database
        
        Args:
            db: Database session
            
        Returns:
            List of device dictionaries
        """
        try:
            result = db.execute(text("""
                SELECT id, device_sn, ip_address, port, comm_key, 
                       status, last_heartbeat, sync_status
                FROM devicemap
                WHERE status != 2  -- Exclude permanently disabled devices
            """))
            
            devices = []
            for row in result:
                devices.append({
                    'id': row[0],
                    'device_sn': row[1],
                    'ip_address': row[2],
                    'port': row[3] if row[3] else 4370,
                    'comm_key': row[4] if row[4] else 0,
                    'status': row[5],
                    'last_heartbeat': row[6],
                    'sync_status': row[7]
                })
            
            return devices
            
        except Exception as e:
            logger.error(f"Error getting devices: {e}")
            return []
    
    async def check_device_status(self, device: Dict, db: Session):
        """
        Check status of a single device
        
        Args:
            device: Device dictionary
            db: Database session
        """
        device_sn = device['device_sn']
        ip_address = device['ip_address']
        port = device['port']
        comm_key = device['comm_key']
        
        try:
            # Initialize protocol client
            protocol = ZKTecoADMSProtocolAsync(ip_address, port, comm_key)
            
            # Try to connect
            connected = await protocol.connect()
            
            if connected:
                # Get device info
                device_info = await protocol.get_device_info()
                
                # Update device status to online
                await self.update_device_status(db, device_sn, 1, device_info)
                
                # Disconnect
                await protocol.disconnect()
                
                # Reset failure counter
                if device_sn in self.device_status:
                    self.device_status[device_sn]['failures'] = 0
                
                logger.debug(f"Device {device_sn} is online")
                
            else:
                # Device is offline
                await self.handle_device_offline(db, device_sn)
                
        except Exception as e:
            logger.error(f"Error checking device {device_sn}: {e}")
            await self.handle_device_offline(db, device_sn)
    
    async def update_device_status(self, db: Session, device_sn: str, status: int, device_info: Optional[Dict] = None):
        """
        Update device status in database
        
        Args:
            db: Database session
            device_sn: Device serial number
            status: Device status (0=offline, 1=online, 2=error)
            device_info: Device information dictionary
        """
        try:
            now = datetime.utcnow()
            
            # Update device status
            db.execute(text("""
                UPDATE devicemap
                SET status = :status,
                    last_heartbeat = :last_heartbeat,
                    updated_at = :updated_at
                WHERE device_sn = :device_sn
            """), {
                'status': status,
                'last_heartbeat': now,
                'updated_at': now,
                'device_sn': device_sn
            })
            
            # Update device info if provided
            if device_info:
                db.execute(text("""
                    UPDATE iclock_terminal
                    SET last_activity = :last_activity,
                        state = :state,
                        updated_at = :updated_at
                    WHERE sn = :device_sn
                """), {
                    'last_activity': now,
                    'state': 1 if status == 1 else 0,
                    'updated_at': now,
                    'device_sn': device_sn
                })
            
            db.commit()
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating device status: {e}")
    
    async def handle_device_offline(self, db: Session, device_sn: str):
        """
        Handle device offline status
        
        Args:
            db: Database session
            device_sn: Device serial number
        """
        try:
            # Initialize failure counter if not exists
            if device_sn not in self.device_status:
                self.device_status[device_sn] = {
                    'failures': 0,
                    'last_alert': None
                }
            
            # Increment failure counter
            self.device_status[device_sn]['failures'] += 1
            failures = self.device_status[device_sn]['failures']
            
            # Update device status to offline
            await self.update_device_status(db, device_sn, 0)
            
            # Check if alert threshold reached
            if failures >= self.alert_threshold:
                last_alert = self.device_status[device_sn]['last_alert']
                
                # Only send alert if not sent recently (within 1 hour)
                if not last_alert or (datetime.utcnow() - last_alert) > timedelta(hours=1):
                    await self.send_device_alert(device_sn, failures)
                    self.device_status[device_sn]['last_alert'] = datetime.utcnow()
            
            logger.warning(f"Device {device_sn} is offline (failures: {failures})")
            
        except Exception as e:
            logger.error(f"Error handling device offline: {e}")
    
    async def send_device_alert(self, device_sn: str, failures: int):
        """
        Send alert for device failure
        
        Args:
            device_sn: Device serial number
            failures: Number of consecutive failures
        """
        try:
            # Log alert
            logger.error(f"ALERT: Device {device_sn} has been offline for {failures} consecutive checks")
            
            # TODO: Implement notification service
            # - Send email to administrators
            # - Send SMS to on-call staff
            # - Create alert record in database
            # - Trigger webhook if configured
            
            # Create alert record in database
            db = next(get_db())
            try:
                db.execute(text("""
                    INSERT INTO base_operationlog (user_id, action, table_name, record_id, new_values, created_at)
                    VALUES (NULL, :action, :table_name, :record_id, :new_values, :created_at)
                """), {
                    'action': 'DEVICE_OFFLINE_ALERT',
                    'table_name': 'devicemap',
                    'record_id': None,
                    'new_values': f'Device {device_sn} offline for {failures} checks',
                    'created_at': datetime.utcnow()
                })
                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"Error creating alert record: {e}")
            finally:
                db.close()
            
        except Exception as e:
            logger.error(f"Error sending device alert: {e}")
    
    def get_device_health_summary(self) -> Dict[str, any]:
        """
        Get summary of device health
        
        Returns:
            Dictionary with device health statistics
        """
        try:
            db = next(get_db())
            
            # Get device statistics
            result = db.execute(text("""
                SELECT 
                    COUNT(*) as total_devices,
                    SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as online_devices,
                    SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as offline_devices,
                    SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as error_devices,
                    MAX(last_heartbeat) as last_heartbeat
                FROM devicemap
            """))
            
            row = result.fetchone()
            
            summary = {
                'total_devices': row[0] if row[0] else 0,
                'online_devices': row[1] if row[1] else 0,
                'offline_devices': row[2] if row[2] else 0,
                'error_devices': row[3] if row[3] else 0,
                'last_heartbeat': row[4],
                'health_percentage': 0
            }
            
            if summary['total_devices'] > 0:
                summary['health_percentage'] = round(
                    (summary['online_devices'] / summary['total_devices']) * 100, 2
                )
            
            db.close()
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting device health summary: {e}")
            return {
                'total_devices': 0,
                'online_devices': 0,
                'offline_devices': 0,
                'error_devices': 0,
                'health_percentage': 0
            }
    
    async def sync_device_time(self, device_sn: str) -> bool:
        """
        Sync device time with server time
        
        Args:
            device_sn: Device serial number
            
        Returns:
            True if successful
        """
        try:
            db = next(get_db())
            
            # Get device info
            result = db.execute(text("""
                SELECT ip_address, port, comm_key
                FROM devicemap
                WHERE device_sn = :device_sn
            """), {'device_sn': device_sn})
            
            row = result.fetchone()
            if not row:
                db.close()
                return False
            
            ip_address = row[0]
            port = row[1] if row[1] else 4370
            comm_key = row[2] if row[2] else 0
            
            db.close()
            
            # Connect to device
            protocol = ZKTecoADMSProtocolAsync(ip_address, port, comm_key)
            connected = await protocol.connect()
            
            if connected:
                # Set device time to server time
                server_time = datetime.utcnow()
                success = await protocol.set_device_time(server_time)
                
                await protocol.disconnect()
                
                if success:
                    logger.info(f"Synced time for device {device_sn}")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error syncing device time: {e}")
            return False


# Global heartbeat service instance
heartbeat_service = DeviceHeartbeatService()


async def start_heartbeat_monitoring():
    """Start the global heartbeat monitoring service"""
    await heartbeat_service.start_monitoring()


def stop_heartbeat_monitoring():
    """Stop the global heartbeat monitoring service"""
    heartbeat_service.stop_monitoring()
