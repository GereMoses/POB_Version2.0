import React, { useState, useCallback, useRef } from 'react';
import {
  Button, Input, Tag, Tooltip, Popconfirm, Checkbox, Badge,
  Typography, Empty, Skeleton, Select, Dropdown, message, Spin,
} from 'antd';
import {
  BellOutlined, CheckOutlined, DeleteOutlined, ReloadOutlined,
  SearchOutlined, FilterOutlined, SoundOutlined, CloseOutlined,
  InfoCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  AlertOutlined, ArrowRightOutlined, ClockCircleOutlined,
  WarningOutlined, SafetyCertificateOutlined, TeamOutlined,
  DesktopOutlined, FileTextOutlined, MedicineBoxOutlined,
  LockOutlined, SyncOutlined, DownOutlined, SelectOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import apiService from '../../services/api';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Search } = Input;

// ── type / priority config ────────────────────────────────────────────────────

const TYPE_CFG = {
  error:     { label: 'Error',     color: '#EF4444', bg: '#FFF1F0', border: '#FECACA', icon: <ExclamationCircleOutlined /> },
  warning:   { label: 'Warning',   color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: <WarningOutlined /> },
  info:      { label: 'Info',      color: '#0078D4', bg: '#EFF6FF', border: '#BFDBFE', icon: <InfoCircleOutlined /> },
  success:   { label: 'Success',   color: '#10B981', bg: '#F0FDF4', border: '#A7F3D0', icon: <CheckCircleOutlined /> },
  emergency: { label: 'Emergency', color: '#DC2626', bg: '#FFF1F0', border: '#FECACA', icon: <AlertOutlined /> },
};

const PRIORITY_CFG = {
  critical: { color: 'red',    weight: 4 },
  high:     { color: 'orange', weight: 3 },
  medium:   { color: 'blue',   weight: 2 },
  low:      { color: 'default',weight: 1 },
};

const LINK_ICON = {
  '/subscription':   <SafetyCertificateOutlined />,
  '/device':         <DesktopOutlined />,
  '/mtd':            <MedicineBoxOutlined />,
  '/attendance':     <ClockCircleOutlined />,
  '/pob-status':     <TeamOutlined />,
  '/access-control': <LockOutlined />,
  '/personnel':      <FileTextOutlined />,
};

// ── helpers ───────────────────────────────────────────────────────────────────

const groupByDate = (notifications) => {
  const groups = {};
  notifications.forEach(n => {
    const d = n.created_at ? dayjs(n.created_at).format('YYYY-MM-DD') : 'Unknown';
    const label = d === dayjs().format('YYYY-MM-DD')
      ? 'Today'
      : d === dayjs().subtract(1, 'day').format('YYYY-MM-DD')
        ? 'Yesterday'
        : dayjs(d).format('DD MMMM YYYY');
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  });
  return groups;
};

// ── stat card ─────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, color, bg, icon, loading }) => (
  <div style={{
    flex: 1, minWidth: 0, padding: '14px 20px', borderRadius: 10,
    background: bg, border: `1px solid ${color}22`,
    display: 'flex', alignItems: 'center', gap: 14,
  }}>
    <div style={{
      width: 42, height: 42, borderRadius: 10,
      background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: 20, flexShrink: 0,
    }}>{icon}</div>
    <div>
      {loading
        ? <Skeleton.Input active size="small" style={{ width: 40 }} />
        : <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>}
      <div style={{ fontSize: 12, color: '#6B7A8D', marginTop: 2 }}>{label}</div>
    </div>
  </div>
);

// ── notification card ─────────────────────────────────────────────────────────

const NotifCard = ({ notif, selected, onSelect, onMarkRead, onDelete, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const tc = TYPE_CFG[notif.notification_type] || TYPE_CFG.info;
  const pc = PRIORITY_CFG[notif.priority]      || PRIORITY_CFG.medium;
  const isUnread = !notif.is_read;

  return (
    <div style={{
      display: 'flex', gap: 0,
      background: isUnread ? '#FAFCFF' : '#fff',
      borderRadius: 8, marginBottom: 6,
      border: `1px solid ${isUnread ? '#DBEAFE' : '#F0F0F0'}`,
      overflow: 'hidden',
      transition: 'box-shadow 0.15s, border-color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Priority stripe */}
      <div style={{ width: 4, flexShrink: 0, background: tc.color, opacity: isUnread ? 1 : 0.35 }} />

      {/* Checkbox */}
      <div style={{ padding: '16px 0 16px 12px', display: 'flex', alignItems: 'flex-start' }}>
        <Checkbox checked={selected} onChange={() => onSelect(notif.id)} />
      </div>

      {/* Icon */}
      <div style={{ padding: '16px 12px 16px 10px', display: 'flex', alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: tc.bg, border: `1px solid ${tc.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: tc.color, fontSize: 16, flexShrink: 0,
        }}>{tc.icon}</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0, padding: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontWeight: isUnread ? 700 : 500, fontSize: 13.5, color: '#111827',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 380,
              }}>{notif.title}</span>
              <Tag color={pc.color} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }}>
                {(notif.priority || '').toUpperCase()}
              </Tag>
              {isUnread && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#0078D4', display: 'inline-block', flexShrink: 0,
                }} />
              )}
            </div>

            <div style={{
              fontSize: 12.5, color: '#4B5563', marginTop: 3, lineHeight: 1.5,
              overflow: expanded ? 'visible' : 'hidden',
              display: expanded ? 'block' : '-webkit-box',
              WebkitLineClamp: expanded ? 'none' : 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {notif.message}
            </div>
            {notif.message && notif.message.length > 120 && (
              <button
                onClick={() => setExpanded(e => !e)}
                style={{ background: 'none', border: 'none', padding: 0, color: '#0078D4', fontSize: 11, cursor: 'pointer', marginTop: 2 }}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          {/* Time */}
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <Tooltip title={notif.created_at ? dayjs(notif.created_at).format('YYYY-MM-DD HH:mm:ss') : ''}>
              <div style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                <ClockCircleOutlined style={{ marginRight: 3 }} />
                {notif.created_at ? dayjs(notif.created_at).fromNow() : '—'}
              </div>
            </Tooltip>
            {notif.is_read && notif.read_at && (
              <div style={{ fontSize: 10, color: '#D1D5DB', marginTop: 2 }}>
                Read {dayjs(notif.read_at).fromNow()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 12px', gap: 4, borderLeft: '1px solid #F3F4F6',
      }}>
        {notif.link && (
          <Tooltip title="Go to module">
            <Button type="text" size="small" icon={<ArrowRightOutlined />}
              style={{ color: '#0078D4' }}
              onClick={() => onNavigate(notif.link)} />
          </Tooltip>
        )}
        {isUnread && (
          <Tooltip title="Mark as read">
            <Button type="text" size="small" icon={<CheckOutlined />}
              style={{ color: '#10B981' }}
              onClick={() => onMarkRead(notif.id)} />
          </Tooltip>
        )}
        <Popconfirm title="Delete this notification?" onConfirm={() => onDelete(notif.id)}
          okText="Delete" okType="danger" placement="left">
          <Tooltip title="Delete">
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
};

// ── main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'unread',   label: 'Unread' },
  { key: 'critical', label: 'Critical' },
  { key: 'system',   label: 'System' },
];

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'error',     label: 'Error' },
  { value: 'warning',   label: 'Warning' },
  { value: 'info',      label: 'Info' },
  { value: 'success',   label: 'Success' },
  { value: 'emergency', label: 'Emergency' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'priority', label: 'By Priority' },
];

const NotificationsPage = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab,        setTab]        = useState('all');
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort,       setSort]       = useState('newest');
  const [selected,   setSelected]   = useState(new Set());
  const [lastRefresh, setLastRefresh] = useState(dayjs());
  const searchTimeout = useRef(null);

  // ── data fetching ──
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['notif-stats'],
    queryFn: () => apiService.get('/api/v1/notifications/stats'),
    refetchInterval: 30000,
  });
  const stats = statsData?.data ?? { total: 0, unread: 0, critical: 0, today: 0 };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['notifications-page', tab, typeFilter, search],
    queryFn: () => {
      const params = {};
      if (typeFilter) params.notification_type = typeFilter;
      if (tab === 'unread')   params.is_read = false;
      if (tab === 'critical') params.priority = 'critical';
      if (search) params.search = search;
      params.limit = 200;
      return apiService.get('/api/v1/notifications/', params);
    },
    refetchInterval: 30000,
    onSuccess: () => setLastRefresh(dayjs()),
  });

  const allNotifs = data?.data ?? [];

  // System tab = subscription + device + mtd
  const displayed = tab === 'system'
    ? allNotifs.filter(n => ['error', 'warning'].includes(n.notification_type)
        && ['/subscription', '/device', '/mtd'].includes(n.link))
    : allNotifs;

  // Client-side sort
  const sorted = [...displayed].sort((a, b) => {
    if (sort === 'oldest') return dayjs(a.created_at).diff(dayjs(b.created_at));
    if (sort === 'priority') {
      const pa = PRIORITY_CFG[a.priority]?.weight ?? 0;
      const pb = PRIORITY_CFG[b.priority]?.weight ?? 0;
      return pb - pa;
    }
    return dayjs(b.created_at).diff(dayjs(a.created_at));
  });

  const grouped = groupByDate(sorted);
  const unreadCount = allNotifs.filter(n => !n.is_read).length;
  const allIds = sorted.map(n => n.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));

  // ── mutations ──
  const markOne = useMutation({
    mutationFn: (id) => apiService.put(`/api/v1/notifications/${id}/read/`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-page'] }); qc.invalidateQueries({ queryKey: ['notif-stats'] }); },
  });

  const markAll = useMutation({
    mutationFn: () => apiService.put('/api/v1/notifications/mark-all-read/'),
    onSuccess: () => {
      message.success('All notifications marked as read');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-page'] });
      qc.invalidateQueries({ queryKey: ['notif-stats'] });
    },
  });

  const deleteOne = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/notifications/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notifications-page'] }); qc.invalidateQueries({ queryKey: ['notif-stats'] }); },
  });

  // Bulk delete selected
  const bulkDelete = async () => {
    await Promise.all([...selected].map(id => apiService.delete(`/api/v1/notifications/${id}`)));
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-page'] });
    qc.invalidateQueries({ queryKey: ['notif-stats'] });
    message.success(`${selected.size} notifications deleted`);
  };

  // Bulk mark read
  const bulkMarkRead = async () => {
    await Promise.all(
      [...selected]
        .filter(id => sorted.find(n => n.id === id && !n.is_read))
        .map(id => apiService.put(`/api/v1/notifications/${id}/read/`))
    );
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-page'] });
    qc.invalidateQueries({ queryKey: ['notif-stats'] });
    message.success('Selected notifications marked as read');
  };

  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  };

  const handleSearch = (val) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(val), 300);
  };

  const handleRefresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ['notif-stats'] });
    setLastRefresh(dayjs());
  };

  // ── render ──
  return (
    <div style={{ padding: 24 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BellOutlined style={{ fontSize: 20, color: '#0078D4' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>Notifications</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Last updated {lastRefresh.fromNow()}
              {isFetching && <SyncOutlined spin style={{ marginLeft: 6, color: '#0078D4' }} />}
            </Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isFetching} />
          </Tooltip>
          {unreadCount > 0 && (
            <Button type="primary" icon={<CheckOutlined />} loading={markAll.isPending}
              onClick={() => markAll.mutate()}>
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total"    value={stats.total}    color="#0078D4" bg="#EFF6FF" icon={<BellOutlined />}            loading={statsLoading} />
        <StatCard label="Unread"   value={stats.unread}   color="#7C3AED" bg="#F5F3FF" icon={<SoundOutlined />}           loading={statsLoading} />
        <StatCard label="Critical" value={stats.critical} color="#DC2626" bg="#FEF2F2" icon={<AlertOutlined />}           loading={statsLoading} />
        <StatCard label="Today"    value={stats.today}    color="#059669" bg="#ECFDF5" icon={<ClockCircleOutlined />}     loading={statsLoading} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #F0F0F0', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected(new Set()); }}
            style={{
              padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#0078D4' : '#6B7A8D',
              borderBottom: tab === t.key ? '2px solid #0078D4' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
            {t.key === 'unread' && stats.unread > 0 && (
              <Badge count={stats.unread} size="small" style={{ marginLeft: 6, background: '#0078D4' }} />
            )}
            {t.key === 'critical' && stats.critical > 0 && (
              <Badge count={stats.critical} size="small" style={{ marginLeft: 6, background: '#DC2626' }} />
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Search
          placeholder="Search notifications..."
          prefix={<SearchOutlined />}
          allowClear
          onChange={e => handleSearch(e.target.value)}
          style={{ width: 240 }}
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          options={TYPE_FILTER_OPTIONS}
          style={{ width: 140 }}
          placeholder="Filter by type"
          suffixIcon={<FilterOutlined />}
        />
        <Select
          value={sort}
          onChange={setSort}
          options={SORT_OPTIONS}
          style={{ width: 160 }}
        />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {selected.size > 0 ? (
            <>
              <Text type="secondary" style={{ fontSize: 12 }}>{selected.size} selected</Text>
              <Button size="small" icon={<CheckOutlined />} onClick={bulkMarkRead}
                style={{ color: '#10B981' }}>Mark Read</Button>
              <Popconfirm title={`Delete ${selected.size} notifications?`}
                onConfirm={bulkDelete} okText="Delete" okType="danger">
                <Button size="small" icon={<DeleteOutlined />} danger>Delete</Button>
              </Popconfirm>
              <Button size="small" icon={<CloseOutlined />}
                onClick={() => setSelected(new Set())}>Clear</Button>
            </>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {sorted.length} notification{sorted.length !== 1 ? 's' : ''}
            </Text>
          )}
        </div>
      </div>

      {/* Select all bar */}
      {sorted.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', background: '#F9FAFB', borderRadius: 6,
          marginBottom: 10, border: '1px solid #E5E7EB',
        }}>
          <Checkbox checked={allSelected} indeterminate={selected.size > 0 && !allSelected}
            onChange={toggleAll} />
          <Text style={{ fontSize: 12, color: '#6B7A8D' }}>
            {allSelected ? `All ${sorted.length} selected` : 'Select all'}
          </Text>
        </div>
      )}

      {/* Notification list */}
      {isLoading ? (
        <div style={{ padding: '40px 0' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ marginBottom: 8 }}>
              <Skeleton active avatar paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          background: '#FAFAFA', borderRadius: 12, border: '1px dashed #E5E7EB',
        }}>
          <BellOutlined style={{ fontSize: 40, color: '#D1D5DB', marginBottom: 12 }} />
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>No notifications found</div>
          {(search || typeFilter || tab !== 'all') && (
            <Button type="link" onClick={() => { setSearch(''); setTypeFilter(''); setTab('all'); }}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        Object.entries(grouped).map(([dateLabel, notifs]) => (
          <div key={dateLabel}>
            {/* Date group header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              margin: '16px 0 8px', fontSize: 11, fontWeight: 700,
              color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
              {dateLabel}
              <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
            </div>

            {notifs.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                selected={selected.has(n.id)}
                onSelect={toggleSelect}
                onMarkRead={(id) => markOne.mutate(id)}
                onDelete={(id) => deleteOne.mutate(id)}
                onNavigate={(link) => navigate(link)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
};

export default NotificationsPage;
