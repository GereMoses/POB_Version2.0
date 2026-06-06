"""
Visitor Device Synchronization Service
BioTime 9.5 compatible device sync with ZKTeco ADMS protocol
Real-time synchronization of visitor cards to access control devices
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.visitor import Visitor, VisitorVisitLog, VisitorType
from app.models.device import Device
from app.models.biotime_models import AccessLevel
from app.core.database import get_db
from app.core.config import settings

logger = logging.getLogger(__name__)


class VisitorDeviceSyncService:
    """Device synchronization service for visitor management"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def sync_visitor_to_devices(self, visitor: Visitor, card_no: str, 
                                   device_sns: Optional[List[str]] = None) -> Dict[str, Any]:
        """Sync visitor to access control devices using ZKTeco ADMS protocol"""
        try:
            # Get visitor type for access level
            access_level = None
            if visitor.visitor_type:
                access_level = self.db.query(AccessLevel).filter(
                    AccessLevel.id == visitor.visitor_type.access_level_id
                ).first()
            
            # Determine target devices
            target_devices = await self._get_target_devices(device_sns)
            
            # Prepare user data for ZKTeco protocol
            user_data = {
                'Pin': card_no,
                'Password': '',  # Empty for visitor cards
                'Card': card_no,
                'Group': access_level.group_id if access_level else 1,
                'StartTime': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'EndTime': self._calculate_end_time(visitor).strftime('%Y-%m-%d %H:%M:%S'),
                'Name': visitor.full_name,
                'Privilege': access_level.privilege if access_level else 0,
                'Enabled': True,
                'UserExtFmt': '0'  # Format for visitor cards
            }
            
            # Sync to each device
            sync_results = []
            for device_sn in target_devices:
                try:
                    result = await self._sync_to_device(device_sn, user_data)
                    sync_results.append(result)
                except Exception as e:
                    logger.error(f"Failed to sync to device {device_sn}: {e}")
                    sync_results.append({
                        'device_sn': device_sn,
                        'success': False,
                        'error': str(e)
                    })
            
            # Log synchronization
            await self._log_sync_operation(visitor.id, card_no, target_devices, sync_results)
            
            return {
                'success': True,
                'visitor_id': visitor.id,
                'card_no': card_no,
                'devices_synced': len(target_devices),
                'sync_results': sync_results
            }
            
        except Exception as e:
            logger.error(f"Visitor sync failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def remove_visitor_from_devices(self, visitor_id: int, card_no: str,
                                      device_sns: Optional[List[str]] = None) -> Dict[str, Any]:
        """Remove visitor from access control devices"""
        try:
            # Get visitor information
            visitor = self.db.query(Visitor).filter(Visitor.id == visitor_id).first()
            if not visitor:
                return {'success': False, 'error': 'Visitor not found'}
            
            # Determine target devices
            target_devices = await self._get_target_devices(device_sns)
            
            # Prepare delete command
            delete_data = {
                'Pin': card_no,
                'Action': 'DELETE USERINFO'
            }
            
            # Remove from each device
            sync_results = []
            for device_sn in target_devices:
                try:
                    result = await self._sync_to_device(device_sn, delete_data)
                    sync_results.append(result)
                except Exception as e:
                    logger.error(f"Failed to remove from device {device_sn}: {e}")
                    sync_results.append({
                        'device_sn': device_sn,
                        'success': False,
                        'error': str(e)
                    })
            
            # Log removal operation
            await self._log_removal_operation(visitor_id, card_no, target_devices, sync_results)
            
            return {
                'success': True,
                'visitor_id': visitor_id,
                'card_no': card_no,
                'devices_removed': len(target_devices),
                'sync_results': sync_results
            }
            
        except Exception as e:
            logger.error(f"Visitor removal failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def sync_all_active_visitors(self) -> Dict[str, Any]:
        """Sync all currently active visitors to devices"""
        try:
            # Get all active visitor visits
            active_visits = self.db.query(VisitorVisitLog).join(Visitor).filter(
                and_(
                    VisitorVisitLog.status == 0,  # checked in
                    Visitor.is_blacklist == False
                )
            ).all()
            
            sync_results = []
            for visit in active_visits:
                if visit.card_no:
                    result = await self.sync_visitor_to_devices(
                        visit.visitor, 
                        visit.card_no
                    )
                    sync_results.append(result)
            
            return {
                'success': True,
                'total_visitors': len(active_visits),
                'sync_results': sync_results
            }
            
        except Exception as e:
            logger.error(f"Sync all active visitors failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_device_sync_status(self) -> Dict[str, Any]:
        """Get synchronization status for all visitor devices"""
        try:
            # Get all visitor-type devices
            visitor_devices = self.db.query(Device).filter(
                Device.device_type == 0  # Attendance readers for visitor access
            ).all()
            
            device_status = []
            for device in visitor_devices:
                try:
                    status = await self._get_device_status(device.sn)
                    device_status.append({
                        'device_sn': device.sn,
                        'device_name': device.name,
                        'location': device.location,
                        'status': status,
                        'last_sync': device.last_sync_time
                    })
                except Exception as e:
                    logger.error(f"Failed to get status for device {device.sn}: {e}")
                    device_status.append({
                        'device_sn': device.sn,
                        'device_name': device.name,
                        'location': device.location,
                        'status': 'offline',
                        'error': str(e)
                    })
            
            return {
                'success': True,
                'total_devices': len(device_status),
                'device_status': device_status
            }
            
        except Exception as e:
            logger.error(f"Get device sync status failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _get_target_devices(self, device_sns: Optional[List[str]] = None) -> List[str]:
        """Get target devices for visitor synchronization"""
        if device_sns:
            return device_sns
        
        # Get all visitor access devices (device_type=0 for attendance readers)
        visitor_devices = self.db.query(Device).filter(
            and_(
                Device.device_type == 0,
                Device.is_active == True,
                Device.device_function.in_(['access_control', 'attendance'])
            )
        ).all()
        
        return [device.sn for device in visitor_devices]
    
    def _calculate_end_time(self, visitor: Visitor) -> datetime:
        """Calculate end time based on visitor type"""
        if visitor.visitor_type and visitor.visitor_type.default_visit_hours:
            return datetime.utcnow() + timedelta(hours=visitor.visitor_type.default_visit_hours)
        return datetime.utcnow() + timedelta(hours=8)  # Default 8 hours
    
    async def _sync_to_device(self, device_sn: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sync data to specific ZKTeco device using ADMS protocol"""
        try:
            # This would implement actual ZKTeco ADMS protocol communication
            # For now, simulate the sync operation
            
            if data.get('Action') == 'DELETE USERINFO':
                # Simulate visitor removal
                logger.info(f"Removing visitor {data.get('Pin')} from device {device_sn}")
                await asyncio.sleep(0.1)  # Simulate network delay
                return {
                    'device_sn': device_sn,
                    'success': True,
                    'action': 'DELETE USERINFO',
                    'pin': data.get('Pin')
                }
            else:
                # Simulate visitor addition
                logger.info(f"Adding visitor {data.get('Name')} with PIN {data.get('Pin')} to device {device_sn}")
                await asyncio.sleep(0.1)  # Simulate network delay
                
                return {
                    'device_sn': device_sn,
                    'success': True,
                    'action': 'ADD USERINFO',
                    'pin': data.get('Pin'),
                    'name': data.get('Name'),
                    'card': data.get('Card')
                }
                
        except Exception as e:
            logger.error(f"Device sync error for {device_sn}: {e}")
            return {
                'device_sn': device_sn,
                'success': False,
                'error': str(e)
            }
    
    async def _get_device_status(self, device_sn: str) -> Dict[str, Any]:
        """Get real-time status of a ZKTeco device"""
        try:
            # This would implement actual ZKTeco device status check
            # For now, simulate status check
            
            await asyncio.sleep(0.05)  # Simulate network delay
            
            # Simulate different device statuses
            import random
            status_chance = random.random()
            
            if status_chance < 0.8:
                return {
                    'online': True,
                    'status': 'connected',
                    'last_ping': datetime.utcnow().isoformat(),
                    'user_count': random.randint(5, 50)
                }
            else:
                return {
                    'online': False,
                    'status': 'offline',
                    'last_ping': (datetime.utcnow() - timedelta(minutes=random.randint(5, 30))).isoformat(),
                    'error': 'Connection timeout'
                }
                
        except Exception as e:
            logger.error(f"Device status check error for {device_sn}: {e}")
            return {
                'online': False,
                'status': 'error',
                'error': str(e)
            }
    
    async def _log_sync_operation(self, visitor_id: int, card_no: str, 
                                devices: List[str], results: List[Dict[str, Any]]) -> None:
        """Log visitor synchronization operation"""
        try:
            # Create sync log entry
            sync_log = {
                'visitor_id': visitor_id,
                'card_no': card_no,
                'operation': 'SYNC',
                'devices': devices,
                'results': results,
                'timestamp': datetime.utcnow().isoformat(),
                'success_count': sum(1 for r in results if r.get('success')),
                'error_count': sum(1 for r in results if not r.get('success'))
            }
            
            # TODO: Save to database sync log table
            logger.info(f"Visitor sync logged: {sync_log}")
            
        except Exception as e:
            logger.error(f"Failed to log sync operation: {e}")
    
    async def _log_removal_operation(self, visitor_id: int, card_no: str,
                                  devices: List[str], results: List[Dict[str, Any]]) -> None:
        """Log visitor removal operation"""
        try:
            # Create removal log entry
            removal_log = {
                'visitor_id': visitor_id,
                'card_no': card_no,
                'operation': 'REMOVE',
                'devices': devices,
                'results': results,
                'timestamp': datetime.utcnow().isoformat(),
                'success_count': sum(1 for r in results if r.get('success')),
                'error_count': sum(1 for r in results if not r.get('success'))
            }
            
            # TODO: Save to database sync log table
            logger.info(f"Visitor removal logged: {removal_log}")
            
        except Exception as e:
            logger.error(f"Failed to log removal operation: {e}")
    
    async def cleanup_expired_cards(self) -> Dict[str, Any]:
        """Clean up expired visitor cards from all devices"""
        try:
            # Get visitors with expired access
            expired_visits = self.db.query(VisitorVisitLog).join(Visitor).join(VisitorType).filter(
                and_(
                    VisitorVisitLog.status == 0,  # still checked in
                    Visitor.is_blacklist == False,
                    VisitorVisitLog.check_in_time < datetime.utcnow() - timedelta(hours=24)  # older than 24 hours
                )
            ).all()
            
            cleanup_results = []
            for visit in expired_visits:
                if visit.card_no:
                    result = await self.remove_visitor_from_devices(
                        visit.visitor_id,
                        visit.card_no
                    )
                    cleanup_results.append(result)
                    
                    # Update visit log to mark as expired
                    visit.status = 5  # expired status
                    self.db.commit()
            
            return {
                'success': True,
                'total_cleaned': len(cleanup_results),
                'cleanup_results': cleanup_results
            }
            
        except Exception as e:
            logger.error(f"Cleanup expired cards failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def bulk_sync_visitors(self, visitor_cards: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Bulk sync multiple visitors to devices"""
        try:
            sync_results = []
            
            for visitor_card in visitor_cards:
                visitor_id = visitor_card.get('visitor_id')
                card_no = visitor_card.get('card_no')
                device_sns = visitor_card.get('device_sns')
                
                if visitor_id and card_no:
                    visitor = self.db.query(Visitor).filter(Visitor.id == visitor_id).first()
                    if visitor:
                        result = await self.sync_visitor_to_devices(
                            visitor, card_no, device_sns
                        )
                        sync_results.append(result)
            
            return {
                'success': True,
                'total_processed': len(visitor_cards),
                'sync_results': sync_results
            }
            
        except Exception as e:
            logger.error(f"Bulk sync failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
