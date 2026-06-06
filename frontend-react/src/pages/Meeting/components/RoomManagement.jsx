import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, Switch, message, Popconfirm, Card, Row, Col, Tooltip,
  Badge, Empty, Segmented,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  CalendarOutlined, AppstoreOutlined, UnorderedListOutlined,
  EnvironmentOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import meetingApi from '../../../services/meetingApi';

const EQUIP_OPTIONS = ['Projector', 'TV', 'Whiteboard', 'Video Conference', 'Audio System', 'Computer', 'Other'];

const RoomManagement = ({ onSchedule }) => {
  const [modal, setModal]       = useState(false);
  const [calModal, setCal]      = useState(false);
  const [editing, setEdit]      = useState(null);
  const [calRoom, setCalRoom]   = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch]     = useState('');
  const [statusFilter, setSF]   = useState('all');
  const [form]                  = Form.useForm();
  const qc                      = useQueryClient();
  const inv                     = () => qc.invalidateQueries(['meeting-rooms']);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['meeting-rooms'],
    queryFn:  () => meetingApi.getRooms({ include_inactive: true }),
    staleTime: 30000,
  });
  const allRooms = data?.data ?? [];

  const rooms = allRooms.filter(r => {
    const matchSearch = !search
      || r.room_name?.toLowerCase().includes(search.toLowerCase())
      || r.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all'
      || (statusFilter === '0' && r.status === 0)
      || (statusFilter === '1' && r.status === 1);
    return matchSearch && matchStatus;
  });

  const createMut = useMutation({
    mutationFn: d => meetingApi.createRoom(d),
    onSuccess: () => { message.success('Room created'); inv(); setModal(false); },
    onError:   e => message.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }) => meetingApi.updateRoom(id, d),
    onSuccess: () => { message.success('Room updated'); inv(); setModal(false); },
    onError:   e => message.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: id => meetingApi.deleteRoom(id),
    onSuccess: () => { message.success('Room deleted'); inv(); },
    onError:   e => message.error(e.message),
  });

  const openModal = (rec = null) => { setEdit(rec); setModal(true); };

  const onFinish = v => {
    const payload = { ...v, equipment: v.equipment ?? [] };
    if (editing) updateMut.mutate({ id: editing.id, d: payload });
    else         createMut.mutate(payload);
  };

  const columns = [
    {
      title: 'Room Name', dataIndex: 'room_name', ellipsis: true,
      render: (v, r) => (
        <>
          <div style={{ fontWeight: 600 }}>{v}</div>
          {r.location && <div style={{ fontSize: 12, color: '#8c8c8c' }}><EnvironmentOutlined /> {r.location}</div>}
        </>
      ),
    },
    { title: 'Capacity', dataIndex: 'capacity', width: 90 },
    {
      title: 'Status', dataIndex: 'status', width: 120,
      render: v => v === 0
        ? <Badge status="success" text="Available" />
        : <Badge status="warning" text="Maintenance" />,
    },
    {
      title: 'Equipment', width: 200,
      render: (_, r) => (
        <Space size={[4, 4]} wrap>
          {(r.equipment ?? []).slice(0, 3).map(e => <Tag key={e}>{e}</Tag>)}
          {(r.equipment ?? []).length > 3 && <Tag>+{r.equipment.length - 3}</Tag>}
          {r.require_approval && <Tag color="blue">Approval Req.</Tag>}
          {r.is_emergency_assembly && <Tag color="red">Emergency</Tag>}
        </Space>
      ),
    },
    {
      title: 'Actions', width: 120, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Calendar">
            <Button size="small" icon={<CalendarOutlined />} onClick={() => { setCalRoom(r); setCal(true); }} />
          </Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Delete this room?" onConfirm={() => deleteMut.mutate(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Command bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input.Search
          placeholder="Search rooms…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ width: 220 }}
        />
        <Select
          value={statusFilter}
          onChange={setSF}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: '0',   label: 'Available' },
            { value: '1',   label: 'Maintenance' },
          ]}
        />
        <Segmented
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'grid',  icon: <AppstoreOutlined /> },
            { value: 'table', icon: <UnorderedListOutlined /> },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} style={{ marginLeft: 'auto' }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Room</Button>
      </div>

      {/* Grid view */}
      {viewMode === 'grid' && (
        rooms.length === 0 ? <Empty description="No rooms found" /> : (
          <Row gutter={[16, 16]}>
            {rooms.map(r => (
              <Col xs={24} sm={12} lg={8} xl={6} key={r.id}>
                <Card
                  hoverable
                  size="small"
                  style={{ height: '100%' }}
                  extra={
                    <Badge
                      status={r.status === 0 ? 'success' : 'warning'}
                      text={r.status === 0 ? 'Available' : 'Maintenance'}
                      style={{ fontSize: 12 }}
                    />
                  }
                  title={<span style={{ fontWeight: 600 }}>{r.room_name}</span>}
                  actions={[
                    <Tooltip title="View Calendar" key="cal">
                      <CalendarOutlined onClick={() => { setCalRoom(r); setCal(true); }} />
                    </Tooltip>,
                    <Tooltip title="Book Room" key="book">
                      <PlusOutlined style={{ color: '#0078D4' }} onClick={() => onSchedule?.()} />
                    </Tooltip>,
                    <Tooltip title="Edit" key="edit">
                      <EditOutlined onClick={() => openModal(r)} />
                    </Tooltip>,
                    <Tooltip title="Delete" key="del">
                      <Popconfirm title="Delete this room?" onConfirm={() => deleteMut.mutate(r.id)} okType="danger">
                        <DeleteOutlined style={{ color: '#ff4d4f' }} />
                      </Popconfirm>
                    </Tooltip>,
                  ]}
                >
                  <div style={{ marginBottom: 8, color: '#595959', fontSize: 13 }}>
                    <TeamOutlined style={{ marginRight: 6 }} />
                    Capacity: <strong>{r.capacity}</strong>
                  </div>
                  {r.location && (
                    <div style={{ marginBottom: 8, color: '#8c8c8c', fontSize: 12 }}>
                      <EnvironmentOutlined style={{ marginRight: 4 }} />{r.location}
                    </div>
                  )}
                  <Space size={[4, 4]} wrap>
                    {r.require_approval && <Tag color="blue" style={{ fontSize: 11 }}>Approval Req.</Tag>}
                    {r.is_emergency_assembly && <Tag color="red" style={{ fontSize: 11 }}>Emergency</Tag>}
                    {(r.equipment ?? []).slice(0, 3).map(e => (
                      <Tag key={e} style={{ fontSize: 11 }}>{e}</Tag>
                    ))}
                    {(r.equipment ?? []).length > 3 && (
                      <Tag style={{ fontSize: 11 }}>+{r.equipment.length - 3} more</Tag>
                    )}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <Table
          dataSource={rooms}
          columns={columns}
          rowKey="id"
          size="small"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 700 }}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        title={editing ? 'Edit Room' : 'Add Room'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        destroyOnHidden
        width={540}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={editing ?? {
            status: 0, require_approval: false,
            is_emergency_assembly: false, auto_unlock: true,
          }}
        >
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="room_name" label="Room Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="capacity" label="Capacity" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="location" label="Location">
                <Input placeholder="Floor / Wing / Building" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select options={[{ value: 0, label: 'Available' }, { value: 1, label: 'Maintenance' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="equipment" label="Equipment">
                <Select
                  mode="tags"
                  options={EQUIP_OPTIONS.map(e => ({ value: e, label: e }))}
                  placeholder="Add equipment…"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="require_approval" label="Require Approval" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_emergency_assembly" label="Emergency Assembly" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="auto_unlock" label="Auto-Unlock" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        title={calRoom ? `${calRoom.room_name} — This Month's Bookings` : 'Calendar'}
        open={calModal}
        onCancel={() => setCal(false)}
        footer={null}
        width={640}
        destroyOnHidden
      >
        {calRoom && <RoomCalendar room={calRoom} />}
      </Modal>
    </>
  );
};

const RoomCalendar = ({ room }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['room-calendar', room.id],
    queryFn: () => {
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59).toISOString();
      return meetingApi.getRoomCalendar(room.id, start, end);
    },
    staleTime: 60000,
  });
  const bookings = data?.data ?? [];
  const STATUS_COLOR = { 0: 'gold', 1: 'green', 2: 'red', 3: 'blue', 4: 'default' };
  const STATUS_LABEL = { 0: 'Pending', 1: 'Approved', 2: 'Rejected', 3: 'Completed', 4: 'Cancelled' };

  if (isLoading) return <div style={{ textAlign: 'center', padding: 40 }}>Loading…</div>;
  if (!bookings.length) return <Empty description="No bookings this month" style={{ padding: 40 }} />;

  return (
    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
      <Table
        size="small"
        pagination={false}
        dataSource={bookings}
        rowKey="id"
        columns={[
          { title: 'Meeting',  dataIndex: 'title',      ellipsis: true },
          {
            title: 'Start', dataIndex: 'start_time', width: 160,
            render: v => new Date(v).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          },
          {
            title: 'End', dataIndex: 'end_time', width: 70,
            render: v => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          {
            title: 'Status', dataIndex: 'status', width: 110,
            render: v => <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? '—'}</Tag>,
          },
        ]}
      />
    </div>
  );
};

export default RoomManagement;
