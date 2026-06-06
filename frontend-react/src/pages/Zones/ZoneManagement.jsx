import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Dropdown,
  Popconfirm, Row, Col, Tabs, Progress,
  Drawer, Descriptions, Alert, Empty, Spin, App, Tooltip, Divider, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  EnvironmentOutlined, TeamOutlined, WifiOutlined,
  EyeOutlined, ApiOutlined, ClockCircleOutlined, GlobalOutlined,
  LoginOutlined, LogoutOutlined, CheckCircleOutlined,
  RadarChartOutlined, CompassOutlined, AlertOutlined,
  SafetyOutlined, LockOutlined, HomeOutlined,
  SwapOutlined, DesktopOutlined, SearchOutlined,
  ThunderboltOutlined, DashboardOutlined,
  CopyOutlined, InfoCircleOutlined, SendOutlined, PoweroffOutlined,
  SyncOutlined, UnlockOutlined, SettingOutlined, LinkOutlined,
  CheckOutlined, CloseOutlined, DownOutlined, DownloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import ZoneMapView from './ZoneMapView';
import POBDashboard from './POBDashboard';

/* ── Constants ─────────────────────────────────────────────────────────────── */

const ZONE_TYPE_LABELS = {
  LOCATION: 'Location', MUSTER_POINT: 'Muster Point', WORK_AREA: 'Work Area',
  OUTSIDE: 'Outside Area', TRANSIT: 'In Transit', RESTRICTED: 'Restricted',
  PUBLIC: 'Public', SAFE_HAVEN: 'Safe Haven', ACCOMMODATION: 'Accommodation',
  HELIPAD: 'Helipad', CONTROL_ROOM: 'Control Room', STORAGE: 'Storage',
  EMERGENCY: 'Emergency',
};

const ZONE_STYLE = {
  LOCATION:     { color: '#10B981', dark: '#059669', bg: '#ECFDF5', icon: <EnvironmentOutlined /> },
  MUSTER_POINT: { color: '#10B981', dark: '#059669', bg: '#ECFDF5', icon: <SafetyOutlined /> },
  WORK_AREA:    { color: '#EF4444', dark: '#DC2626', bg: '#FEF2F2', icon: <DesktopOutlined /> },
  OUTSIDE:      { color: '#6B7280', dark: '#4B5563', bg: '#F9FAFB', icon: <GlobalOutlined /> },
  TRANSIT:      { color: '#0EA5E9', dark: '#0284C7', bg: '#F0F9FF', icon: <SwapOutlined /> },
  RESTRICTED:   { color: '#7C3AED', dark: '#6D28D9', bg: '#F5F3FF', icon: <LockOutlined /> },
  PUBLIC:       { color: '#10B981', dark: '#059669', bg: '#ECFDF5', icon: <GlobalOutlined /> },
  SAFE_HAVEN:   { color: '#0078D4', dark: '#005A9E', bg: '#EFF6FF', icon: <SafetyOutlined /> },
  ACCOMMODATION:{ color: '#8B5CF6', dark: '#7C3AED', bg: '#F5F3FF', icon: <HomeOutlined /> },
  HELIPAD:      { color: '#0078D4', dark: '#005A9E', bg: '#EFF6FF', icon: <CompassOutlined /> },
  CONTROL_ROOM: { color: '#F59E0B', dark: '#D97706', bg: '#FFFBEB', icon: <ThunderboltOutlined /> },
  STORAGE:      { color: '#92400E', dark: '#78350F', bg: '#FEF3C7', icon: <RadarChartOutlined /> },
  EMERGENCY:    { color: '#EF4444', dark: '#DC2626', bg: '#FEF2F2', icon: <AlertOutlined /> },
};

const HAZARD_STYLE = {
  LOW:      { color: '#10B981', bg: '#ECFDF5', border: '#6EE7B7' },
  MEDIUM:   { color: '#F59E0B', bg: '#FFFBEB', border: '#FCD34D' },
  HIGH:     { color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5' },
  CRITICAL: { color: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' },
};

const STATUS_STYLE = {
  ACTIVE:      { color: '#10B981', bg: '#ECFDF5', border: '#6EE7B7', pulse: true },
  INACTIVE:    { color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB', pulse: false },
  MAINTENANCE: { color: '#F59E0B', bg: '#FFFBEB', border: '#FCD34D', pulse: true },
  EMERGENCY:   { color: '#EF4444', bg: '#FEF2F2', border: '#FCA5A5', pulse: true },
  LOCKDOWN:    { color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD', pulse: true },
};

const PRESET_COLORS = [
  { label: 'Green — Muster / Location', value: '#52c41a' },
  { label: 'Red — Work Area / Emergency', value: '#f5222d' },
  { label: 'Dark Gray — Outside', value: '#595959' },
  { label: 'Teal — In Transit', value: '#13c2c2' },
  { label: 'Dark Maroon — Restricted', value: '#6B1E35' },
  { label: 'Blue — Safe Haven / Helipad', value: '#0078D4' },
  { label: 'Pink — Muster Total', value: '#eb2f96' },
  { label: 'Brown — Storage', value: '#8B4513' },
  { label: 'Orange — Warning', value: '#fa8c16' },
  { label: 'Purple — Accommodation', value: '#531dab' },
];

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const timeAgo = (iso) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const getZoneStyle = (type) => ZONE_STYLE[type] || { color: '#6B7280', dark: '#4B5563', bg: '#F9FAFB', icon: <GlobalOutlined /> };
const getStatusStyle = (s) => STATUS_STYLE[s] || STATUS_STYLE.INACTIVE;
const getHazardStyle = (h) => HAZARD_STYLE[h] || HAZARD_STYLE.LOW;

/* ── ZoneCard ──────────────────────────────────────────────────────────────── */

const ZoneCard = ({ zone, onView, onEdit, onAssignReader, onDelete, onStatusChange }) => {
  const zs = getZoneStyle(zone.zone_type);
  const ss = getStatusStyle(zone.status);
  const hs = getHazardStyle(zone.hazard_level);
  const count = zone.current_personnel_count ?? 0;
  const pct = zone.max_capacity ? Math.min(100, Math.round((count / zone.max_capacity) * 100)) : null;
  const capColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981';

  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      border: '1px solid #E5E7EB',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Type color bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${zs.dark}, ${zs.color})` }} />

      {/* Card body */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: '#111827', lineHeight: 1.25, marginBottom: 2 }}>
              {zone.name}
            </div>
            <span style={{ fontSize: 10.5, color: '#9CA3AF', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
              {zone.code}
            </span>
          </div>
          {/* Status pill — click to change */}
          {onStatusChange ? (
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              menu={{
                selectedKeys: [zone.status],
                items: ['ACTIVE','INACTIVE','MAINTENANCE','EMERGENCY','LOCKDOWN'].map(s => {
                  const ss2 = getStatusStyle(s);
                  return {
                    key: s,
                    label: (
                      <div style={{ display:'flex',alignItems:'center',gap:8,padding:'2px 0' }}>
                        <div style={{ width:8,height:8,borderRadius:'50%',background:ss2.color,flexShrink:0 }} />
                        <span style={{color:ss2.color,fontWeight:600,fontSize:12}}>{s.charAt(0)+s.slice(1).toLowerCase()}</span>
                      </div>
                    ),
                    onClick: () => onStatusChange(zone.id, s),
                  };
                }),
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                background: ss.bg, border: `1px solid ${ss.border}`,
                borderRadius: 20, padding: '3px 9px', cursor: 'pointer',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: ss.color,
                  animation: ss.pulse ? 'zoneDotPulse 2s infinite' : 'none',
                }} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: ss.color }}>{zone.status}</span>
                <DownOutlined style={{ fontSize: 7, color: ss.color, opacity: 0.6 }} />
              </div>
            </Dropdown>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              background: ss.bg, border: `1px solid ${ss.border}`,
              borderRadius: 20, padding: '3px 9px',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: ss.color,
                animation: ss.pulse ? 'zoneDotPulse 2s infinite' : 'none',
              }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: ss.color }}>{zone.status}</span>
            </div>
          )}
        </div>

        {/* Type + Hazard tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: zs.bg, borderRadius: 6, padding: '3px 8px',
            border: `1px solid ${zs.color}30`,
          }}>
            <span style={{ color: zs.color, fontSize: 11 }}>{zs.icon}</span>
            <span style={{ color: zs.color, fontSize: 11, fontWeight: 600 }}>
              {ZONE_TYPE_LABELS[zone.zone_type] || zone.zone_type}
            </span>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: hs.bg, borderRadius: 6, padding: '3px 8px',
            border: `1px solid ${hs.border}`,
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: hs.color }}>
              {zone.hazard_level} HAZARD
            </span>
          </div>
        </div>

        {/* Personnel count */}
        <div style={{
          borderRadius: 10, padding: '14px 16px', textAlign: 'center',
          background: `linear-gradient(135deg, ${zs.dark} 0%, ${zs.color} 100%)`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -12, right: -12, width: 60, height: 60,
            borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
          }} />
          <div style={{ fontSize: 44, fontWeight: 900, color: 'white', lineHeight: 1, letterSpacing: -2, position: 'relative' }}>
            {count}
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.82)', fontWeight: 600, letterSpacing: '0.08em', marginTop: 3, position: 'relative' }}>
            PERSONNEL ON BOARD
          </div>
        </div>

        {/* Capacity */}
        {zone.max_capacity ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#6B7280', marginBottom: 5 }}>
              <span>Capacity</span>
              <span style={{ fontWeight: 600, color: capColor }}>{count} / {zone.max_capacity} ({pct}%)</span>
            </div>
            <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: `linear-gradient(90deg, ${capColor}aa, ${capColor})`,
                borderRadius: 3, transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        ) : null}

        {/* Meta row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6B7280' }}>
              <ApiOutlined style={{ color: '#7C3AED', fontSize: 13 }} />
              <span>{zone.device_count ?? zone.reader_count ?? 0} reader{(zone.device_count ?? zone.reader_count ?? 0) !== 1 ? 's' : ''}</span>
            </div>
            {zone.state && (
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{zone.state}</span>
            )}
          </div>

          {zone.latitude && zone.longitude ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#6B7280' }}>
              <EnvironmentOutlined style={{ color: '#EF4444', fontSize: 12 }} />
              <span>{zone.latitude}°N, {zone.longitude}°E</span>
              <a
                href={`https://www.openstreetmap.org/?mlat=${zone.latitude}&mlon=${zone.longitude}#map=14/${zone.latitude}/${zone.longitude}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: '#0078D4', fontSize: 11, marginLeft: 2 }}
              >↗</a>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: '#D1D5DB', display: 'flex', alignItems: 'center', gap: 5 }}>
              <EnvironmentOutlined style={{ fontSize: 12 }} />
              <span>No GPS coordinates</span>
            </div>
          )}

          {zone.last_activity_time && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#6B7280' }}>
              <ClockCircleOutlined style={{ color: '#0EA5E9', fontSize: 12 }} />
              <span>Last activity {timeAgo(zone.last_activity_time)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions footer */}
      <div style={{
        borderTop: '1px solid #F3F4F6',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      }}>
        {[
          { icon: <EyeOutlined />, label: 'Detail', color: '#0078D4', onClick: () => onView(zone) },
          { icon: <EditOutlined />, label: 'Edit', color: '#10B981', onClick: () => onEdit(zone) },
          { icon: <ApiOutlined />, label: 'Readers', color: '#7C3AED', onClick: () => onAssignReader(zone) },
        ].map(btn => (
          <button key={btn.label} onClick={btn.onClick} style={{
            all: 'unset', textAlign: 'center', padding: '9px 4px',
            fontSize: 11, color: btn.color, fontWeight: 500, cursor: 'pointer',
            borderRight: '1px solid #F3F4F6', transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ fontSize: 14, marginBottom: 2 }}>{btn.icon}</div>
            {btn.label}
          </button>
        ))}
        <Popconfirm
          title="Delete zone?"
          description="This permanently removes the zone and unassigns all readers."
          onConfirm={() => onDelete(zone.id)}
          okText="Delete" okButtonProps={{ danger: true }} cancelText="Cancel"
        >
          <button style={{
            all: 'unset', textAlign: 'center', padding: '9px 4px',
            fontSize: 11, color: '#EF4444', fontWeight: 500, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ fontSize: 14, marginBottom: 2 }}><DeleteOutlined /></div>
            Delete
          </button>
        </Popconfirm>
      </div>
    </div>
  );
};

/* ── Zone Detail Drawer ────────────────────────────────────────────────────── */

const ZoneDetailDrawer = ({ zone, open, onClose }) => {
  const [drawerTab, setDrawerTab] = useState('personnel');
  const [reassignReader, setReassignReader] = useState(null); // {reader_id, alias, sn}
  const [reassignZoneId, setReassignZoneId] = useState(null);
  const { message } = App.useApp();
  const qc = useQueryClient();

  const removeReaderMutation = useMutation({
    mutationFn: ({ zoneId, readerId }) =>
      apiService.delete(`/api/v1/zones/${zoneId}/readers/${readerId}`),
    onSuccess: () => {
      message.success('Reader removed from zone');
      qc.invalidateQueries({ queryKey: ['zone-readers', zone?.id] });
      qc.invalidateQueries({ queryKey: ['zones-dashboard'] });
    },
    onError: (err) => message.error(err?.message || 'Failed to remove reader'),
  });

  const reassignMutation = useMutation({
    mutationFn: ({ newZoneId, deviceId }) =>
      apiService.post(`/api/v1/zones/${newZoneId}/assign-reader`, { device_id: deviceId }),
    onSuccess: (res) => {
      message.success(res?.moved_from ? 'Reader moved to zone' : 'Reader assigned to zone');
      setReassignReader(null); setReassignZoneId(null);
      qc.invalidateQueries({ queryKey: ['zone-readers', zone?.id] });
      if (res?.zone_id) qc.invalidateQueries({ queryKey: ['zone-readers', res.zone_id] });
      qc.invalidateQueries({ queryKey: ['zones-dashboard'] });
      qc.invalidateQueries({ queryKey: ['adms-terminals'] });
      qc.invalidateQueries({ queryKey: ['available-devices'] });
    },
    onError: (err) => message.error(err?.message || 'Failed to reassign reader'),
  });

  const { data: allZones } = useQuery({
    queryKey: ['zones-list-simple'],
    queryFn: () => apiService.get('/api/v1/zones/dashboard'),
    enabled: !!reassignReader,
    select: (d) => (Array.isArray(d) ? d : []).filter(z => z.id !== zone?.id),
  });

  const { data: personnel, isLoading: pLoading } = useQuery({
    queryKey: ['zone-personnel', zone?.id],
    queryFn: () => apiService.get(`/api/v1/zones/${zone.id}/current-personnel`),
    enabled: !!zone && open, refetchInterval: 10000,
  });
  const { data: tracking, isLoading: tLoading } = useQuery({
    queryKey: ['zone-tracking', zone?.id],
    queryFn: () => apiService.get(`/api/v1/zones/${zone.id}/tracking?limit=100`),
    enabled: !!zone && open, refetchInterval: 15000,
  });
  const { data: readers, isLoading: rLoading } = useQuery({
    queryKey: ['zone-readers', zone?.id],
    queryFn: () => apiService.get(`/api/v1/zones/${zone.id}/readers`),
    enabled: !!zone && open,
  });

  if (!zone) return null;

  const zs = getZoneStyle(zone.zone_type);
  const ss = getStatusStyle(zone.status);
  const hs = getHazardStyle(zone.hazard_level);
  const personnelList = Array.isArray(personnel) ? personnel : [];
  const trackingList  = Array.isArray(tracking)  ? tracking  : [];
  const readerList    = Array.isArray(readers)    ? readers   : [];
  const count = zone.current_personnel_count ?? 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={660}
      styles={{ header: { padding: 0, border: 'none' }, body: { padding: 0 } }}
      title={
        <div style={{
          background: `linear-gradient(135deg, ${zs.dark} 0%, ${zs.color} 100%)`,
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: 'white',
            }}>{zs.icon}</div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>{zone.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3, fontFamily: 'monospace' }}>
                {zone.code} · {ZONE_TYPE_LABELS[zone.zone_type] || zone.zone_type}
              </div>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)',
            borderRadius: 12, padding: '10px 18px', textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.25)',
          }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: 'white', lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 600, letterSpacing: '0.06em', marginTop: 2 }}>ON BOARD</div>
          </div>
        </div>
      }
    >
      {/* Meta strip */}
      <div style={{ padding: '14px 24px', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'Status', value: (
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:7,height:7,borderRadius:'50%',background:ss.color, animation: ss.pulse ? 'zoneDotPulse 2s infinite' : 'none' }} />
                <span style={{ color:ss.color, fontWeight:600, fontSize:12 }}>{zone.status}</span>
              </div>
            )},
            { label: 'Hazard', value: <span style={{ color:hs.color, fontWeight:600, fontSize:12 }}>{zone.hazard_level}</span> },
            { label: 'Access', value: zone.access_level },
            { label: 'State',  value: zone.state || '—' },
            { label: 'Capacity', value: zone.max_capacity ? `${count} / ${zone.max_capacity}` : '—' },
            { label: 'Readers', value: `${readerList.length} device${readerList.length !== 1 ? 's' : ''}` },
          ].map(item => (
            <div key={item.label} style={{
              background: 'white', border: '1px solid #E5E7EB', borderRadius: 8,
              padding: '6px 12px', minWidth: 90,
            }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12.5, color: '#1F2937', fontWeight: 500 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 24px' }}>
        <Tabs
          size="small"
          activeKey={drawerTab}
          onChange={setDrawerTab}
          style={{ marginTop: 4 }}
          items={[
            {
              key: 'personnel',
              label: <Space size={4}><TeamOutlined />Now ({personnelList.length})</Space>,
              children: (
                <Spin spinning={pLoading}>
                  {personnelList.length === 0 ? (
                    <Empty description="No personnel currently on board" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '32px 0' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 16 }}>
                      {personnelList.map((p) => (
                        <div key={p.emp_code} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', background: '#F6FFF8', borderRadius: 8,
                          border: '1px solid #D1FAE5',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 8,
                              background: 'linear-gradient(135deg, #059669, #10B981)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontSize: 13, fontWeight: 700,
                            }}>
                              {(p.full_name?.[0] || p.emp_code?.[0] || 'P').toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{p.full_name}</div>
                              <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{p.emp_code}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 11 }}>
                            <div style={{ color: '#10B981', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <LoginOutlined />Clocked In
                            </div>
                            <div style={{ color: '#9CA3AF', marginTop: 2 }}>{fmtTime(p.punch_time)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Spin>
              ),
            },
            {
              key: 'activity',
              label: <Space size={4}><ClockCircleOutlined />Activity</Space>,
              children: (
                <Spin spinning={tLoading}>
                  <Table
                    dataSource={trackingList}
                    rowKey={(_, i) => i}
                    size="small"
                    pagination={{ pageSize: 15, size: 'small' }}
                    style={{ marginTop: 4 }}
                    columns={[
                      {
                        title: 'Personnel', key: 'person',
                        render: (_, r) => (
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 12 }}>{r.full_name}</div>
                            <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>{r.emp_code}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Event', dataIndex: 'event_type', width: 80,
                        render: e => e === 'CLOCK_IN'
                          ? <span style={{ color:'#10B981', fontSize:11, fontWeight:600 }}>↑ IN</span>
                          : <span style={{ color:'#EF4444', fontSize:11, fontWeight:600 }}>↓ OUT</span>,
                      },
                      { title: 'Reader', dataIndex: 'device_sn', width: 110, render: s => <code style={{ fontSize: 10 }}>{s}</code> },
                      { title: 'Time', dataIndex: 'punch_time', width: 120, render: fmtTime },
                    ]}
                  />
                </Spin>
              ),
            },
            {
              key: 'readers',
              label: <Space size={4}><ApiOutlined />Readers ({readerList.length})</Space>,
              children: (
                <Spin spinning={rLoading}>
                  {readerList.length === 0 ? (
                    <Empty description="No readers assigned" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '32px 0' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
                      {readerList.map((r) => (
                        <div key={r.reader_id} style={{
                          padding: '12px 14px', borderRadius: 10,
                          background: r.state === 1 ? '#F0FDF4' : '#F9FAFB',
                          border: `1px solid ${r.state === 1 ? '#BBF7D0' : '#E5E7EB'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 8,
                              background: r.state === 1
                                ? 'linear-gradient(135deg,#059669,#10B981)'
                                : 'linear-gradient(135deg,#6B7280,#9CA3AF)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontSize: 16,
                            }}>
                              <WifiOutlined />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {r.alias}
                                {(() => {
                                  const p = r.reader_purpose || 'ATTENDANCE';
                                  const cfg = {
                                    ACCESS_ENTRY:  { color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', label: '▶ Entry'     },
                                    ACCESS_EXIT:   { color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', label: '◀ Exit'      },
                                    ATTENDANCE:    { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: '⏱ T&A'       },
                                    MUSTERING:     { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: '🔔 Muster'   },
                                    POB:           { color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', label: '👤 POB'      },
                                    EMERGENCY:     { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: '🚨 Emergency' },
                                  }[p] || { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: p };
                                  return (
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, padding: '1px 6px',
                                      borderRadius: 4, border: `1px solid ${cfg.border}`,
                                      background: cfg.bg, color: cfg.color,
                                    }}>{cfg.label}</span>
                                  );
                                })()}
                              </div>
                              <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>
                                {r.sn}{r.ip_address ? ` · ${r.ip_address}` : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{
                                fontSize: 11, fontWeight: 600,
                                color: r.state === 1 ? '#10B981' : '#9CA3AF',
                              }}>{r.state === 1 ? '● Online' : '○ Offline'}</div>
                              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                                {timeAgo(r.last_activity)}
                              </div>
                            </div>
                            <Button
                              size="small"
                              icon={<SwapOutlined />}
                              onClick={() => { setReassignReader(r); setReassignZoneId(null); }}
                              style={{ fontSize: 11 }}
                            >
                              Reassign
                            </Button>
                            <Popconfirm
                              title="Remove this reader from the zone?"
                              description="The reader will be unassigned and can be added to another zone."
                              okText="Remove"
                              okType="danger"
                              onConfirm={() => removeReaderMutation.mutate({ zoneId: zone.id, readerId: r.reader_id })}
                            >
                              <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                loading={removeReaderMutation.isPending}
                                style={{ fontSize: 11 }}
                              >
                                Remove
                              </Button>
                            </Popconfirm>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Spin>
              ),
            },
          ]}
        />
      </div>

      {/* Reassign reader modal */}
      <Modal
        open={!!reassignReader}
        title={`Reassign ${reassignReader?.alias || 'Reader'} to another zone`}
        okText="Move Reader"
        onOk={() => {
          if (!reassignZoneId) { message.warning('Select a target zone'); return; }
          reassignMutation.mutate({ newZoneId: reassignZoneId, deviceId: reassignReader.reader_id });
        }}
        confirmLoading={reassignMutation.isPending}
        onCancel={() => { setReassignReader(null); setReassignZoneId(null); }}
        width={440}
      >
        <p style={{ marginBottom: 12, color: '#6B7280', fontSize: 13 }}>
          Moving <strong>{reassignReader?.alias}</strong> ({reassignReader?.sn}) from <strong>{zone?.name}</strong> to:
        </p>
        <Select
          placeholder="Select target zone"
          style={{ width: '100%' }}
          value={reassignZoneId}
          onChange={setReassignZoneId}
          showSearch
          optionFilterProp="label"
        >
          {(allZones || []).map(z => (
            <Select.Option key={z.id} value={z.id} label={z.name}>
              {z.name}
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </Drawer>
  );
};

/* ── ADMS Readers Tab ──────────────────────────────────────────────────────── */

const CMD_PRESETS = [
  { label: 'Open Door (5s)',    value: 'RELAY,0,5',     icon: <UnlockOutlined />, color: '#10B981' },
  { label: 'Open Door (10s)',   value: 'RELAY,0,10',    icon: <UnlockOutlined />, color: '#10B981' },
  { label: 'Restart Device',   value: 'REBOOT',         icon: <PoweroffOutlined />, color: '#EF4444' },
  { label: 'Sync Time',        value: 'SYNCTIME',       icon: <SyncOutlined />,   color: '#1D4ED8' },
  { label: 'Clear Attendance', value: 'CLEAR ATTLOG',   icon: <DeleteOutlined />, color: '#F59E0B' },
  { label: 'Lock Door (relay off)', value: 'RELAY,0,0',   icon: <LockOutlined />,  color: '#7C3AED' },
  { label: 'Emergency Unlock (5m)', value: 'RELAY,0,300', icon: <AlertOutlined />, color: '#EF4444' },
];

const OPER_EVENT_META = {
  0: { label: 'Door Normal',          color: '#10B981', bg: '#ECFDF5' },
  1: { label: 'Door Alarm',           color: '#EF4444', bg: '#FEF2F2' },
  2: { label: 'Tamper',               color: '#EF4444', bg: '#FEF2F2' },
  3: { label: 'Anti-Passback',        color: '#F59E0B', bg: '#FFFBEB' },
  4: { label: 'Duress',               color: '#7C3AED', bg: '#F5F3FF' },
  5: { label: 'Fire Unlock',          color: '#F97316', bg: '#FFF7ED' },
  6: { label: 'Emergency Lock',       color: '#EF4444', bg: '#FEF2F2' },
  8: { label: 'Door Open Too Long',   color: '#F59E0B', bg: '#FFFBEB' },
  200: { label: 'Admin Op',           color: '#1D4ED8', bg: '#EFF6FF' },
};

const ReadersTab = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [search,          setSearch]          = useState('');
  const [activeSubTab,    setActiveSubTab]    = useState('readers');
  const [cmdModal,        setCmdModal]        = useState(null);
  const [cmdValue,        setCmdValue]        = useState('');
  const [customCmd,       setCustomCmd]       = useState('');
  const [addModal,        setAddModal]        = useState(false);
  const [addForm]                             = Form.useForm();
  const [copied,          setCopied]          = useState(false);
  const [editModal,       setEditModal]       = useState(null);
  const [editAlias,       setEditAlias]       = useState('');
  const [editIp,          setEditIp]          = useState('');
  const [capModal,        setCapModal]        = useState(null);  // device for capability panel
  const [pushUsersModal,  setPushUsersModal]  = useState(null);  // device for push users
  const [pushTplModal,    setPushTplModal]    = useState(null);  // device for push templates
  const [pushTzModal,     setPushTzModal]     = useState(null);  // device for push timezones
  const [pushAccModal,    setPushAccModal]    = useState(null);  // device for push access levels
  const [cmdHistModal,    setCmdHistModal]    = useState(null);  // device for command history
  const [operlogFilter,   setOperlogFilter]   = useState(null);  // event type filter
  const [operlogSnFilter, setOperlogSnFilter] = useState(null);  // device SN filter
  const [pushUsersForm]                       = Form.useForm();
  const [pushTzForm]                          = Form.useForm();
  const [pushAccForm]                         = Form.useForm();
  const [editingAddr,    setEditingAddr]    = useState(false);
  const [addrInput,      setAddrInput]      = useState('');

  /* ── ADMS server config (editable) ── */
  const defaultAddr = `${window.location.protocol}//${window.location.hostname}:8000`;
  const { data: admsConfig, refetch: refetchAdmsConfig } = useQuery({
    queryKey: ['adms-config'],
    queryFn:  () => apiService.get('/api/device/adms-config'),
    staleTime: 60000,
  });
  const serverAddr = admsConfig?.data?.server_url || admsConfig?.server_url || defaultAddr;

  const saveAddrMutation = useMutation({
    mutationFn: (url) => apiService.put('/api/device/adms-config', { server_url: url }),
    onSuccess: () => {
      message.success('ADMS server address saved');
      setEditingAddr(false);
      refetchAdmsConfig();
    },
    onError: () => message.error('Failed to save ADMS server address'),
  });

  /* ── registered readers ── */
  const { data: termData, isLoading, refetch } = useQuery({
    queryKey: ['adms-terminals'],
    queryFn:  () => apiService.get('/api/device/terminals/'),
    refetchInterval: 15000,
  });
  const all = Array.isArray(termData?.data) ? termData.data : Array.isArray(termData) ? termData : [];

  /* ── pending devices (state=0) ── */
  const { data: pendingData, refetch: refetchPending } = useQuery({
    queryKey: ['adms-pending'],
    queryFn:  () => apiService.get('/iclock/pending-devices'),
    refetchInterval: 10000,
  });
  const pendingDevices = Array.isArray(pendingData?.data) ? pendingData.data : Array.isArray(pendingData) ? pendingData : [];

  /* ── zones for dropdowns ── */
  const { data: zonesData } = useQuery({
    queryKey: ['zones-for-parent'],
    queryFn:  () => apiService.get('/api/v1/zones/'),
  });
  const zones = Array.isArray(zonesData) ? zonesData : Array.isArray(zonesData?.data) ? zonesData.data : [];

  /* ── OPERLOG events ── */
  const operlogQP = new URLSearchParams({ limit: 200 });
  if (operlogSnFilter) operlogQP.set('sn', operlogSnFilter);
  if (operlogFilter != null) operlogQP.set('event_type', operlogFilter);
  const { data: operlogData, isLoading: operlogLoading, refetch: refetchOperlog } = useQuery({
    queryKey: ['adms-operlog', operlogSnFilter, operlogFilter],
    queryFn:  () => apiService.get(`/iclock/operlog?${operlogQP}`),
    enabled:  activeSubTab === 'operlog',
  });
  const operlogRows = Array.isArray(operlogData?.data?.results) ? operlogData.data.results
                   : Array.isArray(operlogData?.results) ? operlogData.results : [];

  /* ── command history for selected device ── */
  const { data: cmdHistData, isLoading: cmdHistLoading } = useQuery({
    queryKey: ['adms-cmdhistory', cmdHistModal?.sn],
    queryFn:  () => apiService.get(`/api/device/devcmd/?sn=${cmdHistModal?.sn}&limit=50`),
    enabled:  !!cmdHistModal,
  });
  const cmdHistRows = Array.isArray(cmdHistData?.data?.results) ? cmdHistData.data.results
                   : Array.isArray(cmdHistData?.data) ? cmdHistData.data
                   : Array.isArray(cmdHistData) ? cmdHistData : [];

  /* ── employees for push-users modal ── */
  const { data: empData } = useQuery({
    queryKey: ['personnel-list'],
    queryFn:  () => apiService.get('/api/v1/personnel/'),
    enabled:  !!pushUsersModal,
  });
  const employees = Array.isArray(empData?.data) ? empData.data : Array.isArray(empData?.results) ? empData.results : [];

  /* ── shifts for push-timezones modal ── */
  const { data: shiftData } = useQuery({
    queryKey: ['att-timetables'],
    queryFn:  () => apiService.get('/api/v1/attendance/timetables/'),
    enabled:  !!pushTzModal,
  });
  const timetables = Array.isArray(shiftData?.data) ? shiftData.data : Array.isArray(shiftData?.results) ? shiftData.results : [];

  /* ── access levels for push-access modal ── */
  const { data: accLevelData } = useQuery({
    queryKey: ['acc-levels'],
    queryFn:  () => apiService.get('/api/access-control/levels/'),
    enabled:  !!pushAccModal,
  });
  const accLevels = Array.isArray(accLevelData?.data) ? accLevelData.data : [];

  const filtered = search
    ? all.filter(d =>
        (d.alias || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.sn   || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.ip_address || '').includes(search))
    : all;

  const online   = all.filter(d => d.status === 'Online').length;
  const assigned = all.filter(d => d.zone_id || d.area_id).length;
  const offline  = all.length - online;

  /* ── mutations ── */
  const sendCmd = useMutation({
    mutationFn: ({ sn, cmd }) => apiService.post('/api/device/devcmd/', { sn, cmd }),
    onSuccess: () => { message.success('Command queued'); setCmdModal(null); setCmdValue(''); setCustomCmd(''); },
    onError: e => message.error(e?.message || 'Failed'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ sn, action }) => apiService.post('/iclock/approve-device', { sn, action }),
    onSuccess: (_, v) => {
      message.success(v.action === 'approve' ? 'Device approved — users will sync automatically' : 'Device rejected');
      qc.invalidateQueries({ queryKey: ['adms-pending'] }); qc.invalidateQueries({ queryKey: ['adms-terminals'] });
    },
    onError: e => message.error(e?.message || 'Failed'),
  });

  const registerMutation = useMutation({
    mutationFn: (vals) => apiService.post('/api/device/terminals/', vals),
    onSuccess: () => { message.success('Pre-registered'); qc.invalidateQueries({ queryKey: ['adms-terminals'] }); setAddModal(false); addForm.resetFields(); },
    onError: e => message.error(e?.message || 'Failed'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, alias, ip_address }) => apiService.put(`/api/device/terminals/${id}`, { alias, ip_address }),
    onSuccess: () => { message.success('Updated'); qc.invalidateQueries({ queryKey: ['adms-terminals'] }); setEditModal(null); },
    onError: e => message.error(e?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force = false }) =>
      apiService.delete(`/api/device/terminals/${id}${force ? '?force=true' : ''}`),
    onSuccess: () => { message.success('Removed'); qc.invalidateQueries({ queryKey: ['adms-terminals'] }); },
    onError: (e, vars) => {
      const detail = e?.message || 'Failed';
      if (e?.status === 409) {
        Modal.confirm({
          title: 'Terminal has attendance history',
          content: `${detail} Force-deleting will also remove all attendance records from this device. This cannot be undone.`,
          okText: 'Force Delete',
          okType: 'danger',
          onOk: () => deleteMutation.mutate({ id: vars.id, force: true }),
        });
      } else {
        message.error(detail);
      }
    },
  });

  const queryLogsMutation = useMutation({
    mutationFn: (sn) => apiService.post('/iclock/cmd/query-attlog', { sn, cmd_content: 'QUERY ATTLOG' }),
    onSuccess: () => message.success('QUERY ATTLOG queued — device will re-upload its buffer'),
    onError: e => message.error(e?.message || 'Failed'),
  });

  const assignZoneMutation = useMutation({
    mutationFn: ({ deviceId, zoneId, currentZoneId }) => {
      if (zoneId) return apiService.post(`/api/v1/zones/${zoneId}/assign-reader`, { device_id: deviceId });
      if (!currentZoneId) return Promise.resolve({ message: 'Already unassigned' });
      return apiService.delete(`/api/v1/zones/${currentZoneId}/readers/${deviceId}`);
    },
    onSuccess: (res, vars) => {
      message.success(vars.zoneId
        ? (res?.moved_from ? 'Reader moved to zone' : 'Reader assigned to zone')
        : 'Reader unassigned from zone'
      );
      qc.invalidateQueries({ queryKey: ['adms-terminals'] });
      qc.invalidateQueries({ queryKey: ['zones-dashboard'] });
      qc.invalidateQueries({ queryKey: ['available-devices'] });
      if (res?.zone_id)      qc.invalidateQueries({ queryKey: ['zone-readers', res.zone_id] });
      if (res?.moved_from)   qc.invalidateQueries({ queryKey: ['zone-readers', res.moved_from] });
      if (vars.currentZoneId) qc.invalidateQueries({ queryKey: ['zone-readers', vars.currentZoneId] });
    },
    onError: e => message.error(e?.message || 'Failed to assign zone'),
  });

  const pushUsersMutation = useMutation({
    mutationFn: ({ sn, emp_codes }) => apiService.post('/iclock/cmd/push-users', { sn, emp_codes: emp_codes?.length ? emp_codes : null }),
    onSuccess: (d) => { message.success(d?.detail || 'Users queued'); setPushUsersModal(null); pushUsersForm.resetFields(); },
    onError: e => message.error(e?.message || 'Failed'),
  });

  const pushTplMutation = useMutation({
    mutationFn: ({ sn, emp_codes }) => apiService.post('/iclock/cmd/push-templates', { sn, emp_codes: emp_codes?.length ? emp_codes : null }),
    onSuccess: (d) => { message.success(d?.detail || 'Templates queued'); setPushTplModal(null); },
    onError: e => message.error(e?.message || 'Failed'),
  });

  const pushTzMutation = useMutation({
    mutationFn: ({ sn, shift_ids }) => apiService.post('/iclock/cmd/push-timezones', { sn, shift_ids: shift_ids?.length ? shift_ids : null }),
    onSuccess: (d) => { message.success(d?.detail || 'Timezones queued'); setPushTzModal(null); pushTzForm.resetFields(); },
    onError: e => message.error(e?.message || 'Failed'),
  });

  const pushAccMutation = useMutation({
    mutationFn: ({ sn, level_ids }) => apiService.post('/iclock/cmd/push-access-levels', { sn, level_ids: level_ids?.length ? level_ids : null }),
    onSuccess: (d) => { message.success(d?.detail || 'Access levels queued'); setPushAccModal(null); pushAccForm.resetFields(); },
    onError: e => message.error(e?.message || 'Failed'),
  });

  const copyAddr = () => {
    navigator.clipboard.writeText(serverAddr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── columns ── */
  /* ── reader table columns ── */
  const cols = [
    {
      title: 'Reader', key: 'reader', width: 240, fixed: 'left',
      render: (_, r) => {
        const isOnline = r.status === 'Online';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: isOnline
                  ? 'linear-gradient(135deg,#059669,#10B981)'
                  : 'linear-gradient(135deg,#374151,#6B7280)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 17,
                boxShadow: isOnline ? '0 0 0 2px #D1FAE5' : 'none',
              }}><ApiOutlined /></div>
              <div style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 9, height: 9, borderRadius: '50%',
                background: isOnline ? '#10B981' : '#6B7280',
                border: '1.5px solid white',
                boxShadow: isOnline ? '0 0 4px #10B981' : 'none',
                animation: isOnline ? 'statusPulse 2s infinite' : 'none',
              }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                {r.alias || `Terminal-${r.sn}`}
              </div>
              <div style={{ fontSize: 10.5, color: '#9CA3AF', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
                SN: {r.sn}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'IP Address', dataIndex: 'ip_address', width: 140,
      render: ip => ip
        ? <code style={{ fontSize: 11, background: '#F3F4F6', padding: '2px 7px', borderRadius: 4, color: '#374151' }}>{ip}</code>
        : <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>,
    },
    {
      title: 'Status', key: 'status', width: 105,
      render: (_, r) => {
        const isOnline = r.status === 'Online';
        return (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: isOnline ? '#ECFDF5' : '#F9FAFB',
            border: `1px solid ${isOnline ? '#6EE7B7' : '#E5E7EB'}`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isOnline ? '#10B981' : '#9CA3AF',
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: isOnline ? '#059669' : '#6B7280' }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Zone', key: 'zone', width: 180,
      render: (_, r) => (
        <Select
          size="small"
          allowClear
          placeholder="Unassigned"
          value={r.zone_id ?? undefined}
          loading={assignZoneMutation.isPending}
          style={{ width: '100%', fontSize: 11 }}
          onChange={(zoneId) => assignZoneMutation.mutate({ deviceId: r.id, zoneId: zoneId ?? null, currentZoneId: r.zone_id })}
          options={zones.map(z => ({ value: z.id, label: z.name }))}
        />
      ),
    },
    {
      title: 'Firmware', dataIndex: 'fw_version', width: 110,
      render: v => v
        ? <Tag style={{ fontSize: 10, borderRadius: 4 }}>{v}</Tag>
        : <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>,
    },
    {
      title: 'Last Seen', dataIndex: 'last_activity', width: 140,
      render: v => <span style={{ fontSize: 11, color: '#6B7280' }}>{fmtTime(v)}</span>,
    },
    {
      title: '', key: 'actions', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space size={4} wrap>
          <Tooltip title="Send Command">
            <Button size="small" type="primary" ghost icon={<SendOutlined />}
              onClick={() => { setCmdModal(r); setCmdValue(''); setCustomCmd(''); }} />
          </Tooltip>
          <Tooltip title="Capability Stats">
            <Button size="small" icon={<DashboardOutlined />}
              onClick={() => setCapModal(r)} />
          </Tooltip>
          <Tooltip title="Push Users">
            <Button size="small" icon={<TeamOutlined />}
              onClick={() => setPushUsersModal(r)} />
          </Tooltip>
          <Tooltip title="Push Templates">
            <Button size="small" icon={<SyncOutlined />}
              onClick={() => setPushTplModal(r)} />
          </Tooltip>
          <Tooltip title="Push Time Rules">
            <Button size="small" icon={<ClockCircleOutlined />}
              onClick={() => setPushTzModal(r)} />
          </Tooltip>
          <Tooltip title="Push Access Levels">
            <Button size="small" icon={<LockOutlined />}
              onClick={() => setPushAccModal(r)} />
          </Tooltip>
          <Tooltip title="Query / Force Re-upload Logs">
            <Popconfirm title="Reset Stamp and force device to re-upload all logs?" okType="primary"
              onConfirm={() => queryLogsMutation.mutate(r.sn)}>
              <Button size="small" icon={<ReloadOutlined />} />
            </Popconfirm>
          </Tooltip>
          <Tooltip title="Command History">
            <Button size="small" icon={<ClockCircleOutlined />} style={{ color: '#7C3AED' }}
              onClick={() => setCmdHistModal(r)} />
          </Tooltip>
          <Tooltip title="Rename">
            <Button size="small" icon={<EditOutlined />}
              onClick={() => { setEditModal(r); setEditAlias(r.alias || ''); setEditIp(r.ip_address || ''); }} />
          </Tooltip>
          <Popconfirm title="Remove this reader?" okType="danger"
            onConfirm={() => deleteMutation.mutate({ id: r.id })}>
            <Button size="small" danger type="text" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* ── CMD status chip helper ── */
  const cmdStatusChip = (s) => {
    const map = { 0: ['Pending','#F59E0B','#FFFBEB'], 1: ['Sent','#1D4ED8','#EFF6FF'], 2: ['Success','#059669','#ECFDF5'], 3: ['Failed','#EF4444','#FEF2F2'] };
    const [label,color,bg] = map[s] || ['Unknown','#6B7280','#F9FAFB'];
    return <span style={{ fontSize:10, fontWeight:600, color, background:bg, border:`1px solid ${color}30`, borderRadius:4, padding:'1px 7px' }}>{label}</span>;
  };

  /* ── sub-tab: registered readers ── */
  const readersTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          placeholder="Search by alias, SN or IP…"
          value={search} onChange={e => setSearch(e.target.value)}
          allowClear size="small" style={{ maxWidth: 300 }}
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
          Refresh
        </Button>
        <Button size="small" type="primary" icon={<PlusOutlined />}
          style={{ marginLeft: 'auto', borderRadius: 7 }}
          onClick={() => setAddModal(true)}>
          Pre-register Reader
        </Button>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>
          {filtered.length} reader{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <Table
          dataSource={filtered}
          loading={isLoading}
          rowKey={r => r.id ?? r.sn}
          size="small"
          pagination={{ pageSize: 20, size: 'small' }}
          scroll={{ x: 1050 }}
          columns={cols}
          locale={{ emptyText: (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>
              <ApiOutlined style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No readers yet</div>
              <div style={{ fontSize: 12 }}>Configure your ZKTeco device with this server address to get started</div>
            </div>
          )}}
        />
      </div>
    </div>
  );

  /* ── sub-tab: pending approval ── */
  const pendingTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {pendingDevices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <CheckOutlined style={{ fontSize: 40, color: '#10B981', marginBottom: 12 }} />
          <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>All clear — no devices awaiting approval</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>New devices that connect for the first time will appear here</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendingDevices.map(d => (
            <div key={d.sn} style={{
              background: 'white', borderRadius: 12, border: '1.5px solid #FCD34D',
              padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(251,191,36,0.12)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 20,
                }}>
                  <ApiOutlined />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                    {d.alias || `Unknown Device`}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>
                      SN: <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 3 }}>{d.sn}</code>
                    </span>
                    {d.ip_address && (
                      <span style={{ fontSize: 11, color: '#6B7280' }}>
                        IP: <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 3 }}>{d.ip_address}</code>
                      </span>
                    )}
                    {d.fw_version && (
                      <span style={{ fontSize: 11, color: '#6B7280' }}>FW: {d.fw_version}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                    First seen: {fmtTime(d.created_at)}
                  </div>
                </div>
              </div>
              <Space size={8}>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  style={{ background: '#059669', borderColor: '#059669', borderRadius: 8 }}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate({ sn: d.sn, action: 'approve' })}>
                  Approve
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  style={{ borderRadius: 8 }}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate({ sn: d.sn, action: 'reject' })}>
                  Reject
                </Button>
              </Space>
            </div>
          ))}
        </div>
      )}
      <Alert
        type="warning"
        showIcon
        message="Security notice: Until approved, attendance records from pending devices are not processed. Reject any device you do not recognise."
        style={{ fontSize: 12 }}
      />
    </div>
  );

  /* ── sub-tab: OPERLOG viewer ── */
  const operlogTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select
          placeholder="All devices"
          allowClear
          style={{ width: 220 }}
          size="small"
          value={operlogSnFilter}
          onChange={v => setOperlogSnFilter(v || null)}
          showSearch
          optionFilterProp="label"
        >
          {all.map(d => (
            <Select.Option key={d.sn} value={d.sn} label={d.alias || d.sn}>
              {d.alias || d.sn}
            </Select.Option>
          ))}
        </Select>
        <Select
          placeholder="All event types"
          allowClear
          style={{ width: 200 }}
          size="small"
          value={operlogFilter}
          onChange={v => setOperlogFilter(v ?? null)}
        >
          {Object.entries(OPER_EVENT_META).map(([k, m]) => (
            <Select.Option key={k} value={Number(k)}>{m.label}</Select.Option>
          ))}
        </Select>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchOperlog()}>
          Refresh
        </Button>
        <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>
          {operlogRows.length} event{operlogRows.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <Table
          dataSource={operlogRows}
          loading={operlogLoading}
          rowKey={r => r.id}
          size="small"
          pagination={{ pageSize: 25, size: 'small' }}
          scroll={{ x: 800 }}
          columns={[
            {
              title: 'Event', key: 'event', width: 160,
              render: (_, r) => {
                const meta = OPER_EVENT_META[r.oper_event] || { label: `Event ${r.oper_event}`, color: '#6B7280', bg: '#F9FAFB' };
                return (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: meta.color,
                    background: meta.bg, border: `1px solid ${meta.color}30`,
                    borderRadius: 5, padding: '2px 8px',
                  }}>{meta.label}</span>
                );
              },
            },
            {
              title: 'Device', dataIndex: 'terminal_sn', width: 160,
              render: sn => {
                const dev = all.find(d => d.sn === sn);
                return (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{dev?.alias || sn}</div>
                    <code style={{ fontSize: 10, color: '#9CA3AF' }}>{sn}</code>
                  </div>
                );
              },
            },
            {
              title: 'Time', dataIndex: 'event_time', width: 160,
              render: v => <span style={{ fontSize: 11, color: '#374151' }}>{fmtTime(v)}</span>,
            },
            {
              title: 'Door', dataIndex: 'door_id', width: 80,
              render: v => v != null ? <Tag style={{ fontSize: 10 }}>Door {v}</Tag> : <span style={{ color: '#D1D5DB' }}>—</span>,
            },
            {
              title: 'Admin', dataIndex: 'admin_id', width: 100,
              render: v => v ? <code style={{ fontSize: 11 }}>{v}</code> : <span style={{ color: '#D1D5DB' }}>—</span>,
            },
            { title: 'Object', dataIndex: 'object_name', width: 140, render: v => v || '—' },
            { title: 'Param1', dataIndex: 'param1', width: 120, render: v => v ? <code style={{ fontSize: 10 }}>{v}</code> : '—' },
          ]}
          locale={{ emptyText: (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9CA3AF' }}>
              <InfoCircleOutlined style={{ fontSize: 28, marginBottom: 8 }} />
              <div>No OPERLOG events yet.</div>
              <div style={{ fontSize: 12 }}>Door events and alarms will appear here once a device sends them.</div>
            </div>
          )}}
        />
      </div>
    </div>
  );

  /* ── sub-tab: server setup guide ── */
  const setupTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        borderRadius: 14, padding: 24, color: 'white',
      }}>
        <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          ADMS Server Address (enter this on your device)
        </div>
        {editingAddr ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Input
              value={addrInput}
              onChange={e => setAddrInput(e.target.value)}
              placeholder={defaultAddr}
              style={{ flex: 1, fontSize: 16, fontWeight: 600, fontFamily: 'monospace', height: 44, borderRadius: 8 }}
              autoFocus
              onPressEnter={() => saveAddrMutation.mutate(addrInput)}
            />
            <Button
              type="primary" icon={<CheckOutlined />}
              loading={saveAddrMutation.isPending}
              onClick={() => saveAddrMutation.mutate(addrInput)}
              style={{ height: 44, borderRadius: 8, fontWeight: 600 }}>
              Save
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={() => setEditingAddr(false)}
              style={{ height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <code style={{
              fontSize: 22, fontWeight: 700, color: '#38BDF8',
              background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
              borderRadius: 8, padding: '8px 18px', flex: 1, letterSpacing: '0.04em',
            }}>{serverAddr}</code>
            <Button
              icon={<EditOutlined />}
              onClick={() => { setAddrInput(serverAddr); setEditingAddr(true); }}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#94A3B8', borderRadius: 8, height: 44, padding: '0 14px',
              }}>
              Edit
            </Button>
            <Button
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={copyAddr}
              style={{
                background: copied ? '#059669' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${copied ? '#059669' : 'rgba(255,255,255,0.2)'}`,
                color: 'white', borderRadius: 8, height: 44, padding: '0 18px', fontWeight: 600,
              }}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: '#64748B', display: 'flex', gap: 20 }}>
          <span><strong style={{ color: '#94A3B8' }}>Protocol:</strong> HTTP (ADMS push)</span>
          <span><strong style={{ color: '#94A3B8' }}>Endpoint:</strong> /iclock/cdata</span>
          <span><strong style={{ color: '#94A3B8' }}>Auto-register:</strong> Enabled</span>
          {admsConfig?.data?.server_url && (
            <span style={{ color: '#22C55E' }}>
              <CheckOutlined style={{ marginRight: 4 }} />Custom address saved
            </span>
          )}
        </div>
      </div>

      <Row gutter={16}>
        <Col xs={24} md={14}>
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoCircleOutlined style={{ color: '#1D4ED8' }} /> How ADMS Registration Works
            </div>
            {[
              {
                step: '01', color: '#1D4ED8',
                title: 'Configure the ZKTeco device',
                desc: 'On the device keypad: Menu → Comm → ADMS → set "Server Address" to the address above. Set port to 8000.',
              },
              {
                step: '02', color: '#7C3AED',
                title: 'Device connects & auto-registers',
                desc: 'The reader calls GET /iclock/cdata?SN=<serial> on boot and every 30 s. The server auto-creates a pending record.',
              },
              {
                step: '03', color: '#F59E0B',
                title: 'Approve the device',
                desc: 'Go to the "Pending Approval" tab, verify the SN, and click Approve. Rejected devices are blocked permanently.',
              },
              {
                step: '04', color: '#059669',
                title: 'Assign to a Zone',
                desc: 'From the Readers table assign the reader to a zone. Punches update that zone\'s POB count in real time.',
              },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: `${s.color}18`, border: `1.5px solid ${s.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: s.color,
                }}>{s.step}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Col>
        <Col xs={24} md={10}>
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E5E7EB', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <SettingOutlined style={{ color: '#059669' }} /> ADMS Protocol Endpoints
            </div>
            {[
              { method: 'GET',  path: '/iclock/cdata',     desc: 'Heartbeat / attendance upload trigger', color: '#1D4ED8' },
              { method: 'POST', path: '/iclock/cdata',     desc: 'Bulk ATTLOG / OPERLOG / USERINFO push',  color: '#1D4ED8' },
              { method: 'GET',  path: '/iclock/getrequest',desc: 'Device polls for queued commands',       color: '#7C3AED' },
              { method: 'POST', path: '/iclock/devicecmd', desc: 'Device reports command result',          color: '#059669' },
            ].map(ep => (
              <div key={`${ep.method}-${ep.path}`} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: ep.color,
                    background: `${ep.color}15`, border: `1px solid ${ep.color}30`,
                    borderRadius: 4, padding: '1px 6px',
                  }}>{ep.method}</span>
                  <code style={{ fontSize: 11, color: '#374151' }}>{ep.path}</code>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', paddingLeft: 6 }}>{ep.desc}</div>
              </div>
            ))}
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.7 }}>
              <strong>Push direction:</strong> Reader → Server (device-initiated)<br />
              <strong>Commands direction:</strong> Server → Reader (via poll queue)<br />
              <strong>Poll interval:</strong> Every 30 s (configurable per-device)
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
            border: '1px solid #FCD34D', borderRadius: 12, padding: 16, marginTop: 14,
          }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#92400E', marginBottom: 10 }}>
              vs. BioTime Cloud (same protocol, different server)
            </div>
            {[
              { label: 'BioTime Cloud',      value: 'adms.zkteco.com:443' },
              { label: 'Your Server (ADMS)', value: `${window.location.hostname}:8000` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                <span style={{ color: '#92400E' }}>{r.label}</span>
                <code style={{ color: '#78350F', fontWeight: 600 }}>{r.value}</code>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#B45309', marginTop: 6 }}>
              Identical ADMS protocol. Simply point the device at your server instead of ZKTeco's cloud.
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #1D4ED8 100%)',
        borderRadius: 14, padding: '18px 22px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 8px 24px rgba(29,78,216,0.2)',
      }}>
        <Space size={14}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
          }}>
            <WifiOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>ADMS Reader Management</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 }}>
              ZKTeco terminals — push-based protocol over LAN / 4G
            </div>
          </div>
        </Space>
        <Space size={20}>
          {[
            { label: 'Total',    value: all.length,                 color: '#93C5FD' },
            { label: 'Online',   value: online,                     color: '#6EE7B7' },
            { label: 'Offline',  value: offline,                    color: '#FCA5A5' },
            { label: 'Assigned', value: assigned,                   color: '#C4B5FD' },
            { label: 'Pending',  value: pendingDevices.length,      color: '#FDE68A' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </Space>
      </div>

      {/* ── Sub-tabs ── */}
      <Tabs
        activeKey={activeSubTab}
        onChange={setActiveSubTab}
        size="small"
        items={[
          {
            key: 'readers',
            label: (
              <Space size={6}>
                <ApiOutlined />
                Registered Readers
                {online > 0 && <Badge count={online} color="#10B981" size="small" />}
              </Space>
            ),
            children: readersTab,
          },
          {
            key: 'pending',
            label: (
              <Space size={6}>
                <ClockCircleOutlined />
                Pending Approval
                {pendingDevices.length > 0 && <Badge count={pendingDevices.length} color="#F59E0B" size="small" />}
              </Space>
            ),
            children: pendingTab,
          },
          {
            key: 'operlog',
            label: <Space size={6}><AlertOutlined />OPERLOG Viewer</Space>,
            children: operlogTab,
          },
          {
            key: 'setup',
            label: <Space size={6}><InfoCircleOutlined />Server Setup & Protocol</Space>,
            children: setupTab,
          },
        ]}
      />

      {/* ── Send Command Modal ── */}
      <Modal
        open={!!cmdModal}
        title={
          <Space>
            <SendOutlined style={{ color: '#1D4ED8' }} />
            Send Command — <code style={{ fontSize: 13 }}>{cmdModal?.sn}</code>
          </Space>
        }
        onCancel={() => { setCmdModal(null); setCmdValue(''); setCustomCmd(''); }}
        onOk={() => {
          const cmd = cmdValue === 'custom' ? customCmd.trim() : cmdValue;
          if (!cmd) { message.warning('Select or type a command'); return; }
          sendCmd.mutate({ sn: cmdModal.sn, cmd });
        }}
        confirmLoading={sendCmd.isPending}
        okText="Queue Command"
        width={520}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
            Commands are queued and delivered the next time the device polls
            <code style={{ margin: '0 4px', fontSize: 11, background:'#F3F4F6', padding:'1px 5px', borderRadius:3 }}>/iclock/getrequest</code>
            (every ~30 s).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {CMD_PRESETS.map(p => (
              <button key={p.value}
                onClick={() => { setCmdValue(p.value); setCustomCmd(''); }}
                style={{
                  border: `1.5px solid ${cmdValue === p.value ? p.color : '#E5E7EB'}`,
                  borderRadius: 8, padding: '8px 12px', background: cmdValue === p.value ? `${p.color}12` : 'white',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                  transition: 'all 0.15s',
                }}>
                <span style={{ color: p.color, fontSize: 14 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{p.label}</div>
                  <code style={{ fontSize: 10, color: '#6B7280' }}>{p.value}</code>
                </div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>Or type a custom command:</div>
          <Input
            placeholder="e.g. DATA UPDATE USERINFO PIN=001 Name=John"
            value={customCmd}
            onChange={e => { setCustomCmd(e.target.value); setCmdValue('custom'); }}
            onClick={() => setCmdValue('custom')}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>
      </Modal>

      {/* ── Capability Stats Modal ── */}
      <Modal
        open={!!capModal}
        title={
          <Space>
            <DashboardOutlined style={{ color: '#7C3AED' }} />
            Device Capacity — <code style={{ fontSize: 13 }}>{capModal?.alias || capModal?.sn}</code>
          </Space>
        }
        onCancel={() => setCapModal(null)}
        footer={<Button onClick={() => setCapModal(null)}>Close</Button>}
        width={480}
      >
        {capModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Enrolled Users',       value: capModal.user_count  ?? '—', icon: <TeamOutlined />,        color: '#1D4ED8' },
              { label: 'Fingerprint Templates',value: capModal.fp_count    ?? '—', icon: <SyncOutlined />,        color: '#7C3AED' },
              { label: 'Face Templates',       value: capModal.face_count  ?? '—', icon: <ApiOutlined />,         color: '#059669' },
              { label: 'Palm Templates',       value: capModal.palm_count  ?? '—', icon: <ApiOutlined />,         color: '#F59E0B' },
              { label: 'Attendance Records',   value: capModal.log_count   ?? '—', icon: <ClockCircleOutlined />, color: '#EF4444' },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                background: `${s.color}08`, border: `1px solid ${s.color}20`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: s.color, fontSize: 15 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, color: '#374151' }}>{s.label}</span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 4 }}>
              Counts are updated on each device heartbeat.
            </div>
          </div>
        )}
      </Modal>

      {/* ── Push Users Modal ── */}
      <Modal
        open={!!pushUsersModal}
        title={
          <Space>
            <TeamOutlined style={{ color: '#1D4ED8' }} />
            Push Users to — <code style={{ fontSize: 13 }}>{pushUsersModal?.alias || pushUsersModal?.sn}</code>
          </Space>
        }
        onCancel={() => { setPushUsersModal(null); pushUsersForm.resetFields(); }}
        onOk={() => pushUsersForm.validateFields().then(v =>
          pushUsersMutation.mutate({ sn: pushUsersModal.sn, emp_codes: v.emp_codes })
        )}
        confirmLoading={pushUsersMutation.isPending}
        okText="Push to Device"
        width={520}
      >
        <Alert type="info" showIcon message="Leaves emp_codes empty to push ALL personnel to the device." style={{ marginBottom: 16, fontSize: 12 }} />
        <Form form={pushUsersForm} layout="vertical">
          <Form.Item name="emp_codes" label="Select Employees (leave blank for all)">
            <Select
              mode="multiple"
              placeholder="All employees"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            >
              {employees.map(e => (
                <Select.Option key={e.emp_code} value={e.emp_code} label={`${e.first_name} ${e.last_name} (${e.emp_code})`}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{e.first_name} {e.last_name}</div>
                    <code style={{ fontSize: 10, color: '#9CA3AF' }}>{e.emp_code}</code>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Push Templates Modal ── */}
      <Modal
        open={!!pushTplModal}
        title={
          <Space>
            <SyncOutlined style={{ color: '#7C3AED' }} />
            Push Biometric Templates — <code style={{ fontSize: 13 }}>{pushTplModal?.alias || pushTplModal?.sn}</code>
          </Space>
        }
        onCancel={() => setPushTplModal(null)}
        onOk={() => pushTplMutation.mutate({ sn: pushTplModal.sn, emp_codes: null })}
        confirmLoading={pushTplMutation.isPending}
        okText="Push All Templates"
        width={480}
      >
        <Alert
          type="info" showIcon
          message="This queues DATA UPDATE BIODATA commands for all fingerprint and face templates stored on this server."
          style={{ marginBottom: 16, fontSize: 12 }}
        />
        <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#374151' }}>
          Device: <strong>{pushTplModal?.alias || pushTplModal?.sn}</strong><br />
          Templates on server: <strong>{pushTplModal?.fp_count ?? 0} FP + {pushTplModal?.face_count ?? 0} Face</strong>
        </div>
      </Modal>

      {/* ── Push Time Rules Modal ── */}
      <Modal
        open={!!pushTzModal}
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#059669' }} />
            Push Time Rules — <code style={{ fontSize: 13 }}>{pushTzModal?.alias || pushTzModal?.sn}</code>
          </Space>
        }
        onCancel={() => { setPushTzModal(null); pushTzForm.resetFields(); }}
        onOk={() => pushTzForm.validateFields().then(v =>
          pushTzMutation.mutate({ sn: pushTzModal.sn, shift_ids: v.shift_ids })
        )}
        confirmLoading={pushTzMutation.isPending}
        okText="Push to Device"
        width={500}
      >
        <Alert type="info" showIcon message="Leave blank to push all shift timetables. The device uses these for offline access control." style={{ marginBottom: 16, fontSize: 12 }} />
        <Form form={pushTzForm} layout="vertical">
          <Form.Item name="shift_ids" label="Select Timetables (leave blank for all)">
            <Select
              mode="multiple"
              placeholder="All timetables"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            >
              {timetables.map(t => (
                <Select.Option key={t.id} value={t.id} label={t.name}>{t.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Push Access Levels Modal ── */}
      <Modal
        open={!!pushAccModal}
        title={
          <Space>
            <LockOutlined style={{ color: '#EF4444' }} />
            Push Access Levels — <code style={{ fontSize: 13 }}>{pushAccModal?.alias || pushAccModal?.sn}</code>
          </Space>
        }
        onCancel={() => { setPushAccModal(null); pushAccForm.resetFields(); }}
        onOk={() => pushAccForm.validateFields().then(v =>
          pushAccMutation.mutate({ sn: pushAccModal.sn, level_ids: v.level_ids })
        )}
        confirmLoading={pushAccMutation.isPending}
        okText="Push to Device"
        width={500}
      >
        <Alert type="info" showIcon message="Leave blank to push all access levels. These control which doors each employee can open." style={{ marginBottom: 16, fontSize: 12 }} />
        <Form form={pushAccForm} layout="vertical">
          <Form.Item name="level_ids" label="Select Access Levels (leave blank for all)">
            <Select
              mode="multiple"
              placeholder="All access levels"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
            >
              {accLevels.map(l => (
                <Select.Option key={l.id} value={l.id} label={l.name}>{l.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Command History Modal ── */}
      <Modal
        open={!!cmdHistModal}
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#7C3AED' }} />
            Command History — <code style={{ fontSize: 13 }}>{cmdHistModal?.alias || cmdHistModal?.sn}</code>
          </Space>
        }
        onCancel={() => setCmdHistModal(null)}
        footer={<Button onClick={() => setCmdHistModal(null)}>Close</Button>}
        width={640}
      >
        <Table
          dataSource={cmdHistRows}
          loading={cmdHistLoading}
          rowKey={r => r.id}
          size="small"
          pagination={{ pageSize: 15, size: 'small' }}
          columns={[
            {
              title: 'Command', dataIndex: 'cmd_content', ellipsis: true,
              render: v => <code style={{ fontSize: 11 }}>{v}</code>,
            },
            {
              title: 'Status', dataIndex: 'status', width: 90,
              render: s => cmdStatusChip(s),
            },
            {
              title: 'Queued', dataIndex: 'created_at', width: 130,
              render: v => <span style={{ fontSize: 11 }}>{fmtTime(v)}</span>,
            },
            {
              title: 'Executed', dataIndex: 'executed_at', width: 130,
              render: v => v ? <span style={{ fontSize: 11 }}>{fmtTime(v)}</span> : <span style={{ color: '#D1D5DB' }}>—</span>,
            },
          ]}
          locale={{ emptyText: <div style={{ padding: '24px 0', textAlign: 'center', color: '#9CA3AF' }}>No commands sent yet</div> }}
        />
      </Modal>

      {/* ── Pre-register Modal ── */}
      <Modal
        open={addModal}
        title={<Space><PlusOutlined style={{ color: '#059669' }} />Pre-register a Reader</Space>}
        onCancel={() => { setAddModal(false); addForm.resetFields(); }}
        onOk={() => addForm.validateFields().then(vals => registerMutation.mutate(vals))}
        confirmLoading={registerMutation.isPending}
        okText="Register"
      >
        <Alert
          type="info"
          showIcon
          message="Pre-registration is optional — devices auto-register on first connection and appear in Pending Approval."
          style={{ marginBottom: 16, fontSize: 12 }}
        />
        <Form form={addForm} layout="vertical">
          <Form.Item name="sn" label="Serial Number (SN)" rules={[{ required: true, message: 'SN is required' }]}>
            <Input placeholder="e.g. BKMD203460031" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item name="alias" label="Alias / Name">
            <Input placeholder="e.g. Gate A Reader" />
          </Form.Item>
          <Form.Item name="ip_address" label="Expected IP Address">
            <Input placeholder="e.g. 192.168.1.120" />
          </Form.Item>
          <Form.Item name="zone_id" label="Assign to Zone">
            <Select placeholder="Select zone" allowClear showSearch optionFilterProp="label">
              {zones.map(z => (
                <Select.Option key={z.id} value={z.id} label={z.name}>{z.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Edit Reader Modal ── */}
      <Modal
        open={!!editModal}
        title={<Space><EditOutlined style={{ color: '#1D4ED8' }} />Edit Reader</Space>}
        onCancel={() => setEditModal(null)}
        onOk={() => renameMutation.mutate({ id: editModal.id, alias: editAlias, ip_address: editIp || undefined })}
        confirmLoading={renameMutation.isPending}
        okText="Save"
      >
        <div style={{ marginBottom: 12, fontSize: 12, color: '#6B7280' }}>
          SN: <code style={{ background: '#F3F4F6', padding: '1px 6px', borderRadius: 3 }}>{editModal?.sn}</code>
        </div>
        <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#374151' }}>Display Name</div>
        <Input
          placeholder="Friendly name, e.g. Main Gate Entry"
          value={editAlias}
          onChange={e => setEditAlias(e.target.value)}
          autoFocus
          style={{ marginBottom: 16 }}
        />
        <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#374151' }}>
          IP Address
          <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: 8 }}>
            (correct if shown as 192.168.65.1 — Docker masks the real IP)
          </span>
        </div>
        <Input
          placeholder="e.g. 192.168.0.100"
          value={editIp}
          onChange={e => setEditIp(e.target.value)}
        />
      </Modal>

      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

/* ── Main Component ────────────────────────────────────────────────────────── */

const ZoneManagement = () => {
  const { message } = App.useApp();
  const [activeTab,        setActiveTab]        = useState('zones');
  const [detailZone,       setDetailZone]       = useState(null);
  const [editingZone,      setEditingZone]      = useState(null);
  const [isModalOpen,      setIsModalOpen]      = useState(false);
  const [readerZone,       setReaderZone]       = useState(null);
  const [isReaderModalOpen,setIsReaderModalOpen]= useState(false);
  const [searchVal,        setSearchVal]        = useState('');
  const [typeFilter,       setTypeFilter]       = useState(null);
  const [statusFilter,     setStatusFilter]     = useState(null);
  const [hazardFilter,     setHazardFilter]     = useState(null);
  const [selectedRowKeys,  setSelectedRowKeys]  = useState([]);
  const [form]       = Form.useForm();
  const [readerForm] = Form.useForm();
  const queryClient  = useQueryClient();

  const { data: dashData, isLoading: dashLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['zones-dashboard'],
    queryFn:  () => apiService.get('/api/v1/zones/dashboard'),
    refetchInterval: 10000,
  });

  const { data: allZonesForParent } = useQuery({
    queryKey: ['zones-for-parent'],
    queryFn:  () => apiService.get('/api/v1/zones/'),
    enabled: isModalOpen,
  });

  const { data: devicesData } = useQuery({
    queryKey: ['available-devices'],
    queryFn:  () => apiService.get('/api/v1/zones/available-devices'),
    enabled: isReaderModalOpen,
  });

  const zones = Array.isArray(dashData) ? dashData : [];
  const devices = Array.isArray(devicesData) ? devicesData : [];

  const filtered = zones.filter(z => {
    if (searchVal.trim()) {
      const q = searchVal.toLowerCase();
      if (!z.name.toLowerCase().includes(q) && !z.code.toLowerCase().includes(q) && !(z.state || '').toLowerCase().includes(q)) return false;
    }
    if (typeFilter   && z.zone_type   !== typeFilter)   return false;
    if (statusFilter && z.status      !== statusFilter) return false;
    if (hazardFilter && z.hazard_level !== hazardFilter) return false;
    return true;
  });
  const hasFilters = searchVal || typeFilter || statusFilter || hazardFilter;

  const totalPOB    = zones.reduce((s, z) => s + (z.current_personnel_count || 0), 0);
  const activeZones = zones.filter(z => z.is_active && z.status === 'ACTIVE').length;
  const totalReaders= zones.reduce((s, z) => s + (z.device_count || z.reader_count || 0), 0);
  const alerts      = zones.filter(z => ['EMERGENCY','LOCKDOWN'].includes(z.status)).length;

  const saveMutation = useMutation({
    mutationFn: (values) => editingZone
      ? apiService.put(`/api/v1/zones/${editingZone.id}/`, values)
      : apiService.post('/api/v1/zones/', values),
    onSuccess: () => {
      message.success(editingZone ? 'Zone updated' : 'Zone created');
      setIsModalOpen(false); setEditingZone(null); form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['zones-dashboard'] });
    },
    onError: err => message.error(err?.message || 'Failed to save zone'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, cascade = false }) =>
      apiService.delete(`/api/v1/zones/${id}/${cascade ? '?cascade=true' : ''}`),
    onSuccess: (res, { id }) => {
      message.success(res?.message || 'Zone deleted');
      if (detailZone?.id === id) setDetailZone(null);
      queryClient.invalidateQueries({ queryKey: ['zones-dashboard'] });
    },
    onError: (err, vars) => {
      if (err?.message?.includes('sub-zone')) {
        Modal.confirm({
          title: 'Zone has sub-zones',
          icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
          content: (
            <div>
              <p>{err.message}</p>
              <p>Do you want to delete this zone <strong>and all its sub-zones</strong>?</p>
            </div>
          ),
          okText: 'Delete All',
          okButtonProps: { danger: true },
          cancelText: 'Cancel',
          onOk: () => deleteMutation.mutateAsync({ id: vars.id, cascade: true }),
        });
      } else {
        message.error(err?.message || 'Delete failed');
      }
    },
  });

  const assignReaderMutation = useMutation({
    mutationFn: (values) => apiService.post(`/api/v1/zones/${readerZone?.id}/assign-reader`, values),
    onSuccess: (res) => {
      message.success(res?.moved_from ? 'Reader moved to zone' : 'Reader assigned to zone');
      setIsReaderModalOpen(false); readerForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['zones-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['zone-readers', readerZone?.id] });
      if (res?.moved_from) queryClient.invalidateQueries({ queryKey: ['zone-readers', res.moved_from] });
      queryClient.invalidateQueries({ queryKey: ['adms-terminals'] });
      queryClient.invalidateQueries({ queryKey: ['available-devices'] });
    },
    onError: err => message.error(err?.message || 'Assignment failed'),
  });

  const patchStatusM = useMutation({
    mutationFn: ({ id, status }) => apiService.patch(`/api/v1/zones/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      message.success(`Zone status → ${vars.status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['zones-dashboard'] });
    },
    onError: err => message.error(err?.message || 'Status update failed'),
  });

  const exportCSV = () => {
    const rows = selectedRowKeys.length > 0
      ? filtered.filter(z => selectedRowKeys.includes(z.id))
      : filtered;
    const header = ['Name','Code','Type','Status','Hazard','POB','Capacity','State','Readers','Latitude','Longitude'];
    const lines = rows.map(z => [
      z.name, z.code, z.zone_type, z.status, z.hazard_level,
      z.current_personnel_count ?? 0,
      z.max_capacity ? `${z.current_personnel_count ?? 0}/${z.max_capacity}` : '',
      z.state || '', z.device_count ?? z.reader_count ?? 0,
      z.latitude || '', z.longitude || '',
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `zones_${new Date().toISOString().slice(0,10)}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleEdit = (zone) => { setEditingZone(zone); form.setFieldsValue(zone); setIsModalOpen(true); };
  const handleAssignReader = (zone) => { setReaderZone(zone); setIsReaderModalOpen(true); };

  useEffect(() => {
    if (detailZone && zones.length) {
      const updated = zones.find(z => z.id === detailZone.id);
      if (updated) setDetailZone(updated);
    }
  }, [zones]);

  return (
    <div style={{ background: '#F3F4F8', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0d2140 50%, #071428 100%)',
        padding: '22px 28px 20px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(14,165,233,0.4)', fontSize: 24, color: 'white',
            }}>
              <GlobalOutlined />
            </div>
            <div>
              <div style={{ color: 'white', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>Zone Management</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 3 }}>
                Real-time personnel tracking via ZKTeco ADMS readers over 4G
              </div>
            </div>
          </div>
          <Space size={10} align="center">
            {dataUpdatedAt > 0 && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap' }}>
                {dashLoading ? 'Refreshing…' : `Updated ${timeAgo(new Date(dataUpdatedAt).toISOString())}`}
              </span>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={dashLoading}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8 }}
            >Refresh</Button>
            <Button
              type="primary" icon={<PlusOutlined />}
              onClick={() => { setEditingZone(null); form.resetFields(); setIsModalOpen(true); }}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >New Zone</Button>
          </Space>
        </div>

        {/* KPI strip inside header */}
        <Row gutter={12} style={{ marginTop: 20 }}>
          {[
            { label: 'Total Personnel On Board', value: totalPOB,     from: '#0078D4', to: '#005A9E', icon: <TeamOutlined />, big: true },
            { label: 'Active Zones',              value: activeZones,  from: '#059669', to: '#10B981', icon: <CheckCircleOutlined /> },
            { label: 'Total Zones',               value: zones.length, from: '#374151', to: '#1F2937', icon: <RadarChartOutlined /> },
            { label: 'ADMS Readers',              value: totalReaders, from: '#6D28D9', to: '#7C3AED', icon: <ApiOutlined /> },
            { label: 'Alerts',                    value: alerts,       from: '#B91C1C', to: '#DC2626', icon: <AlertOutlined /> },
          ].map(s => (
            <Col key={s.label} xs={12} sm={s.big ? 6 : 4} lg={s.big ? 6 : 4}>
              <div style={{
                background: `linear-gradient(135deg, ${s.from} 0%, ${s.to} 100%)`,
                borderRadius: 12, padding: s.big ? '16px 20px' : '12px 16px',
                boxShadow: `0 4px 14px ${s.from}55`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: s.big ? 44 : 36, height: s.big ? 44 : 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: s.big ? 20 : 16, color: 'white', flexShrink: 0,
                }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: s.big ? 32 : 24, fontWeight: 800, color: 'white', lineHeight: 1 }}>{s.value ?? 0}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', marginTop: 2, lineHeight: 1.2 }}>{s.label}</div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </div>

      {/* ── Tabs content ── */}
      <div style={{ padding: '20px 28px' }}>

        {/* Emergency / lockdown banner */}
        {zones.some(z => ['EMERGENCY','LOCKDOWN'].includes(z.status)) && (
          <Alert
            type="error" showIcon
            message={
              <span>
                <strong>Emergency Alert:</strong>{' '}
                {zones.filter(z => ['EMERGENCY','LOCKDOWN'].includes(z.status)).map(z => `${z.name} (${z.status})`).join(' · ')}
              </span>
            }
            style={{ marginBottom: 12, borderRadius: 10 }}
          />
        )}

        {/* Capacity warning banner */}
        {zones.some(z => z.max_capacity && (z.current_personnel_count ?? 0) / z.max_capacity >= 0.8) && (
          <Alert
            type="warning" showIcon closable
            message={
              <span>
                <strong>Capacity Warning:</strong>{' '}
                {zones
                  .filter(z => z.max_capacity && (z.current_personnel_count ?? 0) / z.max_capacity >= 0.8)
                  .map(z => `${z.name} (${Math.round((z.current_personnel_count ?? 0) / z.max_capacity * 100)}%)`)
                  .join(' · ')}{' '}at or above 80% capacity.
              </span>
            }
            style={{ marginBottom: 12, borderRadius: 10 }}
          />
        )}

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarStyle={{ marginBottom: 16 }}
          tabBarExtraContent={
            (activeTab === 'cards' || activeTab === 'list') ? (
              <Input
                prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="Search zones…"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                allowClear
                size="small"
                style={{ width: 200, borderRadius: 6 }}
              />
            ) : null
          }
          items={[
            {
              key: 'zones',
              label: <Space size={5}><TeamOutlined />POB Dashboard</Space>,
              children: <POBDashboard onRefreshDash={() => refetch()} />,
            },
            {
              key: 'cards',
              label: <Space size={5}><GlobalOutlined />Zone Cards</Space>,
              children: (
                <Spin spinning={dashLoading}>
                  {/* Filter toolbar */}
                  <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Select
                      placeholder="All Types"
                      allowClear
                      value={typeFilter}
                      onChange={setTypeFilter}
                      size="small"
                      style={{ width: 148 }}
                      popupMatchSelectWidth={false}
                    >
                      {Object.entries(ZONE_TYPE_LABELS).map(([v, l]) => {
                        const zs = getZoneStyle(v);
                        return (
                          <Select.Option key={v} value={v}>
                            <span style={{ color: zs.color, marginRight: 6 }}>{zs.icon}</span>{l}
                          </Select.Option>
                        );
                      })}
                    </Select>
                    <Select
                      placeholder="All Statuses"
                      allowClear
                      value={statusFilter}
                      onChange={setStatusFilter}
                      size="small"
                      style={{ width: 138 }}
                    >
                      {['ACTIVE','INACTIVE','MAINTENANCE','EMERGENCY','LOCKDOWN'].map(s => {
                        const ss = getStatusStyle(s);
                        return (
                          <Select.Option key={s} value={s}>
                            <span style={{ color: ss.color, marginRight: 5 }}>●</span>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </Select.Option>
                        );
                      })}
                    </Select>
                    <Select
                      placeholder="All Hazard Levels"
                      allowClear
                      value={hazardFilter}
                      onChange={setHazardFilter}
                      size="small"
                      style={{ width: 158 }}
                    >
                      {['LOW','MEDIUM','HIGH','CRITICAL'].map(h => {
                        const hs = getHazardStyle(h);
                        return (
                          <Select.Option key={h} value={h}>
                            <span style={{ color: hs.color, marginRight: 5, fontWeight: 700 }}>⚠</span>
                            {h.charAt(0) + h.slice(1).toLowerCase()} Hazard
                          </Select.Option>
                        );
                      })}
                    </Select>
                    {hasFilters && (
                      <Button
                        size="small" type="link"
                        style={{ color: '#EF4444', padding: '0 4px', fontSize: 12 }}
                        onClick={() => { setSearchVal(''); setTypeFilter(null); setStatusFilter(null); setHazardFilter(null); }}
                      >✕ Clear</Button>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' }}>
                      {hasFilters ? `${filtered.length} of ${zones.length}` : zones.length} zone{zones.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                      <GlobalOutlined style={{ fontSize: 48, color: '#D1D5DB', marginBottom: 12, display: 'block' }} />
                      <div style={{ color: '#9CA3AF', fontSize: 14 }}>
                        {hasFilters ? 'No zones match your filters.' : 'No zones configured. Create your first zone.'}
                      </div>
                      {hasFilters && (
                        <Button type="link" size="small" style={{ marginTop: 8 }}
                          onClick={() => { setSearchVal(''); setTypeFilter(null); setStatusFilter(null); setHazardFilter(null); }}>
                          Clear all filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filtered.map(zone => (
                        <Col key={zone.id} xs={24} sm={12} lg={8} xl={6}>
                          <ZoneCard
                            zone={zone}
                            onView={setDetailZone}
                            onEdit={handleEdit}
                            onAssignReader={handleAssignReader}
                            onDelete={id => deleteMutation.mutate({ id })}
                            onStatusChange={(id, s) => patchStatusM.mutate({ id, status: s })}
                          />
                        </Col>
                      ))}
                    </Row>
                  )}
                </Spin>
              ),
            },
            {
              key: 'list',
              label: <Space size={5}><DashboardOutlined />Zone List</Space>,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'white', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

                  {/* ── Toolbar ── */}
                  <div style={{
                    padding: '14px 18px', borderBottom: '1px solid #F3F4F6',
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    background: '#FAFAFA',
                  }}>
                    {/* Filter chips */}
                    <Select
                      placeholder="All Types"
                      allowClear
                      value={typeFilter}
                      onChange={setTypeFilter}
                      size="small"
                      style={{ width: 148 }}
                      popupMatchSelectWidth={false}
                    >
                      {Object.entries(ZONE_TYPE_LABELS).map(([v, l]) => {
                        const zs = getZoneStyle(v);
                        return (
                          <Select.Option key={v} value={v}>
                            <span style={{ color: zs.color, marginRight: 6 }}>{zs.icon}</span>{l}
                          </Select.Option>
                        );
                      })}
                    </Select>

                    <Select
                      placeholder="All Statuses"
                      allowClear
                      value={statusFilter}
                      onChange={setStatusFilter}
                      size="small"
                      style={{ width: 138 }}
                    >
                      {['ACTIVE','INACTIVE','MAINTENANCE','EMERGENCY','LOCKDOWN'].map(s => {
                        const ss = getStatusStyle(s);
                        return (
                          <Select.Option key={s} value={s}>
                            <span style={{ color: ss.color, marginRight: 5 }}>●</span>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </Select.Option>
                        );
                      })}
                    </Select>

                    <Select
                      placeholder="All Hazard Levels"
                      allowClear
                      value={hazardFilter}
                      onChange={setHazardFilter}
                      size="small"
                      style={{ width: 158 }}
                    >
                      {['LOW','MEDIUM','HIGH','CRITICAL'].map(h => {
                        const hs = getHazardStyle(h);
                        return (
                          <Select.Option key={h} value={h}>
                            <span style={{ color: hs.color, marginRight: 5, fontWeight: 700 }}>⚠</span>
                            {h.charAt(0) + h.slice(1).toLowerCase()} Hazard
                          </Select.Option>
                        );
                      })}
                    </Select>

                    {hasFilters && (
                      <Button
                        size="small"
                        type="link"
                        style={{ color: '#EF4444', padding: '0 4px', fontSize: 12 }}
                        onClick={() => { setSearchVal(''); setTypeFilter(null); setStatusFilter(null); setHazardFilter(null); }}
                      >
                        ✕ Clear filters
                      </Button>
                    )}

                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                      {hasFilters && (
                        <span style={{ fontSize: 12, color: '#6B7280' }}>
                          <span style={{ fontWeight: 700, color: '#1F2937' }}>{filtered.length}</span> of {zones.length} zones
                        </span>
                      )}
                      {!hasFilters && (
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{zones.length} zone{zones.length !== 1 ? 's' : ''}</span>
                      )}
                      <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={exportCSV}
                        style={{ borderRadius: 6 }}
                      >Export CSV</Button>
                    </div>
                  </div>

                  {/* ── Bulk action bar (visible only when rows are selected) ── */}
                  {selectedRowKeys.length > 0 && (
                    <div style={{
                      padding: '10px 18px',
                      background: 'linear-gradient(90deg, #EFF6FF, #DBEAFE)',
                      borderBottom: '1px solid #BFDBFE',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}>{selectedRowKeys.length}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A' }}>
                        zone{selectedRowKeys.length !== 1 ? 's' : ''} selected
                      </span>
                      <div style={{ width: 1, height: 16, background: '#BFDBFE' }} />
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        style={{ borderColor: '#93C5FD', color: '#1D4ED8', background: 'white', borderRadius: 6 }}
                        onClick={() => {
                          const zone = filtered.find(z => z.id === selectedRowKeys[0]);
                          if (zone) setDetailZone(zone);
                        }}
                        disabled={selectedRowKeys.length !== 1}
                      >View Detail</Button>
                      <Dropdown
                        menu={{
                          items: ['ACTIVE','INACTIVE','MAINTENANCE','EMERGENCY','LOCKDOWN'].map(s => {
                            const ss2 = getStatusStyle(s);
                            return {
                              key: s,
                              label: (
                                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                                  <div style={{ width:8,height:8,borderRadius:'50%',background:ss2.color,flexShrink:0 }} />
                                  <span style={{color:ss2.color,fontWeight:600,fontSize:12}}>{s.charAt(0)+s.slice(1).toLowerCase()}</span>
                                </div>
                              ),
                              onClick: () => {
                                Promise.all(selectedRowKeys.map(id => patchStatusM.mutateAsync({ id, status: s })))
                                  .then(() => { message.success(`${selectedRowKeys.length} zone(s) → ${s.toLowerCase()}`); setSelectedRowKeys([]); })
                                  .catch(() => message.error('Some status updates failed'));
                              },
                            };
                          }),
                        }}
                      >
                        <Button
                          size="small"
                          icon={<SwapOutlined />}
                          style={{ borderColor: '#93C5FD', color: '#1D4ED8', background: 'white', borderRadius: 6 }}
                        >Set Status <DownOutlined style={{ fontSize: 10 }} /></Button>
                      </Dropdown>
                      <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        style={{ borderColor: '#93C5FD', color: '#0891b2', background: 'white', borderRadius: 6 }}
                        onClick={exportCSV}
                      >Export</Button>
                      <Popconfirm
                        title={`Delete ${selectedRowKeys.length} zone${selectedRowKeys.length !== 1 ? 's' : ''}?`}
                        description="This will permanently remove all selected zones and unassign their readers."
                        okText="Delete All" okButtonProps={{ danger: true }}
                        onConfirm={() => {
                          Promise.all(selectedRowKeys.map(id => deleteMutation.mutateAsync({ id })))
                            .then(() => { message.success(`${selectedRowKeys.length} zone(s) deleted`); setSelectedRowKeys([]); })
                            .catch(() => message.error('Some deletions failed'));
                        }}
                      >
                        <Button
                          size="small" danger
                          icon={<DeleteOutlined />}
                          style={{ borderRadius: 6 }}
                        >Delete Selected</Button>
                      </Popconfirm>
                      <Button
                        size="small" type="text"
                        style={{ color: '#6B7280', marginLeft: 'auto' }}
                        onClick={() => setSelectedRowKeys([])}
                      >✕ Deselect all</Button>
                    </div>
                  )}

                  {/* ── Table ── */}
                  <Table
                    dataSource={filtered}
                    loading={dashLoading}
                    rowKey="id"
                    size="middle"
                    scroll={{ x: 1260 }}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: setSelectedRowKeys,
                      columnWidth: 44,
                      selections: [
                        Table.SELECTION_ALL,
                        Table.SELECTION_INVERT,
                        Table.SELECTION_NONE,
                      ],
                    }}
                    pagination={{
                      pageSize: 15,
                      showTotal: (t, r) => `Showing ${r[0]}–${r[1]} of ${t} zones`,
                      showSizeChanger: true,
                      pageSizeOptions: ['10','15','25','50'],
                      size: 'default',
                      style: { padding: '12px 18px', margin: 0, borderTop: '1px solid #F3F4F6' },
                    }}
                    rowClassName={r => ['EMERGENCY','LOCKDOWN'].includes(r.status) ? 'zone-row-alert' : ''}
                    style={{ borderRadius: 0 }}
                    columns={[
                      /* ── Zone name / code ── */
                      {
                        title: 'Zone', dataIndex: 'name', width: 220, fixed: 'left',
                        sorter: (a, b) => a.name.localeCompare(b.name),
                        render: (name, rec) => {
                          const zs = getZoneStyle(rec.zone_type);
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                                background: `linear-gradient(135deg, ${zs.dark}, ${zs.color})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 15,
                                boxShadow: `0 2px 8px ${zs.color}44`,
                              }}>{zs.icon}</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111827', lineHeight: 1.2 }}>{name}</div>
                                <div style={{ fontSize: 10.5, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2, letterSpacing: '0.02em' }}>{rec.code}</div>
                              </div>
                            </div>
                          );
                        },
                      },

                      /* ── Type ── */
                      {
                        title: 'Type', dataIndex: 'zone_type', width: 148,
                        filters: Object.entries(ZONE_TYPE_LABELS).map(([v, l]) => ({ text: l, value: v })),
                        onFilter: (v, r) => r.zone_type === v,
                        render: t => {
                          const zs = getZoneStyle(t);
                          return (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              background: zs.bg, borderRadius: 6, padding: '4px 9px',
                              border: `1px solid ${zs.color}28`,
                            }}>
                              <span style={{ color: zs.color, fontSize: 11 }}>{zs.icon}</span>
                              <span style={{ color: zs.color, fontSize: 11.5, fontWeight: 600 }}>{ZONE_TYPE_LABELS[t] || t}</span>
                            </div>
                          );
                        },
                      },

                      /* ── Status (click to change) ── */
                      {
                        title: 'Status', dataIndex: 'status', width: 148,
                        filters: ['ACTIVE','INACTIVE','MAINTENANCE','EMERGENCY','LOCKDOWN'].map(s => ({ text: s.charAt(0)+s.slice(1).toLowerCase(), value: s })),
                        onFilter: (v, r) => r.status === v,
                        render: (s, record) => {
                          const ss = getStatusStyle(s);
                          return (
                            <Dropdown
                              trigger={['click']}
                              placement="bottomLeft"
                              menu={{
                                selectedKeys: [s],
                                items: ['ACTIVE','INACTIVE','MAINTENANCE','EMERGENCY','LOCKDOWN'].map(st => {
                                  const ss2 = getStatusStyle(st);
                                  return {
                                    key: st,
                                    label: (
                                      <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                                        <div style={{ width:8,height:8,borderRadius:'50%',background:ss2.color,flexShrink:0 }} />
                                        <span style={{color:ss2.color,fontWeight:600,fontSize:12}}>{st.charAt(0)+st.slice(1).toLowerCase()}</span>
                                      </div>
                                    ),
                                    onClick: () => patchStatusM.mutate({ id: record.id, status: st }),
                                  };
                                }),
                              }}
                            >
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                background: ss.bg, borderRadius: 20, padding: '3px 10px',
                                border: `1px solid ${ss.border}`, cursor: 'pointer',
                              }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ss.color, flexShrink: 0, animation: ss.pulse ? 'zoneDotPulse 2s infinite' : 'none' }} />
                                <span style={{ fontSize: 11.5, fontWeight: 600, color: ss.color }}>{s.charAt(0) + s.slice(1).toLowerCase()}</span>
                                <DownOutlined style={{ fontSize: 8, color: ss.color, opacity: 0.5 }} />
                              </div>
                            </Dropdown>
                          );
                        },
                      },

                      /* ── Hazard ── */
                      {
                        title: 'Hazard', dataIndex: 'hazard_level', width: 118,
                        filters: ['LOW','MEDIUM','HIGH','CRITICAL'].map(h => ({ text: h, value: h })),
                        onFilter: (v, r) => r.hazard_level === v,
                        render: h => {
                          const hs = getHazardStyle(h);
                          return (
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              background: hs.bg, borderRadius: 6, padding: '3px 9px',
                              border: `1px solid ${hs.border}`,
                            }}>
                              <span style={{ fontSize: 11, color: hs.color, fontWeight: 700 }}>⚠</span>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: hs.color }}>{h.charAt(0) + h.slice(1).toLowerCase()}</span>
                            </div>
                          );
                        },
                      },

                      /* ── POB ── */
                      {
                        title: <span style={{ color: '#0078D4' }}>POB</span>,
                        dataIndex: 'current_personnel_count',
                        width: 80, align: 'center',
                        sorter: (a, b) => (a.current_personnel_count ?? 0) - (b.current_personnel_count ?? 0),
                        render: n => (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 40, height: 32, borderRadius: 8,
                            background: (n ?? 0) > 0 ? 'linear-gradient(135deg,#0078D4,#005A9E)' : '#F3F4F6',
                            boxShadow: (n ?? 0) > 0 ? '0 2px 8px rgba(0,120,212,0.35)' : 'none',
                          }}>
                            <span style={{
                              fontSize: (n ?? 0) >= 100 ? 15 : 18,
                              fontWeight: 900,
                              color: (n ?? 0) > 0 ? 'white' : '#D1D5DB',
                              lineHeight: 1,
                            }}>{n ?? 0}</span>
                          </div>
                        ),
                      },

                      /* ── Capacity ── */
                      {
                        title: 'Capacity', key: 'cap', width: 150,
                        sorter: (a, b) => {
                          const pa = a.max_capacity ? (a.current_personnel_count || 0) / a.max_capacity : 0;
                          const pb = b.max_capacity ? (b.current_personnel_count || 0) / b.max_capacity : 0;
                          return pa - pb;
                        },
                        render: (_, r) => {
                          if (!r.max_capacity) return <span style={{ color: '#D1D5DB', fontSize: 12 }}>No limit</span>;
                          const pct = Math.min(100, Math.round(((r.current_personnel_count || 0) / r.max_capacity) * 100));
                          const c   = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981';
                          return (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <span style={{ fontSize: 11.5, color: '#374151', fontWeight: 500 }}>
                                  {r.current_personnel_count ?? 0} <span style={{ color: '#9CA3AF' }}>/ {r.max_capacity}</span>
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{pct}%</span>
                              </div>
                              <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', width: `${pct}%`,
                                  background: `linear-gradient(90deg, ${c}88, ${c})`,
                                  borderRadius: 3, transition: 'width 0.5s',
                                }} />
                              </div>
                            </div>
                          );
                        },
                      },

                      /* ── Readers ── */
                      {
                        title: 'Readers', key: 'reader_count', width: 90, align: 'center',
                        sorter: (a, b) => (a.device_count ?? a.reader_count ?? 0) - (b.device_count ?? b.reader_count ?? 0),
                        render: (_, row) => { const n = row.device_count ?? row.reader_count ?? 0; return (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <ApiOutlined style={{ color: n > 0 ? '#7C3AED' : '#D1D5DB', fontSize: 13 }} />
                            <span style={{ fontWeight: 700, color: n > 0 ? '#7C3AED' : '#9CA3AF', fontSize: 13 }}>{n ?? 0}</span>
                          </div>
                        ); },
                      },

                      /* ── Location ── */
                      {
                        title: 'Location', key: 'loc', width: 170,
                        render: (_, r) => (
                          <div>
                            {r.state && (
                              <div style={{ fontSize: 12.5, fontWeight: 500, color: '#374151', marginBottom: 2 }}>{r.state}</div>
                            )}
                            {r.latitude && r.longitude ? (
                              <a
                                href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=14/${r.latitude}/${r.longitude}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 11, color: '#0078D4', display: 'flex', alignItems: 'center', gap: 3 }}
                              >
                                <EnvironmentOutlined style={{ fontSize: 10 }} />
                                {parseFloat(r.latitude).toFixed(4)}°, {parseFloat(r.longitude).toFixed(4)}°
                              </a>
                            ) : (
                              <span style={{ fontSize: 11, color: '#D1D5DB' }}>No GPS</span>
                            )}
                          </div>
                        ),
                      },

                      /* ── Last Activity ── */
                      {
                        title: 'Last Activity', dataIndex: 'last_activity_time', width: 130,
                        sorter: (a, b) => new Date(a.last_activity_time || 0) - new Date(b.last_activity_time || 0),
                        render: v => v ? (
                          <Tooltip title={fmtTime(v)} placement="left">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{timeAgo(v)}</span>
                              <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>{new Date(v).toLocaleDateString('en-NG', { day:'2-digit', month:'short' })}</span>
                            </div>
                          </Tooltip>
                        ) : <span style={{ color: '#D1D5DB', fontSize: 12 }}>No activity</span>,
                      },

                      /* ── Actions ── */
                      {
                        title: '', key: 'actions', fixed: 'right', width: 112,
                        render: (_, record) => (
                          <Space size={2}>
                            <Tooltip title="View Detail">
                              <Button
                                size="small" type="text" icon={<EyeOutlined />}
                                onClick={() => setDetailZone(record)}
                                style={{ color: '#0078D4', width: 28, height: 28 }}
                              />
                            </Tooltip>
                            <Tooltip title="Edit Zone">
                              <Button
                                size="small" type="text" icon={<EditOutlined />}
                                onClick={() => handleEdit(record)}
                                style={{ color: '#10B981', width: 28, height: 28 }}
                              />
                            </Tooltip>
                            <Tooltip title="Assign Reader">
                              <Button
                                size="small" type="text" icon={<ApiOutlined />}
                                onClick={() => handleAssignReader(record)}
                                style={{ color: '#7C3AED', width: 28, height: 28 }}
                              />
                            </Tooltip>
                            <Popconfirm
                              title="Delete zone?"
                              description="Permanently removes the zone and unassigns all readers."
                              onConfirm={() => deleteMutation.mutate({ id: record.id })}
                              okText="Delete" okButtonProps={{ danger: true }}
                            >
                              <Tooltip title="Delete">
                                <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ width: 28, height: 28 }} />
                              </Tooltip>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'map',
              label: <Space size={5}><CompassOutlined />GPS Map</Space>,
              children: activeTab === 'map' ? <ZoneMapView zones={zones} /> : <div />,
            },
            {
              key: 'readers',
              label: <Space size={5}><ApiOutlined />ADMS Readers</Space>,
              children: <ReadersTab />,
            },
          ]}
        />
      </div>

      {/* ── Detail Drawer ── */}
      <ZoneDetailDrawer zone={detailZone} open={!!detailZone} onClose={() => setDetailZone(null)} />

      {/* ── Create / Edit Modal ── */}
      <Modal
        title={
          <Space>
            {editingZone ? <EditOutlined style={{ color: '#10B981' }} /> : <PlusOutlined style={{ color: '#0078D4' }} />}
            {editingZone ? `Edit Zone — ${editingZone.name}` : 'Create New Zone'}
          </Space>
        }
        open={isModalOpen}
        onOk={() => form.validateFields().then(saveMutation.mutate)}
        onCancel={() => { setIsModalOpen(false); setEditingZone(null); form.resetFields(); }}
        okText={editingZone ? 'Update Zone' : 'Create Zone'}
        confirmLoading={saveMutation.isPending}
        width={800} destroyOnHidden
      >
        <div style={{
          background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
          border: '1px solid #BFDBFE', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#1D4ED8',
        }}>
          <EnvironmentOutlined style={{ fontSize: 15 }} />
          Add GPS coordinates to enable real-time map tracking. ADMS readers at this location send punches over 4G —
          assigning them to this zone links their punches to this zone's POB count.
        </div>
        <Form form={form} layout="vertical" size="middle">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Zone Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Bonga FPSO Platform" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code" label="Zone Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. OFF-BONGA-001" disabled={!!editingZone} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="zone_type" label="Zone Type" initialValue="LOCATION" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="children">
                  {Object.entries(ZONE_TYPE_LABELS).map(([v, l]) => <Select.Option key={v} value={v}>{l}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status" initialValue="ACTIVE">
                <Select>
                  {['ACTIVE','INACTIVE','MAINTENANCE','EMERGENCY','LOCKDOWN'].map(s => (
                    <Select.Option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="hazard_level" label="Hazard Level" initialValue="LOW">
                <Select>
                  {['LOW','MEDIUM','HIGH','CRITICAL'].map(h => <Select.Option key={h} value={h}>{h}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="state" label="State / Location">
                <Input placeholder="e.g. Delta State, Offshore" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="latitude" label="Latitude (GPS)" tooltip="e.g. 5.5557">
                <Input placeholder="e.g. 5.5557" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="longitude" label="Longitude (GPS)" tooltip="e.g. 5.7440">
                <Input placeholder="e.g. 5.7440" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="max_capacity" label="Max Capacity">
                <Input type="number" min={0} placeholder="Max persons" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="access_level" label="Access Level" initialValue="RESTRICTED">
                <Select>
                  {['PUBLIC','RESTRICTED','SECURE'].map(a => <Select.Option key={a} value={a}>{a}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contact_person" label="Safety Contact">
                <Input placeholder="Safety officer name" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Physical Address">
            <Input placeholder="Full address or location description" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Zone description and operational notes" />
          </Form.Item>
          <Divider style={{ margin: '8px 0' }} />
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="parent_zone_id" label="Parent Zone" tooltip="Makes this a sub-zone shown inside the parent on the POB Dashboard">
                <Select placeholder="None (top-level)" allowClear showSearch optionFilterProp="label">
                  {(Array.isArray(allZonesForParent) ? allZonesForParent : [])
                    .filter(z => z.id !== editingZone?.id)
                    .map(z => <Select.Option key={z.id} value={z.id} label={z.name}>{z.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tile_position" label="Dashboard Position" tooltip="Where this tile appears around the parent zone image">
                <Select>
                  {['auto','left','right','top','bottom'].map(v => <Select.Option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="display_color" label="Tile Color" tooltip="Color of this zone's tile on the POB Dashboard">
                <Select placeholder="Auto (by zone type)" allowClear>
                  {PRESET_COLORS.map(c => (
                    <Select.Option key={c.value} value={c.value}>
                      <Space size={6}>
                        <span style={{ display:'inline-block',width:14,height:14,background:c.value,borderRadius:2,verticalAlign:'middle' }} />
                        {c.label}
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Assign Reader Modal ── */}
      <Modal
        title={<Space><ApiOutlined style={{ color: '#7C3AED' }} />Assign ADMS Reader — {readerZone?.name}</Space>}
        open={isReaderModalOpen}
        onOk={() => readerForm.validateFields().then(assignReaderMutation.mutate).catch(() => {})}
        onCancel={() => { setIsReaderModalOpen(false); readerForm.resetFields(); }}
        okText="Assign Reader" confirmLoading={assignReaderMutation.isPending}
        width={560} destroyOnHidden
      >
        <div style={{
          background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)',
          border: '1px solid #C4B5FD', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: '#6D28D9',
        }}>
          <WifiOutlined style={{ fontSize: 15 }} />
          Once assigned, every attendance punch from this reader automatically updates this zone's POB count
          in real time via ADMS over 4G — from anywhere in Nigeria.
        </div>
        <Form form={readerForm} layout="vertical">
          <Form.Item name="device_id" label="Select ZKTeco Reader / Device" rules={[{ required: true, message: 'Please select a device' }]}>
            <Select placeholder="Choose a device" showSearch optionFilterProp="label" size="large">
              {devices.map(d => (
                <Select.Option key={d.id} value={d.id} label={`${d.alias} ${d.sn}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: d.state === 1
                        ? 'linear-gradient(135deg,#059669,#10B981)'
                        : 'linear-gradient(135deg,#6B7280,#9CA3AF)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: 12,
                    }}><ApiOutlined /></div>
                    <div>
                      <span style={{ fontWeight: 500 }}>{d.alias}</span>
                      <code style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 6 }}>{d.sn}</code>
                    </div>
                    {d.already_assigned && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>
                        Move here
                      </span>
                    )}
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {/* Reader Purpose — the critical field for zone tracking */}
          <Form.Item
            name="reader_purpose"
            label="Reader Role"
            initialValue="ACCESS_ENTRY"
            rules={[{ required: true, message: 'Select reader role' }]}
            tooltip="Determines how this reader's punches are processed. Entry and Exit readers track who is physically in the zone."
          >
            <Select size="large">
              <Select.Option value="ACCESS_ENTRY">
                <span style={{ color: '#10B981', fontWeight: 600 }}>▶ Entry Reader</span>
                <span style={{ color: '#6B7280', fontSize: 11, marginLeft: 8 }}>Person entering zone</span>
              </Select.Option>
              <Select.Option value="ACCESS_EXIT">
                <span style={{ color: '#EF4444', fontWeight: 600 }}>◀ Exit Reader</span>
                <span style={{ color: '#6B7280', fontSize: 11, marginLeft: 8 }}>Person leaving zone</span>
              </Select.Option>
              <Select.Option value="ATTENDANCE">
                <span style={{ color: '#6B7280', fontWeight: 600 }}>⏱ T&amp;A Reader</span>
                <span style={{ color: '#6B7280', fontSize: 11, marginLeft: 8 }}>Time &amp; Attendance only</span>
              </Select.Option>
              <Select.Option value="MUSTERING">
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>🔔 Muster Reader</span>
                <span style={{ color: '#6B7280', fontSize: 11, marginLeft: 8 }}>Emergency mustering</span>
              </Select.Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assignment_type" label="Assignment Type" initialValue="PERMANENT">
                <Select>
                  <Select.Option value="PERMANENT">Permanent</Select.Option>
                  <Select.Option value="TEMPORARY">Temporary</Select.Option>
                  <Select.Option value="EMERGENCY">Emergency</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_primary" label="Primary Reader" initialValue={false}>
                <Select>
                  <Select.Option value={false}>No</Select.Option>
                  <Select.Option value={true}>Yes — Primary</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="e.g. Main gate reader, Entry only" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        @keyframes zoneDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.4); }
        }
        .zone-row-alert td { background: #FFF8F7 !important; }
        .zone-row-alert:hover td { background: #FEE2E2 !important; }
        .ant-table-tbody > tr:hover > td { background: #F0F7FF !important; }
        .ant-table-thead > tr > th {
          background: #F8FAFC !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #6B7280 !important;
          letter-spacing: 0.03em !important;
          text-transform: uppercase !important;
          border-bottom: 1px solid #E5E7EB !important;
          padding: 10px 14px !important;
        }
        .ant-table-tbody > tr > td { padding: 12px 14px !important; border-bottom: 1px solid #F9FAFB !important; }
        .ant-table-column-sorter { color: #D1D5DB !important; }
        .ant-table-filter-trigger { color: #D1D5DB !important; }
      `}</style>
    </div>
  );
};

export default ZoneManagement;
