import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Input, Modal, Form, Card, Row, Col, Tag,
  Popconfirm, DatePicker, Select, InputNumber, Tabs, Statistic,
  Alert, Tooltip, Divider, Empty, App,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined,
  ArrowRightOutlined, RiseOutlined, FallOutlined, SwapOutlined,
  TrophyOutlined, TeamOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Option } = Select;

const TRANSFER_TYPES = ['promotion', 'department', 'location', 'position', 'role', 'lateral'];
const STATUSES       = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];

const TYPE_COLORS = {
  promotion:  '#52c41a',
  department: '#1890ff',
  location:   '#fa8c16',
  position:   '#722ed1',
  role:       '#eb2f96',
  lateral:    '#13c2c2',
};

const STATUS_COLORS = {
  pending:   '#faad14',
  approved:  '#1890ff',
  rejected:  '#f5222d',
  completed: '#52c41a',
  cancelled: '#8c8c8c',
};

const TYPE_ICONS = {
  promotion:  <TrophyOutlined />,
  department: <TeamOutlined />,
  location:   <EnvironmentOutlined />,
  position:   <SwapOutlined />,
  role:       <SwapOutlined />,
  lateral:    <SwapOutlined />,
};

const PIE_PALETTE = ['#1890ff','#52c41a','#fa8c16','#722ed1','#eb2f96','#13c2c2','#f5222d','#faad14'];

// ── helpers ───────────────────────────────────────────────────────────────────

function statusTag(s) {
  return <Tag color={STATUS_COLORS[s] || 'default'} style={{ textTransform: 'capitalize' }}>{s}</Tag>;
}

function typeTag(t) {
  return (
    <Tag color={TYPE_COLORS[t] || 'default'} icon={TYPE_ICONS[t]} style={{ textTransform: 'capitalize' }}>
      {t}
    </Tag>
  );
}

function salaryBadge(v) {
  if (v == null || v === '') return <span style={{ color: '#8c8c8c' }}>—</span>;
  const n = parseFloat(v);
  if (n === 0) return <span style={{ color: '#8c8c8c' }}>±0</span>;
  return n > 0
    ? <span style={{ color: '#52c41a' }}><RiseOutlined /> +{n.toLocaleString()}</span>
    : <span style={{ color: '#f5222d' }}><FallOutlined /> {n.toLocaleString()}</span>;
}

// ── Analytics sub-component ───────────────────────────────────────────────────

function AnalyticsTab({ transfers, summary }) {
  const stats = useMemo(() => {
    if (!transfers.length) return null;

    const byType   = {};
    const byStatus = {};
    const byMonth  = {};
    let salaryDelta = 0;
    let salaryIncreases = 0;
    let salaryDecreases = 0;

    transfers.forEach(t => {
      byType[t.transfer_type]  = (byType[t.transfer_type]  || 0) + 1;
      byStatus[t.status]       = (byStatus[t.status]       || 0) + 1;
      const m = dayjs(t.created_at).format('MMM YY');
      byMonth[m] = (byMonth[m] || 0) + 1;
      if (t.salary_change && t.status === 'completed') {
        const n = parseFloat(t.salary_change);
        salaryDelta += n;
        if (n > 0) salaryIncreases++;
        else if (n < 0) salaryDecreases++;
      }
    });

    const typeData   = Object.entries(byType).map(([name, value]) => ({ name, value }));
    const statusData = STATUSES.filter(s => byStatus[s]).map(s => ({ name: s, count: byStatus[s], fill: STATUS_COLORS[s] }));

    const months = Object.keys(byMonth).slice(-12);
    const trendData = months.map(m => ({ month: m, count: byMonth[m] }));

    return { typeData, statusData, trendData, salaryDelta, salaryIncreases, salaryDecreases };
  }, [transfers]);

  if (!transfers.length) {
    return (
      <Card><Empty description="No records yet — create a promotion or transfer to see analytics." /></Card>
    );
  }

  const pending   = summary?.pending   || 0;
  const completed = summary?.completed || 0;
  const total     = summary?.total     || transfers.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI cards */}
      <Row gutter={16}>
        {[
          { title: 'Total Records', value: total, color: '#1890ff' },
          { title: 'Pending Approval', value: pending, color: '#faad14' },
          { title: 'Completed', value: completed, color: '#52c41a' },
          { title: 'Net Salary Delta', value: `${summary?.total_salary_delta >= 0 ? '+' : ''}${(summary?.total_salary_delta || 0).toLocaleString()}`, color: summary?.total_salary_delta >= 0 ? '#52c41a' : '#f5222d' },
        ].map(({ title, value, color }) => (
          <Col key={title} xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic title={title} value={value} valueStyle={{ color }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts row 1 */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Transfer Type Distribution" size="small">
            {stats?.typeData?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stats.typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
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
                  <XAxis dataKey="name" tick={{ textTransform: 'capitalize' }} />
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
        <Col xs={24} md={16}>
          <Card title="Monthly Trend (last 12 months)" size="small">
            {stats?.trendData?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.trendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <RTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" name="Records" stroke="#1890ff" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Salary Impact (completed)" size="small" style={{ height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '16px 0' }}>
              <Statistic
                title="Net Salary Delta"
                value={`${(stats?.salaryDelta || 0) >= 0 ? '+' : ''}${(stats?.salaryDelta || 0).toLocaleString()}`}
                valueStyle={{ color: (stats?.salaryDelta || 0) >= 0 ? '#52c41a' : '#f5222d', fontSize: 22 }}
                prefix={(stats?.salaryDelta || 0) >= 0 ? <RiseOutlined /> : <FallOutlined />}
              />
              <Row gutter={8}>
                <Col span={12}>
                  <Statistic title="Increases" value={stats?.salaryIncreases || 0} valueStyle={{ color: '#52c41a', fontSize: 18 }} prefix={<RiseOutlined />} />
                </Col>
                <Col span={12}>
                  <Statistic title="Decreases" value={stats?.salaryDecreases || 0} valueStyle={{ color: '#f5222d', fontSize: 18 }} prefix={<FallOutlined />} />
                </Col>
              </Row>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PromotionTransfer = () => {
  const { message: msg, modal } = App.useApp();
  const queryClient = useQueryClient();

  const [filterType,   setFilterType]   = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [searchText,   setSearchText]   = useState('');
  const [activeTab,    setActiveTab]    = useState('records');

  const [modalOpen,       setModalOpen]       = useState(false);
  const [editingRecord,   setEditingRecord]   = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget,    setRejectTarget]    = useState(null);
  const [rejectReason,    setRejectReason]    = useState('');

  const [form] = Form.useForm();

  // ── Data queries ─────────────────────────────────────────────────────────

  const { data: transfers = [], isLoading, refetch } = useQuery({
    queryKey: ['promotion-transfers'],
    queryFn: () => apiService.get('/api/v1/personnel/promotion-transfers?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });

  const { data: summary = {} } = useQuery({
    queryKey: ['promotion-transfers-summary'],
    queryFn: () => apiService.get('/api/v1/personnel/promotion-transfers/meta/summary'),
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

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['promotion-transfers'] });
    queryClient.invalidateQueries({ queryKey: ['promotion-transfers-summary'] });
  };

  const createMutation = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/promotion-transfers', d),
    onSuccess: () => { msg.success('Record created'); closeModal(); invalidate(); },
    onError: e => msg.error(`Create failed: ${e?.response?.data?.detail || e.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => apiService.put(`/api/v1/personnel/promotion-transfers/${id}`, d),
    onSuccess: () => { msg.success('Record updated'); closeModal(); invalidate(); },
    onError: e => msg.error(`Update failed: ${e?.response?.data?.detail || e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/promotion-transfers/${id}`),
    onSuccess: () => { msg.success('Record deleted'); invalidate(); },
    onError: e => msg.error(`Delete failed: ${e?.response?.data?.detail || e.message}`),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, rejectionReason }) => {
      let url = `/api/v1/personnel/promotion-transfers/${id}/${action}`;
      if (rejectionReason) url += `?rejection_reason=${encodeURIComponent(rejectionReason)}`;
      return apiService.put(url);
    },
    onSuccess: (_, { action }) => { msg.success(`Record ${action}d`); invalidate(); },
    onError: e => msg.error(`Action failed: ${e?.response?.data?.detail || e.message}`),
  });

  // ── Modal helpers ─────────────────────────────────────────────────────────

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
        effective_date: record.effective_date ? dayjs(record.effective_date) : null,
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
        effective_date: values.effective_date ? values.effective_date.format('YYYY-MM-DD') : null,
        salary_change: values.salary_change ?? null,
      };
      if (editingRecord) {
        updateMutation.mutate({ id: editingRecord.id, d: payload });
      } else {
        createMutation.mutate(payload);
      }
    });
  };

  // ── Action buttons per row ────────────────────────────────────────────────

  function actionButtons(record) {
    const { id, status } = record;
    const btns = [];

    if (status === 'pending') {
      btns.push(
        <Tooltip key="approve" title="Approve">
          <Button size="small" type="primary" icon={<CheckCircleOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'approve' })}>Approve</Button>
        </Tooltip>,
        <Tooltip key="reject" title="Reject">
          <Button size="small" danger icon={<CloseCircleOutlined />}
            onClick={() => { setRejectTarget(id); setRejectReason(''); setRejectModalOpen(true); }}>Reject
          </Button>
        </Tooltip>,
        <Tooltip key="cancel" title="Cancel">
          <Button size="small" icon={<StopOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'cancel' })}>Cancel</Button>
        </Tooltip>,
      );
    }
    if (status === 'approved') {
      btns.push(
        <Tooltip key="complete" title="Mark Completed">
          <Button size="small" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }}
            icon={<CheckCircleOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'complete' })}>Complete</Button>
        </Tooltip>,
        <Tooltip key="cancel" title="Cancel">
          <Button size="small" icon={<StopOutlined />}
            onClick={() => actionMutation.mutate({ id, action: 'cancel' })}>Cancel</Button>
        </Tooltip>,
      );
    }
    if (status === 'rejected' || status === 'cancelled') {
      btns.push(
        <Tooltip key="reopen" title="Resubmit as Pending">
          <Button size="small" icon={<ReloadOutlined />}
            onClick={() => updateMutation.mutate({ id, d: { status: 'pending' } })}>Resubmit</Button>
        </Tooltip>,
      );
    }
    return btns;
  }

  // ── Filtered data ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return transfers.filter(t => {
      if (filterType   && t.transfer_type !== filterType) return false;
      if (filterStatus && t.status        !== filterStatus) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (
          !t.personnel_name?.toLowerCase().includes(q) &&
          !t.personnel_emp_code?.toLowerCase().includes(q) &&
          !t.reason?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [transfers, filterType, filterStatus, searchText]);

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns = [
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
      title: 'Type',
      dataIndex: 'transfer_type',
      key: 'transfer_type',
      width: 110,
      render: typeTag,
    },
    {
      title: 'From → To',
      key: 'movement',
      width: 220,
      render: (_, r) => {
        const rows = [];
        if (r.from_department_name || r.to_department_name) {
          rows.push(<div key="dept" style={{ fontSize: 12 }}><span style={{ color: '#8c8c8c' }}>Dept: </span>{r.from_department_name || '—'} <ArrowRightOutlined style={{ fontSize: 10 }} /> {r.to_department_name || '—'}</div>);
        }
        if (r.from_position_name || r.to_position_name) {
          rows.push(<div key="pos" style={{ fontSize: 12 }}><span style={{ color: '#8c8c8c' }}>Pos: </span>{r.from_position_name || '—'} <ArrowRightOutlined style={{ fontSize: 10 }} /> {r.to_position_name || '—'}</div>);
        }
        if (r.from_location || r.to_location) {
          rows.push(<div key="loc" style={{ fontSize: 12 }}><span style={{ color: '#8c8c8c' }}>Site: </span>{r.from_location || '—'} <ArrowRightOutlined style={{ fontSize: 10 }} /> {r.to_location || '—'}</div>);
        }
        return rows.length ? <div>{rows}</div> : <span style={{ color: '#bfbfbf' }}>—</span>;
      },
    },
    {
      title: 'Salary Δ',
      dataIndex: 'salary_change',
      key: 'salary_change',
      width: 100,
      render: salaryBadge,
    },
    {
      title: 'Effective',
      dataIndex: 'effective_date',
      key: 'effective_date',
      width: 100,
      render: d => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: statusTag,
    },
    {
      title: 'Requested By',
      dataIndex: 'requester_name',
      key: 'requester_name',
      width: 110,
      render: v => v || '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 240,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.status !== 'completed' && (
            <Button size="small" icon={<EditOutlined />}
              onClick={() => openEdit(record)}>Edit</Button>
          )}
          {['pending', 'rejected', 'cancelled'].includes(record.status) && (
            <Popconfirm title="Delete this record?" onConfirm={() => deleteMutation.mutate(record.id)} okText="Yes" cancelText="No">
              <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
          {actionButtons(record)}
        </Space>
      ),
    },
  ];

  // ── Pending alert ─────────────────────────────────────────────────────────

  const pendingCount = summary?.pending || 0;

  // ── Render ────────────────────────────────────────────────────────────────

  const deptOptions = departments.map(d => ({ value: d.id, label: d.name }));
  const positionOptions = positions.map(p => ({ value: p.id, label: p.position_name }));
  const personnelOptions = personnel.map(p => ({
    value: p.id,
    label: `${p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ')} (${p.emp_code || p.badge_id || p.id})`,
  }));

  return (
    <div style={{ padding: '16px 24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'records',
            label: 'Records',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingCount > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    message={`${pendingCount} record${pendingCount > 1 ? 's' : ''} pending approval`}
                    action={<Button size="small" onClick={() => setFilterStatus('pending')}>View Pending</Button>}
                  />
                )}

                {/* Filters */}
                <Card size="small">
                  <Row gutter={12} align="middle">
                    <Col flex="1">
                      <Input.Search
                        placeholder="Search name, emp code, reason…"
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
                        options={TRANSFER_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
                      />
                    </Col>
                    <Col>
                      <Select
                        placeholder="Status"
                        style={{ width: 130 }}
                        allowClear
                        value={filterStatus}
                        onChange={setFilterStatus}
                        options={STATUSES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                      />
                    </Col>
                    <Col>
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New</Button>
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
                    pagination={{ pageSize: 20, showTotal: t => `${t} records` }}
                    scroll={{ x: 1100 }}
                    locale={{ emptyText: <Empty description="No promotion/transfer records found" /> }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'analytics',
            label: 'Analytics',
            children: <AnalyticsTab transfers={transfers} summary={summary} />,
          },
        ]}
      />

      {/* Create / Edit modal */}
      <Modal
        title={editingRecord ? 'Edit Record' : 'New Promotion / Transfer'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={closeModal}
        width={720}
        okText={editingRecord ? 'Save Changes' : 'Create'}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Personnel" rules={[{ required: true, message: 'Select personnel' }]}>
                <Select
                  showSearch
                  placeholder="Search personnel…"
                  options={personnelOptions}
                  optionFilterProp="label"
                  disabled={!!editingRecord}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="transfer_type" label="Transfer Type" rules={[{ required: true }]}>
                <Select placeholder="Select type" options={TRANSFER_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ margin: '8px 0' }}>Department</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="from_department_id" label="From Department">
                <Select showSearch placeholder="Current dept" options={deptOptions} optionFilterProp="label" allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="to_department_id" label="To Department">
                <Select showSearch placeholder="New dept" options={deptOptions} optionFilterProp="label" allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ margin: '8px 0' }}>Position</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="from_position_id" label="From Position">
                <Select showSearch placeholder="Current position" options={positionOptions} optionFilterProp="label" allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="to_position_id" label="To Position">
                <Select showSearch placeholder="New position" options={positionOptions} optionFilterProp="label" allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ margin: '8px 0' }}>Location / Site</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="from_location" label="From Location">
                <Input placeholder="e.g. Bonga FPSO" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="to_location" label="To Location">
                <Input placeholder="e.g. Lagos Office" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain style={{ margin: '8px 0' }}>Dates & Salary</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="effective_date" label="Effective Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="salary_change" label="Salary Change (net)">
                <InputNumber style={{ width: '100%' }} placeholder="e.g. 50000 or -20000" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="reason" label="Reason / Notes">
            <Input.TextArea rows={3} placeholder="Reason for this promotion or transfer…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject reason modal */}
      <Modal
        title="Rejection Reason"
        open={rejectModalOpen}
        onOk={() => {
          actionMutation.mutate({ id: rejectTarget, action: 'reject', rejectionReason: rejectReason || undefined });
          setRejectModalOpen(false);
        }}
        onCancel={() => setRejectModalOpen(false)}
        okText="Reject"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Optional reason for rejection…"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default PromotionTransfer;
