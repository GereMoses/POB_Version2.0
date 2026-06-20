import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Upload,
  Select,
  message,
  Progress,
  Tooltip,
  Card,
  Row,
  Col,
  Badge,
  Drawer,
  Alert,
  Statistic,
  List,
  Typography,
  Divider,
} from 'antd';
import {
  CloudUploadOutlined,
  SendOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  MobileOutlined
} from '@ant-design/icons';
import { deviceAPI } from '../../../services/deviceAPI';

const { Option } = Select;
const { Text, Title } = Typography;

const FirmwareManagement = () => {
  const [firmwares, setFirmwares] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [pushModalVisible, setPushModalVisible] = useState(false);
  const [selectedFirmware, setSelectedFirmware] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pushProgress, setPushProgress] = useState({});
  const [form] = Form.useForm();
  const [pushForm] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [stats, setStats] = useState({
    totalFirmwares: 0,
    activeUpdates: 0,
    completedUpdates: 0,
    failedUpdates: 0
  });

  // Mock data for demonstration
  useEffect(() => {
    fetchFirmwares();
    fetchDevices();
  }, []);

  const fetchFirmwares = async () => {
    setLoading(true);
    try {
      // Mock firmware data
      const mockFirmwares = [
        {
          id: 'fw_001',
          filename: 'MB20_v2.3.1.bin',
          originalName: 'MB20_Firmware_v2.3.1.bin',
          file_size: 5242880, // 5MB
          upload_time: '2024-03-15T10:30:00Z',
          device_types: ['MB20', 'MB360'],
          version: '2.3.1',
          description: 'Stable firmware for MB20 and MB360 devices',
          status: 'active',
          uploaded_by: 'admin',
          checksum: 'a1b2c3d4e5f6',
          update_count: 15,
          success_count: 12,
          failed_count: 3
        },
        {
          id: 'fw_002',
          filename: 'MB560_v1.8.5.bin',
          originalName: 'MB560_Firmware_v1.8.5.bin',
          file_size: 8388608, // 8MB
          upload_time: '2024-03-20T14:15:00Z',
          device_types: ['MB560'],
          version: '1.8.5',
          description: 'Latest firmware for MB560 with improved biometric recognition',
          status: 'active',
          uploaded_by: 'admin',
          checksum: 'f6e5d4c3b2a1',
          update_count: 8,
          success_count: 7,
          failed_count: 1
        },
        {
          id: 'fw_003',
          filename: 'K40_v3.0.0.bin',
          originalName: 'K40_Firmware_v3.0.0.bin',
          file_size: 4194304, // 4MB
          upload_time: '2024-03-25T09:45:00Z',
          device_types: ['K40', 'K60'],
          version: '3.0.0',
          description: 'Major firmware update for K40/K60 series',
          status: 'testing',
          uploaded_by: 'admin',
          checksum: 'z9y8x7w6v5u4',
          update_count: 0,
          success_count: 0,
          failed_count: 0
        }
      ];
      
      setFirmwares(mockFirmwares);
      
      // Calculate stats
      const totalUpdates = mockFirmwares.reduce((sum, fw) => sum + fw.update_count, 0);
      const completedUpdates = mockFirmwares.reduce((sum, fw) => sum + fw.success_count, 0);
      const failedUpdates = mockFirmwares.reduce((sum, fw) => sum + fw.failed_count, 0);
      const activeUpdates = totalUpdates - completedUpdates - failedUpdates;
      
      setStats({
        totalFirmwares: mockFirmwares.length,
        activeUpdates,
        completedUpdates,
        failedUpdates
      });
    } catch (error) {
      message.error('Failed to fetch firmwares');
      console.error('Error fetching firmwares:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await deviceAPI.getTerminals({ limit: 1000 });
      setDevices(Array.isArray(response) ? response : (response?.data || []));
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const handleUploadFirmware = () => {
    setFileList([]);
    setUploadProgress(0);
    form.resetFields();
    setUploadModalVisible(true);
  };

  const handlePushFirmware = (firmware) => {
    setSelectedFirmware(firmware);
    setSelectedDevices([]);
    pushForm.resetFields();
    setPushModalVisible(true);
  };

  const handleUploadModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (fileList.length === 0) {
        message.error('Please select a firmware file');
        return;
      }
      
      const file = fileList[0].originFileObj;
      
      // Simulate upload progress
      setUploadProgress(0);
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);
      
      // Mock upload
      setTimeout(async () => {
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        try {
          const firmwareData = {
            firmware_id: `fw_${Date.now()}`,
            filename: file.name,
            file_size: file.size,
            upload_time: new Date().toISOString(),
            device_types: values.device_types || [],
            version: values.version || 'Unknown',
            description: values.description || '',
            status: 'active'
          };
          
          setFirmwares([firmwareData, ...firmwares]);
          message.success('Firmware uploaded successfully');
          setUploadModalVisible(false);
          setFileList([]);
          fetchFirmwares();
        } catch (error) {
          message.error('Failed to upload firmware');
          console.error('Error uploading firmware:', error);
        }
      }, 2000);
      
    } catch (error) {
      if (error.errorFields) {
        // Validation error
        return;
      }
      message.error('Failed to upload firmware');
      console.error('Error uploading firmware:', error);
    }
  };

  const handlePushModalOk = async () => {
    try {
      const values = await pushForm.validateFields();
      
      if (selectedDevices.length === 0) {
        message.error('Please select at least one device');
        return;
      }
      
      // Simulate firmware push
      const firmwareId = selectedFirmware.id;
      const deviceSNs = selectedDevices;
      
      // Initialize progress for each device
      const initialProgress = {};
      deviceSNs.forEach(sn => {
        initialProgress[sn] = 0;
      });
      setPushProgress(initialProgress);
      
      // Simulate progress updates
      deviceSNs.forEach((sn, index) => {
        setTimeout(() => {
          setPushProgress(prev => ({
            ...prev,
            [sn]: 50
          }));
          
          setTimeout(() => {
            setPushProgress(prev => ({
              ...prev,
              [sn]: 100
            }));
            
            message.success(`Firmware pushed to ${sn}`);
          }, 2000);
        }, index * 1000);
      });
      
      setPushModalVisible(false);
      setSelectedDevices([]);
      fetchFirmwares();
    } catch (error) {
      if (error.errorFields) {
        // Validation error
        return;
      }
      message.error('Failed to push firmware');
      console.error('Error pushing firmware:', error);
    }
  };

  const handleDeleteFirmware = async (firmwareId) => {
    try {
      setFirmwares(firmwares.filter(fw => fw.id !== firmwareId));
      message.success('Firmware deleted successfully');
      fetchFirmwares();
    } catch (error) {
      message.error('Failed to delete firmware');
      console.error('Error deleting firmware:', error);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return 'N/A';
    return new Date(dateTime).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'testing': return 'warning';
      case 'deprecated': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircleOutlined />;
      case 'testing': return <ClockCircleOutlined />;
      case 'deprecated': return <ExclamationCircleOutlined />;
      default: return <FileOutlined />;
    }
  };

  const columns = [
    {
      title: 'Firmware',
      dataIndex: 'filename',
      key: 'filename',
      width: 200,
      render: (filename, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <FileOutlined style={{ marginRight: '8px' }} />
            <strong>{filename}</strong>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            v{record.version} • {formatFileSize(record.file_size)}
          </div>
        </div>
      )
    },
    {
      title: 'Device Types',
      dataIndex: 'device_types',
      key: 'device_types',
      width: 150,
      render: (deviceTypes) => (
        <div>
          {deviceTypes.map((type, index) => (
            <Tag key={index} size="small" style={{ margin: '2px' }}>
              {type}
            </Tag>
          ))}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag 
          color={getStatusColor(status)}
          icon={getStatusIcon(status)}
        >
          {status.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Testing', value: 'testing' },
        { text: 'Deprecated', value: 'deprecated' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: 'Update Stats',
      key: 'stats',
      width: 150,
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          <div>Total: {record.update_count}</div>
          <div style={{ color: '#52c41a' }}>Success: {record.success_count}</div>
          <div style={{ color: '#ff4d4f' }}>Failed: {record.failed_count}</div>
        </div>
      )
    },
    {
      title: 'Uploaded',
      dataIndex: 'upload_time',
      key: 'upload_time',
      width: 150,
      render: (time) => formatDateTime(time)
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      render: (description) => (
        <div style={{ fontSize: '12px', color: '#666' }}>
          {description && description.length > 50 ? 
            `${description.substring(0, 50)}...` : 
            description || 'No description'
          }
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Push to Devices">
            <Button 
              icon={<SendOutlined />} 
              size="small"
              onClick={() => handlePushFirmware(record)}
            />
          </Tooltip>
          
          <Tooltip title="Download">
            <Button 
              icon={<DownloadOutlined />} 
              size="small"
              onClick={() => message.info('Download not implemented')}
            />
          </Tooltip>
          
          <Tooltip title="Delete">
            <Button 
              icon={<DeleteOutlined />} 
              size="small"
              danger
              onClick={() => handleDeleteFirmware(record.id)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  const deviceColumns = [
    {
      title: 'Select',
      key: 'select',
      width: 60,
      render: (_, record) => (
        <input
          type="checkbox"
          checked={selectedDevices.includes(record.sn)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedDevices([...selectedDevices, record.sn]);
            } else {
              setSelectedDevices(selectedDevices.filter(sn => sn !== record.sn));
            }
          }}
        />
      )
    },
    {
      title: 'Device',
      dataIndex: 'alias',
      key: 'alias',
      render: (alias, record) => (
        <div>
          <div><strong>{alias}</strong></div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.sn}</div>
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 120,
      render: (deviceType) => {
        const types = {
          0: 'Attendance',
          1: 'Access Control',
          2: 'Mustering',
          3: 'Emergency'
        };
        return types[deviceType] || 'Unknown';
      }
    },
    {
      title: 'Model',
      dataIndex: 'device_model',
      key: 'device_model',
      width: 100
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Badge 
          status={status === 'online' ? 'success' : 'error'} 
          text={status?.toUpperCase()} 
        />
      )
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 120,
      render: (_, record) => {
        const progress = pushProgress[record.sn] || 0;
        return (
          <Progress
            percent={progress}
            size="small"
            status={progress === 100 ? 'success' : 'active'}
          />
        );
      }
    }
  ];

  return (
    <div className="firmware-management">
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Firmwares"
              value={stats.totalFirmwares}
              prefix={<FileOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Updates"
              value={stats.activeUpdates}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Completed"
              value={stats.completedUpdates}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Failed"
              value={stats.failedUpdates}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Toolbar */}
      <Card className="firmware-toolbar" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={12}>
            <Space>
              <CloudUploadOutlined style={{ fontSize: '20px' }} />
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Firmware Management</span>
            </Space>
          </Col>
          
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchFirmwares}
                loading={loading}
              >
                Refresh
              </Button>
              
              <Button
                icon={<CloudUploadOutlined />}
                type="primary"
                onClick={handleUploadFirmware}
              >
                Upload Firmware
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Firmware Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={firmwares}
          loading={loading}
          rowKey="id"
          pagination={{
            total: firmwares.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} firmwares`
          }}
        />
      </Card>

      {/* Upload Firmware Modal */}
      <Modal
        title="Upload Firmware"
        open={uploadModalVisible}
        onOk={handleUploadModalOk}
        onCancel={() => setUploadModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="firmware_file"
            label="Firmware File"
            rules={[{ required: true, message: 'Please select a firmware file' }]}
          >
            <Upload
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setFileList(fileList)}
              accept=".bin"
            >
              <Button icon={<CloudUploadOutlined />}>Select .bin File</Button>
            </Upload>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Only .bin firmware files are supported
            </Text>
          </Form.Item>
          
          <Form.Item
            name="version"
            label="Firmware Version"
            rules={[{ required: true, message: 'Please enter firmware version' }]}
          >
            <Input placeholder="e.g., 2.3.1" />
          </Form.Item>
          
          <Form.Item
            name="device_types"
            label="Compatible Device Types"
          >
            <Select
              mode="tags"
              placeholder="Select or enter device types"
              style={{ width: '100%' }}
            >
              <Option value="MB20">MB20</Option>
              <Option value="MB360">MB360</Option>
              <Option value="MB560">MB560</Option>
              <Option value="K40">K40</Option>
              <Option value="K60">K60</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea 
              placeholder="Enter firmware description"
              rows={3}
            />
          </Form.Item>
          
          {uploadProgress > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text>Upload Progress:</Text>
              <Progress percent={uploadProgress} status="active" />
            </div>
          )}
        </Form>
      </Modal>

      {/* Push Firmware Modal */}
      <Modal
        title={`Push Firmware: ${selectedFirmware?.filename}`}
        open={pushModalVisible}
        onOk={handlePushModalOk}
        onCancel={() => setPushModalVisible(false)}
        width={800}
      >
        {selectedFirmware && (
          <div>
            <Alert
              message={`Firmware: ${selectedFirmware.filename}`}
              description={`Version: ${selectedFirmware.version} | Size: ${formatFileSize(selectedFirmware.file_size)}`}
              type="info"
              style={{ marginBottom: 16 }}
            />
            
            <Form
              form={pushForm}
              layout="vertical"
            >
              <Form.Item
                label="Select Devices"
                extra="Choose devices to push firmware to. Only compatible devices are shown."
              >
                <Table
                  columns={deviceColumns}
                  dataSource={devices.filter(device => 
                    selectedFirmware.device_types.length === 0 || 
                    selectedFirmware.device_types.includes(device.device_model)
                  )}
                  rowKey="sn"
                  size="small"
                  pagination={false}
                  scroll={{ y: 300 }}
                />
                
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">
                    Selected: {selectedDevices.length} devices
                  </Text>
                </div>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FirmwareManagement;
