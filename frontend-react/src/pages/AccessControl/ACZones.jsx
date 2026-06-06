import React, { useState, useMemo } from 'react';
import {
  Button, Space, Select, Input, Tag, Popconfirm,
  Row, Col, Card, App, Avatar, Progress,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, HeatMapOutlined,
  TeamOutlined, WarningOutlined, CheckCircleOutlined, SearchOutlined,
  SaveOutlined, CloseOutlined, UserOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;

const occColor = (cur, max) => {
  if (!max) return '#1890ff';
  const p = cur / max;
  if (p >= 1) return '#f5222d';
  if (p >= 0.8) return '#fa8c16';
  return '#52c41a';
};

const occPct = (cur, max) => {
  if (!max) return 0;
  return Math.min(100, Math.round((cur / max) * 100));
};

const BLANK = { name: '', desc: '', maxOcc: '', doorIds: [] };

const ACZones = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [selId,   setSelId]   = useState(null);
  const [adding,  setAdding]  = useState(false);
  const [editing, setEditing] = useState(false);
  const [search,  setSearch]  = useState('');
  const [form,    setForm]    = useState(BLANK);

  const { data: zonesData, isLoading } = useQuery({
    queryKey: ['acc-zones'],
    queryFn: () => apiService.get('/api/access-control/zones/'),
    refetchInterval: 30000,
  });
  const zones = zonesData?.data || zonesData || [];

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn: () => apiService.get('/api/access-control/doors/'),
  });
  const doors = doorsData?.data || [];

  const { data: musterData, isLoading: musterLoading, refetch: refetchMuster } = useQuery({
    queryKey: ['acc-zone-muster', selId],
    queryFn: () => apiService.get(`/api/access-control/zones/${selId}/mustering/`),
    enabled: !!selId && !adding && !editing,
    refetchInterval: 15000,
  });
  const musterList = musterData?.data || musterData || [];

  const createMut = useMutation({
    mutationFn: (body) => apiService.post('/api/access-control/zones/', body),
    onSuccess: (res) => {
      message.success('Zone created');
      qc.invalidateQueries(['acc-zones']);
      setAdding(false);
      setSelId(res?.data?.id ?? null);
      setForm(BLANK);
    },
    onError: e => message.error(e?.message || 'Error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => apiService.put(`/api/access-control/zones/${id}`, body),
    onSuccess: () => {
      message.success('Zone updated');
      qc.invalidateQueries(['acc-zones']);
      setEditing(false);
    },
    onError: e => message.error(e?.message || 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => apiService.delete(`/api/access-control/zones/${id}`),
    onSuccess: () => {
      message.success('Zone deleted');
      qc.invalidateQueries(['acc-zones']);
      setSelId(null);
    },
    onError: e => message.error(e?.message || 'Error'),
  });

  const filtered = useMemo(() => {
    if (!search) return zones;
    const q = search.toLowerCase();
    return zones.filter(z =>
      (z.zone_name || '').toLowerCase().includes(q) ||
      (z.description || '').toLowerCase().includes(q)
    );
  }, [zones, search]);

  const selected = zones.find(z => z.id === selId) || null;
  const cur = selected?.current_occupancy ?? 0;
  const max = selected?.max_occupancy;
  const color = occColor(cur, max);

  const startAdd = () => {
    setAdding(true); setEditing(false); setSelId(null); setForm(BLANK);
  };

  const startEdit = () => {
    if (!selected) return;
    setEditing(true);
    setForm({
      name:    selected.zone_name || '',
      desc:    selected.description || '',
      maxOcc:  selected.max_occupancy != null ? String(selected.max_occupancy) : '',
      doorIds: selected.door_ids || [],
    });
  };

  const cancelForm = () => { setAdding(false); setEditing(false); setForm(BLANK); };

  const handleSave = () => {
    if (!form.name.trim()) { message.warning('Zone name is required'); return; }
    const body = {
      zone_name:     form.name.trim(),
      description:   form.desc,
      max_occupancy: form.maxOcc ? parseInt(form.maxOcc) : null,
      door_ids:      form.doorIds,
    };
    if (editing) updateMut.mutate({ id: selected.id, body });
    else createMut.mutate(body);
  };

  const patch = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const totalOcc   = zones.reduce((s, z) => s + (z.current_occupancy ?? 0), 0);
  const overcrowded = zones.filter(z => z.max_occupancy && (z.current_occupancy ?? 0) >= z.max_occupancy).length;

  const FormFields = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 6 }}>Zone Name *</div>
        <Input
          value={form.name}
          onChange={e => patch('name', e.target.value)}
          placeholder="e.g., Server Room, Main Office"
          size="large"
        />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 6 }}>Description</div>
        <Input.TextArea
          value={form.desc}
          onChange={e => patch('desc', e.target.value)}
          rows={2}
          placeholder="Optional description"
        />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 6 }}>Max Occupancy</div>
        <Input
          type="number" min={0}
          value={form.maxOcc}
          onChange={e => patch('maxOcc', e.target.value)}
          placeholder="Leave blank for unlimited"
          size="large"
          style={{ maxWidth: 200 }}
        />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#262626', marginBottom: 6 }}>Doors in this Zone</div>
        <Select
          mode="multiple" allowClear placeholder="Select doors"
          value={form.doorIds} onChange={v => patch('doorIds', v)}
          size="large" style={{ width: '100%' }}
          optionFilterProp="label"
        >
          {doors.map(d => <Option key={d.id} value={d.id} label={d.door_name}>{d.door_name}</Option>)}
        </Select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
        <Button onClick={cancelForm} icon={<CloseOutlined />}>Cancel</Button>
        <Button type="primary" icon={<SaveOutlined />}
          onClick={handleSave}
          loading={createMut.isPending || updateMut.isPending}
          style={{ background: '#722ed1', borderColor: '#722ed1' }}>
          {editing ? 'Save Changes' : 'Create Zone'}
        </Button>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #120338 0%, #2b0c6e 50%, #391085 100%)',
        borderRadius: 0, padding: '18px 24px',
        boxShadow: '0 2px 12px rgba(18,3,56,0.3)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
      }}>
        <Space size={14}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #722ed1, #531dab)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(114,46,209,0.4)',
          }}>
            <HeatMapOutlined style={{ color: 'white', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>AC Zones</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 }}>
              Zone-based door groupings with live occupancy &amp; mustering
            </div>
          </div>
        </Space>
        <Button
          icon={<PlusOutlined />}
          onClick={startAdd}
          style={{ borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', fontWeight: 600 }}>
          Add Zone
        </Button>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'white', borderBottom: '1px solid #f0f0f0', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { label: 'Zones',           value: zones.length,   color: '#722ed1' },
          { label: 'Total Inside',    value: totalOcc,        color: '#1890ff' },
          { label: 'Overcrowded',     value: overcrowded,     color: '#f5222d' },
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
          width: 280, flexShrink: 0,
          borderRight: '1px solid #e8e8e8',
          display: 'flex', flexDirection: 'column',
          background: 'white', overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search zones…"
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
                <HeatMapOutlined style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
                <div style={{ fontSize: 12 }}>No zones yet</div>
              </div>
            )}
            {filtered.map(z => {
              const c = z.current_occupancy ?? 0;
              const m = z.max_occupancy;
              const clr = occColor(c, m);
              const pct = occPct(c, m);
              const isSel = z.id === selId;
              return (
                <div key={z.id}
                  onClick={() => { setSelId(z.id); setAdding(false); setEditing(false); }}
                  style={{
                    padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                    background: isSel ? '#f9f0ff' : 'white',
                    borderLeft: isSel ? '3px solid #722ed1' : '3px solid transparent',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: 'linear-gradient(135deg, #722ed1, #531dab)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <HeatMapOutlined style={{ color: 'white', fontSize: 12 }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#141414' }}>{z.zone_name}</div>
                        <div style={{ fontSize: 10, color: '#8c8c8c' }}>{z.door_names?.length || 0} door{z.door_names?.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color: clr, lineHeight: 1 }}>{c}</div>
                      {m && <div style={{ fontSize: 9, color: '#8c8c8c' }}>/ {m}</div>}
                    </div>
                  </div>
                  {m > 0 && (
                    <Progress percent={pct} strokeColor={clr} showInfo={false} size="small" style={{ margin: 0 }} />
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
            <div style={{ padding: 24, maxWidth: 560 }}>
              <div style={{
                background: 'linear-gradient(135deg, #120338, #391085)',
                borderRadius: 14, padding: '20px 24px', marginBottom: 20,
                boxShadow: '0 4px 20px rgba(18,3,56,0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, #722ed1, #531dab)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PlusOutlined style={{ color: 'white', fontSize: 16 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>New Zone</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Group doors and track occupancy</div>
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
            <div style={{ padding: 24, maxWidth: 560 }}>
              <div style={{
                background: '#f9f0ff', border: '1px solid #d3adf7',
                borderRadius: 14, padding: '18px 24px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <HeatMapOutlined style={{ color: '#722ed1', fontSize: 22 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.zone_name}</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>Editing zone</div>
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
                background: 'linear-gradient(135deg, #120338 0%, #391085 100%)',
                borderRadius: 14, padding: '20px 24px', marginBottom: 20,
                boxShadow: '0 4px 20px rgba(18,3,56,0.3)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
              }}>
                <Space size={14}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: 'linear-gradient(135deg, #722ed1, #531dab)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(114,46,209,0.4)',
                  }}>
                    <HeatMapOutlined style={{ color: 'white', fontSize: 22 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{selected.zone_name}</div>
                    {selected.description && (
                      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>{selected.description}</div>
                    )}
                  </div>
                </Space>
                <Space>
                  <Button icon={<EditOutlined />} onClick={startEdit}
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8 }}>
                    Edit
                  </Button>
                  <Popconfirm title="Delete this zone?" okType="danger" onConfirm={() => deleteMut.mutate(selected.id)}>
                    <Button danger icon={<DeleteOutlined />} loading={deleteMut.isPending}
                      style={{ background: 'rgba(245,34,45,0.12)', border: '1px solid rgba(245,34,45,0.3)', borderRadius: 8 }}>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              {/* Occupancy card */}
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={8}>
                  <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', borderTop: `3px solid ${color}` }}
                    styles={{ body: { padding: 20 } }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Current Occupancy
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <div style={{ fontSize: 42, fontWeight: 800, color, lineHeight: 1 }}>{cur}</div>
                      {max && <div style={{ fontSize: 16, color: '#8c8c8c' }}>/ {max}</div>}
                    </div>
                    {max && (
                      <>
                        <Progress percent={occPct(cur, max)} strokeColor={color} showInfo={false} style={{ marginTop: 10, marginBottom: 4 }} />
                        {cur >= max && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f5222d', fontSize: 12, fontWeight: 600 }}>
                            <WarningOutlined /> Zone at capacity
                          </div>
                        )}
                        {cur < max && (
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{max - cur} slots available</div>
                        )}
                      </>
                    )}
                  </Card>
                </Col>

                <Col xs={24} sm={16}>
                  <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)', height: '100%' }}
                    styles={{ body: { padding: 20 } }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Assigned Doors
                    </div>
                    {selected.door_names?.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selected.door_names.map((d, i) => {
                          const doorObj = doors.find(dr => dr.door_name === d);
                          return (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              background: doorObj?.is_online ? '#f6ffed' : '#f5f5f5',
                              border: `1px solid ${doorObj?.is_online ? '#b7eb8f' : '#d9d9d9'}`,
                              borderRadius: 8, padding: '4px 10px',
                              fontSize: 12, fontWeight: 500,
                              color: doorObj?.is_online ? '#52c41a' : '#595959',
                            }}>
                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: doorObj?.is_online ? '#52c41a' : '#d9d9d9' }} />
                              {d}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: '#bfbfbf', fontSize: 12 }}>No doors assigned to this zone</span>
                    )}
                  </Card>
                </Col>
              </Row>

              {/* Mustering panel */}
              <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
                styles={{ body: { padding: 0 } }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Space>
                      <TeamOutlined style={{ color: '#722ed1' }} />
                      <span style={{ fontWeight: 700 }}>People Inside Zone</span>
                      <div style={{
                        background: '#f9f0ff', border: '1px solid #d3adf7',
                        borderRadius: 10, padding: '1px 10px', fontSize: 12, fontWeight: 700, color: '#722ed1',
                      }}>
                        {musterList.length}
                      </div>
                    </Space>
                    <Button
                      size="small" icon={<ReloadOutlined />}
                      onClick={() => refetchMuster()}
                      loading={musterLoading}
                      style={{ borderRadius: 6 }}
                    >
                      Refresh
                    </Button>
                  </div>
                }>
                {musterLoading ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#8c8c8c', fontSize: 12 }}>Loading…</div>
                ) : musterList.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#bfbfbf' }}>
                    <TeamOutlined style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
                    <div style={{ fontSize: 13 }}>Zone is empty</div>
                  </div>
                ) : (
                  <div>
                    {musterList.map((p, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 20px',
                        borderBottom: i < musterList.length - 1 ? '1px solid #f5f5f5' : 'none',
                        background: i % 2 === 0 ? 'white' : '#fafafa',
                      }}>
                        <Avatar size={36} src={p.photo || undefined}
                          style={{ background: '#722ed1', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {!p.photo && (p.emp_name || p.emp_code || '?')[0]?.toUpperCase()}
                        </Avatar>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.emp_name || p.emp_code}</div>
                          <div style={{ fontSize: 11, color: '#8c8c8c', display: 'flex', gap: 8 }}>
                            <span style={{ fontFamily: 'monospace' }}>{p.emp_code}</span>
                            {p.last_entry && <span>In: {new Date(p.last_entry).toLocaleTimeString()}</span>}
                          </div>
                        </div>
                        {p.dept_name && (
                          <Tag style={{ fontSize: 10, margin: 0 }}>{p.dept_name}</Tag>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Empty state */}
          {!adding && !editing && !selected && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bfbfbf' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 18,
                background: 'linear-gradient(135deg, #f9f0ff, #efdbff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <HeatMapOutlined style={{ fontSize: 32, color: '#722ed1' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#8c8c8c', marginBottom: 6 }}>Select a zone</div>
              <div style={{ fontSize: 12, color: '#bfbfbf', textAlign: 'center', maxWidth: 260, marginBottom: 20 }}>
                Click a zone on the left to see occupancy and mustering, or create a new zone.
              </div>
              <Button icon={<PlusOutlined />} onClick={startAdd}
                style={{ borderRadius: 8, background: '#722ed1', border: 'none', color: 'white' }}>
                Add Zone
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ACZones;
