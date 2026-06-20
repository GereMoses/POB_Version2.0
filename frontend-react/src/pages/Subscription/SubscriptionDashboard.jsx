import React, { useState } from 'react';
import {
  Card, Row, Col, Statistic, Button, Form, Input, DatePicker, Select,
  Table, Tag, Typography, Alert, Space, Divider, InputNumber, message, Modal,
  Descriptions, Badge,
} from 'antd';
import {
  SafetyCertificateOutlined, KeyOutlined, CopyOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiService from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const STATUS_COLOR = {
  active:     'success',
  warning:    'warning',
  critical:   'error',
  expired:    'error',
  no_license: 'default',
};

const SubscriptionDashboard = () => {
  const [genForm] = Form.useForm();
  const [setupForm] = Form.useForm();
  const [generatedKey, setGeneratedKey] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiService.get('/api/v1/subscription/'),
  });

  const sub = data?.data;

  const generateMutation = useMutation({
    mutationFn: (body) => apiService.post('/api/v1/subscription/generate-key', body),
    onSuccess: (res) => {
      setGeneratedKey(res.data);
      message.success('Renewal key generated');
    },
    onError: (e) => message.error(e.message),
  });

  const setupMutation = useMutation({
    mutationFn: (body) => apiService.post('/api/v1/subscription/setup', body),
    onSuccess: () => {
      message.success('Subscription updated');
      setSetupOpen(false);
      setupForm.resetFields();
      qc.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (e) => message.error(e.message),
  });

  const handleGenerate = (values) => {
    generateMutation.mutate({ new_expiry: values.new_expiry.format('YYYY-MM-DDTHH:mm:ss') });
  };

  const handleSetup = (values) => {
    setupMutation.mutate({
      org_name: values.org_name,
      tier: values.tier,
      expiry_date: values.expiry_date.format('YYYY-MM-DDTHH:mm:ss'),
      max_users: values.max_users,
      max_employees: values.max_employees,
      max_devices: values.max_devices,
      notes: values.notes,
    });
  };

  const renewalCols = [
    { title: 'Date', dataIndex: 'activated_at', key: 'activated_at',
      render: v => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—' },
    { title: 'Previous Expiry', dataIndex: 'previous_expiry', key: 'prev' },
    { title: 'New Expiry', dataIndex: 'new_expiry', key: 'new' },
    { title: 'Key Prefix', dataIndex: 'key_prefix', key: 'kp',
      render: v => <Text code>{v}</Text> },
    { title: 'IP', dataIndex: 'ip_address', key: 'ip' },
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <SafetyCertificateOutlined style={{ marginRight: 8, color: '#0078D4' }} />
          Subscription Management
        </Title>
        <Button icon={<SettingOutlined />} onClick={() => setSetupOpen(true)}>
          Setup / Reset Subscription
        </Button>
      </div>

      {error && (
        <Alert message={error.message} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      {/* Status cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic
              title="Status"
              value={sub?.label || '—'}
              prefix={<Badge status={STATUS_COLOR[sub?.status] || 'default'} />}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic
              title="Days Remaining"
              value={sub?.days_remaining ?? '—'}
              suffix={sub?.days_remaining != null ? 'days' : ''}
              valueStyle={{ color: sub?.days_remaining < 14 ? '#f5222d' : sub?.days_remaining < 30 ? '#fa8c16' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic
              title="Expiry Date & Time"
              value={sub?.expiry_date
                ? new Date(sub.expiry_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—'}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ fontSize: 14 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic title="Organisation" value={sub?.org_name || '—'} valueStyle={{ fontSize: 16 }} />
          </Card>
        </Col>
      </Row>

      {/* Subscription details */}
      {sub && sub.status !== 'no_license' && (
        <Card title="Subscription Details" style={{ marginBottom: 24 }}>
          <Descriptions column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="Installation ID"><Text code>{sub.installation_id}</Text></Descriptions.Item>
            <Descriptions.Item label="Tier"><Tag>{sub.tier}</Tag></Descriptions.Item>
            <Descriptions.Item label="Issue Date">{sub.issue_date}</Descriptions.Item>
            <Descriptions.Item label="Max Users">{sub.max_users}</Descriptions.Item>
            <Descriptions.Item label="Max Employees">{sub.max_employees}</Descriptions.Item>
            <Descriptions.Item label="Max Devices">{sub.max_devices}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        {/* Generate renewal key */}
        <Col xs={24} lg={12}>
          <Card
            title={<Space><KeyOutlined /><span>Generate Renewal Key</span></Space>}
            extra={<Tag color="blue">Vendor Tool</Tag>}
          >
            <Paragraph type="secondary">
              Generate a renewal key to give to the customer. They enter the key + expiry date on the lock screen.
            </Paragraph>
            <Form form={genForm} layout="vertical" onFinish={handleGenerate}>
              <Form.Item
                name="new_expiry"
                label="New Expiry Date & Time"
                rules={[{ required: true, message: 'Select expiry date & time' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  showTime
                  disabledDate={(d) => d && d < dayjs().startOf('day')}
                  format="YYYY-MM-DD HH:mm:ss"
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={generateMutation.isPending}
                  icon={<KeyOutlined />}
                  block
                >
                  Generate Key
                </Button>
              </Form.Item>
            </Form>

            {generatedKey && (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message="Key Generated — Send to Customer"
                description={
                  <div style={{ marginTop: 8 }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>Renewal Key: </Text>
                      <Text code style={{ fontSize: 15, letterSpacing: 1 }}>{generatedKey.key}</Text>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        style={{ marginLeft: 8 }}
                        onClick={() => { navigator.clipboard.writeText(generatedKey.key); message.success('Key copied'); }}
                      />
                    </div>
                    <div>
                      <Text strong>New Expiry: </Text>
                      <Text code style={{ fontFamily: 'monospace' }}>{generatedKey.valid_until}</Text>
                    </div>
                    <Divider style={{ margin: '8px 0' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tell the customer to enter both the key and the expiry date on the lock screen.
                    </Text>
                  </div>
                }
              />
            )}
          </Card>
        </Col>

        {/* Installation info */}
        <Col xs={24} lg={12}>
          <Card title="Installation Information">
            <Descriptions column={1}>
              <Descriptions.Item label="Installation ID">
                <Space>
                  <Text code>{sub?.installation_id || '—'}</Text>
                  {sub?.installation_id && (
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => { navigator.clipboard.writeText(sub.installation_id); message.success('Copied'); }}
                    />
                  )}
                </Space>
              </Descriptions.Item>
            </Descriptions>
            <Alert
              type="info"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message="About the Installation ID"
              description="This ID is unique to this deployment. It is derived from the SECRET_KEY and is needed to generate a valid renewal key for this specific installation."
              style={{ marginTop: 16 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Renewal history */}
      {sub?.renewal_history?.length > 0 && (
        <Card title="Renewal History" style={{ marginTop: 16 }}>
          <Table
            dataSource={sub.renewal_history}
            columns={renewalCols}
            rowKey={(r, i) => i}
            size="small"
            pagination={false}
          />
        </Card>
      )}

      {/* Setup modal */}
      <Modal
        title="Setup / Reset Subscription"
        open={setupOpen}
        onCancel={() => setSetupOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={setupForm} layout="vertical" onFinish={handleSetup}>
          <Form.Item name="org_name" label="Organisation Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Acme Offshore Ltd" />
          </Form.Item>
          <Form.Item name="tier" label="Tier" initialValue="standard">
            <Select>
              <Select.Option value="starter">Starter</Select.Option>
              <Select.Option value="standard">Standard</Select.Option>
              <Select.Option value="enterprise">Enterprise</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="expiry_date" label="Expiry Date & Time" rules={[{ required: true }]}>
            <DatePicker
              style={{ width: '100%' }}
              showTime
              disabledDate={(d) => d && d < dayjs().startOf('day')}
              format="YYYY-MM-DD HH:mm:ss"
            />
          </Form.Item>
          <Row gutter={8}>
            <Col span={8}>
              <Form.Item name="max_users" label="Max Users" initialValue={50}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_employees" label="Max Employees" initialValue={500}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_devices" label="Max Devices" initialValue={20}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={setupMutation.isPending} block>
              Save Subscription
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SubscriptionDashboard;
