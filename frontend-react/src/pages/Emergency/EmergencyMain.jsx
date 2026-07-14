/**
 * Emergency & Mustering Command Center — POB v2.0
 * NOC/SOC dark control-room layout: left nav sidebar, content, right live-status panel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import {
  LockOutlined, FireOutlined, BellOutlined, ApiOutlined,
  ThunderboltOutlined, FileTextOutlined, AuditOutlined, DashboardOutlined,
  TeamOutlined, AimOutlined, EnvironmentOutlined, MobileOutlined,
  WifiOutlined, DisconnectOutlined, WarningOutlined, AlertOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ReloadOutlined, UserOutlined,
  MailOutlined,
} from '@ant-design/icons';

import EmergencyDashboard     from './EmergencyDashboard';
import EmergencyLockdown      from './EmergencyLockdown';
import EmergencyFireMode      from './EmergencyFireMode';
import EmergencyNotifications from './EmergencyNotifications';
import EmailSetup            from './EmailSetup';
import EmergencyDevices       from './EmergencyDevices';
import EmergencyTriggers      from './EmergencyTriggers';
import EmergencyPlans         from './EmergencyPlans';
import EmergencyAudit         from './EmergencyAudit';
import Mustering              from '../Mustering/Mustering';
import MusteringManagement    from '../Mustering/MusteringManagement';
import MusteringLiveMap       from '../Mustering/MusteringLiveMap';
import MusteringMobile        from '../Mustering/MusteringMobile';

// ─── Design tokens ──────────────────────────────────────────────────────────
const T = {
  // Backgrounds
  sidebarBg:   '#07101f',
  sidebarHover:'rgba(255,255,255,0.04)',
  sidebarSel:  'rgba(59,130,246,0.12)',
  contentBg:   '#0d1526',
  panelBg:     '#060e1c',
  cardBg:      '#111e30',
  // Borders
  border:      'rgba(255,255,255,0.06)',
  borderHi:    'rgba(255,255,255,0.12)',
  // Text
  text:        '#f1f5f9',
  textSub:     '#94a3b8',
  textMuted:   '#3d556e',
  // Status
  red:         '#ef4444',
  redBg:       'rgba(239,68,68,0.10)',
  redBorder:   'rgba(239,68,68,0.25)',
  amber:       '#f59e0b',
  amberBg:     'rgba(245,158,11,0.10)',
  amberBorder: 'rgba(245,158,11,0.25)',
  green:       '#22c55e',
  greenBg:     'rgba(34,197,94,0.10)',
  greenBorder: 'rgba(34,197,94,0.25)',
  blue:        '#3b82f6',
  blueBg:      'rgba(59,130,246,0.10)',
  blueBorder:  'rgba(59,130,246,0.25)',
  // Sizing
  sidebarW:    208,
  panelW:      256,
};

// CSS keyframes injected once
const KEYFRAMES = `
  @keyframes ccPulseRing {
    0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
    50%      { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
  }
  @keyframes ccDot {
    0%,100% { opacity:1; }
    50%      { opacity:0.35; }
  }
  @keyframes ccSpin {
    to { transform: rotate(360deg); }
  }
  .cc-nav-btn:hover { background: ${T.sidebarHover} !important; }
`;

// ─── Navigation definitions ──────────────────────────────────────────────────
const EMERGENCY_NAV = [
  { id: 'e-dashboard',  label: 'Dashboard',     icon: <DashboardOutlined />,     Component: EmergencyDashboard,     desc: 'Live status'       },
  { id: 'e-lockdown',   label: 'Lockdown',      icon: <LockOutlined />,          Component: EmergencyLockdown,      desc: 'Access control'    },
  { id: 'e-fire',       label: 'Fire Mode',     icon: <FireOutlined />,          Component: EmergencyFireMode,      desc: 'Evacuation'        },
  { id: 'e-notify',     label: 'Notifications', icon: <BellOutlined />,          Component: EmergencyNotifications, desc: 'Mass alerts'       },
  { id: 'e-email',      label: 'Email Setup',   icon: <MailOutlined />,          Component: EmailSetup,             desc: 'SMTP & domain'     },
  { id: 'e-devices',    label: 'Devices',       icon: <ApiOutlined />,           Component: EmergencyDevices,       desc: 'Sirens & relays'   },
  { id: 'e-triggers',   label: 'Triggers',      icon: <ThunderboltOutlined />,   Component: EmergencyTriggers,      desc: 'Panic & automation'},
  { id: 'e-plans',      label: 'Plans',         icon: <FileTextOutlined />,      Component: EmergencyPlans,         desc: 'Procedures'        },
  { id: 'e-audit',      label: 'Audit Trail',   icon: <AuditOutlined />,         Component: EmergencyAudit,         desc: 'Event history'     },
];

const MUSTERING_NAV = [
  { id: 'm-overview',   label: 'Overview',      icon: <TeamOutlined />,          Component: Mustering,              desc: 'POB summary'       },
  { id: 'm-events',     label: 'Live Events',   icon: <AimOutlined />,           Component: MusteringManagement,    desc: 'Active headcount'  },
  { id: 'm-map',        label: 'Zone Map',      icon: <EnvironmentOutlined />,   Component: MusteringLiveMap,       desc: 'Spatial view'      },
  { id: 'm-mobile',     label: 'Mobile Check-in', icon: <MobileOutlined />,      Component: MusteringMobile,        desc: 'QR check-in'       },
];

const ALL_NAV = [...EMERGENCY_NAV, ...MUSTERING_NAV];

// ─── Helpers ────────────────────────────────────────────────────────────────
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Pulsing status dot */
const Dot = ({ color, pulse = false, size = 7 }) => (
  <span style={{
    display: 'inline-block',
    width: size, height: size,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
    animation: pulse ? 'ccDot 1.2s ease-in-out infinite' : 'none',
  }} />
);

/** Small label chip */
const Chip = ({ label, color, bg, border }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    color, background: bg, border: `1px solid ${border}`,
    borderRadius: 4, padding: '2px 7px',
  }}>
    {label}
  </span>
);

/** Section divider for sidebar */
const SidebarDivider = ({ label }) => (
  <div style={{ padding: '14px 16px 6px' }}>
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
      color: T.textMuted, textTransform: 'uppercase',
    }}>{label}</div>
  </div>
);

/** Single nav item button */
const NavItem = ({ item, isActive, accentColor, onClick }) => (
  <button
    onClick={() => onClick(item.id)}
    className="cc-nav-btn"
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', padding: '8px 14px',
      border: 'none', cursor: 'pointer',
      background: isActive ? T.sidebarSel : 'transparent',
      borderLeft: `2px solid ${isActive ? accentColor : 'transparent'}`,
      transition: 'background 0.12s, border-color 0.12s',
      textAlign: 'left',
    }}
  >
    <span style={{ fontSize: 14, color: isActive ? accentColor : T.textMuted, width: 18, flexShrink: 0 }}>
      {item.icon}
    </span>
    <span style={{
      fontSize: 12.5,
      fontWeight: isActive ? 600 : 400,
      color: isActive ? T.text : T.textSub,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {item.label}
    </span>
  </button>
);

/** Left navigation sidebar */
const Sidebar = ({ activeId, onSelect, wsStatus, systemStatus }) => {
  const isEmergency = systemStatus === 'EMERGENCY';
  const isWarning   = systemStatus === 'WARNING';
  const statusColor = isEmergency ? T.red : isWarning ? T.amber : T.green;
  const statusBg    = isEmergency ? T.redBg : isWarning ? T.amberBg : T.greenBg;
  const statusBrd   = isEmergency ? T.redBorder : isWarning ? T.amberBorder : T.greenBorder;

  return (
    <div style={{
      width: T.sidebarW, flexShrink: 0,
      background: T.sidebarBg,
      borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* Brand */}
      <div style={{
        padding: '16px 14px 12px',
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: isEmergency ? T.redBg : T.blueBg,
            border: `1px solid ${isEmergency ? T.redBorder : T.blueBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: isEmergency ? 'ccPulseRing 1.4s infinite' : 'none',
          }}>
            <WarningOutlined style={{ color: isEmergency ? T.red : T.blue, fontSize: 15 }} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text, lineHeight: 1.2, letterSpacing: '0.04em' }}>
              COMMAND CENTER
            </div>
            <div style={{ fontSize: 9.5, color: T.textMuted, marginTop: 2, letterSpacing: '0.05em' }}>
              Emergency &amp; Mustering
            </div>
          </div>
        </div>

        {/* System status pill */}
        <div style={{
          marginTop: 10,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: statusBg,
          border: `1px solid ${statusBrd}`,
          borderRadius: 5, padding: '4px 9px',
        }}>
          <Dot color={statusColor} pulse={isEmergency || isWarning} size={6} />
          <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, letterSpacing: '0.06em' }}>
            {systemStatus || 'NORMAL'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, paddingTop: 4 }}>
        <SidebarDivider label="Emergency Response" />
        {EMERGENCY_NAV.map(item => (
          <NavItem key={item.id} item={item} isActive={activeId === item.id}
            accentColor={T.red} onClick={onSelect} />
        ))}

        <div style={{ margin: '10px 14px', borderTop: `1px solid ${T.border}` }} />

        <SidebarDivider label="Mustering" />
        {MUSTERING_NAV.map(item => (
          <NavItem key={item.id} item={item} isActive={activeId === item.id}
            accentColor={T.blue} onClick={onSelect} />
        ))}
      </div>

      {/* WS status footer */}
      <div style={{
        padding: '10px 14px',
        borderTop: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: 7,
        flexShrink: 0,
      }}>
        {wsStatus === 'connected'
          ? <WifiOutlined style={{ color: T.green, fontSize: 11 }} />
          : <DisconnectOutlined style={{ color: T.textMuted, fontSize: 11 }} />}
        <span style={{ fontSize: 10.5, color: wsStatus === 'connected' ? T.textSub : T.textMuted }}>
          {wsStatus === 'connected' ? 'Live feed active' : 'Reconnecting…'}
        </span>
        {wsStatus !== 'connected' && (
          <span style={{
            width: 10, height: 10, border: `1.5px solid ${T.textMuted}`,
            borderTopColor: 'transparent', borderRadius: '50%',
            display: 'inline-block',
            animation: 'ccSpin 0.9s linear infinite', flexShrink: 0,
          }} />
        )}
      </div>
    </div>
  );
};

/** Self-updating clock — avoids forcing LivePanel remount */
const LiveClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontSize: 10, color: T.textMuted }}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
};

/** Metric card for right panel */
const MetricCard = ({ label, value, sub, color, icon }) => (
  <div style={{
    background: T.cardBg, border: `1px solid ${T.border}`,
    borderRadius: 8, padding: '10px 12px', marginBottom: 8,
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: color || T.text, lineHeight: 1 }}>
          {value ?? '—'}
        </div>
        {sub && <div style={{ fontSize: 10.5, color: T.textSub, marginTop: 3 }}>{sub}</div>}
      </div>
      {icon && <span style={{ fontSize: 18, color: color ? `${color}88` : T.textMuted }}>{icon}</span>}
    </div>
  </div>
);

/** Alert row for right panel */
const AlertRow = ({ title, time, color }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '7px 0', borderBottom: `1px solid ${T.border}`,
  }}>
    <Dot color={color || T.amber} size={6} style={{ marginTop: 4, flexShrink: 0 }} />
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: T.textSub, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </div>
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{time}</div>
    </div>
  </div>
);

/** Right live-status panel */
const LivePanel = ({ emergencyData, activeMusters, loading }) => {
  const status = emergencyData?.system_status || 'NORMAL';
  const isEmergency = status === 'EMERGENCY';
  const pob = emergencyData?.pob_count ?? emergencyData?.total_personnel ?? '—';
  const locked = emergencyData?.doors_locked ?? '—';
  const activeEvts = emergencyData?.active_emergencies ?? [];
  const recentEvts = emergencyData?.recent_events ?? [];
  const zoneStatus = emergencyData?.zone_status ?? [];

  const fmtTime = (dt) => {
    if (!dt) return '';
    try {
      return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div style={{
      width: T.panelW, flexShrink: 0,
      background: T.panelBg,
      borderLeft: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 14px 10px',
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: T.textMuted, textTransform: 'uppercase' }}>
            Live Status
          </span>
          {loading && (
            <span style={{
              width: 10, height: 10, border: `1.5px solid ${T.textMuted}`,
              borderTopColor: T.blue, borderRadius: '50%', display: 'inline-block',
              animation: 'ccSpin 0.8s linear infinite',
            }} />
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 12px 0' }}>
        {/* POB metric */}
        <MetricCard
          label="Personnel on Board"
          value={pob}
          sub="current manifest"
          color={T.blue}
          icon={<UserOutlined />}
        />

        {/* Active emergencies */}
        <MetricCard
          label="Active Emergencies"
          value={Array.isArray(activeEvts) ? activeEvts.length : activeEvts}
          sub={isEmergency ? 'ALERT — response required' : 'all clear'}
          color={isEmergency ? T.red : T.green}
          icon={isEmergency ? <AlertOutlined /> : <CheckCircleOutlined />}
        />

        {/* Doors locked */}
        <MetricCard
          label="Doors Locked"
          value={locked}
          sub={emergencyData?.doors_unlocked != null ? `${emergencyData.doors_unlocked} unlocked` : undefined}
          color={locked > 0 ? T.amber : T.textSub}
          icon={<LockOutlined />}
        />

        {/* Active musters */}
        <MetricCard
          label="Active Muster Events"
          value={activeMusters?.length ?? 0}
          sub={activeMusters?.length > 0 ? 'headcount in progress' : 'no active drills'}
          color={activeMusters?.length > 0 ? T.amber : T.textSub}
          icon={<TeamOutlined />}
        />

        {/* Zone status strip */}
        {zoneStatus.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Zone Status
            </div>
            {zoneStatus.slice(0, 6).map((z, i) => {
              const hasAlert = z.emergency_active || z.lockdown_active || z.fire_mode_active;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 8px', borderRadius: 5, marginBottom: 4,
                  background: hasAlert ? T.redBg : T.cardBg,
                  border: `1px solid ${hasAlert ? T.redBorder : T.border}`,
                }}>
                  <span style={{ fontSize: 11, color: T.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                    {z.zone_name || `Zone ${z.zone_id}`}
                  </span>
                  <Dot color={hasAlert ? T.red : T.green} pulse={hasAlert} size={6} />
                </div>
              );
            })}
          </div>
        )}

        {/* Recent events */}
        {recentEvts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Recent Events
            </div>
            {recentEvts.slice(0, 5).map((ev, i) => (
              <AlertRow
                key={i}
                title={ev.description || ev.event_type || 'Emergency event'}
                time={fmtTime(ev.created_at || ev.start_time)}
                color={ev.status === 'ACTIVE' ? T.red : T.amber}
              />
            ))}
          </div>
        )}
      </div>

      {/* Timestamp footer */}
      <div style={{ padding: '8px 12px 10px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <ClockCircleOutlined style={{ fontSize: 10, color: T.textMuted }} />
          <LiveClock />
        </div>
      </div>
    </div>
  );
};

/** Top context bar */
const TopBar = ({ activeItem, systemStatus, wsStatus, onRefresh }) => {
  const isEmergency = systemStatus === 'EMERGENCY';
  const isWarning   = systemStatus === 'WARNING';
  const group       = EMERGENCY_NAV.find(n => n.id === activeItem?.id) ? 'Emergency Response' : 'Mustering';

  return (
    <div style={{
      height: 44, flexShrink: 0,
      background: T.sidebarBg,
      borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 8,
    }}>
      {/* Breadcrumb */}
      <span style={{ fontSize: 12, color: T.textMuted }}>{group}</span>
      <span style={{ color: T.textMuted, fontSize: 12 }}>/</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.textSub, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 13 }}>{activeItem?.icon}</span>
        {activeItem?.label}
      </span>

      <div style={{ flex: 1 }} />

      {/* Emergency banner */}
      {isEmergency && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderRadius: 5, padding: '3px 10px',
          animation: 'ccPulseRing 1.5s infinite',
        }}>
          <Dot color={T.red} pulse size={6} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.red, letterSpacing: '0.05em' }}>
            EMERGENCY ACTIVE
          </span>
        </div>
      )}
      {isWarning && !isEmergency && (
        <Chip label="WARNING" color={T.amber} bg={T.amberBg} border={T.amberBorder} />
      )}

      {/* WS chip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: T.cardBg, border: `1px solid ${T.border}`,
        borderRadius: 5, padding: '3px 9px',
      }}>
        <Dot color={wsStatus === 'connected' ? T.green : T.textMuted} size={5} pulse={wsStatus !== 'connected'} />
        <span style={{ fontSize: 10, color: T.textSub }}>
          {wsStatus === 'connected' ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.textMuted, fontSize: 13, padding: '4px 6px',
          borderRadius: 5, transition: 'color 0.15s',
          display: 'flex', alignItems: 'center',
        }}
        title="Refresh status"
        onMouseEnter={e => { e.currentTarget.style.color = T.blue; }}
        onMouseLeave={e => { e.currentTarget.style.color = T.textMuted; }}
      >
        <ReloadOutlined />
      </button>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const EmergencyMain = () => {
  const [activeId, setActiveId]           = useState('e-dashboard');
  const [wsStatus, setWsStatus]           = useState('disconnected');
  const [systemStatus, setSystemStatus]   = useState('NORMAL');
  const [emergencyData, setEmergencyData] = useState(null);
  const [activeMusters, setActiveMusters] = useState([]);
  const [dataLoading, setDataLoading]     = useState(false);

  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setDataLoading(true);
    try {
      const [emResp, musterResp] = await Promise.allSettled([
        fetch('/api/emergency/status/', { headers: authHeaders() }),
        fetch('/api/mustering/events/?status=0&limit=20', { headers: authHeaders() }),
      ]);

      if (emResp.status === 'fulfilled' && emResp.value.ok) {
        const json = await emResp.value.json();
        const d = json.data || json;
        setEmergencyData(d);
        setSystemStatus(d.system_status || 'NORMAL');
      }

      if (musterResp.status === 'fulfilled' && musterResp.value.ok) {
        const json = await musterResp.value.json();
        setActiveMusters(json.data || json.items || json || []);
      }
    } catch (_) {
      // silent — panel shows stale data
    } finally {
      setDataLoading(false);
    }
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/api/emergency/ws/emergency/`);

      ws.onopen = () => { setWsStatus('connected'); clearTimeout(reconnectRef.current); };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
          if (msg.type === 'system_status') {
            setSystemStatus(msg.data?.status || 'NORMAL');
          }
          if (['fire_mode', 'lockdown', 'panic', 'emergency_status'].includes(msg.type)) {
            fetchStatus();
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        reconnectRef.current = setTimeout(connectWs, 5000);
      };

      ws.onerror = () => { setWsStatus('disconnected'); };

      wsRef.current = ws;
    } catch (_) {
      setWsStatus('disconnected');
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
    connectWs();
    const dataInterval = setInterval(fetchStatus, 30000);

    return () => {
      clearInterval(dataInterval);
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [fetchStatus, connectWs]);

  // ── Resolve active component ───────────────────────────────────────────────
  const activeItem = ALL_NAV.find(n => n.id === activeId) || ALL_NAV[0];
  const { Component } = activeItem;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
      background: T.contentBg,
      fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Inject keyframes once */}
      <style>{KEYFRAMES}</style>

      {/* ── Left sidebar ── */}
      <Sidebar
        activeId={activeId}
        onSelect={setActiveId}
        wsStatus={wsStatus}
        systemStatus={systemStatus}
      />

      {/* ── Centre column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <TopBar
          activeItem={activeItem}
          systemStatus={systemStatus}
          wsStatus={wsStatus}
          onRefresh={fetchStatus}
        />

        {/* Content scroll area with antd dark theme */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <ConfigProvider theme={{ algorithm: antTheme.darkAlgorithm }}>
            {systemStatus === 'EMERGENCY' && (
              <div style={{
                background: T.redBg,
                borderBottom: `1px solid ${T.redBorder}`,
                padding: '9px 20px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <AlertOutlined style={{ color: T.red, fontSize: 14 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.red }}>
                  EMERGENCY SYSTEM ACTIVE —
                </span>
                <span style={{ fontSize: 12, color: `${T.red}bb` }}>
                  {Array.isArray(emergencyData?.active_emergencies)
                    ? `${emergencyData.active_emergencies.length} event(s) require immediate response`
                    : 'All personnel and systems on high alert'}
                </span>
              </div>
            )}

            <Component key={activeId} />
          </ConfigProvider>
        </div>
      </div>

      {/* ── Right status panel ── */}
      <LivePanel
        emergencyData={emergencyData}
        activeMusters={activeMusters}
        loading={dataLoading}
      />
    </div>
  );
};

export default EmergencyMain;
