import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Input, Modal, Form, Card, Row, Col, Tag,
  Popconfirm, DatePicker, Select, InputNumber, Tabs, Statistic,
  Alert, Tooltip, Divider, Empty, Badge, App,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined,
  ExclamationCircleOutlined, FileTextOutlined, SyncOutlined,
  SafetyCertificateOutlined, WarningOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const CONTRACT_TYPES    = ['permanent', 'fixed_term', 'contractor', 'intern', 'apprentice', 'temporary'];
const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated', 'suspended', 'renewed'];
const PAY_FREQUENCIES   = ['monthly', 'bi_weekly', 'weekly', 'daily'];

const STATUS_COLORS = {
  draft:      '#8c8c8c',
  active:     '#52c41a',
  expired:    '#fa8c16',
  terminated: '#f5222d',
  suspended:  '#faad14',
  renewed:    '#1890ff',
};

const TYPE_COLORS = {
  permanent:  '#1890ff',
  fixed_term: '#722ed1',
  contractor: '#fa8c16',
  intern:     '#13c2c2',
  apprentice: '#eb2f96',
  temporary:  '#8c8c8c',
};

// ZKTeco access visual config
const ZKTECO_CONFIG = {
  granted: { color: '#52c41a', icon: <SafetyCertificateOutlined />, label: 'Access Granted' },
  pending: { color: '#8c8c8c', icon: <ClockCircleOutlined />,        label: 'Pending Enrollment' },
  warning: { color: '#fa8c16', icon: <WarningOutlined />,            label: 'Access — Review Required' },
  revoked: { color: '#f5222d', icon: <CloseCircleOutlined />,        label: 'Access Revoked' },
};

const PIE_PALETTE = ['#52c41a','#f5222d','#fa8c16','#faad14','#1890ff','#722ed1','#13c2c2','#eb2f96'];

function statusTag(s) {
  return <Tag color={STATUS_COLORS[s] || 'default'} style={{ textTransform: 'capitalize' }}>{s?.replace('_', ' ')}</Tag>;
}

function zktecoBadge(access) {
  const cfg = ZKTECO_CONFIG[access] || ZKTECO_CONFIG.pending;
  return (
    <Tooltip title={cfg.label}>
      <Tag color={cfg.color} icon={cfg.icon} style={{ cursor: 'default' }}>
        {access === 'granted' ? 'Granted' : access === 'revoked' ? 'Revoked' : access === 'warning' ? 'Warning' : 'Pending'}
      </Tag>
    </Tooltip>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function AnalyticsTab({ contracts, summary }) {
  const stats = useMemo(() => {
    if (!contracts.length) return null;

    const byType   = {};
    const byStatus = {};
    const byMonth  = {};

    contracts.forEach(c => {
      byType[c.contract_type] = (byType[c.contract_type] || 0) + 1;
      byStatus[c.status]      = (byStatus[c.status]      || 0) + 1;
      const m = dayjs(c.created_at).format('MMM YY');
      byMonth[m] = (byMonth[m] || 0) + 1;
    });

    const typeData   = Object.entries(byType).map(([name, value]) => ({ name: name.replace('_', ' '), value }));
    const statusData = CONTRACT_STATUSES.filter(s => byStatus[s]).map(s => ({
      name: s.replace('_', ' '), count: byStatus[s], fill: STATUS_COLORS[s],
    }));
    const trendData  = Object.keys(byMonth).slice(-12).map(m => ({ month: m, count: byMonth[m] }));

    return { typeData, statusData, trendData };
  }, [contracts]);

  if (!contracts.length) {
    return <Card><Empty description="No contracts yet." /></Card>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <Row gutter={16}>
        {[
          { title: 'Total Contracts', value: summary?.total || 0, color: '#1890ff' },
          { title: 'Active', value: summary?.active || 0, color: '#52c41a' },
          { title: 'Expiring Soon (≤30d)', value: summary?.expiring_soon || 0, color: '#fa8c16' },
          { title: 'Terminated', value: summary?.terminated || 0, color: '#f5222d' },
        ].map(({ title, value, color }) => (
          <Col key={title} xs={24} sm={12} md={6}>
            <Card size="small"><Statistic title={title} value={value} valueStyle={{ color }} /></Card>
          </Col>
        ))}
      </Row>

      {/* ZKTeco access summary */}
      <Card
        title={<span><SafetyCertificateOutlined style={{ color: '#1890ff', marginRight: 8 }} />ZKTeco Access State</span>}
        size="small"
      >
        <Row gutter={16}>
          {[
            { label: 'Granted', value: summary?.zkteco_granted || 0, color: '#52c41a', icon: <SafetyCertificateOutlined /> },
            { label: 'Pending', value: summary?.zkteco_pending || 0, color: '#8c8c8c', icon: <ClockCircleOutlined /> },
            { label: 'Warning', value: summary?.zkteco_warning || 0, color: '#fa8c16', icon: <WarningOutlined /> },
            { label: 'Revoked', value: summary?.zkteco_revoked || 0, color: '#f5222d', icon: <CloseCircleOutlined /> },
          ].map(({ label, value, color, icon }) => (
            <Col key={label} xs={12} md={6}>
              <Statistic title={<span style={{ color }}>{icon} {label}</span>} value={value} valueStyle={{ color }} />
            </Col>
          ))}
        </Row>
      </Card>

      {/* Charts row 1 */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Contract Type Distribution" size="small">
            {stats?.typeData?.length ? (
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
          <Card title="Status Breakdown" size="small">
            {stats?.statusData?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.statusData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ textTransform: 'capitalize', fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <RTooltip />
                  <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                    {stats.statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>
      </Row>

      {/* Charts row 2 */}
      <Row gutter={16}>
        <Col xs={24}>
          <Card title="Monthly Contract Activity (last 12 months)" size="small">
            {stats?.trendData?.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.trendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <RTooltip />
                  <Line type="monotone" dataKey="count" name="Contracts" stroke="#1890ff" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const EmploymentContract = () => {
  const { message: msg } = App.useApp();
  const queryClient = useQueryClient();

  const [filterType,   setFilterType]   = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [searchText,   setSearchText]   = useState('');
  const [activeTab,    setActiveTab]    = useState('contracts');

  const [modalOpen,     setModalOpen]     = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: contracts = [], isLoading, refetch } = useQuery({
    queryKey: ['employment-contracts'],
    queryFn: () => apiService.get('/api/v1/personnel/contracts?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });

  const { data: summary = {} } = useQuery({
    queryKey: ['employment-contracts-summary'],
    queryFn: () => apiService.get('/api/v1/personnel/contracts/meta/summary'),
    staleTime: 30000,
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel-list'],
    queryFn: () => apiService.get('/api/v1/personnel/?limit=500'),
    staleTime: 60000,
    select: d => Array.isArray(d) ? d : (d?.results || d?.data || []),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.get('/api/v1/departments/'),
    staleTime: 300000,
    select: d => Array.isArray(d) ? d : (d?.results || []),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions-list'],
    queryFn: () => apiService.get('/api/v1/positions/'),
    staleTime: 300000,
    select: d => Array.isArray(d) ? d : (d?.data || []),
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['employment-contracts'] });
    queryClient.invalidateQueries({ queryKey: ['employment-contracts-summary'] });
  };

  const createMutation = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/contracts', d),
    onSuccess: () => { msg.success('Contract created'); closeModal(); invalidate(); },
    onError:   e => msg.error(`Create failed: ${e?.response?.data?.detail || e.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => apiService.put(`/api/v1/personnel/contracts/${id}`, d),
    onSuccess: () => { msg.success('Contract updated'); closeModal(); invalidate(); },
    onError:   e => msg.error(`Update failed: ${e?.response?.data?.detail || e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/contracts/${id}`),
    onSuccess: () => { msg.success('Contract deleted'); invalidate(); },
    onError:   e => msg.error(`Delete failed: ${e?.response?.data?.detail || e.message}`),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, params }) => {
      let url = `/api/v1/personnel/contracts/${id}/${action}`;
      if (params) {
        const qs = new URLSearchParams(params).toString();
        url += `?${qs}`;
      }
      return apiService.put(url);
    },
    onSuccess: (_, { action }) => {
      const labels = { activate: 'activated', terminate: 'terminated', suspend: 'suspended', renew: 'renewed', expire: 'expired' };
      msg.success(`Contract ${labels[action] || action}`);
      invalidate();
    },
    onError: e => msg.error(`Action failed: ${e?.response?.data?.detail || e.message}`),
  });

  // ── Modal helpers ────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingRecord(null);
    setTimeout(() => form.resetFields(), 0);
    setModalOpen(true);
  };

  const openEdit = record => {
    setEditingRecord(record);
    setTimeout(() => {
      form.setFieldsValue({
        ...record,
        start_date:          record.start_date          ? dayjs(record.start_date)          : null,
        end_date:            record.end_date            ? dayjs(record.end_date)            : null,
        probation_end_date:  record.probation_end_date  ? dayjs(record.probation_end_date)  : null,
        signed_date:         record.signed_date         ? dayjs(record.signed_date)         : null,
      });
    }, 0);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      const payload = {
        ...values,
        start_date:         values.start_date         ? values.start_date.format('YYYY-MM-DD')         : null,
        end_date:           values.end_date           ? values.end_date.format('YYYY-MM-DD')           : null,
        probation_end_date: values.probation_end_date ? values.probation_end_date.format('YYYY-MM-DD') : null,
        signed_date:        values.signed_date        ? values.signed_date.format('YYYY-MM-DD')        : null,
      };
      if (editingRecord) updateMutation.mutate({ id: editingRecord.id, d: payload });
      else createMutation.mutate(payload);
    });
  };

  // ── Action buttons ───────────────────────────────────────────────────────

  function actionButtons(r) {
    const { id, status } = r;
    const btns = [];

    if (status === 'draft') {
      btns.push(
        <Tooltip key="activate" title="Activate — grants ZKTeco access">
          <Button size="small" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }}
            icon={<CheckCircleOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'activate' })}>Activate</Button>
        </Tooltip>,
        <Tooltip key="terminate" title="Terminate">
          <Button size="small" danger icon={<CloseCircleOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'terminate' })}>Terminate</Button>
        </Tooltip>,
      );
    }
    if (status === 'active') {
      btns.push(
        <Tooltip key="suspend" title="Suspend — access warning on ZKTeco">
          <Button size="small" icon={<StopOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'suspend' })}>Suspend</Button>
        </Tooltip>,
        <Tooltip key="terminate" title="Terminate — revokes ZKTeco access">
          <Button size="small" danger icon={<CloseCircleOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'terminate' })}>Terminate</Button>
        </Tooltip>,
      );
    }
    if (status === 'suspended') {
      btns.push(
        <Tooltip key="activate" title="Re-activate — restores ZKTeco access">
          <Button size="small" type="primary" icon={<SyncOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'activate' })}>Reactivate</Button>
        </Tooltip>,
        <Tooltip key="terminate" title="Terminate">
          <Button size="small" danger icon={<CloseCircleOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'terminate' })}>Terminate</Button>
        </Tooltip>,
      );
    }
    if (status === 'active' || status === 'expired') {
      btns.push(
        <Tooltip key="renew" title="Renew contract">
          <Button size="small" icon={<FileTextOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'renew' })}>Renew</Button>
        </Tooltip>,
      );
    }
    if (status === 'active') {
      btns.push(
        <Tooltip key="expire" title="Mark as expired">
          <Button size="small" icon={<ExclamationCircleOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'expire' })}>Mark Expired</Button>
        </Tooltip>,
      );
    }
    return btns;
  }

  // ── Filtered data ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return contracts.filter(c => {
      if (filterType   && c.contract_type !== filterType)  return false;
      if (filterStatus && c.status        !== filterStatus) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (
          !c.personnel_name?.toLowerCase().includes(q) &&
          !c.personnel_emp_code?.toLowerCase().includes(q) &&
          !c.contract_number?.toLowerCase().includes(q) &&
          !c.job_title?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [contracts, filterType, filterStatus, searchText]);

  // ── Table columns ────────────────────────────────────────────────────────

  const columns = [
    {
      title: 'Contract #',
      dataIndex: 'contract_number',
      key: 'contract_number',
      width: 130,
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: 'Personnel',
      key: 'personnel',
      width: 160,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.personnel_name || `ID:${r.personnel_id}`}</div>
          {r.personnel_emp_code && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.personnel_emp_code}</div>}
          {r.is_in_probation && <Tag color="purple" style={{ fontSize: 10, marginTop: 2 }}>Probation</Tag>}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'contract_type',
      key: 'contract_type',
      width: 110,
      render: t => <Tag color={TYPE_COLORS[t] || 'default'} style={{ textTransform: 'capitalize' }}>{t?.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Job Title',
      dataIndex: 'job_title',
      key: 'job_title',
      width: 130,
      render: v => v || '—',
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 160,
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          <div>{r.start_date ? dayjs(r.start_date).format('DD MMM YYYY') : '—'}</div>
          {r.end_date && <div style={{ color: '#8c8c8c' }}>→ {dayjs(r.end_date).format('DD MMM YYYY')}</div>}
          {r.is_expiring_soon && (
            <Tag color="orange" icon={<WarningOutlined />} style={{ fontSize: 10, marginTop: 2 }}>
              {r.days_until_expiry}d left
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Salary',
      key: 'salary',
      width: 110,
      render: (_, r) => r.salary
        ? <span>{r.currency} {parseFloat(r.salary).toLocaleString()}<span style={{ color: '#8c8c8c', fontSize: 11 }}>/{r.payment_frequency || 'mo'}</span></span>
        : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: statusTag,
    },
    {
      title: 'ZKTeco',
      dataIndex: 'zkteco_access',
      key: 'zkteco_access',
      width: 120,
      render: zktecoBadge,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.status !== 'terminated' && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>Edit</Button>
          )}
          {['draft', 'terminated', 'expired'].includes(record.status) && (
            <Popconfirm title="Delete this contract?" onConfirm={() => deleteMutation.mutate(record.id)} okText="Yes" cancelText="No">
              <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
          {actionButtons(record)}
        </Space>
      ),
    },
  ];

  // ── Alerts ───────────────────────────────────────────────────────────────

  const expiringSoon  = summary?.expiring_soon || 0;
  const zktecoPending = summary?.zkteco_warning || 0;

  const deptOptions     = departments.map(d => ({ value: d.id, label: d.name }));
  const positionOptions = positions.map(p => ({ value: p.id, label: p.position_name }));
  const personnelOptions = personnel.map(p => ({
    value: p.id,
    label: `${p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ')} (${p.emp_code || p.badge_id || p.id})`,
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '16px 24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'contracts',
            label: 'Contracts',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {expiringSoon > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    message={`${expiringSoon} active contract${expiringSoon > 1 ? 's' : ''} expiring within 30 days — renew to maintain ZKTeco access`}
                    action={<Button size="small" onClick={() => setFilterStatus('active')}>View Active</Button>}
                  />
                )}
                {zktecoPending > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    message={`${zktecoPending} contract${zktecoPending > 1 ? 's' : ''} in suspended/expired state — ZKTeco access review required`}
                    action={<Button size="small" danger onClick={() => setFilterStatus('suspended')}>View</Button>}
                  />
                )}

                {/* Filters */}
                <Card size="small">
                  <Row gutter={12} align="middle">
                    <Col flex="1">
                      <Input.Search
                        placeholder="Search name, emp code, contract #, job title…"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col>
                      <Select
                        placeholder="Type"
                        style={{ width: 140 }}
                        allowClear
                        value={filterType}
                        onChange={setFilterType}
                        options={CONTRACT_TYPES.map(t => ({ value: t, label: t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }))}
                      />
                    </Col>
                    <Col>
                      <Select
                        placeholder="Status"
                        style={{ width: 120 }}
                        allowClear
                        value={filterStatus}
                        onChange={setFilterStatus}
                        options={CONTRACT_STATUSES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                      />
                    </Col>
                    <Col>
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Contract</Button>
                        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                {/* Table */}
                <Card size="small">
                  <Table
                    columns={columns}
                    dataSource={filtered}
                    loading={isLoading}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20, showTotal: t => `${t} contracts` }}
                    scroll={{ x: 1200 }}
                    locale={{ emptyText: <Empty description="No employment contracts found" /> }}
                    rowClassName={r => r.is_expiring_soon ? 'ant-table-row-warning' : ''}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'analytics',
            label: 'Analytics',
            children: <AnalyticsTab contracts={contracts} summary={summary} />,
          },
        ]}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editingRecord ? 'Edit Employment Contract' : 'New Employment Contract'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={closeModal}
        width={760}
        okText={editingRecord ? 'Save Changes' : 'Create'}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Personnel" rules={[{ required: true, message: 'Select personnel' }]}>
                <Select showSearch placeholder="Search personnel…" options={personnelOptions} optionFilterProp="label" disabled={!!editingRecord} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contract_number" label="Contract Number">
                <Input placeholder="Auto-generated if blank (EC-YYYY-NNNN)" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contract_type" label="Contract Type" rules={[{ required: true }]}>
                <Select placeholder="Select type" options={CONTRACT_TYPES.map(t => ({ value: t, label: t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="job_title" label="Job Title">
                <Input placeholder="e.g. Offshore Engineer" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ margin: '8px 0' }}>Duration</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_date" label="Start Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_date" label="End Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="probation_end_date" label="Probation End">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ margin: '8px 0' }}>Compensation</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="salary" label="Salary">
                <InputNumber style={{ width: '100%' }} placeholder="Amount" min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="currency" label="Currency">
                <Select options={[{ value: 'USD', label: 'USD' }, { value: 'NGN', label: 'NGN' }, { value: 'GBP', label: 'GBP' }, { value: 'EUR', label: 'EUR' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="payment_frequency" label="Frequency">
                <Select allowClear placeholder="Monthly…" options={PAY_FREQUENCIES.map(f => ({ value: f, label: f.replace('_', '-') }))} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ margin: '8px 0' }}>Placement</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department_id" label="Department">
                <Select showSearch placeholder="Select department" options={deptOptions} optionFilterProp="label" allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="position_id" label="Position">
                <Select showSearch placeholder="Select position" options={positionOptions} optionFilterProp="label" allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="working_hours" label="Working Hours / Week">
                <InputNumber style={{ width: '100%' }} placeholder="e.g. 40" min={1} max={84} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="signed_date" label="Signed Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="document_url" label="Document URL">
            <Input placeholder="Link to signed contract document" />
          </Form.Item>

          <Form.Item name="terms" label="Terms & Conditions">
            <Input.TextArea rows={3} placeholder="Key contract terms…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmploymentContract;
