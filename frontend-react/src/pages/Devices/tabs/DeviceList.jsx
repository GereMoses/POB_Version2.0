import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  App,
  Popconfirm,
  Tooltip,
  Badge,
  Drawer,
  Card,
  Row,
  Col,
  Upload,
  Switch,
  Statistic,
  Alert,
  Typography,
  Divider,
  Progress,
  Skeleton,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  SearchOutlined,
  FilterOutlined,
  ExportOutlined,
  ImportOutlined,
  EyeOutlined,
  DesktopOutlined,
  AppstoreOutlined,
  RadarChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { deviceAPI } from '../../../services/deviceAPI';
import apiService from '../../../services/api';

const { Option } = Select;
const { Search } = Input;
const { Title, Text } = Typography;

// ─── Pure helpers (module scope — safe to call before component renders) ──────

const CONNECTION_MODE_META = {
  adms:   { label: 'ADMS',   color: 'purple', description: 'Device pushes to server' },
  direct: { label: 'Direct', color: 'blue',   description: 'Server polls via ZKLib' },
  both:   { label: 'Both',   color: 'cyan',   description: 'ADMS + ZKLib polling' },
};

const READER_PURPOSE_META = {
  ATTENDANCE:   { label: 'T&A',         color: 'blue',   deviceType: 0 },
  ACCESS_ENTRY: { label: 'Entry',        color: 'green',  deviceType: 1 },
  ACCESS_EXIT:  { label: 'Exit',         color: 'cyan',   deviceType: 1 },
  MUSTERING:    { label: 'Mustering',    color: 'orange', deviceType: 2 },
  POB:          { label: 'POB',          color: 'purple', deviceType: 1 },
  EMERGENCY:    { label: 'Emergency',    color: 'red',    deviceType: 3 },
};

const getReaderPurposeName  = (p) => (READER_PURPOSE_META[p] || READER_PURPOSE_META.ATTENDANCE).label;
const getReaderPurposeColor = (p) => (READER_PURPOSE_META[p] || READER_PURPOSE_META.ATTENDANCE).color;
const purposeToDeviceType   = (p) => (READER_PURPOSE_META[p] || READER_PURPOSE_META.ATTENDANCE).deviceType;

// kept for legacy read-only display (device_type integer still stored in DB)
const getDeviceTypeName = (deviceType) => {
  const types = { 0: 'Attendance', 1: 'Access Control', 2: 'Mustering', 3: 'Emergency' };
  return types[deviceType] || 'Unknown';
};

const getDeviceTypeColor = (deviceType) => {
  const colors = { 0: 'blue', 1: 'green', 2: 'orange', 3: 'red' };
  return colors[deviceType] || 'default';
};

const getStatusColor = (status) => {
  switch (status) {
    case 'online': return 'success';
    case 'offline': return 'error';
    default: return 'default';
  }
};

const getActivityColor = (lastActivity) => {
  if (!lastActivity) return 'default';
  const diffMinutes = (Date.now() - new Date(lastActivity)) / 60000;
  if (diffMinutes < 5) return 'green';
  if (diffMinutes < 30) return 'orange';
  return 'red';
};

const getRelativeTime = (lastActivity) => {
  if (!lastActivity) return 'Never';
  const diffMinutes = (Date.now() - new Date(lastActivity)) / 60000;
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${Math.floor(diffMinutes)}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return `${Math.floor(diffMinutes / 1440)}d ago`;
};

const formatDateTime = (dt) => dt ? new Date(dt).toLocaleString() : '—';

const getSignalColor = (s) => {
  if (!s) return '#ff4d4f';
  if (s >= 80) return '#52c41a';
  if (s >= 60) return '#faad14';
  return '#ff4d4f';
};

const DeviceList = ({ onDeviceSelect, refreshTrigger }) => {
  const { message, modal } = App.useApp();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    area_id: null,
    device_type: null,
    status: null
  });
  const [areas, setAreas] = useState([]);
  const [zones, setZones] = useState([]);
  const [form] = Form.useForm();
  const readerPurpose = Form.useWatch('reader_purpose', form);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    byType: {},
    byArea: {}
  });
  const [connectionTestLoading, setConnectionTestLoading] = useState({});
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // ── View-details drawer state ─────────────────────────────────────────────
  const [viewDevice, setViewDevice] = useState(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  // ── Time sync state ───────────────────────────────────────────────────────
  const [timeSyncLoading, setTimeSyncLoading] = useState({});  // keyed by sn
  const [deviceTimes, setDeviceTimes] = useState({});          // { sn: { device_time, server_time } }
  const [driftMap, setDriftMap] = useState({});                // { sn: { drift_seconds, drift_status, ... } }

  // ── Discover-by-IP state ──────────────────────────────────────────────────
  const [discoverVisible, setDiscoverVisible] = useState(false);
  const [discoverIp, setDiscoverIp] = useState('');
  const [discoverPort, setDiscoverPort] = useState(4370);
  const [discoverCommKey, setDiscoverCommKey] = useState(0);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverResult, setDiscoverResult] = useState(null); // null | probe response
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerForm] = Form.useForm();

  // Calculate statistics when devices change
  const deviceStats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter(d => d.status?.toLowerCase() === 'online').length;
    const offline = total - online;
    
    const byType = devices.reduce((acc, device) => {
      const type = getDeviceTypeName(device.device_type);
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    const byArea = devices.reduce((acc, device) => {
      const area = areas.find(a => a.id === device.area_id);
      const areaName = area ? area.name : 'Unassigned';
      acc[areaName] = (acc[areaName] || 0) + 1;
      return acc;
    }, {});
    
    return { total, online, offline, byType, byArea };
  }, [devices, areas]);

  // Update stats when devices change
  useEffect(() => {
    setStats(deviceStats);
  }, [deviceStats]);

  const fetchDrift = async () => {
    try {
      const res = await apiService.get('/iclock/terminals/time-drift');
      const list = Array.isArray(res?.data) ? res.data : [];
      const map = {};
      list.forEach(d => { map[d.sn] = d; });
      setDriftMap(map);
    } catch { /* drift is informational — don't surface errors */ }
  };

  // Fetch devices when component mounts or filters change
  useEffect(() => {
    fetchDevices();
    fetchAreas();
    fetchZones();
    fetchDrift();
  }, [refreshTrigger, filters]);

  // Auto-refresh device status every 5 seconds (silent — no loading spinner)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchDevices(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [filters]);

  const fetchDevices = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = {
        page: 1,
        limit: 100,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === null || params[key] === '') {
          delete params[key];
        }
      });

      const response = await deviceAPI.getTerminals(params);
      setDevices(response || []);
    } catch (error) {
      if (!silent) message.error('Failed to fetch devices');
      console.error('Error fetching devices:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchAreas = async () => {
    try {
      const response = await apiService.get('/api/device/areas/');
      setAreas(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching areas:', error);
    }
  };

  const fetchZones = async () => {
    try {
      const response = await apiService.get('/api/v1/zones/', { limit: 200 });
      setZones(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching zones:', error);
    }
  };

  // ── Discover-by-IP handlers ───────────────────────────────────────────────
  const handleDiscover = async () => {
    if (!discoverIp) { message.warning('Enter an IP address'); return; }
    setDiscoverLoading(true);
    setDiscoverResult(null);
    try {
      const result = await deviceAPI.zkQuickPing({
        ip_address: discoverIp,
        port: discoverPort,
        device_password: discoverCommKey,
      });
      setDiscoverResult(result);
      if (result.connected) {
        registerForm.setFieldsValue({
          name: result.device_name || `ZKTeco ${discoverIp}`,
          ip_address: discoverIp,
          port: discoverPort,
          device_password: discoverCommKey,
          connection_mode: 'direct',
          auto_poll: true,
          poll_interval_sec: 300,
        });
      }
    } catch (e) {
      setDiscoverResult({ connected: false, error: e.message });
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleRegisterDirect = async () => {
    try {
      const values = await registerForm.validateFields();
      setRegisterLoading(true);
      await deviceAPI.zkRegisterDevice(values);
      message.success(`${values.name} registered successfully`);
      setDiscoverVisible(false);
      setDiscoverResult(null);
      setDiscoverIp('');
      registerForm.resetFields();
      fetchDevices();
    } catch (e) {
      if (!e.errorFields) message.error(e.message || 'Registration failed');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleAddDevice = () => {
    setEditingDevice(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditDevice = (device) => {
    setEditingDevice(device);
    form.setFieldsValue({
      sn: device.sn,
      alias: device.alias,
      ip_address: device.ip_address,
      area_id: device.area_id,
      device_type: device.device_type,
      zone_id: device.zone_id,
      reader_purpose: device.reader_purpose || 'ATTENDANCE',
      device_name: device.device_name,
      device_model: device.device_model,
      comm_key: device.comm_key,
      connection_mode: device.connection_mode || 'adms',
    });
    setModalVisible(true);
  };

  const handleDeleteDevice = async (deviceId, force = false) => {
    try {
      await deviceAPI.deleteTerminal(deviceId, force);
      message.success('Device deleted successfully');
      fetchDevices();
    } catch (error) {
      // 409 = has transactions → ask user if they want to force-delete
      if (error.message && error.message.includes('transactions')) {
        modal.confirm({
          title: 'Device has attendance records',
          content: `${error.message} All attendance history for this device will be permanently removed.`,
          okText: 'Force Delete',
          okType: 'danger',
          cancelText: 'Cancel',
          onOk: () => handleDeleteDevice(deviceId, true),
        });
      } else {
        message.error(error.message || 'Failed to delete device');
        console.error('Error deleting device:', error);
      }
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      // Auto-derive device_type from reader_purpose; clear inapplicable location field
      values.device_type = purposeToDeviceType(values.reader_purpose);
      if (values.reader_purpose === 'ATTENDANCE') {
        delete values.zone_id;
      } else {
        delete values.area_id;
      }

      // Coerce integer fields that come back as strings from Input fields
      if (values.zone_id !== undefined && values.zone_id !== null && values.zone_id !== '') {
        values.zone_id = parseInt(values.zone_id, 10);
      } else {
        delete values.zone_id;
      }
      if (values.port !== undefined && values.port !== null && values.port !== '') {
        values.port = parseInt(values.port, 10);
      }

      if (editingDevice) {
        // Update existing device
        await deviceAPI.updateTerminal(editingDevice.id, values);
        message.success('Device updated successfully');
      } else {
        // Create new device
        await deviceAPI.createTerminal(values);
        message.success('Device created successfully');
      }
      
      setModalVisible(false);
      fetchDevices();
    } catch (error) {
      if (error.errorFields) {
        // Validation error
        return;
      }
      message.error(`Failed to ${editingDevice ? 'update' : 'create'} device`);
      console.error('Error saving device:', error);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select devices first');
      return;
    }

    try {
      setLoading(true);
      
      switch (action) {
        case 'delete':
          await Promise.all(
            selectedRowKeys.map(id => deviceAPI.deleteTerminal(id, true))
          );
          message.success(`Deleted ${selectedRowKeys.length} devices`);
          break;
        case 'reboot':
          await Promise.all(
            selectedRowKeys.map(sn => deviceAPI.sendCommand({ sn, cmd: 'REBOOT' }))
          );
          message.success(`Reboot command sent to ${selectedRowKeys.length} devices`);
          break;
        case 'syncTime':
          await Promise.all(
            selectedRowKeys.map(sn => deviceAPI.admsSyncTime(sn))
          );
          message.info(`Time sync queued for ${selectedRowKeys.length} device(s) — will apply on next heartbeat`);
          break;
        case 'clearAdmin':
          await Promise.all(
            selectedRowKeys.map(sn => deviceAPI.sendCommand({ sn, cmd: 'CLEAR ADMIN' }))
          );
          message.success(`Clear admin command sent to ${selectedRowKeys.length} devices`);
          break;
        case 'clearData':
          await Promise.all(
            selectedRowKeys.map(sn => deviceAPI.sendCommand({ sn, cmd: 'CLEAR DATA' }))
          );
          message.success(`Clear data command sent to ${selectedRowKeys.length} devices`);
          break;
        default:
          break;
      }
      
      setSelectedRowKeys([]);
      fetchDevices();
    } catch (error) {
      message.error(`Failed to perform ${action} action`);
      console.error('Error performing bulk action:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeBulkAction = (action) => handleBulkAction(action);

  const testDeviceConnection = async (sn) => {
    setConnectionTestLoading(p => ({ ...p, [sn]: true }));
    try {
      await deviceAPI.sendCommand({ sn, cmd: 'CHECK' });
      message.success(`Connection test sent to ${sn}`);
    } catch (err) {
      message.error(`Connection test failed: ${err.message}`);
    } finally {
      setConnectionTestLoading(p => ({ ...p, [sn]: false }));
    }
  };


  const fetchDeviceTime = async (sn, ip, port = 4370) => {
    setTimeSyncLoading(p => ({ ...p, [sn]: 'reading' }));
    try {
      const result = await deviceAPI.zkQuickGetTime({ ip_address: ip, port });
      setDeviceTimes(p => ({ ...p, [sn]: result }));
    } catch (e) {
      message.error(`Could not read time from ${sn}: ${e.message}`);
    } finally {
      setTimeSyncLoading(p => ({ ...p, [sn]: false }));
    }
  };

  const handleSyncTime = async (sn, ip, port = 4370, connectionMode) => {
    setTimeSyncLoading(p => ({ ...p, [sn]: 'syncing' }));
    const isAdms = !connectionMode || connectionMode === 'adms' || (!ip && connectionMode !== 'direct');
    try {
      if (isAdms) {
        // ADMS push devices: queue DATE TIME command via the ADMS endpoint (no IP needed)
        await deviceAPI.admsSyncTime(sn);
        message.info(`Time sync queued for ${sn} — the device will apply it on its next heartbeat (~10–30 s). The options block also auto-syncs the clock on every heartbeat.`);
      } else {
        const result = await deviceAPI.zkQuickSyncTime({ ip_address: ip, port });
        if (result.method === 'adms_queued') {
          message.info(`Time sync queued for ${sn} — device will apply on next heartbeat (~10–30 s)`);
        } else {
          message.success(`Clock synced on ${sn} — device reports: ${result.device_reports}`);
        }
        setDeviceTimes(p => ({
          ...p,
          [sn]: { device_time: result.device_reports, server_time: result.set_to },
        }));
      }
    } catch (e) {
      message.error(`Time sync failed for ${sn}: ${e.message}`);
    } finally {
      setTimeSyncLoading(p => ({ ...p, [sn]: false }));
    }
  };

  const handleImportCSV = async () => {
    if (fileList.length === 0) {
      message.warning('Please select a CSV file');
      return;
    }

    try {
      const file = fileList[0].originFileObj;
      const text = await file.text();
      const lines = text.split('\n');
      
      // Skip header if exists
      const startIndex = lines[0].toLowerCase().includes('sn') ? 1 : 0;
      const devices = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [sn, alias, ip, area, commKey] = line.split(',').map(item => item.trim());
        
        if (sn) {
          devices.push({
            sn: sn.replace(/"/g, ''),
            alias: alias?.replace(/"/g, '') || `Terminal ${sn}`,
            ip_address: ip?.replace(/"/g, ''),
            area_id: area ? parseInt(area) : null,
            comm_key: commKey?.replace(/"/g, '') || '0'
          });
        }
      }
      
      const response = await deviceAPI.batchImport({ devices });
      
      if (response.imported > 0) {
        message.success(`Successfully imported ${response.imported} devices`);
        if (response.skipped > 0) {
          message.warning(`${response.skipped} devices were skipped`);
        }
      } else {
        message.error('No devices were imported');
      }
      
      setImportModalVisible(false);
      setFileList([]);
      fetchDevices();
    } catch (error) {
      message.error('Failed to import devices');
      console.error('Error importing devices:', error);
    }
  };

  const getStatusIcon = (status) =>
    status?.toLowerCase() === 'online' ? <WifiOutlined /> : <DisconnectOutlined />;

  const handleViewDetails = (device) => {
    setViewDevice(device);
    setDetailDrawerOpen(true);
    if (onDeviceSelect) onDeviceSelect(device);
  };

  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => (
        <Badge 
          status={getStatusColor(status)}
          text={status?.toUpperCase()} 
          icon={getStatusIcon(status)}
        />
      ),
      filters: [
        { text: 'Online', value: 'online' },
        { text: 'Offline', value: 'offline' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: 'Device',
      dataIndex: 'sn',
      key: 'sn',
      width: 120,
      render: (sn, record) => (
        <div>
          <div><strong>{sn}</strong></div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.alias}</div>
          {record.connection_test_loading && (
            <Spin size="small" />
          )}
        </div>
      )
    },
    {
      title: 'Purpose',
      dataIndex: 'reader_purpose',
      key: 'reader_purpose',
      width: 110,
      render: (purpose, record) => (
        <Tag color={getReaderPurposeColor(purpose)}>
          {getReaderPurposeName(purpose)}
          {record.device_model && (
            <div style={{ fontSize: '10px', color: '#999' }}>
              {record.device_model}
            </div>
          )}
        </Tag>
      ),
      filters: Object.entries(READER_PURPOSE_META).map(([v, m]) => ({ text: m.label, value: v })),
      onFilter: (value, record) => record.reader_purpose === value,
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140,
      render: (ip) => ip
        ? <Text code style={{ fontSize: '12px' }}>{ip}</Text>
        : <Text type="secondary" style={{ fontSize: '12px' }}>—</Text>,
    },
    {
      title: 'Connection',
      dataIndex: 'connection_mode',
      key: 'connection_mode',
      width: 100,
      render: (mode) => {
        const m = CONNECTION_MODE_META[mode] || CONNECTION_MODE_META.adms;
        return (
          <Tooltip title={m.description}>
            <Tag color={m.color}>{m.label}</Tag>
          </Tooltip>
        );
      },
      filters: Object.entries(CONNECTION_MODE_META).map(([v, m]) => ({ text: m.label, value: v })),
      onFilter: (value, record) => (record.connection_mode || 'adms') === value,
    },
    {
      title: 'Purpose / Location',
      key: 'reader_purpose_loc',
      width: 160,
      render: (_, record) => {
        const area = areas.find(a => a.id === record.area_id);
        const zone = zones.find(z => z.id === record.zone_id);
        const location = area?.name || zone?.name;
        return (
          <div>
            <Tag color={getReaderPurposeColor(record.reader_purpose)}>
              {getReaderPurposeName(record.reader_purpose)}
            </Tag>
            {location && <div style={{ fontSize: '11px', color: '#666', marginTop: 2 }}>{location}</div>}
          </div>
        );
      }
    },
    {
      title: 'Users',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 80,
      render: (count, record) => (
        <div>
          {count || 0}
          <div style={{ fontSize: '10px', color: '#666' }}>users</div>
        </div>
      )
    },
    {
      title: 'Biometrics',
      key: 'biometrics',
      width: 120,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#666' }}>{record.fp_count || 0} FP</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{record.face_count || 0} Face</div>
          </div>
        </div>
      )
    },
    {
      title: 'Last Active',
      dataIndex: 'last_activity',
      key: 'last_activity',
      width: 150,
      render: (date) => (
        <div>
          {formatDateTime(date)}
          {date && (
            <Tag color={getActivityColor(date)}>
              {getRelativeTime(date)}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'Sync Status',
      key: 'health_status',
      width: 160,
      render: (_, record) => {
        const statusLower = (record.status || '').toLowerCase();
        const isOnline = statusLower === 'online';
        const lastAct = record.last_activity ? new Date(record.last_activity) : null;
        const diffSec = lastAct ? (Date.now() - lastAct) / 1000 : null;
        const diffMin = diffSec != null ? diffSec / 60 : null;

        let badgeStatus, label, detail, detailColor;

        if (!isOnline) {
          badgeStatus = 'error';
          label = 'Offline';
          if (lastAct) {
            const ago = diffMin < 60
              ? `${Math.round(diffMin)}m ago`
              : diffMin < 1440
                ? `${Math.round(diffMin / 60)}h ago`
                : `${Math.round(diffMin / 1440)}d ago`;
            detail = `Last seen ${ago}`;
            detailColor = '#ef4444';
          } else {
            detail = 'Never connected';
            detailColor = '#94a3b8';
          }
        } else if (!lastAct) {
          badgeStatus = 'warning';
          label = 'Online';
          detail = 'No sync yet';
          detailColor = '#f59e0b';
        } else if (diffMin < 2) {
          badgeStatus = 'success';
          label = 'Syncing';
          detail = `${Math.round(diffSec)}s ago`;
          detailColor = '#22c55e';
        } else if (diffMin < 5) {
          badgeStatus = 'warning';
          label = 'Slow';
          detail = `${Math.round(diffMin)}m since last sync`;
          detailColor = '#f59e0b';
        } else {
          badgeStatus = 'error';
          label = 'Sync stalled';
          detail = `No sync for ${Math.round(diffMin)}m`;
          detailColor = '#ef4444';
        }

        return (
          <div>
            <Badge status={badgeStatus} text={<span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>} />
            {detail && (
              <div style={{ fontSize: 10, color: detailColor, marginTop: 1, marginLeft: 14 }}>
                {detail}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Time Drift',
      key: 'time_drift',
      width: 100,
      render: (_, record) => {
        const d = driftMap[record.sn];
        if (!d) return <span style={{ fontSize: 11, color: '#bbb' }}>—</span>;
        const driftAbs = Math.abs(d.drift_seconds ?? 0);
        const tagColor = d.drift_status === 'ok' ? 'success' : d.drift_status === 'warning' ? 'warning' : 'error';
        return (
          <Tooltip title={`${driftAbs}s drift vs server clock`}>
            <Tag color={tagColor} style={{ fontSize: 10, lineHeight: '18px', cursor: 'default' }}>
              {d.drift_status === 'ok' ? `✓ ${driftAbs}s` : `${driftAbs}s`}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Signal',
      dataIndex: 'signal_strength',
      key: 'signal_strength',
      width: 90,
      render: (signalStrength) => {
        if (signalStrength == null) {
          return <span style={{ fontSize: '11px', color: '#999' }}>N/A</span>;
        }
        return (
          <div>
            <div style={{
              width: '100%', height: '8px',
              backgroundColor: getSignalColor(signalStrength),
              borderRadius: '4px'
            }} />
            <div style={{ fontSize: '10px', color: '#666', marginTop: 2 }}>
              {signalStrength}%
            </div>
          </div>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => handleEditDevice(record)}
            />
          </Tooltip>
          
          <Tooltip title="Test Connection">
            <Button 
              icon={<WifiOutlined />} 
              size="small"
              loading={connectionTestLoading[record.sn]}
              onClick={() => testDeviceConnection(record.sn)}
            />
          </Tooltip>
          
          {record.device_type === 3 && (
            <Tooltip title="Emergency Toggle">
              <Button 
                icon={<ThunderboltOutlined />} 
                size="small"
                danger
                onClick={() => deviceAPI.emergencyCommand(record.sn, 'ON')}
              />
            </Tooltip>
          )}
          
          <Tooltip title="Sync Device Clock">
            <Button
              icon={<ClockCircleOutlined />}
              size="small"
              loading={!!timeSyncLoading[record.sn]}
              onClick={() => handleSyncTime(record.sn, record.ip_address, record.port || 4370, record.connection_mode)}
            />
          </Tooltip>

          <Tooltip title="View Details">
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Are you sure you want to delete this device?"
            onConfirm={() => handleDeleteDevice(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button 
                icon={<DeleteOutlined />} 
                size="small"
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record) => ({
      disabled: false,
      name: record.sn
    })
  };

  return (
    <div className="device-list">
      {/* Enhanced Toolbar with Statistics */}
      <Card className="device-toolbar" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Space>
              <Title level={4} style={{ margin: 0 }}>Device Management</Title>
              <Text type="secondary">Manage and monitor all devices in the system</Text>
            </Space>
          </Col>
          
          <Col span={18} style={{ textAlign: 'right' }}>
            <Space>
              <Button
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                Import CSV
              </Button>

              <Button
                icon={<RadarChartOutlined />}
                onClick={() => { setDiscoverVisible(true); setDiscoverResult(null); }}
              >
                Discover by IP
              </Button>

              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={handleAddDevice}
              >
                Add Device
              </Button>
            </Space>
          </Col>
        </Row>
        
        {/* Statistics Cards */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Total Devices"
                value={stats.total}
                prefix={<DesktopOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Online Devices"
                value={stats.online}
                prefix={<WifiOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Offline Devices"
                value={stats.offline}
                prefix={<DisconnectOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="By Type"
                value={Object.keys(stats.byType).length}
                prefix={<AppstoreOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Search and Filters */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col span={12}>
              <Space>
                <Search
                  placeholder="Search by SN or alias"
                  allowClear
                  enterButton={<SearchOutlined />}
                  onSearch={(value) => setFilters({ ...filters, search: value })}
                  style={{ width: '100%' }}
                />
              </Space>
            </Col>
            
            <Col span={12}>
              <Space>
                <Select
                  placeholder="Filter by Area"
                  allowClear
                  style={{ width: 150 }}
                  onChange={(value) => setFilters({ ...filters, area_id: value })}
                >
                  {areas.map(area => (
                    <Option key={area.id} value={area.id}>{area.name}</Option>
                  ))}
                </Select>
                
                <Select
                  placeholder="Filter by Purpose"
                  allowClear
                  style={{ width: 160 }}
                  onChange={(value) => setFilters({ ...filters, device_type: value })}
                >
                  {Object.entries(READER_PURPOSE_META).map(([v, m]) => (
                    <Option key={v} value={v}>{m.label}</Option>
                  ))}
                </Select>
                
                <Select
                  placeholder="Filter by Status"
                  allowClear
                  style={{ width: 120 }}
                  onChange={(value) => setFilters({ ...filters, status: value })}
                >
                  <Option value="online">Online</Option>
                  <Option value="offline">Offline</Option>
                </Select>
              </Space>
            </Col>
          </Row>
        </Card>
        
        {/* Bulk Actions */}
        {selectedRowKeys.length > 0 && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col span={24}>
                <Space>
                  <span>Selected {selectedRowKeys.length} devices:</span>
                  <Divider type="vertical" />
                  <Space>
                    <Popconfirm
                      title={`Delete ${selectedRowKeys.length} devices?`}
                      onConfirm={() => executeBulkAction('delete')}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button 
                        size="small" 
                        danger 
                        loading={bulkActionLoading}
                        icon={<DeleteOutlined />}
                      >
                        Delete
                      </Button>
                    </Popconfirm>
                    <Button 
                      size="small" 
                      loading={bulkActionLoading}
                      icon={<ReloadOutlined />}
                      onClick={() => executeBulkAction('reboot')}
                    >
                      Reboot
                    </Button>
                    <Button 
                      size="small" 
                      loading={bulkActionLoading}
                      icon={<ThunderboltOutlined />}
                      onClick={() => executeBulkAction('syncTime')}
                    >
                      Sync Time
                    </Button>
                    <Button 
                      size="small" 
                      loading={bulkActionLoading}
                      icon={<ThunderboltOutlined />}
                      onClick={() => executeBulkAction('clearAdmin')}
                    >
                      Clear Admin
                    </Button>
                    <Button 
                      size="small" 
                      loading={bulkActionLoading}
                      icon={<DeleteOutlined />}
                      onClick={() => executeBulkAction('clearData')}
                    >
                      Clear Data
                    </Button>
                  </Space>
                </Space>
              </Col>
            </Row>
          </Card>
        )}
      </Card>

      {/* Device Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={devices}
          loading={loading}
          rowKey="id"
          rowSelection={rowSelection}
          pagination={{
            total: devices.length,
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} devices`
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Add/Edit Device Modal */}
      <Modal
        title={editingDevice ? 'Edit Device' : 'Add Device'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sn"
                label="Serial Number"
                rules={[{ required: true, message: 'Please enter serial number' }]}
              >
                <Input placeholder="Device serial number" disabled={!!editingDevice} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="alias"
                label="Alias"
                rules={[{ required: true, message: 'Please enter alias' }]}
              >
                <Input placeholder="Device alias" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="ip_address"
                label="IP Address"
              >
                <Input placeholder="192.168.1.100" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="comm_key"
                label="Communication Key"
              >
                <Input placeholder="0 (default)" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="connection_mode"
                label="Connection Mode"
                initialValue="adms"
                rules={[{ required: true, message: 'Select connection mode' }]}
              >
                <Select>
                  <Option value="adms">ADMS — device pushes to server</Option>
                  <Option value="direct">Direct — server polls via ZKLib</Option>
                  <Option value="both">Both — ADMS + ZKLib polling</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="reader_purpose"
                label="Reader Purpose"
                initialValue="ATTENDANCE"
                rules={[{ required: true, message: 'Select reader purpose' }]}
              >
                <Select>
                  <Option value="ATTENDANCE">T&amp;A Reader (Time &amp; Attendance)</Option>
                  <Option value="ACCESS_ENTRY">Access Control — Entry</Option>
                  <Option value="ACCESS_EXIT">Access Control — Exit</Option>
                  <Option value="MUSTERING">Mustering Station</Option>
                  <Option value="POB">POB (Personnel On Board)</Option>
                  <Option value="EMERGENCY">Emergency Station</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            {(!readerPurpose || readerPurpose === 'ATTENDANCE') && (
              <Col span={24}>
                <Form.Item name="area_id" label="Area (T&A Location)">
                  <Select allowClear placeholder="Select area">
                    {areas.map(area => (
                      <Option key={area.id} value={area.id}>{area.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
            {readerPurpose && readerPurpose !== 'ATTENDANCE' && (
              <Col span={24}>
                <Form.Item
                  name="zone_id"
                  label="Zone"
                  rules={[{ required: true, message: 'Select the zone this reader controls' }]}
                >
                  <Select allowClear placeholder="Select zone">
                    {zones.map(zone => (
                      <Option key={zone.id} value={zone.id}>{zone.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="device_name"
                label="Device Name"
              >
                <Input placeholder="Device model name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="device_model"
                label="Device Model"
              >
                <Input placeholder="MB20, MB560, etc." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Discover by IP Modal ─────────────────────────────────────── */}
      <Modal
        title={<span><RadarChartOutlined /> Discover &amp; Register Device by IP</span>}
        open={discoverVisible}
        onCancel={() => { setDiscoverVisible(false); setDiscoverResult(null); }}
        footer={null}
        width={620}
      >
        {/* Step 1 — Ping */}
        <Card size="small" title="Step 1 — Enter device IP and test connection" style={{ marginBottom: 16 }}>
          <Row gutter={8} align="middle">
            <Col span={9}>
              <Input
                placeholder="192.168.1.52"
                value={discoverIp}
                onChange={e => setDiscoverIp(e.target.value)}
                onPressEnter={handleDiscover}
                addonBefore="IP"
              />
            </Col>
            <Col span={5}>
              <Input
                type="number"
                placeholder="4370"
                value={discoverPort}
                onChange={e => setDiscoverPort(Number(e.target.value))}
                addonBefore="Port"
              />
            </Col>
            <Col span={5}>
              <Input
                type="number"
                placeholder="0"
                value={discoverCommKey}
                onChange={e => setDiscoverCommKey(Number(e.target.value))}
                addonBefore="Key"
              />
            </Col>
            <Col span={5}>
              <Button
                type="primary"
                icon={<WifiOutlined />}
                loading={discoverLoading}
                onClick={handleDiscover}
                block
              >
                Ping
              </Button>
            </Col>
          </Row>

          {discoverResult && (
            <Alert
              style={{ marginTop: 12 }}
              type={discoverResult.connected ? 'success' : 'error'}
              icon={discoverResult.connected ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              showIcon
              message={discoverResult.connected ? 'Device found!' : 'Cannot reach device'}
              description={
                discoverResult.connected ? (
                  <div style={{ marginTop: 4 }}>
                    <Row gutter={8}>
                      <Col span={12}><Text type="secondary">Model:</Text> <strong>{discoverResult.device_name || '—'}</strong></Col>
                      <Col span={12}><Text type="secondary">Serial:</Text> <strong>{discoverResult.serial_number || '—'}</strong></Col>
                      <Col span={12}><Text type="secondary">Firmware:</Text> {discoverResult.firmware || '—'}</Col>
                      <Col span={12}><Text type="secondary">MAC:</Text> {discoverResult.mac || '—'}</Col>
                      <Col span={12}><Text type="secondary">Users:</Text> {discoverResult.user_count ?? '—'}</Col>
                      <Col span={12}><Text type="secondary">Log entries:</Text> {discoverResult.log_count ?? '—'}</Col>
                    </Row>
                  </div>
                ) : discoverResult.error
              }
            />
          )}
        </Card>

        {/* Step 2 — Register (only shown after successful ping) */}
        {discoverResult?.connected && (
          <Card size="small" title="Step 2 — Register the device">
            <Form form={registerForm} layout="vertical">
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item name="name" label="Device name" rules={[{ required: true }]}>
                    <Input placeholder="F18 - Gate A" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="zone_id" label="Zone ID">
                    <InputNumber placeholder="1" style={{ width: '100%' }} min={1} precision={0} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="location_description" label="Location">
                    <Input placeholder="Main entry gate" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="connection_mode" label="Connection mode">
                    <Select>
                      <Select.Option value="direct">Direct only (no ADMS) — e.g. F18</Select.Option>
                      <Select.Option value="adms">ADMS only — e.g. Huros H1</Select.Option>
                      <Select.Option value="both">Both (ADMS + polling backup)</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="auto_poll" label="Auto-poll" valuePropName="checked">
                    <Switch checkedChildren="On" unCheckedChildren="Off" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="poll_interval_sec" label="Poll every (seconds)">
                    <Input type="number" min={60} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  {/* hidden fields pre-filled from ping */}
                  <Form.Item name="ip_address" hidden><Input /></Form.Item>
                  <Form.Item name="port" hidden><Input /></Form.Item>
                  <Form.Item name="device_password" hidden><Input /></Form.Item>
                </Col>
              </Row>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={registerLoading}
                onClick={handleRegisterDirect}
                block
              >
                Register Device
              </Button>
            </Form>
          </Card>
        )}
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        title="Import Devices from CSV"
        open={importModalVisible}
        onOk={handleImportCSV}
        onCancel={() => setImportModalVisible(false)}
      >
        <div style={{ marginBottom: 16 }}>
          <p>CSV Format: SN,Alias,IP,Area,CommKey</p>
          <p>Example: ABC123456,Terminal 1,192.168.1.100,1,0</p>
        </div>

        <Upload
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList }) => setFileList(fileList)}
          accept=".csv"
        >
          <Button icon={<UploadOutlined />}>Select CSV File</Button>
        </Upload>
      </Modal>

      {/* ── Device Details Drawer ─────────────────────────────────────────── */}
      <Drawer
        title={viewDevice ? (viewDevice.alias || viewDevice.sn) : 'Device Details'}
        width={480}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        extra={
          viewDevice && (
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => { setDetailDrawerOpen(false); handleEditDevice(viewDevice); }}
              >
                Edit
              </Button>
            </Space>
          )
        }
      >
        {viewDevice && (
          <div>
            {/* Status banner */}
            <Alert
              message={viewDevice.status?.toLowerCase() === 'online' ? 'Device Online' : 'Device Offline'}
              type={viewDevice.status?.toLowerCase() === 'online' ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Divider orientation="left">Identity</Divider>
            <Row gutter={[0, 12]}>
              <Col span={10}><Text type="secondary">Serial Number</Text></Col>
              <Col span={14}><Text strong>{viewDevice.sn}</Text></Col>

              <Col span={10}><Text type="secondary">Name / Alias</Text></Col>
              <Col span={14}><Text>{viewDevice.alias || '—'}</Text></Col>

              <Col span={10}><Text type="secondary">Device Name</Text></Col>
              <Col span={14}><Text>{viewDevice.device_name || '—'}</Text></Col>

              <Col span={10}><Text type="secondary">Model</Text></Col>
              <Col span={14}><Text>{viewDevice.device_model || '—'}</Text></Col>

              <Col span={10}><Text type="secondary">Firmware</Text></Col>
              <Col span={14}><Text code>{viewDevice.fw_version || '—'}</Text></Col>

              <Col span={10}><Text type="secondary">Platform</Text></Col>
              <Col span={14}><Text>{viewDevice.platform || '—'}</Text></Col>

              <Col span={10}><Text type="secondary">OEM Vendor</Text></Col>
              <Col span={14}><Text>{viewDevice.oem_vendor || '—'}</Text></Col>

              <Col span={10}><Text type="secondary">Purpose</Text></Col>
              <Col span={14}>
                <Tag color={getReaderPurposeColor(viewDevice.reader_purpose)}>
                  {getReaderPurposeName(viewDevice.reader_purpose)}
                </Tag>
              </Col>
            </Row>

            <Divider orientation="left">Network</Divider>
            <Row gutter={[0, 12]}>
              <Col span={10}><Text type="secondary">IP Address</Text></Col>
              <Col span={14}><Text code>{viewDevice.ip_address || '—'}</Text></Col>

              <Col span={10}><Text type="secondary">Connection Mode</Text></Col>
              <Col span={14}>
                {(() => {
                  const m = CONNECTION_MODE_META[viewDevice.connection_mode] || CONNECTION_MODE_META.adms;
                  return <Tooltip title={m.description}><Tag color={m.color}>{m.label}</Tag></Tooltip>;
                })()}
              </Col>

              <Col span={10}><Text type="secondary">MAC Address</Text></Col>
              <Col span={14}><Text code>{viewDevice.mac_address || '—'}</Text></Col>

              <Col span={10}><Text type="secondary">Comm Key</Text></Col>
              <Col span={14}><Text code>{viewDevice.comm_key ?? '—'}</Text></Col>
            </Row>

            <Divider orientation="left">Capacity</Divider>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Users" value={viewDevice.user_count ?? 0} />
              </Col>
              <Col span={6}>
                <Statistic title="Fingerprints" value={viewDevice.fp_count ?? 0} />
              </Col>
              <Col span={6}>
                <Statistic title="Faces" value={viewDevice.face_count ?? 0} />
              </Col>
              <Col span={6}>
                <Statistic title="Logs" value={viewDevice.log_count ?? 0} />
              </Col>
            </Row>

            <Divider orientation="left">Activity</Divider>
            <Row gutter={[0, 12]}>
              <Col span={10}><Text type="secondary">Last Active</Text></Col>
              <Col span={14}>
                {viewDevice.last_activity ? (
                  <Space direction="vertical" size={0}>
                    <Text>{new Date(viewDevice.last_activity).toLocaleString()}</Text>
                    <Tag color={getActivityColor(viewDevice.last_activity)}>
                      {getRelativeTime(viewDevice.last_activity)}
                    </Tag>
                  </Space>
                ) : <Text type="secondary">Never</Text>}
              </Col>

              <Col span={10}><Text type="secondary">Registered</Text></Col>
              <Col span={14}><Text>{new Date(viewDevice.created_at).toLocaleString()}</Text></Col>

              <Col span={10}><Text type="secondary">Last Updated</Text></Col>
              <Col span={14}><Text>{new Date(viewDevice.updated_at).toLocaleString()}</Text></Col>
            </Row>

            {viewDevice.ip_address && (
              <>
                <Divider orientation="left">Device Clock</Divider>
                {deviceTimes[viewDevice.sn] ? (
                  <Row gutter={[0, 10]} style={{ marginBottom: 14 }}>
                    <Col span={10}><Text type="secondary">Device Time</Text></Col>
                    <Col span={14}>
                      <Text code style={{ fontSize: 12 }}>
                        {deviceTimes[viewDevice.sn].device_time}
                      </Text>
                    </Col>
                    <Col span={10}><Text type="secondary">Server Time</Text></Col>
                    <Col span={14}>
                      <Text code style={{ fontSize: 12 }}>
                        {deviceTimes[viewDevice.sn].server_time
                          ? new Date(deviceTimes[viewDevice.sn].server_time + 'Z').toLocaleString()
                          : '—'}
                      </Text>
                    </Col>
                  </Row>
                ) : (
                  <Text type="secondary" style={{ display: 'block', marginBottom: 14 }}>
                    Click "Read Clock" to check the device time.
                  </Text>
                )}
                <Space>
                  <Button
                    size="small"
                    icon={<ClockCircleOutlined />}
                    loading={timeSyncLoading[viewDevice.sn] === 'reading'}
                    onClick={() => fetchDeviceTime(viewDevice.sn, viewDevice.ip_address, viewDevice.port || 4370)}
                  >
                    Read Clock
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<SyncOutlined />}
                    loading={timeSyncLoading[viewDevice.sn] === 'syncing'}
                    onClick={() => handleSyncTime(viewDevice.sn, viewDevice.ip_address, viewDevice.port || 4370, viewDevice.connection_mode)}
                  >
                    Sync to Server Time
                  </Button>
                </Space>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default DeviceList;
