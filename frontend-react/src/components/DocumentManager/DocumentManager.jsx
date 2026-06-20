/**
 * DocumentManager — reusable component for uploading and listing
 * documents attached to a personnel record.
 *
 * Usage:
 *   <DocumentManager personnelId={123} />
 */
import React, { useState } from 'react';
import {
  Card, Table, Button, Upload, Select, Input, DatePicker, Form, Modal,
  Space, Tag, Tooltip, Typography, Popconfirm, App, Empty,
} from 'antd';
import {
  UploadOutlined, DownloadOutlined, DeleteOutlined, FilePdfOutlined,
  FileImageOutlined, FileWordOutlined, FileExcelOutlined,
  FileOutlined, PlusOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const CATEGORIES = [
  { value: 'certification', label: 'Certification', color: '#3B82F6' },
  { value: 'permit',        label: 'Permit',        color: '#10B981' },
  { value: 'medical',       label: 'Medical Record', color: '#EF4444' },
  { value: 'contract',      label: 'Contract',      color: '#8B5CF6' },
  { value: 'training',      label: 'Training',      color: '#F59E0B' },
  { value: 'id_document',   label: 'ID / Passport', color: '#6366F1' },
  { value: 'other',         label: 'Other',         color: '#9CA3AF' },
];

const catMeta = (val) => CATEGORIES.find(c => c.value === val) || CATEGORIES[CATEGORIES.length - 1];

const fileIcon = (ct = '') => {
  if (ct.includes('pdf'))   return <FilePdfOutlined style={{ color: '#EF4444', fontSize: 16 }} />;
  if (ct.includes('image')) return <FileImageOutlined style={{ color: '#10B981', fontSize: 16 }} />;
  if (ct.includes('word') || ct.includes('document'))
                            return <FileWordOutlined style={{ color: '#3B82F6', fontSize: 16 }} />;
  if (ct.includes('sheet') || ct.includes('excel'))
                            return <FileExcelOutlined style={{ color: '#22C55E', fontSize: 16 }} />;
  return <FileOutlined style={{ color: '#9CA3AF', fontSize: 16 }} />;
};

const fmtBytes = (b) => {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const DocumentManager = ({ personnelId }) => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const token = localStorage.getItem('token');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', personnelId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/documents/${personnelId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    enabled: !!personnelId,
    staleTime: 30000,
  });
  const docs = data?.documents ?? [];

  const uploadM = useMutation({
    mutationFn: async (values) => {
      if (!fileList.length) throw new Error('No file selected');
      const fd = new FormData();
      fd.append('file', fileList[0].originFileObj);
      fd.append('category', values.category || 'other');
      fd.append('title', values.title || '');
      fd.append('notes', values.notes || '');
      if (values.expiry_date) fd.append('expiry_date', values.expiry_date.format('YYYY-MM-DD'));

      const res = await fetch(`/api/v1/documents/${personnelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Upload failed');
      return json;
    },
    onSuccess: () => {
      message.success('Document uploaded');
      qc.invalidateQueries(['documents', personnelId]);
      setUploadOpen(false);
      setFileList([]);
      form.resetFields();
    },
    onError: e => message.error(e.message || 'Upload failed'),
  });

  const deleteM = useMutation({
    mutationFn: async (docId) => {
      const res = await fetch(`/api/v1/documents/${personnelId}/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => { message.success('Document deleted'); qc.invalidateQueries(['documents', personnelId]); },
    onError: e => message.error(e.message),
  });

  const handleDownload = (doc) => {
    const a = document.createElement('a');
    a.href = `/api/v1/documents/${personnelId}/${doc.id}/download`;
    // Fetch with auth header
    fetch(a.href, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const dl = document.createElement('a');
        dl.href = url; dl.download = doc.original_name; dl.click();
        URL.revokeObjectURL(url);
      });
  };

  const isExpiringSoon = (d) => {
    if (!d) return false;
    return dayjs(d).diff(dayjs(), 'day') <= 30;
  };
  const isExpired = (d) => d && dayjs(d).isBefore(dayjs());

  const cols = [
    {
      title: 'Document', key: 'doc',
      render: (_, r) => (
        <Space>
          {fileIcon(r.content_type || '')}
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>{r.title || r.original_name}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{r.original_name} · {fmtBytes(r.file_size)}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Category', dataIndex: 'category', key: 'category', width: 130,
      render: v => { const m = catMeta(v); return <Tag color={m.color} style={{ fontSize: 11 }}>{m.label}</Tag>; },
    },
    {
      title: 'Expiry', dataIndex: 'expiry_date', key: 'expiry', width: 120,
      render: v => {
        if (!v) return <Text type="secondary">—</Text>;
        const exp = isExpired(v);
        const soon = isExpiringSoon(v);
        return (
          <Tag color={exp ? 'red' : soon ? 'orange' : 'default'} style={{ fontSize: 11 }}>
            {exp ? '⚠ Expired' : soon ? '⚠ Expiring' : ''} {dayjs(v).format('DD MMM YYYY')}
          </Tag>
        );
      },
    },
    {
      title: 'Uploaded', dataIndex: 'created_at', key: 'created', width: 120,
      render: v => <Text style={{ fontSize: 11 }}>{v ? dayjs(v).format('DD MMM YYYY') : '—'}</Text>,
    },
    {
      title: '', key: 'actions', width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Download">
            <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)} />
          </Tooltip>
          <Popconfirm title="Delete this document?" onConfirm={() => deleteM.mutate(r.id)} okType="danger" okText="Delete">
            <Button size="small" danger icon={<DeleteOutlined />} loading={deleteM.isPending} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={<Space><FileOutlined />Documents ({docs.length})</Space>}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} size="small" onClick={() => refetch()} loading={isLoading} />
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => setUploadOpen(true)}>
              Upload
            </Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
        size="small"
      >
        <Table
          columns={cols}
          dataSource={docs}
          loading={isLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No documents uploaded" /> }}
        />
      </Card>

      <Modal
        title={<Space><UploadOutlined />Upload Document</Space>}
        open={uploadOpen}
        onCancel={() => { setUploadOpen(false); setFileList([]); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Upload"
        confirmLoading={uploadM.isPending}
        width={480}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={v => uploadM.mutate(v)}>
          <Form.Item label="File" required>
            <Upload
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Select File (max 20MB)</Button>
            </Upload>
          </Form.Item>

          <Form.Item name="category" label="Category" initialValue="other">
            <Select>
              {CATEGORIES.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="title" label="Title / Description">
            <Input placeholder="e.g. BOSIET Certificate 2024" />
          </Form.Item>

          <Form.Item name="expiry_date" label="Expiry Date (optional)">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes…" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default DocumentManager;
