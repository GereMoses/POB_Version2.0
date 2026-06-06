import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  message, Popconfirm, Row, Col, Card, Badge, Statistic,
  Alert, Segmented, Empty, Tooltip,
} from 'antd';
import { DatePicker } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  WarningOutlined, CheckCircleOutlined, ToolOutlined,
  AppstoreOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import meetingApi from '../../../services/meetingApi';

const EQUIP_TYPES = ['Projector', 'TV', 'Whiteboard', 'Video Conference', 'Audio System', 'Computer', 'Other'];


const EquipmentManagement = () => {
  const [modal, setModal]   = useState(false);
  const [editing, setEdit]  = useState(null);
  const [viewMode, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [typeFilter, setTF] = useState('all');
  const [form]              = Form.useForm();
  const qc                  = useQueryClient();
  const inv                 = () => qc.invalidateQueries(['meeting-equipment']);

  const { data: roomsData } = useQuery({
    queryKey: ['meeting-rooms'],
    queryFn:  () => meetingApi.getRooms(),
    staleTime: 60000,
  });
  const roomOptions = (roomsData?.data ?? []).map(r => ({ value: r.id, label: r.room_name }));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['meeting-equipment'],
    queryFn:  () => meetingApi.getEquipment(),
    staleTime: 30000,
  });
  const allRows = data?.data ?? [];

  const rows = allRows.filter(r => {
    const matchSearch = !search || r.equip_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || r.equip_type === typeFilter;
    return matchSearch && matchType;
  });

  const expiringCount = allRows.filter(r => {
    if (!r.warranty_expiry) return false;
    return dayjs(r.warranty_expiry).diff(dayjs(), 'day') <= 30;
  }).length;

  const expiredCount = allRows.filter(r => r.warranty_expiry && dayjs(r.warranty_expiry).isBefore(dayjs())).length;
  const maintenanceCount = allRows.filter(r => r.status === 1).length;

  const createMut = useMutation({
    mutationFn: d => meetingApi.createEquipment(d),
    onSuccess: () => { message.success('Equipment added'); inv(); setModal(false); },
    onError:   e => message.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }) => meetingApi.updateEquipment(id, d),
    onSuccess: () => { message.success('Equipment updated'); inv(); setModal(false); },
    onError:   e => message.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: id => meetingApi.deleteEquipment(id),
    onSuccess: () => { message.success('Equipment deleted'); inv(); },
    onError:   e => message.error(e.message),
  });

  const openModal = (rec = null) => { setEdit(rec); setModal(true); };

  const onFinish = v => {
    const payload = {
      ...v,
      purchase_date:    v.purchase_date   ? v.purchase_date.format('YYYY-MM-DD')   : null,
      warranty_expiry:  v.warranty_expiry ? v.warranty_expiry.format('YYYY-MM-DD') : null,
      last_maintenance: v.last_maintenance ? v.last_maintenance.format('YYYY-MM-DD') : null,
    };
    if (editing) updateMut.mutate({ id: editing.id, d: payload });
    else         createMut.mutate(payload);
  };

  const warrantyTag = (expiry) => {
    if (!expiry) return <span style={{ color: '#ccc' }}>—</span>;
    const days = dayjs(expiry).diff(dayjs(), 'day');
    if (days < 0)   return <Tag color="red" icon={<WarningOutlined />}>Expired</Tag>;
    if (days <= 30) return <Tag color="orange" icon={<WarningOutlined />}>{days}d left</Tag>;
    return <Tag color="green" icon={<CheckCircleOutlined />}>Valid</Tag>;
  };

  const columns = [
    {
      title: 'Equipment', dataIndex: 'equip_name', ellipsis: true,
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          {r.equip_type && <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.equip_type}</div>}
        </div>
      ),
    },
    { title: 'Room',    dataIndex: 'room_id',    width: 140, render: v => roomOptions.find(r => r.value === v)?.label ?? <span style={{ color: '#bfbfbf' }}>Unassigned</span> },
    { title: 'Serial',  dataIndex: 'serial_no',  width: 120, render: v => v ? <code style={{ fontSize: 12 }}>{v}</code> : '—' },
    {
      title: 'Status', dataIndex: 'status', width: 120,
      render: v => v === 0
        ? <Badge status="success" text="Available" />
        : <Badge status="warning" text="Maintenance" />,
    },
    { title: 'Warranty', dataIndex: 'warranty_expiry', width: 110, render: v => warrantyTag(v) },
    {
      title: '', width: 80,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Delete this equipment?" onConfirm={() => deleteMut.mutate(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const initValues = editing
    ? {
        ...editing,
        purchase_date:    editing.purchase_date   ? dayjs(editing.purchase_date)   : null,
        warranty_expiry:  editing.warranty_expiry ? dayjs(editing.warranty_expiry) : null,
        last_maintenance: editing.last_maintenance ? dayjs(editing.last_maintenance) : null,
      }
    : { status: 0 };

  const typeOptions = ['all', ...EQUIP_TYPES].map(t => ({ value: t, label: t === 'all' ? 'All Types' : t }));

  return (
    <>
      {/* Summary cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8} sm={6}>
          <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
            <Statistic title="Total" value={allRows.length} prefix={<ToolOutlined />} valueStyle={{ fontSize: 18, color: '#0078D4' }} />
          </Card>
        </Col>
        <Col xs={8} sm={6}>
          <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
            <Statistic title="Maintenance" value={maintenanceCount} valueStyle={{ fontSize: 18, color: maintenanceCount > 0 ? '#faad14' : '#0078D4' }} />
          </Card>
        </Col>
        <Col xs={8} sm={6}>
          <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
            <Statistic title="Warranty Issues" value={expiredCount + expiringCount} valueStyle={{ fontSize: 18, color: expiredCount > 0 ? '#ff4d4f' : '#0078D4' }} />
          </Card>
        </Col>
      </Row>

      {expiringCount > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${expiringCount} item${expiringCount > 1 ? 's' : ''} with warranty expiring within 30 days`}
          style={{ marginBottom: 12 }}
          closable
        />
      )}

      {/* Toolbar */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input.Search
          placeholder="Search equipment…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          value={typeFilter}
          onChange={setTF}
          style={{ width: 160 }}
          options={typeOptions}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Segmented
            value={viewMode}
            onChange={setView}
            options={[
              { value: 'table', icon: <UnorderedListOutlined /> },
              { value: 'grid',  icon: <AppstoreOutlined /> },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Equipment</Button>
        </div>
      </div>

      {/* Table view */}
      {viewMode === 'table' && (
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="small"
          loading={isLoading}
          pagination={{ pageSize: 20, showTotal: t => `${t} items` }}
          scroll={{ x: 800 }}
          locale={{ emptyText: <Empty description="No equipment found" /> }}
        />
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        rows.length === 0
          ? <Empty description="No equipment found" />
          : (
            <Row gutter={[12, 12]}>
              {rows.map(r => {
                const warrantyDays = r.warranty_expiry ? dayjs(r.warranty_expiry).diff(dayjs(), 'day') : null;
                const hasWarrantyIssue = warrantyDays !== null && warrantyDays <= 30;
                return (
                  <Col xs={24} sm={12} lg={8} xl={6} key={r.id}>
                    <Card
                      size="small"
                      hoverable
                      styles={{ body: { padding: 12 } }}
                      actions={[
                        <Tooltip title="Edit" key="edit"><EditOutlined onClick={() => openModal(r)} /></Tooltip>,
                        <Tooltip title="Delete" key="del">
                          <Popconfirm title="Delete?" onConfirm={() => deleteMut.mutate(r.id)} okType="danger">
                            <DeleteOutlined style={{ color: '#ff4d4f' }} />
                          </Popconfirm>
                        </Tooltip>,
                      ]}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{r.equip_name}</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
                        {r.equip_type ?? 'Unknown type'}
                      </div>
                      <Space size={4} wrap>
                        <Badge
                          status={r.status === 0 ? 'success' : 'warning'}
                          text={<span style={{ fontSize: 12 }}>{r.status === 0 ? 'Available' : 'Maintenance'}</span>}
                        />
                        {roomOptions.find(x => x.value === r.room_id) && (
                          <Tag style={{ fontSize: 11 }}>
                            {roomOptions.find(x => x.value === r.room_id)?.label}
                          </Tag>
                        )}
                        {hasWarrantyIssue && warrantyTag(r.warranty_expiry)}
                      </Space>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )
      )}

      <Modal
        title={editing ? 'Edit Equipment' : 'Add Equipment'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={initValues}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="equip_name" label="Equipment Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="equip_type" label="Type">
                <Select options={EQUIP_TYPES.map(t => ({ value: t, label: t }))} allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="room_id" label="Assigned Room">
                <Select options={roomOptions} allowClear placeholder="Not assigned" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select options={[{ value: 0, label: 'Available' }, { value: 1, label: 'Under Maintenance' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serial_no" label="Serial Number">
                <Input placeholder="S/N…" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchase_date" label="Purchase Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warranty_expiry" label="Warranty Expiry">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_maintenance" label="Last Maintenance">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default EquipmentManagement;
