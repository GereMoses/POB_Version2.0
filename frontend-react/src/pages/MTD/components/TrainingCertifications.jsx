import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker,
  Row, Col, Tooltip, Popconfirm, Tabs, Switch, InputNumber, Descriptions, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, EyeOutlined, UserOutlined, SearchOutlined,
  ReloadOutlined, SafetyCertificateOutlined, DeleteOutlined, StarOutlined,
  WarningOutlined, CheckCircleOutlined, TableOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import usePersonnel from '../../../hooks/usePersonnel';
import dayjs from 'dayjs';

const diffDays = d => d ? dayjs(d).diff(dayjs(), 'day') : null;

const StatusTag = ({ days }) => {
  if (days === null) return <Tag color="default">No date</Tag>;
  if (days < 0)    return <Tag color="red"    style={{ fontWeight: 700 }}>Expired {Math.abs(days)}d ago</Tag>;
  if (days <= 7)   return <Tag color="red"    style={{ fontWeight: 700 }}>{days}d left</Tag>;
  if (days <= 30)  return <Tag color="orange"                            >{days}d left</Tag>;
  if (days <= 90)  return <Tag color="gold"                              >{days}d left</Tag>;
  return               <Tag color="green"                                >Valid</Tag>;
};

/* ─── Compliance Matrix view ─────────────────────────────────── */
const MatrixView = ({ certs, certTypes, personnel }) => {
  const [search, setSearch] = useState('');

  const empMap = useMemo(() => {
    const m = {};
    certs.filter(c => c.person_type === 0).forEach(c => {
      if (!m[c.emp_id]) m[c.emp_id] = { emp_id: c.emp_id, emp_name: c.emp_name, emp_code: c.emp_code, certs: {} };
      m[c.emp_id].certs[c.cert_type_id] = c;
    });
    return m;
  }, [certs]);

  const rows = useMemo(() => {
    const all = Object.values(empMap);
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter(r => (r.emp_name || '').toLowerCase().includes(q) || (r.emp_code || '').toLowerCase().includes(q));
  }, [empMap, search]);

  if (!certTypes.length) return <div style={{ padding: 40, textAlign: 'center', color: '#8c8c8c' }}>No certification types configured.</div>;

  const cols = [
    { title: 'Personnel', key: 'name', fixed: 'left', width: 180,
      render: (_, r) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#8c8c8c' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.emp_name}</div>
            {r.emp_code && <div style={{ color: '#8c8c8c', fontSize: 10 }}>{r.emp_code}</div>}
          </div>
        </Space>
      )},
    ...certTypes.map(ct => ({
      title: (
        <div style={{ textAlign: 'center', maxWidth: 90, wordBreak: 'break-word', fontSize: 11, lineHeight: 1.3 }}>
          {ct.is_critical && <StarOutlined style={{ color: '#fa8c16', marginRight: 3 }} />}
          {ct.cert_name}
        </div>
      ),
      key: `ct_${ct.id}`, width: 100, align: 'center',
      render: (_, r) => {
        const c = r.certs[ct.id];
        if (!c) return <span style={{ color: '#d9d9d9', fontSize: 18 }}>○</span>;
        const d = diffDays(c.expiry_date);
        const color = d === null ? '#595959' : d < 0 ? '#ff4d4f' : d <= 30 ? '#fa8c16' : '#52c41a';
        return (
          <Tooltip title={`${dayjs(c.issue_date).format('DD MMM YYYY')} → ${c.expiry_date ? dayjs(c.expiry_date).format('DD MMM YYYY') : 'No expiry'}`}>
            <span style={{ color, fontSize: 18, cursor: 'default' }}>{d !== null && d < 0 ? '✗' : '✓'}</span>
          </Tooltip>
        );
      },
    })),
  ];

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ marginBottom: 12 }}>
        <Input prefix={<SearchOutlined />} placeholder="Search personnel…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 240 }} allowClear />
        <span style={{ marginLeft: 12, color: '#8c8c8c', fontSize: 12 }}>
          <StarOutlined style={{ color: '#fa8c16' }} /> = Critical certification
          &nbsp;·&nbsp; ✓ = Valid &nbsp;·&nbsp; ✗ = Expired &nbsp;·&nbsp; ○ = Not held
        </span>
      </div>
      <Table
        dataSource={rows} columns={cols} rowKey="emp_id" size="small"
        scroll={{ x: 180 + certTypes.length * 100, y: 500 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} people` }}
      />
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────── */
const TrainingCertifications = () => {
  const qc = useQueryClient();
  const [viewMode,     setViewMode]     = useState('list');
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [critFilter,   setCritFilter]   = useState(false);
  const [certModal,    setCertModal]    = useState(null);
  const [typeModal,    setTypeModal]    = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [certForm]    = Form.useForm();
  const [typeForm]    = Form.useForm();

  const { data: certData, isLoading } = useQuery({ queryKey: ['mtd-certs'],      queryFn: () => apiService.get('/api/mtd/certifications/') });
  const { data: ctData  }             = useQuery({ queryKey: ['mtd-cert-types'], queryFn: () => apiService.get('/api/mtd/cert-types/') });
  const { personnel, empOptions, getById: getPersonnelById } = usePersonnel();

  const certs     = certData?.data?.data ?? certData?.data ?? [];
  const certTypes = ctData?.data?.data   ?? ctData?.data   ?? [];

  const saveCert = useMutation({
    mutationFn: v => certModal === 'add'
      ? apiService.post('/api/mtd/certifications/', v)
      : apiService.put(`/api/mtd/certifications/${selected.id}/`, v),
    onSuccess: () => { qc.invalidateQueries(['mtd-certs']); qc.invalidateQueries(['mtd-compliance']); setCertModal(null); certForm.resetFields(); setSelected(null); },
  });

  const deleteCert = useMutation({
    mutationFn: id => apiService.delete(`/api/mtd/certifications/${id}`),
    onSuccess: () => { qc.invalidateQueries(['mtd-certs']); },
  });

  const saveType = useMutation({
    mutationFn: v => typeModal === 'add'
      ? apiService.post('/api/mtd/cert-types/', v)
      : apiService.put(`/api/mtd/cert-types/${selected?.id}/`, v),
    onSuccess: () => { qc.invalidateQueries(['mtd-cert-types']); setTypeModal(null); typeForm.resetFields(); setSelected(null); },
  });

  const filtered = certs.filter(c => {
    const d = diffDays(c.expiry_date);
    const statusOk = statusFilter === 'all'
      || (statusFilter === 'valid'   && d !== null && d > 30)
      || (statusFilter === 'expiring' && d !== null && d >= 0 && d <= 30)
      || (statusFilter === 'expired'  && d !== null && d < 0)
      || (statusFilter === 'nodate'   && d === null);
    const q = search.toLowerCase();
    return (
      (!search  || (c.emp_name || c.visitor_name || '').toLowerCase().includes(q) || (c.cert_type_name || '').toLowerCase().includes(q)) &&
      statusOk  &&
      (typeFilter === 'all' || String(c.cert_type_id) === typeFilter) &&
      (!critFilter || c.is_critical)
    );
  });

  const listColumns = [
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
    { title: 'Certification', key: 'cert', ellipsis: true, width: 200,
      render: (_, r) => (
        <Space size={6}>
          {r.is_critical && <StarOutlined style={{ color: '#fa8c16' }} />}
          <span style={{ fontWeight: r.is_critical ? 700 : 400 }}>{r.cert_type_name || '—'}</span>
        </Space>
      )},
    { title: 'Cert No.', dataIndex: 'cert_no', key: 'no', width: 120,
      render: v => v || <span style={{ color: '#d9d9d9' }}>—</span> },
    { title: 'Issuer', dataIndex: 'issuer', key: 'issuer', ellipsis: true, width: 130 },
    { title: 'Issue Date', dataIndex: 'issue_date', key: 'issue', width: 115,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    { title: 'Expiry', dataIndex: 'expiry_date', key: 'expiry', width: 115,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : <span style={{ color: '#d9d9d9' }}>No expiry</span> },
    { title: 'Status', key: 'status', width: 130,
      render: (_, r) => <StatusTag days={diffDays(r.expiry_date)} /> },
    { title: '', key: 'act', width: 70, align: 'center', fixed: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="View"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => { setSelected(r); setCertModal('view'); }} /></Tooltip>
          <Tooltip title="Edit"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => {
            setSelected(r); setCertModal('edit');
            certForm.setFieldsValue({ ...r, issue_date: r.issue_date ? dayjs(r.issue_date) : null });
          }} /></Tooltip>
          <Popconfirm title="Delete this certification?" onConfirm={() => deleteCert.mutate(r.id)} okType="danger" okText="Delete">
            <Tooltip title="Delete"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )},
  ];

  /* Summary counters */
  const summary = {
    valid:    certs.filter(c => { const d = diffDays(c.expiry_date); return d === null || d > 30; }).length,
    expiring: certs.filter(c => { const d = diffDays(c.expiry_date); return d !== null && d >= 0 && d <= 30; }).length,
    expired:  certs.filter(c => { const d = diffDays(c.expiry_date); return d !== null && d < 0; }).length,
    critical: certs.filter(c => c.is_critical).length,
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Summary chips */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { key: 'valid',    label: 'Valid',    value: summary.valid,    color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f', filter: 'valid' },
          { key: 'expiring', label: 'Expiring', value: summary.expiring, color: '#d48806', bg: '#fffbe6', border: '#ffe58f', filter: 'expiring' },
          { key: 'expired',  label: 'Expired',  value: summary.expired,  color: '#cf1322', bg: '#fff1f0', border: '#ffa39e', filter: 'expired' },
          { key: 'critical', label: 'Critical', value: summary.critical, color: '#d46b08', bg: '#fff7e6', border: '#ffd591', filter: null },
        ].map(s => (
          <Col key={s.key} xs={6}>
            <div
              onClick={() => s.filter && setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
              style={{
                background: statusFilter === s.filter ? s.bg : 'white',
                border: `1.5px solid ${statusFilter === s.filter ? s.color : '#e8e8e8'}`,
                borderRadius: 10, padding: '10px 16px', textAlign: 'center',
                cursor: s.filter ? 'pointer' : 'default', transition: 'all 0.15s',
              }}
            >
              <div style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: s.color, fontSize: 11, fontWeight: 600 }}>{s.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input prefix={<SearchOutlined />} placeholder="Search name or cert…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 240 }} allowClear />
        <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 180 }} placeholder="All cert types">
          <Select.Option value="all">All cert types</Select.Option>
          {certTypes.map(ct => <Select.Option key={ct.id} value={String(ct.id)}>{ct.cert_name}</Select.Option>)}
        </Select>
        <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 130 }}>
          <Select.Option value="all">All status</Select.Option>
          <Select.Option value="valid">Valid</Select.Option>
          <Select.Option value="expiring">Expiring soon</Select.Option>
          <Select.Option value="expired">Expired</Select.Option>
        </Select>
        <Space size={6}>
          <StarOutlined style={{ color: '#fa8c16' }} />
          <span style={{ fontSize: 12, color: '#595959' }}>Critical only</span>
          <Switch size="small" checked={critFilter} onChange={setCritFilter} />
        </Space>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button.Group>
            <Button icon={<AppstoreOutlined />} type={viewMode === 'list'   ? 'primary' : 'default'} onClick={() => setViewMode('list')}>List</Button>
            <Button icon={<TableOutlined />}    type={viewMode === 'matrix' ? 'primary' : 'default'} onClick={() => setViewMode('matrix')}>Matrix</Button>
          </Button.Group>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries(['mtd-certs'])}>Refresh</Button>
          <Button onClick={() => { setSelected(null); setTypeModal('add'); typeForm.resetFields(); }}>Manage Cert Types</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCertModal('add'); certForm.resetFields(); }}>Add Certification</Button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <Table dataSource={filtered} columns={listColumns} rowKey="id" size="small" loading={isLoading}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `${t} certifications` }}
          rowClassName={r => {
            const d = diffDays(r.expiry_date);
            return d !== null && d < 0 ? 'mtd-row-expired' : d !== null && d <= 30 ? 'mtd-row-critical' : '';
          }}
        />
      ) : (
        <MatrixView certs={certs} certTypes={certTypes} personnel={personnel} />
      )}

      {/* ── Add/Edit cert modal ── */}
      <Modal open={certModal === 'add' || certModal === 'edit'}
        title={<Space><SafetyCertificateOutlined />{certModal === 'add' ? 'Add Certification' : 'Edit Certification'}</Space>}
        onCancel={() => { setCertModal(null); certForm.resetFields(); setSelected(null); }}
        onOk={() => certForm.validateFields().then(v => saveCert.mutate({
          ...v,
          issue_date: v.issue_date?.format('YYYY-MM-DD') ?? null,
        }))}
        confirmLoading={saveCert.isPending}
        width={560} destroyOnHidden
      >
        <Form form={certForm} layout="vertical" style={{ marginTop: 16 }}>
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
              <Form.Item noStyle shouldUpdate={(p, c) => p.person_type !== c.person_type || p.emp_id !== c.emp_id}>
                {({ getFieldValue }) => (
                  <Form.Item name="emp_id" label={getFieldValue('person_type') === 0 ? 'Employee' : 'Visitor ID'} rules={[{ required: true }]}>
                    {getFieldValue('person_type') === 0
                      ? <Select showSearch optionFilterProp="label" options={empOptions} />
                      : <InputNumber style={{ width: '100%' }} />}
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>

          {/* Position-based cert requirement hints */}
          <Form.Item noStyle shouldUpdate={(p, c) => p.emp_id !== c.emp_id || p.person_type !== c.person_type}>
            {({ getFieldValue }) => {
              const empId = getFieldValue('emp_id');
              const personType = getFieldValue('person_type');
              if (personType !== 0 || !empId) return null;

              const emp = getPersonnelById(empId);
              const empCertTypeIds = new Set(
                certs.filter(c => c.emp_id === empId).map(c => c.cert_type_id)
              );
              const criticalRequired = certTypes.filter(ct => ct.is_critical && !empCertTypeIds.has(ct.id));
              const alreadyHas = certTypes.filter(ct => empCertTypeIds.has(ct.id));

              if (!emp && criticalRequired.length === 0) return null;

              return (
                <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                  {emp && (
                    <div style={{ fontSize: 11, color: '#595959', marginBottom: 6 }}>
                      <strong>{emp.emp_code}</strong> · {emp.role || emp.position || 'No role set'} · {emp.department || 'No dept'}
                    </div>
                  )}
                  {criticalRequired.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#d48806' }}>⭐ Critical certs missing: </span>
                      <Space size={4} wrap>
                        {criticalRequired.map(ct => (
                          <Tag
                            key={ct.id} color="orange" style={{ fontSize: 10, cursor: 'pointer' }}
                            onClick={() => certForm.setFieldValue('cert_type_id', ct.id)}
                          >
                            {ct.cert_name}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  )}
                  {alreadyHas.length > 0 && (
                    <div>
                      <span style={{ fontSize: 11, color: '#389e0d' }}>✓ Already has: </span>
                      <Space size={4} wrap>
                        {alreadyHas.map(ct => <Tag key={ct.id} color="green" style={{ fontSize: 10 }}>{ct.cert_name}</Tag>)}
                      </Space>
                    </div>
                  )}
                </div>
              );
            }}
          </Form.Item>

          <Form.Item name="cert_type_id" label="Certification Type" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={certTypes.map(ct => ({ value: ct.id, label: `${ct.is_critical ? '⭐ ' : ''}${ct.cert_name}` }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="cert_no" label="Certificate No."><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="issuer" label="Issuing Authority"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="issue_date" label="Issue Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── View cert modal ── */}
      {selected && certModal === 'view' && (
        <Modal open title={<Space><SafetyCertificateOutlined />{selected.cert_type_name}</Space>}
          footer={<Button onClick={() => setCertModal(null)}>Close</Button>}
          onCancel={() => setCertModal(null)} width={480}>
          <Descriptions bordered size="small" column={2} style={{ marginTop: 16 }}>
            <Descriptions.Item label="Personnel" span={2}>{selected.emp_name || selected.visitor_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Certificate No.">{selected.cert_no || '—'}</Descriptions.Item>
            <Descriptions.Item label="Issuer">{selected.issuer || '—'}</Descriptions.Item>
            <Descriptions.Item label="Issue Date">{selected.issue_date ? dayjs(selected.issue_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Expiry Date">
              {selected.expiry_date ? (
                <Space>{dayjs(selected.expiry_date).format('DD MMM YYYY')}<StatusTag days={diffDays(selected.expiry_date)} /></Space>
              ) : 'No expiry'}
            </Descriptions.Item>
            <Descriptions.Item label="Critical" span={2}>{selected.is_critical ? <Tag color="orange" icon={<StarOutlined />}>Critical</Tag> : 'No'}</Descriptions.Item>
          </Descriptions>
        </Modal>
      )}

      {/* ── Cert type modal ── */}
      <Modal open={typeModal === 'add' || typeModal === 'edit'}
        title={<Space><StarOutlined />{typeModal === 'add' ? 'Add Certification Type' : 'Edit Certification Type'}</Space>}
        onCancel={() => { setTypeModal(null); typeForm.resetFields(); setSelected(null); }}
        onOk={() => typeForm.validateFields().then(v => saveType.mutate(v))}
        confirmLoading={saveType.isPending}
        width={480} destroyOnHidden
      >
        <Form form={typeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="cert_name" label="Certification Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="validity_days" label="Validity (days)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} placeholder="e.g. 365 for 1 year" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="is_critical" label="Critical Cert?" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description / Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
        {/* Existing cert types list */}
        {certTypes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: '#595959', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Existing Types</div>
            {certTypes.map(ct => (
              <div key={ct.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: '#fafafa', marginBottom: 4 }}>
                <Space size={6}>
                  {ct.is_critical && <StarOutlined style={{ color: '#fa8c16' }} />}
                  <span style={{ fontSize: 13, fontWeight: ct.is_critical ? 700 : 400 }}>{ct.cert_name}</span>
                  <span style={{ color: '#8c8c8c', fontSize: 11 }}>{ct.validity_days}d validity</span>
                </Space>
                <Space size={4}>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => {
                    setSelected(ct); setTypeModal('edit');
                    typeForm.setFieldsValue({ cert_name: ct.cert_name, validity_days: ct.validity_days, is_critical: ct.is_critical, description: ct.description });
                  }} />
                  <Popconfirm title="Delete this cert type?" onConfirm={() => apiService.delete(`/api/mtd/cert-types/${ct.id}`).then(() => qc.invalidateQueries(['mtd-cert-types']))} okType="danger">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TrainingCertifications;
