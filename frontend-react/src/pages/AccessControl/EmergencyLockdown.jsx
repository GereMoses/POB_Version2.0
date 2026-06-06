import React, { useState } from 'react';
import {
  Table, Button, Space, Tag, Switch, Card, Row, Col,
  Statistic, App, Badge, Modal,
} from 'antd';
import {
  LockOutlined, UnlockOutlined, AlertOutlined, TeamOutlined,
  ReloadOutlined, ExclamationCircleOutlined, WifiOutlined, DisconnectOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const EMERGENCY_ACTIONS = {
  0: { l: 'Ignore', color: 'default', bg: '#f5f5f5', text: '#8c8c8c' },
  1: { l: 'Lock',   color: 'error',   bg: '#fff1f0', text: '#f5222d' },
  2: { l: 'Unlock', color: 'success', bg: '#f6ffed', text: '#52c41a' },
};

const EmergencyLockdown = () => {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const [selectedDoors, setSelectedDoors] = useState([]);

  const { data: doorsData, isLoading, refetch } = useQuery({
    queryKey: ['acc-doors'],
    queryFn: () => apiService.get('/api/access-control/doors/'),
  });
  const doors = doorsData?.data || [];

  const { data: statusData } = useQuery({
    queryKey: ['acc-emergency-status'],
    queryFn: () => apiService.get('/api/access-control/emergency/status/'),
    refetchInterval: 30000,
  });
  const status = statusData?.data || {};

  const emergencyAction = useMutation({
    mutationFn: ({ action, doorIds }) =>
      apiService.post('/api/access-control/emergency/action/', { action, door_ids: doorIds }),
    onSuccess: (_, v) => {
      message.success(`Emergency ${v.action} executed on ${v.doorIds.length} door(s)`);
      qc.invalidateQueries(['acc-doors']); qc.invalidateQueries(['acc-emergency-status']);
      setSelectedDoors([]);
    },
    onError: e => message.error(e?.message || 'Error executing action'),
  });

  const musteringMutation = useMutation({
    mutationFn: ({ doorIds, enable }) =>
      apiService.post('/api/access-control/doors/set-mustering-mode/', { door_ids: doorIds, mustering_mode: enable }),
    onSuccess: () => { message.success('Mustering mode updated'); qc.invalidateQueries(['acc-doors']); },
    onError: e => message.error(e?.message || 'Error'),
  });

  const confirmAction = (action) => {
    const doorIds = selectedDoors.length > 0 ? selectedDoors : doors.map(d => d.id);
    const isLock = action === 'lock';
    modal.confirm({
      title: isLock ? 'Emergency Lockdown' : 'Emergency Unlock',
      icon: <ExclamationCircleOutlined style={{ color: isLock ? '#f5222d' : '#52c41a' }} />,
      content: (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            This will <strong>{isLock ? 'LOCK' : 'UNLOCK'}</strong> {doorIds.length} door(s) immediately.
          </div>
          <div style={{ color: '#8c8c8c', fontSize: 13 }}>
            {isLock ? 'All selected doors will be locked. Users will be unable to pass.' : 'All selected doors will be unlocked for fire evacuation mode.'}
          </div>
        </div>
      ),
      okType: isLock ? 'danger' : 'primary',
      okText: isLock ? 'LOCKDOWN NOW' : 'UNLOCK NOW',
      onOk: () => emergencyAction.mutate({ action, doorIds }),
    });
  };

  const online  = doors.filter(d => d.is_online).length;
  const offline = doors.length - online;
  const mustering = doors.filter(d => d.mustering_mode).length;

  const cols = [
    { title: 'Door', dataIndex: 'door_name', key: 'door', width: 200,
      render: (v, r) => (
        <Space>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: r.is_online ? 'linear-gradient(135deg,#52c41a,#237804)' : 'linear-gradient(135deg,#bfbfbf,#8c8c8c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LockOutlined style={{ color: 'white', fontSize: 13 }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{v}</span>
        </Space>
      )},
    { title: 'Terminal', dataIndex: 'terminal_sn', key: 'term', width: 140,
      render: (v, r) => (
        <Space size={6}>
          {r.is_online ? <WifiOutlined style={{ color: '#52c41a', fontSize: 12 }} /> : <DisconnectOutlined style={{ color: '#f5222d', fontSize: 12 }} />}
          <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</span>
        </Space>
      )},
    { title: 'Connectivity', key: 'online', width: 110,
      render: (_, r) => (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: r.is_online ? '#f6ffed' : '#fff1f0',
          border: `1px solid ${r.is_online ? '#b7eb8f' : '#ffa39e'}`,
          borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500,
          color: r.is_online ? '#52c41a' : '#f5222d',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.is_online ? '#52c41a' : '#f5222d' }} />
          {r.is_online ? 'Online' : 'Offline'}
        </div>
      )},
    { title: 'Emergency Action', dataIndex: 'emergency_action', key: 'ea', width: 140,
      render: v => {
        const a = EMERGENCY_ACTIONS[v] || EMERGENCY_ACTIONS[0];
        return <Tag color={a.color} style={{ fontWeight: 500, borderRadius: 6 }}>{a.l}</Tag>;
      }},
    { title: 'Mustering', key: 'muster', width: 150,
      render: (_, r) => (
        <Switch size="small"
          checked={!!r.mustering_mode}
          disabled={!r.is_online}
          checkedChildren={<Space size={3}><TeamOutlined />On</Space>}
          unCheckedChildren="Off"
          style={{ background: r.mustering_mode ? '#fa8c16' : undefined }}
          onChange={v => musteringMutation.mutate({ doorIds: [r.id], enable: v })}
        />
      )},
  ];

  const rowSelection = {
    selectedRowKeys: selectedDoors,
    onChange: keys => setSelectedDoors(keys),
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24, background: '#f0f2f5' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0000 0%, #4a0000 50%, #7a0000 100%)',
        borderRadius: 16, padding: '22px 28px', marginBottom: 24,
        boxShadow: '0 8px 32px rgba(26,0,0,0.5)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Space size={16}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #f5222d, #a8071a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(245,34,45,0.5)',
            animation: status.active ? 'pulse 1.5s infinite' : 'none',
          }}>
            <AlertOutlined style={{ color: 'white', fontSize: 24 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Emergency Control</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>
              Trigger emergency lockdown/unlock across all or selected doors
            </div>
          </div>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8 }}>
          Refresh
        </Button>
      </div>

      {/* Active emergency banner */}
      {status.active && (
        <div style={{
          background: 'linear-gradient(135deg, #f5222d, #a8071a)',
          borderRadius: 12, padding: '16px 24px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 20px rgba(245,34,45,0.4)',
        }}>
          <WarningOutlined style={{ color: 'white', fontSize: 24 }} />
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
              EMERGENCY {(status.type || '').toUpperCase()} ACTIVE
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              Started: {status.start_time ? new Date(status.start_time).toLocaleString() : '—'} &nbsp;|&nbsp; {status.affected_doors || 0} doors affected
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Doors',  value: doors.length, from: '#434343', to: '#000000' },
          { label: 'Online',       value: online,        from: '#52c41a', to: '#237804' },
          { label: 'Offline',      value: offline,       from: '#f5222d', to: '#a8071a' },
          { label: 'Mustering',    value: mustering,     from: '#fa8c16', to: '#d46b08' },
        ].map(s => (
          <Col key={s.label} xs={12} sm={6}>
            <Card style={{
              borderRadius: 12, border: 'none',
              background: `linear-gradient(135deg, ${s.from}, ${s.to})`,
              boxShadow: `0 4px 16px ${s.from}55`,
            }}>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: 'white', fontSize: 28, fontWeight: 800 }}>{s.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Emergency action buttons */}
      <Card style={{ borderRadius: 12, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Emergency Actions</div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
              {selectedDoors.length > 0
                ? `${selectedDoors.length} door(s) selected — action will target selected doors only`
                : `No doors selected — action will target ALL ${doors.length} doors`}
            </div>
          </div>
          <Space size={12}>
            <Button
              size="large" icon={<LockOutlined />}
              onClick={() => confirmAction('lock')}
              loading={emergencyAction.isPending}
              style={{
                background: 'linear-gradient(135deg,#f5222d,#a8071a)',
                border: 'none', color: 'white', borderRadius: 10,
                fontWeight: 700, fontSize: 14, boxShadow: '0 4px 16px rgba(245,34,45,0.4)',
                padding: '0 24px', height: 44,
              }}>
              EMERGENCY LOCKDOWN
            </Button>
            <Button
              size="large" icon={<UnlockOutlined />}
              onClick={() => confirmAction('unlock')}
              loading={emergencyAction.isPending}
              style={{
                background: 'linear-gradient(135deg,#52c41a,#237804)',
                border: 'none', color: 'white', borderRadius: 10,
                fontWeight: 700, fontSize: 14, boxShadow: '0 4px 16px rgba(82,196,26,0.4)',
                padding: '0 24px', height: 44,
              }}>
              EMERGENCY UNLOCK
            </Button>
          </Space>
        </div>
      </Card>

      <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        styles={{ body: { padding: 0 } }}>
        <Table
          rowSelection={rowSelection}
          columns={cols}
          dataSource={doors}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={false}
          style={{ borderRadius: 12, overflow: 'hidden' }}
        />
      </Card>
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(245,34,45,0.5); }
          50% { box-shadow: 0 4px 28px rgba(245,34,45,0.9); }
        }
      `}</style>
    </div>
  );
};

export default EmergencyLockdown;
