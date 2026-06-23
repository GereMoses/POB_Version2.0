/**
 * ZKTeco Template Sync Tab
 * Push personnel user data (name, ID, access level) and sync biometric
 * templates to one or all registered ZKTeco readers.
 *
 * Pushes users via the ADMS command queue (POST /iclock/cmd/push-users), which
 * works for both remote (ADMS) readers and direct-IP readers.
 */
import React, { useState } from 'react';
import {
  Card, Button, Table, Space, Tag, Alert, Typography, Row, Col,
  Progress, Statistic, Tooltip, Badge, App,
} from 'antd';
import {
  SyncOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DesktopOutlined, UserOutlined, ThunderboltOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Text } = Typography;

const STATUS_COLOR = {
  online: '#22C55E', offline: '#EF4444', unknown: '#9CA3AF',
};

const TemplateSyncTab = ({ terminals = [] }) => {
  const { message } = App.useApp();
  const [syncState, setSyncState] = useState({}); // deviceId → { loading, result }

  const { data: devicesData, isLoading, refetch } = useQuery({
    queryKey: ['device-terminals-sync'],
    queryFn: () => apiService.get('/api/device/terminals/'),
    staleTime: 30000,
  });
  const devices = (Array.isArray(devicesData) ? devicesData : (devicesData?.data ?? []))
    .map(t => {
      const sn = t.sn || t.serial_number;
      return {
        id: sn, sn,
        name: t.alias || t.device_name || sn,
        serial_number: sn,
        ip_address: t.ip_address,
        status: t.status,
        connection_mode: t.connection_mode,
      };
    });

  const syncDevice = async (sn, deviceName) => {
    setSyncState(s => ({ ...s, [sn]: { loading: true, result: null } }));
    try {
      // Push all active users to the reader via the ADMS command queue.
      const res = await apiService.post('/iclock/cmd/push-users', { sn });
      const m = /Queued\s+(\d+)/.exec(res?.detail || '');
      const synced = m ? parseInt(m[1], 10) : (res?.queued ?? res?.count ?? 0);
      setSyncState(s => ({
        ...s,
        [sn]: { loading: false, result: { success: true, synced } },
      }));
      message.success(`${deviceName}: queued ${synced} user(s) — applied on next device poll`);
    } catch (e) {
      const err = e?.response?.data?.detail || e?.message || 'Sync failed';
      setSyncState(s => ({
        ...s,
        [sn]: { loading: false, result: { success: false, error: err } },
      }));
      message.error(`${deviceName}: ${err}`);
    }
  };

  const syncAll = async () => {
    if (!devices.length) return;
    message.info(`Syncing ${devices.length} devices…`);
    await Promise.allSettled(devices.map(d => syncDevice(d.sn, d.name)));
  };

  const successCount = Object.values(syncState).filter(s => s.result?.success).length;
  const failCount    = Object.values(syncState).filter(s => s.result && !s.result.success).length;

  const cols = [
    {
      title: 'Device', key: 'dev',
      render: (_, r) => (
        <Space>
          <DesktopOutlined style={{ color: '#3B82F6' }} />
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>{r.name || r.serial_number || `Device #${r.id}`}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              SN: {r.serial_number || '—'}  •  IP: {r.ip_address || '—'}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Status', key: 'status', width: 90,
      render: (_, r) => {
        const st = r.status || r.connection_status || 'unknown';
        return (
          <Badge
            color={STATUS_COLOR[st] || '#9CA3AF'}
            text={<Text style={{ fontSize: 12 }}>{st}</Text>}
          />
        );
      },
    },
    {
      title: 'Last Sync', key: 'last_sync', width: 130,
      render: (_, r) => {
        const s = syncState[r.sn];
        if (!s) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        if (s.loading) return <SyncOutlined spin style={{ color: '#3B82F6' }} />;
        if (s.result?.success)
          return (
            <Space size={4}>
              <CheckCircleOutlined style={{ color: '#22C55E' }} />
              <Text style={{ fontSize: 12, color: '#22C55E' }}>{s.result.synced} queued</Text>
            </Space>
          );
        return (
          <Tooltip title={s.result?.error}>
            <Space size={4}>
              <CloseCircleOutlined style={{ color: '#EF4444' }} />
              <Text style={{ fontSize: 12, color: '#EF4444' }}>Failed</Text>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: '', key: 'action', width: 110,
      render: (_, r) => (
        <Button
          size="small"
          icon={<SyncOutlined />}
          loading={syncState[r.sn]?.loading}
          onClick={() => syncDevice(r.sn, r.name || r.serial_number)}
          type="primary"
          ghost
        >
          Sync
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Alert
        type="info"
        showIcon
        message="ZKTeco Template & User Sync"
        description="Pushes all active personnel (name, employee code, access level) from the database to your ZKTeco readers. Run this after adding new employees or updating biometric data. Biometric fingerprint templates registered on the device are preserved."
        style={{ marginBottom: 16 }}
      />

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { title: 'Registered Devices', value: devices.length,  color: '#3B82F6', icon: <DesktopOutlined /> },
          { title: 'Synced This Session', value: successCount,   color: '#22C55E', icon: <CheckCircleOutlined /> },
          { title: 'Failed',              value: failCount,       color: '#EF4444', icon: <CloseCircleOutlined /> },
        ].map(s => (
          <Col xs={12} sm={8} key={s.title}>
            <Card size="small" style={{ borderTop: `3px solid ${s.color}` }} styles={{ body: { padding: '10px 16px' } }}>
              <Statistic
                title={<Text style={{ fontSize: 12 }}>{s.title}</Text>}
                value={s.value}
                prefix={<span style={{ color: s.color }}>{s.icon}</span>}
                valueStyle={{ color: s.color, fontSize: 22 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Action bar */}
      <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ marginBottom: 12 }}>
        <Space>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={syncAll}
            loading={Object.values(syncState).some(s => s.loading)}
            disabled={!devices.length}
          >
            Sync All Devices
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {devices.length} device{devices.length !== 1 ? 's' : ''} registered
          </Text>
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={cols}
          dataSource={devices}
          loading={isLoading}
          rowKey="id"
          size="middle"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default TemplateSyncTab;
