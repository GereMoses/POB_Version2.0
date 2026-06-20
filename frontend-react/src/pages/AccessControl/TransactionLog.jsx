import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, DatePicker, Tag, Switch,
  Row, Col, Avatar, Tooltip, App,
} from 'antd';
import {
  ReloadOutlined, FilterOutlined, WifiOutlined, DownloadOutlined,
  ThunderboltOutlined, CloseCircleOutlined, SearchOutlined,
  ArrowUpOutlined, ArrowDownOutlined, WarningOutlined,
  CheckCircleOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

const EVENT_TYPE = {
  0: { label: 'Normal Access',   bg: '#f6ffed', text: '#52c41a',  icon: <CheckCircleOutlined /> },
  1: { label: 'Door Open',       bg: '#e6f7ff', text: '#1677ff',  icon: <UnlockOutlined /> },
  2: { label: 'Door Alarm',      bg: '#fff1f0', text: '#f5222d',  icon: <WarningOutlined /> },
  3: { label: 'Anti-Passback',   bg: '#fffbe6', text: '#d4a017',  icon: <CloseCircleOutlined /> },
  4: { label: 'Duress',          bg: '#fff1f0', text: '#f5222d',  icon: <WarningOutlined /> },
  5: { label: 'Fire Unlock',     bg: '#fff7e6', text: '#fa8c16',  icon: <UnlockOutlined /> },
  6: { label: 'Emergency Lock',  bg: '#fff1f0', text: '#cf1322',  icon: <LockOutlined /> },
  7: { label: 'Mustering Check', bg: '#f9f0ff', text: '#722ed1',  icon: <CheckCircleOutlined /> },
};
const ALARM_TYPES = new Set([2, 3, 4, 6]);

const VERIFY = { 0: 'Password', 1: 'Fingerprint', 2: 'Face', 3: 'Card' };

const C = {
  darkHeader: 'linear-gradient(135deg, #1a0a00 0%, #3d1a00 50%, #612500 100%)',
  border: '#f0f0f0',
};

const QUICK_RANGES = [
  { label: 'Last hour',  hours: 1  },
  { label: 'Today',      hours: 24 },
  { label: 'Last 7 d',  hours: 168 },
];

/* ── Hourly heatmap ─────────────────────────────────────────────────── */
const HourlyHeatmap = ({ rows }) => {
  const counts = useMemo(() => {
    const arr = new Array(24).fill(0);
    rows.forEach(r => {
      if (r.event_time) arr[new Date(r.event_time).getHours()]++;
    });
    return arr;
  }, [rows]);

  const peak = Math.max(...counts, 1);

  return (
    <div style={{ padding: '12px 0 4px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#8c8c8c', marginBottom: 6, letterSpacing: '0.5px' }}>
        HOURLY ACTIVITY — {rows.length} events
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 44 }}>
        {counts.map((cnt, h) => {
          const ratio = cnt / peak;
          const barH  = Math.max(cnt > 0 ? 6 : 2, Math.round(ratio * 40));
          return (
            <Tooltip key={h} title={`${String(h).padStart(2,'0')}:00 — ${cnt} event${cnt !== 1 ? 's' : ''}`}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}>
                <div style={{
                  width: '100%', height: barH, borderRadius: '3px 3px 0 0',
                  background: cnt === 0
                    ? '#f0f0f0'
                    : `rgba(250,140,22,${0.15 + ratio * 0.85})`,
                  transition: 'height 0.2s',
                }} />
                {h % 4 === 0 && (
                  <div style={{ fontSize: 9, color: '#bfbfbf', marginTop: 2 }}>{h}</div>
                )}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

/* ── CSV export ─────────────────────────────────────────────────────── */
const exportCSV = (rows) => {
  const headers = ['Time', 'Event Type', 'Employee Name', 'Emp Code', 'Door', 'Terminal', 'Direction', 'Verify Method', 'Description'];
  const data = rows.map(r => [
    r.event_time ? new Date(r.event_time).toLocaleString() : '',
    EVENT_TYPE[r.event_type]?.label || String(r.event_type),
    r.emp_name  || '',
    r.emp_code  || '',
    r.door_name || '',
    r.terminal_sn || '',
    r.in_out === 0 ? 'IN' : r.in_out === 1 ? 'OUT' : '',
    VERIFY[r.verify_type] || '',
    r.description || '',
  ]);
  const csv = [headers, ...data]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `access_events_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

/* ── Main component ─────────────────────────────────────────────────── */
const TransactionLog = () => {
  const { message } = App.useApp();
  const [liveEvents, setLiveEvents] = useState([]);
  const [wsStatus,   setWsStatus]   = useState('disconnected');
  const [liveMode,   setLiveMode]   = useState(false);

  // Filter state (draft)
  const [range,       setRange]       = useState(null);
  const [doorFilter,  setDoorFilter]  = useState(null);
  const [typeFilter,  setTypeFilter]  = useState(null);
  const [empSearch,   setEmpSearch]   = useState('');
  // Applied (triggers query)
  const [applied, setApplied] = useState({});

  const wsRef = useRef(null);

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn:  () => apiService.get('/api/access-control/doors/'),
  });
  const doors = doorsData?.data || [];

  // Build query string from applied filters
  const qParams = useMemo(() => {
    const p = new URLSearchParams();
    if (applied.range?.[0]) p.append('start_time',  applied.range[0]);
    if (applied.range?.[1]) p.append('end_time',    applied.range[1]);
    if (applied.door)        p.append('door_id',    applied.door);
    if (applied.type != null) p.append('event_type', applied.type);
    if (applied.emp)         p.append('emp_code',   applied.emp);
    p.append('limit', 500);
    return p;
  }, [applied]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['acc-events', qParams.toString()],
    queryFn:  () => apiService.get(`/api/access-control/events/?${qParams}`),
    enabled:  !liveMode,
  });
  const histEvents = data?.data || [];

  // WebSocket for live mode
  useEffect(() => {
    if (!liveMode) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }
    const token = localStorage.getItem('token') || '';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws    = new WebSocket(`${proto}//${window.location.host}/api/access-control/events/ws?token=${token}`);
    wsRef.current = ws;
    ws.onopen    = () => setWsStatus('connected');
    ws.onclose   = () => setWsStatus('disconnected');
    ws.onerror   = () => setWsStatus('error');
    ws.onmessage = e => {
      try {
        const items = JSON.parse(e.data);
        if (Array.isArray(items) && items.length)
          setLiveEvents(prev => [...items, ...prev].slice(0, 500));
      } catch {}
    };
    return () => { ws.close(); wsRef.current = null; };
  }, [liveMode]);

  const applyFilters = useCallback(() => {
    setApplied({
      range: range ? [range[0].toISOString(), range[1].toISOString()] : null,
      door: doorFilter, type: typeFilter, emp: empSearch,
    });
  }, [range, doorFilter, typeFilter, empSearch]);

  const clearFilters = () => {
    setRange(null); setDoorFilter(null); setTypeFilter(null); setEmpSearch('');
    setApplied({});
  };

  const applyQuickRange = (hours) => {
    const end   = new Date();
    const start = new Date(end.getTime() - hours * 3600 * 1000);
    setApplied(prev => ({ ...prev, range: [start.toISOString(), end.toISOString()] }));
    setRange(null);
  };

  const displayRows = liveMode ? liveEvents : histEvents;

  // Always-on today query — stats strip is independent of user filters
  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, []);
  const { data: todayData } = useQuery({
    queryKey: ['acc-events-today', todayStart],
    queryFn:  () => apiService.get(`/api/access-control/events/?start_time=${todayStart}&limit=2000`),
    refetchInterval: 60000,
  });
  const todayRows = todayData?.data || [];

  // Stats — always today, never affected by filter state
  const stats = useMemo(() => {
    const inC   = todayRows.filter(r => r.in_out === 0).length;
    const outC  = todayRows.filter(r => r.in_out === 1).length;
    const alarm = todayRows.filter(r => ALARM_TYPES.has(r.event_type)).length;
    const uniqP = new Set(todayRows.map(r => r.emp_code).filter(Boolean)).size;
    const uniqD = new Set(todayRows.map(r => r.door_name).filter(Boolean)).size;
    return { total: todayRows.length, in: inC, out: outC, alarm, persons: uniqP, doors: uniqD };
  }, [todayRows]);

  const wsColor = wsStatus === 'connected' ? '#52c41a' : wsStatus === 'error' ? '#f5222d' : '#8c8c8c';
  const hasFilters = !!(applied.range || applied.door || applied.type != null || applied.emp);

  // ── Columns ──────────────────────────────────────────────────────────
  const cols = [
    {
      title: 'Time', dataIndex: 'event_time', key: 'time', width: 155, fixed: 'left',
      sorter: (a, b) => new Date(b.event_time) - new Date(a.event_time),
      render: v => v
        ? <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#595959' }}>{new Date(v).toLocaleString()}</span>
        : '—',
    },
    {
      title: 'Event', dataIndex: 'event_type', key: 'type', width: 160,
      filters: Object.entries(EVENT_TYPE).map(([v, t]) => ({ text: t.label, value: +v })),
      onFilter: (val, row) => row.event_type === val,
      render: v => {
        const t = EVENT_TYPE[v] || { label: 'Unknown', bg: '#f5f5f5', text: '#8c8c8c', icon: null };
        return (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: t.bg, borderRadius: 6, padding: '3px 10px',
            color: t.text, fontWeight: 600, fontSize: 11,
          }}>
            {t.icon}
            {t.label}
          </div>
        );
      },
    },
    {
      title: 'Employee', key: 'emp', width: 200,
      render: (_, r) => (
        <Space size={8}>
          <Avatar size={30} style={{ background: '#1677ff', fontSize: 11, flexShrink: 0 }}>
            {(r.emp_name || r.emp_code || '?')[0].toUpperCase()}
          </Avatar>
          {r.emp_name
            ? <div>
                <div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.3 }}>{r.emp_name}</div>
                <div style={{ fontSize: 10, color: '#8c8c8c', fontFamily: 'monospace' }}>{r.emp_code}</div>
              </div>
            : <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#8c8c8c' }}>{r.emp_code || '—'}</span>}
        </Space>
      ),
    },
    {
      title: 'Door', dataIndex: 'door_name', width: 150,
      render: v => <span style={{ fontSize: 12, fontWeight: 500 }}>{v || '—'}</span>,
    },
    {
      title: 'Terminal', dataIndex: 'terminal_sn', width: 120,
      render: v => <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#8c8c8c' }}>{v || '—'}</span>,
    },
    {
      title: 'Dir', dataIndex: 'in_out', width: 65, align: 'center',
      render: v => v === 0
        ? <Tag icon={<ArrowDownOutlined />} color="blue"   style={{ borderRadius: 10, fontSize: 11, margin: 0 }}>IN</Tag>
        : v === 1
        ? <Tag icon={<ArrowUpOutlined />}  color="orange" style={{ borderRadius: 10, fontSize: 11, margin: 0 }}>OUT</Tag>
        : <span style={{ color: '#d9d9d9' }}>—</span>,
    },
    {
      title: 'Verify', dataIndex: 'verify_type', width: 100,
      render: v => <Tag style={{ fontSize: 10, borderRadius: 4 }}>{VERIFY[v] || '—'}</Tag>,
    },
    {
      title: 'Description', dataIndex: 'description', ellipsis: true,
      render: v => <span style={{ fontSize: 11, color: '#8c8c8c' }}>{v || '—'}</span>,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>

      {/* Header */}
      <div style={{
        background: C.darkHeader,
        padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <Space size={14}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #fa8c16, #d46b08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(250,140,22,0.4)',
          }}>
            <ThunderboltOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Transaction Log</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
              Access event history {liveMode ? '— live feed' : `— ${stats.total} records`}
            </div>
          </div>
        </Space>
        <Space size={8}>
          {/* WebSocket status pill */}
          {liveMode && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '5px 12px',
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', background: wsColor,
                boxShadow: wsStatus === 'connected' ? `0 0 6px ${wsColor}` : 'none',
              }} />
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                {wsStatus === 'connected' ? 'Live' : wsStatus}
              </span>
            </div>
          )}
          {/* Quick range filters */}
          {!liveMode && QUICK_RANGES.map(q => (
            <Button key={q.label} size="small" onClick={() => applyQuickRange(q.hours)}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)', borderRadius: 6, fontSize: 11 }}>
              {q.label}
            </Button>
          ))}
          {/* Export */}
          {!liveMode && (
            <Button icon={<DownloadOutlined />} size="small"
              onClick={() => { if (displayRows.length) exportCSV(displayRows); else message.info('No data to export'); }}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 6 }}>
              Export CSV
            </Button>
          )}
          {/* Live toggle */}
          <Switch
            checkedChildren={<Space size={4}><WifiOutlined />Live</Space>}
            unCheckedChildren="History"
            checked={liveMode}
            onChange={v => { setLiveMode(v); if (!v) setLiveEvents([]); }}
            style={{ background: liveMode ? '#52c41a' : undefined }}
          />
          {!liveMode && (
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 6 }} />
          )}
        </Space>
      </div>

      {/* Stats strip — always today's data */}
      <div style={{
        background: 'white', borderBottom: `1px solid ${C.border}`,
        padding: '10px 24px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 0,
      }}>
        <div style={{ marginRight: 20, paddingRight: 20, borderRight: '1px solid #f0f0f0', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#bfbfbf', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Today</div>
        </div>
        {[
          { label: 'Total',   value: stats.total,   color: '#fa8c16', border: '#ffd591' },
          { label: 'Entry',   value: stats.in,       color: '#1677ff', border: '#91caff' },
          { label: 'Exit',    value: stats.out,      color: '#52c41a', border: '#b7eb8f' },
          { label: 'Alarms',  value: stats.alarm,    color: '#f5222d', border: '#ffa39e' },
          { label: 'Persons', value: stats.persons,  color: '#722ed1', border: '#d3adf7' },
          { label: 'Doors',   value: stats.doors,    color: '#0958d9', border: '#91caff' },
        ].map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <div style={{ width: 1, height: 36, background: '#f0f0f0', margin: '0 20px' }} />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 2, fontWeight: 500 }}>{s.label}</div>
            </div>
          </React.Fragment>
        ))}

        {/* Heatmap fills remaining space */}
        <div style={{ flex: 1, paddingLeft: 28 }}>
          <HourlyHeatmap rows={displayRows} />
        </div>
      </div>

      {/* Filter bar (history only) */}
      {!liveMode && (
        <div style={{
          background: 'white', borderBottom: `1px solid ${C.border}`,
          padding: '10px 24px', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <RangePicker
            showTime size="small" style={{ borderRadius: 6 }}
            value={range}
            onChange={v => setRange(v)}
          />
          <Select
            allowClear placeholder="All doors" size="small" style={{ minWidth: 140 }}
            value={doorFilter} onChange={setDoorFilter}
            showSearch optionFilterProp="label"
          >
            {doors.map(d => <Option key={d.id} value={d.id} label={d.door_name}>{d.door_name}</Option>)}
          </Select>
          <Select
            allowClear placeholder="Event type" size="small" style={{ minWidth: 140 }}
            value={typeFilter} onChange={setTypeFilter}
          >
            {Object.entries(EVENT_TYPE).map(([v, t]) => <Option key={v} value={+v}>{t.label}</Option>)}
          </Select>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 11 }} />}
            placeholder="Employee code" value={empSearch} size="small" style={{ width: 140, borderRadius: 6 }}
            onChange={e => setEmpSearch(e.target.value)}
            onPressEnter={applyFilters}
            allowClear
          />
          <Button type="primary" size="small" icon={<FilterOutlined />} onClick={applyFilters} style={{ borderRadius: 6 }}>
            Apply
          </Button>
          {hasFilters && (
            <Button size="small" icon={<CloseCircleOutlined />} onClick={clearFilters} style={{ borderRadius: 6 }}>
              Clear
            </Button>
          )}
          {hasFilters && (
            <span style={{ fontSize: 11, color: '#fa8c16', fontWeight: 600 }}>
              Filtered
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '12px 16px' }}>
        <div style={{ height: '100%', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Table
            columns={cols}
            dataSource={displayRows}
            rowKey={(r, i) => r.id ?? i}
            loading={isLoading && !liveMode}
            size="small"
            scroll={{ x: 1050, y: 'calc(100vh - 340px)' }}
            pagination={liveMode
              ? false
              : { pageSize: 50, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
            rowClassName={r => ALARM_TYPES.has(r.event_type) ? 'ac-row-alarm' : ''}
            style={{ borderRadius: 12, overflow: 'hidden' }}
          />
        </div>
      </div>

      <style>{`
        .ac-row-alarm td { background: #fff8f7 !important; }
        .ac-row-alarm:hover td { background: #ffe8e6 !important; }
        .ac-row-alarm td:first-child { border-left: 3px solid #f5222d; }
      `}</style>
    </div>
  );
};

export default TransactionLog;
