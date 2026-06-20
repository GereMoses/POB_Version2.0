import React, { useState, useEffect } from 'react';
import {
  Card, Button, List, Avatar, Badge, Progress, Tag, Space, Typography, Alert,
  Modal, Form, Input, Select, message, Statistic, Row, Col, Divider, Tooltip,
  Drawer, Tabs, Timeline, Steps, Upload,
} from 'antd';
import {
  TeamOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  BellOutlined,
  CameraOutlined,
  PushpinOutlined,
  PhoneOutlined,
  MessageOutlined,
  MailOutlined,
  ShareAltOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  UserOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FireOutlined,
  AlertOutlined,
  HeartOutlined,
  MedicineBoxOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { API_BASE_URL } from '../../services/api';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;
const { Step } = Steps;

const MusteringMobile = () => {
  // State management
  const [activeTab, setActiveTab] = useState('emergency');
  const [activeEvents, setActiveEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [headcount, setHeadcount] = useState(null);
  const [myStatus, setMyStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  
  // Form states
  const [checkInForm] = Form.useForm();
  const [emergencyForm] = Form.useForm();
  const [locationForm] = Form.useForm();

  // Event type options
  const eventTypes = [
    { value: 0, label: 'Real Emergency', color: 'red', icon: <AlertOutlined /> },
    { value: 1, label: 'Drill', color: 'blue', icon: <SafetyOutlined /> },
    { value: 2, label: 'Fire', color: 'orange', icon: <FireOutlined /> },
    { value: 3, label: 'Gas', color: 'yellow', icon: <AlertOutlined /> },
    { value: 4, label: 'Man Down', color: 'purple', icon: <HeartOutlined /> }
  ];

  // Status options
  const statusOptions = [
    { value: 1, label: 'Safe', color: 'green', icon: <CheckCircleOutlined /> },
    { value: 0, label: 'Missing', color: 'red', icon: <WarningOutlined /> },
    { value: 2, label: 'Injured', color: 'orange', icon: <MedicineBoxOutlined /> }
  ];

  // Get current user info (mock for demo)
  const currentUser = {
    id: 123,
    name: 'John Doe',
    emp_code: 'EMP001',
    department: 'Operations',
    phone: '+2348012345678',
    email: 'john.doe@company.com'
  };

  // Fetch active events
  const fetchActiveEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/events/?status=0`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setActiveEvents(data.data);
        if (data.data.length > 0 && !selectedEvent) {
          setSelectedEvent(data.data[0]);
        }
      }
    } catch (error) {
      message.error('Failed to fetch active events');
    }
  };

  // Fetch headcount for selected event
  const fetchEventHeadcount = async (eventId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/events/${eventId}/headcount/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setHeadcount(data.data);
        // Find current user's status
        const userStatus = data.data.personnel_status?.find(p => p.emp_code === currentUser.emp_code);
        setMyStatus(userStatus);
      }
    } catch (error) {
      message.error('Failed to fetch headcount');
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          message.error('Failed to get current location');
        }
      );
    } else {
      message.error('Geolocation is not supported by this browser');
    }
  };

  // Mobile check-in
  const handleMobileCheckIn = async (values) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/mobile/check-in/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          status: values.status,
          location: location,
          notes: values.notes
        })
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Check-in successful');
        setShowCheckInModal(false);
        checkInForm.resetFields();
        fetchEventHeadcount(selectedEvent.id);
      } else {
        message.error(data.message || 'Failed to check in');
      }
    } catch (error) {
      message.error('Failed to check in');
    } finally {
      setLoading(false);
    }
  };

  // Emergency alert
  const handleEmergencyAlert = async (values) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/mobile/emergency-alert/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          alert_type: values.alert_type,
          message: values.message,
          location: location,
          contact_method: values.contact_method
        })
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Emergency alert sent successfully');
        setShowEmergencyModal(false);
        emergencyForm.resetFields();
      } else {
        message.error(data.message || 'Failed to send emergency alert');
      }
    } catch (error) {
      message.error('Failed to send emergency alert');
    } finally {
      setLoading(false);
    }
  };

  // Upload emergency photo
  const handlePhotoUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('event_id', selectedEvent.id);
    formData.append('personnel_id', currentUser.id);
    formData.append('location', JSON.stringify(location));
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/mobile/upload-photo/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Photo uploaded successfully');
        setUploadedPhotos([...uploadedPhotos, data.data]);
      } else {
        message.error(data.message || 'Failed to upload photo');
      }
    } catch (error) {
      message.error('Failed to upload photo');
    }
    
    return false; // Prevent default upload behavior
  };

  // Share location
  const handleShareLocation = async () => {
    if (navigator.share && location) {
      try {
        await navigator.share({
          title: 'My Emergency Location',
          text: `My current location during emergency: ${location.lat}, ${location.lng}`,
          url: `https://maps.google.com/?q=${location.lat},${location.lng}`
        });
      } catch (error) {
        console.error('Error sharing location:', error);
      }
    } else {
      // Fallback: copy to clipboard
      const locationText = `Location: ${location.lat}, ${location.lng}`;
      navigator.clipboard.writeText(locationText);
      message.success('Location copied to clipboard');
    }
  };

  // Initialize component
  useEffect(() => {
    fetchActiveEvents();
    getCurrentLocation();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchActiveEvents();
      if (selectedEvent) {
        fetchEventHeadcount(selectedEvent.id);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedEvent]);

  // Update headcount when event changes
  useEffect(() => {
    if (selectedEvent) {
      fetchEventHeadcount(selectedEvent.id);
    }
  }, [selectedEvent]);

  // Render Emergency Tab
  const renderEmergencyTab = () => (
    <div>
      {selectedEvent ? (
        <div>
          {/* Event Header */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {eventTypes.find(t => t.value === selectedEvent.event_type)?.label}
                </Title>
                <Text type="secondary">{selectedEvent.zone_name}</Text>
              </div>
              <Badge 
                status="processing" 
                text="Active" 
                style={{ fontSize: 16 }}
              />
            </div>
          </Card>

          {/* Quick Actions */}
          <Card title="🚨 Quick Actions" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                size="large" 
                icon={<CheckCircleOutlined />}
                onClick={() => setShowCheckInModal(true)}
                style={{ width: '100%' }}
              >
                Check In Safe
              </Button>
              <Button 
                danger 
                size="large" 
                icon={<AlertOutlined />}
                onClick={() => setShowEmergencyModal(true)}
                style={{ width: '100%' }}
              >
                Send Emergency Alert
              </Button>
              <Button 
                size="large" 
                icon={<CameraOutlined />}
                onClick={() => setShowPhotoModal(true)}
                style={{ width: '100%' }}
              >
                Upload Photo
              </Button>
              <Button 
                size="large" 
                icon={<ShareAltOutlined />}
                onClick={handleShareLocation}
                disabled={!location}
                style={{ width: '100%' }}
              >
                Share Location
              </Button>
            </Space>
          </Card>

          {/* My Status */}
          <Card title="👤 My Status" style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Avatar size={64} icon={<UserOutlined />} />
              <div>
                <Title level={5}>{currentUser.name}</Title>
                <Text type="secondary">{currentUser.emp_code}</Text>
              </div>
            </div>
            {myStatus ? (
              <div>
                <Tag color={statusOptions.find(s => s.value === myStatus.status)?.color} icon={statusOptions.find(s => s.value === myStatus.status)?.icon}>
                  {statusOptions.find(s => s.value === myStatus.status)?.label}
                </Tag>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">Checked in: {new Date(myStatus.check_time).toLocaleString()}</Text>
                </div>
              </div>
            ) : (
              <Alert
                message="Not Checked In"
                description="Please check in to update your status"
                type="warning"
                showIcon
              />
            )}
          </Card>

          {/* Event Overview */}
          <Card title="📊 Event Overview">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Total"
                  value={headcount?.total_expected || 0}
                  prefix={<TeamOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Safe"
                  value={headcount?.total_safe || 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Missing"
                  value={headcount?.total_missing || 0}
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
            </Row>
            <Divider />
            <Progress
              percent={headcount ? Math.round((headcount.total_safe / headcount.total_expected) * 100) : 0}
              status={headcount && headcount.total_safe === headcount.total_expected ? 'success' : 'active'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
            <Text type="secondary">Completion Progress</Text>
          </Card>
        </div>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Alert
              message="No Active Events"
              description="There are no active mustering events at the moment."
              type="info"
              showIcon
            />
          </div>
        </Card>
      )}
    </div>
  );

  // Render Personnel Tab
  const renderPersonnelTab = () => (
    <div>
      <Card title="👥 Personnel Status">
        <List
          dataSource={headcount?.personnel_status || []}
          renderItem={(person) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={person.person_name}
                description={person.emp_code}
              />
              <Tag color={statusOptions.find(s => s.value === person.status)?.color} icon={statusOptions.find(s => s.value === person.status)?.icon}>
                {statusOptions.find(s => s.value === person.status)?.label}
              </Tag>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  // Render Location Tab
  const renderLocationTab = () => (
    <div>
      <Card title="📍 Location Services">
        {location ? (
          <div>
            <Alert
              message="Location Available"
              description={`Latitude: ${location.lat}, Longitude: ${location.lng}`}
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Button 
              type="primary" 
              icon={<ReloadOutlined />}
              onClick={getCurrentLocation}
              style={{ marginRight: 8 }}
            >
              Refresh Location
            </Button>
            <Button 
              icon={<ShareAltOutlined />}
              onClick={handleShareLocation}
            >
              Share Location
            </Button>
          </div>
        ) : (
          <div>
            <Alert
              message="Location Not Available"
              description="Enable location services to share your position during emergencies."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Button 
              type="primary" 
              icon={<ReloadOutlined />}
              onClick={getCurrentLocation}
            >
              Get Location
            </Button>
          </div>
        )}
      </Card>
    </div>
  );

  // Render Photos Tab
  const renderPhotosTab = () => (
    <div>
      <Card title="📸 Emergency Photos" extra={
        <Button 
          type="primary" 
          icon={<CameraOutlined />}
          onClick={() => setShowPhotoModal(true)}
        >
          Upload Photo
        </Button>
      }>
        <List
          dataSource={uploadedPhotos}
          renderItem={(photo) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar src={photo.thumbnail_url} />}
                title={`Photo ${photo.id}`}
                description={new Date(photo.upload_time).toLocaleString()}
              />
              <Button size="small" icon={<EyeOutlined />}>
                View
              </Button>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );

  return (
    <div style={{ padding: 16 }}>
      <Title level={3}>🚨 Mobile Mustering</Title>
      
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        items={[
          { key: 'emergency', label: '🚨 Emergency', children: renderEmergencyTab() },
          { key: 'personnel', label: '👥 Personnel', children: renderPersonnelTab() },
          { key: 'location', label: '📍 Location', children: renderLocationTab() },
          { key: 'photos', label: '📸 Photos', children: renderPhotosTab() },
        ]}
      />

      {/* Check-in Modal */}
      <Modal
        title="Check In"
        open={showCheckInModal}
        onCancel={() => setShowCheckInModal(false)}
        footer={null}
      >
        <Form form={checkInForm} onFinish={handleMobileCheckIn}>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select placeholder="Select your status">
              {statusOptions.map(status => (
                <Option key={status.value} value={status.value}>
                  {status.icon} {status.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Add any additional information..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Check In
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Emergency Alert Modal */}
      <Modal
        title="Send Emergency Alert"
        open={showEmergencyModal}
        onCancel={() => setShowEmergencyModal(false)}
        footer={null}
      >
        <Form form={emergencyForm} onFinish={handleEmergencyAlert}>
          <Form.Item name="alert_type" label="Alert Type" rules={[{ required: true }]}>
            <Select placeholder="Select alert type">
              <Option value="medical">Medical Emergency</Option>
              <Option value="fire">Fire Emergency</Option>
              <Option value="security">Security Threat</Option>
              <Option value="other">Other Emergency</Option>
            </Select>
          </Form.Item>
          <Form.Item name="message" label="Message" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Describe your emergency..." />
          </Form.Item>
          <Form.Item name="contact_method" label="Contact Method" rules={[{ required: true }]}>
            <Select placeholder="Select contact method">
              <Option value="sms">SMS</Option>
              <Option value="email">Email</Option>
              <Option value="whatsapp">WhatsApp</Option>
              <Option value="all">All Methods</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" danger htmlType="submit" loading={loading} block>
              Send Alert
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Photo Upload Modal */}
      <Modal
        title="Upload Emergency Photo"
        open={showPhotoModal}
        onCancel={() => setShowPhotoModal(false)}
        footer={null}
      >
        <Upload
          beforeUpload={handlePhotoUpload}
          accept="image/*"
          showUploadList={false}
        >
          <Button icon={<CameraOutlined />} block>
            Take Photo or Choose from Gallery
          </Button>
        </Upload>
      </Modal>
    </div>
  );
};

export default MusteringMobile;
