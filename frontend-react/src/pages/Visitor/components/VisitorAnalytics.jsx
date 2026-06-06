/**
 * Visitor Analytics Dashboard Component
 * BioTime 9.5 compatible visitor analytics with POB extensions
 * Comprehensive visitor analytics with real-time insights and trends
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Clock, 
  Calendar, 
  MapPin, 
  BarChart3, 
  PieChart, 
  Activity,
  Eye,
  Shield,
  AlertTriangle,
  UserCheck,
  UserX,
  Filter,
  Download,
  RefreshCw,
  Building,
  HardHat
} from 'lucide-react';
import { visitorAPI } from '../../../services/visitorAPI';

const VisitorAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedMetric, setSelectedMetric] = useState('overview');
  const [timeFilter, setTimeFilter] = useState('30d');

  // Load analytics data
  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange, selectedMetric, timeFilter]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      // TODO: Implement actual analytics API
      // const response = await visitorAPI.getAnalytics({
      //   start_date: dateRange.startDate,
      //   end_date: dateRange.endDate,
      //   metric: selectedMetric,
      //   time_filter: timeFilter
      // });
      
      // Mock data for demonstration
      const mockData = {
        overview: {
          total_visitors: 1247,
          active_visitors: 45,
          total_visits: 1892,
          average_visit_duration: 2.3,
          compliance_rate: 94.2,
          blacklist_count: 12,
          overstay_rate: 3.1,
          satisfaction_score: 4.6
        },
        trends: {
          daily_visits: [
            { date: '2024-01-01', count: 45 },
            { date: '2024-01-02', count: 52 },
            { date: '2024-01-03', count: 38 },
            { date: '2024-01-04', count: 61 },
            { date: '2024-01-05', count: 47 },
            { date: '2024-01-06', count: 55 },
            { date: '2024-01-07', count: 49 }
          ],
          visitor_types: [
            { type: 'Contractor', count: 623, percentage: 50.0 },
            { type: 'Vendor', count: 311, percentage: 25.0 },
            { type: 'Interview', count: 187, percentage: 15.0 },
            { type: 'VIP', count: 87, percentage: 7.0 },
            { type: 'Delivery', count: 39, percentage: 3.0 }
          ],
          peak_hours: [
            { hour: '08:00', count: 85 },
            { hour: '09:00', count: 124 },
            { hour: '10:00', count: 98 },
            { hour: '11:00', count: 76 },
            { hour: '12:00', count: 45 },
            { hour: '13:00', count: 67 },
            { hour: '14:00', count: 89 },
            { hour: '15:00', count: 72 },
            { hour: '16:00', count: 58 },
            { hour: '17:00', count: 41 }
          ],
          monthly_trend: [
            { month: 'Jan', visitors: 1247, visits: 1892 },
            { month: 'Feb', visitors: 1156, visits: 1723 },
            { month: 'Mar', visitors: 1324, visits: 1987 },
            { month: 'Apr', visitors: 1089, visits: 1634 },
            { month: 'May', visitors: 1456, visits: 2184 },
            { month: 'Jun', visitors: 1234, visits: 1851 }
          ]
        },
        compliance: {
          pre_registration_rate: 78.5,
          approval_rate: 92.3,
          check_in_rate: 95.1,
          safety_induction_rate: 67.8,
          mustering_compliance: 94.2,
          access_control_compliance: 96.5
        },
        security: {
          blacklist_hits: 23,
          overstay_incidents: 45,
          security_alerts: 12,
          access_violations: 8,
          incident_trend: 'decreasing'
        },
        performance: {
          average_check_in_time: 3.2, // minutes
          average_check_out_time: 2.1,
          badge_print_success_rate: 98.7,
          device_sync_success_rate: 99.2,
          qr_scan_success_rate: 94.5
        }
      };
      
      setAnalyticsData(mockData);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      // TODO: Implement analytics export
      console.log(`Exporting analytics as ${format}`);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getTrendIcon = (current, previous) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
  };

  const getComplianceColor = (rate) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    if (rate >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const OverviewCards = () => {
    if (!analyticsData?.overview) return null;

    const { overview } = analyticsData;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Visitors</p>
              <p className="text-2xl font-bold text-gray-900">{overview.total_visitors.toLocaleString()}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">+12.5% from last month</span>
              </div>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Visitors</p>
              <p className="text-2xl font-bold text-orange-600">{overview.active_visitors}</p>
              <div className="flex items-center mt-2">
                <Activity className="w-4 h-4 text-orange-500 mr-1" />
                <span className="text-sm text-gray-600">Currently on-site</span>
              </div>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <Eye className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Compliance Rate</p>
              <p className={`text-2xl font-bold ${getComplianceColor(overview.compliance_rate)}`}>
                {overview.compliance_rate}%
              </p>
              <div className="flex items-center mt-2">
                <Shield className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">Good standing</span>
              </div>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Visit Duration</p>
              <p className="text-2xl font-bold text-gray-900">{overview.average_visit_duration}h</p>
              <div className="flex items-center mt-2">
                <Clock className="w-4 h-4 text-blue-500 mr-1" />
                <span className="text-sm text-blue-600">Within limits</span>
              </div>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const VisitorTypesChart = () => {
    if (!analyticsData?.trends?.visitor_types) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Visitor Types Distribution</h3>
        <div className="space-y-3">
          {analyticsData.trends.visitor_types.map((type, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  type.type === 'Contractor' ? 'bg-orange-500' :
                  type.type === 'Vendor' ? 'bg-blue-500' :
                  type.type === 'Interview' ? 'bg-green-500' :
                  type.type === 'VIP' ? 'bg-purple-500' :
                  'bg-gray-500'
                }`} />
                <span className="text-sm font-medium text-gray-900">{type.type}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-600 mr-3">{type.count}</span>
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${type.percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 ml-2">{type.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PeakHoursChart = () => {
    if (!analyticsData?.trends?.peak_hours) return null;

    const maxCount = Math.max(...analyticsData.trends.peak_hours.map(h => h.count));

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Peak Visit Hours</h3>
        <div className="h-48 flex items-end space-x-1">
          {analyticsData.trends.peak_hours.map((hour, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div 
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${(hour.count / maxCount) * 100}%` }}
              />
              <span className="text-xs text-gray-600 mt-1">{hour.hour}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const ComplianceMetrics = () => {
    if (!analyticsData?.compliance) return null;

    const { compliance } = analyticsData;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Pre-Registration Rate</span>
              <span className={`text-sm font-medium ${getComplianceColor(compliance.pre_registration_rate)}`}>
                {compliance.pre_registration_rate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Approval Rate</span>
              <span className={`text-sm font-medium ${getComplianceColor(compliance.approval_rate)}`}>
                {compliance.approval_rate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Check-in Rate</span>
              <span className={`text-sm font-medium ${getComplianceColor(compliance.check_in_rate)}`}>
                {compliance.check_in_rate}%
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Safety Induction Rate</span>
              <span className={`text-sm font-medium ${getComplianceColor(compliance.safety_induction_rate)}`}>
                {compliance.safety_induction_rate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Mustering Compliance</span>
              <span className={`text-sm font-medium ${getComplianceColor(compliance.mustering_compliance)}`}>
                {compliance.mustering_compliance}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Access Control Compliance</span>
              <span className={`text-sm font-medium ${getComplianceColor(compliance.access_control_compliance)}`}>
                {compliance.access_control_compliance}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SecurityAlerts = () => {
    if (!analyticsData?.security) return null;

    const { security } = analyticsData;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-2xl font-bold text-red-600">{security.blacklist_hits}</span>
            </div>
            <p className="text-sm text-gray-600">Blacklist Hits</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-orange-500 mr-2" />
              <span className="text-2xl font-bold text-orange-600">{security.overstay_incidents}</span>
            </div>
            <p className="text-sm text-gray-600">Overstay Incidents</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Shield className="w-5 h-5 text-yellow-500 mr-2" />
              <span className="text-2xl font-bold text-yellow-600">{security.security_alerts}</span>
            </div>
            <p className="text-sm text-gray-600">Security Alerts</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <UserX className="w-5 h-5 text-purple-500 mr-2" />
              <span className="text-2xl font-bold text-purple-600">{security.access_violations}</span>
            </div>
            <p className="text-sm text-gray-600">Access Violations</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <div className="flex items-center">
            <TrendingDown className="w-4 h-4 text-green-600 mr-2" />
            <span className="text-sm text-green-800">
              Security incidents are decreasing by 15% compared to last month
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Visitor Analytics</h2>
          <p className="text-gray-600 mt-1">Comprehensive visitor insights and trends</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadAnalyticsData}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Filter</label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metric</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="overview">Overview</option>
              <option value="trends">Trends</option>
              <option value="compliance">Compliance</option>
              <option value="security">Security</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading analytics data...
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <OverviewCards />

          {/* Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <VisitorTypesChart />
            <PeakHoursChart />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ComplianceMetrics />
            <SecurityAlerts />
          </div>
        </>
      )}
    </div>
  );
};

export default VisitorAnalytics;
