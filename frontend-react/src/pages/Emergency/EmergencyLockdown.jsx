/**
 * Emergency Lockdown - POB v2.0
 * Zone and global lockdown management with selective door control
 */

import React, { useState, useEffect } from 'react';
import { 
  Lock, Unlock, MapPin, DoorOpen, AlertTriangle, CheckCircle, 
  XCircle, Users, Shield, Power
} from 'lucide-react';
import { api } from '../../services/api';

const EmergencyLockdown = () => {
  const [zones, setZones] = useState([]);
  const [doors, setDoors] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedDoors, setSelectedDoors] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [lockdownReason, setLockdownReason] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [lockdownHistory, setLockdownHistory] = useState([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [zonesRes, doorsRes, historyRes] = await Promise.all([
        api.get('/api/v1/zones/'),
        api.get('/api/access-control/doors/'),
        api.get('/api/emergency/audit/?event_type=0&limit=10') // Lockdown events
      ]);
      
      setZones(zonesRes.data.data || []);
      setDoors(doorsRes.data.data || []);
      // Locations = personnel areas (for location-scoped lockdown, action #13).
      try {
        const areasRes = await api.get('/api/device/areas');
        const rows = areasRes.data?.data ?? areasRes.data ?? [];
        setLocations(Array.isArray(rows) ? rows.map(a => ({ id: a.id, name: a.area_name || a.name || `Area ${a.id}` })) : []);
      } catch (_) { setLocations([]); }
      setLockdownHistory(historyRes.data.data || []);
    } catch (error) {
      console.error('Error fetching lockdown data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLockdownAction = (action, scope = 'door') => {
    if (actionInProgress) return;
    
    if (!lockdownReason.trim()) {
      alert('Please provide a reason for the lockdown action');
      return;
    }

    setPendingAction({ action, scope });
    setShowConfirmModal(true);
  };

  const executeLockdown = async () => {
    if (!pendingAction) return;

    try {
      setActionInProgress(true);
      
      let requestData = {
        action: pendingAction.action,
        reason: lockdownReason
      };

      if (pendingAction.scope === 'global') {
        requestData.scope = 'global';
      } else if (pendingAction.scope === 'zone') {
        requestData.scope = 'zone';
        requestData.zone_ids = selectedZones;
      } else if (pendingAction.scope === 'location') {
        requestData.scope = 'location';
        requestData.location_ids = selectedLocations;
      } else {
        requestData.scope = 'door';
        requestData.door_ids = selectedDoors.length > 0 ? selectedDoors : doors.map(d => d.id);
      }

      const response = await api.post('/api/emergency/lockdown/', requestData);
      
      if (response.data.success) {
        const result = response.data.data;
        alert(
          `Emergency ${pendingAction.action} completed successfully.\n` +
          `Total doors: ${result.total_doors}\n` +
          `Processed: ${result.processed_doors}\n` +
          `Failed: ${result.failed_doors}`
        );
        
        // Reset form
        setLockdownReason('');
        setSelectedDoors([]);
        setSelectedZones([]);
        setShowConfirmModal(false);
        setPendingAction(null);
        
        // Refresh data
        fetchData();
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

  const handleSelectAllDoors = () => {
    if (selectedDoors.length === doors.length) {
      setSelectedDoors([]);
    } else {
      setSelectedDoors(doors.map(d => d.id));
    }
  };

  const handleSelectAllZones = () => {
    if (selectedZones.length === zones.length) {
      setSelectedZones([]);
    } else {
      setSelectedZones(zones.map(z => z.id));
    }
  };

  const handleDoorSelection = (doorId) => {
    setSelectedDoors(prev => 
      prev.includes(doorId) 
        ? prev.filter(id => id !== doorId)
        : [...prev, doorId]
    );
  };

  const handleZoneSelection = (zoneId) => {
    setSelectedZones(prev =>
      prev.includes(zoneId)
        ? prev.filter(id => id !== zoneId)
        : [...prev, zoneId]
    );
  };

  const handleSelectAllLocations = () => {
    setSelectedLocations(
      selectedLocations.length === locations.length ? [] : locations.map(l => l.id)
    );
  };

  const handleLocationSelection = (locId) => {
    setSelectedLocations(prev =>
      prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]
    );
  };

  const getEmergencyActionLabel = (action) => {
    switch (action) {
      case 0: return 'Ignore';
      case 1: return 'Lock';
      case 2: return 'Unlock';
      default: return 'Unknown';
    }
  };

  const getEmergencyActionColor = (action) => {
    switch (action) {
      case 1: return 'red';
      case 2: return 'green';
      default: return 'gray';
    }
  };

  const getDoorsInZone = (zoneId) => {
    return doors.filter(door => door.area_id === zoneId);
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
      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Emergency Actions</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => handleLockdownAction('lock', 'global')}
            disabled={actionInProgress}
            className="flex flex-col items-center justify-center p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <Lock className="w-6 h-6 mb-2" />
            <span className="font-semibold">Global Lockdown</span>
            <span className="text-xs opacity-90">Lock all doors</span>
          </button>
          
          <button
            onClick={() => handleLockdownAction('unlock', 'global')}
            disabled={actionInProgress}
            className="flex flex-col items-center justify-center p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <Unlock className="w-6 h-6 mb-2" />
            <span className="font-semibold">Global Unlock</span>
            <span className="text-xs opacity-90">Unlock all doors</span>
          </button>
          
          <button
            onClick={() => handleLockdownAction('lock', 'zone')}
            disabled={actionInProgress}
            className="flex flex-col items-center justify-center p-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <MapPin className="w-6 h-6 mb-2" />
            <span className="font-semibold">Zone Lockdown</span>
            <span className="text-xs opacity-90">Lock selected zones</span>
          </button>

          <button
            onClick={() => handleLockdownAction('lock', 'location')}
            disabled={actionInProgress}
            className="flex flex-col items-center justify-center p-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <MapPin className="w-6 h-6 mb-2" />
            <span className="font-semibold">Location Lockdown</span>
            <span className="text-xs opacity-90">Lock selected locations</span>
          </button>

          <button
            onClick={() => handleLockdownAction('lock', 'door')}
            disabled={actionInProgress}
            className="flex flex-col items-center justify-center p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <DoorOpen className="w-6 h-6 mb-2" />
            <span className="font-semibold">Selective Lock</span>
            <span className="text-xs opacity-90">Lock selected doors</span>
          </button>
        </div>
      </div>

      {/* Location Selection (personnel areas) — action #13 */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Location Selection</h3>
          <button onClick={handleSelectAllLocations} className="text-blue-600 hover:text-blue-800 text-sm">
            {selectedLocations.length === locations.length && locations.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        {locations.length === 0 ? (
          <p className="text-sm text-gray-500">No locations configured.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((loc) => {
              const isSelected = selectedLocations.includes(loc.id);
              return (
                <div
                  key={loc.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors duration-200 ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => handleLocationSelection(loc.id)}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{loc.name}</h4>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleLocationSelection(loc.id)}
                      className="rounded border-gray-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {selectedLocations.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">Selected {selectedLocations.length} location(s)</p>
          </div>
        )}
      </div>

      {/* Zone Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Zone Selection</h3>
          <button
            onClick={handleSelectAllZones}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {selectedZones.length === zones.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => {
            const zoneDoors = getDoorsInZone(zone.id);
            const isSelected = selectedZones.includes(zone.id);
            
            return (
              <div
                key={zone.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors duration-200 ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => handleZoneSelection(zone.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{zone.name}</h4>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleZoneSelection(zone.id)}
                    className="rounded border-gray-300"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <div className="flex items-center">
                    <DoorOpen className="w-4 h-4 mr-1" />
                    {zoneDoors.length} doors
                  </div>
                  <div className="flex items-center mt-1">
                    <Users className="w-4 h-4 mr-1" />
                    Capacity: {zone.capacity || 'N/A'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {selectedZones.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              Selected {selectedZones.length} zones with {selectedZones.reduce((total, zoneId) => {
                return total + getDoorsInZone(zoneId).length;
              }, 0)} doors
            </p>
          </div>
        )}
      </div>

      {/* Door Control */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Door Control</h3>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Selected: {selectedDoors.length} of {doors.length}
            </span>
            <button
              onClick={handleSelectAllDoors}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {selectedDoors.length === doors.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedDoors.length === doors.length}
                    onChange={handleSelectAllDoors}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Door
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Terminal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Emergency Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mustering Mode
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {doors.map((door) => {
                const isSelected = selectedDoors.includes(door.id);
                const zone = zones.find(z => z.id === door.area_id);
                
                return (
                  <tr 
                    key={door.id} 
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleDoorSelection(door.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Shield className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{door.door_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Power className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="text-sm text-gray-900">{door.terminal_sn}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{zone?.name || 'Unassigned'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        door.state === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {door.state === 1 ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getEmergencyActionColor(door.emergency_action)}-100 text-${getEmergencyActionColor(door.emergency_action)}-800`}>
                        {getEmergencyActionLabel(door.emergency_action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        door.mustering_mode ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {door.mustering_mode ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lockdown History */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Lockdown Events</h3>
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
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Initiated By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lockdownHistory.map((event) => (
                <tr key={event.event_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(event.start_time).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      event.actions?.[0]?.action === 'lock' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {event.actions?.[0]?.action?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.scope === 0 ? 'Global' : event.scope === 1 ? 'Zone' : 'Door'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.initiated_by || 'System'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {event.reason || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      {event.actions?.[0]?.processed_count > 0 ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 mr-1" />
                      )}
                      {event.actions?.[0]?.processed_count || 0} processed
                    </div>
                  </td>
                </tr>
              ))}
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
                Confirm Emergency {pendingAction?.action?.toUpperCase()}
              </h3>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Emergency Action
                </label>
                <textarea
                  value={lockdownReason}
                  onChange={(e) => setLockdownReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter reason for emergency action..."
                />
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="flex">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">This is a critical safety action:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Action will be logged for audit trail</li>
                      <li>Notifications will be sent to relevant personnel</li>
                      <li>Emergency systems will be activated</li>
                    </ul>
                  </div>
                </div>
              </div>
              
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
                  onClick={executeLockdown}
                  disabled={actionInProgress || !lockdownReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {actionInProgress ? 'Processing...' : `Execute ${pendingAction?.action?.toUpperCase()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyLockdown;
