import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Row, Col, Card, Tag, Space, Progress, Button, App } from 'antd';
import {
  ApiOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined,
  AlertOutlined, TeamOutlined, SafetyOutlined, ReloadOutlined,
  DashboardOutlined, WifiOutlined, DisconnectOutlined,
  LockOutlined, UnlockOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const EVENT_TYPE = {
  0: { label: 'Normal Access',   bg: '#f6ffed', color: '#52c41a', icon: '✓' },
  1: { label: 'Door Open',       bg: '#e6f7ff', color: '#1890ff', icon: '🚪' },
  2: { label: 'Door Alarm',      bg: '#fff1f0', color: '#f5222d', icon: '🔔' },
  3: { label: 'Anti-passback',   bg: '#fffbe6', color: '#d4a017', icon: '↩' },
  4: { label: 'Duress',          bg: '#fff1f0', color: '#f5222d', icon: '⚠' },
  5: { label: 'Fire Unlock',     bg: '#fff7e6', color: '#fa8c16', icon: '🔥' },
  6: { label: 'Emergency Lock',  bg: '#fff1f0', color: '#f5222d', icon: '🚨' },
  7: { label: 'Mustering Check', bg: '#f9f0ff', color: '#722ed1', icon: '👥' },
};

const KpiCard = ({ title, value, sub, icon, accent }) => (
  <div style={{
    background: 'white', borderRadius: 14, padding: '18px 20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)', borderTop: `3px solid ${accent}`,
    height: '100%',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 8, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: '#141414', lineHeight: 1 }}>{value ?? 0}</div>
        {sub && <div style={{ color: '#8c8c8c', fontSize: 11, marginTop: 6 }}>{sub}</div>}
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${accent}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {React.cloneElement(icon, { style: { fontSize: 20, color: accent } })}
      </div>
    </div>
  </div>
);

const DoorMiniCard = ({ door, onOpen }) => {
  const isOnline = door.is_online;
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '14px 16px',
      border: `1px solid ${isOnline ? '#d9f7be' : '#ffd6d6'}`,
      boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.05)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div className={isOnline ? 'ac-online-pulse' : ''} style={{
            width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
            background: isOnline ? '#52c41a' : '#f5222d',
          }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#141414' }}>{door.door_name}</span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, borderRadius: 10, padding: '2px 7px',
          background: isOnline ? '#f6ffed' : '#fff1f0',
          color: isOnline ? '#52c41a' : '#f5222d',
        }}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#8c8c8c', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
        {door.terminal_sn || 'No terminal'}
      </div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {door.first_card_open && <span style={{ background: '#e6f7ff', color: '#1890ff', fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>FIRST CARD</span>}
        {door.mustering_mode  && <span style={{ background: '#fff7e6', color: '#fa8c16', fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>MUSTERING</span>}
        {door.fire_linkage    && <span style={{ background: '#fff1f0', color: '#f5222d', fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>FIRE LINK</span>}
        {door.anti_passback > 0 && <span style={{ background: '#fffbe6', color: '#d48806', fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>APB</span>}
      </div>
      {isOnline && (
        <button onClick={() => onOpen(door.id)} style={{
          background: 'linear-gradient(90deg, #1890ff, #0050b3)',
          border: 'none', borderRadius: 7, color: 'white',
          fontSize: 11, fontWeight: 600, padding: '5px 0',
          cursor: 'pointer', width: '100%', transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Remote Open
        </button>
      )}
    </div>
  );
};

const EventFeedItem = ({ event, index, isNew }) => {
  const t = EVENT_TYPE[event.event_type] || { label: 'Unknown', bg: '#f5f5f5', color: '#8c8c8c', icon: '?' };
  const isAlarm = [2, 4, 5, 6].includes(event.event_type);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px',
      background: isNew ? '#e6f7ff' : index % 2 === 0 ? 'white' : '#fafafa',
      borderLeft: `3px solid ${t.color}`,
      borderBottom: '1px solid #f5f5f5',
      transition: 'background 1.5s',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: t.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>
        {t.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: '#141414' }}>{t.label}</span>
          <span style={{ fontSize: 10, color: '#bfbfbf', flexShrink: 0, marginLeft: 6, fontFamily: 'monospace' }}>
            {new Date(event.event_time).toLocaleTimeString()}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#595959', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
          {event.emp_name
            ? <><span style={{ fontWeight: 500 }}>{event.emp_name}</span>{event.door_name ? ` · ${event.door_name}` : ''}</>
            : event.door_name || event.terminal_sn || '—'}
        </div>
      </div>
      {isAlarm && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f5222d', flexShrink: 0 }} />}
    </div>
  );
};

const HealthRow = ({ label, status }) => {
  const ok = status === 'healthy' || status === 'running';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 12px', borderRadius: 8, marginBottom: 6,
      background: ok ? '#f6ffed' : '#fff1f0',
      border: `1px solid ${ok ? '#d9f7be' : '#ffccc7'}`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#262626' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? '#52c41a' : '#f5222d' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: ok ? '#52c41a' : '#f5222d' }}>
          {ok ? 'OK' : 'Error'}
        </span>
      </div>
    </div>
  );
};

const WS_MAX = 80;

const AccessControlDashboard = () => {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();

  const [liveEvents, setLiveEvents]   = useState([]);
  const [newIds,     setNewIds]       = useState(new Set());
  const [wsState,    setWsState]      = useState('connecting'); // connecting | open | closed
  const wsRef = useRef(null);

  // ── WebSocket live feed ──
  const connectWs = useCallback(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/api/access-control/events/ws?token=${token}`);
    wsRef.current = ws;
    setWsState('connecting');

    ws.onopen  = () => setWsState('open');
    ws.onclose = () => {
      setWsState('closed');
      setTimeout(connectWs, 5000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        if (!ev.event_type && ev.event_type !== 0) return;
        const id = ev.id ?? `ws-${Date.now()}`;
        setLiveEvents(prev => [ev, ...prev].slice(0, WS_MAX));
        setNewIds(prev => new Set([...prev, id]));
        setTimeout(() => setNewIds(p => { const n = new Set(p); n.delete(id); return n; }), 2000);
      } catch {}
    };
  }, []);

  useEffect(() => {
    connectWs();
    return () => { wsRef.current?.close(); };
  }, [connectWs]);

  // ── REST queries ──
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ac-dashboard'],
    queryFn: () => apiService.get('/api/access-control/dashboard/'),
    refetchInterval: 30000,
  });

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn: () => apiService.get('/api/access-control/doors/'),
    refetchInterval: 15000,
  });

  const emergencyLock = useMutation({
    mutationFn: (reason) => apiService.post('/api/access-control/emergency/lock-all/', { reason }),
    onSuccess: () => { message.success('Emergency lock sent to all doors'); refetch(); },
    onError: e => message.error(e?.message || 'Command failed'),
  });

  const emergencyUnlock = useMutation({
    mutationFn: (reason) => apiService.post('/api/access-control/emergency/unlock-all/', { reason }),
    onSuccess: () => { message.success('Emergency unlock sent to all doors'); refetch(); },
    onError: e => message.error(e?.message || 'Command failed'),
  });

  const handleRemoteOpen = (doorId) => {
    modal.confirm({
      title: 'Remote Open Door',
      icon: <ThunderboltOutlined style={{ color: '#1890ff' }} />,
      content: 'Send remote open command to this door?',
      okText: 'Open Now',
      onOk: () => apiService.post(`/api/access-control/doors/${doorId}/open/`)
        .then(() => message.success('Open command sent'))
        .catch(e => message.error(e?.message || 'Failed')),
    });
  };

  const d      = data?.data || {};
  const doors  = doorsData?.data || [];
  const today  = d.today_activity  || {};
  const health = d.system_health   || {};
  const restEvents = d.recent_events || [];

  // merge: live events first, then REST events that aren't already shown
  const liveIds = new Set(liveEvents.map(e => e.id).filter(Boolean));
  const mergedEvents = [
    ...liveEvents,
    ...restEvents.filter(e => !liveIds.has(e.id)),
  ].slice(0, WS_MAX);

  const online     = doors.filter(d => d.is_online).length;
  const offline    = doors.length - online;
  const grantPct   = today.total_events ? Math.round((today.access_granted / today.total_events) * 100) : 0;
  const alarmCount = mergedEvents.filter(e => [2,4,5,6].includes(e.event_type)).length;

  const wsIndicatorColor = { connecting: '#fa8c16', open: '#52c41a', closed: '#f5222d' }[wsState];
  const wsIndicatorLabel = { connecting: 'Connecting…', open: 'Live', closed: 'Disconnected' }[wsState];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24, background: '#f0f2f5' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f1923 0%, #1a3a5c 50%, #0d2137 100%)',
        borderRadius: 16, padding: '20px 24px', marginBottom: 20,
        boxShadow: '0 8px 32px rgba(15,25,35,0.35)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <Space size={14}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #1890ff, #096dd9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(24,144,255,0.4)',
          }}>
            <DashboardOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Access Control Dashboard</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
              Real-time door status &amp; access event monitoring
            </div>
          </div>
        </Space>
        <Space size={8} wrap>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 12px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: wsIndicatorColor }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600 }}>{wsIndicatorLabel}</span>
          </div>
          <Button
            icon={<LockOutlined />}
            loading={emergencyLock.isPending}
            onClick={() => {
              let reason = '';
              modal.confirm({
                title: 'Emergency Lock All Doors?',
                icon: <AlertOutlined style={{ color: '#f5222d' }} />,
                content: (
                  <div>
                    <p style={{ marginBottom: 8 }}>This will lock all doors immediately. Provide a reason:</p>
                    <input
                      autoFocus
                      placeholder="e.g. Security drill, threat detected…"
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d9d9d9', fontSize: 13 }}
                      onChange={e => { reason = e.target.value; }}
                    />
                  </div>
                ),
                okType: 'danger', okText: 'Lock All',
                onOk: () => {
                  if (!reason || reason.trim().length < 5) return Promise.reject('Please provide a reason (at least 5 characters)');
                  return emergencyLock.mutateAsync(reason.trim());
                },
              });
            }}
            danger
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Lock All
          </Button>
          <Button
            icon={<UnlockOutlined />}
            loading={emergencyUnlock.isPending}
            onClick={() => {
              let reason = '';
              modal.confirm({
                title: 'Emergency Unlock All Doors?',
                icon: <AlertOutlined style={{ color: '#52c41a' }} />,
                content: (
                  <div>
                    <p style={{ marginBottom: 8 }}>This will unlock all doors immediately. Provide a reason:</p>
                    <input
                      autoFocus
                      placeholder="e.g. All-clear confirmed, drill complete…"
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d9d9d9', fontSize: 13 }}
                      onChange={e => { reason = e.target.value; }}
                    />
                  </div>
                ),
                okText: 'Unlock All',
                onOk: () => {
                  if (!reason || reason.trim().length < 5) return Promise.reject('Please provide a reason (at least 5 characters)');
                  return emergencyUnlock.mutateAsync(reason.trim());
                },
              });
            }}
            style={{ borderRadius: 8, fontWeight: 600, background: 'rgba(82,196,26,0.15)', borderColor: 'rgba(82,196,26,0.4)', color: '#52c41a' }}
          >
            Unlock All
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
            style={{ borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* ── KPI row ── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Doors',     value: doors.length || d.door_statistics?.total, icon: <ApiOutlined />,          accent: '#1890ff' },
          { title: 'Online',          value: online || d.door_statistics?.online, sub: offline > 0 ? `${offline} offline` : 'All online', icon: <WifiOutlined />, accent: '#52c41a' },
          { title: "Today's Events",  value: today.total_events,  icon: <ThunderboltOutlined />, accent: '#fa8c16' },
          { title: 'Access Granted',  value: today.access_granted, sub: `${grantPct}% grant rate`, icon: <CheckCircleOutlined />, accent: '#722ed1' },
          { title: 'Active Users',    value: d.active_users, sub: `${d.access_levels?.total || 0} access levels`, icon: <TeamOutlined />, accent: '#13c2c2' },
        ].map(k => (
          <Col key={k.title} style={{ flex: '0 0 20%', maxWidth: '20%' }} xs={12} sm={12}>
            <KpiCard {...k} />
          </Col>
        ))}
      </Row>

      {/* ── Middle section ── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>

        {/* Door Status Grid */}
        <Col xs={24} lg={15}>
          <Card
            style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', height: '100%' }}
            styles={{ body: { padding: '16px 20px' } }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                  <ApiOutlined style={{ color: '#1890ff' }} />
                  <span style={{ fontWeight: 700 }}>Door Status</span>
                  <Tag style={{ fontSize: 11 }}>{doors.length} doors</Tag>
                </Space>
                <Space size={6}>
                  <span style={{ fontSize: 11, color: '#52c41a', fontWeight: 600 }}>● {online} online</span>
                  {offline > 0 && <span style={{ fontSize: 11, color: '#f5222d', fontWeight: 600 }}>● {offline} offline</span>}
                </Space>
              </div>
            }
          >
            {doors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#8c8c8c' }}>
                <ApiOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                No doors configured
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {doors.map(door => <DoorMiniCard key={door.id} door={door} onOpen={handleRemoteOpen} />)}
              </div>
            )}
          </Card>
        </Col>

        {/* Right column */}
        <Col xs={24} lg={9}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

            {/* Today's Activity */}
            <Card style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
              styles={{ body: { padding: '16px 20px' } }}
              title={<Space><ThunderboltOutlined style={{ color: '#fa8c16' }} /><span style={{ fontWeight: 700 }}>Today's Activity</span></Space>}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#595959', marginBottom: 5 }}>
                  <span>Grant rate</span>
                  <span style={{ fontWeight: 600, color: grantPct >= 90 ? '#52c41a' : grantPct >= 70 ? '#fa8c16' : '#f5222d' }}>{grantPct}%</span>
                </div>
                <Progress percent={grantPct}
                  strokeColor={grantPct >= 90 ? '#52c41a' : grantPct >= 70 ? '#fa8c16' : '#f5222d'}
                  trailColor="#f0f0f0" size={7} showInfo={false} />
              </div>
              <Row gutter={[8, 8]}>
                {[
                  { label: 'Granted',   value: today.access_granted   || 0, bg: '#f6ffed', color: '#52c41a', icon: <CheckCircleOutlined /> },
                  { label: 'Denied',    value: today.access_denied    || 0, bg: '#fff1f0', color: '#f5222d', icon: <CloseCircleOutlined /> },
                  { label: 'Emergency', value: today.emergency_events  || 0, bg: '#fff2e8', color: '#fa541c', icon: <AlertOutlined /> },
                  { label: 'Mustering', value: today.mustering_events  || 0, bg: '#f9f0ff', color: '#722ed1', icon: <TeamOutlined /> },
                ].map(s => (
                  <Col span={12} key={s.label}>
                    <div style={{ background: s.bg, borderRadius: 9, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <span style={{ color: s.color, fontSize: 13 }}>{s.icon}</span>
                        <span style={{ fontSize: 11, color: '#8c8c8c' }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>

            {/* System Health */}
            <Card style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
              styles={{ body: { padding: '16px 20px' } }}
              title={<Space><SafetyOutlined style={{ color: '#52c41a' }} /><span style={{ fontWeight: 700 }}>System Health</span></Space>}>
              <HealthRow label="Database"     status={health.database} />
              <HealthRow label="ADMS Service" status={health.adms_service} />
              <HealthRow label="WebSocket"    status={health.websocket} />
              {health.last_check && (
                <div style={{ fontSize: 10, color: '#bfbfbf', textAlign: 'right', marginTop: 6 }}>
                  Last check: {new Date(health.last_check).toLocaleTimeString()}
                </div>
              )}
            </Card>
          </div>
        </Col>
      </Row>

      {/* ── Live Event Feed ── */}
      <Card
        style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
        styles={{ body: { padding: 0 } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <ThunderboltOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontWeight: 700 }}>Live Event Feed</span>
              <Tag style={{ fontSize: 11 }}>{mergedEvents.length}</Tag>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: wsIndicatorColor,
                  ...(wsState === 'open' ? { animation: 'ac-pulse 2s ease-out infinite' } : {}),
                }} />
                <span style={{ fontSize: 11, color: wsIndicatorColor, fontWeight: 600 }}>{wsIndicatorLabel}</span>
              </div>
            </Space>
            {alarmCount > 0 && (
              <Tag color="error" style={{ fontWeight: 600 }}>
                {alarmCount} alarm{alarmCount > 1 ? 's' : ''}
              </Tag>
            )}
          </div>
        }
      >
        {mergedEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
            <ThunderboltOutlined style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
            Waiting for events…
          </div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {mergedEvents.map((event, i) => (
              <EventFeedItem
                key={event.id ?? i}
                event={event}
                index={i}
                isNew={event.id ? newIds.has(event.id) : false}
              />
            ))}
          </div>
        )}
      </Card>

      <style>{`
        @keyframes ac-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(82,196,26,0.55); }
          70%  { box-shadow: 0 0 0 6px rgba(82,196,26,0); }
          100% { box-shadow: 0 0 0 0   rgba(82,196,26,0); }
        }
        .ac-online-pulse { animation: ac-pulse 2.4s ease-out infinite; }
      `}</style>
    </div>
  );
};

export default AccessControlDashboard;
