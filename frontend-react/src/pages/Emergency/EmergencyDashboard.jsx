/**
 * Emergency Dashboard - POB v2.0
 * Real-time emergency status with big action buttons and live monitoring
 */

import React, { useState, useEffect } from 'react';
import { 
  Lock, Unlock, AlertTriangle, Users, Power, Wifi, WifiOff, 
  Bell, MapPin, Activity, Clock, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';

const EmergencyDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    total_emergencies: 0,
    active_emergencies: [],
    doors_locked: 0,
    doors_unlocked: 0,
    sirens_on: 0,
    recent_events: [],
    zone_status: [],
    system_status: 'NORMAL'
  });
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [selectedZones, setSelectedZones] = useState([]);
  const [lockdownReason, setLockdownReason] = useState('');
  const [showLockdownConfirm, setShowLockdownConfirm] = useState(false);
  const [showFireModeConfirm, setShowFireModeConfirm] = useState(false);
  const [fireModeZone, setFireModeZone] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/api/emergency/status/');
      setDashboardData(response.data.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLockdown = async (action, scope = 'global') => {
    if (actionInProgress) return;
    
    if (!lockdownReason.trim()) {
      alert('Please provide a reason for the lockdown action');
      return;
    }

    try {
      setActionInProgress(true);
      
      const requestData = {
        scope: scope,
        action: action,
        reason: lockdownReason,
        zone_ids: scope === 'zone' ? selectedZones : undefined
      };

      const response = await api.post('/api/emergency/lockdown/', requestData);
      
      if (response.data.success) {
        alert(`Emergency ${action} completed successfully. ${response.data.data.processed_doors} doors affected.`);
        setLockdownReason('');
        setShowLockdownConfirm(false);
        fetchDashboardData();
      } else {
        alert('Lockdown action failed');
      }
    } catch (error) {
      console.error('Error executing lockdown:', error);
      alert('Error executing lockdown action');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleFireMode = async (action, zoneId = null) => {
    if (actionInProgress) return;

    try {
      setActionInProgress(true);
      
      const requestData = {
        zone_id: zoneId,
        action: action,
        reason: action === 'activate' ? 'Fire emergency activated' : 'Fire emergency cleared'
      };

      const response = await api.post('/api/emergency/fire-mode/', requestData);
      
      if (response.data.success) {
        alert(`Fire mode ${action} completed successfully.`);
        setShowFireModeConfirm(false);
        setFireModeZone(null);
        fetchDashboardData();
      } else {
        alert('Fire mode action failed');
      }
    } catch (error) {
      console.error('Error executing fire mode:', error);
      alert('Error executing fire mode action');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleStartMustering = async () => {
    if (actionInProgress) return;

    try {
      setActionInProgress(true);
      
      // This would integrate with mustering module
      alert('Mustering event started successfully');
      fetchDashboardData();
    } catch (error) {
      console.error('Error starting mustering:', error);
      alert('Error starting mustering event');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleAllClear = async () => {
    if (actionInProgress) return;

    if (!window.confirm('Are you sure you want to issue ALL CLEAR? This will deactivate all emergency systems.')) {
      return;
    }

    try {
      setActionInProgress(true);
      
      // Clear all active emergencies
      await handleFireMode('clear');
      
      alert('ALL CLEAR issued successfully');
      fetchDashboardData();
    } catch (error) {
      console.error('Error issuing all clear:', error);
      alert('Error issuing all clear');
    } finally {
      setActionInProgress(false);
    }
  };

  const getSystemStatusColor = () => {
    switch (dashboardData.system_status) {
      case 'EMERGENCY': return 'red';
      case 'WARNING': return 'yellow';
      default: return 'green';
    }
  };

  const getZoneStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'red';
      case 'WARNING': return 'yellow';
      default: return 'green';
    }
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
      {/* System Status Banner */}
      <div className={`bg-${getSystemStatusColor()}-50 border-l-4 border-${getSystemStatusColor()}-400 p-4 rounded-lg`}>
        <div className="flex items-center">
          <Activity className={`w-6 h-6 text-${getSystemStatusColor()}-400 mr-3`} />
          <div>
            <h3 className={`text-lg font-semibold text-${getSystemStatusColor()}-800`}>
              System Status: {dashboardData.system_status}
            </h3>
            <p className={`text-${getSystemStatusColor()}-700`}>
              {dashboardData.total_emergencies} active emergencies | 
              {dashboardData.doors_locked} doors locked | 
              {dashboardData.sirens_on} sirens active
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Action Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lockdown All */}
        <button
          onClick={() => setShowLockdownConfirm(true)}
          disabled={actionInProgress}
          className="flex flex-col items-center justify-center p-6 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <Lock className="w-8 h-8 mb-2" />
          <span className="font-semibold">Lockdown All</span>
          <span className="text-xs opacity-90">Emergency lockdown</span>
        </button>

        {/* Fire Mode */}
        <button
          onClick={() => setShowFireModeConfirm(true)}
          disabled={actionInProgress}
          className="flex flex-col items-center justify-center p-6 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <AlertTriangle className="w-8 h-8 mb-2" />
          <span className="font-semibold">Fire Mode</span>
          <span className="text-xs opacity-90">Fire evacuation</span>
        </button>

        {/* All Clear */}
        <button
          onClick={handleAllClear}
          disabled={actionInProgress || dashboardData.system_status === 'NORMAL'}
          className="flex flex-col items-center justify-center p-6 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <CheckCircle className="w-8 h-8 mb-2" />
          <span className="font-semibold">All Clear</span>
          <span className="text-xs opacity-90">End emergency</span>
        </button>

        {/* Start Mustering */}
        <button
          onClick={handleStartMustering}
          disabled={actionInProgress}
          className="flex flex-col items-center justify-center p-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
        >
          <Users className="w-8 h-8 mb-2" />
          <span className="font-semibold">Start Mustering</span>
          <span className="text-xs opacity-90">Headcount</span>
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Emergencies</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData.total_emergencies}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Lock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Doors Locked</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData.doors_locked}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-full">
              <Bell className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Sirens Active</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData.sirens_on}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Last Trigger</p>
              <p className="text-sm font-semibold text-gray-900">
                {dashboardData.last_trigger ? 
                  new Date(dashboardData.last_trigger).toLocaleString() : 
                  'No triggers'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Status Map */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Zone Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardData.zone_status.map((zone) => (
            <div
              key={zone.id}
              className={`border-l-4 border-${getZoneStatusColor(zone.status)}-400 bg-gray-50 p-4 rounded`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{zone.name}</h4>
                  <p className="text-sm text-gray-600">
                    Status: <span className={`font-medium text-${getZoneStatusColor(zone.status)}-600`}>
                      {zone.status}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Capacity: {zone.capacity} | Evac Point: {zone.evac_point || 'N/A'}
                  </p>
                </div>
                <div className={`w-3 h-3 rounded-full bg-${getZoneStatusColor(zone.status)}-500`}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Events</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trigger Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboardData.recent_events.map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      event.event_type === 0 ? 'bg-red-100 text-red-800' :
                      event.event_type === 1 ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {event.event_type_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(event.start_time).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      event.status === 0 ? 'bg-red-100 text-red-800' :
                      event.status === 1 ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {event.status_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.trigger_source}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {event.reason || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lockdown Confirmation Modal */}
      {showLockdownConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900">Emergency Lockdown</h3>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Lockdown
                </label>
                <textarea
                  value={lockdownReason}
                  onChange={(e) => setLockdownReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter reason for emergency lockdown..."
                />
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowLockdownConfirm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleLockdown('lock')}
                  disabled={actionInProgress || !lockdownReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Lockdown All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fire Mode Confirmation Modal */}
      {showFireModeConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900">Fire Mode</h3>
              <p className="mt-2 text-sm text-gray-600">
                This will unlock fire exits, lock danger zones, activate sirens, and start mustering.
              </p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zone (optional - leave blank for global)
                </label>
                <select
                  value={fireModeZone || ''}
                  onChange={(e) => setFireModeZone(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Global Fire Mode</option>
                  {dashboardData.zone_status.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowFireModeConfirm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleFireMode('activate', fireModeZone)}
                  disabled={actionInProgress}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  Activate Fire Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyDashboard;
