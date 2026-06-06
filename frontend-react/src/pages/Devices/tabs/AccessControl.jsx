import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select, InputNumber,
  Switch, message, Popconfirm, Tabs, Row, Col, TimePicker, Checkbox,
  Tooltip, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  LockOutlined, UnlockOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import deviceAPI from '../../../services/deviceAPI';
import usePersonnel from '../../../hooks/usePersonnel';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const useCrud = (queryKey, fetchFn, createFn, updateFn, deleteFn) => {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries([queryKey]);

  const q = useQuery({ queryKey: [queryKey], queryFn: fetchFn, staleTime: 30000 });

  const create = useMutation({ mutationFn: createFn, onSuccess: inv, onError: e => message.error(e.message) });
  const update = useMutation({ mutationFn: ({ id, data }) => updateFn(id, data), onSuccess: inv, onError: e => message.error(e.message) });
  const del    = useMutation({ mutationFn: deleteFn, onSuccess: inv, onError: e => message.error(e.message) });

  return { q, create, update, del };
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Time Zones ───────────────────────────────────────────────────────────────

const TimeZones = () => {
  const [modal, setModal]   = useState(false);
  const [editing, setEdit]  = useState(null);
  const [form]              = Form.useForm();

  const { q, create, update, del } = useCrud(
    'ac-timezones',
    () => deviceAPI.getTimeZones(),
    d => deviceAPI.createTimeZone(d),
    (id, d) => deviceAPI.updateTimeZone(id, d),
    id => deviceAPI.deleteTimeZone(id),
  );

  const rows = q.data?.data ?? [];

  const openModal = (rec = null) => {
    setEdit(rec);
    form.setFieldsValue(rec ? {
      ...rec,
      start_time: rec.start_time ? dayjs(rec.start_time, 'HH:mm') : null,
      end_time:   rec.end_time   ? dayjs(rec.end_time,   'HH:mm') : null,
    } : {});
    setModal(true);
  };

  const onFinish = v => {
    const payload = {
      ...v,
      start_time: v.start_time?.format('HH:mm'),
      end_time:   v.end_time?.format('HH:mm'),
    };
    if (editing) update.mutate({ id: editing.id, data: payload }, { onSuccess: () => setModal(false) });
    else          create.mutate(payload, { onSuccess: () => setModal(false) });
  };

  const columns = [
    { title: 'ID',   dataIndex: 'id',   width: 60 },
    { title: 'Name', dataIndex: 'name', ellipsis: true },
    { title: 'Start', dataIndex: 'start_time', width: 90 },
    { title: 'End',   dataIndex: 'end_time',   width: 90 },
    {
      title: 'Days',
      dataIndex: 'days_of_week',
      render: v => (v ?? '').split(',').filter(Boolean).map(d => <Tag key={d} style={{ fontSize: 11 }}>{d}</Tag>),
    },
    {
      title: '', width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Delete?" onConfirm={() => del.mutate(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={q.refetch} loading={q.isLoading} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New Time Zone</Button>
      </div>
      <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={q.isLoading} pagination={false} />

      <Modal title={editing ? 'Edit Time Zone' : 'New Time Zone'} open={modal}
        onCancel={() => setModal(false)} onOk={() => form.submit()}
        confirmLoading={create.isPending || update.isPending} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="start_time" label="Start Time"><TimePicker format="HH:mm" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="end_time"   label="End Time"><TimePicker format="HH:mm" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="days_of_week" label="Days of Week">
            <Checkbox.Group options={DAYS} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Access Levels ────────────────────────────────────────────────────────────

const AccessLevels = ({ terminals }) => {
  const [modal, setModal]  = useState(false);
  const [editing, setEdit] = useState(null);
  const [form]             = Form.useForm();

  const tzQ = useQuery({ queryKey: ['ac-timezones'], queryFn: () => deviceAPI.getTimeZones(), staleTime: 60000 });
  const tzOptions = (tzQ.data?.data ?? []).map(t => ({ value: t.id, label: t.name }));

  const { q, create, update, del } = useCrud(
    'ac-levels',
    () => deviceAPI.getAccessLevels(),
    d => deviceAPI.createAccessLevel(d),
    (id, d) => deviceAPI.updateAccessLevel(id, d),
    id => deviceAPI.deleteAccessLevel(id),
  );

  const rows = q.data?.data ?? [];
  const terminalOptions = (terminals ?? []).map(t => ({ value: t.sn, label: t.alias || t.sn }));

  const openModal = (rec = null) => { setEdit(rec); form.setFieldsValue(rec ?? {}); setModal(true); };

  const columns = [
    { title: 'ID',   dataIndex: 'id',   width: 60 },
    { title: 'Name', dataIndex: 'name', ellipsis: true },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    {
      title: '', width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Delete?" onConfirm={() => del.mutate(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={q.refetch} loading={q.isLoading} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New Level</Button>
      </div>
      <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={q.isLoading} pagination={false} />

      <Modal title={editing ? 'Edit Access Level' : 'New Access Level'} open={modal}
        onCancel={() => setModal(false)} onOk={() => form.submit()}
        confirmLoading={create.isPending || update.isPending} destroyOnHidden>
        <Form form={form} layout="vertical"
          onFinish={v => editing
            ? update.mutate({ id: editing.id, data: v }, { onSuccess: () => setModal(false) })
            : create.mutate(v, { onSuccess: () => setModal(false) })}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="timezone_id" label="Time Zone">
            <Select options={tzOptions} placeholder="Optional" allowClear />
          </Form.Item>
          <Form.Item name="device_sns" label="Devices">
            <Select mode="multiple" options={terminalOptions} placeholder="All devices if empty" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Doors ────────────────────────────────────────────────────────────────────

const Doors = ({ terminals }) => {
  const [modal, setModal]  = useState(false);
  const [editing, setEdit] = useState(null);
  const [form]             = Form.useForm();

  const { q, create, update, del } = useCrud(
    'ac-doors',
    () => deviceAPI.getDoors(),
    d => deviceAPI.createDoor(d),
    (id, d) => deviceAPI.updateDoor(id, d),
    id => deviceAPI.deleteDoor(id),
  );

  const openDoorMutation = useMutation({
    mutationFn: id => deviceAPI.openDoor(id),
    onSuccess: () => message.success('Door open command sent'),
    onError: e => message.error(e.message),
  });

  const rows = q.data?.data ?? [];
  const terminalOptions = (terminals ?? []).map(t => ({ value: t.sn, label: t.alias || t.sn }));

  const levelQ = useQuery({ queryKey: ['ac-levels'], queryFn: () => deviceAPI.getAccessLevels(), staleTime: 60000 });
  const levelOptions = (levelQ.data?.data ?? []).map(l => ({ value: l.id, label: l.name }));

  const openModal = (rec = null) => { setEdit(rec); form.setFieldsValue(rec ?? {}); setModal(true); };

  const columns = [
    { title: 'ID',   dataIndex: 'id',   width: 60 },
    { title: 'Name', dataIndex: 'name', ellipsis: true },
    { title: 'Device SN', dataIndex: 'terminal_sn', width: 140 },
    {
      title: 'Open Duration (s)',
      dataIndex: 'open_duration',
      width: 140,
      render: v => v ?? '—',
    },
    {
      title: 'Verify Mode',
      dataIndex: 'verify_mode',
      width: 120,
      render: v => ({ 0: 'Fingerprint', 1: 'Card', 2: 'Face', 3: 'Card+FP', 4: 'Card+Face' }[v] ?? v),
    },
    {
      title: 'Actions',
      width: 130,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Open door now">
            <Button size="small" type="primary" icon={<UnlockOutlined />}
              onClick={() => openDoorMutation.mutate(r.id)}
              loading={openDoorMutation.isPending}>Open</Button>
          </Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Delete?" onConfirm={() => del.mutate(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={q.refetch} loading={q.isLoading} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New Door</Button>
      </div>
      <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={q.isLoading} pagination={false} scroll={{ x: 700 }} />

      <Modal title={editing ? 'Edit Door' : 'New Door'} open={modal}
        onCancel={() => setModal(false)} onOk={() => form.submit()}
        confirmLoading={create.isPending || update.isPending} destroyOnHidden>
        <Form form={form} layout="vertical"
          onFinish={v => editing
            ? update.mutate({ id: editing.id, data: v }, { onSuccess: () => setModal(false) })
            : create.mutate(v, { onSuccess: () => setModal(false) })}>
          <Form.Item name="name" label="Door Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="terminal_sn" label="Device" rules={[{ required: true }]}>
            <Select options={terminalOptions} showSearch filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="acc_level_id" label="Access Level">
            <Select options={levelOptions} allowClear />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="open_duration" label="Open Duration (s)">
                <InputNumber min={1} max={300} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="verify_mode" label="Verify Mode">
                <Select options={[
                  { value: 0, label: 'Fingerprint' },
                  { value: 1, label: 'Card' },
                  { value: 2, label: 'Face' },
                  { value: 3, label: 'Card + Fingerprint' },
                  { value: 4, label: 'Card + Face' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

// ─── User Assignments ─────────────────────────────────────────────────────────

const UserAssignments = () => {
  const [modal, setModal] = useState(false);
  const [form]            = Form.useForm();
  const { empOptions }    = usePersonnel();

  const { q, create, del } = useCrud(
    'ac-user-auth',
    () => deviceAPI.getUserAuthorizations(),
    d => deviceAPI.createUserAuthorization(d),
    null,
    id => deviceAPI.deleteUserAuthorization(id),
  );

  const levelQ = useQuery({ queryKey: ['ac-levels'], queryFn: () => deviceAPI.getAccessLevels(), staleTime: 60000 });
  const levelOptions = (levelQ.data?.data ?? []).map(l => ({ value: l.id, label: l.name }));

  const rows = q.data?.data ?? [];

  const columns = [
    { title: 'Employee', dataIndex: 'emp_code', width: 120 },
    { title: 'Name', dataIndex: 'emp_name', ellipsis: true },
    { title: 'Access Level', dataIndex: 'acc_level_name', ellipsis: true },
    { title: 'Valid Days', dataIndex: 'valid_days', width: 100 },
    { title: 'Start', dataIndex: 'start_time', width: 80 },
    { title: 'End',   dataIndex: 'end_time',   width: 80 },
    {
      title: '', width: 70,
      render: (_, r) => (
        <Popconfirm title="Remove assignment?" onConfirm={() => del.mutate(r.id)} okType="danger">
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={q.refetch} loading={q.isLoading} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>Assign Employee</Button>
      </div>
      <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={q.isLoading}
        pagination={{ pageSize: 20 }} />

      <Modal title="Assign Employee to Access Level" open={modal}
        onCancel={() => { setModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={create.isPending} destroyOnHidden>
        <Form form={form} layout="vertical"
          onFinish={v => create.mutate(v, { onSuccess: () => { setModal(false); form.resetFields(); } })}>
          <Form.Item name="emp_code" label="Employee" rules={[{ required: true }]}>
            <Select options={empOptions} showSearch
              filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="acc_level_id" label="Access Level" rules={[{ required: true }]}>
            <Select options={levelOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Anti-Passback ────────────────────────────────────────────────────────────

const AntiPassback = () => {
  const [modal, setModal] = useState(false);
  const [form]            = Form.useForm();

  const { q, create, del } = useCrud(
    'ac-anti-passback',
    () => deviceAPI.getAntiPassback(),
    d => deviceAPI.createAntiPassback(d),
    null,
    id => deviceAPI.deleteAntiPassback(id),
  );

  const doorQ = useQuery({ queryKey: ['ac-doors'], queryFn: () => deviceAPI.getDoors(), staleTime: 60000 });
  const doorOptions = (doorQ.data?.data ?? []).map(d => ({ value: d.id, label: d.name }));

  const rows = q.data?.data ?? [];

  const openModal = () => { form.resetFields(); form.setFieldsValue({ mode: 1 }); setModal(true); };

  const columns = [
    { title: 'Name', dataIndex: 'name', ellipsis: true },
    {
      title: 'Entry Door',
      dataIndex: 'in_door_name',
      ellipsis: true,
      render: (v, r) => v || r.in_door_id || '—',
    },
    {
      title: 'Exit Door',
      dataIndex: 'out_door_name',
      ellipsis: true,
      render: (v, r) => v || r.out_door_id || '—',
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      width: 110,
      render: v => v === 0 ? <Tag color="orange">Soft warn</Tag> : <Tag color="red">Hard deny</Tag>,
    },
    {
      title: '', width: 60,
      render: (_, r) => (
        <Popconfirm title="Delete rule?" onConfirm={() => del.mutate(r.id)} okType="danger">
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={q.refetch} loading={q.isLoading} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openModal}>New Rule</Button>
      </div>
      <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={q.isLoading} pagination={false} />

      <Modal title="New Anti-Passback Rule" open={modal}
        onCancel={() => setModal(false)} onOk={() => form.submit()}
        confirmLoading={create.isPending} destroyOnHidden>
        <Form form={form} layout="vertical"
          onFinish={v => create.mutate(v, { onSuccess: () => setModal(false) })}>
          <Form.Item name="name" label="Rule Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="in_door_id" label="Entry Door">
                <Select options={doorOptions} allowClear placeholder="Any entry door" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="out_door_id" label="Exit Door">
                <Select options={doorOptions} allowClear placeholder="Any exit door" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="mode" label="Mode" rules={[{ required: true }]}>
            <Select options={[{ value: 1, label: 'Hard — deny entry (strict)' }, { value: 0, label: 'Soft — warn only' }]} />
          </Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Blacklist ────────────────────────────────────────────────────────────────

const Blacklist = () => {
  const [modal, setModal] = useState(false);
  const [form]            = Form.useForm();
  const { empOptions }    = usePersonnel();

  const { q, create, del } = useCrud(
    'ac-blacklist',
    () => deviceAPI.getBlacklist(),
    d => deviceAPI.addToBlacklist(d),
    null,
    id => deviceAPI.removeFromBlacklist(id),
  );

  const rows = q.data?.data ?? [];

  const columns = [
    { title: 'Emp Code', dataIndex: 'emp_code', width: 120 },
    { title: 'Name', dataIndex: 'emp_name', ellipsis: true },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
    { title: 'Blocked At', dataIndex: 'blocked_at', width: 160,
      render: v => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—' },
    {
      title: '', width: 70,
      render: (_, r) => (
        <Popconfirm title="Remove from blacklist?" onConfirm={() => del.mutate(r.id)} okType="danger">
          <Button size="small" danger icon={<DeleteOutlined />}>Remove</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={q.refetch} loading={q.isLoading} />
        <Button type="primary" danger icon={<LockOutlined />} onClick={() => setModal(true)}>Add to Blacklist</Button>
      </div>
      <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={q.isLoading}
        pagination={{ pageSize: 20 }} />

      <Modal title="Add Employee to Blacklist" open={modal}
        onCancel={() => { setModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={create.isPending} destroyOnHidden>
        <Form form={form} layout="vertical"
          onFinish={v => create.mutate(v, { onSuccess: () => { setModal(false); form.resetFields(); } })}>
          <Form.Item name="emp_code" label="Employee" rules={[{ required: true }]}>
            <Select options={empOptions} showSearch
              filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="State reason for blacklisting" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Root Component ───────────────────────────────────────────────────────────

const AccessControl = ({ terminals }) => {
  const tabItems = [
    { key: 'timezones',    label: 'Time Zones',      children: <TimeZones /> },
    { key: 'levels',       label: 'Access Levels',   children: <AccessLevels terminals={terminals} /> },
    { key: 'doors',        label: 'Doors',            children: <Doors terminals={terminals} /> },
    { key: 'assignments',  label: 'User Assignments', children: <UserAssignments /> },
    { key: 'antipassback', label: 'Anti-Passback',   children: <AntiPassback /> },
    { key: 'blacklist',    label: <span style={{ color: '#ff4d4f' }}>Blacklist</span>, children: <Blacklist /> },
  ];

  return <Tabs items={tabItems} size="small" />;
};

export default AccessControl;
