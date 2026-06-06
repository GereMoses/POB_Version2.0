/**
 * Emergency Fire Mode - POB v2.0
 * Fire evacuation system with door control, sirens, and mustering integration
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle, XCircle, Bell, Users, MapPin, 
  DoorOpen, Lock, Wifi, WifiOff, Flame, Shield, Activity
} from 'lucide-react';
import { api } from '../../services/api';

const EmergencyFireMode = () => {
  const [zones, setZones] = useState([]);
  const [activeFireMode, setActiveFireMode] = useState(null);
  const [fireModeHistory, setFireModeHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [selectedZone, setSelectedZone] = useState('');
  const [fireModeReason, setFireModeReason] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [zonesRes, historyRes] = await Promise.all([
        api.get('/api/v1/zones/'),
        api.get('/api/emergency/audit/?event_type=1&limit=10') // Fire events
      ]);
      
      setZones(zonesRes.data.data || []);
      setFireModeHistory(historyRes.data.data || []);
      
      // Check for active fire mode
      const activeFireEvents = historyRes.data.data?.filter(event => 
        event.status_name === 'ACTIVE' && event.event_type_name === 'FIRE'
      ) || [];
      setActiveFireMode(activeFireEvents.length > 0 ? activeFireEvents[0] : null);
      
    } catch (error) {
      console.error('Error fetching fire mode data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFireModeAction = (action, zoneId = null) => {
    if (actionInProgress) return;
    
    if (action === 'activate' && !fireModeReason.trim()) {
      alert('Please provide a reason for activating fire mode');
      return;
    }

    setPendingAction({ action, zoneId });
    setShowConfirmModal(true);
  };

  const executeFireMode = async () => {
    if (!pendingAction) return;

    try {
      setActionInProgress(true);
      
      const requestData = {
        zone_id: pendingAction.zoneId,
        action: pendingAction.action,
        reason: pendingAction.action === 'activate' ? fireModeReason : 'Fire emergency cleared'
      };

      const response = await api.post('/api/emergency/fire-mode/', requestData);
      
      if (response.data.success) {
        const result = response.data.data;
        
        alert(
          `Fire mode ${pendingAction.action} completed successfully.\n` +
          `Unlocked doors: ${result.results.unlocked_doors}\n` +
          `Locked doors: ${result.results.locked_doors}\n` +
          `Sirens activated: ${result.results.sirens_activated}\n` +
          `Mustering started: ${result.results.mustering_started ? 'Yes' : 'No'}\n` +
          `Notifications sent: ${result.results.notifications_sent}`
        );
        
        // Reset form
        setFireModeReason('');
        setSelectedZone('');
        setShowConfirmModal(false);
        setPendingAction(null);
        
        // Refresh data
        fetchData();
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

  const getFireModeActions = (event) => {
    const actions = event.actions || [];
    return {
      unlockedDoors: actions.find(a => a.type === 'unlock_fire_exits')?.count || 0,
      lockedDoors: actions.find(a => a.type === 'lock_danger_zones')?.count || 0,
      sirensActivated: actions.find(a => a.type === 'siren_activation')?.count || 0,
      musteringStarted: actions.some(a => a.type === 'start_mustering'),
      notificationsSent: 0 // Would be calculated from notifications
    };
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
      {/* Active Fire Mode Alert */}
      {activeFireMode && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
          <div className="flex items-center">
            <Flame className="w-6 h-6 text-red-400 mr-3 animate-pulse" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800">
                FIRE MODE ACTIVE
              </h3>
              <p className="text-red-700">
                Started: {new Date(activeFireMode.start_time).toLocaleString()} | 
                Zone: {zones.find(z => z.id === activeFireMode.zone_ids?.[0])?.name || 'Global'} | 
                Actions: {getFireModeActions(activeFireMode).unlockedDoors} unlocked, {getFireModeActions(activeFireMode).sirensActivated} sirens
              </p>
            </div>
            <button
              onClick={() => handleFireModeAction('clear')}
              disabled={actionInProgress}
              className="ml-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Clear Fire Mode
            </button>
          </div>
        </div>
      )}

      {/* Fire Mode Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fire Mode Control</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Activate Fire Mode */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Activate Fire Mode</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zone (optional - leave blank for global)
              </label>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Global Fire Mode</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Activation
              </label>
              <textarea
                value={fireModeReason}
                onChange={(e) => setFireModeReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Enter reason for fire mode activation..."
              />
            </div>
            
            <button
              onClick={() => handleFireModeAction('activate', selectedZone ? parseInt(selectedZone) : null)}
              disabled={actionInProgress || !!activeFireMode}
              className="w-full px-4 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {actionInProgress ? 'Processing...' : 'Activate Fire Mode'}
            </button>
          </div>
          
          {/* Fire Mode Actions Preview */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Actions When Activated</h4>
            
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded">
                <DoorOpen className="w-5 h-5 text-green-600 mr-3" />
                <div>
                  <p className="font-medium text-green-800">Unlock Fire Exits</p>
                  <p className="text-sm text-green-700">All doors with emergency action = UNLOCK</p>
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded">
                <Lock className="w-5 h-5 text-red-600 mr-3" />
                <div>
                  <p className="font-medium text-red-800">Lock Danger Zones</p>
                  <p className="text-sm text-red-700">All doors with emergency action = LOCK</p>
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-orange-50 border border-orange-200 rounded">
                <Bell className="w-5 h-5 text-orange-600 mr-3" />
                <div>
                  <p className="font-medium text-orange-800">Activate Sirens/Strobes</p>
                  <p className="text-sm text-orange-700">All emergency devices in affected zones</p>
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded">
                <Users className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <p className="font-medium text-blue-800">Start Mustering</p>
                  <p className="text-sm text-blue-700">Automatic mustering event creation</p>
                </div>
              </div>
              
              <div className="flex items-center p-3 bg-purple-50 border border-purple-200 rounded">
                <Shield className="w-5 h-5 text-purple-600 mr-3" />
                <div>
                  <p className="font-medium text-purple-800">Send Notifications</p>
                  <p className="text-sm text-purple-700">SMS, Email, PA, and Siren alerts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Zone Fire Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => {
            const isAffected = activeFireMode && (!activeFireMode.zone_ids?.length || activeFireMode.zone_ids.includes(zone.id));
            
            return (
              <div
                key={zone.id}
                className={`border-l-4 ${
                  isAffected ? 'border-orange-400 bg-orange-50' : 'border-green-400 bg-green-50'
                } p-4 rounded`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{zone.name}</h4>
                    <p className="text-sm text-gray-600">
                      Status: <span className={`font-medium ${
                        isAffected ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {isAffected ? 'EVACUATION' : 'SAFE'}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Capacity: {zone.capacity} | Evac Point: {zone.evac_point || 'N/A'}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    isAffected ? 'bg-orange-500 animate-pulse' : 'bg-green-500'
                  }`}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fire Mode History */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fire Mode History</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions Executed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fireModeHistory.map((event) => {
                const actions = getFireModeActions(event);
                const duration = event.end_time ? 
                  new Date(event.end_time) - new Date(event.start_time) : 
                  Date.now() - new Date(event.start_time);
                
                return (
                  <tr key={event.event_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(event.start_time).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        event.status_name === 'ACTIVE' ? 'bg-orange-100 text-orange-800' : 
                        event.status_name === 'RESOLVED' ? 'bg-green-100 text-green-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {event.status_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {zones.find(z => z.id === event.zone_ids?.[0])?.name || 'Global'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <DoorOpen className="w-4 h-4 mr-1 text-green-500" />
                          {actions.unlockedDoors} unlocked
                        </div>
                        <div className="flex items-center">
                          <Lock className="w-4 h-4 mr-1 text-red-500" />
                          {actions.lockedDoors} locked
                        </div>
                        <div className="flex items-center">
                          <Bell className="w-4 h-4 mr-1 text-orange-500" />
                          {actions.sirensActivated} sirens
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {event.status_name === 'ACTIVE' ? (
                          <Activity className="w-4 h-4 text-orange-500 mr-1" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                        )}
                        <span className={`text-sm font-medium ${
                          event.status_name === 'ACTIVE' ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {event.status_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.floor(duration / 60000)}m {Math.floor((duration % 60000) / 1000)}s
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900">
                Confirm Fire Mode {pendingAction?.action?.toUpperCase()}
              </h3>
              
              {pendingAction?.action === 'activate' && (
                <div className="mt-4">
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                    <div className="flex">
                      <Flame className="w-5 h-5 text-orange-400 mr-2" />
                      <div className="text-sm text-orange-800">
                        <p className="font-medium">Fire mode will execute these actions:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Unlock all fire exit doors</li>
                          <li>Lock all danger zone doors</li>
                          <li>Activate sirens and strobes</li>
                          <li>Start automatic mustering</li>
                          <li>Send emergency notifications</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {pendingAction?.action === 'clear' && (
                <div className="mt-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <div className="flex">
                      <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                      <div className="text-sm text-green-800">
                        <p className="font-medium">Clear fire mode will:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Turn off all sirens and strobes</li>
                          <li>End active mustering events</li>
                          <li>Send all-clear notifications</li>
                          <li>Return doors to normal operation</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setPendingAction(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={executeFireMode}
                  disabled={actionInProgress}
                  className={`px-4 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 ${
                    pendingAction?.action === 'activate' ? 'bg-orange-600' : 'bg-green-600'
                  }`}
                >
                  {actionInProgress ? 'Processing...' : `${pendingAction?.action?.toUpperCase()} Fire Mode`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyFireMode;
