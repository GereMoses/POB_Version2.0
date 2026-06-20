/**
 * ZKTeco Template Sync Tab
 * Push personnel user data (name, ID, access level) and sync biometric
 * templates to one or all registered ZKTeco readers.
 *
 * Uses the existing POST /api/v1/zkteco/devices/{id}/sync-personnel endpoint.
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
    queryKey: ['zkteco-sync-devices'],
    queryFn: () => apiService.get('/api/v1/zkteco/devices'),
    staleTime: 30000,
  });
  const devices = devicesData?.devices ?? devicesData ?? [];

  const syncDevice = async (deviceId, deviceName) => {
    setSyncState(s => ({ ...s, [deviceId]: { loading: true, result: null } }));
    try {
      const res = await apiService.post(`/api/v1/zkteco/devices/${deviceId}/sync-personnel`);
      const synced = res?.synced ?? res?.count ?? 0;
      setSyncState(s => ({
        ...s,
        [deviceId]: { loading: false, result: { success: true, synced } },
      }));
      message.success(`${deviceName}: ${synced} users synced`);
    } catch (e) {
      setSyncState(s => ({
        ...s,
        [deviceId]: { loading: false, result: { success: false, error: e?.message || 'Sync failed' } },
      }));
      message.error(`${deviceName}: ${e?.message || 'Sync failed'}`);
    }
  };

  const syncAll = async () => {
    if (!devices.length) return;
    message.info(`Syncing ${devices.length} devices…`);
    await Promise.allSettled(devices.map(d => syncDevice(d.id, d.name || d.serial_number)));
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
        const s = syncState[r.id];
        if (!s) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        if (s.loading) return <SyncOutlined spin style={{ color: '#3B82F6' }} />;
        if (s.result?.success)
          return (
            <Space size={4}>
              <CheckCircleOutlined style={{ color: '#22C55E' }} />
              <Text style={{ fontSize: 12, color: '#22C55E' }}>{s.result.synced} users</Text>
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
          loading={syncState[r.id]?.loading}
          onClick={() => syncDevice(r.id, r.name || r.serial_number)}
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
