/**
 * Visitor Self-Check-In Kiosk
 * Tablet-mode, full-screen, no authentication required.
 * Mount on public route /visitor/kiosk (unprotected).
 */
import React, { useState, useEffect } from 'react';
import {
  Form, Input, Button, Select, Space, Card, Typography, Result, Steps, message,
} from 'antd';
import {
  UserOutlined, PhoneOutlined, MailOutlined, HomeOutlined,
  IdcardOutlined, CheckCircleOutlined, ArrowRightOutlined, ReloadOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const STEP_FORM = 0;
const STEP_SUCCESS = 1;

const PRIMARY = '#0078D4';

const Kiosk = () => {
  const [form]    = Form.useForm();
  const [step,    setStep]    = useState(STEP_FORM);
  const [loading, setLoading] = useState(false);
  const [types,   setTypes]   = useState([]);
  const [result,  setResult]  = useState(null);
  const [clock,   setClock]   = useState('');

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Load visitor types
  useEffect(() => {
    fetch('/api/visitor/kiosk/types')
      .then(r => r.json())
      .then(d => setTypes(d.types || []))
      .catch(() => {});
  }, []);

  const handleCheckIn = async (values) => {
    setLoading(true);
    try {
      const res = await fetch('/api/visitor/kiosk/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
        message.warning(
          `Too many check-in requests. Please wait ${retryAfter} seconds and try again.`,
          retryAfter,
        );
        // fall through to finally so loading state is always reset
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Check-in failed');
      setResult(data);
      setStep(STEP_SUCCESS);
    } catch (e) {
      message.error(e.message || 'Check-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    form.resetFields();
    setStep(STEP_FORM);
    setResult(null);
  };

  // Auto-reset after 10 s on success screen
  useEffect(() => {
    if (step === STEP_SUCCESS) {
      const id = setTimeout(reset, 10000);
      return () => clearTimeout(id);
    }
  }, [step]);

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #0078D4 0%, #004A8F 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px', fontFamily: "'Segoe UI', -apple-system, sans-serif",
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏢</div>
        <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 800 }}>
          Visitor Self Check-In
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>
          Welcome — please complete the form below
        </Text>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>{clock}</div>
      </div>

      {step === STEP_FORM ? (
        <Card
          style={{
            width: '100%', maxWidth: 560, borderRadius: 16,
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          }}
          styles={{ body: { padding: '32px 36px' } }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCheckIn}
            size="large"
          >
            <Title level={4} style={{ margin: '0 0 20px', color: '#1F2937' }}>
              Your Information
            </Title>

            <Form.Item
              name="first_name"
              label="First Name"
              rules={[{ required: true, message: 'Please enter your first name' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="John" autoFocus />
            </Form.Item>

            <Form.Item name="last_name" label="Last Name">
              <Input prefix={<UserOutlined />} placeholder="Doe" />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Phone Number"
              rules={[{ required: true, message: 'Phone number is required' }]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="+234 800 000 0000" />
            </Form.Item>

            <Form.Item name="email" label="Email (optional)">
              <Input prefix={<MailOutlined />} placeholder="john@company.com" />
            </Form.Item>

            <Form.Item name="company" label="Company / Organisation">
              <Input prefix={<HomeOutlined />} placeholder="Acme Ltd" />
            </Form.Item>

            <Form.Item name="id_number" label="ID / Passport Number">
              <Input prefix={<IdcardOutlined />} placeholder="A12345678" />
            </Form.Item>

            <Form.Item name="visitor_type" label="Visit Type" initialValue="Walk-in">
              <Select placeholder="Select visit type">
                {types.length > 0
                  ? types.map(t => <Option key={t.id} value={t.name}>{t.name}</Option>)
                  : ['Walk-in', 'Contractor', 'Delivery', 'Business Meeting', 'Inspection'].map(t =>
                      <Option key={t} value={t}>{t}</Option>
                    )
                }
              </Select>
            </Form.Item>

            <Form.Item name="host_name" label="Person You Are Visiting">
              <Input placeholder="e.g. John Smith" />
            </Form.Item>

            <Form.Item name="purpose" label="Purpose of Visit">
              <Input.TextArea rows={2} placeholder="Briefly describe the purpose of your visit..." />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                size="large"
                icon={<ArrowRightOutlined />}
                style={{
                  height: 52, fontSize: 16, fontWeight: 700,
                  background: PRIMARY, borderColor: PRIMARY, borderRadius: 8,
                }}
              >
                CHECK IN
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ) : (
        <Card
          style={{
            width: '100%', maxWidth: 480, borderRadius: 16,
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)', textAlign: 'center',
          }}
          styles={{ body: { padding: '48px 36px' } }}
        >
          <CheckCircleOutlined style={{ fontSize: 72, color: '#22C55E', marginBottom: 16 }} />
          <Title level={2} style={{ color: '#1F2937', margin: '0 0 8px' }}>
            Welcome!
          </Title>
          <Paragraph style={{ fontSize: 18, color: '#374151', marginBottom: 8 }}>
            {result?.message || 'You have been checked in successfully.'}
          </Paragraph>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Checked in at {new Date().toLocaleTimeString()}
          </Text>

          <div style={{
            marginTop: 32, padding: '12px 20px', background: '#F0FDF4',
            borderRadius: 8, border: '1px solid #86EFAC',
          }}>
            <Text style={{ fontSize: 13, color: '#166534' }}>
              Please collect your visitor badge from reception and wait for your host.
            </Text>
          </div>

          <Button
            onClick={reset}
            block
            size="large"
            icon={<ReloadOutlined />}
            style={{ marginTop: 24, height: 48, borderRadius: 8 }}
          >
            New Check-In
          </Button>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
            This screen resets automatically in 10 seconds
          </Text>
        </Card>
      )}

      {/* Footer */}
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 24 }}>
        Apex POB • Secure Visitor Check-In
      </Text>
    </div>
  );
};

export default Kiosk;
