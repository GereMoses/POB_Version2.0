import React, { useState, useMemo } from 'react';
import {
  Button, Select, Input, Popconfirm, Form, Tag,
  Space, Spin, App, Alert,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, LinkOutlined, ApiOutlined,
  SearchOutlined, CloseOutlined, SaveOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;
const { TextArea } = Input;

const C = {
  bg: '#f0f2f5',
  panel: 'white',
  border: '#f0f0f0',
  selBg: '#e6f7ff',
  darkHeader: 'linear-gradient(135deg, #001529 0%, #003366 50%, #0050b3 100%)',
};

/* ── Visual door chain diagram ──────────────────────────────────────── */
const DoorChain = ({ doors, allDoors }) => {
  if (!doors?.length) return (
    <div style={{ color: '#bfbfbf', fontSize: 13, padding: '12px 0' }}>No doors in this group</div>
  );

  const doorMap = {};
  allDoors.forEach(d => { doorMap[d.id] = d; });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'center' }}>
      {doors.map((d, i) => {
        const door = doorMap[d.door_id] || {};
        const isLast = i === doors.length - 1;
        return (
          <React.Fragment key={d.door_id}>
            {/* Door box */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '14px 20px', borderRadius: 12,
              background: door.is_online ? 'linear-gradient(135deg, #e6f4ff, #bae0ff)' : '#f5f5f5',
              border: `1px solid ${door.is_online ? '#91caff' : '#d9d9d9'}`,
              minWidth: 120,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: door.is_online
                  ? 'linear-gradient(135deg, #1677ff, #0958d9)'
                  : 'linear-gradient(135deg, #bfbfbf, #8c8c8c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: door.is_online ? '0 3px 8px rgba(22,119,255,0.35)' : 'none',
              }}>
                <ApiOutlined style={{ color: 'white', fontSize: 16 }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#141414', lineHeight: 1.2 }}>
                  {d.door_name || `Door #${d.door_id}`}
                </div>
                <div style={{ fontSize: 10, color: door.is_online ? '#1677ff' : '#8c8c8c', marginTop: 2 }}>
                  {door.is_online ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>

            {/* Link connector */}
            {!isLast && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 4px' }}>
                <div style={{ width: 20, height: 2, background: '#91caff' }} />
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(22,119,255,0.3)',
                }}>
                  <LinkOutlined style={{ color: 'white', fontSize: 10 }} />
                </div>
                <div style={{ width: 20, height: 2, background: '#91caff' }} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const InterlockManagement = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();

  const [selId,    setSelId]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [editMode, setEditMode] = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [selDoors, setSelDoors] = useState([]);

  // ── Queries ────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['acc-interlock'],
    queryFn:  () => apiService.get('/api/access-control/interlock/'),
  });
  const groups = data?.data || [];

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn:  () => apiService.get('/api/access-control/doors/'),
  });
  const doors = doorsData?.data || [];

  // ── Derived ────────────────────────────────────────────────────────
  const selGroup = useMemo(() => groups.find(g => g.id === selId) || null, [groups, selId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? groups.filter(g => g.group_name?.toLowerCase().includes(q)) : groups;
  }, [groups, search]);

  const totalDoors = groups.reduce((s, g) => s + (g.doors?.length || 0), 0);

  // ── Mutations ──────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: v => {
      const body = { ...v, door_ids: selDoors };
      return adding
        ? apiService.post('/api/access-control/interlock/', body)
        : apiService.put(`/api/access-control/interlock/${selId}`, body);
    },
    onSuccess: res => {
      message.success(adding ? 'Group created' : 'Group updated');
      qc.invalidateQueries(['acc-interlock']);
      if (adding) { setAdding(false); setSelId(res?.data?.id ?? null); }
      setEditMode(false);
    },
    onError: e => message.error(e?.message || 'Error saving (min 2 doors required)'),
  });

  const del = useMutation({
    mutationFn: id => apiService.delete(`/api/access-control/interlock/${id}`),
    onSuccess: () => {
      message.success('Group deleted');
      qc.invalidateQueries(['acc-interlock']);
      setSelId(null); setEditMode(false);
    },
    onError: e => message.error(e?.message || 'Error'),
  });

  // ── Handlers ──────────────────────────────────────────────────────
  const startAdd = () => {
    form.resetFields(); setSelDoors([]);
    setSelId(null); setEditMode(false); setAdding(true);
  };

  const startEdit = () => {
    if (!selGroup) return;
    form.setFieldsValue({ group_name: selGroup.group_name, description: selGroup.description });
    setSelDoors(selGroup.doors?.map(d => d.door_id) || []);
    setEditMode(true);
  };

  const cancelEdit = () => { setEditMode(false); setAdding(false); setSelDoors([]); };

  const selectGroup = id => { setSelId(id); setEditMode(false); setAdding(false); };

  const handleSave = () => { form.validateFields().then(v => save.mutate(v)); };

  // ── Form ──────────────────────────────────────────────────────────
  const renderForm = () => (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
      <Form form={form} layout="vertical">
        <Form.Item name="group_name" label="Group Name" rules={[{ required: true, message: 'Required' }]}>
          <Input size="large" placeholder="e.g. Airlock Group A" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <TextArea rows={2} placeholder="Describe this interlock group..." />
        </Form.Item>
      </Form>

      <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 10 }}>
        Doors in Group <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11, color: '#bfbfbf' }}>(min. 2)</span>
      </div>
      <Select
        mode="multiple" placeholder="Select doors for this group"
        style={{ width: '100%', marginBottom: 10 }}
        value={selDoors} onChange={setSelDoors} optionFilterProp="label"
        size="large"
      >
        {doors.map(d => <Option key={d.id} value={d.id} label={d.door_name}>{d.door_name}</Option>)}
      </Select>

      {selDoors.length === 1 && (
        <Alert type="warning" style={{ borderRadius: 8, marginBottom: 10 }}
          message="At least 2 doors are required for an interlock group." />
      )}

      {selDoors.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 10 }}>
            Preview
          </div>
          <DoorChain
            doors={selDoors.map(id => ({ door_id: id, door_name: doors.find(d => d.id === id)?.door_name }))}
            allDoors={doors}
          />
        </div>
      )}
    </div>
  );

  // ── View ──────────────────────────────────────────────────────────
  const renderView = () => {
    if (!selGroup) return null;
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
        {selGroup.description && (
          <div style={{ fontSize: 13, color: '#595959', marginBottom: 20, padding: '10px 14px', background: 'white', borderRadius: 8, border: '1px solid #f0f0f0' }}>
            {selGroup.description}
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 14 }}>
          Interlocked Doors ({selGroup.doors?.length || 0})
        </div>

        <div style={{ marginBottom: 20 }}>
          <DoorChain doors={selGroup.doors || []} allDoors={doors} />
        </div>

        <Alert
          type="info" style={{ borderRadius: 8 }}
          message="Only one door in this group can be open at a time. Opening one automatically locks all others."
        />
      </div>
    );
  };

  const renderEmpty = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <LinkOutlined style={{ fontSize: 52, color: '#d9d9d9' }} />
      <div style={{ fontSize: 15, color: '#8c8c8c', fontWeight: 500 }}>Select a group to view its diagram</div>
      <div style={{ color: '#bfbfbf', fontSize: 13 }}>or</div>
      <Button type="primary" icon={<PlusOutlined />} onClick={startAdd}>Add Group</Button>
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
            background: 'linear-gradient(135deg, #1677ff, #0958d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(22,119,255,0.4)',
          }}>
            <LinkOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Interlock Management</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
              {groups.length} groups &bull; {totalDoors} doors interlocked
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
              style={{ borderRadius: 8, marginBottom: 8, fontWeight: 600 }}>
              Add Group
            </Button>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search groups..."
              value={search} onChange={e => setSearch(e.target.value)}
              allowClear style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#bfbfbf', fontSize: 13 }}>No groups found</div>
            ) : filtered.map(group => {
              const selected  = group.id === selId;
              const doorCount = group.doors?.length || 0;
              return (
                <div
                  key={group.id}
                  onClick={() => selectGroup(group.id)}
                  style={{
                    padding: '12px 14px', cursor: 'pointer',
                    background: selected ? C.selBg : 'transparent',
                    borderLeft: `3px solid ${selected ? '#1677ff' : 'transparent'}`,
                    borderBottom: `1px solid ${C.border}`,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f9f9f9'; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? C.selBg : 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg, #1677ff, #0958d9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <LinkOutlined style={{ color: 'white', fontSize: 16 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13, color: '#141414',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{group.group_name}</div>
                      {group.description && (
                        <div style={{
                          fontSize: 11, color: '#8c8c8c', marginTop: 1,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{group.description}</div>
                      )}
                      <div style={{ marginTop: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, borderRadius: 6, padding: '1px 7px',
                          background: '#e6f7ff', color: '#1677ff',
                        }}>{doorCount} door{doorCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mini door tags */}
                  {doorCount > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, paddingLeft: 46 }}>
                      {(group.doors || []).slice(0, 3).map(d => (
                        <Tag key={d.door_id} style={{ fontSize: 9, padding: '0 4px', margin: 0, borderRadius: 4, background: '#e6f7ff', color: '#1677ff', border: '1px solid #91caff' }}>
                          <ApiOutlined style={{ marginRight: 2, fontSize: 8 }} />{d.door_name}
                        </Tag>
                      ))}
                      {doorCount > 3 && (
                        <Tag style={{ fontSize: 9, padding: '0 4px', margin: 0, borderRadius: 4 }}>+{doorCount - 3}</Tag>
                      )}
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
                background: 'linear-gradient(135deg, #001529, #003a8c)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
              }}>
                <Space size={12}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlusOutlined style={{ color: 'white', fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>New Interlock Group</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Link 2+ doors to open one at a time</div>
                  </div>
                </Space>
                <Space>
                  <Button onClick={cancelEdit} icon={<CloseOutlined />}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>Cancel</Button>
                  <Button type="primary" loading={save.isPending} icon={<SaveOutlined />}
                    onClick={handleSave} disabled={selDoors.length < 2} style={{ fontWeight: 600 }}>Create Group</Button>
                </Space>
              </div>
              {renderForm()}
            </>

          ) : selGroup ? (
            <>
              <div style={{
                background: 'linear-gradient(135deg, #001529, #003a8c)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
              }}>
                <Space size={14}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 14,
                    background: 'linear-gradient(135deg, #1677ff, #0958d9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(22,119,255,0.5)',
                  }}>
                    <LinkOutlined style={{ color: 'white', fontSize: 22 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{selGroup.group_name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 }}>
                      {selGroup.doors?.length || 0} doors interlocked
                    </div>
                  </div>
                </Space>
                <Space size={8}>
                  {editMode ? (
                    <>
                      <Button onClick={cancelEdit} icon={<CloseOutlined />}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>Cancel</Button>
                      <Button type="primary" loading={save.isPending} icon={<SaveOutlined />}
                        onClick={handleSave} disabled={selDoors.length < 2} style={{ fontWeight: 600 }}>Save</Button>
                    </>
                  ) : (
                    <Button icon={<EditOutlined />} onClick={startEdit}
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>Edit</Button>
                  )}
                  <Popconfirm title="Delete this group?" okText="Delete" okType="danger"
                    onConfirm={() => del.mutate(selGroup.id)}>
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

export default InterlockManagement;
