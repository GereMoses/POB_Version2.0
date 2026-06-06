"""
Mustering Celery Tasks
Automated drill scheduling, notifications, and background tasks for mustering system
"""

from celery import Celery
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import logging
import json
import requests

import os

from app.core.database import engine
from app.services.mustering_service import MusteringService
from app.models.biotime_models import (
    MusteringDrillSchedule, MusteringEvent,
    MusteringLog, MusteringEscalationRecord,
)
from app.models.zone import Zone
from sqlalchemy import and_

# Configure logging
logger = logging.getLogger(__name__)

_redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Initialize Celery
celery_app = Celery(
    'mustering_tasks',
    broker=_redis_url,
    backend=_redis_url,
    include=['app.services.mustering_celery_tasks']
)

# Database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@celery_app.task(bind=True, max_retries=3)
def check_scheduled_drills(self):
    """
    Check for scheduled drills and start them automatically
    Runs every minute
    """
    db = SessionLocal()
    
    try:
        logger.info("Checking for scheduled drills...")
        
        # Get current time
        now = datetime.utcnow()
        
        # Find drills scheduled to start now or in the past minute
        scheduled_drills = db.query(MusteringDrillSchedule).filter(
            MusteringDrillSchedule.scheduled_time <= now,
            MusteringDrillSchedule.auto_start == True
        ).all()
        
        started_drills = []
        
        for drill in scheduled_drills:
            try:
                # Check if there's already an active event for this zone
                active_event = db.query(MusteringEvent).filter(
                    MusteringEvent.zone_id == drill.zone_id,
                    MusteringEvent.status == 0  # Active
                ).first()
                
                if active_event:
                    logger.warning(f"Zone {drill.zone_id} already has active event, skipping scheduled drill")
                    continue
                
                # Start the drill
                mustering_service = MusteringService(db)
                event_result = mustering_service.start_mustering_event(
                    zone_id=drill.zone_id,
                    event_type=drill.event_type,
                    initiated_by=drill.created_by,
                    initiated_type=1,  # Scheduled
                    notify_sms=False,  # Will be handled by notification task
                    notify_email=False,
                    notify_whatsapp=False,
                    notify_siren=False,
                    notes=f"Automated drill: {drill.template.template_name if drill.template else 'Scheduled drill'}"
                )
                
                started_drills.append({
                    'drill_id': drill.id,
                    'event_id': event_result['event_id'],
                    'zone_id': drill.zone_id,
                    'scheduled_time': drill.scheduled_time,
                    'started_time': now
                })
                
                # Update drill schedule to mark as processed
                drill.processed = True
                drill.processed_time = now
                db.commit()
                
                logger.info(f"✅ Started scheduled drill {drill.id} -> Event {event_result['event_id']}")
                
            except Exception as e:
                logger.error(f"❌ Error starting scheduled drill {drill.id}: {e}")
                db.rollback()
        
        # Send notification for started drills
        if started_drills:
            send_drill_notifications.delay(started_drills)
        
        # Clean up old processed drills (older than 7 days)
        cleanup_old_schedules(db)
        
    except Exception as e:
        logger.error(f"❌ Error in check_scheduled_drills task: {e}")
        db.rollback()
    finally:
        db.close()

@celery_app.task(bind=True, max_retries=3)
def send_drill_notifications(self, drill_data):
    """
    Send notifications for started drills
    drill_data: List of dictionaries with drill information
    """
    try:
        logger.info(f"Sending drill notifications for {len(drill_data)} drills")
        
        for drill in drill_data:
            # Send SMS notifications
            if drill.get('notify_sms'):
                send_sms_notification.delay(
                    message=f"DRILL STARTED: Emergency drill initiated in Zone {drill['zone_id']}",
                    recipients=get_drill_recipients(drill['zone_id'], 'sms')
                )
            
            # Send Email notifications
            if drill.get('notify_email'):
                send_email_notification.delay(
                    subject=f"Emergency Drill Started - Zone {drill['zone_id']}",
                    message=f"An emergency drill has been initiated in Zone {drill['zone_id']} at {drill['started_time']}.",
                    recipients=get_drill_recipients(drill['zone_id'], 'email')
                )
            
            # Send WhatsApp notifications
            if drill.get('notify_whatsapp'):
                send_whatsapp_notification.delay(
                    message=f"🚨 DRILL: Emergency drill in Zone {drill['zone_id']}",
                    recipients=get_drill_recipients(drill['zone_id'], 'whatsapp')
                )
            
            # Trigger sirens
            if drill.get('notify_siren'):
                trigger_sirens.delay(drill['zone_id'])
        
        logger.info(f"✅ Drill notifications sent for {len(drill_data)} drills")
        
    except Exception as e:
        logger.error(f"❌ Error sending drill notifications: {e}")

@celery_app.task(bind=True, max_retries=3)
def send_emergency_notifications(self, event_data):
    """
    Send emergency notifications for real events
    event_data: Dictionary with event information
    """
    try:
        logger.info(f"Sending emergency notifications for event {event_data.get('event_id')}")
        
        event_id = event_data.get('event_id')
        zone_id = event_data.get('zone_id')
        event_type = event_data.get('event_type')
        
        # Get notification preferences from zone
        db = SessionLocal()
        try:
            zone = db.query(Zone).filter(Zone.id == zone_id).first()
            if not zone:
                logger.error(f"Zone {zone_id} not found for notifications")
                return
            
            # Determine event type name
            event_names = {
                0: "Real Emergency",
                1: "Drill", 
                2: "Fire Emergency",
                3: "Gas Emergency",
                4: "Man Down Emergency"
            }
            event_name = event_names.get(event_type, "Emergency")
            
            # Send notifications based on event type and preferences
            if event_data.get('notify_sms'):
                send_sms_notification.delay(
                    message=f"🚨 {event_name}: Emergency initiated in Zone {zone.name}",
                    recipients=get_emergency_recipients(zone_id, 'sms')
                )
            
            if event_data.get('notify_email'):
                send_email_notification.delay(
                    subject=f"🚨 {event_name} - Zone {zone.name}",
                    message=f"A {event_name.lower()} has been initiated in Zone {zone.name} at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}. Please proceed to your designated muster point immediately.",
                    recipients=get_emergency_recipients(zone_id, 'email')
                )
            
            if event_data.get('notify_whatsapp'):
                send_whatsapp_notification.delay(
                    message=f"🚨 {event_name} in Zone {zone.name} - Proceed to muster point immediately!",
                    recipients=get_emergency_recipients(zone_id, 'whatsapp')
                )
            
            if event_data.get('notify_siren'):
                trigger_sirens.delay(zone_id)
            
            logger.info(f"✅ Emergency notifications sent for event {event_id}")
            
        except Exception as e:
            logger.error(f"❌ Error sending emergency notifications: {e}")
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Critical error in send_emergency_notifications: {e}")

@celery_app.task(bind=True, max_retries=3)
def send_muster_completion_notifications(self, event_data):
    """
    Send notifications when mustering event is completed
    event_data: Dictionary with event completion information
    """
    try:
        logger.info(f"Sending muster completion notifications for event {event_data.get('event_id')}")
        
        event_id = event_data.get('event_id')
        zone_id = event_data.get('zone_id')
        headcount = event_data.get('final_headcount', {})
        
        db = SessionLocal()
        try:
            zone = db.query(Zone).filter(Zone.id == zone_id).first()
            if not zone:
                logger.error(f"Zone {zone_id} not found for completion notifications")
                return
            
            total_expected = headcount.get('total_expected', 0)
            total_safe = headcount.get('total_safe', 0)
            total_missing = headcount.get('total_missing', 0)
            completion_percent = headcount.get('completion_percentage', 0)
            
            # Prepare message
            if total_missing == 0:
                status_msg = f"✅ All personnel accounted for ({total_safe}/{total_expected})"
                status_emoji = "✅"
            else:
                status_msg = f"⚠️ {total_missing} personnel still missing ({total_safe}/{total_expected})"
                status_emoji = "⚠️"
            
            # Send completion notifications
            send_sms_notification.delay(
                message=f"{status_emoji} Muster Complete: {status_msg} - {completion_percent:.1f}% accounted",
                recipients=get_emergency_recipients(zone_id, 'sms')
            )
            
            send_email_notification.delay(
                subject=f"Muster Complete - Zone {zone.name} - {completion_percent:.1f}%",
                message=f"""
Mustering event completed for Zone {zone.name}.

Summary:
- Total Expected: {total_expected}
- Safe: {total_safe}
- Missing: {total_missing}
- Completion: {completion_percent:.1f}%

{status_msg}

Event Duration: {event_data.get('duration', 'N/A')} minutes
                """,
                recipients=get_emergency_recipients(zone_id, 'email')
            )
            
            logger.info(f"✅ Muster completion notifications sent for event {event_id}")
            
        except Exception as e:
            logger.error(f"❌ Error sending completion notifications: {e}")
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Critical error in send_muster_completion_notifications: {e}")

@celery_app.task(bind=True, max_retries=3)
def send_sms_notification(self, message, recipients):
    """
    Send SMS notification
    recipients: List of phone numbers
    """
    try:
        logger.info(f"Sending SMS to {len(recipients)} recipients: {message}")
        
        # Check if SMS service is configured
        sms_api_key = os.getenv('SMS_API_KEY')
        if not sms_api_key:
            logger.warning("SMS_API_KEY not configured, skipping SMS notification")
            return
        
        # Mock SMS implementation - replace with actual SMS service
        for recipient in recipients:
            logger.info(f"📱 SMS sent to {recipient}: {message}")
            # In real implementation:
            # response = requests.post(
            #     'https://sms-provider.com/api/send',
            #     json={
            #         'api_key': sms_api_key,
            #         'to': recipient,
            #         'message': message
            #     }
            # )
        
    except Exception as e:
        logger.error(f"❌ Error sending SMS notification: {e}")

@celery_app.task(bind=True, max_retries=3)
def send_email_notification(self, subject, message, recipients):
    """
    Send email notification
    recipients: List of email addresses
    """
    try:
        logger.info(f"Sending email to {len(recipients)} recipients: {subject}")
        
        # Check if email service is configured
        email_api_key = os.getenv('EMAIL_API_KEY')
        if not email_api_key:
            logger.warning("EMAIL_API_KEY not configured, skipping email notification")
            return
        
        # Mock email implementation - replace with actual email service
        for recipient in recipients:
            logger.info(f"📧 Email sent to {recipient}: {subject}")
            # In real implementation:
            # response = requests.post(
            #     'https://email-provider.com/api/send',
            #     json={
            #         'api_key': email_api_key,
            #         'to': recipient,
            #         'subject': subject,
            #         'message': message
            #     }
            # )
        
    except Exception as e:
        logger.error(f"❌ Error sending email notification: {e}")

@celery_app.task(bind=True, max_retries=3)
def send_whatsapp_notification(self, message, recipients):
    """
    Send WhatsApp notification
    recipients: List of WhatsApp numbers
    """
    try:
        logger.info(f"Sending WhatsApp to {len(recipients)} recipients: {message}")
        
        # Check if WhatsApp service is configured
        whatsapp_api_key = os.getenv('WHATSAPP_API_KEY')
        if not whatsapp_api_key:
            logger.warning("WHATSAPP_API_KEY not configured, skipping WhatsApp notification")
            return
        
        # Mock WhatsApp implementation - replace with actual WhatsApp service
        for recipient in recipients:
            logger.info(f"💬 WhatsApp sent to {recipient}: {message}")
            # In real implementation:
            # response = requests.post(
            #     'https://whatsapp-provider.com/api/send',
            #     json={
            #         'api_key': whatsapp_api_key,
            #         'to': recipient,
            #         'message': message
            #     }
            # )
        
    except Exception as e:
        logger.error(f"❌ Error sending WhatsApp notification: {e}")

@celery_app.task(bind=True, max_retries=3)
def trigger_sirens(self, zone_id):
    """
    Trigger emergency sirens in a zone
    zone_id: ID of the mustering zone
    """
    try:
        logger.info(f"Triggering sirens for zone {zone_id}")
        
        db = SessionLocal()
        try:
            # Get emergency devices in the zone
            # This would query emergency_device table
            # For now, we'll mock the implementation
            
            # Get zone info
            zone = db.query(Zone).filter(Zone.id == zone_id).first()
            if not zone:
                logger.error(f"Zone {zone_id} not found for siren activation")
                return
            
            logger.info(f"🚨 Sirens triggered for Zone {zone.name}")
            
            # In real implementation, this would:
            # 1. Query emergency_device table for devices in this zone
            # 2. Send EMERGENCY_ON commands to siren devices
            # 3. Log device responses
            
            # Mock implementation
            emergency_devices = [
                {'id': 1, 'device_type': 'siren', 'location': zone.name},
                {'id': 2, 'device_type': 'strobe', 'location': zone.name}
            ]
            
            for device in emergency_devices:
                logger.info(f"   Siren {device['id']} activated in {device['location']}")
                # Send actual command to device via ADMS protocol
            
        except Exception as e:
            logger.error(f"❌ Error triggering sirens: {e}")
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"❌ Critical error in trigger_sirens: {e}")

@celery_app.task(bind=True, max_retries=3)
def cleanup_old_schedules(db):
    """
    Clean up old processed drill schedules
    """
    try:
        # Delete schedules older than 7 days that have been processed
        cutoff_date = datetime.utcnow() - timedelta(days=7)
        
        old_schedules = db.query(MusteringDrillSchedule).filter(
            MusteringDrillSchedule.processed == True,
            MusteringDrillSchedule.processed_time < cutoff_date
        ).all()
        
        for schedule in old_schedules:
            db.delete(schedule)
        
        if old_schedules:
            db.commit()
            logger.info(f"✅ Cleaned up {len(old_schedules)} old drill schedules")
        
    except Exception as e:
        logger.error(f"❌ Error cleaning up old schedules: {e}")
        db.rollback()

# Helper functions
def get_drill_recipients(zone_id, notification_type):
    """Get recipients for drill notifications"""
    # This would query notification preferences for the zone
    # For now, return mock recipients
    if notification_type == 'sms':
        return ['+234801234567', '+234801234568']
    elif notification_type == 'email':
        return ['safety.manager@company.com', 'hse.officer@company.com']
    elif notification_type == 'whatsapp':
        return ['+234801234567']
    return []

def get_emergency_recipients(zone_id, notification_type):
    """Get recipients for emergency notifications"""
    # This would query emergency contact lists for the zone
    # For now, return mock recipients
    if notification_type == 'sms':
        return ['+234801234567', '+234801234568', '+234801234569']
    elif notification_type == 'email':
        return ['safety.manager@company.com', 'hse.officer@company.com', 'emergency.team@company.com']
    elif notification_type == 'whatsapp':
        return ['+234801234567', '+234801234568']
    return []

@celery_app.task(bind=True, max_retries=3)
def check_missing_escalations(self):
    """
    Scan all active mustering events for persons missing beyond the 10 / 20 / 30-minute
    escalation thresholds and fire a notification for each new threshold crossed.

    Runs every 5 minutes via beat schedule.
    De-duplicated via the mustering_escalation_record table so each level is only
    notified once per person per event.
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        active_events = db.query(MusteringEvent).filter(MusteringEvent.status == 0).all()

        total_notified = 0
        for event in active_events:
            start = event.start_time
            if hasattr(start, 'tzinfo') and start.tzinfo is not None:
                start = start.replace(tzinfo=None)
            minutes_elapsed = (now - start).total_seconds() / 60

            missing_logs = db.query(MusteringLog).filter(
                and_(MusteringLog.event_id == event.id, MusteringLog.status == 0)
            ).all()

            zone_name = event.zone.name if event.zone else f"Event {event.id}"

            for log in missing_logs:
                thresholds = [
                    (10, 1, 'ALERT',          f"⚠️  {log.emp_name or log.emp_code} has been MISSING for 10 minutes in {zone_name}."),
                    (20, 2, 'SEARCH_ORDERED', f"🔴  {log.emp_name or log.emp_code} MISSING 20 minutes — search team should be deployed in {zone_name}."),
                    (30, 3, 'CRITICAL',       f"🚨  CRITICAL: {log.emp_name or log.emp_code} MISSING 30+ minutes in {zone_name}. Escalate immediately."),
                ]

                for threshold_min, level, notif_type, msg in thresholds:
                    if minutes_elapsed < threshold_min:
                        continue

                    already_sent = db.query(MusteringEscalationRecord).filter(
                        and_(
                            MusteringEscalationRecord.event_id == event.id,
                            MusteringEscalationRecord.emp_code == log.emp_code,
                            MusteringEscalationRecord.level == level,
                        )
                    ).first()

                    if already_sent:
                        continue

                    # Log the escalation (integrate with notification service here)
                    logger.warning(f"MUSTER ESCALATION [{notif_type}] event={event.id}: {msg}")

                    # TODO: call real notification service, e.g.:
                    # send_emergency_notification(event.id, log.emp_code, notif_type, msg)

                    record = MusteringEscalationRecord(
                        event_id=event.id,
                        emp_code=log.emp_code,
                        level=level,
                        notification_type=notif_type,
                    )
                    db.add(record)
                    total_notified += 1

        db.commit()
        logger.info(f"check_missing_escalations: {len(active_events)} active events, {total_notified} new escalations fired")

    except Exception as exc:
        logger.error(f"check_missing_escalations error: {exc}")
        db.rollback()
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()


# Schedule periodic tasks
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    'check-scheduled-drills': {
        'task': 'app.services.mustering_celery_tasks.check_scheduled_drills',
        'schedule': crontab(minute='*'),
    },
    'check-missing-escalations': {
        'task': 'app.services.mustering_celery_tasks.check_missing_escalations',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
}

import os
