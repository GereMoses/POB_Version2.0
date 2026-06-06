/**
 * Emergency Audit Trail - POB v2.0
 * Complete audit trail with export functionality for compliance
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, Download, Filter, Search, Calendar, User, Activity,
  AlertTriangle, CheckCircle, XCircle, FileText, Eye, EyeOff,
  ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';

const EmergencyAudit = () => {
  const [auditData, setAuditData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    eventType: '',
    actionType: '',
    userId: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetails, setShowDetails] = useState(null);
  const [exportInProgress, setExportInProgress] = useState(false);

  useEffect(() => {
    fetchAuditData();
  }, [pagination.page, pagination.limit, filters, searchTerm]);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      params.append('limit', pagination.limit.toString());
      params.append('offset', ((pagination.page - 1) * pagination.limit).toString());
      
      if (filters.startDate) params.append('start_time', filters.startDate);
      if (filters.endDate) params.append('end_time', filters.endDate);
      if (filters.eventType) params.append('event_type', filters.eventType);
      if (filters.actionType) params.append('action_type', filters.actionType);
      if (filters.userId) params.append('user_id', filters.userId);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await api.get(`/api/emergency/audit/?${params}`);
      
      if (response.data.success) {
        setAuditData(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.total || response.data.data.length
        }));
      }
    } catch (error) {
      console.error('Error fetching audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (exportInProgress) return;

    try {
      setExportInProgress(true);
      
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_time', filters.startDate);
      if (filters.endDate) params.append('end_time', filters.endDate);
      if (filters.eventType) params.append('event_type', filters.eventType);
      if (filters.actionType) params.append('action_type', filters.actionType);
      if (filters.userId) params.append('user_id', filters.userId);
      if (searchTerm) params.append('search', searchTerm);
      params.append('export', 'true');
      params.append('limit', '10000'); // Large limit for export
      
      const response = await api.get(`/api/emergency/audit/?${params}`);
      
      if (response.data.success) {
        // Create CSV content
        const csvContent = generateCSV(response.data.data);
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `emergency_audit_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        alert(`Exported ${response.data.data.length} audit records`);
      } else {
        alert('Failed to export audit data');
      }
    } catch (error) {
      console.error('Error exporting audit data:', error);
      alert('Error exporting audit data');
    } finally {
      setExportInProgress(false);
    }
  };

  const generateCSV = (data) => {
    const headers = [
      'Event ID',
      'Event Type',
      'Status',
      'Start Time',
      'End Time',
      'Initiated By',
      'Initiated Type',
      'Trigger Source',
      'Reason',
      'Scope',
      'Zone IDs',
      'Door IDs',
      'Actions',
      'Operation Logs'
    ];

    const rows = data.map(event => {
      const actions = event.actions || [];
      const operationLogs = event.operation_logs || [];
      
      return [
        event.event_id,
        event.event_type_name,
        event.status_name,
        event.start_time,
        event.end_time || '',
        event.initiated_by || '',
        event.initiated_type_name || '',
        event.trigger_source || '',
        event.reason || '',
        event.scope || '',
        event.zone_ids ? JSON.stringify(event.zone_ids) : '',
        event.door_ids ? JSON.stringify(event.door_ids) : '',
        actions.map(a => `${a.type}: ${a.action || ''}`).join('; '),
        operationLogs.map(log => `${log.action}: ${log.new_values || ''}`).join('; ')
      ];
    });

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getEventTypeName = (eventType) => {
    const types = {
      0: 'LOCKDOWN',
      1: 'FIRE',
      2: 'GAS',
      3: 'INTRUDER',
      4: 'MEDICAL',
      5: 'ALL_CLEAR'
    };
    return types[eventType] || 'UNKNOWN';
  };

  const getStatusColor = (status) => {
    const colors = {
      'ACTIVE': 'red',
      'RESOLVED': 'green',
      'CANCELLED': 'gray'
    };
    return colors[status] || 'gray';
  };

  const getInitiatedTypeName = (initiatedType) => {
    const types = {
      0: 'Manual UI',
      1: 'Panic Button',
      2: 'Fire Panel',
      3: 'API'
    };
    return types[initiatedType] || 'UNKNOWN';
  };

  const getScopeName = (scope) => {
    const types = {
      0: 'Global',
      1: 'Zone',
      2: 'Door'
    };
    return types[scope] || 'UNKNOWN';
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Emergency Audit Trail</h3>
            <p className="text-sm text-gray-600">Complete audit trail of all emergency system activities</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleExport}
              disabled={exportInProgress}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              {exportInProgress ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              onClick={fetchAuditData}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-1 space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search audit trail..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex space-x-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Start date"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="End date"
              />
              <select
                value={filters.eventType}
                onChange={(e) => handleFilterChange('eventType', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Event Types</option>
                <option value="0">LOCKDOWN</option>
                <option value="1">FIRE</option>
                <option value="2">GAS</option>
                <option value="3">INTRUDER</option>
                <option value="4">MEDICAL</option>
                <option value="5">ALL_CLEAR</option>
              </select>
              <select
                value={filters.actionType}
                onChange={(e) => handleFilterChange('actionType', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                <option value="CREATE_EMERGENCY_EVENT">Create Event</option>
                <option value="UPDATE_EMERGENCY_EVENT">Update Event</option>
                <option value="COMPLETE_EMERGENCY_EVENT">Complete Event</option>
                <option value="TOGGLE_EMERGENCY_DEVICE">Toggle Device</option>
                <option value="SEND_EMERGENCY_NOTIFICATION">Send Notification</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <Activity className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-semibold text-gray-900">{pagination.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-red-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Active Events</p>
              <p className="text-2xl font-semibold text-gray-900">
                {auditData.filter(e => e.status_name === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Resolved Events</p>
              <p className="text-2xl font-semibold text-gray-900">
                {auditData.filter(e => e.status_name === 'RESOLVED').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="w-8 h-8 text-gray-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Cancelled Events</p>
              <p className="text-2xl font-semibold text-gray-900">
                {auditData.filter(e => e.status_name === 'CANCELLED').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Initiated By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trigger Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auditData.map((event) => {
                const duration = event.end_time ? 
                  new Date(event.end_time) - new Date(event.start_time) : 
                  Date.now() - new Date(event.start_time);
                
                return (
                  <tr 
                    key={event.event_id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setShowDetails(event)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(event.start_time).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getEventTypeName(event.event_type) === 'FIRE' ? 'orange' : getEventTypeName(event.event_type) === 'LOCKDOWN' ? 'red' : getEventTypeName(event.event_type) === 'GAS' ? 'yellow' : getEventTypeName(event.event_type) === 'INTRUDER' ? 'purple' : getEventTypeName(event.event_type) === 'MEDICAL' ? 'blue' : getEventTypeName(event.event_type) === 'ALL_CLEAR' ? 'green' : 'gray'}-100 text-${getEventTypeName(event.event_type) === 'FIRE' ? 'orange' : getEventTypeName(event.event_type) === 'LOCKDOWN' ? 'red' : getEventTypeName(event.event_type) === 'GAS' ? 'yellow' : getEventTypeName(event.event_type) === 'INTRUDER' ? 'purple' : getEventTypeName(event.event_type) === 'MEDICAL' ? 'blue' : getEventTypeName(event.event_type) === 'ALL_CLEAR' ? 'green' : 'gray'}-800`}>
                        {getEventTypeName(event.event_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {event.status_name === 'ACTIVE' ? (
                          <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
                        ) : event.status_name === 'RESOLVED' ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-500 mr-2" />
                        )}
                        <span className={`text-sm font-medium ${getStatusColor(event.status_name)}-600`}>
                          {event.status_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2 text-gray-600" />
                        <span>{event.initiated_by || 'System'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {event.trigger_source || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {event.reason || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getScopeName(event.scope)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.floor(duration / 60000)}m {Math.floor((duration % 60000) / 1000)}s
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDetails(event);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Page {pagination.page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= totalPages}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Emergency Event Details</h3>
                <button
                  onClick={() => setShowDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gray-50 p-4 rounded">
                  <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Event ID:</span>
                      <p className="text-gray-900">{showDetails.event_id}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Event Type:</span>
                      <p className="text-gray-900">{getEventTypeName(showDetails.event_type)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <p className="text-gray-900">{showDetails.status_name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Start Time:</span>
                      <p className="text-gray-900">{new Date(showDetails.start_time).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">End Time:</span>
                      <p className="text-gray-900">
                        {showDetails.end_time ? new Date(showDetails.end_time).toLocaleString() : 'Still Active'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Initiated By:</span>
                      <p className="text-gray-900">{showDetails.initiated_by || 'System'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Trigger Source:</span>
                      <p className="text-gray-900">{showDetails.trigger_source || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Scope:</span>
                      <p className="text-gray-900">{getScopeName(showDetails.scope)}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-gray-50 p-4 rounded">
                  <h4 className="font-medium text-gray-900 mb-3">Actions Executed</h4>
                  <div className="space-y-2">
                    {showDetails.actions?.map((action, index) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{action.type}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(action.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          {action.action && <div><strong>Action:</strong> {action.action}</div>}
                          {action.doors && <div><strong>Doors:</strong> {JSON.stringify(action.doors)}</div>}
                          {action.devices && <div><strong>Devices:</strong> {JSON.stringify(action.devices)}</div>}
                          {action.mustering_event_id && <div><strong>Mustering Event:</strong> {action.mustering_event_id}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Operation Logs */}
                <div className="bg-gray-50 p-4 rounded">
                  <h4 className="font-medium text-gray-900 mb-3">Operation Logs</h4>
                  <div className="space-y-2">
                    {showDetails.operation_logs?.map((log, index) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{log.action}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          {log.new_values && <div><strong>New Values:</strong> {log.new_values}</div>}
                          {log.old_values && <div><strong>Old Values:</strong> {log.old_values}</div>}
                          {log.ip_address && <div><strong>IP Address:</strong> {log.ip_address}</div>}
                          {log.user_agent && <div><strong>User Agent:</strong> {log.user_agent}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyAudit;
