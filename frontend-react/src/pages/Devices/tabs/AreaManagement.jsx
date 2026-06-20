import React, { useState, useEffect, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, App,
  Popconfirm, Tooltip, Card, Row, Col, Badge, Drawer,
  Statistic, Descriptions, Typography,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, BankOutlined,
  EyeOutlined, ReloadOutlined, DesktopOutlined, WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { deviceAPI } from '../../../services/deviceAPI';
import apiService from '../../../services/api';

const { Text } = Typography;
const { Option } = Form.Item;  // unused but kept to avoid unused-import lint

const AREAS_URL  = '/api/v1/biotime/personnel/api/areas/';

const READER_PURPOSE_LABEL = {
  ATTENDANCE:   { label: 'T&A Reader',   color: 'blue'  },
  ACCESS_ENTRY: { label: 'Entry Reader', color: 'green' },
  ACCESS_EXIT:  { label: 'Exit Reader',  color: 'red'   },
};

const AreaManagement = () => {
  const { message, modal } = App.useApp();
  const [areas,   setAreas]   = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingArea,  setEditingArea]  = useState(null);
  const [drawerArea,   setDrawerArea]   = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAreas();
    fetchDevices();
  }, []);

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const res = await apiService.get(AREAS_URL);
      setAreas(Array.isArray(res) ? res : []);
    } catch {
      message.error('Failed to fetch areas');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await deviceAPI.getTerminals({ limit: 500 });
      setDevices(Array.isArray(res) ? res : (res?.data || []));
    } catch {
      /* non-critical */
    }
  };

  // ── per-area derived data ────────────────────────────────────────────────
  const devicesByArea = useMemo(() => {
    const map = {};
    devices.forEach(d => {
      if (d.area_id) {
        if (!map[d.area_id]) map[d.area_id] = [];
        map[d.area_id].push(d);
      }
    });
    return map;
  }, [devices]);

  const taDevicesByArea = useMemo(() => {
    const map = {};
    devices.forEach(d => {
      if (d.area_id && (!d.reader_purpose || d.reader_purpose === 'ATTENDANCE')) {
        if (!map[d.area_id]) map[d.area_id] = [];
        map[d.area_id].push(d);
      }
    });
    return map;
  }, [devices]);

  const stats = useMemo(() => ({
    totalAreas:     areas.length,
    totalDevices:   devices.length,
    onlineDevices:  devices.filter(d => d.status === 'online').length,
    assignedDevices: devices.filter(d => d.area_id).length,
  }), [areas, devices]);

  // ── handlers ─────────────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingArea(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (area) => {
    setEditingArea(area);
    form.setFieldsValue({ area_code: area.area_code, area_name: area.area_name });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      if (editingArea) {
        await apiService.put(`${AREAS_URL}${editingArea.id}`, values);
        message.success('Area updated');
      } else {
        await apiService.post(AREAS_URL, values);
        message.success('Area created');
      }
      setModalVisible(false);
      fetchAreas();
    } catch (e) {
      message.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (area) => {
    try {
      await apiService.delete(`${AREAS_URL}${area.id}`);
      message.success(`Area "${area.area_name}" deleted`);
      fetchAreas();
    } catch (e) {
      message.error(e.message || 'Delete failed');
    }
  };

  const formatTime = (dt) => dt ? new Date(dt).toLocaleString() : '—';

  // ── columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Area Name',
      key: 'area_name',
      render: (_, r) => (
        <div>
          <strong>{r.area_name}</strong>
          {r.area_code && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Code: {r.area_code}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'T&A Readers',
      key: 'ta_readers',
      width: 130,
      render: (_, r) => {
        const devs = taDevicesByArea[r.id] || [];
        const online = devs.filter(d => d.status === 'online').length;
        return (
          <div>
            <Space size={4}>
              <DesktopOutlined style={{ color: '#1890ff' }} />
              <strong>{devs.length}</strong>
            </Space>
            {devs.length > 0 && (
              <div style={{ fontSize: 11, color: online > 0 ? '#52c41a' : '#ff4d4f' }}>
                {online} online
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'All Devices',
      key: 'all_devices',
      width: 120,
      render: (_, r) => {
        const all = devicesByArea[r.id] || [];
        return all.length ? (
          <Tag color="default">{all.length} device{all.length !== 1 ? 's' : ''}</Tag>
        ) : <Text type="secondary">None</Text>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: formatTime,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, r) => {
        const devCount = (devicesByArea[r.id] || []).length;
        return (
          <Space size="small">
            <Tooltip title="View details">
              <Button icon={<EyeOutlined />} size="small" onClick={() => setDrawerArea(r)} />
            </Tooltip>
            <Tooltip title="Edit">
              <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(r)} />
            </Tooltip>
            <Popconfirm
              title="Delete this area?"
              description={devCount > 0
                ? `${devCount} device(s) assigned — reassign them first.`
                : 'This cannot be undone.'}
              onConfirm={() => handleDelete(r)}
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              disabled={devCount > 0}
            >
              <Tooltip title={devCount > 0 ? 'Reassign devices first' : 'Delete'}>
                <Button icon={<DeleteOutlined />} size="small" danger disabled={devCount > 0} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const deviceColumns = [
    {
      title: 'Device',
      key: 'device',
      render: (_, d) => (
        <div>
          <strong>{d.alias}</strong>
          <div style={{ fontSize: 11, color: '#666' }}>{d.sn}</div>
        </div>
      ),
    },
    {
      title: 'Purpose',
      dataIndex: 'reader_purpose',
      key: 'reader_purpose',
      width: 130,
      render: (p) => {
        const info = READER_PURPOSE_LABEL[p] || READER_PURPOSE_LABEL.ATTENDANCE;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s) => (
        <Badge
          status={s === 'online' ? 'success' : 'error'}
          text={<span style={{ fontSize: 12 }}>{s === 'online' ? 'Online' : 'Offline'}</span>}
        />
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip',
      width: 130,
      render: (ip) => ip ? <Text code style={{ fontSize: 12 }}>{ip}</Text> : '—',
    },
  ];

  const drawerDevices = drawerArea ? (devicesByArea[drawerArea.id] || []) : [];
  const drawerOnline  = drawerDevices.filter(d => d.status === 'online').length;
  const drawerTA      = drawerDevices.filter(d => !d.reader_purpose || d.reader_purpose === 'ATTENDANCE').length;

  return (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { title: 'Total Areas',       value: stats.totalAreas,      icon: <BankOutlined />,       color: '#1890ff' },
          { title: 'T&A Readers',       value: stats.assignedDevices,  icon: <DesktopOutlined />,    color: '#722ed1' },
          { title: 'Online Devices',    value: stats.onlineDevices,    icon: <WifiOutlined />,       color: '#52c41a' },
          { title: 'Offline Devices',   value: stats.totalDevices - stats.onlineDevices, icon: <DisconnectOutlined />, color: '#ff4d4f' },
        ].map(s => (
          <Col key={s.title} xs={12} sm={6}>
            <Card>
              <Statistic title={s.title} value={s.value} valueStyle={{ color: s.color }}
                prefix={React.cloneElement(s.icon, { style: { color: s.color } })} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Toolbar */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <BankOutlined style={{ fontSize: 18 }} />
              <strong style={{ fontSize: 16 }}>T&amp;A Areas</strong>
              <Text type="secondary" style={{ fontSize: 13 }}>
                — Assign T&amp;A readers to areas to track attendance by location
              </Text>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => { fetchAreas(); fetchDevices(); }} loading={loading}>
                Refresh
              </Button>
              <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>
                New Area
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={areas}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 20, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} areas` }}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editingArea ? 'Edit Area' : 'New Area'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        confirmLoading={saving}
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="area_name"
            label="Area Name"
            rules={[{ required: true, message: 'Enter area name' }]}
          >
            <Input placeholder="e.g. Platform Alpha, Onshore Base, Helipad" />
          </Form.Item>
          <Form.Item
            name="area_code"
            label="Area Code"
            extra="Optional short code (e.g. PLT-A, ONS-1)"
          >
            <Input placeholder="e.g. PLT-A" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Area Details Drawer */}
      <Drawer
        title={
          <Space>
            <BankOutlined />
            {drawerArea?.area_name}
            {drawerArea?.area_code && <Tag>{drawerArea.area_code}</Tag>}
          </Space>
        }
        placement="right"
        width={700}
        open={!!drawerArea}
        onClose={() => setDrawerArea(null)}
      >
        {drawerArea && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Area Name">{drawerArea.area_name}</Descriptions.Item>
              <Descriptions.Item label="Code">{drawerArea.area_code || '—'}</Descriptions.Item>
              <Descriptions.Item label="Created">{formatTime(drawerArea.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Updated">{formatTime(drawerArea.updated_at)}</Descriptions.Item>
            </Descriptions>

            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="Total Devices" value={drawerDevices.length} valueStyle={{ color: '#1890ff' }} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="Online" value={drawerOnline} valueStyle={{ color: '#52c41a' }} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="T&A Readers" value={drawerTA} valueStyle={{ color: '#722ed1' }} />
                </Card>
              </Col>
            </Row>

            <h4 style={{ margin: '0 0 8px' }}>Assigned Devices ({drawerDevices.length})</h4>
            {drawerDevices.length === 0 ? (
              <Card size="small">
                <Text type="secondary">
                  No devices assigned to this area yet. Go to{' '}
                  <strong>Device List</strong>, edit a device, set{' '}
                  <strong>Reader Purpose = T&A Reader</strong>, and select this area.
                </Text>
              </Card>
            ) : (
              <Table
                columns={deviceColumns}
                dataSource={drawerDevices}
                rowKey="sn"
                size="small"
                pagination={false}
              />
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default AreaManagement;
