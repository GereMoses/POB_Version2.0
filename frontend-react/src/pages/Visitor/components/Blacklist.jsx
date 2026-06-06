import React, { useState } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, message, Popconfirm, Tag,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, StopOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';

const Blacklist = () => {
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(false);
  const [editing, setEdit]    = useState(null);
  const [form]                = Form.useForm();
  const qc                    = useQueryClient();
  const inv                   = () => { qc.invalidateQueries(['visitor-blacklist']); qc.invalidateQueries(['visitor-stats']); };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-blacklist', search],
    queryFn:  () => visitorAPI.getBlacklist({ search }),
    staleTime: 30000,
  });
  const rows = data?.data ?? [];

  const addMut    = useMutation({ mutationFn: d => visitorAPI.addToBlacklist(d),      onSuccess: () => { message.success('Added to blacklist'); inv(); setModal(false); form.resetFields(); }, onError: e => message.error(e.message) });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => visitorAPI.updateBlacklist(id, d), onSuccess: () => { message.success('Updated'); inv(); setModal(false); }, onError: e => message.error(e.message) });
  const removeMut = useMutation({ mutationFn: id => visitorAPI.removeFromBlacklist(id), onSuccess: () => { message.success('Removed from blacklist'); inv(); }, onError: e => message.error(e.message) });

  const openModal = (rec = null) => {
    setEdit(rec);
    form.setFieldsValue(rec ?? {});
    setModal(true);
  };

  const onFinish = v => {
    if (editing) updateMut.mutate({ id: editing.id, d: v });
    else         addMut.mutate(v);
  };

  const columns = [
    { title: 'Full Name', dataIndex: 'full_name',  ellipsis: true },
    { title: 'ID No',     dataIndex: 'id_no',      width: 130,  render: v => v || '—' },
    { title: 'Phone',     dataIndex: 'phone',      width: 130,  render: v => v || '—' },
    { title: 'Email',     dataIndex: 'email',      width: 180,  ellipsis: true, render: v => v || '—' },
    { title: 'Reason',    dataIndex: 'reason',     ellipsis: true },
    {
      title: 'Added',     dataIndex: 'created_at', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Status',    dataIndex: 'is_active',  width: 90,
      render: v => v ? <Tag color="red">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: '', width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Remove from blacklist?" onConfirm={() => removeMut.mutate(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search by name / ID / phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
        <Button type="primary" danger icon={<StopOutlined />} onClick={() => openModal()}>
          Add to Blacklist
        </Button>
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 800 }}
      />

      <Modal
        title={editing ? 'Edit Blacklist Entry' : 'Add to Blacklist'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={addMut.isPending || updateMut.isPending}
        destroyOnHidden
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="id_no" label="ID Number" rules={[{ required: !editing }]}><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="reason" label="Reason for Blacklisting" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Blacklist;
