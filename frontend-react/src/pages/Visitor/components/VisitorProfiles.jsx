import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  message, Popconfirm, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  StopOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import visitorAPI from '../../../services/visitorAPI';

const ID_TYPES = { 0: 'National ID', 1: 'Passport', 2: "Driver's Licence" };

const VisitorProfiles = () => {
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(false);
  const [editing, setEdit]    = useState(null);
  const [form]                = Form.useForm();
  const qc                    = useQueryClient();
  const inv                   = () => qc.invalidateQueries(['visitor-profiles']);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-profiles', search],
    queryFn:  () => visitorAPI.getVisitors({ search, limit: 200 }),
    staleTime: 30000,
  });
  const rows = data?.data ?? [];

  const { data: typesData } = useQuery({
    queryKey: ['visitor-types'],
    queryFn:  () => visitorAPI.getVisitorTypes(),
    staleTime: 60000,
  });
  const typeOptions = (typesData?.data ?? []).map(t => ({ value: t.id, label: t.type_name }));

  const createMut = useMutation({ mutationFn: d => visitorAPI.createVisitor(d), onSuccess: () => { message.success('Visitor created'); inv(); setModal(false); }, onError: e => message.error(e.message) });
  const updateMut = useMutation({ mutationFn: ({ id, d }) => visitorAPI.updateVisitor(id, d), onSuccess: () => { message.success('Updated'); inv(); setModal(false); }, onError: e => message.error(e.message) });
  const blacklistMut = useMutation({ mutationFn: ({ id, reason }) => visitorAPI.blacklistVisitor(id, reason), onSuccess: () => { message.success('Visitor blacklisted'); inv(); }, onError: e => message.error(e.message) });

  const openModal = (rec = null) => {
    setEdit(rec);
    setModal(true);
  };

  const onFinish = v => {
    if (editing) updateMut.mutate({ id: editing.id, d: v });
    else         createMut.mutate(v);
  };

  const columns = [
    { title: 'Visitor Code', dataIndex: 'visitor_code', width: 130 },
    { title: 'Full Name',    dataIndex: 'full_name',    ellipsis: true },
    { title: 'Company',      dataIndex: 'company',      ellipsis: true, render: v => v || '—' },
    { title: 'Phone',        dataIndex: 'phone',        width: 130,     render: v => v || '—' },
    { title: 'ID Type',      dataIndex: 'id_type',      width: 120,     render: v => ID_TYPES[v] ?? '—' },
    { title: 'ID No',        dataIndex: 'id_no',        width: 130,     render: v => v || '—' },
    { title: 'Type',         dataIndex: 'visitor_type', width: 120,     render: (_, r) => r.visitor_type?.type_name || '—' },
    {
      title: 'Status', dataIndex: 'is_blacklist', width: 100,
      render: v => v ? <Tag color="red">Blacklisted</Tag> : <Tag color="green">Active</Tag>,
    },
    {
      title: '', width: 110,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          {!r.is_blacklist && (
            <Tooltip title="Blacklist visitor">
              <Popconfirm
                title="Blacklist this visitor?"
                onConfirm={() => {
                  const reason = prompt('Reason for blacklisting:');
                  if (reason) blacklistMut.mutate({ id: r.id, reason });
                }}
                okType="danger"
              >
                <Button size="small" danger icon={<StopOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>New Visitor</Button>
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 900 }}
      />

      <Modal
        title={editing ? 'Edit Visitor' : 'New Visitor'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}
          initialValues={editing ?? { id_type: 0 }}>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input type="email" /></Form.Item>
          <Form.Item name="company" label="Company"><Input /></Form.Item>
          <Form.Item name="id_type" label="ID Type">
            <Select options={Object.entries(ID_TYPES).map(([v, l]) => ({ value: Number(v), label: l }))} />
          </Form.Item>
          <Form.Item name="id_no" label="ID Number"><Input /></Form.Item>
          <Form.Item name="visitor_type_id" label="Visitor Type">
            <Select options={typeOptions} allowClear placeholder="Select type…" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default VisitorProfiles;
