import React, { useState, useEffect, useMemo } from 'react';
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
  Drawer,
  Dropdown,
  Menu,
  message,
  Upload,
  DatePicker,
  Switch,
  Alert,
  Spin,
  Empty,
  Pagination,
  Typography,
  Divider,
  List,
  Descriptions,
  Timeline,
  Steps,
  Result,
  notification,
  Popconfirm
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  SettingOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
  ReloadOutlined,
  EyeOutlined,
  UploadOutlined,
  DownloadOutlined,
  CalendarOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  BankOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  MoreOutlined,
  PrinterOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import { format } from 'date-fns';
import { debounce } from 'lodash';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Item } = Form;
const { RangePicker } = DatePicker;

const PersonnelDashboard = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [advancedForm] = Form.useForm();
  
  // State management
  const [searchText, setSearchText] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isAdvancedModalVisible, setIsAdvancedModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // table, card, kanban
  
  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((value) => {
      setSearchText(value);
      queryClient.invalidateQueries(['personnel']);
    }, 500),
    []
  );

  // Fetch personnel data
  const { data: personnelData, isLoading, refetch } = useQuery({
    queryKey: ['personnel', searchText, selectedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchText) params.append('search', searchText);
      Object.entries(selectedFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page_size', '50');
      return await apiService.get(`/api/v1/personnel/?${params}`);
    },
    refetchInterval: 30000,
    staleTime: 60000,
    gcTime: 300000,
  });

  // Fetch departments
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => apiService.get('/api/v1/departments/'),
  });

  // Fetch positions
  const { data: positionsData } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => apiService.get('/api/v1/positions/'),
  });

  // Fetch biometric enrollment status
  const { data: biometricData } = useQuery({
    queryKey: ['biometric-status'],
    queryFn: async () => apiService.get('/api/v1/biometric/dashboard'),
  });

  // Create/Update employee mutation
  const employeeMutation = useMutation({
    mutationFn: async (employeeData) => {
      const url = editingEmployee
        ? `/api/v1/personnel/${editingEmployee.id}/`
        : '/api/v1/personnel/';
      return editingEmployee
        ? await apiService.put(url, employeeData)
        : await apiService.post(url, employeeData);
    },
    onSuccess: () => {
      message.success(`Employee ${editingEmployee ? 'updated' : 'created'} successfully`);
      setIsModalVisible(false);
      setEditingEmployee(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
    },
    onError: (error) => {
      message.error(`Failed to ${editingEmployee ? 'update' : 'create'} employee`);
    },
  });

  // Delete employee mutation
  const deleteMutation = useMutation({
    mutationFn: async (employeeId) => apiService.delete(`/api/v1/personnel/${employeeId}/`),
    onSuccess: () => {
      message.success('Employee deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      setSelectedRowKeys([]);
    },
    onError: () => message.error('Failed to delete employee'),
  });

  // Biometric enrollment mutation
  const biometricMutation = useMutation({
    mutationFn: async ({ employeeId, biometricType }) =>
      apiService.post('/api/v1/biometric/enroll', {
        personnel_id: employeeId,
        template_type: biometricType,
      }),
    onSuccess: (_, { biometricType }) => {
      message.success(`Biometric ${biometricType} enrollment started`);
      queryClient.invalidateQueries({ queryKey: ['biometric-status'] });
    },
    onError: () => message.error('Failed to start biometric enrollment'),
  });

  // Enhanced table columns
  const columns = [
    {
      title: 'Employee',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200,
      fixed: 'left',
      render: (text, record) => (
        <Space>
          <Avatar 
            size="small" 
            src={record.photo_url} 
            style={{ backgroundColor: '#1890ff' }}
          >
            {text?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 'bold' }}>{text}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{record.badge_id}</div>
          </div>
        </Space>
      ),
      sorter: (a, b) => a.full_name.localeCompare(b.full_name),
    },
    {
      title: 'Department',
      dataIndex: ['department', 'name'],
      key: 'department',
      width: 150,
      render: (dept) => (
        <Tag color={dept?.color || 'blue'}>{dept?.name || 'N/A'}</Tag>
      ),
      sorter: (a, b) => (a.department?.name || '').localeCompare(b.department?.name || ''),
    },
    {
      title: 'Position',
      dataIndex: ['position', 'position_name'],
      key: 'position',
      width: 180,
      render: (position) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{position?.position_name || 'N/A'}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{position?.grade_level || ''}</div>
        </div>
      ),
      sorter: (a, b) => (a.position?.position_name || '').localeCompare(b.position?.position_name || ''),
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <div>
            <PhoneOutlined /> {record.phone || 'N/A'}
          </div>
          <div>
            <MailOutlined /> <Text type="secondary" style={{ fontSize: '12px' }}>{record.email || 'N/A'}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const statusConfig = {
          'ACTIVE': { color: 'green', text: 'Active' },
          'INACTIVE': { color: 'red', text: 'Inactive' },
          'ON_LEAVE': { color: 'orange', text: 'On Leave' },
          'PENDING': { color: 'blue', text: 'Pending' }
        };
        
        const config = statusConfig[status] || { color: 'default', text: status };
        
        return <Badge color={config.color} text={config.text} />;
      },
      sorter: (a, b) => a.status.localeCompare(b.status),
    },
    {
      title: 'Biometric',
      key: 'biometric',
      width: 150,
      render: (_, record) => {
        const hasBiometric = record.biometric_enrolled;
        return (
          <Space>
            {hasBiometric ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                Enrolled
              </Tag>
            ) : (
              <Tag color="orange" icon={<ExclamationCircleOutlined />}>
                Not Enrolled
              </Tag>
            )}
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item 
                    icon={<IdcardOutlined />}
                    onClick={() => biometricMutation.mutate({ employeeId: record.id, biometricType: 'FINGERPRINT' })}
                  >
                    Enroll Fingerprint
                  </Menu.Item>
                  <Menu.Item 
                    icon={<CameraOutlined />}
                    onClick={() => biometricMutation.mutate({ employeeId: record.id, biometricType: 'FACE' })}
                  >
                    Enroll Face
                  </Menu.Item>
                  <Menu.Item 
                    icon={<ScanOutlined />}
                    onClick={() => biometricMutation.mutate({ employeeId: record.id, biometricType: 'PALM' })}
                  >
                    Enroll Palm
                  </Menu.Item>
                </Menu>
              }
              trigger={['click']}
            >
              <Button size="small" icon={<SettingOutlined />}>
                Biometric
              </Button>
            </Dropdown>
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedEmployee(record);
                setDrawerVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Edit Employee">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingEmployee(record);
                form.setFieldsValue(record);
                setIsModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Delete Employee">
            <Popconfirm
              title="Are you sure you want to delete this employee?"
              description="This action cannot be undone."
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Statistics cards
  const statisticsCards = [
    {
      title: 'Total Personnel',
      value: personnelData?.total_count || 0,
      icon: <UserOutlined />,
      color: '#1890ff',
    },
    {
      title: 'Active Personnel',
      value: personnelData?.data?.filter(p => p.status === 'ACTIVE').length || 0,
      icon: <TeamOutlined />,
      color: '#52c41a',
    },
    {
      title: 'Biometric Enrolled',
      value: biometricData?.data?.total_enrolled || 0,
      icon: <SafetyCertificateOutlined />,
      color: '#722ed1',
    },
    {
      title: 'Pending Onboarding',
      value: personnelData?.data?.filter(p => p.status === 'PENDING').length || 0,
      icon: <ClockCircleOutlined />,
      color: '#faad14',
    },
  ];

  // Filter options
  const filterOptions = [
    {
      label: 'Department',
      name: 'department_id',
      options: departmentsData?.data?.map(dept => ({
        label: dept.name,
        value: dept.id,
      })) || [],
    },
    {
      label: 'Position',
      name: 'position_id',
      options: positionsData?.data?.map(pos => ({
        label: pos.position_name,
        value: pos.id,
      })) || [],
    },
    {
      label: 'Status',
      name: 'status',
      options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
        { label: 'On Leave', value: 'ON_LEAVE' },
        { label: 'Pending', value: 'PENDING' },
      ],
    },
  ];

  // Row selection
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    onSelectAll: (selected, selectedRows, changeRows) => {
      setSelectedRowKeys(selected ? selectedRows.map(row => row.id) : []);
    },
  };

  // Export functionality
  const handleExport = async () => {
    try {
      const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch('/api/v1/personnel/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ export_format: 'excel' }),
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'personnel_export.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('Personnel data exported successfully');
    } catch (error) {
      message.error('Failed to export data');
    }
  };

  // Bulk actions
  const bulkActions = (
    <Space>
      <Button icon={<ExportOutlined />} onClick={handleExport}>
        Export
      </Button>
      <Button icon={<ImportOutlined />}>
        Import
      </Button>
      <Button icon={<SyncOutlined />} onClick={() => refetch()}>
        Sync Devices
      </Button>
    </Space>
  );

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5' }}>
      {/* Header */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={3} style={{ margin: 0 }}>
                  <UserOutlined /> Personnel Management
                </Title>
              </Col>
              <Col>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                    Refresh
                  </Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                    Add Employee
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Statistics Cards */}
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

      {/* Main Content */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            {/* Filters and Actions */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12} md={8}>
                <Search
                  placeholder="Search personnel..."
                  allowClear
                  enterButton
                  onChange={debouncedSearch}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={12} md={16}>
                <Space wrap>
                  {filterOptions.map(filter => (
                    <Select
                      key={filter.name}
                      placeholder={filter.label}
                      style={{ width: 150, marginBottom: 8 }}
                      allowClear
                      value={selectedFilters[filter.name]}
                      onChange={(value) => setSelectedFilters(prev => ({ ...prev, [filter.name]: value }))}
                    >
                      {filter.options.map(option => (
                        <Select.Option key={option.value} value={option.value}>
                          {option.label}
                        </Select.Option>
                      ))}
                    </Select>
                  ))}
                  <Button icon={<FilterOutlined />}>
                    More Filters
                  </Button>
                </Space>
              </Col>
            </Row>

            {/* View Mode Tabs */}
            <Tabs
              activeKey={viewMode}
              onChange={setViewMode}
              style={{ marginBottom: 16 }}
              items={[
                { key: 'table', label: <span><TableOutlined /> Table View</span> },
                { key: 'card', label: <span><AppstoreOutlined /> Card View</span> },
                { key: 'kanban', label: <span><KanbanOutlined /> Kanban View</span> },
              ]}
            />

            {/* Bulk Actions */}
            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
              <Col>
                <Space>
                  <Text strong>
                    {selectedRowKeys.length > 0 && `${selectedRowKeys.length} selected`}
                  </Text>
                </Space>
              </Col>
              <Col>
                {bulkActions}
              </Col>
            </Row>

            {/* Personnel Table/Card View */}
            {viewMode === 'table' && (
              <Table
                columns={columns}
                dataSource={personnelData?.data || []}
                loading={isLoading}
                rowSelection={rowSelection}
                rowKey="id"
                pagination={{
                  current: personnelData?.current_page || 1,
                  pageSize: 50,
                  total: personnelData?.total_count || 0,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => (
                    <span>
                      {range[0]}-{range[1]} of <strong>{total}</strong> items
                    </span>
                  ),
                }}
                scroll={{ x: 1200 }}
                size="middle"
              />
            )}

            {viewMode === 'card' && (
              <Row gutter={[16, 16]}>
                {personnelData?.data?.map(employee => (
                  <Col xs={24} sm={12} md={8} lg={6} xl={4} key={employee.id}>
                    <Card
                      hoverable
                      style={{ marginBottom: 16 }}
                      actions={[
                        <Button
                          type="text"
                          icon={<EyeOutlined />}
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setDrawerVisible(true);
                          }}
                        />,
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingEmployee(employee);
                            form.setFieldsValue(employee);
                            setIsModalVisible(true);
                          }}
                        />,
                      ]}
                    >
                      <Card.Meta
                        avatar={
                          <Avatar 
                            size="large" 
                            src={employee.photo_url} 
                            style={{ backgroundColor: '#1890ff' }}
                          >
                            {employee.full_name?.charAt(0)?.toUpperCase()}
                          </Avatar>
                        }
                        title={employee.full_name}
                        description={
                          <Space direction="vertical" size="small">
                            <div><strong>{employee.badge_id}</strong></div>
                            <div>{employee.department?.name || 'N/A'}</div>
                            <div>{employee.position?.position_name || 'N/A'}</div>
                            <Badge 
                              status={employee.status === 'ACTIVE' ? 'success' : 'error'}
                              text={employee.status}
                            />
                          </Space>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Card>
        </Col>
      </Row>

      {/* Add/Edit Modal */}
      <Modal
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingEmployee(null);
          form.resetFields();
        }}
        footer={[
          <Button key="back" onClick={() => setIsModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="advanced"
            onClick={() => {
              setIsAdvancedModalVisible(true);
              setIsModalVisible(false);
            }}
          >
            Advanced
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={employeeMutation.isPending}
            onClick={() => form.validateFields().then((values) => {
              employeeMutation.mutate(values);
            })}
          >
            {editingEmployee ? 'Update' : 'Create'}
          </Button>,
        ]}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          name="employeeForm"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="first_name"
                label="First Name"
                rules={[{ required: true, message: 'Please input first name!' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="last_name"
                label="Last Name"
                rules={[{ required: true, message: 'Please input last name!' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please input email!' },
                  { type: 'email', message: 'Please input a valid email!' }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="department_id"
                label="Department"
                rules={[{ required: true, message: 'Please select department!' }]}
              >
                <Select placeholder="Select Department">
                  {departmentsData?.data?.map(dept => (
                    <Select.Option key={dept.id} value={dept.id}>
                      {dept.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="position_id"
                label="Position"
                rules={[{ required: true, message: 'Please select position!' }]}
              >
                <Select placeholder="Select Position">
                  {positionsData?.data?.map(pos => (
                    <Select.Option key={pos.id} value={pos.id}>
                      {pos.position_name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select status!' }]}
          >
            <Select placeholder="Select Status">
              <Select.Option value="ACTIVE">Active</Select.Option>
              <Select.Option value="INACTIVE">Inactive</Select.Option>
              <Select.Option value="ON_LEAVE">On Leave</Select.Option>
              <Select.Option value="PENDING">Pending</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Employee Details Drawer */}
      <Drawer
        title="Employee Details"
        placement="right"
        width={600}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedEmployee(null);
        }}
        open={drawerVisible}
      >
        {selectedEmployee && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar
                size={120}
                src={selectedEmployee.photo_url}
                style={{ backgroundColor: '#1890ff' }}
              >
                {selectedEmployee.full_name?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Title level={4} style={{ marginTop: 16 }}>
                {selectedEmployee.full_name}
              </Title>
              <Text type="secondary">{selectedEmployee.badge_id}</Text>
            </div>
            
            <Descriptions title="Personal Information" column={1}>
              <Descriptions.Item label="Email">
                {selectedEmployee.email}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {selectedEmployee.phone}
              </Descriptions.Item>
              <Descriptions.Item label="Department">
                {selectedEmployee.department?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Position">
                {selectedEmployee.position?.position_name}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge 
                  status={selectedEmployee.status === 'ACTIVE' ? 'success' : 'error'}
                  text={selectedEmployee.status}
                />
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions title="Biometric Status" column={1}>
              <Descriptions.Item label="Enrolled">
                <Badge 
                  status={selectedEmployee.biometric_enrolled ? 'success' : 'warning'}
                  text={selectedEmployee.biometric_enrolled ? 'Enrolled' : 'Not Enrolled'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Templates">
                {selectedEmployee.fingerprint_templates?.length || 0} Fingerprint, 
                {selectedEmployee.face_template ? 1 : 0} Face
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default PersonnelDashboard;
