import React, { useState } from 'react';
import {
  Card, Form, Input, Button, message, Alert, Descriptions, Tag, Tabs,
} from 'antd';
import { LogoutOutlined, QrcodeOutlined, CreditCardOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';

const CheckOut = () => {
  const [visitLog, setVisitLog] = useState(null);
  const [form]                  = Form.useForm();
  const qc                      = useQueryClient();

  const checkOutMut = useMutation({
    mutationFn: d => visitorAPI.checkOutVisitor(d),
    onSuccess: () => {
      message.success('Visitor checked out successfully');
      form.resetFields();
      setVisitLog(null);
      qc.invalidateQueries(['visitor-stats']);
      qc.invalidateQueries(['visitor-records']);
    },
    onError: e => message.error(e.response?.data?.detail || e.message),
  });

  const tabItems = [
    {
      key: 'qr',
      label: <span><QrcodeOutlined />QR Code</span>,
      children: (
        <div style={{ maxWidth: 420 }}>
          <Form form={form} layout="vertical"
            onFinish={v => checkOutMut.mutate({ visitor_code: v.code })}>
            <Form.Item name="code" label="Scan QR Code or enter Visitor Code" rules={[{ required: true }]}>
              <Input placeholder="VIS202506001 or QR code value…" size="large" />
            </Form.Item>
            <Button type="primary" icon={<LogoutOutlined />} htmlType="submit" loading={checkOutMut.isPending} block>
              Check Out
            </Button>
          </Form>
        </div>
      ),
    },
    {
      key: 'card',
      label: <span><CreditCardOutlined />Temp Card</span>,
      children: (
        <div style={{ maxWidth: 420 }}>
          <Form layout="vertical"
            onFinish={v => checkOutMut.mutate({ card_no: v.card_no })}>
            <Form.Item name="card_no" label="Temporary Card Number" rules={[{ required: true }]}>
              <Input placeholder="TMP20260524123456…" size="large" />
            </Form.Item>
            <Button type="primary" icon={<LogoutOutlined />} htmlType="submit" loading={checkOutMut.isPending} block>
              Check Out
            </Button>
          </Form>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <Tabs items={tabItems} />
    </Card>
  );
};

export default CheckOut;
