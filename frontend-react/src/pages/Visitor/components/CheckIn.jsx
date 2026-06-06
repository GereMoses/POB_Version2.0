import React, { useState } from 'react';
import {
  Card, Form, Input, Select, Button, message, Alert, Descriptions, Tag, Divider, Row, Col, Tabs,
} from 'antd';
import { LoginOutlined, SearchOutlined, QrcodeOutlined, UserAddOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';
import usePersonnel from '../../../hooks/usePersonnel';

const CheckIn = () => {
  const [preReg, setPreReg]     = useState(null);
  const [walkInForm]            = Form.useForm();
  const [preRegForm]            = Form.useForm();
  const qc                      = useQueryClient();

  const { empOptions } = usePersonnel();

  const { data: typesData } = useQuery({
    queryKey: ['visitor-types'],
    queryFn:  () => visitorAPI.getVisitorTypes(),
    staleTime: 60000,
  });
  const typeOptions = (typesData?.data ?? []).map(t => ({ value: t.id, label: t.type_name }));

  const checkInMut = useMutation({
    mutationFn: d => visitorAPI.checkInVisitor(d),
    onSuccess: () => {
      message.success('Visitor checked in successfully');
      preRegForm.resetFields();
      walkInForm.resetFields();
      setPreReg(null);
      qc.invalidateQueries(['visitor-stats']);
      qc.invalidateQueries(['visitor-records']);
    },
    onError: e => message.error(e.response?.data?.detail || e.message),
  });

  const lookupMut = useMutation({
    mutationFn: qr => visitorAPI.getQRData(qr),
    onSuccess: d => {
      if (d?.data) setPreReg(d.data);
      else message.warning('QR code not found');
    },
    onError: () => message.error('Invalid QR code'),
  });

  const handlePreRegCheckIn = v => {
    if (!preReg) { message.warning('Scan QR code first'); return; }
    checkInMut.mutate({ pre_reg_id: undefined, qr_code: v.qr_code });
  };

  const handleWalkInCheckIn = v => {
    checkInMut.mutate({
      visitor_data: {
        full_name:       v.full_name,
        phone:           v.phone,
        email:           v.email,
        company:         v.company,
        id_type:         v.id_type ?? 0,
        id_no:           v.id_no,
        visitor_type_id: v.visitor_type_id ?? null,
      },
      host_emp_id: v.host_emp_id,
    });
  };

  const preRegTabContent = (
    <div style={{ maxWidth: 500 }}>
      <Form form={preRegForm} layout="vertical" onFinish={handlePreRegCheckIn}>
        <Form.Item name="qr_code" label="QR Code / Pre-Registration Code" rules={[{ required: true }]}>
          <Input.Search
            placeholder="Scan or type QR code…"
            enterButton={<><QrcodeOutlined /> Lookup</>}
            onSearch={v => lookupMut.mutate(v)}
            loading={lookupMut.isPending}
          />
        </Form.Item>
      </Form>

      {preReg && (
        <>
          <Alert type="success" message="Pre-registration found" style={{ marginBottom: 12 }} />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Visitor">{preReg.visitor_name}</Descriptions.Item>
            <Descriptions.Item label="Company">{preReg.company || '—'}</Descriptions.Item>
            <Descriptions.Item label="Host">{preReg.host_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Date">{preReg.visit_date ? dayjs(preReg.visit_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Time">{preReg.visit_time_start} – {preReg.visit_time_end}</Descriptions.Item>
            <Descriptions.Item label="Purpose">{preReg.purpose || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color={preReg.status === 1 ? 'green' : 'gold'}>{preReg.status === 1 ? 'Approved' : 'Pending'}</Tag></Descriptions.Item>
          </Descriptions>
          <Button
            type="primary"
            icon={<LoginOutlined />}
            style={{ marginTop: 16 }}
            loading={checkInMut.isPending}
            onClick={() => checkInMut.mutate({ pre_reg_id: undefined, qr_code: preReg.qr_code })}
            block
          >
            Confirm Check-In
          </Button>
        </>
      )}
    </div>
  );

  const walkInTabContent = (
    <div style={{ maxWidth: 560 }}>
      <Form form={walkInForm} layout="vertical" onFinish={handleWalkInCheckIn}
        initialValues={{ id_type: 0 }}>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="phone" label="Phone"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="email" label="Email"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="company" label="Company"><Input /></Form.Item></Col>
          <Col span={12}>
            <Form.Item name="id_type" label="ID Type">
              <Select options={[{ value: 0, label: 'National ID' }, { value: 1, label: 'Passport' }, { value: 2, label: "Driver's Licence" }]} />
            </Form.Item>
          </Col>
          <Col span={12}><Form.Item name="id_no" label="ID Number"><Input /></Form.Item></Col>
          <Col span={12}>
            <Form.Item name="visitor_type_id" label="Visitor Type">
              <Select options={typeOptions} allowClear />
            </Form.Item>
          </Col>
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
        </Row>
        <Button type="primary" icon={<LoginOutlined />} htmlType="submit" loading={checkInMut.isPending} block>
          Check In (Walk-in)
        </Button>
      </Form>
    </div>
  );

  return (
    <Card>
      <Tabs
        items={[
          { key: 'pre-reg', label: <span><QrcodeOutlined />Pre-Registered Visitor</span>, children: preRegTabContent },
          { key: 'walk-in', label: <span><UserAddOutlined />Walk-in Visitor</span>,      children: walkInTabContent },
        ]}
      />
    </Card>
  );
};

export default CheckIn;
