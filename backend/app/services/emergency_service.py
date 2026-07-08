"""
Emergency Management Service - POB v2.0
Comprehensive emergency system with lockdown, fire mode, notifications, and audit trails
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from sqlalchemy.exc import SQLAlchemyError
import json
import logging
import asyncio
from enum import Enum

from ..models.emergency import (
    EmergencyEvent, EmergencyTemplate, EmergencyNotification,
    EmergencyPlan, EmergencyPanicLog, Transport, TransportMaintenance,
    FlightLog, TransportCrew, TransportSchedule, TransportInventory,
    EmergencyEventType, EmergencyStatus, EmergencyScope, EmergencyInitiatedType,
    NotificationChannel, NotificationStatus, RecipientType, PanicType
)
from ..models.biotime_models import EmergencyDevice
from ..models.biotime_models import (
    IClockTerminal, AccDoor, MusteringEvent,
    AuthUser, PersonnelEmployee, BaseOperationLog
)
from ..models.zone import Zone
from ..core.database import get_db
from ..services.zkteco.biometric_service import ZKTecoBiometricService
from ..services.emergency_websocket import emergency_websocket_manager
from ..services.zkteco_adms_service import zkteco_adms_service
from ..services.mustering_service import MusteringService

# Configure logging
logger = logging.getLogger(__name__)

class EmergencyService:
    """Comprehensive emergency management service"""
    
    def __init__(self):
        self.zkteco_service = ZKTecoBiometricService()
        
        # Emergency type mappings
        self.emergency_type_names = {
            0: "LOCKDOWN",
            1: "FIRE", 
            2: "GAS",
            3: "INTRUDER",
            4: "MEDICAL",
            5: "ALL_CLEAR"
        }
        
        self.emergency_status_names = {
            0: "ACTIVE",
            1: "RESOLVED", 
            2: "CANCELLED"
        }
        
        self.notification_channel_names = {
            0: "SMS",
            1: "EMAIL",
            2: "WHATSAPP", 
            3: "PUSH",
            4: "PA",
            5: "SIREN"
        }

    async def get_emergency_dashboard(self, db: Session) -> Dict[str, Any]:
        """Get comprehensive emergency dashboard data"""
        try:
            # Get active emergencies
            active_emergencies = db.query(EmergencyEvent).filter(
                EmergencyEvent.status == EmergencyStatus.ACTIVE.value
            ).all()
            
            # Count doors by emergency action
            locked_doors = db.query(AccDoor).filter(
                AccDoor.emergency_action == 1  # LOCK
            ).count()
            
            unlocked_doors = db.query(AccDoor).filter(
                AccDoor.emergency_action == 2  # UNLOCK
            ).count()
            
            # Count active emergency devices
            sirens_on = db.query(EmergencyDevice).filter(
                EmergencyDevice.device_type.in_([1, 2]),  # Siren, Strobe
                EmergencyDevice.status == 1  # ON
            ).count()
            
            # Get recent emergency events
            recent_events = db.query(EmergencyEvent).order_by(
                EmergencyEvent.start_time.desc()
            ).limit(10).all()
            
            # Get zone status
            zones = db.query(Zone).all()
            zone_status = []
            for zone in zones:
                active_count = len([e for e in active_emergencies if zone.id in (e.zone_ids or [])])
                zone_status.append({
                    "id": zone.id,
                    "name": zone.name,
                    "status": "ACTIVE" if active_count > 0 else "SAFE",
                    "active_emergencies": active_count,
                    "capacity": zone.max_capacity,
                    "evac_point": zone.evac_point
                })
            
            return {
                "total_emergencies": len(active_emergencies),
                "active_emergencies": [
                    {
                        "id": e.id,
                        "event_type": e.event_type,
                        "event_type_name": self.emergency_type_names.get(e.event_type, "UNKNOWN"),
                        "status": e.status,
                        "status_name": self.emergency_status_names.get(e.status, "UNKNOWN"),
                        "start_time": e.start_time.isoformat(),
                        "trigger_source": e.trigger_source,
                        "reason": e.reason,
                        "scope": e.scope,
                        "zone_ids": e.zone_ids or [],
                        "door_ids": e.door_ids or []
                    }
                    for e in active_emergencies
                ],
                "doors_locked": locked_doors,
                "doors_unlocked": unlocked_doors,
                "sirens_on": sirens_on,
                "recent_events": [
                    {
                        "id": e.id,
                        "event_type": e.event_type,
                        "event_type_name": self.emergency_type_names.get(e.event_type, "UNKNOWN"),
                        "start_time": e.start_time.isoformat(),
                        "end_time": e.end_time.isoformat() if e.end_time else None,
                        "status": e.status,
                        "trigger_source": e.trigger_source
                    }
                    for e in recent_events
                ],
                "zone_status": zone_status,
                "last_trigger": active_emergencies[0].start_time.isoformat() if active_emergencies else None,
                "system_status": "EMERGENCY" if active_emergencies else "NORMAL"
            }
            
        except Exception as e:
            logger.error(f"Error getting emergency dashboard: {str(e)}")
            raise

    async def execute_lockdown(
        self, 
        scope: str,
        zone_ids: Optional[List[int]] = None,
        location_ids: Optional[List[int]] = None,
        door_ids: Optional[List[int]] = None,
        action: str = "lock",
        reason: Optional[str] = None,
        initiated_by: Optional[int] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """Execute emergency lockdown with full audit trail"""
        
        if db is None:
            db = next(get_db())
        
        try:
            # Validate action
            if action not in ["lock", "unlock"]:
                raise ValueError("Action must be 'lock' or 'unlock'")
            
            # Determine scope and target doors
            if scope == "global":
                target_doors = db.query(AccDoor).all()
                scope_enum = EmergencyScope.GLOBAL.value
            elif scope == "zone" and zone_ids:
                target_doors = db.query(AccDoor).join(IClockTerminal).filter(
                    IClockTerminal.zone_id.in_(zone_ids)
                ).all()
                scope_enum = EmergencyScope.ZONE.value
            elif scope == "location" and location_ids:
                # Location = personnel_area: lock every door on terminals in those areas.
                target_doors = db.query(AccDoor).join(IClockTerminal).filter(
                    IClockTerminal.area_id.in_(location_ids)
                ).all()
                scope_enum = EmergencyScope.LOCATION.value
            elif scope == "door" and door_ids:
                target_doors = db.query(AccDoor).filter(
                    AccDoor.id.in_(door_ids)
                ).all()
                scope_enum = EmergencyScope.DOOR.value
            else:
                raise ValueError("Invalid scope or missing target identifiers")
            
            # No doors is not a hard failure — the emergency event is still recorded
            # for audit trail purposes and any door-command loop simply no-ops.
            
            # Create emergency event
            emergency_event = EmergencyEvent(
                event_type=EmergencyEventType.LOCKDOWN.value,
                status=EmergencyStatus.ACTIVE.value,
                scope=scope_enum,
                zone_ids=zone_ids,
                door_ids=[d.id for d in target_doors],
                initiated_by=initiated_by,
                initiated_type=EmergencyInitiatedType.MANUAL_UI.value,
                trigger_source="Web UI",
                reason=reason or f"Emergency {action} from Access Control panel",
                actions=[{
                    "type": "lockdown",
                    "action": action,
                    "doors": [d.id for d in target_doors],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }]
            )
            
            db.add(emergency_event)
            db.flush()  # Get the ID
            
            # Process each door
            processed_doors = []
            failed_doors = []
            
            for door in target_doors:
                try:
                    # Queue command to ZKTeco device
                    terminal = door.terminal
                    if not terminal:
                        failed_doors.append({
                            "door_id": door.id,
                            "door_name": door.door_name,
                            "error": "No terminal associated"
                        })
                        continue
                    
                    # Determine command based on action and door emergency_action
                    if action == "lock":
                        # Lock doors with emergency_action=1 (LOCK)
                        if door.emergency_action == 1:
                            cmd_result = await self.zkteco_queue_command(
                                terminal.sn, "RELAY_OFF"
                            )
                            if cmd_result.get("success"):
                                processed_doors.append(door.id)
                            else:
                                failed_doors.append({
                                    "door_id": door.id,
                                    "door_name": door.door_name,
                                    "error": cmd_result.get("error", "Command failed")
                                })
                    elif action == "unlock":
                        # Unlock doors with emergency_action=2 (UNLOCK)
                        if door.emergency_action == 2:
                            cmd_result = await self.zkteco_queue_command(
                                terminal.sn, "RELAY_ON"
                            )
                            if cmd_result.get("success"):
                                processed_doors.append(door.id)
                            else:
                                failed_doors.append({
                                    "door_id": door.id,
                                    "door_name": door.door_name,
                                    "error": cmd_result.get("error", "Command failed")
                                })
                    
                except Exception as e:
                    failed_doors.append({
                        "door_id": door.id,
                        "door_name": door.door_name,
                        "error": str(e)
                    })
                    logger.error(f"Error processing door {door.id}: {str(e)}")
            
            # Update emergency event with results
            emergency_event.actions[0]["processed_doors"] = processed_doors
            emergency_event.actions[0]["failed_doors"] = failed_doors
            
            # Log operation
            await self.log_emergency_operation(
                db=db,
                user_id=initiated_by,
                action=f"EMERGENCY_{action.upper()}",
                target_type="door",
                target_ids=[d.id for d in target_doors],
                emergency_event_id=emergency_event.id,
                details={
                    "scope": scope,
                    "action": action,
                    "processed_count": len(processed_doors),
                    "failed_count": len(failed_doors),
                    "reason": reason
                }
            )
            
            db.commit()
            
            # Broadcast WebSocket update
            await self.broadcast_emergency_update({
                "type": "emergency_lockdown",
                "data": {
                    "emergency_event_id": emergency_event.id,
                    "action": action,
                    "scope": scope,
                    "processed_doors": len(processed_doors),
                    "failed_doors": len(failed_doors),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            })
            
            return {
                "success": True,
                "emergency_event_id": emergency_event.id,
                "action": action,
                "scope": scope,
                "total_doors": len(target_doors),
                "processed_doors": len(processed_doors),
                "failed_doors": len(failed_doors),
                "failed_details": failed_doors,
                "message": f"Emergency {action} completed. {len(processed_doors)} doors processed."
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error executing lockdown: {str(e)}")
            raise

    async def activate_fire_mode(
        self,
        zone_id: Optional[int] = None,
        location_id: Optional[int] = None,
        action: str = "activate",
        reason: Optional[str] = None,
        initiated_by: Optional[int] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """Activate fire mode with comprehensive response"""
        
        if db is None:
            db = next(get_db())
        
        try:
            if action not in ["activate", "clear"]:
                raise ValueError("Action must be 'activate' or 'clear'")
            
            # Get target zone
            if zone_id:
                zone = db.query(Zone).filter(Zone.id == zone_id).first()
                if not zone:
                    raise ValueError(f"Zone {zone_id} not found")
            else:
                zone = None

            # Scope: location (personnel_area) > zone > global
            if location_id:
                fire_scope = EmergencyScope.LOCATION.value
            elif zone_id:
                fire_scope = EmergencyScope.ZONE.value
            else:
                fire_scope = EmergencyScope.GLOBAL.value

            # Create emergency event
            emergency_event = EmergencyEvent(
                event_type=EmergencyEventType.FIRE.value,
                status=EmergencyStatus.ACTIVE.value if action == "activate" else EmergencyStatus.RESOLVED.value,
                scope=fire_scope,
                zone_ids=[zone_id] if zone_id else [],
                initiated_by=initiated_by,
                initiated_type=EmergencyInitiatedType.MANUAL_UI.value,
                trigger_source="Web UI - Fire Mode",
                reason=reason or f"Fire mode {action}",
                actions=[]
            )
            
            db.add(emergency_event)
            db.flush()
            # Commit immediately so the emergency event row is durable before any
            # child operation (mustering, ZKTeco commands) that shares this session
            # and may call db.rollback() on its own failure path.
            db.commit()

            results = {
                "unlocked_doors": 0,
                "locked_doors": 0,
                "sirens_activated": 0,
                "mustering_started": False,
                "notifications_sent": 0
            }

            if action == "activate":
                # 1. Unlock fire exits (emergency_action=2) — scoped to the location's readers when given
                _fe_q = db.query(AccDoor).filter(AccDoor.emergency_action == 2)
                if location_id:
                    _fe_q = _fe_q.join(IClockTerminal).filter(IClockTerminal.area_id == location_id)
                fire_exit_doors = _fe_q.all()

                for door in fire_exit_doors:
                    sp = db.begin_nested()
                    try:
                        if door.terminal:
                            await self.zkteco_queue_command(door.terminal.sn, "RELAY_ON")
                            results["unlocked_doors"] += 1
                        sp.commit()
                    except Exception as e:
                        logger.error(f"Error unlocking fire exit {door.id}: {str(e)}")
                        sp.rollback()  # roll back only this door; prior commands are preserved

                emergency_event.actions.append({
                    "type": "unlock_fire_exits",
                    "doors": [d.id for d in fire_exit_doors],
                    "count": results["unlocked_doors"],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

                # 2. Lock danger zones (emergency_action=1) — scoped to the location's readers when given
                _dz_q = db.query(AccDoor).filter(AccDoor.emergency_action == 1)
                if location_id:
                    _dz_q = _dz_q.join(IClockTerminal).filter(IClockTerminal.area_id == location_id)
                danger_zone_doors = _dz_q.all()

                for door in danger_zone_doors:
                    sp = db.begin_nested()
                    try:
                        if door.terminal:
                            await self.zkteco_queue_command(door.terminal.sn, "RELAY_OFF")
                            results["locked_doors"] += 1
                        sp.commit()
                    except Exception as e:
                        logger.error(f"Error locking danger zone {door.id}: {str(e)}")
                        sp.rollback()

                emergency_event.actions.append({
                    "type": "lock_danger_zones",
                    "doors": [d.id for d in danger_zone_doors],
                    "count": results["locked_doors"],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

                # 3. Turn ON sirens/strobes
                emergency_devices = db.query(EmergencyDevice).filter(
                    EmergencyDevice.device_type.in_([1, 2]),  # Siren, Strobe
                    EmergencyDevice.status != 2  # Not fault
                ).all()

                for device in emergency_devices:
                    sp = db.begin_nested()
                    try:
                        if device.terminal:
                            await self.zkteco_queue_command(device.terminal.sn, "EMERGENCY_ON")
                            device.status = 1  # ON
                            results["sirens_activated"] += 1
                        sp.commit()
                    except Exception as e:
                        logger.error(f"Error activating siren {device.id}: {str(e)}")
                        sp.rollback()

                emergency_event.actions.append({
                    "type": "siren_activation",
                    "devices": [d.id for d in emergency_devices],
                    "count": results["sirens_activated"],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

                # 4. Start mustering event — use MusteringService so that expected
                # personnel are calculated from Personnel.current_zone_id and
                # MusteringExpected rows are created. Without this the headcount
                # shows 0 expected during an actual fire evacuation.
                # MusteringService.start_mustering_event has its own db.commit() on
                # success and db.rollback() on failure. Because the emergency event
                # was committed above, its own rollback cannot affect it.
                mustering_zone_ids = [zone_id] if zone_id else [
                    z.id for z in db.query(Zone).filter(Zone.is_active == True).limit(10).all()
                ]
                try:
                    muster_result = MusteringService(db).start_mustering_event(
                        zone_ids=mustering_zone_ids,
                        event_type=2,  # Fire
                        initiated_by=initiated_by or 0,
                        notes="Fire evacuation — auto-started by fire mode activation",
                    )
                    mustering_event_id = muster_result["event_id"]
                    # Update the already-committed emergency event with the muster link
                    db.query(EmergencyEvent).filter(EmergencyEvent.id == emergency_event.id).update(
                        {"mustering_event_id": mustering_event_id}
                    )
                    emergency_event.mustering_event_id = mustering_event_id
                    results["mustering_started"] = True

                    emergency_event.actions.append({
                        "type": "start_mustering",
                        "mustering_event_id": mustering_event_id,
                        "zone_ids": mustering_zone_ids,
                        "total_expected": muster_result.get("total_expected", 0),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception as muster_err:
                    logger.error(f"Fire-mode mustering start failed: {muster_err}")
                    results["mustering_started"] = False
                    # Ensure the session is clean after mustering's rollback
                    try:
                        db.rollback()
                    except Exception:
                        pass

                # 5. Send notifications
                notification_count = await self.send_emergency_notifications(
                    emergency_event.id,
                    [NotificationChannel.SMS.value, NotificationChannel.EMAIL.value, NotificationChannel.PA.value],
                    db
                )
                results["notifications_sent"] = notification_count
                
            else:  # clear action
                # Turn OFF sirens/strobes
                emergency_devices = db.query(EmergencyDevice).filter(
                    EmergencyDevice.device_type.in_([1, 2]),  # Siren, Strobe
                    EmergencyDevice.status == 1  # Currently ON
                ).all()
                
                for device in emergency_devices:
                    try:
                        if device.terminal:
                            await self.zkteco_queue_command(device.terminal.sn, "EMERGENCY_OFF")
                            device.status = 0  # OFF
                            results["sirens_activated"] = len(emergency_devices)
                    except Exception as e:
                        logger.error(f"Error deactivating siren {device.id}: {str(e)}")
                
                emergency_event.actions.append({
                    "type": "siren_deactivation",
                    "devices": [d.id for d in emergency_devices],
                    "count": len(emergency_devices),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
                # End active mustering events. Update status directly so we stay
                # in the same transaction as the siren deactivation above, then call
                # _set_mustering_readers() per zone to clear device commands. The
                # original code only set status — readers were never deactivated.
                active_mustering = db.query(MusteringEvent).filter(
                    MusteringEvent.status == 0
                ).all()

                muster_svc = MusteringService(db)
                for muster in active_mustering:
                    muster.status = 1  # Completed
                    muster.end_time = datetime.now(timezone.utc)
                    for zid in (muster.zone_ids or ([muster.zone_id] if muster.zone_id else [])):
                        try:
                            muster_svc._set_mustering_readers(zid, False)
                        except Exception as _re:
                            logger.error(f"Error deactivating readers for zone {zid}: {_re}")

                emergency_event.actions.append({
                    "type": "end_mustering",
                    "events_ended": len(active_mustering),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            
            # Log operation
            await self.log_emergency_operation(
                db=db,
                user_id=initiated_by,
                action=f"FIRE_MODE_{action.upper()}",
                target_type="system",
                emergency_event_id=emergency_event.id,
                details=results
            )
            
            db.commit()
            
            # Broadcast WebSocket update
            await self.broadcast_emergency_update({
                "type": "fire_mode",
                "data": {
                    "emergency_event_id": emergency_event.id,
                    "action": action,
                    "zone_id": zone_id,
                    "results": results,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            })
            
            return {
                "success": True,
                "emergency_event_id": emergency_event.id,
                "action": action,
                "zone_id": zone_id,
                "results": results,
                "message": f"Fire mode {action} completed successfully"
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error activating fire mode: {str(e)}")
            raise

    async def send_emergency_notifications(
        self,
        emergency_event_id: int,
        channels: List[int],
        db: Session
    ) -> int:
        """Send emergency notifications through multiple channels"""
        
        try:
            emergency_event = db.query(EmergencyEvent).filter(
                EmergencyEvent.id == emergency_event_id
            ).first()
            
            if not emergency_event:
                raise ValueError(f"Emergency event {emergency_event_id} not found")
            
            # Get notification template
            template = db.query(EmergencyTemplate).filter(
                EmergencyTemplate.event_type == emergency_event.event_type,
                EmergencyTemplate.is_active == True
            ).first()
            
            if not template:
                template = db.query(EmergencyTemplate).filter(
                    EmergencyTemplate.event_type == EmergencyEventType.LOCKDOWN.value,
                    EmergencyTemplate.is_default == True
                ).first()
            
            # Prepare message
            event_type_name = self.emergency_type_names.get(emergency_event.event_type, "EMERGENCY")
            message = f"EMERGENCY ALERT: {event_type_name} activated"
            if emergency_event.reason:
                message += f". Reason: {emergency_event.reason}"
            
            sent_count = 0
            
            for channel in channels:
                try:
                    # Get recipients based on channel and scope
                    recipients = await self.get_notification_recipients(
                        channel, emergency_event.scope, emergency_event.zone_ids, db
                    )
                    
                    for recipient in recipients:
                        notification = EmergencyNotification(
                            emergency_event_id=emergency_event_id,
                            channel=channel,
                            recipient_type=recipient["type"],
                            recipient_id=recipient.get("id"),
                            recipient_addr=recipient["address"],
                            message=message,
                            template_vars={
                                "event_type": event_type_name,
                                "reason": emergency_event.reason or "",
                                "timestamp": emergency_event.start_time.isoformat()
                            }
                        )
                        
                        db.add(notification)
                        db.flush()
                        
                        # Send notification (implement actual sending logic)
                        send_result = await self.send_notification(
                            channel, recipient["address"], message
                        )
                        
                        if send_result.get("success"):
                            notification.status = NotificationStatus.SENT.value
                            notification.sent_time = datetime.now(timezone.utc)
                            sent_count += 1
                        else:
                            notification.status = NotificationStatus.FAILED.value
                            notification.error_msg = send_result.get("error", "Send failed")
                
                except Exception as e:
                    logger.error(f"Error sending notifications on channel {channel}: {str(e)}")
            
            return sent_count
            
        except Exception as e:
            logger.error(f"Error sending emergency notifications: {str(e)}")
            raise

    async def get_notification_recipients(
        self,
        channel: int,
        scope: int,
        zone_ids: Optional[List[int]],
        db: Session
    ) -> List[Dict[str, Any]]:
        """Get notification recipients based on channel and scope"""
        
        recipients = []
        
        try:
            if scope == EmergencyScope.GLOBAL.value:
                # All active personnel
                personnel = db.query(PersonnelEmployee).filter(
                    PersonnelEmployee.status == 0  # Active
                ).all()
                
                for person in personnel:
                    recipient = {"type": RecipientType.USER.value, "id": person.id}
                    
                    if channel == NotificationChannel.SMS.value:
                        # Get phone number from emergency contacts
                        emergency_info = person.emergency_contact or {}
                        contacts = emergency_info.get("contacts", [])
                        primary_contact = next((c for c in contacts if c.get("is_primary")), contacts[0] if contacts else None)
                        
                        if primary_contact and primary_contact.get("phone"):
                            recipient["address"] = primary_contact["phone"]
                            recipients.append(recipient)
                    
                    elif channel == NotificationChannel.EMAIL.value:
                        # Would need email field in personnel
                        pass
                    
            elif scope == EmergencyScope.ZONE.value and zone_ids:
                # Personnel in specific zones
                for zone_id in zone_ids:
                    personnel_in_zone = db.query(PersonnelEmployee).join(IClockTerminal).filter(
                        IClockTerminal.area_id == zone_id,
                        PersonnelEmployee.status == 0
                    ).all()
                    
                    for person in personnel_in_zone:
                        recipient = {"type": RecipientType.USER.value, "id": person.id}
                        
                        # Add contact info similar to global scope
                        emergency_info = person.emergency_contact or {}
                        contacts = emergency_info.get("contacts", [])
                        primary_contact = next((c for c in contacts if c.get("is_primary")), contacts[0] if contacts else None)
                        
                        if primary_contact and primary_contact.get("phone"):
                            recipient["address"] = primary_contact["phone"]
                            recipients.append(recipient)
        
        except Exception as e:
            logger.error(f"Error getting notification recipients: {str(e)}")
        
        return recipients

    async def send_notification(
        self,
        channel: int,
        address: str,
        message: str,
        subject: str = "Emergency Alert",
    ) -> Dict[str, Any]:
        """Send notification through a specific channel.

        All blocking I/O (SMTP, HTTP) is offloaded to a thread via asyncio.to_thread()
        so the event loop is never blocked during an emergency with many recipients.
        """
        import os
        try:
            if channel == NotificationChannel.SMS.value:
                sms_key = os.getenv('SMS_API_KEY')
                sms_url = os.getenv('SMS_API_URL')
                if not sms_key or not sms_url:
                    logger.warning(f"SMS not configured — would send to {address}: {message}")
                    return {"success": False, "error": "SMS_API_KEY / SMS_API_URL not set"}

                def _send_sms():
                    import requests as _req
                    resp = _req.post(
                        sms_url,
                        json={'api_key': sms_key, 'to': address, 'message': message},
                        timeout=10,
                    )
                    resp.raise_for_status()

                await asyncio.to_thread(_send_sms)
                logger.info(f"SMS sent to {address}")
                return {"success": True}

            elif channel == NotificationChannel.EMAIL.value:
                smtp_host = os.getenv('SMTP_HOST')
                smtp_port = int(os.getenv('SMTP_PORT', '587'))
                smtp_user = os.getenv('SMTP_USER')
                smtp_pass = os.getenv('SMTP_PASSWORD')
                email_from = os.getenv('EMAIL_FROM', smtp_user)
                if not smtp_host or not smtp_user:
                    logger.warning(f"SMTP not configured — would send to {address}: {subject}")
                    return {"success": False, "error": "SMTP_HOST / SMTP_USER not set"}

                def _send_email():
                    import smtplib
                    from email.mime.multipart import MIMEMultipart
                    from email.mime.text import MIMEText as _MIMEText
                    msg = MIMEMultipart('alternative')
                    msg['Subject'] = subject
                    msg['From'] = email_from
                    msg['To'] = address
                    msg.attach(_MIMEText(message, 'plain'))
                    with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                        server.ehlo()
                        server.starttls()
                        server.login(smtp_user, smtp_pass)
                        server.sendmail(email_from, [address], msg.as_string())

                await asyncio.to_thread(_send_email)
                logger.info(f"Email sent to {address}")
                return {"success": True}

            elif channel == NotificationChannel.PA.value:
                logger.info(f"PA broadcast: {message}")
                return {"success": True}

            else:
                return {"success": False, "error": f"Channel {channel} not implemented"}

        except Exception as e:
            logger.error(f"Error sending notification to {address}: {e}")
            return {"success": False, "error": str(e)}

    async def zkteco_queue_command(self, terminal_sn: str, command: str) -> Dict[str, Any]:
        """Queue command to ZKTeco device via ADMS"""
        
        try:
            # Use ADMS service for emergency commands
            result = await zkteco_adms_service.queue_device_command(terminal_sn, command)
            return result
        
        except Exception as e:
            logger.error(f"Error queuing command to {terminal_sn}: {str(e)}")
            return {"success": False, "error": str(e)}

    async def zkteco_queue_device_command(self, terminal_sn: str, command: str) -> Dict[str, Any]:
        """Queue device command to ZKTeco ADMS"""
        
        try:
            # Use ADMS service for command queuing
            result = await zkteco_adms_service.queue_device_command(terminal_sn, command)
            return result
        
        except Exception as e:
            logger.error(f"Error queuing device command: {str(e)}")
            return {"success": False, "error": str(e)}

    async def log_emergency_operation(
        self,
        db: Session,
        user_id: Optional[int],
        action: str,
        target_type: str,
        target_ids: Optional[List[int]] = None,
        emergency_event_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Log emergency operation for audit trail"""
        
        try:
            log_entry = BaseOperationLog(
                user_id=user_id,
                action=action,
                table_name="emergency_event" if emergency_event_id else target_type,
                record_id=emergency_event_id or (target_ids[0] if target_ids else None),
                new_values=json.dumps(details) if details else None,
                created_at=datetime.now(timezone.utc)
            )
            
            db.add(log_entry)
            
        except Exception as e:
            logger.error(f"Error logging emergency operation: {str(e)}")

    async def broadcast_emergency_update(self, update_data: Dict[str, Any]):
        """Broadcast emergency update via WebSocket and SSE so every open browser
        tab receives the alert — not only those on the emergency page."""
        try:
            await emergency_websocket_manager.broadcast(update_data)
        except Exception as e:
            logger.error(f"Error broadcasting emergency update via WebSocket: {str(e)}")
        try:
            from ..api.notifications import broadcast_notification
            # Build a human-readable SSE notification from the update payload
            event_type = update_data.get("type", "emergency_update")
            data = update_data.get("data", {})
            title_map = {
                "fire_mode": "Fire Mode Activated",
                "lockdown": "Emergency Lockdown",
                "panic": "PANIC ALARM",
                "emergency_status": "Emergency Status Update",
            }
            title = title_map.get(event_type, "Emergency Alert")
            action = data.get("action", "")
            if action == "clear":
                title = f"{title} — CLEARED"
            await broadcast_notification({
                "type": event_type,
                "priority": "critical",
                "title": title,
                "message": data.get("message") or f"Emergency event: {event_type}",
                **{k: v for k, v in data.items() if k in ("zone_id", "emergency_event_id")},
            })
        except Exception as e:
            logger.error(f"Error broadcasting emergency update via SSE: {str(e)}")

    async def get_emergency_audit_trail(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        event_type: Optional[int] = None,
        limit: int = 100,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """Get comprehensive emergency audit trail"""
        
        if db is None:
            db = next(get_db())
        
        try:
            query = db.query(EmergencyEvent)
            
            if start_time:
                query = query.filter(EmergencyEvent.start_time >= start_time)
            
            if end_time:
                query = query.filter(EmergencyEvent.start_time <= end_time)
            
            if event_type is not None:
                query = query.filter(EmergencyEvent.event_type == event_type)
            
            events = query.order_by(EmergencyEvent.start_time.desc()).limit(limit).all()
            
            audit_trail = []
            for event in events:
                # Get related operation logs
                logs = db.query(BaseOperationLog).filter(
                    BaseOperationLog.table_name == "emergency_event",
                    BaseOperationLog.record_id == event.id
                ).all()
                
                audit_trail.append({
                    "event_id": event.id,
                    "event_type": event.event_type,
                    "event_type_name": self.emergency_type_names.get(event.event_type, "UNKNOWN"),
                    "status": event.status,
                    "status_name": self.emergency_status_names.get(event.status, "UNKNOWN"),
                    "start_time": event.start_time.isoformat(),
                    "end_time": event.end_time.isoformat() if event.end_time else None,
                    "initiated_by": event.initiated_by,
                    "initiated_type": event.initiated_type,
                    "trigger_source": event.trigger_source,
                    "reason": event.reason,
                    "scope": event.scope,
                    "zone_ids": event.zone_ids or [],
                    "door_ids": event.door_ids or [],
                    "actions": event.actions or [],
                    "operation_logs": [
                        {
                            "user_id": log.user_id,
                            "action": log.action,
                            "new_values": log.new_values,
                            "created_at": log.created_at.isoformat()
                        }
                        for log in logs
                    ]
                })
            
            return audit_trail
            
        except Exception as e:
            logger.error(f"Error getting emergency audit trail: {str(e)}")
            raise

    # Transport Logistics Methods
    
    async def get_transport_dashboard(self, db: Session) -> Dict[str, Any]:
        """Get comprehensive transport dashboard"""
        
        try:
            # Get transport statistics
            total_transports = db.query(Transport).count()
            active_transports = db.query(Transport).filter(
                Transport.status.in_([TransportStatus.SCHEDULED.value, TransportStatus.BOARDING.value, TransportStatus.IN_TRANSIT.value])
            ).count()
            
            # Count by type
            helicopter_count = db.query(Transport).filter(Transport.type == TransportType.HELICOPTER.value).count()
            vessel_count = db.query(Transport).filter(Transport.type == TransportType.VESSEL.value).count()
            vehicle_count = db.query(Transport).filter(Transport.type == TransportType.VEHICLE.value).count()
            
            # Maintenance due
            maintenance_due = db.query(Transport).filter(
                or_(
                    Transport.is_maintenance_mode == True,
                    Transport.is_inspection_due == True
                )
            ).count()
            
            # Calculate utilization
            transports = db.query(Transport).all()
            total_utilization = sum(t.utilization_rate or 0 for t in transports)
            avg_utilization = total_utilization / len(transports) if transports else 0
            
            # Calculate costs
            total_cost_per_hour = sum(t.cost_per_hour or 0 for t in transports)
            avg_cost_per_hour = total_cost_per_hour / len(transports) if transports else 0
            
            return {
                "total_transports": total_transports,
                "active_transports": active_transports,
                "helicopter_transports": helicopter_count,
                "vessel_transports": vessel_count,
                "vehicle_transports": vehicle_count,
                "maintenance_due": maintenance_due,
                "average_utilization": round(avg_utilization, 2),
                "total_cost_per_hour": total_cost_per_hour,
                "average_cost_per_hour": round(avg_cost_per_hour, 2),
                "transport_types": {
                    "helicopter": {
                        "total": helicopter_count,
                        "active": db.query(Transport).filter(
                            Transport.type == TransportType.HELICOPTER.value,
                            Transport.status.in_([TransportStatus.SCHEDULED.value, TransportStatus.BOARDING.value, TransportStatus.IN_TRANSIT.value])
                        ).count()
                    },
                    "vessel": {
                        "total": vessel_count,
                        "active": db.query(Transport).filter(
                            Transport.type == TransportType.VESSEL.value,
                            Transport.status.in_([TransportStatus.SCHEDULED.value, TransportStatus.BOARDING.value, TransportStatus.IN_TRANSIT.value])
                        ).count()
                    },
                    "vehicle": {
                        "total": vehicle_count,
                        "active": db.query(Transport).filter(
                            Transport.type == TransportType.VEHICLE.value,
                            Transport.status.in_([TransportStatus.SCHEDULED.value, TransportStatus.BOARDING.value, TransportStatus.IN_TRANSIT.value])
                        ).count()
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting transport dashboard: {str(e)}")
            raise

    async def get_transport_fleet(
        self,
        transport_type: Optional[str] = None,
        include_inactive: bool = False,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """Get transport fleet information"""
        
        if db is None:
            db = next(get_db())
        
        try:
            query = db.query(Transport)
            
            if transport_type:
                type_map = {"helicopter": 0, "vessel": 1, "vehicle": 2}
                if transport_type.lower() in type_map:
                    query = query.filter(Transport.type == type_map[transport_type.lower()])
            
            if not include_inactive:
                query = query.filter(Transport.is_available == True)
            
            transports = query.all()
            
            fleet_data = []
            for transport in transports:
                fleet_data.append({
                    "id": transport.id,
                    "type": transport.type,
                    "type_name": ["HELICOPTER", "VESSEL", "VEHICLE"][transport.type],
                    "identifier": transport.identifier,
                    "registration_number": transport.registration_number,
                    "operator": transport.operator,
                    "status": transport.status,
                    "status_name": ["SCHEDULED", "BOARDING", "IN_TRANSIT", "ARRIVED", "CANCELLED"][transport.status],
                    "capacity": transport.capacity,
                    "current_pob": transport.current_pob,
                    "base_location": transport.base_location,
                    "current_location": transport.current_location,
                    "fuel_capacity": transport.fuel_capacity,
                    "current_fuel": transport.current_fuel,
                    "flight_hours": transport.flight_hours,
                    "max_altitude": transport.max_altitude,
                    "max_speed": transport.max_speed,
                    "cost_per_hour": transport.cost_per_hour,
                    "utilization_rate": transport.utilization_rate,
                    "performance_rating": transport.performance_rating,
                    "is_available": transport.is_available,
                    "is_maintenance_mode": transport.is_maintenance_mode,
                    "is_inspection_due": transport.is_inspection_due
                })
            
            return fleet_data
            
        except Exception as e:
            logger.error(f"Error getting transport fleet: {str(e)}")
            raise

# Create singleton instance
emergency_service = EmergencyService()
