import { useState } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Card,
  Row, Col, Tag, Badge, message, Popconfirm, Tabs, Statistic,
  Alert, Tooltip, Descriptions, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  EyeOutlined, SafetyOutlined, TeamOutlined, ApartmentOutlined,
  ThunderboltOutlined, InfoCircleOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const POS_TYPE_COLORS = {
  executive: 'purple',
  manager: 'blue',
  supervisor: 'cyan',
  staff: 'green',
  contractor: 'orange',
};

const CAT_COLORS = {
  technical: 'geekblue',
  operations: 'blue',
  safety: 'red',
  admin: 'volcano',
  support: 'lime',
};

// ── Analytics Tab ─────────────────────────────────────────────────────────────
const AnalyticsTab = ({ positions, summary }) => {
  const byType = summary?.by_type || {};
  const byCategory = summary?.by_category || {};
  const byDept = summary?.by_department || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Row gutter={12}>
        {[
          { label: 'Total Positions', value: summary?.total ?? positions.length, color: '#1677ff' },
          { label: 'Active', value: summary?.active ?? positions.filter(p => p.is_active).length, color: '#52c41a' },
          { label: 'Inactive', value: summary?.inactive ?? positions.filter(p => !p.is_active).length, color: '#ff4d4f' },
          { label: 'Safety Critical', value: summary?.safety_critical ?? positions.filter(p => p.is_safety_critical).length, color: '#faad14' },
        ].map(({ label, value, color }) => (
          <Col span={6} key={label}>
            <Card size="small">
              <Statistic title={label} value={value} valueStyle={{ color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={12}>
        <Col span={8}>
          <Card size="small" title="By Type">
            {Object.entries(byType).map(([type, count]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Tag color={POS_TYPE_COLORS[type] || 'default'} style={{ margin: 0 }}>{type}</Tag>
                <strong>{count}</strong>
              </div>
            ))}
            {Object.keys(byType).length === 0 && <div style={{ color: '#8c8c8c', fontSize: 12 }}>No data</div>}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="By Category">
            {Object.entries(byCategory).map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Tag color={CAT_COLORS[cat] || 'default'} style={{ margin: 0 }}>{cat}</Tag>
                <strong>{count}</strong>
              </div>
            ))}
            {Object.keys(byCategory).length === 0 && <div style={{ color: '#8c8c8c', fontSize: 12 }}>No data</div>}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="By Department">
            {Object.entries(byDept).map(([dept, count]) => (
              <div key={dept} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ fontSize: 12 }}>{dept}</span>
                <strong>{count}</strong>
              </div>
            ))}
            {Object.keys(byDept).length === 0 && <div style={{ color: '#8c8c8c', fontSize: 12 }}>No data</div>}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ── ZKTeco Info Tab ────────────────────────────────────────────────────────────
const ZktecoInfoTab = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <Alert
      type="info"
      showIcon
      icon={<ThunderboltOutlined />}
      message="Positions & ZKTeco BioTime Integration"
      description="Positions in the POB system are not directly synchronized with ZKTeco BioTime as a separate entity. BioTime stores only a reference integer (position_id) on each employee record — there is no dedicated positions table in BioTime."
    />
    <Row gutter={12}>
      <Col span={12}>
        <Card size="small" title={<Space><ThunderboltOutlined style={{ color: '#1677ff' }} />How BioTime References Positions</Space>}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="BioTime Table">personnel_employee</Descriptions.Item>
            <Descriptions.Item label="Field">position_id (INTEGER)</Descriptions.Item>
            <Descriptions.Item label="Type">Plain integer — no FK constraint</Descriptions.Item>
            <Descriptions.Item label="Sync Required">No — positions are POB-local</Descriptions.Item>
          </Descriptions>
          <Divider style={{ margin: '12px 0 8px' }} />
          <div style={{ fontSize: 12, color: '#595959' }}>
            When a personnel record is synced to BioTime, the <code>position_id</code> from
            the POB position assignment is written to the BioTime employee record as a reference.
            If the position changes in POB, the BioTime employee must be re-synced to reflect the update.
          </div>
        </Card>
      </Col>
      <Col span={12}>
        <Card size="small" title={<Space><ApartmentOutlined style={{ color: '#52c41a' }} />Module Relationships</Space>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { from: 'Position', to: 'Department', desc: 'Each position belongs to a department (department_id FK)' },
              { from: 'Position', to: 'Personnel Assignments', desc: 'position_assignments table links personnel ↔ positions with start/end dates' },
              { from: 'Position', to: 'Employment Contracts', desc: 'employment_contracts.position_id references the current contracted position' },
              { from: 'Position', to: 'Promotion/Transfer', desc: 'promotion_transfer records reference from_position_id and to_position_id' },
              { from: 'Position', to: 'BioTime Employee', desc: 'personnel_employee.position_id stores the POB position ID as an integer reference' },
            ].map(({ from, to, desc }) => (
              <div key={to} style={{ padding: '6px 8px', background: '#fafafa', borderRadius: 4, border: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>
                  <Tag color="blue" style={{ margin: 0 }}>{from}</Tag>
                  {' → '}
                  <Tag color="green" style={{ margin: 0 }}>{to}</Tag>
                </div>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{desc}</div>
              </div>
            ))}
          </div>
        </Card>
      </Col>
    </Row>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const PositionList = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchText, setSearchText] = useState('');
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [drawerPosition, setDrawerPosition] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: positionsRes, isLoading, refetch } = useQuery({
    queryKey: ['positions', searchText, selectedDept, selectedType, selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchText) params.append('search', searchText);
      if (selectedDept) params.append('department_id', selectedDept);
      if (selectedType) params.append('position_type', selectedType);
      if (selectedStatus !== null && selectedStatus !== undefined) params.append('is_active', selectedStatus);
      params.append('limit', '200');
      return await apiService.get(`/api/v1/positions/?${params}`);
    },
    refetchInterval: 30000,
  });

  const { data: summaryRes } = useQuery({
    queryKey: ['positions-summary'],
    queryFn: () => apiService.get('/api/v1/positions/meta/summary'),
    refetchInterval: 60000,
  });

  const { data: departmentsRes } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.get('/api/v1/departments/'),
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (editingPosition) {
        return await apiService.put(`/api/v1/positions/${editingPosition.id}/`, values);
      }
      return await apiService.post('/api/v1/positions/', values);
    },
    onSuccess: () => {
      message.success(editingPosition ? 'Position updated' : 'Position created');
      setIsModalOpen(false);
      setEditingPosition(null);
      form.resetFields();
      queryClient.invalidateQueries(['positions']);
      queryClient.invalidateQueries(['positions-summary']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || err.message || 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/positions/${id}/`),
    onSuccess: () => {
      message.success('Position deactivated');
      queryClient.invalidateQueries(['positions']);
      queryClient.invalidateQueries(['positions-summary']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || err.message || 'Deactivate failed'),
  });

  const positions = positionsRes?.data || positionsRes || [];
  const summary = summaryRes;
  const departments = departmentsRes?.data || departmentsRes || [];

  const handleAdd = () => {
    setEditingPosition(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingPosition(record);
    form.setFieldsValue({
      ...record,
      position_type: record.position_type || undefined,
      job_category: record.job_category || undefined,
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    form.validateFields().then((values) => saveMutation.mutate(values));
  };

  const columns = [
    {
      title: 'Position',
      dataIndex: 'position_name',
      key: 'position_name',
      width: 220,
      render: (name, rec) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>{rec.position_code}</div>
        </div>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 150,
      render: (dept) => dept?.name ? (
        <Tag color="default" style={{ fontSize: 11 }}>{dept.name}</Tag>
      ) : <span style={{ color: '#bfbfbf', fontSize: 11 }}>—</span>,
    },
    {
      title: 'Type',
      dataIndex: 'position_type',
      key: 'position_type',
      width: 120,
      render: (t) => t ? <Tag color={POS_TYPE_COLORS[t] || 'default'}>{t}</Tag> : '—',
    },
    {
      title: 'Category',
      dataIndex: 'job_category',
      key: 'job_category',
      width: 120,
      render: (c) => c ? <Tag color={CAT_COLORS[c] || 'default'}>{c}</Tag> : '—',
    },
    {
      title: 'Grade',
      dataIndex: 'grade_level',
      key: 'grade_level',
      width: 80,
      render: (g) => g || '—',
    },
    {
      title: 'Assigned',
      dataIndex: 'assigned_count',
      key: 'assigned_count',
      width: 90,
      render: (n) => (
        <Space size={4}>
          <TeamOutlined style={{ color: '#1677ff' }} />
          <span>{n ?? 0}</span>
        </Space>
      ),
    },
    {
      title: 'Salary Range',
      key: 'salary',
      width: 150,
      render: (_, rec) => {
        if (!rec.salary_range_min && !rec.salary_range_max) return '—';
        const fmt = (v) => v ? `${(v / 1000).toFixed(0)}k` : '?';
        return (
          <Space size={4}>
            <DollarOutlined style={{ color: '#52c41a' }} />
            <span style={{ fontSize: 12 }}>{fmt(rec.salary_range_min)} – {fmt(rec.salary_range_max)} {rec.currency}</span>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active) => (
        <Badge
          status={active ? 'success' : 'error'}
          text={<span style={{ fontSize: 12 }}>{active ? 'Active' : 'Inactive'}</span>}
        />
      ),
    },
    {
      title: 'Safety',
      dataIndex: 'is_safety_critical',
      key: 'is_safety_critical',
      width: 70,
      render: (critical) => critical ? (
        <Tooltip title="Safety Critical">
          <SafetyOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
        </Tooltip>
      ) : <span style={{ color: '#d9d9d9' }}>—</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 220,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDrawerPosition(record)}>View</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm
            title="Deactivate this position?"
            description="Active assignments must be cleared first."
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Deactivate"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Deactivate</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: 'Positions',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* KPI strip */}
                <Row gutter={12}>
                  {[
                    { label: 'Total Positions', value: summary?.total ?? positions.length, color: '#1677ff', icon: <ApartmentOutlined /> },
                    { label: 'Active', value: summary?.active ?? positions.filter(p => p.is_active).length, color: '#52c41a', icon: <TeamOutlined /> },
                    { label: 'Inactive', value: summary?.inactive ?? positions.filter(p => !p.is_active).length, color: '#ff4d4f', icon: <InfoCircleOutlined /> },
                    { label: 'Safety Critical', value: summary?.safety_critical ?? positions.filter(p => p.is_safety_critical).length, color: '#faad14', icon: <SafetyOutlined /> },
                  ].map(({ label, value, color, icon }) => (
                    <Col span={6} key={label}>
                      <Card size="small" style={{ borderTop: `3px solid ${color}` }}>
                        <Statistic
                          title={<Space size={4}>{icon}<span>{label}</span></Space>}
                          value={value ?? 0}
                          valueStyle={{ color, fontSize: 20 }}
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>

                {/* Filter card */}
                <Card size="small">
                  <Row gutter={12} align="middle">
                    <Col flex="1">
                      <Input.Search
                        placeholder="Search positions..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onSearch={setSearchText}
                        allowClear
                      />
                    </Col>
                    <Col>
                      <Select
                        placeholder="Department"
                        style={{ width: 160 }}
                        value={selectedDept}
                        onChange={setSelectedDept}
                        allowClear
                      >
                        {departments.map(d => (
                          <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col>
                      <Select
                        placeholder="Type"
                        style={{ width: 130 }}
                        value={selectedType}
                        onChange={setSelectedType}
                        allowClear
                      >
                        {['executive', 'manager', 'supervisor', 'staff', 'contractor'].map(t => (
                          <Select.Option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col>
                      <Select
                        placeholder="Status"
                        style={{ width: 110 }}
                        value={selectedStatus}
                        onChange={setSelectedStatus}
                        allowClear
                      >
                        <Select.Option value={true}>Active</Select.Option>
                        <Select.Option value={false}>Inactive</Select.Option>
                      </Select>
                    </Col>
                    <Col>
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>New Position</Button>
                        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                {/* Table card */}
                <Card size="small">
                  <Table
                    columns={columns}
                    dataSource={positions}
                    loading={isLoading}
                    rowKey="id"
                    size="small"
                    scroll={{ x: 1400 }}
                    pagination={{
                      pageSize: 50,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} positions`,
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'analytics',
            label: 'Analytics',
            children: <AnalyticsTab positions={positions} summary={summary} />,
          },
          {
            key: 'zkteco',
            label: <Space><ThunderboltOutlined />ZKTeco Info</Space>,
            children: <ZktecoInfoTab />,
          },
        ]}
      />

      {/* View Detail Modal */}
      <Modal
        title={drawerPosition ? `${drawerPosition.position_name} (${drawerPosition.position_code})` : ''}
        open={!!drawerPosition}
        onCancel={() => setDrawerPosition(null)}
        footer={[
          <Button key="edit" type="primary" onClick={() => { handleEdit(drawerPosition); setDrawerPosition(null); }}>Edit</Button>,
          <Button key="close" onClick={() => setDrawerPosition(null)}>Close</Button>,
        ]}
        width={640}
      >
        {drawerPosition && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Code">{drawerPosition.position_code}</Descriptions.Item>
            <Descriptions.Item label="Name">{drawerPosition.position_name}</Descriptions.Item>
            <Descriptions.Item label="Department">{drawerPosition.department?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color={POS_TYPE_COLORS[drawerPosition.position_type]}>{drawerPosition.position_type || '—'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              <Tag color={CAT_COLORS[drawerPosition.job_category]}>{drawerPosition.job_category || '—'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Grade">{drawerPosition.grade_level || '—'}</Descriptions.Item>
            <Descriptions.Item label="Min Experience">{drawerPosition.min_experience_years ?? 0} yrs</Descriptions.Item>
            <Descriptions.Item label="Education">{drawerPosition.education_level || '—'}</Descriptions.Item>
            <Descriptions.Item label="Salary Min">{drawerPosition.salary_range_min ? `${drawerPosition.currency} ${drawerPosition.salary_range_min.toLocaleString()}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Salary Max">{drawerPosition.salary_range_max ? `${drawerPosition.currency} ${drawerPosition.salary_range_max.toLocaleString()}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Assigned Personnel">{drawerPosition.assigned_count}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge status={drawerPosition.is_active ? 'success' : 'error'} text={drawerPosition.is_active ? 'Active' : 'Inactive'} />
            </Descriptions.Item>
            <Descriptions.Item label="Safety Critical">
              {drawerPosition.is_safety_critical ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Background Check">
              {drawerPosition.requires_background_check ? <Tag color="orange">Required</Tag> : <Tag>Not Required</Tag>}
            </Descriptions.Item>
            {drawerPosition.description && (
              <Descriptions.Item label="Description" span={2}>{drawerPosition.description}</Descriptions.Item>
            )}
            {drawerPosition.notes && (
              <Descriptions.Item label="Notes" span={2}>{drawerPosition.notes}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Create / Edit Modal */}
      <Modal
        title={editingPosition ? `Edit Position — ${editingPosition.position_name}` : 'New Position'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => { setIsModalOpen(false); setEditingPosition(null); form.resetFields(); }}
        okText={editingPosition ? 'Update' : 'Create'}
        confirmLoading={saveMutation.isPending}
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="position_code" label="Position Code" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. POS-001" disabled={!!editingPosition} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="position_name" label="Position Name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. Senior Engineer" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department_id" label="Department">
                <Select placeholder="Select department" allowClear>
                  {departments.map(d => (
                    <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="position_type" label="Position Type">
                <Select placeholder="Select type">
                  {['executive', 'manager', 'supervisor', 'staff', 'contractor'].map(t => (
                    <Select.Option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="job_category" label="Job Category">
                <Select placeholder="Select category">
                  {['technical', 'operations', 'safety', 'admin', 'support'].map(c => (
                    <Select.Option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="grade_level" label="Grade Level">
                <Input placeholder="e.g. L3, G5" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="salary_range_min" label="Salary Min">
                <Input type="number" placeholder="Min" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="salary_range_max" label="Salary Max">
                <Input type="number" placeholder="Max" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="currency" label="Currency" initialValue="USD">
                <Select>
                  <Select.Option value="USD">USD</Select.Option>
                  <Select.Option value="NGN">NGN</Select.Option>
                  <Select.Option value="EUR">EUR</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="min_experience_years" label="Min Experience (yrs)" initialValue={0}>
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_active" label="Status" initialValue={true}>
                <Select>
                  <Select.Option value={true}>Active</Select.Option>
                  <Select.Option value={false}>Inactive</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_safety_critical" label="Safety Critical" initialValue={false}>
                <Select>
                  <Select.Option value={false}>No</Select.Option>
                  <Select.Option value={true}>Yes</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="education_level" label="Education Level">
            <Input placeholder="e.g. Bachelor's Degree in Engineering" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Position description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PositionList;
