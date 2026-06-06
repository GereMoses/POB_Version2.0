import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Switch, message, Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import visitorAPI from '../../../services/visitorAPI';

const VisitorTypes = () => {
  const [modal, setModal]   = useState(false);
  const [editing, setEdit]  = useState(null);
  const [form]              = Form.useForm();
  const qc                  = useQueryClient();
  const inv                 = () => qc.invalidateQueries(['visitor-types']);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-types'],
    queryFn:  () => visitorAPI.getVisitorTypes({ include_inactive: true }),
    staleTime: 30000,
  });
  const rows = data?.data ?? [];

  const createMut = useMutation({ mutationFn: d => visitorAPI.createVisitorType(d), onSuccess: () => { message.success('Created'); inv(); setModal(false); }, onError: e => message.error(e.message) });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => visitorAPI.updateVisitorType(id, d), onSuccess: () => { message.success('Updated'); inv(); setModal(false); }, onError: e => message.error(e.message) });
  const deleteMut = useMutation({ mutationFn: id => visitorAPI.deleteVisitorType(id), onSuccess: () => { message.success('Deleted'); inv(); }, onError: e => message.error(e.message) });

  const openModal = (rec = null) => {
    setEdit(rec);
    setModal(true);
  };

  const onFinish = v => {
    if (editing) updateMut.mutate({ id: editing.id, d: v });
    else         createMut.mutate(v);
  };

  const columns = [
    { title: 'Type Name',           dataIndex: 'type_name',          ellipsis: true },
    { title: 'Badge Template',      dataIndex: 'badge_template',     width: 140, render: v => v || '—' },
    { title: 'Default Hours',       dataIndex: 'default_visit_hours',width: 110, render: v => v ?? '—' },
    {
      title: 'Induction Required',  dataIndex: 'induction_required', width: 140,
      render: v => v ? <Tag color="orange">Required</Tag> : <Tag>Not required</Tag>,
    },
    {
      title: 'Auto Check-Out',      dataIndex: 'auto_checkout',      width: 120,
      render: v => v ? <Tag color="blue">Yes</Tag> : <Tag>No</Tag>,
    },
    {
      title: 'Contractor',          dataIndex: 'contractor_visitor', width: 100,
      render: v => v ? <Tag color="purple">Yes</Tag> : '—',
    },
    {
      title: 'Status',              dataIndex: 'is_active',          width: 90,
      render: v => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: '', width: 80,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Deactivate this type?" onConfirm={() => deleteMut.mutate(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New Type</Button>
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={false}
        scroll={{ x: 800 }}
      />

      <Modal
        title={editing ? 'Edit Visitor Type' : 'New Visitor Type'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        destroyOnHidden
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}
          initialValues={editing ?? { is_active: true, default_visit_hours: 8, auto_checkout: true }}>
          <Form.Item name="type_name" label="Type Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="badge_template" label="Badge Template"><Input /></Form.Item>
          <Form.Item name="default_visit_hours" label="Default Visit Hours (for auto check-out)">
            <InputNumber min={1} max={72} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="induction_required" label="Safety Induction Required" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="safety_induction_required" valuePropName="checked">
            <Switch /> Safety Induction Required
          </Form.Item>
          <Form.Item name="auto_checkout" label="Auto Check-Out after hours" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="contractor_visitor" label="Contractor Visitor Type" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default VisitorTypes;
