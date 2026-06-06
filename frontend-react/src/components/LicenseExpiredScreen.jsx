import React, { useState } from 'react';
import { Form, Input, Button, Typography, Alert, Space, Divider, DatePicker } from 'antd';
import { LockOutlined, KeyOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const LicenseExpiredScreen = ({ onUnlocked, onLoginAsAdmin, status }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleActivate = async (values) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: values.key.trim(), new_expiry: values.new_expiry.format('YYYY-MM-DDTHH:mm:ss') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
      setSuccess(data.message);
      setTimeout(() => onUnlocked && onUnlocked(), 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const isNoLicense = status === 'no_license';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '48px 40px',
        width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: isNoLicense ? '#fff7e6' : '#fff1f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <LockOutlined style={{ fontSize: 32, color: isNoLicense ? '#fa8c16' : '#f5222d' }} />
        </div>

        <Title level={3} style={{ marginBottom: 8 }}>
          {isNoLicense ? 'No Active License' : 'License Expired'}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 32 }}>
          {isNoLicense
            ? 'This installation has no active subscription. Contact your vendor to activate.'
            : 'Your annual subscription has expired. Contact your vendor to receive a renewal key.'}
        </Paragraph>

        <Divider>
          <Space>
            <KeyOutlined />
            <Text strong>Enter Renewal Key</Text>
          </Space>
        </Divider>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 16, textAlign: 'left' }} />
        )}
        {success && (
          <Alert message={success} type="success" showIcon style={{ marginBottom: 16, textAlign: 'left' }} />
        )}

        <Form form={form} layout="vertical" onFinish={handleActivate}>
          <Form.Item
            name="key"
            label="Renewal Key"
            rules={[{ required: true, message: 'Enter the renewal key provided by your vendor' }]}
          >
            <Input
              prefix={<SafetyCertificateOutlined />}
              placeholder="POBK-XXXXX-XXXXX-XXXXX-XXXXX"
              size="large"
              style={{ fontFamily: 'monospace', letterSpacing: 1 }}
            />
          </Form.Item>
          <Form.Item
            name="new_expiry"
            label="New Expiry Date & Time"
            rules={[{ required: true, message: 'Select the expiry date & time provided by your vendor' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
              size="large"
              placeholder="Select expiry date & time"
              disabledDate={(d) => d && d < dayjs().startOf('day')}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Activate License
            </Button>
          </Form.Item>
        </Form>

        <Text type="secondary" style={{ fontSize: 12 }}>
          Contact your system vendor to obtain a renewal key.
        </Text>

        <Divider style={{ margin: '20px 0 16px' }} />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
            Are you a Global Admin? Sign in to manage the subscription.
          </Text>
          <Button
            icon={<UserOutlined />}
            onClick={onLoginAsAdmin}
            style={{ borderColor: '#d1d5db', color: '#374151' }}
          >
            Login as Admin
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LicenseExpiredScreen;
