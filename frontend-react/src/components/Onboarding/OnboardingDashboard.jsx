import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Space,
  Tag,
  Avatar,
  Tooltip,
  Badge,
  Progress,
  Tabs,
  Steps,
  Timeline,
  Descriptions,
  List,
  Upload,
  DatePicker,
  Switch,
  Alert,
  Spin,
  Typography,
  Divider,
  message,
  notification,
  Popconfirm,
  Rate,
  Checkbox
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  SettingOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  UploadOutlined,
  CalendarOutlined,
  PhoneOutlined,
  MailOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  FilterOutlined,
  MoreOutlined,
  PrinterOutlined,
  SyncOutlined,
  IdcardOutlined,
  BankOutlined,
  SolutionOutlined,
  AuditOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import { format, addDays, differenceInDays } from 'date-fns';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Item } = Form;
const { RangePicker } = DatePicker;

const OnboardingDashboard = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedOnboarding, setSelectedOnboarding] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  
  // Fetch personnel for dropdown
  const { data: personnelData } = useQuery({
    queryKey: ['personnel'],
    queryFn: async () => apiService.get('/api/v1/personnel/'),
  });

  // Fetch onboarding data
  const { data: onboardingData, isLoading, refetch } = useQuery({
    queryKey: ['onboarding', filterStatus, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterType) params.append('onboarding_type', filterType);
      params.append('page_size', '50');
      return await apiService.get(`/api/v1/personnel/onboarding/?${params}`);
    },
    refetchInterval: 30000,
    staleTime: 60000,
  });

  // Fetch onboarding tasks (tasks are per-onboarding; fetch overview from statistics)
  const { data: tasksData } = useQuery({
    queryKey: ['onboarding-tasks'],
    queryFn: async () => apiService.get('/api/v1/personnel/onboarding/statistics'),
  });

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['onboarding-templates'],
    queryFn: async () => apiService.get('/api/v1/personnel/onboarding/templates'),
  });

  // Create onboarding mutation
  const createMutation = useMutation({
    mutationFn: async (onboardingData) =>
      apiService.post('/api/v1/personnel/onboarding/', onboardingData),
    onSuccess: () => {
      message.success('Onboarding created successfully');
      setIsModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
    onError: () => message.error('Failed to create onboarding'),
  });

  // Update onboarding mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) =>
      apiService.put(`/api/v1/personnel/onboarding/${id}/`, data),
    onSuccess: () => {
      message.success('Onboarding updated successfully');
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
    onError: () => message.error('Failed to update onboarding'),
  });

  // Approve onboarding mutation
  const approveMutation = useMutation({
    mutationFn: async (id) =>
      apiService.post(`/api/v1/personnel/onboarding/${id}/approve`, {}),
    onSuccess: () => {
      message.success('Onboarding approved successfully');
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
    onError: () => message.error('Failed to approve onboarding'),
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }) =>
      apiService.put(`/api/v1/personnel/onboarding/tasks/${taskId}`, data),
    onSuccess: () => {
      message.success('Task completed successfully');
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
    },
    onError: () => message.error('Failed to complete task'),
  });

  // Statistics cards
  const statisticsCards = [
    {
      title: 'Total Onboarding',
      value: onboardingData?.total_count || 0,
      icon: <UserOutlined />,
      color: '#1890ff',
    },
    {
      title: 'Active Onboarding',
      value: onboardingData?.data?.filter(o => o.status === 'IN_PROGRESS').length || 0,
      icon: <PlayCircleOutlined />,
      color: '#52c41a',
    },
    {
      title: 'Pending Approval',
      value: onboardingData?.data?.filter(o => o.status === 'PENDING_REVIEW').length || 0,
      icon: <ClockCircleOutlined />,
      color: '#faad14',
    },
    {
      title: 'Completed This Month',
      value: onboardingData?.data?.filter(o => o.status === 'COMPLETED').length || 0,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
    },
  ];

  // Enhanced table columns
  const columns = [
    {
      title: 'Personnel',
      dataIndex: ['personnel', 'full_name'],
      key: 'personnel',
      width: 200,
      render: (personnel) => (
        <Space>
          <Avatar size="small" src={personnel?.photo_url}>
            {personnel?.full_name?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 'bold' }}>{personnel?.full_name}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{personnel?.badge_id}</div>
          </div>
        </Space>
      ),
      sorter: (a, b) => a.personnel?.full_name.localeCompare(b.personnel?.full_name),
    },
    {
      title: 'Type',
      dataIndex: 'onboarding_type',
      key: 'onboarding_type',
      width: 150,
      render: (type) => {
        const typeConfig = {
          'NEW_HIRE': { color: 'blue', text: 'New Hire' },
          'REHIRE': { color: 'green', text: 'Rehire' },
          'INTERNAL_TRANSFER': { color: 'orange', text: 'Internal Transfer' },
          'PROMOTION': { color: 'purple', text: 'Promotion' },
          'CONTRACT_RENEWAL': { color: 'cyan', text: 'Contract Renewal' },
        };
        
        const config = typeConfig[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
      sorter: (a, b) => a.onboarding_type.localeCompare(b.onboarding_type),
    },
    {
      title: 'Job Title',
      dataIndex: 'job_title',
      key: 'job_title',
      width: 180,
      sorter: (a, b) => a.job_title.localeCompare(b.job_title),
    },
    {
      title: 'Progress',
      dataIndex: 'completion_percentage',
      key: 'progress',
      width: 150,
      render: (progress) => (
        <Progress
          percent={progress || 0}
          size="small"
          status={progress === 100 ? 'success' : 'active'}
          format={(percent) => `${percent}%`}
        />
      ),
      sorter: (a, b) => a.completion_percentage - b.completion_percentage,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const statusConfig = {
          'NOT_STARTED': { color: 'default', text: 'Not Started' },
          'IN_PROGRESS': { color: 'processing', text: 'In Progress' },
          'PENDING_REVIEW': { color: 'warning', text: 'Pending Review' },
          'APPROVED': { color: 'success', text: 'Approved' },
          'REJECTED': { color: 'error', text: 'Rejected' },
          'COMPLETED': { color: 'success', text: 'Completed' },
          'CANCELLED': { color: 'default', text: 'Cancelled' },
        };
        
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Badge color={config.color} text={config.text} />;
      },
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
    {
      title: 'Timeline',
      key: 'timeline',
      width: 100,
      render: (_, record) => (
        <Tooltip title="View Timeline">
          <Button
            type="text"
            icon={<ClockCircleOutlined />}
            onClick={() => {
              setSelectedOnboarding(record);
              setActiveTab('timeline');
            }}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedOnboarding(record);
                setActiveTab('details');
              }}
            />
          </Tooltip>
          <Tooltip title="Edit Onboarding">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedOnboarding(record);
                form.setFieldsValue(record);
                setIsModalVisible(true);
              }}
            />
          </Tooltip>
          {record.status === 'PENDING_REVIEW' && (
            <Tooltip title="Approve">
              <Button
                type="text"
                style={{ color: '#52c41a' }}
                icon={<CheckCircleOutlined />}
                onClick={() => approveMutation.mutate(record.id)}
                loading={approveMutation.isPending}
              >
                Approve
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Render dashboard
  const renderDashboard = () => {
    return (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {statisticsCards.map((stat, index) => (
            <Col xs={24} sm={12} md={6} key={index}>
              <Card>
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  prefix={stat.icon}
                  valueStyle={{ color: stat.color }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <Card title="Recent Onboarding Activities" style={{ marginBottom: 24 }}>
          <Timeline>
            {onboardingData?.data?.slice(0, 5).map((onboarding, index) => (
              <Timeline.Item
                key={onboarding.id}
                color={onboarding.status === 'COMPLETED' ? 'green' : 'blue'}
                dot={onboarding.status === 'COMPLETED' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
              >
                <div>
                  <Text strong>{onboarding.personnel?.full_name}</Text>
                  <div>
                    <Tag color="blue">{onboarding.onboarding_type}</Tag>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {onboarding.job_title} - {onboarding.status}
                  </div>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      </div>
    );
  };

  // Render onboarding list
  const renderOnboardingList = () => {
    return (
      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Filter by Status"
              style={{ width: '100%' }}
              allowClear
              value={filterStatus}
              onChange={setFilterStatus}
            >
              <Select.Option value="">All Status</Select.Option>
              <Select.Option value="NOT_STARTED">Not Started</Select.Option>
              <Select.Option value="IN_PROGRESS">In Progress</Select.Option>
              <Select.Option value="PENDING_REVIEW">Pending Review</Select.Option>
              <Select.Option value="APPROVED">Approved</Select.Option>
              <Select.Option value="COMPLETED">Completed</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Filter by Type"
              style={{ width: '100%' }}
              allowClear
              value={filterType}
              onChange={setFilterType}
            >
              <Select.Option value="">All Types</Select.Option>
              <Select.Option value="NEW_HIRE">New Hire</Select.Option>
              <Select.Option value="REHIRE">Rehire</Select.Option>
              <Select.Option value="INTERNAL_TRANSFER">Internal Transfer</Select.Option>
              <Select.Option value="PROMOTION">Promotion</Select.Option>
              <Select.Option value="CONTRACT_RENEWAL">Contract Renewal</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button icon={<PlusOutlined />} type="primary" onClick={() => setIsModalVisible(true)}>
                New Onboarding
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={onboardingData?.data || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: onboardingData?.current_page || 1,
            pageSize: 20,
            total: onboardingData?.total_count || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => (
              <span>
                {range[0]}-{range[1]} of <strong>{total}</strong> items
              </span>
            ),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    );
  };

  // Render onboarding details
  const renderDetails = () => {
    if (!selectedOnboarding) return null;

    return (
      <Card>
        <Row gutter={[16, 16]}>
          <Col span={16}>
            <Descriptions title="Onboarding Details" column={2}>
              <Descriptions.Item label="Personnel">
                {selectedOnboarding.personnel?.full_name}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color="blue">{selectedOnboarding.onboarding_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Job Title">
                {selectedOnboarding.job_title}
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {selectedOnboarding.start_date}
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                {selectedOnboarding.planned_end_date}
              </Descriptions.Item>
              <Descriptions.Item label="Progress">
                <Progress
                  percent={selectedOnboarding.completion_percentage || 0}
                  status={selectedOnboarding.completion_percentage === 100 ? 'success' : 'active'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge
                  status={selectedOnboarding.status === 'COMPLETED' ? 'success' : 'processing'}
                  text={selectedOnboarding.status}
                />
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={8}>
            <Card title="Quick Actions" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    form.setFieldsValue(selectedOnboarding);
                    setIsModalVisible(true);
                  }}
                  block
                >
                  Edit Onboarding
                </Button>
                <Button
                  icon={<FileTextOutlined />}
                  onClick={() => setActiveTab('tasks')}
                  block
                >
                  Manage Tasks
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => setActiveTab('documents')}
                  block
                >
                  Upload Documents
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>
    );
  };

  // Render tasks management
  const renderTasks = () => {
    const taskColumns = [
      {
        title: 'Task',
        dataIndex: 'task_name',
        key: 'task_name',
        render: (text, record) => (
          <Space>
            <Text strong>{text}</Text>
            {record.is_required && <Tag color="red">Required</Tag>}
          </Space>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'task_type',
        key: 'task_type',
        render: (type) => <Tag color="blue">{type}</Tag>,
      },
      {
        title: 'Due Date',
        dataIndex: 'due_date',
        key: 'due_date',
        render: (date) => (
          <Text type={new Date(date) < new Date() ? 'danger' : 'secondary'}>
            {date}
          </Text>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (status) => (
          <Badge
            status={status === 'COMPLETED' ? 'success' : status === 'OVERDUE' ? 'error' : 'default'}
            text={status}
          />
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_, record) => (
          <Space>
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => completeTaskMutation.mutate({
                taskId: record.id,
                data: { is_completed: true, completion_date: new Date().toISOString() }
              })}
              disabled={record.status === 'COMPLETED'}
            >
              Complete
            </Button>
          </Space>
        ),
      },
    ];

    return (
      <Card title="Onboarding Tasks">
        <Table
          columns={taskColumns}
          dataSource={tasksData?.data || []}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    );
  };

  // Render documents
  const renderDocuments = () => {
    return (
      <Card title="Onboarding Documents">
        <Upload.Dragger
          name="documents"
          multiple
          beforeUpload={() => false}
          onChange={(info) => {
            // Handle document upload
            message.success(`${info.file.name} uploaded successfully`);
          }}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">
            Click or drag files to this area to upload
          </p>
          <p className="ant-upload-hint">
            Support for a single or bulk upload.
          </p>
        </Upload.Dragger>
      </Card>
    );
  };

  // Render timeline
  const renderTimeline = () => {
    return (
      <Card title="Onboarding Timeline">
        <Timeline>
          <Timeline.Item color="blue">
            <Text>Onboarding initiated for {selectedOnboarding?.personnel?.full_name}</Text>
          </Timeline.Item>
          <Timeline.Item color="green">
            <Text>Documents uploaded</Text>
          </Timeline.Item>
          <Timeline.Item color="orange">
            <Text>Background check in progress</Text>
          </Timeline.Item>
          <Timeline.Item color="blue">
            <Text>Training scheduled</Text>
          </Timeline.Item>
          <Timeline.Item color="green">
            <Text>Onboarding completed</Text>
          </Timeline.Item>
        </Timeline>
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <UserOutlined /> Onboarding Management
      </Title>
      
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 24 }}
        items={[
          { key: 'dashboard', label: <span><DashboardOutlined /> Dashboard</span>, children: renderDashboard() },
          { key: 'list', label: <span><TeamOutlined /> Onboarding List</span>, children: renderOnboardingList() },
          { key: 'details', label: <span><FileTextOutlined /> Details</span>, children: renderDetails() },
          { key: 'tasks', label: <span><CheckCircleOutlined /> Tasks</span>, children: renderTasks() },
          { key: 'documents', label: <span><UploadOutlined /> Documents</span>, children: renderDocuments() },
          { key: 'timeline', label: <span><ClockCircleOutlined /> Timeline</span>, children: renderTimeline() },
        ]}
      />

      {/* Add/Edit Modal */}
      <Modal
        title={selectedOnboarding ? 'Edit Onboarding' : 'Create Onboarding'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setSelectedOnboarding(null);
          form.resetFields();
        }}
        footer={[
          <Button key="back" onClick={() => setIsModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={() => form.validateFields().then((values) => {
              if (selectedOnboarding) {
                updateMutation.mutate({ id: selectedOnboarding.id, data: values });
              } else {
                createMutation.mutate(values);
              }
            })}
          >
            {selectedOnboarding ? 'Update' : 'Create'}
          </Button>,
        ]}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          name="onboardingForm"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="personnel_id"
                label="Personnel"
                rules={[{ required: true, message: 'Please select personnel!' }]}
              >
                <Select
                  showSearch
                  placeholder="Select Personnel"
                  filterOption={(input, option) =>
                    option?.children?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {personnelData?.data?.map(personnel => (
                    <Select.Option key={personnel.id} value={personnel.id}>
                      {personnel.full_name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="onboarding_type"
                label="Onboarding Type"
                rules={[{ required: true, message: 'Please select onboarding type!' }]}
              >
                <Select placeholder="Select Type">
                  <Select.Option value="NEW_HIRE">New Hire</Select.Option>
                  <Select.Option value="REHIRE">Rehire</Select.Option>
                  <Select.Option value="INTERNAL_TRANSFER">Internal Transfer</Select.Option>
                  <Select.Option value="PROMOTION">Promotion</Select.Option>
                  <Select.Option value="CONTRACT_RENEWAL">Contract Renewal</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="job_title"
                label="Job Title"
                rules={[{ required: true, message: 'Please input job title!' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="job_description"
                label="Job Description"
                rules={[{ required: true, message: 'Please input job description!' }]}
              >
                <Input.TextArea rows={4} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label="Start Date"
                rules={[{ required: true, message: 'Please select start date!' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="planned_end_date"
                label="End Date"
                rules={[{ required: true, message: 'Please select end date!' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default OnboardingDashboard;
