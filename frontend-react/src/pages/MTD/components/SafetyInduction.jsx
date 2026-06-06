import React, { useState } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker,
  Row, Col, Tooltip, Popconfirm, Tabs, InputNumber, Descriptions, Progress,
} from 'antd';
import {
  PlusOutlined, EditOutlined, EyeOutlined, UserOutlined, SearchOutlined,
  ReloadOutlined, BookOutlined, DeleteOutlined, CheckCircleOutlined,
  CloseCircleOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import usePersonnel from '../../../hooks/usePersonnel';
import dayjs from 'dayjs';

const diffDays = d => d ? dayjs(d).diff(dayjs(), 'day') : null;

const ExpiryTag = ({ date }) => {
  if (!date) return <Tag color="default">No expiry</Tag>;
  const d = diffDays(date);
  if (d < 0)   return <Tag color="red"    style={{ fontWeight: 700 }}>Expired {Math.abs(d)}d ago</Tag>;
  if (d <= 30) return <Tag color="orange"                            >{d}d left</Tag>;
  if (d <= 90) return <Tag color="gold"                              >{d}d left</Tag>;
  return           <Tag color="green"                                >Valid</Tag>;
};

const ScoreTag = ({ score, pass }) => {
  const color = score >= pass ? '#389e0d' : '#cf1322';
  return (
    <Space size={6}>
      <span style={{ color, fontWeight: 700, fontSize: 14 }}>{score}%</span>
      {score >= pass
        ? <CheckCircleOutlined style={{ color: '#389e0d' }} />
        : <CloseCircleOutlined style={{ color: '#cf1322' }} />}
    </Space>
  );
};

/* ─── Templates tab ─────────────────────────────────────────── */
const TemplatesTab = ({ templates, isLoading, qc }) => {
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [form]  = Form.useForm();

  const saveMut = useMutation({
    mutationFn: v => modal === 'add'
      ? apiService.post('/api/mtd/induction-templates/', { ...v, quiz_questions: [] })
      : apiService.put(`/api/mtd/induction-templates/${selected.id}/`, { ...v, quiz_questions: selected.quiz_questions ?? [] }),
    onSuccess: () => { qc.invalidateQueries(['mtd-templates']); setModal(null); form.resetFields(); setSelected(null); },
  });

  const columns = [
    { title: 'Template Name', dataIndex: 'template_name', key: 'name', ellipsis: true, width: 220, render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Validity', dataIndex: 'validity_days', key: 'valid', width: 100,
      render: v => <Tag color="blue">{v} days</Tag> },
    { title: 'Pass Score', dataIndex: 'passing_score', key: 'pass', width: 100, align: 'center',
      render: v => <Tag color="purple">{v}%</Tag> },
    { title: 'Required For', dataIndex: 'required_for_type', key: 'req', width: 120,
      render: v => v !== null && v !== undefined
        ? <Tag color={v === 0 ? 'blue' : v === 1 ? 'purple' : 'cyan'}>{v === 0 ? 'Employee' : v === 1 ? 'Visitor' : 'Both'}</Tag>
        : <Tag color="default">All</Tag> },
    { title: 'Questions', key: 'q', width: 90, align: 'center',
      render: (_, r) => <Tag>{(r.quiz_questions ?? []).length} Qs</Tag> },
    { title: 'Description', dataIndex: 'description', key: 'desc', ellipsis: true },
    { title: '', key: 'act', width: 70, align: 'center',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="Edit">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => {
              setSelected(r); setModal('edit');
              form.setFieldsValue({ template_name: r.template_name, validity_days: r.validity_days, passing_score: r.passing_score, required_for_type: r.required_for_type, description: r.description });
            }} />
          </Tooltip>
          <Popconfirm title="Delete this template?" okType="danger"
            onConfirm={() => apiService.delete(`/api/mtd/induction-templates/${r.id}/`).then(() => qc.invalidateQueries(['mtd-templates']))}>
            <Tooltip title="Delete"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )},
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModal('add'); form.resetFields(); }}>
          Add Template
        </Button>
      </div>
      <Table dataSource={templates} columns={columns} rowKey="id" size="small" loading={isLoading}
        pagination={{ pageSize: 15, showSizeChanger: true }} />

      <Modal open={modal === 'add' || modal === 'edit'}
        title={<Space><BookOutlined />{modal === 'add' ? 'Add Induction Template' : 'Edit Induction Template'}</Space>}
        onCancel={() => { setModal(null); form.resetFields(); setSelected(null); }}
        onOk={() => form.validateFields().then(v => saveMut.mutate(v))}
        confirmLoading={saveMut.isPending} width={500} destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="template_name" label="Template Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="validity_days" label="Validity (days)" rules={[{ required: true }]} initialValue={365}>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="passing_score" label="Pass Score (%)" rules={[{ required: true }]} initialValue={80}>
                <InputNumber style={{ width: '100%' }} min={1} max={100} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="required_for_type" label="Required For">
            <Select allowClear placeholder="All personnel types">
              <Select.Option value={0}>Employee only</Select.Option>
              <Select.Option value={1}>Visitor only</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────── */
const SafetyInduction = () => {
  const qc = useQueryClient();
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [tmplFilter,   setTmplFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal,        setModal]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [form] = Form.useForm();

  const { data: recData,  isLoading }      = useQuery({ queryKey: ['mtd-inductions'],  queryFn: () => apiService.get('/api/mtd/induction-records/') });
  const { data: tmplData, isLoading: ltpl } = useQuery({ queryKey: ['mtd-templates'],   queryFn: () => apiService.get('/api/mtd/induction-templates/') });
  const { empOptions } = usePersonnel();

  const records   = recData?.data?.data  ?? recData?.data  ?? [];
  const templates = tmplData?.data?.data ?? tmplData?.data ?? [];

  const saveMut = useMutation({
    mutationFn: v => apiService.post('/api/mtd/induction-records/take/', { ...v, quiz_answers: [] }),
    onSuccess:  () => { qc.invalidateQueries(['mtd-inductions']); qc.invalidateQueries(['mtd-compliance']); setModal(null); form.resetFields(); },
  });

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const d = diffDays(r.expiry_date);
    return (
      (!search || (r.emp_name || r.visitor_name || '').toLowerCase().includes(q) || (r.template_name || '').toLowerCase().includes(q)) &&
      (typeFilter === 'all' || String(r.person_type) === typeFilter) &&
      (tmplFilter === 'all' || String(r.template_id) === tmplFilter) &&
      (statusFilter === 'all'
        || (statusFilter === 'valid'    && (d === null || d > 30))
        || (statusFilter === 'expiring' && d !== null && d >= 0 && d <= 30)
        || (statusFilter === 'expired'  && d !== null && d < 0))
    );
  });

  const summary = {
    valid:    records.filter(r => { const d = diffDays(r.expiry_date); return d === null || d > 30; }).length,
    expiring: records.filter(r => { const d = diffDays(r.expiry_date); return d !== null && d >= 0 && d <= 30; }).length,
    expired:  records.filter(r => { const d = diffDays(r.expiry_date); return d !== null && d < 0; }).length,
    passed:   records.filter(r => r.passed).length,
  };

  const avgScore = records.length
    ? Math.round(records.reduce((s, r) => s + (r.score ?? 0), 0) / records.length)
    : 0;

  const columns = [
    { title: 'Personnel', key: 'name', ellipsis: true, width: 190,
      render: (_, r) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#8c8c8c' }} />
          <div>
            <span style={{ fontWeight: 600 }}>{r.emp_name || r.visitor_name || '—'}</span>
            {r.emp_code && <span style={{ color: '#8c8c8c', fontSize: 11 }}> ({r.emp_code})</span>}
          </div>
        </Space>
      )},
    { title: 'Type', key: 'type', width: 90,
      render: (_, r) => <Tag color={r.person_type === 0 ? 'blue' : 'purple'} style={{ fontSize: 11 }}>{r.person_type === 0 ? 'Employee' : 'Visitor'}</Tag> },
    { title: 'Template', dataIndex: 'template_name', key: 'tmpl', ellipsis: true, width: 180, render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Score', key: 'score', width: 100,
      render: (_, r) => {
        const tmpl = templates.find(t => t.id === r.template_id);
        return <ScoreTag score={r.score ?? 0} pass={tmpl?.passing_score ?? 80} />;
      }},
    { title: 'Completed', dataIndex: 'completed_at', key: 'comp', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Expiry', key: 'expiry', width: 155,
      render: (_, r) => (
        <Space size={8}>
          {r.expiry_date ? dayjs(r.expiry_date).format('DD MMM YYYY') : '—'}
          <ExpiryTag date={r.expiry_date} />
        </Space>
      )},
    { title: 'Trainer', dataIndex: 'trainer_name', key: 'trainer', ellipsis: true, width: 130,
      render: v => v || <span style={{ color: '#d9d9d9' }}>—</span> },
    { title: '', key: 'act', width: 50, align: 'center', fixed: 'right',
      render: (_, r) => (
        <Tooltip title="View details">
          <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => { setSelected(r); setModal('view'); }} />
        </Tooltip>
      )},
  ];

  const tabItems = [
    {
      key: 'records',
      label: <span>Induction Records <Tag style={{ marginLeft: 4 }}>{records.length}</Tag></span>,
      children: (
        <div style={{ padding: '14px 0' }}>
          {/* Summary */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {[
              { label: 'Total Records', value: records.length, color: '#1890ff', bg: '#e6f7ff', border: '#91d5ff',  filter: 'all' },
              { label: 'Valid',         value: summary.valid,    color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f',  filter: 'valid' },
              { label: 'Expiring',      value: summary.expiring, color: '#d48806', bg: '#fffbe6', border: '#ffe58f',  filter: 'expiring' },
              { label: 'Expired',       value: summary.expired,  color: '#cf1322', bg: '#fff1f0', border: '#ffa39e',  filter: 'expired' },
              { label: 'Avg Score',     value: `${avgScore}%`,   color: '#722ed1', bg: '#f9f0ff', border: '#d3adf7',  filter: null },
            ].map(s => (
              <Col key={s.label} xs={s.label === 'Avg Score' ? 24 : undefined} flex={s.label === 'Avg Score' ? undefined : 1}>
                <div onClick={() => s.filter && setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
                  style={{ background: statusFilter === s.filter ? s.bg : 'white', border: `1.5px solid ${statusFilter === s.filter ? s.color : '#e8e8e8'}`, borderRadius: 10, padding: '10px 16px', textAlign: 'center', cursor: s.filter ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                  <div style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.value}</div>
                  <div style={{ color: s.color, fontSize: 11, fontWeight: 600 }}>{s.label}</div>
                </div>
              </Col>
            ))}
          </Row>

          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <Input prefix={<SearchOutlined />} placeholder="Search by name or template…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ width: 260 }} allowClear />
            <Select value={tmplFilter} onChange={setTmplFilter} style={{ width: 200 }}>
              <Select.Option value="all">All templates</Select.Option>
              {templates.map(t => <Select.Option key={t.id} value={String(t.id)}>{t.template_name}</Select.Option>)}
            </Select>
            <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 130 }}>
              <Select.Option value="all">All types</Select.Option>
              <Select.Option value="0">Employee</Select.Option>
              <Select.Option value="1">Visitor</Select.Option>
            </Select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries(['mtd-inductions'])}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModal('add'); form.resetFields(); }}>Record Induction</Button>
            </div>
          </div>

          <Table dataSource={filtered} columns={columns} rowKey="id" size="small" loading={isLoading}
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `${t} records` }}
            rowClassName={r => {
              const d = diffDays(r.expiry_date);
              return d !== null && d < 0 ? 'mtd-row-expired' : d !== null && d <= 30 ? 'mtd-row-critical' : '';
            }}
          />
        </div>
      ),
    },
    {
      key: 'templates',
      label: <span>Templates <Tag style={{ marginLeft: 4 }}>{templates.length}</Tag></span>,
      children: <TemplatesTab templates={templates} isLoading={ltpl} qc={qc} />,
    },
  ];

  return (
    <div style={{ padding: '20px 24px' }}>
      <Tabs items={tabItems} size="small" />

      {/* ── Record induction modal ── */}
      <Modal open={modal === 'add'}
        title={<Space><BookOutlined />Record Induction Completion</Space>}
        onCancel={() => { setModal(null); form.resetFields(); }}
        onOk={() => form.validateFields().then(v => saveMut.mutate(v))}
        confirmLoading={saveMut.isPending} width={540} destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="person_type" label="Person Type" rules={[{ required: true }]} initialValue={0}>
                <Select>
                  <Select.Option value={0}>Employee</Select.Option>
                  <Select.Option value={1}>Visitor</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item noStyle shouldUpdate={(p, c) => p.person_type !== c.person_type}>
                {({ getFieldValue }) => (
                  <Form.Item name="emp_id" label={getFieldValue('person_type') === 0 ? 'Employee' : 'Visitor ID'} rules={[{ required: true }]}>
                    {getFieldValue('person_type') === 0
                      ? <Select showSearch optionFilterProp="label"
                          options={empOptions} />
                      : <InputNumber style={{ width: '100%' }} />}
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="template_id" label="Induction Template" rules={[{ required: true }]}>
            <Select options={templates.map(t => ({ value: t.id, label: `${t.template_name} (pass: ${t.passing_score}%)` }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="score" label="Score (%)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trainer_emp_id" label="Trainer (Employee)">
                <Select showSearch optionFilterProp="label" allowClear
                  options={empOptions} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── View induction modal ── */}
      {selected && modal === 'view' && (
        <Modal open title={<Space><BookOutlined />{selected.template_name}</Space>}
          footer={<Button onClick={() => setModal(null)}>Close</Button>}
          onCancel={() => setModal(null)} width={480}
        >
          {(() => {
            const tmpl = templates.find(t => t.id === selected.template_id);
            const pass = tmpl?.passing_score ?? 80;
            return (
              <div style={{ marginTop: 16 }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <Progress type="circle" percent={selected.score ?? 0} size={100}
                    strokeColor={selected.score >= pass ? '#52c41a' : '#ff4d4f'}
                    format={p => <span style={{ fontSize: 18, fontWeight: 800, color: selected.score >= pass ? '#52c41a' : '#ff4d4f' }}>{p}%</span>}
                  />
                  <div style={{ marginTop: 8, fontWeight: 700, color: selected.score >= pass ? '#389e0d' : '#cf1322' }}>
                    {selected.score >= pass ? '✓ PASSED' : '✗ FAILED'} (pass mark: {pass}%)
                  </div>
                </div>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Personnel" span={2}>{selected.emp_name || selected.visitor_name || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Completed">{selected.completed_at ? dayjs(selected.completed_at).format('DD MMM YYYY') : '—'}</Descriptions.Item>
                  <Descriptions.Item label="Expiry"><ExpiryTag date={selected.expiry_date} /></Descriptions.Item>
                  <Descriptions.Item label="Trainer" span={2}>{selected.trainer_name || '—'}</Descriptions.Item>
                </Descriptions>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};

export default SafetyInduction;
