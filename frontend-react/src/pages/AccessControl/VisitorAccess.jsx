import React, { useState, useMemo } from 'react';
import {
  Button, Space, Select, DatePicker, Tag, Popconfirm,
  Row, Col, Card, App, Avatar, Input,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, StopOutlined, UserOutlined,
  CalendarOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined,
  SearchOutlined, EditOutlined, SaveOutlined, CloseOutlined,
  LockOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

const deriveStatus = (v) => {
  if (v.is_revoked) return 'revoked';
  const now = dayjs();
  if (v.valid_to && dayjs(v.valid_to).isBefore(now, 'day')) return 'expired';
  if (v.valid_from && dayjs(v.valid_from).isAfter(now, 'day')) return 'upcoming';
  return 'active';
};

const STATUS = {
  active:   { label: 'Active',   color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', icon: <CheckCircleOutlined /> },
  upcoming: { label: 'Upcoming', color: '#1890ff', bg: '#e6f7ff', border: '#91d5ff', icon: <ClockCircleOutlined /> },
  expired:  { label: 'Expired',  color: '#8c8c8c', bg: '#f5f5f5', border: '#d9d9d9', icon: <WarningOutlined /> },
  revoked:  { label: 'Revoked',  color: '#f5222d', bg: '#fff1f0', border: '#ffa39e', icon: <StopOutlined /> },
};

const initials = (name, code) => {
  if (!name) return (code || '?')[0].toUpperCase();
  const parts = name.trim().split(' ');
  return parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0];
};

const BLANK = { empCode: null, levelId: null, doorIds: [], range: null, note: '' };

const VisitorAccess = () => {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();

  const [selId,    setSelId]    = useState(null);
  const [adding,   setAdding]   = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [form,     setForm]     = useState(BLANK);

  const { data: visitorsData, isLoading } = useQuery({
    queryKey: ['acc-visitors'],
    queryFn: () => apiService.get('/api/access-control/visitors/'),
  });
  const visitors = visitorsData?.data || visitorsData || [];

  const { data: empData } = useQuery({
    queryKey: ['personnel-list'],
    queryFn: () => apiService.get('/api/v1/personnel/'),
  });
  const employees = empData?.data || empData?.results || [];

  const { data: levelsData } = useQuery({
    queryKey: ['acc-levels'],
    queryFn: () => apiService.get('/api/access-control/levels/'),
  });
  const levels = levelsData?.data || [];

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn: () => apiService.get('/api/access-control/doors/'),
  });
  const doors = doorsData?.data || [];

  const createMut = useMutation({
    mutationFn: (body) => apiService.post('/api/access-control/visitors/', body),
    onSuccess: (res) => {
      message.success('Visitor access granted');
      qc.invalidateQueries(['acc-visitors']);
      setAdding(false);
      setSelId(res?.data?.id ?? null);
      setForm(BLANK);
    },
    onError: e => message.error(e?.message || 'Error creating'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => apiService.put(`/api/access-control/visitors/${id}`, body),
    onSuccess: () => {
      message.success('Updated');
      qc.invalidateQueries(['acc-visitors']);
      setEditing(false);
    },
    onError: e => message.error(e?.message || 'Error updating'),
  });

  const revokeMut = useMutation({
    mutationFn: (id) => apiService.patch(`/api/access-control/visitors/${id}/revoke/`),
    onSuccess: () => { message.success('Access revoked'); qc.invalidateQueries(['acc-visitors']); },
    onError: e => message.error(e?.message || 'Error revoking'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => apiService.delete(`/api/access-control/visitors/${id}`),
    onSuccess: () => {
      message.success('Deleted');
      qc.invalidateQueries(['acc-visitors']);
      setSelId(null);
    },
    onError: e => message.error(e?.message || 'Error deleting'),
  });

  const filtered = useMemo(() => {
    if (!search) return visitors;
    const q = search.toLowerCase();
    return visitors.filter(v =>
      (v.emp_name || '').toLowerCase().includes(q) ||
      (v.emp_code || '').toLowerCase().includes(q) ||
      (v.level_name || '').toLowerCase().includes(q)
    );
  }, [visitors, search]);

  const selected = visitors.find(v => v.id === selId) || null;
  const selStatus = selected ? deriveStatus(selected) : null;
  const selInfo   = selStatus ? STATUS[selStatus] : null;

  const startAdd = () => {
    setAdding(true); setEditing(false); setSelId(null); setForm(BLANK);
  };

  const startEdit = () => {
    if (!selected) return;
    setEditing(true);
    setForm({
      empCode:  selected.emp_code,
      levelId:  selected.level_id || null,
      doorIds:  selected.door_ids || [],
      range:    selected.valid_from && selected.valid_to
                  ? [dayjs(selected.valid_from), dayjs(selected.valid_to)]
                  : null,
      note:     selected.note || '',
    });
  };

  const cancelForm = () => { setAdding(false); setEditing(false); setForm(BLANK); };

  const handleSave = () => {
    if (adding && !form.empCode) { message.warning('Select a person'); return; }
    if (!form.range) { message.warning('Select valid period'); return; }
    const body = {
      emp_code:   form.empCode,
      level_id:   form.levelId || null,
      door_ids:   form.doorIds,
      valid_from: form.range[0].format('YYYY-MM-DD'),
      valid_to:   form.range[1].format('YYYY-MM-DD'),
      note:       form.note,
    };
    if (editing) updateMut.mutate({ id: selected.id, body });
    else createMut.mutate(body);
  };

  const patch = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const activeCount   = visitors.filter(v => deriveStatus(v) === 'active').length;
  const expiredCount  = visitors.filter(v => deriveStatus(v) === 'expired').length;
  const revokedCount  = visitors.filter(v => deriveStatus(v) === 'revoked').length;
  const upcomingCount = visitors.filter(v => deriveStatus(v) === 'upcoming').length;

  // ── Shared form markup (add + edit) ──
  const FormFields = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 6 }}>Person *</div>
        <Select
          showSearch placeholder="Search by name or code"
          value={form.empCode} onChange={v => patch('empCode', v)}
          optionFilterProp="label" style={{ width: '100%' }}
          disabled={editing}
          size="large"
        >
          {employees.map(e => (
            <Option key={e.emp_code} value={e.emp_code}
              label={`${e.first_name} ${e.last_name} ${e.emp_code}`}>
              <Space>
                <Avatar size={18} style={{ background: '#1890ff', fontSize: 10 }}>
                  {(e.first_name || '?')[0].toUpperCase()}
                </Avatar>
                {e.first_name} {e.last_name}
                <span style={{ color: '#8c8c8c', fontSize: 11 }}>({e.emp_code})</span>
              </Space>
            </Option>
          ))}
        </Select>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 6 }}>Valid Period *</div>
        <RangePicker
          format="DD MMM YYYY"
          value={form.range}
          onChange={v => patch('range', v ? [v[0], v[1]] : null)}
          style={{ width: '100%' }}
          size="large"
        />
      </div>

      <Row gutter={12}>
        <Col span={12}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 6 }}>Access Level</div>
          <Select allowClear placeholder="Optional" value={form.levelId} onChange={v => patch('levelId', v)}
            size="large" style={{ width: '100%' }}>
            {levels.map(l => <Option key={l.id} value={l.id}>{l.level_name || l.name}</Option>)}
          </Select>
        </Col>
        <Col span={12}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 6 }}>Specific Doors</div>
          <Select mode="multiple" allowClear placeholder="Optional"
            value={form.doorIds} onChange={v => patch('doorIds', v)}
            size="large" style={{ width: '100%' }} maxTagCount={1}>
            {doors.map(d => <Option key={d.id} value={d.id}>{d.door_name}</Option>)}
          </Select>
        </Col>
      </Row>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 6 }}>Note</div>
        <input
          value={form.note}
          onChange={e => patch('note', e.target.value)}
          placeholder="Reason for visit, contractor company, etc."
          style={{
            width: '100%', padding: '7px 11px',
            border: '1px solid #d9d9d9', borderRadius: 6,
            fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
        <Button onClick={cancelForm} icon={<CloseOutlined />}>Cancel</Button>
        <Button type="primary" icon={<SaveOutlined />}
          onClick={handleSave}
          loading={createMut.isPending || updateMut.isPending}
          style={{ background: '#1890ff' }}>
          {editing ? 'Save Changes' : 'Grant Access'}
        </Button>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #001529 0%, #002766 50%, #003a8c 100%)',
        borderRadius: 0, padding: '18px 24px',
        boxShadow: '0 2px 12px rgba(0,21,41,0.3)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
      }}>
        <Space size={14}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #1890ff, #096dd9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(24,144,255,0.4)',
          }}>
            <UserOutlined style={{ color: 'white', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Visitor Access Levels</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 }}>
              Grant doors &amp; access levels to visitors/contractors for a time window — visits are managed in the Visitor module
            </div>
          </div>
        </Space>
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={startAdd}
          style={{ borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', fontWeight: 600 }}>
          Grant Access
        </Button>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'white', borderBottom: '1px solid #f0f0f0', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',    value: visitors.length, color: '#1890ff' },
          { label: 'Active',   value: activeCount,     color: '#52c41a' },
          { label: 'Upcoming', value: upcomingCount,   color: '#1890ff' },
          { label: 'Expired',  value: expiredCount,    color: '#8c8c8c' },
          { label: 'Revoked',  value: revokedCount,    color: '#f5222d' },
        ].map(s => (
          <div key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f9f9f9', borderRadius: 8, padding: '6px 14px',
          }}>
            <span style={{ fontSize: 11, color: '#8c8c8c' }}>{s.label}</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: s.color, lineHeight: 1 }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Body — split panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left list ── */}
        <div style={{
          width: 300, flexShrink: 0,
          borderRight: '1px solid #e8e8e8',
          display: 'flex', flexDirection: 'column',
          background: 'white', overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search visitors…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              style={{ borderRadius: 6 }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading && (
              <div style={{ padding: 24, textAlign: 'center', color: '#bfbfbf', fontSize: 12 }}>Loading…</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#bfbfbf' }}>
                <UserOutlined style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
                <div style={{ fontSize: 12 }}>No records found</div>
              </div>
            )}
            {filtered.map(v => {
              const s = deriveStatus(v);
              const info = STATUS[s];
              const isSelected = v.id === selId;
              return (
                <div key={v.id}
                  onClick={() => { setSelId(v.id); setAdding(false); setEditing(false); }}
                  style={{
                    padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                    background: isSelected ? '#e6f7ff' : 'white',
                    borderLeft: isSelected ? '3px solid #1890ff' : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar size={34} style={{ background: '#1890ff', fontSize: 13, flexShrink: 0, fontWeight: 700 }}>
                      {initials(v.emp_name, v.emp_code)}
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#141414', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.emp_name || v.emp_code}
                      </div>
                      <div style={{ fontSize: 10, color: '#8c8c8c', fontFamily: 'monospace' }}>{v.emp_code}</div>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                      background: info.bg, color: info.color, border: `1px solid ${info.border}`,
                      flexShrink: 0,
                    }}>
                      {info.label}
                    </div>
                  </div>
                  {(v.valid_from || v.valid_to) && (
                    <div style={{ marginTop: 5, marginLeft: 44, fontSize: 10, color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CalendarOutlined style={{ fontSize: 9 }} />
                      {v.valid_from ? dayjs(v.valid_from).format('DD MMM') : '—'}
                      {' → '}
                      {v.valid_to ? dayjs(v.valid_to).format('DD MMM YYYY') : '—'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ flex: 1, overflow: 'auto', background: '#f5f5f5' }}>

          {/* Add form */}
          {adding && (
            <div style={{ padding: 24, maxWidth: 600 }}>
              <div style={{
                background: 'linear-gradient(135deg, #001529, #003a8c)',
                borderRadius: 14, padding: '20px 24px', marginBottom: 20,
                boxShadow: '0 4px 20px rgba(0,21,41,0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, #1890ff, #096dd9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PlusOutlined style={{ color: 'white', fontSize: 16 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>Grant Visitor Access</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Define the person, access scope, and validity window</div>
                  </div>
                </div>
              </div>
              <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <FormFields />
              </Card>
            </div>
          )}

          {/* Edit form */}
          {editing && selected && (
            <div style={{ padding: 24, maxWidth: 600 }}>
              <div style={{
                background: `linear-gradient(135deg, ${selInfo.color}22, ${selInfo.color}11)`,
                border: `1px solid ${selInfo.border}`,
                borderRadius: 14, padding: '20px 24px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar size={44} style={{ background: '#1890ff', fontSize: 16, fontWeight: 700 }}>
                    {initials(selected.emp_name, selected.emp_code)}
                  </Avatar>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#141414' }}>{selected.emp_name || selected.emp_code}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>Editing access record</div>
                  </div>
                </div>
              </div>
              <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <FormFields />
              </Card>
            </div>
          )}

          {/* Detail view */}
          {!adding && !editing && selected && (
            <div style={{ padding: 24 }}>

              {/* Sub-header */}
              <div style={{
                background: `linear-gradient(135deg, #001529 0%, #002766 100%)`,
                borderRadius: 14, padding: '20px 24px', marginBottom: 20,
                boxShadow: '0 4px 20px rgba(0,21,41,0.3)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
              }}>
                <Space size={14}>
                  <Avatar size={48} style={{ background: '#1890ff', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                    {initials(selected.emp_name, selected.emp_code)}
                  </Avatar>
                  <div>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{selected.emp_name || selected.emp_code}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'monospace' }}>{selected.emp_code}</span>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: `${selInfo.color}22`, border: `1px solid ${selInfo.color}55`,
                        borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: selInfo.color,
                      }}>
                        {selInfo.icon}&nbsp;{selInfo.label}
                      </div>
                    </div>
                  </div>
                </Space>
                <Space size={8}>
                  {selStatus !== 'revoked' && (
                    <Button icon={<EditOutlined />} onClick={startEdit}
                      style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8 }}>
                      Edit
                    </Button>
                  )}
                  {selStatus === 'active' && (
                    <Popconfirm title="Revoke this access?" okType="danger" onConfirm={() => revokeMut.mutate(selected.id)}>
                      <Button icon={<StopOutlined />} loading={revokeMut.isPending}
                        style={{ background: 'rgba(250,173,20,0.15)', border: '1px solid rgba(250,173,20,0.4)', color: '#faad14', borderRadius: 8 }}>
                        Revoke
                      </Button>
                    </Popconfirm>
                  )}
                  <Popconfirm title="Delete this record permanently?" okType="danger" onConfirm={() => deleteMut.mutate(selected.id)}>
                    <Button danger icon={<DeleteOutlined />} loading={deleteMut.isPending}
                      style={{ background: 'rgba(245,34,45,0.12)', border: '1px solid rgba(245,34,45,0.3)', borderRadius: 8 }}>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              {/* Info cards */}
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
                    styles={{ body: { padding: 20 } }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Valid Period
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, background: '#e6f7ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CalendarOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#141414' }}>
                          {selected.valid_from ? dayjs(selected.valid_from).format('DD MMM YYYY') : '—'}
                          {' → '}
                          {selected.valid_to ? dayjs(selected.valid_to).format('DD MMM YYYY') : '—'}
                        </div>
                        {selected.valid_to && (
                          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                            {selStatus === 'expired' ? 'Expired' : selStatus === 'upcoming' ? 'Starts in future' : `${dayjs(selected.valid_to).diff(dayjs(), 'day')} days remaining`}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </Col>

                <Col xs={24} sm={12}>
                  <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
                    styles={{ body: { padding: 20 } }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Access Scope
                    </div>
                    {selected.level_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <LockOutlined style={{ color: '#1890ff', fontSize: 14 }} />
                        <Tag color="blue" style={{ fontWeight: 600, fontSize: 12 }}>{selected.level_name}</Tag>
                      </div>
                    )}
                    {selected.door_names?.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {selected.door_names.map((d, i) => (
                          <Tag key={i} style={{ fontSize: 11, margin: 0 }}>{d}</Tag>
                        ))}
                      </div>
                    ) : !selected.level_name ? (
                      <span style={{ color: '#bfbfbf', fontSize: 12 }}>No specific scope</span>
                    ) : null}
                  </Card>
                </Col>

                {selected.note && (
                  <Col xs={24}>
                    <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
                      styles={{ body: { padding: 20 } }}>
                      <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Note
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#262626', lineHeight: 1.6 }}>{selected.note}</p>
                    </Card>
                  </Col>
                )}
              </Row>
            </div>
          )}

          {/* Empty state */}
          {!adding && !editing && !selected && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bfbfbf' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 18,
                background: 'linear-gradient(135deg, #e6f7ff, #bae7ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <UserOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#8c8c8c', marginBottom: 6 }}>Select a visitor record</div>
              <div style={{ fontSize: 12, color: '#bfbfbf', textAlign: 'center', maxWidth: 260, marginBottom: 20 }}>
                Click any record on the left to view details, or create a new grant.
              </div>
              <Button type="primary" icon={<PlusOutlined />} onClick={startAdd} style={{ borderRadius: 8 }}>
                Grant Access
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisitorAccess;
