import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Button, Form, Input, Tag, Tooltip, Select,
  Popconfirm, Row, Col, Card, App, Badge, Tabs,
  Table, Empty, Spin, Switch, Divider, Space,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined,
  ApiOutlined, ClockCircleOutlined, MinusCircleOutlined, TeamOutlined,
  SearchOutlined, CheckOutlined, CloseOutlined, SaveOutlined,
  ReloadOutlined, CopyOutlined, ExclamationCircleOutlined,
  CheckSquareOutlined, BorderOutlined, SyncOutlined, FilterOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;

// ─── tokens ──────────────────────────────────────────────────────────────────
const C = {
  blue:'#1677ff', blueBg:'#e6f4ff', blueBd:'#91caff',
  green:'#52c41a', greenBg:'#f6ffed',
  orange:'#fa8c16', orangeBg:'#fff7e6',
  red:'#ff4d4f', redBg:'#fff1f0',
  purple:'#722ed1',
  text:'#1d2939', sub:'#6b7280',
  border:'#e4e7ec', surface:'#f9fafb', white:'#ffffff',
};

// ─── Matrix cell ─────────────────────────────────────────────────────────────
const MatrixCell = React.memo(({ active, pending, onClick }) => (
  <td
    onClick={!pending ? onClick : undefined}
    style={{
      width: 52, textAlign: 'center', verticalAlign: 'middle',
      padding: '6px 4px',
      cursor: pending ? 'wait' : 'pointer',
      background: active ? '#f0f7ff' : C.white,
      borderBottom: `1px solid ${C.border}`,
      borderRight: `1px solid ${C.border}`,
      transition: 'background 0.12s',
      userSelect: 'none',
    }}
  >
    {pending
      ? <Spin size="small" />
      : active
        ? <CheckSquareOutlined style={{ fontSize: 17, color: C.blue }} />
        : <BorderOutlined      style={{ fontSize: 17, color: '#d9d9d9' }} />}
  </td>
));

// ─── Door-Timezone Matrix ─────────────────────────────────────────────────────
const DoorMatrix = ({ doors, timezones, pairs, onToggle, pending }) => {
  // Build fast lookup: pairMap[doorId][tzId] = pairId | undefined
  const pairMap = useMemo(() => {
    const m = {};
    for (const p of pairs) {
      if (!m[p.door_id]) m[p.door_id] = {};
      m[p.door_id][p.timezone_id] = p.id;
    }
    return m;
  }, [pairs]);

  if (!doors.length || !timezones.length) {
    return (
      <Empty
        description={
          !doors.length
            ? 'No doors configured yet — add doors in the Doors tab first'
            : 'No time zones configured yet — add time zones in the Time Zones tab first'
        }
        style={{ padding: 40 }}
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 400 }}>
        {/* Header row */}
        <thead>
          <tr>
            {/* Door name column */}
            <th style={{
              position: 'sticky', left: 0, zIndex: 2,
              background: '#f0f2f5', padding: '9px 14px',
              borderBottom: `2px solid ${C.border}`, borderRight: `2px solid ${C.border}`,
              fontSize: 12, fontWeight: 700, color: C.text,
              textAlign: 'left', minWidth: 200,
              whiteSpace: 'nowrap',
            }}>
              <ApiOutlined style={{ marginRight: 6, color: C.blue }} />
              Door / Reader
            </th>
            {timezones.map(tz => (
              <th key={tz.id} style={{
                background: '#f0f2f5', padding: '9px 6px',
                borderBottom: `2px solid ${C.border}`, borderRight: `1px solid ${C.border}`,
                fontSize: 11, fontWeight: 600, color: C.sub,
                textAlign: 'center', minWidth: 52, maxWidth: 80,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                <Tooltip title={tz.timezone_name}>
                  <span>
                    <ClockCircleOutlined style={{ fontSize: 10, color: C.green, marginRight: 3 }} />
                    {tz.timezone_name.length > 10
                      ? tz.timezone_name.slice(0, 9) + '…'
                      : tz.timezone_name}
                  </span>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doors.map((door, idx) => (
            <tr key={door.id} style={{ background: idx % 2 === 0 ? C.white : C.surface }}>
              {/* Door name — sticky */}
              <td style={{
                position: 'sticky', left: 0, zIndex: 1,
                background: idx % 2 === 0 ? C.white : C.surface,
                padding: '8px 14px',
                borderBottom: `1px solid ${C.border}`, borderRight: `2px solid ${C.border}`,
                fontSize: 13, fontWeight: 500, color: C.text,
                whiteSpace: 'nowrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: door.status === 'open' ? C.green : C.border,
                    flexShrink: 0,
                  }} />
                  {door.door_name || door.name}
                  {door.door_no && (
                    <span style={{ fontSize: 11, color: C.sub }}>#{door.door_no}</span>
                  )}
                </div>
              </td>
              {/* Timezone cells */}
              {timezones.map(tz => {
                const pairId = pairMap[door.id]?.[tz.id];
                const key    = `${door.id}-${tz.id}`;
                return (
                  <MatrixCell
                    key={key}
                    active={!!pairId}
                    pending={pending.has(key)}
                    onClick={() => onToggle(door.id, tz.id, pairId)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Stat pill ────────────────────────────────────────────────────────────────
const StatChip = ({ icon: Icon, label, value, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px',
  }}>
    <Icon style={{ color, fontSize: 18 }} />
    <div>
      <div style={{ color: 'white', fontWeight: 700, fontSize: 18, lineHeight: 1 }}>{value}</div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{label}</div>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const AccessLevelManagement = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [selId, setSelId]       = useState(null);
  const [search, setSearch]     = useState('');
  const [editing, setEditing]   = useState(false);   // true = edit panel open
  const [isNew, setIsNew]       = useState(false);
  const [form]                  = Form.useForm();
  const [pending, setPending]   = useState(new Set()); // cells being toggled
  const [doorFilter, setDFilter]= useState('');

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: levData, isLoading: levLoading, refetch: refetchLevels } = useQuery({
    queryKey: ['acc-levels'],
    queryFn: () => apiService.get('/api/access-control/levels/'),
  });
  const levels = useMemo(() => levData?.data || [], [levData]);
  const selLevel = levels.find(l => l.id === selId) || null;

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn: () => apiService.get('/api/access-control/doors/'),
  });
  const allDoors = doorsData?.data || [];

  const { data: tzData } = useQuery({
    queryKey: ['acc-timezones'],
    queryFn: () => apiService.get('/api/access-control/timezones/'),
  });
  const timezones = tzData?.data || [];

  const { data: pairsData, refetch: refetchPairs, isFetching: pairsBusy } = useQuery({
    queryKey: ['acc-level-doors', selId],
    queryFn: () => apiService.get(`/api/access-control/levels/${selId}/doors/`),
    enabled: !!selId,
  });
  const pairs = pairsData?.data || [];

  const { data: usersData, refetch: refetchUsers, isFetching: usersBusy } = useQuery({
    queryKey: ['acc-level-users', selId],
    queryFn: () => apiService.get(`/api/access-control/levels/${selId}/users/`),
    enabled: !!selId,
  });
  const levelUsers = usersData?.data || [];

  // filtered doors for matrix
  const doors = useMemo(() =>
    allDoors.filter(d =>
      !doorFilter || (d.door_name || d.name || '').toLowerCase().includes(doorFilter.toLowerCase())
    ), [allDoors, doorFilter]);

  // ── mutations ─────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: (v) => isNew
      ? apiService.post('/api/access-control/levels/', v)
      : apiService.put(`/api/access-control/levels/${selId}`, v),
    onSuccess: (res) => {
      message.success(isNew ? 'Access level created' : 'Changes saved');
      qc.invalidateQueries(['acc-levels']);
      setEditing(false);
      if (isNew && res?.data?.id) setSelId(res.data.id);
      setIsNew(false);
    },
    onError: e => message.error(e?.message || 'Error'),
  });

  const del = useMutation({
    mutationFn: (id) => apiService.delete(`/api/access-control/levels/${id}`),
    onSuccess: () => {
      message.success('Access level deleted');
      qc.invalidateQueries(['acc-levels']);
      setSelId(null);
    },
    onError: e => message.error(e?.message || 'Cannot delete access level'),
  });

  const copy = useMutation({
    mutationFn: (id) => apiService.post(`/api/access-control/levels/${id}/copy/`),
    onSuccess: (res) => {
      message.success('Level copied');
      qc.invalidateQueries(['acc-levels']);
      if (res?.data?.id) setSelId(res.data.id);
    },
    onError: e => message.error(e?.message || 'Error copying'),
  });

  const addPair = useMutation({
    mutationFn: (body) => apiService.post(`/api/access-control/levels/${selId}/doors/`, body),
    onSuccess: () => { refetchPairs(); qc.invalidateQueries(['acc-levels']); },
    onError: e => message.error(e?.message || 'Error'),
  });

  const removePair = useMutation({
    mutationFn: (pairId) => apiService.delete(`/api/access-control/levels/${selId}/doors/${pairId}`),
    onSuccess: () => { refetchPairs(); qc.invalidateQueries(['acc-levels']); },
    onError: e => message.error(e?.message || 'Error'),
  });

  const removeUser = useMutation({
    mutationFn: ({ level_id, auth_id }) =>
      apiService.delete(`/api/access-control/levels/${level_id}/users/${auth_id}`),
    onSuccess: () => { message.success('Removed'); refetchUsers(); qc.invalidateQueries(['acc-levels']); },
    onError: e => message.error(e?.message || 'Error'),
  });

  // ── matrix toggle ─────────────────────────────────────────────────────────
  const handleToggle = useCallback(async (doorId, tzId, pairId) => {
    const key = `${doorId}-${tzId}`;
    setPending(s => { const n = new Set(s); n.add(key); return n; });
    try {
      if (pairId) {
        await removePair.mutateAsync(pairId);
      } else {
        await addPair.mutateAsync({ door_id: doorId, timezone_id: tzId });
      }
    } finally {
      setPending(s => { const n = new Set(s); n.delete(key); return n; });
    }
  }, [selId, addPair, removePair]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const openNew = () => {
    form.resetFields();
    form.setFieldsValue({ is_active: true, mustering_only: false });
    setIsNew(true); setEditing(true);
    setSelId(null);
  };
  const openEdit = () => {
    if (!selLevel) return;
    form.setFieldsValue({
      level_name:     selLevel.level_name || selLevel.name || '',
      description:    selLevel.description || '',
      mustering_only: !!selLevel.mustering_only,
      is_active:      selLevel.is_active !== false,
    });
    setIsNew(false); setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setIsNew(false); form.resetFields(); };

  const filtered = useMemo(() =>
    levels.filter(l =>
      (l.level_name || l.name || '').toLowerCase().includes(search.toLowerCase())
    ), [levels, search]);

  const stats = useMemo(() => ({
    total:  levels.length,
    active: levels.filter(l => l.is_active !== false).length,
    muster: levels.filter(l => l.mustering_only).length,
    doors:  levels.reduce((s, l) => s + (l.door_count || 0), 0),
  }), [levels]);

  // ── user table cols ───────────────────────────────────────────────────────
  const userCols = [
    {
      title: 'Employee', key: 'emp',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#1677ff,#722ed1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: 'white', fontWeight: 700,
          }}>
            {(r.emp_name || r.emp_code || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{r.emp_name || '—'}</div>
            <div style={{ fontSize: 11, color: C.sub }}>{r.emp_code}</div>
          </div>
        </div>
      ),
    },
    { title: 'Valid From', dataIndex: 'valid_from', width: 110,
      render: v => v
        ? <span style={{ fontSize: 12 }}>{v}</span>
        : <span style={{ color: '#bfbfbf', fontSize: 12 }}>Always</span> },
    { title: 'Valid To', dataIndex: 'valid_to', width: 110,
      render: v => {
        if (!v) return <span style={{ color: '#bfbfbf', fontSize: 12 }}>No expiry</span>;
        const expired = new Date(v) < new Date();
        return <span style={{ fontSize: 12, color: expired ? C.red : C.text }}>{v}</span>;
      }},
    { title: '', key: 'rm', width: 46,
      render: (_, r) => (
        <Popconfirm title="Remove from this level?" onConfirm={() => removeUser.mutate({ level_id: selId, auth_id: r.id })}>
          <Button size="small" type="text" danger icon={<MinusCircleOutlined />} />
        </Popconfirm>
      )},
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh', background: C.surface }}>

      {/* ══ LEFT — Level list ══════════════════════════════════════════════ */}
      <div style={{
        width: 280, flexShrink: 0,
        background: C.white, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        height: '100vh', position: 'sticky', top: 0,
      }}>
        {/* header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>Access Levels</span>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openNew} style={{ borderRadius: 6 }}>New</Button>
          </div>
          <Input prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Search levels…" value={search} allowClear size="small"
            onChange={e => setSearch(e.target.value)} style={{ borderRadius: 6 }} />
        </div>

        {/* mini stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
          borderBottom: `1px solid ${C.border}`, background: C.surface,
        }}>
          {[
            { label: 'Total',  value: stats.total,  color: C.blue   },
            { label: 'Active', value: stats.active, color: C.green  },
            { label: 'Muster', value: stats.muster, color: C.orange },
            { label: 'Doors',  value: stats.doors,  color: C.purple },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '8px 0', textAlign: 'center',
              borderRight: i % 2 === 0 ? `1px solid ${C.border}` : 'none',
              borderBottom: i < 2 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.sub }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {levLoading && <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>}
          {!levLoading && filtered.length === 0 &&
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No levels" style={{ marginTop: 32 }} />}
          {filtered.map(lvl => {
            const active = lvl.is_active !== false;
            const sel    = lvl.id === selId;
            return (
              <div key={lvl.id} onClick={() => { setSelId(lvl.id); setEditing(false); setIsNew(false); }}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderLeft: sel ? `3px solid ${C.blue}` : '3px solid transparent',
                  background: sel ? '#f0f7ff' : 'transparent',
                  borderBottom: `1px solid ${C.border}`,
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                    background: lvl.mustering_only
                      ? 'linear-gradient(135deg,#fff7e6,#ffd591)'
                      : sel ? 'linear-gradient(135deg,#e6f4ff,#bae0ff)'
                        : 'linear-gradient(135deg,#f5f5f5,#e0e0e0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SafetyOutlined style={{
                      color: lvl.mustering_only ? C.orange : sel ? C.blue : '#8c8c8c', fontSize: 14,
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: sel ? 700 : 600, fontSize: 13,
                      color: sel ? C.blue : C.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {lvl.level_name || lvl.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: C.sub }}>
                        <ApiOutlined style={{ marginRight: 2 }} />{lvl.door_count || 0}
                      </span>
                      <span style={{ fontSize: 11, color: C.sub }}>
                        <TeamOutlined style={{ marginRight: 2 }} />{lvl.user_count || 0}
                      </span>
                      {!active && <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>Off</Tag>}
                      {lvl.mustering_only && (
                        <Tag color="orange" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>Muster</Tag>
                      )}
                    </div>
                  </div>
                  <Badge status={active ? 'success' : 'default'} style={{ flexShrink: 0 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ RIGHT — Detail ═════════════════════════════════════════════════ */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── No selection ──────────────────────────────────────────────── */}
        {!selLevel && !editing && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, color: C.sub, padding: 48,
          }}>
            <SafetyOutlined style={{ fontSize: 56, color: '#d9d9d9' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#bfbfbf' }}>Select an access level</div>
            <div style={{ fontSize: 13 }}>Choose from the list, or create a new one</div>
            <Button type="primary" icon={<PlusOutlined />} onClick={openNew} style={{ marginTop: 8 }}>
              Create Access Level
            </Button>
          </div>
        )}

        {/* ── Edit / Create form ─────────────────────────────────────────── */}
        {editing && (
          <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '18px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                  {isNew ? 'New Access Level' : `Edit — ${selLevel?.level_name || selLevel?.name}`}
                </div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>
                  {isNew ? 'Create the level, then configure its door matrix below'
                         : 'Update level properties'}
                </div>
              </div>
              <Button icon={<CloseOutlined />} onClick={cancelEdit}>Cancel</Button>
            </div>
            <Form form={form} layout="inline" onFinish={v => save.mutate(v)} style={{ flexWrap: 'wrap', gap: 8 }}>
              <Form.Item name="level_name" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8, flex: '1 1 200px' }}>
                <Input size="large" placeholder="Level name *" style={{ borderRadius: 8 }} />
              </Form.Item>
              <Form.Item name="description" style={{ marginBottom: 8, flex: '2 1 300px' }}>
                <Input size="large" placeholder="Description (optional)" style={{ borderRadius: 8 }} />
              </Form.Item>
              <Form.Item name="is_active" valuePropName="checked" label="Active" style={{ marginBottom: 8 }}>
                <Switch checkedChildren={<CheckOutlined />} unCheckedChildren={<CloseOutlined />} />
              </Form.Item>
              <Form.Item name="mustering_only" valuePropName="checked" label="Muster only" style={{ marginBottom: 8 }}>
                <Switch />
              </Form.Item>
              <Form.Item style={{ marginBottom: 8 }}>
                <Button type="primary" icon={<SaveOutlined />} size="large" loading={save.isPending}
                  onClick={() => form.submit()} style={{ borderRadius: 8 }}>
                  {isNew ? 'Create' : 'Save'}
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}

        {/* ── Level header + toolbar ─────────────────────────────────────── */}
        {selLevel && (
          <>
            <div style={{
              background: 'linear-gradient(135deg,#0c1929 0%,#1a3a5c 100%)',
              padding: '18px 24px',
            }}>
              {/* Toolbar */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 16,
              }}>
                <Space size={8}>
                  <Button icon={<EditOutlined />} onClick={openEdit}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 7 }}>
                    Edit
                  </Button>
                  <Tooltip title="Duplicate this level with all its door permissions">
                    <Button icon={<CopyOutlined />} loading={copy.isPending}
                      onClick={() => copy.mutate(selId)}
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 7 }}>
                      Copy Level
                    </Button>
                  </Tooltip>
                  <Button icon={<ReloadOutlined />} onClick={() => { refetchPairs(); refetchUsers(); refetchLevels(); }}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 7 }}>
                    Refresh
                  </Button>
                  <Popconfirm
                    title="Delete this access level?"
                    description="All door assignments will be removed. Users assigned to this level will lose access."
                    icon={<ExclamationCircleOutlined style={{ color: C.red }} />}
                    okType="danger" okText="Delete"
                    onConfirm={() => del.mutate(selId)}
                  >
                    <Button danger icon={<DeleteOutlined />} loading={del.isPending} style={{ borderRadius: 7 }}>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>

                {/* Status tags */}
                <Space size={6}>
                  {selLevel.is_active !== false
                    ? <Tag color="success" icon={<CheckOutlined />}>Active</Tag>
                    : <Tag icon={<CloseOutlined />}>Inactive</Tag>}
                  {selLevel.mustering_only && <Tag color="warning">Mustering Only</Tag>}
                </Space>
              </div>

              {/* Name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 11, flexShrink: 0,
                  background: selLevel.mustering_only
                    ? 'linear-gradient(135deg,#fa8c16,#d46b08)'
                    : 'linear-gradient(135deg,#1677ff,#0050b3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                }}>
                  <SafetyOutlined style={{ color: 'white', fontSize: 22 }} />
                </div>
                <div>
                  <div style={{ color: 'white', fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>
                    {selLevel.level_name || selLevel.name}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 3 }}>
                    {selLevel.description || 'No description'}
                  </div>
                </div>
              </div>

              {/* Summary chips */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <StatChip icon={ApiOutlined}  label="Doors Assigned"  value={selLevel.door_count || 0} color="#40a9ff" />
                <StatChip icon={TeamOutlined} label="Users Assigned"   value={selLevel.user_count || 0} color={C.green}  />
                <StatChip icon={ClockCircleOutlined} label="Time Zones in Matrix" value={timezones.length} color={C.orange} />
              </div>
            </div>

            {/* ── Tabs ────────────────────────────────────────────────── */}
            <div style={{ flex: 1, background: C.white }}>
              <Tabs
                defaultActiveKey="matrix"
                size="large"
                tabBarStyle={{ paddingLeft: 24, marginBottom: 0, borderBottom: `1px solid ${C.border}` }}
                items={[
                  /* ─ Door-Timezone Matrix ─ */
                  {
                    key: 'matrix',
                    label: (
                      <span>
                        <CheckSquareOutlined style={{ marginRight: 6 }} />
                        Door Permission Matrix
                        {pairsBusy && <SyncOutlined spin style={{ marginLeft: 6, fontSize: 12 }} />}
                      </span>
                    ),
                    children: (
                      <div style={{ padding: '16px 24px 28px' }}>

                        {/* How-to banner */}
                        <div style={{
                          background: C.blueBg, border: `1px solid ${C.blueBd}`,
                          borderRadius: 8, padding: '9px 14px',
                          fontSize: 12, color: C.blue, marginBottom: 14,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <CheckSquareOutlined />
                          <span>
                            Click any cell to <strong>grant or revoke</strong> access for that
                            door during that time zone. Changes apply instantly.
                          </span>
                        </div>

                        {/* Door search filter */}
                        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FilterOutlined style={{ color: C.sub }} />
                          <Input
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            placeholder="Filter doors…"
                            value={doorFilter} onChange={e => setDFilter(e.target.value)}
                            allowClear size="small" style={{ width: 200, borderRadius: 6 }}
                          />
                          <span style={{ fontSize: 12, color: C.sub }}>
                            {doors.length} door{doors.length !== 1 ? 's' : ''}
                            &nbsp;×&nbsp;{timezones.length} time zone{timezones.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {pairsBusy && !pairs.length
                          ? <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
                          : (
                            <DoorMatrix
                              doors={doors}
                              timezones={timezones}
                              pairs={pairs}
                              onToggle={handleToggle}
                              pending={pending}
                            />
                          )}

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                          {[
                            { icon: <CheckSquareOutlined style={{ color: C.blue }} />, label: 'Access granted for this door + time zone' },
                            { icon: <BorderOutlined      style={{ color: '#d9d9d9' }} />, label: 'No access' },
                          ].map(l => (
                            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.sub }}>
                              {l.icon} {l.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  },

                  /* ─ Assigned Personnel ─ */
                  {
                    key: 'personnel',
                    label: (
                      <span>
                        <TeamOutlined style={{ marginRight: 6 }} />
                        Assigned Personnel
                        <Tag style={{ marginLeft: 8, fontSize: 11 }} color="green">{levelUsers.length}</Tag>
                      </span>
                    ),
                    children: (
                      <div style={{ padding: '16px 24px 28px' }}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: 12,
                        }}>
                          <div style={{ fontSize: 13, color: C.sub }}>
                            These employees have access to all doors in the matrix above,
                            during their respective time zones.
                            To add personnel, use the <strong>User Levels</strong> tab.
                          </div>
                          <Tooltip title="Refresh">
                            <Button icon={<ReloadOutlined />} loading={usersBusy}
                              onClick={() => refetchUsers()} style={{ borderRadius: 8 }} />
                          </Tooltip>
                        </div>
                        <Table
                          columns={userCols}
                          dataSource={levelUsers}
                          rowKey="id"
                          loading={usersBusy}
                          size="middle"
                          pagination={{ pageSize: 10, showTotal: t => `${t} employees` }}
                          rowClassName={r => r.valid_to && new Date(r.valid_to) < new Date() ? 'row-expired' : ''}
                          locale={{ emptyText: <Empty description="No personnel assigned to this level" /> }}
                          style={{ borderRadius: 10, overflow: 'hidden' }}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}
      </div>

      <style>{`
        .row-expired td { background: #fff1f0 !important; }
        .row-expired:hover td { background: #ffe4e1 !important; }
      `}</style>
    </div>
  );
};

export default AccessLevelManagement;
