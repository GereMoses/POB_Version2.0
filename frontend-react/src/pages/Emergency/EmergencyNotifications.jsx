/**
 * Emergency Notifications - POB v2.0
 * Mass notification system with templates, channels, and delivery tracking
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, Mail, MessageSquare, Smartphone, Megaphone, AlertTriangle,
  Send, Clock, CheckCircle, XCircle, Users, MapPin, FileText,
  Plus, Edit, Trash2, Download, Filter
} from 'lucide-react';
import { api } from '../../services/api';

const EmergencyNotifications = () => {
  const [activeTab, setActiveTab] = useState('send');
  const [templates, setTemplates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingInProgress, setSendingInProgress] = useState(false);
  // Which channels have a configured gateway on the server (email/sms/whatsapp)
  const [channelConfig, setChannelConfig] = useState({ email: false, sms: false, whatsapp: false });
  // Send-test control
  const [testChannel, setTestChannel] = useState('email');
  const [testAddress, setTestAddress] = useState('');
  const [testInProgress, setTestInProgress] = useState(false);
  const [testResult, setTestResult] = useState(null);
  
  // Send notification form
  const [notificationForm, setNotificationForm] = useState({
    templateId: '',
    eventType: 0,
    channels: {
      sms: false,
      email: false,
      whatsapp: false,
      push: false,
      pa: false,
      siren: false
    },
    recipients: {
      type: 'all',
      zones: [],
      departments: [],
      users: []
    },
    customMessage: ''
  });

  // Template form
  const [templateForm, setTemplateForm] = useState({
    templateName: '',
    eventType: 0,
    description: '',
    actions: [],
    notifyChannels: {},
    autoMustering: true,
    autoMusteringZoneId: ''
  });

  // Filters
  const [filters, setFilters] = useState({
    eventType: '',
    status: '',
    channel: '',
    dateRange: ''
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [templatesRes, notificationsRes, zonesRes, configRes] = await Promise.all([
        api.get('/api/emergency/templates/'),
        api.get('/api/emergency/notifications/'),
        api.get('/api/v1/zones/'),
        api.get('/api/emergency/notify/config').catch(() => null)
      ]);

      setTemplates(templatesRes.data.data || []);
      setNotifications(notificationsRes.data.data || []);
      setZones(zonesRes.data.data || []);
      if (configRes?.data?.data) {
        setChannelConfig(configRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching notification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (testInProgress) return;
    if (!testAddress.trim()) {
      alert('Enter an email address or phone number to send the test to.');
      return;
    }
    try {
      setTestInProgress(true);
      setTestResult(null);
      const response = await api.post('/api/emergency/notify/test', {
        channel: testChannel,
        address: testAddress.trim()
      });
      setTestResult(response.data.data || { error: 'No response' });
    } catch (error) {
      const detail = error?.response?.data?.detail || error.message || 'Test failed';
      setTestResult({ sent: 0, error: detail });
    } finally {
      setTestInProgress(false);
    }
  };

  const handleSendNotification = async () => {
    if (sendingInProgress) return;

    // Validate form
    const activeChannels = Object.entries(notificationForm.channels)
      .filter(([_, enabled]) => enabled)
      .map(([channel, _]) => channel);

    if (activeChannels.length === 0) {
      alert('Please select at least one notification channel');
      return;
    }

    if (!notificationForm.templateId && !notificationForm.customMessage.trim()) {
      alert('Please select a template or enter a custom message');
      return;
    }

    try {
      setSendingInProgress(true);
      
      const requestData = {
        template_id: notificationForm.templateId ? parseInt(notificationForm.templateId) : null,
        event_type: notificationForm.eventType,
        channels: notificationForm.channels,
        recipients: notificationForm.recipients,
        message: notificationForm.customMessage || undefined
      };

      const response = await api.post('/api/emergency/notify/', requestData);
      
      if (response.data.success) {
        alert(
          `Emergency notification sent successfully!\n` +
          `Event ID: ${response.data.data.emergency_event_id}\n` +
          `Notifications sent: ${response.data.data.notifications_sent}`
        );
        
        // Reset form
        setNotificationForm({
          templateId: '',
          eventType: 0,
          channels: {
            sms: false,
            email: false,
            whatsapp: false,
            push: false,
            pa: false,
            siren: false
          },
          recipients: {
            type: 'all',
            zones: [],
            departments: [],
            users: []
          },
          customMessage: ''
        });
        
        // Refresh data
        fetchData();
      } else {
        alert('Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Error sending notification');
    } finally {
      setSendingInProgress(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateForm.templateName.trim()) {
      alert('Template name is required');
      return;
    }

    try {
      const requestData = {
        template_name: templateForm.templateName,
        event_type: templateForm.eventType,
        description: templateForm.description,
        actions: templateForm.actions,
        notify_channels: templateForm.notifyChannels,
        auto_mustering: templateForm.autoMustering,
        auto_mustering_zone_id: templateForm.autoMusteringZoneId ? parseInt(templateForm.autoMusteringZoneId) : null
      };

      const response = await api.post('/api/emergency/templates/', requestData);
      
      if (response.data.success) {
        alert('Emergency template created successfully');
        
        // Reset form
        setTemplateForm({
          templateName: '',
          eventType: 0,
          description: '',
          actions: [],
          notifyChannels: {},
          autoMustering: true,
          autoMusteringZoneId: ''
        });
        
        // Refresh data
        fetchData();
        setActiveTab('templates');
      } else {
        alert('Failed to create template');
      }
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Error creating template');
    }
  };

  const handleChannelToggle = (channel) => {
    setNotificationForm(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: !prev.channels[channel]
      }
    }));
  };

  const handleRecipientTypeChange = (type) => {
    setNotificationForm(prev => ({
      ...prev,
      recipients: {
        ...prev.recipients,
        type,
        zones: type === 'zones' ? [] : prev.recipients.zones,
        departments: type === 'departments' ? [] : prev.recipients.departments,
        users: type === 'users' ? [] : prev.recipients.users
      }
    }));
  };

  const getChannelIcon = (channel) => {
    const icons = {
      sms: MessageSquare,
      email: Mail,
      whatsapp: MessageSquare,
      push: Smartphone,
      pa: Megaphone,
      siren: Bell
    };
    return icons[channel] || Bell;
  };

  const getChannelName = (channel) => {
    const names = {
      sms: 'SMS',
      email: 'Email',
      whatsapp: 'WhatsApp',
      push: 'Push',
      pa: 'PA System',
      siren: 'Siren'
    };
    return names[channel] || channel;
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'yellow',
      SENT: 'blue',
      DELIVERED: 'green',
      FAILED: 'red'
    };
    return colors[status] || 'gray';
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
              { id: 'send', name: 'Send Notification', icon: Send },
              { id: 'templates', name: 'Templates', icon: FileText },
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
          {/* Send Notification Tab */}
          {activeTab === 'send' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Send Emergency Notification</h3>
              
              {/* Template Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template (optional)
                </label>
                <select
                  value={notificationForm.templateId}
                  onChange={(e) => setNotificationForm(prev => ({ ...prev, templateId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select template...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.template_name} - {getEventTypeName(template.event_type)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Message
                </label>
                <textarea
                  value={notificationForm.customMessage}
                  onChange={(e) => setNotificationForm(prev => ({ ...prev, customMessage: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter custom emergency message..."
                />
              </div>

              {/* Channel Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Channels
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(notificationForm.channels).map(([channel, enabled]) => {
                    const Icon = getChannelIcon(channel);
                    // Only email/sms/whatsapp have a server-side gateway to report on.
                    const tracked = Object.prototype.hasOwnProperty.call(channelConfig, channel);
                    const notConfigured = tracked && !channelConfig[channel];
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => handleChannelToggle(channel)}
                        title={notConfigured ? `${getChannelName(channel)} gateway is not configured on the server` : ''}
                        className={`flex items-center justify-between p-3 border rounded-lg transition-colors duration-200 ${
                          enabled
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400 text-gray-700'
                        }`}
                      >
                        <span className="flex items-center">
                          <Icon className="w-5 h-5 mr-2" />
                          <span className="font-medium">{getChannelName(channel)}</span>
                        </span>
                        {notConfigured && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                            Not set up
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Channels marked <span className="font-semibold text-amber-600">Not set up</span> have no
                  gateway configured on the server and will not deliver. Configure SMTP / SMS / WhatsApp
                  env vars and restart the backend to enable them.
                </p>
              </div>

              {/* Recipient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipients
                </label>
                <div className="space-y-4">
                  <div className="flex space-x-4">
                    {['all', 'zones', 'departments', 'users'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleRecipientTypeChange(type)}
                        className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                          notificationForm.recipients.type === type
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {type === 'all' ? 'All Personnel' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>

                  {notificationForm.recipients.type === 'zones' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {zones.map((zone) => (
                        <label key={zone.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={notificationForm.recipients.zones.includes(zone.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNotificationForm(prev => ({
                                  ...prev,
                                  recipients: {
                                    ...prev.recipients,
                                    zones: [...prev.recipients.zones, zone.id]
                                  }
                                }));
                              } else {
                                setNotificationForm(prev => ({
                                  ...prev,
                                  recipients: {
                                    ...prev.recipients,
                                    zones: prev.recipients.zones.filter(id => id !== zone.id)
                                  }
                                }));
                              }
                            }}
                            className="rounded border-gray-300 mr-2"
                          />
                          <span className="text-sm">{zone.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendNotification}
                disabled={sendingInProgress}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {sendingInProgress ? 'Sending...' : 'Send Emergency Notification'}
              </button>

              {/* ── Send a test to verify a gateway ─────────────────────────── */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Test a channel</h4>
                <p className="text-xs text-gray-500 mb-3">
                  Send a single test message to yourself to confirm a gateway is wired up correctly.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={testChannel}
                    onChange={(e) => { setTestChannel(e.target.value); setTestResult(null); }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="email">Email {channelConfig.email ? '' : '(not set up)'}</option>
                    <option value="sms">SMS {channelConfig.sms ? '' : '(not set up)'}</option>
                    <option value="whatsapp">WhatsApp {channelConfig.whatsapp ? '' : '(not set up)'}</option>
                  </select>
                  <input
                    type="text"
                    value={testAddress}
                    onChange={(e) => setTestAddress(e.target.value)}
                    placeholder={testChannel === 'email' ? 'you@example.com' : '+2348012345678'}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={testInProgress}
                    className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {testInProgress ? 'Sending…' : 'Send test'}
                  </button>
                </div>
                {testResult && (
                  <div className={`mt-3 flex items-start text-sm rounded-md p-2 ${
                    testResult.sent ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}>
                    {testResult.sent
                      ? <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />}
                    <span>
                      {testResult.sent
                        ? `Test sent successfully to ${testResult.address}.`
                        : `Test failed: ${testResult.error || 'unknown error'}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Emergency Templates</h3>
                <button
                  onClick={() => setActiveTab('create-template')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                >
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
                        Channels
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
                    {templates.map((template) => (
                      <tr key={template.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{template.template_name}</div>
                            <div className="text-sm text-gray-500">{template.description}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getEventTypeName(template.event_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-1">
                            {Object.entries(template.notify_channels || {}).map(([channel, enabled]) => {
                              if (!enabled) return null;
                              const Icon = getChannelIcon(channel);
                              return (
                                <Icon key={channel} className="w-4 h-4 text-gray-600" title={getChannelName(channel)} />
                              );
                            })}
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
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Notification History</h3>
                <div className="flex space-x-2">
                  <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter
                  </button>
                  <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Channel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recipient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Message
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sent Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {notifications.map((notification) => {
                      const Icon = getChannelIcon(notification.channel_name.toLowerCase());
                      return (
                        <tr key={notification.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(notification.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Icon className="w-4 h-4 mr-2 text-gray-600" />
                              <span className="text-sm">{notification.channel_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {notification.recipient_addr}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {notification.message}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(notification.status_name)}-100 text-${getStatusColor(notification.status_name)}-800`}>
                              {notification.status_name}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {notification.sent_time ? new Date(notification.sent_time).toLocaleString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Template Modal (simplified) */}
      {activeTab === 'create-template' && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900">Create Emergency Template</h3>
              
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateForm.templateName}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, templateName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter template name..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type
                  </label>
                  <select
                    value={templateForm.eventType}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, eventType: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={0}>LOCKDOWN</option>
                    <option value={1}>FIRE</option>
                    <option value={2}>GAS</option>
                    <option value={3}>INTRUDER</option>
                    <option value={4}>MEDICAL</option>
                    <option value={5}>ALL_CLEAR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter template description..."
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setActiveTab('templates')}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyNotifications;
