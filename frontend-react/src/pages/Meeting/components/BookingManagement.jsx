import React, { useState, useMemo } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  message, Popconfirm, Descriptions, Divider, List, Avatar,
  Alert, Tooltip, Row, Col,
} from 'antd';
import { DatePicker } from 'antd';
import {
  PlusOutlined, EditOutlined, ReloadOutlined, QrcodeOutlined,
  StopOutlined, TeamOutlined, DeleteOutlined, UserOutlined,
  CheckOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';
import meetingApi from '../../../services/meetingApi';
import usePersonnel from '../../../hooks/usePersonnel';

const STATUS_MAP = {
  0: { color: 'gold',    label: 'Pending' },
  1: { color: 'green',   label: 'Approved' },
  2: { color: 'red',     label: 'Rejected' },
  3: { color: 'blue',    label: 'Completed' },
  4: { color: 'default', label: 'Cancelled' },
};

const BookingManagement = () => {
  const [modal, setModal]        = useState(false);
  const [detailModal, setDetail] = useState(false);
  const [qrModal, setQrModal]    = useState(false);
  const [editing, setEdit]       = useState(null);
  const [selected, setSelected]  = useState(null);
  const [statusFilter, setSF]    = useState('all');
  const [search, setSearch]      = useState('');
  const [form]                   = Form.useForm();
  const [attForm]                = Form.useForm();
  const qc                       = useQueryClient();
  const inv                      = () => qc.invalidateQueries(['meeting-bookings']);
  const { empOptions }           = usePersonnel();

  const { data: roomsData } = useQuery({
    queryKey: ['meeting-rooms'],
    queryFn:  () => meetingApi.getRooms(),
    staleTime: 60000,
  });
  const roomOptions = (roomsData?.data ?? []).map(r => ({
    value: r.id, label: `${r.room_name} (cap: ${r.capacity})`,
  }));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['meeting-bookings'],
    queryFn:  () => meetingApi.getBookings({ limit: 200 }),
    staleTime: 30000,
  });
  const allRows = data?.data ?? [];

  const rows = useMemo(() => {
    let r = allRows;
    if (statusFilter !== 'all') r = r.filter(b => String(b.status) === statusFilter);
    if (search) r = r.filter(b =>
      b.title?.toLowerCase().includes(search.toLowerCase()) ||
      b.room?.room_name?.toLowerCase().includes(search.toLowerCase())
    );
    return r;
  }, [allRows, statusFilter, search]);

  const todayMeetings = useMemo(
    () => allRows.filter(b => dayjs(b.start_time).isSame(dayjs(), 'day') && [0, 1].includes(b.status)),
    [allRows]
  );

  const { data: attendeesData, refetch: refetchAtt } = useQuery({
    queryKey: ['booking-attendees', selected?.id],
    queryFn:  () => meetingApi.getBookingAttendees(selected.id),
    enabled:  !!selected?.id,
  });
  const attendees = attendeesData?.data ?? [];

  const createMut  = useMutation({ mutationFn: d => meetingApi.createBooking(d),             onSuccess: () => { message.success('Booking created'); inv(); setModal(false); },   onError: e => message.error(e.response?.data?.detail || e.message) });
  const updateMut  = useMutation({ mutationFn: ({ id, d }) => meetingApi.updateBooking(id, d), onSuccess: () => { message.success('Booking updated'); inv(); setModal(false); },   onError: e => message.error(e.response?.data?.detail || e.message) });
  const cancelMut  = useMutation({ mutationFn: ({ id }) => meetingApi.cancelBooking(id, { reason: 'Cancelled' }), onSuccess: () => { message.success('Cancelled'); inv(); }, onError: e => message.error(e.message) });
  const completeMut = useMutation({ mutationFn: id => meetingApi.completeBooking(id),         onSuccess: () => { message.success('Completed'); inv(); },                          onError: e => message.error(e.message) });
  const addAttMut  = useMutation({ mutationFn: ({ bid, data }) => meetingApi.addAttendees(bid, data), onSuccess: () => { message.success('Attendee added'); refetchAtt(); attForm.resetFields(); }, onError: e => message.error(e.message) });
  const removeAttMut = useMutation({ mutationFn: ({ bid, aid }) => meetingApi.removeAttendee(bid, aid), onSuccess: () => { message.success('Removed'); refetchAtt(); }, onError: e => message.error(e.message) });

  const openModal = (rec = null) => { setEdit(rec); setModal(true); };

  const onFinish = v => {
    const payload = {
      room_id:          v.room_id,
      title:            v.title,
      start_time:       v.time_range[0].toISOString(),
      end_time:         v.time_range[1].toISOString(),
      organizer_emp_id: v.organizer_emp_id,
      agenda:           v.agenda ?? '',
      auto_unlock:      true,
    };
    if (editing) updateMut.mutate({ id: editing.id, d: payload });
    else         createMut.mutate(payload);
  };

  const onAddAttendee = v => {
    const att = v.attendee_type === 0
      ? { attendee_type: 0, emp_id: v.emp_id, is_required: true }
      : { attendee_type: 2, ext_name: v.ext_name, ext_email: v.ext_email, is_required: true };
    addAttMut.mutate({ bid: selected.id, data: [att] });
  };

  const columns = [
    {
      title: 'Meeting Title', dataIndex: 'title', ellipsis: true,
      render: (v, r) => (
        <>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.room?.room_name ?? '—'}</div>
        </>
      ),
    },
    {
      title: 'Date & Time', dataIndex: 'start_time', width: 170,
      render: (v, r) => (
        <>
          <div>{dayjs(v).format('DD MMM YYYY')}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            {dayjs(v).format('HH:mm')} — {dayjs(r.end_time).format('HH:mm')}
          </div>
        </>
      ),
    },
    { title: 'Organizer', dataIndex: 'organizer', width: 150, render: (_, r) => r.organizer?.full_name ?? '—' },
    { title: 'Attendees', dataIndex: 'attendee_count', width: 90, render: v => <><TeamOutlined /> {v}</> },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: v => {
        const s = STATUS_MAP[v] ?? { color: 'default', label: '?' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '', width: 130, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Details / Attendees">
            <Button size="small" icon={<TeamOutlined />} onClick={() => { setSelected(r); setDetail(true); }} />
          </Tooltip>
          {r.status === 1 && (
            <Tooltip title="QR Code">
              <Button size="small" icon={<QrcodeOutlined />} onClick={() => { setSelected(r); setQrModal(true); }} />
            </Tooltip>
          )}
          {r.status === 0 && <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />}
          {r.status === 1 && (
            <Popconfirm title="Mark as completed?" onConfirm={() => completeMut.mutate(r.id)}>
              <Tooltip title="Complete"><Button size="small" icon={<CheckOutlined />} /></Tooltip>
            </Popconfirm>
          )}
          {[0, 1].includes(r.status) && (
            <Popconfirm title="Cancel this booking?" okType="danger" onConfirm={() => cancelMut.mutate({ id: r.id })}>
              <Tooltip title="Cancel"><Button size="small" danger icon={<StopOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const initValues = editing ? {
    room_id:          editing.room_id,
    title:            editing.title,
    time_range:       [dayjs(editing.start_time), dayjs(editing.end_time)],
    organizer_emp_id: editing.organizer_emp_id,
    agenda:           editing.agenda,
  } : {};

  return (
    <>
      {/* Today's meetings notice */}
      {todayMeetings.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <span>
              <strong>{todayMeetings.length}</strong> meeting{todayMeetings.length > 1 ? 's' : ''} today —{' '}
              {todayMeetings.map(b => (
                <Tag key={b.id} color={STATUS_MAP[b.status]?.color} style={{ margin: '0 2px' }}>
                  {b.title} {dayjs(b.start_time).format('HH:mm')}
                </Tag>
              ))}
            </span>
          }
        />
      )}

      {/* Command bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input.Search
          placeholder="Search meetings…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ width: 220 }}
        />
        <Select
          value={statusFilter}
          onChange={setSF}
          style={{ width: 150 }}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: '0',   label: 'Pending' },
            { value: '1',   label: 'Approved' },
            { value: '3',   label: 'Completed' },
            { value: '4',   label: 'Cancelled' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} style={{ marginLeft: 'auto' }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Schedule Meeting
        </Button>
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 20, showTotal: t => `${t} total` }}
        scroll={{ x: 900 }}
      />

      {/* Create / Edit */}
      <Modal
        title={editing ? 'Edit Booking' : 'Schedule Meeting'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        destroyOnHidden
        width={540}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={initValues}>
          <Form.Item name="title" label="Meeting Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Q2 Strategy Review" />
          </Form.Item>
          <Form.Item name="room_id" label="Room" rules={[{ required: true }]}>
            <Select options={roomOptions} showSearch placeholder="Select room…"
              filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="time_range" label="Start → End Time" rules={[{ required: true }]}>
            <DatePicker.RangePicker showTime format="DD MMM YYYY HH:mm" style={{ width: '100%' }} minuteStep={15} />
          </Form.Item>
          <Form.Item name="organizer_emp_id" label="Organizer" rules={[{ required: true }]}>
            <Select options={empOptions} showSearch placeholder="Select organizer…"
              filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="agenda" label="Agenda">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Details / Attendees */}
      <Modal
        title={selected?.title ?? 'Booking Details'}
        open={detailModal}
        onCancel={() => setDetail(false)}
        footer={null}
        destroyOnHidden
        width={620}
      >
        {selected && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Room">{selected.room?.room_name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_MAP[selected.status]?.color}>{STATUS_MAP[selected.status]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Date">{dayjs(selected.start_time).format('DD MMM YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Time">
                {dayjs(selected.start_time).format('HH:mm')} — {dayjs(selected.end_time).format('HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Organizer" span={2}>{selected.organizer?.full_name ?? '—'}</Descriptions.Item>
              {selected.meeting_code && (
                <Descriptions.Item label="Meeting Code" span={2}>
                  <code>{selected.meeting_code}</code>
                </Descriptions.Item>
              )}
              {selected.agenda && (
                <Descriptions.Item label="Agenda" span={2}>{selected.agenda}</Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left">Attendees ({attendees.length})</Divider>
            <List
              size="small"
              dataSource={attendees}
              locale={{ emptyText: 'No attendees yet' }}
              renderItem={a => (
                <List.Item actions={[
                  <Button size="small" danger icon={<DeleteOutlined />} key="del"
                    onClick={() => removeAttMut.mutate({ bid: selected.id, aid: a.id })} />,
                ]}>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} size="small" />}
                    title={a.employee?.full_name || a.ext_name || '—'}
                    description={<Tag>{a.attendee_type === 0 ? 'Employee' : a.attendee_type === 1 ? 'Visitor' : 'External'}</Tag>}
                  />
                </List.Item>
              )}
            />
            <Divider dashed />
            <Form form={attForm} layout="inline" onFinish={onAddAttendee}>
              <Form.Item name="attendee_type" initialValue={0} style={{ margin: 0 }}>
                <Select style={{ width: 110 }} options={[{ value: 0, label: 'Employee' }, { value: 2, label: 'External' }]} />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(p, c) => p.attendee_type !== c.attendee_type}>
                {({ getFieldValue }) => getFieldValue('attendee_type') === 0 ? (
                  <Form.Item name="emp_id" rules={[{ required: true }]} style={{ margin: 0 }}>
                    <Select style={{ width: 200 }} options={empOptions} showSearch placeholder="Employee…"
                      filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
                  </Form.Item>
                ) : (
                  <>
                    <Form.Item name="ext_name" rules={[{ required: true }]} style={{ margin: 0 }}>
                      <Input placeholder="Full name" style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item name="ext_email" style={{ margin: 0 }}>
                      <Input placeholder="Email" style={{ width: 160 }} />
                    </Form.Item>
                  </>
                )}
              </Form.Item>
              <Button htmlType="submit" type="primary" icon={<PlusOutlined />} loading={addAttMut.isPending}>Add</Button>
            </Form>
          </>
        )}
      </Modal>

      {/* QR Code */}
      <Modal
        title={`QR Code — ${selected?.title ?? ''}`}
        open={qrModal}
        onCancel={() => setQrModal(false)}
        footer={null}
        destroyOnHidden
        width={300}
      >
        {selected && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <QRCodeSVG value={selected.meeting_code ?? String(selected.id)} size={200} />
            <div style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 16, letterSpacing: 2, fontWeight: 700 }}>
              {selected.meeting_code}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>Scan to check in</div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default BookingManagement;
