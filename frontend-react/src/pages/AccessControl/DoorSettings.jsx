import React, { useState, useCallback, useMemo } from 'react';
import {
  Button, Input, Select, Switch, Tag, Tooltip, Popconfirm, Form, InputNumber,
  Space, Spin, App, Empty, Modal, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined,
  ThunderboltOutlined, SyncOutlined, WifiOutlined, DisconnectOutlined,
  SearchOutlined, CloseOutlined, SaveOutlined, ReloadOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;

const SENSOR_TYPES = [
  { v: 0, l: 'None' },
  { v: 1, l: 'Normally Open (NO)' },
  { v: 2, l: 'Normally Closed (NC)' },
];
const APB_MODES = [
  { v: 0, l: 'None' },
  { v: 1, l: 'Entry-Exit' },
  { v: 2, l: 'Strict' },
];
const EMG_ACTIONS = [
  { v: 0, l: 'Ignore' },
  { v: 1, l: 'Lock' },
  { v: 2, l: 'Unlock' },
];
const READER_PURPOSE_LABELS = {
  ATTENDANCE:   { label: 'Attendance',   color: '#1677ff' },
  ACCESS_ENTRY: { label: 'Entry Reader', color: '#52c41a' },
  ACCESS_EXIT:  { label: 'Exit Reader',  color: '#fa8c16' },
};

const C = {
  bg: '#f0f2f5',
  panel: 'white',
  border: '#f0f0f0',
  selBg: '#e6f4ff',
  darkHeader: 'linear-gradient(135deg, #0d1117 0%, #1a2332 50%, #0d2137 100%)',
};

const fmtLastSeen = ts => {
  if (!ts) return 'Never';
  const secs = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

const PropRow = ({ label, value }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid #f5f5f5',
  }}>
    <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: 13, color: '#141414', fontWeight: 600 }}>{value}</span>
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: '#8c8c8c',
    letterSpacing: '0.8px', textTransform: 'uppercase', margin: '20px 0 10px',
  }}>{children}</div>
);

const FeaturePill = ({ active, color, label }) => {
  const colors = {
    blue:    { bg: '#e6f4ff', border: '#91caff', text: '#1677ff' },
    orange:  { bg: '#fff7e6', border: '#ffd591', text: '#fa8c16' },
    red:     { bg: '#fff1f0', border: '#ffa39e', text: '#f5222d' },
    default: { bg: '#fafafa', border: '#e8e8e8', text: '#8c8c8c' },
  };
  const c = active ? (colors[color] || colors.default) : colors.default;
  return (
    <div style={{
      padding: '8px 16px', borderRadius: 8,
      background: c.bg, border: `1px solid ${c.border}`,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? c.text : '#d9d9d9' }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{label}</span>
    </div>
  );
};

const DoorSettings = () => {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [selId, setSelId]       = useState(null);
  const [search, setSearch]     = useState('');
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding]     = useState(false);
  const [syncing, setSyncing]   = useState(new Set());
  const [opening, setOpening]   = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['acc-doors'],
    queryFn: () => apiService.get('/api/access-control/doors/'),
    refetchInterval: 30_000,   // poll every 30 s for real-time status
  });
  const doors = data?.data || (Array.isArray(data) ? data : []);

  // Dedicated AC-terminals endpoint — returns terminals enriched with
  // online status, current door assignment, and zone info.
  const { data: termData } = useQuery({
    queryKey: ['ac-terminals'],
    queryFn: () => apiService.get('/api/access-control/terminals/'),
    refetchInterval: 30_000,
  });
  const terminals = termData?.data || (Array.isArray(termData) ? termData : []);

  // Access controllers (C3/inBio panels) — a door is a port on a controller.
  const { data: ctrlData } = useQuery({
    queryKey: ['ac-controllers'],
    queryFn: () => apiService.get('/api/v1/access-controllers'),
    refetchInterval: 60_000,
  });
  const controllers = Array.isArray(ctrlData) ? ctrlData : (ctrlData?.data || []);

  // Recent events for the selected door
  const { data: eventsData, isFetching: eventsFetching } = useQuery({
    queryKey: ['acc-door-events', selId],
    queryFn: () =>
      apiService.get(`/api/access-control/events/?door_id=${selId}&limit=15`)
        .catch(() => ({ data: [] })),
    enabled: !!selId,
  });
  const events = eventsData?.data || eventsData?.results || [];

  // Access levels assigned to the selected door
  const { data: levelData } = useQuery({
    queryKey: ['acc-door-levels', selId],
    queryFn: async () => {
      const all = await apiService.get('/api/access-control/levels/');
      const levels = all?.data || [];
      // filter to levels that contain this door
      const filtered = [];
      for (const lvl of levels) {
        const detail = await apiService.get(`/api/access-control/levels/${lvl.id}/doors/`)
          .catch(() => ({ data: [] }));
        const doorList = detail?.data || [];
        if (doorList.some(d => d.door_id === selId || d.id === selId)) {
          filtered.push(lvl);
        }
      }
      return filtered;
    },
    enabled: !!selId,
  });
  const assignedLevels = levelData || [];

  // ── Derived state ────────────────────────────────────────────────────
  const selDoor = useMemo(() => doors.find(d => d.id === selId) || null, [doors, selId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? doors.filter(d =>
          d.door_name?.toLowerCase().includes(q) ||
          d.terminal_sn?.toLowerCase().includes(q))
      : doors;
  }, [doors, search]);

  const onlineCount  = doors.filter(d => d.is_online).length;
  const offlineCount = doors.length - onlineCount;
  const apbCount     = doors.filter(d => d.anti_passback > 0).length;

  // ── Mutations ────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: v => adding
      ? apiService.post('/api/access-control/doors/', v)
      : apiService.put(`/api/access-control/doors/${selId}`, v),
    onSuccess: res => {
      message.success(adding ? 'Door created' : 'Door updated');
      qc.invalidateQueries(['acc-doors']);
      qc.invalidateQueries(['ac-terminals']);
      if (adding) {
        setAdding(false);
        setSelId(res?.data?.id ?? null);
      }
      setEditMode(false);
    },
    onError: e => message.error(e?.response?.data?.detail || e?.message || 'Error saving'),
  });

  const doDelete = useCallback((id, force = false) => {
    return apiService.delete(`/api/access-control/doors/${id}${force ? '?force=true' : ''}`);
  }, []);

  const del = useMutation({
    mutationFn: id => doDelete(id, false),
    onSuccess: () => {
      message.success('Door deleted');
      qc.invalidateQueries(['acc-doors']);
      qc.invalidateQueries(['ac-terminals']);
      setSelId(null);
      setEditMode(false);
    },
    onError: e => {
      const msg = e?.message || '';
      // Extract event count from error message if present
      const match = msg.match(/(\d+)\s+access event/);
      const count = match ? parseInt(match[1]) : null;
      modal.confirm({
        title: 'Door has access history',
        icon: <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />,
        content: (
          <div>
            <p>{count
              ? `This door has ${count} access event record(s) in the log.`
              : 'This door has access event records in the log.'
            }</p>
            <p style={{ color: '#8c8c8c', fontSize: 13 }}>
              Force-deleting will permanently remove the door <strong>and all its event history</strong>.
            </p>
          </div>
        ),
        okText: 'Delete with history',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: () => doDelete(selId, true).then(() => {
          message.success('Door and event history deleted');
          qc.invalidateQueries(['acc-doors']);
          qc.invalidateQueries(['ac-terminals']);
          setSelId(null);
          setEditMode(false);
        }).catch(e2 => message.error(e2?.message || 'Force delete failed')),
      });
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────
  const remoteOpen = useCallback(async () => {
    if (!selId) return;
    setOpening(true);
    try {
      await apiService.post(`/api/access-control/doors/${selId}/open/`);
      message.success('Door open command sent');
      qc.invalidateQueries(['acc-door-events', selId]);
    } catch (e) {
      message.error(e?.message || 'Open command failed');
    } finally {
      setOpening(false);
    }
  }, [selId, message, qc]);

  const syncDoor = useCallback(async id => {
    setSyncing(s => { const n = new Set(s); n.add(id); return n; });
    try {
      await apiService.post(`/api/access-control/doors/${id}/sync/`);
      message.success('Sync queued');
    } catch { message.error('Sync failed'); }
    finally { setSyncing(s => { const n = new Set(s); n.delete(id); return n; }); }
  }, [message]);

  const startAdd = () => {
    form.resetFields();
    form.setFieldsValue({ relay_time: 5, alarm_delay: 30, open_duration: 15, anti_passback: 0, emergency_action: 0, door_sensor_type: 0, interlock_group: 0 });
    setSelId(null);
    setEditMode(false);
    setAdding(true);
  };

  const startEdit = () => {
    if (!selDoor) return;
    form.setFieldsValue({ ...selDoor });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setAdding(false);
  };

  const selectDoor = id => {
    setSelId(id);
    setEditMode(false);
    setAdding(false);
  };

  // ── Right panel sub-renders ──────────────────────────────────────────
  const renderConfigView = () => {
    if (!selDoor) return null;
    const sensor = SENSOR_TYPES.find(x => x.v === selDoor.door_sensor_type)?.l || 'None';
    const apb    = APB_MODES.find(x => x.v === selDoor.anti_passback)?.l || 'None';
    const emg    = EMG_ACTIONS.find(x => x.v === selDoor.emergency_action)?.l || 'Ignore';
    const term   = terminals.find(t => t.sn === selDoor.terminal_sn);
    const rpInfo = READER_PURPOSE_LABELS[term?.reader_purpose] || null;

    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        <SectionLabel>Configuration</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <div>
            <PropRow label="Door Sensor Type" value={sensor} />
            <PropRow label="Anti-Passback Mode" value={
              <Tag color={selDoor.anti_passback > 0 ? 'warning' : 'default'} style={{ borderRadius: 4 }}>{apb}</Tag>
            } />
            <PropRow label="Emergency Action" value={
              <Tag
                color={selDoor.emergency_action === 1 ? 'error' : selDoor.emergency_action === 2 ? 'success' : 'default'}
                style={{ borderRadius: 4 }}
              >{emg}</Tag>
            } />
            <PropRow label="Interlock Group" value={selDoor.interlock_group > 0 ? `Group ${selDoor.interlock_group}` : 'None'} />
          </div>
          <div>
            <PropRow label="Relay Time"    value={`${selDoor.relay_time ?? 5} s`} />
            <PropRow label="Alarm Delay"   value={`${selDoor.alarm_delay ?? 30} s`} />
            <PropRow label="Open Duration" value={`${selDoor.open_duration ?? 15} s`} />
            <PropRow label="Terminal SN"   value={
              <Space size={6}>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{selDoor.terminal_sn || '—'}</span>
                {term && (
                  <Badge
                    status={term.is_online ? 'success' : 'error'}
                    text={
                      <span style={{ fontSize: 11, color: term.is_online ? '#52c41a' : '#f5222d' }}>
                        {term.is_online
                          ? 'Online'
                          : `Offline · last seen ${fmtLastSeen(term.last_seen || selDoor.terminal_last_seen)}`}
                      </span>
                    }
                  />
                )}
              </Space>
            } />
            {term?.zone_name && (
              <PropRow label="Zone" value={
                <Tag color="blue" style={{ borderRadius: 4 }}>{term.zone_name}</Tag>
              } />
            )}
            {rpInfo && (
              <PropRow label="Reader Purpose" value={
                <Tag style={{ borderRadius: 4, color: rpInfo.color, borderColor: rpInfo.color, background: rpInfo.color + '18' }}>
                  {rpInfo.label}
                </Tag>
              } />
            )}
          </div>
        </div>

        <SectionLabel>Features</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <FeaturePill active={selDoor.first_card_open} color="blue"   label="First Card Open" />
          <FeaturePill active={selDoor.mustering_mode}  color="orange" label="Mustering Mode"  />
          <FeaturePill active={selDoor.fire_linkage}    color="red"    label="Fire Linkage"    />
        </div>

        {assignedLevels.length > 0 && (
          <>
            <SectionLabel>Assigned Access Levels</SectionLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {assignedLevels.map(lvl => (
                <Tag
                  key={lvl.id}
                  icon={<CheckCircleOutlined />}
                  color="green"
                  style={{ borderRadius: 6, padding: '3px 10px', fontSize: 12 }}
                >
                  {lvl.level_name || lvl.name}
                </Tag>
              ))}
            </div>
          </>
        )}

        <SectionLabel>
          Recent Events{' '}
          {eventsFetching && <Spin size="small" style={{ marginLeft: 8 }} />}
        </SectionLabel>
        {events.length === 0 ? (
          <div style={{ color: '#bfbfbf', fontSize: 13, padding: '8px 0' }}>No recent events for this door</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {events.slice(0, 10).map((ev, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', borderRadius: 8,
                background: '#fafafa', border: '1px solid #f0f0f0',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: ev.event_type === 5 ? '#52c41a' : ev.event_type === 6 ? '#f5222d' : '#1677ff',
                }} />
                <span style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace', flexShrink: 0, width: 72 }}>
                  {ev.event_time ? new Date(ev.event_time).toLocaleTimeString() : '—'}
                </span>
                <span style={{ fontSize: 12, color: '#595959', flex: 1 }}>
                  {ev.description || ev.emp_name || '—'}
                </span>
                <span style={{ fontSize: 11, color: '#bfbfbf', fontFamily: 'monospace' }}>{ev.emp_code || ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderEditForm = () => (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
      <Form form={form} layout="vertical" onFinish={v => save.mutate(v)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Form.Item name="door_name" label="Door Name" rules={[{ required: true, message: 'Required' }]}>
            <Input size="large" placeholder="e.g. Main Entrance" />
          </Form.Item>
          <Form.Item name="controller_id" label="Controller" rules={[{ required: true, message: 'Select a controller' }]}>
            <Select
              showSearch optionFilterProp="label" size="large" disabled={!adding}
              placeholder="Select controller"
              onChange={() => form.setFieldsValue({ port: undefined })}
              notFoundContent={controllers.length === 0
                ? <div style={{ padding: '12px 16px', color: '#8c8c8c', textAlign: 'center' }}>
                    <InfoCircleOutlined style={{ marginRight: 6 }} />
                    No controllers yet. Add one under Access Control &rarr; Controllers.
                  </div>
                : <Empty description="No match" />}
            >
              {controllers.map(c => (
                <Option key={c.id} value={c.id} label={`${c.name} ${c.serial_number || ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: c.status === 'online' ? '#52c41a' : '#d9d9d9' }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8c8c8c' }}>{c.model || c.serial_number || ''}</span>
                    <Tag style={{ fontSize: 10, marginLeft: 'auto' }}>{c.door_count || 0} doors</Tag>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item noStyle dependencies={['controller_id']}>
            {({ getFieldValue }) => {
              const cid = getFieldValue('controller_id');
              const ctrl = controllers.find(c => c.id === cid);
              const doorCount = ctrl?.door_count || 0;
              return (
                <Form.Item name="port" label="Terminal / Port" rules={[{ required: true, message: 'Select a port' }]}>
                  <Select size="large" disabled={!cid || !adding} placeholder={cid ? 'Select port' : 'Select a controller first'}>
                    {Array.from({ length: doorCount }, (_, k) => k + 1).map(p => (
                      <Option key={p} value={p}>Port {p}</Option>
                    ))}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>
        </div>

        <SectionLabel>Timing</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 20px' }}>
          <Form.Item name="relay_time" label="Relay Time (s)">
            <InputNumber min={1} max={60} size="large" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="alarm_delay" label="Alarm Delay (s)">
            <InputNumber min={0} max={300} size="large" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="open_duration" label="Open Duration (s)">
            <InputNumber min={1} max={120} size="large" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <SectionLabel>Access Control</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 20px' }}>
          <Form.Item name="door_sensor_type" label="Sensor Type">
            <Select size="large">
              {SENSOR_TYPES.map(x => <Option key={x.v} value={x.v}>{x.l}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="anti_passback" label="Anti-Passback">
            <Select size="large">
              {APB_MODES.map(x => <Option key={x.v} value={x.v}>{x.l}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="emergency_action" label="Emergency Action">
            <Select size="large">
              {EMG_ACTIONS.map(x => <Option key={x.v} value={x.v}>{x.l}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="interlock_group" label="Interlock Group (0 = off)">
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber min={0} max={20} size="large" style={{ width: '100%' }} />
            </Space.Compact>
          </Form.Item>
        </div>

        <SectionLabel>Features</SectionLabel>
        <div style={{ display: 'flex', gap: 40, paddingBottom: 8 }}>
          <Form.Item name="first_card_open" valuePropName="checked" label="First Card Open" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="mustering_mode" valuePropName="checked" label="Mustering Mode" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="fire_linkage" valuePropName="checked" label="Fire Linkage" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
        </div>
      </Form>
    </div>
  );

  const renderEmpty = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <ApiOutlined style={{ fontSize: 52, color: '#d9d9d9' }} />
      <div style={{ fontSize: 15, color: '#8c8c8c', fontWeight: 500 }}>Select a door to view details</div>
      <div style={{ color: '#bfbfbf', fontSize: 13 }}>or</div>
      <Button type="primary" icon={<PlusOutlined />} onClick={startAdd}>Add Door</Button>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>

      {/* Top header */}
      <div style={{
        background: C.darkHeader,
        padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <Space size={14}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #2f54eb, #1d39c4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(47,84,235,0.4)',
          }}>
            <ApiOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Door Settings</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
              {doors.length} door{doors.length !== 1 ? 's' : ''} &bull; {onlineCount} online &bull; {offlineCount} offline
            </div>
          </div>
        </Space>
        <Space size={8}>
          {[
            { label: 'Online',    value: onlineCount,       color: '#52c41a' },
            { label: 'Offline',   value: offlineCount,      color: '#f5222d' },
            { label: 'APB',       value: apbCount,          color: '#fa8c16' },
            { label: 'Terminals', value: terminals.length,  color: '#1677ff' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700 }}>{s.value}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{s.label}</span>
            </div>
          ))}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { refetch(); qc.invalidateQueries(['ac-terminals']); }}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
          />
        </Space>
      </div>

      {/* Split panel body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel ────────────────────────────────────────── */}
        <div style={{
          width: 280, flexShrink: 0,
          background: C.panel,
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <Button
              type="primary" icon={<PlusOutlined />} block onClick={startAdd}
              style={{ borderRadius: 8, marginBottom: 8, fontWeight: 600 }}
            >
              Add Door
            </Button>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search doors…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#bfbfbf', fontSize: 13 }}>No doors found</div>
            ) : filtered.map(door => {
              const selected = door.id === selId;
              return (
                <div
                  key={door.id}
                  onClick={() => selectDoor(door.id)}
                  style={{
                    padding: '11px 14px',
                    cursor: 'pointer',
                    background: selected ? C.selBg : 'transparent',
                    borderLeft: `3px solid ${selected ? '#1677ff' : 'transparent'}`,
                    borderBottom: `1px solid ${C.border}`,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f9f9f9'; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? C.selBg : 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: door.is_online
                        ? 'linear-gradient(135deg, #52c41a, #237804)'
                        : 'linear-gradient(135deg, #bfbfbf, #8c8c8c)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} className={door.is_online ? 'ac-online-pulse' : ''}>
                      <ApiOutlined style={{ color: 'white', fontSize: 16 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13, color: '#141414',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {door.door_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        {door.is_online
                          ? <WifiOutlined style={{ fontSize: 10, color: '#52c41a' }} />
                          : <DisconnectOutlined style={{ fontSize: 10, color: '#f5222d' }} />}
                        <span style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>
                          {door.terminal_sn || 'No terminal'}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '2px 6px', flexShrink: 0,
                      background: door.is_online ? '#f6ffed' : '#fff1f0',
                      color: door.is_online ? '#52c41a' : '#f5222d',
                      letterSpacing: '0.4px',
                    }}>
                      {door.is_online ? 'ON' : 'OFF'}
                    </div>
                  </div>

                  {(door.first_card_open || door.mustering_mode || door.fire_linkage || door.interlock_group > 0) && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, paddingLeft: 46, flexWrap: 'wrap' }}>
                      {door.first_card_open   && <Tag color="blue"   style={{ fontSize: 9, padding: '0 4px', margin: 0, borderRadius: 4 }}>1ST</Tag>}
                      {door.mustering_mode    && <Tag color="orange" style={{ fontSize: 9, padding: '0 4px', margin: 0, borderRadius: 4 }}>MST</Tag>}
                      {door.fire_linkage      && <Tag color="red"    style={{ fontSize: 9, padding: '0 4px', margin: 0, borderRadius: 4 }}>FIRE</Tag>}
                      {door.interlock_group > 0 && <Tag color="purple" style={{ fontSize: 9, padding: '0 4px', margin: 0, borderRadius: 4 }}>ILK{door.interlock_group}</Tag>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8f9fb' }}>

          {adding ? (
            <>
              <div style={{
                background: 'linear-gradient(135deg, #002766, #003a8c)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexShrink: 0,
              }}>
                <Space size={12}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PlusOutlined style={{ color: 'white', fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>New Door</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Configure hardware parameters</div>
                  </div>
                </Space>
                <Space>
                  <Button onClick={cancelEdit} icon={<CloseOutlined />}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
                    Cancel
                  </Button>
                  <Button type="primary" loading={save.isPending} icon={<SaveOutlined />}
                    onClick={() => form.submit()} style={{ fontWeight: 600 }}>
                    Create Door
                  </Button>
                </Space>
              </div>
              {renderEditForm()}
            </>

          ) : selDoor ? (
            <>
              <div style={{
                background: selDoor.is_online
                  ? 'linear-gradient(135deg, #092b00, #135200)'
                  : 'linear-gradient(135deg, #1c1c1c, #2d2d2d)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexShrink: 0,
              }}>
                <Space size={14}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 14, position: 'relative',
                    background: selDoor.is_online
                      ? 'linear-gradient(135deg, #52c41a, #237804)'
                      : 'linear-gradient(135deg, #595959, #262626)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 14px ${selDoor.is_online ? 'rgba(82,196,26,0.5)' : 'rgba(0,0,0,0.4)'}`,
                  }}>
                    <ApiOutlined style={{ color: 'white', fontSize: 22 }} />
                    {selDoor.is_online && (
                      <div style={{
                        position: 'absolute', top: -2, right: -2,
                        width: 12, height: 12, borderRadius: '50%',
                        background: '#52c41a', border: '2px solid white',
                      }} />
                    )}
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{selDoor.door_name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'monospace' }}>{selDoor.terminal_sn || 'No terminal'}</span>
                      {selDoor.terminal_name && selDoor.terminal_name !== selDoor.terminal_sn && (
                        <span style={{ color: 'rgba(255,255,255,0.35)' }}>({selDoor.terminal_name})</span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '1px 7px',
                        background: selDoor.is_online ? 'rgba(82,196,26,0.15)' : 'rgba(245,34,45,0.15)',
                        color: selDoor.is_online ? '#52c41a' : '#f5222d',
                        border: `1px solid ${selDoor.is_online ? 'rgba(82,196,26,0.4)' : 'rgba(245,34,45,0.4)'}`,
                      }}>
                        {selDoor.is_online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                </Space>

                <Space size={8}>
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    disabled={!selDoor.is_online}
                    loading={opening}
                    onClick={remoteOpen}
                    size="middle"
                    style={{
                      background: selDoor.is_online ? '#52c41a' : undefined,
                      borderColor: selDoor.is_online ? '#52c41a' : undefined,
                      fontWeight: 700, borderRadius: 8,
                    }}
                  >
                    Remote Open
                  </Button>
                  <Tooltip title="Sync to device">
                    <Button
                      icon={<SyncOutlined spin={syncing.has(selDoor.id)} />}
                      onClick={() => syncDoor(selDoor.id)}
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                    />
                  </Tooltip>

                  {editMode ? (
                    <>
                      <Button onClick={cancelEdit} icon={<CloseOutlined />}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>
                        Cancel
                      </Button>
                      <Button type="primary" loading={save.isPending} icon={<SaveOutlined />}
                        onClick={() => form.submit()} style={{ fontWeight: 600 }}>
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button icon={<EditOutlined />} onClick={startEdit}
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>
                      Edit
                    </Button>
                  )}

                  <Popconfirm
                    title="Delete this door?"
                    description="This will also remove all access level links for this door."
                    okText="Delete" okType="danger"
                    onConfirm={() => del.mutate(selDoor.id)}
                  >
                    <Button danger icon={<DeleteOutlined />}
                      loading={del.isPending}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(245,34,45,0.5)' }}
                    />
                  </Popconfirm>
                </Space>
              </div>

              {editMode ? renderEditForm() : renderConfigView()}
            </>

          ) : renderEmpty()}
        </div>
      </div>
    </div>
  );
};

export default DoorSettings;
