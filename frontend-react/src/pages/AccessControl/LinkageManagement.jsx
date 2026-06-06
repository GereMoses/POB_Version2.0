import React, { useState, useMemo } from 'react';
import {
  Button, Select, Popconfirm, Form, Space, Spin, App, Input,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined,
  ArrowRightOutlined, SearchOutlined, CloseOutlined, SaveOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;

const INPUT_TYPES = [
  { v: 0, l: 'Door Sensor',     color: '#1677ff', bg: '#e6f7ff', border: '#91caff',  icon: '🚪' },
  { v: 1, l: 'Auxiliary Input', color: '#fa8c16', bg: '#fff7e6', border: '#ffd591',  icon: '⚡' },
  { v: 2, l: 'Fire Panel',      color: '#f5222d', bg: '#fff1f0', border: '#ffa39e',  icon: '🔥' },
];

const OUTPUT_ACTIONS = [
  { v: 0, l: 'Open Door', color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
  { v: 1, l: 'Alarm',     color: '#f5222d', bg: '#fff1f0', border: '#ffa39e' },
  { v: 2, l: 'Siren',     color: '#f5222d', bg: '#fff1f0', border: '#ffa39e' },
  { v: 3, l: 'Strobe',    color: '#faad14', bg: '#fffbe6', border: '#ffe58f' },
];

const C = {
  bg: '#f0f2f5',
  panel: 'white',
  border: '#f0f0f0',
  selBg: '#e6fffb',
  darkHeader: 'linear-gradient(135deg, #00111a 0%, #003344 50%, #006d75 100%)',
};

/* ── Visual flow diagram ─────────────────────────────────────────────── */
const FlowDiagram = ({ linkage, doors }) => {
  const input  = INPUT_TYPES.find(t => t.v === linkage.input_type)  || INPUT_TYPES[0];
  const output = OUTPUT_ACTIONS.find(a => a.v === linkage.output_action) || OUTPUT_ACTIONS[0];
  const targetDoor = doors.find(d => d.id === linkage.output_door_id);

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginTop: 8 }}>
      {/* Input box */}
      <div style={{
        flex: 1, padding: '20px 18px', borderRadius: '12px 0 0 12px',
        background: input.bg, border: `2px solid ${input.border}`,
        borderRight: 'none',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>{input.icon}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 4 }}>Trigger Input</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: input.color }}>{input.l}</div>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 6, fontFamily: 'monospace' }}>
          {linkage.terminal_sn || 'Any terminal'}
        </div>
      </div>

      {/* Arrow */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 12px', background: '#fafafa', border: '2px solid #e8e8e8',
        borderLeft: 'none', borderRight: 'none',
      }}>
        <ThunderboltOutlined style={{ color: '#fa8c16', fontSize: 16, marginBottom: 4 }} />
        <ArrowRightOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />
        <div style={{ fontSize: 9, color: '#bfbfbf', marginTop: 4, textTransform: 'uppercase' }}>triggers</div>
      </div>

      {/* Output box */}
      <div style={{
        flex: 1, padding: '20px 18px', borderRadius: '0 12px 12px 0',
        background: output.bg, border: `2px solid ${output.border}`,
        borderLeft: 'none',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>
          {output.v === 0 ? '🔓' : output.v === 1 ? '🚨' : output.v === 2 ? '📢' : '💡'}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 4 }}>Output Action</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: output.color }}>{output.l}</div>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 6 }}>
          {targetDoor ? targetDoor.door_name : linkage.output_terminal_sn || 'Any device'}
        </div>
      </div>
    </div>
  );
};

/* ── Mini flow card for left panel ──────────────────────────────────── */
const MiniFlow = ({ linkage }) => {
  const input  = INPUT_TYPES.find(t => t.v === linkage.input_type)  || INPUT_TYPES[0];
  const output = OUTPUT_ACTIONS.find(a => a.v === linkage.output_action) || OUTPUT_ACTIONS[0];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, paddingLeft: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: input.color, background: input.bg, borderRadius: 5, padding: '1px 6px', border: `1px solid ${input.border}` }}>
        {input.icon} {input.l}
      </span>
      <ArrowRightOutlined style={{ fontSize: 9, color: '#bfbfbf' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: output.color, background: output.bg, borderRadius: 5, padding: '1px 6px', border: `1px solid ${output.border}` }}>
        {output.l}
      </span>
    </div>
  );
};

const LinkageManagement = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const [selId,    setSelId]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [editMode, setEditMode] = useState(false);
  const [adding,   setAdding]   = useState(false);

  // ── Queries ────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['acc-linkage'],
    queryFn:  () => apiService.get('/api/access-control/linkage/'),
  });
  const linkages = data?.data || [];

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn:  () => apiService.get('/api/access-control/doors/'),
  });
  const doors = doorsData?.data || [];

  // ── Derived ────────────────────────────────────────────────────────
  const selLinkage = useMemo(() => linkages.find(l => l.id === selId) || null, [linkages, selId]);

  const filtered = useMemo(() => {
    if (!search) return linkages;
    const q = search.toLowerCase();
    return linkages.filter(l =>
      INPUT_TYPES.find(t => t.v === l.input_type)?.l.toLowerCase().includes(q) ||
      OUTPUT_ACTIONS.find(a => a.v === l.output_action)?.l.toLowerCase().includes(q) ||
      l.terminal_sn?.toLowerCase().includes(q));
  }, [linkages, search]);

  const inputCounts = useMemo(() => {
    const c = {};
    linkages.forEach(l => { c[l.input_type] = (c[l.input_type] || 0) + 1; });
    return c;
  }, [linkages]);

  // ── Mutations ──────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: v => adding
      ? apiService.post('/api/access-control/linkage/', v)
      : apiService.put(`/api/access-control/linkage/${selId}`, v),
    onSuccess: res => {
      message.success(adding ? 'Linkage created' : 'Linkage updated');
      qc.invalidateQueries(['acc-linkage']);
      if (adding) { setAdding(false); setSelId(res?.data?.id ?? null); }
      setEditMode(false);
    },
    onError: e => message.error(e?.message || 'Error saving'),
  });

  const del = useMutation({
    mutationFn: id => apiService.delete(`/api/access-control/linkage/${id}`),
    onSuccess: () => {
      message.success('Linkage deleted');
      qc.invalidateQueries(['acc-linkage']);
      setSelId(null); setEditMode(false);
    },
    onError: e => message.error(e?.message || 'Error'),
  });

  // ── Handlers ──────────────────────────────────────────────────────
  const startAdd = () => {
    form.resetFields();
    setSelId(null); setEditMode(false); setAdding(true);
  };

  const startEdit = () => {
    if (!selLinkage) return;
    form.setFieldsValue({
      terminal_sn:        selLinkage.terminal_sn,
      input_type:         selLinkage.input_type,
      output_action:      selLinkage.output_action,
      output_door_id:     selLinkage.output_door_id ?? undefined,
      output_terminal_sn: selLinkage.output_terminal_sn ?? undefined,
    });
    setEditMode(true);
  };

  const cancelEdit = () => { setEditMode(false); setAdding(false); };
  const selectLinkage = id => { setSelId(id); setEditMode(false); setAdding(false); };

  // ── Form ──────────────────────────────────────────────────────────
  const renderForm = () => (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
      <Form form={form} layout="vertical" onFinish={v => save.mutate(v)}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 10 }}>
          Input (Trigger)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Form.Item name="input_type" label="Input Type" rules={[{ required: true, message: 'Required' }]}>
            <Select size="large">
              {INPUT_TYPES.map(t => (
                <Option key={t.v} value={t.v}>
                  <Space>{t.icon} {t.l}</Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="terminal_sn" label="Source Terminal" rules={[{ required: true, message: 'Required' }]}>
            <Select showSearch optionFilterProp="label" size="large" placeholder="Select terminal">
              {doors.map(d => (
                <Option key={d.terminal_sn} value={d.terminal_sn} label={d.terminal_sn}>
                  {d.terminal_sn} — {d.door_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', margin: '8px 0 10px' }}>
          Output (Action)
        </div>
        <Form.Item name="output_action" label="Output Action" rules={[{ required: true, message: 'Required' }]}>
          <Select size="large">
            {OUTPUT_ACTIONS.map(a => <Option key={a.v} value={a.v}>{a.l}</Option>)}
          </Select>
        </Form.Item>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <Form.Item name="output_door_id" label="Output Door (for door control)">
            <Select allowClear showSearch optionFilterProp="label" size="large" placeholder="Select door">
              {doors.map(d => <Option key={d.id} value={d.id} label={d.door_name}>{d.door_name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="output_terminal_sn" label="Output Terminal (for siren/strobe)">
            <Select allowClear showSearch optionFilterProp="label" size="large" placeholder="Select terminal">
              {doors.map(d => (
                <Option key={d.terminal_sn} value={d.terminal_sn} label={d.terminal_sn}>
                  {d.terminal_sn} — {d.door_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>
      </Form>
    </div>
  );

  // ── View ──────────────────────────────────────────────────────────
  const renderView = () => {
    if (!selLinkage) return null;
    const input  = INPUT_TYPES.find(t => t.v === selLinkage.input_type)  || INPUT_TYPES[0];
    const output = OUTPUT_ACTIONS.find(a => a.v === selLinkage.output_action) || OUTPUT_ACTIONS[0];
    const targetDoor = doors.find(d => d.id === selLinkage.output_door_id);

    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 14 }}>
          Linkage Flow
        </div>
        <FlowDiagram linkage={selLinkage} doors={doors} />

        {/* Detail grid */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Input Type',       value: `${input.icon} ${input.l}`,   color: input.color,   bg: input.bg  },
            { label: 'Output Action',    value: output.l,                      color: output.color,  bg: output.bg },
            { label: 'Source Terminal',  value: selLinkage.terminal_sn || '—', color: '#595959', bg: '#fafafa' },
            { label: 'Output Target',    value: targetDoor ? targetDoor.door_name : selLinkage.output_terminal_sn || '—', color: '#595959', bg: '#fafafa' },
          ].map(item => (
            <div key={item.label} style={{
              padding: '12px 16px', borderRadius: 10,
              background: item.bg, border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEmpty = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <ThunderboltOutlined style={{ fontSize: 52, color: '#d9d9d9' }} />
      <div style={{ fontSize: 15, color: '#8c8c8c', fontWeight: 500 }}>Select a linkage to view its flow</div>
      <div style={{ color: '#bfbfbf', fontSize: 13 }}>or</div>
      <Button type="primary" icon={<PlusOutlined />} onClick={startAdd}>Add Linkage</Button>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>

      {/* Header */}
      <div style={{
        background: C.darkHeader,
        padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
      }}>
        <Space size={14}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #13c2c2, #006d75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(19,194,194,0.4)',
          }}>
            <ThunderboltOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Linkage Management</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
              {linkages.length} linkage{linkages.length !== 1 ? 's' : ''} &bull;{' '}
              {INPUT_TYPES.map(t => `${inputCounts[t.v] || 0} ${t.icon}`).join(' · ')}
            </div>
          </div>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
      </div>

      {/* Split body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel ────────────────────────────────────────── */}
        <div style={{
          width: 280, flexShrink: 0, background: C.panel,
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <Button type="primary" icon={<PlusOutlined />} block onClick={startAdd}
              style={{ borderRadius: 8, marginBottom: 8, fontWeight: 600, background: '#13c2c2', borderColor: '#13c2c2' }}>
              Add Linkage
            </Button>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search linkages..."
              value={search} onChange={e => setSearch(e.target.value)}
              allowClear style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#bfbfbf', fontSize: 13 }}>No linkages found</div>
            ) : filtered.map(lnk => {
              const selected = lnk.id === selId;
              const input  = INPUT_TYPES.find(t => t.v === lnk.input_type) || INPUT_TYPES[0];
              return (
                <div
                  key={lnk.id}
                  onClick={() => selectLinkage(lnk.id)}
                  style={{
                    padding: '11px 14px', cursor: 'pointer',
                    background: selected ? C.selBg : 'transparent',
                    borderLeft: `3px solid ${selected ? '#13c2c2' : 'transparent'}`,
                    borderBottom: `1px solid ${C.border}`,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f9f9f9'; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? C.selBg : 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `linear-gradient(135deg, ${input.color}, ${input.color}cc)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17,
                    }}>
                      {input.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 12, color: '#141414',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {lnk.terminal_sn || 'Any terminal'}
                      </div>
                      <MiniFlow linkage={lnk} />
                    </div>
                  </div>
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
                background: 'linear-gradient(135deg, #003333, #006d75)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
              }}>
                <Space size={12}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlusOutlined style={{ color: 'white', fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>New Linkage</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Map an input trigger to an output action</div>
                  </div>
                </Space>
                <Space>
                  <Button onClick={cancelEdit} icon={<CloseOutlined />}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>Cancel</Button>
                  <Button type="primary" loading={save.isPending} icon={<SaveOutlined />}
                    onClick={() => form.submit()} style={{ background: '#13c2c2', borderColor: '#13c2c2', fontWeight: 600 }}>Create</Button>
                </Space>
              </div>
              {renderForm()}
            </>

          ) : selLinkage ? (
            <>
              <div style={{
                background: 'linear-gradient(135deg, #003333, #006d75)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
              }}>
                <Space size={14}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 14,
                    background: 'linear-gradient(135deg, #13c2c2, #006d75)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(19,194,194,0.5)',
                  }}>
                    <ThunderboltOutlined style={{ color: 'white', fontSize: 22 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
                      {INPUT_TYPES.find(t => t.v === selLinkage.input_type)?.l || 'Linkage'}
                      {' '}→{' '}
                      {OUTPUT_ACTIONS.find(a => a.v === selLinkage.output_action)?.l || '?'}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3, fontFamily: 'monospace' }}>
                      {selLinkage.terminal_sn || 'Any terminal'}
                    </div>
                  </div>
                </Space>
                <Space size={8}>
                  {editMode ? (
                    <>
                      <Button onClick={cancelEdit} icon={<CloseOutlined />}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>Cancel</Button>
                      <Button type="primary" loading={save.isPending} icon={<SaveOutlined />}
                        onClick={() => form.submit()} style={{ fontWeight: 600 }}>Save</Button>
                    </>
                  ) : (
                    <Button icon={<EditOutlined />} onClick={startEdit}
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>Edit</Button>
                  )}
                  <Popconfirm title="Delete this linkage?" okText="Delete" okType="danger"
                    onConfirm={() => del.mutate(selLinkage.id)}>
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

export default LinkageManagement;
