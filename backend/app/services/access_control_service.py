"""
Access Control Service - BioTime 9.5 Compatible + POB Extensions
Business logic for Access Control operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from typing import List, Optional, Dict, Any
from datetime import datetime, time, timedelta
import json

from app.models.access_control import (
    AccTimeZone, AccLevelDoor, 
    AccEvent, AccInterlockGroup, AccInterlockDoor, AccLinkage,
    AccAntiPassback, AccFirstCard, AccessEventType, EmergencyAction
)
from app.models.biotime_models import IClockTerminal, PersonnelEmployee, AccLevel, AccDoor, AccUserAuthorize
from app.services.adms_protocol import ADMSProtocolService

class AccessControlService:
    """Service for Access Control business logic"""
    
    def __init__(self):
        self.adms_service = ADMSProtocolService()
    
    # ================================
    # TIME ZONE OPERATIONS
    # ================================
    
    def check_time_access(self, timezone_id: int, check_time: datetime) -> bool:
        """Check if current time is within timezone access window"""
        timezone = self.db.query(AccTimeZone).filter(AccTimeZone.id == timezone_id).first()
        if not timezone:
            return False
        
        # During emergency override, always allow access
        if timezone.emergency_override:
            return True
        
        # Get day of week (0=Monday, 6=Sunday)
        day_of_week = check_time.weekday()
        current_time = check_time.time()
        
        # Map day to time fields
        time_fields = {
            0: ['mon_time1', 'mon_time2', 'mon_time3'],
            1: ['tue_time1', 'tue_time2', 'tue_time3'],
            2: ['wed_time1', 'wed_time2', 'wed_time3'],
            3: ['thu_time1', 'thu_time2', 'thu_time3'],
            4: ['fri_time1', 'fri_time2', 'fri_time3'],
            5: ['sat_time1', 'sat_time2', 'sat_time3'],
            6: ['sun_time1', 'sun_time2', 'sun_time3']
        }
        
        day_fields = time_fields.get(day_of_week, ['mon_time1', 'mon_time2', 'mon_time3'])
        
        # Check each time interval
        for field in day_fields:
            time_range = getattr(timezone, field)
            if time_range and self._time_in_range(current_time, time_range):
                return True
        
        return False
    
    def _time_in_range(self, current_time: time, time_range: str) -> bool:
        """Check if current time is within the specified range"""
        try:
            start_str, end_str = time_range.split('-')
            start_time = datetime.strptime(start_str, '%H:%M').time()
            end_time = datetime.strptime(end_str, '%H:%M').time()
            
            if start_time <= end_time:
                return start_time <= current_time <= end_time
            else:  # Overnight range
                return current_time >= start_time or current_time <= end_time
        except Exception as e:
            return False
    
    # ================================
    # ACCESS LEVEL OPERATIONS
    # ================================
    
    def check_employee_access(self, emp_id: int, door_id: int, check_time: datetime) -> Dict[str, Any]:
        """Check if employee has access to door at specific time"""
        # Get employee's access levels
        access_levels = self.db.query(AccUserAuthorize).filter(
            AccUserAuthorize.emp_id == emp_id
        ).all()
        
        if not access_levels:
            return {"allowed": False, "reason": "No access level assigned"}
        
        # Check each access level
        for auth in access_levels:
            level = auth.access_level
            if not level.is_active:
                continue
            
            # Check mustering-only restriction
            if level.mustering_only:
                # Check if mustering event is active
                active_mustering = self._check_active_mustering()
                if not active_mustering:
                    continue
            
            # Check if level has access to this door
            level_door = self.db.query(AccLevelDoor).filter(
                and_(
                    AccLevelDoor.level_id == level.id,
                    AccLevelDoor.door_id == door_id
                )
            ).first()
            
            if not level_door:
                continue
            
            # Check time zone access
            if self.check_time_access(level_door.timezone_id, check_time):
                return {"allowed": True, "level_id": level.id, "timezone_id": level_door.timezone_id}
        
        return {"allowed": False, "reason": "No valid access level for this door/time"}
    
    def _check_active_mustering(self) -> bool:
        """Check if there's an active mustering event"""
        # This would check mustering_event table for active events
        # Implementation depends on mustering module
        return False
    
    # ================================
    # DOOR OPERATIONS
    # ================================
    
    async def process_access_request(self, terminal_sn: str, emp_code: str, verify_type: int) -> Dict[str, Any]:
        """Process access request from device"""
        # Get door information
        door = self.db.query(AccDoor).filter(AccDoor.terminal_sn == terminal_sn).first()
        if not door:
            return {"allowed": False, "reason": "Door not configured"}
        
        # Get employee information
        employee = self.db.query(PersonnelEmployee).filter(PersonnelEmployee.emp_code == emp_code).first()
        if not employee:
            return {"allowed": False, "reason": "Employee not found"}
        
        current_time = datetime.utcnow()
        
        # Check mustering mode
        if door.mustering_mode:
            return await self._process_mustering_access(door, employee, current_time, verify_type)
        
        # Check normal access
        access_result = self.check_employee_access(employee.id, door.id, current_time)
        
        if not access_result["allowed"]:
            # Log denied access
            await self._log_access_event(door, employee, current_time, verify_type, AccessEventType.NORMAL.value, False, access_result["reason"])
            return access_result
        
        # Check anti-passback
        apb_result = await self._check_anti_passback(door, employee, current_time)
        if not apb_result["allowed"]:
            await self._log_access_event(door, employee, current_time, verify_type, AccessEventType.ANTI_PASSBACK.value, False, apb_result["reason"])
            return apb_result
        
        # Check first-card open
        fco_result = await self._check_first_card_open(door, employee, current_time, access_result["timezone_id"])
        if fco_result["first_card_open"]:
            # Keep door open for zone duration
            await self.adms_service.set_door_open_duration(terminal_sn, door.open_duration * 60)  # Convert to seconds
        
        # Grant access
        await self.adms_service.relay_on(terminal_sn)
        await self._log_access_event(door, employee, current_time, verify_type, AccessEventType.NORMAL.value, True)
        
        return {"allowed": True, "door_open": True}
    
    async def _process_mustering_access(self, door: AccDoor, employee: PersonnelEmployee, current_time: datetime, verify_type: int) -> Dict[str, Any]:
        """Process mustering mode access"""
        # Log to mustering table instead of normal access
        # This would integrate with mustering module
        await self._log_mustering_event(door, employee, current_time, verify_type)
        return {"allowed": True, "mustering_mode": True, "logged": True}
    
    async def _check_anti_passback(self, door: AccDoor, employee: PersonnelEmployee, current_time: datetime) -> Dict[str, Any]:
        """Check anti-passback violation"""
        if door.anti_passback == 0:  # Disabled
            return {"allowed": True}
        
        # Get last access record for this employee at this door
        last_access = self.db.query(AccAntiPassback).filter(
            and_(
                AccAntiPassback.emp_code == employee.emp_code,
                AccAntiPassback.door_id == door.id
            )
        ).order_by(desc(AccAntiPassback.last_event_time)).first()
        
        if not last_access:
            # First access, create record
            apb_record = AccAntiPassback(
                emp_code=employee.emp_code,
                door_id=door.id,
                last_event_time=current_time,
                last_event_type=0,  # IN
                last_terminal_sn=door.terminal_sn
            )
            self.db.add(apb_record)
            self.db.commit()
            return {"allowed": True}
        
        # Check anti-passback rules
        if door.anti_passback == 1:  # Entry-Exit mode
            # Allow alternating IN/OUT
            return {"allowed": True}
        
        elif door.anti_passback == 2:  # Strict mode
            # Must alternate IN/OUT, same direction not allowed
            # Implementation depends on detecting entry/exit direction
            return {"allowed": True}  # Simplified for now
        
        return {"allowed": True}
    
    async def _check_first_card_open(self, door: AccDoor, employee: PersonnelEmployee, current_time: datetime, timezone_id: int) -> Dict[str, Any]:
        """Check first-card open functionality"""
        if not door.first_card_open:
            return {"first_card_open": False}
        
        # Check if this is the first card for this timezone period
        first_card = self.db.query(AccFirstCard).filter(
            and_(
                AccFirstCard.door_id == door.id,
                AccFirstCard.timezone_id == timezone_id,
                AccFirstCard.zone_end_time > current_time
            )
        ).first()
        
        if not first_card:
            # This is the first card, create record
            timezone = self.db.query(AccTimeZone).filter(AccTimeZone.id == timezone_id).first()
            if timezone:
                # Calculate zone end time (simplified - would use actual timezone logic)
                zone_end = current_time + timedelta(hours=8)  # 8-hour zone
                
                first_card_record = AccFirstCard(
                    door_id=door.id,
                    timezone_id=timezone_id,
                    first_card_time=current_time,
                    emp_code=employee.emp_code,
                    zone_end_time=zone_end
                )
                self.db.add(first_card_record)
                self.db.commit()
                
                return {"first_card_open": True, "zone_end": zone_end}
        
        return {"first_card_open": False}
    
    async def _log_access_event(self, door: AccDoor, employee: PersonnelEmployee, event_time: datetime, verify_type: int, event_type: int, allowed: bool, reason: str = None):
        """Log access control event"""
        event = AccEvent(
            event_time=event_time,
            terminal_sn=door.terminal_sn,
            door_id=door.id,
            emp_code=employee.emp_code,
            emp_name=f"{employee.first_name} {employee.last_name}",
            event_type=event_type,
            verify_type=verify_type,
            description=f"Access {'granted' if allowed else 'denied'}{': ' + reason if reason else ''}"
        )
        self.db.add(event)
        self.db.commit()
    
    async def _log_mustering_event(self, door: AccDoor, employee: PersonnelEmployee, event_time: datetime, verify_type: int):
        """Log mustering event"""
        # This would integrate with mustering module
        # For now, log as mustering event type
        event = AccEvent(
            event_time=event_time,
            terminal_sn=door.terminal_sn,
            door_id=door.id,
            emp_code=employee.emp_code,
            emp_name=f"{employee.first_name} {employee.last_name}",
            event_type=AccessEventType.MUSTERING_CHECK.value,
            verify_type=verify_type,
            description="Mustering check-in"
        )
        self.db.add(event)
        self.db.commit()
    
    # ================================
    # EMERGENCY OPERATIONS
    # ================================
    
    async def emergency_lockdown(self, door_ids: List[int] = None, action: str = "lock") -> Dict[str, Any]:
        """Execute emergency lockdown or unlock"""
        doors_query = self.db.query(AccDoor)
        if door_ids:
            doors_query = doors_query.filter(AccDoor.id.in_(door_ids))
        
        doors = doors_query.all()
        results = []
        
        for door in doors:
            try:
                if action == "lock":
                    await self.adms_service.relay_off(door.terminal_sn)
                    event_type = AccessEventType.EMERGENCY_LOCK.value
                else:  # unlock
                    await self.adms_service.relay_on(door.terminal_sn)
                    event_type = AccessEventType.FIRE_UNLOCK.value
                
                # Log emergency event
                event = AccEvent(
                    event_time=datetime.utcnow(),
                    terminal_sn=door.terminal_sn,
                    door_id=door.id,
                    event_type=event_type,
                    description=f"Emergency {action} action"
                )
                self.db.add(event)
                
                results.append({"door_id": door.id, "status": "success"})
                
            except Exception as e:
                results.append({"door_id": door.id, "status": "error", "error": str(e)})
        
        self.db.commit()
        return {"action": action, "doors": results}
    
    async def set_mustering_mode(self, door_ids: List[int], mustering_mode: bool = True) -> Dict[str, Any]:
        """Enable/disable mustering mode on doors"""
        doors = self.db.query(AccDoor).filter(AccDoor.id.in_(door_ids)).all()
        
        for door in doors:
            door.mustering_mode = mustering_mode
            
            # Log configuration change
            event = AccEvent(
                event_time=datetime.utcnow(),
                terminal_sn=door.terminal_sn,
                door_id=door.id,
                event_type=AccessEventType.MUSTERING_CHECK.value,
                description=f"Mustering mode {'enabled' if mustering_mode else 'disabled'}"
            )
            self.db.add(event)
        
        self.db.commit()
        return {"doors_updated": len(doors), "mustering_mode": mustering_mode}
    
    # ================================
    # REPORTING OPERATIONS
    # ================================
    
    def get_latest_events(self, limit: int = 50) -> List[AccEvent]:
        """Get latest access control events"""
        return self.db.query(AccEvent).order_by(desc(AccEvent.event_time)).limit(limit).all()
    
    def get_door_statistics(self, door_id: int, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get statistics for a specific door"""
        events = self.db.query(AccEvent).filter(
            and_(
                AccEvent.door_id == door_id,
                AccEvent.event_time >= start_date,
                AccEvent.event_time <= end_date
            )
        ).all()
        
        stats = {
            "total_events": len(events),
            "by_event_type": {},
            "by_hour": {},
            "access_granted": 0,
            "access_denied": 0
        }
        
        for event in events:
            # Count by event type
            event_type_name = AccessEventType(event.event_type).name
            stats["by_event_type"][event_type_name] = stats["by_event_type"].get(event_type_name, 0) + 1
            
            # Count by hour
            hour = event.event_time.hour
            stats["by_hour"][hour] = stats["by_hour"].get(hour, 0) + 1
            
            # Count access granted/denied (simplified)
            if event.event_type == AccessEventType.NORMAL.value:
                if "granted" in event.description:
                    stats["access_granted"] += 1
                else:
                    stats["access_denied"] += 1
        
        return stats
    
    def get_employee_access_history(self, emp_code: str, start_date: datetime, end_date: datetime) -> List[AccEvent]:
        """Get access history for an employee"""
        return self.db.query(AccEvent).filter(
            and_(
                AccEvent.emp_code == emp_code,
                AccEvent.event_time >= start_date,
                AccEvent.event_time <= end_date
            )
        ).order_by(desc(AccEvent.event_time)).all()
    
    # ================================
    # INTERLOCK OPERATIONS
    # ================================
    
    def check_interlock_violation(self, door_id: int, action: str) -> Dict[str, Any]:
        """Check if door action violates interlock rules"""
        door = self.db.query(AccDoor).filter(AccDoor.id == door_id).first()
        if not door or door.interlock_group == 0:
            return {"allowed": True}
        
        # Get other doors in the same interlock group
        other_doors = self.db.query(AccDoor).filter(
            and_(
                AccDoor.interlock_group == door.interlock_group,
                AccDoor.id != door_id
            )
        ).all()
        
        # Check if any other door in the group is currently open
        for other_door in other_doors:
            # Check for recent open events that haven't been closed
            recent_open = self.db.query(AccEvent).filter(
                and_(
                    AccEvent.door_id == other_door.id,
                    AccEvent.event_type == AccessEventType.DOOR_OPEN.value,
                    AccEvent.event_time >= datetime.utcnow() - timedelta(minutes=5)
                )
            ).first()
            
            if recent_open:
                return {
                    "allowed": False,
                    "reason": f"Interlock violation: {other_door.door_name} is open",
                    "conflicting_door": other_door.door_name
                }
        
        return {"allowed": True}
    
    # Database session setter (for dependency injection)
    def set_db(self, db: Session):
        self.db = db
