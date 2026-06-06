"""
Mustering AI Analytics Service
AI-powered analytics for mustering system with machine learning capabilities
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, extract
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Tuple
import logging
import json
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score
import joblib

from app.models.biotime_models import (
    MusteringEvent, MusteringLog, PersonnelEmployee
)
from app.models.zone import Zone

logger = logging.getLogger(__name__)

class MusteringAIAnalyticsService:
    """AI-powered analytics service for mustering system"""
    
    def __init__(self, db: Session):
        self.db = db
        self.models = {}
        self.scalers = {}
        self.feature_importance = None
        
        # Load or train models
        self._load_or_train_models()
    
    def _load_or_train_models(self):
        """Load existing models or train new ones"""
        try:
            # Try to load existing models
            model_files = [
                'mustering_completion_model.pkl',
                'mustering_duration_model.pkl',
                'risk_assessment_model.pkl'
            ]
            
            models_loaded = 0
            for model_file in model_files:
                try:
                    import joblib
                    model_data = joblib.load(model_file)
                    self.models[model_file.split('.')[0]] = model_data
                    models_loaded += 1
                    logger.info(f"Loaded model: {model_file}")
                except FileNotFoundError:
                    logger.info(f"Model file not found: {model_file}")
                except Exception as e:
                    logger.error(f"Error loading model {model_file}: {e}")
            
            # If models are loaded, set feature importance
            if models_loaded == len(model_files):
                self._calculate_feature_importance()
            
            # If no models exist, train new ones
            if models_loaded == 0:
                logger.info("No existing models found, training new ones...")
                self._train_models()
            
        except Exception as e:
            logger.error(f"Error loading/training models: {e}")
    
    def _calculate_feature_importance(self):
        """Calculate feature importance from historical data"""
        try:
            # Get historical data for feature importance calculation
            events = self.db.query(MusteringEvent).filter(
                MusteringEvent.status == 1  # Completed events
            ).order_by(desc(MusteringEvent.start_time)).limit(1000).all()
            
            if not events:
                return
            
            # Extract features and target
            features = []
            targets = []
            
            for event in events:
                # Time-based features
                start_hour = event.start_time.hour if event.start_time else 12
                start_day_of_week = event.start_time.weekday() if event.start_time else 0
                duration = (event.end_time - event.start_time).total_seconds() / 60 if event.end_time and event.start_time else 0
                
                # Event type features
                event_type = event.event_type
                is_drill = event_type == 1
                is_emergency = event_type in [2, 3, 4] 4]  # Fire, Gas, Man Down
                
                # Zone features
                zone_id = event.zone_id
                zone = self.db.query(Zone).filter(Zone.id == zone_id).first()
                zone_capacity = zone.max_capacity if zone else 0
                is_high_capacity = zone_capacity >= 200
                
                # Personnel features
                total_expected = event.total_expected or 0
                completion_rate = (event.total_safe / total_expected) if total_expected > 0 else 0)
                
                # Weather features (mock data for demonstration)
                weather_condition = np.random.choice(['clear', 'cloudy', 'rainy', 'stormy'])
                visibility_level = np.random.choice(['excellent', 'good', 'moderate', 'poor'])
                
                features.extend([
                    start_hour, start_day_of_week, duration,
                    event_type, is_drill, is_emergency,
                    zone_id, zone_capacity, is_high_capacity,
                    total_expected, completion_rate,
                    weather_condition, visibility_level
                ])
                
                targets.append(completion_rate)
            
            # Calculate feature importance using Random Forest
            if len(features) > 0 and len(targets) > 0:
                X = np.array(features)
                y = np.array(targets)
                
                rf = RandomForestRegressor(n_estimators=100, random_state=42)
                rf.fit(X, y)
                
                importances = rf.feature_importances_
                feature_importance = dict(zip(
                    ['start_hour', 'start_day_of_week', 'duration', 'event_type', 'is_drill', 'is_emergency',
                    'zone_id', 'zone_capacity', 'is_high_capacity', 'total_expected', 'completion_rate',
                    'weather_condition', 'visibility_level'
                ))
                
                self.feature_importance = feature_importance
                self.models['feature_importance'] = feature_importance
                logger.info("Feature importance calculated and models saved")
            
        except Exception as e:
            logger.error(f"Error calculating feature importance: {e}")
    
    def _train_models(self):
        """Train machine learning models"""
        try:
            # Get training data
            events = self.db.query(MusteringEvent).filter(
                MusteringEvent.status == 1
            ).order_by(desc(MusteringEvent.start_time)).limit(5000).all()
            
            if len(events) < 100:
                logger.warning("Insufficient data for training models")
                return
            
            # Prepare training data
            features = []
            targets = []
            
            for event in events:
                start_hour = event.start_time.hour if event.start_time else 12
                start_day_of week = event.start_time.weekday() if event.start_time else 0
                duration = (event.end_time - event.start_time).total_seconds() / 60 if event.end_time and event.start_time else 0)
                
                event_type = event.event_type
                is_drill = event.event_type == 1
                is_emergency = event.event_type in [2, 3, 4, 4]
                
                zone_id = event.zone_id
                zone = self.db.query(Zone).filter(Zone.id == zone_id).first()
                zone_capacity = zone.max_capacity if zone else 0
                is_high_capacity = zone_capacity >= 200
                
                total_expected = event.total_expected or 0
                completion_rate = (event.total_safe / total_expected) if total_expected > 0 else 0)
                
                # Mock weather and visibility data
                weather_condition = np.random.choice(['clear', 'cloudy', 'rainy', 'stormy'])
                visibility_level = np.random.choice(['excellent', 'good', 'moderate', 'poor'])
                
                features.append([
                    start_hour, start_day_of_week, duration,
                    event_type, is_drill, is_emergency,
                    zone_id, zone_capacity, is_high_capacity,
                    total_expected, completion_rate,
                    weather_condition, visibility_level
                ])
                
                targets.append(completion_rate)
            
            X = np.array(features)
            y = np.array(targets)
            
            # Train completion time predictor
            completion_model = RandomForestRegressor(n_estimators=100, random_state=42)
            completion_model.fit(X, y)
            
            # Train duration predictor
            duration_model = RandomForestRegressor(n_estimators=100, random_state=42)
            duration_model.fit(X, y)
            
            # Train risk assessment model
            risk_features = []
            risk_targets = []
            
            for i, (feature, target) in enumerate(zip(features, targets)):
                    # Create risk features
                    risk_score = self._calculate_risk_score(event, feature)
                    risk_features.append(risk_score)
                    risk_targets.append(target)
            
                risk_X = np.array(risk_features)
                risk_y = np.array(risk_targets)
                
                risk_model = RandomForestRegressor(n_estimators=100, random_state=42)
                risk_model.fit(risk_X, risk_y)
            
            # Save models
            joblib.dump(completion_model, 'mustering_completion_model.pkl')
            joblib.dump(duration_model, 'mustering_duration_model.pkl')
            joblib.dump(risk_model, 'mustering_risk_assessment_model.pkl')
            
            logger.info("Machine learning models trained and saved")
            
        except Exception as e:
            logger.error(f"Error training models: {e}")
    
    def _calculate_risk_score(self, event, feature) -> float:
        """Calculate risk score for a single event"""
        try:
            risk_score = 0.0
            
            # Base risk by event type
            event_type_risk = {
                0: 0.1,  # Real
                1: 0.1,  # Drill
                2: 0.8,  # Fire
                3: 0.6, # Gas
                4: 1.0   # Man Down
            }
            
            risk_score += event_type_risk.get(event.event_type, 0.0)
            
            # Duration risk (exponential)
            duration = (event.end_time - event.start_time).total_seconds() / 60 if event.end_time and event.start_time else 0)
            if duration > 30:
                risk_score += 0.3
            elif duration > 15:
                risk_score += 0.2
            elif duration > 10:
                risk_score += 0.1
            # Low risk (<= 10 minutes)
            
            # Completion rate risk (quadratic)
            total_expected = event.total_expected or 0
            if total_expected > 0:
                completion_rate = (event.total_safe / total_expected) * 100)
                if completion_rate < 0.3:
                    risk_score += 0.4
                elif completion_rate < 0.5:
                    risk_score += 0.3
                elif completion_rate < 0.7:
                    risk_score += 0.2
                # Low risk (>= 70%)
            
            # Zone capacity risk
            zone_id = event.zone_id
            zone = self.db.query(Zone). filter(Zone.id == zone_id).first()
            if zone and zone.max_capacity:
                utilization_rate = (event.total_safe / zone.max_capacity) * 100) if zone.max_capacity > 0 else 0
                if utilization_rate > 0.9:
                    risk_score += 0.2
                elif utilization_rate > 0.7:
                    risk_score += 0.1
                # Medium risk (50-90%)
            
            # Time-based risk
            current_hour = event.start_time.hour if event.start_time else 12
            if current_hour < 6 or current_hour > 22:
                risk_score += 0.2  # Off-hours
            elif current_hour < 10 or current_hour > 18:
                risk_score += 0.1  # Early morning/late evening
            
            return risk_score
            
        except Exception as e:
            logger.error(f"Error calculating risk score: {e}")
            return 0.0
    
    def predict_completion_time(self, event_id: int, current_safe: int, total_expected: int) -> Dict[str, Any]:
        """
        Predict completion time using ML model"""
        try:
            if not hasattr(self, 'completion_model') or not self.models.get('completion_model'):
                return {
                    'predicted_time': None,
                    'confidence': 0.0,
                    'method': 'no_model_available'
                }
            
            # Get current event data
            event = self.db.query(MusteringEvent).filter(MusteringEvent.id == event_id).first()
            if not event:
                return {
                    'error': 'Event not found'
                }
            
            # Get zone data
            zone = self.db.query(Zone).filter(Zone.id == event.zone_id).first()
            
            # Calculate progress metrics
            progress_rate = (current_safe / total_expected) if total_expected > 0 else 0)
            elapsed_time = (datetime.utcnow() - event.start_time).total_seconds() / 60
            remaining_personnel = total_expected - current_safe
            
            # Prepare features for prediction
            features = np.array([
                progress_rate,
                elapsed_time,
                event.event_type,
                zone.max_capacity if zone else 0,
                is_drill: event.event_type == 1,
                zone.utilization_rate if zone and zone.max_capacity > 0 else 0,
                total_expected,
                current_safe,
                remaining_personnel
            ])
            
            # Make prediction
            try:
                predicted_time_minutes = self.models['completion_model'].predict([features])[0]
                confidence = self.models['completion_model'].score(features)
            except Exception as e:
                predicted_time_minutes = None
                confidence = 0.0
            
            predicted_time = datetime.utcnow() + timedelta(minutes=predicted_time_minutes) if predicted_time_minutes else 0)
            
            return {
                'current_progress': {
                    'safe_personnel': current_safe,
                    'total_expected': total_expected,
                    'completion_rate': round(progress_rate * 100, 2),
                    'elapsed_minutes': round(elapsed_time, 2),
                    'remaining_personnel': remaining_personnel
                },
                'prediction': {
                    'predicted_time': predicted_time.isoformat(),
                    'predicted_minutes': round(predicted_time_minutes, 2),
                    'confidence': round(confidence * 100, 2),
                    'method': 'ml_model'
                }
            }
            
        except Exception as e:
            logger.error(f"Error predicting completion time: {e}")
            return {
                'error': str(e)
            }
    
    def predict_duration(self, event_id: int) -> Dict[str, Any]:
        """
        Predict event duration using ML model"""
        try:
            if not hasattr(self, 'duration_model') or not self.models.get('duration_model'):
                return {
                    'predicted_duration': None,
                    'confidence': 0.0,
                    'method': 'no_model_available'
                }
            
            # Get event data
            event = self.db.query(MusteringEvent). filter(MusteringEvent.id == event_id).first()
            if not event:
                return {
                    'error': 'Event not found'
                }
            
            # Get zone data
            zone = self.db.query(Zone).filter(Zone.id == event.zone_id).first()
            
            # Calculate features for duration prediction
            elapsed_time = (datetime.utcnow() - event.start_time).total_seconds() / 60 if event.start_time else 0)
            total_expected = event.total_expected or 0
            completion_rate = (event.total_safe / total_expected) if total_expected > 0 else 0)
            
            features = np.array([
                elapsed_time,
                event.event_type,
                zone.max_capacity if zone else 0,
                is_drill: event.event_type == 1,
                zone.utilization_rate if zone and zone.max_capacity > 0 else 0,
                total_expected,
                current_safe,
                event.total_safe,
                completion_rate
            ])
            
            # Make prediction
            try:
                predicted_duration = self.models['duration_model'].predict([features])[0]
                confidence = self.models['duration_model'].score(features)
            except Exception as e:
                predicted_duration = None
                confidence = 0.0
            
            return {
                'predicted_duration': round(predicted_duration, 2),
                'confidence': round(confidence * 100, 2),
                'method': 'ml_model',
                'features_used': features.tolist()
            }
            
        except Exception as e:
            logger.error(f"Error predicting duration: {e}")
            return {
                'error': str(e)
            }
    
    def get_risk_assessment(self, event_id: int) -> Dict[str, Any]:
        """
        Get AI-powered risk assessment for an event"""
        try:
            if not hasattr(self, 'risk_model') or not self.models.get('risk_assessment_model'):
                return {
                    'risk_level': 'unknown',
                    'risk_factors': [],
                    'recommendations': [],
                    'confidence': 0.0
                }
            
            # Get event data
            event = self.db.query(MusteringEvent).filter(MusteringEvent.id == event_id).first()
            if not event:
                return {
                    'error': 'Event not found'
                }
            
            # Get recent logs
            recent_logs = self.db.query(MusteringLog).filter(
                MusteringLog.event_id == event_id
            ).order_by(desc(MusteringLog.check_time)).limit(50).all()
            
            # Calculate risk features
            risk_features = []
            for log in recent_logs:
                # Time since last check-in
                time_since_last_check = (datetime.utcnow() - log.check_time).total_seconds() / 60 if log.check_time else 0)
                
                # Status-based risk
                if log.status == 0:  # Missing
                    time_since_last_check_risk = min(time_since_last_check / 300, 1.0)  # 5 minutes
                else:
                    time_since_last_check_risk = 0.0
                
                risk_score = time_since_last_check_risk * 0.5
                
                risk_features.append(time_since_last_check_risk)
            
            # Zone-based risk
            zone_id = event.zone_id
            zone = self.db.query(Zone).filter(Zone.id == zone_id).first()
            if zone:
                zone_capacity = zone.max_capacity if zone else 0
                total_expected = event.total_expected or 0
                completion_rate = (event.total_safe / total_expected) if total_expected > 0 else 0)
                
                if zone_capacity > 0:
                    utilization_rate = (event.total_safe / zone.max_capacity) * 100)
                    if utilization_rate > 1.2:
                        zone_risk = 0.2  # Overcrowded
                    else:
                        zone_risk = 0.0
                
                risk_features.append(zone_risk)
            
            # Event type risk
            high_risk_types = [2, 3, 4]  # Fire, Gas, Man Down
            if event.event_type in high_risk_types:
                event_risk = 0.8  # Critical
                risk_features.append(event_risk)
            
            # Duration risk
            duration = (datetime.utcnow() - event.start_time).total_seconds() / 60 if event.start_time else 0
            if duration > 25:
                duration_risk = 0.3
                risk_features.append(duration_risk)
            elif duration > 15:
                duration_risk = 0.2
                risk_features.append(duration_risk)
            
            # Personnel risk
            missing_count = len([log for log in recent_logs if log.status == 0])
            if missing_count > 0:
                    missing_rate = missing_count / len(recent_logs)
                    if missing_rate > 0.2:
                        personnel_risk = 0.2  # Multiple personnel missing
                    else:
                        personnel_risk = 0.0
            
                risk_features.append(personnel_risk)
            
            # Calculate overall risk score
            if risk_features:
                risk_score = sum(risk_features) / len(risk_features)
            else:
                risk_score = 0.0
            
            # Make prediction
            if hasattr(self, 'risk_model') and len(risk_features) > 0:
                X_risk = np.array(risk_features).reshape(1, -1)
                risk_prediction = self.models['risk_model'].predict(X_risk)
                confidence = self.models['risk_model'].score(X_risk)
                
                risk_level = 'critical' if confidence > 0.7 else 'high' if confidence > 0.5 else 'medium' if confidence > 0.3 else 'low'
            else:
                risk_level = 'low'
            
            return {
                'risk_level': risk_level,
                'risk_score': risk_score,
                'risk_factors': [
                    {
                        'factor': 'time_since_last_check',
                        'value': time_since_last_check_risk,
                        'description': f"{time_since_last_check:.1f} minutes since last check-in"
                    } for time_since_last_check_risk in risk_features if isinstance(time_since_last_check_risk, (int, float))
                ],
                    {
                        'factor': 'zone_capacity',
                        'value': zone_capacity,
                        'description': f"Zone capacity: {zone_capacity}"
                    } for zone_risk in risk_features if isinstance(zone_risk, (int, float))
                    },
                    {
                        'factor': 'event_type',
                        'value': event.event_type,
                        'description': f"Event type: {event.event_type}"
                    } for event_risk in risk_features if isinstance(event_risk, (str, int))
                    },
                    {
                        'factor': 'missing_count',
                        'value': missing_count,
                        'description': f"Missing personnel: {missing_count}"
                    } for personnel_risk in risk_features if isinstance(personnel_risk, (int, float))
                    }
                ],
                ],
                'confidence': round(confidence * 100, 2),
                'recommendations': self._generate_risk_recommendations(risk_level, event, recent_logs)
            }
            
        except Exception as e:
            logger.error(f"Error getting risk assessment: {e}")
            return {
                'risk_level': 'unknown',
                'error': str(e)
            }
    
    def _generate_risk_recommendations(self, risk_level: str, event, recent_logs: List) -> List[str]:
        """Generate risk mitigation recommendations"""
        recommendations = []
        
        try:
            if risk_level == 'critical':
                recommendations.extend([
                    'Immediate evacuation required',
                    'Activate all emergency protocols',
                    'Notify all emergency services',
                    'Consider full facility lockdown'
                ])
            elif risk_level == 'high':
                recommendations.extend([
                    'Accelerate mustering efforts immediately',
                    'Increase supervisor presence at muster points',
                    'Consider additional communication channels',
                    'Review evacuation procedures'
                ])
            elif risk_level == 'medium':
                recommendations.extend([
                    'Monitor situation closely',
                    'Prepare contingency plans',
                    'Increase notification frequency',
                    'Consider additional training'
                ])
            elif risk_level == 'low':
                recommendations.extend([
                    'Continue current pace',
                    'Maintain regular monitoring',
                    'Document lessons learned',
                    'Optimize processes for next time'
                ])
            
            # Add specific recommendations based on recent logs
            missing_logs = [log for log in recent_logs if log.status == 0]
            if len(missing_logs) > 0:
                recommendations.append(f"Multiple personnel still missing: {len(missing_logs)}")
            
            long_duration_events = [
                event for event in recent_events 
                if event.end_time and event.start_time and 
                (event.end_time - event.start_time).total_seconds() / 60) > 20
            ]
            
            if len(long_duration_events) > 0:
                recommendations.append("Review time management procedures")
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return recommendations
    
    def get_anomaly_detection(self, zone_id: Optional[int] = None, days: int = 7) -> Dict[str, Any]:
        """
        Detect anomalies in mustering patterns"""
        try:
            # Get recent events for analysis
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=days)
            
            events = self.db.query(MusteringEvent).filter(
                and_(
                    MusteringEvent.start_time >= start_date,
                    MusteringEvent.start_time <= end_date
                )
            ).order_by(desc(MusteringEvent.start_time)).all()
            
            if not events:
                return {
                    'anomalies': [],
                    'message': 'No events found for analysis'
                }
            
            anomalies = []
            
            # Analyze completion rates
            completion_rates = []
            for event in events:
                if event.total_expected and event.total_expected > 0:
                    completion_rate = (event.total_safe / event.total_expected) * 100
                    completion_rates.append(completion_rate)
            
            if len(completion_rates) > 2:
                # Check for significant drops in completion rate
                recent_rates = completion_rates[-3:]  # Last 3 events
                avg_recent = sum(recent_rates) / len(recent_rates)
                current_rate = completion_rates[-1]
                
                if current_rate < avg_recent * 0.8:  # 20% drop
                    anomalies.append({
                        'type': 'completion_rate_drop',
                        'description': f"Recent completion rate: {round(current_rate * 100, 1)}% (average: {round(avg_recent * 100, 1)}%)",
                        'severity': 'high',
                        'affected_events': [event.id for event in events[-3:]]
                    })
                elif current_rate < avg_recent * 0.6:  # 40% drop
                    anomalies.append({
                        'type': 'completion_rate_drop',
                        'description': f"Recent completion rate: {round(current_rate * 100, 1)}% (average: {round(avg_recent * 100, 1)}%)",
                        'severity': 'medium',
                        'affected_events': [event.id for event in events[-3:]]
                    })
            
            # Analyze duration patterns
            durations = []
            for event in events:
                if event.end_time and event.start_time:
                    duration = (event.end_time - event.start_time).total_seconds() / 60
                    durations.append(duration)
            
            if len(durations) > 2:
                recent_durations = durations[-3:]  # Last 3 events
                avg_recent = sum(recent_durations) / len(recent_durations)
                current_duration = durations[-1]
                
                if current_duration > avg_recent * 1.5:  # 50% increase
                    anomalies.append({
                        'type': 'duration_increase',
                        'description': f"Recent duration: {round(current_duration, 1)} minutes (average: {round(avg_recent, 1)})",
                        'severity': 'medium',
                        'affected_events': [event.id for event in events[-3:]]
                    })
            
            # Check for outlier events
            if len(durations) > 0:
                mean_duration = sum(durations) / len(durations)
                std_duration = np.std(durations)
                
                outliers = [
                    event.id for event in events 
                    if event.end_time and event.start_time and
                    abs((event.end_time - event.start_time).total_seconds() / 60 - mean_duration) > 2 * std_duration)
                ]
                
                if outliers:
                    anomalies.append({
                        'type': 'duration_outlier',
                        'description': f"{len(outliers)} events with unusual duration patterns",
                        'severity': 'medium',
                        'affected_events': [event.id for event in outliers]
                    })
            
            # Check for zone-specific anomalies
            zone_performance = {}
            for event in events:
                zone_id = event.zone_id
                if zone_id not in zone_performance:
                    zone_performance[zone_id] = {'events': 0, 'metrics': {}}
                
                zone_performance[zone_id]['events'] += 1
                zone_performance[zone_id]['total_safe'] += event.total_safe or 0
                zone_performance[zone_id]['total_expected'] += event.total_expected or 0
                
                if zone.max_capacity and zone.max_capacity > 0:
                    zone_performance[zone_id]['utilization_rate'] = (zone_performance[zone_id]['total_safe'] / (zone.max_capacity * zone_performance[zone_id]['events'])) * 100)
            
            # Find zones with unusual patterns
            zone_anomalies = []
            for zone_id, zone_data in zone_performance.items():
                if zone_data['events'] > 0:
                    completion_rates = [
                        zone_data['metrics']['completion_rate']
                    for zone_id, zone_data in zone_performance.items()
                    ]
                    
                    avg_completion_rate = sum(completion_rates) / len(completion_rates)
                    
                    for zone_id, completion_rate in enumerate(completion_rates):
                        if completion_rate < avg_completion_rate * 0.7:
                            zone_anomalies.append({
                                'zone_id': zone_id,
                                'type': 'low_completion_rate',
                                'description': f"Zone {zone_id} consistently underperforming: {round(completion_rate * 100, 1)}%"
                            })
                        elif completion_rate < avg_completion_rate * 0.5:
                            zone_anomalies.append({
                                'zone_id': zone_id,
                                'type': 'medium_completion_rate',
                                'description': f"Zone {zone_id} showing declining performance trend"
                            })
            
            return {
                'anomalies': anomalies,
                'anomaly_count': len(anomalies),
                'performance_trends': {
                    'completion_rate_trend': self._calculate_trend(completion_rates),
                    'duration_trend': self._calculate_trend(durations)
                },
                    'zone_performance': zone_performance
                }
            }
            
        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            return {
                'anomalies': [],
                'error': str(e)
            }
    
    def _calculate_trend(self, values: List[float]) -> Dict[str, Any]:
        """Calculate trend from a series of values"""
        if len(values) < 2:
            return {'trend': 'insufficient_data', 'description': 'Insufficient data for trend analysis'}
        
        if len(values) < 3:
            return {'trend': 'insufficient_data', 'description': 'Insufficient data for trend analysis'}
        
        # Calculate trend
        x = np.array(range(len(values)))
        y = np.array(values)
        
        # Linear regression
        slope, intercept = np.polyfit(x, y)
        
        # Calculate R-squared
        y_pred = slope * x + intercept
        
        ss_tot = sum((y - y_pred) ** 2)
        ss_res = sum((y - y_pred) ** 2)
        
        r2 = 1 - (ss_res / ss_tot)
        
        if ss_tot == 0:
            r2 = 0
        
        if r2 < 0:
            r2 = 0
        
        trend_direction = 'improving' if slope > 0 else 'declining'
        
        return {
            'trend': trend_direction,
            'slope': round(slope, 4),
            'r_squared': round(r2, 4),
            'data_points': len(values),
            'description': f"Trend: {trend_direction} ({round(slope, 4)} R²={round(r2, 4)})"
        }
    
    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend direction and R²"""
        if len(values) < 3:
            return 'insufficient_data'
        
        x = np.array(range(len(values)))
        y = np.array(values)
        
        # Linear regression
        slope, intercept = np.polyfit(x, y)
        
        # Calculate R-squared
        y_pred = slope * x + intercept
        ss_tot = sum((y - y_pred) ** 2)
        ss_res = sum((y - y_pred) ** 2)
        
        if ss_tot == 0:
            r2 = 0
        
        if r2 < 0:
            r2 = 0
        
        r2 = max(0, r2)
        
        trend_direction = 'improving' if slope > 0 else 'declining'
        
        return trend_direction
    
    def get_predictive_analytics(self, zone_id: Optional[int] = None, days: int = 30) -> Dict[str, Any]:
        """
        Get comprehensive predictive analytics"""
        try:
            from app.services.mustering_ai_analytics import MusteringAIAnalyticsService
            ai_service = MusteringAIAnalyticsService(self.db)
            
            analytics = ai_service.get_predictive_analytics(zone_id, days)
            
            return {"success": True, "data": analytics}
            
        except Exception as e:
            logger.error(f"Error getting predictive analytics: {e}")
            return {"error": str(e)}
    
    def get_anomaly_detection(self, zone_id: Optional[int] = None, days: int = 7) -> Dict[str, Any]:
        """
        Get anomaly detection for mustering patterns"""
        try:
            from app.services.mustering_ai_analytics import MusteringAIAnalyticsService
            anomalies = ai_service.get_anomaly_detection(zone_id, days)
            
            return {"success": True, "data": anomalies}
            
        except Exception as e:
            logger.error(f"Error getting anomaly detection: {e}")
            return {"error": str(e)}

# Global AI analytics service instance
ai_analytics_service = None
