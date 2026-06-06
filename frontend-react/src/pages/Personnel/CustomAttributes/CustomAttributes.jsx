import React, { useState } from 'react';
import {
  Table, Button, Space, Input, Select, Card, Row, Col,
  Tag, App, Popconfirm, Form, Drawer, Statistic,
  Descriptions, Divider, Badge, Tooltip, Switch,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  ReloadOutlined, SettingOutlined, EyeOutlined,
  AppstoreOutlined, CheckCircleOutlined, DatabaseOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Option } = Select;

// ── Constants ─────────────────────────────────────────────────────────────────
const ATTRIBUTE_TYPES = [
  { value: 'TEXT',         label: 'Text',         color: 'blue' },
  { value: 'NUMBER',       label: 'Number',        color: 'green' },
  { value: 'DATE',         label: 'Date',          color: 'orange' },
  { value: 'BOOLEAN',      label: 'Boolean',       color: 'magenta' },
  { value: 'SELECT',       label: 'Select',        color: 'purple' },
  { value: 'MULTI_SELECT', label: 'Multi-Select',  color: 'geekblue' },
  { value: 'FILE',         label: 'File',          color: 'cyan' },
  { value: 'EMAIL',        label: 'Email',         color: 'volcano' },
  { value: 'PHONE',        label: 'Phone',         color: 'gold' },
  { value: 'URL',          label: 'URL',           color: 'lime' },
];

const CATEGORIES = [
  { value: 'PERSONAL',     label: 'Personal Information' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'MEDICAL',      label: 'Medical' },
  { value: 'EMERGENCY',    label: 'Emergency Contact' },
  { value: 'SYSTEM',       label: 'System Information' },
  { value: 'CUSTOM',       label: 'Custom Fields' },
];

const typeInfo = (v) => ATTRIBUTE_TYPES.find(t => t.value === v);
const catLabel = (v) => CATEGORIES.find(c => c.value === v)?.label || v;

// ── CustomAttributes ──────────────────────────────────────────────────────────
const CustomAttributes = () => {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);

  // Form drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  // Detail drawer
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: attributesData, isLoading, refetch } = useQuery({
    queryKey: ['custom-attributes', search, filterType, filterCategory],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (filterType) p.append('attribute_type', filterType);
      if (filterCategory) p.append('category', filterCategory);
      return apiService.get(`/api/v1/personnel/custom-attributes/?${p}`);
    },
    refetchInterval: 30000,
  });

  const attributes = attributesData?.data || attributesData?.results || [];
  const total = attributesData?.total_count ?? attributes.length;
  const activeCount = attributes.filter(a => a.is_active !== false).length;
  const requiredCount = attributes.filter(a => a.is_required).length;
  const selectCount = attributes.filter(a => ['SELECT', 'MULTI_SELECT'].includes(a.attribute_type)).length;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? apiService.put(`/api/v1/personnel/custom-attributes/${editing.id}/`, data)
        : apiService.post('/api/v1/personnel/custom-attributes/', data),
    onSuccess: () => {
      message.success(editing ? 'Attribute updated successfully' : 'Attribute created successfully');
      setDrawerVisible(false);
      setEditing(null);
      form.resetFields();
      queryClient.invalidateQueries(['custom-attributes']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || err.message || 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/custom-attributes/${id}/`),
    onSuccess: () => {
      message.success('Attribute deleted successfully');
      setDetailVisible(false);
      queryClient.invalidateQueries(['custom-attributes']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Delete failed'),
  });

  // ── Open Drawer ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setDrawerVisible(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    const opts = record.display_options?.options || [];
    form.setFieldsValue({
      attribute_code: record.attribute_code,
      attribute_name: record.attribute_name,
      attribute_type: record.attribute_type,
      category: record.category,
      group_name: record.group_name,
      sort_order: record.sort_order ?? 0,
      placeholder_text: record.placeholder_text,
      is_required: record.is_required ?? false,
      is_searchable: record.is_searchable ?? true,
      is_visible_in_list: record.is_visible_in_list ?? true,
      is_active: record.is_active ?? true,
      description: record.description,
      notes: record.notes,
      options: opts,
    });
    setDrawerVisible(true);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const isSelectType = ['SELECT', 'MULTI_SELECT'].includes(values.attribute_type);
      const payload = {
        attribute_code: values.attribute_code,
        attribute_name: values.attribute_name,
        attribute_type: values.attribute_type,
        description: values.description || null,
        category: values.category || null,
        group_name: values.group_name || null,
        sort_order: values.sort_order ?? 0,
        placeholder_text: values.placeholder_text || null,
        is_required: values.is_required ?? false,
        is_searchable: values.is_searchable ?? true,
        is_visible_in_list: values.is_visible_in_list ?? true,
        is_active: values.is_active ?? true,
        notes: values.notes || null,
        display_options: isSelectType && values.options?.length
          ? { options: values.options }
          : null,
      };
      saveMutation.mutate(payload);
    });
  };

  // ── Table Columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Attribute Code',
      dataIndex: 'attribute_code',
      key: 'attribute_code',
      width: 180,
      render: (v, rec) => (
        <Space direction="vertical" size={0}>
          <button
            type="button"
            style={{ background: 'none', border: 'none', padding: 0, color: '#1890ff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            onClick={() => { setDetailRecord(rec); setDetailVisible(true); }}
          >
            {v}
          </button>
          <span style={{ fontSize: 11, color: '#8c8c8c' }}>{rec.attribute_name}</span>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'attribute_type',
      key: 'attribute_type',
      width: 130,
      render: (v) => {
        const t = typeInfo(v);
        return t ? <Tag color={t.color}>{t.label}</Tag> : <Tag>{v || '—'}</Tag>;
      },
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (v) => v ? <Tag>{catLabel(v)}</Tag> : <span style={{ color: '#bfbfbf' }}>—</span>,
    },
    {
      title: 'Options',
      key: 'options',
      width: 180,
      render: (_, rec) => {
        const opts = rec.display_options?.options || [];
        if (!opts.length) return <span style={{ color: '#bfbfbf' }}>—</span>;
        return (
          <Space size={2} wrap>
            {opts.slice(0, 3).map((o) => <Tag key={o} style={{ fontSize: 11 }}>{o}</Tag>)}
            {opts.length > 3 && <Tag style={{ fontSize: 11 }}>+{opts.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Required',
      dataIndex: 'is_required',
      key: 'is_required',
      width: 90,
      align: 'center',
      render: (v) => v
        ? <Badge status="error" text="Yes" />
        : <Badge status="default" text="No" />,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      align: 'center',
      render: (v) => v !== false
        ? <Badge status="success" text="Active" />
        : <Badge status="default" text="Inactive" />,
    },
    {
      title: 'Used',
      dataIndex: 'usage_count',
      key: 'usage_count',
      width: 70,
      align: 'center',
      render: (v) => <span style={{ fontWeight: 600, color: '#595959' }}>{v ?? 0}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, rec) => (
        <Space size={4}>
          <Tooltip title="View Details">
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setDetailRecord(rec); setDetailVisible(true); }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} />
          </Tooltip>
          <Popconfirm
            title="Delete this attribute?"
            description="Values recorded against this field will also be removed."
            onConfirm={() => deleteMutation.mutate(rec.id)}
            okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rec = detailRecord;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24 }}>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Fields', value: total, icon: <DatabaseOutlined />, color: '#1890ff' },
          { title: 'Active Fields', value: activeCount, icon: <CheckCircleOutlined />, color: '#52c41a' },
          { title: 'Required Fields', value: requiredCount, icon: <SettingOutlined />, color: '#f5222d' },
          { title: 'Dropdown Fields', value: selectCount, icon: <AppstoreOutlined />, color: '#722ed1' },
        ].map((s) => (
          <Col xs={12} sm={6} key={s.title}>
            <Card styles={{ body: { padding: '14px 18px' } }} style={{ borderTop: `3px solid ${s.color}` }}>
              <Statistic title={s.title} value={s.value} prefix={s.icon} valueStyle={{ color: s.color, fontSize: 24 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filter bar */}
      <Card styles={{ body: { padding: '12px 16px' } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} sm={8} md={7}>
            <Input
              placeholder="Search code or name..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={5} md={5}>
            <Select
              placeholder="Type"
              style={{ width: '100%' }}
              value={filterType}
              onChange={setFilterType}
              allowClear
            >
              {ATTRIBUTE_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={5} md={5}>
            <Select
              placeholder="Category"
              style={{ width: '100%' }}
              value={filterCategory}
              onChange={setFilterCategory}
              allowClear
            >
              {CATEGORIES.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={6} md={7}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                Add Field
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Refresh</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={attributes}
          loading={isLoading}
          rowKey="id"
          size="middle"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
        />
      </Card>

      {/* ── Add / Edit Drawer ──────────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <SettingOutlined style={{ color: editing ? '#1890ff' : '#52c41a' }} />
            <span>{editing ? `Edit: ${editing.attribute_code}` : 'Add Custom Field'}</span>
          </Space>
        }
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setEditing(null); form.resetFields(); }}
        width={680}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => { setDrawerVisible(false); setEditing(null); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit} loading={saveMutation.isPending}>
              {editing ? 'Save Changes' : 'Create Field'}
            </Button>
          </Space>
        }
        destroyOnHidden
      >
        <Form form={form} layout="vertical" size="small">

          {/* ── Identity ── */}
          <Divider orientation="left">
            <Space><DatabaseOutlined style={{ color: '#1890ff' }} />Identity</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="attribute_code"
                label="Attribute Code *"
                rules={[
                  { required: true, message: 'Required' },
                  { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: 'Letters, numbers, underscores only. Must start with letter or underscore.' },
                ]}
              >
                <Input
                  placeholder="e.g., offshore_certification"
                  disabled={!!editing}
                  style={editing ? { background: '#fafafa' } : {}}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="attribute_name"
                label="Display Name *"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Input placeholder="e.g., Offshore Certification" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="attribute_type"
                label="Data Type *"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select placeholder="Select data type" size="middle">
                  {ATTRIBUTE_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>
                      <Tag color={t.color} style={{ marginRight: 6 }}>{t.value}</Tag>{t.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category">
                <Select placeholder="Select category" size="middle" allowClear>
                  {CATEGORIES.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* ── SELECT options (conditional) ── */}
          <Form.Item noStyle shouldUpdate={(p, c) => p.attribute_type !== c.attribute_type}>
            {({ getFieldValue }) => {
              const t = getFieldValue('attribute_type');
              if (!['SELECT', 'MULTI_SELECT'].includes(t)) return null;
              return (
                <>
                  <Divider orientation="left">
                    <Space><FilterOutlined style={{ color: '#722ed1' }} />Dropdown Options</Space>
                  </Divider>
                  <Form.Item
                    name="options"
                    label="Options *"
                    rules={[{ required: true, message: 'Add at least one option' }]}
                  >
                    <Select
                      mode="tags"
                      placeholder="Type an option and press Enter"
                      size="middle"
                      tokenSeparators={[',']}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>

          {/* ── Configuration ── */}
          <Divider orientation="left">
            <Space><AppstoreOutlined style={{ color: '#fa8c16' }} />Configuration</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="placeholder_text" label="Placeholder Text">
                <Input placeholder="Hint shown inside the field" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sort_order" label="Sort Order" initialValue={0}>
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="group_name" label="Group Name">
            <Input placeholder="Optional grouping label" />
          </Form.Item>

          {/* ── Behaviour ── */}
          <Divider orientation="left">
            <Space><CheckCircleOutlined style={{ color: '#52c41a' }} />Behaviour</Space>
          </Divider>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="is_required" label="Required" valuePropName="checked" initialValue={false}>
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_searchable" label="Searchable" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_visible_in_list" label="Show in List" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          {editing && (
            <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
          )}

          {/* ── Notes ── */}
          <Divider orientation="left">
            <Space><EditOutlined style={{ color: '#8c8c8c' }} />Description & Notes</Space>
          </Divider>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Explain what this field captures" />
          </Form.Item>
          <Form.Item name="notes" label="Internal Notes">
            <Input.TextArea rows={2} placeholder="Notes for administrators" />
          </Form.Item>

        </Form>
      </Drawer>

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={
          rec && (
            <Space>
              <DatabaseOutlined style={{ color: '#1890ff' }} />
              <span>{rec.attribute_code}</span>
              {(() => { const t = typeInfo(rec.attribute_type); return t ? <Tag color={t.color}>{t.label}</Tag> : null; })()}
            </Space>
          )
        }
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={500}
        extra={
          <Space>
            <Button icon={<EditOutlined />} size="small" onClick={() => { setDetailVisible(false); openEdit(rec); }}>
              Edit
            </Button>
            <Popconfirm
              title="Delete this attribute?"
              onConfirm={() => deleteMutation.mutate(rec?.id)}
              okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} size="small">Delete</Button>
            </Popconfirm>
          </Space>
        }
        destroyOnHidden
      >
        {rec && (
          <>
            <Divider orientation="left" style={{ fontSize: 12 }}>Identity</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Code" span={2}>
                <strong>{rec.attribute_code}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Name" span={2}>{rec.attribute_name}</Descriptions.Item>
              <Descriptions.Item label="Type">
                {(() => { const t = typeInfo(rec.attribute_type); return t ? <Tag color={t.color}>{t.label}</Tag> : rec.attribute_type; })()}
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                {rec.category ? <Tag>{catLabel(rec.category)}</Tag> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Group">{rec.group_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Sort Order">{rec.sort_order ?? 0}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Behaviour</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Status">
                <Badge status={rec.is_active !== false ? 'success' : 'default'} text={rec.is_active !== false ? 'Active' : 'Inactive'} />
              </Descriptions.Item>
              <Descriptions.Item label="Required">
                <Badge status={rec.is_required ? 'error' : 'default'} text={rec.is_required ? 'Yes' : 'No'} />
              </Descriptions.Item>
              <Descriptions.Item label="Searchable">
                <Badge status={rec.is_searchable ? 'success' : 'default'} text={rec.is_searchable ? 'Yes' : 'No'} />
              </Descriptions.Item>
              <Descriptions.Item label="Visible in List">
                <Badge status={rec.is_visible_in_list ? 'success' : 'default'} text={rec.is_visible_in_list ? 'Yes' : 'No'} />
              </Descriptions.Item>
              <Descriptions.Item label="Used by" span={2}>
                <strong>{rec.usage_count ?? 0}</strong> personnel records
              </Descriptions.Item>
            </Descriptions>

            {rec.display_options?.options?.length > 0 && (
              <>
                <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Options</Divider>
                <Space wrap size={4}>
                  {rec.display_options.options.map((o) => <Tag key={o}>{o}</Tag>)}
                </Space>
              </>
            )}

            {rec.placeholder_text && (
              <>
                <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Placeholder</Divider>
                <div style={{ color: '#595959', fontSize: 13 }}>{rec.placeholder_text}</div>
              </>
            )}

            {(rec.description || rec.notes) && (
              <>
                <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Notes</Divider>
                {rec.description && <div style={{ fontSize: 13, marginBottom: 6 }}>{rec.description}</div>}
                {rec.notes && <div style={{ fontSize: 12, color: '#8c8c8c' }}>{rec.notes}</div>}
              </>
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: '#bfbfbf' }}>
              Created: {rec.created_at ? new Date(rec.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              {rec.updated_at && ` · Updated: ${new Date(rec.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
            </div>
          </>
        )}
      </Drawer>

    </div>
  );
};

export default CustomAttributes;
