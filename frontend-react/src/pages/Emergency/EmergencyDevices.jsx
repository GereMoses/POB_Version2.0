/**
 * Emergency Devices - POB v2.0
 * Siren and strobe control with device management and testing
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, Wifi, WifiOff, Power, Activity, TestTube, Settings,
  MapPin, AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw,
  ToggleLeft, ToggleRight, Search, Filter
} from 'lucide-react';
import { api } from '../../services/api';

const EmergencyDevices = () => {
  const [devices, setDevices] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [devicesRes, zonesRes] = await Promise.all([
        api.get('/api/emergency/devices/'),
        api.get('/api/v1/zones/')
      ]);
      
      setDevices(devicesRes.data.data || []);
      setZones(zonesRes.data.data || []);
    } catch (error) {
      console.error('Error fetching device data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDevice = async (deviceId, currentStatus) => {
    if (actionInProgress) return;

    const newStatus = currentStatus === 1 ? 0 : 1; // Toggle between ON and OFF
    const action = newStatus === 1 ? 'activate' : 'deactivate';

    if (!window.confirm(`Are you sure you want to ${action} this device?`)) {
      return;
    }

    try {
      setActionInProgress(true);
      
      const response = await api.post(`/api/emergency/devices/${deviceId}/toggle/`, {
        status: newStatus
      });
      
      if (response.data.success) {
        alert(`Device ${action}d successfully`);
        fetchData(); // Refresh data
      } else {
        alert('Failed to toggle device');
      }
    } catch (error) {
      console.error('Error toggling device:', error);
      alert('Error toggling device');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleTestAllDevices = async () => {
    if (actionInProgress) return;

    if (!window.confirm('Are you sure you want to test all emergency devices? This will activate all sirens and strobes briefly.')) {
      return;
    }

    try {
      setActionInProgress(true);
      
      const response = await api.post('/api/emergency/devices/test-all/');
      
      if (response.data.success) {
        const result = response.data.data;
        alert(
          `Device test completed:\n` +
          `Total devices: ${result.total_devices}\n` +
          `Successful tests: ${result.successful_tests}\n` +
          `Failed tests: ${result.failed_tests}`
        );
        fetchData(); // Refresh data
      } else {
        alert('Failed to test devices');
      }
    } catch (error) {
      console.error('Error testing devices:', error);
      alert('Error testing devices');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedDevices.length === filteredDevices.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(filteredDevices.map(d => d.id));
    }
  };

  const handleDeviceSelection = (deviceId) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const handleBulkAction = async (action) => {
    if (actionInProgress || selectedDevices.length === 0) return;

    if (!window.confirm(`Are you sure you want to ${action} ${selectedDevices.length} selected devices?`)) {
      return;
    }

    try {
      setActionInProgress(true);
      let successCount = 0;
      let failCount = 0;

      for (const deviceId of selectedDevices) {
        try {
          const device = devices.find(d => d.id === deviceId);
          const newStatus = action === 'activate' ? 1 : 0;
          
          const response = await api.post(`/api/emergency/devices/${deviceId}/toggle/`, {
            status: newStatus
          });
          
          if (response.data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      alert(
        `Bulk ${action} completed:\n` +
        `Successful: ${successCount}\n` +
        `Failed: ${failCount}`
      );

      setSelectedDevices([]);
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error in bulk action:', error);
      alert('Error in bulk action');
    } finally {
      setActionInProgress(false);
    }
  };

  const getDeviceTypeIcon = (deviceType) => {
    const icons = {
      1: Bell,      // Siren
      2: Activity,  // Strobe
      3: Lock,      // Lock
      4: Settings,  // Speaker
      5: AlertTriangle // Panic Button
    };
    return icons[deviceType] || Bell;
  };

  const getDeviceTypeName = (deviceType) => {
    const names = {
      1: 'Siren',
      2: 'Strobe',
      3: 'Lock',
      4: 'Speaker',
      5: 'Panic Button'
    };
    return names[deviceType] || 'Unknown';
  };

  const getStatusColor = (status) => {
    const colors = {
      0: 'gray',    // OFF
      1: 'green',   // ON
      2: 'red'      // FAULT
    };
    return colors[status] || 'gray';
  };

  const getStatusName = (status) => {
    const names = {
      0: 'OFF',
      1: 'ON',
      2: 'FAULT'
    };
    return names[status] || 'UNKNOWN';
  };

  const getLastHeartbeatColor = (lastHeartbeat) => {
    if (!lastHeartbeat) return 'red';
    
    const now = new Date();
    const heartbeat = new Date(lastHeartbeat);
    const diffMinutes = (now - heartbeat) / (1000 * 60);
    
    if (diffMinutes < 5) return 'green';
    if (diffMinutes < 15) return 'yellow';
    return 'red';
  };

  const getLastHeartbeatText = (lastHeartbeat) => {
    if (!lastHeartbeat) return 'Never';
    
    const now = new Date();
    const heartbeat = new Date(lastHeartbeat);
    const diffMinutes = Math.floor((now - heartbeat) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    return heartbeat.toLocaleDateString();
  };

  // Filter devices
  const filteredDevices = devices.filter(device => {
    const matchesSearch = !searchTerm || 
      device.terminal_sn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.location_description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesZone = !filterZone || device.zone_id === parseInt(filterZone);
    const matchesType = !filterType || device.device_type === parseInt(filterType);
    const matchesStatus = !filterStatus || device.status === parseInt(filterStatus);
    
    return matchesSearch && matchesZone && matchesType && matchesStatus;
  });

  // Device statistics
  const deviceStats = {
    total: devices.length,
    online: devices.filter(d => d.status === 1).length,
    offline: devices.filter(d => d.status === 0).length,
    fault: devices.filter(d => d.status === 2).length,
    sirens: devices.filter(d => d.device_type === 1).length,
    strobes: devices.filter(d => d.device_type === 2).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Device Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-full">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-xl font-semibold text-gray-900">{deviceStats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-full">
              <Wifi className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Online</p>
              <p className="text-xl font-semibold text-gray-900">{deviceStats.online}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-full">
              <WifiOff className="w-6 h-6 text-gray-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Offline</p>
              <p className="text-xl font-semibold text-gray-900">{deviceStats.offline}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Fault</p>
              <p className="text-xl font-semibold text-gray-900">{deviceStats.fault}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-full">
              <Bell className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Sirens</p>
              <p className="text-xl font-semibold text-gray-900">{deviceStats.sirens}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-full">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Strobes</p>
              <p className="text-xl font-semibold text-gray-900">{deviceStats.strobes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search devices..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filters */}
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Zones</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="1">Sirens</option>
              <option value="2">Strobes</option>
              <option value="3">Locks</option>
              <option value="4">Speakers</option>
              <option value="5">Panic Buttons</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="0">OFF</option>
              <option value="1">ON</option>
              <option value="2">FAULT</option>
            </select>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleTestAllDevices}
              disabled={actionInProgress}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center"
            >
              <TestTube className="w-4 h-4 mr-2" />
              Test All
            </button>
            
            <button
              onClick={() => fetchData()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Device List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Emergency Devices</h3>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Selected: {selectedDevices.length} of {filteredDevices.length}
              </span>
              <button
                onClick={handleSelectAll}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                {selectedDevices.length === filteredDevices.length ? 'Deselect All' : 'Select All'}
              </button>
              
              {selectedDevices.length > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleBulkAction('activate')}
                    disabled={actionInProgress}
                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    Activate Selected
                  </button>
                  <button
                    onClick={() => handleBulkAction('deactivate')}
                    disabled={actionInProgress}
                    className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 text-sm"
                  >
                    Deactivate Selected
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedDevices.length === filteredDevices.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Heartbeat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Test Schedule
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDevices.map((device) => {
                const Icon = getDeviceTypeIcon(device.device_type);
                const isSelected = selectedDevices.includes(device.id);
                const heartbeatColor = getLastHeartbeatColor(device.last_heartbeat);
                
                return (
                  <tr 
                    key={device.id} 
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleDeviceSelection(device.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Icon className="w-5 h-5 mr-2 text-gray-600" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{device.terminal_sn}</div>
                          <div className="text-sm text-gray-500">ID: {device.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getDeviceTypeName(device.device_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {zones.find(z => z.id === device.zone_id)?.name || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(device.status)}-100 text-${getStatusColor(device.status)}-800`}>
                          {getStatusName(device.status)}
                        </span>
                        {device.status === 1 && (
                          <div className="w-2 h-2 rounded-full bg-green-500 ml-2 animate-pulse"></div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full bg-${heartbeatColor}-500 mr-2`}></div>
                        <span className={`text-sm ${heartbeatColor === 'green' ? 'text-green-600' : heartbeatColor === 'yellow' ? 'text-yellow-600' : 'text-red-600'}`}>
                          {getLastHeartbeatText(device.last_heartbeat)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {device.location_description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {device.test_schedule || 'None'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleToggleDevice(device.id, device.status)}
                        disabled={actionInProgress || device.status === 2}
                        className={`p-2 rounded-md transition-colors duration-200 ${
                          device.status === 2 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : device.status === 1
                              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                        }`}
                      >
                        {device.status === 1 ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmergencyDevices;
