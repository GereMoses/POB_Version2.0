import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Avatar, Badge, Space, Tooltip, Popover, Input, List,
  Empty, Divider, Button, Tag, Modal, Descriptions,
} from 'antd';
import {
  DashboardOutlined, TeamOutlined, ClockCircleOutlined, DesktopOutlined,
  SafetyOutlined, AlertOutlined, FileTextOutlined, SettingOutlined,
  UserOutlined, LogoutOutlined, BellOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, LockOutlined, UsergroupAddOutlined, CalendarOutlined,
  GlobalOutlined, BarChartOutlined, DollarOutlined, MedicineBoxOutlined,
  DownOutlined, CheckCircleOutlined, AppstoreOutlined,
  ApartmentOutlined, SwapOutlined, GiftOutlined, BookOutlined,
  StarOutlined, WarningOutlined, ToolOutlined,
  SafetyCertificateOutlined, HomeOutlined, SearchOutlined,
  FullscreenOutlined, FullscreenExitOutlined, CloseOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined, CheckOutlined,
  ReloadOutlined, ThunderboltOutlined, IdcardOutlined,
  RightOutlined, QuestionCircleOutlined, CrownOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const COLORS = {
  sidebarBg: '#1E2A3B',
  sidebarBgHover: 'rgba(255,255,255,0.07)',
  sidebarActive: 'rgba(0,120,212,0.18)',
  sidebarActiveBorder: '#0078D4',
  sidebarText: '#C9D1D9',
  sidebarTextActive: '#FFFFFF',
  sidebarGroupLabel: '#8892A4',
  topbarBg: '#FFFFFF',
  topbarBorder: '#E1E4E8',
  contentBg: '#F3F4F8',
  accentBlue: '#0078D4',
  accentBlueDark: '#005A9E',
  headerHeight: 56,
  sidebarWidth: 240,
  sidebarCollapsed: 56,
};

const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [
      { key: '/dashboard',  icon: <DashboardOutlined />, label: 'Dashboard' },
      { key: '/pob-status', icon: <BarChartOutlined />,  label: 'POB Status', permission: 'pob.view' },
    ],
  },
  {
    label: 'HUMAN RESOURCES',
    items: [
      {
        key: 'personnel-group', icon: <TeamOutlined />, label: 'Personnel', permission: 'personnel.view',
        children: [
          { key: '/personnel',                        icon: <UserOutlined />,             label: 'Employees' },
          { key: '/personnel/leave-management',       icon: <CalendarOutlined />,         label: 'Leave Management' },
          { key: '/personnel/training-management',    icon: <BookOutlined />,             label: 'Training' },
          { key: '/personnel/performance-management', icon: <StarOutlined />,             label: 'Performance' },
          { key: '/personnel/disciplinary-management',icon: <WarningOutlined />,          label: 'Disciplinary' },
          { key: '/personnel/promotion-transfer',     icon: <SwapOutlined />,             label: 'Promotion/Transfer' },
          { key: '/personnel/employment-contract',    icon: <FileTextOutlined />,         label: 'Contracts' },
          { key: '/personnel/benefits-management',    icon: <GiftOutlined />,             label: 'Benefits' },
          { key: '/personnel/departments',            icon: <ApartmentOutlined />,        label: 'Departments' },
          { key: '/personnel/positions',              icon: <TeamOutlined />,             label: 'Positions' },
          { key: '/personnel/resignation',            icon: <FileTextOutlined />,         label: 'Resignation' },
          { key: '/personnel/custom-attributes',      icon: <SettingOutlined />,          label: 'Custom Attributes' },
          { key: '/personnel/onboarding',             icon: <SafetyCertificateOutlined />,label: 'Onboarding' },
          { key: '/personnel/vendors',                icon: <ToolOutlined />,             label: 'Contractor/Vendor' },
        ],
      },
      { key: '/payroll', icon: <DollarOutlined />, label: 'Payroll', permission: 'payroll.view' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { key: '/attendance',          icon: <ClockCircleOutlined />, label: 'Attendance',            permission: 'attendance.view' },
      { key: '/zones',               icon: <GlobalOutlined />,      label: 'Zones' },
      { key: '/transport-manifest',  icon: <IdcardOutlined />,      label: 'Transport Manifest' },
      { key: '/emergency-response',  icon: <AlertOutlined />,       label: 'Emergency & Mustering', permission: 'emergency.view' },
      { key: '/mtd',                 icon: <MedicineBoxOutlined />, label: 'MTD' },
    ],
  },
  {
    label: 'SECURITY',
    items: [
      { key: '/access-control', icon: <LockOutlined />,         label: 'Access Control', permission: 'access_control.view' },
      { key: '/device',         icon: <DesktopOutlined />,       label: 'Devices',        permission: 'devices.view' },
      { key: '/visitor',        icon: <UsergroupAddOutlined />,  label: 'Visitor',        permission: 'visitors.view' },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { key: '/meeting',      icon: <CalendarOutlined />,        label: 'Meeting' },
      { key: '/reports',      icon: <FileTextOutlined />,        label: 'Reports',      permission: 'reports.view' },
      { key: '/settings',     icon: <SettingOutlined />,         label: 'Settings',     permission: 'settings.view' },
      { key: '/subscription', icon: <CrownOutlined />,           label: 'Subscription', globalAdminOnly: true },
    ],
  },
];

const APP_TILES = [
  { key: '/dashboard',          icon: <DashboardOutlined />,    label: 'Dashboard',          color: '#0078D4', bg: '#EFF6FF' },
  { key: '/pob-status',         icon: <BarChartOutlined />,     label: 'POB Status',         color: '#7C3AED', bg: '#F5F3FF', permission: 'pob.view' },
  { key: '/personnel',          icon: <TeamOutlined />,         label: 'Personnel',          color: '#047857', bg: '#ECFDF5', permission: 'personnel.view' },
  { key: '/attendance',         icon: <ClockCircleOutlined />,  label: 'Attendance',         color: '#B45309', bg: '#FFFBEB', permission: 'attendance.view' },
  { key: '/zones',              icon: <GlobalOutlined />,       label: 'Zones',              color: '#0E7490', bg: '#ECFEFF' },
  { key: '/emergency-response', icon: <AlertOutlined />,        label: 'Emergency & Muster', color: '#B91C1C', bg: '#FEF2F2', permission: 'emergency.view' },
  { key: '/access-control',     icon: <LockOutlined />,         label: 'Access Control',     color: '#1D4ED8', bg: '#EFF6FF', permission: 'access_control.view' },
  { key: '/device',             icon: <DesktopOutlined />,      label: 'Devices',            color: '#374151', bg: '#F9FAFB', permission: 'devices.view' },
  { key: '/visitor',            icon: <UsergroupAddOutlined />, label: 'Visitors',           color: '#065F46', bg: '#ECFDF5', permission: 'visitors.view' },
  { key: '/reports',            icon: <FileTextOutlined />,     label: 'Reports',            color: '#92400E', bg: '#FFFBEB', permission: 'reports.view' },
  { key: '/settings',           icon: <SettingOutlined />,      label: 'Settings',           color: '#4B5563', bg: '#F3F4F6', permission: 'settings.view' },
];

const NOTIF_STYLE = {
  info:     { color: '#1890ff', bg: '#e6f7ff', icon: <InfoCircleOutlined /> },
  warning:  { color: '#fa8c16', bg: '#fff7e6', icon: <ExclamationCircleOutlined /> },
  error:    { color: '#f5222d', bg: '#fff1f0', icon: <ExclamationCircleOutlined /> },
  success:  { color: '#52c41a', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
  emergency:{ color: '#f5222d', bg: '#fff1f0', icon: <AlertOutlined /> },
};

const getNotifStyle = (type) => NOTIF_STYLE[type] || NOTIF_STYLE.info;

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const Layout = ({ user, onLogout, children }) => {
  const [collapsed,      setCollapsed]     = useState(false);
  const [expandedItems,  setExpandedItems] = useState({ 'personnel-group': true });
  const [notifOpen,      setNotifOpen]     = useState(false);
  const [appsOpen,       setAppsOpen]      = useState(false);
  const [searchOpen,     setSearchOpen]    = useState(false);
  const [searchVal,      setSearchVal]     = useState('');
  const [isFullscreen,   setIsFullscreen]  = useState(false);
  const [clockDate,      setClockDate]     = useState('');
  const [clockTime,      setClockTime]     = useState('');
  const [profileOpen,    setProfileOpen]   = useState(false);
  const [userPopOpen,    setUserPopOpen]   = useState(false);
  const searchRef = useRef(null);
  const qc = useQueryClient();
  const navigate  = useNavigate();
  const location  = useLocation();

  const canSee = useCallback((permission, globalAdminOnly) => {
    if (globalAdminOnly) return Boolean(user?.is_global_admin);
    if (!permission) return true;
    if (user?.is_superuser) return true;
    return (user?.permissions || []).includes(permission);
  }, [user]);

  /* ── subscription status ── */
  const { data: subData } = useQuery({
    queryKey: ['subscription-status-topbar'],
    queryFn: () => fetch('/api/v1/subscription/status').then(r => r.json()),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
  const sub = subData?.data;

  const SUB_THEME = {
    active:     { bg: '#F0FDF4', border: '#86EFAC', color: '#166534', dot: '#22C55E' },
    warning:    { bg: '#FFFBEB', border: '#FCD34D', color: '#92400E', dot: '#F59E0B' },
    critical:   { bg: '#FFF1F0', border: '#FCA5A5', color: '#991B1B', dot: '#EF4444' },
    expired:    { bg: '#FFF1F0', border: '#EF4444', color: '#7F1D1D', dot: '#EF4444' },
    no_license: { bg: '#F3F4F6', border: '#D1D5DB', color: '#4B5563', dot: '#9CA3AF' },
  };
  const subTheme = SUB_THEME[sub?.status] || SUB_THEME.active;

  const formatExpiryDt = (dt) => {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      if (isNaN(d)) return dt;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return dt; }
  };

  const subLabel = (() => {
    if (!sub || sub.status === 'active') return null; // hide badge when healthy
    if (sub.status === 'no_license') return 'No License';
    if (sub.status === 'expired')    return 'License Expired';
    return `Expires in ${sub.days_remaining}d`;
  })();

  const subTooltip = (() => {
    if (!sub) return '';
    if (sub.status === 'no_license') return 'No subscription found. Contact your vendor.';
    if (sub.status === 'expired')    return `Subscription expired on ${formatExpiryDt(sub.expiry_date)}. Contact your vendor to renew.`;
    return `Subscription expires on ${formatExpiryDt(sub.expiry_date)} (${sub.days_remaining} days remaining)`;
  })();

  /* ── live clock ── */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockDate(now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }));
      setClockTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── fullscreen listener ── */
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  /* ── auto-expand active group ── */
  useEffect(() => {
    NAV_GROUPS.forEach(g =>
      g.items.forEach(item => {
        if (item.children && item.children.some(c => location.pathname.startsWith(c.key)))
          setExpandedItems(prev => ({ ...prev, [item.key]: true }));
      })
    );
  }, [location.pathname]);

  /* ── notifications query ── */
  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiService.get('/api/v1/notifications/'),
    refetchInterval: notifOpen ? 15000 : 60000,
    retry: 1,
  });
  const rawNotifs = notifData?.data?.results ?? notifData?.data ?? [];
  const notifications = Array.isArray(rawNotifs) ? rawNotifs : [];
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = useMutation({
    mutationFn: () => apiService.put('/api/v1/notifications/mark-all-read/'),
    onSuccess: () => qc.invalidateQueries(['notifications']),
    onSettled: () => qc.invalidateQueries(['notifications']),
  });

  const markOneRead = useMutation({
    mutationFn: (id) => apiService.put(`/api/v1/notifications/${id}/read/`),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  /* ── search ── */
  const allNavItems = NAV_GROUPS.flatMap(g =>
    g.items.filter(item => canSee(item.permission, item.globalAdminOnly)).flatMap(item => item.children
      ? [item, ...item.children]
      : [item]
    )
  );
  const searchResults = searchVal.trim()
    ? allNavItems.filter(i => i.label.toLowerCase().includes(searchVal.toLowerCase()) && i.key !== 'personnel-group')
    : [];

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  /* ── nav helpers ── */
  const isActive = key => {
    if (key === '/personnel') return location.pathname === '/personnel';
    return location.pathname === key || location.pathname.startsWith(key + '/');
  };
  const isGroupActive = item => {
    if (!item.children) return isActive(item.key);
    return item.children.some(c => isActive(c.key));
  };
  const toggleExpand = key => setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));

  /* ── breadcrumbs ── */
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const crumbs = [{ label: 'Home', icon: <HomeOutlined />, path: '/dashboard' }];
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children) {
          const child = item.children.find(c => c.key === path);
          if (child) {
            crumbs.push({ label: item.label, path: item.key });
            crumbs.push({ label: child.label, path: child.key });
            return crumbs;
          }
          if (path.startsWith(item.key + '/')) {
            crumbs.push({ label: item.label, path: item.key });
            return crumbs;
          }
        } else if (item.key === path || path.startsWith(item.key + '/')) {
          crumbs.push({ label: item.label, path: item.key });
          return crumbs;
        }
      }
    }
    return crumbs;
  };


  /* ── sidebar nav item renderer ── */
  const renderNavItem = (item, depth = 0) => {
    const active      = isActive(item.key);
    const groupActive = isGroupActive(item);
    const expanded    = expandedItems[item.key];
    const hasChildren = !!item.children;

    const itemStyle = {
      display: 'flex', alignItems: 'center', cursor: 'pointer',
      borderRadius: 6, margin: '1px 6px', transition: 'all 0.15s ease',
      position: 'relative',
      padding: collapsed ? '10px 0' : depth === 1 ? '7px 16px 7px 44px' : '10px 16px',
      background: active ? COLORS.sidebarActive : 'transparent',
      borderLeft: active && depth === 0
        ? `3px solid ${COLORS.sidebarActiveBorder}`
        : depth === 0 ? '3px solid transparent' : 'none',
      justifyContent: collapsed ? 'center' : 'flex-start',
      gap: 10,
    };

    const content = (
      <div
        style={itemStyle}
        onClick={() => hasChildren ? toggleExpand(item.key) : navigate(item.key)}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = COLORS.sidebarBgHover; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          fontSize: depth === 1 ? 13 : 16,
          color: active ? '#fff' : groupActive ? '#90B8E0' : COLORS.sidebarText,
          flexShrink: 0, width: 18, textAlign: 'center',
        }}>{item.icon}</span>
        {!collapsed && (
          <span style={{
            fontSize: depth === 1 ? 12.5 : 13.5,
            fontWeight: active ? 600 : 400,
            color: active ? '#fff' : groupActive && depth === 0 ? '#B8D4F0' : COLORS.sidebarText,
            flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{item.label}</span>
        )}
        {!collapsed && hasChildren && (
          <DownOutlined style={{
            fontSize: 10, color: COLORS.sidebarGroupLabel, flexShrink: 0,
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s',
          }} />
        )}
      </div>
    );

    return (
      <div key={item.key}>
        {collapsed && depth === 0
          ? <Tooltip title={item.label} placement="right">{content}</Tooltip>
          : content}
        {hasChildren && expanded && !collapsed && (
          <div style={{ overflow: 'hidden' }}>
            {item.children.map(child => renderNavItem(child, 1))}
          </div>
        )}
      </div>
    );
  };

  /* ── notifications panel ── */
  const notifPanel = (
    <div style={{ width: 360 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1F2937' }}>Notifications</span>
          {unreadCount > 0 && (
            <span style={{
              marginLeft: 8, background: '#EFF6FF', color: '#0078D4',
              borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600,
            }}>{unreadCount} new</span>
          )}
        </div>
        <Space size={6}>
          <Tooltip title="Refresh">
            <Button type="text" size="small" icon={<ReloadOutlined />}
              onClick={() => refetchNotifs()} style={{ color: '#6B7A8D' }} />
          </Tooltip>
          {unreadCount > 0 && (
            <Button type="text" size="small" style={{ color: COLORS.accentBlue, fontSize: 12 }}
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          )}
        </Space>
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto' }} className="pob-notif-scroll">
        {notifications.length === 0 ? (
          <Empty description="No notifications" image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '32px 0' }} />
        ) : (
          notifications.slice(0, 20).map(n => {
            const ns = getNotifStyle(n.notification_type || n.type);
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markOneRead.mutate(n.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f8f8f8',
                  background: n.is_read ? 'transparent' : '#FAFCFF',
                  cursor: n.is_read ? 'default' : 'pointer',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = n.is_read ? 'transparent' : '#FAFCFF'; }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: ns.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: ns.color, fontSize: 15,
                }}>{ns.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: n.is_read ? 500 : 600, fontSize: 13,
                    color: '#1F2937', marginBottom: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{n.title || n.subject || 'Notification'}</div>
                  <div style={{
                    fontSize: 12, color: '#6B7A8D', lineHeight: 1.4,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>{n.message || n.body || ''}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
                {!n.is_read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.accentBlue, flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
        <Button type="link" size="small" style={{ color: COLORS.accentBlue, fontSize: 12 }}
          onClick={() => { setNotifOpen(false); navigate('/notifications'); }}>
          View all notifications
        </Button>
      </div>
    </div>
  );

  /* ── app launcher panel ── */
  const appsPanel = (
    <div style={{ width: 340 }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #f0f0f0' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#1F2937' }}>All Modules</span>
      </div>
      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {APP_TILES.filter(tile => canSee(tile.permission)).map(tile => (
          <div
            key={tile.key}
            onClick={() => { navigate(tile.key); setAppsOpen(false); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '14px 8px 10px', borderRadius: 10, cursor: 'pointer',
              transition: 'all 0.15s', border: '1px solid transparent',
              background: location.pathname.startsWith(tile.key) ? tile.bg : 'transparent',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = tile.bg;
              e.currentTarget.style.border = `1px solid ${tile.color}30`;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = location.pathname.startsWith(tile.key) ? tile.bg : 'transparent';
              e.currentTarget.style.border = '1px solid transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: tile.bg,
              border: `1px solid ${tile.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: tile.color, fontSize: 18, marginBottom: 6,
            }}>{tile.icon}</div>
            <span style={{ fontSize: 11, color: '#374151', fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>
              {tile.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── search results dropdown ── */
  const searchDropdown = searchOpen && searchResults.length > 0 && (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
      background: 'white', borderRadius: '0 0 8px 8px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      border: '1px solid #E1E4E8', borderTop: 'none',
      maxHeight: 280, overflowY: 'auto',
    }}>
      {searchResults.map(item => (
        <div
          key={item.key}
          onClick={() => { navigate(item.key); setSearchOpen(false); setSearchVal(''); }}
          style={{
            padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, color: '#374151', transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F3F4F8'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ color: COLORS.accentBlue, fontSize: 14 }}>{item.icon}</span>
          {item.label}
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto', fontFamily: 'monospace' }}>
            {item.key}
          </span>
        </div>
      ))}
    </div>
  );

  /* ── user popover panel ── */
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username || 'Admin';
  const initials = (user?.first_name?.[0] || user?.username?.[0] || 'A').toUpperCase();

  const userPopPanel = (
    <div style={{ width: 288 }}>
      {/* Profile header */}
      <div style={{
        background: 'linear-gradient(145deg, #0d1b2e 0%, #1a2d45 55%, #0f2137 100%)',
        borderRadius: '8px 8px 0 0', padding: '20px 18px 16px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:-24, right:-24, width:90, height:90, borderRadius:'50%', background:'rgba(0,120,212,0.12)' }} />
        <div style={{ position:'absolute', bottom:-16, left:40, width:60, height:60, borderRadius:'50%', background:'rgba(0,120,212,0.07)' }} />

        <div style={{ display:'flex', alignItems:'center', gap:14, position:'relative' }}>
          {/* Avatar */}
          <div style={{
            width:56, height:56, borderRadius:14, flexShrink:0,
            background:'linear-gradient(135deg, #0078D4 0%, #005A9E 100%)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:22, fontWeight:800, color:'white',
            boxShadow:'0 4px 16px rgba(0,120,212,0.45)',
            border:'2px solid rgba(255,255,255,0.15)',
          }}>{initials}</div>

          <div style={{ minWidth:0, flex:1 }}>
            <div style={{
              color:'white', fontWeight:700, fontSize:15, lineHeight:1.25,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>{displayName}</div>
            <div style={{ marginTop:5 }}>
              <span style={{
                background: user?.is_superuser ? 'rgba(0,120,212,0.28)' : 'rgba(255,255,255,0.1)',
                color: user?.is_superuser ? '#60A5FA' : 'rgba(255,255,255,0.65)',
                fontSize:10, fontWeight:700, letterSpacing:'0.06em',
                padding:'2px 8px', borderRadius:10,
                border:`1px solid ${user?.is_superuser ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.12)'}`,
              }}>
                {user?.is_superuser ? 'SUPER ADMIN' : 'USER'}
              </span>
            </div>
            {user?.email && (
              <div style={{
                color:'rgba(255,255,255,0.42)', fontSize:11, marginTop:6,
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>{user.email}</div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          marginTop:13, paddingTop:11,
          borderTop:'1px solid rgba(255,255,255,0.07)',
          position:'relative',
        }}>
          <div style={{
            width:7, height:7, borderRadius:'50%', background:'#22C55E',
            animation:'statusPulse 2s infinite', flexShrink:0,
          }} />
          <span style={{ color:'rgba(255,255,255,0.45)', fontSize:11 }}>Active now</span>
          {user?.username && (
            <span style={{
              marginLeft:'auto', color:'rgba(255,255,255,0.28)',
              fontSize:10.5, fontFamily:'monospace',
            }}>@{user.username}</span>
          )}
        </div>
      </div>

      {/* Menu items */}
      <div style={{ padding:'6px 0' }}>
        {[
          {
            icon:<UserOutlined />, label:'My Profile',
            sub:'View & edit your details', color:'#0078D4',
            action:() => { setUserPopOpen(false); setProfileOpen(true); },
          },
          {
            icon:<SettingOutlined />, label:'Account Settings',
            sub:'Preferences & security', color:'#7C3AED',
            action:() => { setUserPopOpen(false); navigate('/settings'); },
          },
          {
            icon:<LockOutlined />, label:'Change Password',
            sub:'Update your credentials', color:'#047857',
            action:() => { setUserPopOpen(false); navigate('/settings'); },
          },
          {
            icon:<QuestionCircleOutlined />, label:'Help & Support',
            sub:'Docs, guides & contact', color:'#B45309',
            action:() => {},
          },
        ].map(item => (
          <div
            key={item.label}
            onClick={item.action}
            style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'9px 16px', cursor:'pointer', transition:'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='#F5F7FA'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <div style={{
              width:36, height:36, borderRadius:9, flexShrink:0,
              background:`${item.color}12`, border:`1px solid ${item.color}22`,
              display:'flex', alignItems:'center', justifyContent:'center',
              color:item.color, fontSize:15,
            }}>{item.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#1F2937', lineHeight:1.3 }}>{item.label}</div>
              <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{item.sub}</div>
            </div>
            <RightOutlined style={{ fontSize:10, color:'#D1D5DB', flexShrink:0 }} />
          </div>
        ))}
      </div>

      <Divider style={{ margin:'4px 0' }} />

      {/* Sign out */}
      <div style={{ padding:'8px 12px 12px' }}>
        <div
          onClick={() => { setUserPopOpen(false); onLogout(); }}
          style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            padding:'9px 0', borderRadius:8, cursor:'pointer',
            background:'#FEF2F2', border:'1px solid #FECACA',
            color:'#DC2626', fontWeight:600, fontSize:13,
            transition:'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='#FEE2E2'; e.currentTarget.style.borderColor='#FCA5A5'; }}
          onMouseLeave={e => { e.currentTarget.style.background='#FEF2F2'; e.currentTarget.style.borderColor='#FECACA'; }}
        >
          <LogoutOutlined style={{ fontSize:14 }} />
          Sign Out
        </div>
      </div>
    </div>
  );

  const breadcrumbs = getBreadcrumbs();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: collapsed ? COLORS.sidebarCollapsed : COLORS.sidebarWidth,
        minWidth: collapsed ? COLORS.sidebarCollapsed : COLORS.sidebarWidth,
        background: COLORS.sidebarBg,
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        boxShadow: '2px 0 8px rgba(0,0,0,0.18)',
        zIndex: 100,
      }}>

        {/* Logo */}
        <div style={{
          height: COLORS.headerHeight,
          display: 'flex', alignItems: 'center',
          padding: collapsed ? '0 12px' : '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          gap: 10, flexShrink: 0,
        }}>
          <img src="/logo/image.png" alt="Marconi.ng EPC Limited"
            style={{ width: collapsed ? 32 : 36, height: collapsed ? 32 : 36,
              borderRadius: 6, objectFit: 'contain', flexShrink: 0, background: '#fff', padding: 2 }} />
          {!collapsed && (
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2, letterSpacing: '0.01em' }}>
                Marconi.ng EPC
              </div>
              <div style={{ color: '#6B7A8D', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                POB Management
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}
          className="pob-sidebar-scroll">
          {NAV_GROUPS.map(group => {
            const visibleItems = group.items.filter(item => canSee(item.permission, item.globalAdminOnly));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} style={{ marginTop: 12 }}>
                {!collapsed && (
                  <div style={{
                    padding: '4px 16px', fontSize: 10, fontWeight: 700,
                    color: COLORS.sidebarGroupLabel, letterSpacing: '0.1em',
                    textTransform: 'uppercase', marginBottom: 2,
                  }}>{group.label}</div>
                )}
                {collapsed && <div style={{ height: 8 }} />}
                {visibleItems.map(item => renderNavItem(item))}
              </div>
            );
          })}
        </div>

        {/* Collapse toggle */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 8px',
          display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end',
        }}>
          <div onClick={() => setCollapsed(!collapsed)} style={{
            cursor: 'pointer', width: 32, height: 32, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: COLORS.sidebarText, transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = COLORS.sidebarBgHover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {collapsed ? <MenuUnfoldOutlined style={{ fontSize: 16 }} /> : <MenuFoldOutlined style={{ fontSize: 16 }} />}
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── Top bar ── */}
        <div style={{
          height: COLORS.headerHeight,
          background: COLORS.topbarBg,
          borderBottom: `1px solid ${COLORS.topbarBorder}`,
          display: 'flex', alignItems: 'center',
          padding: '0 16px 0 20px', gap: 8,
          flexShrink: 0, zIndex: 50,
        }}>

          {/* Breadcrumb */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={`${crumb.path}-${i}`}>
                {i > 0 && <span style={{ color: '#C4C9D0', fontSize: 14 }}>/</span>}
                <span
                  onClick={() => navigate(crumb.path)}
                  style={{
                    fontSize: 13,
                    color: i === breadcrumbs.length - 1 ? '#1F2937' : '#6B7A8D',
                    fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    whiteSpace: 'nowrap', transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { if (i < breadcrumbs.length - 1) e.currentTarget.style.color = COLORS.accentBlue; }}
                  onMouseLeave={e => { if (i < breadcrumbs.length - 1) e.currentTarget.style.color = '#6B7A8D'; }}
                >
                  {crumb.icon && <span style={{ fontSize: 12 }}>{crumb.icon}</span>}
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* ── Right side controls ── */}
          <Space size={2} style={{ flexShrink: 0 }}>

            {/* Search */}
            <div style={{ position: 'relative', marginRight: 4 }}>
              {searchOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <Input
                    ref={searchRef}
                    value={searchVal}
                    onChange={e => setSearchVal(e.target.value)}
                    placeholder="Search modules…"
                    prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
                    suffix={
                      <CloseOutlined
                        style={{ color: '#9CA3AF', cursor: 'pointer', fontSize: 12 }}
                        onClick={() => { setSearchOpen(false); setSearchVal(''); }}
                      />
                    }
                    onKeyDown={e => {
                      if (e.key === 'Escape') { setSearchOpen(false); setSearchVal(''); }
                      if (e.key === 'Enter' && searchResults.length > 0) {
                        navigate(searchResults[0].key);
                        setSearchOpen(false); setSearchVal('');
                      }
                    }}
                    style={{ width: 220, borderRadius: 6, fontSize: 13 }}
                    size="small"
                  />
                  {searchDropdown}
                </div>
              ) : (
                <Tooltip title="Quick search (/)">
                  <div onClick={openSearch} style={iconBtnStyle}>
                    <SearchOutlined style={{ fontSize: 17 }} />
                  </div>
                </Tooltip>
              )}
            </div>

            {/* Clock */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '3px 10px', borderRadius: 6,
              background: '#F9FAFB', border: '1px solid #E5E7EB',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1.3,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ClockCircleOutlined style={{ fontSize: 9, color: '#9CA3AF' }} />
                <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>{clockDate}</span>
              </div>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 700, letterSpacing: '0.04em' }}>{clockTime}</span>
            </div>

            {/* Subscription expiry badge — always visible, hides only when active+healthy */}
            {sub && (
              <Tooltip title={subTooltip} placement="bottomRight">
                <div
                  onClick={() => user?.is_global_admin && navigate('/subscription')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 6,
                    background: subTheme.bg,
                    border: `1px solid ${subTheme.border}`,
                    fontSize: 11.5, color: subTheme.color, fontWeight: 600,
                    cursor: user?.is_global_admin ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <SafetyCertificateOutlined style={{ fontSize: 12 }} />
                  {subLabel
                    ? subLabel
                    : `License · ${formatExpiryDt(sub.expiry_date)}`}
                </div>
              </Tooltip>
            )}

            {/* Fullscreen */}
            <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              <div onClick={toggleFullscreen} style={iconBtnStyle}>
                {isFullscreen
                  ? <FullscreenExitOutlined style={{ fontSize: 17 }} />
                  : <FullscreenOutlined style={{ fontSize: 17 }} />}
              </div>
            </Tooltip>

            {/* System status */}
            <Tooltip title="All systems operational">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20,
                background: '#F0FDF4', border: '1px solid #86EFAC',
                fontSize: 11, color: '#166534', fontWeight: 600,
                cursor: 'default',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', animation: 'statusPulse 2s infinite' }} />
                Online
              </div>
            </Tooltip>

            {/* Notifications */}
            <Popover
              open={notifOpen}
              onOpenChange={setNotifOpen}
              content={notifPanel}
              trigger="click"
              placement="bottomRight"
              arrow={false}
              styles={{ body: { padding: 0 } }}
              overlayStyle={{ width: 360 }}
            >
              <Tooltip title="Notifications" open={notifOpen ? false : undefined}>
                <Badge count={unreadCount} size="small" offset={[-3, 3]}
                  style={{ background: '#EF4444' }}>
                  <div style={{
                    ...iconBtnStyle,
                    background: notifOpen ? '#EFF6FF' : 'transparent',
                    color: notifOpen ? COLORS.accentBlue : '#6B7A8D',
                  }}>
                    <BellOutlined style={{ fontSize: 17 }} />
                  </div>
                </Badge>
              </Tooltip>
            </Popover>

            {/* App launcher */}
            <Popover
              open={appsOpen}
              onOpenChange={setAppsOpen}
              content={appsPanel}
              trigger="click"
              placement="bottomRight"
              arrow={false}
              styles={{ body: { padding: 0 } }}
              overlayStyle={{ width: 340 }}
            >
              <Tooltip title="All modules" open={appsOpen ? false : undefined}>
                <div style={{
                  ...iconBtnStyle,
                  background: appsOpen ? '#EFF6FF' : 'transparent',
                  color: appsOpen ? COLORS.accentBlue : '#6B7A8D',
                }}>
                  <AppstoreOutlined style={{ fontSize: 17 }} />
                </div>
              </Tooltip>
            </Popover>

            {/* Divider */}
            <div style={{ width: 1, height: 22, background: '#E5E7EB', margin: '0 4px' }} />

            {/* User popover */}
            <Popover
              open={userPopOpen}
              onOpenChange={setUserPopOpen}
              content={userPopPanel}
              trigger="click"
              placement="bottomRight"
              arrow={false}
              styles={{ body: { padding: 0, borderRadius: 10, overflow: 'hidden' } }}
              overlayStyle={{ width: 288 }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 8, cursor: 'pointer',
                transition: 'all 0.15s',
                background: userPopOpen ? '#EFF6FF' : 'transparent',
                border: userPopOpen ? '1px solid #BAE0FF' : '1px solid transparent',
              }}
                onMouseEnter={e => {
                  if (!userPopOpen) { e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.borderColor='#E1E4E8'; }
                }}
                onMouseLeave={e => {
                  if (!userPopOpen) { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent'; }
                }}
              >
                {/* Avatar with online ring */}
                <div style={{ position:'relative', flexShrink:0 }}>
                  <div style={{
                    width:32, height:32, borderRadius:8,
                    background:'linear-gradient(135deg, #0078D4 0%, #005A9E 100%)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:13, fontWeight:700, color:'white',
                  }}>
                    {initials}
                  </div>
                  <div style={{
                    position:'absolute', bottom:0, right:0,
                    width:9, height:9, borderRadius:'50%',
                    background:'#22C55E', border:'1.5px solid white',
                  }} />
                </div>

                <div style={{ display:'flex', flexDirection:'column', lineHeight:1, minWidth:0 }}>
                  <span style={{ fontSize:12.5, fontWeight:600, color: userPopOpen ? COLORS.accentBlue : '#1F2937', whiteSpace:'nowrap' }}>
                    {user?.first_name || user?.username || 'Admin'}
                  </span>
                  <span style={{ fontSize:10.5, color:'#6B7A8D', marginTop:2, whiteSpace:'nowrap' }}>
                    {user?.is_superuser ? 'Super Admin' : 'User'}
                  </span>
                </div>
                <DownOutlined style={{
                  fontSize:10, color: userPopOpen ? COLORS.accentBlue : '#9CA3AF',
                  transform: userPopOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition:'transform 0.2s',
                }} />
              </div>
            </Popover>
          </Space>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto', background: COLORS.contentBg, padding: 0 }}>
          {children}
        </div>
      </div>

      {/* ── Profile modal ── */}
      <Modal
        open={profileOpen}
        onCancel={() => setProfileOpen(false)}
        footer={[
          <Button key="close" onClick={() => setProfileOpen(false)}>Close</Button>,
          <Button key="settings" type="primary" onClick={() => { setProfileOpen(false); navigate('/settings'); }}>
            Account Settings
          </Button>,
        ]}
        title={
          <Space>
            <IdcardOutlined style={{ color: COLORS.accentBlue }} />
            My Profile
          </Space>
        }
        width={420}
      >
        <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
          <Avatar size={72} style={{
            background: 'linear-gradient(135deg, #0078D4, #005A9E)',
            fontSize: 28, fontWeight: 700, marginBottom: 12,
          }}>
            {(user?.first_name?.[0] || user?.username?.[0] || 'A').toUpperCase()}
          </Avatar>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1F2937' }}>
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}
          </div>
          <div style={{ fontSize: 13, color: '#6B7A8D', marginTop: 4 }}>
            {user?.is_superuser
              ? <Tag color="blue" style={{ borderRadius: 10 }}>Super Administrator</Tag>
              : <Tag style={{ borderRadius: 10 }}>User</Tag>}
          </div>
        </div>
        <Divider style={{ margin: '12px 0' }} />
        <Descriptions column={1} size="small" styles={{ label: { color: '#6B7A8D', fontWeight: 500 } }}>
          <Descriptions.Item label="Username">{user?.username || '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{user?.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="User ID">#{user?.id || '—'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            {user?.is_active !== false
              ? <span style={{ color: '#22C55E', fontWeight: 600 }}>● Active</span>
              : <span style={{ color: '#EF4444', fontWeight: 600 }}>● Inactive</span>}
          </Descriptions.Item>
        </Descriptions>
      </Modal>

      <style>{`
        .pob-sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .pob-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .pob-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        .pob-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .pob-notif-scroll::-webkit-scrollbar { width: 4px; }
        .pob-notif-scroll::-webkit-scrollbar-track { background: transparent; }
        .pob-notif-scroll::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 2px; }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

/* shared icon button style (defined outside component to avoid re-creating per render) */
const iconBtnStyle = {
  width: 34, height: 34, borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#6B7A8D', transition: 'all 0.15s',
};

export default Layout;
