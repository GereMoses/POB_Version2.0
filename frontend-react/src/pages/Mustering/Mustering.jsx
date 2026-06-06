import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, Card, Row, Col, Statistic, Button, Modal, Form, Input, Select, Table, Tag, Progress, message, Badge, Space, Descriptions, Timeline, Tooltip, Alert, Divider } from 'antd';
import {
  TeamOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  FileTextOutlined,
  BellOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  SearchOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { API_BASE_URL } from '../../services/api';

const { Option } = Select;
const { TextArea } = Input;

const ESCALATION_CONFIG = [
  { level: 0, label: 'Missing',       color: '#ff4d4f', bg: '#fff1f0', border: '#ffccc7' },
  { level: 1, label: 'Alert',         color: '#faad14', bg: '#fffbe6', border: '#ffe58f' },
  { level: 2, label: 'Search Ordered',color: '#ff7a00', bg: '#fff7e6', border: '#ffd591' },
  { level: 3, label: 'Critical',      color: '#ff0000', bg: '#fff0f0', border: '#ff4d4f' },
];

/* ── Missing persons panel ───────────────────────────────────────────────────── */
const MissingPersonsPanel = ({ eventId, onMarkStatus }) => {
  const [persons, setPersons]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [sweepTarget, setSweepTarget] = useState(null);
  const [sweepForm]                 = Form.useForm();
  const timerRef                    = useRef(null);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchMissing = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/mustering/events/${eventId}/missing-persons/`, { headers: authHeader() });
      const data = await res.json();
      if (data.success) setPersons(data.data);
    } catch (_) {}
  }, [eventId]);

  useEffect(() => {
    fetchMissing();
    timerRef.current = setInterval(fetchMissing, 30000);
    return () => clearInterval(timerRef.current);
  }, [fetchMissing]);

  const recordSweep = async (values) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/mustering/events/${eventId}/search-sweeps/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ emp_code: sweepTarget.emp_code, ...values }),
        }
      );
      const data = await res.json();
      if (data.success) {
        message.success('Search sweep recorded');
        sweepForm.resetFields();
        setSweepTarget(null);
        fetchMissing();
        onMarkStatus?.();
      } else {
        message.error(data.detail || 'Failed to record sweep');
      }
    } catch (_) {
      message.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (persons.length === 0) return null;

  return (
    <Card
      style={{ marginBottom: 16, border: '2px solid #ff4d4f', background: '#fff1f0' }}
      title={
        <span style={{ color: '#cf1322', fontWeight: 700 }}>
          <CloseCircleOutlined style={{ marginRight: 8 }} />
          Missing Personnel — {persons.length} person{persons.length !== 1 ? 's' : ''} unaccounted
        </span>
      }
      extra={
        <Button size="small" icon={<SearchOutlined />} onClick={fetchMissing}>
          Refresh
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {persons.map(p => {
          const cfg = ESCALATION_CONFIG[p.escalation_level] || ESCALATION_CONFIG[0];
          return (
            <div
              key={p.emp_code}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 14px', borderRadius: 8,
                background: cfg.bg, border: `1px solid ${cfg.border}`,
              }}
            >
              {/* Left: identity */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                    {p.emp_name}
                  </span>
                  <Tag color="default" style={{ fontFamily: 'monospace' }}>{p.emp_code}</Tag>
                  <Tag
                    color={cfg.level >= 3 ? 'error' : cfg.level >= 2 ? 'warning' : cfg.level >= 1 ? 'gold' : 'default'}
                    style={{ fontWeight: 700 }}
                  >
                    {cfg.label}
                  </Tag>
                  <span style={{ fontSize: 11, color: '#666' }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {p.minutes_missing} min missing
                  </span>
                </div>

                {p.dept_name && (
                  <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{p.dept_name}</div>
                )}

                <div style={{ marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {p.last_known_location ? (
                    <span style={{ fontSize: 12, color: '#333' }}>
                      <EnvironmentOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                      Last seen: <strong>{p.last_known_location}</strong>
                      {p.last_seen_at && (
                        <span style={{ color: '#888', marginLeft: 6 }}>
                          @ {new Date(p.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#999' }}>
                      <EnvironmentOutlined style={{ marginRight: 4 }} />
                      Last location unknown
                    </span>
                  )}

                  {p.last_sweep && (
                    <span style={{ fontSize: 12, color: '#333' }}>
                      <AimOutlined style={{ marginRight: 4, color: '#722ed1' }} />
                      Last sweep: <strong>{p.last_sweep.area_searched}</strong>
                      <Tag
                        style={{ marginLeft: 6, fontSize: 10 }}
                        color={p.last_sweep.result === 'NOT_FOUND' ? 'default' : p.last_sweep.result === 'FOUND_SAFE' ? 'success' : 'warning'}
                      >
                        {p.last_sweep.result.replace('_', ' ')}
                      </Tag>
                    </span>
                  )}
                </div>

                {p.sweep_count > 0 && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    {p.sweep_count} sweep{p.sweep_count !== 1 ? 's' : ''} conducted
                  </div>
                )}
              </div>

              {/* Right: actions */}
              <Space direction="vertical" size={4} style={{ flexShrink: 0 }}>
                <Button
                  size="small"
                  icon={<AimOutlined />}
                  onClick={() => { setSweepTarget(p); sweepForm.resetFields(); }}
                >
                  Record Sweep
                </Button>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<CheckCircleOutlined />}
                  onClick={() => onMarkStatus?.(p.emp_code, 1)}
                >
                  Mark Safe
                </Button>
                <Button
                  size="small"
                  danger
                  ghost
                  icon={<WarningOutlined />}
                  onClick={() => onMarkStatus?.(p.emp_code, 2)}
                >
                  Injured
                </Button>
              </Space>
            </div>
          );
        })}
      </div>

      {/* Record Sweep Modal */}
      <Modal
        title={
          <span>
            <AimOutlined style={{ marginRight: 8, color: '#722ed1' }} />
            Record Search Sweep — {sweepTarget?.emp_name}
          </span>
        }
        open={!!sweepTarget}
        onCancel={() => setSweepTarget(null)}
        footer={null}
        width={480}
      >
        <Form form={sweepForm} layout="vertical" onFinish={recordSweep}>
          <Form.Item
            name="area_searched"
            label="Area / Location Searched"
            rules={[{ required: true, message: 'Enter the area searched' }]}
          >
            <Input placeholder="e.g. Deck B, Engine Room, Accommodation Block 2" />
          </Form.Item>

          <Form.Item
            name="result"
            label="Search Result"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select result">
              <Select.Option value="NOT_FOUND">Not Found</Select.Option>
              <Select.Option value="FOUND_SAFE">Found — Safe</Select.Option>
              <Select.Option value="FOUND_INJURED">Found — Injured</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea rows={2} placeholder="Any additional details about the search" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<AimOutlined />}>
              Save Sweep Record
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => setSweepTarget(null)}>
              Cancel
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};


const Mustering = () => {
  // State management
  const [activeTab, setActiveTab] = useState('zones');
  const [zones, setZones] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventLogs, setEventLogs] = useState([]);
  const [headcount, setHeadcount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showStartEventModal, setShowStartEventModal] = useState(false);
  const [showEndEventModal, setShowEndEventModal] = useState(false);
  const [websocket, setWebsocket] = useState(null);

  // Form states
  const [eventForm] = Form.useForm();
  const [zoneForm] = Form.useForm();
  const [endEventForm] = Form.useForm();

  // Event type options
  const eventTypes = [
    { value: 0, label: 'Real Emergency', color: 'red' },
    { value: 1, label: 'Drill', color: 'blue' },
    { value: 2, label: 'Fire', color: 'orange' },
    { value: 3, label: 'Gas', color: 'yellow' },
    { value: 4, label: 'Man Down', color: 'purple' }
  ];

  const zoneTypes = [
    { value: 0, label: 'Assembly Point' },
    { value: 1, label: 'Safe Room' },
    { value: 2, label: 'Hospital' }
  ];

  // Status colors
  const statusColors = {
    0: 'red',    // Missing
    1: 'green',  // Safe
    2: 'orange'  // Injured
  };

  const statusLabels = {
    0: 'Missing',
    1: 'Safe',
    2: 'Injured'
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchZones();
    fetchEvents();
    fetchActiveEvents();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchActiveEvents();
      if (selectedEvent) {
        fetchEventHeadcount(selectedEvent);
        fetchEventLogs(selectedEvent);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedEvent]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (selectedEvent) {
      connectWebSocket(selectedEvent);
    }
    
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [selectedEvent]);

  const connectWebSocket = (eventId) => {
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/mustering/events/${eventId}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected for event', eventId);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'headcount_update') {
          setHeadcount(data.data);
        } else if (data.type === 'status_updated') {
          fetchEventLogs(eventId);
          fetchEventHeadcount(eventId);
        } else if (data.type === 'event_started' || data.type === 'event_ended') {
          fetchActiveEvents();
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };
      
      setWebsocket(ws);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  // API functions
  const fetchZones = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/zones/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setZones(data.data);
      }
    } catch (error) {
      message.error('Failed to fetch zones');
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/events/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setEvents(data.data);
      }
    } catch (error) {
      message.error('Failed to fetch events');
    }
  };

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
      }
    } catch (error) {
      message.error('Failed to fetch active events');
    }
  };

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
      }
    } catch (error) {
      message.error('Failed to fetch headcount');
    }
  };

  const fetchEventLogs = async (eventId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/events/${eventId}/logs/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setEventLogs(data.data.logs);
      }
    } catch (error) {
      message.error('Failed to fetch event logs');
    }
  };

  const startEvent = async (values) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/events/start/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(values)
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Mustering event started successfully');
        setShowStartEventModal(false);
        eventForm.resetFields();
        fetchActiveEvents();
        fetchEvents();
      } else {
        message.error(data.message || 'Failed to start event');
      }
    } catch (error) {
      message.error('Failed to start mustering event');
    } finally {
      setLoading(false);
    }
  };

  const endEvent = async (eventId, reason) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/events/${eventId}/end/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason })
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Mustering event ended successfully');
        setShowEndEventModal(false);
        endEventForm.resetFields();
        setSelectedEvent(null);
        setHeadcount(null);
        setEventLogs([]);
        fetchActiveEvents();
        fetchEvents();
      } else {
        message.error(data.message || 'Failed to end event');
      }
    } catch (error) {
      message.error('Failed to end mustering event');
    } finally {
      setLoading(false);
    }
  };

  const markPersonStatus = async (eventId, empCode, status) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/events/${eventId}/mark/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ emp_code: empCode, status })
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Person status updated successfully');
        fetchEventLogs(eventId);
        fetchEventHeadcount(eventId);
      } else {
        message.error(data.message || 'Failed to update status');
      }
    } catch (error) {
      message.error('Failed to update person status');
    }
  };

  const createZone = async (values) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mustering/zones/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(values)
      });
      
      const data = await response.json();
      if (data.success) {
        message.success('Zone created successfully');
        zoneForm.resetFields();
        fetchZones();
      } else {
        message.error(data.message || 'Failed to create zone');
      }
    } catch (error) {
      message.error('Failed to create zone');
    } finally {
      setLoading(false);
    }
  };

  // Table columns
  const eventColumns = [
    {
      title: 'Event ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Zone',
      dataIndex: 'zone_name',
      key: 'zone_name',
    },
    {
      title: 'Type',
      dataIndex: 'event_type',
      key: 'event_type',
      render: (type) => {
        const eventType = eventTypes.find(t => t.value === type);
        return <Tag color={eventType?.color}>{eventType?.label}</Tag>;
      }
    },
    {
      title: 'Start Time',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (time) => new Date(time).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 0 ? 'green' : status === 1 ? 'blue' : 'red'}>
          {status === 0 ? 'Active' : status === 1 ? 'Completed' : 'Cancelled'}
        </Tag>
      )
    },
    {
      title: 'Expected',
      dataIndex: 'total_expected',
      key: 'total_expected',
    },
    {
      title: 'Safe',
      dataIndex: 'total_safe',
      key: 'total_safe',
    },
    {
      title: 'Missing',
      dataIndex: 'total_missing',
      key: 'total_missing',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 0 && (
            <Button 
              type="primary" 
              size="small"
              onClick={() => {
                setSelectedEvent(record.id);
                fetchEventHeadcount(record.id);
                fetchEventLogs(record.id);
                setActiveTab('live');
              }}
            >
              View Live
            </Button>
          )}
        </Space>
      )
    }
  ];

  const logColumns = [
    {
      title: 'Employee Code',
      dataIndex: 'emp_code',
      key: 'emp_code',
    },
    {
      title: 'Name',
      dataIndex: 'emp_name',
      key: 'emp_name',
    },
    {
      title: 'Department',
      dataIndex: 'dept_name',
      key: 'dept_name',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {statusLabels[status]}
        </Tag>
      )
    },
    {
      title: 'Check Time',
      dataIndex: 'check_time',
      key: 'check_time',
      render: (time) => new Date(time).toLocaleString(),
    },
    {
      title: 'Device',
      dataIndex: 'device_alias',
      key: 'device_alias',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status !== 1 && (
            <Button 
              type="primary" 
              size="small"
              onClick={() => markPersonStatus(selectedEvent, record.emp_code, 1)}
            >
              Mark Safe
            </Button>
          )}
          {record.status !== 2 && (
            <Button 
              danger 
              size="small"
              onClick={() => markPersonStatus(selectedEvent, record.emp_code, 2)}
            >
              Mark Injured
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1>Mustering Management</h1>
      
      {/* Active Events Banner */}
      {activeEvents.length > 0 && (
        <Card 
          style={{ marginBottom: 24, backgroundColor: '#fff2e8', borderColor: '#ffbb96' }}
          title={
            <span>
              <BellOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
              Active Emergency Events
            </span>
          }
        >
          <Row gutter={16}>
            {activeEvents.map(event => (
              <Col span={8} key={event.id}>
                <Card 
                  size="small"
                  title={
                    <span>
                      <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                      {event.zone_name}
                    </span>
                  }
                  extra={
                    <Button 
                      type="primary"
                      size="small"
                      onClick={() => {
                        setSelectedEvent(event.id);
                        fetchEventHeadcount(event.id);
                        fetchEventLogs(event.id);
                        setActiveTab('live');
                      }}
                    >
                      View Details
                    </Button>
                  }
                >
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Type">
                      {eventTypes.find(t => t.value === event.event_type)?.label}
                    </Descriptions.Item>
                    <Descriptions.Item label="Started">
                      {new Date(event.start_time).toLocaleString()}
                    </Descriptions.Item>
                    <Descriptions.Item label="Accounted">
                      {event.headcount?.total_accounted || 0} / {event.total_expected}
                    </Descriptions.Item>
                    <Descriptions.Item label="Progress">
                      <Progress 
                        percent={event.headcount?.completion_percentage || 0} 
                        size="small" 
                        status={event.headcount?.total_missing === 0 ? 'success' : 'active'}
                      />
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'zones',
            label: <span><EnvironmentOutlined />Zones</span>,
            children: (
              <Card
                title="Mustering Zones"
                extra={<Button type="primary" onClick={() => zoneForm.resetFields()}>Add Zone</Button>}
              >
                <Form form={zoneForm} layout="vertical" onFinish={createZone}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="name" label="Zone Name" rules={[{ required: true }]}>
                        <Input placeholder="Enter zone name" />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item name="capacity" label="Capacity">
                        <Input type="number" placeholder="Capacity" />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item name="zone_type" label="Zone Type">
                        <Select placeholder="Select type">
                          {zoneTypes.map(type => (
                            <Option key={type.value} value={type.value}>{type.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="evac_point" label="Evacuation Point">
                        <Input placeholder="Enter evacuation point" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="evac_gps" label="GPS Coordinates">
                        <Input placeholder="lat,lng" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="primary_reader_sn" label="Primary Reader">
                        <Input placeholder="Reader serial number" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="secondary_reader_sn" label="Secondary Reader">
                        <Input placeholder="Reader serial number" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading}>Create Zone</Button>
                  </Form.Item>
                </Form>
                <Table
                  dataSource={zones}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: 'Name', dataIndex: 'name', key: 'name' },
                    { title: 'Capacity', dataIndex: 'capacity', key: 'capacity' },
                    { title: 'Type', dataIndex: 'zone_type', key: 'zone_type', render: (type) => zoneTypes.find(t => t.value === type)?.label },
                    { title: 'Evac Point', dataIndex: 'evac_point', key: 'evac_point' },
                    { title: 'Reader SN', dataIndex: 'reader_sn', key: 'reader_sn', render: (sn) => sn ? <Tag color="blue" style={{ fontFamily: 'monospace' }}>{sn}</Tag> : <span style={{ color: '#ccc' }}>—</span> },
                    {
                      title: (
                        <Tooltip title="Auto check-in activates when a mustering event is running — biometric swipes at this reader mark personnel Safe automatically">
                          Auto Check-in
                        </Tooltip>
                      ),
                      dataIndex: 'mustering_mode',
                      key: 'mustering_mode',
                      render: (mode) => mode
                        ? <Badge status="processing" text={<span style={{ color: '#52c41a', fontWeight: 600 }}>Active</span>} />
                        : <Badge status="default" text="Inactive" />,
                    },
                    { title: 'Current Occupancy', dataIndex: 'current_occupancy', key: 'current_occupancy' },
                  ]}
                />
              </Card>
            )
          },
          {
            key: 'events',
            label: <span><ExclamationCircleOutlined />Events</span>,
            children: (
              <Card
                title="Mustering Events"
                extra={
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setShowStartEventModal(true)}>
                    Start Event
                  </Button>
                }
              >
                <Table dataSource={events} rowKey="id" pagination={{ pageSize: 10 }} columns={eventColumns} />
              </Card>
            )
          },
          {
            key: 'live',
            label: <span><TeamOutlined />Live Headcount</span>,
            children: selectedEvent && headcount ? (
              <div>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}><Card><Statistic title="Total Expected" value={headcount.total_expected} prefix={<UserOutlined />} /></Card></Col>
                  <Col span={6}><Card><Statistic title="Safe" value={headcount.total_safe} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} /></Card></Col>
                  <Col span={6}><Card><Statistic title="Missing" value={headcount.total_missing} valueStyle={{ color: '#cf1322' }} prefix={<CloseCircleOutlined />} /></Card></Col>
                  <Col span={6}><Card><Statistic title="Injured" value={headcount.total_injured} valueStyle={{ color: '#fa8c16' }} prefix={<WarningOutlined />} /></Card></Col>
                </Row>
                <Card style={{ marginBottom: 16 }}>
                  <Progress percent={headcount.completion_percentage} status={headcount.total_missing === 0 ? 'success' : 'active'} strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} />
                  <div style={{ textAlign: 'center', marginTop: 8 }}>{headcount.total_accounted} of {headcount.total_expected} accounted for</div>
                </Card>

                {/* ── Missing persons escalation panel ── */}
                <MissingPersonsPanel
                  eventId={selectedEvent}
                  onMarkStatus={(empCode, status) => {
                    markPersonStatus(selectedEvent, empCode, status);
                  }}
                />

                <Card
                  title="All Personnel"
                  extra={<Button danger icon={<StopOutlined />} onClick={() => setShowEndEventModal(true)}>End Event</Button>}
                >
                  <Table
                    dataSource={eventLogs}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    columns={logColumns}
                    rowClassName={(record) => {
                      if (record.status === 0) return 'row-missing';
                      if (record.status === 1) return 'row-safe';
                      if (record.status === 2) return 'row-injured';
                      return '';
                    }}
                  />
                </Card>
              </div>
            ) : (
              <Card>
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <UserOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                  <p>Select an event to view live headcount</p>
                  <Button type="primary" onClick={() => setActiveTab('events')}>View Events</Button>
                </div>
              </Card>
            )
          },
          {
            key: 'drills',
            label: <span><CalendarOutlined />Drill Planning</span>,
            children: (
              <Card title="Drill Planning">
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <CalendarOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                  <p>Drill scheduling and templates coming soon</p>
                </div>
              </Card>
            )
          },
          {
            key: 'compliance',
            label: <span><FileTextOutlined />Compliance</span>,
            children: (
              <Card title="Compliance Dashboard">
                <Row gutter={16}>
                  <Col span={8}><Card><Statistic title="Avg Muster Time" value={4.2} suffix="minutes" prefix={<ClockCircleOutlined />} /></Card></Col>
                  <Col span={8}><Card><Statistic title="% Accounted < 10min" value={92.5} suffix="%" prefix={<SafetyOutlined />} /></Card></Col>
                  <Col span={8}><Card><Statistic title="Drills This Month" value={3} prefix={<CalendarOutlined />} /></Card></Col>
                </Row>
              </Card>
            )
          },
          {
            key: 'reports',
            label: <span><FileTextOutlined />Reports</span>,
            children: (
              <Card title="Mustering Reports">
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <FileTextOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                  <p>Event reports and analytics coming soon</p>
                </div>
              </Card>
            )
          },
        ]}
      />

      {/* Start Event Modal */}
      <Modal
        title="Start Mustering Event"
        open={showStartEventModal}
        onCancel={() => setShowStartEventModal(false)}
        footer={null}
        width={600}
      >
        <Form form={eventForm} layout="vertical" onFinish={startEvent}>
          <Form.Item name="zone_id" label="Zone" rules={[{ required: true }]}>
            <Select placeholder="Select mustering zone">
              {zones.map(zone => (
                <Option key={zone.id} value={zone.id}>{zone.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="event_type" label="Event Type" rules={[{ required: true }]}>
            <Select placeholder="Select event type">
              {eventTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  <Tag color={type.color}>{type.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Enter event notes (optional)" />
          </Form.Item>
          
          <Form.Item>
            <span style={{ marginRight: 16 }}>Notifications:</span>
            <Form.Item name="notify_sms" valuePropName="checked" style={{ display: 'inline-block', marginRight: 16 }}>
              SMS
            </Form.Item>
            <Form.Item name="notify_email" valuePropName="checked" style={{ display: 'inline-block', marginRight: 16 }}>
              Email
            </Form.Item>
            <Form.Item name="notify_whatsapp" valuePropName="checked" style={{ display: 'inline-block', marginRight: 16 }}>
              WhatsApp
            </Form.Item>
            <Form.Item name="notify_siren" valuePropName="checked" style={{ display: 'inline-block' }}>
              Siren
            </Form.Item>
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} danger>
              Start Mustering Event
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => setShowStartEventModal(false)}>
              Cancel
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* End Event Modal */}
      <Modal
        title="End Mustering Event"
        open={showEndEventModal}
        onCancel={() => setShowEndEventModal(false)}
        footer={null}
      >
        <Form form={endEventForm} layout="vertical" onFinish={(values) => endEvent(selectedEvent, values.reason)}>
          <Form.Item name="reason" label="Reason (optional)">
            <TextArea rows={3} placeholder="Enter reason for ending event" />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              End Event
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => setShowEndEventModal(false)}>
              Cancel
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <style jsx>{`
        .row-missing {
          background-color: #fff1f0;
        }
        .row-safe {
          background-color: #f6ffed;
        }
        .row-injured {
          background-color: #fffbe6;
        }
      `}</style>
    </div>
  );
};

export default Mustering;
