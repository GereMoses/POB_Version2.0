"""
Mustering Simulation and Training Service
Provides simulation mode for training and testing without affecting real data
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
import json

from app.models.biotime_models import (
    MusteringEvent, MusteringLog, PersonnelEmployee
)
from app.models.zone import Zone

logger = logging.getLogger(__name__)

class MusteringSimulationService:
    """Mustering simulation service for training and testing"""
    
    def __init__(self, db: Session):
        self.db = db
        self.is_simulation_mode = False
        self.simulation_events = {}  # {simulation_id: event_data}
        self.simulation_logs = {}  # {simulation_id: [logs]}
    
    def start_simulation_mode(
        self,
        simulation_name: str,
        zone_id: int,
        event_type: int,
        participants: Optional[List[str]] = None,
        scenario_type: str = "drill"  # drill, fire, gas, man_down
        duration_minutes: int = 10
        auto_progress: bool = True
    ) -> Dict[str, Any]:
        """
        Start a mustering simulation for training
        """
        try:
            # Validate zone exists
            zone = self.db.query(Zone).filter(Zone.id == zone_id).first()
            if not zone:
                raise ValueError(f"Zone {zone_id} not found")
            
            # Generate simulation ID
            simulation_id = f"sim_{datetime.utcnow().timestamp()}"
            
            # Create simulation event (not real)
            simulation_event = {
                'simulation_id': simulation_id,
                'simulation_name': simulation_name,
                'zone_id': zone_id,
                'zone_name': zone.name,
                'event_type': event_type,
                'scenario_type': scenario_type,
                'start_time': datetime.utcnow(),
                'duration_minutes': duration_minutes,
                'participants': participants or [],
                'auto_progress': auto_progress,
                'status': 'active',
                'progress': {
                    'current_step': 0,
                    'total_steps': 5,
                    'step_name': 'Initialization'
                }
            }
            
            self.simulation_events[simulation_id] = simulation_event
            self.is_simulation_mode = True
            
            # Initialize simulation logs
            self.simulation_logs[simulation_id] = []
            
            logger.info(f"Started mustering simulation: {simulation_name} (ID: {simulation_id})")
            
            return {
                'success': True,
                'simulation_id': simulation_id,
                'message': f"Simulation '{simulation_name}' started successfully",
                'event_data': simulation_event
            }
            
        except Exception as e:
            logger.error(f"Error starting simulation: {e}")
            raise
    
    def end_simulation_mode(self, simulation_id: str) -> Dict[str, Any]:
        """
        End a mustering simulation
        """
        try:
            if simulation_id not in self.simulation_events:
                raise ValueError(f"Simulation {simulation_id} not found")
            
            simulation_event = self.simulation_events[simulation_id]
            simulation_event['status'] = 'completed'
            simulation_event['end_time'] = datetime.utcnow()
            simulation_event['duration_seconds'] = (
                simulation_event['end_time'] - simulation_event['start_time']
            ).total_seconds()
            
            # Calculate final statistics
            logs = self.simulation_logs.get(simulation_id, [])
            total_participants = len(set(log['emp_code'] for log in logs))
            safe_count = len([log for log in logs if log['status'] == 1])
            missing_count = len([log for log in logs if log['status'] == 0])
            
            simulation_event['final_statistics'] = {
                'total_participants': total_participants,
                'total_safe': safe_count,
                'total_missing': missing_count,
                'completion_rate': (safe_count / total_participants * 100) if total_participants > 0 else 0,
                'simulation_duration': simulation_event['duration_seconds'] / 60
            }
            
            logger.info(f"Ended mustering simulation: {simulation_id}")
            
            return {
                'success': True,
                'simulation_id': simulation_id,
                'message': f"Simulation '{simulation_event['simulation_name']}' completed",
                'final_statistics': simulation_event['final_statistics']
            }
            
        except Exception as e:
            logger.error(f"Error ending simulation: {e}")
            raise
    
    def simulate_punch(
        self,
        simulation_id: str,
        emp_code: str,
        device_sn: str,
        status: int = 1,  # Safe by default
        gps_coordinates: Optional[str] = None
        response_delay_seconds: int = 0
    ) -> Dict[str, Any]:
        """
        Simulate a punch during simulation
        """
        try:
            if simulation_id not in self.simulation_events:
                raise ValueError(f"Simulation {simulation_id} not found")
            
            simulation_event = self.simulation_events[simulation_id]
            
            if simulation_event['status'] != 'active':
                raise ValueError(f"Simulation {simulation_id} is not active")
            
            # Create simulation log
            simulation_log = {
                'simulation_id': simulation_id,
                'emp_code': emp_code,
                'check_time': datetime.utcnow(),
                'device_sn': device_sn,
                'status': status,
                'gps': gps_coordinates,
                'response_delay_seconds': response_delay_seconds,
                'simulated': True
            }
            
            self.simulation_logs[simulation_id].append(simulation_log)
            
            # Update simulation progress
            current_step = simulation_event['progress']['current_step']
            total_steps = simulation_event['progress']['total_steps']
            
            if current_step < total_steps:
                simulation_event['progress']['current_step'] = current_step + 1
                
                # Define step names
                step_names = [
                    'Initialization',
                    'Personnel Check-in',
                    'Emergency Response',
                    'Headcount Update',
                    'Completion'
                ]
                
                if current_step + 1 < len(step_names):
                    simulation_event['progress']['step_name'] = step_names[current_step + 1]
            
            logger.info(f"Simulation punch: {emp_code} -> {status} in simulation {simulation_id}")
            
            return {
                'success': True,
                'simulation_id': simulation_id,
                'message': f"Simulated punch for {emp_code}",
                'log_data': simulation_log
            }
            
        except Exception as e:
            logger.error(f"Error simulating punch: {e}")
            raise
    
    def get_simulation_progress(self, simulation_id: str) -> Dict[str, Any]:
        """
        Get simulation progress and status
        """
        try:
            if simulation_id not in self.simulation_events:
                raise ValueError(f"Simulation {simulation_id} not found")
            
            simulation_event = self.simulation_events[simulation_id]
            logs = self.simulation_logs.get(simulation_id, [])
            
            # Calculate progress metrics
            total_participants = len(set(log['emp_code'] for log in logs))
            safe_count = len([log for log in logs if log['status'] == 1])
            missing_count = len([log for log in logs if log['status'] == 0])
            
            progress_percentage = 0
            if total_participants > 0:
                progress_percentage = (safe_count / total_participants) * 100
            
            return {
                'simulation_id': simulation_id,
                'simulation_name': simulation_event['simulation_name'],
                'status': simulation_event['status'],
                'start_time': simulation_event['start_time'],
                'duration_minutes': (datetime.utcnow() - simulation_event['start_time']).total_seconds() / 60,
                'progress': simulation_event['progress'],
                'statistics': {
                    'total_participants': total_participants,
                    'total_safe': safe_count,
                    'total_missing': missing_count,
                    'completion_percentage': round(progress_percentage, 2),
                    'total_punches': len(logs)
                },
                'logs': logs[-10:] if logs else []  # Last 10 logs
            }
            
        except Exception as e:
            logger.error(f"Error getting simulation progress: {e}")
            raise
    
    def get_active_simulations(self) -> List[Dict[str, Any]]:
        """
        Get all active simulations
        """
        try:
            active_simulations = []
            
            for sim_id, sim_event in self.simulation_events.items():
                if sim_event['status'] == 'active':
                    progress = self.get_simulation_progress(sim_id)
                    active_simulations.append(progress)
            
            return active_simulations
            
        except Exception as e:
            logger.error(f"Error getting active simulations: {e}")
            raise
    
    def get_simulation_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get simulation history
        """
        try:
            history = []
            
            for sim_id, sim_event in self.simulation_events.items():
                progress = self.get_simulation_progress(sim_id)
                history.append(progress)
            
            # Sort by start time (newest first)
            history.sort(key=lambda x: x['start_time'], reverse=True)
            
            return history[:limit]
            
        except Exception as e:
            logger.error(f"Error getting simulation history: {e}")
            raise
    
    def auto_progress_simulation(self, simulation_id: str) -> Dict[str, Any]:
        """
        Automatically progress through simulation steps
        """
        try:
            if simulation_id not in self.simulation_events:
                raise ValueError(f"Simulation {simulation_id} not found")
            
            simulation_event = self.simulation_events[simulation_id]
            
            if not simulation_event['auto_progress']:
                return {
                    'success': False,
                    'message': 'Auto-progress is not enabled for this simulation'
                }
            
            # Simulate random check-ins based on participants
            participants = simulation_event['participants']
            if not participants:
                # Use some test participants
                participants = ['SIM001', 'SIM002', 'SIM003', 'SIM004', 'SIM005']
            
            # Simulate check-ins over time
            import random
            num_checkins = random.randint(3, 8)
            
            for i in range(num_checkins):
                emp_code = random.choice(participants)
                device_sn = f"SIM_DEVICE_{random.randint(1, 3):03d}"
                
                # Random status (90% safe, 10% missing)
                status = 1 if random.random() < 0.9 else 0
                
                self.simulate_punch(
                    simulation_id=simulation_id,
                    emp_code=emp_code,
                    device_sn=device_sn,
                    status=status,
                    response_delay_seconds=random.randint(5, 30)
                )
                
                # Small delay between check-ins
                import time
                time.sleep(0.5)
            
            return {
                'success': True,
                'message': f"Auto-progressed simulation with {num_checkins} check-ins",
                'simulation_id': simulation_id
            }
            
        except Exception as e:
            logger.error(f"Error in auto-progress simulation: {e}")
            raise
    
    def create_training_scenario(
        self,
        scenario_name: str,
        zone_id: int,
        scenario_type: str,
        description: str,
        steps: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create a training scenario for simulation
        """
        try:
            # Validate zone exists
            zone = self.db.query(Zone).filter(Zone.id == zone_id).first()
            if not zone:
                raise ValueError(f"Zone {zone_id} not found")
            
            scenario = {
                'scenario_name': scenario_name,
                'zone_id': zone_id,
                'zone_name': zone.name,
                'scenario_type': scenario_type,
                'description': description,
                'steps': steps,
                'created_at': datetime.utcnow(),
                'is_active': True
            }
            
            # In a real implementation, this would be saved to database
            # For now, return the scenario data
            
            logger.info(f"Created training scenario: {scenario_name}")
            
            return {
                'success': True,
                'message': f"Training scenario '{scenario_name}' created",
                'scenario': scenario
            }
            
        except Exception as e:
            logger.error(f"Error creating training scenario: {e}")
            raise
    
    def get_training_scenarios(self, zone_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get available training scenarios
        """
        try:
            # Return predefined scenarios (in real implementation, these would come from database)
            scenarios = [
                {
                    'scenario_name': 'Fire Evacuation',
                    'scenario_type': 'fire',
                    'description': 'Simulate fire emergency with rapid evacuation',
                    'steps': [
                        {'step': 1, 'name': 'Alarm Activation', 'description': 'Trigger fire alarm'},
                        {'step': 2, 'name': 'Evacuation Start', 'description': 'Begin evacuation process'},
                        {'step': 3, 'name': 'Headcount Check', 'description': 'Verify all personnel accounted for'},
                        {'step': 4, 'name': 'Emergency Services', 'description': 'Notify emergency services'},
                        {'step': 5, 'name': 'All Clear', 'description': 'Confirm all personnel safe'}
                    ],
                    'estimated_duration': 15
                },
                {
                    'scenario_name': 'Gas Leak Response',
                    'scenario_type': 'gas',
                    'description': 'Simulate gas leak with shelter in place',
                    'steps': [
                        {'step': 1, 'name': 'Gas Detection', 'description': 'Detect gas leak'},
                        {'step': 2, 'name': 'Shelter Order', 'description': 'Order personnel to safe shelter'},
                        {'step': 3, 'name': 'Headcount', 'description': 'Account for all personnel'},
                        {'step': 4, 'name': 'All Clear', 'description': 'Confirm shelter secured'}
                    ],
                    'estimated_duration': 20
                },
                {
                    'scenario_name': 'Medical Emergency',
                    'scenario_type': 'medical',
                    'description': 'Simulate medical emergency with triage',
                    'steps': [
                        {'step': 1, 'name': 'Emergency Alert', 'description': 'Alert medical team'},
                        {'step': 2, 'name': 'Triage Setup', 'description': 'Establish triage area'},
                        {'step': 3, 'name': 'Patient Assessment', 'description': 'Assess and categorize patients'},
                        {'step': 4, 'name': 'Transport Coordination', 'description': 'Arrange medical transport'},
                        {'step': 5, 'name': 'All Clear', 'description': 'Complete medical response'}
                    ],
                    'estimated_duration': 25
                },
                {
                    'scenario_name': 'Security Lockdown',
                    'scenario_type': 'security',
                    'description': 'Simulate security threat with lockdown',
                    'steps': [
                        {'step': 1, 'name': 'Threat Assessment', 'description': 'Assess security threat'},
                        {'step': 2, 'name': 'Lockdown Initiation', 'description': 'Initiate facility lockdown'},
                        {'step': 3, 'name': 'Secure Perimeter', 'description': 'Secure all access points'},
                        {'step': 4, 'name': 'Headcount', 'description': 'Account for all personnel'},
                        {'step': 5, 'name': 'All Clear', 'description': 'Confirm facility secured'}
                    ],
                    'estimated_duration': 30
                }
            ]
            
            # Filter by zone if specified
            if zone_id:
                try:
                    zone = self.db.query(Zone).filter(Zone.id == zone_id).first()
                    if zone:
                        scenarios = [s for s in scenarios if s['zone_id'] == zone_id]
                except Exception as e:
                    logger.warning(f"Unexpected error: {e}")  # If zone not found, return all scenarios
            
            return scenarios
            
        except Exception as e:
            logger.error(f"Error getting training scenarios: {e}")
            raise
    
    def is_simulation_active(self) -> bool:
        """Check if any simulation is currently active"""
        return self.is_simulation_mode
    
    def get_simulation_metrics(self) -> Dict[str, Any]:
        """Get overall simulation metrics"""
        try:
            total_simulations = len(self.simulation_events)
            active_simulations = len([s for s in self.simulation_events.values() if s['status'] == 'active'])
            completed_simulations = len([s for s in self.simulation_events.values() if s['status'] == 'completed'])
            
            total_punches = sum(len(logs) for logs in self.simulation_logs.values())
            
            return {
                'total_simulations': total_simulations,
                'active_simulations': active_simulations,
                'completed_simulations': completed_simulations,
                'total_simulated_punches': total_punches,
                'simulation_mode_active': self.is_simulation_mode,
                'available_scenarios': len(self.get_training_scenarios()),
                'last_activity': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting simulation metrics: {e}")
            raise
