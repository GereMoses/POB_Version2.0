import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, App, Popconfirm, Tooltip,
  Card, Row, Col, Badge, Drawer, Alert, Statistic, Tag, Form,
  Modal, Progress, Divider, Spin, Typography,
} from 'antd';
import {
  ThunderboltOutlined, SendOutlined, ReloadOutlined, DeleteOutlined,
  EyeOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined, SyncOutlined, UserOutlined, ScanOutlined,
  IdcardOutlined, AlertOutlined, RedoOutlined, ClearOutlined,
  TeamOutlined, UnlockOutlined, LockOutlined, PoweroffOutlined,
  CloudDownloadOutlined, InfoCircleOutlined, WifiOutlined, WarningOutlined,
  UserDeleteOutlined, DownloadOutlined, SafetyOutlined,
} from '@ant-design/icons';
import apiService from '../../../services/api';
import { deviceAPI } from '../../../services/deviceAPI';

const { Text } = Typography;

const { Option } = Select;
const { TextArea } = Input;

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS = {
  color: { 0: 'orange', 1: 'blue', 2: 'green', 3: 'red' },
  icon: {
    0: <ClockCircleOutlined />, 1: <SyncOutlined spin />,
    2: <CheckCircleOutlined />, 3: <CloseCircleOutlined />,
  },
  text: { 0: 'Pending', 1: 'Sent', 2: 'Success', 3: 'Failed' },
};

const cmdIcon = (cmd = '') => {
  const c = cmd.toUpperCase();
  if (c.includes('REBOOT') || c.includes('RESTART')) return <PoweroffOutlined />;
  if (c.includes('SYNC') || c.includes('USER'))      return <UserOutlined />;
  if (c.includes('FINGER'))                          return <ScanOutlined />;
  if (c.includes('FACE'))                            return <IdcardOutlined />;
  if (c.includes('EMERGENCY'))                       return <AlertOutlined />;
  if (c.includes('CLEAR') || c.includes('DELETE'))   return <DeleteOutlined />;
  if (c.includes('CHECK') || c.includes('INFO'))     return <InfoCircleOutlined />;
  if (c.includes('LOCK') || c.includes('DISABLE'))   return <LockOutlined />;
  if (c.includes('UNLOCK') || c.includes('ENABLE'))  return <UnlockOutlined />;
  if (c.includes('OPEN') || c.includes('DOOR'))      return <UnlockOutlined />;
  return <ThunderboltOutlined />;
};

const cmdColor = (cmd = '') => {
  const c = cmd.toUpperCase();
  if (c.includes('EMERGENCY'))                       return 'red';
  if (c.includes('REBOOT') || c.includes('RESTART')) return 'orange';
  if (c.includes('CLEAR') || c.includes('DELETE'))   return 'volcano';
  if (c.includes('LOCK') || c.includes('DISABLE'))   return 'magenta';
  if (c.includes('SYNC') || c.includes('PUSH'))      return 'geekblue';
  return 'default';
};

const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

// ── Action button component (card-style) ───────────────────────────────────────
const ActionBtn = ({ icon, label, desc, color, onClick, danger, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    style={{
      width: '100%', background: disabled ? '#f5f5f5' : '#fff',
      border: `1px solid ${danger ? '#fca5a5' : '#e2e8f0'}`,
      borderRadius: 10, padding: '10px 12px', cursor: disabled ? 'not-allowed' : 'pointer',
      textAlign: 'left', transition: 'all 0.15s', opacity: disabled ? 0.55 : 1,
    }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = disabled ? '' : 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: danger ? '#fef2f2' : `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: danger ? '#dc2626' : color, fontSize: 14,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: danger ? '#dc2626' : '#0f172a', lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{desc}</div>
      </div>
    </div>
  </button>
);

// ── Category header ────────────────────────────────────────────────────────────
const CatHeader = ({ icon, title, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
    <div style={{
      width: 28, height: 28, borderRadius: 7, background: `${color}20`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: 13, flexShrink: 0,
    }}>{icon}</div>
    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{title}</span>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
const DeviceCommands = () => {
  const { message } = App.useApp();

  const [commands,     setCommands]     = useState([]);
  const [devices,      setDevices]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [retryingIds,  setRetryingIds]  = useState(new Set());
  const [filters,      setFilters]      = useState({ sn: null, status: null });
  const [stats,        setStats]        = useState({ pending: 0, sent: 0, success: 0, failed: 0 });
  const [detailCmd,    setDetailCmd]    = useState(null);
  const [busyCmd,      setBusyCmd]      = useState(null);
  const [driftData,    setDriftData]    = useState([]);
  const [driftLoading, setDriftLoading] = useState(false);
  const [syncAllBusy,  setSyncAllBusy]  = useState(false);

  // modal states
  const [syncEmpModal,   setSyncEmpModal]   = useState(false);
  const [syncDeptModal,  setSyncDeptModal]  = useState(false);
  const [removeEmpModal, setRemoveEmpModal] = useState(false);
  const [openDoorModal,  setOpenDoorModal]  = useState(false);
  const [sendRawModal,   setSendRawModal]   = useState(false);

  const [actionDevice, setActionDevice] = useState(null);  // pre-selected device for action modals
  const [syncEmpForm]   = Form.useForm();
  const [syncDeptForm]  = Form.useForm();
  const [removeEmpForm] = Form.useForm();
  const [openDoorForm]  = Form.useForm();
  const [rawForm]       = Form.useForm();

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchCommands = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: 1, limit: 200, ...filters };
      Object.keys(params).forEach(k => { if (params[k] === null) delete params[k]; });
      const res = await deviceAPI.getDeviceCommands(params);
      const list = res || [];
      setCommands(list);
      setStats({
        pending: list.filter(c => c.status === 0).length,
        sent:    list.filter(c => c.status === 1).length,
        success: list.filter(c => c.status === 2).length,
        failed:  list.filter(c => c.status === 3).length,
      });
    } catch { message.error('Failed to fetch command history'); }
    finally  { setLoading(false); }
  }, [filters, message]);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await deviceAPI.getTerminals({ limit: 1000 });
      setDevices(res || []);
    } catch { /* silent */ }
  }, []);

  const fetchDrift = useCallback(async () => {
    setDriftLoading(true);
    try {
      const res = await apiService.get('/iclock/terminals/time-drift');
      setDriftData(res?.data || []);
    } catch { /* silent — drift panel is informational */ }
    finally { setDriftLoading(false); }
  }, []);

  useEffect(() => { fetchCommands(); fetchDevices(); fetchDrift(); }, [fetchCommands, fetchDevices, fetchDrift]);

  // ── Generic action runner ─────────────────────────────────────────────────
  const run = async (key, fn, successMsg) => {
    if (!actionDevice) { message.warning('Select a device first'); return; }
    setBusyCmd(key);
    try {
      await fn();
      message.success(successMsg);
      fetchCommands();
    } catch (err) {
      message.error(err?.message || `${key} failed`);
    } finally {
      setBusyCmd(null);
    }
  };

  const runWithDevice = (device, key, fn, successMsg) => {
    setBusyCmd(key);
    fn()
      .then(() => { message.success(successMsg); fetchCommands(); })
      .catch(err => message.error(err?.message || `${key} failed`))
      .finally(() => setBusyCmd(null));
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  // — Employee sync —
  const doSyncAll = () =>
    run('sync-all', () => deviceAPI.syncAllUsersToDevice(actionDevice),
      'All employees pushed to device successfully');

  const doSyncEmp = async () => {
    setBusyCmd('sync-emp');
    try {
      const vals = await syncEmpForm.validateFields();
      setSyncEmpModal(false);
      const res = await deviceAPI.syncUserToDevice(vals.sn, vals.emp_code);
      message.success(res?.message || `Employee ${vals.emp_code} synced to device`);
      fetchCommands();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Sync failed');
    } finally { setBusyCmd(null); }
  };

  const doSyncDept = async () => {
    setBusyCmd('sync-dept');
    try {
      const vals = await syncDeptForm.validateFields();
      setSyncDeptModal(false);
      const res = await deviceAPI.syncDepartmentToDevice(vals.sn, vals.department);
      message.success(res?.message || `Department synced to device`);
      fetchCommands();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Sync failed');
    } finally { setBusyCmd(null); }
  };

  const doRemoveEmp = async () => {
    setBusyCmd('remove-emp');
    try {
      const vals = await removeEmpForm.validateFields();
      setRemoveEmpModal(false);
      await deviceAPI.extendedCommand({ sn: vals.sn, command_type: 'DELETE_USER', params: { emp_code: vals.emp_code } });
      message.success(`Employee ${vals.emp_code} removed from device`);
      fetchCommands();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Remove failed');
    } finally { setBusyCmd(null); }
  };

  // — Door / access —
  const doOpenDoor = async () => {
    setBusyCmd('open-door');
    try {
      const vals = await openDoorForm.validateFields();
      setOpenDoorModal(false);
      await deviceAPI.extendedCommand({ sn: vals.sn, command_type: 'OPEN_DOOR', params: { hold_seconds: vals.hold_seconds || 5 } });
      message.success('Door unlock command sent');
      fetchCommands();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Door open failed');
    } finally { setBusyCmd(null); }
  };

  const doDisable = () =>
    run('disable', () => deviceAPI.extendedCommand({ sn: actionDevice, command_type: 'DISABLE', params: {} }),
      'Device disabled (lockdown active)');

  const doEnable = () =>
    run('enable', () => deviceAPI.extendedCommand({ sn: actionDevice, command_type: 'ENABLE', params: {} }),
      'Device enabled');

  const doEmergencyOn = () =>
    run('emg-on', () => deviceAPI.emergencyCommand(actionDevice, 'ON'),
      'Emergency mode activated');

  const doEmergencyOff = () =>
    run('emg-off', () => deviceAPI.emergencyCommand(actionDevice, 'OFF'),
      'Emergency mode deactivated');

  // — Device management —
  const doRestart = () =>
    run('restart', () => deviceAPI.sendCommand({ sn: actionDevice, cmd: 'REBOOT' }),
      'Restart command sent');

  // Uses the proper SET DATE TIME endpoint (embeds current server time in the command)
  const doSyncTime = () =>
    run('synctime', () => apiService.post('/iclock/cmd/sync-time', { sn: actionDevice }),
      'Time sync queued — reader will correct its clock on next poll');

  // Sync all approved readers at once
  const doSyncAllTimes = async () => {
    setSyncAllBusy(true);
    try {
      const res = await apiService.post('/iclock/cmd/sync-time-all', {});
      message.success(`Time sync queued for ${res.queued} reader(s) — clocks will correct on next poll`);
      fetchCommands();
      fetchDrift();
    } catch (err) {
      message.error(err?.message || 'Sync all failed');
    } finally { setSyncAllBusy(false); }
  };

  const doPollNow = () =>
    run('poll', () => deviceAPI.sendCommand({ sn: actionDevice, cmd: 'GET LOG' }),
      'Attendance pull command sent');

  const doGetInfo = () =>
    run('info', () => deviceAPI.sendCommand({ sn: actionDevice, cmd: 'GET INFO' }),
      'Device info request sent');

  const doCheckConn = () =>
    run('check', () => deviceAPI.sendCommand({ sn: actionDevice, cmd: 'TEST CONNECTION' }),
      'Connection test sent');

  // — Data management —
  const doClearLogs = () =>
    run('clearlogs', () => deviceAPI.sendCommand({ sn: actionDevice, cmd: 'CLEAR LOG' }),
      'Attendance log clear command sent');

  const doGetUsers = async () => {
    if (!actionDevice) { message.warning('Select a device first'); return; }
    setBusyCmd('getusers');
    try {
      const res = await apiService.post('/iclock/cmd/pull-users', { sn: actionDevice });
      message.success(res?.detail || 'Pull users completed', 6);
      fetchCommands();
    } catch (err) {
      message.error(err?.message || 'Get users from device failed');
    } finally {
      setBusyCmd(null);
    }
  };

  // — Misc —
  const doSendRaw = async () => {
    setBusyCmd('raw');
    try {
      const vals = await rawForm.validateFields();
      setSendRawModal(false);
      await deviceAPI.sendCommand({ sn: vals.sn, cmd: vals.cmd });
      message.success('Command sent');
      fetchCommands();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed');
    } finally { setBusyCmd(null); }
  };

  const handleRetry = async (record) => {
    setRetryingIds(p => new Set(p).add(record.id));
    try {
      await deviceAPI.sendCommand({ sn: record.sn, cmd: record.cmd_content });
      message.success('Command resent');
      fetchCommands();
    } catch { message.error('Retry failed'); }
    finally { setRetryingIds(p => { const s = new Set(p); s.delete(record.id); return s; }); }
  };

  const handleClearPending = async () => {
    const pending = commands.filter(c => c.status === 0);
    if (!pending.length) { message.info('No pending commands'); return; }
    await Promise.all(pending.map(c => deviceAPI.deleteCommand(c.id)));
    message.success(`Cleared ${pending.length} pending commands`);
    fetchCommands();
  };

  const deviceLabel = (sn) => {
    const d = devices.find(x => x.sn === sn);
    return d ? `${d.alias || sn} (${sn})` : sn;
  };

  const noDevice = !actionDevice;

  // ── Table columns ────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: s => (
        <Tag color={STATUS.color[s]} icon={STATUS.icon[s]}>{STATUS.text[s] ?? 'Unknown'}</Tag>
      ),
      filters: [0,1,2,3].map(v => ({ text: STATUS.text[v], value: v })),
      onFilter: (v, r) => r.status === v,
    },
    {
      title: 'Device', dataIndex: 'sn', key: 'sn', width: 160,
      render: sn => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {devices.find(d => d.sn === sn)?.alias || sn}
        </span>
      ),
    },
    {
      title: 'Command', dataIndex: 'cmd_content', key: 'cmd_content', width: 220,
      render: (cmd) => (
        <div>
          <Tag color={cmdColor(cmd)} icon={cmdIcon(cmd)} style={{ marginBottom: 2 }}>
            {cmd.split(' ')[0]}
          </Tag>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {cmd.length > 35 ? `${cmd.slice(0, 35)}…` : cmd}
          </div>
        </div>
      ),
    },
    {
      title: 'Created', dataIndex: 'cmd_commit_time', key: 'cmd_commit_time',
      width: 150, render: fmt,
    },
    {
      title: 'Completed', dataIndex: 'cmd_return_time', key: 'cmd_return_time',
      width: 150, render: fmt,
    },
    {
      title: 'Response', dataIndex: 'cmd_return', key: 'cmd_return', width: 160,
      render: r => r
        ? <span style={{ fontSize: 11, color: '#64748b' }}>{r.length > 30 ? `${r.slice(0,30)}…` : r}</span>
        : <span style={{ color: '#d1d5db' }}>—</span>,
    },
    {
      title: '', key: 'actions', width: 100, fixed: 'right',
      render: (_, rec) => (
        <Space size={4}>
          <Tooltip title="View details">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailCmd(rec)} style={{ borderRadius: 6 }} />
          </Tooltip>
          {(rec.status === 0 || rec.status === 3) && (
            <Tooltip title="Retry">
              <Button size="small" type="primary" icon={<RedoOutlined />}
                loading={retryingIds.has(rec.id)} onClick={() => handleRetry(rec)}
                style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          {(rec.status === 0 || rec.status === 3) && (
            <Popconfirm title="Delete this command?" onConfirm={() => deviceAPI.deleteCommand(rec.id).then(fetchCommands)}
              okText="Delete" okButtonProps={{ danger: true }}>
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const total = stats.pending + stats.sent + stats.success + stats.failed;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <Row gutter={12}>
        {[
          { label: 'Pending', key: 'pending', color: '#f59e0b', bg: '#fffbeb', icon: <ClockCircleOutlined /> },
          { label: 'Sent',    key: 'sent',    color: '#3b82f6', bg: '#eff6ff', icon: <SyncOutlined /> },
          { label: 'Success', key: 'success', color: '#22c55e', bg: '#f0fdf4', icon: <CheckCircleOutlined /> },
          { label: 'Failed',  key: 'failed',  color: '#ef4444', bg: '#fef2f2', icon: <CloseCircleOutlined /> },
        ].map(s => (
          <Col key={s.key} xs={12} sm={6}>
            <div style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 9, background: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: s.color, fontSize: 16, flexShrink: 0,
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{stats[s.key]}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ── Device Control Panel ────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* panel header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ThunderboltOutlined style={{ color: '#fff', fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Device Control Panel</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Select a reader, then choose a command</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Select
              showSearch
              placeholder="Select reader / device…"
              style={{ minWidth: 280 }}
              value={actionDevice}
              onChange={setActionDevice}
              allowClear
              optionFilterProp="label"
              options={devices.map(d => ({
                value: d.sn,
                label: `${d.alias || d.sn} — ${d.sn}`,
              }))}
            />
            <Button
              icon={<SyncOutlined />}
              loading={syncAllBusy}
              onClick={doSyncAllTimes}
              type="primary"
              style={{ borderRadius: 8, background: '#7c3aed', borderColor: '#7c3aed', whiteSpace: 'nowrap' }}
            >
              Sync All Clocks
            </Button>
          </div>
        </div>

        {noDevice && (
          <Alert
            type="info" showIcon
            message="Select a reader from the dropdown above to enable the commands below."
            style={{ borderRadius: 8, marginBottom: 16 }}
          />
        )}

        <Row gutter={[16, 16]}>

          {/* ── Category 1: Employee Sync ─────────────────────────── */}
          <Col xs={24} sm={12} lg={6}>
            <CatHeader icon={<TeamOutlined />} title="Employee Sync" color="#2563eb" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Popconfirm
                title="Sync ALL active employees to this reader?"
                description="This will push every active employee from the database to the selected device."
                onConfirm={doSyncAll}
                okText="Sync All" disabled={noDevice}
              >
                <ActionBtn
                  icon={<TeamOutlined />} color="#2563eb"
                  label="Sync All Employees"
                  desc="Push all active staff to reader"
                  disabled={noDevice || busyCmd === 'sync-all'}
                />
              </Popconfirm>

              <ActionBtn
                icon={<UserOutlined />} color="#2563eb"
                label="Sync One Employee"
                desc="Push a single employee by code"
                disabled={noDevice || busyCmd === 'sync-emp'}
                onClick={() => { syncEmpForm.setFieldValue('sn', actionDevice); setSyncEmpModal(true); }}
              />

              <ActionBtn
                icon={<TeamOutlined />} color="#0891b2"
                label="Sync by Department"
                desc="Push one department to reader"
                disabled={noDevice || busyCmd === 'sync-dept'}
                onClick={() => { syncDeptForm.setFieldValue('sn', actionDevice); setSyncDeptModal(true); }}
              />

              <ActionBtn
                icon={<UserDeleteOutlined />} color="#7c3aed"
                label="Remove Employee"
                desc="Delete an employee from reader"
                disabled={noDevice || busyCmd === 'remove-emp'}
                onClick={() => { removeEmpForm.setFieldValue('sn', actionDevice); setRemoveEmpModal(true); }}
                danger
              />

              <ActionBtn
                icon={<CloudDownloadOutlined />} color="#0891b2"
                label="Get Users from Device"
                desc="Import all users stored on reader into POB"
                disabled={noDevice || busyCmd === 'getusers'}
                onClick={doGetUsers}
              />
            </div>
          </Col>

          {/* ── Category 2: Door & Access ─────────────────────────── */}
          <Col xs={24} sm={12} lg={6}>
            <CatHeader icon={<UnlockOutlined />} title="Door & Access" color="#16a34a" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ActionBtn
                icon={<UnlockOutlined />} color="#16a34a"
                label="Open / Unlock Door"
                desc="Temporarily unlock relay"
                disabled={noDevice || busyCmd === 'open-door'}
                onClick={() => { openDoorForm.setFieldValue('sn', actionDevice); setOpenDoorModal(true); }}
              />

              <Popconfirm
                title="Disable this device (lockdown)?"
                description="Local authentication will be suspended until you re-enable the device."
                onConfirm={doDisable} okText="Disable" okButtonProps={{ danger: true }}
                disabled={noDevice}
              >
                <ActionBtn
                  icon={<LockOutlined />} color="#dc2626"
                  label="Lock Down Device"
                  desc="Suspend local authentication"
                  disabled={noDevice || busyCmd === 'disable'} danger
                />
              </Popconfirm>

              <Popconfirm
                title="Re-enable this device?"
                onConfirm={doEnable} okText="Enable"
                disabled={noDevice}
              >
                <ActionBtn
                  icon={<UnlockOutlined />} color="#16a34a"
                  label="Enable Device"
                  desc="Restore normal operation"
                  disabled={noDevice || busyCmd === 'enable'}
                />
              </Popconfirm>

              <Popconfirm
                title="Activate EMERGENCY mode?"
                description="Triggers emergency lockdown sequence on device."
                onConfirm={doEmergencyOn} okText="Activate" okButtonProps={{ danger: true }}
                disabled={noDevice}
              >
                <ActionBtn
                  icon={<SafetyOutlined />} color="#dc2626"
                  label="Emergency ON"
                  desc="Activate emergency lockdown"
                  disabled={noDevice || busyCmd === 'emg-on'} danger
                />
              </Popconfirm>

              <Popconfirm
                title="Deactivate emergency mode?"
                onConfirm={doEmergencyOff} okText="Deactivate"
                disabled={noDevice}
              >
                <ActionBtn
                  icon={<SafetyOutlined />} color="#f59e0b"
                  label="Emergency OFF"
                  desc="Cancel emergency mode"
                  disabled={noDevice || busyCmd === 'emg-off'}
                />
              </Popconfirm>
            </div>
          </Col>

          {/* ── Category 3: Device Management ────────────────────── */}
          <Col xs={24} sm={12} lg={6}>
            <CatHeader icon={<PoweroffOutlined />} title="Device Management" color="#7c3aed" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Popconfirm
                title="Restart this device?" description="The device will reboot. It will be offline for ~30 seconds."
                onConfirm={doRestart} okText="Restart" okButtonProps={{ danger: true }}
                disabled={noDevice}
              >
                <ActionBtn
                  icon={<PoweroffOutlined />} color="#f59e0b"
                  label="Restart Device"
                  desc="Reboot the reader"
                  disabled={noDevice || busyCmd === 'restart'} danger
                />
              </Popconfirm>

              <ActionBtn
                icon={<ClockCircleOutlined />} color="#7c3aed"
                label="Sync Device Time"
                desc="Set clock to server UTC time"
                disabled={noDevice || busyCmd === 'synctime'}
                onClick={doSyncTime}
              />

              <ActionBtn
                icon={<DownloadOutlined />} color="#0891b2"
                label="Pull Attendance Now"
                desc="Force an attendance log pull"
                disabled={noDevice || busyCmd === 'poll'}
                onClick={doPollNow}
              />

              <ActionBtn
                icon={<InfoCircleOutlined />} color="#64748b"
                label="Get Device Info"
                desc="Firmware, user/log counts"
                disabled={noDevice || busyCmd === 'info'}
                onClick={doGetInfo}
              />

              <ActionBtn
                icon={<WifiOutlined />} color="#16a34a"
                label="Test Connection"
                desc="Verify device is reachable"
                disabled={noDevice || busyCmd === 'check'}
                onClick={doCheckConn}
              />
            </div>
          </Col>

          {/* ── Category 4: Data Management ───────────────────────── */}
          <Col xs={24} sm={12} lg={6}>
            <CatHeader icon={<CloudDownloadOutlined />} title="Data Management" color="#0891b2" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Popconfirm
                title="Clear attendance logs on device?"
                description="This will permanently erase all punch records from the reader's memory. Database records are unaffected."
                onConfirm={doClearLogs} okText="Clear Logs" okButtonProps={{ danger: true }}
                disabled={noDevice}
              >
                <ActionBtn
                  icon={<ClearOutlined />} color="#f59e0b"
                  label="Clear Attendance Logs"
                  desc="Erase punch records from device"
                  disabled={noDevice || busyCmd === 'clearlogs'} danger
                />
              </Popconfirm>

              <Divider style={{ margin: '4px 0' }} />

              <ActionBtn
                icon={<SendOutlined />} color="#64748b"
                label="Send Raw Command"
                desc="Send a custom ADMS command"
                disabled={false}
                onClick={() => { rawForm.setFieldValue('sn', actionDevice); setSendRawModal(true); }}
              />
            </div>
          </Col>
        </Row>

        {/* busy indicator */}
        {busyCmd && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb', fontSize: 12 }}>
            <Spin size="small" />
            <span>Sending command to <strong>{deviceLabel(actionDevice)}</strong>…</span>
          </div>
        )}
      </div>

      {/* ── Time Drift Status Panel ─────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
        padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg,#7c3aed,#2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ClockCircleOutlined style={{ color: '#fff', fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Reader Time Drift Status</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Drift vs server clock — auto-corrects hourly; use "Sync All Clocks" to force immediately</div>
            </div>
          </div>
          <Button icon={<ReloadOutlined />} size="small" onClick={fetchDrift} loading={driftLoading} style={{ borderRadius: 7 }}>
            Refresh
          </Button>
        </div>

        {driftLoading && !driftData.length && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>
            <Spin size="small" /> <span style={{ marginLeft: 8 }}>Loading drift data…</span>
          </div>
        )}

        {!driftLoading && !driftData.length && (
          <Alert type="info" showIcon message="No approved readers found. Add and approve readers in the Device List tab." style={{ borderRadius: 8 }} />
        )}

        {driftData.length > 0 && (
          <Row gutter={[12, 12]}>
            {driftData.map(d => {
              const isOk      = d.drift_status === 'ok';
              const isWarn    = d.drift_status === 'warning';
              const isUnknown = d.drift_status === 'unknown';
              const statusColor = isOk ? '#22c55e' : isWarn ? '#f59e0b' : isUnknown ? '#94a3b8' : '#ef4444';
              const statusBg    = isOk ? '#f0fdf4' : isWarn ? '#fffbeb' : isUnknown ? '#f8fafc' : '#fef2f2';
              const driftAbs    = d.drift_seconds != null ? Math.abs(d.drift_seconds) : null;
              const tagColor    = isOk ? 'success' : isWarn ? 'warning' : isUnknown ? 'default' : 'error';
              const methodLabel = d.method === 'live' ? '● Live' : d.method === 'recent_punch' ? '○ Estimated' : d.method === 'no_recent_data' ? '— No data' : d.method === 'live_failed' ? '✕ Unreachable' : '';
              return (
                <Col key={d.sn} xs={24} sm={12} lg={8} xl={6}>
                  <div style={{
                    background: statusBg, border: `1px solid ${statusColor}40`,
                    borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{d.alias || d.sn}</Text>
                      <Tag color={tagColor} style={{ marginRight: 0, fontSize: 10, lineHeight: '18px' }}>
                        {(d.drift_status ?? 'unknown').toUpperCase()}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 6 }}>{d.sn}</div>
                    {driftAbs != null ? (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: statusColor, lineHeight: 1 }}>{driftAbs}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>sec drift</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No data yet</div>
                    )}
                    {methodLabel && (
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{methodLabel}</div>
                    )}
                    {!isOk && !isUnknown && driftAbs != null && (
                      <div style={{ fontSize: 10, color: statusColor, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <WarningOutlined />
                        {isWarn ? 'Minor drift — will auto-correct next hour' : 'Large drift — use Sync All Clocks now'}
                      </div>
                    )}
                    {d.detail && (
                      <div style={{ fontSize: 10, color: '#ef4444', marginTop: 3 }}>{d.detail}</div>
                    )}
                    {d.last_seen && (
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                        Last seen: {new Date(d.last_seen).toLocaleString()}
                      </div>
                    )}
                  </div>
                </Col>
              );
            })}
          </Row>
        )}
      </div>

      {/* ── Command queue toolbar ────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <Select
          placeholder="Filter by device"
          allowClear style={{ minWidth: 200 }}
          onChange={v => setFilters(f => ({ ...f, sn: v || null }))}
        >
          {devices.map(d => <Option key={d.sn} value={d.sn}>{d.alias || d.sn} ({d.sn})</Option>)}
        </Select>

        <Select
          placeholder="Filter by status"
          allowClear style={{ minWidth: 140 }}
          onChange={v => setFilters(f => ({ ...f, status: v ?? null }))}
        >
          {[0,1,2,3].map(v => <Option key={v} value={v}>{STATUS.text[v]}</Option>)}
        </Select>

        <div style={{ flex: 1 }} />

        <Badge count={stats.pending} color="#f59e0b">
          <span style={{ fontSize: 12, color: '#64748b' }}>Command Queue</span>
        </Badge>

        {stats.pending > 0 && (
          <Popconfirm
            title={`Clear all ${stats.pending} pending commands?`}
            onConfirm={handleClearPending} okText="Clear All" okButtonProps={{ danger: true }}
          >
            <Button icon={<ClearOutlined />} danger size="small" style={{ borderRadius: 7 }}>
              Clear Pending ({stats.pending})
            </Button>
          </Popconfirm>
        )}

        <Button icon={<ReloadOutlined />} onClick={fetchCommands} loading={loading}
          size="small" style={{ borderRadius: 7 }}>
          Refresh
        </Button>
      </div>

      {/* ── Command queue table ──────────────────────────────────────── */}
      {total > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <Progress
            percent={total ? Math.round(stats.success / total * 100) : 0}
            size="small" showInfo={false}
            strokeColor={{ '0%': '#ef4444', '100%': '#22c55e' }}
            style={{ marginBottom: 0 }}
          />
          <Table
            columns={columns} dataSource={commands} loading={loading}
            rowKey="id" size="middle" scroll={{ x: 1100 }}
            pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} commands` }}
            style={{ borderRadius: 0 }}
          />
        </div>
      )}

      {total === 0 && !loading && (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13,
        }}>
          <ThunderboltOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
          No commands in queue yet. Use the control panel above to send commands.
        </div>
      )}

      {/* ══ Modals ══════════════════════════════════════════════════════════ */}

      {/* Sync one employee */}
      <Modal title={<><UserOutlined /> Sync Employee to Device</>}
        open={syncEmpModal} onOk={doSyncEmp} onCancel={() => setSyncEmpModal(false)}
        okText="Sync Now" width={480} destroyOnHidden>
        <Alert type="info" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
          message="This will push the employee's profile (name, emp code, card) to the selected reader immediately." />
        <Form form={syncEmpForm} layout="vertical">
          <Form.Item name="sn" label="Reader / Device" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select device" optionFilterProp="label"
              options={devices.map(d => ({ value: d.sn, label: `${d.alias || d.sn} (${d.sn})` }))} />
          </Form.Item>
          <Form.Item name="emp_code" label="Employee Code (PIN)" rules={[{ required: true, message: 'Enter the employee code' }]}>
            <Input placeholder="e.g. EMP001" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Sync by department */}
      <Modal title={<><TeamOutlined style={{ color: '#0891b2' }} /> Sync Department to Device</>}
        open={syncDeptModal} onOk={doSyncDept} onCancel={() => setSyncDeptModal(false)}
        okText="Sync Department" width={480} destroyOnHidden>
        <Alert type="info" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
          message="All active employees in the specified department will be pushed to the selected reader." />
        <Form form={syncDeptForm} layout="vertical">
          <Form.Item name="sn" label="Reader / Device" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select device" optionFilterProp="label"
              options={devices.map(d => ({ value: d.sn, label: `${d.alias || d.sn} (${d.sn})` }))} />
          </Form.Item>
          <Form.Item name="department" label="Department Name" rules={[{ required: true, message: 'Enter department name' }]}>
            <Input placeholder="e.g. Engineering, Operations, Maintenance" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Remove employee from device */}
      <Modal title={<><UserDeleteOutlined style={{ color: '#dc2626' }} /> Remove Employee from Device</>}
        open={removeEmpModal} onOk={doRemoveEmp} onCancel={() => setRemoveEmpModal(false)}
        okText="Remove" okButtonProps={{ danger: true }} width={480} destroyOnHidden>
        <Alert type="warning" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
          message="The employee will be deleted from the reader. They will no longer be able to punch at this device until re-synced." />
        <Form form={removeEmpForm} layout="vertical">
          <Form.Item name="sn" label="Reader / Device" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select device" optionFilterProp="label"
              options={devices.map(d => ({ value: d.sn, label: `${d.alias || d.sn} (${d.sn})` }))} />
          </Form.Item>
          <Form.Item name="emp_code" label="Employee Code (PIN)" rules={[{ required: true }]}>
            <Input placeholder="e.g. EMP001" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Open door */}
      <Modal title={<><UnlockOutlined style={{ color: '#16a34a' }} /> Open / Unlock Door</>}
        open={openDoorModal} onOk={doOpenDoor} onCancel={() => setOpenDoorModal(false)}
        okText="Send Unlock" width={480} destroyOnHidden>
        <Alert type="info" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
          message="Sends an unlock pulse to the device relay. Duration controls how long the door stays open." />
        <Form form={openDoorForm} layout="vertical" initialValues={{ hold_seconds: 5 }}>
          <Form.Item name="sn" label="Reader / Device" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select device" optionFilterProp="label"
              options={devices.map(d => ({ value: d.sn, label: `${d.alias || d.sn} (${d.sn})` }))} />
          </Form.Item>
          <Form.Item name="hold_seconds" label="Unlock duration (seconds)">
            <Input type="number" min={1} max={30} style={{ width: 120 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Raw / custom command */}
      <Modal title={<><SendOutlined /> Send Raw Command</>}
        open={sendRawModal} onOk={doSendRaw} onCancel={() => setSendRawModal(false)}
        okText="Send" width={520} destroyOnHidden>
        <Alert type="warning" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
          message="Raw commands are queued in iclock_devcmd and delivered to the device on its next poll." />
        <Form form={rawForm} layout="vertical">
          <Form.Item name="sn" label="Device" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select device" optionFilterProp="label"
              options={devices.map(d => ({ value: d.sn, label: `${d.alias || d.sn} (${d.sn})` }))} />
          </Form.Item>
          <Form.Item name="cmd" label="Command" rules={[{ required: true, message: 'Enter a command' }]}>
            <Select mode="combobox" placeholder="Type or select command">
              {[
                'REBOOT', 'SYNCTIME', 'CLEAR LOG', 'CLEAR ATTLOG',
                'ENABLE', 'DISABLE',
                'RELAY,0,5', 'RELAY,0,10', 'RELAY,0,0',
                'DATA QUERY USERINFO', 'QUERY ATTLOG',
              ].map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Command detail drawer */}
      <Drawer
        title={detailCmd ? `Command: ${detailCmd.cmd_content.split(' ')[0]}` : ''}
        placement="right" width={520}
        open={!!detailCmd} onClose={() => setDetailCmd(null)} destroyOnClose
      >
        {detailCmd && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>DEVICE</div>
                <div style={{ fontWeight: 700 }}>{deviceLabel(detailCmd.sn)}</div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>STATUS</div>
                <Tag color={STATUS.color[detailCmd.status]} icon={STATUS.icon[detailCmd.status]}>
                  {STATUS.text[detailCmd.status]}
                </Tag>
              </Col>
            </Row>

            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>FULL COMMAND</div>
              <code style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', display: 'block', fontSize: 12 }}>
                {detailCmd.cmd_content}
              </code>
            </div>

            <Row gutter={12}>
              {[
                { label: 'Created',   val: fmt(detailCmd.cmd_commit_time) },
                { label: 'Sent',      val: fmt(detailCmd.cmd_trans_time) },
                { label: 'Completed', val: fmt(detailCmd.cmd_return_time) },
              ].map(r => (
                <Col key={r.label} span={8}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{r.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.val}</div>
                </Col>
              ))}
            </Row>

            {detailCmd.cmd_return && (
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>DEVICE RESPONSE</div>
                <TextArea value={detailCmd.cmd_return} readOnly rows={5} style={{ fontFamily: 'monospace', fontSize: 12 }} />
              </div>
            )}

            <Alert
              type={{ 0: 'info', 1: 'warning', 2: 'success', 3: 'error' }[detailCmd.status]}
              showIcon
              message={{ 0: 'Waiting for device to poll', 1: 'Command delivered, awaiting response', 2: 'Executed successfully', 3: 'Execution failed — see response above' }[detailCmd.status]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default DeviceCommands;
