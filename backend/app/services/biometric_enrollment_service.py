"""
Biometric Enrollment Service
Handles biometric template enrollment, verification, and device communication.
All enrollment paths use real ZKTeco hardware (ZKLib TCP or ADMS); no mock data.
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import Optional, Dict, Any
from datetime import datetime
import uuid
import logging
import base64

from ..core.database import get_db
from ..models.personnel import Personnel
from ..models.biometric_templates import (
    BiometricTemplate, BiometricEnrollmentSession, BiometricVerificationLog,
)
from ..schemas.biometric_enrollment import (
    BiometricEnrollmentRequest, FingerprintEnrollmentRequest, FaceEnrollmentRequest,
    PalmEnrollmentRequest, BiometricVerificationRequest,
)

logger = logging.getLogger(__name__)


# ── Device resolution helper ────────────────────────────────────────────────────
def _resolve_device_ip(device_serial: Optional[str], db: Session):
    """Return (ip, port) for a device serial number, or raise ValueError."""
    if not device_serial:
        raise ValueError("device_serial is required for hardware enrollment")

    # Try IClockTerminal first (ZKTeco ADMS push devices)
    try:
        from ..models.biotime_models import IClockTerminal
        term = db.query(IClockTerminal).filter(IClockTerminal.sn == device_serial).first()
        if term and term.ip_address:
            return term.ip_address, 4370
    except Exception:
        pass

    # Fall back to the Device table (direct-connect devices)
    try:
        from ..models.device import Device
        dev = db.query(Device).filter(Device.serial_number == device_serial).first()
        if dev and dev.ip_address:
            return dev.ip_address, (dev.port or 4370)
    except Exception:
        pass

    raise ValueError(f"Device '{device_serial}' not found or has no IP address configured")


# ── Session helper ──────────────────────────────────────────────────────────────
def _finish_session(session_obj, status: str, db: Session, template_id: Optional[int] = None):
    if session_obj:
        session_obj.status = status
        session_obj.progress_percentage = 100.0 if status == "COMPLETED" else session_obj.progress_percentage
        session_obj.templates_collected = 1 if status == "COMPLETED" else 0
        session_obj.completed_at = datetime.utcnow()
        db.commit()


# ── Service ─────────────────────────────────────────────────────────────────────
class BiometricEnrollmentService:

    def __init__(self):
        self.active_sessions: dict = {}

    # ── Session management ────────────────────────────────────────────────────
    async def start_enrollment_session(
        self, request: BiometricEnrollmentRequest, db: Session
    ) -> Dict[str, Any]:
        try:
            personnel = db.query(Personnel).filter(Personnel.id == request.personnel_id).first()
            if not personnel:
                return {"success": False, "error": "Personnel not found"}

            session_id = str(uuid.uuid4())
            session = BiometricEnrollmentSession(
                session_id=session_id,
                personnel_id=request.personnel_id,
                template_type=request.template_type.value,
                device_serial=request.device_serial,
                quality_threshold=request.quality_threshold,
                status="INITIATED",
            )
            db.add(session)
            db.commit()
            db.refresh(session)

            self.active_sessions[session_id] = {
                "personnel_id": request.personnel_id,
                "template_type": request.template_type.value,
                "started_at": datetime.utcnow(),
            }

            return {"success": True, "session_id": session_id, "status": "INITIATED",
                    "message": "Enrollment session started"}
        except Exception as e:
            logger.error(f"start_enrollment_session error: {e}")
            return {"success": False, "error": str(e)}

    # ── Fingerprint enrollment (real ZKLib TCP) ───────────────────────────────
    async def enroll_fingerprint(
        self, request: FingerprintEnrollmentRequest, db: Session
    ) -> Dict[str, Any]:
        session_obj = None
        try:
            # 1. Create session record
            session_result = await self.start_enrollment_session(
                BiometricEnrollmentRequest(
                    personnel_id=request.personnel_id,
                    template_type="FINGERPRINT",
                    device_serial=request.device_serial,
                    quality_threshold=request.quality_threshold,
                    notes=request.notes,
                ), db
            )
            if not session_result["success"]:
                return session_result
            session_id = session_result["session_id"]
            session_obj = db.query(BiometricEnrollmentSession).filter(
                BiometricEnrollmentSession.session_id == session_id
            ).first()

            # 2. Resolve device
            device_ip, device_port = _resolve_device_ip(request.device_serial, db)

            # 3. Look up personnel to get their ZK user_id
            personnel = db.query(Personnel).filter(Personnel.id == request.personnel_id).first()
            if not personnel:
                _finish_session(session_obj, "FAILED", db)
                return {"success": False, "error": "Personnel not found"}

            emp_code = personnel.emp_code or personnel.badge_id
            zk_uid = personnel.id  # Use DB id as the numeric ZK uid

            # 4. Mark session in-progress
            if session_obj:
                session_obj.status = "IN_PROGRESS"
                db.commit()

            # 5. Run real ZKLib enrollment (blocks until user presses finger 3× or timeout)
            from .zkteco.direct_connection import zkteco_direct
            enroll_result = await zkteco_direct.enroll_and_capture(
                ip=device_ip,
                port=device_port,
                uid=zk_uid,
                user_id=emp_code,
                finger_id=request.finger_index,
                timeout=90,
            )

            if not enroll_result.get("success"):
                _finish_session(session_obj, "FAILED", db)
                return {"success": False, "error": enroll_result.get("error", "Enrollment failed on device")}

            # 6. Store the real template
            template_b64 = enroll_result.get("template_b64", "")
            template_size = enroll_result.get("template_size", 0)
            quality = float(min(100, max(0, (template_size / 5) if template_size else 0)))

            template = BiometricTemplate(
                personnel_id=request.personnel_id,
                template_type="FINGERPRINT",
                template_data=template_b64,
                template_quality=quality,
                finger_index=request.finger_index,
                hand=request.hand.value,
                device_serial=request.device_serial,
                enrollment_method="ENROLLMENT",
                is_verified=True,
                notes=request.notes,
            )
            db.add(template)

            # 7. Update personnel biometric flag
            personnel.biometric_enrolled = True
            personnel.biometric_quality_score = quality

            _finish_session(session_obj, "COMPLETED", db)
            db.commit()
            db.refresh(template)

            self.active_sessions.pop(session_id, None)
            logger.info(f"Fingerprint enrolled for personnel {request.personnel_id} via device {device_ip}")

            return {
                "success": True,
                "session_id": session_id,
                "template_id": template.id,
                "status": "COMPLETED",
                "template_quality": quality,
                "message": "Fingerprint enrolled from device successfully",
            }

        except ValueError as e:
            if session_obj:
                _finish_session(session_obj, "FAILED", db)
            return {"success": False, "error": str(e)}
        except Exception as e:
            if session_obj:
                _finish_session(session_obj, "FAILED", db)
            logger.error(f"enroll_fingerprint error: {e}")
            return {"success": False, "error": str(e)}

    # ── Face enrollment (ADMS API) ────────────────────────────────────────────
    async def enroll_face(
        self, request: FaceEnrollmentRequest, db: Session
    ) -> Dict[str, Any]:
        session_obj = None
        try:
            session_result = await self.start_enrollment_session(
                BiometricEnrollmentRequest(
                    personnel_id=request.personnel_id,
                    template_type="FACE",
                    device_serial=request.device_serial,
                    quality_threshold=request.quality_threshold,
                    notes=request.notes,
                ), db
            )
            if not session_result["success"]:
                return session_result
            session_id = session_result["session_id"]
            session_obj = db.query(BiometricEnrollmentSession).filter(
                BiometricEnrollmentSession.session_id == session_id
            ).first()

            personnel = db.query(Personnel).filter(Personnel.id == request.personnel_id).first()
            if not personnel:
                _finish_session(session_obj, "FAILED", db)
                return {"success": False, "error": "Personnel not found"}

            if session_obj:
                session_obj.status = "IN_PROGRESS"
                db.commit()

            # Face enrollment requires ADMS (pyzk does not support face capture)
            from .zkteco.biometric_service import zkteco_biometric_service
            capture_result = await zkteco_biometric_service._capture_from_device(
                device_identifier=request.device_serial or "",
                badge_id=personnel.emp_code or personnel.badge_id,
                biometric_type="face",
            )

            if not capture_result.get("success"):
                _finish_session(session_obj, "FAILED", db)
                return {
                    "success": False,
                    "error": capture_result.get("error", "Face capture failed"),
                    "hint": "Face enrollment requires ZKTeco ADMS credentials (ZKTECO_COMPANY_ID, ZKTECO_ADMS_TOKEN)",
                }

            face_template = capture_result.get("face_template", "")
            quality = float(capture_result.get("quality", 0))

            template = BiometricTemplate(
                personnel_id=request.personnel_id,
                template_type="FACE",
                template_data=face_template,
                template_quality=quality,
                device_serial=request.device_serial,
                enrollment_method="ENROLLMENT",
                is_verified=True,
                notes=request.notes,
            )
            db.add(template)

            personnel.face_enrolled = True
            personnel.biometric_quality_score = max(personnel.biometric_quality_score or 0, quality)

            _finish_session(session_obj, "COMPLETED", db)
            db.commit()
            db.refresh(template)

            self.active_sessions.pop(session_id, None)
            logger.info(f"Face enrolled for personnel {request.personnel_id}")

            return {
                "success": True,
                "session_id": session_id,
                "template_id": template.id,
                "status": "COMPLETED",
                "template_quality": quality,
                "message": "Face template captured from device successfully",
            }

        except Exception as e:
            if session_obj:
                _finish_session(session_obj, "FAILED", db)
            logger.error(f"enroll_face error: {e}")
            return {"success": False, "error": str(e)}

    # ── Palm enrollment (ADMS API) ────────────────────────────────────────────
    async def enroll_palm(
        self, request: PalmEnrollmentRequest, db: Session
    ) -> Dict[str, Any]:
        """Palm vein enrollment via ZKTeco ADMS API. Requires ADMS credentials."""
        session_obj = None
        try:
            session_result = await self.start_enrollment_session(
                BiometricEnrollmentRequest(
                    personnel_id=request.personnel_id,
                    template_type="PALM",
                    device_serial=request.device_serial,
                    quality_threshold=request.quality_threshold,
                    notes=request.notes,
                ), db
            )
            if not session_result["success"]:
                return session_result
            session_id = session_result["session_id"]
            session_obj = db.query(BiometricEnrollmentSession).filter(
                BiometricEnrollmentSession.session_id == session_id
            ).first()

            personnel = db.query(Personnel).filter(Personnel.id == request.personnel_id).first()
            if not personnel:
                _finish_session(session_obj, "FAILED", db)
                return {"success": False, "error": "Personnel not found"}

            if session_obj:
                session_obj.status = "IN_PROGRESS"
                db.commit()

            from .zkteco.biometric_service import zkteco_biometric_service
            capture_result = await zkteco_biometric_service._capture_from_device(
                device_identifier=request.device_serial or "",
                badge_id=personnel.emp_code or personnel.badge_id,
                biometric_type="palm",
            )

            if not capture_result.get("success"):
                _finish_session(session_obj, "FAILED", db)
                return {
                    "success": False,
                    "error": capture_result.get("error", "Palm capture failed"),
                    "hint": "Palm enrollment requires ZKTeco ADMS credentials and a palm-capable device",
                }

            palm_template = capture_result.get("palm_template", "")
            quality = float(capture_result.get("quality", 0))

            template = BiometricTemplate(
                personnel_id=request.personnel_id,
                template_type="PALM",
                template_data=palm_template,
                template_quality=quality,
                hand=request.hand.value,
                device_serial=request.device_serial,
                enrollment_method="ENROLLMENT",
                is_verified=True,
                notes=request.notes,
            )
            db.add(template)

            _finish_session(session_obj, "COMPLETED", db)
            db.commit()
            db.refresh(template)

            self.active_sessions.pop(session_id, None)
            return {
                "success": True,
                "session_id": session_id,
                "template_id": template.id,
                "status": "COMPLETED",
                "template_quality": quality,
                "message": "Palm template captured from device successfully",
            }

        except Exception as e:
            if session_obj:
                _finish_session(session_obj, "FAILED", db)
            logger.error(f"enroll_palm error: {e}")
            return {"success": False, "error": str(e)}

    # ── Progress polling ──────────────────────────────────────────────────────
    async def get_enrollment_progress(self, session_id: str, db: Session) -> Dict[str, Any]:
        try:
            session = db.query(BiometricEnrollmentSession).filter(
                BiometricEnrollmentSession.session_id == session_id
            ).first()
            if not session:
                return {"success": False, "error": "Session not found"}

            # Compute elapsed and estimated remaining from real timestamps
            elapsed = (datetime.utcnow() - session.started_at).total_seconds() if session.started_at else 0
            estimated_remaining = max(0, int(90 - elapsed)) if session.status == "IN_PROGRESS" else 0

            # Get latest quality from actual template if completed
            quality_score = None
            if session.status == "COMPLETED":
                latest_tpl = (
                    db.query(BiometricTemplate)
                    .filter(
                        BiometricTemplate.personnel_id == session.personnel_id,
                        BiometricTemplate.template_type == session.template_type,
                        BiometricTemplate.is_active == True,
                    )
                    .order_by(BiometricTemplate.enrolled_at.desc())
                    .first()
                )
                if latest_tpl:
                    quality_score = latest_tpl.template_quality

            return {
                "success": True,
                "session_id": session_id,
                "status": session.status,
                "progress_percentage": session.progress_percentage,
                "current_step": session.current_step,
                "templates_collected": session.templates_collected,
                "templates_required": session.templates_required,
                "quality_score": quality_score,
                "estimated_time_remaining": estimated_remaining,
                "next_action": "Continue enrollment" if session.status == "IN_PROGRESS" else None,
            }

        except Exception as e:
            logger.error(f"get_enrollment_progress error: {e}")
            return {"success": False, "error": str(e)}

    # ── Biometric verification ─────────────────────────────────────────────────
    async def verify_biometric(
        self, request: BiometricVerificationRequest, db: Session
    ) -> Dict[str, Any]:
        """
        Verify biometric identity.
        - If ADMS is configured: delegates to the ADMS verify endpoint (real hardware comparison).
        - Otherwise: confirms enrollment status but does NOT auto-grant access.
        """
        start_time = datetime.utcnow()

        try:
            # 1. Find enrolled templates
            query = db.query(BiometricTemplate).filter(
                BiometricTemplate.template_type == request.template_type.value,
                BiometricTemplate.is_active == True,
            )
            if request.personnel_id:
                query = query.filter(BiometricTemplate.personnel_id == request.personnel_id)
            templates = query.all()

            if not templates:
                return {"success": False, "error": "No enrolled biometric templates found for this personnel"}

            personnel = None
            if request.personnel_id:
                personnel = db.query(Personnel).filter(Personnel.id == request.personnel_id).first()

            # 2. Try ADMS verification (real hardware matching)
            is_successful = False
            confidence_score = 0.0
            verification_method_used = "ENROLLMENT_CHECK"

            if personnel:
                from .zkteco.biometric_service import zkteco_biometric_service
                stored = {t.template_type: t.template_data for t in templates}
                adms_result = await zkteco_biometric_service._verify_on_device(
                    device_ip=request.device_serial or "any",
                    badge_id=personnel.emp_code or personnel.badge_id or str(personnel.id),
                    biometric_data={},
                    stored_templates=stored,
                    biometric_type=request.template_type.value.lower(),
                )
                if "error" not in adms_result:
                    # Got a real ADMS response
                    is_successful = adms_result.get("verified", False)
                    confidence_score = adms_result.get("confidence", 0.0)
                    verification_method_used = "ADMS"
                else:
                    # ADMS not configured or failed — do NOT auto-grant
                    response_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
                    return {
                        "success": False,
                        "is_successful": False,
                        "confidence_score": 0.0,
                        "response_time_ms": response_time,
                        "enrolled": True,
                        "template_count": len(templates),
                        "error": (
                            adms_result.get("error") or
                            "ADMS verification not configured. Physical device verification required."
                        ),
                    }

            response_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            # 3. Log the verification attempt
            verification_log = BiometricVerificationLog(
                personnel_id=request.personnel_id,
                template_type=request.template_type.value,
                device_serial=request.device_serial,
                is_successful=is_successful,
                confidence_score=confidence_score,
                response_time_ms=response_time,
                verification_method=request.verification_method,
                location=request.location,
                purpose=request.purpose,
                verified_at=datetime.utcnow(),
            )
            db.add(verification_log)

            # 4. Update template usage on success
            if is_successful and templates:
                tpl = templates[0]
                tpl.verification_count = (tpl.verification_count or 0) + 1
                tpl.last_used = datetime.utcnow()

            db.commit()

            return {
                "success": True,
                "verification_id": verification_log.id,
                "personnel_id": request.personnel_id,
                "is_successful": is_successful,
                "confidence_score": confidence_score,
                "response_time_ms": response_time,
                "verification_method": verification_method_used,
                "verified_at": verification_log.verified_at.isoformat(),
            }

        except Exception as e:
            logger.error(f"verify_biometric error: {e}")
            return {"success": False, "error": str(e)}

    # ── Statistics (from real DB data) ────────────────────────────────────────
    async def get_enrollment_statistics(self, db: Session) -> Dict[str, Any]:
        try:
            total_personnel = db.query(Personnel).count()
            enrolled_count = db.query(
                func.count(func.distinct(BiometricTemplate.personnel_id))
            ).filter(BiometricTemplate.is_active == True).scalar() or 0

            fp_count = db.query(BiometricTemplate).filter(
                BiometricTemplate.template_type == "FINGERPRINT",
                BiometricTemplate.is_active == True,
            ).count()
            face_count = db.query(BiometricTemplate).filter(
                BiometricTemplate.template_type == "FACE",
                BiometricTemplate.is_active == True,
            ).count()
            palm_count = db.query(BiometricTemplate).filter(
                BiometricTemplate.template_type == "PALM",
                BiometricTemplate.is_active == True,
            ).count()

            today = datetime.utcnow().date()
            active_sessions = db.query(BiometricEnrollmentSession).filter(
                BiometricEnrollmentSession.status.in_(["INITIATED", "IN_PROGRESS"])
            ).count()
            completed_today = db.query(BiometricEnrollmentSession).filter(
                BiometricEnrollmentSession.status == "COMPLETED",
                func.date(BiometricEnrollmentSession.completed_at) == today,
            ).count()
            failed_today = db.query(BiometricEnrollmentSession).filter(
                BiometricEnrollmentSession.status == "FAILED",
                func.date(BiometricEnrollmentSession.completed_at) == today,
            ).count()

            # Real average enrollment time from completed sessions
            completed_sessions = db.query(BiometricEnrollmentSession).filter(
                BiometricEnrollmentSession.status == "COMPLETED",
                BiometricEnrollmentSession.started_at != None,
                BiometricEnrollmentSession.completed_at != None,
            ).all()
            if completed_sessions:
                durations = [
                    (s.completed_at - s.started_at).total_seconds()
                    for s in completed_sessions
                    if s.completed_at and s.started_at
                ]
                avg_time = round(sum(durations) / len(durations), 1) if durations else 0.0
            else:
                avg_time = 0.0

            # Real quality distribution from BiometricTemplate table
            all_templates = db.query(BiometricTemplate.template_quality).filter(
                BiometricTemplate.is_active == True,
                BiometricTemplate.template_quality != None,
            ).all()
            quality_dist = {"excellent": 0, "good": 0, "acceptable": 0, "poor": 0}
            for (q,) in all_templates:
                if q is not None:
                    if q >= 90:
                        quality_dist["excellent"] += 1
                    elif q >= 75:
                        quality_dist["good"] += 1
                    elif q >= 60:
                        quality_dist["acceptable"] += 1
                    else:
                        quality_dist["poor"] += 1

            return {
                "success": True,
                "data": {
                    "total_personnel": total_personnel,
                    "enrolled_personnel": enrolled_count,
                    "fingerprint_templates": fp_count,
                    "face_templates": face_count,
                    "palm_templates": palm_count,
                    "active_sessions": active_sessions,
                    "completed_sessions_today": completed_today,
                    "failed_sessions_today": failed_today,
                    "average_enrollment_time": avg_time,
                    "quality_distribution": quality_dist,
                },
            }

        except Exception as e:
            logger.error(f"get_enrollment_statistics error: {e}")
            return {"success": False, "error": str(e)}

    # ── Read-only helpers (already real; kept as-is) ─────────────────────────
    async def get_personnel_templates(
        self, personnel_id: int, db: Session, template_type: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            query = db.query(BiometricTemplate).filter(
                BiometricTemplate.personnel_id == personnel_id
            )
            if template_type:
                query = query.filter(BiometricTemplate.template_type == template_type)
            templates = query.all()

            return {
                "success": True,
                "data": [
                    {
                        "id": t.id,
                        "template_type": t.template_type,
                        "template_quality": t.template_quality,
                        "finger_index": t.finger_index,
                        "hand": t.hand,
                        "device_serial": t.device_serial,
                        "is_active": t.is_active,
                        "is_verified": t.is_verified,
                        "verification_count": t.verification_count,
                        "enrolled_at": t.enrolled_at.isoformat() if t.enrolled_at else None,
                        "last_used": t.last_used.isoformat() if t.last_used else None,
                        "notes": t.notes,
                    }
                    for t in templates
                ],
            }
        except Exception as e:
            logger.error(f"get_personnel_templates error: {e}")
            return {"success": False, "error": str(e)}

    async def delete_template(self, template_id: int, db: Session) -> Dict[str, Any]:
        try:
            template = db.query(BiometricTemplate).filter(BiometricTemplate.id == template_id).first()
            if not template:
                return {"success": False, "error": "Template not found"}
            template.is_active = False
            db.commit()
            return {"success": True, "message": "Template deactivated successfully"}
        except Exception as e:
            logger.error(f"delete_template error: {e}")
            return {"success": False, "error": str(e)}


biometric_enrollment_service = BiometricEnrollmentService()
