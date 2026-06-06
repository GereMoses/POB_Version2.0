import React, { useState } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select,
  DatePicker, InputNumber, Row, Col, Tooltip, Popconfirm, Descriptions,
} from 'antd';
import {
  PlusOutlined, EditOutlined, EyeOutlined, UserOutlined,
  SearchOutlined, ReloadOutlined, MedicineBoxOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import usePersonnel from '../../../hooks/usePersonnel';
import dayjs from 'dayjs';

const FIT = {
  0: { label: 'Fit',        color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f' },
  1: { label: 'Restricted', color: '#d48806', bg: '#fffbe6', border: '#ffe58f' },
  2: { label: 'Unfit',      color: '#cf1322', bg: '#fff1f0', border: '#ffa39e' },
};
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

const dueDays = d => d ? dayjs(d).diff(dayjs(), 'day') : null;

const DueCell = ({ date }) => {
  if (!date) return <span style={{ color: '#bfbfbf' }}>—</span>;
  const d = dueDays(date);
  const color = d < 0 ? '#cf1322' : d <= 30 ? '#d48806' : '#389e0d';
  const label = d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`;
  return (
    <span style={{ color, fontWeight: d <= 30 ? 700 : 400 }}>
      {dayjs(date).format('DD MMM YYYY')}
      {d <= 60 && <span style={{ marginLeft: 4, fontSize: 10 }}>({label})</span>}
    </span>
  );
};

const MedicalRecords = () => {
  const qc = useQueryClient();
  const [search,     setSearch]     = useState('');
  const [fitFilter,  setFitFilter]  = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal,      setModal]      = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [form] = Form.useForm();

  const { data: recData, isLoading } = useQuery({
    queryKey: ['mtd-medical'],
    queryFn:  () => apiService.get('/api/mtd/medical/'),
  });
  const { empOptions } = usePersonnel();

  const records = recData?.data?.data ?? recData?.data ?? [];

  const saveMut = useMutation({
    mutationFn: v => modal === 'add'
      ? apiService.post('/api/mtd/medical/', v)
      : apiService.put(`/api/mtd/medical/${selected.id}/`, v),
    onSuccess: () => { qc.invalidateQueries(['mtd-medical']); qc.invalidateQueries(['mtd-compliance']); closeModal(); },
  });

  const closeModal = () => { setModal(null); setSelected(null); form.resetFields(); };

  const openEdit = r => {
    setSelected(r);
    setModal('edit');
    form.setFieldsValue({
      ...r,
      last_checkup: r.last_checkup ? dayjs(r.last_checkup) : null,
      next_due:     r.next_due     ? dayjs(r.next_due)     : null,
    });
  };

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (
      (!search || (r.emp_name || r.visitor_name || '').toLowerCase().includes(q)) &&
      (fitFilter  === 'all' || String(r.fit_status)  === fitFilter)  &&
      (typeFilter === 'all' || String(r.person_type) === typeFilter)
    );
  });

  const columns = [
    { title: 'Personnel', key: 'name', ellipsis: true, width: 190,
      render: (_, r) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#8c8c8c' }} />
          <span style={{ fontWeight: 600 }}>{r.emp_name || r.visitor_name || '—'}</span>
          {r.emp_code && <span style={{ color: '#8c8c8c', fontSize: 11 }}>({r.emp_code})</span>}
        </Space>
      )},
    { title: 'Type', key: 'type', width: 90,
      render: (_, r) => <Tag color={r.person_type === 0 ? 'blue' : 'purple'} style={{ fontSize: 11 }}>{r.person_type === 0 ? 'Employee' : 'Visitor'}</Tag> },
    { title: 'Blood Grp', dataIndex: 'blood_group', key: 'bg', width: 80, align: 'center',
      render: v => v ? <Tag color="blue" style={{ fontWeight: 700 }}>{v}</Tag> : <span style={{ color: '#d9d9d9' }}>—</span> },
    { title: 'Fit Status', key: 'fit', width: 105,
      render: (_, r) => {
        const f = FIT[r.fit_status] ?? FIT[0];
        return <Tag style={{ color: f.color, background: f.bg, borderColor: f.border, fontWeight: 700 }}>{f.label}</Tag>;
      }},
    { title: 'Last Checkup', dataIndex: 'last_checkup', key: 'last', width: 130,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : <span style={{ color: '#d9d9d9' }}>—</span> },
    { title: 'Next Due', key: 'due', width: 155,
      render: (_, r) => <DueCell date={r.next_due} /> },
    { title: 'Doctor', dataIndex: 'doctor_name', key: 'dr', ellipsis: true, width: 130 },
    { title: 'Conditions', dataIndex: 'medical_conditions', key: 'cond', ellipsis: true },
    { title: '', key: 'act', width: 70, align: 'center', fixed: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="View details">
            <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => { setSelected(r); setModal('view'); }} />
          </Tooltip>
          <Tooltip title="Edit record">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
        </Space>
      )},
  ];

  /* Summary counts */
  const counts = Object.entries(FIT).map(([k, v]) => ({
    ...v, count: records.filter(r => String(r.fit_status) === k).length, key: k,
  }));

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Summary chips */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {counts.map(c => (
          <Col key={c.key} xs={8}>
            <div
              onClick={() => setFitFilter(fitFilter === c.key ? 'all' : c.key)}
              style={{
                background: fitFilter === c.key ? c.bg : 'white',
                border: `1.5px solid ${fitFilter === c.key ? c.color : '#e8e8e8'}`,
                borderRadius: 10, padding: '10px 16px', textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ color: c.color, fontSize: 22, fontWeight: 800 }}>{c.count}</div>
              <div style={{ color: c.color, fontSize: 11, fontWeight: 600 }}>{c.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input prefix={<SearchOutlined />} placeholder="Search by name…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 240 }} allowClear />
        <Select value={fitFilter} onChange={setFitFilter} style={{ width: 140 }}>
          <Select.Option value="all">All Fit Status</Select.Option>
          {counts.map(c => <Select.Option key={c.key} value={c.key}>{c.label} ({c.count})</Select.Option>)}
        </Select>
        <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 130 }}>
          <Select.Option value="all">All Types</Select.Option>
          <Select.Option value="0">Employee</Select.Option>
          <Select.Option value="1">Visitor</Select.Option>
        </Select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries(['mtd-medical'])}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModal('add'); form.resetFields(); }}>
            Add Record
          </Button>
        </div>
      </div>

      <Table
        dataSource={filtered} columns={columns} rowKey="id" size="small" loading={isLoading}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `${t} records` }}
        rowClassName={r => {
          const d = dueDays(r.next_due);
          return d !== null && d < 0 ? 'mtd-row-expired' : d !== null && d <= 30 ? 'mtd-row-critical' : '';
        }}
      />

      {/* ── Add / Edit modal ── */}
      <Modal
        open={modal === 'add' || modal === 'edit'}
        title={<Space><MedicineBoxOutlined />{modal === 'add' ? 'Add Medical Record' : 'Edit Medical Record'}</Space>}
        onCancel={closeModal}
        onOk={() => form.validateFields().then(v => saveMut.mutate({
          ...v,
          last_checkup: v.last_checkup?.format('YYYY-MM-DD') ?? null,
          next_due:     v.next_due?.format('YYYY-MM-DD')     ?? null,
        }))}
        confirmLoading={saveMut.isPending}
        width={640}
        destroyOnHidden
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
                {({ getFieldValue }) => getFieldValue('person_type') === 0 ? (
                  <Form.Item name="emp_id" label="Employee">
                    <Select showSearch optionFilterProp="label"
                      options={empOptions} />
                  </Form.Item>
                ) : (
                  <Form.Item name="visitor_id" label="Visitor ID">
                    <InputNumber style={{ width: '100%' }} min={1} />
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="blood_group" label="Blood Group">
                <Select allowClear>{BLOOD_GROUPS.map(g => <Select.Option key={g} value={g}>{g}</Select.Option>)}</Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="height_cm" label="Height (cm)">
                <InputNumber style={{ width: '100%' }} min={50} max={250} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="weight_kg" label="Weight (kg)">
                <InputNumber style={{ width: '100%' }} min={10} max={400} step={0.5} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="fit_status" label="Fit Status" initialValue={0}>
                <Select>
                  <Select.Option value={0}>Fit for work</Select.Option>
                  <Select.Option value={1}>Restricted duties</Select.Option>
                  <Select.Option value={2}>Unfit for work</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="doctor_name" label="Doctor / Examiner">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="last_checkup" label="Last Checkup Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="next_due" label="Next Due Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="medical_conditions" label="Medical Conditions">
            <Input.TextArea rows={2} placeholder="e.g. hypertension, diabetes…" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="allergies" label="Allergies">
                <Input placeholder="e.g. penicillin, latex…" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="restrictions" label="Work Restrictions">
                <Input placeholder="e.g. no confined space, limited heights…" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="disabilities" label="Disabilities / Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── View modal ── */}
      {selected && modal === 'view' && (
        <Modal
          open
          title={<Space><MedicineBoxOutlined style={{ color: '#1890ff' }} />{selected.emp_name || selected.visitor_name || 'Medical Record'}</Space>}
          footer={[
            <Button key="edit" type="primary" onClick={() => openEdit(selected)}>Edit</Button>,
            <Button key="close" onClick={() => setModal(null)}>Close</Button>,
          ]}
          onCancel={() => setModal(null)}
          width={560}
        >
          <Descriptions bordered size="small" column={2} style={{ marginTop: 16 }}>
            <Descriptions.Item label="Fit Status" span={2}>
              {(() => { const f = FIT[selected.fit_status] ?? FIT[0]; return <Tag style={{ color: f.color, background: f.bg, borderColor: f.border, fontWeight: 700 }}>{f.label}</Tag>; })()}
            </Descriptions.Item>
            <Descriptions.Item label="Blood Group">{selected.blood_group || '—'}</Descriptions.Item>
            <Descriptions.Item label="Doctor">{selected.doctor_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Height">{selected.height_cm ? `${selected.height_cm} cm` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Weight">{selected.weight_kg ? `${selected.weight_kg} kg` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Last Checkup">{selected.last_checkup ? dayjs(selected.last_checkup).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Next Due">
              <DueCell date={selected.next_due} />
            </Descriptions.Item>
            <Descriptions.Item label="Medical Conditions" span={2}>{selected.medical_conditions || 'None'}</Descriptions.Item>
            <Descriptions.Item label="Allergies" span={2}>{selected.allergies || 'None'}</Descriptions.Item>
            <Descriptions.Item label="Restrictions" span={2}>{selected.restrictions || 'None'}</Descriptions.Item>
            <Descriptions.Item label="Disabilities" span={2}>{selected.disabilities || 'None'}</Descriptions.Item>
          </Descriptions>
        </Modal>
      )}
    </div>
  );
};

export default MedicalRecords;
