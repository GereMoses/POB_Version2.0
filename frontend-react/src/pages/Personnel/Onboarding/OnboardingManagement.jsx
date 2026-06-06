import { useState } from 'react';
import {
  Table, Card, Button, Space, Tag, Progress, App,
  Form, Input, Select, DatePicker, Popconfirm,
  Drawer, Statistic, Row, Col, Divider, Badge,
  Descriptions, Tooltip, Alert,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, CheckOutlined, CloseOutlined,
  FileTextOutlined, UserOutlined, ReloadOutlined,
  SearchOutlined, TeamOutlined, ClockCircleOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

// ── Constants ─────────────────────────────────────────────────────────────────
const ONBOARDING_TYPES = [
  { value: 'NEW_HIRE',           label: 'New Hire',           color: 'green' },
  { value: 'REHIRE',             label: 'Re-hire',            color: 'blue' },
  { value: 'INTERNAL_TRANSFER',  label: 'Internal Transfer',  color: 'purple' },
  { value: 'PROMOTION',          label: 'Promotion',          color: 'gold' },
  { value: 'CONTRACT_RENEWAL',   label: 'Contract Renewal',   color: 'cyan' },
];

const STATUS_CONFIG = {
  NOT_STARTED:    { color: 'default',    label: 'Not Started',    badge: 'default' },
  IN_PROGRESS:    { color: 'processing', label: 'In Progress',    badge: 'processing' },
  PENDING_REVIEW: { color: 'warning',    label: 'Pending Review', badge: 'warning' },
  APPROVED:       { color: 'success',    label: 'Approved',       badge: 'success' },
  REJECTED:       { color: 'error',      label: 'Rejected',       badge: 'error' },
  COMPLETED:      { color: 'success',    label: 'Completed',      badge: 'success' },
  CANCELLED:      { color: 'default',    label: 'Cancelled',      badge: 'default' },
};

const typeInfo = (v) => ONBOARDING_TYPES.find(t => t.value === v) || { color: 'default', label: v };
const statusInfo = (v) => STATUS_CONFIG[v] || { color: 'default', label: v || 'Unknown', badge: 'default' };

// ── OnboardingManagement ──────────────────────────────────────────────────────
const OnboardingManagement = () => {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);

  // Create drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [form] = Form.useForm();

  // Detail / tasks drawer
  const [detailVisible, setDetailVisible] = useState(false);
  const [selected, setSelected] = useState(null);

  // Reject drawer
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectForm] = Form.useForm();

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: onboardingData, isLoading, refetch } = useQuery({
    queryKey: ['onboarding-records', search, filterType, filterStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (filterType) p.append('onboarding_type', filterType);
      if (filterStatus) p.append('status', filterStatus);
      return apiService.get(`/api/v1/personnel/onboarding/?${p}`);
    },
    refetchInterval: 30000,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['onboarding-tasks', selected?.id],
    queryFn: () => apiService.get(`/api/v1/personnel/onboarding/${selected.id}/tasks`),
    enabled: !!selected?.id,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => apiService.get('/api/v1/personnel/?page_size=1000'),
  });

  const onboardings = onboardingData?.data || onboardingData?.results || [];
  const employees = employeesData?.results || [];
  const tasks = tasksData?.data || tasksData?.results || [];

  const total = onboardingData?.total_count ?? onboardings.length;
  const inProgressCount = onboardings.filter(o => o.status === 'IN_PROGRESS').length;
  const completedCount = onboardings.filter(o => o.status === 'COMPLETED').length;
  const pendingCount = onboardings.filter(o => o.status === 'PENDING_REVIEW').length;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => apiService.post('/api/v1/personnel/onboarding/', data),
    onSuccess: () => {
      message.success('Onboarding process started successfully');
      setDrawerVisible(false);
      form.resetFields();
      queryClient.invalidateQueries(['onboarding-records']);
      queryClient.invalidateQueries(['employees-all']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || err.message || 'Failed to create onboarding'),
  });

  const completeMutation = useMutation({
    mutationFn: (id) => apiService.post(`/api/v1/personnel/onboarding/${id}/complete`, {}),
    onSuccess: () => {
      message.success('Onboarding marked as completed. Employee is now ACTIVE.');
      setDetailVisible(false);
      queryClient.invalidateQueries(['onboarding-records']);
      queryClient.invalidateQueries(['personnel']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Failed to complete onboarding'),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => apiService.post(`/api/v1/personnel/onboarding/${id}/approve`, {}),
    onSuccess: () => {
      message.success('Onboarding approved');
      queryClient.invalidateQueries(['onboarding-records']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      apiService.post(`/api/v1/personnel/onboarding/${id}/reject?rejection_reason=${encodeURIComponent(reason)}`, {}),
    onSuccess: () => {
      message.success('Onboarding rejected');
      setRejectVisible(false);
      rejectForm.resetFields();
      queryClient.invalidateQueries(['onboarding-records']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Failed to reject'),
  });

  // ── Submit Create ──────────────────────────────────────────────────────────
  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const payload = {
        personnel_id: values.personnel_id,
        onboarding_type: values.onboarding_type,
        start_date: values.start_date.toISOString(),
        planned_end_date: values.planned_end_date.toISOString(),
        job_title: values.job_title,
        job_description: values.job_description,
        department_id: values.department_id || null,
        notes: values.notes || null,
      };
      createMutation.mutate(payload);
    }).catch(() => {});
  };

  // ── Table Columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, rec) => {
        const emp = rec.employee || {};
        const name = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
        return (
          <Space direction="vertical" size={0}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', padding: 0, color: '#1890ff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              onClick={() => { setSelected(rec); setDetailVisible(true); }}
            >
              {name || `Personnel #${rec.personnel_id}`}
            </button>
            <span style={{ fontSize: 11, color: '#8c8c8c' }}>{emp.emp_code || ''} {emp.department ? `· ${emp.department}` : ''}</span>
          </Space>
        );
      },
    },
    {
      title: 'Type',
      dataIndex: 'onboarding_type',
      key: 'type',
      width: 150,
      render: (v) => {
        const t = typeInfo(v);
        return <Tag color={t.color}>{t.label}</Tag>;
      },
    },
    {
      title: 'Job Title',
      dataIndex: 'job_title',
      key: 'job_title',
      ellipsis: true,
      width: 160,
    },
    {
      title: 'Start Date',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Due Date',
      dataIndex: 'planned_end_date',
      key: 'planned_end_date',
      width: 110,
      render: (d) => {
        if (!d) return '—';
        const overdue = dayjs(d).isBefore(dayjs()) ;
        return <span style={{ color: overdue ? '#f5222d' : undefined }}>{dayjs(d).format('DD MMM YYYY')}</span>;
      },
    },
    {
      title: 'Progress',
      dataIndex: 'completion_percentage',
      key: 'progress',
      width: 130,
      render: (pct) => (
        <Progress
          percent={pct || 0}
          size="small"
          status={pct === 100 ? 'success' : 'active'}
          style={{ margin: 0 }}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v) => {
        const s = statusInfo(v);
        return <Badge status={s.badge} text={s.label} />;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_, rec) => (
        <Space size={4}>
          <Tooltip title="View Tasks">
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(rec); setDetailVisible(true); }} />
          </Tooltip>
          {rec.status === 'PENDING_REVIEW' && (
            <Tooltip title="Approve">
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approveMutation.mutate(rec.id)} loading={approveMutation.isPending} />
            </Tooltip>
          )}
          {['IN_PROGRESS', 'PENDING_REVIEW'].includes(rec.status) && (
            <Tooltip title="Reject">
              <Button size="small" danger icon={<CloseOutlined />} onClick={() => { setRejectTarget(rec); setRejectVisible(true); }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // ── Task columns ───────────────────────────────────────────────────────────
  const taskColumns = [
    {
      title: 'Task',
      dataIndex: 'task_name',
      key: 'task_name',
      render: (name, r) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{name}</span>
          {r.task_type && <Tag color="blue" style={{ fontSize: 11 }}>{r.task_type}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Due',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v) => {
        const s = statusInfo(v);
        return <Badge status={s.badge} text={s.label} />;
      },
    },
    {
      title: 'Required',
      dataIndex: 'is_required',
      key: 'required',
      width: 90,
      render: (r) => r ? <Tag color="red">Required</Tag> : <Tag>Optional</Tag>,
    },
  ];

  const rec = selected;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24 }}>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Onboardings', value: total, icon: <FileTextOutlined />, color: '#1890ff' },
          { title: 'In Progress', value: inProgressCount, icon: <ClockCircleOutlined />, color: '#fa8c16' },
          { title: 'Pending Review', value: pendingCount, icon: <ExclamationCircleOutlined />, color: '#722ed1' },
          { title: 'Completed', value: completedCount, icon: <CheckCircleOutlined />, color: '#52c41a' },
        ].map((s) => (
          <Col xs={12} sm={6} key={s.title}>
            <Card styles={{ body: { padding: '14px 18px' } }} style={{ borderTop: `3px solid ${s.color}` }}>
              <Statistic title={s.title} value={s.value} prefix={s.icon} valueStyle={{ color: s.color, fontSize: 24 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filter bar */}
      <Card styles={{ body: { padding: '12px 16px' } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} sm={8} md={7}>
            <Input
              placeholder="Search job title or description..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={5} md={5}>
            <Select placeholder="Type" style={{ width: '100%' }} value={filterType} onChange={setFilterType} allowClear>
              {ONBOARDING_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={5} md={5}>
            <Select placeholder="Status" style={{ width: '100%' }} value={filterStatus} onChange={setFilterStatus} allowClear>
              {Object.entries(STATUS_CONFIG).map(([v, s]) => <Option key={v} value={v}>{s.label}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={6} md={7}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setDrawerVisible(true); }}>
                Start Onboarding
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Refresh</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={onboardings}
          loading={isLoading}
          rowKey="id"
          size="middle"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
        />
      </Card>

      {/* ── Start Onboarding Drawer ───────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <UserOutlined style={{ color: '#52c41a' }} />
            <span>Start Employee Onboarding</span>
          </Space>
        }
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); form.resetFields(); }}
        width={680}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => { setDrawerVisible(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit} loading={createMutation.isPending}>
              Start Onboarding
            </Button>
          </Space>
        }
        destroyOnHidden
      >
        <Alert
          message="Creating an onboarding record will set the employee status to pending and initiate the intake checklist."
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />

        <Form form={form} layout="vertical" size="small">

          {/* ── Employee ── */}
          <Divider orientation="left">
            <Space><UserOutlined style={{ color: '#1890ff' }} />Employee</Space>
          </Divider>
          <Form.Item
            name="personnel_id"
            label="Select Employee *"
            rules={[{ required: true, message: 'Please select an employee' }]}
          >
            <Select
              placeholder="Search by name or employee code"
              showSearch
              filterOption={(input, option) =>
                (option?.searchtext || '').toLowerCase().includes(input.toLowerCase())
              }
              size="middle"
            >
              {employees.map(emp => {
                const name = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
                return (
                  <Option key={emp.id} value={emp.id} searchtext={`${name} ${emp.emp_code || ''}`}>
                    <Space direction="vertical" size={0} style={{ lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600 }}>{name}</span>
                      <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {emp.emp_code} · {emp.company || ''} · {emp.department || 'No dept'}
                      </span>
                    </Space>
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          {/* ── Onboarding Details ── */}
          <Divider orientation="left">
            <Space><FileTextOutlined style={{ color: '#722ed1' }} />Onboarding Details</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item
                name="onboarding_type"
                label="Onboarding Type *"
                rules={[{ required: true, message: 'Please select a type' }]}
              >
                <Select placeholder="Select type" size="middle">
                  {ONBOARDING_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>
                      <Tag color={t.color} style={{ marginRight: 6 }}>{t.value}</Tag>{t.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label="Start Date *"
                rules={[{ required: true, message: 'Required' }]}
                initialValue={dayjs()}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="planned_end_date"
                label="Planned End Date *"
                rules={[{ required: true, message: 'Required' }]}
                initialValue={dayjs().add(30, 'day')}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Job Details ── */}
          <Divider orientation="left">
            <Space><CalendarOutlined style={{ color: '#fa8c16' }} />Job Details</Space>
          </Divider>
          <Form.Item
            name="job_title"
            label="Job Title *"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g. Offshore Drilling Engineer" size="middle" />
          </Form.Item>
          <Form.Item
            name="job_description"
            label="Job Description *"
            rules={[{ required: true, message: 'Required' }, { min: 10, message: 'Minimum 10 characters' }]}
          >
            <TextArea rows={3} placeholder="Brief description of duties and responsibilities..." size="middle" />
          </Form.Item>
          <Form.Item name="notes" label="Additional Notes">
            <TextArea rows={2} placeholder="Any additional remarks..." size="middle" />
          </Form.Item>

        </Form>
      </Drawer>

      {/* ── Detail / Tasks Drawer ────────────────────────────────────────── */}
      <Drawer
        title={
          rec && (
            <Space>
              <FileTextOutlined style={{ color: '#1890ff' }} />
              <span>
                {(() => {
                  const emp = rec.employee || {};
                  return emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || `Personnel #${rec.personnel_id}`;
                })()}
              </span>
              <Tag color={typeInfo(rec.onboarding_type).color}>{typeInfo(rec.onboarding_type).label}</Tag>
            </Space>
          )
        }
        open={detailVisible}
        onClose={() => { setDetailVisible(false); setSelected(null); }}
        width={680}
        extra={
          rec && (
            <Space>
              {rec.status === 'PENDING_REVIEW' && (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  size="small"
                  onClick={() => approveMutation.mutate(rec.id)}
                  loading={approveMutation.isPending}
                >
                  Approve
                </Button>
              )}
              {rec.status === 'APPROVED' && (
                <Popconfirm
                  title="Mark this onboarding as completed?"
                  description="This will activate the employee and grant full system access."
                  onConfirm={() => completeMutation.mutate(rec.id)}
                  okText="Complete" cancelText="Cancel"
                >
                  <Button type="primary" icon={<CheckCircleOutlined />} size="small" loading={completeMutation.isPending}>
                    Complete
                  </Button>
                </Popconfirm>
              )}
              {['IN_PROGRESS', 'PENDING_REVIEW'].includes(rec.status) && (
                <Button
                  danger
                  icon={<CloseOutlined />}
                  size="small"
                  onClick={() => { setDetailVisible(false); setRejectTarget(rec); setRejectVisible(true); }}
                >
                  Reject
                </Button>
              )}
            </Space>
          )
        }
        destroyOnHidden
      >
        {rec && (
          <>
            <Divider orientation="left" style={{ fontSize: 12 }}>Employee</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Name" span={2}>
                <strong>
                  {rec.employee?.full_name ||
                    `${rec.employee?.first_name || ''} ${rec.employee?.last_name || ''}`.trim() ||
                    `Personnel #${rec.personnel_id}`}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Emp Code">{rec.employee?.emp_code || '—'}</Descriptions.Item>
              <Descriptions.Item label="Company">{rec.employee?.company || '—'}</Descriptions.Item>
              <Descriptions.Item label="Department">{rec.employee?.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Role">{rec.employee?.role || '—'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Onboarding</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Type" span={2}>
                <Tag color={typeInfo(rec.onboarding_type).color}>{typeInfo(rec.onboarding_type).label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>
                <Badge status={statusInfo(rec.status).badge} text={statusInfo(rec.status).label} />
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {rec.start_date ? dayjs(rec.start_date).format('DD MMM YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Planned End">
                {rec.planned_end_date ? dayjs(rec.planned_end_date).format('DD MMM YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Job Title" span={2}>{rec.job_title || '—'}</Descriptions.Item>
              <Descriptions.Item label="Progress" span={2}>
                <Progress percent={rec.completion_percentage || 0} size="small" status={rec.completion_percentage === 100 ? 'success' : 'active'} />
              </Descriptions.Item>
            </Descriptions>

            {rec.job_description && (
              <>
                <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Job Description</Divider>
                <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '10px 12px', fontSize: 13, color: '#595959' }}>
                  {rec.job_description}
                </div>
              </>
            )}

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>
              Tasks
              {tasksData && (
                <span style={{ marginLeft: 8, color: '#8c8c8c', fontSize: 11, fontWeight: 400 }}>
                  {tasksData.completed_count ?? 0} / {tasksData.total_tasks ?? tasks.length} completed
                </span>
              )}
            </Divider>
            <Table
              columns={taskColumns}
              dataSource={tasks}
              loading={tasksLoading}
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: 'No tasks assigned yet' }}
            />

            {rec.notes && (
              <>
                <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Notes</Divider>
                <div style={{ fontSize: 12, color: '#595959' }}>{rec.notes}</div>
              </>
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: '#bfbfbf' }}>
              Created: {rec.created_at ? dayjs(rec.created_at).format('DD MMM YYYY HH:mm') : '—'}
            </div>
          </>
        )}
      </Drawer>

      {/* ── Reject Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <CloseOutlined style={{ color: '#f5222d' }} />
            <span>Reject Onboarding</span>
          </Space>
        }
        open={rejectVisible}
        onClose={() => { setRejectVisible(false); rejectForm.resetFields(); }}
        width={480}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => { setRejectVisible(false); rejectForm.resetFields(); }}>Cancel</Button>
            <Button
              danger
              onClick={() => {
                rejectForm.validateFields().then((v) => {
                  rejectMutation.mutate({ id: rejectTarget.id, reason: v.rejection_reason });
                }).catch(() => {});
              }}
              loading={rejectMutation.isPending}
            >
              Confirm Rejection
            </Button>
          </Space>
        }
        destroyOnHidden
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="rejection_reason"
            label="Reason for Rejection *"
            rules={[{ required: true, message: 'Please provide a reason' }, { min: 10, message: 'Minimum 10 characters' }]}
          >
            <TextArea rows={4} placeholder="Explain why this onboarding is being rejected..." />
          </Form.Item>
        </Form>

      </Drawer>

    </div>
  );
};

export default OnboardingManagement;
