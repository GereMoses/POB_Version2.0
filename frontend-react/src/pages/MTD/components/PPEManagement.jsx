import React, { useState } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker,
  Row, Col, Tooltip, Popconfirm, Tabs, InputNumber, Descriptions, Switch,
} from 'antd';
import {
  PlusOutlined, EditOutlined, EyeOutlined, UserOutlined, SearchOutlined,
  ReloadOutlined, ToolOutlined, RollbackOutlined, DeleteOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import usePersonnel from '../../../hooks/usePersonnel';
import dayjs from 'dayjs';

const diffDays = d => d ? dayjs(d).diff(dayjs(), 'day') : null;

const COND_MAP = {
  0: { label: 'New',  color: '#52c41a' },
  1: { label: 'Good', color: '#1890ff' },
  2: { label: 'Fair', color: '#fa8c16' },
};

const ExpiryCell = ({ date }) => {
  if (!date) return <span style={{ color: '#d9d9d9' }}>—</span>;
  const d = diffDays(date);
  const color = d < 0 ? '#cf1322' : d <= 30 ? '#d48806' : '#389e0d';
  return (
    <span style={{ color, fontWeight: d <= 30 ? 700 : 400 }}>
      {dayjs(date).format('DD MMM YYYY')}
      {d <= 60 && <span style={{ fontSize: 10, marginLeft: 4 }}>({d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`})</span>}
    </span>
  );
};

/* ─── PPE Types sub-tab ───────────────────────────────────────── */
const PPETypesTab = ({ ppeTypes, isLoading, qc }) => {
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [form]  = Form.useForm();

  const saveMut = useMutation({
    mutationFn: v => modal === 'add'
      ? apiService.post('/api/mtd/ppe-types/', v)
      : apiService.put(`/api/mtd/ppe-types/${selected.id}/`, v),
    onSuccess: () => { qc.invalidateQueries(['mtd-ppe-types']); setModal(null); form.resetFields(); setSelected(null); },
  });

  const columns = [
    { title: 'PPE Type', dataIndex: 'ppe_name', key: 'name', ellipsis: true, width: 200, render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Lifespan', dataIndex: 'lifespan_days', key: 'life', width: 110,
      render: v => v ? <Tag color="blue">{v} days</Tag> : <span style={{ color: '#d9d9d9' }}>Unlimited</span> },
    { title: 'Calibration', key: 'calib', width: 130, align: 'center',
      render: (_, r) => r.requires_calibration
        ? <Tag color="orange" icon={<CalendarOutlined />}>Every {r.calib_interval_days}d</Tag>
        : <Tag color="default">Not required</Tag> },
    { title: 'Description', dataIndex: 'description', key: 'desc', ellipsis: true },
    { title: '', key: 'act', width: 70, align: 'center',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="Edit">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => {
              setSelected(r); setModal('edit'); form.setFieldsValue({ ...r });
            }} />
          </Tooltip>
          <Popconfirm title="Delete this PPE type?" okType="danger"
            onConfirm={() => apiService.delete(`/api/mtd/ppe-types/${r.id}`).then(() => qc.invalidateQueries(['mtd-ppe-types']))}>
            <Tooltip title="Delete"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )},
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModal('add'); form.resetFields(); }}>Add PPE Type</Button>
      </div>
      <Table dataSource={ppeTypes} columns={columns} rowKey="id" size="small" loading={isLoading}
        pagination={{ pageSize: 15, showSizeChanger: true }} />

      <Modal open={modal === 'add' || modal === 'edit'}
        title={<Space><ToolOutlined />{modal === 'add' ? 'Add PPE Type' : 'Edit PPE Type'}</Space>}
        onCancel={() => { setModal(null); form.resetFields(); setSelected(null); }}
        onOk={() => form.validateFields().then(v => saveMut.mutate(v))}
        confirmLoading={saveMut.isPending} width={480} destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="ppe_name" label="PPE Type Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="lifespan_days" label="Lifespan (days)">
                <InputNumber style={{ width: '100%' }} min={1} placeholder="Leave blank = unlimited" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="requires_calibration" label="Requires Calibration?" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(p, c) => p.requires_calibration !== c.requires_calibration}>
            {({ getFieldValue }) => getFieldValue('requires_calibration') && (
              <Form.Item name="calib_interval_days" label="Calibration Interval (days)">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────── */
const PPEManagement = () => {
  const qc = useQueryClient();
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [issueModal,   setIssueModal]   = useState(false);
  const [viewModal,    setViewModal]    = useState(false);
  const [returnModal,  setReturnModal]  = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [issueForm]  = Form.useForm();
  const [returnForm] = Form.useForm();

  const { data: issueData, isLoading }          = useQuery({ queryKey: ['mtd-ppe-issues'], queryFn: () => apiService.get('/api/mtd/ppe-issues/') });
  const { data: typeData,  isLoading: loadTypes } = useQuery({ queryKey: ['mtd-ppe-types'],  queryFn: () => apiService.get('/api/mtd/ppe-types/') });
  const { empOptions } = usePersonnel();

  const issues   = issueData?.data?.data ?? issueData?.data ?? [];
  const ppeTypes = typeData?.data?.data  ?? typeData?.data  ?? [];

  const issueMut = useMutation({
    mutationFn: v => apiService.post('/api/mtd/ppe-issues/', v),
    onSuccess:  () => { qc.invalidateQueries(['mtd-ppe-issues']); setIssueModal(false); issueForm.resetFields(); },
  });

  const returnMut = useMutation({
    mutationFn: v => apiService.post(`/api/mtd/ppe-issues/${selected.id}/return/`, v),
    onSuccess:  () => { qc.invalidateQueries(['mtd-ppe-issues']); setReturnModal(false); returnForm.resetFields(); setSelected(null); },
  });

  const active   = issues.filter(i => !i.return_date);
  const returned = issues.filter(i =>  i.return_date);

  const minDays = r => Math.min(diffDays(r.expiry_date) ?? 9999, diffDays(r.next_calib_date) ?? 9999);

  const filtered = active.filter(r => {
    const q = search.toLowerCase();
    const d = minDays(r);
    return (
      (!search || (r.emp_name || '').toLowerCase().includes(q) || (r.ppe_type_name || '').toLowerCase().includes(q)) &&
      (typeFilter === 'all' || String(r.ppe_type_id) === typeFilter) &&
      (statusFilter === 'all'
        || (statusFilter === 'due'     && d >= 0  && d <= 30)
        || (statusFilter === 'expired' && d < 0))
    );
  });

  const expiringSoon = active.filter(r => { const d = minDays(r); return d >= 0 && d <= 30; }).length;
  const overdue      = active.filter(r => minDays(r) < 0).length;

  const activeColumns = [
    { title: 'Employee', key: 'name', ellipsis: true, width: 190,
      render: (_, r) => <Space size={6}><UserOutlined style={{ color: '#8c8c8c' }} /><span style={{ fontWeight: 600 }}>{r.emp_name || '—'}</span></Space> },
    { title: 'PPE Type', dataIndex: 'ppe_type_name', key: 'type', ellipsis: true, width: 160, render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Serial No.', dataIndex: 'serial_no', key: 'serial', width: 110, render: v => v || <span style={{ color: '#d9d9d9' }}>—</span> },
    { title: 'Issued', dataIndex: 'issue_date', key: 'issued', width: 110, render: v => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Condition', dataIndex: 'condition_out', key: 'cond', width: 90, align: 'center',
      render: v => { const c = COND_MAP[v] ?? COND_MAP[1]; return <Tag style={{ color: c.color, borderColor: c.color }}>{c.label}</Tag>; } },
    { title: 'PPE Expiry',   key: 'expiry', width: 155, render: (_, r) => <ExpiryCell date={r.expiry_date} /> },
    { title: 'Next Calib.',  key: 'calib',  width: 155, render: (_, r) => <ExpiryCell date={r.next_calib_date} /> },
    { title: '', key: 'act', width: 80, align: 'center', fixed: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="View"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => { setSelected(r); setViewModal(true); }} /></Tooltip>
          <Tooltip title="Record Return">
            <Button size="small" type="text" icon={<RollbackOutlined />} style={{ color: '#52c41a' }}
              onClick={() => { setSelected(r); setReturnModal(true); returnForm.resetFields(); }} />
          </Tooltip>
        </Space>
      )},
  ];

  const historyColumns = [
    { title: 'Employee',   key: 'name', ellipsis: true, width: 160, render: (_, r) => <span style={{ fontWeight: 600 }}>{r.emp_name || '—'}</span> },
    { title: 'PPE Type',   dataIndex: 'ppe_type_name', key: 'type', ellipsis: true, width: 150 },
    { title: 'Serial No.', dataIndex: 'serial_no',     key: 'serial', width: 110, render: v => v || '—' },
    { title: 'Issued',     dataIndex: 'issue_date',    key: 'issued', width: 115, render: v => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Returned',   dataIndex: 'return_date',   key: 'ret',    width: 115, render: v => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Condition In', dataIndex: 'condition_in', key: 'cin', width: 110, align: 'center',
      render: v => { const c = COND_MAP[v] ?? COND_MAP[1]; return <Tag style={{ color: c.color }}>{c.label}</Tag>; } },
  ];

  const tabItems = [
    {
      key: 'active',
      label: <span>Active Issues <Tag style={{ marginLeft: 4 }}>{active.length}</Tag></span>,
      children: (
        <div style={{ padding: '14px 0' }}>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {[
              { label: 'Active Issues',  value: active.length,   color: '#1890ff', bg: '#e6f7ff', border: '#91d5ff',  filter: 'all' },
              { label: 'Expiring Soon',  value: expiringSoon,    color: '#d48806', bg: '#fffbe6', border: '#ffe58f',  filter: 'due' },
              { label: 'Overdue',        value: overdue,         color: '#cf1322', bg: '#fff1f0', border: '#ffa39e',  filter: 'expired' },
              { label: 'Returned',       value: returned.length, color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f',  filter: null },
            ].map(s => (
              <Col key={s.label} xs={6}>
                <div onClick={() => s.filter && setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
                  style={{ background: statusFilter === s.filter ? s.bg : 'white', border: `1.5px solid ${statusFilter === s.filter ? s.color : '#e8e8e8'}`, borderRadius: 10, padding: '10px 16px', textAlign: 'center', cursor: s.filter ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                  <div style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.value}</div>
                  <div style={{ color: s.color, fontSize: 11, fontWeight: 600 }}>{s.label}</div>
                </div>
              </Col>
            ))}
          </Row>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <Input prefix={<SearchOutlined />} placeholder="Search by name or PPE type…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ width: 260 }} allowClear />
            <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 180 }}>
              <Select.Option value="all">All PPE types</Select.Option>
              {ppeTypes.map(t => <Select.Option key={t.id} value={String(t.id)}>{t.ppe_name}</Select.Option>)}
            </Select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries(['mtd-ppe-issues'])}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setIssueModal(true); issueForm.resetFields(); }}>Issue PPE</Button>
            </div>
          </div>

          <Table dataSource={filtered} columns={activeColumns} rowKey="id" size="small" loading={isLoading}
            scroll={{ x: 1050 }}
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `${t} active issues` }}
            rowClassName={r => { const d = minDays(r); return d < 0 ? 'mtd-row-expired' : d <= 30 ? 'mtd-row-critical' : ''; }}
          />
        </div>
      ),
    },
    {
      key: 'history',
      label: <span>Return History <Tag style={{ marginLeft: 4 }}>{returned.length}</Tag></span>,
      children: (
        <div style={{ padding: '14px 0' }}>
          <Table dataSource={returned} columns={historyColumns} rowKey="id" size="small"
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `${t} returns` }} />
        </div>
      ),
    },
    {
      key: 'types',
      label: 'PPE Types',
      children: <PPETypesTab ppeTypes={ppeTypes} isLoading={loadTypes} qc={qc} />,
    },
  ];

  return (
    <div style={{ padding: '20px 24px' }}>
      <Tabs items={tabItems} size="small" />

      {/* ── Issue PPE modal ── */}
      <Modal open={issueModal}
        title={<Space><ToolOutlined />Issue PPE to Employee</Space>}
        onCancel={() => { setIssueModal(false); issueForm.resetFields(); }}
        onOk={() => issueForm.validateFields().then(v => issueMut.mutate({
          ...v,
          issue_date:      v.issue_date?.format('YYYY-MM-DD')      ?? null,
          last_calib_date: v.last_calib_date?.format('YYYY-MM-DD') ?? null,
        }))}
        confirmLoading={issueMut.isPending} width={520} destroyOnHidden
      >
        <Form form={issueForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="emp_id" label="Employee" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={empOptions} />
          </Form.Item>
          <Form.Item name="ppe_type_id" label="PPE Type" rules={[{ required: true }]}>
            <Select options={ppeTypes.map(t => ({ value: t.id, label: t.ppe_name }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="serial_no" label="Serial / Tag No."><Input /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="condition_out" label="Condition" initialValue={1}>
                <Select>{Object.entries(COND_MAP).map(([k, v]) => <Select.Option key={k} value={Number(k)}>{v.label}</Select.Option>)}</Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="issue_date" label="Issue Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="last_calib_date" label="Last Calibration Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Return modal ── */}
      <Modal open={returnModal}
        title={<Space><RollbackOutlined />Return PPE — {selected?.ppe_type_name}</Space>}
        onCancel={() => { setReturnModal(false); returnForm.resetFields(); setSelected(null); }}
        onOk={() => returnForm.validateFields().then(v => returnMut.mutate({
          ...v, return_date: v.return_date?.format('YYYY-MM-DD') ?? null,
        }))}
        confirmLoading={returnMut.isPending} width={400} destroyOnHidden
      >
        <Form form={returnForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="return_date" label="Return Date">
            <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
          </Form.Item>
          <Form.Item name="condition_in" label="Condition on Return" rules={[{ required: true }]} initialValue={1}>
            <Select>{Object.entries(COND_MAP).map(([k, v]) => <Select.Option key={k} value={Number(k)}>{v.label}</Select.Option>)}</Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── View modal ── */}
      {selected && viewModal && (
        <Modal open title={<Space><ToolOutlined />{selected.ppe_type_name}</Space>}
          footer={<Button onClick={() => setViewModal(false)}>Close</Button>}
          onCancel={() => setViewModal(false)} width={460}
        >
          <Descriptions bordered size="small" column={2} style={{ marginTop: 16 }}>
            <Descriptions.Item label="Employee" span={2}>{selected.emp_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Serial No.">{selected.serial_no || '—'}</Descriptions.Item>
            <Descriptions.Item label="Issued">{selected.issue_date ? dayjs(selected.issue_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Condition Out">{COND_MAP[selected.condition_out]?.label || '—'}</Descriptions.Item>
            <Descriptions.Item label="PPE Expiry"><ExpiryCell date={selected.expiry_date} /></Descriptions.Item>
            <Descriptions.Item label="Last Calibration">{selected.last_calib_date ? dayjs(selected.last_calib_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Next Calibration"><ExpiryCell date={selected.next_calib_date} /></Descriptions.Item>
          </Descriptions>
        </Modal>
      )}
    </div>
  );
};

export default PPEManagement;
