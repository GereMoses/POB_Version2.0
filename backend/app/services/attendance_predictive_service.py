"""
Attendance Predictive Analytics Service
Advanced forecasting and predictive analytics for attendance management
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
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class AttendanceForecast:
    """Attendance forecast data structure"""
    date: date
    expected_attendance: int
    confidence_score: float
    factors: Dict[str, float]
    recommendations: List[str]

@dataclass
class StaffingPrediction:
    """Staffing prediction data structure"""
    date: date
    department: str
    required_staff: int
    available_staff: int
    shortage_risk: float
    recommendations: List[str]

class AttendancePredictiveService:
    """Predictive analytics for attendance management"""
    
    def __init__(self):
        self.forecast_horizon_days = 30
        self.confidence_threshold = 0.7
        self.shortage_risk_threshold = 0.15  # 15% shortage risk
    
    async def generate_attendance_forecast(self, start_date: date, end_date: date, 
                                       department_id: Optional[int] = None, 
                                       db: Session = None) -> List[AttendanceForecast]:
        """Generate attendance forecast for specified period"""
        try:
            # Get historical attendance data
            historical_data = await self._get_historical_attendance_data(
                start_date - timedelta(days=90), start_date, department_id, db
            )
            
            if not historical_data:
                return []
            
            forecasts = []
            current_date = start_date
            
            while current_date <= end_date:
                forecast = await self._forecast_single_date(
                    current_date, historical_data, department_id, db
                )
                forecasts.append(forecast)
                current_date += timedelta(days=1)
            
            return forecasts
            
        except Exception as e:
            logger.error(f"Error generating attendance forecast: {e}")
            return []
    
    async def predict_staffing_needs(self, start_date: date, end_date: date,
                                   department_id: Optional[int] = None,
                                   db: Session = None) -> List[StaffingPrediction]:
        """Predict staffing needs and potential shortages"""
        try:
            # Get attendance forecast
            forecasts = await self.generate_attendance_forecast(start_date, end_date, department_id, db)
            
            # Get department staffing requirements
            staffing_requirements = await self._get_staffing_requirements(department_id, db)
            
            predictions = []
            
            for forecast in forecasts:
                prediction = await self._create_staffing_prediction(
                    forecast, staffing_requirements, department_id, db
                )
                predictions.append(prediction)
            
            return predictions
            
        except Exception as e:
            logger.error(f"Error predicting staffing needs: {e}")
            return []
    
    async def analyze_attendance_trends(self, start_date: date, end_date: date,
                                    department_id: Optional[int] = None,
                                    db: Session = None) -> Dict:
        """Analyze attendance trends and patterns"""
        try:
            # Get historical data
            historical_data = await self._get_historical_attendance_data(
                start_date, end_date, department_id, db
            )
            
            if not historical_data:
                return {"error": "No historical data available"}
            
            # Analyze various trends
            trends = {
                "daily_trends": await self._analyze_daily_trends(historical_data),
                "weekly_trends": await self._analyze_weekly_trends(historical_data),
                "monthly_trends": await self._analyze_monthly_trends(historical_data),
                "seasonal_patterns": await self._analyze_seasonal_patterns(historical_data),
                "absence_patterns": await self._analyze_absence_patterns(historical_data),
                "overtime_patterns": await self._analyze_overtime_patterns(historical_data),
                "recommendations": await self._generate_trend_recommendations(historical_data)
            }
            
            return trends
            
        except Exception as e:
            logger.error(f"Error analyzing attendance trends: {e}")
            return {"error": str(e)}
    
    async def _get_historical_attendance_data(self, start_date: date, end_date: date,
                                          department_id: Optional[int], db: Session) -> List[Dict]:
        """Get historical attendance data for analysis"""
        try:
            query = """
                SELECT 
                    att_date,
                    COUNT(DISTINCT emp_id) as total_employees,
                    COUNT(CASE WHEN work_hours > 0 THEN 1 END) as present_employees,
                    COUNT(CASE WHEN work_hours = 0 THEN 1 END) as absent_employees,
                    AVG(work_hours) as avg_work_hours,
                    AVG(late_minutes) as avg_late_minutes,
                    AVG(overtime_minutes) as avg_overtime_minutes,
                    SUM(CASE WHEN is_holiday THEN 1 ELSE 0 END) as holiday_count,
                    SUM(CASE WHEN is_weekend THEN 1 ELSE 0 END) as weekend_count
                FROM att_report 
                WHERE att_date BETWEEN :start_date AND :end_date
            """
            
            params = {"start_date": start_date, "end_date": end_date}
            
            if department_id:
                query += " AND department_id = :department_id"
                params["department_id"] = department_id
            
            query += " GROUP BY att_date ORDER BY att_date"
            
            result = db.execute(text(query), params).fetchall()
            
            return [dict(row) for row in result]
            
        except Exception as e:
            logger.error(f"Error getting historical data: {e}")
            return []
    
    async def _forecast_single_date(self, target_date: date, historical_data: List[Dict],
                                 department_id: Optional[int], db: Session) -> AttendanceForecast:
        """Forecast attendance for a single date"""
        try:
            # Get day of week and other date features
            day_of_week = target_date.weekday()
            is_weekend = day_of_week >= 5
            is_holiday = await self._is_holiday(target_date, db)
            
            # Find similar historical dates
            similar_dates = await self._find_similar_dates(target_date, historical_data)
            
            if not similar_dates:
                # Fallback to simple average
                avg_attendance = len(similar_dates) if similar_dates else 0
                confidence = 0.3
            else:
                # Calculate weighted average based on similarity
                weights = []
                attendance_values = []
                
                for date_data in similar_dates:
                    similarity = await self._calculate_date_similarity(target_date, date_data["att_date"])
                    weights.append(similarity)
                    attendance_values.append(date_data["present_employees"])
                
                # Weighted average
                avg_attendance = sum(w * a for w, a in zip(weights, attendance_values)) / sum(weights)
                confidence = min(max(sum(weights) / len(weights), 0), 1)
            
            # Apply adjustment factors
            factors = await self._calculate_adjustment_factors(target_date, historical_data, db)
            adjusted_attendance = int(avg_attendance * factors.get("base_factor", 1.0))
            
            # Generate recommendations
            recommendations = await self._generate_forecast_recommendations(
                target_date, adjusted_attendance, confidence, factors
            )
            
            return AttendanceForecast(
                date=target_date,
                expected_attendance=adjusted_attendance,
                confidence_score=confidence,
                factors=factors,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"Error forecasting for {target_date}: {e}")
            return AttendanceForecast(
                date=target_date,
                expected_attendance=0,
                confidence_score=0,
                factors={},
                recommendations=["Unable to generate forecast"]
            )
    
    async def _find_similar_dates(self, target_date: date, historical_data: List[Dict]) -> List[Dict]:
        """Find historically similar dates"""
        similar_dates = []
        target_day_of_week = target_date.weekday()
        
        for date_data in historical_data:
            historical_date = date_data["att_date"]
            
            # Check if same day of week
            if historical_date.weekday() == target_day_of_week:
                similar_dates.append(date_data)
        
        # Return up to 8 similar dates
        return similar_dates[:8]
    
    async def _calculate_date_similarity(self, date1: date, date2: date) -> float:
        """Calculate similarity score between two dates"""
        # Base similarity for same day of week
        if date1.weekday() == date2.weekday():
            base_similarity = 0.8
        else:
            base_similarity = 0.2
        
        # Adjust for proximity
        days_diff = abs((date1 - date2).days)
        proximity_factor = max(0, 1 - (days_diff / 365))  # Decay over year
        
        # Combine factors
        similarity = base_similarity * (0.7 + 0.3 * proximity_factor)
        
        return similarity
    
    async def _calculate_adjustment_factors(self, target_date: date, historical_data: List[Dict],
                                        db: Session) -> Dict:
        """Calculate various adjustment factors for the forecast"""
        factors = {}
        
        # Holiday factor
        is_holiday = await self._is_holiday(target_date, db)
        if is_holiday:
            factors["holiday_factor"] = 0.3  # 70% reduction
        else:
            factors["holiday_factor"] = 1.0
        
        # Weekend factor
        if target_date.weekday() >= 5:
            factors["weekend_factor"] = 0.7  # 30% reduction
        else:
            factors["weekend_factor"] = 1.0
        
        # Seasonal factor (based on historical patterns)
        month = target_date.month
        seasonal_factors = {
            1: 0.85,  # January - post-holidays
            2: 0.90,  # February
            3: 0.95,  # March
            4: 1.0,   # April
            5: 1.0,   # May
            6: 0.95,  # June - summer vacation start
            7: 0.85,  # July - summer vacation
            8: 0.90,  # August - summer vacation end
            9: 1.0,   # September
            10: 1.0,  # October
            11: 0.95, # November - pre-holidays
            12: 0.80  # December - holidays
        }
        factors["seasonal_factor"] = seasonal_factors.get(month, 1.0)
        
        # Weather factor (placeholder - would integrate with weather API)
        factors["weather_factor"] = 1.0
        
        # Special events factor (placeholder)
        factors["events_factor"] = 1.0
        
        # Calculate base factor
        base_factor = (factors["holiday_factor"] * 
                     factors["weekend_factor"] * 
                     factors["seasonal_factor"] * 
                     factors["weather_factor"] * 
                     factors["events_factor"])
        
        factors["base_factor"] = base_factor
        
        return factors
    
    async def _is_holiday(self, target_date: date, db: Session) -> bool:
        """Check if target date is a holiday"""
        try:
            query = """
                SELECT COUNT(*) as count
                FROM att_holiday 
                WHERE :target_date BETWEEN start_date AND end_date
                AND is_active = true
            """
            
            result = db.execute(text(query), {"target_date": target_date}).fetchone()
            return result.count > 0
            
        except Exception as e:
            logger.error(f"Error checking holiday: {e}")
            return False
    
    async def _generate_forecast_recommendations(self, target_date: date, expected_attendance: int,
                                            confidence: float, factors: Dict) -> List[str]:
        """Generate recommendations based on forecast"""
        recommendations = []
        
        # Confidence-based recommendations
        if confidence < 0.5:
            recommendations.append("Low confidence forecast - monitor actual attendance closely")
        
        # Factor-based recommendations
        if factors.get("holiday_factor", 1.0) < 1.0:
            recommendations.append("Holiday period - expect reduced attendance")
        
        if factors.get("weekend_factor", 1.0) < 1.0:
            recommendations.append("Weekend - expect reduced attendance")
        
        if factors.get("seasonal_factor", 1.0) < 0.9:
            recommendations.append("Seasonal low attendance period")
        
        # Attendance level recommendations
        if expected_attendance < 50:
            recommendations.append("Very low expected attendance - consider consolidating operations")
        elif expected_attendance < 100:
            recommendations.append("Low expected attendance - adjust staffing accordingly")
        
        return recommendations
    
    async def _get_staffing_requirements(self, department_id: Optional[int], db: Session) -> Dict:
        """Get staffing requirements for department"""
        try:
            # This would typically come from department configuration
            # For now, return default requirements
            return {
                "min_staff_per_shift": 10,
                "optimal_staff_per_shift": 15,
                "max_staff_per_shift": 25,
                "shifts_per_day": 2
            }
            
        except Exception as e:
            logger.error(f"Error getting staffing requirements: {e}")
            return {}
    
    async def _create_staffing_prediction(self, forecast: AttendanceForecast,
                                       staffing_requirements: Dict,
                                       department_id: Optional[int],
                                       db: Session) -> StaffingPrediction:
        """Create staffing prediction from attendance forecast"""
        try:
            # Calculate required staff based on forecast
            required_staff = int(forecast.expected_attendance * 1.1)  # 10% buffer
            
            # Get available staff (would integrate with scheduling system)
            available_staff = await self._get_available_staff(forecast.date, department_id, db)
            
            # Calculate shortage risk
            if available_staff > 0:
                shortage_risk = max(0, (required_staff - available_staff) / required_staff)
            else:
                shortage_risk = 1.0
            
            # Generate recommendations
            recommendations = []
            
            if shortage_risk > self.shortage_risk_threshold:
                recommendations.append(f"Staffing shortage risk: {shortage_risk:.1%}")
                recommendations.append("Consider calling backup staff")
                recommendations.append("Adjust shift schedules if possible")
            
            if shortage_risk > 0.3:
                recommendations.append("High shortage risk - immediate action required")
            
            return StaffingPrediction(
                date=forecast.date,
                department=f"Department {department_id}" if department_id else "All Departments",
                required_staff=required_staff,
                available_staff=available_staff,
                shortage_risk=shortage_risk,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"Error creating staffing prediction: {e}")
            return StaffingPrediction(
                date=forecast.date,
                department="Unknown",
                required_staff=0,
                available_staff=0,
                shortage_risk=1.0,
                recommendations=["Unable to predict staffing"]
            )
    
    async def _get_available_staff(self, target_date: date, department_id: Optional[int], db: Session) -> int:
        """Get number of available staff for a date"""
        try:
            # This would integrate with scheduling system
            # For now, return a reasonable estimate
            query = """
                SELECT COUNT(DISTINCT emp_id) as total_staff
                FROM personnel 
                WHERE is_active = true
            """
            
            if department_id:
                query += " AND department_id = :department_id"
            
            result = db.execute(text(query), {"department_id": department_id}).fetchone()
            return result.total_staff if result else 0
            
        except Exception as e:
            logger.error(f"Error getting available staff: {e}")
            return 0
    
    async def _analyze_daily_trends(self, historical_data: List[Dict]) -> Dict:
        """Analyze daily attendance trends"""
        try:
            if not historical_data:
                return {}
            
            # Calculate daily statistics
            daily_attendance = [record["present_employees"] for record in historical_data]
            daily_absences = [record["absent_employees"] for record in historical_data]
            
            trends = {
                "avg_daily_attendance": statistics.mean(daily_attendance),
                "max_daily_attendance": max(daily_attendance),
                "min_daily_attendance": min(daily_attendance),
                "avg_daily_absences": statistics.mean(daily_absences),
                "attendance_volatility": statistics.stdev(daily_attendance) if len(daily_attendance) > 1 else 0,
                "trend_direction": await self._calculate_trend_direction(daily_attendance)
            }
            
            return trends
            
        except Exception as e:
            logger.error(f"Error analyzing daily trends: {e}")
            return {}
    
    async def _analyze_weekly_trends(self, historical_data: List[Dict]) -> Dict:
        """Analyze weekly attendance patterns"""
        try:
            if not historical_data:
                return {}
            
            # Group by day of week
            weekly_data = defaultdict(list)
            for record in historical_data:
                day_of_week = record["att_date"].weekday()
                weekly_data[day_of_week].append(record["present_employees"])
            
            # Calculate weekly patterns
            weekly_patterns = {}
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            
            for day, attendance_list in weekly_data.items():
                if attendance_list:
                    weekly_patterns[day_names[day]] = {
                        "avg_attendance": statistics.mean(attendance_list),
                        "max_attendance": max(attendance_list),
                        "min_attendance": min(attendance_list),
                        "volatility": statistics.stdev(attendance_list) if len(attendance_list) > 1 else 0
                    }
            
            return weekly_patterns
            
        except Exception as e:
            logger.error(f"Error analyzing weekly trends: {e}")
            return {}
    
    async def _analyze_monthly_trends(self, historical_data: List[Dict]) -> Dict:
        """Analyze monthly attendance trends"""
        try:
            if not historical_data:
                return {}
            
            # Group by month
            monthly_data = defaultdict(list)
            for record in historical_data:
                month = record["att_date"].month
                monthly_data[month].append(record["present_employees"])
            
            # Calculate monthly patterns
            monthly_patterns = {}
            month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            
            for month, attendance_list in monthly_data.items():
                if attendance_list:
                    monthly_patterns[month_names[month-1]] = {
                        "avg_attendance": statistics.mean(attendance_list),
                        "max_attendance": max(attendance_list),
                        "min_attendance": min(attendance_list),
                        "total_days": len(attendance_list)
                    }
            
            return monthly_patterns
            
        except Exception as e:
            logger.error(f"Error analyzing monthly trends: {e}")
            return {}
    
    async def _analyze_seasonal_patterns(self, historical_data: List[Dict]) -> Dict:
        """Analyze seasonal attendance patterns"""
        try:
            if not historical_data:
                return {}
            
            # Group by season
            seasonal_data = {"Spring": [], "Summer": [], "Fall": [], "Winter": []}
            
            for record in historical_data:
                month = record["att_date"].month
                if month in [3, 4, 5]:
                    seasonal_data["Spring"].append(record["present_employees"])
                elif month in [6, 7, 8]:
                    seasonal_data["Summer"].append(record["present_employees"])
                elif month in [9, 10, 11]:
                    seasonal_data["Fall"].append(record["present_employees"])
                else:
                    seasonal_data["Winter"].append(record["present_employees"])
            
            # Calculate seasonal averages
            seasonal_patterns = {}
            for season, attendance_list in seasonal_data.items():
                if attendance_list:
                    seasonal_patterns[season] = {
                        "avg_attendance": statistics.mean(attendance_list),
                        "max_attendance": max(attendance_list),
                        "min_attendance": min(attendance_list),
                        "days_count": len(attendance_list)
                    }
            
            return seasonal_patterns
            
        except Exception as e:
            logger.error(f"Error analyzing seasonal patterns: {e}")
            return {}
    
    async def _analyze_absence_patterns(self, historical_data: List[Dict]) -> Dict:
        """Analyze absence patterns"""
        try:
            if not historical_data:
                return {}
            
            # Calculate absence statistics
            total_employees = [record["total_employees"] for record in historical_data]
            absent_employees = [record["absent_employees"] for record in historical_data]
            
            # Calculate absence rates
            absence_rates = []
            for i, record in enumerate(historical_data):
                if total_employees[i] > 0:
                    absence_rates.append(absent_employees[i] / total_employees[i])
            
            patterns = {
                "avg_absence_rate": statistics.mean(absence_rates) if absence_rates else 0,
                "max_absence_rate": max(absence_rates) if absence_rates else 0,
                "min_absence_rate": min(absence_rates) if absence_rates else 0,
                "absence_volatility": statistics.stdev(absence_rates) if len(absence_rates) > 1 else 0,
                "total_absence_days": sum(absent_employees)
            }
            
            return patterns
            
        except Exception as e:
            logger.error(f"Error analyzing absence patterns: {e}")
            return {}
    
    async def _analyze_overtime_patterns(self, historical_data: List[Dict]) -> Dict:
        """Analyze overtime patterns"""
        try:
            if not historical_data:
                return {}
            
            # Calculate overtime statistics
            avg_overtime = [record.get("avg_overtime_minutes", 0) for record in historical_data]
            
            patterns = {
                "avg_daily_overtime": statistics.mean(avg_overtime) if avg_overtime else 0,
                "max_daily_overtime": max(avg_overtime) if avg_overtime else 0,
                "total_overtime_hours": sum(avg_overtime) / 60 if avg_overtime else 0,
                "overtime_frequency": len([ot for ot in avg_overtime if ot > 0]) / len(avg_overtime) if avg_overtime else 0
            }
            
            return patterns
            
        except Exception as e:
            logger.error(f"Error analyzing overtime patterns: {e}")
            return {}
    
    async def _calculate_trend_direction(self, values: List[float]) -> str:
        """Calculate trend direction from values"""
        if len(values) < 2:
            return "insufficient_data"
        
        # Simple linear regression to determine trend
        x = list(range(len(values)))
        n = len(values)
        
        sum_x = sum(x)
        sum_y = sum(values)
        sum_xy = sum(x[i] * values[i] for i in range(n))
        sum_x2 = sum(x[i] ** 2 for i in range(n))
        
        if n * sum_x2 - sum_x ** 2 == 0:
            return "stable"
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2)
        
        if slope > 0.1:
            return "increasing"
        elif slope < -0.1:
            return "decreasing"
        else:
            return "stable"
    
    async def _generate_trend_recommendations(self, historical_data: List[Dict]) -> List[str]:
        """Generate recommendations based on trend analysis"""
        recommendations = []
        
        if not historical_data:
            return recommendations
        
        # Analyze trends and generate recommendations
        daily_trends = await self._analyze_daily_trends(historical_data)
        
        if daily_trends.get("attendance_volatility", 0) > 10:
            recommendations.append("High attendance volatility - investigate causes")
        
        absence_patterns = await self._analyze_absence_patterns(historical_data)
        avg_absence_rate = absence_patterns.get("avg_absence_rate", 0)
        
        if avg_absence_rate > 0.1:  # 10% absence rate
            recommendations.append("High absence rate - review employee wellness programs")
        
        overtime_patterns = await self._analyze_overtime_patterns(historical_data)
        avg_overtime = overtime_patterns.get("avg_daily_overtime", 0)
        
        if avg_overtime > 60:  # More than 1 hour average overtime
            recommendations.append("High overtime levels - consider hiring additional staff")
        
        return recommendations

# Global instance
attendance_predictive_service = AttendancePredictiveService()
