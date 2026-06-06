"""
BioTime Enhanced API Endpoints

This module provides enhanced API endpoints for improved ZKTeco BioTime compatibility,
including device group management, advanced access control, enhanced reporting, and conflict resolution.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from ..core.database import get_db
from ..services.biotime_sync_service import biotime_sync_service
from ..services.biotime_client import biotime_client
from ..models.biotime_enhancements import (
    BioTimeBiometricTemplate, BioTimeDeviceGroup, BioTimeAccessSchedule,
    BioTimeSyncLogEntry, BioTimeDevice, BioTimeAccessLevel, BioTimeConflictResolution
)

router = APIRouter()


# Enhanced Device Management

@router.post("/devices/groups")
async def create_device_group(
    group_data: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create device group for batch operations"""
    try:
        device_group = BioTimeDeviceGroup(
            group_name=group_data["group_name"],
            group_type=group_data["group_type"],
            device_ids=group_data["device_ids"],
            configuration=group_data.get("configuration", {}),
            priority=group_data.get("priority", 0),
            description=group_data.get("description", ""),
            biotime_group_id=group_data.get("biotime_group_id"),
            biotime_sync_enabled=group_data.get("biotime_sync_enabled", True)
        )
        
        db.add(device_group)
        db.commit()
        
        return {
            "success": True,
            "device_group": {
                "id": device_group.id,
                "group_name": device_group.group_name,
                "group_type": device_group.group_type,
                "device_count": len(device_group.device_ids),
                "created_at": device_group.created_at.isoformat()
            },
            "message": "Device group created successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create device group: {str(e)}"
        )


@router.put("/devices/groups/{group_id}")
async def update_device_group(
    group_id: int,
    group_data: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update device group configuration"""
    try:
        device_group = db.query(BioTimeDeviceGroup).filter(BioTimeDeviceGroup.id == group_id).first()
        if not device_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device group not found"
            )
        
        # Update fields
        if "group_name" in group_data:
            device_group.group_name = group_data["group_name"]
        if "configuration" in group_data:
            device_group.configuration = group_data["configuration"]
        if "priority" in group_data:
            device_group.priority = group_data["priority"]
        if "device_ids" in group_data:
            device_group.device_ids = group_data["device_ids"]
        
        device_group.updated_at = datetime.utcnow()
        db.commit()
        
        return {
            "success": True,
            "device_group": {
                "id": device_group.id,
                "group_name": device_group.group_name,
                "updated_at": device_group.updated_at.isoformat()
            },
            "message": "Device group updated successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update device group: {str(e)}"
        )


@router.post("/devices/batch-operations")
async def batch_device_operations(
    operations: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Perform batch operations on multiple devices"""
    try:
        operation_type = operations["operation_type"]  # restart, shutdown, update_config, sync
        device_ids = operations["device_ids"]
        operation_data = operations.get("operation_data", {})
        
        results = []
        errors = []
        
        for device_id in device_ids:
            try:
                if operation_type == "restart":
                    result = await biotime_client.restart_device(device_id)
                elif operation_type == "update_config":
                    result = await biotime_client.configure_device(device_id, operation_data)
                elif operation_type == "sync":
                    result = await biotime_client.sync_device(device_id)
                else:
                    result = {"success": False, "error": f"Unsupported operation: {operation_type}"}
                
                results.append({
                    "device_id": device_id,
                    "success": result.get("success", False),
                    "message": result.get("message", ""),
                    "timestamp": datetime.utcnow().isoformat()
                })
                
                if not result.get("success", False):
                    errors.append({
                        "device_id": device_id,
                        "error": result.get("error", "Unknown error")
                    })
                    
            except Exception as e:
                errors.append({
                    "device_id": device_id,
                    "error": str(e)
                })
        
        return {
            "success": len(errors) == 0,
            "operation_type": operation_type,
            "total_devices": len(device_ids),
            "successful_operations": len(results),
            "failed_operations": len(errors),
            "results": results,
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to perform batch operations: {str(e)}"
        )


@router.post("/devices/{device_id}/firmware-update")
async def update_device_firmware(
    device_id: str,
    firmware_data: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update device firmware"""
    try:
        # Check if device exists
        device = db.query(BioTimeDevice).filter(BioTimeDevice.device_id == device_id).first()
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found"
            )
        
        # Update firmware information
        device.firmware_version = firmware_data.get("firmware_version")
        device.hardware_version = firmware_data.get("hardware_version")
        device.biotime_last_config_sync = datetime.utcnow()
        
        # Simulate firmware update process
        update_result = {
            "device_id": device_id,
            "current_firmware": device.firmware_version,
            "target_firmware": firmware_data.get("target_firmware"),
            "update_status": "in_progress",
            "estimated_time_minutes": firmware_data.get("estimated_time", 15),
            "requires_restart": firmware_data.get("requires_restart", True)
        }
        
        db.commit()
        
        return {
            "success": True,
            "firmware_update": update_result,
            "message": "Firmware update initiated successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update device firmware: {str(e)}"
        )


# Advanced Access Control

@router.post("/access/time-schedules")
async def create_time_schedule(
    schedule_data: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create time-based access schedules"""
    try:
        schedule = BioTimeAccessSchedule(
            schedule_name=schedule_data["schedule_name"],
            schedule_type=schedule_data["schedule_type"],
            start_date=datetime.fromisoformat(schedule_data["start_date"]),
            end_date=datetime.fromisoformat(schedule_data["end_date"]),
            personnel_ids=schedule_data["personnel_ids"],
            device_group_ids=schedule_data.get("device_group_ids", []),
            access_levels=schedule_data.get("access_levels", []),
            biotime_schedule_id=schedule_data.get("biotime_schedule_id"),
            # Set daily time ranges
            monday_enabled=schedule_data.get("monday_enabled", True),
            monday_start_time=schedule_data.get("monday_start_time", "08:00"),
            monday_end_time=schedule_data.get("monday_end_time", "17:00"),
            tuesday_enabled=schedule_data.get("tuesday_enabled", True),
            tuesday_start_time=schedule_data.get("tuesday_start_time", "08:00"),
            tuesday_end_time=schedule_data.get("tuesday_end_time", "17:00"),
            wednesday_enabled=schedule_data.get("wednesday_enabled", True),
            wednesday_start_time=schedule_data.get("wednesday_start_time", "08:00"),
            wednesday_end_time=schedule_data.get("wednesday_end_time", "17:00"),
            thursday_enabled=schedule_data.get("thursday_enabled", True),
            thursday_start_time=schedule_data.get("thursday_start_time", "08:00"),
            thursday_end_time=schedule_data.get("thursday_end_time", "17:00"),
            friday_enabled=schedule_data.get("friday_enabled", True),
            friday_start_time=schedule_data.get("friday_start_time", "08:00"),
            friday_end_time=schedule_data.get("friday_end_time", "17:00"),
            saturday_enabled=schedule_data.get("saturday_enabled", False),
            saturday_start_time=schedule_data.get("saturday_start_time", "09:00"),
            saturday_end_time=schedule_data.get("saturday_end_time", "13:00"),
            sunday_enabled=schedule_data.get("sunday_enabled", False),
            sunday_start_time=schedule_data.get("sunday_start_time", "09:00"),
            sunday_end_time=schedule_data.get("sunday_end_time", "13:00")
        )
        
        db.add(schedule)
        db.commit()
        
        return {
            "success": True,
            "schedule": {
                "id": schedule.id,
                "schedule_name": schedule.schedule_name,
                "schedule_type": schedule.schedule_type,
                "created_at": schedule.created_at.isoformat()
            },
            "message": "Time schedule created successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create time schedule: {str(e)}"
        )


@router.post("/access/anti-passback")
async def configure_anti_passback(
    config: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Configure anti-passback features"""
    try:
        # Update device groups with anti-passback configuration
        device_group_ids = config.get("device_group_ids", [])
        anti_passback_config = config.get("configuration", {})
        
        updated_groups = []
        for group_id in device_group_ids:
            device_group = db.query(BioTimeDeviceGroup).filter(BioTimeDeviceGroup.id == group_id).first()
            if device_group:
                # Update configuration with anti-passback settings
                current_config = device_group.configuration or {}
                current_config["anti_passback"] = anti_passback_config
                device_group.configuration = current_config
                device_group.updated_at = datetime.utcnow()
                
                db.commit()
                updated_groups.append({
                    "group_id": group_id,
                    "group_name": device_group.group_name,
                    "updated_at": device_group.updated_at.isoformat()
                })
        
        return {
            "success": True,
            "updated_groups": updated_groups,
            "anti_passback_config": anti_passback_config,
            "message": "Anti-passback configuration updated successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure anti-passback: {str(e)}"
        )


@router.post("/access/multi-factor")
async def configure_multi_factor(
    config: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Configure multi-factor authentication"""
    try:
        # Update access levels with multi-factor requirements
        access_level_ids = config.get("access_level_ids", [])
        mfa_config = config.get("configuration", {})
        
        updated_levels = []
        for level_id in access_level_ids:
            access_level = db.query(BioTimeAccessLevel).filter(BioTimeAccessLevel.id == level_id).first()
            if access_level:
                # Update configuration with multi-factor settings
                current_config = access_level.biotime_configuration or {}
                current_config["multi_factor"] = mfa_config
                access_level.multi_factor_required = mfa_config.get("required", False)
                access_level.biotime_configuration = current_config
                access_level.updated_at = datetime.utcnow()
                
                db.commit()
                updated_levels.append({
                    "level_id": level_id,
                    "level_name": access_level.level_name,
                    "updated_at": access_level.updated_at.isoformat()
                })
        
        return {
            "success": True,
            "updated_levels": updated_levels,
            "multi_factor_config": mfa_config,
            "message": "Multi-factor authentication configured successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure multi-factor: {str(e)}"
        )


# Enhanced Reporting

@router.get("/reports/shift-handover")
async def get_shift_handover_report(
    date: datetime = Query(..., description="Date for shift handover report"),
    shift_type: str = Query("morning", description="Shift type: morning, evening, night"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate shift handover reports"""
    try:
        # Get personnel on duty during shift
        shift_start = date
        shift_end = date + timedelta(hours=8)  # Assuming 8-hour shifts
        
        # Get attendance records for the shift
        attendance_records = db.query(BioTimeAccessSchedule).filter(
            BioTimeAccessSchedule.start_date <= shift_start,
            BioTimeAccessSchedule.end_date >= shift_end
        ).all()
        
        # Generate handover report
        handover_data = {
            "shift_info": {
                "date": date.isoformat(),
                "shift_type": shift_type,
                "start_time": shift_start.isoformat(),
                "end_time": shift_end.isoformat(),
                "duration_hours": 8
            },
            "personnel_on_duty": [
                {
                    "personnel_id": record.personnel_ids,
                    "access_level": record.access_levels,
                    "device_groups": record.device_group_ids
                }
                for record in attendance_records
            ],
            "incidents_during_shift": [],  # Would be populated from incident logs
            "equipment_status": [],  # Would be populated from device status
            "special_notes": [],  # Would be populated from shift notes
            "recommendations": []
        }
        
        return {
            "success": True,
            "handover_report": handover_data,
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate shift handover report: {str(e)}"
        )


@router.get("/reports/incident-analysis")
async def get_incident_analysis(
    days: int = Query(30, ge=1, le=90, description="Number of days for analysis"),
    incident_type: Optional[str] = Query(None, description="Filter by incident type"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate incident analysis reports"""
    try:
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Simulate incident data
        incidents = [
            {
                "id": f"incident_{i}",
                "timestamp": (datetime.utcnow() - timedelta(hours=i*6)).isoformat(),
                "incident_type": "ACCESS_VIOLATION" if i % 3 == 0 else "DEVICE_FAILURE" if i % 3 == 1 else "BIOMETRIC_ERROR",
                "severity": "HIGH" if i % 4 == 0 else "MEDIUM" if i % 4 == 1 else "LOW",
                "device_id": f"device_{i % 5}",
                "personnel_involved": [f"personnel_{i % 10}"],
                "description": f"Simulated incident {i}",
                "resolution_time_minutes": 30 + (i * 10),
                "preventive_measures": [
                    "Regular device maintenance",
                    "Enhanced access control",
                    "Biometric quality monitoring"
                ][i % 3]
            }
            for i in range(20)
        ]
        
        # Apply filters
        if incident_type:
            incidents = [i for i in incidents if i["incident_type"] == incident_type]
        
        # Calculate analytics
        total_incidents = len(incidents)
        high_severity = len([i for i in incidents if i["severity"] == "HIGH"])
        medium_severity = len([i for i in incidents if i["severity"] == "MEDIUM"])
        low_severity = len([i for i in incidents if i["severity"] == "LOW"])
        
        avg_resolution_time = sum(i["resolution_time_minutes"] for i in incidents) / len(incidents) if incidents else 0
        
        return {
            "success": True,
            "analysis_period": {
                "days": days,
                "start_date": cutoff_date.isoformat(),
                "end_date": datetime.utcnow().isoformat()
            },
            "incident_summary": {
                "total_incidents": total_incidents,
                "severity_distribution": {
                    "HIGH": high_severity,
                    "MEDIUM": medium_severity,
                    "LOW": low_severity
                },
                "avg_resolution_time_minutes": round(avg_resolution_time, 2),
                "incident_types": list(set(i["incident_type"] for i in incidents))
            },
            "incidents": incidents,
            "recommendations": [
                "Increase device maintenance frequency",
                "Implement enhanced access control",
                "Provide additional biometric training"
            ],
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate incident analysis: {str(e)}"
        )


@router.get("/reports/data-export")
async def export_biotime_data(
    format: str = Query("json", description="Export format: json, csv, excel"),
    data_type: str = Query("personnel", description="Data type: personnel, attendance, devices"),
    date_from: datetime = Query(..., description="Start date for export"),
    date_to: datetime = Query(..., description="End date for export"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Export data in BioTime format"""
    try:
        # Get data based on type
        if data_type == "personnel":
            # Get personnel data for export
            data = {
                "export_type": "personnel",
                "format": format,
                "period": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat()
                },
                "data": []  # Would be populated from database
            }
        elif data_type == "attendance":
            data = {
                "export_type": "attendance",
                "format": format,
                "period": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat()
                },
                "data": []  # Would be populated from database
            }
        elif data_type == "devices":
            data = {
                "export_type": "devices",
                "format": format,
                "period": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat()
                },
                "data": []  # Would be populated from database
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid data type: {data_type}"
            )
        
        return {
            "success": True,
            "export_request": data,
            "export_id": f"export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "message": f"Data export request created for {format} format"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export data: {str(e)}"
        )


# Synchronization Enhancement

@router.get("/sync/conflicts")
async def get_sync_conflicts(
    days: int = Query(7, ge=1, le=30, description="Number of days for conflict analysis"),
    status: Optional[str] = Query(None, description="Filter by conflict status"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get synchronization conflicts"""
    try:
        from datetime import timedelta
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Get conflict records
        conflicts = db.query(BioTimeConflictResolution).filter(
            BioTimeConflictResolution.created_at >= cutoff_date
        ).all()
        
        # Apply status filter
        if status:
            conflicts = [c for c in conflicts if c.status == status]
        
        # Calculate conflict statistics
        total_conflicts = len(conflicts)
        conflict_types = {}
        for conflict in conflicts:
            conflict_type = conflict.conflict_type
            conflict_types[conflict_type] = conflict_types.get(conflict_type, 0) + 1
        
        return {
            "success": True,
            "analysis_period": {
                "days": days,
                "start_date": cutoff_date.isoformat(),
                "end_date": datetime.utcnow().isoformat()
            },
            "conflict_summary": {
                "total_conflicts": total_conflicts,
                "conflict_types": conflict_types,
                "resolved_conflicts": len([c for c in conflicts if c.status == "resolved"]),
                "pending_conflicts": len([c for c in conflicts if c.status == "pending"]),
                "high_impact_conflicts": len([c for c in conflicts if c.impact_level == "high"])
            },
            "conflicts": [
                {
                    "id": conflict.id,
                    "conflict_id": conflict.conflict_id,
                    "conflict_type": conflict.conflict_type,
                    "description": conflict.conflict_description,
                    "detected_at": conflict.detected_at.isoformat(),
                    "status": conflict.status,
                    "impact_level": conflict.impact_level,
                    "resolution_strategy": conflict.resolution_strategy
                }
                for conflict in conflicts
            ],
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sync conflicts: {str(e)}"
        )


@router.post("/sync/resolve-conflict")
async def resolve_sync_conflict(
    conflict_id: str,
    resolution_data: Dict[str, Any],
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Resolve synchronization conflict"""
    try:
        conflict = db.query(BioTimeConflictResolution).filter(
            BioTimeConflictResolution.conflict_id == conflict_id
        ).first()
        
        if not conflict:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conflict not found"
            )
        
        # Update conflict resolution
        conflict.resolution_strategy = resolution_data.get("resolution_strategy")
        conflict.resolution_details = resolution_data.get("resolution_details", {})
        conflict.resolved_at = datetime.utcnow()
        conflict.status = "resolved"
        conflict.impact_level = resolution_data.get("impact_level", "medium")
        conflict.prevention_measures = resolution_data.get("prevention_measures", [])
        
        db.commit()
        
        return {
            "success": True,
            "conflict": {
                "id": conflict.id,
                "conflict_id": conflict.conflict_id,
                "resolved_at": conflict.resolved_at.isoformat(),
                "resolution_strategy": conflict.resolution_strategy
            },
            "message": "Conflict resolved successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve conflict: {str(e)}"
        )
