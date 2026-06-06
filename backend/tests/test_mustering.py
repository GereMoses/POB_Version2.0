"""
Mustering System Tests
Comprehensive test suite for mustering functionality
"""

import pytest
import sys
import os
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

# Add backend path
backend_path = os.path.join(os.path.dirname(__file__), '..')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app
from app.core.database import get_database_url, engine
from sqlalchemy.orm import sessionmaker
from app.models.biotime_models import MusteringZone, MusteringEvent, MusteringLog, PersonnelEmployee

# Test database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class TestMusteringAPI:
    """Test suite for mustering API endpoints"""
    
    def setup_method(self):
        """Setup test database"""
        self.db = SessionLocal()
        self.client = TestClient(app)
        
        # Create test zone
        self.test_zone = MusteringZone(
            name="Test Zone",
            capacity=100,
            evac_point="Test Assembly Point",
            evac_gps="6.5244,3.3792",
            zone_type=0,
            area_id=1
        )
        self.db.add(self.test_zone)
        self.db.commit()
        self.db.refresh(self.test_zone)
        
        # Create test employee
        self.test_employee = PersonnelEmployee(
            emp_code="TEST001",
            name="Test Employee",
            dept_id=1,
            status=0
        )
        self.db.add(self.test_employee)
        self.db.commit()
        self.db.refresh(self.test_employee)
    
    def teardown_method(self):
        """Cleanup test database"""
        self.db.close()
    
    def test_create_zone_success(self):
        """Test successful zone creation"""
        zone_data = {
            "name": "New Test Zone",
            "capacity": 50,
            "evac_point": "New Assembly Point",
            "zone_type": 0
        }
        
        response = self.client.post(
            "/api/mustering/zones/",
            json=zone_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "id" in data["data"]
    
    def test_create_zone_validation_error(self):
        """Test zone creation with validation error"""
        zone_data = {
            "name": "",  # Empty name should fail
            "capacity": -10,  # Negative capacity should fail
            "zone_type": 5  # Invalid zone type
        }
        
        response = self.client.post(
            "/api/mustering/zones/",
            json=zone_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_start_mustering_event_success(self):
        """Test successful mustering event start"""
        event_data = {
            "zone_id": self.test_zone.id,
            "event_type": 1,  # Drill
            "notify_sms": False,
            "notify_email": False,
            "notify_whatsapp": False,
            "notify_siren": False,
            "notes": "Test event"
        }
        
        response = self.client.post(
            "/api/mustering/events/start/",
            json=event_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "event_id" in data["data"]
        
        # Store event ID for subsequent tests
        self.event_id = data["data"]["event_id"]
    
    def test_start_event_invalid_zone(self):
        """Test event start with invalid zone"""
        event_data = {
            "zone_id": 99999,  # Non-existent zone
            "event_type": 1
        }
        
        response = self.client.post(
            "/api/mustering/events/start/",
            json=event_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 404
    
    def test_get_event_headcount(self):
        """Test getting event headcount"""
        if not hasattr(self, 'event_id'):
            pytest.skip("No event ID available")
        
        response = self.client.get(
            f"/api/mustering/events/{self.event_id}/headcount/",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "total_expected" in data["data"]
        assert "total_safe" in data["data"]
        assert "total_missing" in data["data"]
        assert "completion_percentage" in data["data"]
    
    def test_get_event_logs(self):
        """Test getting event logs"""
        if not hasattr(self, 'event_id'):
            pytest.skip("No event ID available")
        
        response = self.client.get(
            f"/api/mustering/events/{self.event_id}/logs/",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "logs" in data["data"]
        assert isinstance(data["data"]["logs"], list)
    
    def test_mark_person_safe(self):
        """Test marking person as safe"""
        if not hasattr(self, 'event_id'):
            pytest.skip("No event ID available")
        
        mark_data = {
            "emp_code": "TEST001",
            "status": 1  # Safe
        }
        
        response = self.client.post(
            f"/api/mustering/events/{self.event_id}/mark/",
            json=mark_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
    
    def test_end_mustering_event(self):
        """Test ending mustering event"""
        if not hasattr(self, 'event_id'):
            pytest.skip("No event ID available")
        
        end_data = {
            "reason": "Test completed"
        }
        
        response = self.client.post(
            f"/api/mustering/events/{self.event_id}/end/",
            json=end_data,
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "duration" in data["data"]
        assert "final_headcount" in data["data"]
    
    def test_list_zones(self):
        """Test listing zones"""
        response = self.client.get(
            "/api/mustering/zones/",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert isinstance(data["data"], list)
        
        # Check if our test zone is in the list
        zone_ids = [zone["id"] for zone in data["data"]]
        assert self.test_zone.id in zone_ids
    
    def test_list_events(self):
        """Test listing events"""
        response = self.client.get(
            "/api/mustering/events/",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert isinstance(data["data"], list)
    
    def test_unauthorized_access(self):
        """Test unauthorized access"""
        response = self.client.get(
            "/api/mustering/zones/"
            # No authorization header
        )
        
        assert response.status_code == 401

class TestMusteringService:
    """Test suite for mustering service layer"""
    
    def setup_method(self):
        """Setup test database"""
        self.db = SessionLocal()
        
        # Create test zone
        self.test_zone = MusteringZone(
            name="Test Zone",
            capacity=100,
            evac_point="Test Assembly Point",
            zone_type=0,
            area_id=1
        )
        self.db.add(self.test_zone)
        self.db.commit()
        self.db.refresh(self.test_zone)
        
        # Create test employee
        self.test_employee = PersonnelEmployee(
            emp_code="TEST001",
            name="Test Employee",
            dept_id=1,
            status=0
        )
        self.db.add(self.test_employee)
        self.db.commit()
        self.db.refresh(self.test_employee)
    
    def teardown_method(self):
        """Cleanup test database"""
        self.db.close()
    
    def test_start_mustering_event(self):
        """Test mustering service start event"""
        from app.services.mustering_service import MusteringService
        
        service = MusteringService(self.db)
        
        result = service.start_mustering_event(
            zone_id=self.test_zone.id,
            event_type=1,  # Drill
            initiated_by=1,
            notify_sms=False,
            notify_email=False,
            notify_whatsapp=False,
            notify_siren=False,
            notes="Test event"
        )
        
        assert "event_id" in result
        assert result["total_expected"] >= 0
        assert result["status"] == "started"
        
        # Store event ID for subsequent tests
        self.event_id = result["event_id"]
    
    def test_get_event_headcount(self):
        """Test getting event headcount"""
        if not hasattr(self, 'event_id'):
            pytest.skip("No event ID available")
        
        from app.services.mustering_service import MusteringService
        service = MusteringService(self.db)
        
        headcount = service.get_event_headcount(self.event_id)
        
        assert "event_id" in headcount
        assert "total_expected" in headcount
        assert "total_safe" in headcount
        assert "total_missing" in headcount
        assert "completion_percentage" in headcount
    
    def test_mark_person_status(self):
        """Test marking person status"""
        if not hasattr(self, 'event_id'):
            pytest.skip("No event ID available")
        
        from app.services.mustering_service import MusteringService
        service = MusteringService(self.db)
        
        result = service.mark_person_status(
            event_id=self.event_id,
            emp_code="TEST001",
            status=1,  # Safe
            marked_by=1
        )
        
        assert "event_id" in result
        assert result["emp_code"] == "TEST001"
        assert result["new_status"] == 1
        assert result["marked_by"] == 1
    
    def test_end_mustering_event(self):
        """Test ending mustering event"""
        if not hasattr(self, 'event_id'):
            pytest.skip("No event ID available")
        
        from app.services.mustering_service import MusteringService
        service = MusteringService(self.db)
        
        result = service.end_mustering_event(
            event_id=self.event_id,
            ended_by=1,
            reason="Test completed"
        )
        
        assert "event_id" in result
        assert result["status"] == "completed"
        assert "duration" in result
        assert "final_headcount" in result
    
    def test_process_mustering_punch(self):
        """Test processing mustering punch"""
        from app.services.mustering_service import MusteringService
        
        # First, start an event
        service = MusteringService(self.db)
        event_result = service.start_mustering_event(
            zone_id=self.test_zone.id,
            event_type=1,
            initiated_by=1,
            notify_sms=False,
            notify_email=False,
            notify_whatsapp=False,
            notify_siren=False,
            notes="Punch test"
        )
        event_id = event_result["event_id"]
        
        # Process a punch
        punch_result = service.process_mustering_punch(
            emp_code="TEST001",
            device_sn="TEST001",
            check_time=datetime.utcnow()
        )
        
        assert "event_id" in punch_result
        assert punch_result["emp_code"] == "TEST001"
        assert punch_result["status"] == "safe"
        
        # Check that headcount updated
        updated_headcount = service.get_event_headcount(event_id)
        assert updated_headcount["total_safe"] > 0

class TestMusteringIntegration:
    """Integration tests for mustering system"""
    
    def setup_method(self):
        """Setup integration test"""
        self.db = SessionLocal()
        
        # Create test zone
        self.test_zone = MusteringZone(
            name="Integration Test Zone",
            capacity=50,
            evac_point="Integration Assembly Point",
            zone_type=0,
            area_id=1
        )
        self.db.add(self.test_zone)
        self.db.commit()
        self.db.refresh(self.test_zone)
    
    def teardown_method(self):
        """Cleanup integration test"""
        self.db.close()
    
    def test_complete_mustering_workflow(self):
        """Test complete mustering workflow"""
        from app.services.mustering_service import MusteringService
        
        service = MusteringService(self.db)
        
        # 1. Start event
        event_result = service.start_mustering_event(
            zone_id=self.test_zone.id,
            event_type=1,  # Drill
            initiated_by=1,
            notify_sms=False,
            notify_email=False,
            notify_whatsapp=False,
            notify_siren=False,
            notes="Integration test"
        )
        event_id = event_result["event_id"]
        
        # 2. Get initial headcount
        initial_headcount = service.get_event_headcount(event_id)
        assert initial_headcount["total_missing"] > 0
        assert initial_headcount["total_safe"] == 0
        
        # 3. Process multiple punches
        test_employees = ["TEST001", "TEST002", "TEST003"]
        for i, emp_code in enumerate(test_employees):
            service.process_mustering_punch(
                emp_code=emp_code,
                device_sn=f"TEST{i:03d}",
                check_time=datetime.utcnow()
            )
        
        # 4. Get updated headcount
        updated_headcount = service.get_event_headcount(event_id)
        assert updated_headcount["total_safe"] == len(test_employees)
        assert updated_headcount["total_missing"] == 0
        
        # 5. Mark one person as injured
        service.mark_person_status(
            event_id=event_id,
            emp_code="TEST001",
            status=2,  # Injured
            marked_by=1
        )
        
        # 6. Get final headcount
        final_headcount = service.get_event_headcount(event_id)
        assert final_headcount["total_safe"] == 2
        assert final_headcount["total_injured"] == 1
        
        # 7. End event
        end_result = service.end_mustering_event(
            event_id=event_id,
            ended_by=1,
            reason="Integration test completed"
        )
        
        assert end_result["status"] == "completed"
        assert end_result["final_headcount"]["total_safe"] == 2
        assert end_result["final_headcount"]["total_injured"] == 1

if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v"])
