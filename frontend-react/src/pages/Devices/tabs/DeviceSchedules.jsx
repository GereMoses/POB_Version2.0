import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, InputNumber, Input,
  TimePicker, message, Popconfirm, Row, Col, Tooltip, Switch,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import deviceAPI from '../../../services/deviceAPI';

// Backend uses individual boolean day fields — these map to/from a convenience array
const DAY_FIELDS = [
  { key: 'monday_enabled',    label: 'Mon' },
  { key: 'tuesday_enabled',   label: 'Tue' },
  { key: 'wednesday_enabled', label: 'Wed' },
  { key: 'thursday_enabled',  label: 'Thu' },
  { key: 'friday_enabled',    label: 'Fri' },
  { key: 'saturday_enabled',  label: 'Sat' },
  { key: 'sunday_enabled',    label: 'Sun' },
];

const ACCESS_MODES = [
  { value: 'NORMAL',  label: 'Normal' },
  { value: 'OPEN',    label: 'Always Open' },
  { value: 'CLOSE',   label: 'Always Closed' },
  { value: 'ATTEND',  label: 'Attendance Only' },
];

// Convert backend row → form values
const rowToForm = (rec) => ({
  terminal_sn: rec.terminal_sn,
  name:         rec.name,
  description:  rec.description,
  access_mode:  rec.access_mode ?? 'NORMAL',
  priority:     rec.priority ?? 1,
  is_active:    rec.is_active ?? true,
  start_time:   rec.time_ranges?.[0]?.start ? dayjs(rec.time_ranges[0].start, 'HH:mm') : null,
  end_time:     rec.time_ranges?.[0]?.end   ? dayjs(rec.time_ranges[0].end,   'HH:mm') : null,
  ...Object.fromEntries(DAY_FIELDS.map(d => [d.key, rec[d.key] ?? true])),
});

// Convert form values → backend payload
const formToPayload = (v) => ({
  terminal_sn:         v.terminal_sn,
  name:                v.name,
  description:         v.description,
  access_mode:         v.access_mode,
  priority:            v.priority ?? 1,
  is_active:           v.is_active ?? true,
  time_ranges:         (v.start_time && v.end_time)
    ? [{ start: v.start_time.format('HH:mm'), end: v.end_time.format('HH:mm') }]
    : [],
  ...Object.fromEntries(DAY_FIELDS.map(d => [d.key, v[d.key] ?? true])),
});

const DeviceSchedules = ({ terminals }) => {
  const qc = useQueryClient();
  const [modal, setModal]       = useState(false);
  const [editing, setEdit]      = useState(null);
  const [snFilter, setSnFilter] = useState(null);
  const [form]                  = Form.useForm();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['device-schedules', snFilter],
    queryFn:  () => deviceAPI.getSchedules(snFilter ? { terminal_sn: snFilter } : {}),
    staleTime: 30000,
  });

  const rows = data?.data ?? [];
  const terminalOptions = (terminals ?? []).map(t => ({ value: t.sn, label: t.alias || t.sn }));

  const saveMutation = useMutation({
    mutationFn: v => {
      const payload = formToPayload(v);
      return editing
        ? deviceAPI.updateSchedule(editing.id, payload)
        : deviceAPI.createSchedule(payload);
    },
    onSuccess: () => {
      message.success(editing ? 'Schedule updated' : 'Schedule created');
      qc.invalidateQueries(['device-schedules']);
      setModal(false);
      form.resetFields();
    },
    onError: e => message.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: id => deviceAPI.deleteSchedule(id),
    onSuccess: () => { message.success('Schedule deleted'); qc.invalidateQueries(['device-schedules']); },
    onError: e => message.error(e.message),
  });

  const openModal = (rec = null) => {
    setEdit(rec);
    form.setFieldsValue(rec ? rowToForm(rec) : {
      access_mode: 'NORMAL', priority: 1, is_active: true,
      monday_enabled: true, tuesday_enabled: true, wednesday_enabled: true,
      thursday_enabled: true, friday_enabled: true, saturday_enabled: false, sunday_enabled: false,
    });
    setModal(true);
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', ellipsis: true },
    {
      title: 'Device',
      dataIndex: 'terminal_sn',
      width: 160,
      render: v => {
        const t = (terminals ?? []).find(t => t.sn === v);
        return <Tag>{t?.alias || v}</Tag>;
      },
    },
    {
      title: 'Time',
      width: 130,
      render: (_, r) => {
        const slot = r.time_ranges?.[0];
        return slot ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{slot.start} – {slot.end}</span> : <span style={{ color: '#bfbfbf' }}>All day</span>;
      },
    },
    {
      title: 'Days',
      render: (_, r) => DAY_FIELDS.filter(d => r[d.key]).map(d => (
        <Tag key={d.key} style={{ fontSize: 11, padding: '0 5px' }}>{d.label}</Tag>
      )),
    },
    {
      title: 'Mode',
      dataIndex: 'access_mode',
      width: 130,
      render: v => ACCESS_MODES.find(m => m.value === v)?.label ?? v,
    },
    { title: 'Priority', dataIndex: 'priority', width: 80 },
    {
      title: 'Active',
      dataIndex: 'is_active',
      width: 70,
      render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: '', width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /></Tooltip>
          <Popconfirm title="Delete schedule?" onConfirm={() => deleteMutation.mutate(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Select allowClear placeholder="Filter by device" options={terminalOptions}
          value={snFilter} onChange={setSnFilter} style={{ width: 220 }} />
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            <CalendarOutlined /> New Schedule
          </Button>
        </Space>
      </div>

      <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={isLoading}
        pagination={{ pageSize: 20, showTotal: t => `${t} schedules` }} scroll={{ x: 700 }} />

      <Modal
        title={editing ? 'Edit Schedule' : 'New Device Schedule'}
        open={modal}
        onCancel={() => { setModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={580}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={v => saveMutation.mutate(v)}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="name" label="Schedule Name" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="terminal_sn" label="Device" rules={[{ required: true }]}>
                <Select options={terminalOptions} showSearch
                  filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description"><Input /></Form.Item>

          {/* Day toggles */}
          <Form.Item label="Days Active" style={{ marginBottom: 8 }}>
            <Row gutter={[8, 4]}>
              {DAY_FIELDS.map(d => (
                <Col key={d.key}>
                  <Form.Item name={d.key} valuePropName="checked" noStyle>
                    <Switch size="small" checkedChildren={d.label} unCheckedChildren={d.label} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="start_time" label="Start Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="End Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="access_mode" label="Access Mode">
                <Select options={ACCESS_MODES} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="priority" label="Priority (1=high)">
                <InputNumber min={1} max={99} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default DeviceSchedules;
