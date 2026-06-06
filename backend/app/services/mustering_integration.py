"""
Mustering External System Integration Service
Integrates mustering system with external emergency systems, SAP, HSE systems, etc.
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
import json
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.models.biotime_models import (
    MusteringEvent, MusteringLog, PersonnelEmployee
)
from app.models.zone import Zone

logger = logging.getLogger(__name__)

class MusteringIntegrationService:
    """External system integration service for mustering"""
    
    def __init__(self, db: Session):
        self.db = db
        self.config = {
            'sap_api_url': None,
            'sap_api_key': None,
            'hse_api_url': None,
            'hse_api_key': None,
            'fire_system_api_url': None,
            'fire_system_api_key': None,
            'medical_api_url': None,
            'medical_api_key': None,
            'timeout': 30,
            'retry_attempts': 3
        }
        
        # Load configuration from environment
        self._load_configuration()
    
    def _load_configuration(self):
        """Load integration configuration from environment variables"""
        import os
        
        self.config['sap_api_url'] = os.getenv('SAP_API_URL')
        self.config['sap_api_key'] = os.getenv('SAP_API_KEY')
        self.config['hse_api_url'] = os.getenv('HSE_API_URL')
        self.config['hse_api_key'] = os.getenv('HSE_API_KEY')
        self.config['fire_system_api_url'] = os.getenv('FIRE_SYSTEM_API_URL')
        self.config['fire_system_api_key'] = os.getenv('FIRE_SYSTEM_API_KEY')
        self.config['medical_api_url'] = os.getenv('MEDICAL_API_URL')
        self.config['medical_api_key'] = os.getenv('MEDICAL_API_KEY')
    
    def sync_to_sap(self, event_id: int) -> Dict[str, Any]:
        """
        Sync mustering event data to SAP system
        """
        try:
            if not self.config['sap_api_url'] or not self.config['sap_api_key']:
                logger.warning("SAP integration not configured")
                return {'success': False, 'message': 'SAP integration not configured'}
            
            # Get event data
            event = self.db.query(MusteringEvent).filter(MusteringEvent.id == event_id).first()
            if not event:
                return {'success': False, 'message': 'Event not found'}
            
            # Get event logs
            logs = self.db.query(MusteringLog).filter(MusteringLog.event_id == event_id).all()
            
            # Prepare SAP payload
            sap_payload = {
                'event_id': event.id,
                'event_type': event.event_type,
                'zone_id': event.zone_id,
                'start_time': event.start_time.isoformat(),
                'end_time': event.end_time.isoformat() if event.end_time else None,
                'total_expected': event.total_expected,
                'total_safe': event.total_safe,
                'total_missing': event.total_missing,
                'total_injured': event.total_injured,
                'initiated_by': event.initiated_by,
                'initiated_type': event.initiated_type,
                'status': event.status,
                'logs': []
            }
            
            # Add logs to payload
            for log in logs:
                sap_payload['logs'].append({
                    'emp_code': log.emp_code,
                    'emp_name': log.emp_name,
                    'check_time': log.check_time.isoformat(),
                    'device_sn': log.device_sn,
                    'status': log.status,
                    'gps': log.gps,
                    'notes': log.notes
                })
            
            # Send to SAP
            headers = {
                'Authorization': f"Bearer {self.config['sap_api_key']}",
                'Content-Type': 'application/json'
            }
            
            session = requests.Session()
            session.mount('https://', HTTPAdapter(max_retries=3))
            
            response = session.post(
                f"{self.config['sap_api_url']}/api/mustering/events",
                json=sap_payload,
                headers=headers,
                timeout=self.config['timeout']
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully synced event {event_id} to SAP")
                return {
                    'success': True,
                    'message': 'Event synced to SAP',
                    'sap_response': response.json() if response.content else None
                }
            else:
                logger.error(f"Failed to sync event {event_id} to SAP: {response.status_code}")
                return {
                    'success': False,
                    'message': f"SAP sync failed: HTTP {response.status_code}",
                    'sap_response': response.text if response.text else None
                }
                
        except Exception as e:
            logger.error(f"Error syncing to SAP: {e}")
            return {
                'success': False,
                'message': f"SAP sync error: {str(e)}"
            }
    
    def notify_hse_system(self, event_id: int, notification_type: str, message: str) -> Dict[str, Any]:
        """
        Send notification to HSE system
        """
        try:
            if not self.config['hse_api_url'] or not self.config['hse_api_key']:
                logger.warning("HSE integration not configured")
                return {'success': False, 'message': 'HSE integration not configured'}
            
            # Get event data
            event = self.db.query(MusteringEvent).filter(MusteringEvent.id == event_id).first()
            if not event:
                return {'success': False, 'message': 'Event not found'}
            
            # Prepare HSE notification payload
            hse_payload = {
                'event_id': event.id,
                'event_type': event.event_type,
                'zone_id': event.zone_id,
                'zone_name': event.zone.name if event.zone else None,
                'start_time': event.start_time.isoformat(),
                'notification_type': notification_type,
                'message': message,
                'severity': self._calculate_hse_severity(event),
                'requires_action': notification_type in ['emergency_alert', 'fire_alarm', 'medical_emergency'],
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Send to HSE
            headers = {
                'Authorization': f"Bearer {self.config['hse_api_key']}",
                'Content-Type': 'application/json'
            }
            
            response = requests.post(
                f"{self.config['hse_api_url']}/api/emergency-notifications",
                json=hse_payload,
                headers=headers,
                timeout=self.config['timeout']
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully sent HSE notification for event {event_id}")
                return {
                    'success': True,
                    'message': 'HSE notification sent',
                    'hse_response': response.json() if response.content else None
                }
            else:
                logger.error(f"Failed to send HSE notification: {response.status_code}")
                return {
                    'success': False,
                    'message': f"HSE notification failed: HTTP {response.status_code}",
                    'hse_response': response.text if response.text else None
                }
                
        except Exception as e:
            logger.error(f"Error sending HSE notification: {e}")
            return {
                'success': False,
                'message': f"HSE notification error: {str(e)}"
            }
    
    def trigger_fire_system(self, event_id: int, zone_id: int) -> Dict[str, Any]:
        """
        Trigger fire system integration
        """
        try:
            if not self.config['fire_system_api_url'] or not self.config['fire_system_api_key']:
                logger.warning("Fire system integration not configured")
                return {'success': False, 'message': 'Fire system integration not configured'}
            
            # Get zone information
            zone = self.db.query(Zone).filter(Zone.id == zone_id).first()
            if not zone:
                return {'success': False, 'message': 'Zone not found'}
            
            # Prepare fire system payload
            fire_payload = {
                'event_id': event_id,
                'zone_id': zone_id,
                'zone_name': zone.name,
                'alarm_type': 'mustering_fire',
                'activation_time': datetime.utcnow().isoformat(),
                'evacuation_points': zone.evac_point,
                'gps_coordinates': zone.evac_gps,
                'severity': 'high',
                'requires_evacuation': True
            }
            
            # Send to fire system
            headers = {
                'Authorization': f"Bearer {self.config['fire_system_api_key']}",
                'Content-Type': 'application/json'
            }
            
            response = requests.post(
                f"{self.config['fire_system_api_url']}/api/fire-alarms",
                json=fire_payload,
                headers=headers,
                timeout=self.config['timeout']
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully triggered fire system for event {event_id}")
                return {
                    'success': True,
                    'message': 'Fire system triggered',
                    'fire_response': response.json() if response.content else None
                }
            else:
                logger.error(f"Failed to trigger fire system: {response.status_code}")
                return {
                    'success': False,
                    'message': f"Fire system trigger failed: HTTP {response.status_code}",
                    'fire_response': response.text if response.text else None
                }
                
        except Exception as e:
            logger.error(f"Error triggering fire system: {e}")
            return {
                'success': False,
                'message': f"Fire system trigger error: {str(e)}"
            }
    
    def notify_medical_system(self, event_id: int, medical_alerts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Send medical emergency notifications to medical system
        """
        try:
            if not self.config['medical_api_url'] or not self.config['medical_api_key']:
                logger.warning("Medical system integration not configured")
                return {'success': False, 'message': 'Medical system integration not configured'}
            
            # Get event data
            event = self.db.query(MusteringEvent).filter(MusteringEvent.id == event_id).first()
            if not event:
                return {'success': False, 'message': 'Event not found'}
            
            # Prepare medical system payload
            medical_payload = {
                'event_id': event_id,
                'event_type': event.event_type,
                'zone_id': event.zone_id,
                'zone_name': event.zone.name if event.zone else None,
                'alert_time': datetime.utcnow().isoformat(),
                'emergency_type': 'mustering_medical',
                'medical_alerts': medical_alerts,
                'total_alerts': len(medical_alerts),
                'requires_immediate_response': True
            }
            
            # Send to medical system
            headers = {
                'Authorization': f"Bearer {self.config['medical_api_key']}",
                'Content-Type': 'application/json'
            }
            
            response = requests.post(
                f"{self.config['medical_api_url']}/api/emergency-alerts",
                json=medical_payload,
                headers=headers,
                timeout=self.config['timeout']
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully sent medical alerts for event {event_id}")
                return {
                    'success': True,
                    'message': 'Medical alerts sent',
                    'medical_response': response.json() if response.content else None
                }
            else:
                logger.error(f"Failed to send medical alerts: {response.status_code}")
                return {
                    'success': False,
                    'message': f"Medical alerts failed: HTTP {response.status_code}",
                    'medical_response': response.text if response.text else None
                }
                
        except Exception as e:
            logger.error(f"Error sending medical alerts: {e}")
            return {
                'success': False,
                'message': f"Medical alerts error: {str(e)}"
            }
    
    def get_integration_status(self) -> Dict[str, Any]:
        """
        Get status of all external integrations
        """
        try:
            integration_status = {
                'sap': {
                    'configured': bool(self.config['sap_api_url'] and self.config['sap_api_key']),
                    'last_sync': None,
                    'status': 'not_tested'
                },
                'hse': {
                    'configured': bool(self.config['hse_api_url'] and self.config['hse_api_key']),
                    'last_notification': None,
                    'status': 'not_tested'
                },
                'fire_system': {
                    'configured': bool(self.config['fire_system_api_url'] and self.config['fire_system_api_key']),
                    'last_trigger': None,
                    'status': 'not_tested'
                },
                'medical': {
                    'configured': bool(self.config['medical_api_url'] and self.config['medical_api_key']),
                    'last_alert': None,
                    'status': 'not_tested'
                }
            }
            
            # Test connections
            test_results = {}
            
            # Test SAP connection
            if integration_status['sap']['configured']:
                try:
                    test_response = requests.get(
                        f"{self.config['sap_api_url']}/api/health",
                        headers={'Authorization': f"Bearer {self.config['sap_api_key']}"},
                        timeout=10
                    )
                    integration_status['sap']['last_sync'] = datetime.utcnow().isoformat()
                    integration_status['sap']['status'] = 'available' if test_response.status_code == 200 else 'error'
                    test_results['sap'] = test_response.status_code
                except Exception as e:
                    integration_status['sap']['status'] = 'error'
                    test_results['sap'] = str(e)
            
            # Test HSE connection
            if integration_status['hse']['configured']:
                try:
                    test_response = requests.get(
                        f"{self.config['hse_api_url']}/api/health",
                        headers={'Authorization': f"Bearer {self.config['hse_api_key']}"},
                        timeout=10
                    )
                    integration_status['hse']['last_notification'] = datetime.utcnow().isoformat()
                    integration_status['hse']['status'] = 'available' if test_response.status_code == 200 else 'error'
                    test_results['hse'] = test_response.status_code
                except Exception as e:
                    integration_status['hse']['status'] = 'error'
                    test_results['hse'] = str(e)
            
            integration_status['test_results'] = test_results
            
            return {
                'success': True,
                'data': integration_status
            }
            
        except Exception as e:
            logger.error(f"Error getting integration status: {e}")
            return {
                'success': False,
                'message': f"Integration status error: {str(e)}"
            }
    
    def _calculate_hse_severity(self, event) -> str:
        """Calculate HSE notification severity based on event type"""
        severity_map = {
            0: 'low',      # Real
            1: 'info',     # Drill
            2: 'critical',  # Fire
            3: 'high',      # Gas
            4: 'critical'   # Man Down
        }
        
        return severity_map.get(event.event_type, 'medium')
    
    def log_integration_activity(self, integration_type: str, event_id: int, status: str, details: Dict[str, Any]):
        """
        Log integration activity for audit purposes
        """
        try:
            # In a real implementation, this would save to an integration_log table
            log_entry = {
                'integration_type': integration_type,
                'event_id': event_id,
                'status': status,
                'details': details,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info(f"Integration activity: {integration_type} - {status} - {json.dumps(log_entry)}")
            
            return {'success': True, 'log_entry': log_entry}
            
        except Exception as e:
            logger.error(f"Error logging integration activity: {e}")
            return {'success': False, 'message': f"Logging error: {str(e)}"}
