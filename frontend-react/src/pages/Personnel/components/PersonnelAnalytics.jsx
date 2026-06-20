/**
 * PersonnelAnalytics — mini dashboard strip shown above the employee list.
 * Clickable stat cards filter the list; charts show status and type distribution.
 */
import React, { useState } from 'react';
import { Row, Col, Card, Statistic, Tooltip, Skeleton } from 'antd';
import {
  TeamOutlined, SafetyOutlined, EnvironmentOutlined, ToolOutlined,
  MedicineBoxOutlined, ClockCircleOutlined, RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = {
  ACTIVE:   '#22c55e',
  OFFSHORE: '#3b82f6',
  ONSHORE:  '#14b8a6',
  TRANSIT:  '#a855f7',
  ON_LEAVE: '#f59e0b',
  INACTIVE: '#ef4444',
  STAFF:      '#2563eb',
  CONTRACTOR: '#f59e0b',
  VISITOR:    '#8b5cf6',
};

const StatCard = React.forwardRef(({ icon, label, value, color, bg, active, onClick, suffix, trend }, ref) => (
  <div
    ref={ref}
    onClick={onClick}
    style={{
      background: active ? color : '#fff',
      borderRadius: 12,
      padding: '14px 16px',
      border: active ? `2px solid ${color}` : '1px solid #e2e8f0',
      boxShadow: active ? `0 4px 14px ${color}30` : '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.18s',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
  >
    <div style={{
      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
      background: active ? 'rgba(255,255,255,0.2)' : bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: active ? '#fff' : color, fontSize: 18,
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: active ? '#fff' : '#0f172a', lineHeight: 1 }}>
        {value}
        {trend != null && (
          <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 6, color: active ? 'rgba(255,255,255,0.8)' : trend >= 0 ? '#22c55e' : '#ef4444' }}>
            {trend >= 0 ? <RiseOutlined /> : <FallOutlined />}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: active ? 'rgba(255,255,255,0.75)' : '#94a3b8', marginTop: 3, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </div>
    </div>
  </div>
));

const PersonnelAnalytics = ({
  employees = [],
  dashStats,
  loading,
  activeFilterStatus,
  activeFilterType,
  onFilterStatus,
  onFilterType,
}) => {
  const [showCharts, setShowCharts] = useState(false);

  // Compute distributions from loaded slice
  const statusDist = employees.reduce((acc, e) => {
    const s = (e.status || 'ACTIVE').toUpperCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const typeDist = employees.reduce((acc, e) => {
    const t = (e.personnel_type || 'STAFF').toUpperCase();
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const totalPersonnel = dashStats?.total_personnel ?? employees.length;
  const onboardCount   = dashStats?.onboard_count ?? employees.filter(e => e.is_onboard).length;
  const offshoreCount  = dashStats?.offshore_count ?? (statusDist.OFFSHORE || 0);
  const contractorCount = dashStats?.contractor_count ?? (typeDist.CONTRACTOR || 0);
  const safetyCount    = dashStats?.safety_critical_count ?? employees.filter(e => e.safety_critical).length;

  const statusChartData = Object.entries(statusDist).map(([k, v]) => ({ name: k.replace('_', ' '), value: v, color: COLORS[k] || '#94a3b8' }));
  const typeChartData   = Object.entries(typeDist).map(([k, v]) => ({ name: k, value: v, color: COLORS[k] || '#94a3b8' }));

  const STATS = [
    { label: 'Total Personnel', value: totalPersonnel, icon: <TeamOutlined />,          color: '#2563eb', bg: '#eff6ff',  filterStatus: null, filterType: null },
    { label: 'On Board (POB)',  value: onboardCount,   icon: <SafetyOutlined />,         color: '#16a34a', bg: '#f0fdf4',  filterStatus: 'OFFSHORE', filterType: null },
    { label: 'Offshore',        value: offshoreCount,  icon: <EnvironmentOutlined />,     color: '#7c3aed', bg: '#fdf4ff', filterStatus: 'OFFSHORE', filterType: null },
    { label: 'Contractors',     value: contractorCount,icon: <ToolOutlined />,            color: '#d97706', bg: '#fffbeb', filterStatus: null, filterType: 'CONTRACTOR' },
    { label: 'Safety Critical', value: safetyCount,    icon: <MedicineBoxOutlined />,     color: '#dc2626', bg: '#fef2f2', filterStatus: null, filterType: null },
  ];

  if (loading) {
    return (
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {STATS.map((_, i) => (
          <Col key={i} xs={12} sm={8} md={Math.floor(24 / STATS.length)}>
            <Card size="small"><Skeleton active paragraph={false} /></Card>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]}>
        {STATS.map(s => (
          <Col key={s.label} xs={12} sm={8} md={Math.floor(24 / STATS.length)}>
            <Tooltip title={s.filterStatus || s.filterType ? `Click to filter by ${s.label.toLowerCase()}` : ''}>
              <StatCard
                icon={s.icon}
                label={s.label}
                value={s.value}
                color={s.color}
                bg={s.bg}
                active={
                  (s.filterStatus && activeFilterStatus === s.filterStatus) ||
                  (s.filterType && activeFilterType === s.filterType)
                }
                onClick={s.filterStatus || s.filterType ? () => {
                  if (s.filterStatus) onFilterStatus(activeFilterStatus === s.filterStatus ? null : s.filterStatus);
                  if (s.filterType) onFilterType(activeFilterType === s.filterType ? null : s.filterType);
                } : undefined}
              />
            </Tooltip>
          </Col>
        ))}
      </Row>

      {/* Expandable charts row */}
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <button
          type="button"
          onClick={() => setShowCharts(v => !v)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: '2px 8px', borderRadius: 6 }}
        >
          {showCharts ? '▲ Hide charts' : '▼ Show distribution charts'}
        </button>
      </div>

      {showCharts && (
        <Row gutter={12} style={{ marginTop: 8 }}>
          {/* Status bar chart */}
          <Col xs={24} md={14}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px 4px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Status Distribution
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={statusChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ReTip formatter={(v, name) => [v, name]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>

          {/* Type pie chart */}
          <Col xs={24} md={10}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px 4px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Personnel Type
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={typeChartData} cx="40%" cy="50%" innerRadius={28} outerRadius={50} dataKey="value" paddingAngle={3}>
                    {typeChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <ReTip formatter={(v, name) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default PersonnelAnalytics;
