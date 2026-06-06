/**
 * Enhanced Emergency Dashboard - POB v2.0
 * AI-powered emergency management with predictive analytics and real-time insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Lock, Unlock, AlertTriangle, Users, Power, Wifi, WifiOff, 
  Bell, MapPin, Activity, Clock, CheckCircle, XCircle, AlertCircle,
  Brain, TrendingUp, Shield, Eye, Download, RefreshCw, Zap,
  BarChart3, PieChart, Target, Radar
} from 'lucide-react';
import { api } from '../../services/api';

const EmergencyDashboardEnhanced = () => {
  const [dashboardData, setDashboardData] = useState({
    total_emergencies: 0,
    active_emergencies: [],
    doors_locked: 0,
    doors_unlocked: 0,
    sirens_on: 0,
    recent_events: [],
    zone_status: [],
    system_status: 'NORMAL',
    threat_assessment: null,
    predictive_analytics: null,
    system_metrics: null,
    recent_patterns: [],
    device_health: null,
    ai_insights: [],
    recommendations: []
  });
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [selectedZones, setSelectedZones] = useState([]);
  const [lockdownReason, setLockdownReason] = useState('');
  const [showLockdownConfirm, setShowLockdownConfirm] = useState(false);
  const [showFireModeConfirm, setShowFireModeConfirm] = useState(false);
  const [fireModeZone, setFireModeZone] = useState(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [severityLevel, setSeverityLevel] = useState('NORMAL');
  const [autoDuration, setAutoDuration] = useState(null);

  useEffect(() => {
    fetchEnhancedDashboardData();
    const interval = setInterval(fetchEnhancedDashboardData, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchEnhancedDashboardData = async () => {
    try {
      const response = await api.get('/api/emergency/enhanced/dashboard/ai/');
      setDashboardData(response.data.data);
    } catch (error) {
      console.error('Error fetching enhanced dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnhancedLockdown = async (action, scope = 'global') => {
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
        severity_level: severityLevel,
        auto_duration: autoDuration,
        zone_ids: scope === 'zone' ? selectedZones : undefined
      };

      const response = await api.post('/api/emergency/enhanced/lockdown/', requestData);
      
      if (response.data.success) {
        const result = response.data.data;
        alert(
          `Enhanced emergency ${action} completed successfully.\n` +
          `AI-optimized strategy applied.\n` +
          `Severity: ${severityLevel}\n` +
          `Processed: ${result.results.processed_doors} doors\n` +
          `Auto-duration: ${autoDuration ? `${autoDuration}s` : 'Manual'}`
        );
        
        setLockdownReason('');
        setShowLockdownConfirm(false);
        fetchEnhancedDashboardData();
      } else {
        alert('Enhanced lockdown action failed');
      }
    } catch (error) {
      console.error('Error executing enhanced lockdown:', error);
      alert('Error executing enhanced lockdown action');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSmartFireMode = async (action, zoneId = null) => {
    if (actionInProgress) return;

    try {
      setActionInProgress(true);
      
      const requestData = {
        zone_id: zoneId,
        action: action,
        reason: action === 'activate' ? 'Smart fire mode activated' : 'Smart fire mode cleared',
        evacuation_priority: 'HIGH',
        auto_evacuation_routes: true
      };

      const response = await api.post('/api/emergency/enhanced/fire-mode/smart', requestData);
      
      if (response.data.success) {
        alert(`Smart fire mode ${action} completed successfully with AI-optimized evacuation routes`);
        setShowFireModeConfirm(false);
        setFireModeZone(null);
        fetchEnhancedDashboardData();
      } else {
        alert('Smart fire mode action failed');
      }
    } catch (error) {
      console.error('Error executing smart fire mode:', error);
      alert('Error executing smart fire mode action');
    } finally {
      setActionInProgress(false);
    }
  };

  const getSystemStatusColor = () => {
    if (dashboardData.threat_assessment) {
      const threatLevel = dashboardData.threat_assessment.threat_level;
      switch (threatLevel) {
        case 'CRITICAL': return 'red';
        case 'HIGH': return 'orange';
        case 'MEDIUM': return 'yellow';
        case 'LOW': return 'green';
        default: return 'green';
      }
    }
    
    switch (dashboardData.system_status) {
      case 'EMERGENCY': return 'red';
      case 'WARNING': return 'yellow';
      default: return 'green';
    }
  };

  const getThreatLevelIcon = () => {
    if (dashboardData.threat_assessment) {
      const threatLevel = dashboardData.threat_assessment.threat_level;
      switch (threatLevel) {
        case 'CRITICAL': return AlertTriangle;
        case 'HIGH': return Shield;
        case 'MEDIUM': return Activity;
        case 'LOW': return CheckCircle;
        default: return CheckCircle;
      }
    }
    return Activity;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'red';
      case 'HIGH': return 'orange';
      case 'NORMAL': return 'blue';
      case 'LOW': return 'green';
      default: return 'gray';
    }
  };

  const renderAIInsights = () => {
    if (!dashboardData.ai_insights || dashboardData.ai_insights.length === 0) {
      return null;
    }

    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-400 p-4 rounded-lg">
        <div className="flex items-center mb-3">
          <Brain className="w-6 h-6 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-blue-800">AI Insights</h3>
        </div>
        <div className="space-y-2">
          {dashboardData.ai_insights.map((insight, index) => (
            <div key={index} className="flex items-start">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 mr-3 flex-shrink-0"></div>
              <p className="text-sm text-blue-700">{insight}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPredictiveAnalytics = () => {
    if (!dashboardData.predictive_analytics) {
      return null;
    }

    const { risk_score, confidence_interval, predicted_events, prevention_measures } = dashboardData.predictive_analytics;

    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
            Predictive Analytics
          </h3>
          <div className="flex items-center">
            <span className="text-sm text-gray-600 mr-2">Risk Score:</span>
            <div className="flex items-center">
              <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                <div 
                  className={`h-2 rounded-full ${
                    risk_score > 0.7 ? 'bg-red-500' : 
                    risk_score > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${risk_score * 100}%` }}
                ></div>
              </div>
              <span className="text-sm font-medium text-gray-700">
                {Math.round(risk_score * 100)}%
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Predicted Events</h4>
            <div className="space-y-2">
              {predicted_events.slice(0, 3).map((event, index) => (
                <div key={index} className="flex items-center p-2 bg-gray-50 rounded">
                  <Target className="w-4 h-4 text-orange-500 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{event.type}</p>
                    <p className="text-xs text-gray-600">
                      Confidence: {Math.round(event.confidence * 100)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Prevention Measures</h4>
            <div className="space-y-1">
              {prevention_measures.slice(0, 3).map((measure, index) => (
                <div key={index} className="flex items-center p-2 bg-green-50 rounded">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  <p className="text-sm text-green-800">{measure}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded">
          <p className="text-xs text-gray-600">
            <strong>Confidence Interval:</strong> {Math.round(confidence_interval[0] * 100)}% - {Math.round(confidence_interval[1] * 100)}%
          </p>
        </div>
      </div>
    );
  };

  const renderSystemMetrics = () => {
    if (!dashboardData.system_metrics) {
      return null;
    }

    const metrics = dashboardData.system_metrics;

    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
          System Performance Metrics
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(metrics.response_time_avg)}s
            </div>
            <p className="text-sm text-gray-600">Avg Response Time</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${Math.min((300 - metrics.response_time_avg) / 300 * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(metrics.success_rate * 100)}%
            </div>
            <p className="text-sm text-gray-600">Success Rate</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${metrics.success_rate * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(metrics.device_availability * 100)}%
            </div>
            <p className="text-sm text-gray-600">Device Availability</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${metrics.device_availability * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(metrics.notification_delivery_rate * 100)}%
            </div>
            <p className="text-sm text-gray-600">Notification Delivery</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-purple-500 h-2 rounded-full"
                style={{ width: `${metrics.notification_delivery_rate * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdvancedLockdownOptions = () => {
    return (
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900">Advanced Options</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Severity Level
          </label>
          <select
            value={severityLevel}
            onChange={(e) => setSeverityLevel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Auto-Duration (seconds)
          </label>
          <input
            type="number"
            value={autoDuration || ''}
            onChange={(e) => setAutoDuration(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Leave empty for manual"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="60"
            max="3600"
          />
          <p className="text-xs text-gray-500 mt-1">
            Automatically terminate after N seconds
          </p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="aiOptimized"
            checked={true}
            disabled
            className="rounded border-gray-300 mr-2"
          />
          <label htmlFor="aiOptimized" className="text-sm text-gray-700">
            AI-Optimized Strategy (Enabled)
          </label>
        </div>
      </div>
    );
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
      {/* AI-Powered Status Banner */}
      <div className={`bg-${getSystemStatusColor()}-50 border-l-4 border-${getSystemStatusColor()}-400 p-4 rounded-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {getThreatLevelIcon()}
            <div className="ml-3">
              <h3 className={`text-lg font-semibold text-${getSystemStatusColor()}-800`}>
                {dashboardData.threat_assessment ? 
                  `AI Threat Level: ${dashboardData.threat_assessment.threat_level}` : 
                  `System Status: ${dashboardData.system_status}`
                }
              </h3>
              <p className={`text-${getSystemStatusColor()}-700`}>
                {dashboardData.threat_assessment ? (
                  <>
                    Confidence: {Math.round(dashboardData.threat_assessment.confidence * 100)}% | 
                    Risk Factors: {dashboardData.threat_assessment.risk_factors.length} | 
                    Response Time: {dashboardData.threat_assessment.response_time}s
                  </>
                ) : (
                  <>
                    {dashboardData.total_emergencies} active emergencies | 
                    {dashboardData.doors_locked} doors locked | 
                    {dashboardData.sirens_on} sirens active
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchEnhancedDashboardData}
              className="p-2 bg-white bg-opacity-50 rounded-md hover:bg-opacity-70"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              className="p-2 bg-white bg-opacity-50 rounded-md hover:bg-opacity-70"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Action Buttons with AI Enhancement */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Enhanced Lockdown */}
        <button
          onClick={() => setShowLockdownConfirm(true)}
          disabled={actionInProgress}
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
        >
          <Lock className="w-8 h-8 mb-2" />
          <span className="font-semibold">AI Lockdown</span>
          <span className="text-xs opacity-90">Optimized lockdown</span>
          <Zap className="w-4 h-4 mt-1 opacity-70" />
        </button>

        {/* Smart Fire Mode */}
        <button
          onClick={() => setShowFireModeConfirm(true)}
          disabled={actionInProgress}
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
        >
          <AlertTriangle className="w-8 h-8 mb-2" />
          <span className="font-semibold">Smart Fire</span>
          <span className="text-xs opacity-90">AI evacuation</span>
          <Brain className="w-4 h-4 mt-1 opacity-70" />
        </button>

        {/* Enhanced All Clear */}
        <button
          onClick={() => handleSmartFireMode('clear')}
          disabled={actionInProgress || dashboardData.system_status === 'NORMAL'}
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
        >
          <CheckCircle className="w-8 h-8 mb-2" />
          <span className="font-semibold">All Clear</span>
          <span className="text-xs opacity-90">Smart resolution</span>
          <Eye className="w-4 h-4 mt-1 opacity-70" />
        </button>

        {/* Start Mustering */}
        <button
          onClick={() => {/* Start mustering */}}
          disabled={actionInProgress}
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
        >
          <Users className="w-8 h-8 mb-2" />
          <span className="font-semibold">Smart Mustering</span>
          <span className="text-xs opacity-90">AI-optimized</span>
          <Radar className="w-4 h-4 mt-1 opacity-70" />
        </button>
      </div>

      {/* AI Insights and Predictive Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderAIInsights()}
        {renderPredictiveAnalytics()}
      </div>

      {/* System Metrics */}
      {renderSystemMetrics()}

      {/* Status Cards with Enhanced Data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Emergencies</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData.total_emergencies}</p>
              {dashboardData.threat_assessment && (
                <p className="text-xs text-red-600 mt-1">
                  Threat: {dashboardData.threat_assessment.threat_level}
                </p>
              )}
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
              <p className="text-xs text-gray-500 mt-1">
                Unlocked: {dashboardData.doors_unlocked}
              </p>
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
              {dashboardData.device_health && (
                <p className="text-xs text-gray-500 mt-1">
                  Health: {Math.round(dashboardData.device_health.avg_health * 100)}%
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Response</p>
              <p className="text-2xl font-semibold text-gray-900">
                {dashboardData.system_metrics ? 
                  `${Math.round(dashboardData.system_metrics.response_time_avg)}s` : 
                  'N/A'
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Success: {dashboardData.system_metrics ? 
                  `${Math.round(dashboardData.system_metrics.success_rate * 100)}%` : 
                  'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Status with AI Recommendations */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Zone Status with AI Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardData.zone_status.map((zone, index) => {
            const isAffected = zone.status === 'ACTIVE';
            const recommendation = dashboardData.recommendations[index] || 'Normal operations';
            
            return (
              <div
                key={zone.id}
                className={`border-l-4 ${
                  isAffected ? 'border-orange-400 bg-orange-50' : 'border-green-400 bg-green-50'
                } p-4 rounded`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{zone.name}</h4>
                  <div className={`w-3 h-3 rounded-full ${
                    isAffected ? 'bg-orange-500 animate-pulse' : 'bg-green-500'
                  }`}></div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-600">
                    Status: <span className={`font-medium ${
                      isAffected ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {zone.status}
                    </span>
                  </p>
                  <p className="text-gray-600">
                    Capacity: {zone.capacity} | Evac Point: {zone.evac_point || 'N/A'}
                  </p>
                  <p className="text-xs text-blue-600 italic">
                    AI: {recommendation}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enhanced Lockdown Confirmation Modal */}
      {showLockdownConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900">
                Enhanced Emergency Lockdown
              </h3>
              
              <div className="mt-4 space-y-4">
                {/* Reason Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Enhanced Lockdown
                  </label>
                  <textarea
                    value={lockdownReason}
                    onChange={(e) => setLockdownReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter reason for enhanced emergency lockdown..."
                  />
                </div>

                {/* Advanced Options Toggle */}
                <div>
                  <button
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="flex items-center text-blue-600 hover:text-blue-800"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
                  </button>
                </div>

                {/* Advanced Options */}
                {showAdvancedOptions && renderAdvancedLockdownOptions()}

                {/* AI Strategy Preview */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex">
                    <Brain className="w-5 h-5 text-blue-400 mr-2" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">AI Strategy Preview</p>
                      <p className="mt-1">
                        The system will analyze current conditions and optimize the lockdown strategy for maximum effectiveness and minimal disruption.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowLockdownConfirm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleEnhancedLockdown('lock')}
                  disabled={actionInProgress || !lockdownReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {actionInProgress ? 'Processing...' : 'Execute Enhanced Lockdown'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Fire Mode Confirmation Modal */}
      {showFireModeConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900">
                Smart Fire Mode Activation
              </h3>
              
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded">
                <div className="flex">
                  <Brain className="w-5 h-5 text-orange-400 mr-2" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">AI-Optimized Fire Response</p>
                    <p className="mt-1">
                      System will optimize evacuation routes and coordinate emergency response using predictive analytics.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zone (optional - leave blank for global)
                </label>
                <select
                  value={fireModeZone || ''}
                  onChange={(e) => setFireModeZone(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Global Smart Fire Mode</option>
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
                  onClick={() => handleSmartFireMode('activate', fireModeZone)}
                  disabled={actionInProgress}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {actionInProgress ? 'Processing...' : 'Activate Smart Fire Mode'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyDashboardEnhanced;
