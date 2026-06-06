import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select, DatePicker,
  TimePicker, Checkbox, message, Popconfirm, Tooltip, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, ReloadOutlined, CheckOutlined, CloseOutlined,
  QrcodeOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';
import usePersonnel from '../../../hooks/usePersonnel';

const STATUS_MAP = {
  0: { color: 'gold',    text: 'Pending' },
  1: { color: 'green',   text: 'Approved' },
  2: { color: 'red',     text: 'Rejected' },
  3: { color: 'blue',    text: 'Checked In' },
  4: { color: 'default', text: 'Checked Out' },
  5: { color: 'orange',  text: 'Expired' },
};

const PreRegistration = () => {
  const [modal, setModal]       = useState(false);
  const [qrModal, setQrModal]   = useState(false);
  const [selectedReg, setSelReg] = useState(null);
  const [search, setSearch]     = useState('');
  const [statusFilter, setSF]   = useState(undefined);
  const [form]                  = Form.useForm();
  const qc                      = useQueryClient();
  const inv                     = () => qc.invalidateQueries(['pre-registrations']);

  const { empOptions } = usePersonnel();

  const { data: typesData } = useQuery({
    queryKey: ['visitor-types'],
    queryFn:  () => visitorAPI.getVisitorTypes(),
    staleTime: 60000,
  });
  const typeOptions = (typesData?.data ?? []).map(t => ({ value: t.id, label: t.type_name }));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pre-registrations', search, statusFilter],
    queryFn:  () => visitorAPI.getPreRegistrations({ search, ...(statusFilter !== undefined ? { status: statusFilter } : {}) }),
    staleTime: 20000,
  });
  const rows = data?.data ?? [];

  const createMut = useMutation({
    mutationFn: d => visitorAPI.createPreRegistration(d),
    onSuccess:  () => { message.success('Pre-registration created'); inv(); setModal(false); form.resetFields(); },
    onError:    e => message.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, status, note }) => visitorAPI.approvePreRegistration(id, { status, note }),
    onSuccess:  () => { message.success('Done'); inv(); },
    onError:    e => message.error(e.message),
  });

  const onFinish = v => {
    const payload = {
      visitor_data: {
        full_name:       v.full_name,
        phone:           v.phone,
        email:           v.email,
        company:         v.company,
        id_type:         v.id_type ?? 0,
        id_no:           v.id_no,
        visitor_type_id: v.visitor_type_id ?? null,
      },
      host_emp_id:          v.host_emp_id,
      visit_date:           v.visit_date?.format('YYYY-MM-DD'),
      visit_time_start:     v.visit_time_start?.format('HH:mm'),
      visit_time_end:       v.visit_time_end?.format('HH:mm'),
      purpose:              v.purpose,
      vehicle_no:           v.vehicle_no,
      contractor_visitor:   v.contractor_visitor ?? false,
      safety_induction_done: v.safety_induction_done ?? false,
    };
    createMut.mutate(payload);
  };

  const columns = [
    {
      title: 'Visitor', dataIndex: 'visitor', ellipsis: true,
      render: v => v ? <span><strong>{v.full_name}</strong><br /><small>{v.phone || v.email || ''}</small></span> : '—',
    },
    { title: 'Company', dataIndex: ['visitor', 'company'], width: 130, ellipsis: true, render: v => v || '—' },
    { title: 'Host',    dataIndex: ['host_employee', 'full_name'], width: 140, ellipsis: true, render: v => v || '—' },
    {
      title: 'Visit Date', dataIndex: 'visit_date', width: 110,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    { title: 'Purpose', dataIndex: 'purpose', ellipsis: true, render: v => v || '—' },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: v => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.text ?? v}</Tag>,
    },
    {
      title: '', width: 110,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View QR Code">
            <Button size="small" icon={<QrcodeOutlined />} onClick={() => { setSelReg(r); setQrModal(true); }} />
          </Tooltip>
          {r.status === 0 && (
            <>
              <Tooltip title="Approve">
                <Button size="small" type="primary" icon={<CheckOutlined />}
                  onClick={() => approveMut.mutate({ id: r.id, status: 1, note: '' })} />
              </Tooltip>
              <Tooltip title="Reject">
                <Popconfirm title="Reject this pre-registration?" onConfirm={() => approveMut.mutate({ id: r.id, status: 2, note: '' })} okType="danger">
                  <Button size="small" danger icon={<CloseOutlined />} />
                </Popconfirm>
              </Tooltip>
            </>
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
          placeholder="Search visitor…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="Status"
          value={statusFilter}
          onChange={setSF}
          allowClear
          style={{ width: 140 }}
          options={Object.entries(STATUS_MAP).map(([v, { text }]) => ({ value: Number(v), label: text }))}
        />
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }}>
          New Pre-Registration
        </Button>
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 900 }}
      />

      {/* Create Modal */}
      <Modal
        title="New Pre-Registration"
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="Phone"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="Email"><Input type="email" /></Form.Item></Col>
            <Col span={12}><Form.Item name="company" label="Company"><Input /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="id_type" label="ID Type">
                <Select options={[{ value: 0, label: 'National ID' }, { value: 1, label: 'Passport' }, { value: 2, label: "Driver's Licence" }]} />
              </Form.Item>
            </Col>
            <Col span={12}><Form.Item name="id_no" label="ID Number"><Input /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="visitor_type_id" label="Visitor Type">
                <Select options={typeOptions} allowClear placeholder="Select type…" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="host_emp_id" label="Host Employee" rules={[{ required: true }]}>
                <Select
                  options={empOptions}
                  showSearch
                  filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())}
                  placeholder="Select host…"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="visit_date" label="Visit Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="visit_time_start" label="Start Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="visit_time_end" label="End Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="purpose" label="Purpose of Visit">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={12}><Form.Item name="vehicle_no" label="Vehicle Number"><Input /></Form.Item></Col>
          </Row>

          <Form.Item name="contractor_visitor" valuePropName="checked">
            <Checkbox>Contractor Visitor</Checkbox>
          </Form.Item>
          <Form.Item name="safety_induction_done" valuePropName="checked">
            <Checkbox>Safety Induction Completed</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        title="Visitor QR Code"
        open={qrModal && !!selectedReg}
        onCancel={() => setQrModal(false)}
        footer={[<Button key="close" onClick={() => setQrModal(false)}>Close</Button>]}
        width={360}
        destroyOnHidden
      >
        {selectedReg && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 16 }}>
              <QRCodeSVG value={selectedReg.qr_code || selectedReg.id?.toString()} size={180} />
            </div>
            <div style={{ textAlign: 'left', fontSize: 13 }}>
              <p><strong>Visitor:</strong> {selectedReg.visitor?.full_name}</p>
              <p><strong>Company:</strong> {selectedReg.visitor?.company || '—'}</p>
              <p><strong>Host:</strong> {selectedReg.host_employee?.full_name || '—'}</p>
              <p><strong>Date:</strong> {selectedReg.visit_date ? dayjs(selectedReg.visit_date).format('DD MMM YYYY') : '—'}</p>
              <p><strong>Time:</strong> {selectedReg.visit_time_start || '—'} – {selectedReg.visit_time_end || '—'}</p>
              <p><strong>Purpose:</strong> {selectedReg.purpose || '—'}</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default PreRegistration;
