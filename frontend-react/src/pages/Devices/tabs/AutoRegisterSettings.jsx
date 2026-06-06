import React, { useState } from 'react';
import {
  Card, Switch, Form, Input, Select, Button, Space, message,
  Alert, Row, Col, Statistic, Badge, Table, Tag, Tooltip,
  Typography, Divider,
} from 'antd';
import {
  SettingOutlined, SaveOutlined, ReloadOutlined, WifiOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined,
  ThunderboltOutlined, CloseCircleOutlined, ApiOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Option } = Select;
const { Text, Title, Paragraph } = Typography;

const AutoRegisterSettings = () => {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  /* ── Real pending devices from database ── */
  const { data: pendingRaw, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['adms-pending'],
    queryFn: () => apiService.get('/iclock/pending-devices'),
    refetchInterval: 15000,
  });
  const pendingDevices = Array.isArray(pendingRaw?.data) ? pendingRaw.data
    : Array.isArray(pendingRaw) ? pendingRaw : [];

  /* ── All approved/registered terminals ── */
  const { data: termRaw, isLoading: termLoading, refetch: refetchTerms } = useQuery({
    queryKey: ['adms-terminals'],
    queryFn: () => apiService.get('/api/device/terminals/'),
    refetchInterval: 30000,
  });
  const allTerminals = Array.isArray(termRaw?.data) ? termRaw.data
    : Array.isArray(termRaw) ? termRaw : [];

  /* ── ADMS config (auto-register toggle) ── */
  const { data: admsConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['adms-config'],
    queryFn: () => apiService.get('/api/device/adms-config'),
    staleTime: 60000,
  });
  const autoRegEnabled = admsConfig?.data?.auto_register ?? admsConfig?.auto_register ?? true;

  /* ── Approve / Reject mutation ── */
  const approveMutation = useMutation({
    mutationFn: ({ sn, action }) =>
      apiService.post('/iclock/approve-device', { sn, action }),
    onSuccess: (_, vars) => {
      message.success(vars.action === 'approve' ? 'Device approved' : 'Device rejected');
      qc.invalidateQueries({ queryKey: ['adms-pending'] });
      qc.invalidateQueries({ queryKey: ['adms-terminals'] });
    },
    onError: (e) => message.error(e?.response?.data?.detail || 'Action failed'),
  });

  /* ── Save auto-register toggle ── */
  const saveConfigMutation = useMutation({
    mutationFn: (val) => apiService.put('/api/device/adms-config', { auto_register: val }),
    onSuccess: () => { message.success('Setting saved'); refetchConfig(); },
    onError: () => message.error('Failed to save setting'),
  });

  const stats = {
    total:   allTerminals.length,
    online:  allTerminals.filter(d => d.status === 'Online').length,
    pending: pendingDevices.length,
    offline: allTerminals.filter(d => d.status === 'Offline').length,
  };

  const pendingColumns = [
    {
      title: 'Device',
      key: 'device',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.alias || `Terminal-${r.sn}`}</div>
          <code style={{ fontSize: 11, color: '#6B7280' }}>{r.sn}</code>
        </div>
      ),
    },
    { title: 'IP Address', dataIndex: 'ip_address', key: 'ip', render: v => v || '—' },
    { title: 'FW', dataIndex: 'fw_ver', key: 'fw', render: v => v || '—' },
    {
      title: 'First Seen',
      dataIndex: 'created_at',
      key: 'ts',
      render: v => v ? new Date(v).toLocaleString() : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Approve — allow attendance data from this device">
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              size="small"
              style={{ background: '#059669', borderColor: '#059669' }}
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate({ sn: r.sn, action: 'approve' })}
            >
              Approve
            </Button>
          </Tooltip>
          <Tooltip title="Reject — block this device permanently">
            <Button
              danger
              icon={<CloseCircleOutlined />}
              size="small"
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate({ sn: r.sn, action: 'reject' })}
            >
              Reject
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const termColumns = [
    {
      title: 'Device',
      key: 'device',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.alias || r.sn}</div>
          <code style={{ fontSize: 11, color: '#6B7280' }}>{r.sn}</code>
        </div>
      ),
    },
    { title: 'IP Address', dataIndex: 'ip_address', key: 'ip', render: v => v || '—' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: v => (
        <Tag color={v === 'Online' ? 'green' : v === 'Offline' ? 'red' : 'orange'}>
          {v || 'Unknown'}
        </Tag>
      ),
    },
    {
      title: 'Last Activity',
      dataIndex: 'last_activity',
      key: 'la',
      render: v => v ? new Date(v).toLocaleString() : '—',
    },
  ];

  return (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Registered" value={stats.total} prefix={<ApiOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Online" value={stats.online} valueStyle={{ color: '#52c41a' }} prefix={<WifiOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Pending Approval" value={stats.pending} valueStyle={{ color: '#faad14' }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Offline" value={stats.offline} valueStyle={{ color: '#ff4d4f' }} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Pending Approval */}
      {pendingDevices.length > 0 && (
        <Card
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              Pending Approval ({pendingDevices.length})
            </Space>
          }
          extra={
            <Button icon={<ReloadOutlined />} size="small" onClick={refetchPending}>
              Refresh
            </Button>
          }
          style={{ marginBottom: 16, borderColor: '#FCD34D' }}
        >
          <Alert
            type="warning"
            showIcon
            message="These devices have connected to the ADMS server but are awaiting approval. Approve only devices you recognise."
            style={{ marginBottom: 12, fontSize: 12 }}
          />
          <Table
            columns={pendingColumns}
            dataSource={pendingDevices}
            rowKey="sn"
            size="small"
            pagination={false}
            loading={pendingLoading}
          />
        </Card>
      )}

      {pendingDevices.length === 0 && !pendingLoading && (
        <Card style={{ marginBottom: 16, textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
          <div style={{ fontWeight: 600, color: '#374151' }}>No devices awaiting approval</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
            New devices that connect for the first time will appear here
          </div>
        </Card>
      )}

      <Row gutter={16}>
        {/* Settings */}
        <Col span={10}>
          <Card
            title={<Space><SettingOutlined />Auto-Register Settings</Space>}
            extra={
              <Button icon={<ReloadOutlined />} size="small" onClick={refetchConfig}>
                Refresh
              </Button>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 600 }}>Enable Auto-Registration</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  Automatically register unknown devices on first heartbeat
                </div>
              </div>
              <Switch
                checked={autoRegEnabled}
                loading={saveConfigMutation.isPending}
                onChange={(val) => saveConfigMutation.mutate(val)}
              />
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              <div style={{ marginBottom: 6 }}>
                <strong>ADMS Endpoint:</strong>{' '}
                <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 3 }}>
                  /iclock/cdata
                </code>
              </div>
              <div style={{ marginBottom: 6 }}>
                <strong>State after auto-register:</strong> Pending approval
              </div>
              <div>
                <strong>To change server address:</strong> Go to Zones → ADMS Readers tab
              </div>
            </div>
          </Card>
        </Col>

        {/* How it works */}
        <Col span={14}>
          <Card title={<Space><InfoCircleOutlined />How Auto-Registration Works</Space>}>
            <Paragraph style={{ fontSize: 12 }}>
              <ol style={{ paddingLeft: 16, margin: 0 }}>
                <li style={{ marginBottom: 8 }}>
                  <strong>Configure the device</strong> — On the ZKTeco keypad: Menu → Comm → ADMS → set Server Address
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Device connects</strong> — The reader calls GET /iclock/cdata on boot and every 30 s
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Auto-created as Pending</strong> — The server creates a terminal record in state=Pending
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Admin approves</strong> — Approved devices send attendance. Rejected devices are blocked
                </li>
                <li>
                  <strong>Assign to Zone</strong> — From Zones → ADMS Readers, assign the reader to a zone
                </li>
              </ol>
            </Paragraph>
            <Alert
              type="info"
              showIcon
              message="Tip: The ADMS server address for your devices can be set in Zones → ADMS Readers tab → ADMS Configuration sub-tab."
              style={{ fontSize: 12 }}
            />
          </Card>
        </Col>
      </Row>

      {/* All Registered Terminals */}
      <Card
        title="All Registered Terminals"
        style={{ marginTop: 16 }}
        extra={
          <Button icon={<ReloadOutlined />} size="small" onClick={refetchTerms}>
            Refresh
          </Button>
        }
      >
        <Table
          columns={termColumns}
          dataSource={allTerminals}
          rowKey="id"
          size="small"
          loading={termLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default AutoRegisterSettings;
