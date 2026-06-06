"""
BioTime Real-time Biometric Verification Service

This service provides advanced real-time biometric verification capabilities
including multi-modal authentication, confidence scoring, and live monitoring.
"""

import logging
import asyncio
import json
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class BiometricType(Enum):
    FINGERPRINT = "fingerprint"
    FACE = "face"
    CARD = "card"
    PIN = "pin"
    MULTIMODAL = "multimodal"


class VerificationResult(Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    TIMEOUT = "timeout"
    ERROR = "error"


@dataclass
class BiometricMatch:
    """Represents a biometric match result"""
    biometric_type: str
    confidence: float
    match_score: float
    template_id: str
    verification_time: float
    timestamp: datetime


@dataclass
class VerificationSession:
    """Represents a biometric verification session"""
    session_id: str
    personnel_id: int
    biometric_types: List[str]
    start_time: datetime
    end_time: Optional[datetime]
    matches: List[BiometricMatch]
    final_result: Optional[str]
    metadata: Dict[str, Any]


class BioTimeRealtimeService:
    """Advanced real-time biometric verification service"""
    
    def __init__(self):
        self.active_sessions: Dict[str, VerificationSession] = {}
        self.verification_history: List[Dict[str, Any]] = []
        self.performance_metrics = {
            "total_verifications": 0,
            "successful_verifications": 0,
            "avg_verification_time": 0.0,
            "avg_confidence": 0.0
        }
        
    async def start_verification_session(
        self, 
        personnel_id: int,
        biometric_types: List[str],
        session_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Start a new biometric verification session
        
        Args:
            personnel_id: Personnel ID to verify
            biometric_types: List of biometric types to use
            session_metadata: Additional session metadata
            
        Returns:
            Session information
        """
        try:
            session_id = f"session_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{personnel_id}"
            
            session = VerificationSession(
                session_id=session_id,
                personnel_id=personnel_id,
                biometric_types=biometric_types,
                start_time=datetime.utcnow(),
                end_time=None,
                matches=[],
                final_result=None,
                metadata=session_metadata or {}
            )
            
            self.active_sessions[session_id] = session
            
            logger.info(f"Started verification session {session_id} for personnel {personnel_id}")
            
            return {
                "success": True,
                "session_id": session_id,
                "personnel_id": personnel_id,
                "biometric_types": biometric_types,
                "start_time": session.start_time.isoformat(),
                "status": "active"
            }
        except Exception as e:
            logger.error(f"Failed to start verification session: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status": "error"
            }
    
    async def verify_biometric_data(
        self, 
        session_id: str,
        biometric_data: Dict[str, Any],
        biometric_type: str,
        confidence_threshold: float = 0.8
    ) -> Dict[str, Any]:
        """
        Verify biometric data within a session
        
        Args:
            session_id: Session ID
            biometric_data: Biometric data to verify
            biometric_type: Type of biometric data
            confidence_threshold: Minimum confidence threshold
            
        Returns:
            Verification result
        """
        try:
            if session_id not in self.active_sessions:
                return {
                    "success": False,
                    "error": "Session not found",
                    "status": "error"
                }
            
            session = self.active_sessions[session_id]
            start_time = datetime.utcnow()
            
            # Simulate biometric verification (in real implementation, this would call BioTime API)
            match_result = await self._perform_biometric_verification(
                biometric_data, 
                biometric_type, 
                session.personnel_id
            )
            
            # Add match to session
            match = BiometricMatch(
                biometric_type=biometric_type,
                confidence=match_result["confidence"],
                match_score=match_result["score"],
                template_id=match_result["template_id"],
                verification_time=match_result["verification_time"],
                timestamp=start_time
            )
            
            session.matches.append(match)
            
            # Update session status
            if match_result["confidence"] >= confidence_threshold:
                session.final_result = VerificationResult.SUCCESS.value
            else:
                session.final_result = VerificationResult.FAILED.value
            
            # Update performance metrics
            self._update_performance_metrics(match_result)
            
            logger.info(f"Biometric verification completed for session {session_id}: {session.final_result}")
            
            return {
                "success": True,
                "session_id": session_id,
                "biometric_type": biometric_type,
                "result": session.final_result,
                "confidence": match_result["confidence"],
                "match_score": match_result["score"],
                "template_id": match_result["template_id"],
                "verification_time": match_result["verification_time"],
                "timestamp": start_time.isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to verify biometric data: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status": "error"
            }
    
    async def complete_verification_session(
        self, 
        session_id: str,
        final_result: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete a verification session with final result
        
        Args:
            session_id: Session ID
            final_result: Final verification result (optional)
            
        Returns:
            Session completion result
        """
        try:
            if session_id not in self.active_sessions:
                return {
                    "success": False,
                    "error": "Session not found",
                    "status": "error"
                }
            
            session = self.active_sessions[session_id]
            session.end_time = datetime.utcnow()
            
            if final_result:
                session.final_result = final_result
            elif not session.final_result:
                # Determine final result from matches
                if session.matches:
                    avg_confidence = sum(m.confidence for m in session.matches) / len(session.matches)
                    session.final_result = (
                        VerificationResult.SUCCESS.value if avg_confidence >= 0.8
                        else VerificationResult.FAILED.value
                    )
                else:
                    session.final_result = VerificationResult.FAILED.value
            
            session_duration = (session.end_time - session.start_time).total_seconds()
            
            # Store session in history
            history_entry = {
                "session_id": session_id,
                "personnel_id": session.personnel_id,
                "biometric_types": session.biometric_types,
                "start_time": session.start_time.isoformat(),
                "end_time": session.end_time.isoformat(),
                "duration_seconds": session_duration,
                "final_result": session.final_result,
                "match_count": len(session.matches),
                "matches": [
                    {
                        "biometric_type": m.biometric_type,
                        "confidence": m.confidence,
                        "match_score": m.match_score,
                        "template_id": m.template_id,
                        "verification_time": m.verification_time,
                        "timestamp": m.timestamp.isoformat()
                    }
                    for m in session.matches
                ],
                "metadata": session.metadata
            }
            
            self.verification_history.append(history_entry)
            
            # Remove from active sessions
            del self.active_sessions[session_id]
            
            logger.info(f"Completed verification session {session_id}: {session.final_result}")
            
            return {
                "success": True,
                "session_id": session_id,
                "final_result": session.final_result,
                "duration_seconds": session_duration,
                "match_count": len(session.matches),
                "completed_at": session.end_time.isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to complete verification session: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "status": "error"
            }
    
    async def get_active_sessions(self) -> Dict[str, Any]:
        """
        Get all active verification sessions
        
        Returns:
            Active sessions information
        """
        try:
            active_sessions_data = {}
            for session_id, session in self.active_sessions.items():
                active_sessions_data[session_id] = {
                    "personnel_id": session.personnel_id,
                    "biometric_types": session.biometric_types,
                    "start_time": session.start_time.isoformat(),
                    "duration_seconds": (datetime.utcnow() - session.start_time).total_seconds(),
                    "match_count": len(session.matches),
                    "final_result": session.final_result,
                    "metadata": session.metadata
                }
            
            return {
                "success": True,
                "active_sessions": active_sessions_data,
                "total_active": len(self.active_sessions),
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get active sessions: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_verification_history(
        self, 
        personnel_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get verification history
        
        Args:
            personnel_id: Filter by personnel ID
            limit: Maximum records to return
            offset: Number of records to skip
            
        Returns:
            Verification history
        """
        try:
            filtered_history = self.verification_history
            
            if personnel_id:
                filtered_history = [
                    h for h in filtered_history 
                    if h.get("personnel_id") == personnel_id
                ]
            
            # Apply pagination
            total_count = len(filtered_history)
            paginated_history = filtered_history[offset:offset + limit]
            
            return {
                "success": True,
                "history": paginated_history,
                "pagination": {
                    "total": total_count,
                    "limit": limit,
                    "offset": offset,
                    "has_more": offset + limit < total_count
                },
                "filters": {
                    "personnel_id": personnel_id
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get verification history: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_performance_metrics(self) -> Dict[str, Any]:
        """
        Get verification performance metrics
        
        Returns:
            Performance metrics
        """
        try:
            return {
                "success": True,
                "metrics": self.performance_metrics,
                "active_sessions": len(self.active_sessions),
                "recent_performance": self.verification_history[-10:] if self.verification_history else [],
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get performance metrics: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _perform_biometric_verification(
        self, 
        biometric_data: Dict[str, Any], 
        biometric_type: str, 
        personnel_id: int
    ) -> Dict[str, Any]:
        """
        Perform actual biometric verification (simulated for demo)
        
        In production, this would call BioTime API for verification
        """
        try:
            # Simulate verification process
            await asyncio.sleep(0.1)  # Simulate processing time
            
            # Simulate confidence calculation based on data quality
            base_confidence = 0.7
            if biometric_type == BiometricType.FINGERPRINT.value:
                quality = biometric_data.get("quality", 0.8)
                base_confidence = 0.6 + (quality * 0.4)
            elif biometric_type == BiometricType.FACE.value:
                quality = biometric_data.get("quality", 0.8)
                base_confidence = 0.5 + (quality * 0.5)
            
            # Add some randomness for demo
            import random
            confidence = min(0.99, base_confidence + random.uniform(-0.1, 0.1))
            
            return {
                "success": True,
                "confidence": round(confidence, 3),
                "score": round(confidence * 100, 0),
                "template_id": f"template_{biometric_type}_{personnel_id}",
                "verification_time": round(random.uniform(0.5, 2.0), 3)
            }
        except Exception as e:
            logger.error(f"Biometric verification failed: {str(e)}")
            return {
                "success": False,
                "confidence": 0.0,
                "score": 0.0,
                "template_id": "",
                "verification_time": 0.0
            }
    
    def _update_performance_metrics(self, match_result: Dict[str, Any]):
        """Update internal performance metrics"""
        try:
            self.performance_metrics["total_verifications"] += 1
            
            if match_result.get("success", False):
                self.performance_metrics["successful_verifications"] += 1
            
            # Update averages
            total = self.performance_metrics["total_verifications"]
            if total > 0:
                self.performance_metrics["avg_verification_time"] = (
                    (self.performance_metrics["avg_verification_time"] * (total - 1) + 
                     match_result.get("verification_time", 0)) / total
                )
                self.performance_metrics["avg_confidence"] = (
                    (self.performance_metrics["avg_confidence"] * (total - 1) + 
                     match_result.get("confidence", 0)) / total
                )
        except Exception as e:
            logger.error(f"Failed to update performance metrics: {str(e)}")


# Global service instance
biotime_realtime_service = BioTimeRealtimeService()
