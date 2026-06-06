# ZKTeco CVSecurity API Integration Technical Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Module Structure](#module-structure)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [API Integration Details](#api-integration-details)
7. [Data Models](#data-models)
8. [Security Considerations](#security-considerations)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Migration Strategy](#migration-strategy)
11. [Testing & Validation](#testing--validation)
12. [Maintenance & Support](#maintenance--support)

---

## Executive Summary

This document outlines the comprehensive integration of ZKTeco CVSecurity API with the existing POB (Personnel on Board) management system for oil and gas operations. The integration enhances the system with enterprise-grade access control, biometric authentication, real-time monitoring, and advanced security features while preserving critical oil & gas specific functionality.

### Key Objectives
- Replace custom access control implementations with ZKTeco professional APIs
- Enhance existing critical modules (Personnel Tracking, Muster Management, Zones Management)
- Implement enterprise-grade security features
- Maintain oil & gas industry-specific functionality
- Ensure seamless data synchronization between systems

---

## System Architecture Overview

### High-Level Architecture
```
ZKTeco Devices (Readers, Cameras, Alarms)
    |
    v
ZKTeco CVSecurity API Server
    |
    v
POB Backend (FastAPI) <--> Database (PostgreSQL)
    |
    v
POB Frontend (React/Vue) <--> Mobile App
```

### Integration Pattern
- **Bidirectional Synchronization**: Data flows both ways between POB and ZKTeco systems
- **Real-time Updates**: WebSocket connections for live monitoring
- **API Gateway**: Centralized API management for both systems
- **Data Lake**: Unified data storage for analytics and reporting

---

## Module Structure

### Backend Module Organization

#### 1. ZKTeco Integration Modules (NEW)
```
backend/app/api/zkteco/
    auth.py                    # ZKTeco authentication & token management
    personnel.py               # Personnel CRUD with biometric sync
    access_control.py          # Door/reader management
    attendance.py              # Enhanced attendance with biometrics
    visitors.py                # Professional visitor management
    parking.py                 # Parking operations
    surveillance.py            # Video surveillance integration
    alarms.py                  # Intrusion detection & alarms
    devices.py                 # Device management & monitoring
    transactions.py 
    
               # Access log management
```

#### 2. Critical Modules (KEEP & ENHANCE)
```
backend/app/api/critical/
    personnel_tracking.py      # Enhanced with ZKTeco real-time data
    muster.py                  # Enhanced with ZKTeco alarm integration
    zones.py                   # Enhanced with ZKTeco access levels
```

#### 3. POB Core Modules (KEEP)
```
backend/app/api/pob/
    pob_status.py              # Personnel on board management
    emergency.py               # Emergency response system
```

#### 4. Operations Modules (KEEP)
```
backend/app/api/operations/
    transport.py               # Transport logistics
    permits.py                 # Permit-to-work management
    training.py                # Industry-specific training
    safety_passport.py         # Safety passport management
```

### Frontend Module Organization

#### 1. ZKTeco Views (NEW)
```
frontend/src/views/zkteco/
    PersonnelManagement.vue    # Enhanced personnel with biometrics
    AccessControl.vue          # Door/reader management
    VisitorManagement.vue      # Professional visitor system
    Surveillance.vue           # Video surveillance
    DeviceManagement.vue       # Device monitoring
    ParkingManagement.vue      # Parking operations
```

#### 2. Critical Views (ENHANCED)
```
frontend/src/views/critical/
    PersonnelTracking.vue      # Real-time tracking with ZKTeco data
    MusterManagement.vue       # Emergency muster with alarms
    ZonesManagement.vue        # Zone management with access control
```

#### 3. POB Views (KEEP)
```
frontend/src/views/pob/
    Dashboard.vue              # Main dashboard
    EmergencyManagement.vue    # Emergency response
```

---

## Backend Implementation

### 1. ZKTeco Integration Service

#### Authentication Service
```python
# app/services/zkteco/zkteco_auth.py
class ZKTecoAuthService:
    def __init__(self):
        self.base_url = os.getenv("ZKTECO_API_URL")
        self.access_token = None
        self.token_expiry = None
    
    async def authenticate(self) -> str:
        """Authenticate with ZKTeco API and return access token"""
        auth_data = {
            "username": os.getenv("ZKTECO_USERNAME"),
            "password": os.getenv("ZKTECO_PASSWORD")
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/auth/login",
                json=auth_data
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                self.token_expiry = datetime.now() + timedelta(hours=24)
                return self.access_token
            else:
                raise ZKTecoAPIException("Authentication failed")
    
    async def get_valid_token(self) -> str:
        """Get valid access token, refresh if needed"""
        if not self.access_token or self.token_expiry <= datetime.now():
            await self.authenticate()
        return self.access_token
```

#### Personnel Synchronization Service
```python
# app/services/zkteco/personnel_sync.py
class PersonnelSyncService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def sync_personnel_to_zkteco(self, personnel_data: dict) -> dict:
        """Sync personnel data to ZKTeco system"""
        token = await self.zkteco_client.get_valid_token()
        
        zkteco_payload = {
            "pin": personnel_data["pin"],
            "name": personnel_data["name"],
            "lastName": personnel_data["last_name"],
            "deptCode": personnel_data["department_code"],
            "gender": personnel_data["gender"],
            "cardNo": personnel_data.get("card_number", ""),
            "personPhoto": personnel_data.get("photo_base64", ""),
            "accLevelIds": personnel_data.get("access_levels", ""),
            "accStartTime": personnel_data.get("access_start", ""),
            "accEndTime": personnel_data.get("access_end", "")
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.zkteco_client.base_url}/api/person/add",
                json=zkteco_payload,
                headers={"Authorization": f"Bearer {token}"}
            )
            
            return response.json()
    
    async def sync_biometric_templates(self, personnel_id: int, templates: list) -> dict:
        """Sync biometric templates to ZKTeco"""
        token = await self.zkteco_client.get_valid_token()
        
        for template in templates:
            payload = {
                "pin": str(personnel_id),
                "templateData": template["template_data"],
                "templateType": template["type"],  # fingerprint, face
                "fingerIndex": template.get("finger_index", 0)
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.zkteco_client.base_url}/api/fingerprint/add",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if response.status_code != 200:
                    raise ZKTecoAPIException(f"Biometric sync failed: {response.text}")
        
        return {"success": True, "message": "Biometric templates synced"}
```

#### Real-time Monitoring Service
```python
# app/services/zkteco/real_time_monitoring.py
class RealTimeMonitoringService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
        self.websocket_connections = []
    
    async def start_monitoring(self):
        """Start real-time monitoring of ZKTeco events"""
        token = await self.zkteco_client.get_valid_token()
        
        # WebSocket connection for real-time events
        ws_url = f"{self.zkteco_client.base_url.replace('http', 'ws')}/api/realtime/events"
        
        async with websockets.connect(ws_url, extra_headers={"Authorization": f"Bearer {token}"}) as websocket:
            async for message in websocket:
                event_data = json.loads(message)
                await self.process_real_time_event(event_data)
    
    async def process_real_time_event(self, event_data: dict):
        """Process real-time events from ZKTeco"""
        event_type = event_data.get("eventType")
        
        if event_type == "ACCESS_EVENT":
            await self.handle_access_event(event_data)
        elif event_type == "ALARM_EVENT":
            await self.handle_alarm_event(event_data)
        elif event_type == "DEVICE_STATUS":
            await self.handle_device_status(event_data)
    
    async def handle_access_event(self, event_data: dict):
        """Handle access control events"""
        # Update personnel tracking
        await self.update_personnel_location(event_data)
        
        # Update zone occupancy
        await self.update_zone_occupancy(event_data)
        
        # Send real-time updates to frontend
        await self.broadcast_to_frontend(event_data)
```

### 2. Enhanced Critical Modules

#### Personnel Tracking Enhancement
```python
# app/services/critical/enhanced_personnel_tracking.py
class EnhancedPersonnelTrackingService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def get_real_time_position(self, personnel_id: int) -> dict:
        """Get real-time position using ZKTeco access logs"""
        token = await self.zkteco_client.get_valid_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.zkteco_client.base_url}/api/transaction/person/{personnel_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                access_data = response.json()
                latest_access = access_data["data"][0] if access_data["data"] else None
                
                if latest_access:
                    return {
                        "personnel_id": personnel_id,
                        "current_zone": latest_access.get("areaName"),
                        "last_access": latest_access.get("eventTime"),
                        "entry_point": latest_access.get("readerName"),
                        "device_sn": latest_access.get("devSn"),
                        "confidence": "HIGH"  # Biometric verified
                    }
        
        return {"personnel_id": personnel_id, "status": "NOT_DETECTED"}
    
    async def get_zone_occupancy(self, zone_code: str) -> dict:
        """Get real-time zone occupancy"""
        token = await self.zkteco_client.get_valid_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.zkteco_client.base_url}/api/accAdvanced/getWhoIsInsideByZone",
                params={"code": zone_code},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                personnel_data = response.json()
                return {
                    "zone_code": zone_code,
                    "current_occupancy": len(personnel_data["data"]),
                    "personnel_list": personnel_data["data"],
                    "last_updated": datetime.now().isoformat()
                }
        
        return {"zone_code": zone_code, "current_occupancy": 0, "personnel_list": []}
```

#### Muster Management Enhancement
```python
# app/services/critical/enhanced_muster_management.py
class EnhancedMusterManagementService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def trigger_emergency_muster(self, emergency_type: str, muster_points: list) -> dict:
        """Trigger emergency muster using ZKTeco alarm system"""
        token = await self.zkteco_client.get_valid_token()
        
        # Trigger alarm on all ZKTeco devices
        alarm_payload = {
            "deviceName": "Emergency Control",
            "partitionName": "Main Partition",
            "pointName": emergency_type,
            "eventName": "EMERGENCY_MUSTER",
            "eventLevel": "CRITICAL"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.zkteco_client.base_url}/api/intrusionAlarm/trigger",
                json=alarm_payload,
                headers={"Authorization": f"Bearer {token}"}
            )
        
        # Lock down all access points except muster points
        await self.emergency_lockdown(muster_points)
        
        return {"success": True, "message": "Emergency muster triggered"}
    
    async def emergency_lockdown(self, muster_points: list):
        """Lock down all access points except muster points"""
        token = await self.zkteco_client.get_valid_token()
        
        # Get all doors
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.zkteco_client.base_url}/api/door/list",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            doors = response.json().get("data", [])
            
            for door in doors:
                if door["name"] not in muster_points:
                    # Lock door
                    await client.post(
                        f"{self.zkteco_client.base_url}/api/door/remoteClose",
                        json={"id": door["id"]},
                        headers={"Authorization": f"Bearer {token}"}
                    )
    
    async def get_real_time_muster_status(self) -> dict:
        """Get real-time muster status"""
        # Get all personnel access events in last 30 minutes
        token = await self.zkteco_client.get_valid_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.zkteco_client.base_url}/api/transaction/list",
                params={"pageNo": 1, "pageSize": 1000},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            access_events = response.json().get("data", [])
            
            # Process muster status
            accounted_personnel = set()
            for event in access_events:
                if datetime.fromisoformat(event["eventTime"]) >= datetime.now() - timedelta(minutes=30):
                    accounted_personnel.add(event["pin"])
            
            total_personnel = await self.get_total_personnel_count()
            missing_count = total_personnel - len(accounted_personnel)
            
            return {
                "total_personnel": total_personnel,
                "accounted_for": len(accounted_personnel),
                "missing_personnel": missing_count,
                "muster_points": await self.get_muster_point_status(),
                "last_update": datetime.now().isoformat()
            }
```

---

## Frontend Implementation

### 1. ZKTeco API Client Service

```javascript
// frontend/src/services/zkteco.api.js
class ZKTecoAPIService {
    constructor() {
        this.baseURL = process.env.VUE_APP_ZKTECO_API_URL || 'http://localhost:8080/api';
        this.token = null;
        this.tokenExpiry = null;
    }

    async authenticate(username, password) {
        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                this.token = data.access_token;
                this.tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                return data;
            } else {
                throw new Error('Authentication failed');
            }
        } catch (error) {
            console.error('ZKTeco authentication error:', error);
            throw error;
        }
    }

    async getValidToken() {
        if (!this.token || this.tokenExpiry <= new Date()) {
            // Re-authenticate with stored credentials
            await this.authenticate(
                localStorage.getItem('zkteco_username'),
                localStorage.getItem('zkteco_password')
            );
        }
        return this.token;
    }

    async getPersonnelList(page = 1, pageSize = 100) {
        const token = await this.getValidToken();
        
        try {
            const response = await fetch(`${this.baseURL}/person/list?pageNo=${page}&pageSize=${pageSize}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to fetch personnel list');
            }
        } catch (error) {
            console.error('Error fetching personnel list:', error);
            throw error;
        }
    }

    async getAccessLogs(deviceSn = null, startDate = null, endDate = null) {
        const token = await this.getValidToken();
        let url = `${this.baseURL}/transaction/list?pageNo=1&pageSize=1000`;
        
        const params = new URLSearchParams();
        if (deviceSn) params.append('deviceSn', deviceSn);
        if (startDate) params.append('startTime', startDate);
        if (endDate) params.append('endTime', endDate);
        
        if (params.toString()) {
            url += `&${params.toString()}`;
        }

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to fetch access logs');
            }
        } catch (error) {
            console.error('Error fetching access logs:', error);
            throw error;
        }
    }

    async getDeviceList() {
        const token = await this.getValidToken();
        
        try {
            const response = await fetch(`${this.baseURL}/device/accList?pageNo=1&pageSize=1000`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to fetch device list');
            }
        } catch (error) {
            console.error('Error fetching device list:', error);
            throw error;
        }
    }

    async addPersonnel(personnelData) {
        const token = await this.getValidToken();
        
        try {
            const response = await fetch(`${this.baseURL}/person/add`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(personnelData)
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to add personnel');
            }
        } catch (error) {
            console.error('Error adding personnel:', error);
            throw error;
        }
    }

    async getRealTimeMonitoring() {
        const token = await this.getValidToken();
        
        try {
            const response = await fetch(`${this.baseURL}/transaction/realTimeMonitoring`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to get real-time monitoring');
            }
        } catch (error) {
            console.error('Error getting real-time monitoring:', error);
            throw error;
        }
    }
}

export default new ZKTecoAPIService();
```

### 2. Real-time WebSocket Service

```javascript
// frontend/src/services/websocket.service.js
class WebSocketService {
    constructor() {
        this.connections = new Map();
        this.reconnectAttempts = new Map();
        this.maxReconnectAttempts = 5;
    }

    connect(endpoint, onMessage, onError, onClose) {
        const wsUrl = `${process.env.VUE_APP_WS_URL || 'ws://localhost:8000'}/${endpoint}`;
        
        if (this.connections.has(endpoint)) {
            this.disconnect(endpoint);
        }

        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log(`Connected to ${endpoint}`);
            this.reconnectAttempts.set(endpoint, 0);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error(`WebSocket error on ${endpoint}:`, error);
            if (onError) onError(error);
        };

        ws.onclose = () => {
            console.log(`Disconnected from ${endpoint}`);
            if (onClose) onClose();
            this.attemptReconnect(endpoint, onMessage, onError, onClose);
        };

        this.connections.set(endpoint, ws);
        return ws;
    }

    disconnect(endpoint) {
        const ws = this.connections.get(endpoint);
        if (ws) {
            ws.close();
            this.connections.delete(endpoint);
            this.reconnectAttempts.delete(endpoint);
        }
    }

    attemptReconnect(endpoint, onMessage, onError, onClose) {
        const attempts = this.reconnectAttempts.get(endpoint) || 0;
        
        if (attempts < this.maxReconnectAttempts) {
            this.reconnectAttempts.set(endpoint, attempts + 1);
            
            setTimeout(() => {
                console.log(`Attempting to reconnect to ${endpoint} (attempt ${attempts + 1})`);
                this.connect(endpoint, onMessage, onError, onClose);
            }, Math.pow(2, attempts) * 1000); // Exponential backoff
        } else {
            console.error(`Max reconnection attempts reached for ${endpoint}`);
        }
    }

    send(endpoint, data) {
        const ws = this.connections.get(endpoint);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        } else {
            console.error(`WebSocket not connected to ${endpoint}`);
        }
    }
}

export default new WebSocketService();
```

### 3. Enhanced Personnel Tracking Component

```vue
<!-- frontend/src/views/critical/PersonnelTracking.vue -->
<template>
  <div class="personnel-tracking">
    <div class="tracking-header">
      <h2>Real-time Personnel Tracking</h2>
      <div class="tracking-controls">
        <button @click="refreshTracking" :disabled="loading" class="btn btn-primary">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
        <button @click="toggleAutoRefresh" :class="['btn', autoRefresh ? 'btn-success' : 'btn-secondary']">
          <i class="fas fa-clock"></i> Auto Refresh: {{ autoRefresh ? 'ON' : 'OFF' }}
        </button>
      </div>
    </div>

    <div class="tracking-summary">
      <div class="summary-card">
        <h3>Total on Site</h3>
        <span class="summary-value">{{ trackingSummary.totalOnSite }}</span>
      </div>
      <div class="summary-card">
        <h3>By Zone</h3>
        <div class="zone-breakdown">
          <div v-for="zone in trackingSummary.zones" :key="zone.code" class="zone-item">
            <span class="zone-name">{{ zone.name }}</span>
            <span class="zone-count">{{ zone.count }}</span>
          </div>
        </div>
      </div>
      <div class="summary-card">
        <h3>Last Update</h3>
        <span class="summary-value">{{ formatTime(trackingSummary.lastUpdate) }}</span>
      </div>
    </div>

    <div class="tracking-filters">
      <div class="filter-group">
        <label for="zoneFilter">Filter by Zone:</label>
        <select id="zoneFilter" v-model="selectedZone" @change="filterPersonnel">
          <option value="">All Zones</option>
          <option v-for="zone in zones" :key="zone.code" :value="zone.code">
            {{ zone.name }}
          </option>
        </select>
      </div>
      <div class="filter-group">
        <label for="searchFilter">Search Personnel:</label>
        <input 
          id="searchFilter" 
          v-model="searchQuery" 
          @input="filterPersonnel" 
          placeholder="Enter name or PIN..."
        />
      </div>
    </div>

    <div class="tracking-table">
      <table>
        <thead>
          <tr>
            <th>PIN</th>
            <th>Name</th>
            <th>Current Zone</th>
            <th>Last Access</th>
            <th>Entry Point</th>
            <th>Device</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="personnel in filteredPersonnel" :key="personnel.personnel_id">
            <td>{{ personnel.pin }}</td>
            <td>{{ personnel.name }}</td>
            <td>
              <span class="zone-badge" :class="getZoneClass(personnel.current_zone)">
                {{ personnel.current_zone || 'Unknown' }}
              </span>
            </td>
            <td>{{ formatTime(personnel.last_access) }}</td>
            <td>{{ personnel.entry_point }}</td>
            <td>{{ personnel.device_sn }}</td>
            <td>
              <span class="status-badge" :class="getStatusClass(personnel.status)">
                {{ personnel.status }}
              </span>
            </td>
            <td>
              <button @click="viewPersonnelDetails(personnel)" class="btn btn-sm btn-info">
                <i class="fas fa-info-circle"></i> Details
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Personnel Details Modal -->
    <div v-if="selectedPersonnel" class="modal-overlay" @click="closePersonnelDetails">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Personnel Details</h3>
          <button @click="closePersonnelDetails" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="personnel-details">
            <div class="detail-row">
              <label>PIN:</label>
              <span>{{ selectedPersonnel.pin }}</span>
            </div>
            <div class="detail-row">
              <label>Name:</label>
              <span>{{ selectedPersonnel.name }}</span>
            </div>
            <div class="detail-row">
              <label>Current Zone:</label>
              <span>{{ selectedPersonnel.current_zone }}</span>
            </div>
            <div class="detail-row">
              <label>Last Access:</label>
              <span>{{ formatDateTime(selectedPersonnel.last_access) }}</span>
            </div>
            <div class="detail-row">
              <label>Entry Point:</label>
              <span>{{ selectedPersonnel.entry_point }}</span>
            </div>
            <div class="detail-row">
              <label>Device:</label>
              <span>{{ selectedPersonnel.device_sn }}</span>
            </div>
            <div class="detail-row">
              <label>Status:</label>
              <span>{{ selectedPersonnel.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import zktecoAPI from '@/services/zkteco.api.js';
import websocketService from '@/services/websocket.service.js';

export default {
  name: 'PersonnelTracking',
  setup() {
    const loading = ref(false);
    const autoRefresh = ref(true);
    const refreshInterval = ref(null);
    const personnelList = ref([]);
    const filteredPersonnel = ref([]);
    const zones = ref([]);
    const selectedZone = ref('');
    const searchQuery = ref('');
    const selectedPersonnel = ref(null);
    const trackingSummary = ref({
      totalOnSite: 0,
      zones: [],
      lastUpdate: new Date()
    });

    // Load personnel tracking data
    const loadPersonnelTracking = async () => {
      loading.value = true;
      try {
        // Get real-time access logs from ZKTeco
        const accessLogs = await zktecoAPI.getAccessLogs();
        
        // Process access logs to get current positions
        const currentPositions = {};
        accessLogs.data.forEach(log => {
          const pin = log.pin;
          if (!currentPositions[pin] || new Date(log.eventTime) > new Date(currentPositions[pin].last_access)) {
            currentPositions[pin] = {
              pin: log.pin,
              name: log.name || `Personnel ${log.pin}`,
              current_zone: log.areaName,
              last_access: log.eventTime,
              entry_point: log.readerName,
              device_sn: log.devSn,
              status: 'ON_SITE'
            };
          }
        });

        personnelList.value = Object.values(currentPositions);
        filteredPersonnel.value = personnelList.value;
        
        // Update summary
        updateTrackingSummary();
        
      } catch (error) {
        console.error('Error loading personnel tracking:', error);
      } finally {
        loading.value = false;
      }
    };

    // Load zones
    const loadZones = async () => {
      try {
        // Get zones from your existing zones API
        const response = await fetch('/api/v1/zones');
        const zonesData = await response.json();
        zones.value = zonesData;
      } catch (error) {
        console.error('Error loading zones:', error);
      }
    };

    // Update tracking summary
    const updateTrackingSummary = () => {
      const zoneCounts = {};
      personnelList.value.forEach(person => {
        const zone = person.current_zone || 'Unknown';
        zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
      });

      trackingSummary.value = {
        totalOnSite: personnelList.value.length,
        zones: Object.entries(zoneCounts).map(([code, count]) => ({
          code,
          name: getZoneName(code),
          count
        })),
        lastUpdate: new Date()
      };
    };

    // Get zone name
    const getZoneName = (code) => {
      const zone = zones.value.find(z => z.code === code);
      return zone ? zone.name : code;
    };

    // Filter personnel
    const filterPersonnel = () => {
      let filtered = personnelList.value;

      if (selectedZone.value) {
        filtered = filtered.filter(person => person.current_zone === selectedZone.value);
      }

      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter(person => 
          person.name.toLowerCase().includes(query) ||
          person.pin.toLowerCase().includes(query)
        );
      }

      filteredPersonnel.value = filtered;
    };

    // Refresh tracking
    const refreshTracking = () => {
      loadPersonnelTracking();
    };

    // Toggle auto refresh
    const toggleAutoRefresh = () => {
      autoRefresh.value = !autoRefresh.value;
      if (autoRefresh.value) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    };

    // Start auto refresh
    const startAutoRefresh = () => {
      refreshInterval.value = setInterval(() => {
        loadPersonnelTracking();
      }, 30000); // 30 seconds
    };

    // Stop auto refresh
    const stopAutoRefresh = () => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value);
        refreshInterval.value = null;
      }
    };

    // View personnel details
    const viewPersonnelDetails = (personnel) => {
      selectedPersonnel.value = personnel;
    };

    // Close personnel details
    const closePersonnelDetails = () => {
      selectedPersonnel.value = null;
    };

    // Get zone class
    const getZoneClass = (zone) => {
      const zoneClasses = {
        'Platform Alpha': 'zone-alpha',
        'Platform Beta': 'zone-beta',
        'Helipad': 'zone-helipad',
        'Office': 'zone-office',
        'Unknown': 'zone-unknown'
      };
      return zoneClasses[zone] || 'zone-default';
    };

    // Get status class
    const getStatusClass = (status) => {
      const statusClasses = {
        'ON_SITE': 'status-success',
        'OFF_SITE': 'status-warning',
        'UNKNOWN': 'status-secondary'
      };
      return statusClasses[status] || 'status-secondary';
    };

    // Format time
    const formatTime = (timeString) => {
      if (!timeString) return 'N/A';
      const date = new Date(timeString);
      return date.toLocaleTimeString();
    };

    // Format date time
    const formatDateTime = (timeString) => {
      if (!timeString) return 'N/A';
      const date = new Date(timeString);
      return date.toLocaleString();
    };

    // WebSocket connection for real-time updates
    const connectWebSocket = () => {
      websocketService.connect(
        'personnel-tracking',
        (data) => {
          // Handle real-time updates
          if (data.type === 'access_event') {
            // Update personnel position
            const existingPerson = personnelList.value.find(p => p.pin === data.pin);
            if (existingPerson) {
              Object.assign(existingPerson, data);
            } else {
              personnelList.value.push(data);
            }
            filterPersonnel();
            updateTrackingSummary();
          }
        },
        (error) => {
          console.error('WebSocket error:', error);
        },
        () => {
          console.log('WebSocket disconnected');
        }
      );
    };

    onMounted(() => {
      loadPersonnelTracking();
      loadZones();
      connectWebSocket();
      if (autoRefresh.value) {
        startAutoRefresh();
      }
    });

    onUnmounted(() => {
      stopAutoRefresh();
      websocketService.disconnect('personnel-tracking');
    });

    return {
      loading,
      autoRefresh,
      personnelList,
      filteredPersonnel,
      zones,
      selectedZone,
      searchQuery,
      selectedPersonnel,
      trackingSummary,
      refreshTracking,
      toggleAutoRefresh,
      filterPersonnel,
      viewPersonnelDetails,
      closePersonnelDetails,
      getZoneClass,
      getStatusClass,
      formatTime,
      formatDateTime
    };
  }
};
</script>

<style scoped>
.personnel-tracking {
  padding: 20px;
}

.tracking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.tracking-controls {
  display: flex;
  gap: 10px;
}

.tracking-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.summary-card {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.summary-card h3 {
  margin: 0 0 10px 0;
  color: #495057;
  font-size: 14px;
  text-transform: uppercase;
}

.summary-value {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
}

.zone-breakdown {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.zone-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.zone-name {
  font-size: 12px;
  color: #6c757d;
}

.zone-count {
  font-weight: bold;
  color: #007bff;
}

.tracking-filters {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-group label {
  font-weight: bold;
  color: #495057;
}

.filter-group select,
.filter-group input {
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.tracking-table {
  overflow-x: auto;
}

.tracking-table table {
  width: 100%;
  border-collapse: collapse;
}

.tracking-table th,
.tracking-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

.tracking-table th {
  background: #f8f9fa;
  font-weight: bold;
  color: #495057;
}

.zone-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.zone-alpha { background: #d4edda; color: #155724; }
.zone-beta { background: #cce5ff; color: #004085; }
.zone-helipad { background: #fff3cd; color: #856404; }
.zone-office { background: #e2e3e5; color: #383d41; }
.zone-unknown { background: #f8d7da; color: #721c24; }

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.status-success { background: #d4edda; color: #155724; }
.status-warning { background: #fff3cd; color: #856404; }
.status-secondary { background: #e2e3e5; color: #383d41; }

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
}

.personnel-details {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-row label {
  font-weight: bold;
  color: #495057;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary { background: #007bff; color: white; }
.btn-success { background: #28a745; color: white; }
.btn-secondary { background: #6c757d; color: white; }
.btn-info { background: #17a2b8; color: white; }
.btn-sm { padding: 4px 8px; font-size: 12px; }

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

---

## API Integration Details

### 1. ZKTeco API Endpoints Mapping

#### Personnel Management
```python
# ZKTeco API -> POB System Mapping
PERSONNEL_ENDPOINTS = {
    "add_personnel": {
        "zkteco": "/api/person/add",
        "pob": "/api/v1/personnel",
        "method": "POST",
        "sync": "bidirectional"
    },
    "get_personnel": {
        "zkteco": "/api/person/list",
        "pob": "/api/v1/personnel",
        "method": "GET",
        "sync": "zkteco_to_pob"
    },
    "update_personnel": {
        "zkteco": "/api/person/update",
        "pob": "/api/v1/personnel/{id}",
        "method": "PUT",
        "sync": "bidirectional"
    },
    "delete_personnel": {
        "zkteco": "/api/person/delete",
        "pob": "/api/v1/personnel/{id}",
        "method": "DELETE",
        "sync": "bidirectional"
    }
}
```

#### Access Control
```python
ACCESS_CONTROL_ENDPOINTS = {
    "get_devices": {
        "zkteco": "/api/device/accList",
        "pob": "/api/v1/devices/zkteco",
        "method": "GET",
        "sync": "zkteco_to_pob"
    },
    "get_doors": {
        "zkteco": "/api/door/list",
        "pob": "/api/v1/doors",
        "method": "GET",
        "sync": "zkteco_to_pob"
    },
    "remote_open": {
        "zkteco": "/api/door/remoteOpen",
        "pob": "/api/v1/doors/open",
        "method": "POST",
        "sync": "pob_to_zkteco"
    },
    "get_access_logs": {
        "zkteco": "/api/transaction/list",
        "pob": "/api/v1/access-logs",
        "method": "GET",
        "sync": "zkteco_to_pob"
    }
}
```

#### Biometric Management
```python
BIOMETRIC_ENDPOINTS = {
    "add_fingerprint": {
        "zkteco": "/api/fingerprint/add",
        "pob": "/api/v1/personnel/{id}/biometrics/fingerprint",
        "method": "POST",
        "sync": "pob_to_zkteco"
    },
    "get_fingerprint": {
        "zkteco": "/api/fingerprint/get",
        "pob": "/api/v1/personnel/{id}/biometrics/fingerprint",
        "method": "GET",
        "sync": "zkteco_to_pob"
    },
    "delete_fingerprint": {
        "zkteco": "/api/fingerprint/delete",
        "pob": "/api/v1/personnel/{id}/biometrics/fingerprint",
        "method": "DELETE",
        "sync": "bidirectional"
    }
}
```

### 2. Data Synchronization Logic

#### Bidirectional Sync Manager
```python
# app/services/zkteco/sync_manager.py
class ZKTecoSyncManager:
    def __init__(self):
        self.zkteco_client = ZKTecoAuthService()
        self.sync_interval = 300  # 5 minutes
        self.last_sync = {}
    
    async def run_sync_cycle(self):
        """Run complete synchronization cycle"""
        try:
            # Sync from ZKTeco to POB
            await self.sync_from_zkteco()
            
            # Sync from POB to ZKTeco
            await self.sync_to_zkteco()
            
            # Update sync timestamp
            self.last_sync['full_sync'] = datetime.now()
            
        except Exception as e:
            logger.error(f"Sync cycle failed: {e}")
            raise
    
    async def sync_from_zkteco(self):
        """Sync data from ZKTeco to POB system"""
        # Sync access logs
        await self.sync_access_logs()
        
        # Sync device status
        await self.sync_device_status()
        
        # Sync personnel changes
        await self.sync_personnel_changes()
    
    async def sync_access_logs(self):
        """Sync access logs from ZKTeco"""
        last_sync_time = self.last_sync.get('access_logs', datetime.min)
        
        access_logs = await self.zkteco_client.get_access_logs(
            startDate=last_sync_time.isoformat(),
            endDate=datetime.now().isoformat()
        )
        
        for log in access_logs.get('data', []):
            # Process and store in POB database
            await self.store_access_log(log)
    
    async def sync_to_zkteco(self):
        """Sync POB data to ZKTeco system"""
        # Sync new personnel
        await self.sync_new_personnel()
        
        # Sync personnel updates
        await self.sync_personnel_updates()
        
        # Sync access level changes
        await self.sync_access_level_changes()
```

---

## Data Models

### 1. Enhanced Personnel Model

```python
# app/models/enhanced_personnel.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, Text, Date
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

class EnhancedPersonnel(Base):
    __tablename__ = "enhanced_personnel"
    
    # Existing POB fields
    id = Column(Integer, primary_key=True, index=True)
    pin = Column(String(20), unique=True, index=True)
    name = Column(String(100), nullable=False)
    last_name = Column(String(100))
    email = Column(String(100), unique=True)
    phone = Column(String(20))
    department_id = Column(Integer, ForeignKey("departments.id"))
    is_active = Column(Boolean, default=True)
    
    # ZKTeco integration fields
    zkteco_user_id = Column(String(100), unique=True)
    zkteco_pin = Column(String(20), unique=True)
    card_number = Column(String(50))
    
    # Biometric data
    face_template = Column(Text)  # Base64 encoded face template
    fingerprint_templates = Column(JSON)  # Array of fingerprint templates
    biometric_status = Column(Enum('ENROLLED', 'PENDING', 'FAILED', 'NOT_ENROLLED'))
    last_biometric_update = Column(DateTime(timezone=True))
    
    # Access control
    access_levels = Column(JSON)  # ZKTeco access level IDs
    qr_code = Column(Text)  # Base64 encoded QR code
    access_start_time = Column(DateTime(timezone=True))
    access_end_time = Column(DateTime(timezone=True))
    
    # Location tracking
    current_zone = Column(String(50))
    last_access_time = Column(DateTime(timezone=True))
    last_access_device = Column(String(100))
    location_history = Column(JSON)  # Array of location timestamps
    
    # Industry-specific fields
    safety_passport_expiry = Column(Date)
    medical_fitness_expiry = Column(Date)
    h2s_training_expiry = Column(Date)
    t_water_training_expiry = Column(Date)
    survival_training_expiry = Column(Date)
    fire_safety_training_expiry = Column(Date)
    confined_space_training_expiry = Column(Date)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_sync_at = Column(DateTime(timezone=True))
    sync_status = Column(Enum('SYNCED', 'PENDING', 'FAILED'))
    
    # Relationships
    department = relationship("Department", back_populates="personnel")
    access_logs = relationship("AccessLog", back_populates="personnel")
    biometric_records = relationship("BiometricRecord", back_populates="personnel")
```

### 2. Access Log Model

```python
# app/models/access_log.py
class AccessLog(Base):
    __tablename__ = "access_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    personnel_id = Column(Integer, ForeignKey("enhanced_personnel.id"))
    zkteco_log_id = Column(String(100), unique=True)
    
    # Event details
    event_time = Column(DateTime(timezone=True), nullable=False)
    event_type = Column(String(50))  # ACCESS, EXIT, ALARM, etc.
    event_description = Column(String(200))
    
    # Location details
    area_name = Column(String(100))
    zone_code = Column(String(50))
    reader_name = Column(String(100))
    device_sn = Column(String(100))
    device_name = Column(String(100))
    
    # Verification details
    verification_mode = Column(String(50))  # fingerprint, face, card, password
    verification_result = Column(String(20))  # SUCCESS, FAILED
    confidence_score = Column(Integer)  # 0-100
    
    # Access control
    access_granted = Column(Boolean)
    access_denied_reason = Column(String(200))
    
    # Biometric data
    biometric_template_used = Column(String(50))
    fingerprint_index = Column(Integer)
    
    # Image data
    capture_photo_base64 = Column(Text)  # Base64 encoded photo
    
    # Raw data from ZKTeco
    raw_zkteco_data = Column(JSON)
    
    # Processing
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
    sync_status = Column(Enum('PROCESSED', 'PENDING', 'FAILED'))
    
    # Relationships
    personnel = relationship("EnhancedPersonnel", back_populates="access_logs")
```

### 3. Device Management Model

```python
# app/models/zkteco_device.py
class ZKTecoDevice(Base):
    __tablename__ = "zkteco_devices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zkteco_device_id = Column(String(100), unique=True)
    device_sn = Column(String(100), unique=True, nullable=False)
    device_name = Column(String(100))
    
    # Device details
    device_type = Column(String(50))  # inBIO160, MA300, etc.
    device_model = Column(String(100))
    firmware_version = Column(String(50))
    
    # Network details
    ip_address = Column(String(45))  # IPv6 compatible
    port = Column(Integer, default=4370)
    mac_address = Column(String(17))
    
    # Location details
    zone_code = Column(String(50))
    location_description = Column(String(200))
    installation_date = Column(DateTime(timezone=True))
    
    # Status
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime(timezone=True))
    battery_level = Column(Integer)  # For wireless devices
    signal_strength = Column(Integer)  # For 4G devices
    
    # Capabilities
    supported_features = Column(JSON)  # fingerprint, face, card, etc.
    max_users = Column(Integer)
    max_logs = Column(Integer)
    
    # Configuration
    configuration = Column(JSON)  # Device-specific settings
    access_levels = Column(JSON)  # Associated access levels
    
    # Maintenance
    last_maintenance = Column(DateTime(timezone=True))
    next_maintenance_due = Column(DateTime(timezone=True))
    maintenance_notes = Column(Text)
    
    # Sync status
    last_sync_at = Column(DateTime(timezone=True))
    sync_status = Column(Enum('SYNCED', 'PENDING', 'FAILED'))
    
    # Relationships
    access_logs = relationship("AccessLog", back_populates="device")
    maintenance_records = relationship("MaintenanceRecord", back_populates="device")
```

---

## Security Considerations

### 1. Authentication & Authorization

#### ZKTeco API Security
```python
# app/services/zkteco/security.py
class ZKTecoSecurityManager:
    def __init__(self):
        self.encryption_key = os.getenv("ZKTECO_ENCRYPTION_KEY")
        self.token_store = {}
    
    async def secure_authentication(self, username: str, password: str) -> dict:
        """Secure authentication with ZKTeco API"""
        # Encrypt credentials
        encrypted_credentials = self.encrypt_credentials(username, password)
        
        # Use secure connection
        async with httpx.AsyncClient(verify=True) as client:
            response = await client.post(
                f"{self.base_url}/api/auth/login",
                json=encrypted_credentials,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                token_data = response.json()
                # Store token securely
                await self.store_token_securely(token_data)
                return token_data
            else:
                raise SecurityException("Authentication failed")
    
    def encrypt_credentials(self, username: str, password: str) -> dict:
        """Encrypt credentials before transmission"""
        from cryptography.fernet import Fernet
        f = Fernet(self.encryption_key)
        
        encrypted_username = f.encrypt(username.encode()).decode()
        encrypted_password = f.encrypt(password.encode()).decode()
        
        return {
            "username": encrypted_username,
            "password": encrypted_password
        }
```

#### Role-Based Access Control
```python
# app/models/permissions.py
class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True)
    description = Column(Text)
    resource = Column(String(100))  # personnel, devices, access_logs
    action = Column(String(50))     # create, read, update, delete

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True)
    description = Column(Text)
    
class RolePermission(Base):
    __tablename__ = "role_permissions"
    
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True)
    permission_id = Column(Integer, ForeignKey("permissions.id"), primary_key=True)

class UserRole(Base):
    __tablename__ = "user_roles"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True
```

### 2. Data Protection

#### Biometric Data Encryption
```python
# app/services/biometric_security.py
class BiometricSecurityManager:
    def __init__(self):
        self.biometric_key = os.getenv("BIOMETRIC_ENCRYPTION_KEY")
    
    def encrypt_biometric_template(self, template_data: bytes) -> str:
        """Encrypt biometric template data"""
        from cryptography.fernet import Fernet
        f = Fernet(self.biometric_key)
        encrypted_data = f.encrypt(template_data)
        return encrypted_data.decode()
    
    def decrypt_biometric_template(self, encrypted_data: str) -> bytes:
        """Decrypt biometric template data"""
        from cryptography.fernet import Fernet
        f = Fernet(self.biometric_key)
        decrypted_data = f.decrypt(encrypted_data.encode())
        return decrypted_data
    
    def hash_biometric_template(self, template_data: bytes) -> str:
        """Create hash of biometric template for comparison"""
        import hashlib
        return hashlib.sha256(template_data).hexdigest()
```

#### Audit Logging
```python
# app/services/audit_service.py
class AuditService:
    async def log_access_event(self, event_data: dict):
        """Log all access events for audit"""
        audit_log = {
            "timestamp": datetime.now().isoformat(),
            "event_type": "ACCESS_EVENT",
            "user_id": event_data.get("user_id"),
            "personnel_id": event_data.get("personnel_id"),
            "action": event_data.get("action"),
            "resource": event_data.get("resource"),
            "ip_address": event_data.get("ip_address"),
            "user_agent": event_data.get("user_agent"),
            "result": event_data.get("result"),
            "details": event_data.get("details")
        }
        
        # Store in audit database
        await self.store_audit_log(audit_log)
    
    async def log_system_event(self, event_type: str, details: dict):
        """Log system events"""
        system_log = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "source": "ZKTeco Integration",
            "details": details
        }
        
        await self.store_system_log(system_log)
```

---

## Implementation Roadmap

### Phase 1: Foundation Setup (Week 1-2)

#### Week 1: Infrastructure Setup
- [ ] Set up ZKTeco API integration layer
- [ ] Configure authentication and security
- [ ] Create database schema enhancements
- [ ] Set up development environment

#### Week 2: Basic Integration
- [ ] Implement ZKTeco authentication service
- [ ] Create basic personnel sync
- [ ] Set up device discovery
- [ ] Implement basic API endpoints

### Phase 2: Core Features (Week 3-4)

#### Week 3: Personnel & Access Control
- [ ] Complete personnel synchronization
- [ ] Implement biometric enrollment
- [ ] Create access control management
- [ ] Set up real-time monitoring

#### Week 4: Critical Module Enhancement
- [ ] Enhance personnel tracking with ZKTeco data
- [ ] Integrate muster management with ZKTeco alarms
- [ ] Enhance zones management with access levels
- [ ] Implement emergency lockdown features

### Phase 3: Advanced Features (Week 5-6)

#### Week 5: Advanced Security
- [ ] Implement visitor management system
- [ ] Set up surveillance integration
- [ ] Create parking management
- [ ] Add intrusion detection

#### Week 6: Optimization & Testing
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] User training
- [ ] Documentation completion

---

## Migration Strategy

### 1. Pre-Migration Preparation

#### Data Assessment
```python
# scripts/assess_current_data.py
class DataAssessment:
    async def assess_personnel_data(self):
        """Assess current personnel data for migration"""
        current_personnel = await self.get_current_personnel()
        
        assessment = {
            "total_personnel": len(current_personnel),
            "with_biometric_data": 0,
            "with_access_levels": 0,
            "migration_complexity": "LOW"
        }
        
        for person in current_personnel:
            if person.get("biometric_data"):
                assessment["with_biometric_data"] += 1
            if person.get("access_levels"):
                assessment["with_access_levels"] += 1
        
        return assessment
```

#### Backup Strategy
```python
# scripts/backup_system.py
class SystemBackup:
    async def create_full_backup(self):
        """Create complete system backup"""
        backup_data = {
            "timestamp": datetime.now().isoformat(),
            "personnel": await self.backup_personnel(),
            "access_logs": await self.backup_access_logs(),
            "devices": await self.backup_devices(),
            "configurations": await self.backup_configurations()
        }
        
        backup_file = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        await self.save_backup(backup_data, backup_file)
        
        return backup_file
```

### 2. Migration Execution

#### Personnel Data Migration
```python
# scripts/migrate_personnel.py
class PersonnelMigration:
    async def migrate_personnel_to_zkteco(self):
        """Migrate personnel data to ZKTeco system"""
        current_personnel = await self.get_current_personnel()
        migration_results = []
        
        for person in current_personnel:
            try:
                # Map current data to ZKTeco format
                zkteco_payload = self.map_personnel_to_zkteco(person)
                
                # Add to ZKTeco system
                result = await self.zkteco_client.add_personnel(zkteco_payload)
                
                migration_results.append({
                    "personnel_id": person["id"],
                    "status": "SUCCESS",
                    "zkteco_id": result.get("id"),
                    "timestamp": datetime.now().isoformat()
                })
                
            except Exception as e:
                migration_results.append({
                    "personnel_id": person["id"],
                    "status": "FAILED",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
        
        return migration_results
```

### 3. Post-Migration Validation

#### Data Validation
```python
# scripts/validate_migration.py
class MigrationValidator:
    async def validate_personnel_migration(self):
        """Validate personnel data migration"""
        validation_results = {
            "total_migrated": 0,
            "successful_migrations": 0,
            "failed_migrations": 0,
            "data_integrity_issues": []
        }
        
        # Compare data between systems
        current_personnel = await self.get_current_personnel()
        zkteco_personnel = await self.get_zkteco_personnel()
        
        for person in current_personnel:
            zkteco_person = await self.find_zkteco_person(person["pin"])
            
            if zkteco_person:
                validation_results["successful_migrations"] += 1
                
                # Validate data integrity
                integrity_issues = await self.validate_data_integrity(person, zkteco_person)
                if integrity_issues:
                    validation_results["data_integrity_issues"].extend(integrity_issues)
            else:
                validation_results["failed_migrations"] += 1
        
        validation_results["total_migrated"] = len(current_personnel)
        return validation_results
```

---

## Testing & Validation

### 1. Unit Testing

#### ZKTeco Integration Tests
```python
# tests/test_zkteco_integration.py
import pytest
from app.services.zkteco.zkteco_auth import ZKTecoAuthService

class TestZKTecoAuthService:
    @pytest.fixture
    def auth_service(self):
        return ZKTecoAuthService()
    
    @pytest.mark.asyncio
    async def test_authentication_success(self, auth_service):
        """Test successful authentication"""
        result = await auth_service.authenticate("test_user", "test_password")
        assert result["access_token"] is not None
        assert auth_service.token is not None
        assert auth_service.token_expiry > datetime.now()
    
    @pytest.mark.asyncio
    async def test_authentication_failure(self, auth_service):
        """Test authentication failure"""
        with pytest.raises(ZKTecoAPIException):
            await auth_service.authenticate("invalid_user", "invalid_password")
    
    @pytest.mark.asyncio
    async def test_token_refresh(self, auth_service):
        """Test token refresh functionality"""
        # Initial authentication
        await auth_service.authenticate("test_user", "test_password")
        original_token = auth_service.token
        
        # Expire token
        auth_service.token_expiry = datetime.now() - timedelta(hours=1)
        
        # Get new token
        new_token = await auth_service.get_valid_token()
        assert new_token != original_token
```

### 2. Integration Testing

#### End-to-End Integration Tests
```python
# tests/test_integration.py
import pytest
from app.services.zkteco.sync_manager import ZKTecoSyncManager

class TestIntegration:
    @pytest.fixture
    def sync_manager(self):
        return ZKTecoSyncManager()
    
    @pytest.mark.asyncio
    async def test_personnel_sync_cycle(self, sync_manager):
        """Test complete personnel synchronization cycle"""
        # Create test personnel in POB
        test_personnel = await self.create_test_personnel()
        
        # Run sync cycle
        await sync_manager.run_sync_cycle()
        
        # Verify personnel exists in ZKTeco
        zkteco_personnel = await sync_manager.zkteco_client.get_personnel(test_personnel["pin"])
        assert zkteco_personnel is not None
        assert zkteco_personnel["name"] == test_personnel["name"]
    
    @pytest.mark.asyncio
    async def test_access_log_sync(self, sync_manager):
        """Test access log synchronization"""
        # Create test access log in ZKTeco
        test_log = await self.create_test_access_log()
        
        # Sync access logs
        await sync_manager.sync_access_logs()
        
        # Verify log exists in POB
        pob_log = await self.get_access_log(test_log["id"])
        assert pob_log is not None
        assert pob_log["personnel_id"] == test_log["personnel_id"]
```

### 3. Performance Testing

#### Load Testing
```python
# tests/test_performance.py
import asyncio
import time
from app.services.zkteco.zkteco_client import ZKTecoClient

class TestPerformance:
    async def test_concurrent_api_calls(self):
        """Test concurrent API call performance"""
        client = ZKTecoClient()
        
        start_time = time.time()
        
        # Make 100 concurrent API calls
        tasks = []
        for i in range(100):
            task = client.get_personnel_list(page=i+1)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Performance assertions
        assert duration < 30  # Should complete within 30 seconds
        assert len(results) == 100
        assert all(result["code"] == 0 for result in results)
    
    async def test_large_dataset_sync(self):
        """Test synchronization of large datasets"""
        sync_manager = ZKTecoSyncManager()
        
        # Create large test dataset (1000 personnel)
        await self.create_large_test_dataset(1000)
        
        start_time = time.time()
        await sync_manager.run_sync_cycle()
        end_time = time.time()
        
        duration = end_time - start_time
        
        # Performance assertions
        assert duration < 300  # Should complete within 5 minutes
        assert await self.verify_sync_completion(1000)
```

---

## Maintenance & Support

### 1. System Monitoring

#### Health Monitoring Service
```python
# app/services/monitoring/health_monitor.py
class HealthMonitorService:
    def __init__(self):
        self.zkteco_client = ZKTecoAuthService()
        self.alert_thresholds = {
            "api_response_time": 5000,  # milliseconds
            "sync_failure_rate": 0.1,   # 10%
            "device_offline_rate": 0.2   # 20%
        }
    
    async def check_system_health(self) -> dict:
        """Check overall system health"""
        health_status = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "HEALTHY",
            "components": {
                "zkteco_api": await self.check_zkteco_api_health(),
                "database": await self.check_database_health(),
                "sync_service": await self.check_sync_health(),
                "websocket_service": await self.check_websocket_health()
            },
            "alerts": []
        }
        
        # Determine overall status
        component_statuses = [comp["status"] for comp in health_status["components"].values()]
        if "CRITICAL" in component_statuses:
            health_status["overall_status"] = "CRITICAL"
        elif "WARNING" in component_statuses:
            health_status["overall_status"] = "WARNING"
        
        return health_status
    
    async def check_zkteco_api_health(self) -> dict:
        """Check ZKTeco API health"""
        try:
            start_time = time.time()
            await self.zkteco_client.get_device_list()
            response_time = (time.time() - start_time) * 1000
            
            status = "HEALTHY"
            if response_time > self.alert_thresholds["api_response_time"]:
                status = "WARNING"
            
            return {
                "status": status,
                "response_time": response_time,
                "last_check": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "CRITICAL",
                "error": str(e),
                "last_check": datetime.now().isoformat()
            }
```

### 2. Automated Maintenance

#### Maintenance Scheduler
```python
# app/services/maintenance/scheduler.py
class MaintenanceScheduler:
    def __init__(self):
        self.tasks = []
        self.running = False
    
    async def start_scheduler(self):
        """Start maintenance scheduler"""
        self.running = True
        
        while self.running:
            try:
                await self.run_maintenance_tasks()
                await asyncio.sleep(3600)  # Run every hour
            except Exception as e:
                logger.error(f"Maintenance scheduler error: {e}")
                await asyncio.sleep(300)  # Retry after 5 minutes
    
    async def run_maintenance_tasks(self):
        """Run all maintenance tasks"""
        tasks = [
            self.cleanup_old_logs(),
            self.optimize_database(),
            self.check_device_health(),
            self.update_sync_statistics(),
            self.backup_critical_data()
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def cleanup_old_logs(self):
        """Clean up old access logs"""
        cutoff_date = datetime.now() - timedelta(days=90)
        
        # Delete old access logs
        deleted_count = await self.delete_access_logs_older_than(cutoff_date)
        logger.info(f"Cleaned up {deleted_count} old access logs")
    
    async def optimize_database(self):
        """Optimize database performance"""
        # Update table statistics
        await self.update_table_statistics()
        
        # Rebuild indexes if needed
        await self.rebuild_indexes()
        
        logger.info("Database optimization completed")
```

### 3. Troubleshooting Guide

#### Common Issues & Solutions

##### Issue 1: ZKTeco API Authentication Failure
```python
# troubleshooting/api_auth_issues.py
class APIAuthTroubleshooter:
    async def diagnose_auth_issue(self) -> dict:
        """Diagnose authentication issues"""
        diagnosis = {
            "issue": "API_AUTH_FAILURE",
            "possible_causes": [],
            "solutions": []
        }
        
        # Check credentials
        if not os.getenv("ZKTECO_USERNAME") or not os.getenv("ZKTECO_PASSWORD"):
            diagnosis["possible_causes"].append("Missing credentials")
            diagnosis["solutions"].append("Set ZKTECO_USERNAME and ZKTECO_PASSWORD environment variables")
        
        # Check API URL
        if not os.getenv("ZKTECO_API_URL"):
            diagnosis["possible_causes"].append("Missing API URL")
            diagnosis["solutions"].append("Set ZKTECO_API_URL environment variable")
        
        # Check network connectivity
        if not await self.test_network_connectivity():
            diagnosis["possible_causes"].append("Network connectivity issue")
            diagnosis["solutions"].append("Check network connection to ZKTeco server")
        
        return diagnosis
```

##### Issue 2: Biometric Template Sync Failure
```python
# troubleshooting/biometric_sync_issues.py
class BiometricSyncTroubleshooter:
    async def diagnose_biometric_sync_issue(self, personnel_id: int) -> dict:
        """Diagnose biometric sync issues"""
        diagnosis = {
            "personnel_id": personnel_id,
            "issue": "BIOMETRIC_SYNC_FAILURE",
            "checks": []
        }
        
        # Check if personnel exists in ZKTeco
        zkteco_personnel = await self.get_zkteco_personnel(personnel_id)
        if not zkteco_personnel:
            diagnosis["checks"].append({
                "check": "Personnel existence",
                "status": "FAILED",
                "message": "Personnel not found in ZKTeco system"
            })
        
        # Check biometric template format
        template = await self.get_biometric_template(personnel_id)
        if not template:
            diagnosis["checks"].append({
                "check": "Biometric template",
                "status": "FAILED",
                "message": "No biometric template found"
            })
        
        # Check template size
        if template and len(template) > 1024 * 1024:  # 1MB limit
            diagnosis["checks"].append({
                "check": "Template size",
                "status": "FAILED",
                "message": "Template size exceeds limit"
            })
        
        return diagnosis
```

---

## Conclusion

This technical documentation provides a comprehensive guide for integrating ZKTeco CVSecurity API with the existing POB management system. The integration enhances the system with enterprise-grade security features while preserving critical oil & gas specific functionality.

### Key Benefits
- **Enhanced Security**: Professional access control with biometric authentication
- **Real-time Monitoring**: Live tracking of personnel and access events
- **Scalability**: Enterprise-grade architecture for large operations
- **Compliance**: Industry-standard security and audit capabilities
- **Integration**: Seamless data flow between POB and ZKTeco systems

---

## 9. Mustering Module Integration

### 9.1. Emergency Response Management

#### 9.1.1. Mustering Emergency System Architecture
```python
# app/services/mustering/emergency_service.py
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.mustering import MusteringEmergency, MusterPoint, MusteringAssignment

class MusteringEmergencyService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
        self.active_emergencies = {}
    
    async def declare_emergency(self, emergency_data: Dict[str, Any]) -> Dict[str, Any]:
        """Declare emergency and trigger mustering procedures"""
        emergency = MusteringEmergency(
            emergency_id=self.generate_emergency_id(),
            emergency_type=emergency_data["emergency_type"],  # FIRE, GAS_LEAK, MEDICAL, SECURITY, DRILL
            priority_level=emergency_data["priority_level"],  # CRITICAL, HIGH, MEDIUM, LOW
            declared_by=emergency_data["declared_by"],
            description=emergency_data.get("description", ""),
            affected_zones=emergency_data.get("affected_zones", []),
            status="ACTIVE"
        )
        
        # Save to database
        db = next(get_db())
        db.add(emergency)
        db.commit()
        
        # Trigger automatic mustering procedures
        await self.initiate_mustering(emergency.emergency_id)
        
        return {
            "emergency_id": emergency.emergency_id,
            "status": "ACTIVE",
            "message": "Emergency declared successfully"
        }
    
    async def initiate_mustering(self, emergency_id: str) -> Dict[str, Any]:
        """Initiate automatic mustering procedures"""
        # Get all active muster points
        db = next(get_db())
        muster_points = db.query(MusterPoint).filter(MusterPoint.is_active == True).all()
        
        # Trigger ZKTeco device lockdown and unlock procedures
        await self.manage_access_control(emergency_id, muster_points)
        
        # Send notifications to all personnel
        await self.broadcast_emergency_notification(emergency_id)
        
        # Start real-time monitoring
        self.active_emergencies[emergency_id] = {
            "started_at": datetime.now(),
            "muster_points": {point.point_id: 0 for point in muster_points},
            "status": "ACTIVE"
        }
        
        return {"message": "Mustering initiated successfully"}
    
    async def manage_access_control(self, emergency_id: str, muster_points: List[MusterPoint]) -> Dict[str, Any]:
        """Manage ZKTeco access control devices during emergency"""
        token = await self.zkteco_client.get_valid_token()
        
        # Lock down all doors except muster point access
        async with httpx.AsyncClient() as client:
            # Get all doors
            doors_response = await client.get(
                f"{self.zkteco_client.base_url}/api/door/list",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if doors_response.status_code == 200:
                doors = doors_response.json().get("data", [])
                
                for door in doors:
                    door_name = door.get("name", "")
                    
                    # Check if this door leads to a muster point
                    is_muster_point_access = any(
                        door_name.lower() in point.name.lower() or 
                        door_name.lower() in point.zone_code.lower()
                        for point in muster_points
                    )
                    
                    if is_muster_point_access:
                        # Open door for muster point access
                        await client.post(
                            f"{self.zkteco_client.base_url}/api/door/remoteOpen",
                            json={"id": door["id"]},
                            headers={"Authorization": f"Bearer {token}"}
                        )
                    else:
                        # Lock down non-muster point doors
                        await client.post(
                            f"{self.zkteco_client.base_url}/api/door/remoteClose",
                            json={"id": door["id"]},
                            headers={"Authorization": f"Bearer {token}"}
                        )
        
        return {"message": "Access control managed successfully"}
```

#### 9.1.2. Muster Point Management Service
```python
# app/services/mustering/muster_point_service.py
class MusterPointService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def get_muster_point_status(self, emergency_id: str) -> Dict[str, Any]:
        """Get real-time status of all muster points"""
        db = next(get_db())
        
        # Get all active muster points
        muster_points = db.query(MusterPoint).filter(MusterPoint.is_active == True).all()
        
        status_data = []
        for point in muster_points:
            # Get current count from assignments
            current_count = db.query(MusteringAssignment).filter(
                MusteringAssignment.emergency_id == emergency_id,
                MusteringAssignment.muster_point_id == point.point_id,
                MusteringAssignment.status.in_(["SAFE", "INJURED"])
            ).count()
            
            # Get capacity utilization
            utilization = (current_count / point.max_capacity) * 100 if point.max_capacity > 0 else 0
            
            status_data.append({
                "point_id": point.point_id,
                "name": point.name,
                "zone_code": point.zone_code,
                "max_capacity": point.max_capacity,
                "current_count": current_count,
                "utilization": utilization,
                "is_primary": point.is_primary,
                "coordinates": point.coordinates,
                "equipment": point.equipment,
                "status": "ACTIVE" if current_count < point.max_capacity else "FULL"
            })
        
        return {
            "emergency_id": emergency_id,
            "muster_points": status_data,
            "total_capacity": sum(point["max_capacity"] for point in status_data),
            "total_count": sum(point["current_count"] for point in status_data),
            "overall_utilization": (sum(point["current_count"] for point in status_data) / 
                                sum(point["max_capacity"] for point in status_data)) * 100 if status_data else 0
        }
    
    async def create_muster_point(self, point_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new muster point"""
        db = next(get_db())
        
        muster_point = MusterPoint(
            point_id=self.generate_point_id(),
            name=point_data["name"],
            zone_code=point_data["zone_code"],
            max_capacity=point_data["max_capacity"],
            coordinates=point_data.get("coordinates", {"lat": 0.0, "lng": 0.0}),
            equipment=point_data.get("equipment", []),
            is_primary=point_data.get("is_primary", False),
            is_active=True
        )
        
        db.add(muster_point)
        db.commit()
        
        return {
            "point_id": muster_point.point_id,
            "message": "Muster point created successfully"
        }
    
    async def update_muster_point(self, point_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update existing muster point"""
        db = next(get_db())
        
        muster_point = db.query(MusterPoint).filter(MusterPoint.point_id == point_id).first()
        if not muster_point:
            raise ValueError(f"Muster point {point_id} not found")
        
        # Update fields
        for key, value in update_data.items():
            if hasattr(muster_point, key):
                setattr(muster_point, key, value)
        
        db.commit()
        
        return {"message": "Muster point updated successfully"}
```

#### 9.1.3. Personnel Accountability Service
```python
# app/services/mustering/personnel_accountability_service.py
class PersonnelAccountabilityService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def check_in_personnel(self, emergency_id: str, check_in_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check in personnel at muster point"""
        db = next(get_db())
        
        # Create muster assignment
        assignment = MusteringAssignment(
            assignment_id=self.generate_assignment_id(),
            emergency_id=emergency_id,
            personnel_id=check_in_data["personnel_id"],
            muster_point_id=check_in_data["muster_point_id"],
            status="SAFE",  # Default status, can be updated by medical team
            check_in_time=datetime.now(),
            check_in_method=check_in_data.get("method", "BIOMETRIC"),
            notes=check_in_data.get("notes", "")
        )
        
        db.add(assignment)
        db.commit()
        
        # Update muster point count
        await self.update_muster_point_count(check_in_data["muster_point_id"])
        
        # Verify biometric data if method is biometric
        if check_in_data.get("method") == "BIOMETRIC":
            await self.verify_biometric_check_in(assignment.assignment_id, check_in_data.get("biometric_data"))
        
        return {
            "assignment_id": assignment.assignment_id,
            "status": "CHECKED_IN",
            "message": "Personnel checked in successfully"
        }
    
    async def get_personnel_status(self, emergency_id: str) -> Dict[str, Any]:
        """Get personnel accountability status"""
        db = next(get_db())
        
        # Get all personnel assignments for this emergency
        assignments = db.query(MusteringAssignment).filter(
            MusteringAssignment.emergency_id == emergency_id
        ).all()
        
        # Count by status
        status_counts = {
            "SAFE": 0,
            "INJURED": 0,
            "MISSING": 0,
            "EVACUATED": 0,
            "PENDING": 0
        }
        
        personnel_details = []
        for assignment in assignments:
            status_counts[assignment.status] = status_counts.get(assignment.status, 0) + 1
            
            # Get personnel details
            personnel = db.query(Personnel).filter(Personnel.id == assignment.personnel_id).first()
            if personnel:
                personnel_details.append({
                    "personnel_id": personnel.id,
                    "full_name": personnel.full_name,
                    "badge_id": personnel.badge_id,
                    "department": personnel.department,
                    "status": assignment.status,
                    "muster_point_id": assignment.muster_point_id,
                    "check_in_time": assignment.check_in_time.isoformat() if assignment.check_in_time else None,
                    "check_in_method": assignment.check_in_method
                })
        
        # Get total personnel count from POB system
        total_personnel = await self.get_total_personnel_count()
        
        return {
            "emergency_id": emergency_id,
            "status_counts": status_counts,
            "personnel_details": personnel_details,
            "total_personnel": total_personnel,
            "accounted_personnel": sum(status_counts.values()),
            "missing_personnel": status_counts["MISSING"],
            "accountability_rate": (sum(status_counts.values()) / total_personnel * 100) if total_personnel > 0 else 0
        }
    
    async def identify_missing_personnel(self, emergency_id: str) -> Dict[str, Any]:
        """Identify personnel who haven't checked in"""
        db = next(get_db())
        
        # Get all active personnel
        all_personnel = db.query(Personnel).filter(Personnel.is_active == True).all()
        checked_in_personnel = set()
        
        # Get personnel who have checked in
        assignments = db.query(MusteringAssignment).filter(
            MusteringAssignment.emergency_id == emergency_id
        ).all()
        
        for assignment in assignments:
            checked_in_personnel.add(assignment.personnel_id)
        
        # Identify missing personnel
        missing_personnel = []
        for personnel in all_personnel:
            if personnel.id not in checked_in_personnel:
                # Get last known location from ZKTeco access logs
                last_location = await self.get_last_known_location(personnel.pin)
                
                missing_personnel.append({
                    "personnel_id": personnel.id,
                    "full_name": personnel.full_name,
                    "badge_id": personnel.badge_id,
                    "department": personnel.department,
                    "last_known_location": last_location,
                    "last_access_time": last_location.get("event_time") if last_location else None
                })
        
        return {
            "emergency_id": emergency_id,
            "missing_personnel": missing_personnel,
            "missing_count": len(missing_personnel),
            "search_priority": "HIGH" if len(missing_personnel) > 0 else "LOW"
        }
    
    async def get_last_known_location(self, pin: str) -> Optional[Dict[str, Any]]:
        """Get last known location from ZKTeco access logs"""
        try:
            token = await self.zkteco_client.get_valid_token()
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.zkteco_client.base_url}/api/transaction/person/{pin}",
                    params={"pageNo": 1, "pageSize": 1},
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    access_logs = data.get("data", [])
                    
                    if access_logs:
                        latest_log = access_logs[0]
                        return {
                            "pin": pin,
                            "area_name": latest_log.get("areaName"),
                            "event_time": latest_log.get("eventTime"),
                            "reader_name": latest_log.get("readerName"),
                            "device_sn": latest_log.get("devSn")
                        }
        except Exception as e:
            print(f"Error getting last known location for {pin}: {e}")
        
        return None
```

### 9.2. Real-time Monitoring and Dashboard

#### 9.2.1. Mustering Dashboard Service
```python
# app/services/mustering/dashboard_service.py
class MusteringDashboardService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def get_mustering_dashboard(self, emergency_id: str) -> Dict[str, Any]:
        """Get comprehensive mustering dashboard data"""
        # Get emergency details
        emergency_data = await self.get_emergency_details(emergency_id)
        
        # Get muster point status
        muster_status = await self.get_muster_point_status(emergency_id)
        
        # Get personnel accountability
        personnel_status = await self.get_personnel_status(emergency_id)
        
        # Get zone status
        zone_status = await self.get_zone_status(emergency_id)
        
        # Calculate progress metrics
        progress_metrics = self.calculate_progress_metrics(
            emergency_data, muster_status, personnel_status
        )
        
        return {
            "emergency": emergency_data,
            "muster_points": muster_status,
            "personnel": personnel_status,
            "zones": zone_status,
            "progress": progress_metrics,
            "timestamp": datetime.now().isoformat()
        }
    
    async def get_emergency_details(self, emergency_id: str) -> Dict[str, Any]:
        """Get emergency details"""
        db = next(get_db())
        
        emergency = db.query(MusteringEmergency).filter(
            MusteringEmergency.emergency_id == emergency_id
        ).first()
        
        if not emergency:
            raise ValueError(f"Emergency {emergency_id} not found")
        
        return {
            "emergency_id": emergency.emergency_id,
            "emergency_type": emergency.emergency_type,
            "priority_level": emergency.priority_level,
            "declared_by": emergency.declared_by,
            "declared_at": emergency.declared_at.isoformat(),
            "status": emergency.status,
            "description": emergency.description,
            "affected_zones": emergency.affected_zones,
            "duration_minutes": (datetime.now() - emergency.declared_at).total_seconds() / 60
        }
    
    async def get_zone_status(self, emergency_id: str) -> Dict[str, Any]:
        """Get zone status during emergency"""
        # Get affected zones from emergency
        db = next(get_db())
        emergency = db.query(MusteringEmergency).filter(
            MusteringEmergency.emergency_id == emergency_id
        ).first()
        
        affected_zones = emergency.affected_zones if emergency else []
        
        zone_status = []
        for zone_code in affected_zones:
            # Get personnel in this zone
            zone_personnel = await self.get_zone_personnel(zone_code)
            
            # Determine zone safety status
            zone_safety = self.determine_zone_safety(zone_code, emergency.emergency_type)
            
            zone_status.append({
                "zone_code": zone_code,
                "zone_name": self.get_zone_name(zone_code),
                "personnel_count": len(zone_personnel),
                "safety_status": zone_safety,
                "evacuation_required": zone_safety in ["DANGER", "EVACUATE"],
                "personnel_list": zone_personnel
            })
        
        return {
            "emergency_id": emergency_id,
            "zones": zone_status,
            "total_zones": len(zone_status),
            "safe_zones": len([z for z in zone_status if z["safety_status"] == "SAFE"]),
            "danger_zones": len([z for z in zone_status if z["safety_status"] == "DANGER"])
        }
    
    def calculate_progress_metrics(self, emergency_data: Dict, muster_status: Dict, personnel_status: Dict) -> Dict[str, Any]:
        """Calculate mustering progress metrics"""
        elapsed_minutes = emergency_data.get("duration_minutes", 0)
        total_capacity = muster_status.get("total_capacity", 0)
        total_count = personnel_status.get("accounted_personnel", 0)
        
        # Calculate completion rate
        completion_rate = (total_count / total_capacity * 100) if total_capacity > 0 else 0
        
        # Determine mustering status
        if completion_rate >= 95:
            mustering_status = "COMPLETE"
        elif completion_rate >= 80:
            mustering_status = "IN_PROGRESS"
        elif completion_rate >= 50:
            mustering_status = "PARTIAL"
        else:
            mustering_status = "INITIATING"
        
        return {
            "elapsed_minutes": elapsed_minutes,
            "completion_rate": completion_rate,
            "muster_status": mustering_status,
            "time_to_complete": self.estimate_time_to_complete(completion_rate, elapsed_minutes),
            "missing_personnel": personnel_status.get("missing_personnel", 0),
            "injured_personnel": personnel_status["status_counts"].get("INJURED", 0)
        }
    
    def estimate_time_to_complete(self, completion_rate: float, elapsed_minutes: float) -> str:
        """Estimate time to complete mustering based on current rate"""
        if completion_rate <= 0:
            return "Unknown"
        
        # Calculate rate of completion per minute
        rate_per_minute = completion_rate / elapsed_minutes if elapsed_minutes > 0 else 0
        
        if rate_per_minute <= 0:
            return "Unknown"
        
        remaining_percentage = 100 - completion_rate
        estimated_minutes = remaining_percentage / rate_per_minute
        
        if estimated_minutes < 1:
            return "< 1 minute"
        elif estimated_minutes < 60:
            return f"{int(estimated_minutes)} minutes"
        else:
            return f"{int(estimated_minutes / 60)} hours"
```

#### 9.2.2. Real-time WebSocket Monitoring
```python
# app/services/mustering/websocket_service.py
import asyncio
import json
import websockets
from typing import Dict, List, Any

class MusteringWebSocketService:
    def __init__(self):
        self.connections = {}
        self.emergency_monitors = {}
    
    async def start_emergency_monitoring(self, emergency_id: str):
        """Start real-time monitoring for emergency"""
        if emergency_id in self.emergency_monitors:
            return
        
        self.emergency_monitors[emergency_id] = {
            "started_at": datetime.now(),
            "connections": set(),
            "is_active": True
        }
        
        # Start monitoring loop
        asyncio.create_task(self.monitor_emergency(emergency_id))
    
    async def monitor_emergency(self, emergency_id: str):
        """Monitor emergency and broadcast updates"""
        while emergency_id in self.emergency_monitors and self.emergency_monitors[emergency_id]["is_active"]:
            try:
                # Get updated dashboard data
                dashboard_service = MusteringDashboardService()
                dashboard_data = await dashboard_service.get_mustering_dashboard(emergency_id)
                
                # Broadcast to all connected clients
                await self.broadcast_emergency_update(emergency_id, dashboard_data)
                
                # Check for critical alerts
                await self.check_critical_alerts(emergency_id, dashboard_data)
                
                # Wait before next update
                await asyncio.sleep(5)  # Update every 5 seconds
                
            except Exception as e:
                print(f"Error monitoring emergency {emergency_id}: {e}")
                await asyncio.sleep(10)  # Wait longer on error
    
    async def check_critical_alerts(self, emergency_id: str, dashboard_data: Dict):
        """Check for critical alerts and send notifications"""
        alerts = []
        
        # Check for missing personnel
        missing_count = dashboard_data["personnel"]["missing_personnel"]
        if missing_count > 0:
            alerts.append({
                "type": "MISSING_PERSONNEL",
                "severity": "CRITICAL",
                "message": f"{missing_count} personnel missing",
                "data": dashboard_data["personnel"]["missing_personnel"]
            })
        
        # Check for injured personnel
        injured_count = dashboard_data["personnel"]["status_counts"].get("INJURED", 0)
        if injured_count > 0:
            alerts.append({
                "type": "INJURED_PERSONNEL",
                "severity": "HIGH",
                "message": f"{injured_count} personnel injured",
                "data": injured_count
            })
        
        # Check for full muster points
        full_muster_points = [
            point for point in dashboard_data["muster_points"]["muster_points"]
            if point["status"] == "FULL"
        ]
        if full_muster_points:
            alerts.append({
                "type": "FULL_MUSTER_POINTS",
                "severity": "MEDIUM",
                "message": f"{len(full_muster_points)} muster points at capacity",
                "data": full_muster_points
            })
        
        # Broadcast alerts if any
        if alerts:
            await self.broadcast_alerts(emergency_id, alerts)
    
    async def broadcast_emergency_update(self, emergency_id: str, data: Dict):
        """Broadcast emergency update to all connected clients"""
        if emergency_id not in self.emergency_monitors:
            return
        
        message = {
            "type": "EMERGENCY_UPDATE",
            "emergency_id": emergency_id,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        # Send to all connected clients
        for connection_id in list(self.emergency_monitors[emergency_id]["connections"]):
            try:
                if connection_id in self.connections:
                    await self.connections[connection_id].send(json.dumps(message))
            except Exception as e:
                print(f"Error sending update to {connection_id}: {e}")
                # Remove dead connection
                self.emergency_monitors[emergency_id]["connections"].discard(connection_id)
    
    async def broadcast_alerts(self, emergency_id: str, alerts: List[Dict]):
        """Broadcast critical alerts"""
        message = {
            "type": "CRITICAL_ALERTS",
            "emergency_id": emergency_id,
            "alerts": alerts,
            "timestamp": datetime.now().isoformat()
        }
        
        # Send to all connected clients
        for connection_id in list(self.emergency_monitors[emergency_id]["connections"]):
            try:
                if connection_id in self.connections:
                    await self.connections[connection_id].send(json.dumps(message))
            except Exception as e:
                print(f"Error sending alerts to {connection_id}: {e}")
                self.emergency_monitors[emergency_id]["connections"].discard(connection_id)
```

### 9.3. Database Schema for Mustering Module

```python
# app/models/mustering.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class MusteringEmergency(Base):
    """Emergency incidents requiring mustering"""
    __tablename__ = "mustering_emergencies"
    
    id = Column(Integer, primary_key=True, index=True)
    emergency_id = Column(String(50), unique=True, nullable=False, index=True)
    emergency_type = Column(Enum('FIRE', 'GAS_LEAK', 'MEDICAL', 'SECURITY', 'DRILL'), nullable=False)
    priority_level = Column(Enum('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'), nullable=False, default='MEDIUM')
    declared_by = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    declared_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    resolved_at = Column(DateTime(timezone=True))
    status = Column(Enum('ACTIVE', 'RESOLVED', 'CANCELLED'), nullable=False, default='ACTIVE')
    description = Column(Text)
    affected_zones = Column(JSON)  # List of zone codes
    total_personnel = Column(Integer, default=0)
    accounted_personnel = Column(Integer, default=0)
    missing_personnel = Column(Integer, default=0)
    injured_personnel = Column(Integer, default=0)
    evacuation_required = Column(Boolean, default=False)
    
    # Relationships
    assignments = relationship("MusteringAssignment", back_populates="emergency")
    alerts = relationship("MusteringAlert", back_populates="emergency")

class MusterPoint(Base):
    """Muster point locations for personnel assembly"""
    __tablename__ = "muster_points"
    
    id = Column(Integer, primary_key=True, index=True)
    point_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    zone_code = Column(String(20), nullable=False)
    max_capacity = Column(Integer, nullable=False)
    current_count = Column(Integer, default=0)
    coordinates = Column(JSON)  # {"lat": 0.0, "lng": 0.0, "altitude": 0.0}
    equipment = Column(JSON)  # Safety equipment list
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    assignments = relationship("MusteringAssignment", back_populates="muster_point")

class MusteringAssignment(Base):
    """Personnel assignments to muster points"""
    __tablename__ = "mustering_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(String(50), unique=True, nullable=False, index=True)
    emergency_id = Column(String(50), ForeignKey("mustering_emergencies.emergency_id"), nullable=False)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    muster_point_id = Column(String(50), ForeignKey("muster_points.point_id"), nullable=False)
    status = Column(Enum('PENDING', 'SAFE', 'INJURED', 'MISSING', 'EVACUATED'), nullable=False, default='PENDING')
    check_in_time = Column(DateTime(timezone=True))
    check_in_method = Column(Enum('BIOMETRIC', 'CARD', 'MANUAL', 'AUTOMATIC'), nullable=False, default='BIOMETRIC')
    biometric_data = Column(JSON)  # Biometric verification data
    notes = Column(Text)
    verified_by = Column(Integer, ForeignKey("users.id"))
    verified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    emergency = relationship("MusteringEmergency", back_populates="assignments")
    personnel = relationship("Personnel")
    muster_point = relationship("MusterPoint", back_populates="assignments")

class MusteringAlert(Base):
    """Alerts generated during mustering operations"""
    __tablename__ = "mustering_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    emergency_id = Column(String(50), ForeignKey("mustering_emergencies.emergency_id"), nullable=False)
    alert_type = Column(Enum('MISSING_PERSONNEL', 'INJURED_PERSONNEL', 'FULL_MUSTER_POINTS', 'ZONE_DANGER', 'TIMEOUT'), nullable=False)
    severity = Column(Enum('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'), nullable=False)
    message = Column(Text, nullable=False)
    alert_data = Column(JSON)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(Integer, ForeignKey("users.id"))
    acknowledged_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    emergency = relationship("MusteringEmergency", back_populates="alerts")

class MusteringDrill(Base):
    """Mustering drill records for training and compliance"""
    __tablename__ = "mustering_drills"
    
    id = Column(Integer, primary_key=True, index=True)
    drill_id = Column(String(50), unique=True, nullable=False, index=True)
    drill_type = Column(Enum('FIRE', 'GAS_LEAK', 'MEDICAL', 'SECURITY', 'EVACUATION'), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    status = Column(Enum('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'), nullable=False, default='SCHEDULED')
    total_personnel = Column(Integer, default=0)
    participated_personnel = Column(Integer, default=0)
    completion_time_minutes = Column(Integer)
    success_rate = Column(Float, default=0.0)
    notes = Column(Text)
    
    # Relationships
    assignments = relationship("MusteringDrillAssignment", back_populates="drill")

class MusteringDrillAssignment(Base):
    """Personnel participation in mustering drills"""
    __tablename__ = "mustering_drill_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    drill_id = Column(String(50), ForeignKey("mustering_drills.drill_id"), nullable=False)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    muster_point_id = Column(String(50), ForeignKey("muster_points.point_id"), nullable=False)
    check_in_time = Column(DateTime(timezone=True))
    status = Column(Enum('PARTICIPATED', 'ABSENT', 'LATE'))
    evaluation_score = Column(Integer)  # 1-5 performance rating
    notes = Column(Text)
    
    # Relationships
    drill = relationship("MusteringDrill", back_populates="assignments")
    personnel = relationship("Personnel")
    muster_point = relationship("MusterPoint")
```

### 9.4. API Endpoints for Mustering Module

```python
# app/api/mustering/emergencies.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.mustering.emergency_service import MusteringEmergencyService
from app.services.mustering.dashboard_service import MusteringDashboardService
from app.core.dependencies import get_current_active_user

router = APIRouter(prefix="/api/v1/mustering/emergencies", tags=["Mustering Emergencies"])

@router.post("/declare", response_model=Dict[str, Any])
async def declare_emergency(
    emergency_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Declare emergency and trigger mustering procedures"""
    service = MusteringEmergencyService()
    return await service.declare_emergency(emergency_data)

@router.get("/active", response_model=List[Dict[str, Any]])
async def get_active_emergencies(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get list of active emergencies"""
    # Implementation for getting active emergencies
    pass

@router.post("/{emergency_id}/resolve", response_model=Dict[str, Any])
async def resolve_emergency(
    emergency_id: str,
    resolution_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Resolve emergency and end mustering procedures"""
    # Implementation for resolving emergency
    pass

@router.get("/{emergency_id}/dashboard", response_model=Dict[str, Any])
async def get_emergency_dashboard(
    emergency_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get comprehensive emergency dashboard"""
    service = MusteringDashboardService()
    return await service.get_mustering_dashboard(emergency_id)

# app/api/mustering/muster-points.py
@router.get("/muster-points", response_model=List[Dict[str, Any]])
async def get_muster_points(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get all active muster points"""
    service = MusterPointService()
    return await service.get_all_muster_points()

@router.post("/muster-points", response_model=Dict[str, Any])
async def create_muster_point(
    point_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create new muster point"""
    service = MusterPointService()
    return await service.create_muster_point(point_data)

@router.put("/muster-points/{point_id}", response_model=Dict[str, Any])
async def update_muster_point(
    point_id: str,
    update_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Update existing muster point"""
    service = MusterPointService()
    return await service.update_muster_point(point_id, update_data)

# app/api/mustering/personnel.py
@router.get("/{emergency_id}/personnel/status", response_model=Dict[str, Any])
async def get_personnel_status(
    emergency_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get personnel accountability status"""
    service = PersonnelAccountabilityService()
    return await service.get_personnel_status(emergency_id)

@router.post("/{emergency_id}/personnel/check-in", response_model=Dict[str, Any])
async def check_in_personnel(
    emergency_id: str,
    check_in_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Check in personnel at muster point"""
    service = PersonnelAccountabilityService()
    return await service.check_in_personnel(emergency_id, check_in_data)

@router.get("/{emergency_id}/personnel/missing", response_model=Dict[str, Any])
async def get_missing_personnel(
    emergency_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get list of missing personnel"""
    service = PersonnelAccountabilityService()
    return await service.identify_missing_personnel(emergency_id)
```

---

## 10. Personnel On Board (POB) Module Integration

### 10.1. POB Manifest Management

#### 10.1.1. POB Manifest Service Architecture
```python
# app/services/pob/manifest_service.py
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.pob import POBManifest, POBPersonnel, POBTransport, POBCertification

class POBManifestService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def create_daily_manifest(self, manifest_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create daily personnel manifest for platform operations"""
        manifest = POBManifest(
            manifest_date=manifest_data["manifest_date"],
            platform_id=manifest_data["platform_id"],
            max_capacity=manifest_data["max_capacity"],
            status="ACTIVE"
        )
        
        # Save to database
        db = next(get_db())
        db.add(manifest)
        db.commit()
        
        # Initialize with current on-board personnel
        await self.initialize_manifest_personnel(manifest.manifest_id)
        
        return {
            "manifest_id": manifest.manifest_id,
            "platform_id": manifest.platform_id,
            "manifest_date": manifest.manifest_date.isoformat(),
            "status": "ACTIVE"
        }
    
    async def get_current_pob_count(self, platform_id: str) -> Dict[str, Any]:
        """Get real-time POB count for platform"""
        db = next(get_db())
        
        # Get today's manifest
        today = date.today()
        manifest = db.query(POBManifest).filter(
            POBManifest.platform_id == platform_id,
            POBManifest.manifest_date == today,
            POBManifest.status == "ACTIVE"
        ).first()
        
        if not manifest:
            return {"error": "No active manifest found for today"}
        
        # Get personnel breakdown
        personnel_query = db.query(POBPersonnel).filter(
            POBPersonnel.manifest_id == manifest.manifest_id,
            POBPersonnel.status == "ON_BOARD"
        ).all()
        
        # Count by category
        category_counts = {
            "STAFF": 0,
            "CONTRACTOR": 0,
            "VISITOR": 0,
            "CREW": 0
        }
        
        for personnel in personnel_query:
            # Get personnel category from main personnel table
            person = db.query(Personnel).filter(Personnel.id == personnel.personnel_id).first()
            if person:
                category = getattr(person, 'category', 'STAFF')
                category_counts[category] = category_counts.get(category, 0) + 1
        
        total_count = sum(category_counts.values())
        utilization_rate = (total_count / manifest.max_capacity) * 100 if manifest.max_capacity > 0 else 0
        
        return {
            "platform_id": platform_id,
            "manifest_id": manifest.manifest_id,
            "manifest_date": manifest.manifest_date.isoformat(),
            "total_personnel": total_count,
            "max_capacity": manifest.max_capacity,
            "utilization_rate": utilization_rate,
            "category_breakdown": category_counts,
            "status": "ACTIVE"
        }
    
    async def initialize_manifest_personnel(self, manifest_id: int) -> Dict[str, Any]:
        """Initialize manifest with current on-board personnel"""
        db = next(get_db())
        
        # Get all personnel currently on board from previous day
        previous_manifest = db.query(POBManifest).filter(
            POBManifest.manifest_date == date.today() - timedelta(days=1)
        ).first()
        
        if previous_manifest:
            # Copy personnel who are still on board
            previous_personnel = db.query(POBPersonnel).filter(
                POBPersonnel.manifest_id == previous_manifest.manifest_id,
                POBPersonnel.status == "ON_BOARD",
                POBPersonnel.expected_departure >= date.today()
            ).all()
            
            for prev_person in previous_personnel:
                new_personnel = POBPersonnel(
                    manifest_id=manifest_id,
                    personnel_id=prev_person.personnel_id,
                    boarding_time=datetime.now(),
                    status="ON_BOARD",
                    zone_code=prev_person.zone_code,
                    room_number=prev_person.room_number,
                    work_area=prev_person.work_area,
                    purpose_of_visit=prev_person.purpose_of_visit,
                    expected_departure=prev_person.expected_departure
                )
                db.add(new_personnel)
        
        db.commit()
        return {"message": "Manifest initialized successfully"}
```

#### 10.1.2. Boarding and Deboarding Service
```python
# app/services/pob/boarding_service.py
class POBBoardingService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def process_boarding_request(self, boarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process personnel boarding request with validation"""
        db = next(get_db())
        
        # Validate personnel eligibility
        validation_result = await self.validate_boarding_eligibility(boarding_data["personnel_id"])
        
        if not validation_result["eligible"]:
            return {
                "status": "REJECTED",
                "reason": validation_result["reason"],
                "details": validation_result["details"]
            }
        
        # Check transport capacity
        transport_validation = await self.validate_transport_capacity(
            boarding_data["transport_id"],
            boarding_data["departure_time"]
        )
        
        if not transport_validation["available"]:
            return {
                "status": "REJECTED",
                "reason": "Transport capacity exceeded",
                "details": transport_validation
            }
        
        # Create boarding record
        boarding_record = POBPersonnel(
            manifest_id=boarding_data["manifest_id"],
            personnel_id=boarding_data["personnel_id"],
            boarding_time=boarding_data["departure_time"],
            transport_method=boarding_data["transport_type"],
            transport_id=boarding_data["transport_id"],
            seat_number=boarding_data.get("seat_number"),
            status="TRANSIT",
            purpose_of_visit=boarding_data["purpose_of_visit"],
            expected_departure=boarding_data["expected_departure"]
        )
        
        db.add(boarding_record)
        db.commit()
        
        # Update transport seat count
        await self.update_transport_seats(boarding_data["transport_id"], 1)
        
        # Generate boarding pass
        boarding_pass = await self.generate_boarding_pass(boarding_record.id)
        
        return {
            "status": "APPROVED",
            "boarding_id": boarding_record.id,
            "boarding_pass": boarding_pass,
            "seat_number": boarding_data.get("seat_number"),
            "transport_details": transport_validation["transport_details"]
        }
    
    async def validate_boarding_eligibility(self, personnel_id: int) -> Dict[str, Any]:
        """Validate personnel eligibility for boarding"""
        db = next(get_db())
        
        # Check if personnel is already on board
        today = date.today()
        current_manifest = db.query(POBManifest).filter(
            POBManifest.manifest_date == today,
            POBManifest.status == "ACTIVE"
        ).first()
        
        if current_manifest:
            existing_record = db.query(POBPersonnel).filter(
                POBPersonnel.manifest_id == current_manifest.manifest_id,
                POBPersonnel.personnel_id == personnel_id,
                POBPersonnel.status.in_(["ON_BOARD", "TRANSIT"])
            ).first()
            
            if existing_record:
                return {
                    "eligible": False,
                    "reason": "Personnel already on board",
                    "details": {
                        "status": existing_record.status,
                        "boarding_time": existing_record.boarding_time.isoformat() if existing_record.boarding_time else None
                    }
                }
        
        # Check certifications
        certifications = db.query(POBCertification).filter(
            POBCertification.personnel_id == personnel_id,
            POBCertification.expiry_date > date.today(),
            POBCertification.status == "VALID"
        ).all()
        
        required_certifications = ["BOSIET", "H2S_AWARENESS", "MEDICAL_CLEARANCE"]
        missing_certifications = []
        
        for cert in required_certifications:
            if not any(c.certification_type == cert for c in certifications):
                missing_certifications.append(cert)
        
        if missing_certifications:
            return {
                "eligible": False,
                "reason": "Missing required certifications",
                "details": {
                    "missing_certifications": missing_certifications,
                    "valid_certifications": [c.certification_type for c in certifications]
                }
            }
        
        # Check medical fitness
        medical_cert = db.query(POBCertification).filter(
            POBCertification.personnel_id == personnel_id,
            POBCertification.certification_type == "MEDICAL_CLEARANCE",
            POBCertification.expiry_date > date.today(),
            POBCertification.status == "VALID"
        ).first()
        
        if not medical_cert:
            return {
                "eligible": False,
                "reason": "Medical clearance not valid",
                "details": {
                    "medical_status": "INVALID"
                }
            }
        
        return {
            "eligible": True,
            "reason": "All validations passed",
            "details": {
                "certifications": [c.certification_type for c in certifications],
                "medical_valid_until": medical_cert.expiry_date.isoformat()
            }
        }
    
    async def process_deboarding_request(self, deboarding_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process personnel deboarding request"""
        db = next(get_db())
        
        # Find current boarding record
        today = date.today()
        current_manifest = db.query(POBManifest).filter(
            POBManifest.manifest_date == today,
            POBManifest.status == "ACTIVE"
        ).first()
        
        if not current_manifest:
            return {"status": "ERROR", "reason": "No active manifest found"}
        
        boarding_record = db.query(POBPersonnel).filter(
            POBPersonnel.manifest_id == current_manifest.manifest_id,
            POBPersonnel.personnel_id == deboarding_data["personnel_id"],
            POBPersonnel.status.in_(["ON_BOARD", "TRANSIT"])
        ).first()
        
        if not boarding_record:
            return {"status": "ERROR", "reason": "Personnel not found on board"}
        
        # Update deboarding information
        boarding_record.deboarding_time = deboarding_data["departure_time"]
        boarding_record.transport_method = deboarding_data["transport_type"]
        boarding_record.transport_id = deboarding_data["transport_id"]
        boarding_record.status = "DEBOARDED"
        
        db.commit()
        
        # Update transport seat count
        await self.update_transport_seats(deboarding_data["transport_id"], -1)
        
        # Generate deboarding summary
        summary = await self.generate_deboarding_summary(boarding_record.id)
        
        return {
            "status": "COMPLETED",
            "deboarding_time": deboarding_data["departure_time"].isoformat(),
            "transport_details": deboarding_data["transport_id"],
            "summary": summary
        }
    
    async def generate_boarding_pass(self, boarding_id: int) -> Dict[str, Any]:
        """Generate digital boarding pass with QR code"""
        db = next(get_db())
        
        boarding_record = db.query(POBPersonnel).filter(
            POBPersonnel.id == boarding_id
        ).first()
        
        if not boarding_record:
            return {"error": "Boarding record not found"}
        
        # Get personnel details
        personnel = db.query(Personnel).filter(
            Personnel.id == boarding_record.personnel_id
        ).first()
        
        # Get transport details
        transport = db.query(POBTransport).filter(
            POBTransport.transport_id == boarding_record.transport_id
        ).first()
        
        # Generate QR code data
        qr_data = {
            "boarding_id": boarding_id,
            "personnel_id": boarding_record.personnel_id,
            "transport_id": boarding_record.transport_id,
            "departure_time": boarding_record.boarding_time.isoformat() if boarding_record.boarding_time else None,
            "seat_number": boarding_record.seat_number,
            "platform": transport.destination if transport else "Unknown"
        }
        
        boarding_pass = {
            "pass_id": f"BP_{boarding_id}_{datetime.now().strftime('%Y%m%d')}",
            "personnel_name": personnel.full_name if personnel else "Unknown",
            "badge_id": personnel.badge_id if personnel else "Unknown",
            "transport_type": boarding_record.transport_method,
            "transport_name": transport.transport_name if transport else "Unknown",
            "departure_time": boarding_record.boarding_time.isoformat() if boarding_record.boarding_time else None,
            "seat_number": boarding_record.seat_number,
            "destination": transport.destination if transport else "Unknown",
            "qr_code": self.generate_qr_code(qr_data),
            "generated_at": datetime.now().isoformat()
        }
        
        return boarding_pass
```

### 10.2. Transport Management

#### 10.2.1. Transport Scheduling Service
```python
# app/services/pob/transport_service.py
class POBTransportService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def create_transport_schedule(self, transport_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create transport schedule for personnel movement"""
        transport = POBTransport(
            transport_id=self.generate_transport_id(),
            transport_type=transport_data["transport_type"],  # HELICOPTER, VESSEL, VEHICLE
            transport_name=transport_data["transport_name"],
            origin=transport_data["origin"],
            destination=transport_data["destination"],
            departure_time=transport_data["departure_time"],
            arrival_time=transport_data.get("arrival_time"),
            capacity=transport_data["capacity"],
            captain_pilot=transport_data.get("captain_pilot"),
            status="SCHEDULED"
        )
        
        db = next(get_db())
        db.add(transport)
        db.commit()
        
        return {
            "transport_id": transport.transport_id,
            "status": "SCHEDULED",
            "message": "Transport scheduled successfully"
        }
    
    async def get_transport_manifest(self, transport_id: str) -> Dict[str, Any]:
        """Get complete transport manifest with personnel details"""
        db = next(get_db())
        
        # Get transport details
        transport = db.query(POBTransport).filter(
            POBTransport.transport_id == transport_id
        ).first()
        
        if not transport:
            return {"error": "Transport not found"}
        
        # Get personnel assigned to this transport
        personnel_records = db.query(POBPersonnel).filter(
            POBPersonnel.transport_id == transport_id,
            POBPersonnel.status.in_(["TRANSIT", "ON_BOARD"])
        ).all()
        
        manifest_personnel = []
        for record in personnel_records:
            personnel = db.query(Personnel).filter(
                Personnel.id == record.personnel_id
            ).first()
            
            if personnel:
                manifest_personnel.append({
                    "personnel_id": personnel.id,
                    "full_name": personnel.full_name,
                    "badge_id": personnel.badge_id,
                    "category": getattr(personnel, 'category', 'STAFF'),
                    "seat_number": record.seat_number,
                    "boarding_time": record.boarding_time.isoformat() if record.boarding_time else None,
                    "purpose_of_visit": record.purpose_of_visit,
                    "emergency_contact": record.emergency_contact
                })
        
        return {
            "transport_id": transport_id,
            "transport_details": {
                "name": transport.transport_name,
                "type": transport.transport_type,
                "origin": transport.origin,
                "destination": transport.destination,
                "departure_time": transport.departure_time.isoformat(),
                "arrival_time": transport.arrival_time.isoformat() if transport.arrival_time else None,
                "capacity": transport.capacity,
                "occupied_seats": len(manifest_personnel),
                "available_seats": transport.capacity - len(manifest_personnel),
                "captain_pilot": transport.captain_pilot,
                "status": transport.status
            },
            "personnel_manifest": manifest_personnel,
            "utilization": (len(manifest_personnel) / transport.capacity) * 100 if transport.capacity > 0 else 0
        }
    
    async def update_transport_status(self, transport_id: str, status_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update transport status and related operations"""
        db = next(get_db())
        
        transport = db.query(POBTransport).filter(
            POBTransport.transport_id == transport_id
        ).first()
        
        if not transport:
            return {"error": "Transport not found"}
        
        # Update transport status
        transport.status = status_data["status"]
        transport.weather_conditions = status_data.get("weather_conditions")
        transport.notes = status_data.get("notes")
        
        db.commit()
        
        # Trigger related actions based on status
        if status_data["status"] == "DEPARTED":
            await self.process_transport_departure(transport_id)
        elif status_data["status"] == "ARRIVED":
            await self.process_transport_arrival(transport_id)
        elif status_data["status"] == "CANCELLED":
            await self.process_transport_cancellation(transport_id)
        
        return {
            "transport_id": transport_id,
            "status": transport.status,
            "updated_at": datetime.now().isoformat(),
            "message": f"Transport status updated to {transport.status}"
        }
    
    async def process_transport_departure(self, transport_id: str) -> Dict[str, Any]:
        """Process transport departure operations"""
        db = next(get_db())
        
        # Update all personnel on this transport to TRANSIT status
        personnel_records = db.query(POBPersonnel).filter(
            POBPersonnel.transport_id == transport_id,
            POBPersonnel.status == "ON_BOARD"
        ).all()
        
        for record in personnel_records:
            record.status = "TRANSIT"
            record.boarding_time = datetime.now()
        
        db.commit()
        
        # Send departure notifications
        await self.send_departure_notifications(transport_id)
        
        return {"message": "Transport departure processed successfully"}
    
    async def process_transport_arrival(self, transport_id: str) -> Dict[str, Any]:
        """Process transport arrival operations"""
        db = next(get_db())
        
        # Update all personnel on this transport to ON_BOARD status
        personnel_records = db.query(POBPersonnel).filter(
            POBPersonnel.transport_id == transport_id,
            POBPersonnel.status == "TRANSIT"
        ).all()
        
        for record in personnel_records:
            record.status = "ON_BOARD"
            record.deboarding_time = datetime.now()
        
        db.commit()
        
        # Send arrival notifications
        await self.send_arrival_notifications(transport_id)
        
        return {"message": "Transport arrival processed successfully"}
```

### 10.3. Safety and Compliance Management

#### 10.3.1. Certification Management Service
```python
# app/services/pob/certification_service.py
class POBCertificationService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def add_personnel_certification(self, cert_data: Dict[str, Any]) -> Dict[str, Any]:
        """Add personnel certification with validation"""
        db = next(get_db())
        
        # Check for existing certification
        existing_cert = db.query(POBCertification).filter(
            POBCertification.personnel_id == cert_data["personnel_id"],
            POBCertification.certification_type == cert_data["certification_type"],
            POBCertification.status == "VALID"
        ).first()
        
        if existing_cert:
            return {
                "status": "WARNING",
                "message": "Valid certification already exists",
                "existing_cert": {
                    "certification_number": existing_cert.certification_number,
                    "expiry_date": existing_cert.expiry_date.isoformat()
                }
            }
        
        # Create new certification
        certification = POBCertification(
            personnel_id=cert_data["personnel_id"],
            certification_type=cert_data["certification_type"],
            certification_number=cert_data["certification_number"],
            issued_date=cert_data["issued_date"],
            expiry_date=cert_data["expiry_date"],
            issuing_authority=cert_data["issuing_authority"],
            status="VALID"
        )
        
        db.add(certification)
        db.commit()
        
        return {
            "certification_id": certification.id,
            "status": "ACTIVE",
            "message": "Certification added successfully"
        }
    
    async def get_expiring_certifications(self, days_ahead: int = 30) -> Dict[str, Any]:
        """Get certifications expiring within specified days"""
        db = next(get_db())
        
        expiry_date = date.today() + timedelta(days=days_ahead)
        
        expiring_certs = db.query(POBCertification).filter(
            POBCertification.expiry_date <= expiry_date,
            POBCertification.expiry_date > date.today(),
            POBCertification.status == "VALID"
        ).all()
        
        expiring_list = []
        for cert in expiring_certs:
            personnel = db.query(Personnel).filter(
                Personnel.id == cert.personnel_id
            ).first()
            
            if personnel:
                days_to_expiry = (cert.expiry_date - date.today()).days
                expiring_list.append({
                    "certification_id": cert.id,
                    "personnel_id": cert.personnel_id,
                    "personnel_name": personnel.full_name,
                    "badge_id": personnel.badge_id,
                    "certification_type": cert.certification_type,
                    "certification_number": cert.certification_number,
                    "expiry_date": cert.expiry_date.isoformat(),
                    "days_to_expiry": days_to_expiry,
                    "urgency": "HIGH" if days_to_expiry <= 7 else "MEDIUM" if days_to_expiry <= 14 else "LOW"
                })
        
        return {
            "total_expiring": len(expiring_list),
            "high_priority": len([c for c in expiring_list if c["urgency"] == "HIGH"]),
            "medium_priority": len([c for c in expiring_list if c["urgency"] == "MEDIUM"]),
            "low_priority": len([c for c in expiring_list if c["urgency"] == "LOW"]),
            "certifications": expiring_list
        }
    
    async def check_compliance_status(self, personnel_id: int) -> Dict[str, Any]:
        """Check personnel compliance status for boarding"""
        db = next(get_db())
        
        # Get all valid certifications
        certifications = db.query(POBCertification).filter(
            POBCertification.personnel_id == personnel_id,
            POBCertification.expiry_date > date.today(),
            POBCertification.status == "VALID"
        ).all()
        
        # Required certifications for offshore operations
        required_certs = {
            "BOSIET": "Basic Offshore Safety Induction and Emergency Training",
            "H2S_AWARENESS": "Hydrogen Sulfide Safety Awareness",
            "MEDICAL_CLEARANCE": "Medical Fitness Certificate"
        }
        
        compliance_status = {
            "personnel_id": personnel_id,
            "overall_status": "COMPLIANT",
            "required_certifications": {},
            "additional_certifications": [],
            "missing_certifications": [],
            "expiring_soon": []
        }
        
        # Check required certifications
        for cert_type, description in required_certs.items():
            cert_found = False
            for cert in certifications:
                if cert.certification_type == cert_type:
                    days_to_expiry = (cert.expiry_date - date.today()).days
                    compliance_status["required_certifications"][cert_type] = {
                        "status": "VALID",
                        "certification_number": cert.certification_number,
                        "expiry_date": cert.expiry_date.isoformat(),
                        "days_to_expiry": days_to_expiry,
                        "description": description
                    }
                    
                    if days_to_expiry <= 30:
                        compliance_status["expiring_soon"].append({
                            "certification_type": cert_type,
                            "days_to_expiry": days_to_expiry
                        })
                    
                    cert_found = True
                    break
            
            if not cert_found:
                compliance_status["required_certifications"][cert_type] = {
                    "status": "MISSING",
                    "description": description
                }
                compliance_status["missing_certifications"].append(cert_type)
                compliance_status["overall_status"] = "NON_COMPLIANT"
        
        # Additional certifications
        for cert in certifications:
            if cert.certification_type not in required_certs:
                compliance_status["additional_certifications"].append({
                    "certification_type": cert.certification_type,
                    "certification_number": cert.certification_number,
                    "expiry_date": cert.expiry_date.isoformat()
                })
        
        return compliance_status
```

### 10.4. Database Schema for POB Module

```python
# app/models/pob.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, Enum, ForeignKey, Date, Float
from sqlalchemy.orm import relationship
from app.core.database import Base

class POBManifest(Base):
    """Daily personnel manifest for platform operations"""
    __tablename__ = "pob_manifests"
    
    id = Column(Integer, primary_key=True, index=True)
    manifest_id = Column(String(50), unique=True, nullable=False, index=True)
    manifest_date = Column(Date, nullable=False, index=True)
    platform_id = Column(String(20), nullable=False)  # Platform identifier
    total_personnel = Column(Integer, default=0)
    staff_count = Column(Integer, default=0)
    contractor_count = Column(Integer, default=0)
    visitor_count = Column(Integer, default=0)
    crew_count = Column(Integer, default=0)
    max_capacity = Column(Integer, nullable=False)
    utilization_rate = Column(Float, default=0.0)
    status = Column(Enum('ACTIVE', 'CLOSED', 'CANCELLED'), default='ACTIVE')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    personnel = relationship("POBPersonnel", back_populates="manifest")
    incidents = relationship("POBIncident", back_populates="manifest")

class POBPersonnel(Base):
    """Individual personnel on board records"""
    __tablename__ = "pob_personnel"
    
    id = Column(Integer, primary_key=True, index=True)
    manifest_id = Column(Integer, ForeignKey("pob_manifests.id"), nullable=False)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    boarding_time = Column(DateTime(timezone=True))
    deboarding_time = Column(DateTime(timezone=True))
    transport_method = Column(Enum('HELICOPTER', 'VESSEL', 'VEHICLE'))
    transport_id = Column(String(50))  # Flight/vessel number
    seat_number = Column(String(10))
    zone_code = Column(String(20))  # Current zone location
    room_number = Column(String(20))  # Accommodation assignment
    work_area = Column(String(50))  # Work area assignment
    status = Column(Enum('ON_BOARD', 'TRANSIT', 'DEBOARDED'), default='ON_BOARD')
    purpose_of_visit = Column(String(200))
    expected_departure = Column(Date)
    certification_status = Column(Enum('VALID', 'EXPIRED', 'PENDING'), default='VALID')
    medical_status = Column(Enum('FIT', 'UNFIT', 'PENDING'), default='FIT')
    safety_briefing_completed = Column(Boolean, default=False)
    emergency_contact = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    manifest = relationship("POBManifest", back_populates="personnel")
    personnel = relationship("Personnel")
    incidents = relationship("POBIncident", back_populates="personnel")

class POBTransport(Base):
    """Transport scheduling and management"""
    __tablename__ = "pob_transports"
    
    id = Column(Integer, primary_key=True, index=True)
    transport_id = Column(String(50), unique=True, nullable=False, index=True)
    transport_type = Column(Enum('HELICOPTER', 'VESSEL', 'VEHICLE'), nullable=False)
    transport_name = Column(String(100))  # Flight name, vessel name
    origin = Column(String(100))  # Departure location
    destination = Column(String(100))  # Platform location
    departure_time = Column(DateTime(timezone=True), nullable=False)
    arrival_time = Column(DateTime(timezone=True))
    capacity = Column(Integer, nullable=False)
    occupied_seats = Column(Integer, default=0)
    status = Column(Enum('SCHEDULED', 'DEPARTED', 'ARRIVED', 'CANCELLED'), default='SCHEDULED')
    captain_pilot = Column(String(100))
    weather_conditions = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    personnel = relationship("POBPersonnel")

class POBCertification(Base):
    """Personnel certification tracking"""
    __tablename__ = "pob_certifications"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    certification_type = Column(String(100), nullable=False)  # BOSIET, H2S, etc.
    certification_number = Column(String(100))
    issued_date = Column(Date)
    expiry_date = Column(Date)
    issuing_authority = Column(String(200))
    status = Column(Enum('VALID', 'EXPIRED', 'SUSPENDED'), default='VALID')
    certificate_file = Column(String(500))  # File path or URL
    reminder_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    personnel = relationship("Personnel")

class POBIncident(Base):
    """Safety incidents involving personnel"""
    __tablename__ = "pob_incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(50), unique=True, nullable=False, index=True)
    manifest_id = Column(Integer, ForeignKey("pob_manifests.id"))
    personnel_id = Column(Integer, ForeignKey("personnel.id"))
    incident_type = Column(Enum('INJURY', 'ILLNESS', 'NEAR_MISS', 'SAFETY_BREACH', 'OTHER'))
    incident_date = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(100))
    description = Column(Text)
    severity = Column(Enum('MINOR', 'MAJOR', 'CRITICAL', 'FATAL'))
    medical_attention_required = Column(Boolean, default=False)
    evacuated = Column(Boolean, default=False)
    reported_by = Column(Integer, ForeignKey("users.id"))
    investigated_by = Column(Integer, ForeignKey("users.id"))
    status = Column(Enum('OPEN', 'INVESTIGATING', 'CLOSED'), default='OPEN')
    corrective_actions = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    manifest = relationship("POBManifest", back_populates="incidents")
    personnel = relationship("Personnel")
    incidents_personnel = relationship("POBPersonnel", back_populates="incidents")

class POBSafetyBriefing(Base):
    """Safety briefing completion tracking"""
    __tablename__ = "pob_safety_briefings"
    
    id = Column(Integer, primary_key=True, index=True)
    briefing_id = Column(String(50), unique=True, nullable=False, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    briefing_type = Column(Enum('GENERAL_SAFETY', 'EMERGENCY_PROCEDURES', 'H2S_SAFETY', 'FIRE_SAFETY'))
    briefing_date = Column(DateTime(timezone=True), nullable=False)
    presenter = Column(String(100))
    completion_status = Column(Enum('COMPLETED', 'PENDING', 'FAILED'), default='PENDING')
    test_score = Column(Integer)  # Optional test score
    certificate_issued = Column(Boolean, default=False)
    next_briefing_due = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    personnel = relationship("Personnel")
```

### 10.5. API Endpoints for POB Module

```python
# app/api/pob/manifests.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.pob.manifest_service import POBManifestService
from app.core.dependencies import get_current_active_user

router = APIRouter(prefix="/api/v1/pob/manifests", tags=["POB Manifests"])

@router.post("/", response_model=Dict[str, Any])
async def create_manifest(
    manifest_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create daily personnel manifest"""
    service = POBManifestService()
    return await service.create_daily_manifest(manifest_data)

@router.get("/current/{platform_id}", response_model=Dict[str, Any])
async def get_current_pob(
    platform_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get current POB count for platform"""
    service = POBManifestService()
    return await service.get_current_pob_count(platform_id)

# app/api/pob/boarding.py
@router.post("/boarding/request", response_model=Dict[str, Any])
async def request_boarding(
    boarding_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Process personnel boarding request"""
    service = POBBoardingService()
    return await service.process_boarding_request(boarding_data)

@router.post("/deboarding/request", response_model=Dict[str, Any])
async def request_deboarding(
    deboarding_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Process personnel deboarding request"""
    service = POBBoardingService()
    return await service.process_deboarding_request(deboarding_data)

# app/api/pob/transports.py
@router.post("/transports", response_model=Dict[str, Any])
async def create_transport(
    transport_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create transport schedule"""
    service = POBTransportService()
    return await service.create_transport_schedule(transport_data)

@router.get("/transports/{transport_id}/manifest", response_model=Dict[str, Any])
async def get_transport_manifest(
    transport_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get transport manifest with personnel details"""
    service = POBTransportService()
    return await service.get_transport_manifest(transport_id)

# app/api/pob/certifications.py
@router.post("/certifications", response_model=Dict[str, Any])
async def add_certification(
    cert_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Add personnel certification"""
    service = POBCertificationService()
    return await service.add_personnel_certification(cert_data)

@router.get("/certifications/expiring", response_model=Dict[str, Any])
async def get_expiring_certifications(
    days_ahead: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get certifications expiring within specified days"""
    service = POBCertificationService()
    return await service.get_expiring_certifications(days_ahead)

@router.get("/certifications/{personnel_id}/compliance", response_model=Dict[str, Any])
async def check_compliance(
    personnel_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Check personnel compliance status"""
    service = POBCertificationService()
    return await service.check_compliance_status(personnel_id)
```

---

## 11. User Profile & RBAC Module Integration

### 11.1. User Profile Management

#### 11.1.1. User Profile Service Architecture
```python
# app/services/rbac/user_profile_service.py
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.rbac import User, UserRole, UserSession, UserActivityLog
from app.core.security import get_password_hash, verify_password, generate_mfa_secret

class UserProfileService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def create_user_profile(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new user profile with validation"""
        db = next(get_db())
        
        # Check if username or email already exists
        existing_user = db.query(User).filter(
            (User.username == user_data["username"]) | 
            (User.email == user_data["email"])
        ).first()
        
        if existing_user:
            return {
                "status": "ERROR",
                "message": "Username or email already exists"
            }
        
        # Create new user
        user = User(
            username=user_data["username"],
            email=user_data["email"],
            full_name=user_data["full_name"],
            password_hash=get_password_hash(user_data["password"]),
            phone=user_data.get("phone"),
            department=user_data.get("department"),
            position=user_data.get("position"),
            personnel_id=user_data.get("personnel_id"),
            timezone=user_data.get("timezone", "UTC"),
            language=user_data.get("language", "en"),
            theme=user_data.get("theme", "light")
        )
        
        db.add(user)
        db.commit()
        
        # Assign default role
        await self.assign_default_role(user.id)
        
        # Log user creation
        await self.log_user_activity(user.id, "USER_CREATED", "users", "create", user.id)
        
        return {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "status": "ACTIVE",
            "created_at": user.created_at.isoformat()
        }
    
    async def update_user_profile(self, user_id: int, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user profile information"""
        db = next(get_db())
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "ERROR", "message": "User not found"}
        
        # Update allowed fields
        updatable_fields = ["full_name", "phone", "department", "position", "timezone", "language", "theme"]
        for field in updatable_fields:
            if field in profile_data:
                setattr(user, field, profile_data[field])
        
        user.updated_at = datetime.now()
        db.commit()
        
        # Log profile update
        await self.log_user_activity(user_id, "PROFILE_UPDATED", "users", "update", user_id)
        
        return {
            "user_id": user.id,
            "updated_fields": list(profile_data.keys()),
            "updated_at": user.updated_at.isoformat()
        }
    
    async def change_user_password(self, user_id: int, password_data: Dict[str, Any]) -> Dict[str, Any]:
        """Change user password with validation"""
        db = next(get_db())
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "ERROR", "message": "User not found"}
        
        # Verify current password
        if not verify_password(password_data["current_password"], user.password_hash):
            return {"status": "ERROR", "message": "Current password is incorrect"}
        
        # Update password
        user.password_hash = get_password_hash(password_data["new_password"])
        user.password_changed_at = datetime.now()
        db.commit()
        
        # Invalidate all sessions except current
        await self.invalidate_user_sessions(user_id, exclude_current=True)
        
        # Log password change
        await self.log_user_activity(user_id, "PASSWORD_CHANGED", "users", "change_password", user_id)
        
        return {
            "status": "SUCCESS",
            "message": "Password changed successfully",
            "changed_at": user.password_changed_at.isoformat()
        }
    
    async def enable_mfa(self, user_id: int) -> Dict[str, Any]:
        """Enable multi-factor authentication for user"""
        db = next(get_db())
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "ERROR", "message": "User not found"}
        
        # Generate MFA secret
        mfa_secret = generate_mfa_secret()
        user.mfa_secret = mfa_secret
        user.mfa_enabled = False  # User needs to verify first
        db.commit()
        
        # Generate QR code for MFA setup
        qr_code_url = self.generate_mfa_qr_code(user.email, mfa_secret)
        
        return {
            "mfa_secret": mfa_secret,
            "qr_code_url": qr_code_url,
            "backup_codes": self.generate_backup_codes(),
            "message": "MFA setup initiated. Please verify with authenticator app."
        }
    
    async def verify_mfa_setup(self, user_id: int, verification_code: str) -> Dict[str, Any]:
        """Verify MFA setup and enable it"""
        db = next(get_db())
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "ERROR", "message": "User not found"}
        
        # Verify MFA code
        if not self.verify_mfa_code(user.mfa_secret, verification_code):
            return {"status": "ERROR", "message": "Invalid verification code"}
        
        # Enable MFA
        user.mfa_enabled = True
        db.commit()
        
        # Log MFA enablement
        await self.log_user_activity(user_id, "MFA_ENABLED", "users", "enable_mfa", user_id)
        
        return {
            "status": "SUCCESS",
            "message": "MFA enabled successfully",
            "enabled_at": datetime.now().isoformat()
        }
    
    async def get_user_profile(self, user_id: int) -> Dict[str, Any]:
        """Get comprehensive user profile"""
        db = next(get_db())
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "ERROR", "message": "User not found"}
        
        # Get user roles
        user_roles = db.query(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.is_active == True
        ).all()
        
        # Get effective permissions
        effective_permissions = await self.get_user_effective_permissions(user_id)
        
        # Get recent activity
        recent_activity = db.query(UserActivityLog).filter(
            UserActivityLog.user_id == user_id
        ).order_by(UserActivityLog.created_at.desc()).limit(10).all()
        
        return {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "department": user.department,
            "position": user.position,
            "personnel_id": user.personnel_id,
            "avatar_url": user.avatar_url,
            "is_active": user.is_active,
            "is_locked": user.is_locked,
            "is_verified": user.is_verified,
            "mfa_enabled": user.mfa_enabled,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "password_changed_at": user.password_changed_at.isoformat() if user.password_changed_at else None,
            "timezone": user.timezone,
            "language": user.language,
            "theme": user.theme,
            "notifications_enabled": user.notifications_enabled,
            "roles": [
                {
                    "role_id": role.role_id,
                    "role_name": role.role.name if role.role else "Unknown",
                    "assigned_at": role.assigned_at.isoformat(),
                    "expires_at": role.expires_at.isoformat() if role.expires_at else None
                }
                for role in user_roles
            ],
            "effective_permissions": effective_permissions,
            "recent_activity": [
                {
                    "activity_type": activity.activity_type,
                    "module": activity.module,
                    "action": activity.action,
                    "ip_address": activity.ip_address,
                    "user_agent": activity.user_agent,
                    "created_at": activity.created_at.isoformat()
                }
                for activity in recent_activity
            ],
            "created_at": user.created_at.isoformat(),
            "updated_at": user.updated_at.isoformat() if user.updated_at else None
        }
```

#### 11.1.2. Role-Based Access Control Service
```python
# app/services/rbac/rbac_service.py
class RBACService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def create_role(self, role_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new role with permissions"""
        db = next(get_db())
        
        # Check if role name already exists
        existing_role = db.query(Role).filter(Role.name == role_data["name"]).first()
        if existing_role:
            return {"status": "ERROR", "message": "Role name already exists"}
        
        # Create new role
        role = Role(
            name=role_data["name"],
            display_name=role_data["display_name"],
            description=role_data.get("description", ""),
            is_system_role=role_data.get("is_system_role", False),
            parent_role_id=role_data.get("parent_role_id"),
            level=role_data.get("level", 0)
        )
        
        db.add(role)
        db.commit()
        
        # Assign permissions if provided
        if "permission_ids" in role_data:
            await self.assign_role_permissions(role.id, role_data["permission_ids"])
        
        return {
            "role_id": role.id,
            "name": role.name,
            "display_name": role.display_name,
            "status": "ACTIVE",
            "created_at": role.created_at.isoformat()
        }
    
    async def assign_role_to_user(self, user_id: int, role_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assign role to user with conditions"""
        db = next(get_db())
        
        # Check if role exists
        role = db.query(Role).filter(Role.id == role_data["role_id"]).first()
        if not role:
            return {"status": "ERROR", "message": "Role not found"}
        
        # Check if user already has this role
        existing_assignment = db.query(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role_data["role_id"],
            UserRole.is_active == True
        ).first()
        
        if existing_assignment:
            return {"status": "ERROR", "message": "User already has this role"}
        
        # Create role assignment
        user_role = UserRole(
            user_id=user_id,
            role_id=role_data["role_id"],
            assigned_by=role_data.get("assigned_by"),
            expires_at=role_data.get("expires_at"),
            location_restrictions=role_data.get("location_restrictions"),
            time_restrictions=role_data.get("time_restrictions"),
            device_restrictions=role_data.get("device_restrictions")
        )
        
        db.add(user_role)
        db.commit()
        
        # Log role assignment
        await self.log_user_activity(user_id, "ROLE_ASSIGNED", "roles", "assign", role_data["role_id"])
        
        return {
            "assignment_id": user_role.id,
            "user_id": user_id,
            "role_id": role_data["role_id"],
            "assigned_at": user_role.assigned_at.isoformat(),
            "expires_at": user_role.expires_at.isoformat() if user_role.expires_at else None
        }
    
    async def check_user_permission(self, user_id: int, permission: str, context: Dict[str, Any] = None) -> bool:
        """Check if user has specific permission"""
        db = next(get_db())
        
        # Get effective permissions for user
        effective_permissions = await self.get_user_effective_permissions(user_id)
        
        # Check for wildcard permission
        if "*" in effective_permissions:
            return True
        
        # Check for specific permission
        if permission in effective_permissions:
            # Check context-based restrictions
            return await self.check_permission_context(user_id, permission, context)
        
        return False
    
    async def get_user_effective_permissions(self, user_id: int) -> List[str]:
        """Get all effective permissions for user including inherited permissions"""
        db = next(get_db())
        
        # Get user's active roles
        user_roles = db.query(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.is_active == True
        ).all()
        
        effective_permissions = set()
        
        for user_role in user_roles:
            # Get role permissions
            role_permissions = db.query(RolePermission).filter(
                RolePermission.role_id == user_role.role_id,
                RolePermission.is_active == True
            ).all()
            
            for role_perm in role_permissions:
                permission = db.query(Permission).filter(
                    Permission.id == role_perm.permission_id
                ).first()
                
                if permission:
                    effective_permissions.add(f"{permission.module}.{permission.resource}.{permission.action}")
        
        return list(effective_permissions)
    
    async def check_permission_context(self, user_id: int, permission: str, context: Dict[str, Any]) -> bool:
        """Check permission context restrictions"""
        db = next(get_db())
        
        # Get user role assignments
        user_roles = db.query(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.is_active == True
        ).all()
        
        for user_role in user_roles:
            # Check location restrictions
            if user_role.location_restrictions and context.get("location"):
                if context["location"] not in user_role.location_restrictions:
                    continue
            
            # Check time restrictions
            if user_role.time_restrictions:
                current_time = datetime.now().time()
                allowed_start = datetime.strptime(user_role.time_restrictions.get("start", "00:00"), "%H:%M").time()
                allowed_end = datetime.strptime(user_role.time_restrictions.get("end", "23:59"), "%H:%M").time()
                
                if not (allowed_start <= current_time <= allowed_end):
                    continue
            
            # Check device restrictions
            if user_role.device_restrictions and context.get("device_info"):
                device_fingerprint = context["device_info"].get("fingerprint")
                if device_fingerprint not in user_role.device_restrictions:
                    continue
            
            # If we reach here, the permission is valid for this role
            return True
        
        return False
    
    async def assign_role_permissions(self, role_id: int, permission_ids: List[int]) -> Dict[str, Any]:
        """Assign permissions to role"""
        db = next(get_db())
        
        # Clear existing permissions
        db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
        
        # Add new permissions
        for permission_id in permission_ids:
            role_permission = RolePermission(
                role_id=role_id,
                permission_id=permission_id,
                granted_by=1  # Should be current user ID
            )
            db.add(role_permission)
        
        db.commit()
        
        return {
            "role_id": role_id,
            "permissions_assigned": len(permission_ids),
            "message": "Permissions assigned successfully"
        }
```

### 11.2. Session Management

#### 11.2.1. Session Management Service
```python
# app/services/rbac/session_service.py
class SessionManagementService:
    def __init__(self, zkteco_client: ZKTecoAuthService):
        self.zkteco_client = zkteco_client
    
    async def create_user_session(self, user_id: int, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new user session"""
        db = next(get_db())
        
        # Generate session token
        session_token = self.generate_session_token()
        
        # Create session record
        session = UserSession(
            user_id=user_id,
            session_token=session_token,
            ip_address=session_data.get("ip_address"),
            user_agent=session_data.get("user_agent"),
            device_info=session_data.get("device_info"),
            location=session_data.get("location"),
            expires_at=datetime.now() + timedelta(hours=24)
        )
        
        db.add(session)
        db.commit()
        
        # Update user last login
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.last_login = datetime.now()
            db.commit()
        
        # Log session creation
        await self.log_user_activity(user_id, "SESSION_CREATED", "sessions", "create", session.id)
        
        return {
            "session_token": session_token,
            "session_id": session.id,
            "expires_at": session.expires_at.isoformat(),
            "user_info": {
                "user_id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "roles": await self.get_user_roles(user_id)
            }
        }
    
    async def validate_session(self, session_token: str) -> Dict[str, Any]:
        """Validate user session"""
        db = next(get_db())
        
        session = db.query(UserSession).filter(
            UserSession.session_token == session_token,
            UserSession.is_active == True
        ).first()
        
        if not session:
            return {"valid": False, "reason": "Session not found"}
        
        if session.expires_at < datetime.now():
            return {"valid": False, "reason": "Session expired"}
        
        # Update last activity
        session.last_activity = datetime.now()
        db.commit()
        
        # Get user information
        user = db.query(User).filter(User.id == session.user_id).first()
        
        return {
            "valid": True,
            "user_id": session.user_id,
            "session_id": session.id,
            "last_activity": session.last_activity.isoformat(),
            "expires_at": session.expires_at.isoformat(),
            "user_info": {
                "user_id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "is_locked": user.is_locked
            }
        }
    
    async def invalidate_session(self, session_token: str) -> Dict[str, Any]:
        """Invalidate user session"""
        db = next(get_db())
        
        session = db.query(UserSession).filter(
            UserSession.session_token == session_token
        ).first()
        
        if not session:
            return {"status": "ERROR", "message": "Session not found"}
        
        session.is_active = False
        db.commit()
        
        # Log session invalidation
        await self.log_user_activity(session.user_id, "SESSION_INVALIDATED", "sessions", "invalidate", session.id)
        
        return {
            "status": "SUCCESS",
            "message": "Session invalidated successfully"
        }
    
    async def get_user_sessions(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all active sessions for user"""
        db = next(get_db())
        
        sessions = db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.is_active == True
        ).order_by(UserSession.created_at.desc()).all()
        
        return [
            {
                "session_id": session.id,
                "ip_address": session.ip_address,
                "user_agent": session.user_agent,
                "device_info": session.device_info,
                "location": session.location,
                "created_at": session.created_at.isoformat(),
                "last_activity": session.last_activity.isoformat(),
                "expires_at": session.expires_at.isoformat(),
                "is_current": session.last_activity >= datetime.now() - timedelta(minutes=5)
            }
            for session in sessions
        ]
    
    async def invalidate_all_user_sessions(self, user_id: int, exclude_current: bool = False) -> Dict[str, Any]:
        """Invalidate all user sessions"""
        db = next(get_db())
        
        query = db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.is_active == True
        )
        
        if exclude_current:
            # Get current session (most recent activity)
            current_session = query.order_by(UserSession.last_activity.desc()).first()
            if current_session:
                query = query.filter(UserSession.id != current_session.id)
        
        sessions = query.all()
        
        for session in sessions:
            session.is_active = False
        
        db.commit()
        
        # Log mass session invalidation
        await self.log_user_activity(user_id, "ALL_SESSIONS_INVALIDATED", "sessions", "invalidate_all", user_id)
        
        return {
            "status": "SUCCESS",
            "sessions_invalidated": len(sessions),
            "message": f"Invalidated {len(sessions)} sessions"
        }
```

### 11.3. Database Schema for RBAC Module

```python
# app/models/rbac.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    """User account management"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    personnel_id = Column(Integer, ForeignKey("personnel.id"))
    
    # Profile Information
    phone = Column(String(20))
    department = Column(String(100))
    position = Column(String(100))
    avatar_url = Column(String(500))
    
    # Account Status
    is_active = Column(Boolean, default=True)
    is_locked = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True))
    password_changed_at = Column(DateTime(timezone=True))
    
    # Security Settings
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(32))
    trusted_devices = Column(JSON)
    
    # Preferences
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")
    theme = Column(String(20), default="light")
    notifications_enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    roles = relationship("UserRole", back_populates="user")
    sessions = relationship("UserSession", back_populates="user")
    activity_logs = relationship("UserActivityLog", back_populates="user")

class Role(Base):
    """Role definitions with permissions"""
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    is_system_role = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Role Hierarchy
    parent_role_id = Column(Integer, ForeignKey("roles.id"))
    level = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    parent_role = relationship("Role", remote_side=[Role.id])
    child_roles = relationship("Role", back_populates="parent_role")
    users = relationship("UserRole", back_populates="role")
    permissions = relationship("RolePermission", back_populates="role")

class Permission(Base):
    """System permissions"""
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    module = Column(String(50), nullable=False)
    resource = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)
    
    # Permission Properties
    is_system_permission = Column(Boolean, default=False)
    is_sensitive = Column(Boolean, default=False)
    requires_approval = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    roles = relationship("RolePermission", back_populates="permission")

class UserRole(Base):
    """User role assignments"""
    __tablename__ = "user_roles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    
    # Assignment Details
    assigned_by = Column(Integer, ForeignKey("users.id"))
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    
    # Context-based Permissions
    location_restrictions = Column(JSON)
    time_restrictions = Column(JSON)
    device_restrictions = Column(JSON)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users")

class RolePermission(Base):
    """Role permission assignments"""
    __tablename__ = "role_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False)
    
    # Permission Details
    granted_by = Column(Integer, ForeignKey("users.id"))
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    # Permission Conditions
    conditions = Column(JSON)  # Additional conditions for permission
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")

class UserSession(Base):
    """User session management"""
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    
    # Session Details
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    device_info = Column(JSON)
    location = Column(JSON)
    
    # Session Status
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True))
    last_activity = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="sessions")

class UserActivityLog(Base):
    """User activity audit log"""
    __tablename__ = "user_activity_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(Integer, ForeignKey("user_sessions.id"))
    
    # Activity Details
    activity_type = Column(String(50), nullable=False)
    module = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    resource_id = Column(String(100))
    
    # Request Details
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    request_method = Column(String(10))
    request_endpoint = Column(String(200))
    
    # Response Details
    response_status = Column(Integer)
    response_time_ms = Column(Integer)
    
    # Additional Data
    metadata = Column(JSON)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="activity_logs")
    session = relationship("UserSession")
```

### 11.4. API Endpoints for RBAC Module

```python
# app/api/rbac/users.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.rbac.user_profile_service import UserProfileService
from app.core.dependencies import get_current_active_user

router = APIRouter(prefix="/api/v1/rbac/users", tags=["RBAC Users"])

@router.post("/", response_model=Dict[str, Any])
async def create_user(
    user_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create new user profile"""
    service = UserProfileService()
    return await service.create_user_profile(user_data)

@router.get("/{user_id}/profile", response_model=Dict[str, Any])
async def get_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get user profile"""
    service = UserProfileService()
    return await service.get_user_profile(user_id)

@router.put("/{user_id}/profile", response_model=Dict[str, Any])
async def update_user_profile(
    user_id: int,
    profile_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Update user profile"""
    service = UserProfileService()
    return await service.update_user_profile(user_id, profile_data)

@router.post("/{user_id}/change-password", response_model=Dict[str, Any])
async def change_password(
    user_id: int,
    password_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Change user password"""
    service = UserProfileService()
    return await service.change_user_password(user_id, password_data)

# app/api/rbac/roles.py
@router.post("/roles", response_model=Dict[str, Any])
async def create_role(
    role_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create new role"""
    service = RBACService()
    return await service.create_role(role_data)

@router.post("/users/{user_id}/roles", response_model=Dict[str, Any])
async def assign_role_to_user(
    user_id: int,
    role_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Assign role to user"""
    service = RBACService()
    return await service.assign_role_to_user(user_id, role_data)

@router.get("/users/{user_id}/permissions", response_model=Dict[str, Any])
async def get_user_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get user effective permissions"""
    service = RBACService()
    return {
        "user_id": user_id,
        "permissions": await service.get_user_effective_permissions(user_id)
    }

# app/api/rbac/sessions.py
@router.post("/sessions", response_model=Dict[str, Any])
async def create_session(
    session_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Create user session"""
    service = SessionManagementService()
    return await service.create_user_session(session_data["user_id"], session_data)

@router.get("/users/{user_id}/sessions", response_model=List[Dict[str, Any]])
async def get_user_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get user sessions"""
    service = SessionManagementService()
    return await service.get_user_sessions(user_id)

@router.post("/sessions/{session_token}/invalidate", response_model=Dict[str, Any])
async def invalidate_session(
    session_token: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Invalidate session"""
    service = SessionManagementService()
    return await service.invalidate_session(session_token)
```

---

## 12. Time and Attendance Module

### 12.1. Time Tracking System

#### 12.1.1. Time Tracking Service Architecture
```python
# app/services/time_attendance/time_tracking_service.py
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.time_attendance import TimeSession, OvertimeRequest, Shift
from app.models.personnel import Personnel

class TimeTrackingService:
    def __init__(self):
        self.db = next(get_db())
    
    async def clock_in(self, clock_in_data: Dict[str, Any]) -> Dict[str, Any]:
        """Record employee clock-in with ZKTeco reader integration"""
        try:
            # Check if already clocked in
            active_session = self.db.query(TimeSession).filter(
                TimeSession.personnel_id == clock_in_data["personnel_id"],
                TimeSession.clock_out_time.is_(None)
            ).first()
            
            if active_session:
                return {
                    "status": "ERROR",
                    "message": "Personnel already clocked in",
                    "active_session": active_session.id
                }
            
            # Create new time session
            time_session = TimeSession(
                personnel_id=clock_in_data["personnel_id"],
                clock_in_time=datetime.now(),
                clock_in_method=clock_in_data.get("method", "READER"),  # READER, MANUAL, MOBILE
                clock_in_location=clock_in_data.get("location"),
                clock_in_device=clock_in_data.get("device_sn"),
                schedule_id=clock_in_data.get("schedule_id"),
                shift_id=clock_in_data.get("shift_id"),
                status="ACTIVE"
            )
            
            self.db.add(time_session)
            self.db.commit()
            
            # Update personnel status
            await self.update_personnel_status(clock_in_data["personnel_id"], "CLOCKED_IN")
            
            # Send notification
            await self.send_clock_in_notification(time_session)
            
            return {
                "status": "SUCCESS",
                "session_id": time_session.id,
                "clock_in_time": time_session.clock_in_time.isoformat(),
                "message": "Clock-in recorded successfully"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def clock_out(self, clock_out_data: Dict[str, Any]) -> Dict[str, Any]:
        """Record employee clock-out with overtime calculation"""
        try:
            # Find active time session
            active_session = self.db.query(TimeSession).filter(
                TimeSession.personnel_id == clock_out_data["personnel_id"],
                TimeSession.clock_out_time.is_(None)
            ).first()
            
            if not active_session:
                return {
                    "status": "ERROR",
                    "message": "No active clock-in session found"
                }
            
            # Update time session
            active_session.clock_out_time = datetime.now()
            active_session.clock_out_method = clock_out_data.get("method", "READER")
            active_session.clock_out_location = clock_out_data.get("location")
            active_session.clock_out_device = clock_out_data.get("device_sn")
            active_session.status = "COMPLETED"
            
            # Calculate work duration
            work_duration = active_session.clock_out_time - active_session.clock_in_time
            
            # Calculate overtime
            overtime_hours = await self.calculate_overtime(active_session)
            active_session.regular_hours = work_duration.total_seconds() / 3600 - overtime_hours
            active_session.overtime_hours = overtime_hours
            
            self.db.commit()
            
            # Update personnel status
            await self.update_personnel_status(clock_out_data["personnel_id"], "CLOCKED_OUT")
            
            return {
                "status": "SUCCESS",
                "session_id": active_session.id,
                "clock_out_time": active_session.clock_out_time.isoformat(),
                "work_duration": str(work_duration),
                "regular_hours": active_session.regular_hours,
                "overtime_hours": active_session.overtime_hours,
                "message": "Clock-out recorded successfully"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def calculate_overtime(self, time_session: TimeSession) -> float:
        """Calculate overtime hours based on work schedule and rules"""
        try:
            # Get personnel overtime rules
            personnel = self.db.query(Personnel).filter(
                Personnel.id == time_session.personnel_id
            ).first()
            
            if not personnel:
                return 0.0
            
            # Get work schedule for this date
            work_schedule = await self.get_work_schedule(
                time_session.personnel_id, 
                time_session.clock_in_time.date()
            )
            
            if not work_schedule:
                return 0.0
            
            # Calculate expected work hours
            expected_hours = work_schedule.get("regular_hours", 8.0)
            
            # Calculate actual work hours
            actual_duration = time_session.clock_out_time - time_session.clock_in_time
            actual_hours = actual_duration.total_seconds() / 3600
            
            # Calculate overtime (actual - expected, minimum 0)
            overtime = max(0, actual_hours - expected_hours)
            
            # Apply overtime rules
            overtime_rules = personnel.overtime_rules or {}
            daily_limit = overtime_rules.get("daily_limit", 8.0)
            weekly_limit = overtime_rules.get("weekly_limit", 40.0)
            
            # Check daily limit
            if overtime > daily_limit:
                overtime = daily_limit
            
            # Check weekly limit
            weekly_overtime = await self.get_weekly_overtime(time_session.personnel_id)
            if weekly_overtime + overtime > weekly_limit:
                overtime = max(0, weekly_limit - weekly_overtime)
            
            return overtime
            
        except Exception as e:
            print(f"Error calculating overtime: {e}")
            return 0.0
    
    async def get_active_sessions(self) -> List[Dict[str, Any]]:
        """Get all active clock-in sessions"""
        try:
            active_sessions = self.db.query(TimeSession).filter(
                TimeSession.clock_out_time.is_(None),
                TimeSession.status == "ACTIVE"
            ).all()
            
            return [
                {
                    "session_id": session.id,
                    "personnel_id": session.personnel_id,
                    "personnel_name": session.personnel.full_name if session.personnel else "Unknown",
                    "clock_in_time": session.clock_in_time.isoformat(),
                    "clock_in_method": session.clock_in_method,
                    "clock_in_location": session.clock_in_location,
                    "duration": str(datetime.now() - session.clock_in_time)
                }
                for session in active_sessions
            ]
            
        except Exception as e:
            print(f"Error getting active sessions: {e}")
            return []
```

#### 12.1.2. Attendance Management Service
```python
# app/services/time_attendance/attendance_service.py
class AttendanceService:
    def __init__(self):
        self.db = next(get_db())
    
    async def get_attendance_summary(self, start_date: date, end_date: date, personnel_id: int = None) -> Dict[str, Any]:
        """Get comprehensive attendance summary for date range"""
        try:
            # Query time sessions
            query = self.db.query(TimeSession).filter(
                TimeSession.clock_in_time >= start_date,
                TimeSession.clock_in_time <= end_date
            )
            
            if personnel_id:
                query = query.filter(TimeSession.personnel_id == personnel_id)
            
            sessions = query.all()
            
            # Calculate attendance metrics
            total_days = (end_date - start_date).days + 1
            present_days = len(set(session.clock_in_time.date() for session in sessions if session.clock_out_time))
            absent_days = total_days - present_days
            late_days = len([s for s in sessions if self.is_late(s)])
            early_departure_days = len([s for s in sessions if self.is_early_departure(s)])
            
            # Calculate total hours
            total_regular_hours = sum(s.regular_hours or 0 for s in sessions)
            total_overtime_hours = sum(s.overtime_hours or 0 for s in sessions)
            total_work_hours = total_regular_hours + total_overtime_hours
            
            # Calculate attendance rate
            attendance_rate = (present_days / total_days) * 100 if total_days > 0 else 0
            
            return {
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
                "total_days": total_days,
                "present_days": present_days,
                "absent_days": absent_days,
                "late_days": late_days,
                "early_departure_days": early_departure_days,
                "attendance_rate": round(attendance_rate, 2),
                "total_regular_hours": round(total_regular_hours, 2),
                "total_overtime_hours": round(total_overtime_hours, 2),
                "total_work_hours": round(total_work_hours, 2),
                "average_daily_hours": round(total_work_hours / present_days, 2) if present_days > 0 else 0
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def get_attendance_calendar(self, year: int, month: int, personnel_id: int = None) -> List[Dict[str, Any]]:
        """Get attendance data for calendar view"""
        try:
            # Get first and last day of month
            start_date = date(year, month, 1)
            if month == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
            
            # Query time sessions for month
            query = self.db.query(TimeSession).filter(
                TimeSession.clock_in_time >= start_date,
                TimeSession.clock_in_time < end_date
            )
            
            if personnel_id:
                query = query.filter(TimeSession.personnel_id == personnel_id)
            
            sessions = query.all()
            
            # Generate calendar data
            calendar_data = []
            current_date = start_date
            
            while current_date < end_date:
                day_sessions = [s for s in sessions if s.clock_in_time.date() == current_date]
                
                if day_sessions:
                    # Calculate day totals
                    total_hours = sum((s.overtime_hours or 0) + (s.regular_hours or 0) for s in day_sessions)
                    
                    # Determine attendance status
                    status = "PRESENT"
                    if any(self.is_late(s) for s in day_sessions):
                        status = "LATE"
                    elif any(self.is_early_departure(s) for s in day_sessions):
                        status = "EARLY_DEPARTURE"
                    
                    calendar_data.append({
                        "date": current_date.isoformat(),
                        "day": current_date.day,
                        "weekday": current_date.strftime("%A"),
                        "status": status,
                        "total_hours": round(total_hours, 2),
                        "regular_hours": round(sum(s.regular_hours or 0 for s in day_sessions), 2),
                        "overtime_hours": round(sum(s.overtime_hours or 0 for s in day_sessions), 2),
                        "sessions": len(day_sessions),
                        "has_data": True
                    })
                else:
                    # Check if this is a work day
                    is_work_day = await self.is_work_day(current_date, personnel_id)
                    
                    calendar_data.append({
                        "date": current_date.isoformat(),
                        "day": current_date.day,
                        "weekday": current_date.strftime("%A"),
                        "status": "ABSENT" if is_work_day else "WEEKEND",
                        "total_hours": 0,
                        "regular_hours": 0,
                        "overtime_hours": 0,
                        "sessions": 0,
                        "has_data": False
                    })
                
                current_date += timedelta(days=1)
            
            return calendar_data
            
        except Exception as e:
            return []
    
    def is_late(self, time_session: TimeSession) -> bool:
        """Check if employee was late"""
        if not time_session.schedule_id:
            return False
        
        # Get scheduled start time
        work_schedule = self.db.query(Shift).filter(
            Shift.id == time_session.shift_id
        ).first()
        
        if not work_schedule:
            return False
        
        # Compare with actual clock-in time
        scheduled_time = datetime.combine(
            time_session.clock_in_time.date(),
            work_schedule.start_time
        )
        
        # Consider late if more than 5 minutes after scheduled time
        return time_session.clock_in_time > scheduled_time + timedelta(minutes=5)
    
    def is_early_departure(self, time_session: TimeSession) -> bool:
        """Check if employee left early"""
        if not time_session.schedule_id:
            return False
        
        # Get scheduled end time
        work_schedule = self.db.query(Shift).filter(
            Shift.id == time_session.shift_id
        ).first()
        
        if not work_schedule:
            return False
        
        # Compare with actual clock-out time
        scheduled_time = datetime.combine(
            time_session.clock_out_time.date(),
            work_schedule.end_time
        )
        
        # Consider early if more than 5 minutes before scheduled time
        return time_session.clock_out_time < scheduled_time - timedelta(minutes=5)
```

### 12.2. Overtime Management

#### 12.2.1. Overtime Management Service
```python
# app/services/time_attendance/overtime_service.py
class OvertimeService:
    def __init__(self):
        self.db = next(get_db())
    
    async def create_overtime_request(self, overtime_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create overtime request with approval workflow"""
        try:
            overtime_request = OvertimeRequest(
                personnel_id=overtime_data["personnel_id"],
                request_date=overtime_data["request_date"],
                start_time=overtime_data["start_time"],
                end_time=overtime_data["end_time"],
                requested_hours=overtime_data["requested_hours"],
                overtime_type=overtime_data["overtime_type"],  # REGULAR, WEEKEND, HOLIDAY
                reason=overtime_data["reason"],
                status="PENDING",
                requested_by=overtime_data["requested_by"],
                requested_at=datetime.now()
            )
            
            self.db.add(overtime_request)
            self.db.commit()
            
            # Send notifications to approvers
            await self.send_overtime_notifications(overtime_request)
            
            return {
                "status": "SUCCESS",
                "overtime_request_id": overtime_request.id,
                "message": "Overtime request submitted for approval"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def approve_overtime(self, overtime_request_id: int, approval_data: Dict[str, Any]) -> Dict[str, Any]:
        """Approve or reject overtime request"""
        try:
            overtime_request = self.db.query(OvertimeRequest).filter(
                OvertimeRequest.id == overtime_request_id
            ).first()
            
            if not overtime_request:
                return {"status": "ERROR", "message": "Overtime request not found"}
            
            # Update overtime request
            overtime_request.status = approval_data["status"]  # APPROVED, REJECTED
            overtime_request.approved_by = approval_data["approved_by"]
            overtime_request.approved_at = datetime.now()
            overtime_request.approver_notes = approval_data.get("notes", "")
            
            self.db.commit()
            
            # Send notification
            await self.send_approval_notifications(overtime_request)
            
            return {
                "status": "SUCCESS",
                "overtime_request_id": overtime_request.id,
                "approval_status": overtime_request.status,
                "approved_by": approval_data["approved_by"],
                "approved_at": overtime_request.approved_at.isoformat()
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def get_overtime_summary(self, start_date: date, end_date: date, personnel_id: int = None) -> Dict[str, Any]:
        """Get overtime summary for date range"""
        try:
            # Query overtime sessions
            query = self.db.query(TimeSession).filter(
                TimeSession.clock_in_time >= start_date,
                TimeSession.clock_in_time <= end_date,
                TimeSession.overtime_hours > 0
            )
            
            if personnel_id:
                query = query.filter(TimeSession.personnel_id == personnel_id)
            
            overtime_sessions = query.all()
            
            # Calculate overtime metrics
            total_overtime_hours = sum(s.overtime_hours for s in overtime_sessions)
            overtime_days = len(set(s.clock_in_time.date() for s in overtime_sessions))
            
            # Group by overtime type
            regular_overtime = sum(s.overtime_hours for s in overtime_sessions if s.overtime_type == "REGULAR")
            weekend_overtime = sum(s.overtime_hours for s in overtime_sessions if s.overtime_type == "WEEKEND")
            holiday_overtime = sum(s.overtime_hours for s in overtime_sessions if s.overtime_type == "HOLIDAY")
            
            return {
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
                "total_overtime_hours": round(total_overtime_hours, 2),
                "overtime_days": overtime_days,
                "average_overtime_per_day": round(total_overtime_hours / overtime_days, 2) if overtime_days > 0 else 0,
                "regular_overtime_hours": round(regular_overtime, 2),
                "weekend_overtime_hours": round(weekend_overtime, 2),
                "holiday_overtime_hours": round(holiday_overtime, 2),
                "overtime_sessions": len(overtime_sessions)
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
```

### 12.3. Payroll Integration

#### 12.3.1. Payroll Integration Service
```python
# app/services/time_attendance/payroll_integration_service.py
class PayrollIntegrationService:
    def __init__(self):
        self.db = next(get_db())
    
    async def generate_payroll_data(self, start_date: date, end_date: date, personnel_id: int = None) -> Dict[str, Any]:
        """Generate comprehensive payroll data for specified period"""
        try:
            # Get time sessions for period
            query = self.db.query(TimeSession).filter(
                TimeSession.clock_in_time >= start_date,
                TimeSession.clock_in_time <= end_date,
                TimeSession.status == "COMPLETED"
            )
            
            if personnel_id:
                query = query.filter(TimeSession.personnel_id == personnel_id)
            
            sessions = query.all()
            
            # Group by personnel
            payroll_data = {}
            for session in sessions:
                if session.personnel_id not in payroll_data:
                    payroll_data[session.personnel_id] = {
                        "personnel_id": session.personnel_id,
                        "personnel_name": session.personnel.full_name if session.personnel else "Unknown",
                        "regular_hours": 0,
                        "overtime_hours": 0,
                        "total_hours": 0,
                        "work_days": 0,
                        "absent_days": 0,
                        "late_days": 0
                    }
                
                # Add session data
                payroll_data[session.personnel_id]["regular_hours"] += session.regular_hours or 0
                payroll_data[session.personnel_id]["overtime_hours"] += session.overtime_hours or 0
                payroll_data[session.personnel_id]["total_hours"] += (session.regular_hours or 0) + (session.overtime_hours or 0)
                payroll_data[session.personnel_id]["work_days"] += 1
                
                # Check for late arrival
                if self.is_late(session):
                    payroll_data[session.personnel_id]["late_days"] += 1
            
            # Calculate absent days
            work_days = (end_date - start_date).days + 1
            for personnel_id, data in payroll_data.items():
                data["absent_days"] = work_days - data["work_days"]
            
            return {
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
                "total_personnel": len(payroll_data),
                "payroll_data": list(payroll_data.values())
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def export_payroll_csv(self, start_date: date, end_date: date) -> Dict[str, Any]:
        """Export payroll data as CSV for external payroll systems"""
        try:
            # Generate payroll data
            payroll_data = await self.generate_payroll_data(start_date, end_date)
            
            # Create CSV content
            csv_content = []
            csv_content.append("Personnel ID,Name,Regular Hours,Overtime Hours,Total Hours,Work Days,Absent Days,Late Days")
            
            for data in payroll_data["payroll_data"]:
                csv_content.append(f"{data['personnel_id']},{data['personnel_name']},{data['regular_hours']},{data['overtime_hours']},{data['total_hours']},{data['work_days']},{data['absent_days']},{data['late_days']}")
            
            # Generate filename
            filename = f"payroll_{start_date.strftime('%Y%m%d')}_to_{end_date.strftime('%Y%m%d')}.csv"
            
            return {
                "status": "SUCCESS",
                "filename": filename,
                "csv_content": "\n".join(csv_content),
                "total_records": len(payroll_data["payroll_data"])
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
```

### 12.4. Database Schema for Time and Attendance

```python
# app/models/time_attendance/time_session.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class TimeSession(Base):
    """Employee time tracking sessions"""
    __tablename__ = "time_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("schedule_assignments.id"))
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    
    # Clock-in data
    clock_in_time = Column(DateTime(timezone=True), nullable=False)
    clock_in_method = Column(String(20))  # READER, MANUAL, MOBILE, WEB
    clock_in_location = Column(String(100))
    clock_in_device = Column(String(50))
    clock_in_coordinates = Column(JSON)
    
    # Clock-out data
    clock_out_time = Column(DateTime(timezone=True))
    clock_out_method = Column(String(20))
    clock_out_location = Column(String(100))
    clock_out_device = Column(String(50))
    clock_out_coordinates = Column(JSON)
    
    # Time calculations
    regular_hours = Column(Float)
    overtime_hours = Column(Float)
    overtime_type = Column(String(20))  # REGULAR, WEEKEND, HOLIDAY
    break_duration = Column(Integer)  # minutes
    
    # Status and metadata
    status = Column(String(20), default="ACTIVE")  # ACTIVE, COMPLETED, CORRECTED
    notes = Column(Text)
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    personnel = relationship("Personnel")
    schedule = relationship("ScheduleAssignment")
    shift = relationship("Shift")

class OvertimeRequest(Base):
    """Overtime requests and approvals"""
    __tablename__ = "overtime_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    request_date = Column(Date, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    requested_hours = Column(Float, nullable=False)
    overtime_type = Column(String(20))  # REGULAR, WEEKEND, HOLIDAY
    reason = Column(Text)
    status = Column(String(20), default="PENDING")  # PENDING, APPROVED, REJECTED, CANCELLED
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    approver_notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    personnel = relationship("Personnel")

class Shift(Base):
    """Work shift definitions"""
    __tablename__ = "shifts"
    
    id = Column(Integer, primary_key=True, index=True)
    shift_name = Column(String(50), nullable=False)
    start_time = Column(String(8), nullable=False)  # HH:MM:SS
    end_time = Column(String(8), nullable=False)
    break_duration = Column(Integer, default=0)  # minutes
    regular_hours = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### 12.5. API Endpoints for Time and Attendance Module

```python
# app/api/time_attendance/time_tracking.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.time_attendance.time_tracking_service import TimeTrackingService
from app.core.dependencies import get_current_active_user

router = APIRouter(prefix="/api/v1/time-attendance", tags=["Time and Attendance"])

@router.post("/clock-in", response_model=Dict[str, Any])
async def clock_in(
    clock_in_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Record employee clock-in"""
    service = TimeTrackingService()
    return await service.clock_in(clock_in_data)

@router.post("/clock-out", response_model=Dict[str, Any])
async def clock_out(
    clock_out_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Record employee clock-out"""
    service = TimeTrackingService()
    return await service.clock_out(clock_out_data)

@router.get("/active-sessions", response_model=List[Dict[str, Any]])
async def get_active_sessions(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get all active clock-in sessions"""
    service = TimeTrackingService()
    return await service.get_active_sessions()

# app/api/time_attendance/attendance.py
@router.get("/attendance/summary", response_model=Dict[str, Any])
async def get_attendance_summary(
    start_date: date,
    end_date: date,
    personnel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get attendance summary for date range"""
    service = AttendanceService()
    return await service.get_attendance_summary(start_date, end_date, personnel_id)

@router.get("/attendance/calendar", response_model=List[Dict[str, Any]])
async def get_attendance_calendar(
    year: int,
    month: int,
    personnel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get attendance data for calendar view"""
    service = AttendanceService()
    return await service.get_attendance_calendar(year, month, personnel_id)

# app/api/time_attendance/overtime.py
@router.post("/overtime/requests", response_model=Dict[str, Any])
async def create_overtime_request(
    overtime_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create overtime request"""
    service = OvertimeService()
    return await service.create_overtime_request(overtime_data)

@router.put("/overtime/requests/{request_id}/approve", response_model=Dict[str, Any])
async def approve_overtime_request(
    request_id: int,
    approval_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Approve or reject overtime request"""
    service = OvertimeService()
    return await service.approve_overtime(request_id, approval_data)

# app/api/time_attendance/payroll.py
@router.get("/payroll/data", response_model=Dict[str, Any])
async def generate_payroll_data(
    start_date: date,
    end_date: date,
    personnel_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Generate payroll data for specified period"""
    service = PayrollIntegrationService()
    return await service.generate_payroll_data(start_date, end_date, personnel_id)

@router.get("/payroll/export", response_model=Dict[str, Any])
async def export_payroll_csv(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Export payroll data as CSV"""
    service = PayrollIntegrationService()
    return await service.export_payroll_csv(start_date, end_date)
```

### 12.6. Integration with ZKTeco Readers

#### 12.6.1. ZKTeco Reader Time Tracking Integration
```python
# app/services/time_attendance/zkteco_integration.py
class ZKTecoTimeTrackingIntegration:
    def __init__(self, zkteco_service):
        self.zkteco_service = zkteco_service
    
    async def process_reader_event_for_time_tracking(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process ZKTeco reader event for time tracking"""
        try:
            # Check if this is a personnel access event
            if event_data.get("event_type") == "ACCESS_EVENT":
                personnel_pin = event_data.get("personnel_pin")
                timestamp = event_data.get("timestamp")
                reader_ip = event_data.get("reader_ip")
                
                # Check if personnel is already clocked in
                active_session = await self.get_active_session(personnel_pin)
                
                if active_session:
                    # This is a clock-out event
                    clock_out_data = {
                        "personnel_id": active_session.personnel_id,
                        "method": "READER",
                        "location": event_data.get("zone_name"),
                        "device_sn": reader_ip
                    }
                    return await self.process_clock_out(clock_out_data)
                else:
                    # This is a clock-in event
                    clock_in_data = {
                        "personnel_id": personnel_pin,
                        "method": "READER",
                        "location": event_data.get("zone_name"),
                        "device_sn": reader_ip,
                        "timestamp": timestamp
                    }
                    return await self.process_clock_in(clock_in_data)
            
            return {"status": "IGNORED", "message": "Not a time tracking event"}
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def get_active_session(self, personnel_pin: str) -> Optional[TimeSession]:
        """Get active time session for personnel"""
        db = next(get_db())
        return db.query(TimeSession).filter(
            TimeSession.personnel.pin == personnel_pin,
            TimeSession.clock_out_time.is_(None),
            TimeSession.status == "ACTIVE"
        ).first()
```

---

## 13. Staffing, Shifts, Schedules, Breaks, and Leave Management

### 13.1. Staffing Configuration

#### 13.1.1. Staffing Configuration Service
```python
# app/services/staffing/staffing_config_service.py
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.staffing import StaffingConfiguration, StaffingLevel

class StaffingConfigurationService:
    def __init__(self):
        self.db = next(get_db())
    
    async def create_staffing_config(self, config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create staffing configuration"""
        try:
            # Check if configuration already exists
            existing_config = self.db.query(StaffingConfiguration).filter(
                StaffingConfiguration.company_id == config_data["company_id"],
                StaffingConfiguration.is_active == True
            ).first()
            
            if existing_config:
                return {
                    "status": "ERROR",
                    "message": "Staffing configuration already exists for this company"
                }
            
            # Create new configuration
            config = StaffingConfiguration(
                company_id=config_data["company_id"],
                staff_categories=config_data["staff_categories"],
                staffing_levels=config_data["staffing_levels"],
                department_structure=config_data.get("department_structure", {}),
                role_hierarchy=config_data.get("role_hierarchy", {}),
                min_offshore_experience_years=config_data.get("min_offshore_experience_years", 3),
                max_offshore_age_years=config_data.get("max_offshore_age_years", 65),
                max_consecutive_days_offshore=config_data.get("max_consecutive_days_offshore", 28),
                min_onshore_experience_years=config_data.get("min_onshore_experience_years", 2),
                max_onshore_age_years=config_data.get("max_onshore_age_years", 70),
                max_consecutive_days_onshore=config_data.get("max_consecutive_days_onshore", 35),
                is_active=True,
                created_by=config_data.get("created_by")
            )
            
            self.db.add(config)
            self.db.commit()
            
            return {
                "status": "SUCCESS",
                "config_id": config.id,
                "message": "Staffing configuration created successfully"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def get_staffing_config(self, company_id: int) -> Dict[str, Any]:
        """Get staffing configuration for company"""
        try:
            config = self.db.query(StaffingConfiguration).filter(
                StaffingConfiguration.company_id == company_id,
                StaffingConfiguration.is_active == True
            ).first()
            
            if not config:
                return {"status": "ERROR", "message": "Staffing configuration not found"}
            
            return {
                "config_id": config.id,
                "staff_categories": config.staff_categories,
                "staffing_levels": config.staffing_levels,
                "department_structure": config.department_structure,
                "role_hierarchy": config.role_hierarchy,
                "min_offshore_experience_years": config.min_offshore_experience_years,
                "max_offshore_age_years": config.max_offshore_age_years,
                "max_consecutive_days_offshore": config.max_consecutive_days_offshore,
                "min_onshore_experience_years": config.min_onshore_experience_years,
                "max_onshore_age_years": config.max_onshore_age_years,
                "max_consecutive_days_onshore": config.max_consecutive_days_onshore,
                "is_active": config.is_active,
                "created_at": config.created_at.isoformat(),
                "updated_at": config.updated_at.isoformat()
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def update_staffing_config(self, config_id: int, config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update staffing configuration"""
        try:
            config = self.db.query(StaffingConfiguration).filter(
                StaffingConfiguration.id == config_id
            ).first()
            
            if not config:
                return {"status": "ERROR", "message": "Staffing configuration not found"}
            
            # Update configuration
            if "staff_categories" in config_data:
                config.staff_categories = config_data["staff_categories"]
            if "staffing_levels" in config_data:
                config.staffing_levels = config_data["staffing_levels"]
            if "department_structure" in config_data:
                config.department_structure = config_data["department_structure"]
            if "role_hierarchy" in config_data:
                config.role_hierarchy = config_data["role_hierarchy"]
            
            config.updated_at = datetime.now()
            self.db.commit()
            
            return {
                "status": "SUCCESS",
                "config_id": config.id,
                "message": "Staffing configuration updated successfully"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def get_staffing_levels(self) -> List[Dict[str, Any]]:
        """Get all staffing levels"""
        try:
            levels = self.db.query(StaffingLevel).filter(
                StaffingLevel.is_active == True
            ).all()
            
            return [
                {
                    "id": level.id,
                    "code": level.code,
                    "name": level.name,
                    "description": level.description,
                    "base_salary_grade": level.base_salary_grade,
                    "max_supervisees": level.max_supervisees,
                    "can_approve_leave": level.can_approve_leave,
                    "can_approve_overtime": level.can_approve_overtime,
                    "min_experience_years": level.min_experience_years,
                    "created_at": level.created_at.isoformat()
                }
                for level in levels
            ]
            
        except Exception as e:
            return []
```

#### 13.1.2. Staffing Level Management
```python
# app/models/staffing/staffing_levels.py
from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class StaffingLevel(Base):
    """Staffing level definitions"""
    __tablename__ = "staffing_levels"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # Level Properties
    code = Column(String(20), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # Salary and Compensation
    base_salary_grade = Column(Integer, nullable=False)
    max_supervisees = Column(Integer, nullable=False)
    
    # Permissions and Authority
    can_approve_leave = Column(Boolean, default=False)
    can_approve_overtime = Column(Boolean, default=False)
    can_approve_expenses = Column(Boolean, default=False)
    can_hire_personnel = Column(Boolean, default=False)
    can_terminate_personnel = Column(Boolean, default=False)
    
    # Experience Requirements
    min_experience_years = Column(Integer, nullable=False)
    required_certifications = Column(JSON)
    required_training = Column(JSON)
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    company = relationship("Company")
    personnel_levels = relationship("PersonnelStaffingLevel", back_populates="staffing_level")
```

### 13.2. Shift Management

#### 13.2.1. Shift Management Service
```python
# app/services/staffing/shift_management_service.py
class ShiftManagementService:
    def __init__(self):
        self.db = next(get_db())
    
    async def create_shift_type(self, shift_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new shift type"""
        try:
            # Check if shift type already exists
            existing_shift = self.db.query(ShiftType).filter(
                ShiftType.company_id == shift_data["company_id"],
                ShiftType.shift_code == shift_data["shift_code"]
            ).first()
            
            if existing_shift:
                return {
                    "status": "ERROR",
                    "message": "Shift type already exists"
                }
            
            # Create new shift type
            shift_type = ShiftType(
                company_id=shift_data["company_id"],
                shift_code=shift_data["shift_code"],
                shift_name=shift_data["shift_name"],
                shift_description=shift_data.get("description", ""),
                shift_type=shift_data["shift_type"],
                start_time=shift_data["start_time"],
                end_time=shift_data["end_time"],
                duration_hours=shift_data.get("duration_hours", 8.0),
                break_duration_minutes=shift_data.get("break_duration_minutes", 60),
                min_personnel=shift_data.get("min_personnel", 1),
                max_personnel=shift_data.get("max_personnel"),
                required_skills=shift_data.get("required_skills", []),
                required_certifications=shift_data.get("required_certifications", []),
                overtime_multiplier=shift_data.get("overtime_multiplier", 1.0),
                night_shift_allowance=shift_data.get("night_shift_allowance", 0.0),
                weekend_multiplier=shift_data.get("weekend_multiplier", 1.0),
                is_active=True
            )
            
            self.db.add(shift_type)
            self.db.commit()
            
            return {
                "status": "SUCCESS",
                "shift_type_id": shift_type.id,
                "message": "Shift type created successfully"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def create_shift_assignment(self, assignment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create personnel shift assignment"""
        try:
            # Validate assignment data
            validation_result = await self.validate_shift_assignment(assignment_data)
            if not validation_result["valid"]:
                return validation_result
            
            # Create shift assignment
            assignment = ShiftAssignment(
                personnel_id=assignment_data["personnel_id"],
                shift_type_id=assignment_data["shift_type_id"],
                schedule_id=assignment_data.get("schedule_id"),
                role=assignment_data.get("role"),
                start_date=assignment_data["start_date"],
                end_date=assignment_data["end_date"],
                is_primary_shift=assignment_data.get("is_primary_shift", False),
                assigned_days=assignment_data.get("assigned_days", ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
                rotation_pattern=assignment_data.get("rotation_pattern"),
                work_location=assignment_data.get("work_location"),
                backup_personnel_id=assignment_data.get("backup_personnel_id")
            )
            
            self.db.add(assignment)
            self.db.commit()
            
            # Update personnel availability
            await self.update_personnel_availability(assignment_data["personnel_id"], assignment_data["start_date"], assignment_data["end_date"])
            
            return {
                "status": "SUCCESS",
                "assignment_id": assignment.id,
                "message": "Shift assignment created successfully"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def validate_shift_assignment(self, assignment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate shift assignment data"""
        try:
            # Check personnel availability
            personnel = self.db.query(Personnel).filter(
                Personnel.id == assignment_data["personnel_id"]
            ).first()
            
            if not personnel:
                return {
                    "valid": False,
                    "message": "Personnel not found",
                    "errors": ["Personnel ID is required"]
                }
            
            # Check shift conflicts
            conflicts = await self.check_shift_conflicts(assignment_data)
            if conflicts:
                return {
                    "valid": False,
                    "message": "Shift conflicts detected",
                    "errors": conflicts
                }
            
            # Check certification requirements
            if assignment_data["shift_type_id"]:
                shift_type = self.db.query(ShiftType).filter(
                    ShiftType.id == assignment_data["shift_type_id"]
                ).first()
                
                if shift_type and shift_type.required_certifications:
                    personnel_certs = personnel.certifications or []
                    required_certs = shift_type.required_certifications
                    
                    missing_certs = [cert for cert in required_certs if cert not in personnel_certs]
                    if missing_certs:
                        return {
                            "valid": False,
                            "message": "Missing required certifications",
                            "errors": [f"Missing certification: {cert}" for cert in missing_certs]
                        }
            
            return {
                "valid": True,
                "message": "Shift assignment is valid"
            }
            
        except Exception as e:
            return {
                "valid": False,
                "message": str(e),
                "errors": ["Validation error occurred"]
            }
    
    async def get_shift_assignments(self, personnel_id: Optional[int] = None, date_range: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get shift assignments for personnel"""
        try:
            query = self.db.query(ShiftAssignment).filter(ShiftAssignment.is_active == True)
            
            if personnel_id:
                query = query.filter(ShiftAssignment.personnel_id == personnel_id)
            
            if date_range:
                start_date = datetime.strptime(date_range["start_date"], "%Y-%m-%d").date()
                end_date = datetime.strptime(date_range["end_date"], "%Y-%m-%d").date()
                query = query.filter(
                    ShiftAssignment.start_date >= start_date,
                    ShiftAssignment.end_date <= end_date
                )
            
            assignments = query.all()
            
            return [
                {
                    "assignment_id": assignment.id,
                    "personnel_id": assignment.personnel_id,
                    "personnel_name": assignment.personnel.full_name if assignment.personnel else "Unknown",
                    "shift_type": assignment.shift_type.shift_name if assignment.shift_type else "Unknown",
                    "role": assignment.role,
                    "start_date": assignment.start_date.isoformat(),
                    "end_date": assignment.end_date.isoformat(),
                    "assigned_days": assignment.assigned_days,
                    "is_primary_shift": assignment.is_primary_shift,
                    "work_location": assignment.work_location,
                    "status": "ACTIVE"
                }
                for assignment in assignments
            ]
            
        except Exception as e:
            return []
    
    async def check_shift_conflicts(self, assignment_data: Dict[str, Any]) -> List[str]:
        """Check for shift assignment conflicts"""
        conflicts = []
        
        try:
            # Check for overlapping assignments
            existing_assignments = self.db.query(ShiftAssignment).filter(
                ShiftAssignment.personnel_id == assignment_data["personnel_id"],
                ShiftAssignment.is_active == True,
                ShiftAssignment.start_date <= assignment_data["end_date"],
                ShiftAssignment.end_date >= assignment_data["start_date"]
            ).all()
            
            for existing in existing_assignments:
                if self.dates_overlap(existing.start_date, existing.end_date, assignment_data["start_date"], assignment_data["end_date"]):
                    conflicts.append(f"Shift conflict: {existing.start_date} to {existing.end_date}")
            
            return conflicts
            
        except Exception as e:
            return ["Error checking shift conflicts"]
    
    def dates_overlap(self, start1: date, end1: date, start2: date, end2: date) -> bool:
        """Check if two date ranges overlap"""
        return (start1 <= end2 and start2 <= end1) or (start2 <= end1 and start1 <= end2)
```

### 13.2.2. Shift Types and Assignments
```python
# app/models/staffing/shift_management.py
class ShiftType(Base):
    """Shift type definitions"""
    __tablename__ = "shift_types"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # Shift Properties
    shift_code = Column(String(20), nullable=False, unique=True)
    shift_name = Column(String(100), nullable=False)
    shift_description = Column(Text)
    shift_type = Column(String(20))  # DAY, NIGHT, ROTATING, SPLIT, FLEXIBLE
    
    # Time Configuration
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_hours = Column(Float, nullable=False)
    break_duration_minutes = Column(Integer, default=60)
    
    # Staffing Requirements
    min_personnel = Column(Integer, default=1)
    max_personnel = Column(Integer, nullable=False)
    required_skills = Column(JSON)
    required_certifications = Column(JSON)
    
    # Compensation
    overtime_multiplier = Column(Float, default=1.0)
    night_shift_allowance = Column(Float, default=0.0)
    weekend_multiplier = Column(Float, default=1.0)
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ShiftAssignment(Base):
    """Personnel shift assignments"""
    __tablename__ = "shift_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    shift_type_id = Column(Integer, ForeignKey("shift_types.id"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("work_schedules.id"))
    
    # Assignment Details
    role = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_primary_shift = Column(Boolean, default=False)
    
    # Scheduling Details
    assigned_days = Column(JSON)  # ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    rotation_pattern = Column(String(50))  # "WEEK1", "WEEK2", "WEEK3", "WEEK4"
    
    # Location and Coverage
    work_location = Column(String(100))
    coverage_area = Column(String(50))
    backup_personnel_id = Column(Integer, ForeignKey("personnel.id"))
    
    # Status
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    personnel = relationship("Personnel")
    shift_type = relationship("ShiftType")
    schedule = relationship("WorkSchedule")
```

### 13.3. Schedule Management

#### 13.3.1. Schedule Management Service
```python
# app/services/staffing/schedule_management_service.py
class ScheduleManagementService:
    def __init__(self):
        self.db = next(get_db())
    
    async def create_work_schedule(self, schedule_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create work schedule"""
        try:
            # Validate schedule data
            validation_result = await self.validate_schedule_data(schedule_data)
            if not validation_result["valid"]:
                return validation_result
            
            # Create work schedule
            schedule = WorkSchedule(
                company_id=schedule_data["company_id"],
                schedule_name=schedule_data["schedule_name"],
                schedule_type=schedule_data["schedule_type"],
                schedule_pattern=schedule_data.get("schedule_pattern"),
                start_date=schedule_data["start_date"],
                end_date=schedule_data["end_date"],
                required_personnel_count=schedule_data.get("required_personnel_count"),
                minimum_staffing_level=schedule_data.get("minimum_staffing_level"),
                required_skills=schedule_data.get("required_skills", []),
                required_certifications=schedule_data.get("required_certifications", []),
                coverage_areas=schedule_data.get("coverage_areas", []),
                critical_positions=schedule_data.get("critical_positions", []),
                requires_approval=schedule_data.get("requires_approval", False),
                approved_by=schedule_data.get("approved_by"),
                approved_at=schedule_data.get("approved_at"),
                is_active=True
            )
            
            self.db.add(schedule)
            self.db.commit()
            
            return {
                "status": "SUCCESS",
                "schedule_id": schedule.id,
                "message": "Work schedule created successfully"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def validate_schedule_data(self, schedule_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate work schedule data"""
        try:
            # Check required fields
            required_fields = ["company_id", "schedule_name", "schedule_type", "start_date", "end_date"]
            for field in required_fields:
                if field not in schedule_data:
                    return {
                        "valid": False,
                        "message": f"Required field missing: {field}",
                        "errors": [f"Missing required field: {field}"]
                    }
            
            # Validate date range
            if schedule_data["start_date"] >= schedule_data["end_date"]:
                return {
                    "valid": False,
                    "message": "Start date must be before end date",
                    "errors": ["Invalid date range"]
                }
            
            # Validate personnel requirements
            if schedule_data.get("required_personnel_count", 0) < 1:
                return {
                    "valid": False,
                    "message": "At least 1 personnel required",
                    "errors": ["Personnel count must be at least 1"]
                }
            
            return {
                "valid": True,
                "message": "Schedule data is valid"
            }
            
        except Exception as e:
            return {
                "valid": False,
                "message": str(e),
                "errors": ["Validation error occurred"]
            }
    
    async def get_work_schedules(self, company_id: int) -> List[Dict[str, Any]]:
        """Get all work schedules for company"""
        try:
            schedules = self.db.query(WorkSchedule).filter(
                WorkSchedule.company_id == company_id,
                WorkSchedule.is_active == True
            ).all()
            
            return [
                {
                    "schedule_id": schedule.id,
                    "schedule_name": schedule.schedule_name,
                    "schedule_type": schedule.schedule_type,
                    "schedule_pattern": schedule.schedule_pattern,
                    "start_date": schedule.start_date.isoformat(),
                    "end_date": schedule.end_date.isoformat(),
                    "required_personnel_count": schedule.required_personnel_count,
                    "minimum_staffing_level": schedule.minimum_staffing_level,
                    "required_skills": schedule.required_skills,
                    "required_certifications": schedule.required_certifications,
                    "coverage_areas": schedule.coverage_areas,
                    "critical_positions": schedule.critical_positions,
                    "is_active": schedule.is_active,
                    "created_at": schedule.created_at.isoformat()
                }
                for schedule in schedules
            ]
            
        except Exception as e:
            return []
```

### 13.3.2. Work Schedule Models
```python
# app/models/staffing/schedule_management.py
class WorkSchedule(Base):
    """Work schedule definitions and rules"""
    __tablename__ = "work_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # Schedule Properties
    schedule_name = Column(String(100), nullable=False)
    schedule_type = Column(String(20))  # WEEKLY, BI_WEEKLY, MONTHLY, ROTATING
    schedule_pattern = Column(String(50))  # "MON-FRI", "TUE-SAT", etc.
    
    # Date Range
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    
    # Personnel Requirements
    required_personnel_count = Column(Integer, nullable=False)
    minimum_staffing_level = Column(String(20))  # JUNIOR, MID_LEVEL, etc.
    required_skills = Column(JSON)
    required_certifications = Column(JSON)
    
    # Coverage Requirements
    coverage_areas = Column(JSON)  # ["PRODUCTION", "MAINTENANCE", "SAFETY"]
    critical_positions = Column(JSON)  # Positions that must always be staffed
    
    # Approval Workflow
    requires_approval = Column(Boolean, default=False)
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ScheduleAssignment(Base):
    """Personnel schedule assignments"""
    __tablename__ = "schedule_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("work_schedules.id"), nullable=False)
    role = Column(String(100), nullable=False)
    
    # Assignment Details
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_primary_assignment = Column(Boolean, default=False)
    
    # Time Details
    work_days = Column(JSON)  # ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    break_duration = Column(Integer, default=0)  # minutes
    
    # Location and Coverage
    work_location = Column(String(100))
    coverage_area = Column(String(50))
    backup_personnel_id = Column(Integer, ForeignKey("personnel.id"))
    
    # Status
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### 13.4. Break Time Management

#### 13.4.1. Break Time Management Service
```python
# app/services/staffing/break_time_service.py
class BreakTimeService:
    def __init__(self):
        self.db = next(get_db())
    
    async def create_break_policy(self, policy_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create break time policy"""
        try:
            # Check if policy already exists
            existing_policy = self.db.query(BreakTimePolicy).filter(
                BreakTimePolicy.company_id == policy_data["company_id"],
                BreakTimePolicy.is_active == True
            ).first()
            
            if existing_policy:
                return {
                    "status": "ERROR",
                    "message": "Break time policy already exists for this company"
                }
            
            # Create new break policy
            policy = BreakTimePolicy(
                company_id=policy_data["company_id"],
                policy_name=policy_data["policy_name"],
                policy_type=policy_data["policy_type"],
                work_hours_required=policy_data.get("work_hours_required", 8),
                break_duration_minutes=policy_data.get("break_duration_minutes", 30),
                max_break_duration_minutes=policy_data.get("max_break_duration_minutes", 60),
                min_hours_between_breaks=policy_data.get("min_hours_between_breaks", 4),
                max_breaks_per_shift=policy_data.get("max_breaks_per_shift", 2),
                break_start_window_minutes=policy_data.get("break_start_window_minutes", 60),
                break_end_window_minutes=policy_data.get("break_end_window_minutes", 60),
                is_paid_break=policy_data.get("is_paid_break", False),
                break_pay_rate=policy_data.get("break_pay_rate", 0.0),
                is_active=True
            )
            
            self.db.add(policy)
            self.db.commit()
            
            return {
                "status": "SUCCESS",
                "policy_id": policy.id,
                "message": "Break time policy created successfully"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def log_break_time(self, break_data: Dict[str, Any]) -> Dict[str, Any]:
        """Log break time for compliance tracking"""
        try:
            # Create break time log
            break_log = BreakTimeLog(
                personnel_id=break_data["personnel_id"],
                shift_assignment_id=break_data["shift_assignment_id"],
                scheduled_start_time=break_data["scheduled_start_time"],
                scheduled_end_time=break_data["scheduled_end_time"],
                actual_start_time=break_data["actual_start_time"],
                actual_end_time=break_data["actual_end_time"],
                duration_minutes=break_data["duration_minutes"],
                break_type=break_data["break_type"],
                is_paid=break_data.get("is_paid", False),
                break_location=break_data.get("break_location"),
                is_compliant=break_data.get("is_compliant", True),
                compliance_notes=break_data.get("compliance_notes", "")
            )
            
            self.db.add(break_log)
            self.db.commit()
            
            return {
                "status": "SUCCESS",
                "break_log_id": break_log.id,
                "message": "Break time logged successfully"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def get_break_time_logs(self, personnel_id: Optional[int] = None, date_range: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get break time logs"""
        try:
            query = self.db.query(BreakTimeLog).filter(BreakTimeLog.is_compliant == True)
            
            if personnel_id:
                query = query.filter(BreakTimeLog.personnel_id == personnel_id)
            
            if date_range:
                start_date = datetime.strptime(date_range["start_date"], "%Y-%m-%d").date()
                end_date = datetime.strptime(date_range["end_date"], "%Y-%m-%d").date()
                query = query.filter(
                    BreakTimeLog.actual_start_time >= start_date,
                    BreakTimeLog.actual_end_time <= end_date
                )
            
            logs = query.all()
            
            return [
                {
                    "break_log_id": log.id,
                    "personnel_id": log.personnel_id,
                    "scheduled_start_time": log.scheduled_start_time.isoformat(),
                    "scheduled_end_time": log.scheduled_end_time.isoformat(),
                    "actual_start_time": log.actual_start_time.isoformat(),
                    "actual_end_time": log.actual_end_time.isoformat(),
                    "duration_minutes": log.duration_minutes,
                    "break_type": log.break_type,
                    "is_paid": log.is_paid,
                    "break_location": log.break_location,
                    "is_compliant": log.is_compliant,
                    "compliance_notes": log.compliance_notes,
                    "created_at": log.created_at.isoformat()
                }
                for log in logs
            ]
            
        except Exception as e:
            return []
```

### 13.4.2. Break Time Models
```python
# app/models/staffing/break_time_management.py
class BreakTimePolicy(Base):
    """Break time policies and rules"""
    __tablename__ = "break_time_policies"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # Policy Properties
    policy_name = Column(String(100), nullable=False)
    policy_type = Column(String(20))  # PAID, UNPAID, FLEXIBLE
    
    # Time Configuration
    work_hours_required = Column(Integer, default=8)  # hours before break eligible
    break_duration_minutes = Column(Integer, default=30)  # standard break length
    max_break_duration_minutes = Column(Integer, default=60)  # maximum break length
    
    # Shift-based Rules
    min_hours_between_breaks = Column(Integer, default=4)  # minimum work hours between breaks
    max_breaks_per_shift = Column(Integer, default=2)  # maximum breaks per shift
    
    # Time-based Rules
    break_start_window_minutes = Column(Integer, default=60)  # window around scheduled break time
    break_end_window_minutes = Column(Integer, default=60)  # window around scheduled break end
    
    # Compensation Rules
    is_paid_break = Column(Boolean, default=False)
    break_pay_rate = Column(Float, default=0.0)  # hourly rate for paid breaks
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class BreakTimeLog(Base):
    """Break time tracking and compliance"""
    __tablename__ = "break_time_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    shift_assignment_id = Column(Integer, ForeignKey("shift_assignments.id"), nullable=False)
    
    # Break Details
    scheduled_start_time = Column(DateTime(timezone=True), nullable=False)
    scheduled_end_time = Column(DateTime(timezone=True), nullable=False)
    actual_start_time = Column(DateTime(timezone=True), nullable=False)
    actual_end_time = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    
    # Break Type
    break_type = Column(String(20))  # SCHEDULED, UNSCHEDULED, EXTENDED
    is_paid = Column(Boolean, default=False)
    break_location = Column(String(100))
    
    # Compliance
    is_compliant = Column(Boolean, default=True)
    compliance_notes = Column(Text)
    
    # Status
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### 13.5. Leave Management

#### 13.5.1. Leave Management Service
```python
# app/services/staffing/leave_management_service.py
class LeaveManagementService:
    def __init__(self):
        self.db = next(get_db())
    
    async def create_leave_request(self, leave_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create leave request"""
        try:
            # Validate leave data
            validation_result = await self.validate_leave_request(leave_data)
            if not validation_result["valid"]:
                return validation_result
            
            # Check leave balance
            balance_result = await self.check_leave_balance(leave_data["personnel_id"], leave_data["leave_type"])
            if not balance_result["sufficient"]:
                return {
                    "valid": False,
                    "message": "Insufficient leave balance",
                    "errors": balance_result["errors"]
                }
            
            # Create leave request
            leave_request = LeaveRequest(
                personnel_id=leave_data["personnel_id"],
                leave_policy_id=leave_data["leave_policy_id"],
                leave_type=leave_data["leave_type"],
                start_date=leave_data["start_date"],
                end_date=leave_data["end_date"],
                total_days=leave_data["total_days"],
                reason=leave_data["reason"],
                emergency_contact=leave_data.get("emergency_contact"),
                emergency_phone=leave_data.get("emergency_phone"),
                supporting_documents=leave_data.get("supporting_documents", []),
                status="PENDING",
                requested_at=datetime.now()
            )
            
            self.db.add(leave_request)
            self.db.commit()
            
            # Send notifications to approvers
            await self.send_leave_notifications(leave_request)
            
            return {
                "status": "SUCCESS",
                "leave_request_id": leave_request.id,
                "message": "Leave request submitted for approval"
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def approve_leave_request(self, leave_request_id: int, approval_data: Dict[str, Any]) -> Dict[str, Any]:
        """Approve or reject leave request"""
        try:
            leave_request = self.db.query(LeaveRequest).filter(
                LeaveRequest.id == leave_request_id
            ).first()
            
            if not leave_request:
                return {
                    "status": "ERROR",
                    "message": "Leave request not found"
                }
            
            # Update leave request
            leave_request.status = approval_data["status"]  # APPROVED, REJECTED, CANCELLED
            leave_request.approved_by = approval_data.get("approved_by")
            leave_request.approved_at = datetime.now()
            leave_request.rejection_reason = approval_data.get("rejection_reason", "")
            leave_request.approval_notes = approval_data.get("approval_notes", "")
            
            self.db.commit()
            
            # Send notifications
            await self.send_approval_notifications(leave_request)
            
            return {
                "status": "SUCCESS",
                "leave_request_id": leave_request.id,
                "approval_status": leave_request.status,
                "approved_by": approval_data.get("approved_by"),
                "approved_at": leave_request.approved_at.isoformat()
            }
            
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
    
    async def validate_leave_request(self, leave_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate leave request data"""
        try:
            # Check personnel exists
            personnel = self.db.query(Personnel).filter(
                Personnel.id == leave_data["personnel_id"]
            ).first()
            
            if not personnel:
                return {
                    "valid": False,
                    "message": "Personnel not found",
                    "errors": ["Personnel ID is required"]
                }
            
            # Check leave policy
            leave_policy = self.db.query(LeavePolicy).filter(
                LeavePolicy.id == leave_data["leave_policy_id"]
            ).first()
            
            if not leave_policy:
                return {
                    "valid": False,
                    "message": "Leave policy not found",
                    "errors": ["Leave policy ID is required"]
                }
            
            # Validate dates
            if leave_data["start_date"] >= leave_data["end_date"]:
                return {
                    "valid": False,
                    "message": "Start date must be before end date",
                    "errors": ["Invalid date range"]
                }
            
            # Check leave balance
            balance_result = await self.check_leave_balance(leave_data["personnel_id"], leave_data["leave_type"])
            if not balance_result["sufficient"]:
                return balance_result
            
            # Check required documents
            if leave_policy.requires_medical_certificate and not leave_data.get("supporting_documents"):
                return {
                    "valid": False,
                    "message": "Medical certificate required",
                    "errors": ["Medical certificate is required for this leave type"]
                }
            
            return {
                "valid": True,
                "message": "Leave request is valid"
            }
            
        except Exception as e:
            return {
                "valid": False,
                "message": str(e),
                "errors": ["Validation error occurred"]
            }
    
    async def check_leave_balance(self, personnel_id: int, leave_type: str) -> Dict[str, Any]:
        """Check personnel leave balance"""
        try:
            # Get personnel leave requests
            leave_requests = self.db.query(LeaveRequest).filter(
                LeaveRequest.personnel_id == personnel_id,
                LeaveRequest.leave_type == leave_type,
                LeaveRequest.status.in_(["APPROVED", "COMPLETED"])
            ).all()
            
            # Get leave policy
            leave_policy = self.db.query(LeavePolicy).filter(
                LeavePolicy.leave_type == leave_type
            ).first()
            
            if not leave_policy:
                return {
                    "sufficient": False,
                    "message": "Leave policy not found",
                    "errors": ["Leave policy configuration missing"]
                }
            
            # Calculate used leave
            used_days = sum(req.total_days for req in leave_requests)
            
            # Calculate earned leave
            earned_days = 0
            if leave_policy.accrual_rate:
                # Get personnel service years
                personnel = self.db.query(Personnel).filter(Personnel.id == personnel_id).first()
                if personnel and personnel.hire_date:
                    service_years = (datetime.now().date() - personnel.hire_date.date()).days // 365
                    earned_days = service_years * leave_policy.accrual_rate
            
            # Calculate available balance
            total_entitlement = leave_policy.days_per_year if leave_policy.days_per_year else 0
            available_days = total_entitlement - used_days + earned_days
            
            return {
                "sufficient": available_days > 0,
                "total_entitlement": total_entitlement,
                "used_days": used_days,
                "earned_days": earned_days,
                "available_days": available_days,
                "errors": [] if available_days > 0 else ["No leave days available"]
            }
            
        except Exception as e:
            return {
                "sufficient": False,
                "message": "Error checking leave balance",
                "errors": [str(e)]
            }
```

### 13.5.2. Leave Management Models
```python
# app/models/staffing/leave_management.py
class LeavePolicy(Base):
    """Leave policies and entitlement rules"""
    __tablename__ = "leave_policies"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    
    # Policy Properties
    policy_name = Column(String(100), nullable=False)
    leave_type = Column(String(20))  # ANNUAL, SICK, MATERNITY, PATERNITY, COMPASSIONATE, UNPAID, MILITARY, BEREAVEMENT
    
    # Entitlement Rules
    days_per_year = Column(Float, nullable=False)
    days_per_month = Column(Float, nullable=False)
    days_per_week = Column(Float, nullable=False)
    max_days_per_year = Column(Integer, nullable=False)
    accrual_rate = Column(Float, nullable=False)  # days earned per month worked
    carry_over_expiry_days = Column(Integer, nullable=False)
    
    # Eligibility Requirements
    min_employment_months = Column(Integer, default=3)  # months of service required
    min_age_years = Column(Integer, default=18)
    max_age_years = Column(Integer, default=70)
    probation_period_months = Column(Integer, nullable=False)
    
    # Carry-over Rules
    max_carried_forward_days = Column(Integer, nullable=False)
    carry_over_expiry_days = Column(Integer, nullable=False)
    use_it_or_lose_policy = Column(String(20))  # "USE_IT_OR_LOSE", "CARRY_FORWARD", "LIMITED"
    
    # Approval Workflow
    requires_approval = Column(Boolean, default=True)
    approval_levels = Column(JSON)  # ["SUPERVISOR", "MANAGER", "HR"]
    approval_deadline_hours = Column(Integer, default=48)  # hours before leave date
    
    # Documentation Requirements
    requires_medical_certificate = Column(Boolean, default=False)
    requires_doctor_note = Column(Boolean, default=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class LeaveRequest(Base):
    """Leave requests and tracking"""
    __tablename__ = "leave_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    leave_policy_id = Column(Integer, ForeignKey("leave_policies.id"), nullable=False)
    
    # Leave Details
    leave_type = Column(String(20), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Integer, nullable=False)
    
    # Leave Reason
    reason = Column(Text, nullable=False)
    emergency_contact = Column(String(100))
    emergency_phone = Column(String(20))
    
    # Supporting Documents
    supporting_documents = Column(JSON)  # [{"type": "medical", "url": "..."}, ...]
    
    # Status and Workflow
    status = Column(String(20), default="PENDING")  # PENDING, APPROVED, REJECTED, CANCELLED, COMPLETED
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    approval_notes = Column(Text)
    
    # Return Information
    actual_return_date = Column(Date)
    return_to_work_date = Column(Date)
    return_notes = Column(Text)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### 13.6. Database Schema for Staffing

```python
# app/models/staffing/personnel_staffing_level.py
from sqlalchemy import Column, Integer, ForeignKey

class PersonnelStaffingLevel(Base):
    """Personnel staffing level assignments"""
    __tablename__ = "personnel_staffing_levels"
    
    id = Column(Integer, primary_key=True, index=True)
    personnel_id = Column(Integer, ForeignKey("personnel.id"), nullable=False)
    staffing_level_id = Column(Integer, ForeignKey("staffing_levels.id"), nullable=False)
    
    # Assignment Details
    assigned_date = Column(DateTime(timezone=True), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    personnel = relationship("Personnel")
    staffing_level = relationship("StaffingLevel")
```

### 13.7. API Endpoints for Staffing Management

```python
# app/api/staffing/staffing_config.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.staffing.staffing_config_service import StaffingConfigurationService
from app.core.dependencies import get_current_active_user

router = APIRouter(prefix="/api/v1/staffing", tags=["Staffing Management"])

@router.post("/configuration", response_model=Dict[str, Any])
async def create_staffing_config(
    config_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create staffing configuration"""
    service = StaffingConfigurationService()
    return await service.create_staffing_config(config_data)

@router.get("/configuration/{company_id}", response_model=Dict[str, Any])
async def get_staffing_config(
    company_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get staffing configuration"""
    service = StaffingConfigurationService()
    return await service.get_staffing_config(company_id)

@router.get("/staffing-levels", response_model=List[Dict[str, Any]])
async def get_staffing_levels(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get all staffing levels"""
    service = StaffingConfigurationService()
    return await service.get_staffing_levels()

# app/api/staffing/shift_management.py
@router.post("/shift-types", response_model=Dict[str, Any])
async def create_shift_type(
    shift_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create new shift type"""
    service = ShiftManagementService()
    return await service.create_shift_type(shift_data)

@router.post("/shift-assignments", response_model=Dict[str, Any])
async def create_shift_assignment(
    assignment_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create personnel shift assignment"""
    service = ShiftManagementService()
    return await service.create_shift_assignment(assignment_data)

@router.get("/shift-assignments", response_model=List[Dict[str, Any]])
async def get_shift_assignments(
    personnel_id: Optional[int] = None,
    date_range: Dict[str, Any] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get shift assignments"""
    service = ShiftManagementService()
    return await service.get_shift_assignments(personnel_id, date_range)

# app/api/staffing/schedule_management.py
@router.post("/work-schedules", response_model=Dict[str, Any])
async def create_work_schedule(
    schedule_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create work schedule"""
    service = ScheduleManagementService()
    return await service.create_work_schedule(schedule_data)

@router.get("/work-schedules", response_model=List[Dict[str, Any]])
async def get_work_schedules(
    company_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get all work schedules"""
    service = ScheduleManagementService()
    return await service.get_work_schedules(company_id)

# app/api/staffing/break_time_management.py
@router.post("/break-policies", response_model=Dict[str, Any])
async def create_break_policy(
    policy_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create break time policy"""
    service = BreakTimeService()
    return await service.create_break_policy(policy_data)

@router.post("/break-logs", response_model=Dict[str, Any])
async def log_break_time(
    break_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Log break time"""
    service = BreakTimeService()
    return await service.log_break_time(break_data)

@router.get("/break-logs", response_model=List[Dict[str, Any]])
async def get_break_time_logs(
    personnel_id: Optional[int] = None,
    date_range: Dict[str, Any] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Get break time logs"""
    service = BreakTimeService()
    return await service.get_break_time_logs(personnel_id, date_range)

# app/api/staffing/leave_management.py
@router.post("/leave-requests", response_model=Dict[str, Any])
async def create_leave_request(
    leave_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Create leave request"""
    service = LeaveManagementService()
    return await service.create_leave_request(leave_data)

@router.put("/leave-requests/{request_id}/approve", response_model=Dict[str, Any])
async def approve_leave_request(
    request_id: int,
    approval_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """Approve or reject leave request"""
    service = LeaveManagementService()
    return await service.approve_leave_request(request_id, approval_data)
```

## 🎯 **Configuration Best Practices**

### **Default Oil & Gas Staffing Configuration**
```python
# Recommended Staffing Configuration for Oil & Gas
OIL_GAS_STAFFING_CONFIG = {
    "staffing_categories": {
        "OFFSHORE": {
            "max_consecutive_days": 28,
            "min_experience_years": 3,
            "max_age_years": 65,
            "required_certifications": ["BOSIET", "H2S", "MEDICAL"],
            "required_training": ["SAFETY_ORIENTED", "EMERGENCY_RESPONSE"],
            "rotation_requirements": {
                "min_rotation_experience": 2,
                "certification_refresh_interval_months": 6
            }
        },
        "ONSHORE": {
            "max_consecutive_days": 35,
            "min_experience_years": 2,
            "max_age_years": 70,
            "required_certifications": ["SAFETY_TRAINING", "OPERATION_CERTIFICATES"]
        }
    },
    
    "shift_patterns": {
        "OFFSHORE_STANDARD": {
            "pattern": "28 days on, 28 days off",
            "rotation_cycle": "4 weeks",
            "changeover_day": "SUNDAY",
            "work_schedule": "14/14, 7/7"
        },
        "OFFSHORE_EXTENDED": {
            "pattern": "21 days on, 7 days off",
            "rotation_cycle": "4 weeks",
            "work_schedule": "21/7, 7/7"
        }
    },
    
    "leave_entitlements": {
        "ANNUAL_LEAVE": {
            "base_entitlement": 20,
            "service_years_multiplier": 0.1,
            "max_entitlement": 30,
            "carry_forward_limit": 10
        },
        "SICK_LEAVE": {
            "accrual_rate": 0.083,
            "max_days_per_year": 10,
            "waiting_period_days": 3,
            "medical_certification_required": True
        },
        "MATERNITY_LEAVE": {
            "paid_leave": True,
            "minimum_service_months": 6,
            "days_per_year": 90,
            "requires_medical_certificate": True,
            "job_protection": True
        }
    }
}
```

---

## 14. API Endpoint Management & Performance Optimization

### 14.1. Problem Analysis and Solution Architecture

#### 14.1.1. Performance Challenges
```python
# Current Performance Challenges
PERFORMANCE_CHALLENGES = {
    "dashboard_heavy_traffic": {
        "description": "Multiple concurrent API calls causing system slowdown",
        "impact": "Dashboard loading times of 3-5 seconds",
        "root_cause": "Unoptimized database queries and lack of caching"
    },
    
    "api_endpoint_conflicts": {
        "description": "Resource contention between concurrent requests",
        "impact": "Response times of 500-1000ms",
        "root_cause": "Poor connection pooling and request management"
    },
    
    "database_bottlenecks": {
        "description": "Inefficient database queries and connection management",
        "impact": "Database query times of 100-500ms",
        "root_cause": "Lack of query optimization and connection pooling"
    },
    
    "scalability_limitations": {
        "description": "System cannot handle increased user load",
        "impact": "Supports only 50-100 concurrent users",
        "root_cause": "Monolithic architecture without optimization"
    }
}
```

#### 14.1.2. Solution Architecture Overview
```python
# Solution Architecture Components
SOLUTION_ARCHITECTURE = {
    "api_gateway": {
        "components": [
            "RateLimitingMiddleware",
            "RequestQueueMiddleware", 
            "ResponseCacheMiddleware",
            "CompressionMiddleware"
        ],
        "purpose": "Centralized request management and optimization"
    },
    
    "dashboard_optimization": {
        "components": [
            "DashboardAggregationService",
            "RequestBatchingService",
            "IntelligentCaching",
            "ConcurrentDataFetching"
        ],
        "purpose": "Optimized dashboard data aggregation and delivery"
    },
    
    "database_optimization": {
        "components": [
            "OptimizedDatabase",
            "ConnectionPooling",
            "QueryOptimization",
            "PerformanceMonitoring"
        ],
        "purpose": "Efficient database operations and resource management"
    },
    
    "realtime_streaming": {
        "components": [
            "RealtimeStreamingService",
            "WebSocketConnections",
            "EventBroadcasting",
            "SubscriptionManagement"
        ],
        "purpose": "Real-time data updates without polling"
    },
    
    "performance_monitoring": {
        "components": [
            "PerformanceMonitoringService",
            "MetricsCollection",
            "AlertGeneration",
            "AnalyticsDashboard"
        ],
        "purpose": "Continuous performance monitoring and optimization"
    }
}
```

### 14.2. Enhanced API Gateway Implementation

#### 14.2.1. API Gateway with Performance Optimization
```python
# app/core/api_gateway_enhanced.py
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.concurrency import run_in_threadpool
from app.core.rate_limiter import RateLimiter
from app.core.cache_manager import CacheManager
from app.core.request_queue import RequestQueue
import asyncio
import time
from typing import Dict, Any

class EnhancedAPIGateway:
    """Enhanced API Gateway with performance optimization"""
    
    def __init__(self):
        self.app = FastAPI(title="ZKTeco POB Enhanced API Gateway")
        self.rate_limiter = RateLimiter()
        self.cache_manager = CacheManager()
        self.request_queue = RequestQueue()
        self.setup_middleware()
        self.setup_routes()
        self.setup_background_tasks()
    
    def setup_middleware(self):
        """Setup performance optimization middleware"""
        # CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"]
        )
        
        # Compression middleware
        self.app.add_middleware(GZipMiddleware, minimum_size=1000)
        
        # Rate limiting middleware
        self.app.add_middleware(RateLimitingMiddleware, rate_limiter=self.rate_limiter)
        
        # Request queuing middleware
        self.app.add_middleware(RequestQueueMiddleware, request_queue=self.request_queue)
        
        # Response caching middleware
        self.app.add_middleware(ResponseCacheMiddleware, cache_manager=self.cache_manager)
    
    def setup_background_tasks(self):
        """Setup background tasks for optimization"""
        @self.app.on_event("startup")
        async def startup_event():
            # Start cache warming task
            asyncio.create_task(self.cache_warming_task())
            # Start request monitoring task
            asyncio.create_task(self.request_monitoring_task())
            # Start performance monitoring task
            asyncio.create_task(self.performance_monitoring_task())
    
    async def cache_warming_task(self):
        """Background task to warm up cache with frequently accessed data"""
        while True:
            try:
                # Warm up dashboard cache
                await self.warm_dashboard_cache()
                
                # Wait before next warming
                await asyncio.sleep(300)  # 5 minutes
            except Exception as e:
                print(f"Error in cache warming: {e}")
                await asyncio.sleep(60)
    
    async def warm_dashboard_cache(self):
        """Warm up dashboard cache with common data"""
        # Pre-cache common dashboard data
        common_endpoints = [
            "/api/v1/pob-status/dashboard",
            "/api/v1/rotation-management/dashboard",
            "/api/v1/personnel/summary",
            "/api/v1/time-attendance/summary"
        ]
        
        for endpoint in common_endpoints:
            try:
                # Make internal request to warm cache
                await self.make_internal_request(endpoint)
            except Exception as e:
                print(f"Error warming cache for {endpoint}: {e}")

class RateLimitingMiddleware:
    """Rate limiting middleware for API protection"""
    
    def __init__(self, app, rate_limiter: RateLimiter):
        self.app = app
        self.rate_limiter = rate_limiter
    
    async def __call__(self, scope: Dict[str, Any], receive: Any, send: Any):
        if scope["type"] == "http":
            # Extract client IP and endpoint
            client_ip = self.get_client_ip(scope)
            endpoint = scope["path"]
            
            # Check rate limit
            if not await self.rate_limiter.is_allowed(client_ip, endpoint):
                response = Response(
                    content={"error": "Rate limit exceeded"},
                    status_code=429,
                    headers={"Retry-After": str(self.rate_limiter.get_retry_after(client_ip, endpoint))}
                )
                await response(scope, receive, send)
                return
        
        await self.app(scope, receive, send)
    
    def get_client_ip(self, scope: Dict[str, Any]) -> str:
        """Extract client IP from request scope"""
        for header, value in scope.get("headers", []):
            if header.decode() == "x-forwarded-for":
                return value.decode()
        return scope.get("client", [""])[0]

class RequestQueueMiddleware:
    """Request queuing middleware for traffic management"""
    
    def __init__(self, app, request_queue: RequestQueue):
        self.app = app
        self.request_queue = request_queue
    
    async def __call__(self, scope: Dict[str, Any], receive: Any, send: Any):
        if scope["type"] == "http":
            endpoint = scope["path"]
            
            # Check if endpoint requires queuing
            if self.should_queue_request(endpoint):
                # Add to queue
                queue_position = await self.request_queue.add_request(scope, receive, send)
                
                if queue_position > 10:  # Queue too long
                    response = Response(
                        content={"error": "Server busy, please try again later"},
                        status_code=503
                    )
                    await response(scope, receive, send)
                    return
                
                # Wait for turn
                await self.request_queue.wait_for_turn(queue_position)
        
        await self.app(scope, receive, send)
    
    def should_queue_request(self, endpoint: str) -> bool:
        """Determine if request should be queued"""
        heavy_endpoints = [
            "/api/v1/pob-status/dashboard",
            "/api/v1/rotation-management/dashboard",
            "/api/v1/reporting/analytics",
            "/api/v1/time-attendance/summary"
        ]
        return any(heavy_endpoint in endpoint for heavy_endpoint in endpoint)

class ResponseCacheMiddleware:
    """Response caching middleware for performance"""
    
    def __init__(self, app, cache_manager: CacheManager):
        self.app = app
        self.cache_manager = cache_manager
    
    async def __call__(self, scope: Dict[str, Any], receive: Any, send: Any):
        if scope["type"] == "http":
            endpoint = scope["path"]
            method = scope["method"]
            
            # Check if response is cached
            if method == "GET" and self.should_cache_response(endpoint):
                cache_key = self.generate_cache_key(scope)
                cached_response = await self.cache_manager.get(cache_key)
                
                if cached_response:
                    # Return cached response
                    response = Response(
                        content=cached_response["content"],
                        status_code=cached_response["status_code"],
                        headers=cached_response["headers"]
                    )
                    await response(scope, receive, send)
                    return
        
        await self.app(scope, receive, send)
    
    def should_cache_response(self, endpoint: str) -> bool:
        """Determine if response should be cached"""
        cacheable_endpoints = [
            "/api/v1/pob-status/dashboard",
            "/api/v1/rotation-management/dashboard",
            "/api/v1/personnel/list",
            "/api/v1/time-attendance/summary",
            "/api/v1/reports/analytics"
        ]
        return any(cacheable_endpoint in endpoint for cacheable_endpoint in endpoint)
    
    def generate_cache_key(self, scope: Dict[str, Any]) -> str:
        """Generate cache key for request"""
        endpoint = scope["path"]
        query_params = self.get_query_params(scope)
        user_id = self.get_user_id(scope)
        return f"{endpoint}:{query_params}:{user_id}"
```

#### 14.2.2. Rate Limiting Implementation
```python
# app/core/rate_limiter.py
from typing import Dict, Any, Optional
from collections import defaultdict
import time
import asyncio

class RateLimiter:
    """Advanced rate limiting implementation"""
    
    def __init__(self):
        self.requests = defaultdict(lambda: defaultdict(list))
        self.limits = {
            "default": {"requests": 100, "window": 60},  # 100 requests per minute
            "dashboard": {"requests": 30, "window": 60},   # 30 requests per minute for dashboard
            "api": {"requests": 200, "window": 60},       # 200 requests per minute for API
            "upload": {"requests": 10, "window": 60}        # 10 requests per minute for uploads
        }
    
    async def is_allowed(self, client_ip: str, endpoint: str) -> bool:
        """Check if request is allowed based on rate limits"""
        current_time = time.time()
        
        # Determine limit category
        limit_category = self.get_limit_category(endpoint)
        limit_config = self.limits[limit_category]
        
        # Clean old requests
        self.clean_old_requests(client_ip, limit_category, current_time, limit_config["window"])
        
        # Check current request count
        request_count = len(self.requests[client_ip][limit_category])
        
        if request_count >= limit_config["requests"]:
            return False
        
        # Add current request
        self.requests[client_ip][limit_category].append(current_time)
        return True
    
    def get_limit_category(self, endpoint: str) -> str:
        """Determine rate limit category based on endpoint"""
        if "dashboard" in endpoint:
            return "dashboard"
        elif "upload" in endpoint or "file" in endpoint:
            return "upload"
        elif "/api/" in endpoint:
            return "api"
        else:
            return "default"
    
    def clean_old_requests(self, client_ip: str, category: str, current_time: float, window: int):
        """Clean old requests outside the time window"""
        cutoff_time = current_time - window
        
        if client_ip in self.requests and category in self.requests[client_ip]:
            self.requests[client_ip][category] = [
                req_time for req_time in self.requests[client_ip][category]
                if req_time > cutoff_time
            ]
    
    def get_retry_after(self, client_ip: str, endpoint: str) -> int:
        """Get retry after time for rate limited requests"""
        limit_category = self.get_limit_category(endpoint)
        limit_config = self.limits[limit_category]
        
        if client_ip in self.requests and limit_category in self.requests[client_ip]:
            if self.requests[client_ip][limit_category]:
                oldest_request = min(self.requests[client_ip][limit_category])
                retry_after = int(oldest_request + limit_config["window"] - time.time())
                return max(retry_after, 1)
        
        return 60  # Default retry after 1 minute
```

### 14.3. Smart Dashboard Data Aggregation

#### 14.3.1. Dashboard Aggregation Service
```python
# app/services/dashboard_aggregation.py
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.cache_manager import CacheManager
import asyncio
from datetime import datetime, timedelta

class DashboardAggregationService:
    """Smart dashboard data aggregation service"""
    
    def __init__(self):
        self.db = next(get_db())
        self.cache_manager = CacheManager()
        self.aggregation_cache = {}
        self.last_aggregation_time = {}
    
    async def get_aggregated_dashboard_data(self, user_id: int, dashboard_type: str = "main") -> Dict[str, Any]:
        """Get aggregated dashboard data with intelligent caching"""
        cache_key = f"dashboard:{dashboard_type}:{user_id}"
        
        # Check cache first
        cached_data = await self.cache_manager.get(cache_key)
        if cached_data and self.is_cache_valid(cache_key):
            return cached_data
        
        # Aggregate data from multiple modules
        aggregated_data = await self.aggregate_all_modules(user_id, dashboard_type)
        
        # Cache the result
        await self.cache_manager.set(
            cache_key, 
            aggregated_data, 
            ttl=300  # 5 minutes cache
        )
        
        return aggregated_data
    
    async def aggregate_all_modules(self, user_id: int, dashboard_type: str) -> Dict[str, Any]:
        """Aggregate data from all modules concurrently"""
        tasks = []
        
        # Define module data fetchers based on dashboard type
        if dashboard_type == "main":
            tasks = [
                self.get_personnel_data(),
                self.get_pob_status_data(),
                self.get_time_attendance_data(),
                self.get_rotation_management_data(),
                self.get_mustering_data(),
                self.get_transport_data(),
                self.get_recent_events_data()
            ]
        elif dashboard_type == "operations":
            tasks = [
                self.get_pob_status_data(),
                self.get_time_attendance_data(),
                self.get_rotation_management_data(),
                self.get_transport_data()
            ]
        elif dashboard_type == "analytics":
            tasks = [
                self.get_analytics_data(),
                self.get_performance_metrics(),
                self.get_compliance_data()
            ]
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Combine results
        aggregated_data = {}
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"Error in aggregation task {i}: {result}")
                continue
            
            if isinstance(result, dict):
                aggregated_data.update(result)
        
        return aggregated_data
    
    async def get_personnel_data(self) -> Dict[str, Any]:
        """Get personnel data with caching"""
        cache_key = "personnel:summary"
        
        # Check cache
        cached_data = await self.cache_manager.get(cache_key)
        if cached_data:
            return {"personnel": cached_data}
        
        try:
            # Get personnel summary
            total_personnel = self.db.query(Personnel).filter(Personnel.is_active == True).count()
            offshore_count = self.db.query(Personnel).filter(
                Personnel.is_active == True,
                Personnel.current_location.like("%offshore%")
            ).count()
            onshore_count = total_personnel - offshore_count
            
            personnel_data = {
                "total_count": total_personnel,
                "offshore_count": offshore_count,
                "onshore_count": onshore_count,
                "last_updated": datetime.now().isoformat()
            }
            
            # Cache for 10 minutes
            await self.cache_manager.set(cache_key, personnel_data, ttl=600)
            
            return {"personnel": personnel_data}
            
        except Exception as e:
            print(f"Error getting personnel data: {e}")
            return {"personnel": {"total_count": 0, "offshore_count": 0, "onshore_count": 0}}
    
    async def get_pob_status_data(self) -> Dict[str, Any]:
        """Get POB status data with caching"""
        cache_key = "pob:status"
        
        # Check cache
        cached_data = await self.cache_manager.get(cache_key)
        if cached_data:
            return {"pob_status": cached_data}
        
        try:
            # Get POB status counts
            offshore_count = self.db.query(Personnel).filter(
                Personnel.is_active == True,
                Personnel.current_location.like("%offshore%")
            ).count()
            
            onshore_count = self.db.query(Personnel).filter(
                Personnel.is_active == True,
                Personnel.current_location.like("%onshore%")
            ).count()
            
            transit_count = self.db.query(Personnel).filter(
                Personnel.is_active == True,
                Personnel.current_location.like("%transit%")
            ).count()
            
            # Get location breakdown
            location_query = self.db.query(
                Personnel.current_location,
                func.count(Personnel.id).label('count')
            ).filter(
                Personnel.is_active == True,
                Personnel.current_location.isnot(None)
            ).group_by(Personnel.current_location).all()
            
            location_breakdown = {
                location: count for location, count in location_query
            }
            
            pob_data = {
                "offshore_count": offshore_count,
                "onshore_count": onshore_count,
                "transit_count": transit_count,
                "by_location": location_breakdown,
                "last_updated": datetime.now().isoformat()
            }
            
            # Cache for 2 minutes (more frequent)
            await self.cache_manager.set(cache_key, pob_data, ttl=120)
            
            return {"pob_status": pob_data}
            
        except Exception as e:
            print(f"Error getting POB status data: {e}")
            return {"pob_status": {"offshore_count": 0, "onshore_count": 0, "transit_count": 0, "by_location": {}}}
    
    async def get_time_attendance_data(self) -> Dict[str, Any]:
        """Get time attendance data with caching"""
        cache_key = "time_attendance:summary"
        
        # Check cache
        cached_data = await self.cache_manager.get(cache_key)
        if cached_data:
            return {"time_attendance": cached_data}
        
        try:
            # Get today's attendance summary
            today = datetime.now().date()
            
            clock_in_count = self.db.query(TimeSession).filter(
                TimeSession.clock_in_time >= today,
                TimeSession.clock_out_time.is_(None)
            ).count()
            
            total_sessions = self.db.query(TimeSession).filter(
                TimeSession.clock_in_time >= today
            ).count()
            
            attendance_data = {
                "active_sessions": clock_in_count,
                "total_sessions_today": total_sessions,
                "attendance_rate": (clock_in_count / max(total_sessions, 1)) * 100,
                "last_updated": datetime.now().isoformat()
            }
            
            # Cache for 5 minutes
            await self.cache_manager.set(cache_key, attendance_data, ttl=300)
            
            return {"time_attendance": attendance_data}
            
        except Exception as e:
            print(f"Error getting time attendance data: {e}")
            return {"time_attendance": {"active_sessions": 0, "total_sessions_today": 0, "attendance_rate": 0}}
    
    async def get_recent_events_data(self) -> Dict[str, Any]:
        """Get recent events data with caching"""
        cache_key = "events:recent"
        
        # Check cache
        cached_data = await self.cache_manager.get(cache_key)
        if cached_data:
            return {"recent_events": cached_data}
        
        try:
            # Get recent events
            recent_events_query = self.db.query(Event).join(Personnel).order_by(
                Event.timestamp.desc()
            ).limit(10).all()
            
            recent_events = []
            for event in recent_events_query:
                recent_events.append({
                    "id": event.id,
                    "type": event.event_type.value if event.event_type else 'UNKNOWN',
                    "personnel": event.personnel.full_name if event.personnel else 'Unknown',
                    "location": event.personnel.current_location if event.personnel and event.personnel.current_location else 'Unknown',
                    "timestamp": event.timestamp.isoformat(),
                    "raw_data": event.raw_data
                })
            
            # Cache for 1 minute (very frequent)
            await self.cache_manager.set(cache_key, recent_events, ttl=60)
            
            return {"recent_events": recent_events}
            
        except Exception as e:
            print(f"Error getting recent events: {e}")
            return {"recent_events": []}
    
    def is_cache_valid(self, cache_key: str) -> bool:
        """Check if cache is still valid"""
        last_update = self.last_aggregation_time.get(cache_key)
        if not last_update:
            return False
        
        # Different cache validity periods for different data types
        if "dashboard" in cache_key:
            return (datetime.now() - last_update).seconds < 300  # 5 minutes
        elif "events" in cache_key:
            return (datetime.now() - last_update).seconds < 60   # 1 minute
        else:
            return (datetime.now() - last_update).seconds < 600  # 10 minutes
```

#### 14.3.2. Intelligent Request Batching
```python
# app/services/request_batching.py
from typing import Dict, Any, List
from collections import defaultdict
import asyncio
import time

class RequestBatchingService:
    """Intelligent request batching for performance optimization"""
    
    def __init__(self):
        self.pending_requests = defaultdict(list)
        self.batch_size = 10
        self.batch_timeout = 0.1  # 100ms
        self.processing = False
    
    async def add_request(self, request_id: str, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Add request to batch"""
        batch_key = self.get_batch_key(endpoint, params)
        
        # Create batch request
        batch_request = {
            "request_id": request_id,
            "endpoint": endpoint,
            "params": params,
            "timestamp": time.time(),
            "response": None,
            "completed": False
        }
        
        self.pending_requests[batch_key].append(batch_request)
        
        # Wait for batch processing
        return await self.wait_for_batch_completion(batch_key, request_id)
    
    def get_batch_key(self, endpoint: str, params: Dict[str, Any]) -> str:
        """Generate batch key for similar requests"""
        # Remove user-specific params for batching
        batch_params = {k: v for k, v in params.items() if k not in ["user_id", "session_id"]}
        return f"{endpoint}:{hash(str(sorted(batch_params.items())))}"
    
    async def wait_for_batch_completion(self, batch_key: str, request_id: str) -> Dict[str, Any]:
        """Wait for batch to complete"""
        while True:
            # Check if request is completed
            for request in self.pending_requests[batch_key]:
                if request["request_id"] == request_id and request["completed"]:
                    return request["response"]
            
            # Check if batch should be processed
            if self.should_process_batch(batch_key):
                await self.process_batch(batch_key)
            
            # Wait a bit before checking again
            await asyncio.sleep(0.01)
    
    def should_process_batch(self, batch_key: str) -> bool:
        """Check if batch should be processed"""
        requests = self.pending_requests[batch_key]
        
        # Process if batch is full
        if len(requests) >= self.batch_size:
            return True
        
        # Process if timeout reached
        if requests and (time.time() - requests[0]["timestamp"]) >= self.batch_timeout:
            return True
        
        return False
    
    async def process_batch(self, batch_key: str):
        """Process batch of requests"""
        if self.processing:
            return
        
        self.processing = True
        requests = self.pending_requests[batch_key]
        
        try:
            # Get batch response
            batch_response = await self.get_batch_response(requests)
            
            # Distribute response to all requests
            for request in requests:
                request["response"] = batch_response
                request["completed"] = True
            
            # Clear processed requests
            self.pending_requests[batch_key] = []
            
        except Exception as e:
            print(f"Error processing batch: {e}")
            # Mark all requests as failed
            for request in requests:
                request["response"] = {"error": str(e)}
                request["completed"] = True
        
        finally:
            self.processing = False
    
    async def get_batch_response(self, requests: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get response for batch of requests"""
        # All requests in batch should have similar endpoints
        endpoint = requests[0]["endpoint"]
        
        # Call appropriate batch handler
        if "dashboard" in endpoint:
            return await self.get_batch_dashboard_response(requests)
        elif "personnel" in endpoint:
            return await self.get_batch_personnel_response(requests)
        elif "events" in endpoint:
            return await self.get_batch_events_response(requests)
        else:
            return {"error": "Unsupported batch endpoint"}
    
    async def get_batch_dashboard_response(self, requests: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get batch response for dashboard requests"""
        # Get unique user IDs
        user_ids = list(set(req["params"].get("user_id") for req in requests))
        
        # Get aggregated data for all users
        from app.services.dashboard_aggregation import DashboardAggregationService
        dashboard_service = DashboardAggregationService()
        
        # Process all user requests concurrently
        tasks = [
            dashboard_service.get_aggregated_dashboard_data(user_id, "main")
            for user_id in user_ids
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Create response mapping
        response_map = {}
        for i, user_id in enumerate(user_ids):
            if i < len(results) and not isinstance(results[i], Exception):
                response_map[user_id] = results[i]
            else:
                response_map[user_id] = {"error": "Failed to get dashboard data"}
        
        return {"responses": response_map}
```

### 14.4. Database Connection Pool Optimization

#### 14.4.1. Optimized Database Configuration
```python
# app/core/database_optimized.py
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from app.core.config import settings
import time
import logging

class OptimizedDatabase:
    """Optimized database connection management"""
    
    def __init__(self):
        self.engine = self.create_optimized_engine()
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )
        self.setup_connection_pooling()
        self.setup_query_optimization()
    
    def create_optimized_engine(self):
        """Create optimized database engine"""
        return create_engine(
            settings.DATABASE_URL,
            # Connection pooling
            poolclass=QueuePool,
            pool_size=20,  # Number of connections to keep
            max_overflow=30,  # Additional connections when pool is full
            pool_pre_ping=True,  # Validate connections
            pool_recycle=3600,  # Recycle connections every hour
            
            # Query optimization
            echo=False,  # Disable SQL logging in production
            connect_args={
                "connect_timeout": 10,
                "command_timeout": 30,
                "application_name": "zkteco_pob_system"
            },
            
            # Performance optimization
            isolation_level="READ_COMMITTED",
            executemany_mode="values"
        )
    
    def setup_connection_pooling(self):
        """Setup connection pooling events"""
        @event.listens_for(self.engine, "connect")
        def receive_connect(dbapi_connection, connection_record):
            """Optimize connection on connect"""
            # Set connection parameters
            cursor = dbapi_connection.cursor()
            cursor.execute("SET statement_timeout = '30s'")
            cursor.execute("SET lock_timeout = '10s'")
            cursor.execute("SET idle_in_transaction_session_timeout = '5min'")
            cursor.close()
        
        @event.listens_for(self.engine, "checkout")
        def receive_checkout(dbapi_connection, connection_record, connection_proxy):
            """Log connection checkout"""
            connection_record.info.setdefault('query_start_time', []).append(time.time())
        
        @event.listens_for(self.engine, "checkin")
        def receive_checkin(dbapi_connection, connection_record):
            """Log connection checkin"""
            start_times = connection_record.info.get('query_start_time')
            if start_times:
                connection_record.info['query_start_time'] = start_times[1:]
    
    def setup_query_optimization(self):
        """Setup query optimization"""
        @event.listens_for(self.engine, "before_cursor_execute")
        def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """Log and optimize queries"""
            context._query_start_time = time.time()
            
            # Add query hints for optimization
            if "SELECT" in statement.upper():
                # Add query optimization hints
                if "personnel" in statement.lower():
                    statement += " /*+ INDEX(personnel idx_personnel_active) */"
                elif "time_session" in statement.lower():
                    statement += " /*+ INDEX(time_session idx_time_session_date) */"
                elif "event" in statement.lower():
                    statement += " /*+ INDEX(event idx_event_timestamp) */"
            
            context._query = statement
        
        @event.listens_for(self.engine, "after_cursor_execute")
        def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """Log query performance"""
            total = time.time() - context._query_start_time
            
            # Log slow queries
            if total > 1.0:  # Queries taking more than 1 second
                logging.warning(f"Slow query: {total:.2f}s - {statement[:200]}")
    
    def get_session(self) -> Session:
        """Get database session with optimization"""
        session = self.SessionLocal()
        
        # Set session options
        session.execute("SET LOCAL statement_timeout = '30s'")
        session.execute("SET LOCAL lock_timeout = '10s'")
        
        return session

# Global database instance
optimized_db = OptimizedDatabase()

def get_optimized_db():
    """Get optimized database session"""
    session = optimized_db.get_session()
    try:
        yield session
    finally:
        session.close()
```

### 14.5. Real-time Data Streaming

#### 14.5.1. Real-time Streaming Service
```python
# app/services/realtime_streaming.py
from typing import Dict, Any, List
from fastapi import WebSocket, WebSocketDisconnect
from app.core.event_bus import event_bus
import asyncio
import json
import time

class RealtimeStreamingService:
    """Real-time data streaming service"""
    
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}
        self.user_subscriptions: Dict[str, List[str]] = {}
        self.event_handlers = {}
        self.setup_event_handlers()
    
    def setup_event_handlers(self):
        """Setup event handlers for real-time updates"""
        # Personnel events
        event_bus.subscribe("personnel_created", self.handle_personnel_event)
        event_bus.subscribe("personnel_updated", self.handle_personnel_event)
        event_bus.subscribe("personnel_deleted", self.handle_personnel_event)
        
        # POB events
        event_bus.subscribe("pob_status_changed", self.handle_pob_event)
        event_bus.subscribe("personnel_onboard", self.handle_pob_event)
        event_bus.subscribe("personnel_offboard", self.handle_pob_event)
        
        # Time attendance events
        event_bus.subscribe("clock_in", self.handle_time_attendance_event)
        event_bus.subscribe("clock_out", self.handle_time_attendance_event)
        event_bus.subscribe("break_start", self.handle_time_attendance_event)
        event_bus.subscribe("break_end", self.handle_time_attendance_event)
        
        # Rotation events
        event_bus.subscribe("rotation_assigned", self.handle_rotation_event)
        event_bus.subscribe("rotation_completed", self.handle_rotation_event)
        event_bus.subscribe("rotation_swapped", self.handle_rotation_event)
        
        # Mustering events
        event_bus.subscribe("mustering_started", self.handle_mustering_event)
        event_bus.subscribe("mustering_completed", self.handle_mustering_event)
        event_bus.subscribe("emergency_activated", self.handle_mustering_event)
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Connect WebSocket client"""
        await websocket.accept()
        self.connections[user_id] = websocket
        self.user_subscriptions[user_id] = []
        
        # Send initial data
        await self.send_initial_data(websocket, user_id)
    
    async def disconnect(self, user_id: str):
        """Disconnect WebSocket client"""
        if user_id in self.connections:
            del self.connections[user_id]
        if user_id in self.user_subscriptions:
            del self.user_subscriptions[user_id]
    
    async def subscribe(self, user_id: str, event_types: List[str]):
        """Subscribe user to specific event types"""
        if user_id in self.user_subscriptions:
            self.user_subscriptions[user_id].extend(event_types)
    
    async def unsubscribe(self, user_id: str, event_types: List[str]):
        """Unsubscribe user from specific event types"""
        if user_id in self.user_subscriptions:
            for event_type in event_types:
                if event_type in self.user_subscriptions[user_id]:
                    self.user_subscriptions[user_id].remove(event_type)
    
    async def send_initial_data(self, websocket: WebSocket, user_id: str):
        """Send initial data to connected client"""
        try:
            # Send dashboard summary
            from app.services.dashboard_aggregation import DashboardAggregationService
            dashboard_service = DashboardAggregationService()
            dashboard_data = await dashboard_service.get_aggregated_dashboard_data(int(user_id))
            
            await websocket.send_text(json.dumps({
                "type": "initial_data",
                "data": dashboard_data,
                "timestamp": time.time()
            }))
            
        except Exception as e:
            print(f"Error sending initial data: {e}")
    
    async def handle_personnel_event(self, event: Dict[str, Any]):
        """Handle personnel events"""
        await self.broadcast_event("personnel", event)
    
    async def handle_pob_event(self, event: Dict[str, Any]):
        """Handle POB events"""
        await self.broadcast_event("pob", event)
    
    async def handle_time_attendance_event(self, event: Dict[str, Any]):
        """Handle time attendance events"""
        await self.broadcast_event("time_attendance", event)
    
    async def handle_rotation_event(self, event: Dict[str, Any]):
        """Handle rotation events"""
        await self.broadcast_event("rotation", event)
    
    async def handle_mustering_event(self, event: Dict[str, Any]):
        """Handle mustering events"""
        await self.broadcast_event("mustering", event)
    
    async def broadcast_event(self, event_category: str, event: Dict[str, Any]):
        """Broadcast event to subscribed users"""
        event_type = event.get("type", "")
        
        # Find subscribed users
        for user_id, subscriptions in self.user_subscriptions.items():
            if event_category in subscriptions or event_type in subscriptions or "all" in subscriptions:
                if user_id in self.connections:
                    try:
                        await self.connections[user_id].send_text(json.dumps({
                            "type": "event",
                            "category": event_category,
                            "data": event,
                            "timestamp": time.time()
                        }))
                    except Exception as e:
                        print(f"Error sending event to user {user_id}: {e}")
                        # Remove disconnected user
                        await self.disconnect(user_id)

# Global streaming service
streaming_service = RealtimeStreamingService()
```

### 14.6. Performance Monitoring & Analytics

#### 14.6.1. Performance Monitoring Service
```python
# app/services/performance_monitoring.py
from typing import Dict, Any, List
from collections import defaultdict, deque
import time
import asyncio
from datetime import datetime, timedelta

class PerformanceMonitoringService:
    """Performance monitoring and analytics service"""
    
    def __init__(self):
        self.request_metrics = defaultdict(lambda: deque(maxlen=1000))
        self.endpoint_metrics = defaultdict(lambda: defaultdict(deque))
        self.error_metrics = defaultdict(int)
        self.performance_alerts = []
        self.start_monitoring()
    
    def start_monitoring(self):
        """Start performance monitoring"""
        asyncio.create_task(self.monitoring_loop())
        asyncio.create_task(self.cleanup_loop())
    
    async def monitoring_loop(self):
        """Main monitoring loop"""
        while True:
            try:
                await self.collect_metrics()
                await self.analyze_performance()
                await self.check_alerts()
                await asyncio.sleep(60)  # Check every minute
            except Exception as e:
                print(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)
    
    async def collect_metrics(self):
        """Collect performance metrics"""
        current_time = time.time()
        
        # Collect request metrics
        for endpoint, metrics in self.endpoint_metrics.items():
            if metrics:
                recent_requests = [m for m in metrics if current_time - m["timestamp"] < 300]  # Last 5 minutes
                
                if recent_requests:
                    avg_response_time = sum(m["response_time"] for m in recent_requests) / len(recent_requests)
                    error_rate = sum(1 for m in recent_requests if m["status"] >= 400) / len(recent_requests)
                    
                    self.request_metrics[endpoint].append({
                        "timestamp": current_time,
                        "avg_response_time": avg_response_time,
                        "error_rate": error_rate,
                        "request_count": len(recent_requests)
                    })
    
    async def analyze_performance(self):
        """Analyze performance metrics"""
        current_time = time.time()
        
        for endpoint, metrics in self.request_metrics.items():
            if metrics:
                recent_metrics = [m for m in metrics if current_time - m["timestamp"] < 300]
                
                if recent_metrics:
                    avg_response_time = recent_metrics[-1]["avg_response_time"]
                    error_rate = recent_metrics[-1]["error_rate"]
                    request_count = recent_metrics[-1]["request_count"]
                    
                    # Identify performance issues
                    if avg_response_time > 5.0:  # Slow response
                        await self.create_performance_alert(
                            "SLOW_RESPONSE",
                            endpoint,
                            f"Average response time: {avg_response_time:.2f}s"
                        )
                    
                    if error_rate > 0.1:  # High error rate
                        await self.create_performance_alert(
                            "HIGH_ERROR_RATE",
                            endpoint,
                            f"Error rate: {error_rate:.2%}"
                        )
                    
                    if request_count > 100:  # High traffic
                        await self.create_performance_alert(
                            "HIGH_TRAFFIC",
                            endpoint,
                            f"Request count: {request_count}/5min"
                        )
    
    async def check_alerts(self):
        """Check and send performance alerts"""
        current_time = time.time()
        
        # Clean old alerts
        self.performance_alerts = [
            alert for alert in self.performance_alerts
            if current_time - alert["timestamp"] < 3600  # Keep alerts for 1 hour
        ]
        
        # Send critical alerts
        for alert in self.performance_alerts:
            if alert["severity"] == "CRITICAL" and not alert.get("sent", False):
                await self.send_alert(alert)
                alert["sent"] = True
    
    async def create_performance_alert(self, alert_type: str, endpoint: str, message: str):
        """Create performance alert"""
        alert = {
            "id": f"{alert_type}_{endpoint}_{int(time.time())}",
            "type": alert_type,
            "endpoint": endpoint,
            "message": message,
            "severity": self.get_alert_severity(alert_type),
            "timestamp": time.time(),
            "sent": False
        }
        
        self.performance_alerts.append(alert)
    
    def get_alert_severity(self, alert_type: str) -> str:
        """Get alert severity based on type"""
        severity_map = {
            "SLOW_RESPONSE": "WARNING",
            "HIGH_ERROR_RATE": "CRITICAL",
            "HIGH_TRAFFIC": "INFO",
            "DATABASE_ERROR": "CRITICAL",
            "MEMORY_HIGH": "WARNING",
            "CPU_HIGH": "WARNING"
        }
        return severity_map.get(alert_type, "INFO")
    
    async def send_alert(self, alert: Dict[str, Any]):
        """Send performance alert"""
        # Implementation depends on alert system (email, Slack, etc.)
        print(f"PERFORMANCE ALERT: {alert}")
        
        # Could integrate with notification systems
        # await self.send_email_alert(alert)
        # await self.send_slack_alert(alert)
    
    def record_request(self, endpoint: str, response_time: float, status: int):
        """Record request metrics"""
        self.endpoint_metrics[endpoint].append({
            "timestamp": time.time(),
            "response_time": response_time,
            "status": status
        })
        
        # Record errors
        if status >= 400:
            self.error_metrics[f"{endpoint}_{status}"] += 1
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary"""
        current_time = time.time()
        summary = {}
        
        for endpoint, metrics in self.request_metrics.items():
            recent_metrics = [m for m in metrics if current_time - m["timestamp"] < 3600]  # Last hour
            
            if recent_metrics:
                summary[endpoint] = {
                    "avg_response_time": sum(m["avg_response_time"] for m in recent_metrics) / len(recent_metrics),
                    "max_response_time": max(m["avg_response_time"] for m in recent_metrics),
                    "min_response_time": min(m["avg_response_time"] for m in recent_metrics),
                    "error_rate": sum(m["error_rate"] for m in recent_metrics) / len(recent_metrics),
                    "total_requests": sum(m["request_count"] for m in recent_metrics)
                }
        
        return summary

# Global performance monitor
performance_monitor = PerformanceMonitoringService()
```

### 14.7. Implementation Strategy and Expected Results

#### 14.7.1. Implementation Phases
```python
# Implementation Strategy
IMPLEMENTATION_STRATEGY = {
    "phase_1": {
        "title": "API Gateway Enhancement",
        "duration": "1 week",
        "tasks": [
            "Setup Enhanced API Gateway with rate limiting",
            "Implement request queuing middleware",
            "Add response caching middleware",
            "Setup compression middleware",
            "Configure CORS and security headers"
        ],
        "expected_improvements": {
            "response_time_reduction": "30-50%",
            "error_rate_reduction": "60-80%",
            "throughput_increase": "2-3x"
        }
    },
    
    "phase_2": {
        "title": "Dashboard Optimization",
        "duration": "1 week",
        "tasks": [
            "Implement DashboardAggregationService",
            "Setup intelligent caching for dashboard data",
            "Add concurrent data fetching",
            "Implement request batching",
            "Setup cache warming strategies"
        ],
        "expected_improvements": {
            "dashboard_load_time": "500ms-1s",
            "cache_hit_rate": "80-90%",
            "concurrent_user_support": "500-1000"
        }
    },
    
    "phase_3": {
        "title": "Real-time Streaming",
        "duration": "1 week",
        "tasks": [
            "Setup WebSocket connections",
            "Implement event streaming",
            "Add real-time dashboard updates",
            "Setup subscription management",
            "Add connection monitoring"
        ],
        "expected_improvements": {
            "real_time_updates": "Sub-second",
            "reduced_api_calls": "70-80%",
            "improved_user_experience": "Significant"
        }
    },
    
    "phase_4": {
        "title": "Performance Monitoring",
        "duration": "1 week",
        "tasks": [
            "Setup performance monitoring service",
            "Implement metrics collection",
            "Add performance alerts",
            "Setup performance analytics",
            "Add performance dashboard"
        ],
        "expected_improvements": {
            "proactive_monitoring": "Real-time",
            "performance_visibility": "Complete",
            "issue_detection": "Automated"
        }
    }
}
```

#### 14.7.2. Expected Performance Improvements
```python
# Performance Improvement Projections
PERFORMANCE_IMPROVEMENTS = {
    "before_optimization": {
        "dashboard_load_time": "3-5 seconds",
        "api_response_time": "500-1000ms",
        "database_query_time": "100-500ms",
        "concurrent_users": "50-100",
        "requests_per_second": "50-100",
        "error_rate": "5-10%",
        "system_stability": "Poor"
    },
    
    "after_optimization": {
        "dashboard_load_time": "500ms-1s",
        "api_response_time": "50-200ms",
        "database_query_time": "10-50ms",
        "concurrent_users": "500-1000",
        "requests_per_second": "500-1000",
        "error_rate": "<1%",
        "system_stability": "Excellent"
    },
    
    "improvement_percentages": {
        "response_time_improvement": "80-90%",
        "throughput_increase": "10x",
        "user_capacity_increase": "10x",
        "error_rate_reduction": "90%",
        "resource_efficiency": "70-80%"
    }
}
```

### 14.8. Best Practices and Guidelines

#### 14.8.1. API Design Best Practices
```python
# API Design Best Practices
API_DESIGN_BEST_PRACTICES = {
    "rate_limiting": {
        "description": "Implement per-endpoint rate limiting",
        "implementation": "Use RateLimiter middleware with different limits per endpoint type",
        "benefits": "Prevents API abuse and ensures fair resource usage"
    },
    
    "caching": {
        "description": "Cache frequently accessed data",
        "implementation": "Multi-level caching with intelligent invalidation",
        "benefits": "Reduces database load and improves response times"
    },
    
    "batching": {
        "description": "Batch similar requests together",
        "implementation": "RequestBatchingService with automatic batching",
        "benefits": "Reduces API calls and improves efficiency"
    },
    
    "compression": {
        "description": "Compress large responses",
        "implementation": "GZip middleware for response compression",
        "benefits": "Reduces bandwidth usage and improves load times"
    },
    
    "monitoring": {
        "description": "Monitor all API performance metrics",
        "implementation": "PerformanceMonitoringService with real-time alerts",
        "benefits": "Proactive issue detection and performance optimization"
    }
}
```

#### 14.8.2. Database Optimization Best Practices
```python
# Database Optimization Best Practices
DATABASE_OPTIMIZATION_BEST_PRACTICES = {
    "connection_pooling": {
        "description": "Use connection pooling",
        "implementation": "QueuePool with 20 base connections, 30 overflow",
        "benefits": "Reduces connection overhead and improves performance"
    },
    
    "query_optimization": {
        "description": "Optimize slow queries",
        "implementation": "Query hints, proper indexing, query analysis",
        "benefits": "Reduces query execution time significantly"
    },
    
    "indexing": {
        "description": "Properly index database tables",
        "implementation": "Strategic indexes on frequently queried columns",
        "benefits": "Improves query performance dramatically"
    },
    
    "caching": {
        "description": "Cache database query results",
        "implementation": "Multi-level caching with appropriate TTL",
        "benefits": "Reduces database load and improves response times"
    },
    
    "monitoring": {
        "description": "Monitor database performance",
        "implementation": "Query logging, performance metrics, alerting",
        "benefits": "Identifies and resolves performance issues proactively"
    }
}
```

#### 14.8.3. Caching Strategy Best Practices
```python
# Caching Strategy Best Practices
CACHING_BEST_PRACTICES = {
    "multi_level": {
        "description": "Use multiple cache levels",
        "implementation": "Memory cache + Redis cache + CDN cache",
        "benefits": "Optimal performance across different data types"
    },
    
    "cache_warming": {
        "description": "Warm cache with predictable data",
        "implementation": "Background tasks to pre-populate cache",
        "benefits": "Eliminates cold cache performance issues"
    },
    
    "cache_invalidation": {
        "description": "Invalidate cache appropriately",
        "implementation": "Event-driven cache invalidation",
        "benefits": "Ensures data consistency while maintaining performance"
    },
    
    "cache_monitoring": {
        "description": "Monitor cache hit rates",
        "implementation": "Cache metrics collection and analysis",
        "benefits": "Optimizes cache strategy based on usage patterns"
    },
    
    "cache_optimization": {
        "description": "Optimize cache keys and TTL",
        "implementation": "Intelligent cache key generation and TTL management",
        "benefits": "Improves cache efficiency and reduces memory usage"
    }
}
```

### Success Factors
- **Phased Implementation**: Gradual migration minimizes disruption
- **Data Integrity**: Comprehensive validation and backup strategies
- **Performance Optimization**: Efficient synchronization and caching
- **Security Focus**: Robust authentication and data protection
- **Maintenance Planning**: Ongoing monitoring and automated maintenance

This documentation serves as a reference for the development team, system administrators, and stakeholders involved in the ZKTeco standalone POB system project.
