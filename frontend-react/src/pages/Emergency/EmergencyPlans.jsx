/**
 * Emergency Plans - POB v2.0
 * Emergency response procedures, contacts, and documentation
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Edit, Trash2, Download, Upload, Users, Phone,
  MapPin, Clock, CheckCircle, AlertTriangle, Shield, BookOpen,
  Search, Filter, Calendar
} from 'lucide-react';
import { api } from '../../services/api';

const EmergencyPlans = () => {
  const [plans, setPlans] = useState([]);
  const [zones, setZones] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  // Form state for creating/editing plans
  const [planForm, setPlanForm] = useState({
    planName: '',
    eventType: '',
    zoneId: '',
    steps: '',
    contacts: [
      { name: '', phone: '', role: 'Primary Contact' }
    ]
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, zonesRes] = await Promise.all([
        api.get('/api/emergency/plans/'),
        api.get('/api/v1/zones/')
      ]);
      
      setPlans(plansRes.data.data || []);
      setZones(zonesRes.data.data || []);
    } catch (error) {
      console.error('Error fetching emergency plans data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!planForm.planName.trim()) {
      alert('Plan name is required');
      return;
    }

    if (!planForm.steps.trim()) {
      alert('Plan steps are required');
      return;
    }

    try {
      const requestData = {
        plan_name: planForm.planName,
        event_type: planForm.eventType ? parseInt(planForm.eventType) : null,
        zone_id: planForm.zoneId ? parseInt(planForm.zoneId) : null,
        steps: planForm.steps,
        contacts: planForm.contacts.filter(contact => contact.name.trim() && contact.phone.trim())
      };

      const response = await api.post('/api/emergency/plans/', requestData);
      
      if (response.data.success) {
        alert('Emergency plan created successfully');
        setShowCreateModal(false);
        resetPlanForm();
        fetchData(); // Refresh data
      } else {
        alert('Failed to create emergency plan');
      }
    } catch (error) {
      console.error('Error creating emergency plan:', error);
      alert('Error creating emergency plan');
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      planName: plan.plan_name,
      eventType: plan.event_type?.toString() || '',
      zoneId: plan.zone_id?.toString() || '',
      steps: plan.steps || '',
      contacts: plan.contacts || [{ name: '', phone: '', role: 'Primary Contact' }]
    });
    setShowCreateModal(true);
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;

    try {
      const requestData = {
        plan_name: planForm.planName,
        event_type: planForm.eventType ? parseInt(planForm.eventType) : null,
        zone_id: planForm.zoneId ? parseInt(planForm.zoneId) : null,
        steps: planForm.steps,
        contacts: planForm.contacts.filter(contact => contact.name.trim() && contact.phone.trim())
      };

      const response = await api.put(`/api/emergency/plans/${editingPlan.id}`, requestData);
      
      if (response.data.success) {
        alert('Emergency plan updated successfully');
        setShowCreateModal(false);
        setEditingPlan(null);
        resetPlanForm();
        fetchData(); // Refresh data
      } else {
        alert('Failed to update emergency plan');
      }
    } catch (error) {
      console.error('Error updating emergency plan:', error);
      alert('Error updating emergency plan');
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this emergency plan?')) {
      return;
    }

    try {
      const response = await api.delete(`/api/emergency/plans/${planId}`);
      
      if (response.data.success) {
        alert('Emergency plan deleted successfully');
        fetchData(); // Refresh data
      } else {
        alert('Failed to delete emergency plan');
      }
    } catch (error) {
      console.error('Error deleting emergency plan:', error);
      alert('Error deleting emergency plan');
    }
  };

  const handleAddContact = () => {
    setPlanForm(prev => ({
      ...prev,
      contacts: [...prev.contacts, { name: '', phone: '', role: 'Contact' }]
    }));
  };

  const handleRemoveContact = (index) => {
    setPlanForm(prev => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index)
    }));
  };

  const handleContactChange = (index, field, value) => {
    setPlanForm(prev => ({
      ...prev,
      contacts: prev.contacts.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  const resetPlanForm = () => {
    setPlanForm({
      planName: '',
      eventType: '',
      zoneId: '',
      steps: '',
      contacts: [
        { name: '', phone: '', role: 'Primary Contact' }
      ]
    });
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
    return types[eventType] || 'GENERAL';
  };

  const getEventTypeColor = (eventType) => {
    const colors = {
      0: 'red',
      1: 'orange',
      2: 'yellow',
      3: 'purple',
      4: 'blue',
      5: 'green'
    };
    return colors[eventType] || 'gray';
  };

  // Filter plans
  const filteredPlans = plans.filter(plan => {
    const matchesSearch = !searchTerm || 
      plan.plan_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.steps?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesZone = !filterZone || plan.zone_id === parseInt(filterZone);
    const matchesType = !filterEventType || plan.event_type === parseInt(filterEventType);
    
    return matchesSearch && matchesZone && matchesType;
  });

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
            <h3 className="text-lg font-semibold text-gray-900">Emergency Response Plans</h3>
            <p className="text-sm text-gray-600">Procedures and contacts for emergency situations</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Plan
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plans..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-2">
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
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="0">LOCKDOWN</option>
              <option value="1">FIRE</option>
              <option value="2">GAS</option>
              <option value="3">INTRUDER</option>
              <option value="4">MEDICAL</option>
              <option value="5">ALL_CLEAR</option>
            </select>
          </div>
        </div>
      </div>

      {/* Plans List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Reviewed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPlans.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 mr-3 text-gray-600" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{plan.plan_name}</div>
                        <div className="text-sm text-gray-500 line-clamp-2">
                          {plan.steps?.substring(0, 100)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {plan.event_type !== null ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${getEventTypeColor(plan.event_type)}-100 text-${getEventTypeColor(plan.event_type)}-800`}>
                        {getEventTypeName(plan.event_type)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        GENERAL
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {zones.find(z => z.id === plan.zone_id)?.name || 'Global'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="space-y-1">
                      {plan.contacts?.slice(0, 2).map((contact, index) => (
                        <div key={index} className="flex items-center">
                          <Phone className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="text-xs">{contact.name}: {contact.phone}</span>
                        </div>
                      ))}
                      {plan.contacts?.length > 2 && (
                        <span className="text-xs text-gray-500">
                          +{plan.contacts.length - 2} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.last_reviewed ? new Date(plan.last_reviewed).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPlan ? 'Edit Emergency Plan' : 'Create Emergency Plan'}
              </h3>
              
              <div className="mt-6 space-y-6">
                {/* Plan Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    value={planForm.planName}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, planName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter plan name..."
                  />
                </div>

                {/* Event Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type (optional)
                  </label>
                  <select
                    value={planForm.eventType}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, eventType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select event type...</option>
                    <option value="0">LOCKDOWN</option>
                    <option value="1">FIRE</option>
                    <option value="2">GAS</option>
                    <option value="3">INTRUDER</option>
                    <option value="4">MEDICAL</option>
                    <option value="5">ALL_CLEAR</option>
                  </select>
                </div>

                {/* Zone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zone (optional)
                  </label>
                  <select
                    value={planForm.zoneId}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, zoneId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Global plan</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Emergency Steps */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Steps
                  </label>
                  <textarea
                    value={planForm.steps}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, steps: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={8}
                    placeholder="Enter emergency procedures (markdown format supported)..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You can use markdown formatting for headers, lists, and emphasis
                  </p>
                </div>

                {/* Emergency Contacts */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Emergency Contacts
                    </label>
                    <button
                      onClick={handleAddContact}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Add Contact
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {planForm.contacts.map((contact, index) => (
                      <div key={index} className="flex space-x-2 items-center">
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                          placeholder="Contact name"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={contact.phone}
                          onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                          placeholder="Phone number"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={contact.role}
                          onChange={(e) => handleContactChange(index, 'role', e.target.value)}
                          placeholder="Role"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {planForm.contacts.length > 1 && (
                          <button
                            onClick={() => handleRemoveContact(index)}
                            className="p-2 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingPlan(null);
                    resetPlanForm();
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={editingPlan ? handleUpdatePlan : handleCreatePlan}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyPlans;
