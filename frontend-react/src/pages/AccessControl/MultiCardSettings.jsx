import React, { useState, useMemo } from 'react';
import {
  Button, Select, InputNumber, Tag, Popconfirm, Form, Avatar,
  Space, Spin, App, Input,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined,
  SearchOutlined, CloseOutlined, SaveOutlined, ReloadOutlined,
  TeamOutlined, MinusCircleOutlined, UserOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;

const C = {
  bg: '#f0f2f5',
  panel: 'white',
  border: '#f0f0f0',
  selBg: '#f9f0ff',
  darkHeader: 'linear-gradient(135deg, #120338 0%, #1e0547 50%, #2e0b6e 100%)',
};

const empInitials = e =>
  e ? `${e.first_name?.[0] || ''}${e.last_name?.[0] || ''}`.toUpperCase() || e.emp_code?.[0]?.toUpperCase() || '?' : '?';

const MultiCardSettings = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const [selId,    setSelId]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [editMode, setEditMode] = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [members,  setMembers]  = useState([]);
  const [newCode,  setNewCode]  = useState(null);

  // ── Queries ────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['acc-multicard'],
    queryFn:  () => apiService.get('/api/access-control/multi-card/'),
  });
  const configs = data?.data || [];

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn:  () => apiService.get('/api/access-control/doors/'),
  });
  const doors = doorsData?.data || [];

  const { data: empData } = useQuery({
    queryKey: ['personnel-list'],
    queryFn:  () => apiService.get('/api/v1/personnel/'),
  });
  const employees = empData?.data || empData?.results || [];
  const empMap = useMemo(() => {
    const m = {};
    employees.forEach(e => { m[e.emp_code] = e; });
    return m;
  }, [employees]);

  // ── Derived ────────────────────────────────────────────────────────
  const selConfig = useMemo(() => configs.find(c => c.id === selId) || null, [configs, selId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? configs.filter(c => c.door_name?.toLowerCase().includes(q)) : configs;
  }, [configs, search]);

  const totalMembers = configs.reduce((s, c) => s + (c.members?.length || 0), 0);

  // ── Mutations ──────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: v => {
      const body = { ...v, emp_codes: members };
      return adding
        ? apiService.post('/api/access-control/multi-card/', body)
        : apiService.put(`/api/access-control/multi-card/${selId}`, body);
    },
    onSuccess: res => {
      message.success(adding ? 'Config created' : 'Config updated');
      qc.invalidateQueries(['acc-multicard']);
      if (adding) { setAdding(false); setSelId(res?.data?.id ?? null); }
      setEditMode(false);
    },
    onError: e => message.error(e?.message || 'Error saving'),
  });

  const del = useMutation({
    mutationFn: id => apiService.delete(`/api/access-control/multi-card/${id}`),
    onSuccess: () => {
      message.success('Deleted');
      qc.invalidateQueries(['acc-multicard']);
      setSelId(null); setEditMode(false);
    },
    onError: e => message.error(e?.message || 'Error'),
  });

  // ── Handlers ──────────────────────────────────────────────────────
  const startAdd = () => {
    form.resetFields(); form.setFieldsValue({ min_cards: 2 });
    setMembers([]); setNewCode(null);
    setSelId(null); setEditMode(false); setAdding(true);
  };

  const startEdit = () => {
    if (!selConfig) return;
    form.setFieldsValue({ door_id: selConfig.door_id, min_cards: selConfig.min_cards });
    setMembers((selConfig.members || []).map(m => m.emp_code));
    setEditMode(true);
  };

  const cancelEdit = () => { setEditMode(false); setAdding(false); setMembers([]); setNewCode(null); };

  const selectConfig = id => { setSelId(id); setEditMode(false); setAdding(false); };

  const handleSave = () => { form.validateFields().then(v => save.mutate(v)); };

  const addMember = () => {
    if (newCode && !members.includes(newCode)) { setMembers(p => [...p, newCode]); setNewCode(null); }
  };

  const removeMember = code => setMembers(p => p.filter(c => c !== code));

  // Members not yet in the list (for add dropdown)
  const availableEmps = useMemo(() => employees.filter(e => !members.includes(e.emp_code)), [employees, members]);

  // ── Form content ──────────────────────────────────────────────────
  const renderForm = () => (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
      <Form form={form} layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 20px' }}>
          <Form.Item name="door_id" label="Door" rules={[{ required: true, message: 'Required' }]}>
            <Select showSearch optionFilterProp="label" size="large"
              disabled={!adding} placeholder="Select door">
              {doors.map(d => <Option key={d.id} value={d.id} label={d.door_name}>{d.door_name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="min_cards" label="Min Cards Required" rules={[{ required: true }]}>
            <InputNumber min={2} max={8} size="large" style={{ width: 130 }} />
          </Form.Item>
        </div>
      </Form>

      <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 12 }}>
        Authorised Members
      </div>

      {/* Add member inline */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Select
          showSearch optionFilterProp="label" size="middle"
          style={{ flex: 1 }}
          value={newCode} onChange={setNewCode}
          placeholder="Select employee to add"
          allowClear
        >
          {availableEmps.map(e => (
            <Option key={e.emp_code} value={e.emp_code}
              label={`${e.first_name} ${e.last_name} (${e.emp_code})`}>
              {e.first_name} {e.last_name}
              <span style={{ color: '#8c8c8c', marginLeft: 8, fontSize: 11 }}>{e.emp_code}</span>
            </Option>
          ))}
        </Select>
        <Button type="primary" icon={<PlusOutlined />} onClick={addMember}
          disabled={!newCode} style={{ borderRadius: 8 }}>Add</Button>
      </div>

      {/* Member list */}
      {members.length === 0 ? (
        <div style={{ color: '#bfbfbf', fontSize: 13, padding: '8px 0' }}>No members added yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.map(code => {
            const emp = empMap[code];
            return (
              <div key={code} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                background: '#fafafa', border: '1px solid #f0f0f0',
              }}>
                <Avatar size={32} style={{ background: '#722ed1', fontSize: 12, flexShrink: 0 }}>
                  {emp ? empInitials(emp) : code[0]?.toUpperCase()}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {emp ? `${emp.first_name} ${emp.last_name}` : code}
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>{code}</div>
                </div>
                <Button size="small" type="text" danger icon={<MinusCircleOutlined />}
                  onClick={() => removeMember(code)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── View content ──────────────────────────────────────────────────
  const renderView = () => {
    if (!selConfig) return null;
    const configMembers = selConfig.members || [];
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        {/* Requirement display */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(135deg, #722ed1, #531dab)',
          borderRadius: 12, padding: '12px 20px', marginBottom: 24,
          boxShadow: '0 4px 14px rgba(114,46,209,0.3)',
        }}>
          <LockOutlined style={{ color: 'white', fontSize: 20 }} />
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
              {selConfig.min_cards}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>cards required simultaneously</div>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 12 }}>
          Authorised Members ({configMembers.length})
        </div>

        {configMembers.length === 0 ? (
          <div style={{ color: '#bfbfbf', fontSize: 13, padding: '8px 0' }}>No members configured</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {configMembers.map(m => {
              const emp = empMap[m.emp_code];
              return (
                <div key={m.emp_code} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'white', border: '1px solid #f0f0f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <Avatar size={36} style={{ background: '#722ed1', fontSize: 13, flexShrink: 0 }}>
                    {emp ? empInitials(emp) : m.emp_code[0]?.toUpperCase()}
                  </Avatar>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {emp ? `${emp.first_name} ${emp.last_name}` : m.emp_code}
                    </div>
                    <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>{m.emp_code}</div>
                    {emp?.department_name && (
                      <div style={{ fontSize: 10, color: '#bfbfbf' }}>{emp.department_name}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderEmpty = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <LockOutlined style={{ fontSize: 52, color: '#d9d9d9' }} />
      <div style={{ fontSize: 15, color: '#8c8c8c', fontWeight: 500 }}>Select a config to view details</div>
      <div style={{ color: '#bfbfbf', fontSize: 13 }}>or</div>
      <Button type="primary" icon={<PlusOutlined />} onClick={startAdd}>Add Config</Button>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>

      {/* Header */}
      <div style={{
        background: C.darkHeader,
        padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <Space size={14}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #722ed1, #531dab)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(114,46,209,0.4)',
          }}>
            <LockOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Multi-Card Open</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
              {configs.length} configs &bull; {totalMembers} authorised members
            </div>
          </div>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
      </div>

      {/* Split body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel ───────────────────────────────────────── */}
        <div style={{
          width: 280, flexShrink: 0, background: C.panel,
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <Button type="primary" icon={<PlusOutlined />} block onClick={startAdd}
              style={{ borderRadius: 8, marginBottom: 8, fontWeight: 600, background: '#722ed1', borderColor: '#722ed1' }}>
              Add Config
            </Button>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search doors..."
              value={search} onChange={e => setSearch(e.target.value)}
              allowClear style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#bfbfbf', fontSize: 13 }}>No configs found</div>
            ) : filtered.map(cfg => {
              const selected = cfg.id === selId;
              const memberCount = cfg.members?.length || 0;
              return (
                <div
                  key={cfg.id}
                  onClick={() => selectConfig(cfg.id)}
                  style={{
                    padding: '12px 14px', cursor: 'pointer',
                    background: selected ? C.selBg : 'transparent',
                    borderLeft: `3px solid ${selected ? '#722ed1' : 'transparent'}`,
                    borderBottom: `1px solid ${C.border}`,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f9f9f9'; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? C.selBg : 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg, #722ed1, #531dab)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <LockOutlined style={{ color: 'white', fontSize: 16 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13, color: '#141414',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{cfg.door_name}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '1px 7px',
                          background: '#f9f0ff', color: '#722ed1',
                        }}>{cfg.min_cards} cards</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, borderRadius: 6, padding: '1px 6px',
                          background: '#f5f5f5', color: '#8c8c8c',
                        }}>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8f9fb' }}>

          {adding ? (
            <>
              <div style={{
                background: 'linear-gradient(135deg, #1e0547, #2e0b6e)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
              }}>
                <Space size={12}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlusOutlined style={{ color: 'white', fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>New Multi-Card Config</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Require multiple cards to open</div>
                  </div>
                </Space>
                <Space>
                  <Button onClick={cancelEdit} icon={<CloseOutlined />}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>Cancel</Button>
                  <Button type="primary" loading={save.isPending} icon={<SaveOutlined />}
                    onClick={handleSave} style={{ background: '#722ed1', borderColor: '#722ed1', fontWeight: 600 }}>Create</Button>
                </Space>
              </div>
              {renderForm()}
            </>

          ) : selConfig ? (
            <>
              <div style={{
                background: 'linear-gradient(135deg, #1e0547, #2e0b6e)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
              }}>
                <Space size={14}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 14,
                    background: 'linear-gradient(135deg, #722ed1, #531dab)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(114,46,209,0.5)',
                  }}>
                    <LockOutlined style={{ color: 'white', fontSize: 22 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{selConfig.door_name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 }}>
                      {selConfig.min_cards} cards required &bull; {selConfig.members?.length || 0} authorised members
                    </div>
                  </div>
                </Space>
                <Space size={8}>
                  {editMode ? (
                    <>
                      <Button onClick={cancelEdit} icon={<CloseOutlined />}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>Cancel</Button>
                      <Button type="primary" loading={save.isPending} icon={<SaveOutlined />}
                        onClick={handleSave} style={{ fontWeight: 600 }}>Save</Button>
                    </>
                  ) : (
                    <Button icon={<EditOutlined />} onClick={startEdit}
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>Edit</Button>
                  )}
                  <Popconfirm title="Delete this config?" okText="Delete" okType="danger"
                    onConfirm={() => del.mutate(selConfig.id)}>
                    <Button danger icon={<DeleteOutlined />}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(245,34,45,0.5)' }} />
                  </Popconfirm>
                </Space>
              </div>
              {editMode ? renderForm() : renderView()}
            </>

          ) : renderEmpty()}
        </div>
      </div>
    </div>
  );
};

export default MultiCardSettings;
