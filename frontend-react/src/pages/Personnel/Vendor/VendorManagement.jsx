import React, { useState } from 'react';
import {
  Table, Button, Space, Input, Select, Card, Row, Col,
  Tag, App, Popconfirm, DatePicker, Form, Drawer, Statistic,
  Descriptions, Divider, Badge, Tooltip, Alert, InputNumber, Tabs,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined,
  UserOutlined, FileTextOutlined, CheckCircleOutlined, EyeOutlined,
  TeamOutlined, ShopOutlined, SafetyCertificateOutlined, PhoneOutlined,
  BankOutlined, WarningOutlined, EditOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

// ── Constants ─────────────────────────────────────────────────────────────────
const VENDOR_TYPES = [
  { value: 'SERVICE_PROVIDER',    label: 'Service Provider',    color: 'blue'   },
  { value: 'EQUIPMENT_SUPPLIER',  label: 'Equipment Supplier',  color: 'cyan'   },
  { value: 'CONSULTING_FIRM',     label: 'Consulting Firm',     color: 'purple' },
  { value: 'STAFFING_AGENCY',     label: 'Staffing Agency',     color: 'green'  },
  { value: 'TRAINING_PROVIDER',   label: 'Training Provider',   color: 'gold'   },
  { value: 'MAINTENANCE_PROVIDER',label: 'Maintenance Provider',color: 'orange' },
  { value: 'SOFTWARE_VENDOR',     label: 'Software Vendor',     color: 'default'},
];

const VENDOR_STATUS_COLOR = {
  ACTIVE:           'success',
  INACTIVE:         'default',
  SUSPENDED:        'error',
  BLACKLISTED:      'error',
  PENDING_APPROVAL: 'warning',
};

const COMPLIANCE_COLOR = {
  COMPLIANT:     'success',
  NON_COMPLIANT: 'error',
  PENDING:       'warning',
  EXPIRED:       'error',
};

const BG_COLOR = {
  CLEARED:      'success',
  PENDING:      'warning',
  FAILED:       'error',
  NOT_REQUIRED: 'default',
};

const MED_COLOR = {
  CLEARED:      'success',
  PENDING:      'warning',
  FAILED:       'error',
  EXPIRED:      'error',
  NOT_REQUIRED: 'default',
};

const AVAIL_COLOR = {
  AVAILABLE:   'success',
  ASSIGNED:    'processing',
  ON_LEAVE:    'warning',
  UNAVAILABLE: 'error',
};

const getContractStatus = (endDate) => {
  if (!endDate) return null;
  const days = dayjs(endDate).diff(dayjs(), 'days');
  if (days < 0)   return { status: 'error',   text: 'Expired' };
  if (days <= 30) return { status: 'warning',  text: `${days}d left` };
  if (days <= 90) return { status: 'warning',  text: `${days}d left` };
  return           { status: 'success', text: 'Active' };
};

// ── VendorManagement ──────────────────────────────────────────────────────────
const VendorManagement = () => {
  const { message } = App.useApp();
  const [activeTab,   setActiveTab]   = useState('vendors');
  const [search,      setSearch]      = useState('');
  const [filterType,  setFilterType]  = useState(null);
  const [filterStatus,setFilterStatus]= useState(null);

  // Vendor drawer
  const [vendorDrawerOpen,  setVendorDrawerOpen]  = useState(false);
  const [editingVendor,     setEditingVendor]     = useState(null);
  const [vendorForm]  = Form.useForm();

  // Contractor drawer
  const [contractorDrawerOpen, setContractorDrawerOpen] = useState(false);
  const [editingContractor,    setEditingContractor]    = useState(null);
  const [contractorForm] = Form.useForm();

  // Detail drawer
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord,  setDetailRecord]  = useState(null);
  const [detailType,    setDetailType]    = useState('vendor');

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: vendorsData, isLoading: vendorsLoading, refetch: refetchVendors } = useQuery({
    queryKey: ['vendors', search, filterType, filterStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search)       p.append('search', search);
      if (filterType)   p.append('vendor_type', filterType);
      if (filterStatus) p.append('status', filterStatus);
      return apiService.get(`/api/v1/personnel/vendor-contractor/vendors?${p}`);
    },
    refetchInterval: 30000,
  });

  const { data: contractorsData, isLoading: contractorsLoading, refetch: refetchContractors } = useQuery({
    queryKey: ['contractors', search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      return apiService.get(`/api/v1/personnel/vendor-contractor/contractors?${p}`);
    },
    refetchInterval: 30000,
  });

  const vendors     = vendorsData?.data     || vendorsData?.results     || [];
  const contractors = contractorsData?.data || contractorsData?.results || [];

  const totalVendors    = vendorsData?.total_count     ?? vendors.length;
  const totalContractors = contractorsData?.total_count ?? contractors.length;
  const activeVendors   = vendors.filter(v => v.status === 'ACTIVE').length;
  const expiringCount   = vendors.filter(v => {
    if (!v.contract_end) return false;
    const days = dayjs(v.contract_end).diff(dayjs(), 'days');
    return days >= 0 && days <= 30;
  }).length;
  const expiredCount = vendors.filter(v => v.contract_end && dayjs(v.contract_end).isBefore(dayjs())).length;

  // ── Mutations – Vendor ──────────────────────────────────────────────────────
  const createVendorMutation = useMutation({
    mutationFn: (data) => apiService.post('/api/v1/personnel/vendor-contractor/vendors', data),
    onSuccess: () => {
      message.success('Vendor created successfully');
      setVendorDrawerOpen(false);
      vendorForm.resetFields();
      queryClient.invalidateQueries(['vendors']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || err.message || 'Failed to create vendor'),
  });

  const updateVendorMutation = useMutation({
    mutationFn: ({ id, ...data }) => apiService.put(`/api/v1/personnel/vendor-contractor/vendors/${id}`, data),
    onSuccess: () => {
      message.success('Vendor updated');
      setVendorDrawerOpen(false);
      vendorForm.resetFields();
      queryClient.invalidateQueries(['vendors']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Failed to update vendor'),
  });

  const deleteVendorMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/vendor-contractor/vendors/${id}`),
    onSuccess: () => {
      message.success('Vendor deleted');
      setDetailVisible(false);
      queryClient.invalidateQueries(['vendors']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Delete failed'),
  });

  // ── Mutations – Contractor ──────────────────────────────────────────────────
  const createContractorMutation = useMutation({
    mutationFn: (data) => apiService.post('/api/v1/personnel/vendor-contractor/contractors', data),
    onSuccess: () => {
      message.success('Contractor registered successfully');
      setContractorDrawerOpen(false);
      contractorForm.resetFields();
      queryClient.invalidateQueries(['contractors']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || err.message || 'Failed to register contractor'),
  });

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openVendorDrawer = (record = null) => {
    setEditingVendor(record);
    setVendorDrawerOpen(true);
    if (record) {
      vendorForm.setFieldsValue({
        ...record,
        contract_start: record.contract_start ? dayjs(record.contract_start) : null,
        contract_end:   record.contract_end   ? dayjs(record.contract_end)   : null,
      });
    } else {
      vendorForm.resetFields();
    }
  };

  const openContractorDrawer = (record = null) => {
    setEditingContractor(record);
    setContractorDrawerOpen(true);
    if (record) {
      contractorForm.setFieldsValue({
        ...record,
        date_of_birth:          record.date_of_birth          ? dayjs(record.date_of_birth)          : null,
        work_permit_expiry:     record.work_permit_expiry     ? dayjs(record.work_permit_expiry)     : null,
        background_check_date:  record.background_check_date  ? dayjs(record.background_check_date)  : null,
        medical_clearance_date: record.medical_clearance_date ? dayjs(record.medical_clearance_date) : null,
      });
    } else {
      contractorForm.resetFields();
    }
  };

  // ── Submit handlers ────────────────────────────────────────────────────────
  const handleVendorSubmit = () => {
    vendorForm.validateFields().then((values) => {
      const payload = {
        ...values,
        contract_start: values.contract_start ? values.contract_start.toISOString() : null,
        contract_end:   values.contract_end   ? values.contract_end.toISOString()   : null,
      };
      if (editingVendor) {
        updateVendorMutation.mutate({ id: editingVendor.id, ...payload });
      } else {
        createVendorMutation.mutate(payload);
      }
    }).catch(() => {});
  };

  const handleContractorSubmit = () => {
    contractorForm.validateFields().then((values) => {
      const payload = {
        ...values,
        date_of_birth:          values.date_of_birth          ? values.date_of_birth.toISOString()          : null,
        work_permit_expiry:     values.work_permit_expiry     ? values.work_permit_expiry.toISOString()     : null,
        background_check_date:  values.background_check_date  ? values.background_check_date.toISOString()  : null,
        medical_clearance_date: values.medical_clearance_date ? values.medical_clearance_date.toISOString() : null,
      };
      createContractorMutation.mutate(payload);
    }).catch(() => {});
  };

  // ── Vendor table columns ───────────────────────────────────────────────────
  const vendorColumns = [
    {
      title: 'Code', dataIndex: 'vendor_code', key: 'vendor_code', width: 110,
      render: (code) => <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{code}</Tag>,
    },
    {
      title: 'Vendor',
      key: 'vendor',
      render: (_, rec) => {
        const vt = VENDOR_TYPES.find(t => t.value === rec.vendor_type);
        return (
          <Space direction="vertical" size={0}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', padding: 0, color: '#1890ff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              onClick={() => { setDetailRecord(rec); setDetailType('vendor'); setDetailVisible(true); }}
            >
              {rec.vendor_name}
            </button>
            {vt && <span style={{ fontSize: 11, color: '#8c8c8c' }}>{vt.label}</span>}
          </Space>
        );
      },
    },
    {
      title: 'Contact', key: 'contact',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <span>{r.contact_person || '—'}</span>
          {r.phone && <span style={{ fontSize: 11, color: '#8c8c8c' }}><PhoneOutlined /> {r.phone}</span>}
        </Space>
      ),
    },
    {
      title: 'Contract Period', key: 'contract',
      render: (_, r) => {
        if (!r.contract_start && !r.contract_end) return <span style={{ color: '#bfbfbf' }}>—</span>;
        const st = getContractStatus(r.contract_end);
        return (
          <Space direction="vertical" size={0}>
            <span style={{ fontSize: 12 }}>
              {r.contract_start ? dayjs(r.contract_start).format('DD MMM YYYY') : '?'} —{' '}
              {r.contract_end   ? dayjs(r.contract_end).format('DD MMM YYYY')   : '?'}
            </span>
            {st && <Badge status={st.status} text={st.text} />}
          </Space>
        );
      },
    },
    {
      title: 'Contractors', key: 'contractors', width: 100, align: 'center',
      render: (_, r) => {
        const count = contractors.filter(c => c.vendor_id === r.id).length;
        return (
          <Tag color={count > 0 ? 'blue' : 'default'} style={{ fontSize: 13 }}>
            <TeamOutlined /> {count}
          </Tag>
        );
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: (s) => <Badge status={VENDOR_STATUS_COLOR[s] || 'default'} text={s || '—'} />,
    },
    {
      title: 'Compliance', dataIndex: 'compliance_status', key: 'compliance_status', width: 120,
      render: (s) => s ? <Tag color={COMPLIANCE_COLOR[s] || 'default'}>{s}</Tag> : <span style={{ color: '#bfbfbf' }}>—</span>,
    },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 110,
      render: (_, rec) => (
        <Space size={4}>
          <Tooltip title="View Details">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => { setDetailRecord(rec); setDetailType('vendor'); setDetailVisible(true); }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openVendorDrawer(rec)} />
          </Tooltip>
          <Popconfirm
            title="Delete this vendor?"
            description="All associated contractors will be affected."
            onConfirm={() => deleteVendorMutation.mutate(rec.id)}
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

  // ── Contractor table columns ───────────────────────────────────────────────
  const contractorColumns = [
    {
      title: 'Code', dataIndex: 'contractor_code', key: 'contractor_code', width: 110,
      render: (code) => <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{code || '—'}</Tag>,
    },
    {
      title: 'Name', key: 'name',
      render: (_, rec) => (
        <Space direction="vertical" size={0}>
          <button
            type="button"
            style={{ background: 'none', border: 'none', padding: 0, color: '#1890ff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            onClick={() => { setDetailRecord(rec); setDetailType('contractor'); setDetailVisible(true); }}
          >
            {rec.first_name} {rec.last_name}
          </button>
          {rec.job_title && <span style={{ fontSize: 11, color: '#8c8c8c' }}>{rec.job_title}</span>}
        </Space>
      ),
    },
    {
      title: 'Vendor', key: 'vendor',
      render: (_, r) => {
        const v = vendors.find(v => v.id === r.vendor_id);
        return v
          ? <Tag color="blue">{v.vendor_name}</Tag>
          : <Tag color="default">Unassigned</Tag>;
      },
    },
    {
      title: 'Work Permit Expiry', dataIndex: 'work_permit_expiry', key: 'wp_expiry', width: 160,
      render: (date) => {
        if (!date) return <Tag color="default">None</Tag>;
        const st = getContractStatus(date);
        return (
          <Space direction="vertical" size={0}>
            <span style={{ fontSize: 12 }}>{dayjs(date).format('DD MMM YYYY')}</span>
            {st && <Badge status={st.status} text={st.text} />}
          </Space>
        );
      },
    },
    {
      title: 'Background Check', dataIndex: 'background_check_status', key: 'bg_check', width: 140,
      render: (s) => <Tag color={BG_COLOR[s] || 'default'}>{s || 'N/A'}</Tag>,
    },
    {
      title: 'Medical', dataIndex: 'medical_clearance_status', key: 'medical', width: 110,
      render: (s) => <Tag color={MED_COLOR[s] || 'default'}>{s || 'N/A'}</Tag>,
    },
    {
      title: 'Availability', dataIndex: 'availability_status', key: 'availability', width: 120,
      render: (s) => <Badge status={AVAIL_COLOR[s] || 'default'} text={s || '—'} />,
    },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 90,
      render: (_, rec) => (
        <Space size={4}>
          <Tooltip title="View Details">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => { setDetailRecord(rec); setDetailType('contractor'); setDetailVisible(true); }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openContractorDrawer(rec)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rec = detailRecord;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24 }}>

      {/* Expiry alert */}
      {(expiringCount > 0 || expiredCount > 0) && (
        <Alert
          message="Contract Expiration Warning"
          description={`${expiredCount} vendor contract(s) expired. ${expiringCount} expiring within 30 days. Review and renew to maintain platform access compliance.`}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Vendors',      value: totalVendors,     icon: <ShopOutlined />,          color: '#1890ff' },
          { title: 'Active Vendors',     value: activeVendors,    icon: <CheckCircleOutlined />,   color: '#52c41a' },
          { title: 'Total Contractors',  value: totalContractors, icon: <TeamOutlined />,          color: '#722ed1' },
          { title: 'Expiring Contracts', value: expiringCount + expiredCount, icon: <WarningOutlined />, color: '#fa8c16' },
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
          <Col xs={24} sm={10} md={7}>
            <Input
              placeholder="Search vendor name, code or contractor..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Vendor Type"
              style={{ width: '100%' }}
              value={filterType}
              onChange={setFilterType}
              allowClear
            >
              {VENDOR_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              value={filterStatus}
              onChange={setFilterStatus}
              allowClear
            >
              {Object.keys(VENDOR_STATUS_COLOR).map(s => (
                <Option key={s} value={s}>{s.replace('_', ' ')}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={24} md={9}>
            <Space wrap>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openVendorDrawer()}>
                Add Vendor
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => openContractorDrawer()}>
                Add Contractor
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => { refetchVendors(); refetchContractors(); }}
                loading={vendorsLoading || contractorsLoading}>
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Tabs + Tables */}
      <Card styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 16px' }}
          items={[
            {
              key: 'vendors',
              label: <Space><ShopOutlined />Vendors ({totalVendors})</Space>,
              children: (
                <Table
                  columns={vendorColumns}
                  dataSource={vendors}
                  loading={vendorsLoading}
                  rowKey="id"
                  size="middle"
                  scroll={{ x: 1100 }}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
                />
              ),
            },
            {
              key: 'contractors',
              label: <Space><TeamOutlined />Contractors ({totalContractors})</Space>,
              children: (
                <Table
                  columns={contractorColumns}
                  dataSource={contractors}
                  loading={contractorsLoading}
                  rowKey="id"
                  size="middle"
                  scroll={{ x: 1200 }}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* ── Add / Edit Vendor Drawer ──────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <ShopOutlined style={{ color: '#1890ff' }} />
            <span>{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</span>
          </Space>
        }
        open={vendorDrawerOpen}
        onClose={() => { setVendorDrawerOpen(false); vendorForm.resetFields(); }}
        width={680}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => { setVendorDrawerOpen(false); vendorForm.resetFields(); }}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleVendorSubmit}
              loading={createVendorMutation.isPending || updateVendorMutation.isPending}
            >
              {editingVendor ? 'Update Vendor' : 'Register Vendor'}
            </Button>
          </Space>
        }
        destroyOnHidden
      >
        <Form form={vendorForm} layout="vertical" size="small">

          {/* Basic Info */}
          <Divider orientation="left">
            <Space><ShopOutlined style={{ color: '#1890ff' }} />Basic Information</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="vendor_code" label="Vendor Code *" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g., VEND-001" size="middle" />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="vendor_type" label="Vendor Type *" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select type" size="middle">
                  {VENDOR_TYPES.map(t => (
                    <Option key={t.value} value={t.value}>
                      <Tag color={t.color} style={{ marginRight: 6 }}>{t.value}</Tag>{t.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="vendor_name" label="Vendor Name *" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g., Halliburton Nigeria Ltd" size="middle" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="Services Offered">
                <Input.TextArea rows={2} placeholder="e.g., Drilling services, well completion, cementing, HSE consulting..." size="middle" />
              </Form.Item>
            </Col>
          </Row>

          {/* Contact */}
          <Divider orientation="left">
            <Space><PhoneOutlined style={{ color: '#52c41a' }} />Contact Details</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="contact_person" label="Contact Person">
                <Input placeholder="Primary contact name" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="vendor@company.com" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="+234-800-000-0000" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mobile" label="Mobile">
                <Input placeholder="+234-800-000-0000" size="middle" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="address_line1" label="Address">
                <Input placeholder="Street address" size="middle" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="city" label="City">
                <Input placeholder="City" size="middle" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="state" label="State">
                <Input placeholder="State" size="middle" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="country" label="Country" initialValue="Nigeria">
                <Input placeholder="Country" size="middle" />
              </Form.Item>
            </Col>
          </Row>

          {/* Contract */}
          <Divider orientation="left">
            <Space><FileTextOutlined style={{ color: '#722ed1' }} />Contract & Payment</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="contract_start" label="Contract Start Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contract_end" label="Contract End Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_terms" label="Payment Terms">
                <Input placeholder="e.g., Net 30, Net 60" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="currency" label="Currency" initialValue="USD">
                <Select size="middle">
                  {['USD', 'NGN', 'GBP', 'EUR'].map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Registration */}
          <Divider orientation="left">
            <Space><BankOutlined style={{ color: '#fa8c16' }} />Registration & Status</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="business_registration" label="Business Registration (RC No.)">
                <Input placeholder="CAC/RC Number" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tax_id" label="Tax ID (TIN)">
                <Input placeholder="Tax Identification Number" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="website" label="Website">
                <Input placeholder="https://..." size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status" initialValue="ACTIVE">
                <Select size="middle">
                  {Object.keys(VENDOR_STATUS_COLOR).map(s => (
                    <Option key={s} value={s}>{s.replace('_', ' ')}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={2} placeholder="Additional notes or remarks" size="middle" />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Drawer>

      {/* ── Add / Edit Contractor Drawer ──────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <TeamOutlined style={{ color: '#722ed1' }} />
            <span>{editingContractor ? 'Edit Contractor' : 'Register Contractor'}</span>
          </Space>
        }
        open={contractorDrawerOpen}
        onClose={() => { setContractorDrawerOpen(false); contractorForm.resetFields(); }}
        width={680}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => { setContractorDrawerOpen(false); contractorForm.resetFields(); }}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleContractorSubmit}
              loading={createContractorMutation.isPending}
            >
              {editingContractor ? 'Update Contractor' : 'Register Contractor'}
            </Button>
          </Space>
        }
        destroyOnHidden
      >
        <Form form={contractorForm} layout="vertical" size="small">

          {/* Personal Info */}
          <Divider orientation="left">
            <Space><UserOutlined style={{ color: '#1890ff' }} />Personal Information</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="first_name" label="First Name *" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="First name" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_name" label="Last Name *" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="Last name" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contractor_code" label="Contractor Code">
                <Input placeholder="Auto-generated if blank" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="vendor_id" label="Vendor (Company) *" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select vendor" showSearch optionFilterProp="children" size="middle">
                  {vendors.map(v => <Option key={v.id} value={v.id}>{v.vendor_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="contractor@email.com" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="+234-800-000-0000" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date_of_birth" label="Date of Birth">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="national_id" label="National ID (NIN)">
                <Input placeholder="NIN" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="passport_number" label="Passport Number">
                <Input placeholder="Passport number" size="middle" />
              </Form.Item>
            </Col>
          </Row>

          {/* Professional */}
          <Divider orientation="left">
            <Space><FileTextOutlined style={{ color: '#52c41a' }} />Professional Details</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="job_title" label="Job Title">
                <Input placeholder="e.g., Drilling Engineer" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="specialization" label="Specialization">
                <Input placeholder="e.g., Well Completion, Cementing" size="middle" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="experience_years" label="Experience (yrs)">
                <InputNumber min={0} max={60} style={{ width: '100%' }} size="middle" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="daily_rate" label="Daily Rate">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0.00" size="middle" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="currency" label="Currency" initialValue="USD">
                <Select size="middle">
                  {['USD', 'NGN', 'GBP', 'EUR'].map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="availability_status" label="Availability" initialValue="AVAILABLE">
                <Select size="middle">
                  {['AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'UNAVAILABLE'].map(s => (
                    <Option key={s} value={s}>{s.replace('_', ' ')}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Clearances */}
          <Divider orientation="left">
            <Space><SafetyCertificateOutlined style={{ color: '#fa8c16' }} />Work Permit & Clearances</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="work_permit_number" label="Work Permit Number">
                <Input placeholder="Work permit / visa number" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="work_permit_expiry" label="Work Permit Expiry">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="background_check_status" label="Background Check Status" initialValue="PENDING">
                <Select size="middle">
                  {['PENDING', 'CLEARED', 'FAILED', 'NOT_REQUIRED'].map(s => (
                    <Option key={s} value={s}>{s.replace('_', ' ')}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="background_check_date" label="Background Check Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="medical_clearance_status" label="Medical Clearance Status" initialValue="PENDING">
                <Select size="middle">
                  {['PENDING', 'CLEARED', 'FAILED', 'EXPIRED', 'NOT_REQUIRED'].map(s => (
                    <Option key={s} value={s}>{s.replace('_', ' ')}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="medical_clearance_date" label="Medical Clearance Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="security_clearance" label="Security Clearance Level">
                <Select placeholder="Select level" allowClear size="middle">
                  {['NONE', 'BASIC', 'STANDARD', 'HIGH', 'TOP_SECRET'].map(s => (
                    <Option key={s} value={s}>{s.replace('_', ' ')}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="notes" label="Notes / Certifications Held">
                <Input.TextArea rows={2} placeholder="HSE certifications, special qualifications, remarks..." size="middle" />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Drawer>

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      <Drawer
        title={
          rec && (
            <Space>
              {detailType === 'vendor'
                ? <ShopOutlined style={{ color: '#1890ff' }} />
                : <TeamOutlined style={{ color: '#722ed1' }} />}
              <span>{detailType === 'vendor' ? 'Vendor Details' : 'Contractor Details'}</span>
              {detailType === 'vendor' && rec.status && (
                <Badge status={VENDOR_STATUS_COLOR[rec.status] || 'default'} text={rec.status} />
              )}
            </Space>
          )
        }
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={500}
        extra={
          <Space>
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => {
                setDetailVisible(false);
                if (detailType === 'vendor') openVendorDrawer(rec);
                else openContractorDrawer(rec);
              }}
            >
              Edit
            </Button>
            {detailType === 'vendor' && (
              <Popconfirm
                title="Delete this vendor?"
                onConfirm={() => deleteVendorMutation.mutate(rec?.id)}
                okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />} size="small">Delete</Button>
              </Popconfirm>
            )}
          </Space>
        }
        destroyOnHidden
      >
        {rec && detailType === 'vendor' && (
          <>
            <Divider orientation="left" style={{ fontSize: 12 }}>Basic Information</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Vendor Code">{rec.vendor_code || '—'}</Descriptions.Item>
              <Descriptions.Item label="Vendor Type">
                {(() => { const t = VENDOR_TYPES.find(x => x.value === rec.vendor_type); return t ? <Tag color={t.color}>{t.label}</Tag> : rec.vendor_type || '—'; })()}
              </Descriptions.Item>
              <Descriptions.Item label="Vendor Name" span={2}><strong>{rec.vendor_name}</strong></Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>{rec.description || '—'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Contact</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Contact Person">{rec.contact_person || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{rec.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phone">{rec.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Mobile">{rec.mobile || '—'}</Descriptions.Item>
              <Descriptions.Item label="Address" span={2}>{[rec.address_line1, rec.city, rec.state, rec.country].filter(Boolean).join(', ') || '—'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Contract</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Start Date">{rec.contract_start ? dayjs(rec.contract_start).format('DD MMM YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="End Date">
                {rec.contract_end
                  ? (() => { const st = getContractStatus(rec.contract_end); return <Space><span>{dayjs(rec.contract_end).format('DD MMM YYYY')}</span>{st && <Badge status={st.status} text={st.text} />}</Space>; })()
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Terms">{rec.payment_terms || '—'}</Descriptions.Item>
              <Descriptions.Item label="Currency">{rec.currency || '—'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Registration & Compliance</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Business Reg.">{rec.business_registration || '—'}</Descriptions.Item>
              <Descriptions.Item label="Tax ID">{rec.tax_id || '—'}</Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>
                <Badge status={VENDOR_STATUS_COLOR[rec.status] || 'default'} text={rec.status || '—'} />
              </Descriptions.Item>
              <Descriptions.Item label="Compliance Status" span={2}>
                {rec.compliance_status ? <Tag color={COMPLIANCE_COLOR[rec.compliance_status] || 'default'}>{rec.compliance_status}</Tag> : '—'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 12, fontSize: 11, color: '#bfbfbf' }}>
              Registered: {rec.created_at ? dayjs(rec.created_at).format('DD MMM YYYY HH:mm') : '—'}
            </div>
          </>
        )}

        {rec && detailType === 'contractor' && (
          <>
            <Divider orientation="left" style={{ fontSize: 12 }}>Personal Information</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Name" span={2}><strong>{rec.first_name} {rec.last_name}</strong></Descriptions.Item>
              <Descriptions.Item label="Contractor Code">{rec.contractor_code || '—'}</Descriptions.Item>
              <Descriptions.Item label="Vendor">
                {(() => { const v = vendors.find(x => x.id === rec.vendor_id); return v ? <Tag color="blue">{v.vendor_name}</Tag> : '—'; })()}
              </Descriptions.Item>
              <Descriptions.Item label="Email">{rec.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Phone">{rec.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="National ID">{rec.national_id || '—'}</Descriptions.Item>
              <Descriptions.Item label="Passport">{rec.passport_number || '—'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Professional</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Job Title">{rec.job_title || '—'}</Descriptions.Item>
              <Descriptions.Item label="Specialization">{rec.specialization || '—'}</Descriptions.Item>
              <Descriptions.Item label="Experience">{rec.experience_years != null ? `${rec.experience_years} years` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Daily Rate">{rec.daily_rate != null ? `${rec.currency || 'USD'} ${rec.daily_rate}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Availability" span={2}>
                <Badge status={AVAIL_COLOR[rec.availability_status] || 'default'} text={rec.availability_status || '—'} />
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Clearances & Compliance</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Work Permit No.">{rec.work_permit_number || '—'}</Descriptions.Item>
              <Descriptions.Item label="Work Permit Expiry">
                {rec.work_permit_expiry
                  ? (() => { const st = getContractStatus(rec.work_permit_expiry); return <Space><span>{dayjs(rec.work_permit_expiry).format('DD MMM YYYY')}</span>{st && <Badge status={st.status} text={st.text} />}</Space>; })()
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Background Check">
                <Tag color={BG_COLOR[rec.background_check_status] || 'default'}>{rec.background_check_status || 'N/A'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="BG Check Date">{rec.background_check_date ? dayjs(rec.background_check_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Medical Clearance">
                <Tag color={MED_COLOR[rec.medical_clearance_status] || 'default'}>{rec.medical_clearance_status || 'N/A'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Medical Date">{rec.medical_clearance_date ? dayjs(rec.medical_clearance_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Security Clearance" span={2}>{rec.security_clearance || '—'}</Descriptions.Item>
            </Descriptions>

            {rec.notes && (
              <>
                <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Notes</Divider>
                <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '10px 12px', fontSize: 13 }}>
                  {rec.notes}
                </div>
              </>
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: '#bfbfbf' }}>
              Registered: {rec.created_at ? dayjs(rec.created_at).format('DD MMM YYYY HH:mm') : '—'}
            </div>
          </>
        )}
      </Drawer>

    </div>
  );
};

export default VendorManagement;
