import React, { useState, useMemo } from 'react';
import {
  Table, Card, Row, Col, Statistic, Space, Tag, Tooltip, Badge,
  Button, Input, Select, DatePicker, Segmented, Drawer, Descriptions,
  Alert, Typography, Progress, App, Divider,
} from 'antd';
import {
  UserOutlined, TeamOutlined, ReloadOutlined, DownloadOutlined,
  EyeOutlined, WarningOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, SafetyCertificateOutlined, LoginOutlined,
  LogoutOutlined, EnvironmentOutlined, FilterOutlined, IdcardOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiService from '../../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { pState, vLabel, resolvedPunchState, EmployeeCell, tableContainerStyle } from './shared';

dayjs.extend(relativeTime);

const { RangePicker } = DatePicker;
const { Text } = Typography;

const DATE_PRESETS = [
  { label: 'Today',        value: [dayjs(), dayjs()] },
  { label: 'Yesterday',    value: [dayjs().subtract(1,'day'), dayjs().subtract(1,'day')] },
  { label: 'This Week',    value: [dayjs().startOf('week'), dayjs().endOf('week')] },
  { label: 'Last Week',    value: [dayjs().subtract(1,'week').startOf('week'), dayjs().subtract(1,'week').endOf('week')] },
  { label: 'This Month',   value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  { label: 'Last Month',   value: [dayjs().subtract(1,'month').startOf('month'), dayjs().subtract(1,'month').endOf('month')] },
  { label: 'Last 30 Days', value: [dayjs().subtract(30,'day'), dayjs()] },
];

const clearanceBadge = (status, label) => {
  const cfg = {
    CLEARED:      { color: 'success',  icon: <CheckCircleOutlined /> },
    FAILED:       { color: 'error',    icon: <CloseCircleOutlined /> },
    PENDING:      { color: 'warning',  icon: <ClockCircleOutlined /> },
    NOT_REQUIRED: { color: 'default',  icon: null },
    EXPIRED:      { color: 'error',    icon: <WarningOutlined /> },
  };
  const c = cfg[status] ?? { color: 'default', icon: null };
  return (
    <Tag color={c.color} icon={c.icon} style={{ fontSize: 10 }}>
      {label}: {status ?? '—'}
    </Tag>
  );
};

const permitStatus = (expiry) => {
  if (!expiry) return { color: 'default', label: 'No Permit', days: null };
  const days = dayjs(expiry).diff(dayjs(), 'day');
  if (days < 0)   return { color: 'error',   label: `Expired ${Math.abs(days)}d ago`, days };
  if (days <= 7)  return { color: 'error',   label: `Expires in ${days}d`,            days };
  if (days <= 30) return { color: 'warning', label: `Expires in ${days}d`,            days };
  return                 { color: 'success', label: `Valid (${days}d left)`,           days };
};

const buildCSV = (rows, mode) => {
  const txnHeaders = ['Emp Code','Contractor','Vendor','Job Title','Specialization','Punch Time','Type','Verify','Terminal','Area','Availability','Medical','Background','Permit Expiry'];
  const sumHeaders = ['Emp Code','Contractor','Vendor','Job Title','Specialization','Date','First In','Last Out','Hours','Punches','Availability','Medical','Background','Permit Expiry'];
  const headers = mode === 'summary' ? sumHeaders : txnHeaders;

  const lines = rows.map(r => {
    if (mode === 'summary') return [
      r.emp_code, r.contractor_name, r.vendor_name || '', r.job_title || '', r.specialization || '',
      r.work_date ? dayjs(r.work_date).format('YYYY-MM-DD') : '',
      r.first_in  ? dayjs(r.first_in).format('HH:mm:ss')   : '',
      r.last_out  ? dayjs(r.last_out).format('HH:mm:ss')   : '',
      r.hours_worked ?? '',
      r.punch_count ?? '',
      r.availability_status || '',
      r.medical_clearance_status || '', r.background_check_status || '',
      r.work_permit_expiry ? dayjs(r.work_permit_expiry).format('YYYY-MM-DD') : '',
    ];
    return [
      r.emp_code, r.contractor_name, r.vendor_name || '', r.job_title || '', r.specialization || '',
      r.punch_time ? dayjs(r.punch_time).format('YYYY-MM-DD HH:mm:ss') : '',
      pState(r.punch_state).label, vLabel(r.verify_type).label,
      r.terminal_sn || '', r.area_alias || '',
      r.availability_status || '',
      r.medical_clearance_status || '', r.background_check_status || '',
      r.work_permit_expiry ? dayjs(r.work_permit_expiry).format('YYYY-MM-DD') : '',
    ];
  });

  const csv = [headers, ...lines].map(row =>
    row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `contractor_attendance_${mode}_${dayjs().format('YYYYMMDD_HHmm')}.csv`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
};

const PAGE_SIZE = 100;

const isToday = (range) =>
  range?.[0]?.isSame(dayjs(), 'day') && range?.[1]?.isSame(dayjs(), 'day');

// ── Main Component ────────────────────────────────────────────────────────────
const ContractorAttendanceTab = () => {
  const { message } = App.useApp();
  const navigate    = useNavigate();

  const [mode,        setMode]       = useState('transactions');
  const [search,      setSearch]     = useState('');
  const [vendorId,    setVendorId]   = useState(null);
  const [punchFilter, setPunchFilter]= useState(null);
  const [clearFilter, setClearFilter]= useState(null);
  const [dateRange,   setDateRange]  = useState([dayjs().startOf('week'), dayjs().endOf('week')]);
  const [page,        setPage]       = useState(1);
  const [detail,      setDetail]     = useState(null);
  const [exporting,   setExporting]  = useState(false);

  const startDate = dateRange?.[0]?.format('YYYY-MM-DD') ?? '';
  const endDate   = dateRange?.[1]?.format('YYYY-MM-DD') ?? '';

  // Count active filters for the indicator badge
  const activeFilterCount = [search, vendorId, punchFilter, clearFilter].filter(v => v != null && v !== '').length;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['contractor-att-stats', startDate, endDate],
    queryFn: () => apiService.get(
      `/api/v1/attendance/contractor-stats?start_date=${startDate}&end_date=${endDate}`
    ),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const stats = statsData?.data ?? {};

  // ── Vendors list for filter ───────────────────────────────────────────────
  const { data: vendorsData } = useQuery({
    queryKey: ['contractor-vendors'],
    queryFn: () => apiService.get('/api/v1/personnel/vendor-contractor/vendors?limit=200'),
    staleTime: 120000,
  });
  const vendors = vendorsData?.data ?? [];

  // ── Transaction records ───────────────────────────────────────────────────
  const txnParams = useMemo(() => ({
    search:      search || undefined,
    vendor_id:   vendorId || undefined,
    punch_state: punchFilter ?? undefined,
    clearance:   clearFilter || undefined,
    start_date:  startDate,
    end_date:    endDate,
    page,
    page_size:   PAGE_SIZE,
  }), [search, vendorId, punchFilter, clearFilter, startDate, endDate, page]);

  const { data: txnData, isLoading: txnLoading, refetch: refetchTxn } = useQuery({
    queryKey: ['contractor-transactions', txnParams],
    queryFn: () => {
      const p = new URLSearchParams();
      Object.entries(txnParams).forEach(([k, v]) => { if (v !== undefined) p.append(k, v); });
      return apiService.get(`/api/v1/attendance/contractor-transactions?${p}`);
    },
    enabled: mode === 'transactions',
    staleTime: 15000,
  });
  const txnRows  = txnData?.data  ?? [];
  const txnTotal = txnData?.total ?? 0;

  // ── Summary records ───────────────────────────────────────────────────────
  const sumParams = useMemo(() => ({
    search:     search || undefined,
    vendor_id:  vendorId || undefined,
    clearance:  clearFilter || undefined,
    start_date: startDate,
    end_date:   endDate,
    page,
    page_size:  PAGE_SIZE,
  }), [search, vendorId, clearFilter, startDate, endDate, page]);

  const { data: sumData, isLoading: sumLoading, refetch: refetchSum } = useQuery({
    queryKey: ['contractor-summary', sumParams],
    queryFn: () => {
      const p = new URLSearchParams();
      Object.entries(sumParams).forEach(([k, v]) => { if (v !== undefined) p.append(k, v); });
      return apiService.get(`/api/v1/attendance/contractor-summary?${p}`);
    },
    enabled: mode === 'summary',
    staleTime: 15000,
  });
  const sumRows  = sumData?.data  ?? [];
  const sumTotal = sumData?.total ?? 0;

  const isLoading = mode === 'transactions' ? txnLoading : sumLoading;
  const rows      = mode === 'transactions' ? txnRows    : sumRows;
  const total     = mode === 'transactions' ? txnTotal   : sumTotal;
  const refetch   = () => { refetchStats(); mode === 'transactions' ? refetchTxn() : refetchSum(); };

  const resetFilters = () => { setSearch(''); setVendorId(null); setPunchFilter(null); setClearFilter(null); setPage(1); };

  // ── Export (fetches all matching rows, not just current page) ────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const baseParams = mode === 'transactions' ? txnParams : sumParams;
      const p = new URLSearchParams();
      Object.entries({ ...baseParams, export: true }).forEach(([k, v]) => {
        if (v !== undefined && k !== 'page' && k !== 'page_size') p.append(k, v);
      });
      const endpoint = mode === 'transactions'
        ? `/api/v1/attendance/contractor-transactions?${p}`
        : `/api/v1/attendance/contractor-summary?${p}`;
      const resp = await apiService.get(endpoint);
      const allRows = resp.data ?? [];
      if (!allRows.length) { message.warning('No records to export'); return; }
      buildCSV(allRows, mode);
      message.success(`Exported ${allRows.length} records`);
    } catch {
      message.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ── Transaction columns ───────────────────────────────────────────────────
  const txnCols = [
    {
      title: 'Contractor', key: 'contractor', width: 210, ellipsis: true,
      render: (_, r) => (
        <EmployeeCell
          name={r.contractor_name}
          code={r.emp_code}
          dept={r.vendor_name}
          onClick={() => setDetail(r)}
        />
      ),
    },
    {
      title: 'Job Title', dataIndex: 'job_title', key: 'job', width: 130, ellipsis: true,
      render: v => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Punch Time', dataIndex: 'punch_time', key: 'time', width: 145,
      render: v => v ? (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>{dayjs(v).format('HH:mm:ss')}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(v).format('DD MMM YYYY')}</Text>
        </Space>
      ) : '—',
      sorter: (a, b) => dayjs(a.punch_time).unix() - dayjs(b.punch_time).unix(),
    },
    {
      title: 'Type', key: 'punch_state', width: 110,
      render: (_, r) => {
        const ps = resolvedPunchState(r.punch_state);
        return <Badge status={ps.status} text={<Text style={{ fontSize: 12 }}>{ps.label}</Text>} />;
      },
    },
    {
      title: 'Verify', dataIndex: 'verify_type', key: 'verify', width: 100,
      render: v => { const vl = vLabel(v); return <Tag color={vl.color} style={{ fontSize: 10 }}>{vl.label}</Tag>; },
    },
    {
      title: 'Area / Terminal', key: 'area', width: 140, ellipsis: true,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{r.area_name || r.area_alias || '—'}</Text>
          {r.terminal_alias && <Text type="secondary" style={{ fontSize: 11 }}>{r.terminal_alias}</Text>}
        </Space>
      ),
    },
    {
      title: 'Clearances', key: 'clearances', width: 180,
      render: (_, r) => {
        const pm = permitStatus(r.work_permit_expiry);
        return (
          <Space direction="vertical" size={2}>
            <Tag color={pm.color} icon={pm.days !== null && pm.days < 0 ? <WarningOutlined /> : null} style={{ fontSize: 10 }}>
              {pm.label}
            </Tag>
            <Space size={3}>
              {clearanceBadge(r.medical_clearance_status, 'Med')}
              {clearanceBadge(r.background_check_status, 'BG')}
            </Space>
          </Space>
        );
      },
    },
    {
      title: '', key: 'act', width: 44, fixed: 'right',
      render: (_, r) => (
        <Tooltip title="View contractor details">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)} />
        </Tooltip>
      ),
    },
  ];

  // ── Summary columns ───────────────────────────────────────────────────────
  const sumCols = [
    {
      title: 'Contractor', key: 'contractor', width: 210, ellipsis: true,
      render: (_, r) => (
        <EmployeeCell
          name={r.contractor_name}
          code={r.emp_code}
          dept={r.vendor_name}
          onClick={() => setDetail(r)}
        />
      ),
    },
    {
      title: 'Job Title', dataIndex: 'job_title', key: 'job', width: 130, ellipsis: true,
      render: v => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Date', dataIndex: 'work_date', key: 'date', width: 110,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—',
      sorter: (a, b) => dayjs(a.work_date).unix() - dayjs(b.work_date).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'First In', dataIndex: 'first_in', key: 'first_in', width: 90,
      render: v => v ? <Tag color="success" icon={<LoginOutlined />}>{dayjs(v).format('HH:mm')}</Tag> : '—',
    },
    {
      title: 'Last Out', dataIndex: 'last_out', key: 'last_out', width: 90,
      render: v => v ? <Tag color="error" icon={<LogoutOutlined />}>{dayjs(v).format('HH:mm')}</Tag> : (
        <Tag color="processing">On site</Tag>
      ),
    },
    {
      title: 'Hours', dataIndex: 'hours_worked', key: 'hours', width: 90,
      render: v => v != null ? (
        <Space size={4}>
          <Text strong style={{ color: v >= 8 ? '#52c41a' : v >= 4 ? '#faad14' : '#ff4d4f' }}>
            {Number(v).toFixed(1)}h
          </Text>
          <Progress
            type="circle"
            percent={Math.min(Math.round((v / 8) * 100), 100)}
            size={20}
            strokeColor={v >= 8 ? '#52c41a' : v >= 4 ? '#faad14' : '#ff4d4f'}
            showInfo={false}
          />
        </Space>
      ) : '—',
      sorter: (a, b) => (a.hours_worked ?? 0) - (b.hours_worked ?? 0),
    },
    {
      title: 'Punches', dataIndex: 'punch_count', key: 'punches', width: 75,
      render: v => <Tag>{v ?? '—'}</Tag>,
    },
    {
      title: 'Clearances', key: 'clearances', width: 180,
      render: (_, r) => {
        const pm = permitStatus(r.work_permit_expiry);
        return (
          <Space direction="vertical" size={2}>
            <Tag color={pm.color} style={{ fontSize: 10 }}>{pm.label}</Tag>
            <Space size={3}>
              {clearanceBadge(r.medical_clearance_status, 'Med')}
              {clearanceBadge(r.background_check_status, 'BG')}
            </Space>
          </Space>
        );
      },
    },
    {
      title: '', key: 'act', width: 44, fixed: 'right',
      render: (_, r) => (
        <Tooltip title="View details">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)} />
        </Tooltip>
      ),
    },
  ];

  const periodLabel = isToday(dateRange) ? "Today's" : 'Period';

  return (
    <div>
      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          {
            title: `${periodLabel} Contractors`,
            value: stats.period_contractors ?? stats.today_contractors ?? 0,
            color: '#3B82F6', icon: <TeamOutlined />,
            sub: `${stats.period_punches ?? stats.today_punches ?? 0} total punches`,
          },
          {
            title: 'On Site Now',
            value: stats.on_site_now ?? 0,
            color: '#10B981', icon: <EnvironmentOutlined />,
            sub: 'Live — checked in, not out',
          },
          {
            title: 'Permit Expiring',
            value: (stats.permit_expiring ?? 0) + (stats.permit_expired ?? 0),
            color: '#F59E0B', icon: <IdcardOutlined />,
            sub: `${stats.permit_expired ?? 0} already expired`,
            alert: (stats.permit_expired ?? 0) > 0,
          },
          {
            title: 'Clearance Alerts',
            value: (stats.clearance_alerts ?? 0) + (stats.clearance_pending ?? 0),
            color: '#EF4444', icon: <SafetyCertificateOutlined />,
            sub: `${stats.clearance_alerts ?? 0} failed · ${stats.clearance_pending ?? 0} pending`,
            alert: (stats.clearance_alerts ?? 0) > 0,
          },
          {
            title: 'Active Contractors',
            value: stats.total_active ?? 0,
            color: '#8B5CF6', icon: <UserOutlined />,
            sub: 'Registered in system',
          },
        ].map(s => (
          <Col xs={12} sm={12} md={8} lg={24/5} key={s.title} style={{ minWidth: 150 }}>
            <Card
              size="small"
              styles={{ body: { padding: '10px 16px' } }}
              style={{ borderTop: `3px solid ${s.color}`, background: s.alert ? `${s.color}08` : undefined }}
            >
              <Statistic
                title={<Text style={{ fontSize: 12 }}>{s.title}</Text>}
                value={s.value}
                prefix={<span style={{ color: s.color }}>{s.icon}</span>}
                valueStyle={{ color: s.color, fontSize: 22 }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>{s.sub}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Alert banner ──────────────────────────────────────────────── */}
      {((stats.permit_expired ?? 0) > 0 || (stats.clearance_alerts ?? 0) > 0) && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 12 }}
          message={
            <Space split={<Divider type="vertical" />}>
              {(stats.permit_expired ?? 0) > 0 && (
                <Text><strong>{stats.permit_expired}</strong> contractor(s) with expired work permits are accessing the site</Text>
              )}
              {(stats.clearance_alerts ?? 0) > 0 && (
                <Text><strong>{stats.clearance_alerts}</strong> contractor(s) have failed medical or background checks</Text>
              )}
            </Space>
          }
          action={
            <Button size="small" danger onClick={() => { setClearFilter('FAILED'); setPage(1); }}>
              View
            </Button>
          }
        />
      )}

      {/* ── Filter + view bar ─────────────────────────────────────────── */}
      <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ marginBottom: 12 }}>
        <Row gutter={[10, 8]} align="middle" wrap>
          <Col>
            <Badge count={activeFilterCount} size="small" offset={[-4, 4]}>
              <Input.Search
                prefix={<FilterOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="Search contractor name, code…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                allowClear
                style={{ width: 240 }}
              />
            </Badge>
          </Col>
          <Col>
            <RangePicker
              value={dateRange}
              onChange={v => { setDateRange(v ?? [dayjs().startOf('week'), dayjs().endOf('week')]); setPage(1); }}
              presets={DATE_PRESETS}
              format="DD/MM/YYYY"
              style={{ width: 240 }}
            />
          </Col>
          <Col>
            <Select
              placeholder="All Vendors"
              value={vendorId}
              onChange={v => { setVendorId(v); setPage(1); }}
              allowClear
              showSearch
              filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())}
              style={{ width: 180 }}
              options={(vendors || []).map(v => ({ value: v.id, label: v.vendor_name }))}
            />
          </Col>
          {mode === 'transactions' && (
            <Col>
              <Select
                placeholder="Punch Type"
                value={punchFilter}
                onChange={v => { setPunchFilter(v); setPage(1); }}
                allowClear
                style={{ width: 130 }}
                options={[
                  { value: 0,   label: 'Check-in' },
                  { value: 1,   label: 'Check-out' },
                  { value: 255, label: 'Auto-detect' },
                ]}
              />
            </Col>
          )}
          <Col>
            <Select
              placeholder="Clearance Filter"
              value={clearFilter}
              onChange={v => { setClearFilter(v); setPage(1); }}
              allowClear
              style={{ width: 160 }}
              options={[
                { value: 'FAILED',   label: '🔴 Failed Clearance' },
                { value: 'PENDING',  label: '🟡 Pending Clearance' },
                { value: 'EXPIRING', label: '🟠 Permit Expiring' },
                { value: 'EXPIRED',  label: '🔴 Permit Expired' },
              ]}
            />
          </Col>
          {activeFilterCount > 0 && (
            <Col>
              <Button size="small" onClick={resetFilters}>Clear filters</Button>
            </Col>
          )}
          <Col flex={1} />
          <Col>
            <Segmented
              value={mode}
              onChange={v => { setMode(v); setPage(1); }}
              options={[
                { label: 'Transactions', value: 'transactions' },
                { label: 'Daily Summary', value: 'summary' },
              ]}
            />
          </Col>
          <Col>
            <Space>
              <Tooltip title={total > PAGE_SIZE ? `Export all ${total} matching records` : 'Export CSV'}>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  loading={exporting}
                  disabled={!rows.length && !exporting}
                >
                  Export{total > PAGE_SIZE ? ` (${total})` : ''}
                </Button>
              </Tooltip>
              <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div style={tableContainerStyle}>
        <Table
          columns={mode === 'transactions' ? txnCols : sumCols}
          dataSource={rows}
          rowKey={mode === 'transactions' ? 'id' : r => `${r.emp_code}_${r.work_date}`}
          loading={isLoading}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            onChange: p => setPage(p),
            showSizeChanger: false,
            showTotal: (t, [f, l]) => (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {f}–{l} of <strong>{t}</strong> {mode === 'transactions' ? 'records' : 'contractor-days'}
              </Text>
            ),
          }}
          locale={{ emptyText: (
            <Space direction="vertical" style={{ padding: 32 }}>
              <TeamOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
              <Text type="secondary">No contractor attendance records found for the selected filters</Text>
            </Space>
          )}}
        />
      </div>

      {/* ── Contractor detail drawer ───────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <IdcardOutlined />
            Contractor Details
          </Space>
        }
        open={!!detail}
        onClose={() => setDetail(null)}
        width={440}
        extra={
          detail?.contractor_id && (
            <Tooltip title="Open full contractor profile">
              <Button
                size="small"
                icon={<LinkOutlined />}
                onClick={() => navigate('/personnel/vendors')}
              >
                Full Profile
              </Button>
            </Tooltip>
          )
        }
      >
        {detail && (() => {
          const pm = permitStatus(detail.work_permit_expiry);
          return (
            <>
              {/* Header */}
              <div style={{ textAlign: 'center', padding: '4px 0 20px' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16, margin: '0 auto 12px',
                  background: 'linear-gradient(135deg, #3B82F6, #1677ff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 800, color: '#fff',
                }}>
                  {(detail.contractor_name || detail.emp_code || '?').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{detail.contractor_name || detail.emp_code}</div>
                <Text type="secondary" style={{ fontSize: 13 }}>{detail.job_title || 'Contractor'}</Text>
                {detail.specialization && (
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Specialization: {detail.specialization}</Text>
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  {detail.vendor_name && <Tag color="blue">{detail.vendor_name}</Tag>}
                  <Tag color="default" style={{ fontFamily: 'monospace' }}>{detail.emp_code}</Tag>
                  {detail.availability_status && (
                    <Tag color={detail.availability_status === 'AVAILABLE' ? 'success' : 'default'}>
                      {detail.availability_status}
                    </Tag>
                  )}
                </div>
              </div>

              <Divider style={{ margin: '0 0 16px' }} />

              {/* Clearances */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>
                  Compliance &amp; Clearances
                </div>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <Card size="small" style={{ background: pm.color === 'error' ? '#fff2f0' : pm.color === 'warning' ? '#fffbe6' : '#f6ffed', border: `1px solid ${pm.color === 'error' ? '#ffccc7' : pm.color === 'warning' ? '#ffe58f' : '#b7eb8f'}` }}>
                    <Space>
                      <IdcardOutlined style={{ color: pm.color === 'error' ? '#ff4d4f' : pm.color === 'warning' ? '#faad14' : '#52c41a' }} />
                      <div>
                        <Text strong style={{ fontSize: 12 }}>Work Permit</Text>
                        <div>
                          <Tag color={pm.color} style={{ fontSize: 11 }}>{pm.label}</Tag>
                          {detail.work_permit_number && <Text type="secondary" style={{ fontSize: 11 }}> #{detail.work_permit_number}</Text>}
                        </div>
                      </div>
                    </Space>
                  </Card>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Card size="small">
                        <Text style={{ fontSize: 11, display: 'block', color: '#9CA3AF' }}>Medical</Text>
                        {clearanceBadge(detail.medical_clearance_status, 'Med')}
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card size="small">
                        <Text style={{ fontSize: 11, display: 'block', color: '#9CA3AF' }}>Background</Text>
                        {clearanceBadge(detail.background_check_status, 'BG')}
                      </Card>
                    </Col>
                  </Row>
                  {detail.security_clearance && (
                    <Card size="small">
                      <Text style={{ fontSize: 11, display: 'block', color: '#9CA3AF' }}>Security Clearance</Text>
                      <Tag color="purple">{detail.security_clearance}</Tag>
                    </Card>
                  )}
                </Space>
              </div>

              {/* Attendance record */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>
                  {mode === 'summary' ? 'Day Summary' : 'Punch Record'}
                </div>
                <Descriptions column={1} size="small" styles={{ label: { color: '#9CA3AF', fontWeight: 500 } }}>
                  {mode === 'summary' ? (
                    <>
                      <Descriptions.Item label="Date">{detail.work_date ? dayjs(detail.work_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
                      <Descriptions.Item label="First In">{detail.first_in ? dayjs(detail.first_in).format('HH:mm:ss') : '—'}</Descriptions.Item>
                      <Descriptions.Item label="Last Out">{detail.last_out ? dayjs(detail.last_out).format('HH:mm:ss') : 'Still on site'}</Descriptions.Item>
                      <Descriptions.Item label="Hours Worked">{detail.hours_worked != null ? `${Number(detail.hours_worked).toFixed(2)}h` : '—'}</Descriptions.Item>
                      <Descriptions.Item label="Total Punches">{detail.punch_count ?? '—'}</Descriptions.Item>
                    </>
                  ) : (
                    <>
                      <Descriptions.Item label="Punch Time">{detail.punch_time ? dayjs(detail.punch_time).format('DD MMM YYYY HH:mm:ss') : '—'}</Descriptions.Item>
                      <Descriptions.Item label="Punch Type"><Badge status={pState(detail.punch_state).status} text={pState(detail.punch_state).label} /></Descriptions.Item>
                      <Descriptions.Item label="Verify Method"><Tag color={vLabel(detail.verify_type).color}>{vLabel(detail.verify_type).label}</Tag></Descriptions.Item>
                      <Descriptions.Item label="Terminal">{detail.terminal_sn || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Area">{detail.area_name || detail.area_alias || '—'}</Descriptions.Item>
                    </>
                  )}
                  <Descriptions.Item label="Daily Rate">
                    {detail.daily_rate ? `${detail.currency ?? 'USD'} ${Number(detail.daily_rate).toFixed(2)}` : '—'}
                  </Descriptions.Item>
                  {detail.specialization && (
                    <Descriptions.Item label="Specialization">{detail.specialization}</Descriptions.Item>
                  )}
                  {detail.availability_status && (
                    <Descriptions.Item label="Availability">{detail.availability_status}</Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            </>
          );
        })()}
      </Drawer>
    </div>
  );
};

export default ContractorAttendanceTab;
