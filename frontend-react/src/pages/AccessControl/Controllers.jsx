import React, { useState } from 'react';
import {
  Button, Input, Select, Switch, Tag, Tooltip, Popconfirm, Form, InputNumber,
  Space, Spin, App, Empty, Modal, Card, Collapse, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined,
  SyncOutlined, WifiOutlined, DisconnectOutlined,
  ReloadOutlined, UnlockOutlined, LoginOutlined, LogoutOutlined,
  ClusterOutlined, AimOutlined, BulbOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;
const BASE = '/api/v1/access-controllers';
const C3_MODELS = { 'C3-100': 1, 'C3-200': 2, 'C3-400': 4 };  // door counts (datasheet)

const STATUS = {
  online:  { color: '#52c41a', icon: <WifiOutlined />,       label: 'Online'  },
  offline: { color: '#8c8c8c', icon: <DisconnectOutlined />, label: 'Offline' },
  error:   { color: '#ff4d4f', icon: <DisconnectOutlined />, label: 'Error'   },
};

const fmtLastSeen = ts => {
  if (!ts) return 'Never';
  const secs = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

/* ── Reader row: assign the zone this door port controls ──────────────────── */
const ReaderRow = ({ reader, zones, onSave, onDelete, onOpen, saving }) => {
  const isEntry = reader.direction === 'ENTRY';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
      borderBottom: '1px solid #f5f5f5',
    }}>
      <Tag color={isEntry ? 'green' : 'orange'} style={{ minWidth: 92, textAlign: 'center', margin: 0 }}>
        {isEntry ? <LoginOutlined /> : <LogoutOutlined />}{' '}Door {reader.door_no} {reader.direction}
      </Tag>
      <span style={{ flex: '0 0 150px', fontSize: 12, color: '#595959' }}>
        {reader.name || '—'}
      </span>
      <Select
        size="small"
        style={{ flex: 1, minWidth: 180 }}
        placeholder="— Assign zone —"
        allowClear
        showSearch
        optionFilterProp="children"
        value={reader.zone_id || undefined}
        loading={saving}
        onChange={zid => onSave(reader, { zone_id: zid || 0 })}
      >
        {zones.map(z => <Option key={z.id} value={z.id}>{z.name}</Option>)}
      </Select>
      <Tooltip title="Pulse-open this door">
        <Button size="small" icon={<UnlockOutlined />} onClick={() => onOpen(reader.door_no)} />
      </Tooltip>
      <Popconfirm title="Remove this reader port?" onConfirm={() => onDelete(reader.id)}>
        <Button size="small" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    </div>
  );
};

/* ── One controller card ──────────────────────────────────────────────────── */
const ControllerCard = ({ ctrl, zones, api, qc }) => {
  const { message } = App.useApp();
  const st = STATUS[ctrl.status] || STATUS.offline;

  const saveReader = useMutation({
    mutationFn: ({ id, patch }) => apiService.put(`${BASE}/readers/${id}`, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ac-controllers'] }); },
    onError: e => message.error(e.message || 'Failed to update reader'),
  });
  const delReader = useMutation({
    mutationFn: id => apiService.delete(`${BASE}/readers/${id}`),
    onSuccess: () => { message.success('Reader removed'); qc.invalidateQueries({ queryKey: ['ac-controllers'] }); },
  });
  const poll = useMutation({
    mutationFn: () => apiService.post(`${BASE}/${ctrl.id}/poll`),
    onSuccess: r => { message.success(`Polled — ${r?.events ?? 0} event(s)`); qc.invalidateQueries({ queryKey: ['ac-controllers'] }); },
    onError: e => message.error(e.message || 'Poll failed'),
  });
  const openDoor = useMutation({
    mutationFn: door => apiService.post(`${BASE}/${ctrl.id}/doors/${door}/open`),
    onSuccess: r => r?.success ? message.success(r.message) : message.warning(r?.error || 'Open failed'),
  });
  const [probeResult, setProbeResult] = React.useState(null);
  const probe = useMutation({
    mutationFn: () => apiService.post(`${BASE}/${ctrl.id}/probe`),
    onSuccess: r => setProbeResult(r),
    onError: e => message.error(e.message || 'Probe failed'),
  });

  const unassigned = ctrl.readers.filter(r => !r.zone_id).length;

  return (
    <Card
      size="small"
      style={{ marginBottom: 14, borderRadius: 10 }}
      styles={{ body: { padding: 0 } }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg,#0d1117,#1a2332)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ClusterOutlined style={{ color: '#1890ff', fontSize: 18 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {ctrl.name}{' '}
            <span style={{ color: '#8c8c8c', fontWeight: 400, fontSize: 12 }}>
              {ctrl.model || 'controller'} · {ctrl.ip_address}:{ctrl.port}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            {ctrl.door_count} door(s) · {ctrl.readers.length} reader port(s)
            {unassigned > 0 && <Tag color="warning" style={{ marginLeft: 8 }}>{unassigned} unassigned</Tag>}
          </div>
        </div>
        <Tag color={st.color === '#52c41a' ? 'success' : st.color === '#ff4d4f' ? 'error' : 'default'}>
          {st.icon} {st.label}
        </Tag>
        <span style={{ fontSize: 11, color: '#bfbfbf' }}>seen {fmtLastSeen(ctrl.last_seen)}</span>
        <Space>
          <Tooltip title="Diagnose via ZKTeco PULL SDK (TCP → SDK → handshake → raw event sample)">
            <Button size="small" icon={<ApiOutlined />} loading={probe.isPending} onClick={() => probe.mutate()}>Probe</Button>
          </Tooltip>
          <Tooltip title="Poll buffered events now → zone occupancy">
            <Button size="small" icon={<SyncOutlined />} loading={poll.isPending} onClick={() => poll.mutate()} />
          </Tooltip>
          <Tooltip title="Learn mode — badge at each reader to discover & map its port">
            <Button size="small" icon={<AimOutlined />} onClick={() => api.learn(ctrl)}>Learn</Button>
          </Tooltip>
          <Tooltip title="Edit controller"><Button size="small" icon={<EditOutlined />} onClick={() => api.edit(ctrl)} /></Tooltip>
          <Popconfirm title="Delete this controller and all its readers?" onConfirm={() => api.remove(ctrl.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>

      {ctrl.last_error && (
        <div style={{ padding: '0 16px 8px', color: '#ff4d4f', fontSize: 12 }}>⚠ {ctrl.last_error}</div>
      )}

      {/* readers */}
      <Collapse
        ghost
        items={[{
          key: 'readers',
          label: <span style={{ fontWeight: 600, fontSize: 13 }}>Reader ports & zone assignment</span>,
          children: (
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}>
              {ctrl.readers.length === 0
                ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No reader ports" />
                : ctrl.readers.map(r => (
                  <ReaderRow
                    key={r.id}
                    reader={r}
                    zones={zones}
                    saving={saveReader.isPending}
                    onSave={(reader, patch) => saveReader.mutate({ id: reader.id, patch })}
                    onDelete={id => delReader.mutate(id)}
                    onOpen={door => openDoor.mutate(door)}
                  />
                ))}
              <div style={{ padding: 10 }}>
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => api.addReader(ctrl)}>
                  Add reader port
                </Button>
              </div>
            </div>
          ),
        }]}
      />

      <Modal
        open={!!probeResult}
        title={<span><ApiOutlined /> Probe — {ctrl.name}</span>}
        onCancel={() => setProbeResult(null)}
        footer={<Button onClick={() => setProbeResult(null)}>Close</Button>}
        width={640}
      >
        {probeResult && (
          <div>
            <div style={{ marginBottom: 12 }}>
              {(probeResult.steps || []).map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                  <Tag color={s.ok ? 'success' : 'error'}>{s.ok ? '✓' : '✗'}</Tag>
                  <b style={{ minWidth: 110 }}>{s.step}</b>
                  <span style={{ color: '#8c8c8c', fontSize: 12 }}>{s.detail}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
              {probeResult.summary}
            </div>
            {probeResult.rtlog_raw && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                  Raw realtime-log sample{probeResult.rtlog_provisional ? ' (positional — confirm field order)' : ''}:
                </div>
                <pre style={{ background: '#0d1117', color: '#c9d1d9', padding: 10, borderRadius: 6, fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
                  {probeResult.rtlog_raw}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
};

/* ── Learn mode: badge at each reader, watch which port fires, map to zone ──── */
const firedAgo = ts => {
  if (!ts) return null;
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  return s < 8;   // "just fired" window for the highlight
};

const LearnModal = ({ ctrl, zones, open, onClose, qc }) => {
  const { message } = App.useApp();
  const [feed, setFeed] = useState([]);   // newest-first live event feed

  // Poll the controller in learn mode while the modal is open.
  const learn = useQuery({
    queryKey: ['ac-learn', ctrl?.id],
    queryFn: () => apiService.post(`${BASE}/${ctrl.id}/learn`),
    enabled: open && !!ctrl,
    refetchInterval: 2000,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    const r = learn.data;
    if (!r) return;
    if (r.error) return;
    if (Array.isArray(r.events) && r.events.length) {
      setFeed(prev => [...r.events.map(e => ({ ...e, _k: `${e.reader_id}-${e.time}` })), ...prev].slice(0, 25));
      qc.invalidateQueries({ queryKey: ['ac-controllers'] });   // refresh port list / last_event
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learn.data]);

  const assign = useMutation({
    mutationFn: ({ id, zone_id }) => apiService.put(`${BASE}/readers/${id}`, { zone_id: zone_id || 0 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ac-controllers'] }),
    onError: e => message.error(e.message || 'Failed to assign zone'),
  });

  const err = learn.data?.error;

  return (
    <Modal
      open={open}
      onCancel={() => { setFeed([]); onClose(); }}
      footer={<Button onClick={() => { setFeed([]); onClose(); }}>Done</Button>}
      width={680}
      title={<span><AimOutlined /> Learn Mode — {ctrl?.name}</span>}
      destroyOnClose
    >
      <div style={{
        background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8,
        padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#0958d9',
      }}>
        <BulbOutlined /> Badge a card at each physical reader. The port it's wired to
        will light up below — name it and assign its zone. New ports are added
        automatically as they fire. (This does not move anyone in/out of a zone.)
      </div>

      {err && (
        <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 8, padding: '8px 12px', marginBottom: 14, color: '#cf1322', fontSize: 12 }}>
          ⚠ {err} — the controller transport must be reachable & verified for learn mode to receive events.
        </div>
      )}

      {/* Live feed */}
      <div style={{ fontWeight: 600, fontSize: 12, color: '#8c8c8c', margin: '4px 0 6px' }}>
        LIVE {learn.isFetching && <SyncOutlined spin style={{ marginLeft: 6 }} />}
      </div>
      {feed.length === 0
        ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Waiting for a card to be presented…" />
        : (
          <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 16 }}>
            {feed.map((e, i) => (
              <div key={e._k + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderBottom: '1px solid #fafafa' }}>
                <Tag color={e.direction === 'ENTRY' ? 'green' : 'orange'} style={{ margin: 0 }}>
                  Door {e.door_no} {e.direction}
                </Tag>
                <span style={{ fontSize: 12, color: '#595959' }}>card/ID: {e.identity || '—'}</span>
                {e.created && <Tag color="blue">new port</Tag>}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bfbfbf' }}>
                  {new Date(e.time).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}

      {/* Discovered ports — assign zones */}
      <div style={{ fontWeight: 600, fontSize: 12, color: '#8c8c8c', margin: '4px 0 6px' }}>
        PORTS ON THIS CONTROLLER — ASSIGN ZONES
      </div>
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}>
        {(ctrl?.readers || []).length === 0
          ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No ports yet" />
          : ctrl.readers.map(r => {
            const hot = firedAgo(r.last_event_at);
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
                borderBottom: '1px solid #f5f5f5',
                background: hot ? '#f6ffed' : 'transparent', transition: 'background 1s',
              }}>
                <Tag color={r.direction === 'ENTRY' ? 'green' : 'orange'} style={{ minWidth: 92, textAlign: 'center', margin: 0 }}>
                  {r.direction === 'ENTRY' ? <LoginOutlined /> : <LogoutOutlined />}{' '}Door {r.door_no} {r.direction}
                </Tag>
                {hot && <Badge status="processing" text="just fired" />}
                <Select
                  size="small" style={{ flex: 1, minWidth: 180 }} placeholder="— Assign zone —"
                  allowClear showSearch optionFilterProp="children"
                  value={r.zone_id || undefined}
                  onChange={zid => assign.mutate({ id: r.id, zone_id: zid })}
                >
                  {zones.map(z => <Option key={z.id} value={z.id}>{z.name}</Option>)}
                </Select>
              </div>
            );
          })}
      </div>
    </Modal>
  );
};

/* ── Page ─────────────────────────────────────────────────────────────────── */
const Controllers = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);   // {mode:'create'|'edit', ctrl?} | {mode:'reader', ctrl}
  const [learnId, setLearnId] = useState(null);
  const [form] = Form.useForm();

  const { data: controllers = [], isLoading } = useQuery({
    queryKey: ['ac-controllers'],
    queryFn: () => apiService.get(BASE),
    refetchInterval: 15000,
  });

  const { data: zonesRaw } = useQuery({
    queryKey: ['zones-list'],
    queryFn: () => apiService.get('/api/v1/zones/'),
  });
  const zones = Array.isArray(zonesRaw) ? zonesRaw : (zonesRaw?.zones || zonesRaw?.items || []);

  const saveCtrl = useMutation({
    mutationFn: v => modal?.ctrl
      ? apiService.put(`${BASE}/${modal.ctrl.id}`, v)
      : apiService.post(BASE, v),
    onSuccess: () => {
      message.success(modal?.ctrl ? 'Controller updated' : 'Controller added');
      qc.invalidateQueries({ queryKey: ['ac-controllers'] });
      setModal(null); form.resetFields();
    },
    onError: e => message.error(e.message || 'Save failed'),
  });
  const removeCtrl = useMutation({
    mutationFn: id => apiService.delete(`${BASE}/${id}`),
    onSuccess: () => { message.success('Controller deleted'); qc.invalidateQueries({ queryKey: ['ac-controllers'] }); },
  });
  const addReader = useMutation({
    mutationFn: ({ ctrlId, v }) => apiService.post(`${BASE}/${ctrlId}/readers`, v),
    onSuccess: () => { message.success('Reader added'); qc.invalidateQueries({ queryKey: ['ac-controllers'] }); setModal(null); form.resetFields(); },
    onError: e => message.error(e.message || 'Add failed'),
  });

  const cardApi = {
    edit: ctrl => { setModal({ mode: 'edit', ctrl }); form.setFieldsValue(ctrl); },
    remove: id => removeCtrl.mutate(id),
    addReader: ctrl => { setModal({ mode: 'reader', ctrl }); form.resetFields(); form.setFieldsValue({ direction: 'ENTRY', door_no: 1 }); },
    learn: ctrl => setLearnId(ctrl.id),
  };

  const learnCtrl = controllers.find(c => c.id === learnId) || null;

  const submit = async () => {
    const v = await form.validateFields();
    if (modal.mode === 'reader') addReader.mutate({ ctrlId: modal.ctrl.id, v });
    else saveCtrl.mutate(v);
  };

  return (
    <div style={{ padding: 20, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}><ClusterOutlined /> Access Control Controllers</h2>
          <div style={{ color: '#8c8c8c', fontSize: 13 }}>
            LAN panels (inBio / C3) with Wiegand readers. One IP per controller; assign each
            door's IN/OUT reader to a zone for entry/exit tracking.
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['ac-controllers'] })}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { setModal({ mode: 'create' }); form.resetFields(); form.setFieldsValue({ port: 4370, door_count: 2, poll_interval_sec: 5 }); }}>
            Add Controller
          </Button>
        </Space>
      </div>

      {isLoading
        ? <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        : controllers.length === 0
          ? <Empty description="No access controllers yet. Add one to begin." style={{ padding: 60 }} />
          : controllers.map(c => <ControllerCard key={c.id} ctrl={c} zones={zones} api={cardApi} qc={qc} />)
      }

      {/* Learn mode */}
      <LearnModal
        ctrl={learnCtrl}
        zones={zones}
        open={!!learnCtrl}
        onClose={() => setLearnId(null)}
        qc={qc}
      />

      {/* Create / edit controller, or add reader */}
      <Modal
        open={!!modal}
        title={modal?.mode === 'reader' ? `Add reader — ${modal?.ctrl?.name}`
          : modal?.ctrl ? 'Edit Controller' : 'Add Controller'}
        onCancel={() => { setModal(null); form.resetFields(); }}
        onOk={submit}
        confirmLoading={saveCtrl.isPending || addReader.isPending}
        okText="Save"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          {modal?.mode === 'reader' ? (
            <>
              <Form.Item name="door_no" label="Door number" rules={[{ required: true }]}>
                <InputNumber min={1} max={8} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="direction" label="Direction" rules={[{ required: true }]}>
                <Select>
                  <Option value="ENTRY">ENTRY (in reader)</Option>
                  <Option value="EXIT">EXIT (out reader)</Option>
                </Select>
              </Form.Item>
              <Form.Item name="name" label="Label"><Input placeholder="e.g. Gate 1 Entry" /></Form.Item>
              <Form.Item name="zone_id" label="Zone">
                <Select allowClear showSearch optionFilterProp="children" placeholder="— Assign zone —">
                  {zones.map(z => <Option key={z.id} value={z.id}>{z.name}</Option>)}
                </Select>
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Main Gate Controller" />
              </Form.Item>
              <Space style={{ display: 'flex' }} align="start">
                <Form.Item name="ip_address" label="IP address" rules={[{ required: true }]} style={{ flex: 1 }}>
                  <Input placeholder="192.168.1.50" />
                </Form.Item>
                <Form.Item name="port" label="Port"><InputNumber min={1} max={65535} /></Form.Item>
              </Space>
              <Space style={{ display: 'flex' }} align="start">
                <Form.Item name="model" label="Model" style={{ flex: 1 }}
                  tooltip="Picking a C3 model sets the door count and the correct reader layout">
                  <Select
                    placeholder="Select model"
                    onChange={m => {
                      const doors = C3_MODELS[m];
                      if (doors) form.setFieldsValue({ door_count: doors });
                    }}
                    options={[
                      { value: 'C3-100', label: 'ZKTeco C3-100 (1 door)' },
                      { value: 'C3-200', label: 'ZKTeco C3-200 (2 doors)' },
                      { value: 'C3-400', label: 'ZKTeco C3-400 (4 doors)' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="door_count" label="Doors"
                  tooltip="C3-100/200 seed IN+OUT per door; C3-400 seeds entry-only per door (exit by button)">
                  <InputNumber min={1} max={8} />
                </Form.Item>
              </Space>
              <Form.Item name="serial_number" label="Serial number"><Input /></Form.Item>
              <Form.Item name="comm_password" label="Comm password" tooltip="Panel communication password, if set">
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Space>
                <Form.Item name="poll_enabled" label="Auto-poll" valuePropName="checked"><Switch /></Form.Item>
                <Form.Item name="poll_interval_sec" label="Interval (s)"><InputNumber min={1} max={3600} /></Form.Item>
              </Space>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default Controllers;
