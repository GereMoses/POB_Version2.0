import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, Input, InputNumber,
  DatePicker, message, Popconfirm, Row, Col, Card, Statistic, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  ToolOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import deviceAPI from '../../../services/deviceAPI';

const STATUS_CFG = {
  SCHEDULED:   { color: 'blue',   icon: <ClockCircleOutlined />, label: 'Scheduled' },
  IN_PROGRESS: { color: 'orange', icon: <ToolOutlined />,        label: 'In Progress' },
  COMPLETED:   { color: 'green',  icon: <CheckCircleOutlined />, label: 'Completed' },
  OVERDUE:     { color: 'red',    icon: <WarningOutlined />,     label: 'Overdue' },
};

const MAINT_TYPES = [
  { value: 'ROUTINE',     label: 'Routine' },
  { value: 'REPAIR',      label: 'Repair' },
  { value: 'CALIBRATION', label: 'Calibration' },
  { value: 'CLEANING',    label: 'Cleaning' },
  { value: 'FIRMWARE',    label: 'Firmware Update' },
  { value: 'INSPECTION',  label: 'Inspection' },
];

const MaintenanceTracking = ({ terminals }) => {
  const qc = useQueryClient();
  const [modal, setModal]         = useState(false);
  const [editing, setEdit]        = useState(null);
  const [snFilter, setSnFilter]   = useState(null);
  const [stFilter, setStFilter]   = useState(null);
  const [form]                    = Form.useForm();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['device-maintenance', snFilter, stFilter],
    queryFn: () => {
      const p = {};
      if (snFilter) p.terminal_sn = snFilter;
      if (stFilter) p.status      = stFilter;
      return deviceAPI.getMaintenance(p);
    },
    staleTime: 30000,
  });

  const rows = data?.data ?? [];
  const terminalOptions = (terminals ?? []).map(t => ({ value: t.sn, label: t.alias || t.sn }));

  const saveMutation = useMutation({
    mutationFn: v => {
      const payload = {
        terminal_sn:       v.terminal_sn,
        maintenance_type:  v.maintenance_type,
        description:       v.description,
        scheduled_date:    v.scheduled_date?.toISOString(),
        technician_notes:  v.technician_notes,
        cost:              v.cost,
        estimated_duration: v.estimated_duration,
        ...(editing && {
          status:           v.status,
          completed_at:     v.completed_at?.toISOString() ?? null,
          next_maintenance_date: v.next_maintenance_date?.toISOString() ?? null,
          test_results:     v.test_results ? { notes: v.test_results } : undefined,
        }),
      };
      return editing
        ? deviceAPI.updateMaintenance(editing.id, payload)
        : deviceAPI.createMaintenance(payload);
    },
    onSuccess: () => {
      message.success(editing ? 'Record updated' : 'Maintenance scheduled');
      qc.invalidateQueries(['device-maintenance']);
      setModal(false);
      form.resetFields();
    },
    onError: e => message.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: id => deviceAPI.deleteMaintenance(id),
    onSuccess: () => { message.success('Record deleted'); qc.invalidateQueries(['device-maintenance']); },
    onError: e => message.error(e.message),
  });

  const openModal = (rec = null) => {
    setEdit(rec);
    form.setFieldsValue(rec ? {
      ...rec,
      scheduled_date:        rec.scheduled_date    ? dayjs(rec.scheduled_date)    : null,
      completed_at:          rec.completed_at      ? dayjs(rec.completed_at)      : null,
      next_maintenance_date: rec.next_maintenance_date ? dayjs(rec.next_maintenance_date) : null,
      test_results:          rec.test_results?.notes ?? '',
    } : { status: 'SCHEDULED', maintenance_type: 'ROUTINE' });
    setModal(true);
  };

  // Stats
  const scheduled  = rows.filter(r => r.status === 'SCHEDULED').length;
  const inProgress = rows.filter(r => r.status === 'IN_PROGRESS').length;
  const overdue    = rows.filter(r => r.status === 'OVERDUE').length;
  const completed  = rows.filter(r => r.status === 'COMPLETED').length;

  const columns = [
    {
      title: 'Device',
      dataIndex: 'terminal_sn',
      width: 160,
      render: (v, r) => <Tag>{r.device_alias || v}</Tag>,
    },
    {
      title: 'Type',
      dataIndex: 'maintenance_type',
      width: 120,
      render: v => MAINT_TYPES.find(m => m.value === v)?.label ?? v,
    },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: v => {
        const cfg = STATUS_CFG[v] ?? { color: 'default', label: v };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Scheduled',
      dataIndex: 'scheduled_date',
      width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—',
      sorter: (a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Completed',
      dataIndex: 'completed_at',
      width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Cost ($)',
      dataIndex: 'cost',
      width: 90,
      render: v => v != null ? <span style={{ fontWeight: 600 }}>${v}</span> : '—',
    },
    {
      title: 'Actions',
      width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit / Update Status">
            <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          </Tooltip>
          <Popconfirm title="Delete record?" onConfirm={() => deleteMutation.mutate(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Stats */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        {[
          { label: 'Scheduled',   val: scheduled,  color: '#1890ff', icon: <ClockCircleOutlined /> },
          { label: 'In Progress', val: inProgress, color: '#fa8c16', icon: <ToolOutlined /> },
          { label: 'Overdue',     val: overdue,    color: '#ff4d4f', icon: <WarningOutlined /> },
          { label: 'Completed',   val: completed,  color: '#52c41a', icon: <CheckCircleOutlined /> },
        ].map(s => (
          <Col span={6} key={s.label}>
            <Card size="small">
              <Statistic title={s.label} value={s.val} valueStyle={{ color: s.color }} prefix={s.icon} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Toolbar */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select allowClear placeholder="Filter by device" options={terminalOptions}
            value={snFilter} onChange={setSnFilter} style={{ width: 200 }} />
          <Select allowClear placeholder="Status"
            options={Object.entries(STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))}
            value={stFilter} onChange={setStFilter} style={{ width: 150 }} />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Schedule Maintenance
          </Button>
        </Space>
      </div>

      <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={isLoading}
        rowClassName={r => r.status === 'OVERDUE' ? 'row-danger' : r.status === 'IN_PROGRESS' ? 'row-warning' : ''}
        pagination={{ pageSize: 20, showTotal: t => `${t} records` }} scroll={{ x: 900 }} />

      {/* Form Modal */}
      <Modal
        title={editing ? 'Update Maintenance Record' : 'Schedule Maintenance'}
        open={modal}
        onCancel={() => { setModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={620}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={v => saveMutation.mutate(v)}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="terminal_sn" label="Device" rules={[{ required: true }]}>
                <Select options={terminalOptions} showSearch
                  filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maintenance_type" label="Type" rules={[{ required: true }]}>
                <Select options={MAINT_TYPES} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="scheduled_date" label="Scheduled Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="estimated_duration" label="Est. Duration (mins)">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {editing && (
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="status" label="Status">
                  <Select options={Object.entries(STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="completed_at" label="Completed Date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="next_maintenance_date" label="Next Due">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="cost" label="Cost ($)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="technician_notes" label="Technician">
                <Input placeholder="Name or notes" />
              </Form.Item>
            </Col>
          </Row>

          {editing && (
            <Form.Item name="test_results" label="Test Results / Notes">
              <Input.TextArea rows={2} placeholder="Post-maintenance test results" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <style>{`
        .row-danger td  { background: #fff1f0 !important; }
        .row-warning td { background: #fffbe6 !important; }
      `}</style>
    </div>
  );
};

export default MaintenanceTracking;
