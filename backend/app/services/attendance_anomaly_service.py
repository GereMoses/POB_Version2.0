"""
Attendance Anomaly Detection Service
AI-powered detection of unusual attendance patterns and behaviors
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta, date
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)

class AttendanceAnomalyService:
    """AI-powered attendance anomaly detection"""
    
    def __init__(self):
        self.anomaly_thresholds = {
            'late_arrival_deviation': 2.0,  # Standard deviations
            'early_departure_deviation': 2.0,
            'absence_frequency_threshold': 0.3,  # 30% deviation
            'overtime_frequency_threshold': 0.5,  # 50% increase
            'punch_pattern_deviation': 2.5,
            'location_consistency_threshold': 0.8,  # 80% consistency
        }
    
    async def detect_employee_anomalies(self, emp_id: int, start_date: date, end_date: date, db: Session) -> Dict:
        """Detect anomalies for a specific employee"""
        try:
            # Get employee attendance data
            attendance_data = await self._get_employee_attendance_data(emp_id, start_date, end_date, db)
            
            if not attendance_data:
                return {"anomalies": [], "summary": "No attendance data found"}
            
            anomalies = []
            
            # 1. Late arrival pattern analysis
            late_anomalies = await self._detect_late_arrival_patterns(attendance_data)
            anomalies.extend(late_anomalies)
            
            # 2. Early departure pattern analysis
            early_anomalies = await self._detect_early_departure_patterns(attendance_data)
            anomalies.extend(early_anomalies)
            
            # 3. Absence frequency analysis
            absence_anomalies = await self._detect_absence_patterns(attendance_data)
            anomalies.extend(absence_anomalies)
            
            # 4. Overtime pattern analysis
            overtime_anomalies = await self._detect_overtime_patterns(attendance_data)
            anomalies.extend(overtime_anomalies)
            
            # 5. Punch timing consistency
            timing_anomalies = await self._detect_timing_inconsistencies(attendance_data)
            anomalies.extend(timing_anomalies)
            
            # 6. Location consistency (if multiple terminals)
            location_anomalies = await self._detect_location_inconsistencies(attendance_data)
            anomalies.extend(location_anomalies)
            
            # 7. Break pattern analysis
            break_anomalies = await self._detect_break_pattern_anomalies(attendance_data)
            anomalies.extend(break_anomalies)
            
            # Calculate anomaly score
            anomaly_score = await self._calculate_anomaly_score(anomalies)
            
            return {
                "employee_id": emp_id,
                "period": f"{start_date} to {end_date}",
                "anomalies": anomalies,
                "anomaly_score": anomaly_score,
                "summary": await self._generate_anomaly_summary(anomalies, anomaly_score)
            }
            
        except Exception as e:
            logger.error(f"Error detecting anomalies for employee {emp_id}: {e}")
            return {"error": str(e)}
    
    async def detect_team_anomalies(self, team_ids: List[int], start_date: date, end_date: date, db: Session) -> Dict:
        """Detect anomalies for a team/group of employees"""
        try:
            team_anomalies = []
            team_scores = []
            
            for emp_id in team_ids:
                emp_anomalies = await self.detect_employee_anomalies(emp_id, start_date, end_date, db)
                if "anomalies" in emp_anomalies:
                    team_anomalies.append(emp_anomalies)
                    team_scores.append(emp_anomalies.get("anomaly_score", 0))
            
            # Team-level analysis
            team_insights = await self._analyze_team_patterns(team_anomalies, team_scores)
            
            return {
                "team_size": len(team_ids),
                "period": f"{start_date} to {end_date}",
                "employee_anomalies": team_anomalies,
                "team_insights": team_insights,
                "average_anomaly_score": statistics.mean(team_scores) if team_scores else 0
            }
            
        except Exception as e:
            logger.error(f"Error detecting team anomalies: {e}")
            return {"error": str(e)}
    
    async def _get_employee_attendance_data(self, emp_id: int, start_date: date, end_date: date, db: Session) -> List[Dict]:
        """Get attendance data for an employee"""
        try:
            query = """
                SELECT 
                    att_date,
                    checkin_time,
                    checkout_time,
                    work_hours,
                    late_minutes,
                    early_minutes,
                    overtime_minutes,
                    break_minutes,
                    terminal_sn,
                    is_holiday,
                    is_weekend,
                    exception_count
                FROM att_report 
                WHERE emp_id = :emp_id 
                AND att_date BETWEEN :start_date AND :end_date
                ORDER BY att_date
            """
            
            result = db.execute(text(query), {
                "emp_id": emp_id,
                "start_date": start_date,
                "end_date": end_date
            }).fetchall()
            
            return [dict(row) for row in result]
            
        except Exception as e:
            logger.error(f"Error getting attendance data: {e}")
            return []
    
    async def _detect_late_arrival_patterns(self, attendance_data: List[Dict]) -> List[Dict]:
        """Detect unusual late arrival patterns"""
        anomalies = []
        
        # Extract late minutes for working days
        late_minutes = [record.get("late_minutes", 0) for record in attendance_data 
                       if record.get("late_minutes", 0) > 0]
        
        if len(late_minutes) < 3:  # Need at least 3 data points
            return anomalies
        
        # Calculate statistics
        mean_late = statistics.mean(late_minutes)
        std_late = statistics.stdev(late_minutes) if len(late_minutes) > 1 else 0
        
        # Detect outliers
        threshold = mean_late + (self.anomaly_thresholds['late_arrival_deviation'] * std_late)
        
        for record in attendance_data:
            if record.get("late_minutes", 0) > threshold:
                anomalies.append({
                    "type": "late_arrival",
                    "date": record["att_date"],
                    "severity": "high" if record["late_minutes"] > threshold * 1.5 else "medium",
                    "description": f"Unusually late arrival: {record['late_minutes']} minutes",
                    "value": record["late_minutes"],
                    "threshold": threshold,
                    "recommendation": "Review employee's schedule and transportation"
                })
        
        return anomalies
    
    async def _detect_early_departure_patterns(self, attendance_data: List[Dict]) -> List[Dict]:
        """Detect unusual early departure patterns"""
        anomalies = []
        
        # Extract early minutes
        early_minutes = [record.get("early_minutes", 0) for record in attendance_data 
                        if record.get("early_minutes", 0) > 0]
        
        if len(early_minutes) < 3:
            return anomalies
        
        # Calculate statistics
        mean_early = statistics.mean(early_minutes)
        std_early = statistics.stdev(early_minutes) if len(early_minutes) > 1 else 0
        
        # Detect outliers
        threshold = mean_early + (self.anomaly_thresholds['early_departure_deviation'] * std_early)
        
        for record in attendance_data:
            if record.get("early_minutes", 0) > threshold:
                anomalies.append({
                    "type": "early_departure",
                    "date": record["att_date"],
                    "severity": "high" if record["early_minutes"] > threshold * 1.5 else "medium",
                    "description": f"Unusually early departure: {record['early_minutes']} minutes",
                    "value": record["early_minutes"],
                    "threshold": threshold,
                    "recommendation": "Check for workload issues or personal reasons"
                })
        
        return anomalies
    
    async def _detect_absence_patterns(self, attendance_data: List[Dict]) -> List[Dict]:
        """Detect unusual absence patterns"""
        anomalies = []
        
        # Count absences
        total_days = len(attendance_data)
        absent_days = len([record for record in attendance_data if record.get("work_hours", 0) == 0])
        
        if total_days == 0:
            return anomalies
        
        absence_rate = absent_days / total_days
        
        # Check if absence rate is unusually high
        if absence_rate > self.anomaly_thresholds['absence_frequency_threshold']:
            anomalies.append({
                "type": "high_absence_rate",
                "severity": "high" if absence_rate > 0.5 else "medium",
                "description": f"High absence rate: {absence_rate:.1%}",
                "value": absence_rate,
                "threshold": self.anomaly_thresholds['absence_frequency_threshold'],
                "recommendation": "Review employee health and work conditions"
            })
        
        # Check for consecutive absences
        consecutive_count = 0
        max_consecutive = 0
        
        for record in attendance_data:
            if record.get("work_hours", 0) == 0:
                consecutive_count += 1
                max_consecutive = max(max_consecutive, consecutive_count)
            else:
                consecutive_count = 0
        
        if max_consecutive >= 3:
            anomalies.append({
                "type": "consecutive_absences",
                "date": None,
                "severity": "high" if max_consecutive >= 5 else "medium",
                "description": f"{max_consecutive} consecutive absences detected",
                "value": max_consecutive,
                "threshold": 3,
                "recommendation": "Immediate follow-up required"
            })
        
        return anomalies
    
    async def _detect_overtime_patterns(self, attendance_data: List[Dict]) -> List[Dict]:
        """Detect unusual overtime patterns"""
        anomalies = []
        
        # Extract overtime minutes
        overtime_minutes = [record.get("overtime_minutes", 0) for record in attendance_data 
                          if record.get("overtime_minutes", 0) > 0]
        
        if len(overtime_minutes) < 3:
            return anomalies
        
        # Calculate statistics
        mean_ot = statistics.mean(overtime_minutes)
        std_ot = statistics.stdev(overtime_minutes) if len(overtime_minutes) > 1 else 0
        
        # Detect excessive overtime
        for record in attendance_data:
            if record.get("overtime_minutes", 0) > 240:  # More than 4 hours
                anomalies.append({
                    "type": "excessive_overtime",
                    "date": record["att_date"],
                    "severity": "high" if record["overtime_minutes"] > 360 else "medium",
                    "description": f"Excessive overtime: {record['overtime_minutes']} minutes",
                    "value": record["overtime_minutes"],
                    "threshold": 240,
                    "recommendation": "Review workload distribution and staffing"
                })
        
        # Check for frequent overtime
        overtime_days = len([record for record in attendance_data if record.get("overtime_minutes", 0) > 0])
        overtime_frequency = overtime_days / len(attendance_data)
        
        if overtime_frequency > self.anomaly_thresholds['overtime_frequency_threshold']:
            anomalies.append({
                "type": "frequent_overtime",
                "date": None,
                "severity": "medium",
                "description": f"High overtime frequency: {overtime_frequency:.1%}",
                "value": overtime_frequency,
                "threshold": self.anomaly_thresholds['overtime_frequency_threshold'],
                "recommendation": "Consider hiring additional staff"
            })
        
        return anomalies
    
    async def _detect_timing_inconsistencies(self, attendance_data: List[Dict]) -> List[Dict]:
        """Detect inconsistencies in punch timing"""
        anomalies = []
        
        # Extract check-in times
        checkin_times = []
        for record in attendance_data:
            if record.get("checkin_time"):
                time_str = record["checkin_time"]
                if ":" in time_str:
                    hour, minute = map(int, time_str.split(":")[:2])
                    total_minutes = hour * 60 + minute
                    checkin_times.append(total_minutes)
        
        if len(checkin_times) < 5:
            return anomalies
        
        # Calculate timing consistency
        std_timing = statistics.stdev(checkin_times)
        
        if std_timing > 60:  # More than 1 hour standard deviation
            anomalies.append({
                "type": "timing_inconsistency",
                "date": None,
                "severity": "medium",
                "description": f"Inconsistent check-in times (std dev: {std_timing:.0f} minutes)",
                "value": std_timing,
                "threshold": 60,
                "recommendation": "Review schedule consistency"
            })
        
        return anomalies
    
    async def _detect_location_inconsistencies(self, attendance_data: List[Dict]) -> List[Dict]:
        """Detect inconsistencies in punch locations"""
        anomalies = []
        
        # Extract terminal locations
        terminals = [record.get("terminal_sn") for record in attendance_data 
                    if record.get("terminal_sn")]
        
        if len(set(terminals)) <= 1:
            return anomalies
        
        # Calculate location consistency
        terminal_counts = defaultdict(int)
        for terminal in terminals:
            terminal_counts[terminal] += 1
        
        total_punches = len(terminals)
        consistency_ratios = {term: count/total_punches for term, count in terminal_counts.items()}
        
        # Check for low consistency
        for terminal, ratio in consistency_ratios.items():
            if ratio < self.anomaly_thresholds['location_consistency_threshold'] and ratio > 0.1:
                anomalies.append({
                    "type": "location_inconsistency",
                    "date": None,
                    "severity": "low",
                    "description": f"Low consistency at terminal {terminal}: {ratio:.1%}",
                    "value": ratio,
                    "threshold": self.anomaly_thresholds['location_consistency_threshold'],
                    "recommendation": "Verify if employee should be using this terminal"
                })
        
        return anomalies
    
    async def _detect_break_pattern_anomalies(self, attendance_data: List[Dict]) -> List[Dict]:
        """Detect anomalies in break patterns"""
        anomalies = []
        
        # Extract break minutes
        break_minutes = [record.get("break_minutes", 0) for record in attendance_data 
                       if record.get("break_minutes", 0) > 0]
        
        if len(break_minutes) < 3:
            return anomalies
        
        # Calculate statistics
        mean_break = statistics.mean(break_minutes)
        std_break = statistics.stdev(break_minutes) if len(break_minutes) > 1 else 0
        
        # Detect unusual break patterns
        for record in attendance_data:
            break_time = record.get("break_minutes", 0)
            
            # Very short breaks
            if 0 < break_time < 15:
                anomalies.append({
                    "type": "short_break",
                    "date": record["att_date"],
                    "severity": "low",
                    "description": f"Very short break: {break_time} minutes",
                    "value": break_time,
                    "threshold": 15,
                    "recommendation": "Ensure minimum break time compliance"
                })
            
            # Very long breaks
            elif break_time > 120:  # More than 2 hours
                anomalies.append({
                    "type": "long_break",
                    "date": record["att_date"],
                    "severity": "medium",
                    "description": f"Very long break: {break_time} minutes",
                    "value": break_time,
                    "threshold": 120,
                    "recommendation": "Review break time policy compliance"
                })
        
        return anomalies
    
    async def _calculate_anomaly_score(self, anomalies: List[Dict]) -> float:
        """Calculate overall anomaly score"""
        if not anomalies:
            return 0.0
        
        severity_weights = {
            "low": 1.0,
            "medium": 2.0,
            "high": 3.0
        }
        
        total_score = 0
        for anomaly in anomalies:
            severity = anomaly.get("severity", "medium")
            weight = severity_weights.get(severity, 2.0)
            total_score += weight
        
        # Normalize score (0-100 scale)
        max_possible_score = len(anomalies) * 3.0  # All high severity
        normalized_score = (total_score / max_possible_score) * 100 if max_possible_score > 0 else 0
        
        return min(normalized_score, 100.0)
    
    async def _generate_anomaly_summary(self, anomalies: List[Dict], score: float) -> str:
        """Generate human-readable anomaly summary"""
        if not anomalies:
            return "No anomalies detected"
        
        # Count by type
        type_counts = defaultdict(int)
        severity_counts = defaultdict(int)
        
        for anomaly in anomalies:
            type_counts[anomaly["type"]] += 1
            severity_counts[anomaly["severity"]] += 1
        
        summary_parts = []
        
        # Overall assessment
        if score >= 70:
            summary_parts.append("High risk profile detected")
        elif score >= 40:
            summary_parts.append("Moderate risk profile detected")
        else:
            summary_parts.append("Low risk profile with minor issues")
        
        # Most common issues
        if type_counts:
            most_common = max(type_counts.items(), key=lambda x: x[1])
            summary_parts.append(f"Most common issue: {most_common[0]} ({most_common[1]} occurrences)")
        
        # Severity breakdown
        if severity_counts:
            severity_summary = ", ".join([f"{count} {sev}" for sev, count in severity_counts.items()])
            summary_parts.append(f"Severity breakdown: {severity_summary}")
        
        return " | ".join(summary_parts)
    
    async def _analyze_team_patterns(self, team_anomalies: List[Dict], team_scores: List[float]) -> Dict:
        """Analyze team-level patterns"""
        insights = {}
        
        # Team risk distribution
        high_risk_count = len([score for score in team_scores if score >= 70])
        medium_risk_count = len([score for score in team_scores if 40 <= score < 70])
        low_risk_count = len([score for score in team_scores if score < 40])
        
        insights["risk_distribution"] = {
            "high_risk": high_risk_count,
            "medium_risk": medium_risk_count,
            "low_risk": low_risk_count
        }
        
        # Common anomaly types across team
        all_anomalies = []
        for emp_anomalies in team_anomalies:
            all_anomalies.extend(emp_anomalies.get("anomalies", []))
        
        team_anomaly_types = defaultdict(int)
        for anomaly in all_anomalies:
            team_anomaly_types[anomaly["type"]] += 1
        
        insights["common_anomalies"] = dict(team_anomaly_types)
        
        # Team recommendations
        recommendations = []
        
        if high_risk_count > len(team_scores) * 0.3:
            recommendations.append("Consider team-wide policy review")
        
        if team_anomaly_types.get("excessive_overtime", 0) > len(team_scores) * 0.5:
            recommendations.append("Review team workload and staffing")
        
        if team_anomaly_types.get("high_absence_rate", 0) > len(team_scores) * 0.2:
            recommendations.append("Investigate team health and morale")
        
        insights["recommendations"] = recommendations
        
        return insights

# Global instance
attendance_anomaly_service = AttendanceAnomalyService()
