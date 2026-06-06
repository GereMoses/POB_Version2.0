/**
 * Emergency Triggers - POB v2.0
 * Panic buttons, fire panel integration, and webhook configuration
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Shield, Wifi, Settings, Key, Webhook, Bell,
  CheckCircle, XCircle, Plus, Edit, Trash2, Copy, Activity, Users,
  MapPin, Clock, ToggleLeft, ToggleRight
} from 'lucide-react';
import { api } from '../../services/api';

const EmergencyTriggers = () => {
  const [activeTab, setActiveTab] = useState('panic-button');
  const [panicButtonEnabled, setPanicButtonEnabled] = useState(true);
  const [panicButtonHistory, setPanicButtonHistory] = useState([]);
  const [webhookConfig, setWebhookConfig] = useState({
    enabled: false,
    url: '',
    apiKey: '',
    lastTrigger: null,
    triggerCount: 0
  });
  const [triggerTemplates, setTriggerTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testInProgress, setTestInProgress] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch panic button history and trigger configuration
      const [historyRes, templatesRes] = await Promise.all([
        api.get('/api/emergency/audit/?event_type=3&limit=20'), // Panic events
        api.get('/api/emergency/templates/') // Trigger templates
      ]);
      
      setPanicButtonHistory(historyRes.data.data || []);
      setTriggerTemplates(templatesRes.data.data || []);
    } catch (error) {
      console.error('Error fetching trigger data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePanicButton = async (location = 'Current Location') => {
    if (testInProgress) return;

    if (!window.confirm('Are you sure you want to activate the panic button? This will trigger emergency procedures.')) {
      return;
    }

    try {
      setTestInProgress(true);
      
      const response = await api.post('/api/emergency/panic/', {
        location: location,
        reason: 'Manual panic button activation'
      });
      
      if (response.data.success) {
        alert(`Panic button activated successfully!\nEmergency Event ID: ${response.data.data.emergency_event_id}`);
        fetchData(); // Refresh data
      } else {
        alert('Failed to activate panic button');
      }
    } catch (error) {
      console.error('Error activating panic button:', error);
      alert('Error activating panic button');
    } finally {
      setTestInProgress(false);
    }
  };

  const handleWebhookTest = async () => {
    if (testInProgress) return;

    if (!webhookConfig.url || !webhookConfig.apiKey) {
      alert('Please configure webhook URL and API key before testing');
      return;
    }

    try {
      setTestInProgress(true);
      
      const response = await api.post('/api/emergency/trigger/', {
        trigger_type: 'panic',
        source: 'Webhook Test',
        location: 'Test Location'
      }, {
        headers: {
          'X-API-Key': webhookConfig.apiKey
        }
      });
      
      if (response.data.success) {
        alert(`Webhook test successful!\nEmergency Event ID: ${response.data.data.emergency_event_id}`);
        setWebhookConfig(prev => ({
          ...prev,
          lastTrigger: new Date().toISOString(),
          triggerCount: prev.triggerCount + 1
        }));
      } else {
        alert('Webhook test failed');
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      alert('Error testing webhook');
    } finally {
      setTestInProgress(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/emergency/trigger/`;
    navigator.clipboard.writeText(webhookUrl);
    alert('Webhook URL copied to clipboard');
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(webhookConfig.apiKey);
    alert('API Key copied to clipboard');
  };

  const getTriggerTypeName = (eventType) => {
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

  const getInitiatedTypeName = (initiatedType) => {
    const types = {
      0: 'Manual UI',
      1: 'Panic Button',
      2: 'Fire Panel',
      3: 'API'
    };
    return types[initiatedType] || 'UNKNOWN';
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
      {/* Tab Navigation */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'panic-button', name: 'Panic Button', icon: Shield },
              { id: 'webhook', name: 'Webhook', icon: Webhook },
              { id: 'templates', name: 'Templates', icon: Settings },
              { id: 'history', name: 'History', icon: Clock }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative min-w-0 flex-1 overflow-hidden bg-white py-4 px-6 text-center text-sm font-medium hover:bg-gray-50 focus:z-10 ${
                    isActive
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Icon className="w-5 h-5" />
                    <span>{tab.name}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Panic Button Tab */}
          {activeTab === 'panic-button' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Panic Button Configuration</h3>
                <button
                  onClick={() => setPanicButtonEnabled(!panicButtonEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                    panicButtonEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      panicButtonEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Panic Button Status */}
              <div className={`p-6 rounded-lg border-2 ${
                panicButtonEnabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center">
                  <Shield className={`w-8 h-8 mr-4 ${
                    panicButtonEnabled ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <div className="flex-1">
                    <h4 className={`text-lg font-medium ${
                      panicButtonEnabled ? 'text-green-800' : 'text-gray-800'
                    }`}>
                      Panic Button {panicButtonEnabled ? 'Enabled' : 'Disabled'}
                    </h4>
                    <p className={`text-sm ${
                      panicButtonEnabled ? 'text-green-700' : 'text-gray-600'
                    }`}>
                      {panicButtonEnabled 
                        ? 'Users can trigger emergency procedures using the panic button'
                        : 'Panic button is currently disabled'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Test Panic Button */}
              <div className="bg-white shadow rounded-lg p-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Test Panic Button</h4>
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="flex">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mr-2" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">Test Mode Active</p>
                        <p className="mt-1">
                          This will simulate a panic button activation and create an emergency event.
                          All configured emergency procedures will be triggered.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handlePanicButton('Test Location')}
                    disabled={testInProgress || !panicButtonEnabled}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {testInProgress ? 'Activating...' : 'Activate Panic Button'}
                  </button>
                </div>
              </div>

              {/* Panic Button Instructions */}
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
                <h4 className="text-md font-semibold text-blue-800 mb-2">Panic Button Instructions</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-blue-700">
                  <li>Users with appropriate permissions can activate the panic button</li>
                  <li>Panic button triggers immediate emergency procedures</li>
                  <li>All configured notifications will be sent</li>
                  <li>Emergency lockdown may be activated based on templates</li>
                  <li>All activations are logged in the audit trail</li>
                  <li>Panic button can be disabled for maintenance or testing</li>
                </ul>
              </div>
            </div>
          )}

          {/* Webhook Tab */}
          {activeTab === 'webhook' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Webhook Configuration</h3>
              
              {/* Webhook Status */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-md font-semibold text-gray-900">Webhook Status</h4>
                  <button
                    onClick={() => setWebhookConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                      webhookConfig.enabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        webhookConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook URL
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        value={webhookConfig.url}
                        onChange={(e) => setWebhookConfig(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://your-system.com/webhook"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleCopyWebhookUrl}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-r-md hover:bg-gray-300 border-l-0"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      External systems can send emergency triggers to this URL
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                    </label>
                    <div className="flex">
                      <input
                        type="password"
                        value={webhookConfig.apiKey}
                        onChange={(e) => setWebhookConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder="Enter API key"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleCopyApiKey}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-r-md hover:bg-gray-300 border-l-0"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Secure key for webhook authentication
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">
                    <strong>Current URL:</strong> {window.location.origin}/api/emergency/trigger/
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Method:</strong> POST | <strong>Content-Type:</strong> application/json
                  </p>
                </div>
              </div>

              {/* Webhook Test */}
              <div className="bg-white shadow rounded-lg p-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Test Webhook</h4>
                <button
                  onClick={handleWebhookTest}
                  disabled={testInProgress || !webhookConfig.enabled || !webhookConfig.url}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testInProgress ? 'Testing...' : 'Test Webhook'}
                </button>
                
                {webhookConfig.lastTrigger && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-800">
                      <strong>Last Test:</strong> {new Date(webhookConfig.lastTrigger).toLocaleString()}
                    </p>
                    <p className="text-sm text-green-800">
                      <strong>Total Triggers:</strong> {webhookConfig.triggerCount}
                    </p>
                  </div>
                )}
              </div>

              {/* Webhook Documentation */}
              <div className="bg-white shadow rounded-lg p-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Webhook Documentation</h4>
                <div className="space-y-4">
                  <div>
                    <h5 className="font-medium text-gray-900">Request Format</h5>
                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`POST /api/emergency/trigger/
Headers:
  X-API-Key: your-api-key
  Content-Type: application/json

Body:
{
  "trigger_type": "panic|fire|gas|medical|intruder",
  "source": "External System Name",
  "location": "Location Description",
  "template_id": 123,
  "additional_data": {}}`}
                    </pre>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-900">Response Format</h5>
                    <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`{
  "success": true,
  "data": {
    "emergency_event_id": 12345,
    "trigger_type": "panic",
    "source": "External System",
    "message": "Emergency trigger processed successfully"
  }
}`}
                    </pre>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-900">Trigger Types</h5>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                      <li><code>panic</code> - Security threat or intruder alert</li>
                      <li><code>fire</code> - Fire detection or alarm</li>
                      <li><code>gas</code> - Gas leak detection</li>
                      <li><code>medical</code> - Medical emergency</li>
                      <li><code>intruder</code> - Unauthorized access</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Trigger Templates</h3>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Template Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Event Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Auto Mustering
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Default
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {triggerTemplates.map((template) => (
                      <tr key={template.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{template.template_name}</div>
                            <div className="text-sm text-gray-500">{template.description}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getTriggerTypeName(template.event_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="space-y-1">
                            {template.actions?.map((action, index) => (
                              <div key={index} className="text-xs">
                                <strong>{action.type}:</strong> {action.action || 'N/A'}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            template.auto_mustering ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {template.auto_mustering ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {template.is_default && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Default
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="text-red-600 hover:text-red-900">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Trigger History</h3>
              
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
                        Initiated By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trigger Source
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {panicButtonHistory.map((event) => (
                      <tr key={event.event_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(event.start_time).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {getTriggerTypeName(event.event_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2 text-gray-600" />
                            <span className="text-sm text-gray-900">
                              {getInitiatedTypeName(event.initiated_type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.trigger_source}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {event.reason || '-'}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmergencyTriggers;
