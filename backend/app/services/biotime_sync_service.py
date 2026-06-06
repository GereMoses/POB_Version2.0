"""
BioTime Synchronization Service

This service provides comprehensive bidirectional synchronization between POB system and ZKTeco BioTime,
ensuring data consistency and real-time updates for personnel, biometric templates, and attendance records.
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import httpx
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.personnel import Personnel, AttendanceLog
from ..schemas.personnel import PersonnelCreate, PersonnelUpdate
from ..services.biotime_client import BioTimeClient
from ..services.biotime_realtime_service import biotime_realtime_service
from .biotime_mapper import BioTimeMapper

logger = logging.getLogger(__name__)


class BioTimeSyncService:
    """Service for bidirectional synchronization with ZKTeco BioTime"""
    
    def __init__(self):
        self.biotime_client = BioTimeClient()
        self.mapper = BioTimeMapper()
        self.sync_status = {
            "last_personnel_sync": None,
            "last_attendance_sync": None,
            "last_biometric_sync": None,
            "sync_errors": [],
            "total_synced": 0
        }
    
    async def sync_personnel_from_biotime(self, db: Session, force_sync: bool = False) -> Dict[str, Any]:
        """
        Sync personnel data from BioTime to POB system
        
        Args:
            db: Database session
            force_sync: Force full sync regardless of last sync time
            
        Returns:
            Sync result with statistics
        """
        try:
            logger.info("Starting personnel sync from BioTime")
            
            # Get last sync time
            last_sync = self.sync_status.get("last_personnel_sync")
            if not force_sync and last_sync:
                sync_from = last_sync
            else:
                sync_from = None
            
            # Fetch personnel from BioTime
            biotime_personnel = await self.biotime_client.get_personnel(updated_since=sync_from)
            
            if not biotime_personnel.get("success", False):
                return {
                    "success": False,
                    "error": biotime_personnel.get("error", "Unknown error"),
                    "synced_count": 0
                }
            
            personnel_data = biotime_personnel.get("data", [])
            synced_count = 0
            updated_count = 0
            created_count = 0
            errors = []
            
            for person_data in personnel_data:
                try:
                    # Map BioTime data to POB format
                    pob_personnel = self.mapper.map_biotime_to_pob_personnel(person_data)
                    
                    # Check if personnel exists
                    existing = db.query(Personnel).filter(
                        Personnel.badge_id == pob_personnel.badge_id
                    ).first()
                    
                    if existing:
                        # Update existing personnel
                        update_data = pob_personnel.dict(exclude_unset=True)
                        for field, value in update_data.items():
                            setattr(existing, field, value)
                        existing.updated_at = datetime.utcnow()
                        updated_count += 1
                    else:
                        # Create new personnel
                        new_personnel = Personnel(**pob_personnel.dict())
                        db.add(new_personnel)
                        created_count += 1
                    
                    synced_count += 1
                    
                except Exception as e:
                    error_msg = f"Error syncing personnel {person_data.get('employee_id', 'unknown')}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            
            # Commit changes
            db.commit()
            
            # Update sync status
            self.sync_status["last_personnel_sync"] = datetime.utcnow()
            self.sync_status["total_synced"] += synced_count
            
            result = {
                "success": True,
                "synced_count": synced_count,
                "created_count": created_count,
                "updated_count": updated_count,
                "errors": errors,
                "sync_time": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Personnel sync completed: {synced_count} records processed")
            return result
            
        except Exception as e:
            logger.error(f"Personnel sync failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "synced_count": 0
            }
    
    async def sync_personnel_to_biotime(self, db: Session, personnel_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Sync personnel data from POB to BioTime
        
        Args:
            db: Database session
            personnel_ids: Specific personnel IDs to sync (None for all)
            
        Returns:
            Sync result with statistics
        """
        try:
            logger.info("Starting personnel sync to BioTime")
            
            # Get personnel to sync
            query = db.query(Personnel)
            if personnel_ids:
                query = query.filter(Personnel.id.in_(personnel_ids))
            
            personnel_list = query.all()
            
            synced_count = 0
            errors = []
            
            for personnel in personnel_list:
                try:
                    # Map POB data to BioTime format
                    biotime_data = self.mapper.map_pob_to_biotime_personnel(personnel)
                    
                    # Send to BioTime
                    result = await self.biotime_client.create_or_update_personnel(biotime_data)
                    
                    if result.get("success", False):
                        synced_count += 1
                    else:
                        error_msg = f"Failed to sync {personnel.badge_id}: {result.get('error', 'Unknown error')}"
                        errors.append(error_msg)
                        
                except Exception as e:
                    error_msg = f"Error syncing personnel {personnel.badge_id}: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            
            result = {
                "success": len(errors) == 0,
                "synced_count": synced_count,
                "total_count": len(personnel_list),
                "errors": errors,
                "sync_time": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Personnel sync to BioTime completed: {synced_count}/{len(personnel_list)} records")
            return result
            
        except Exception as e:
            logger.error(f"Personnel sync to BioTime failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "synced_count": 0
            }
    
    async def sync_attendance_from_biotime(self, db: Session, date_from: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Sync attendance records from BioTime to POB system
        
        Args:
            db: Database session
            date_from: Start date for attendance sync
            
        Returns:
            Sync result with statistics
        """
        try:
            logger.info("Starting attendance sync from BioTime")
            
            # Default to last 24 hours if no date specified
            if not date_from:
                date_from = datetime.utcnow() - timedelta(hours=24)
            
            # Fetch attendance from BioTime
            biotime_attendance = await self.biotime_client.get_attendance(from_date=date_from)
            
            if not biotime_attendance.get("success", False):
                return {
                    "success": False,
                    "error": biotime_attendance.get("error", "Unknown error"),
                    "synced_count": 0
                }
            
            attendance_data = biotime_attendance.get("data", [])
            synced_count = 0
            errors = []
            
            for attendance_record in attendance_data:
                try:
                    # Map BioTime attendance to POB format
                    pob_attendance = self.mapper.map_biotime_to_pob_attendance(attendance_record)
                    
                    # Check if attendance record already exists
                    existing = db.query(AttendanceLog).filter(
                        and_(
                            AttendanceLog.personnel_id == pob_attendance.personnel_id,
                            AttendanceLog.timestamp == pob_attendance.timestamp,
                            AttendanceLog.device_id == pob_attendance.device_id
                        )
                    ).first()
                    
                    if not existing:
                        # Create new attendance record
                        new_attendance = AttendanceLog(**pob_attendance.dict())
                        db.add(new_attendance)
                        synced_count += 1
                    
                except Exception as e:
                    error_msg = f"Error syncing attendance record: {str(e)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
            
            # Commit changes
            db.commit()
            
            # Update sync status
            self.sync_status["last_attendance_sync"] = datetime.utcnow()
            
            result = {
                "success": len(errors) == 0,
                "synced_count": synced_count,
                "total_count": len(attendance_data),
                "errors": errors,
                "sync_time": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Attendance sync completed: {synced_count} new records")
            return result
            
        except Exception as e:
            logger.error(f"Attendance sync failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "synced_count": 0
            }
    
    async def enroll_biometric_template(self, personnel_id: int, biometric_type: str, 
                                   template_data: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """
        Enroll biometric template and sync with BioTime
        
        Args:
            personnel_id: Personnel ID
            biometric_type: Type of biometric (fingerprint, face)
            template_data: Template data
            db: Database session
            
        Returns:
            Enrollment result
        """
        try:
            # Get personnel
            personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
            if not personnel:
                return {
                    "success": False,
                    "error": "Personnel not found"
                }
            
            # Prepare biometric data for BioTime
            biometric_data = {
                "employee_id": personnel.badge_id,
                "biometric_type": biometric_type,
                "template_data": template_data,
                "quality_score": template_data.get("quality", 0),
                "enrollment_date": datetime.utcnow().isoformat()
            }
            
            # Send to BioTime
            biotime_result = await self.biotime_client.enroll_biometric(biometric_data)
            
            if not biotime_result.get("success", False):
                return {
                    "success": False,
                    "error": biotime_result.get("error", "BioTime enrollment failed")
                }
            
            # Update local biometric data
            if not personnel.biometric_data:
                personnel.biometric_data = {}
            
            if biometric_type == "fingerprint":
                if not personnel.fingerprint_templates:
                    personnel.fingerprint_templates = []
                personnel.fingerprint_templates.append(template_data)
                personnel.biometric_data["last_fingerprint_enroll"] = datetime.utcnow().isoformat()
            elif biometric_type == "face":
                personnel.face_template = template_data.get("template")
                personnel.biometric_data["last_face_enroll"] = datetime.utcnow().isoformat()
            
            personnel.biometric_enrolled = True
            personnel.updated_at = datetime.utcnow()
            
            db.commit()
            
            return {
                "success": True,
                "message": f"{biometric_type} template enrolled successfully",
                "template_id": biotime_result.get("template_id"),
                "quality_score": template_data.get("quality", 0)
            }
            
        except Exception as e:
            logger.error(f"Biometric enrollment failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def verify_biometric_realtime(self, personnel_id: int, biometric_data: Dict[str, Any], 
                                     db: Session) -> Dict[str, Any]:
        """
        Real-time biometric verification
        
        Args:
            personnel_id: Personnel ID
            biometric_data: Biometric data for verification
            db: Database session
            
        Returns:
            Verification result
        """
        try:
            # Get personnel
            personnel = db.query(Personnel).filter(Personnel.id == personnel_id).first()
            if not personnel:
                return {
                    "success": False,
                    "error": "Personnel not found"
                }
            
            # Prepare verification request
            verification_data = {
                "employee_id": personnel.badge_id,
                "biometric_data": biometric_data,
                "verification_mode": "realtime"
            }
            
            # Send to BioTime for verification
            verification_result = await self.biotime_client.verify_biometric(verification_data)
            
            if verification_result.get("success", False):
                # Update last seen
                personnel.last_seen = datetime.utcnow()
                db.commit()
                
                return {
                    "success": True,
                    "verified": True,
                    "confidence": verification_result.get("confidence", 0),
                    "verification_method": verification_result.get("method", "unknown"),
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "success": True,
                    "verified": False,
                    "confidence": 0,
                    "error": verification_result.get("error", "Verification failed")
                }
                
        except Exception as e:
            logger.error(f"Biometric verification failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_sync_status(self) -> Dict[str, Any]:
        """
        Get current synchronization status
        
        Returns:
            Sync status information
        """
        return {
            "sync_status": self.sync_status,
            "biotime_connection": await self.biotime_client.health_check(),
            "last_sync_summary": {
                "personnel": self.sync_status.get("last_personnel_sync"),
                "attendance": self.sync_status.get("last_attendance_sync"),
                "biometric": self.sync_status.get("last_biometric_sync"),
                "total_synced": self.sync_status.get("total_synced", 0),
                "error_count": len(self.sync_status.get("sync_errors", []))
            }
        }
    
    async def force_full_sync(self, db: Session) -> Dict[str, Any]:
        """
        Force full synchronization with BioTime
        
        Args:
            db: Database session
            
        Returns:
            Full sync result
        """
        logger.info("Starting forced full synchronization with BioTime")
        
        results = {
            "personnel_sync": await self.sync_personnel_from_biotime(db, force_sync=True),
            "attendance_sync": await self.sync_attendance_from_biotime(db),
            "sync_time": datetime.utcnow().isoformat()
        }
        
        # Check if any sync failed
        failed_syncs = [name for name, result in results.items() 
                        if isinstance(result, dict) and not result.get("success", False)]
        
        results["overall_success"] = len(failed_syncs) == 0
        results["failed_syncs"] = failed_syncs
        
        return results


# Global instance
biotime_sync_service = BioTimeSyncService()
