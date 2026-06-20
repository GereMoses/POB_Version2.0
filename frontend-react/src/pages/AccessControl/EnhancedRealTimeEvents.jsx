/**
 * Enhanced Real-time Events - BioTime 9.5 Compatible + POB Extensions
 * Advanced filtering, search, analytics, and improved UX
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Activity, Filter, Search, Download, RefreshCw, 
  Bell, AlertTriangle, CheckCircle, XCircle, Clock,
  TrendingUp, TrendingDown, Users, DoorOpen,
  Zap, Shield, Eye, BarChart3, Calendar, Lock
} from 'lucide-react';
import apiService from '../../services/api';

const EnhancedRealTimeEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    start_time: '',
    end_time: '',
    door_ids: [],
    event_types: [],
    emp_code: '',
    search_term: '',
    limit: 100
  });
  const [analytics, setAnalytics] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [stats, setStats] = useState({
    totalEvents: 0,
    accessGranted: 0,
    accessDenied: 0,
    emergencyEvents: 0,
    musteringEvents: 0,
    activeUsers: 0,
    systemHealth: 'healthy'
  });

  const eventListRef = useRef(null);
  const wsRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsBase = (process.env.REACT_APP_WS_URL || `${proto}//${window.location.host}`).replace(/\/$/, '');
        const wsUrl = `${wsBase}/ws/access-control/events/?token=${token}`;
        
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          alert('Real-time events connected');
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'events_update') {
              setEvents(prev => [...data.data.slice(0, 50), ...prev]);
              updateStats(data.data);
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        };
        
        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
          alert('Real-time events disconnected');
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
          alert('WebSocket connection error');
        };
        
      } catch (error) {
        console.error('WebSocket connection error:', error);
        setConnectionStatus('error');
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Update statistics when events change
  const updateStats = useCallback((eventData) => {
    const totalEvents = eventData.length;
    const accessGranted = eventData.filter(e => e.event_type === 0).length;
    const accessDenied = eventData.filter(e => e.event_type === 2 || e.event_type === 3).length;
    const emergencyEvents = eventData.filter(e => e.event_type === 6 || e.event_type === 5).length;
    const musteringEvents = eventData.filter(e => e.event_type === 7).length;
    
    setStats(prev => ({
      ...prev,
      totalEvents,
      accessGranted,
      accessDenied,
      emergencyEvents,
      musteringEvents
    }));
  }, []);

  // Fetch events with filters
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Add filters to params
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (value && (Array.isArray(value) ? value.length > 0 : value !== '')) {
          if (Array.isArray(value)) {
            params.set(key, value.join(','));
          } else {
            params.set(key, value);
          }
        }
      });
      
      params.set('limit', filters.limit.toString());
      params.set('offset', '0');
      
      const response = await apiService.get(`/api/access-control/events/?${params.toString()}`);

      setEvents(Array.isArray(response) ? response : (response.events || response.results || []));
      setAnalytics(response.analytics || null);
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchEvents, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, fetchEvents]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Apply filters
  const applyFilters = () => {
    setShowFilters(false);
    fetchEvents();
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      start_time: '',
      end_time: '',
      door_ids: [],
      event_types: [],
      emp_code: '',
      search_term: '',
      limit: 100
    });
  };

  // Search functionality
  const handleSearch = async () => {
    if (!filters.search_term.trim()) return;
    
    setLoading(true);
    try {
      const response = await apiService.get(
        `/api/access-control/events/?search=${encodeURIComponent(filters.search_term)}&limit=100`
      );

      const results = Array.isArray(response) ? response : (response.results || response.events || []);
      setSearchResults(results);
      setEvents(results);
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Export functionality
  const exportEvents = async () => {
    try {
      const params = new URLSearchParams();
      
      // Add filters to export parameters
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (value && (Array.isArray(value) ? value.length > 0 : value !== '')) {
          if (Array.isArray(value)) {
            params.set(key, value.join(','));
          } else {
            params.set(key, value);
          }
        }
      });
      
      const response = await apiService.get(`/api/access-control/events/?${params.toString()}`);
      const exportEvents = Array.isArray(response) ? response : (response.events || response.results || []);

      // Create CSV content
      const csvContent = [
        ['Timestamp', 'Event Type', 'Employee', 'Door', 'Description', 'Terminal'],
        ...exportEvents.map(event => [
          event.event_time,
          getEventTypeName(event.event_type),
          event.emp_name || 'N/A',
          event.door_id || 'N/A',
          event.description || '',
          event.terminal_sn || ''
        ])
      ].map(row => row.join(',')).join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `access_events_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      alert('Events exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed');
    }
  };

  // Event type colors and icons
  const getEventTypeInfo = (eventType) => {
    const eventConfig = {
      0: { color: 'green', icon: CheckCircle, name: 'Normal Access' },
      1: { color: 'blue', icon: DoorOpen, name: 'Door Open' },
      2: { color: 'red', icon: AlertTriangle, name: 'Door Alarm' },
      3: { color: 'yellow', icon: XCircle, name: 'Anti-passback' },
      4: { color: 'red', icon: Shield, name: 'Duress' },
      5: { color: 'orange', icon: Zap, name: 'Fire Unlock' },
      6: { color: 'red', icon: Lock, name: 'Emergency Lock' },
      7: { color: 'purple', icon: Users, name: 'Mustering Check' }
    };
    
    return eventConfig[eventType] || eventConfig[0];
  };

  // Helper function to get event type name
  const getEventTypeName = (eventType) => {
    const eventConfig = getEventTypeInfo(eventType);
    return eventConfig ? eventConfig.name : 'Unknown';
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Scroll to bottom of event list
  const scrollToBottom = () => {
    if (eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Enhanced Real-time Events</h3>
          <p className="text-sm text-gray-600">Advanced monitoring with analytics and filtering</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500' : 
              'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 
               'Disconnected'}
            </span>
          </div>
          
          {/* Auto-refresh toggle */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
          
          {/* Refresh button */}
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          {/* Export button */}
          <button
            onClick={exportEvents}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
            <p className="text-sm text-gray-600">Total Events</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{stats.accessGranted}</p>
            <p className="text-sm text-gray-600">Access Granted</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{stats.accessDenied}</p>
            <p className="text-sm text-gray-600">Access Denied</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">{stats.emergencyEvents}</p>
            <p className="text-sm text-gray-600">Emergency</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">{stats.musteringEvents}</p>
            <p className="text-sm text-gray-600">Mustering</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={filters.search_term}
              onChange={(e) => setFilters(prev => ({ ...prev, search_term: e.target.value }))}
              placeholder="Search events..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Search
          </button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="mt-2">
            <p className="text-sm text-gray-600">Search Results ({searchResults.length})</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-semibold text-gray-900">Filters</h4>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-blue-600 hover:text-blue-800"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
        
        {showFilters && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input
                  type="datetime-local"
                  value={filters.start_time}
                  onChange={(e) => handleFilterChange('start_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input
                  type="datetime-local"
                  value={filters.end_time}
                  onChange={(e) => handleFilterChange('end_time', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee Code</label>
                <input
                  type="text"
                  value={filters.emp_code}
                  onChange={(e) => handleFilterChange('emp_code', e.target.value)}
                  placeholder="Enter employee code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Types</label>
                <select
                  multiple
                  value={filters.event_types}
                  onChange={(e) => handleFilterChange('event_types', Array.from(e.target.selectedOptions))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">Normal Access</option>
                  <option value="1">Door Open</option>
                  <option value="2">Door Alarm</option>
                  <option value="3">Anti-passback</option>
                  <option value="4">Duress</option>
                  <option value="5">Fire Unlock</option>
                  <option value="6">Emergency Lock</option>
                  <option value="7">Mustering Check</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-between items-end">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Door
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody ref={eventListRef}>
              {events.map((event, index) => {
                const eventTypeInfo = getEventTypeInfo(event.event_type);
                const Icon = eventTypeInfo.icon;
                const colorClass = `text-${eventTypeInfo.color}-600`;
                
                return (
                  <tr key={event.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Icon className={`w-4 h-4 mr-2 ${colorClass}`} />
                        {formatTimestamp(event.event_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{event.emp_name || 'N/A'}</div>
                        {event.emp_code && (
                          <div className="text-gray-500">({event.emp_code})</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                        {eventTypeInfo.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {event.door_id || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {event.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {event.terminal_sn || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedEvent(event)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {event.event_type === 0 && (
                        <button
                          onClick={() => {/* Remote open functionality */}}
                          className="text-green-600 hover:text-green-800 text-sm ml-2"
                          title="Remote Open"
                        >
                          <DoorOpen className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-screen overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
              <button
                onClick={() => setShowEventDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Event Type</label>
                <div className="flex items-center">
                  {React.createElement(getEventTypeInfo(selectedEvent.event_type).icon, {
                    className: `w-5 h-5 mr-2 text-${getEventTypeInfo(selectedEvent.event_type).color}-600`
                  })}
                  <span className="ml-2">{getEventTypeInfo(selectedEvent.event_type).name}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                <div className="text-gray-900">{formatTimestamp(selectedEvent.event_time)}</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee</label>
                <div className="text-gray-900">
                  <div className="font-medium">{selectedEvent.emp_name || 'N/A'}</div>
                  {selectedEvent.emp_code && (
                    <div className="text-gray-500">({selectedEvent.emp_code})</div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Door</label>
                <div className="text-gray-900">{selectedEvent.door_id || 'N/A'}</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Terminal</label>
                <div className="text-gray-900">{selectedEvent.terminal_sn || '-'}</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <div className="text-gray-900">{selectedEvent.description || 'No description'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRealTimeEvents;
