import React, { useState, useMemo } from 'react';
import {
  Tree, Card, Button, Space, Modal, Form, Input, Select,
  Popconfirm, Tooltip, Tag, Table, Row, Col, Statistic,
  Drawer, Descriptions, Badge, Switch, Divider, Empty, Spin, Alert,
  Tabs, Progress, InputNumber, App, Avatar, Typography,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined,
  TeamOutlined, ReloadOutlined, SearchOutlined, TableOutlined,
  SafetyOutlined, UserOutlined, PhoneOutlined, MailOutlined,
  BranchesOutlined, InfoCircleOutlined, CheckCircleOutlined,
  ClockCircleOutlined, EyeOutlined, SyncOutlined, ThunderboltOutlined,
  DollarOutlined, BarChartOutlined, DisconnectOutlined, WifiOutlined,
  LinkOutlined, CloudUploadOutlined, WarningOutlined, CalendarOutlined,
  EnvironmentOutlined, MinusCircleOutlined, IdcardOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiService from '../../../services/api';

const { Option } = Select;
const { Text } = Typography;

const DEPT_TYPE_COLORS = {
  operations:     'blue',
  maintenance:    'orange',
  safety:         'red',
  security:       'purple',
  administration: 'cyan',
  logistics:      'green',
  technical:      'geekblue',
  medical:        'magenta',
  training:       'gold',
  contractor:     'lime',
  management:     'volcano',
  support:        'default',
};

const CHART_COLORS = ['#1890ff','#52c41a','#fa8c16','#722ed1','#13c2c2','#f5222d','#2f54eb','#eb2f96','#faad14','#a0d911'];

const DEPT_TYPES = [
  'operations','maintenance','safety','security','administration',
  'logistics','technical','medical','training','contractor','management','support',
];

const STATUS_CONFIG = {
  active:       { color: 'success',    icon: <CheckCircleOutlined /> },
  inactive:     { color: 'error',      icon: <ClockCircleOutlined /> },
  temporary:    { color: 'warning',    icon: <ClockCircleOutlined /> },
  under_review: { color: 'processing', icon: <InfoCircleOutlined /> },
};

const ZKTECO_CONFIG = {
  synced:         { color: '#52c41a', label: 'Synced',         antColor: 'success',  icon: <SyncOutlined /> },
  pending:        { color: '#fa8c16', label: 'Pending',        antColor: 'warning',  icon: <ClockCircleOutlined /> },
  not_configured: { color: '#8c8c8c', label: 'Not Configured', antColor: 'default',  icon: <DisconnectOutlined /> },
  disabled:       { color: '#bfbfbf', label: 'Disabled',       antColor: 'default',  icon: <DisconnectOutlined /> },
};

const AVATAR_PALETTE = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed'];
const avatarColor = (s) => AVATAR_PALETTE[(s||'').split('').reduce((a,c) => a + c.charCodeAt(0), 0) % AVATAR_PALETTE.length];
const initials    = (name) => (name||'').split(' ').filter(Boolean).slice(0,2).map(p => p[0].toUpperCase()).join('') || '?';


// ── Analytics ────────────────────────────────────────────────────────────────

function AnalyticsTab({ departments, summary }) {
  const stats = useMemo(() => {
    const byType   = {};
    const byStatus = {};
    departments.forEach(d => {
      const dt = d.department_type || 'other';
      byType[dt]   = (byType[dt]   || 0) + 1;
      const st = d.status || 'active';
      byStatus[st] = (byStatus[st] || 0) + 1;
    });
    const typeData   = Object.entries(byType).map(([name, value]) => ({ name, value }));
    const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
    const zkData = [
      { name: 'Synced',         value: summary.zkteco_synced  || 0, fill: '#52c41a' },
      { name: 'Pending',        value: summary.zkteco_pending || 0, fill: '#fa8c16' },
      { name: 'Not Configured', value: Math.max(0, (summary.total_departments || departments.length) - (summary.zkteco_synced || 0) - (summary.zkteco_pending || 0)), fill: '#8c8c8c' },
    ].filter(d => d.value > 0);
    const budgetDepts = departments.filter(d => d.budget_allocated > 0);
    return { typeData, statusData, zkData, budgetDepts };
  }, [departments, summary]);

  if (!departments.length) return <Card><Empty description="No departments yet." /></Card>;

  const budgetUtil = summary.total_budget_allocated > 0
    ? Math.round((summary.total_budget_used / summary.total_budget_allocated) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={16}>
        {[
          { title: 'Total Departments',  value: summary.total_departments || departments.length, color: '#1890ff', icon: <ApartmentOutlined /> },
          { title: 'Active',             value: summary.active || 0,                             color: '#52c41a', icon: <CheckCircleOutlined /> },
          { title: 'Personnel Assigned', value: summary.total_personnel_assigned || 0,           color: '#722ed1', icon: <TeamOutlined /> },
          { title: 'Safety Critical',    value: summary.safety_critical || 0,                    color: '#f5222d', icon: <SafetyOutlined /> },
        ].map(({ title, value, color, icon }) => (
          <Col key={title} xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic title={title} value={value} valueStyle={{ color }}
                prefix={React.cloneElement(icon, { style: { color } })} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card title={<Space><WifiOutlined style={{ color: '#1890ff' }} />ZKTeco Sync State</Space>} size="small">
        <Row gutter={24}>
          {[
            { label: 'Synced',         value: summary.zkteco_synced  || 0, color: '#52c41a' },
            { label: 'Pending',        value: summary.zkteco_pending || 0, color: '#fa8c16' },
            { label: 'Not Configured', value: Math.max(0, (summary.total_departments || departments.length) - (summary.zkteco_synced || 0) - (summary.zkteco_pending || 0)), color: '#8c8c8c' },
          ].map(({ label, value, color }) => (
            <Col key={label} xs={8}>
              <Statistic title={label} value={value} valueStyle={{ color, fontSize: 20 }} />
            </Col>
          ))}
          {summary.total_budget_allocated > 0 && (
            <Col xs={24} style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>Overall Budget Utilization</span>
              <Progress percent={budgetUtil} style={{ marginTop: 4 }}
                status={budgetUtil > 90 ? 'exception' : budgetUtil > 75 ? 'active' : 'normal'} />
            </Col>
          )}
        </Row>
      </Card>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Distribution by Type" size="small">
            {stats.typeData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stats.typeData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {stats.typeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <RTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="ZKTeco Sync Distribution" size="small">
            {stats.zkData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stats.zkData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {stats.zkData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <RTooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>
      </Row>
      {stats.statusData.length > 0 && (
        <Card title="Departments by Status" size="small">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.statusData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" /><YAxis allowDecimals={false} />
              <RTooltip />
              <Bar dataKey="value" name="Departments" radius={[4, 4, 0, 0]}>
                {stats.statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      {stats.budgetDepts.length > 0 && (
        <Card title="Budget Utilization per Department" size="small">
          <Table dataSource={stats.budgetDepts} rowKey="id" size="small" pagination={false}
            columns={[
              { title: 'Department', dataIndex: 'name', key: 'name' },
              { title: 'Type', dataIndex: 'department_type', key: 'type', render: (t) => t ? <Tag color={DEPT_TYPE_COLORS[t]}>{t}</Tag> : '-' },
              { title: 'Allocated', dataIndex: 'budget_allocated', key: 'alloc', render: (v) => `$${Number(v || 0).toLocaleString()}` },
              { title: 'Used',      dataIndex: 'budget_used',      key: 'used',  render: (v) => `$${Number(v || 0).toLocaleString()}` },
              { title: 'Utilization', key: 'util', render: (_, r) => (
                <Progress percent={r.budget_utilization || 0} size="small"
                  status={r.budget_utilization > 90 ? 'exception' : r.budget_utilization > 75 ? 'active' : 'normal'} />
              )},
            ]}
          />
        </Card>
      )}
    </div>
  );
}


// ── ZKTeco Sync tab ──────────────────────────────────────────────────────────

function ZktecoSyncTab({ departments, onPushAll, pushingId }) {
  const { data: comparison = { matched: [], local_only: [], biotime_only: [], total_local: 0, total_biotime: 0, total_matched: 0 }, isLoading, refetch } = useQuery({
    queryKey: ['departments-zkteco-compare'],
    queryFn:  () => apiService.get('/api/v1/departments/meta/zkteco-compare'),
    staleTime: 15000,
  });

  const allRows = useMemo(() => {
    const matched = (comparison.matched || []).map(r => ({ ...r, _status: 'linked' }));
    const local   = (comparison.local_only || []).map(r => ({ ...r, _status: 'local_only' }));
    const bt      = (comparison.biotime_only || []).map(r => ({ ...r, _status: 'biotime_only' }));
    return [...matched, ...local, ...bt];
  }, [comparison]);

  const syncColumns = [
    {
      title: 'Local Department', key: 'local',
      render: (_, r) => r.local_name
        ? <Space><ApartmentOutlined style={{ color: '#1890ff' }} /><strong>{r.local_name}</strong><Tag style={{ fontSize: 11 }}>{r.local_code}</Tag></Space>
        : <span style={{ color: '#bfbfbf' }}>—</span>,
    },
    {
      title: 'BioTime Department', key: 'biotime',
      render: (_, r) => r.biotime_name
        ? (
          <Space>
            <ThunderboltOutlined style={{ color: '#722ed1' }} />
            <span>{r.biotime_name}</span>
            {r.biotime_code && <Tag color="purple" style={{ fontSize: 11 }}>{r.biotime_code}</Tag>}
            <Tag color="purple" style={{ fontSize: 10 }}>ID #{r.biotime_id}</Tag>
          </Space>
        )
        : <span style={{ color: '#bfbfbf' }}>—</span>,
    },
    {
      title: 'Sync Status', key: 'sync_status',
      render: (_, r) => {
        if (r._status === 'linked') {
          const allMatch = r.name_match && r.code_match;
          const partial  = r.name_match || r.code_match;
          if (allMatch) return <Tag color="success" icon={<CheckCircleOutlined />}>Fully Matched</Tag>;
          if (partial)  return <Tag color="warning" icon={<WarningOutlined />}>Partial Match</Tag>;
          return <Tag color="warning" icon={<WarningOutlined />}>Linked (Name Differs)</Tag>;
        }
        if (r._status === 'local_only')   return <Tag color="default" icon={<DisconnectOutlined />}>Not in BioTime</Tag>;
        if (r._status === 'biotime_only') return <Tag color="purple"  icon={<ThunderboltOutlined />}>BioTime Only</Tag>;
        return null;
      },
    },
    {
      title: 'Action', key: 'action',
      render: (_, r) => {
        if (r._status === 'local_only') {
          return (
            <Button size="small" type="primary" icon={<CloudUploadOutlined />}
              loading={pushingId === r.local_id} onClick={() => onPushAll(r.local_id)}>
              Push to BioTime
            </Button>
          );
        }
        if (r._status === 'linked') return <Tag color="success" icon={<CheckCircleOutlined />}>Synced</Tag>;
        return null;
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={16}>
        {[
          { title: 'Local Departments',   value: comparison.total_local,   color: '#1890ff', icon: <ApartmentOutlined /> },
          { title: 'BioTime Departments', value: comparison.total_biotime, color: '#722ed1', icon: <ThunderboltOutlined /> },
          { title: 'Linked / Matched',    value: comparison.total_matched, color: '#52c41a', icon: <LinkOutlined /> },
          { title: 'Not Synced',          value: (comparison.local_only || []).length, color: '#fa8c16', icon: <DisconnectOutlined /> },
        ].map(({ title, value, color, icon }) => (
          <Col key={title} xs={24} sm={12} md={6}>
            <Card size="small">
              <Statistic title={title} value={value || 0} valueStyle={{ color }}
                prefix={React.cloneElement(icon, { style: { color } })} />
            </Card>
          </Col>
        ))}
      </Row>
      {(comparison.local_only || []).length > 0 && (
        <Alert type="warning" showIcon icon={<WarningOutlined />}
          message={`${(comparison.local_only || []).length} department(s) not yet in BioTime`}
          description="Use 'Push to BioTime' to create them in the BioTime personnel_department table and link them automatically."
          action={
            <Button size="small" type="primary" icon={<CloudUploadOutlined />} loading={!!pushingId}
              onClick={() => (comparison.local_only || []).forEach(r => onPushAll(r.local_id))}>
              Push All
            </Button>
          }
        />
      )}
      {(comparison.local_only || []).length === 0 && comparison.total_biotime > 0 && (
        <Alert type="success" showIcon message="All local departments are linked to BioTime." />
      )}
      {comparison.total_biotime === 0 && comparison.total_local > 0 && (
        <Alert type="info" showIcon message="BioTime has no department records yet."
          description="Push your local departments to BioTime to establish sync." />
      )}
      <Card title={<Space><LinkOutlined />Department Sync Comparison</Space>} size="small"
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={refetch}>Refresh</Button>}>
        <Spin spinning={isLoading}>
          <Table dataSource={allRows}
            rowKey={(r, i) => `${r._status}-${r.local_id || r.biotime_id || i}`}
            columns={syncColumns} size="small" pagination={false}
            rowClassName={(r) =>
              r._status === 'linked' ? 'row-linked' :
              r._status === 'biotime_only' ? 'row-bt-only' : ''
            }
          />
        </Spin>
      </Card>
    </div>
  );
}


// ── Personnel tab inside the drawer ─────────────────────────────────────────

function DeptPersonnelTab({ deptId, onEdit }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [assignModal, setAssignModal] = useState(false);
  const [assignForm] = Form.useForm();

  const { data: members = [], isLoading, refetch } = useQuery({
    queryKey: ['dept-personnel', deptId],
    queryFn:  () => apiService.get(`/api/v1/departments/${deptId}/personnel?status=active`),
    staleTime: 15000,
    enabled: !!deptId,
  });

  const { data: personnelList = [] } = useQuery({
    queryKey: ['personnel-list-minimal'],
    queryFn:  () => apiService.get('/api/v1/personnel/?limit=500').then(r => Array.isArray(r) ? r : (r?.data ?? r?.results ?? [])),
    staleTime: 60000,
  });

  const removeMutation = useMutation({
    mutationFn: ({ pid }) => apiService.delete(`/api/v1/departments/${deptId}/personnel/${pid}/`),
    onSuccess: () => { message.success('Removed from department'); queryClient.invalidateQueries({ queryKey: ['dept-personnel', deptId] }); queryClient.invalidateQueries({ queryKey: ['departments'] }); },
    onError: (e) => message.error('Remove failed: ' + (e?.response?.data?.detail || e?.message)),
  });

  const assignMutation = useMutation({
    mutationFn: (data) => apiService.post(`/api/v1/departments/${deptId}/assign-personnel`, data),
    onSuccess: () => { message.success('Personnel assigned'); setAssignModal(false); assignForm.resetFields(); queryClient.invalidateQueries({ queryKey: ['dept-personnel', deptId] }); queryClient.invalidateQueries({ queryKey: ['departments'] }); },
    onError: (e) => message.error('Assign failed: ' + (e?.response?.data?.detail || e?.message)),
  });

  const assignedIds = new Set(members.map(m => m.personnel_id));
  const available   = personnelList.filter(p => !assignedIds.has(p.id));

  const cols = [
    {
      title: 'Employee', key: 'emp', width: 200,
      render: (_, r) => (
        <Space>
          <Avatar size={28} style={{ background: avatarColor(r.personnel_name), fontSize: 11, fontWeight: 600 }}>
            {initials(r.personnel_name)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{r.personnel_name || `#${r.personnel_id}`}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>{r.emp_code}</div>
          </div>
        </Space>
      ),
    },
    { title: 'Role',     dataIndex: 'role',     key: 'role',     width: 130 },
    { title: 'Position', dataIndex: 'position', key: 'position', width: 130, render: v => v || <span style={{ color: '#bfbfbf' }}>—</span> },
    {
      title: 'Flags', key: 'flags', width: 100,
      render: (_, r) => (
        <Space>
          {r.is_manager && <Tag color="blue"  style={{ fontSize: 10 }}>Manager</Tag>}
          {r.is_primary && <Tag color="green" style={{ fontSize: 10 }}>Primary</Tag>}
        </Space>
      ),
    },
    {
      title: '', key: 'remove', width: 60, align: 'center',
      render: (_, r) => (
        <Popconfirm title="Remove from department?" onConfirm={() => removeMutation.mutate({ pid: r.personnel_id })} okText="Remove" okType="danger">
          <Tooltip title="Remove"><Button type="text" danger size="small" icon={<MinusCircleOutlined />} /></Tooltip>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: '#595959' }}>{members.length} active member{members.length !== 1 ? 's' : ''}</Text>
        <Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={refetch}>Refresh</Button>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setAssignModal(true)}>Assign Personnel</Button>
        </Space>
      </div>
      <Spin spinning={isLoading}>
        {members.length === 0
          ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No personnel assigned" style={{ padding: '20px 0' }} />
          : <Table dataSource={members} rowKey="id" columns={cols} size="small" pagination={false} scroll={{ y: 340 }} />
        }
      </Spin>

      <Modal title="Assign Personnel" open={assignModal} onCancel={() => { setAssignModal(false); assignForm.resetFields(); }}
        onOk={() => assignForm.validateFields().then(v => assignMutation.mutate(v))}
        confirmLoading={assignMutation.isPending} okText="Assign" width={480}>
        <Form form={assignForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="Personnel" name="personnel_id" rules={[{ required: true, message: 'Select a person' }]}>
            <Select showSearch placeholder="Search by name or code" optionFilterProp="label"
              options={available.map(p => ({
                value: p.id,
                label: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.full_name || `#${p.id}`,
                title: p.emp_code,
              }))}
              optionRender={(opt) => (
                <Space>
                  <Avatar size={20} style={{ background: avatarColor(opt.label), fontSize: 9 }}>{initials(opt.label)}</Avatar>
                  <span>{opt.label}</span>
                  <Tag style={{ fontSize: 10 }}>{opt.data.title}</Tag>
                </Space>
              )}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Role" name="role" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. Engineer, Technician" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Position" name="position">
                <Input placeholder="e.g. Senior, Lead" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Primary Contact" name="is_primary" valuePropName="checked" initialValue={false}>
                <Switch size="small" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Department Manager" name="is_manager" valuePropName="checked" initialValue={false}>
                <Switch size="small" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}


// ── Main component ────────────────────────────────────────────────────────────

const DepartmentTree = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form]      = Form.useForm();

  const [treeData, setTreeData]               = useState([]);
  const [isModalVisible, setIsModalVisible]   = useState(false);
  const [editingDept, setEditingDept]         = useState(null);
  const [expandedKeys, setExpandedKeys]       = useState([]);
  const [searchText, setSearchText]           = useState('');
  const [filterType, setFilterType]           = useState(null);
  const [filterStatus, setFilterStatus]       = useState(null);
  const [viewMode, setViewMode]               = useState('tree');
  const [drawerDept, setDrawerDept]           = useState(null);
  const [drawerVisible, setDrawerVisible]     = useState(false);
  const [drawerTab, setDrawerTab]             = useState('overview');
  const [activeTab, setActiveTab]             = useState('overview');
  const [pushingId, setPushingId]             = useState(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: departments = [], isLoading, refetch } = useQuery({
    queryKey: ['departments'],
    queryFn:  () => apiService.get('/api/v1/departments/').then(r => Array.isArray(r) ? r : (r?.data || r?.results || [])),
    staleTime: 30000,
  });

  const { data: summary = {} } = useQuery({
    queryKey: ['departments-summary'],
    queryFn:  () => apiService.get('/api/v1/departments/meta/summary'),
    staleTime: 30000,
  });

  const { data: shiftsRaw } = useQuery({
    queryKey: ['att-shifts-list'],
    queryFn:  () => apiService.get('/api/v1/attendance/shifts'),
    staleTime: 60_000,
  });
  const shifts = Array.isArray(shiftsRaw) ? shiftsRaw : (shiftsRaw?.data ?? []);

  const { data: personnelRaw } = useQuery({
    queryKey: ['personnel-list-minimal'],
    queryFn:  () => apiService.get('/api/v1/personnel/?limit=500').then(r => Array.isArray(r) ? r : (r?.data ?? r?.results ?? [])),
    staleTime: 60_000,
  });
  const personnelList = Array.isArray(personnelRaw) ? personnelRaw : [];

  // Build tree from flat list
  React.useEffect(() => {
    if (!departments.length) { setTreeData([]); return; }
    const build = (list, parentId = null) =>
      list.filter(d => (d.parent_id ?? null) === parentId)
          .map(d => ({ key: d.id, title: d.name, data: d, children: build(list, d.id) }));
    setTreeData(build(departments));
    setExpandedKeys(departments.filter(d => !d.parent_id).map(d => d.id));
  }, [departments]);

  // Sync drawer record with latest data
  React.useEffect(() => {
    if (drawerDept && departments.length) {
      const updated = departments.find(d => d.id === drawerDept.id);
      if (updated) setDrawerDept(updated);
    }
  }, [departments]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    queryClient.invalidateQueries({ queryKey: ['departments-summary'] });
    queryClient.invalidateQueries({ queryKey: ['departments-zkteco-compare'] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => apiService.post('/api/v1/departments/', data),
    onSuccess:  () => { message.success('Department created'); setIsModalVisible(false); form.resetFields(); invalidate(); },
    onError:    (e) => message.error('Create failed: ' + (e?.response?.data?.detail || e?.message || 'Unknown error')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => apiService.put(`/api/v1/departments/${id}/`, data),
    onSuccess:  () => { message.success('Department updated'); setIsModalVisible(false); form.resetFields(); invalidate(); },
    onError:    (e) => message.error('Update failed: ' + (e?.response?.data?.detail || e?.message || 'Unknown error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/departments/${id}/`),
    onSuccess:  () => { message.success('Department deactivated'); invalidate(); },
    onError:    (e) => message.error('Deactivate failed: ' + (e?.response?.data?.detail || e?.message || 'Unknown error')),
  });

  const handlePushToBiotime = async (deptId) => {
    setPushingId(deptId);
    try {
      await apiService.post(`/api/v1/departments/${deptId}/push-to-biotime`);
      message.success('Department pushed to BioTime and linked');
      invalidate();
    } catch (e) {
      message.error('Push failed: ' + (e?.response?.data?.detail || e?.message || 'Unknown error'));
    } finally {
      setPushingId(null);
    }
  };

  // ── Form handlers ──────────────────────────────────────────────────────────

  const handleAdd = (parentId = null) => {
    setEditingDept(null);
    setTimeout(() => { form.resetFields(); form.setFieldsValue({ parent_id: parentId }); }, 0);
    setIsModalVisible(true);
  };

  const handleEdit = (dept) => {
    setEditingDept(dept);
    setTimeout(() => {
      form.resetFields();
      form.setFieldsValue({
        name: dept.name, code: dept.code, description: dept.description,
        department_type: dept.department_type, parent_id: dept.parent_id,
        manager_id: dept.manager_id ?? null,
        zone_id: dept.zone_id ?? null,
        contact_person: dept.contact_person, contact_email: dept.contact_email,
        contact_phone: dept.contact_phone, max_personnel: dept.max_personnel,
        budget_allocated: dept.budget_allocated || 0,
        safety_critical: dept.safety_critical ?? false,
        zkteco_sync_enabled: dept.zkteco_sync_enabled ?? true,
        zkteco_department_id: dept.zkteco_department_id,
        default_shift_id: dept.default_shift_id ?? null,
        status: dept.status,
      });
    }, 0);
    setIsModalVisible(true);
  };

  const handleSubmit = (values) => {
    if (editingDept) updateMutation.mutate({ id: editingDept.id, ...values });
    else createMutation.mutate(values);
  };

  const openDrawer = (dept) => { setDrawerDept(dept); setDrawerTab('overview'); setDrawerVisible(true); };

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const filteredDepts = departments.filter(d => {
    const text   = !searchText || d.name?.toLowerCase().includes(searchText.toLowerCase()) || d.code?.toLowerCase().includes(searchText.toLowerCase());
    const type   = !filterType   || d.department_type === filterType;
    const status = !filterStatus || d.status === filterStatus;
    return text && type && status;
  });

  const filterTree = (nodes) =>
    nodes.map(n => ({ ...n, children: n.children ? filterTree(n.children) : [] }))
         .filter(n => {
           const text   = !searchText || n.data?.name?.toLowerCase().includes(searchText.toLowerCase()) || n.data?.code?.toLowerCase().includes(searchText.toLowerCase());
           const type   = !filterType   || n.data?.department_type === filterType;
           const status = !filterStatus || n.data?.status === filterStatus;
           return text || type || status || n.children.length > 0;
         });

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // ── Tree title ─────────────────────────────────────────────────────────────

  const renderTreeTitle = (node) => {
    const dept = node.data;
    const zk   = ZKTECO_CONFIG[dept.zkteco_status] || ZKTECO_CONFIG.not_configured;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
        <Space size={6}>
          <ApartmentOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 500 }}>{dept.name}</span>
          <Tag style={{ fontSize: 11 }}>{dept.code}</Tag>
          {dept.department_type && <Tag color={DEPT_TYPE_COLORS[dept.department_type]} style={{ fontSize: 11 }}>{dept.department_type}</Tag>}
          {dept.safety_critical && <Tooltip title="Safety Critical"><SafetyOutlined style={{ color: '#f5222d' }} /></Tooltip>}
          <Tooltip title={`ZKTeco: ${zk.label}`}><span style={{ color: zk.color, fontSize: 12 }}>{zk.icon}</span></Tooltip>
          {dept.current_personnel_count !== undefined && (
            <Tag icon={<TeamOutlined />} color="default" style={{ fontSize: 11 }}>{dept.current_personnel_count}/{dept.max_personnel || '∞'}</Tag>
          )}
          {dept.manager_name && (
            <Tag icon={<UserOutlined />} color="geekblue" style={{ fontSize: 11 }}>{dept.manager_name}</Tag>
          )}
          {dept.status && dept.status !== 'active' && <Badge status={STATUS_CONFIG[dept.status]?.color || 'default'} text={dept.status} />}
        </Space>
        <Space size={2} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="View Details"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDrawer(dept)} /></Tooltip>
          <Tooltip title="Add Sub-department"><Button type="text" size="small" icon={<PlusOutlined />} onClick={() => handleAdd(dept.id)} /></Tooltip>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(dept)} /></Tooltip>
          <Popconfirm title="Deactivate department?" description="Sub-departments and personnel will be affected." onConfirm={() => deleteMutation.mutate(dept.id)} okText="Deactivate" okType="danger">
            <Tooltip title="Deactivate"><Button type="text" danger size="small" icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      </div>
    );
  };

  const renderTreeNodes = (nodes) =>
    nodes.map(n => ({ ...n, title: renderTreeTitle(n), children: n.children ? renderTreeNodes(n.children) : [] }));

  // ── Table columns ──────────────────────────────────────────────────────────

  const tableColumns = [
    {
      title: 'Department', dataIndex: 'name', key: 'name', width: 200,
      sorter: (a, b) => a.name?.localeCompare(b.name),
      render: (name, rec) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" style={{ background: 'none', border: 'none', padding: 0, color: '#1890ff', cursor: 'pointer', fontWeight: 500 }} onClick={() => openDrawer(rec)}>{name}</button>
            {rec.safety_critical && <Tooltip title="Safety Critical"><SafetyOutlined style={{ color: '#f5222d', fontSize: 12 }} /></Tooltip>}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>{rec.code}</div>
        </div>
      ),
    },
    {
      title: 'Type', dataIndex: 'department_type', key: 'type', width: 120,
      render: (t) => t ? <Tag color={DEPT_TYPE_COLORS[t]} style={{ textTransform: 'capitalize' }}>{t}</Tag> : '—',
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (s) => <Badge status={STATUS_CONFIG[s || 'active']?.color || 'success'} text={s || 'active'} />,
    },
    {
      title: 'Manager', key: 'manager', width: 150,
      render: (_, rec) => rec.manager_name
        ? (
          <Space>
            <Avatar size={22} style={{ background: avatarColor(rec.manager_name), fontSize: 9, fontWeight: 600 }}>{initials(rec.manager_name)}</Avatar>
            <span style={{ fontSize: 12 }}>{rec.manager_name}</span>
          </Space>
        )
        : <span style={{ color: '#bfbfbf', fontSize: 12 }}>—</span>,
    },
    {
      title: 'Personnel', key: 'personnel', width: 95,
      render: (_, rec) => (
        <span>{rec.current_personnel_count || 0}<span style={{ color: '#bfbfbf' }}> / {rec.max_personnel || '∞'}</span></span>
      ),
    },
    {
      title: 'Sub-depts', key: 'subdepts', width: 90,
      render: (_, rec) => rec.sub_departments_count > 0
        ? <Tag icon={<ApartmentOutlined />} color="geekblue" style={{ fontSize: 11 }}>{rec.sub_departments_count}</Tag>
        : <span style={{ color: '#bfbfbf' }}>—</span>,
    },
    {
      title: 'Default Shift', key: 'shift', width: 140,
      render: (_, rec) => rec.default_shift_name
        ? <Tag icon={<ClockCircleOutlined />} color="purple" style={{ fontSize: 11 }}>{rec.default_shift_name}</Tag>
        : <span style={{ color: '#bfbfbf', fontSize: 12 }}>—</span>,
    },
    {
      title: 'ZKTeco', dataIndex: 'zkteco_status', key: 'zkteco', width: 130,
      render: (zs) => {
        const zk = ZKTECO_CONFIG[zs] || ZKTECO_CONFIG.not_configured;
        return <Tag icon={zk.icon} color={zk.antColor}>{zk.label}</Tag>;
      },
    },
    {
      title: 'Budget', key: 'budget', width: 120,
      render: (_, rec) => {
        if (!rec.budget_allocated) return <span style={{ color: '#bfbfbf' }}>—</span>;
        return (
          <Tooltip title={`Used: $${Number(rec.budget_used || 0).toLocaleString()} of $${Number(rec.budget_allocated).toLocaleString()}`}>
            <Progress percent={rec.budget_utilization || 0} size="small"
              status={rec.budget_utilization > 90 ? 'exception' : rec.budget_utilization > 75 ? 'active' : 'normal'} />
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 220,
      render: (_, rec) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDrawer(rec)}>View</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(rec)}>Edit</Button>
          <Button size="small" icon={<PlusOutlined />} onClick={() => handleAdd(rec.id)}>Sub</Button>
          <Popconfirm title="Deactivate this department?" onConfirm={() => deleteMutation.mutate(rec.id)} okText="Deactivate" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const displayedTree = renderTreeNodes(filterTree(treeData));

  const handleModalOk = () => {
    form.validateFields().then(values => handleSubmit(values));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '16px 24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          // ── Departments tab ──────────────────────────────────────────────
          {
            key: 'overview',
            label: 'Departments',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* KPI strip */}
                <Row gutter={12}>
                  {[
                    { title: 'Total',          value: summary.total_departments || departments.length, color: '#1890ff', icon: <ApartmentOutlined /> },
                    { title: 'Active',          value: summary.active || 0,            color: '#52c41a', icon: <CheckCircleOutlined /> },
                    { title: 'Safety Critical', value: summary.safety_critical || 0,   color: '#f5222d', icon: <SafetyOutlined /> },
                    { title: 'ZKTeco Synced',   value: summary.zkteco_synced || 0,     color: '#13c2c2', icon: <SyncOutlined /> },
                  ].map(({ title, value, color, icon }) => (
                    <Col key={title} xs={12} sm={6}>
                      <Card size="small" style={{ borderTop: `3px solid ${color}` }}>
                        <Statistic title={title} value={value}
                          prefix={React.cloneElement(icon, { style: { color } })}
                          valueStyle={{ color, fontSize: 20 }} />
                      </Card>
                    </Col>
                  ))}
                </Row>

                {/* Filters */}
                <Card size="small">
                  <Row gutter={12} align="middle">
                    <Col flex="1">
                      <Input.Search placeholder="Search name or code…" value={searchText}
                        onChange={e => setSearchText(e.target.value)} allowClear />
                    </Col>
                    <Col>
                      <Select placeholder="Type" style={{ width: 140 }} value={filterType} onChange={setFilterType} allowClear
                        options={DEPT_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
                    </Col>
                    <Col>
                      <Select placeholder="Status" style={{ width: 130 }} value={filterStatus} onChange={setFilterStatus} allowClear
                        options={Object.keys(STATUS_CONFIG).map(s => ({ value: s, label: s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }))} />
                    </Col>
                    <Col>
                      <Button icon={viewMode === 'tree' ? <TableOutlined /> : <BranchesOutlined />}
                        onClick={() => setViewMode(v => v === 'tree' ? 'table' : 'tree')}>
                        {viewMode === 'tree' ? 'Table View' : 'Tree View'}
                      </Button>
                    </Col>
                    <Col>
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>New Department</Button>
                        <Button icon={<ReloadOutlined />} onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ['departments-summary'] }); }}>Refresh</Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                {/* Content */}
                <Card size="small">
                  <Spin spinning={isLoading}>
                    {viewMode === 'tree' ? (
                      displayedTree.length > 0 ? (
                        <Tree treeData={displayedTree} expandedKeys={expandedKeys} onExpand={setExpandedKeys}
                          showLine={{ showLeafIcon: false }} blockNode style={{ fontSize: 13 }} />
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={departments.length === 0 ? 'No departments yet. Create your first department.' : 'No results match your filters.'}>
                          {departments.length === 0 && <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>Create Department</Button>}
                        </Empty>
                      )
                    ) : (
                      <Table columns={tableColumns} dataSource={filteredDepts} loading={isLoading} rowKey="id"
                        size="small" pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} departments` }}
                        scroll={{ x: 1400 }}
                        locale={{ emptyText: <Empty description="No departments found" /> }}
                      />
                    )}
                  </Spin>
                </Card>
              </div>
            ),
          },

          // ── Analytics tab ────────────────────────────────────────────────
          {
            key: 'analytics',
            label: 'Analytics',
            children: <AnalyticsTab departments={departments} summary={summary} />,
          },

          // ── ZKTeco Sync tab ──────────────────────────────────────────────
          {
            key: 'zkteco',
            label: <Space><ThunderboltOutlined />ZKTeco Sync</Space>,
            children: <ZktecoSyncTab departments={departments} onPushAll={handlePushToBiotime} pushingId={pushingId} />,
          },
        ]}
      />

      {/* ── Create / Edit Modal ── */}
      <Modal
        title={editingDept ? `Edit Department — ${editingDept.name}` : 'New Department'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => { setIsModalVisible(false); form.resetFields(); }}
        okText={editingDept ? 'Save Changes' : 'Create'}
        confirmLoading={isMutating}
        width={760}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item label="Department Name" name="name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g., Operations" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="Code" name="code" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g., OPS-001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Type" name="department_type">
                <Select placeholder="Select type" allowClear
                  options={DEPT_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Parent Department" name="parent_id">
                <Select placeholder="Root (no parent)" allowClear showSearch optionFilterProp="children">
                  {departments.filter(d => !editingDept || d.id !== editingDept.id).map(d => (
                    <Option key={d.id} value={d.id}>{d.name} <Tag style={{ fontSize: 10 }}>{d.code}</Tag></Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Manager" name="manager_id">
                <Select placeholder="— none —" allowClear showSearch optionFilterProp="label"
                  options={personnelList.map(p => ({
                    value: p.id,
                    label: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.full_name || `#${p.id}`,
                  }))}
                  optionRender={(opt) => (
                    <Space>
                      <Avatar size={20} style={{ background: avatarColor(opt.label), fontSize: 9 }}>{initials(opt.label)}</Avatar>
                      <span>{opt.label}</span>
                    </Space>
                  )}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Brief description…" />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }}>Contact</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Contact Person" name="contact_person">
                <Input prefix={<UserOutlined />} placeholder="Name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Email" name="contact_email">
                <Input prefix={<MailOutlined />} placeholder="email@company.com" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Phone" name="contact_phone">
                <Input prefix={<PhoneOutlined />} placeholder="+1234567890" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }}>Capacity & Budget</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Max Personnel" name="max_personnel">
                <InputNumber min={0} placeholder="50" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Budget Allocated ($)" name="budget_allocated">
                <InputNumber min={0} style={{ width: '100%' }}
                  formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/\$\s?|(,*)/g, '')} />
              </Form.Item>
            </Col>
            {editingDept && (
              <Col span={8}>
                <Form.Item label="Status" name="status">
                  <Select options={Object.keys(STATUS_CONFIG).map(s => ({ value: s, label: s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }))} />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Divider style={{ margin: '12px 0' }}>Safety & ZKTeco</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Safety Critical" name="safety_critical" valuePropName="checked">
                <Switch checkedChildren={<SafetyOutlined />} unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="ZKTeco Sync" name="zkteco_sync_enabled" valuePropName="checked">
                <Switch checkedChildren={<SyncOutlined />} unCheckedChildren="Off" />
              </Form.Item>
            </Col>
            {editingDept && (
              <Col span={8}>
                <Form.Item label="ZKTeco Dept ID" name="zkteco_department_id">
                  <InputNumber min={1} placeholder="BioTime ID" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Divider style={{ margin: '12px 0' }}>Attendance</Divider>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item label="Default Shift" name="default_shift_id"
                tooltip="Employees in this department with no direct shift assignment will use this shift for attendance calculation">
                <Select placeholder="— inherit global default —" allowClear showSearch optionFilterProp="children" style={{ width: '100%' }}>
                  {shifts.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Details Drawer ── */}
      <Drawer
        title={
          <Space>
            <ApartmentOutlined style={{ color: '#1890ff' }} />
            <span>{drawerDept?.name}</span>
            {drawerDept?.code && <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{drawerDept.code}</Tag>}
            {drawerDept?.department_type && <Tag color={DEPT_TYPE_COLORS[drawerDept.department_type]}>{drawerDept.department_type}</Tag>}
          </Space>
        }
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={560}
        extra={<Button icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(drawerDept); }}>Edit</Button>}
      >
        {drawerDept && (
          <Tabs activeKey={drawerTab} onChange={setDrawerTab} size="small" items={[

            // ── Overview tab ────────────────────────────────────────────────
            {
              key: 'overview',
              label: <Space><InfoCircleOutlined />Overview</Space>,
              children: (() => {
                const zk = ZKTECO_CONFIG[drawerDept.zkteco_status] || ZKTECO_CONFIG.not_configured;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {drawerDept.safety_critical && (
                      <Alert message="Safety Critical Department" type="error" icon={<SafetyOutlined />} showIcon />
                    )}
                    <Alert
                      message={<Space>{zk.icon}<span>ZKTeco: <strong>{zk.label}</strong></span>{drawerDept.zkteco_department_id && <Tag>ID #{drawerDept.zkteco_department_id}</Tag>}</Space>}
                      type={drawerDept.zkteco_status === 'synced' ? 'success' : drawerDept.zkteco_status === 'pending' ? 'warning' : 'info'}
                    />

                    {/* Key metrics row */}
                    <Row gutter={12}>
                      <Col span={8}>
                        <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #1890ff' }}>
                          <Statistic title="Personnel" value={drawerDept.current_personnel_count || 0}
                            suffix={drawerDept.max_personnel ? `/ ${drawerDept.max_personnel}` : ''}
                            valueStyle={{ color: '#1890ff', fontSize: 20 }} prefix={<TeamOutlined />} />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #722ed1' }}>
                          <Statistic title="Sub-depts" value={drawerDept.sub_departments_count || 0}
                            valueStyle={{ color: '#722ed1', fontSize: 20 }} prefix={<ApartmentOutlined />} />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" style={{ textAlign: 'center', borderTop: drawerDept.status === 'active' ? '3px solid #52c41a' : '3px solid #fa8c16' }}>
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Status</div>
                          <Badge status={STATUS_CONFIG[drawerDept.status || 'active']?.color} text={<span style={{ fontWeight: 600 }}>{drawerDept.status || 'active'}</span>} />
                        </Card>
                      </Col>
                    </Row>

                    <Descriptions column={2} size="small" bordered>
                      {drawerDept.parent_name && (
                        <Descriptions.Item label="Parent Dept" span={2}>
                          <Space><ApartmentOutlined style={{ color: '#8c8c8c' }} />{drawerDept.parent_name}</Space>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="Manager" span={2}>
                        {drawerDept.manager_name
                          ? <Space>
                              <Avatar size={24} style={{ background: avatarColor(drawerDept.manager_name), fontSize: 10 }}>{initials(drawerDept.manager_name)}</Avatar>
                              <span>{drawerDept.manager_name}</span>
                            </Space>
                          : <span style={{ color: '#bfbfbf' }}>—</span>
                        }
                      </Descriptions.Item>
                      {drawerDept.zone_name && (
                        <Descriptions.Item label="Zone" span={2}>
                          <Space><EnvironmentOutlined style={{ color: '#13c2c2' }} />{drawerDept.zone_name}</Space>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="Default Shift" span={2}>
                        {drawerDept.default_shift_name
                          ? <Tag icon={<ClockCircleOutlined />} color="purple">{drawerDept.default_shift_name}</Tag>
                          : <span style={{ color: '#bfbfbf' }}>—</span>
                        }
                      </Descriptions.Item>
                      {drawerDept.description && (
                        <Descriptions.Item label="Description" span={2}>{drawerDept.description}</Descriptions.Item>
                      )}
                    </Descriptions>

                    {drawerDept.budget_allocated > 0 && (
                      <>
                        <Divider style={{ margin: '8px 0' }}>Budget</Divider>
                        <Row gutter={12} style={{ marginBottom: 8 }}>
                          <Col span={12}><Statistic title="Allocated" value={drawerDept.budget_allocated} prefix="$" precision={0} valueStyle={{ fontSize: 16 }} /></Col>
                          <Col span={12}><Statistic title="Used"      value={drawerDept.budget_used || 0} prefix="$" precision={0} valueStyle={{ fontSize: 16 }} /></Col>
                        </Row>
                        <Progress percent={drawerDept.budget_utilization || 0}
                          status={drawerDept.budget_utilization > 90 ? 'exception' : drawerDept.budget_utilization > 75 ? 'active' : 'normal'} />
                      </>
                    )}

                    <Divider style={{ margin: '8px 0' }}>Contact</Divider>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label={<Space><UserOutlined />Person</Space>}>{drawerDept.contact_person || <span style={{ color: '#bfbfbf' }}>—</span>}</Descriptions.Item>
                      <Descriptions.Item label={<Space><MailOutlined />Email</Space>}>
                        {drawerDept.contact_email ? <a href={`mailto:${drawerDept.contact_email}`}>{drawerDept.contact_email}</a> : <span style={{ color: '#bfbfbf' }}>—</span>}
                      </Descriptions.Item>
                      <Descriptions.Item label={<Space><PhoneOutlined />Phone</Space>}>{drawerDept.contact_phone || <span style={{ color: '#bfbfbf' }}>—</span>}</Descriptions.Item>
                    </Descriptions>

                    <Divider style={{ margin: '8px 0' }}>Audit</Divider>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Created">{drawerDept.created_at ? dayjs(drawerDept.created_at).format('DD MMM YYYY HH:mm') : '—'}</Descriptions.Item>
                      <Descriptions.Item label="Last Updated">{drawerDept.updated_at ? dayjs(drawerDept.updated_at).format('DD MMM YYYY HH:mm') : '—'}</Descriptions.Item>
                    </Descriptions>

                    <div style={{ paddingTop: 8 }}>
                      <Space wrap>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setDrawerVisible(false); handleAdd(drawerDept.id); }}>
                          Add Sub-department
                        </Button>
                        {drawerDept.zkteco_status === 'not_configured' && (
                          <Button icon={<CloudUploadOutlined />} loading={pushingId === drawerDept.id}
                            onClick={() => { handlePushToBiotime(drawerDept.id); setDrawerVisible(false); }}>
                            Push to BioTime
                          </Button>
                        )}
                        <Popconfirm title="Deactivate this department?"
                          onConfirm={() => { deleteMutation.mutate(drawerDept.id); setDrawerVisible(false); }}
                          okText="Deactivate" okType="danger">
                          <Button danger icon={<DeleteOutlined />}>Deactivate</Button>
                        </Popconfirm>
                      </Space>
                    </div>
                  </div>
                );
              })(),
            },

            // ── Personnel tab ────────────────────────────────────────────────
            {
              key: 'personnel',
              label: (
                <Space>
                  <TeamOutlined />
                  Personnel
                  {drawerDept.current_personnel_count > 0 && (
                    <Tag style={{ fontSize: 10, marginLeft: 0 }}>{drawerDept.current_personnel_count}</Tag>
                  )}
                </Space>
              ),
              children: <DeptPersonnelTab deptId={drawerDept.id} onEdit={handleEdit} />,
            },

          ]} />
        )}
      </Drawer>
    </div>
  );
};

export default DepartmentTree;
