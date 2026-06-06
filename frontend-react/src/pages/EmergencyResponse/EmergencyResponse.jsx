import React, { useState, useEffect, useRef } from 'react';
import { Space, Button, Tooltip } from 'antd';
import {
  AlertOutlined, TeamOutlined, ReloadOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import EmergencyManagement from '../Emergency/EmergencyManagement';
import MusteringManagement from '../Mustering/MusteringManagement';

const SECTIONS = [
  {
    key: 'emergency',
    label: 'Emergency Response',
    sub: 'Lockdown · Fire Mode · Devices · Notifications · Plans · Audit',
    icon: <AlertOutlined />,
    accentColor: '#ff4d4f',
  },
  {
    key: 'mustering',
    label: 'Personnel Accountability',
    sub: 'Live Headcount · Zones · Events · Drills · Analytics',
    icon: <TeamOutlined />,
    accentColor: '#60a5fa',
  },
];

/* ─── Unified header ─────────────────────────────────────────── */
const UnifiedHeader = ({ section, setSection, emergencyData, activeEvents, wsStatus, onRefresh, isLoading }) => {
  const d           = emergencyData || {};
  const isEmergency = d.system_status === 'EMERGENCY';
  const musterCount = activeEvents.length;
  const missingTotal = activeEvents.reduce((s, e) => s + (e.total_missing ?? 0), 0);
  const isCritical  = isEmergency || missingTotal > 0;
  const wsColor     = wsStatus === 'connected' ? '#52c41a' : wsStatus === 'error' ? '#f5222d' : '#8c8c8c';

  const headerBg = isCritical
    ? 'linear-gradient(135deg, #820014 0%, #cf1322 55%, #7a0000 100%)'
    : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';

  return (
    <div style={{ background: headerBg, transition: 'background 0.5s ease', boxShadow: '0 4px 24px rgba(0,0,0,0.45)' }}>
      <style>{`
        @keyframes erDotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(1.35)} }
        @keyframes erIconPulse { 0%,100%{box-shadow:0 2px 12px rgba(0,0,0,0.25)} 50%{box-shadow:0 2px 20px rgba(255,77,79,0.5)} }
        .er-section-btn { transition: all 0.18s !important; }
        .er-section-btn:hover { background: rgba(255,255,255,0.12) !important; border-color: rgba(255,255,255,0.3) !important; }
      `}</style>

      {/* ── Row 1: Title + status chips ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px 12px' }}>
        <Space size={12}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: isCritical ? 'rgba(255,77,79,0.25)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${isCritical ? 'rgba(255,77,79,0.5)' : 'rgba(255,255,255,0.15)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: isCritical ? 'erIconPulse 1.4s infinite' : 'none',
          }}>
            <AlertOutlined style={{ color: isCritical ? '#ff4d4f' : 'white', fontSize: 20 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              Emergency &amp; Mustering
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
              Integrated response command &amp; personnel accountability
            </div>
          </div>
        </Space>

        <Space size={7}>
          {/* System status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: isEmergency ? 'rgba(255,77,79,0.2)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${isEmergency ? 'rgba(255,77,79,0.4)' : 'rgba(255,255,255,0.14)'}`,
            borderRadius: 7, padding: '5px 10px',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isEmergency ? '#ff4d4f' : '#52c41a',
              boxShadow: `0 0 0 2px ${isEmergency ? 'rgba(255,77,79,0.28)' : 'rgba(82,196,26,0.22)'}`,
              animation: isEmergency ? 'erDotPulse 1s infinite' : 'none',
            }} />
            <span style={{ color: isEmergency ? '#ff4d4f' : 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              {d.system_status || 'NORMAL'}
            </span>
          </div>

          {/* Active muster badge */}
          {musterCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: missingTotal > 0 ? 'rgba(255,77,79,0.2)' : 'rgba(74,222,128,0.12)',
              border: `1px solid ${missingTotal > 0 ? 'rgba(255,77,79,0.4)' : 'rgba(74,222,128,0.3)'}`,
              borderRadius: 7, padding: '5px 10px',
            }}>
              <TeamOutlined style={{ fontSize: 10, color: missingTotal > 0 ? '#ff4d4f' : '#4ade80' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: missingTotal > 0 ? '#ff4d4f' : '#4ade80' }}>
                {musterCount} Muster{missingTotal > 0 ? ` · ${missingTotal} Missing` : ''}
              </span>
            </div>
          )}

          {/* Active emergency count */}
          {(d.total_emergencies || 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,77,79,0.18)', border: '1px solid rgba(255,77,79,0.4)', borderRadius: 7, padding: '5px 10px' }}>
              <WarningOutlined style={{ fontSize: 10, color: '#ff4d4f' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ff4d4f' }}>{d.total_emergencies} Active</span>
            </div>
          )}

          {/* WS dot */}
          <Tooltip title={`WebSocket: ${wsStatus}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '5px 9px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: wsColor, boxShadow: wsStatus === 'connected' ? `0 0 4px ${wsColor}` : 'none' }} />
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>{wsStatus === 'connected' ? 'Live' : 'Offline'}</span>
            </div>
          </Tooltip>

          <Button icon={<ReloadOutlined />} size="small" onClick={onRefresh} loading={isLoading}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: 'white', borderRadius: 7, fontSize: 11 }} />
        </Space>
      </div>

      {/* ── Row 2: Section switcher cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 24px 16px' }}>
        {SECTIONS.map(sec => {
          const isActive = section === sec.key;
          const hasBadge = sec.key === 'emergency' ? isEmergency : musterCount > 0;
          const badgeColor = sec.key === 'emergency' ? '#ff4d4f' : (missingTotal > 0 ? '#ff4d4f' : '#4ade80');
          return (
            <button
              key={sec.key}
              className="er-section-btn"
              onClick={() => setSection(sec.key)}
              style={{
                background: isActive ? `${sec.accentColor}18` : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${isActive ? sec.accentColor : 'rgba(255,255,255,0.1)'}`,
                borderBottom: isActive ? `3px solid ${sec.accentColor}` : '3px solid transparent',
                borderRadius: 12,
                padding: '12px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isActive ? `0 4px 20px ${sec.accentColor}30` : 'none',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: isActive ? `${sec.accentColor}25` : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${isActive ? `${sec.accentColor}50` : 'rgba(255,255,255,0.12)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, color: isActive ? sec.accentColor : 'rgba(255,255,255,0.5)',
                  }}>
                    {sec.icon}
                  </div>
                  <div>
                    <div style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>
                      {sec.label}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2, lineHeight: 1.3 }}>
                      {sec.sub}
                    </div>
                  </div>
                </div>
                {hasBadge && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: badgeColor, flexShrink: 0,
                    boxShadow: `0 0 0 2px ${badgeColor}35`,
                    animation: 'erDotPulse 1.2s infinite',
                  }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Root component ─────────────────────────────────────────── */
const EmergencyResponse = () => {
  const qc = useQueryClient();
  const [section, setSection] = useState('emergency');
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);

  const { data: statusData, isLoading, refetch: refetchEmergency } = useQuery({
    queryKey: ['emergency-status'],
    queryFn:  () => apiService.get('/api/emergency/status/'),
    refetchInterval: 30000,
  });
  const emergencyData = statusData?.data?.data || {};

  const { data: musterRaw, refetch: refetchMuster } = useQuery({
    queryKey: ['muster-active'],
    queryFn:  () => apiService.get('/api/mustering/events/?status=0'),
    refetchInterval: 15000,
  });
  const activeEvents = Array.isArray(musterRaw?.data) ? musterRaw.data : [];

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.hostname}:8000/api/emergency/ws/emergency/?token=${token}`);
    wsRef.current = ws;
    ws.onopen  = () => setWsStatus('connected');
    ws.onclose = () => setWsStatus('disconnected');
    ws.onerror = () => setWsStatus('error');
    ws.onmessage = () => {
      qc.invalidateQueries(['emergency-status']);
      qc.invalidateQueries(['muster-active']);
    };
    return () => { ws.close(); wsRef.current = null; };
  }, []); // eslint-disable-line

  const handleRefresh = () => {
    refetchEmergency();
    refetchMuster();
    qc.invalidateQueries(['muster-zones']);
    qc.invalidateQueries(['muster-events']);
  };

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UnifiedHeader
        section={section}
        setSection={setSection}
        emergencyData={emergencyData}
        activeEvents={activeEvents}
        wsStatus={wsStatus}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />
      <div style={{ flex: 1, width: '100%', minWidth: 0 }}>
        {section === 'emergency'
          ? <EmergencyManagement embedded />
          : <MusteringManagement embedded />}
      </div>
    </div>
  );
};

export default EmergencyResponse;
