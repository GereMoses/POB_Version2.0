/**
 * Emergency Management Main Component - POB v2.0
 * Complete emergency system with 8 tabs and real-time monitoring
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Bell, MapPin, Users, Settings, FileText, 
  Activity, Wifi, WifiOff, Lock, Unlock, Shield, CheckCircle
} from 'lucide-react';
import EmergencyDashboard from './EmergencyDashboard';
import EmergencyLockdown from './EmergencyLockdown';
import EmergencyFireMode from './EmergencyFireMode';
import EmergencyNotifications from './EmergencyNotifications';
import EmergencyDevices from './EmergencyDevices';
import EmergencyTriggers from './EmergencyTriggers';
import EmergencyPlans from './EmergencyPlans';
import EmergencyAudit from './EmergencyAudit';

const EmergencyMain = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemStatus, setSystemStatus] = useState('NORMAL');
  const [activeEmergencies, setActiveEmergencies] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Tab definitions
  const tabs = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: Activity,
      component: EmergencyDashboard,
      description: 'Live status and quick actions'
    },
    {
      id: 'lockdown',
      name: 'Lockdown',
      icon: Lock,
      component: EmergencyLockdown,
      description: 'Zone and global lockdown control'
    },
    {
      id: 'fire-mode',
      name: 'Fire Mode',
      icon: AlertTriangle,
      component: EmergencyFireMode,
      description: 'Fire evacuation and response'
    },
    {
      id: 'notifications',
      name: 'Notifications',
      icon: Bell,
      component: EmergencyNotifications,
      description: 'Mass notification system'
    },
    {
      id: 'devices',
      name: 'Devices',
      icon: Wifi,
      component: EmergencyDevices,
      description: 'Siren and device control'
    },
    {
      id: 'triggers',
      name: 'Triggers',
      icon: Shield,
      component: EmergencyTriggers,
      description: 'Panic buttons and automation'
    },
    {
      id: 'plans',
      name: 'Plans',
      icon: FileText,
      component: EmergencyPlans,
      description: 'Emergency procedures'
    },
    {
      id: 'audit',
      name: 'Audit Trail',
      icon: Settings,
      component: EmergencyAudit,
      description: 'Event history and logs'
    }
  ];

  useEffect(() => {
    // Initialize WebSocket connection
    initializeWebSocket();
    
    // Fetch initial status
    fetchSystemStatus();
    
    // Set up status refresh interval
    const statusInterval = setInterval(fetchSystemStatus, 30000);
    
    return () => {
      clearInterval(statusInterval);
      if (window.emergencyWs) {
        window.emergencyWs.close();
      }
    };
  }, []);

  const initializeWebSocket = () => {
    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/emergency/ws/emergency/`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setWsConnected(true);
        console.log('Emergency WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        setWsConnected(false);
        console.log('Emergency WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(initializeWebSocket, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('Emergency WebSocket error:', error);
        setWsConnected(false);
      };
      
      window.emergencyWs = ws;
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      setWsConnected(false);
    }
  };

  const handleWebSocketMessage = (data) => {
    setLastUpdate(new Date());
    
    switch (data.type) {
      case 'emergency_event':
        handleEmergencyEventUpdate(data.data);
        break;
      case 'lockdown_update':
        handleLockdownUpdate(data.data);
        break;
      case 'fire_mode_update':
        handleFireModeUpdate(data.data);
        break;
      case 'device_status':
        handleDeviceStatusUpdate(data.data);
        break;
      case 'system_status':
        handleSystemStatusUpdate(data.data);
        break;
      case 'ping':
        // Respond to ping
        if (window.emergencyWs && window.emergencyWs.readyState === WebSocket.OPEN) {
          window.emergencyWs.send(JSON.stringify({ type: 'pong' }));
        }
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  const handleEmergencyEventUpdate = (eventData) => {
    // Update active emergencies count
    if (eventData.status === 'ACTIVE') {
      setActiveEmergencies(prev => prev + 1);
    } else {
      setActiveEmergencies(prev => Math.max(0, prev - 1));
    }
    
    // Update system status
    if (eventData.status === 'ACTIVE') {
      setSystemStatus('EMERGENCY');
    }
  };

  const handleLockdownUpdate = (lockdownData) => {
    // Handle lockdown updates
    console.log('Lockdown update:', lockdownData);
  };

  const handleFireModeUpdate = (fireData) => {
    // Handle fire mode updates
    console.log('Fire mode update:', fireData);
  };

  const handleDeviceStatusUpdate = (deviceData) => {
    // Handle device status updates
    console.log('Device status update:', deviceData);
  };

  const handleSystemStatusUpdate = (statusData) => {
    setSystemStatus(statusData.status || 'NORMAL');
    setActiveEmergencies(statusData.active_emergencies || 0);
  };

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/emergency/status/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSystemStatus(data.data.system_status || 'NORMAL');
          setActiveEmergencies(data.data.total_emergencies || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  const getSystemStatusColor = () => {
    switch (systemStatus) {
      case 'EMERGENCY': return 'red';
      case 'WARNING': return 'yellow';
      default: return 'green';
    }
  };

  const renderActiveComponent = () => {
    const activeTabData = tabs.find(tab => tab.id === activeTab);
    if (!activeTabData) return null;
    
    const Component = activeTabData.component;
    return <Component />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <AlertTriangle className={`w-8 h-8 mr-3 text-${getSystemStatusColor()}-600`} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Emergency Management</h1>
                <p className="text-sm text-gray-600">Real-time emergency response and control</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* System Status */}
              <div className={`flex items-center px-3 py-2 rounded-full bg-${getSystemStatusColor()}-100 text-${getSystemStatusColor()}-800`}>
                <div className={`w-2 h-2 rounded-full bg-${getSystemStatusColor()}-500 mr-2 animate-pulse`}></div>
                <span className="font-medium">{systemStatus}</span>
              </div>
              
              {/* Active Emergencies */}
              {activeEmergencies > 0 && (
                <div className="flex items-center px-3 py-2 rounded-full bg-red-100 text-red-800">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  <span className="font-medium">{activeEmergencies} Active</span>
                </div>
              )}
              
              {/* WebSocket Status */}
              <div className="flex items-center">
                {wsConnected ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
              </div>
              
              {/* Last Update */}
              <div className="text-sm text-gray-600">
                Last: {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative min-w-0 flex-1 overflow-hidden bg-white py-4 px-1 text-center text-sm font-medium hover:bg-gray-50 focus:z-10 ${
                    isActive
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Icon className="w-5 h-5" />
                    <span className="truncate">{tab.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{tab.description}</p>
                  
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Emergency Alert Banner */}
        {systemStatus === 'EMERGENCY' && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-red-400 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-red-800">
                  EMERGENCY SYSTEM ACTIVE
                </h3>
                <p className="text-red-700">
                  {activeEmergencies} emergency events currently active. Monitor all tabs for real-time updates.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow">
          {renderActiveComponent()}
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Emergency Management System v2.0</span>
              <span>•</span>
              <span>Status: {systemStatus}</span>
              {activeEmergencies > 0 && (
                <>
                  <span>•</span>
                  <span className="text-red-600 font-medium">{activeEmergencies} Active Emergencies</span>
                </>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span>WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}</span>
              <span>•</span>
              <span>Last Update: {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyMain;
