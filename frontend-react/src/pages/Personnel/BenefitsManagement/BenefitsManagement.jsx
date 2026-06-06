import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Input, Modal, Form, Card, Row, Col, Tag,
  Popconfirm, DatePicker, Select, InputNumber, Tabs, Statistic,
  Alert, Tooltip, Divider, Empty, Switch, App,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  GiftOutlined, TeamOutlined, CheckCircleOutlined, CloseCircleOutlined,
  StopOutlined, SyncOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

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

const ENROLLMENT_STATUSES = ['active', 'inactive', 'waived', 'cancelled'];

const TYPE_LABEL = t => t?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '—';

const TYPE_COLORS = {
  health_insurance:      '#f5222d',
  dental_insurance:      '#fa8c16',
  vision_insurance:      '#faad14',
  life_insurance:        '#722ed1',
  pension:               '#1890ff',
  retirement_401k:       '#13c2c2',
  paid_time_off:         '#52c41a',
  sick_leave:            '#eb2f96',
  housing_allowance:     '#fa541c',
  transportation:        '#2f54eb',
  meal_allowance:        '#a0d911',
  disability_insurance:  '#531dab',
  tuition_reimbursement: '#d4380d',
  other:                 '#8c8c8c',
};

const STATUS_COLORS = {
  active:    '#52c41a',
  inactive:  '#8c8c8c',
  waived:    '#faad14',
  cancelled: '#f5222d',
};

const PIE_PALETTE = ['#1890ff','#52c41a','#fa8c16','#f5222d','#722ed1','#13c2c2','#eb2f96','#faad14','#a0d911','#2f54eb'];


// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ plans, enrollments, summary }) {
  const stats = useMemo(() => {
    const byType   = {};
    const byStatus = {};
    const byPlan   = {};

    enrollments.forEach(e => {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      const pname = e.plan_name || `Plan ${e.plan_id}`;
      byPlan[pname] = (byPlan[pname] || 0) + 1;
    });

    plans.forEach(p => {
      const bt = p.benefit_type || 'other';
      byType[bt] = (byType[bt] || 0) + 1;
    });

    const typeData   = Object.entries(byType).map(([name, value]) => ({ name: TYPE_LABEL(name), value }));
    const statusData = ENROLLMENT_STATUSES.filter(s => byStatus[s]).map(s => ({
      name: s.charAt(0).toUpperCase() + s.slice(1), count: byStatus[s], fill: STATUS_COLORS[s],
    }));
    const planData = Object.entries(byPlan)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return { typeData, statusData, planData };
  }, [plans, enrollments]);

  if (!plans.length && !enrollments.length) {
    return <Card><Empty description="No benefit data yet. Create plans and enroll personnel to see analytics." /></Card>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI cards */}
      <Row gutter={16}>
        {[
          { title: 'Total Plans',        value: summary?.total_plans || 0,        color: '#1890ff' },
          { title: 'Active Plans',       value: summary?.active_plans || 0,       color: '#52c41a' },
          { title: 'Total Enrollments',  value: summary?.total_enrollments || 0,  color: '#722ed1' },
          { title: 'Active Enrollments', value: summary?.active_enrollments || 0, color: '#13c2c2' },
        ].map(({ title, value, color }) => (
          <Col key={title} xs={24} sm={12} md={6}>
            <Card size="small"><Statistic title={title} value={value} valueStyle={{ color }} /></Card>
          </Col>
        ))}
      </Row>

      {/* Charts row 1 */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Plan Type Distribution" size="small">
            {stats.typeData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stats.typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {stats.typeData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Pie>
                  <RTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Enrollment Status" size="small">
            {stats.statusData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.statusData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <RTooltip />
                  <Bar dataKey="count" name="Enrollments" radius={[4, 4, 0, 0]}>
                    {stats.statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>
      </Row>

      {/* Top plans by enrollment */}
      {stats.planData.length > 0 && (
        <Card title="Top Plans by Enrollment" size="small">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.planData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
              <RTooltip />
              <Bar dataKey="count" name="Enrollments" fill="#1890ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}


// ── Main Component ────────────────────────────────────────────────────────────

const BenefitsManagement = () => {
  const { message: msg } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab,  setActiveTab]  = useState('plans');
  const [searchText, setSearchText] = useState('');
  const [enrollSearchText, setEnrollSearchText] = useState('');
  const [filterType,   setFilterType]   = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterPlan,   setFilterPlan]   = useState(null);

  // Plan modal
  const [planModalOpen,  setPlanModalOpen]  = useState(false);
  const [editingPlan,    setEditingPlan]    = useState(null);
  const [planForm] = Form.useForm();

  // Enrollment modal
  const [enrollModalOpen,  setEnrollModalOpen]  = useState(false);
  const [editingEnroll,    setEditingEnroll]    = useState(null);
  const [enrollForm] = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: plans = [], isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ['benefit-plans'],
    queryFn: () => apiService.get('/api/v1/personnel/benefits/plans?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });

  const { data: enrollments = [], isLoading: enrollLoading, refetch: refetchEnroll } = useQuery({
    queryKey: ['benefit-enrollments'],
    queryFn: () => apiService.get('/api/v1/personnel/benefits/enrollments?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });

  const { data: summary = {} } = useQuery({
    queryKey: ['benefit-summary'],
    queryFn: () => apiService.get('/api/v1/personnel/benefits/plans/meta/summary'),
    staleTime: 30000,
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel-list'],
    queryFn: () => apiService.get('/api/v1/personnel/?limit=500'),
    staleTime: 60000,
    select: d => Array.isArray(d) ? d : (d?.results || d?.data || []),
  });

  // ── Invalidate helper ────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['benefit-plans'] });
    queryClient.invalidateQueries({ queryKey: ['benefit-enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['benefit-summary'] });
  };

  // ── Plan mutations ───────────────────────────────────────────────────────

  const createPlanMutation = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/benefits/plans', d),
    onSuccess: () => { msg.success('Plan created'); closePlanModal(); invalidateAll(); },
    onError:   e => msg.error(`Create failed: ${e?.response?.data?.detail || e.message}`),
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, d }) => apiService.put(`/api/v1/personnel/benefits/plans/${id}`, d),
    onSuccess: () => { msg.success('Plan updated'); closePlanModal(); invalidateAll(); },
    onError:   e => msg.error(`Update failed: ${e?.response?.data?.detail || e.message}`),
  });

  const deletePlanMutation = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/benefits/plans/${id}`),
    onSuccess: () => { msg.success('Plan deleted'); invalidateAll(); },
    onError:   e => msg.error(`Delete failed: ${e?.response?.data?.detail || e.message}`),
  });

  // ── Enrollment mutations ─────────────────────────────────────────────────

  const createEnrollMutation = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/benefits/enrollments', d),
    onSuccess: () => { msg.success('Enrolled successfully'); closeEnrollModal(); invalidateAll(); },
    onError:   e => msg.error(`Enrollment failed: ${e?.response?.data?.detail || e.message}`),
  });

  const updateEnrollMutation = useMutation({
    mutationFn: ({ id, d }) => apiService.put(`/api/v1/personnel/benefits/enrollments/${id}`, d),
    onSuccess: () => { msg.success('Enrollment updated'); closeEnrollModal(); invalidateAll(); },
    onError:   e => msg.error(`Update failed: ${e?.response?.data?.detail || e.message}`),
  });

  const deleteEnrollMutation = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/benefits/enrollments/${id}`),
    onSuccess: () => { msg.success('Enrollment removed'); invalidateAll(); },
    onError:   e => msg.error(`Delete failed: ${e?.response?.data?.detail || e.message}`),
  });

  const enrollActionMutation = useMutation({
    mutationFn: ({ id, action }) => apiService.put(`/api/v1/personnel/benefits/enrollments/${id}/${action}`),
    onSuccess: (_, { action }) => {
      const labels = { waive: 'waived', cancel: 'cancelled', reactivate: 'reactivated' };
      msg.success(`Enrollment ${labels[action] || action}`);
      invalidateAll();
    },
    onError: e => msg.error(`Action failed: ${e?.response?.data?.detail || e.message}`),
  });

  // ── Plan modal helpers ───────────────────────────────────────────────────

  const openAddPlan = () => {
    setEditingPlan(null);
    setTimeout(() => planForm.resetFields(), 0);
    setPlanModalOpen(true);
  };

  const openEditPlan = record => {
    setEditingPlan(record);
    setTimeout(() => {
      planForm.setFieldsValue({
        ...record,
        enrollment_period_start: record.enrollment_period_start ? dayjs(record.enrollment_period_start) : null,
        enrollment_period_end:   record.enrollment_period_end   ? dayjs(record.enrollment_period_end)   : null,
        effective_date:          record.effective_date          ? dayjs(record.effective_date)          : null,
      });
    }, 0);
    setPlanModalOpen(true);
  };

  const closePlanModal = () => {
    setPlanModalOpen(false);
    setEditingPlan(null);
    planForm.resetFields();
  };

  const handleSavePlan = () => {
    planForm.validateFields().then(values => {
      const payload = {
        ...values,
        enrollment_period_start: values.enrollment_period_start ? values.enrollment_period_start.format('YYYY-MM-DD') : null,
        enrollment_period_end:   values.enrollment_period_end   ? values.enrollment_period_end.format('YYYY-MM-DD')   : null,
        effective_date:          values.effective_date          ? values.effective_date.format('YYYY-MM-DD')          : null,
      };
      if (editingPlan) updatePlanMutation.mutate({ id: editingPlan.id, d: payload });
      else createPlanMutation.mutate(payload);
    });
  };

  // ── Enrollment modal helpers ─────────────────────────────────────────────

  const openAddEnroll = () => {
    setEditingEnroll(null);
    setTimeout(() => enrollForm.resetFields(), 0);
    setEnrollModalOpen(true);
  };

  const openEditEnroll = record => {
    setEditingEnroll(record);
    setTimeout(() => {
      enrollForm.setFieldsValue({
        ...record,
        enrollment_date: record.enrollment_date ? dayjs(record.enrollment_date) : null,
        effective_date:  record.effective_date  ? dayjs(record.effective_date)  : null,
      });
    }, 0);
    setEnrollModalOpen(true);
  };

  const closeEnrollModal = () => {
    setEnrollModalOpen(false);
    setEditingEnroll(null);
    enrollForm.resetFields();
  };

  const handleSaveEnroll = () => {
    enrollForm.validateFields().then(values => {
      const payload = {
        ...values,
        enrollment_date: values.enrollment_date ? values.enrollment_date.format('YYYY-MM-DD') : null,
        effective_date:  values.effective_date  ? values.effective_date.format('YYYY-MM-DD')  : null,
      };
      if (editingEnroll) updateEnrollMutation.mutate({ id: editingEnroll.id, d: payload });
      else createEnrollMutation.mutate(payload);
    });
  };

  // ── Filtered data ────────────────────────────────────────────────────────

  const filteredPlans = useMemo(() => plans.filter(p => {
    if (filterType && p.benefit_type !== filterType) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!p.plan_name?.toLowerCase().includes(q) && !p.plan_code?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [plans, filterType, searchText]);

  const filteredEnrollments = useMemo(() => enrollments.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterPlan   && e.plan_id !== filterPlan)  return false;
    if (enrollSearchText) {
      const q = enrollSearchText.toLowerCase();
      if (!e.personnel_name?.toLowerCase().includes(q) && !e.personnel_emp_code?.toLowerCase().includes(q) && !e.plan_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [enrollments, filterStatus, filterPlan, enrollSearchText]);

  // ── Table columns ────────────────────────────────────────────────────────

  const planColumns = [
    {
      title: 'Plan',
      key: 'plan',
      width: 200,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.plan_name}</div>
          {r.plan_code && <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>{r.plan_code}</div>}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'benefit_type',
      key: 'benefit_type',
      width: 150,
      render: t => <Tag color={TYPE_COLORS[t] || '#8c8c8c'}>{TYPE_LABEL(t)}</Tag>,
    },
    {
      title: 'Eligibility',
      dataIndex: 'eligibility',
      key: 'eligibility',
      width: 130,
      render: v => TYPE_LABEL(v),
    },
    {
      title: 'Contributions',
      key: 'contributions',
      width: 160,
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          {r.employer_contribution != null && <div>Employer: <strong>{r.employer_contribution}%</strong></div>}
          {r.employee_contribution != null && <div>Employee: <strong>{r.employee_contribution}%</strong></div>}
        </div>
      ),
    },
    {
      title: 'Max Coverage',
      dataIndex: 'max_coverage',
      key: 'max_coverage',
      width: 120,
      render: (v, r) => v ? `${r.currency || 'USD'} ${parseFloat(v).toLocaleString()}` : '—',
    },
    {
      title: 'Enrolled',
      dataIndex: 'enrollment_count',
      key: 'enrollment_count',
      width: 80,
      render: v => <Tag color={v > 0 ? '#1890ff' : '#d9d9d9'}>{v || 0}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: v => <Tag color={v ? '#52c41a' : '#f5222d'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditPlan(record)}>Edit</Button>
          <Popconfirm
            title={record.enrollment_count > 0 ? `This plan has ${record.enrollment_count} active enrollment(s). Delete anyway?` : 'Delete this plan?'}
            onConfirm={() => deletePlanMutation.mutate(record.id)}
            okText="Yes" cancelText="No"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const enrollColumns = [
    {
      title: 'Personnel',
      key: 'personnel',
      width: 160,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.personnel_name || `ID:${r.personnel_id}`}</div>
          {r.personnel_emp_code && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.personnel_emp_code}</div>}
          {r.personnel_type && <Tag style={{ fontSize: 10, marginTop: 2 }}>{r.personnel_type}</Tag>}
        </div>
      ),
    },
    {
      title: 'Plan',
      key: 'plan',
      width: 160,
      render: (_, r) => (
        <div>
          <div>{r.plan_name || `Plan ${r.plan_id}`}</div>
          {r.benefit_type && <Tag color={TYPE_COLORS[r.benefit_type] || '#8c8c8c'} style={{ fontSize: 10, marginTop: 2 }}>{TYPE_LABEL(r.benefit_type)}</Tag>}
        </div>
      ),
    },
    {
      title: 'Enrolled',
      dataIndex: 'enrollment_date',
      key: 'enrollment_date',
      width: 110,
      render: d => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Effective',
      dataIndex: 'effective_date',
      key: 'effective_date',
      width: 110,
      render: d => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Coverage',
      key: 'coverage',
      width: 110,
      render: (_, r) => r.coverage_amount ? `USD ${parseFloat(r.coverage_amount).toLocaleString()}` : '—',
    },
    {
      title: 'Dependents',
      dataIndex: 'dependent_count',
      key: 'dependent_count',
      width: 90,
      render: v => v > 0 ? <Tag color="#722ed1">{v} dep.</Tag> : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: s => <Tag color={STATUS_COLORS[s] || 'default'} style={{ textTransform: 'capitalize' }}>{s}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 260,
      render: (_, r) => (
        <Space size={4} wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditEnroll(r)}>Edit</Button>
          {r.status === 'active' && (
            <Tooltip title="Waive benefit">
              <Button size="small" icon={<StopOutlined />}
                onClick={() => enrollActionMutation.mutate({ id: r.id, action: 'waive' })}>Waive</Button>
            </Tooltip>
          )}
          {r.status === 'active' && (
            <Tooltip title="Cancel enrollment">
              <Button size="small" danger icon={<CloseCircleOutlined />}
                onClick={() => enrollActionMutation.mutate({ id: r.id, action: 'cancel' })}>Cancel</Button>
            </Tooltip>
          )}
          {(r.status === 'waived' || r.status === 'cancelled' || r.status === 'inactive') && (
            <Tooltip title="Reactivate">
              <Button size="small" type="primary" icon={<SyncOutlined />}
                onClick={() => enrollActionMutation.mutate({ id: r.id, action: 'reactivate' })}>Reactivate</Button>
            </Tooltip>
          )}
          <Popconfirm title="Remove this enrollment?" onConfirm={() => deleteEnrollMutation.mutate(r.id)} okText="Yes" cancelText="No">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Options ──────────────────────────────────────────────────────────────

  const personnelOptions = personnel.map(p => ({
    value: p.id,
    label: `${p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ')} (${p.emp_code || p.badge_id || p.id})`,
  }));

  const planOptions = plans.map(p => ({
    value: p.id,
    label: `${p.plan_name}${p.plan_code ? ` [${p.plan_code}]` : ''}`,
  }));

  const benefitTypeOptions = BENEFIT_TYPES.map(t => ({ value: t, label: TYPE_LABEL(t) }));
  const eligibilityOptions  = ELIGIBILITY_TYPES.map(t => ({ value: t, label: TYPE_LABEL(t) }));

  // ── Render ────────────────────────────────────────────────────────────────

  const waivedCount   = summary?.waived    || 0;
  const cancelledCount = summary?.cancelled || 0;

  return (
    <div style={{ padding: '16px 24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          // ── Plans tab ──────────────────────────────────────────────────
          {
            key: 'plans',
            label: <span><GiftOutlined /> Benefit Plans</span>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card size="small">
                  <Row gutter={12} align="middle">
                    <Col flex="1">
                      <Input.Search
                        placeholder="Search plan name or code…"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col>
                      <Select
                        placeholder="Benefit type"
                        style={{ width: 180 }}
                        allowClear
                        value={filterType}
                        onChange={setFilterType}
                        options={benefitTypeOptions}
                      />
                    </Col>
                    <Col>
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAddPlan}>New Plan</Button>
                        <Button icon={<ReloadOutlined />} onClick={() => refetchPlans()}>Refresh</Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                <Card size="small">
                  <Table
                    columns={planColumns}
                    dataSource={filteredPlans}
                    loading={plansLoading}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20, showTotal: t => `${t} plans` }}
                    scroll={{ x: 1000 }}
                    locale={{ emptyText: <Empty description="No benefit plans yet" /> }}
                  />
                </Card>
              </div>
            ),
          },

          // ── Enrollments tab ────────────────────────────────────────────
          {
            key: 'enrollments',
            label: <span><TeamOutlined /> Enrollments</span>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(waivedCount + cancelledCount) > 0 && (
                  <Alert
                    type="info"
                    showIcon
                    message={`${waivedCount} waived, ${cancelledCount} cancelled enrollment(s) — review if reactivation is needed`}
                  />
                )}

                <Card size="small">
                  <Row gutter={12} align="middle">
                    <Col flex="1">
                      <Input.Search
                        placeholder="Search personnel name, emp code, plan…"
                        value={enrollSearchText}
                        onChange={e => setEnrollSearchText(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col>
                      <Select
                        placeholder="Plan"
                        style={{ width: 180 }}
                        allowClear
                        value={filterPlan}
                        onChange={setFilterPlan}
                        options={planOptions}
                        showSearch
                        optionFilterProp="label"
                      />
                    </Col>
                    <Col>
                      <Select
                        placeholder="Status"
                        style={{ width: 120 }}
                        allowClear
                        value={filterStatus}
                        onChange={setFilterStatus}
                        options={ENROLLMENT_STATUSES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                      />
                    </Col>
                    <Col>
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAddEnroll}>Enroll</Button>
                        <Button icon={<ReloadOutlined />} onClick={() => refetchEnroll()}>Refresh</Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                <Card size="small">
                  <Table
                    columns={enrollColumns}
                    dataSource={filteredEnrollments}
                    loading={enrollLoading}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20, showTotal: t => `${t} enrollments` }}
                    scroll={{ x: 1100 }}
                    locale={{ emptyText: <Empty description="No enrollments yet" /> }}
                  />
                </Card>
              </div>
            ),
          },

          // ── Analytics tab ──────────────────────────────────────────────
          {
            key: 'analytics',
            label: 'Analytics',
            children: <AnalyticsTab plans={plans} enrollments={enrollments} summary={summary} />,
          },
        ]}
      />

      {/* ── Plan Modal ──────────────────────────────────────────────────── */}
      <Modal
        title={editingPlan ? 'Edit Benefit Plan' : 'New Benefit Plan'}
        open={planModalOpen}
        onOk={handleSavePlan}
        onCancel={closePlanModal}
        width={680}
        okText={editingPlan ? 'Save Changes' : 'Create'}
        confirmLoading={createPlanMutation.isPending || updatePlanMutation.isPending}
        forceRender
      >
        <Form form={planForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="plan_code" label="Plan Code">
                <Input placeholder="e.g. BEN-001" />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="plan_name" label="Plan Name" rules={[{ required: true, message: 'Plan name required' }]}>
                <Input placeholder="e.g. Staff Health Insurance" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="benefit_type" label="Benefit Type">
                <Select placeholder="Select type" options={benefitTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="eligibility" label="Eligibility" initialValue="all_employees">
                <Select options={eligibilityOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ margin: '8px 0' }}>Contributions & Coverage</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="employer_contribution" label="Employer (%)">
                <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="employee_contribution" label="Employee (%)">
                <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_coverage" label="Max Coverage">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="Amount" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="currency" label="Currency" initialValue="USD">
                <Select options={[{ value: 'USD', label: 'USD' }, { value: 'NGN', label: 'NGN' }, { value: 'GBP', label: 'GBP' }, { value: 'EUR', label: 'EUR' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="enrollment_period_start" label="Enrol Period Start">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
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
              <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Plan description…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Enrollment Modal ────────────────────────────────────────────── */}
      <Modal
        title={editingEnroll ? 'Edit Enrollment' : 'New Enrollment'}
        open={enrollModalOpen}
        onOk={handleSaveEnroll}
        onCancel={closeEnrollModal}
        width={600}
        okText={editingEnroll ? 'Save Changes' : 'Enroll'}
        confirmLoading={createEnrollMutation.isPending || updateEnrollMutation.isPending}
        forceRender
      >
        <Form form={enrollForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="personnel_id" label="Personnel" rules={[{ required: true, message: 'Select personnel' }]}>
            <Select
              showSearch
              placeholder="Search personnel…"
              options={personnelOptions}
              optionFilterProp="label"
              disabled={!!editingEnroll}
            />
          </Form.Item>

          <Form.Item name="plan_id" label="Benefit Plan" rules={[{ required: true, message: 'Select plan' }]}>
            <Select
              showSearch
              placeholder="Select plan…"
              options={planOptions}
              optionFilterProp="label"
              disabled={!!editingEnroll}
            />
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
              <Form.Item name="status" label="Status" initialValue="active">
                <Select options={ENROLLMENT_STATUSES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default BenefitsManagement;
