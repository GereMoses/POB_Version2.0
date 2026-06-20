import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Modal, Form, Row, Col, Tag,
  Popconfirm, DatePicker, Select, InputNumber, Tabs, Switch,
  Alert, Tooltip, Divider, Empty, App, Avatar, Typography, Drawer, Badge, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  GiftOutlined, TeamOutlined, CheckCircleOutlined, CloseCircleOutlined,
  StopOutlined, SyncOutlined, SearchOutlined, FilterOutlined,
  DownloadOutlined, ApartmentOutlined, BarChartOutlined,
  CloseOutlined, MoreOutlined, DollarOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Text } = Typography;

// ── Constants ──────────────────────────────────────────────────────────────────
const BENEFIT_TYPES = [
  'health_insurance', 'dental_insurance', 'vision_insurance', 'life_insurance',
  'pension', 'retirement_401k', 'paid_time_off', 'sick_leave',
  'housing_allowance', 'transportation', 'meal_allowance',
  'disability_insurance', 'tuition_reimbursement', 'other',
];
const ELIGIBILITY_TYPES = [
  'all_employees', 'full_time_only', 'part_time_only',
  'per_department', 'tenure_based', 'salary_based',
];
const ENROLL_STATUSES = ['active', 'inactive', 'waived', 'cancelled'];

const TYPE_CFG = {
  health_insurance:      { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  dental_insurance:      { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  vision_insurance:      { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  life_insurance:        { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' },
  pension:               { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  retirement_401k:       { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  paid_time_off:         { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  sick_leave:            { color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
  housing_allowance:     { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa' },
  transportation:        { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  meal_allowance:        { color: '#65a30d', bg: '#f7fee7', border: '#d9f99d' },
  disability_insurance:  { color: '#6b21a8', bg: '#f5f3ff', border: '#ddd6fe' },
  tuition_reimbursement: { color: '#9a3412', bg: '#ffedd5', border: '#fed7aa' },
  other:                 { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};
const STATUS_CFG = {
  active:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Active'    },
  inactive:  { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Inactive'  },
  waived:    { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Waived'    },
  cancelled: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Cancelled' },
};
const PERS_TYPE_CFG = {
  STAFF:      { color: '#1d4ed8', bg: '#dbeafe' },
  CONTRACTOR: { color: '#c2410c', bg: '#ffedd5' },
  VISITOR:    { color: '#0891b2', bg: '#cffafe' },
};
const CHART_PALETTE = [
  '#2563eb','#7c3aed','#dc2626','#16a34a','#d97706',
  '#0891b2','#be185d','#65a30d','#9333ea','#0f766e',
  '#ea580c','#1d4ed8','#c2410c','#64748b',
];

const AVATAR_PALETTE = [
  '#2563eb','#7c3aed','#db2777','#059669','#d97706',
  '#dc2626','#0891b2','#65a30d','#9333ea','#0f766e',
];
const avatarColor = name => AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = name => (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const lbl         = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const exportCSV = (columns, rows, filename) => {
  const headers = columns.map(c => `"${c.title}"`).join(',');
  const body = rows.map(r =>
    columns.map(c => {
      const raw = typeof c.exportValue === 'function' ? c.exportValue(r) : (r[c.dataIndex] ?? '');
      return `"${String(raw).replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\n');
  const blob = new Blob([headers + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── Pills ──────────────────────────────────────────────────────────────────────
const TypePill = ({ type }) => {
  if (!type) return null;
  const cfg = TYPE_CFG[type] || TYPE_CFG.other;
  return (
    <span style={{
      display: 'inline-block', background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {lbl(type)}
    </span>
  );
};

const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: lbl(status) };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

// ── Employee cell ──────────────────────────────────────────────────────────────
const EmployeeCell = ({ name, empCode, type, department, onClick }) => {
  const typeCfg = PERS_TYPE_CFG[type] || PERS_TYPE_CFG.STAFF;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <Avatar size={30} style={{ background: avatarColor(name), fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
        {initials(name)}
      </Avatar>
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{name || '—'}</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
          {empCode && (
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#94a3b8', background: '#f3f4f6', borderRadius: 3, padding: '0 4px' }}>
              {empCode}
            </span>
          )}
          {type && type !== 'STAFF' && (
            <span style={{ fontSize: 9, fontWeight: 700, background: typeCfg.bg, color: typeCfg.color, borderRadius: 3, padding: '0 5px' }}>
              {type}
            </span>
          )}
          {department && <span style={{ fontSize: 9, color: '#94a3b8' }}>{department}</span>}
        </div>
      </div>
    </div>
  );
};

// ── Bulk bar ───────────────────────────────────────────────────────────────────
const BulkBar = ({ count, label: barLabel, onClear, onDelete, deletePending }) =>
  count > 0 ? (
    <div style={{
      background: '#0891b2', borderRadius: 10, padding: '10px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 12px rgba(8,145,178,0.3)',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
        {count} {barLabel || 'item'}{count !== 1 ? 's' : ''} selected
      </span>
      <div style={{ flex: 1 }} />
      <Popconfirm title={`Delete ${count} item(s)?`} description="This cannot be undone."
        onConfirm={onDelete} okText="Delete" okButtonProps={{ danger: true }}>
        <Button size="small" danger icon={<DeleteOutlined />} loading={deletePending}
          style={{ borderRadius: 6, background: '#dc2626', border: 'none', color: '#fff' }}>
          Delete
        </Button>
      </Popconfirm>
      <Button size="small" icon={<CloseOutlined />} onClick={onClear}
        style={{ borderRadius: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }} />
    </div>
  ) : null;

// ── Enrollment detail drawer ───────────────────────────────────────────────────
const EnrollmentDrawer = ({ record, onClose, onAction, onEdit, actionPending }) => {
  if (!record) return null;
  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={34} style={{ background: avatarColor(record.personnel_name), fontSize: 11, fontWeight: 700 }}>
            {initials(record.personnel_name)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{record.personnel_name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{record.plan_name}</div>
          </div>
        </div>
      }
      open={!!record} onClose={onClose} width={400}
      bodyStyle={{ padding: 20 }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatusPill status={record.status} />
        {record.benefit_type && <TypePill type={record.benefit_type} />}
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        <Row gutter={12}>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Plan Code</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{record.plan_code || '—'}</Text>
          </Col>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Coverage</Text>
            <Text style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>
              {record.coverage_amount ? `${Number(record.coverage_amount).toLocaleString()}` : '—'}
            </Text>
          </Col>
        </Row>
        <Row gutter={12} style={{ marginTop: 10 }}>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Enrolled</Text>
            <Text style={{ fontSize: 12 }}>{record.enrollment_date ? dayjs(record.enrollment_date).format('DD MMM YYYY') : '—'}</Text>
          </Col>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Effective</Text>
            <Text style={{ fontSize: 12 }}>{record.effective_date ? dayjs(record.effective_date).format('DD MMM YYYY') : '—'}</Text>
          </Col>
        </Row>
        {record.dependent_count > 0 && (
          <Row style={{ marginTop: 10 }}>
            <Col span={24}>
              <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Dependents</Text>
              <span style={{ fontSize: 12, fontWeight: 700, background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 6, padding: '2px 10px' }}>
                {record.dependent_count} dependent{record.dependent_count !== 1 ? 's' : ''}
              </span>
            </Col>
          </Row>
        )}
      </div>

      {record.department_name && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <ApartmentOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
          <Text style={{ fontSize: 12 }}>{record.department_name}</Text>
        </div>
      )}

      <Divider style={{ margin: '14px 0 10px' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {record.status === 'active' && (
          <>
            <Button icon={<StopOutlined />} size="small" loading={actionPending}
              onClick={() => onAction(record.id, 'waive')} style={{ borderRadius: 7 }}>
              Waive
            </Button>
            <Button danger icon={<CloseCircleOutlined />} size="small" loading={actionPending}
              onClick={() => onAction(record.id, 'cancel')} style={{ borderRadius: 7 }}>
              Cancel
            </Button>
          </>
        )}
        {['waived', 'cancelled', 'inactive'].includes(record.status) && (
          <Button type="primary" icon={<SyncOutlined />} size="small" loading={actionPending}
            onClick={() => onAction(record.id, 'reactivate')}
            style={{ borderRadius: 7, background: '#16a34a', borderColor: '#16a34a' }}>
            Reactivate
          </Button>
        )}
        <Button icon={<EditOutlined />} size="small" onClick={() => { onClose(); onEdit(record); }} style={{ borderRadius: 7 }}>
          Edit
        </Button>
      </div>
    </Drawer>
  );
};

// ── Analytics tab ──────────────────────────────────────────────────────────────
const AnalyticsTab = ({ plans, enrollments, summary }) => {
  const { typeDist, statusDist, topPlansDist, deptDist } = useMemo(() => {
    const sCounts = {}, pCounts = {}, dCounts = {};

    enrollments.forEach(e => {
      sCounts[e.status] = (sCounts[e.status] || 0) + 1;
      const pName = e.plan_name || `Plan ${e.plan_id}`;
      pCounts[pName] = (pCounts[pName] || 0) + 1;
      const dept = e.department_name || 'No Dept';
      if (!dCounts[dept]) dCounts[dept] = { total: 0, active: 0 };
      dCounts[dept].total++;
      if (e.status === 'active') dCounts[dept].active++;
    });

    const tCounts = {};
    plans.forEach(p => {
      const bt = p.benefit_type || 'other';
      tCounts[bt] = (tCounts[bt] || 0) + 1;
    });

    const typeDist     = Object.entries(tCounts).map(([k, v]) => ({ name: lbl(k), value: v, fill: TYPE_CFG[k]?.color || '#94a3b8' })).filter(d => d.value > 0);
    const statusDist   = ENROLL_STATUSES.filter(s => sCounts[s]).map(s => ({ name: STATUS_CFG[s]?.label || lbl(s), value: sCounts[s], fill: STATUS_CFG[s]?.color || '#94a3b8' }));
    const topPlansDist = Object.entries(pCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: name.length > 22 ? name.slice(0, 20) + '…' : name, count }));
    const deptDist     = Object.entries(dCounts).sort((a, b) => b[1].total - a[1].total).slice(0, 12)
      .map(([dept, d]) => ({ name: dept.length > 18 ? dept.slice(0, 16) + '…' : dept, ...d }));

    return { typeDist, statusDist, topPlansDist, deptDist };
  }, [plans, enrollments]);

  if (!plans.length && !enrollments.length) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <BarChartOutlined style={{ fontSize: 40, color: '#cbd5e1' }} />
      <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>No benefit data to visualize</div>
    </div>
  );

  const card    = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16 };
  const sTitle  = t => <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t}</div>;
  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.07) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        {/* Plan type distribution */}
        {typeDist.length > 0 && (
          <Col xs={24} md={10}>
            <div style={card}>
              {sTitle('Plan Type Distribution')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={typeDist} dataKey="value" cx="50%" cy="50%" innerRadius={44} outerRadius={72} labelLine={false} label={CustomPieLabel}>
                      {typeDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflow: 'auto' }}>
                  {typeDist.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                        <Text style={{ fontSize: 9, color: '#374151' }}>{d.name}</Text>
                      </div>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{d.value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Col>
        )}

        {/* Enrollment status */}
        {statusDist.length > 0 && (
          <Col xs={24} md={14}>
            <div style={card}>
              {sTitle('Enrollment Status')}
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={statusDist} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Enrollments']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Enrollments">
                    {statusDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}

        {/* Top plans by enrollment */}
        {topPlansDist.length > 0 && (
          <Col xs={24} md={14}>
            <div style={card}>
              {sTitle('Top Plans by Active Enrollment')}
              <ResponsiveContainer width="100%" height={Math.max(180, topPlansDist.length * 36)}>
                <BarChart data={topPlansDist} layout="vertical" margin={{ left: 4, right: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={120} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Enrolled']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}

        {/* Enrollments by department */}
        {deptDist.length > 0 && (
          <Col xs={24} md={10}>
            <div style={card}>
              {sTitle('Enrollments by Department')}
              <ResponsiveContainer width="100%" height={Math.max(180, deptDist.length * 30)}>
                <BarChart data={deptDist} layout="vertical" margin={{ left: 4, right: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={90} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={(v, n, p) => [`${v} (active: ${p.payload.active})`, 'Total']} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}
      </Row>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const BenefitsManagement = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('plans');

  // Plan filters
  const [planSearch,  setPlanSearch]  = useState('');
  const [filterType,  setFilterType]  = useState(null);

  // Enrollment filters
  const [enrollSearch,  setEnrollSearch]  = useState('');
  const [filterStatus,  setFilterStatus]  = useState(null);
  const [filterPlan,    setFilterPlan]    = useState(null);
  const [filterDept,    setFilterDept]    = useState('');

  // Selection
  const [selectedPlanKeys,   setSelectedPlanKeys]   = useState([]);
  const [selectedEnrollKeys, setSelectedEnrollKeys] = useState([]);

  // Detail drawer
  const [detailEnroll, setDetailEnroll] = useState(null);

  // Plan modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan,   setEditingPlan]   = useState(null);
  const [planForm] = Form.useForm();

  // Enrollment modal
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [editingEnroll,   setEditingEnroll]   = useState(null);
  const [enrollForm] = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: plans = [], isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ['benefit-plans'],
    queryFn:  () => apiService.get('/api/v1/personnel/benefits/plans?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });
  const { data: enrollments = [], isLoading: enrollLoading, refetch: refetchEnroll } = useQuery({
    queryKey: ['benefit-enrollments'],
    queryFn:  () => apiService.get('/api/v1/personnel/benefits/enrollments?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });
  const { data: summary = {} } = useQuery({
    queryKey: ['benefit-summary'],
    queryFn:  () => apiService.get('/api/v1/personnel/benefits/plans/meta/summary'),
    staleTime: 60000,
  });
  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel-list-benefits'],
    queryFn:  () => apiService.get('/api/v1/personnel/?limit=1000'),
    staleTime: 300000,
    select: d => Array.isArray(d) ? d : (d?.results || d?.data || []),
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const inv    = useCallback((...keys) => keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] })), [queryClient]);
  const invAll = useCallback(() => inv('benefit-plans', 'benefit-enrollments', 'benefit-summary'), [inv]);

  const deptOptions = useMemo(() =>
    [...new Set(enrollments.map(e => e.department_name).filter(Boolean))].sort().map(d => ({ value: d, label: d })),
  [enrollments]);
  const planOptions = useMemo(() => plans.map(p => ({ value: p.id, label: `${p.plan_name}${p.plan_code ? ` [${p.plan_code}]` : ''}` })), [plans]);
  const personnelOptions = useMemo(() => personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name || '')} ${(p.last_name || '')}`.trim() + (p.emp_code ? ` (${p.emp_code})` : ''),
  })), [personnel]);

  const filteredPlans = useMemo(() => plans.filter(p => {
    if (filterType && p.benefit_type !== filterType) return false;
    if (planSearch) {
      const q = planSearch.toLowerCase();
      return (p.plan_name || '').toLowerCase().includes(q) || (p.plan_code || '').toLowerCase().includes(q);
    }
    return true;
  }), [plans, filterType, planSearch]);

  const filteredEnrollments = useMemo(() => enrollments.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterPlan   && e.plan_id !== filterPlan)  return false;
    if (filterDept   && e.department_name !== filterDept) return false;
    if (enrollSearch) {
      const q = enrollSearch.toLowerCase();
      return (e.personnel_name || '').toLowerCase().includes(q)
          || (e.personnel_emp_code || '').toLowerCase().includes(q)
          || (e.plan_name || '').toLowerCase().includes(q)
          || (e.department_name || '').toLowerCase().includes(q);
    }
    return true;
  }), [enrollments, filterStatus, filterPlan, filterDept, enrollSearch]);

  const hasEnrollFilters  = enrollSearch || filterStatus || filterPlan || filterDept;
  const waivedCount       = summary?.waived    || enrollments.filter(e => e.status === 'waived').length;
  const cancelledCount    = summary?.cancelled || enrollments.filter(e => e.status === 'cancelled').length;

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createPlanMut = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/benefits/plans', d),
    onSuccess: () => { message.success('Plan created'); setPlanModalOpen(false); setEditingPlan(null); invAll(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Create failed'),
  });
  const updatePlanMut = useMutation({
    mutationFn: ({ id, d }) => apiService.put(`/api/v1/personnel/benefits/plans/${id}`, d),
    onSuccess: () => { message.success('Plan updated'); setPlanModalOpen(false); setEditingPlan(null); invAll(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Update failed'),
  });
  const deletePlanMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/benefits/plans/${id}`),
    onSuccess: () => { message.success('Plan deleted'); invAll(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const createEnrollMut = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/benefits/enrollments', d),
    onSuccess: () => { message.success('Enrolled'); setEnrollModalOpen(false); setEditingEnroll(null); invAll(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Enrollment failed'),
  });
  const updateEnrollMut = useMutation({
    mutationFn: ({ id, d }) => apiService.put(`/api/v1/personnel/benefits/enrollments/${id}`, d),
    onSuccess: () => { message.success('Updated'); setEnrollModalOpen(false); setEditingEnroll(null); invAll(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Update failed'),
  });
  const deleteEnrollMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/benefits/enrollments/${id}`),
    onSuccess: () => { message.success('Removed'); invAll(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action }) => apiService.put(`/api/v1/personnel/benefits/enrollments/${id}/${action}`),
    onSuccess: (_, { action }) => {
      const msgs = { waive: 'Waived', cancel: 'Cancelled', reactivate: 'Reactivated' };
      message.success(msgs[action] || 'Done');
      setDetailEnroll(null);
      invAll();
    },
    onError: e => message.error(e?.response?.data?.detail || 'Action failed'),
  });

  const bulkDelPlans = useCallback(async () => {
    await Promise.all(selectedPlanKeys.map(id => apiService.delete(`/api/v1/personnel/benefits/plans/${id}`)));
    message.success(`${selectedPlanKeys.length} plan(s) deleted`);
    setSelectedPlanKeys([]);
    invAll();
  }, [selectedPlanKeys, invAll]);

  const bulkDelEnroll = useCallback(async () => {
    await Promise.all(selectedEnrollKeys.map(id => apiService.delete(`/api/v1/personnel/benefits/enrollments/${id}`)));
    message.success(`${selectedEnrollKeys.length} enrollment(s) removed`);
    setSelectedEnrollKeys([]);
    invAll();
  }, [selectedEnrollKeys, invAll]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const openAddPlan  = () => { setEditingPlan(null); setPlanModalOpen(true); setTimeout(() => planForm.resetFields(), 0); };
  const openEditPlan = r  => {
    setEditingPlan(r); setPlanModalOpen(true);
    setTimeout(() => planForm.setFieldsValue({
      ...r,
      enrollment_period_start: r.enrollment_period_start ? dayjs(r.enrollment_period_start) : null,
      enrollment_period_end:   r.enrollment_period_end   ? dayjs(r.enrollment_period_end)   : null,
      effective_date:          r.effective_date          ? dayjs(r.effective_date)          : null,
    }), 0);
  };
  const submitPlan = () => planForm.validateFields().then(v => {
    const payload = {
      ...v,
      enrollment_period_start: v.enrollment_period_start?.format('YYYY-MM-DD'),
      enrollment_period_end:   v.enrollment_period_end?.format('YYYY-MM-DD'),
      effective_date:          v.effective_date?.format('YYYY-MM-DD'),
    };
    if (editingPlan) updatePlanMut.mutate({ id: editingPlan.id, d: payload });
    else createPlanMut.mutate(payload);
  }).catch(() => {});

  const openAddEnroll  = (prefill = {}) => {
    setEditingEnroll(null); setEnrollModalOpen(true);
    setTimeout(() => { enrollForm.resetFields(); enrollForm.setFieldsValue({ status: 'active', enrollment_date: dayjs(), ...prefill }); }, 0);
  };
  const openEditEnroll = r => {
    setEditingEnroll(r); setEnrollModalOpen(true);
    setTimeout(() => enrollForm.setFieldsValue({
      ...r,
      enrollment_date: r.enrollment_date ? dayjs(r.enrollment_date) : null,
      effective_date:  r.effective_date  ? dayjs(r.effective_date)  : null,
    }), 0);
  };
  const submitEnroll = () => enrollForm.validateFields().then(v => {
    const payload = {
      ...v,
      enrollment_date: v.enrollment_date?.format('YYYY-MM-DD'),
      effective_date:  v.effective_date?.format('YYYY-MM-DD'),
    };
    if (editingEnroll) updateEnrollMut.mutate({ id: editingEnroll.id, d: payload });
    else createEnrollMut.mutate(payload);
  }).catch(() => {});

  // ── Export ────────────────────────────────────────────────────────────────────
  const enrollExportCols = [
    { title: 'Personnel',   exportValue: r => r.personnel_name    || '' },
    { title: 'Emp Code',    exportValue: r => r.personnel_emp_code || '' },
    { title: 'Type',        exportValue: r => r.personnel_type    || '' },
    { title: 'Department',  exportValue: r => r.department_name   || '' },
    { title: 'Plan Name',   exportValue: r => r.plan_name         || '' },
    { title: 'Plan Code',   exportValue: r => r.plan_code         || '' },
    { title: 'Benefit Type',exportValue: r => r.benefit_type      || '' },
    { title: 'Enrolled',    exportValue: r => r.enrollment_date   || '' },
    { title: 'Effective',   exportValue: r => r.effective_date    || '' },
    { title: 'Coverage',    exportValue: r => r.coverage_amount   ?? '' },
    { title: 'Dependents',  exportValue: r => r.dependent_count   ?? 0  },
    { title: 'Status',      exportValue: r => r.status            || '' },
  ];

  // ── Table columns ─────────────────────────────────────────────────────────────
  const planColumns = [
    {
      title: 'Plan', key: 'plan', width: 240,
      sorter: (a, b) => (a.plan_name || '').localeCompare(b.plan_name || ''),
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>{r.plan_name}</div>
          {r.plan_code && <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#94a3b8', background: '#f1f5f9', borderRadius: 3, padding: '0 5px' }}>{r.plan_code}</span>}
          {r.description && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{r.description.slice(0, 70)}{r.description.length > 70 ? '…' : ''}</div>}
        </div>
      ),
    },
    {
      title: 'Type', dataIndex: 'benefit_type', width: 160,
      render: t => <TypePill type={t} />,
    },
    {
      title: 'Eligibility', dataIndex: 'eligibility', width: 140,
      render: v => <span style={{ fontSize: 11, color: '#64748b' }}>{lbl(v)}</span>,
    },
    {
      title: 'Contributions', key: 'contrib', width: 150,
      render: (_, r) => (
        <div style={{ fontSize: 11 }}>
          {r.employer_contribution != null && <div>Employer: <span style={{ fontWeight: 700, color: '#059669' }}>{r.employer_contribution}%</span></div>}
          {r.employee_contribution != null && <div>Employee: <span style={{ fontWeight: 700, color: '#2563eb' }}>{r.employee_contribution}%</span></div>}
        </div>
      ),
    },
    {
      title: 'Max Coverage', key: 'coverage', width: 120,
      render: (_, r) => r.max_coverage
        ? <span style={{ fontWeight: 700, fontSize: 12, color: '#059669' }}>{r.currency || 'USD'} {Number(r.max_coverage).toLocaleString()}</span>
        : <span style={{ color: '#d1d5db' }}>—</span>,
    },
    {
      title: 'Enrolled', dataIndex: 'enrollment_count', width: 90,
      sorter: (a, b) => (a.enrollment_count || 0) - (b.enrollment_count || 0),
      render: n => <span style={{ fontWeight: 800, fontSize: 14, color: '#2563eb' }}>{n || 0}</span>,
    },
    {
      title: 'Active', dataIndex: 'is_active', width: 80,
      render: v => <Switch size="small" checked={v} disabled />,
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 110,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Enroll someone">
            <Button size="small" type="primary" icon={<PlusOutlined />}
              onClick={() => { setActiveTab('enrollments'); setTimeout(() => openAddEnroll({ plan_id: r.id }), 100); }}
              style={{ borderRadius: 6, background: '#059669', borderColor: '#059669' }} />
          </Tooltip>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEditPlan(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Popconfirm
            title={r.enrollment_count > 0 ? `${r.enrollment_count} active enrollment(s). Delete anyway?` : 'Delete plan?'}
            onConfirm={() => deletePlanMut.mutate(r.id)} okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const enrollColumns = [
    {
      title: 'Personnel', key: 'person', width: 220,
      sorter: (a, b) => (a.personnel_name || '').localeCompare(b.personnel_name || ''),
      render: (_, r) => (
        <EmployeeCell
          name={r.personnel_name || `ID ${r.personnel_id}`}
          empCode={r.personnel_emp_code}
          type={r.personnel_type}
          department={r.department_name}
          onClick={() => setDetailEnroll(r)}
        />
      ),
    },
    {
      title: 'Plan', key: 'plan', width: 200,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{r.plan_name || `Plan ${r.plan_id}`}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
            {r.plan_code && <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#94a3b8', background: '#f1f5f9', borderRadius: 3, padding: '0 4px' }}>{r.plan_code}</span>}
            {r.benefit_type && <TypePill type={r.benefit_type} />}
          </div>
        </div>
      ),
    },
    {
      title: 'Dates', key: 'dates', width: 140,
      render: (_, r) => (
        <div style={{ fontSize: 11 }}>
          {r.enrollment_date && <div>Enrolled: <b>{dayjs(r.enrollment_date).format('DD MMM YY')}</b></div>}
          {r.effective_date  && <div style={{ color: '#94a3b8' }}>Effective: {dayjs(r.effective_date).format('DD MMM YY')}</div>}
        </div>
      ),
    },
    {
      title: 'Coverage', key: 'coverage', width: 110,
      render: (_, r) => r.coverage_amount
        ? <span style={{ fontWeight: 700, color: '#059669' }}>{Number(r.coverage_amount).toLocaleString()}</span>
        : <span style={{ color: '#d1d5db' }}>—</span>,
    },
    {
      title: 'Dep.', dataIndex: 'dependent_count', width: 70,
      render: v => v > 0
        ? <span style={{ fontWeight: 700, fontSize: 12, background: '#ede9fe', color: '#7c3aed', borderRadius: 10, padding: '0 8px' }}>{v}</span>
        : <span style={{ color: '#d1d5db' }}>—</span>,
    },
    {
      title: 'Status', key: 'status', width: 120,
      render: (_, r) => <StatusPill status={r.status} />,
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 200,
      render: (_, r) => (
        <Space size={3} wrap>
          {r.status === 'active' && (
            <Tooltip title="Waive"><Button size="small" icon={<StopOutlined />} onClick={() => actionMut.mutate({ id: r.id, action: 'waive' })} style={{ borderRadius: 6 }} /></Tooltip>
          )}
          {r.status === 'active' && (
            <Tooltip title="Cancel"><Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => actionMut.mutate({ id: r.id, action: 'cancel' })} style={{ borderRadius: 6 }} /></Tooltip>
          )}
          {['waived', 'cancelled', 'inactive'].includes(r.status) && (
            <Tooltip title="Reactivate">
              <Button size="small" type="primary" icon={<SyncOutlined />} onClick={() => actionMut.mutate({ id: r.id, action: 'reactivate' })}
                style={{ borderRadius: 6, background: '#16a34a', borderColor: '#16a34a' }} />
            </Tooltip>
          )}
          <Tooltip title="Detail"><Button size="small" icon={<MoreOutlined />} onClick={() => setDetailEnroll(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEditEnroll(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Popconfirm title="Remove enrollment?" onConfirm={() => deleteEnrollMut.mutate(r.id)} okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const containerStyle  = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' };
  const paginationProps = { pageSize: 20, showSizeChanger: true, showQuickJumper: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`, style: { padding: '12px 16px', margin: 0 } };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Benefits Management</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                Manage benefit plans, personnel enrollments and coverage
              </div>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddPlan}
              size="small" style={{ fontWeight: 600, background: '#0891b2', borderColor: '#0891b2' }}>
              New Plan
            </Button>
          </div>
        }
        styles={{ header: { overflow: 'visible' } }}
      >

      {/* Stat cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Plans',        value: summary.total_plans       ?? plans.length,                                      color: '#2563eb', bg: '#eff6ff', icon: <GiftOutlined />        },
          { label: 'Active Plans',       value: summary.active_plans      ?? plans.filter(p => p.is_active).length,             color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircleOutlined /> },
          { label: 'Active Enrollments', value: summary.active_enrollments ?? enrollments.filter(e => e.status === 'active').length, color: '#0891b2', bg: '#ecfeff', icon: <TeamOutlined />  },
          { label: 'Waived / Cancelled', value: (summary.waived || 0) + (summary.cancelled || 0), color: '#d97706', bg: '#fffbeb', icon: <StopOutlined />, alert: (waivedCount + cancelledCount) > 0 },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <div style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              border: `1px solid ${s.alert ? '#fde68a' : '#e2e8f0'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 18 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {(waivedCount + cancelledCount) > 0 && (
        <Alert type="info" showIcon closable style={{ marginBottom: 12, borderRadius: 8 }}
          message={`${waivedCount} waived and ${cancelledCount} cancelled enrollment(s) — review for reactivation`} />
      )}

      {/* Tabs */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding: '0 16px' }}
          items={[

            // ── PLANS ─────────────────────────────────────────────────────────
            {
              key: 'plans',
              label: <span><GiftOutlined /> Benefit Plans</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                    <Input placeholder="Search plan name or code…" prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
                      value={planSearch} onChange={e => setPlanSearch(e.target.value)} allowClear
                      style={{ flex: '1 1 200px', maxWidth: 260, borderRadius: 8 }} />
                    <Select placeholder="Benefit type" allowClear style={{ flex: '1 1 180px', minWidth: 180 }}
                      value={filterType} onChange={setFilterType}
                      options={BENEFIT_TYPES.map(t => ({ value: t, label: <TypePill type={t} /> }))} />
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Button icon={<ReloadOutlined />} onClick={refetchPlans} style={{ borderRadius: 8 }} />
                    </div>
                  </div>
                  <BulkBar count={selectedPlanKeys.length} label="plan" onClear={() => setSelectedPlanKeys([])} onDelete={bulkDelPlans} />
                  <div style={containerStyle}>
                    <Table columns={planColumns} dataSource={filteredPlans} loading={plansLoading} rowKey="id"
                      rowSelection={{ selectedRowKeys: selectedPlanKeys, onChange: setSelectedPlanKeys }}
                      pagination={paginationProps} scroll={{ x: 1100 }} size="middle" />
                  </div>
                </div>
              ),
            },

            // ── ENROLLMENTS ───────────────────────────────────────────────────
            {
              key: 'enrollments',
              label: (
                <span>
                  <TeamOutlined /> Enrollments
                  <Badge count={enrollments.filter(e => e.status === 'active').length} showZero={false}
                    style={{ marginLeft: 6, background: '#0891b2' }} size="small" />
                </span>
              ),
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                    <Input placeholder="Search person, plan, dept…" prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
                      value={enrollSearch} onChange={e => setEnrollSearch(e.target.value)} allowClear
                      style={{ flex: '1 1 200px', maxWidth: 240, borderRadius: 8 }} />
                    <FilterOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                    <Select placeholder="Plan" allowClear showSearch optionFilterProp="label"
                      style={{ flex: '1 1 180px', minWidth: 180 }}
                      value={filterPlan} onChange={setFilterPlan} options={planOptions} />
                    <Select placeholder="Status" allowClear style={{ flex: '1 1 120px', minWidth: 120 }}
                      value={filterStatus} onChange={setFilterStatus}
                      options={ENROLL_STATUSES.map(s => ({ value: s, label: <StatusPill status={s} /> }))} />
                    <Select placeholder="Department" allowClear showSearch optionFilterProp="label"
                      style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={filterDept || undefined} onChange={v => setFilterDept(v || '')} options={deptOptions} />
                    {hasEnrollFilters && (
                      <Button size="small" style={{ borderRadius: 6 }}
                        onClick={() => { setEnrollSearch(''); setFilterStatus(null); setFilterPlan(null); setFilterDept(''); }}>
                        Clear
                      </Button>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Tooltip title="Export CSV">
                        <Button icon={<DownloadOutlined />}
                          onClick={() => exportCSV(enrollExportCols, filteredEnrollments, `benefits-enrollments-${dayjs().format('YYYY-MM-DD')}.csv`)}
                          style={{ borderRadius: 8 }} />
                      </Tooltip>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddEnroll()}
                        style={{ borderRadius: 8, background: '#0891b2', borderColor: '#0891b2' }}>
                        Enroll
                      </Button>
                      <Button icon={<ReloadOutlined />} onClick={refetchEnroll} style={{ borderRadius: 8 }} />
                    </div>
                  </div>
                  {hasEnrollFilters && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {filterStatus && <Tag closable onClose={() => setFilterStatus(null)} color="green">{STATUS_CFG[filterStatus]?.label}</Tag>}
                      {filterPlan   && <Tag closable onClose={() => setFilterPlan(null)}   color="blue">{plans.find(p => p.id === filterPlan)?.plan_name || filterPlan}</Tag>}
                      {filterDept   && <Tag closable onClose={() => setFilterDept('')}     icon={<ApartmentOutlined />}>{filterDept}</Tag>}
                      {enrollSearch && <Tag closable onClose={() => setEnrollSearch('')}   icon={<SearchOutlined />}>"{enrollSearch}"</Tag>}
                    </div>
                  )}
                  <BulkBar count={selectedEnrollKeys.length} label="enrollment" onClear={() => setSelectedEnrollKeys([])} onDelete={bulkDelEnroll} />
                  <div style={containerStyle}>
                    <Table columns={enrollColumns} dataSource={filteredEnrollments} loading={enrollLoading} rowKey="id"
                      rowSelection={{ selectedRowKeys: selectedEnrollKeys, onChange: setSelectedEnrollKeys }}
                      pagination={paginationProps} scroll={{ x: 1200 }} size="middle"
                      rowClassName={r => r.status === 'cancelled' ? 'row-cancelled' : r.status === 'waived' ? 'row-waived' : ''}
                    />
                  </div>
                </div>
              ),
            },

            // ── ANALYTICS ─────────────────────────────────────────────────────
            {
              key: 'analytics',
              label: <span><BarChartOutlined /> Analytics</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <AnalyticsTab plans={plans} enrollments={enrollments} summary={summary} />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ── Plan Modal ────────────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#0891b2,#0e7490)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GiftOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingPlan ? 'Edit Benefit Plan' : 'New Benefit Plan'}
          </Space>
        }
        open={planModalOpen} onOk={submitPlan}
        onCancel={() => { setPlanModalOpen(false); setEditingPlan(null); }}
        confirmLoading={createPlanMut.isPending || updatePlanMut.isPending}
        width={680} forceRender
      >
        <Form form={planForm} layout="vertical" initialValues={{ eligibility: 'all_employees', currency: 'USD', is_active: true }} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="plan_code" label="Plan Code">
                <Input placeholder="BEN-001 (auto if blank)" maxLength={20} disabled={!!editingPlan} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="plan_name" label="Plan Name" rules={[{ required: true }]}>
                <Input maxLength={100} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="benefit_type" label="Benefit Type">
                <Select placeholder="Select type" options={BENEFIT_TYPES.map(t => ({ value: t, label: <TypePill type={t} /> }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="eligibility" label="Eligibility">
                <Select options={ELIGIBILITY_TYPES.map(t => ({ value: t, label: lbl(t) }))} />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left" plain style={{ margin: '4px 0 12px', fontSize: 11, color: '#94a3b8' }}>Contributions & Coverage</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="employer_contribution" label="Employer (%)">
                <InputNumber style={{ width: '100%' }} min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="employee_contribution" label="Employee (%)">
                <InputNumber style={{ width: '100%' }} min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_coverage" label="Max Coverage">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="currency" label="Currency">
                <Select options={[{ value: 'USD' }, { value: 'NGN' }, { value: 'GBP' }, { value: 'EUR' }].map(o => ({ value: o.value, label: o.value }))} />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="enrollment_period_start" label="Enrol Period Start">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="enrollment_period_end" label="Enrol Period End">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="effective_date" label="Effective Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Enrollment Modal ──────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TeamOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingEnroll ? 'Edit Enrollment' : 'Enroll in Benefit Plan'}
          </Space>
        }
        open={enrollModalOpen} onOk={submitEnroll}
        onCancel={() => { setEnrollModalOpen(false); setEditingEnroll(null); }}
        confirmLoading={createEnrollMut.isPending || updateEnrollMut.isPending}
        width={580} forceRender
      >
        <Form form={enrollForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="personnel_id" label="Personnel" rules={[{ required: true }]}>
            <Select showSearch placeholder="Search personnel…" options={personnelOptions}
              filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
              disabled={!!editingEnroll} />
          </Form.Item>
          <Form.Item name="plan_id" label="Benefit Plan" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select plan…" options={planOptions}
              filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
              disabled={!!editingEnroll} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="enrollment_date" label="Enrollment Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="effective_date" label="Effective Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="coverage_amount" label="Coverage Amount">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="e.g. 50000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select options={ENROLL_STATUSES.map(s => ({ value: s, label: <StatusPill status={s} /> }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Enrollment Detail Drawer ───────────────────────────────────────────── */}
      <EnrollmentDrawer
        record={detailEnroll}
        onClose={() => setDetailEnroll(null)}
        onAction={(id, action) => actionMut.mutate({ id, action })}
        onEdit={r => { setDetailEnroll(null); openEditEnroll(r); }}
        actionPending={actionMut.isPending}
      />

      <style>{`
        .ant-table-thead > tr > th {
          background: #f8fafc !important; color: #64748b !important;
          font-size: 11px !important; font-weight: 700 !important;
          text-transform: uppercase !important; letter-spacing: 0.05em !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f1f5f9 !important; padding: 10px 12px !important;
        }
        .ant-table-tbody > tr:last-child > td { border-bottom: none !important; }
        .ant-tabs-nav { margin-bottom: 0 !important; }
        .row-cancelled { background: rgba(220,38,38,0.03) !important; }
        .row-cancelled:hover > td { background: rgba(220,38,38,0.07) !important; }
        .row-waived { background: rgba(217,119,6,0.03) !important; }
        .row-waived:hover > td { background: rgba(217,119,6,0.07) !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default BenefitsManagement;
