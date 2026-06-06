import React, { useState } from 'react';
import {
  Table, Button, Space, Input, Select, Card, Row, Col,
  Tag, App, Popconfirm, DatePicker, Form, Drawer, Statistic,
  Descriptions, Divider, Badge, Tooltip, Alert,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined,
  UserOutlined, CalendarOutlined, FileTextOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, EyeOutlined,
  TeamOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

// ── Constants ─────────────────────────────────────────────────────────────────
const RESIGNATION_TYPES = [
  { value: 'VOLUNTARY', label: 'Voluntary Resignation', color: 'blue' },
  { value: 'INVOLUNTARY', label: 'Involuntary (Dismissal)', color: 'red' },
  { value: 'RETIREMENT', label: 'Retirement', color: 'gold' },
  { value: 'TERMINATION', label: 'Contract Termination', color: 'orange' },
];

const STATUS_COLOR = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  COMPLETED: 'default',
};

// ── ResignationList ───────────────────────────────────────────────────────────
const ResignationList = () => {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(null);

  // Registration drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [form] = Form.useForm();

  // Detail drawer
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: resignationsData, isLoading, refetch } = useQuery({
    queryKey: ['resignations', search, filterType],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (filterType) p.append('resignation_type', filterType);
      return apiService.get(`/api/v1/personnel/resignation/?${p}`);
    },
    refetchInterval: 30000,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => apiService.get('/api/v1/personnel/?status=ACTIVE&page_size=1000'),
  });

  const resignations = resignationsData?.data || resignationsData?.results || [];
  const employees = employeesData?.results || [];
  const totalResignations = resignationsData?.total_count ?? resignations.length;
  const activeEmployees = employees.length;
  const last30 = resignations.filter(r =>
    r.resignation_date && dayjs(r.resignation_date).isAfter(dayjs().subtract(30, 'day'))
  ).length;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data) => apiService.post('/api/v1/personnel/resignation/', data),
    onSuccess: () => {
      message.success('Resignation recorded successfully. Employee status updated.');
      setDrawerVisible(false);
      form.resetFields();
      queryClient.invalidateQueries(['resignations']);
      queryClient.invalidateQueries(['employees-active']);
      queryClient.invalidateQueries(['personnel']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || err.message || 'Failed to process resignation'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/resignation/${id}/`),
    onSuccess: () => {
      message.success('Resignation record deleted');
      setDetailVisible(false);
      queryClient.invalidateQueries(['resignations']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Delete failed'),
  });

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const payload = {
        personnel_id: values.personnel_id,
        resignation_type: values.resignation_type,
        resignation_date: values.resignation_date.toISOString(),
        last_working_day: values.last_working_day.toISOString(),
        reason: values.reason,
        detailed_reason: values.detailed_reason || null,
      };
      createMutation.mutate(payload);
    }).catch(() => {});
  };

  // ── Table columns ──────────────────────────────────────────────────────────
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
              onClick={() => { setDetailRecord(rec); setDetailVisible(true); }}
            >
              {name || `Personnel #${rec.personnel_id}`}
            </button>
            <span style={{ fontSize: 11, color: '#8c8c8c' }}>{emp.emp_code || ''}</span>
          </Space>
        );
      },
    },
    {
      title: 'Type',
      dataIndex: 'resignation_type',
      key: 'type',
      width: 160,
      render: (v) => {
        const t = RESIGNATION_TYPES.find(x => x.value === v);
        return t ? <Tag color={t.color}>{t.label}</Tag> : <Tag>{v || '—'}</Tag>;
      },
    },
    {
      title: 'Resignation Date',
      dataIndex: 'resignation_date',
      key: 'resignation_date',
      width: 140,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Last Working Day',
      dataIndex: 'last_working_day',
      key: 'last_working_day',
      width: 140,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) => <Badge status={STATUS_COLOR[v] || 'default'} text={v || 'PENDING'} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 110,
      render: (_, rec) => (
        <Space size={4}>
          <Tooltip title="View Details">
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setDetailRecord(rec); setDetailVisible(true); }} />
          </Tooltip>
          <Popconfirm
            title="Delete this resignation record?"
            description="This will not restore the employee's status."
            onConfirm={() => deleteMutation.mutate(rec.id)}
            okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rec = detailRecord;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24 }}>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Resignations', value: totalResignations, icon: <FileTextOutlined />, color: '#f5222d' },
          { title: 'Active Employees', value: activeEmployees, icon: <TeamOutlined />, color: '#52c41a' },
          { title: 'Last 30 Days', value: last30, icon: <ClockCircleOutlined />, color: '#fa8c16' },
        ].map((s) => (
          <Col xs={12} sm={8} key={s.title}>
            <Card styles={{ body: { padding: '14px 18px' } }} style={{ borderTop: `3px solid ${s.color}` }}>
              <Statistic title={s.title} value={s.value} prefix={s.icon} valueStyle={{ color: s.color, fontSize: 24 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filter bar */}
      <Card styles={{ body: { padding: '12px 16px' } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} sm={10} md={8}>
            <Input
              placeholder="Search employee name or code..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              placeholder="Resignation Type"
              style={{ width: '100%' }}
              value={filterType}
              onChange={setFilterType}
              allowClear
            >
              {RESIGNATION_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={8} md={11}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setDrawerVisible(true); }}>
                Process Resignation
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
          dataSource={resignations}
          loading={isLoading}
          rowKey="id"
          size="middle"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
        />
      </Card>

      {/* ── Process Resignation Drawer ───────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#f5222d' }} />
            <span>Process Employee Resignation</span>
          </Space>
        }
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); form.resetFields(); }}
        width={680}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => { setDrawerVisible(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" danger onClick={handleSubmit} loading={createMutation.isPending}>
              Confirm Resignation
            </Button>
          </Space>
        }
        destroyOnHidden
      >
        <Alert
          message="This action is significant"
          description="Processing a resignation will update the employee's status and remove them from active device access. Ensure all information is accurate before confirming."
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
        />

        <Form form={form} layout="vertical" size="small">

          {/* ── Employee Selection ── */}
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
                  <Option key={emp.id} value={emp.id} searchtext={`${name} ${emp.emp_code}`}>
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

          {/* ── Resignation Details ── */}
          <Divider orientation="left">
            <Space><FileTextOutlined style={{ color: '#722ed1' }} />Resignation Details</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item
                name="resignation_type"
                label="Resignation Type *"
                rules={[{ required: true, message: 'Please select a type' }]}
              >
                <Select placeholder="Select type" size="middle">
                  {RESIGNATION_TYPES.map(t => (
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
                name="resignation_date"
                label="Resignation Date *"
                rules={[{ required: true, message: 'Required' }]}
                initialValue={dayjs()}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="last_working_day"
                label="Last Working Day *"
                rules={[{ required: true, message: 'Required' }]}
                initialValue={dayjs().add(30, 'day')}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Reason ── */}
          <Divider orientation="left">
            <Space><CheckCircleOutlined style={{ color: '#52c41a' }} />Reason</Space>
          </Divider>
          <Form.Item
            name="reason"
            label="Reason for Resignation *"
            rules={[
              { required: true, message: 'Please provide a reason' },
              { min: 10, message: 'Reason must be at least 10 characters' },
            ]}
          >
            <Input placeholder="e.g. Personal reasons, Better opportunity, etc." size="middle" />
          </Form.Item>
          <Form.Item
            name="detailed_reason"
            label="Detailed Explanation (optional)"
          >
            <Input.TextArea
              rows={3}
              placeholder="Additional details about the resignation..."
              size="middle"
            />
          </Form.Item>

        </Form>
      </Drawer>

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={
          rec && (
            <Space>
              <FileTextOutlined style={{ color: '#f5222d' }} />
              <span>Resignation Record</span>
              {rec.resignation_type && (
                <Tag color={RESIGNATION_TYPES.find(t => t.value === rec.resignation_type)?.color || 'default'}>
                  {rec.resignation_type}
                </Tag>
              )}
            </Space>
          )
        }
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={500}
        extra={
          <Popconfirm
            title="Delete this resignation record?"
            onConfirm={() => deleteMutation.mutate(rec?.id)}
            okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} size="small">Delete</Button>
          </Popconfirm>
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

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Resignation</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Type" span={2}>
                {(() => {
                  const t = RESIGNATION_TYPES.find(x => x.value === rec.resignation_type);
                  return t ? <Tag color={t.color}>{t.label}</Tag> : rec.resignation_type || '—';
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>
                <Badge status={STATUS_COLOR[rec.status] || 'default'} text={rec.status || 'PENDING'} />
              </Descriptions.Item>
              <Descriptions.Item label="Resignation Date">
                {rec.resignation_date ? dayjs(rec.resignation_date).format('DD MMM YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Last Working Day">
                {rec.last_working_day ? dayjs(rec.last_working_day).format('DD MMM YYYY') : '—'}
              </Descriptions.Item>
            </Descriptions>

            {rec.reason && (
              <>
                <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Reason</Divider>
                <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '10px 12px', fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{rec.reason}</div>
                  {rec.detailed_reason && <div style={{ color: '#595959', fontSize: 12 }}>{rec.detailed_reason}</div>}
                </div>
              </>
            )}

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Clearance Checklist</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Exit Interview">
                <Badge status={rec.exit_interview_date ? 'success' : 'default'} text={rec.exit_interview_date ? 'Done' : 'Pending'} />
              </Descriptions.Item>
              <Descriptions.Item label="Handover">
                <Badge status={rec.handover_completed ? 'success' : 'default'} text={rec.handover_completed ? 'Done' : 'Pending'} />
              </Descriptions.Item>
              <Descriptions.Item label="Financial Clearance">
                <Badge status={rec.financial_clearance_completed ? 'success' : 'default'} text={rec.financial_clearance_completed ? 'Done' : 'Pending'} />
              </Descriptions.Item>
              <Descriptions.Item label="Assets Returned">
                <Badge status={rec.assets_returned ? 'success' : 'default'} text={rec.assets_returned ? 'Done' : 'Pending'} />
              </Descriptions.Item>
              <Descriptions.Item label="System Access">
                <Badge status={rec.system_access_revoked ? 'success' : 'default'} text={rec.system_access_revoked ? 'Revoked' : 'Active'} />
              </Descriptions.Item>
              <Descriptions.Item label="Device Access">
                <Badge status={rec.device_access_removed ? 'success' : 'default'} text={rec.device_access_removed ? 'Removed' : 'Active'} />
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 12, fontSize: 11, color: '#bfbfbf' }}>
              Recorded: {rec.created_at ? dayjs(rec.created_at).format('DD MMM YYYY HH:mm') : '—'}
            </div>
          </>
        )}
      </Drawer>

    </div>
  );
};

export default ResignationList;
