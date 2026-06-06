import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Steps,
  Button,
  Progress,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Alert,
  Spin,
  Typography,
  Space,
  Tag,
  Badge,
  Timeline,
  Descriptions,
  Tabs,
  Result,
  message,
  notification,
  Tooltip,
  Divider,
  List,
  Avatar,
  Statistic
} from 'antd';
import {
  UserOutlined,
  FingerprintOutlined,
  CameraOutlined,
  ScanOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SyncOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Item } = Form;
const { Dragger } = Upload;

const BiometricEnrollment = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [enrollmentSession, setEnrollmentSession] = useState(null);
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('enroll');
  const [templateType, setTemplateType] = useState('FINGERPRINT');
  const [captureProgress, setCaptureProgress] = useState(0);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Fetch personnel data
  const { data: personnelData } = useQuery({
    queryKey: ['personnel'],
    queryFn: async () => apiService.get('/api/v1/personnel/'),
  });

  // Fetch enrollment sessions (recent enrollments from biometric module)
  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['biometric-sessions'],
    queryFn: async () => apiService.get('/api/v1/biometric/enrollments/recent'),
    refetchInterval: 5000,
  });

  // Fetch devices summary
  const { data: devicesData } = useQuery({
    queryKey: ['biometric-devices'],
    queryFn: async () => apiService.get('/api/v1/biometric/devices/summary'),
  });

  // Start enrollment session mutation
  const startSessionMutation = useMutation({
    mutationFn: async ({ personnelId, templateType }) =>
      apiService.post('/api/v1/biometric/enroll', {
        personnel_id: personnelId,
        template_type: templateType,
      }),
    onSuccess: (data) => {
      setEnrollmentSession(data.data);
      setCurrentStep(1);
      setIsModalVisible(true);
      message.success('Biometric enrollment session started');
    },
    onError: () => message.error('Failed to start enrollment'),
  });

  // Capture biometric data mutation (ZKTeco handles capture at device level)
  const captureMutation = useMutation({
    mutationFn: async ({ sessionId, templateData }) =>
      apiService.post('/api/v1/biometric/sync/zkteco', {
        session_id: sessionId,
        template_data: templateData,
      }),
    onSuccess: () => setCaptureProgress(prev => Math.min(prev + 20, 100)),
    onError: () => message.error('Failed to capture biometric data'),
  });

  // Complete enrollment mutation
  const completeMutation = useMutation({
    mutationFn: async (personnelId) =>
      apiService.get(`/api/v1/biometric/personnel/${personnelId}/status`),
    onSuccess: () => {
      message.success('Biometric enrollment completed successfully');
      setIsModalVisible(false);
      setCurrentStep(0);
      setEnrollmentSession(null);
      setCapturedImages([]);
      queryClient.invalidateQueries({ queryKey: ['biometric-sessions'] });
    },
    onError: () => message.error('Failed to complete enrollment'),
  });

  // Steps configuration
  const steps = [
    {
      title: 'Select Personnel',
      description: 'Choose personnel for biometric enrollment',
      icon: <UserOutlined />,
    },
    {
      title: 'Start Session',
      description: 'Initialize biometric enrollment session',
      icon: <PlayCircleOutlined />,
    },
    {
      title: 'Capture Biometric',
      description: 'Capture biometric data from device',
      icon: <ScanOutlined />,
    },
    {
      title: 'Complete Enrollment',
      description: 'Finalize and save biometric template',
      icon: <CheckCircleOutlined />,
    },
  ];

  // Template type configurations
  const templateConfigs = {
    FINGERPRINT: {
      icon: <FingerprintOutlined />,
      color: '#1890ff',
      requiredCaptures: 3,
      instructions: 'Place finger on scanner and capture fingerprint',
    },
    FACE: {
      icon: <CameraOutlined />,
      color: '#52c41a',
      requiredCaptures: 1,
      instructions: 'Position face in front of camera and capture image',
    },
    PALM: {
      icon: <ScanOutlined />,
      color: '#722ed1',
      requiredCaptures: 2,
      instructions: 'Place palm on scanner and capture palm vein pattern',
    },
  };

  // Handle personnel selection
  const handlePersonnelSelect = (personnel) => {
    setSelectedPersonnel(personnel);
    setCurrentStep(1);
  };

  // Handle template type selection
  const handleTemplateTypeSelect = (type) => {
    setTemplateType(type);
    setCurrentStep(2);
  };

  // Handle capture
  const handleCapture = () => {
    setIsCapturing(true);
    setCaptureProgress(0);
    
    // Simulate capture process
    const config = templateConfigs[templateType];
    for (let i = 0; i < config.requiredCaptures; i++) {
      setTimeout(() => {
        captureMutation.mutate({
          sessionId: enrollmentSession?.session_id,
          templateData: {
            template_type: templateType,
            capture_index: i,
            quality_score: Math.random() * 30 + 70, // Simulate quality score
            template_data: `captured_data_${i}` // Simulate template data
          }
        });
        
        setCaptureProgress(prev => Math.min(prev + (100 / config.requiredCaptures), 100));
        
        if (i === config.requiredCaptures - 1) {
          setIsCapturing(false);
          setCurrentStep(3);
        }
      }, i * 2000); // 2 seconds between captures
    }
  };

  // Handle enrollment completion
  const handleComplete = () => {
    completeMutation.mutate(selectedPersonnel?.id);
  };

  // Render enrollment progress
  const renderEnrollmentProgress = () => {
    const config = templateConfigs[templateType];
    
    return (
      <div>
        <Alert
          message={config.instructions}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar size={120} icon={config.icon} style={{ backgroundColor: config.color }} />
        </div>
        
        <Progress
          type="circle"
          percent={captureProgress}
          status={isCapturing ? 'active' : 'normal'}
          format={(percent) => `${percent}%`}
        />
        
        <div style={{ marginTop: 16 }}>
          <Text>Capturing {templateType} template...</Text>
        </div>
        
        {capturedImages.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Title level={5}>Captured Images</Title>
            <Row gutter={[16, 16]}>
              {capturedImages.map((image, index) => (
                <Col span={8} key={index}>
                  <Card>
                    <Avatar
                      size={80}
                      src={image.url}
                      style={{ marginBottom: 8 }}
                    />
                    <div>
                      <Text strong>Capture {index + 1}</Text>
                      <div>
                        <Text type="secondary">Quality: {image.quality}%</Text>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}
      </div>
    );
  };

  // Render session list
  const renderSessionList = () => {
    const columns = [
      {
        title: 'Personnel',
        dataIndex: ['personnel', 'full_name'],
        key: 'personnel',
        render: (personnel) => (
          <Space>
            <Avatar size="small" src={personnel?.photo_url}>
              {personnel?.full_name?.charAt(0)?.toUpperCase()}
            </Avatar>
            <span>{personnel?.full_name}</span>
          </Space>
        ),
      },
      {
        title: 'Template Type',
        dataIndex: 'template_type',
        key: 'template_type',
        render: (type) => {
          const config = templateConfigs[type];
          return (
            <Tag color={config.color} icon={config.icon}>
              {type}
            </Tag>
          );
        },
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (status) => {
          const statusConfig = {
            'INITIATED': { color: 'blue', text: 'Initiated' },
            'IN_PROGRESS': { color: 'orange', text: 'In Progress' },
            'COMPLETED': { color: 'green', text: 'Completed' },
            'FAILED': { color: 'red', text: 'Failed' },
          };
          
          const config = statusConfig[status] || { color: 'default', text: status };
          return <Badge color={config.color} text={config.text} />;
        },
      },
      {
        title: 'Progress',
        dataIndex: 'progress_percentage',
        key: 'progress',
        render: (progress) => (
          <Progress
            percent={progress || 0}
            size="small"
            status={progress === 100 ? 'success' : 'active'}
          />
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_, record) => (
          <Space>
            {record.status === 'IN_PROGRESS' && (
              <Button
                size="small"
                icon={<StopOutlined />}
                onClick={() => {
                  // Cancel session logic
                  notification.info({
                    message: 'Session cancellation not implemented yet',
                    description: 'This feature will be available in the next version.',
                  });
                }}
              >
                Cancel
              </Button>
            )}
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                // View details logic
                Modal.info({
                  title: 'Session Details',
                  content: (
                    <Descriptions column={1}>
                      <Descriptions.Item label="Session ID">
                        {record.session_id}
                      </Descriptions.Item>
                      <Descriptions.Item label="Started At">
                        {record.started_at}
                      </Descriptions.Item>
                      <Descriptions.Item label="Progress">
                        {record.progress_percentage}%
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                  width: 600,
                });
              }}
            >
              Details
            </Button>
          </Space>
        ),
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={sessionsData?.data || []}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
      />
    );
  };

  // Render device status
  const renderDeviceStatus = () => {
    const columns = [
      {
        title: 'Device',
        dataIndex: 'device_name',
        key: 'device_name',
      },
      {
        title: 'Status',
        dataIndex: 'is_online',
        key: 'status',
        render: (isOnline) => (
          <Badge
            status={isOnline ? 'success' : 'error'}
            text={isOnline ? 'Online' : 'Offline'}
          />
        ),
      },
      {
        title: 'Last Sync',
        dataIndex: 'last_sync',
        key: 'last_sync',
        render: (lastSync) => (
          <Text type="secondary">
            {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
          </Text>
        ),
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={devicesData?.data || []}
        rowKey="id"
        pagination={false}
        size="small"
      />
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <FingerprintOutlined /> Biometric Enrollment Center
      </Title>
      
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 24 }}
        items={[
          {
            key: 'personnel',
            label: <span><UserOutlined /> Personnel Selection</span>,
            children: (
              <Row gutter={[16, 16]}>
                {personnelData?.data?.map(personnel => (
                  <Col xs={24} sm={12} md={8} lg={6} xl={4} key={personnel.id}>
                    <Card hoverable style={{ marginBottom: 16 }} actions={[<Button type="primary" onClick={() => handlePersonnelSelect(personnel)}>Select</Button>]}>
                      <Card.Meta
                        avatar={<Avatar size="large" src={personnel.photo_url} style={{ backgroundColor: '#1890ff' }}>{personnel.full_name?.charAt(0)?.toUpperCase()}</Avatar>}
                        title={personnel.full_name}
                        description={
                          <Space direction="vertical" size="small">
                            <div><strong>{personnel.badge_id}</strong></div>
                            <div>{personnel.department?.name || 'N/A'}</div>
                            <Badge status={personnel.biometric_enrolled ? 'success' : 'warning'} text={personnel.biometric_enrolled ? 'Enrolled' : 'Not Enrolled'} />
                          </Space>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            )
          },
          {
            key: 'sessions',
            label: <span><ScanOutlined /> Enrollment Sessions</span>,
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => refetchSessions()}>Refresh</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCurrentStep(0)}>New Session</Button>
                  </Space>
                </div>
                {renderSessionList()}
              </>
            )
          },
          {
            key: 'devices',
            label: <span><SettingOutlined /> Device Status</span>,
            children: renderDeviceStatus()
          },
        ]}
      />

      {/* Enrollment Modal */}
      <Modal
        title="Biometric Enrollment"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setCurrentStep(0);
          setEnrollmentSession(null);
        }}
        footer={null}
        width={800}
      >
        <Steps current={currentStep} items={steps} />
        
        <div style={{ marginTop: 24 }}>
          {currentStep === 0 && (
            <Result
              status="info"
              title="Select Personnel"
              subTitle="Choose a personnel member to start biometric enrollment"
              extra={
                <Button type="primary" onClick={() => setCurrentStep(1)}>
                  Select Personnel
                </Button>
              }
            />
          )}
          
          {currentStep === 1 && selectedPersonnel && (
            <div>
              <Alert
                message={`Selected: ${selectedPersonnel.full_name}`}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <Title level={4}>Select Biometric Template Type</Title>
              <Row gutter={[16, 16]}>
                {Object.entries(templateConfigs).map(([type, config]) => (
                  <Col span={8} key={type}>
                    <Card
                      hoverable
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => handleTemplateTypeSelect(type)}
                    >
                      <div style={{ fontSize: 48, marginBottom: 16 }}>
                        {config.icon}
                      </div>
                      <Title level={5}>{type}</Title>
                      <Text type="secondary">{config.instructions}</Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          )}
          
          {currentStep === 2 && (
            <div>
              <Title level={4}>Capture {templateType}</Title>
              {renderEnrollmentProgress()}
              
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Space>
                  <Button
                    icon={<PauseCircleOutlined />}
                    onClick={() => setIsCapturing(false)}
                    disabled={!isCapturing}
                  >
                    Pause
                  </Button>
                  <Button
                    type="primary"
                    icon={<StopOutlined />}
                    onClick={() => {
                      setIsCapturing(false);
                      setCurrentStep(3);
                    }}
                    disabled={!isCapturing}
                  >
                    Complete
                  </Button>
                </Space>
              </div>
            </div>
          )}
          
          {currentStep === 3 && (
            <Result
              status="success"
              title="Enrollment Completed"
              subTitle="Biometric template has been successfully captured and saved"
              extra={[
                <Button type="primary" onClick={handleComplete}>
                  Save Template
                </Button>,
                <Button onClick={() => setCurrentStep(2)}>
                  Capture More
                </Button>,
              ]}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default BiometricEnrollment;
