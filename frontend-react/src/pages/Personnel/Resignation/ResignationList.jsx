import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Row, Col,
  App, Popconfirm, DatePicker, Form, Drawer, Tabs,
  Divider, Tooltip, Alert, Avatar, Typography, Badge,
  Dropdown, Modal, Card,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined,
  UserOutlined, FileTextOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, ClockCircleOutlined, FilterOutlined,
  ApartmentOutlined, DownloadOutlined, BarChartOutlined,
  WarningOutlined, MoreOutlined, CheckSquareOutlined,
  CalendarOutlined, TeamOutlined, EyeOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// ── Constants ──────────────────────────────────────────────────────────────────
const RESIGNATION_TYPES = [
  { value: 'VOLUNTARY',   label: 'Voluntary',    color: '#2563eb', bg: '#eff6ff',  border: '#bfdbfe' },
  { value: 'INVOLUNTARY', label: 'Dismissal',    color: '#dc2626', bg: '#fef2f2',  border: '#fecaca' },
  { value: 'RETIREMENT',  label: 'Retirement',   color: '#d97706', bg: '#fffbeb',  border: '#fde68a' },
  { value: 'TERMINATION', label: 'Termination',  color: '#c2410c', bg: '#ffedd5',  border: '#fed7aa' },
];
const STATUS_CFG = {
  PENDING:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Pending',   row: 'rgba(217,119,6,0.04)' },
  APPROVED:  { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Approved',  row: 'rgba(22,163,74,0.04)'  },
  REJECTED:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Rejected',  row: 'rgba(220,38,38,0.04)'  },
  COMPLETED: { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Completed', row: 'rgba(100,116,139,0.04)' },
};

const CLEARANCE_ITEMS = [
  { key: 'exit_interview_date',           label: 'Exit Interview'     },
  { key: 'handover_completed',            label: 'Job Handover'       },
  { key: 'financial_clearance_completed', label: 'Financial Clearance'},
  { key: 'assets_returned',               label: 'Assets Returned'    },
  { key: 'system_access_revoked',         label: 'System Access'      },
  { key: 'device_access_removed',         label: 'ZKTeco Device'      },
];

const AVATAR_PALETTE = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d','#9333ea','#0f766e'];
const avatarColor = name => AVATAR_PALETTE[(name||'').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = name => (name||'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
const lbl         = s => (s||'').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
const typeInfo    = v => RESIGNATION_TYPES.find(t => t.value === v) || { color:'#64748b', bg:'#f8fafc', border:'#e2e8f0', label: lbl(v) };

const clearanceDone = r => CLEARANCE_ITEMS.filter(c => r[c.key]).length;

const exportCSV = (cols, rows, fname) => {
  const h = cols.map(c => `"${c.title}"`).join(',');
  const b = rows.map(r => cols.map(c => `"${String(c.ev(r)).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([h+'\n'+b], { type:'text/csv' }));
  a.download = fname; a.click(); URL.revokeObjectURL(a.href);
};

// ── Pills ──────────────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status] || { color:'#64748b', bg:'#f8fafc', border:'#e2e8f0', label: lbl(status) };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, borderRadius:999, padding:'2px 10px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.color, flexShrink:0 }}/>
      {cfg.label}
    </span>
  );
};
const TypePill = ({ value }) => {
  const t = typeInfo(value);
  return (
    <span style={{ display:'inline-flex', alignItems:'center', background:t.bg, border:`1px solid ${t.border}`, color:t.color, borderRadius:999, padding:'2px 10px', fontSize:11, fontWeight:700 }}>
      {t.label}
    </span>
  );
};

const CheckDot = ({ done, label }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
    <span style={{
      width:16, height:16, borderRadius:'50%', flexShrink:0,
      background: done ? '#16a34a' : '#e5e7eb',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      {done
        ? <CheckCircleOutlined style={{ color:'#fff', fontSize:9 }}/>
        : <span style={{ width:4, height:4, borderRadius:'50%', background:'#94a3b8' }}/>
      }
    </span>
    <span style={{ fontSize:12, color: done ? '#374151' : '#94a3b8', fontWeight: done ? 500 : 400 }}>{label}</span>
    {done && <span style={{ marginLeft:'auto', fontSize:10, color:'#16a34a', fontWeight:600 }}>Done</span>}
  </div>
);

// ── Notice Period badge ────────────────────────────────────────────────────────
const NoticePeriod = ({ resignDate, lastDay, status }) => {
  if (!lastDay) return <span style={{ color:'#94a3b8', fontSize:12 }}>—</span>;
  const today    = dayjs();
  const last     = dayjs(lastDay);
  const start    = resignDate ? dayjs(resignDate) : today;
  const totalDays = last.diff(start, 'day');
  const daysLeft  = last.diff(today, 'day');
  const overdue   = daysLeft < 0 && status !== 'COMPLETED';

  if (status === 'COMPLETED') {
    return (
      <div style={{ fontSize:11 }}>
        <div style={{ fontWeight:600, color:'#64748b' }}>{last.format('DD MMM YYYY')}</div>
        <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>{totalDays}d notice</div>
      </div>
    );
  }
  if (overdue) {
    return (
      <div style={{ fontSize:11 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:999, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', fontWeight:700, fontSize:10 }}>
          <WarningOutlined style={{ fontSize:9 }}/> {Math.abs(daysLeft)}d overdue
        </div>
        <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{last.format('DD MMM YYYY')}</div>
      </div>
    );
  }
  const pct   = Math.min(100, Math.max(0, ((totalDays - daysLeft) / Math.max(totalDays, 1)) * 100));
  const color = daysLeft <= 7 ? '#dc2626' : daysLeft <= 14 ? '#d97706' : '#16a34a';
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
        <span style={{ color, fontWeight:700 }}>{daysLeft}d left</span>
        <span style={{ color:'#94a3b8' }}>{last.format('DD MMM')}</span>
      </div>
      <div style={{ height:4, background:'#e5e7eb', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:2, transition:'width 0.3s' }}/>
      </div>
    </div>
  );
};

// ── Clearance progress with tooltip ───────────────────────────────────────────
const ClearanceBar = ({ record }) => {
  const done  = clearanceDone(record);
  const total = CLEARANCE_ITEMS.length;
  const color = done === total ? '#16a34a' : done >= total / 2 ? '#d97706' : '#dc2626';
  return (
    <Tooltip
      title={
        <div style={{ padding:'4px 0', minWidth:160 }}>
          {CLEARANCE_ITEMS.map(c => (
            <div key={c.key} style={{ display:'flex', alignItems:'center', gap:6, padding:'2px 0' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background: record[c.key] ? '#4ade80' : '#6b7280', flexShrink:0 }}/>
              <span style={{ fontSize:11, color: record[c.key] ? '#d1fae5' : '#9ca3af' }}>{c.label}</span>
            </div>
          ))}
        </div>
      }
      color="#1e293b"
    >
      <div style={{ display:'flex', alignItems:'center', gap:7, cursor:'default' }}>
        <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:3, overflow:'hidden' }}>
          <div style={{ width:`${(done/total)*100}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.3s' }}/>
        </div>
        <span style={{ fontSize:10, color: done === total ? '#16a34a' : '#94a3b8', whiteSpace:'nowrap', fontWeight: done===total ? 700 : 400 }}>
          {done}/{total}
        </span>
      </div>
    </Tooltip>
  );
};

// ── Analytics ──────────────────────────────────────────────────────────────────
const AnalyticsTab = ({ records }) => {
  const { typeDist, monthlyTrend, deptDist } = useMemo(() => {
    const tC = {}, mC = {}, dC = {};
    records.forEach(r => {
      if (r.resignation_type) tC[r.resignation_type] = (tC[r.resignation_type] || 0) + 1;
      const m = r.resignation_date ? dayjs(r.resignation_date).format('YYYY-MM') : null;
      if (m) mC[m] = (mC[m] || 0) + 1;
      const dept = r.department_name || r.employee?.department;
      if (dept) dC[dept] = (dC[dept] || 0) + 1;
    });
    const typeDist    = RESIGNATION_TYPES.filter(t => tC[t.value]).map(t => ({ name: t.label, value: tC[t.value], fill: t.color }));
    const now         = dayjs();
    const monthlyTrend = Array.from({ length:12 }, (_,i) => { const d = now.subtract(11-i,'month'); return { name: d.format('MMM'), count: mC[d.format('YYYY-MM')]||0 }; });
    const deptDist    = Object.entries(dC).sort((a,b) => b[1]-a[1]).slice(0,10).map(([name,value]) => ({ name, value }));
    return { typeDist, monthlyTrend, deptDist };
  }, [records]);

  if (!records.length) return (
    <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
      <BarChartOutlined style={{ fontSize:40, color:'#cbd5e1' }}/>
      <div style={{ marginTop:12 }}>No data yet</div>
    </div>
  );
  const card   = { background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:16 };
  const sTitle = t => <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>{t}</div>;
  const CustomPieLabel = ({ cx,cy,midAngle,innerRadius,outerRadius,percent }) => {
    if (percent < 0.07) return null;
    const R = Math.PI/180, r = innerRadius+(outerRadius-innerRadius)*0.55;
    return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent*100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Row gutter={[16,16]}>
        <Col xs={24} md={10}>
          <div style={card}>
            {sTitle('Resignation Type')}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <ResponsiveContainer width="55%" height={160}>
                <PieChart>
                  <Pie data={typeDist} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={68} labelLine={false} label={CustomPieLabel}>
                    {typeDist.map((d,i) => <Cell key={i} fill={d.fill}/>)}
                  </Pie>
                  <RTooltip contentStyle={{ borderRadius:8, fontSize:11 }}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                {typeDist.map((d,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:d.fill, flexShrink:0 }}/>
                      <Text style={{ fontSize:10 }}>{d.name}</Text>
                    </div>
                    <Text style={{ fontSize:12, fontWeight:700 }}>{d.value}</Text>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Col>
        <Col xs={24} md={14}>
          <div style={card}>
            {sTitle('Monthly Trend (12 months)')}
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={monthlyTrend} margin={{ left:-20, right:8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false}/>
                <RTooltip contentStyle={{ borderRadius:8, fontSize:11 }} formatter={v => [v,'Resignations']}/>
                <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2.5} dot={{ fill:'#dc2626', r:3 }} activeDot={{ r:5 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Col>
        {deptDist.length > 0 && (
          <Col xs={24}>
            <div style={card}>
              {sTitle('By Department')}
              <ResponsiveContainer width="100%" height={Math.max(120, deptDist.length * 26)}>
                <BarChart layout="vertical" data={deptDist} margin={{ left:0, right:16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize:9, fill:'#374151' }} tickLine={false} axisLine={false}/>
                  <RTooltip contentStyle={{ borderRadius:8, fontSize:11 }}/>
                  <Bar dataKey="value" radius={[0,4,4,0]} fill="#dc2626"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}
      </Row>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ResignationList = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab,       setActiveTab]       = useState('resignations');
  const [search,          setSearch]          = useState('');
  const [filterType,      setFilterType]      = useState(null);
  const [filterStatus,    setFilterStatus]    = useState(null);
  const [filterDept,      setFilterDept]      = useState('');
  const [filterClearance, setFilterClearance] = useState(null);  // 'complete' | 'incomplete'
  const [dateRange,       setDateRange]       = useState(null);
  const [detailRecord,    setDetailRecord]    = useState(null);
  const [createOpen,      setCreateOpen]      = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [bulkDeleting,    setBulkDeleting]    = useState(false);
  const [form] = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: allRecords = [], isLoading, refetch } = useQuery({
    queryKey: ['resignations'],
    queryFn:  () => apiService.get('/api/v1/personnel/resignation/?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel-active-res'],
    queryFn:  () => apiService.get('/api/v1/personnel/?status=ACTIVE&limit=1000'),
    staleTime: 60000,
    select: d => Array.isArray(d) ? d : (d?.results || d?.data || []),
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const inv = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['resignations'] });
    queryClient.invalidateQueries({ queryKey: ['personnel'] });
    queryClient.invalidateQueries({ queryKey: ['personnel-active-res'] });
  }, [queryClient]);

  const getEmpName = r => r.personnel_name || r.employee?.full_name || `${r.employee?.first_name||''} ${r.employee?.last_name||''}`.trim() || `Personnel #${r.personnel_id}`;

  const deptOptions = useMemo(() => {
    const set = new Set(allRecords.map(r => r.department_name || r.employee?.department).filter(Boolean));
    return [...set].sort().map(d => ({ value:d, label:d }));
  }, [allRecords]);

  const filtered = useMemo(() => allRecords.filter(r => {
    if (filterType      && r.resignation_type !== filterType)  return false;
    if (filterStatus    && r.status           !== filterStatus) return false;
    const dept = r.department_name || r.employee?.department;
    if (filterDept && dept !== filterDept) return false;
    if (filterClearance === 'complete'   && clearanceDone(r) < CLEARANCE_ITEMS.length) return false;
    if (filterClearance === 'incomplete' && clearanceDone(r) >= CLEARANCE_ITEMS.length) return false;
    if (dateRange && dateRange[0] && dateRange[1]) {
      const d = r.resignation_date ? dayjs(r.resignation_date) : null;
      if (!d || d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return getEmpName(r).toLowerCase().includes(q)
          || (r.employee?.emp_code||'').toLowerCase().includes(q)
          || (r.reason||'').toLowerCase().includes(q)
          || (dept||'').toLowerCase().includes(q);
    }
    return true;
  }), [allRecords, filterType, filterStatus, filterDept, filterClearance, dateRange, search]);

  const pendingCount = allRecords.filter(r => r.status === 'PENDING').length;
  const overdueCount = allRecords.filter(r => r.last_working_day && dayjs(r.last_working_day).isBefore(dayjs()) && r.status !== 'COMPLETED').length;
  const hasFilters   = search || filterType || filterStatus || filterDept || filterClearance || dateRange;
  const clearFilters = () => { setSearch(''); setFilterType(null); setFilterStatus(null); setFilterDept(''); setFilterClearance(null); setDateRange(null); };

  const personnelOpts = useMemo(() => personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name||'')} ${(p.last_name||'')}`.trim() + (p.emp_code ? ` (${p.emp_code})` : ''),
    searchtext: `${(p.first_name||'')} ${(p.last_name||'')} ${p.emp_code||''}`,
  })), [personnel]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/resignation/', d),
    onSuccess: () => { message.success('Resignation recorded — employee status updated'); setCreateOpen(false); form.resetFields(); inv(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Failed to process resignation'),
  });
  const deleteMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/resignation/${id}`),
    onSuccess: () => { message.success('Record deleted'); setDetailRecord(null); inv(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });

  const handleCreate = () => form.validateFields().then(v => {
    createMut.mutate({
      personnel_id:     v.personnel_id,
      resignation_type: v.resignation_type,
      resignation_date: v.resignation_date?.toISOString(),
      last_working_day: v.last_working_day?.toISOString(),
      reason:           v.reason,
      detailed_reason:  v.detailed_reason || null,
    });
  }).catch(() => {});

  const handleBulkDelete = () => {
    Modal.confirm({
      title: `Delete ${selectedRowKeys.length} resignation record${selectedRowKeys.length > 1 ? 's' : ''}?`,
      content: 'This will NOT restore any affected employee statuses.',
      icon: <ExclamationCircleOutlined style={{ color:'#dc2626' }}/>,
      okText: 'Delete All', okButtonProps: { danger: true },
      onOk: async () => {
        setBulkDeleting(true);
        try {
          await Promise.all(selectedRowKeys.map(id => apiService.delete(`/api/v1/personnel/resignation/${id}`)));
          message.success(`${selectedRowKeys.length} record(s) deleted`);
          setSelectedRowKeys([]);
          inv();
        } catch (e) {
          message.error('Some deletions failed');
        } finally {
          setBulkDeleting(false);
        }
      },
    });
  };

  const exportCols = [
    { title:'Employee',         ev: r => getEmpName(r) },
    { title:'Emp Code',         ev: r => r.employee?.emp_code||'' },
    { title:'Department',       ev: r => r.department_name||r.employee?.department||'' },
    { title:'Type',             ev: r => r.resignation_type||'' },
    { title:'Status',           ev: r => r.status||'' },
    { title:'Resignation Date', ev: r => r.resignation_date ? dayjs(r.resignation_date).format('YYYY-MM-DD') : '' },
    { title:'Last Working Day', ev: r => r.last_working_day ? dayjs(r.last_working_day).format('YYYY-MM-DD') : '' },
    { title:'Reason',           ev: r => r.reason||'' },
    { title:'Clearance Done',   ev: r => `${clearanceDone(r)}/${CLEARANCE_ITEMS.length}` },
  ];

  // ── Row selection ─────────────────────────────────────────────────────────────
  const rowSelection = {
    selectedRowKeys,
    onChange: keys => setSelectedRowKeys(keys),
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
      { key: 'pending',  text: 'Select Pending Only',  onSelect: () => setSelectedRowKeys(filtered.filter(r => r.status === 'PENDING').map(r => r.id)) },
      { key: 'overdue',  text: 'Select Overdue Only',  onSelect: () => setSelectedRowKeys(filtered.filter(r => r.last_working_day && dayjs(r.last_working_day).isBefore(dayjs()) && r.status !== 'COMPLETED').map(r => r.id)) },
    ],
  };

  // ── Expandable rows ────────────────────────────────────────────────────────────
  const expandedRowRender = record => (
    <div style={{ padding:'10px 16px 10px 52px', background:'#fafafa' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>
        Clearance Checklist — {clearanceDone(record)}/{CLEARANCE_ITEMS.length} complete
      </div>
      <Row gutter={[12, 4]}>
        {CLEARANCE_ITEMS.map(c => (
          <Col key={c.key} xs={24} sm={12} md={8}>
            <CheckDot done={!!record[c.key]} label={c.label}/>
          </Col>
        ))}
      </Row>
      {record.reason && (
        <div style={{ marginTop:10, padding:'8px 12px', background:'#fff', borderRadius:8, border:'1px solid #e5e7eb' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:2 }}>{record.reason}</div>
          {record.detailed_reason && <div style={{ fontSize:11, color:'#6b7280' }}>{record.detailed_reason}</div>}
        </div>
      )}
    </div>
  );

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Employee', key: 'employee', width: 200,
      sorter: (a,b) => getEmpName(a).localeCompare(getEmpName(b)),
      render: (_,r) => (
        <div style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer' }} onClick={() => setDetailRecord(r)}>
          <Avatar size={32} style={{ background: avatarColor(getEmpName(r)), fontSize:11, fontWeight:700, flexShrink:0 }}>
            {initials(getEmpName(r))}
          </Avatar>
          <div>
            <div style={{ fontWeight:600, fontSize:12, color:'#111827', lineHeight:1.3 }}>{getEmpName(r)}</div>
            {r.employee?.emp_code && (
              <span style={{ fontFamily:'monospace', fontSize:9, color:'#94a3b8', background:'#f3f4f6', borderRadius:3, padding:'0 4px' }}>
                {r.employee.emp_code}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Department', key: 'department', width: 140, ellipsis: true,
      sorter: (a,b) => ((a.department_name||a.employee?.department||'')).localeCompare(b.department_name||b.employee?.department||''),
      filters: deptOptions.map(d => ({ text: d.label, value: d.value })),
      onFilter: (value, record) => (record.department_name || record.employee?.department) === value,
      render: (_,r) => {
        const dept = r.department_name || r.employee?.department;
        return dept
          ? <div style={{ display:'flex', alignItems:'center', gap:5 }}><ApartmentOutlined style={{ color:'#94a3b8', fontSize:11 }}/><span style={{ fontSize:12, color:'#374151' }}>{dept}</span></div>
          : <span style={{ color:'#d1d5db' }}>—</span>;
      },
    },
    {
      title: 'Type', key: 'type', width: 130,
      sorter: (a,b) => (a.resignation_type||'').localeCompare(b.resignation_type||''),
      filters: RESIGNATION_TYPES.map(t => ({ text: t.label, value: t.value })),
      onFilter: (value, record) => record.resignation_type === value,
      render: (_,r) => <TypePill value={r.resignation_type}/>,
    },
    {
      title: 'Status', key: 'status', width: 120,
      sorter: (a,b) => (a.status||'').localeCompare(b.status||''),
      filters: Object.keys(STATUS_CFG).map(s => ({ text: STATUS_CFG[s].label, value: s })),
      onFilter: (value, record) => record.status === value,
      render: (_,r) => <StatusPill status={r.status||'PENDING'}/>,
    },
    {
      title: 'Resignation Date', key: 'resignDate', width: 140,
      sorter: (a,b) => (a.resignation_date||'').localeCompare(b.resignation_date||''),
      render: (_,r) => r.resignation_date
        ? <div style={{ fontSize:12 }}><div style={{ fontWeight:600 }}>{dayjs(r.resignation_date).format('DD MMM YYYY')}</div><div style={{ fontSize:10, color:'#94a3b8' }}>{dayjs().diff(dayjs(r.resignation_date),'day')}d ago</div></div>
        : <span style={{ color:'#d1d5db' }}>—</span>,
    },
    {
      title: 'Notice Period', key: 'noticePeriod', width: 140,
      sorter: (a,b) => (a.last_working_day||'').localeCompare(b.last_working_day||''),
      render: (_,r) => <NoticePeriod resignDate={r.resignation_date} lastDay={r.last_working_day} status={r.status}/>,
    },
    {
      title: 'Clearance', key: 'clearance', width: 140,
      sorter: (a,b) => clearanceDone(a) - clearanceDone(b),
      render: (_,r) => <ClearanceBar record={r}/>,
    },
    {
      title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true,
      render: v => <span style={{ fontSize:12, color:'#374151' }}>{v||'—'}</span>,
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 60,
      render: (_,r) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'view', label: 'View Details', icon: <EyeOutlined/>,
                onClick: () => setDetailRecord(r),
              },
              {
                key: 'expand', label: expandedRowKeys.includes(r.id) ? 'Collapse Row' : 'Expand Clearance',
                icon: <CheckSquareOutlined/>,
                onClick: () => setExpandedRowKeys(prev => prev.includes(r.id) ? prev.filter(k => k !== r.id) : [...prev, r.id]),
              },
              {
                key: 'export', label: 'Export This Row', icon: <DownloadOutlined/>,
                onClick: () => exportCSV(exportCols, [r], `resignation-${getEmpName(r).replace(/\s+/g,'-')}-${dayjs().format('YYYY-MM-DD')}.csv`),
              },
              { type: 'divider' },
              {
                key: 'delete', label: 'Delete Record', icon: <DeleteOutlined/>, danger: true,
                onClick: () => Modal.confirm({
                  title: 'Delete resignation record?',
                  content: 'This will NOT restore the employee\'s status.',
                  icon: <ExclamationCircleOutlined style={{ color:'#dc2626' }}/>,
                  okText: 'Delete', okButtonProps: { danger:true },
                  onOk: () => deleteMut.mutateAsync(r.id),
                }),
              },
            ],
          }}
        >
          <Button size="small" type="text" icon={<MoreOutlined/>} style={{ borderRadius:6 }}/>
        </Dropdown>
      ),
    },
  ];

  const selectedRecords = filtered.filter(r => selectedRowKeys.includes(r.id));

  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', overflow:'visible' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Resignation Management</div>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:400, marginTop:2 }}>
                Track employee resignations, retirements and terminations
              </div>
            </div>
            <Button type="primary" danger icon={<PlusOutlined/>} size="small" style={{ fontWeight:600 }}
              onClick={() => { form.resetFields(); setCreateOpen(true); }}>
              Process Resignation
            </Button>
          </div>
        }
        styles={{ header: { overflow:'visible' } }}
      >

      {/* Stat cards */}
      <Row gutter={[12,12]} style={{ marginBottom:16 }}>
        {[
          { label:'Total Resignations', value: allRecords.length,                                                                                    color:'#dc2626', icon:<FileTextOutlined/> },
          { label:'Pending Review',     value: pendingCount,                                                                                         color:'#d97706', icon:<ExclamationCircleOutlined/> },
          { label:'Overdue Last Day',   value: overdueCount,                                                                                         color:'#c2410c', icon:<WarningOutlined/> },
          { label:'Completed',          value: allRecords.filter(r => r.status === 'COMPLETED').length,                                              color:'#64748b', icon:<CheckCircleOutlined/> },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <div style={{ background:'#fff', borderRadius:10, padding:'14px 18px', border:'1px solid #f0f0f0', borderTop:`3px solid ${s.color}`, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:11, color:'#8c8c8c', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.5px' }}>{s.label}</div>
                  <div style={{ fontSize:26, fontWeight:700, color:s.color, lineHeight:1.2, marginTop:4 }}>{s.value}</div>
                </div>
                <div style={{ width:40, height:40, borderRadius:10, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {React.cloneElement(s.icon, { style:{ color:s.color, fontSize:18 } })}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {pendingCount > 0 && (
        <Alert type="warning" showIcon closable style={{ marginBottom:10, borderRadius:8 }}
          message={`${pendingCount} resignation${pendingCount>1?'s':''} pending review — verify clearance checklists`}
          action={<Button size="small" onClick={() => setFilterStatus('PENDING')}>View Pending</Button>}
        />
      )}
      {overdueCount > 0 && (
        <Alert type="error" showIcon closable style={{ marginBottom:10, borderRadius:8 }}
          message={`${overdueCount} employee${overdueCount>1?'s have':' has'} passed their last working day without completion`}
          action={<Button size="small" danger onClick={() => setFilterClearance('incomplete')}>View Incomplete</Button>}
        />
      )}

      {/* Tabs */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding:'0 16px' }}
          items={[
            {
              key: 'resignations',
              label: (
                <span>
                  <UserOutlined/> Resignations
                  {pendingCount > 0 && <span style={{ marginLeft:5, background:'#d97706', color:'#fff', borderRadius:10, padding:'0 6px', fontSize:10, fontWeight:700 }}>{pendingCount}</span>}
                </span>
              ),
              children: (
                <div style={{ paddingBottom:16 }}>

                  {/* Filter bar */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                    <Input
                      placeholder="Search name, code, dept, reason…"
                      prefix={<SearchOutlined style={{ color:'#94a3b8', fontSize:12 }}/>}
                      value={search} onChange={e => setSearch(e.target.value)} allowClear
                      style={{ flex:'1 1 200px', maxWidth:240, borderRadius:8 }}
                    />
                    <FilterOutlined style={{ color:'#94a3b8', fontSize:12 }}/>
                    <Select placeholder="Type" allowClear style={{ flex:'1 1 130px', minWidth:130 }}
                      value={filterType} onChange={setFilterType}
                      options={RESIGNATION_TYPES.map(t => ({ value:t.value, label:<TypePill value={t.value}/> }))}
                    />
                    <Select placeholder="Status" allowClear style={{ flex:'1 1 120px', minWidth:120 }}
                      value={filterStatus} onChange={setFilterStatus}
                      options={Object.keys(STATUS_CFG).map(s => ({ value:s, label:<StatusPill status={s}/> }))}
                    />
                    <Select placeholder="Department" allowClear showSearch optionFilterProp="label" style={{ flex:'1 1 150px', minWidth:150 }}
                      value={filterDept||undefined} onChange={v => setFilterDept(v||'')} options={deptOptions}
                    />
                    <Select placeholder="Clearance" allowClear style={{ width:140 }}
                      value={filterClearance} onChange={setFilterClearance}
                      options={[
                        { value:'complete',   label:<span style={{ color:'#16a34a', fontWeight:600 }}>✓ Complete</span> },
                        { value:'incomplete', label:<span style={{ color:'#dc2626', fontWeight:600 }}>✗ Incomplete</span> },
                      ]}
                    />
                    <RangePicker
                      placeholder={['Resign from','Resign to']} format="DD MMM YYYY" allowClear
                      style={{ flex:'1 1 240px', minWidth:240 }}
                      value={dateRange}
                      onChange={v => setDateRange(v)}
                    />
                    <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                      <Tooltip title="Export visible rows to CSV">
                        <Button icon={<DownloadOutlined/>} onClick={() => exportCSV(exportCols, filtered, `resignations-${dayjs().format('YYYY-MM-DD')}.csv`)} style={{ borderRadius:8 }}/>
                      </Tooltip>
                      <Button icon={<ReloadOutlined/>} onClick={() => refetch()} style={{ borderRadius:8 }}/>
                    </div>
                  </div>

                  {/* Active filter pills */}
                  {hasFilters && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                      <span style={{ fontSize:11, color:'#94a3b8' }}>Filters:</span>
                      {search && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe' }}>"{search}"<button type="button" onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#2563eb', fontSize:12 }}>×</button></span>}
                      {filterType && (() => { const t=typeInfo(filterType); return <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background:t.bg, color:t.color, border:`1px solid ${t.border}` }}>{t.label}<button type="button" onClick={() => setFilterType(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'inherit', fontSize:12 }}>×</button></span>; })()}
                      {filterStatus && (() => { const c=STATUS_CFG[filterStatus]; return <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background:c.bg, color:c.color, border:`1px solid ${c.border}` }}>{c.label}<button type="button" onClick={() => setFilterStatus(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'inherit', fontSize:12 }}>×</button></span>; })()}
                      {filterDept && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background:'#f3f4f6', color:'#374151', border:'1px solid #e5e7eb' }}><ApartmentOutlined style={{ fontSize:10 }}/>{filterDept}<button type="button" onClick={() => setFilterDept('')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#374151', fontSize:12 }}>×</button></span>}
                      {filterClearance && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background: filterClearance==='complete'?'#f0fdf4':'#fef2f2', color: filterClearance==='complete'?'#16a34a':'#dc2626', border:`1px solid ${filterClearance==='complete'?'#bbf7d0':'#fecaca'}` }}>Clearance: {filterClearance}<button type="button" onClick={() => setFilterClearance(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'inherit', fontSize:12 }}>×</button></span>}
                      {dateRange && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe' }}><CalendarOutlined style={{ fontSize:10 }}/>{dateRange[0]?.format('DD MMM')} – {dateRange[1]?.format('DD MMM')}<button type="button" onClick={() => setDateRange(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#2563eb', fontSize:12 }}>×</button></span>}
                      <button type="button" onClick={clearFilters} style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 6px', fontSize:11, color:'#94a3b8', textDecoration:'underline' }}>Clear all</button>
                    </div>
                  )}

                  {/* Bulk action bar */}
                  {selectedRowKeys.length > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 14px', marginBottom:8, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8 }}>
                      <CheckSquareOutlined style={{ color:'#2563eb', fontSize:15 }}/>
                      <span style={{ fontWeight:600, color:'#2563eb', fontSize:13 }}>{selectedRowKeys.length} row{selectedRowKeys.length!==1?'s':''} selected</span>
                      <div style={{ flex:1 }}/>
                      <Button size="small" icon={<DownloadOutlined/>} onClick={() => exportCSV(exportCols, selectedRecords, `resignations-selected-${dayjs().format('YYYY-MM-DD')}.csv`)}>
                        Export CSV
                      </Button>
                      <Button size="small" danger icon={<DeleteOutlined/>} loading={bulkDeleting} onClick={handleBulkDelete}>
                        Delete Selected
                      </Button>
                      <Button size="small" type="text" onClick={() => setSelectedRowKeys([])}>Clear</Button>
                    </div>
                  )}

                  {/* Table */}
                  <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
                    <Table
                      columns={columns}
                      dataSource={filtered}
                      loading={isLoading}
                      rowKey="id"
                      rowSelection={rowSelection}
                      expandable={{
                        expandedRowKeys,
                        onExpandedRowsChange: setExpandedRowKeys,
                        expandedRowRender,
                        rowExpandable: () => true,
                      }}
                      size="middle"
                      scroll={{ x: 1300 }}
                      rowClassName={r => {
                        const s = r.status || 'PENDING';
                        if (r.last_working_day && dayjs(r.last_working_day).isBefore(dayjs()) && s !== 'COMPLETED') return 'row-overdue';
                        return `row-${s.toLowerCase()}`;
                      }}
                      pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => (
                          <span>
                            {range[0]}–{range[1]} of <strong>{total}</strong>
                            {hasFilters && <span style={{ color:'#94a3b8', marginLeft:4 }}>(filtered from {allRecords.length})</span>}
                            {selectedRowKeys.length > 0 && <span style={{ color:'#2563eb', marginLeft:6 }}>· {selectedRowKeys.length} selected</span>}
                          </span>
                        ),
                        style: { padding:'12px 16px', margin:0 },
                      }}
                      footer={() => (
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'#94a3b8' }}>
                          <Space size={16}>
                            {Object.keys(STATUS_CFG).map(s => {
                              const c = filtered.filter(r => r.status === s).length;
                              return c > 0 ? (
                                <span key={s} style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                                  <span style={{ width:6, height:6, borderRadius:'50%', background:STATUS_CFG[s].color }}/>
                                  {STATUS_CFG[s].label}: <strong style={{ color:'#374151' }}>{c}</strong>
                                </span>
                              ) : null;
                            })}
                          </Space>
                          <Button size="small" type="text" icon={<DownloadOutlined/>} style={{ color:'#94a3b8' }}
                            onClick={() => exportCSV(exportCols, filtered, `resignations-${dayjs().format('YYYY-MM-DD')}.csv`)}>
                            Export all ({filtered.length})
                          </Button>
                        </div>
                      )}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'analytics',
              label: <span><BarChartOutlined/> Analytics</span>,
              children: <div style={{ paddingBottom:16 }}><AnalyticsTab records={allRecords}/></div>,
            },
          ]}
        />
      </div>

      {/* ── Process Resignation Drawer ───────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <div style={{ width:24, height:24, borderRadius:6, background:'linear-gradient(135deg,#dc2626,#b91c1c)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <ExclamationCircleOutlined style={{ color:'#fff', fontSize:12 }}/>
            </div>
            Process Employee Resignation
          </Space>
        }
        open={createOpen} onClose={() => { setCreateOpen(false); form.resetFields(); }} width={600}
        footer={
          <Space style={{ float:'right' }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" danger onClick={handleCreate} loading={createMut.isPending}>Confirm Resignation</Button>
          </Space>
        }
        destroyOnHidden
      >
        <Alert
          message="This action is significant"
          description="Processing a resignation updates the employee's status and removes them from active device access. Ensure all information is accurate."
          type="warning" showIcon style={{ marginBottom:16, borderRadius:8 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item name="personnel_id" label="Employee" rules={[{ required:true, message:'Required' }]}>
            <Select showSearch placeholder="Search by name or emp code" options={personnelOpts}
              filterOption={(i,o) => (o?.searchtext||'').toLowerCase().includes(i.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="resignation_type" label="Resignation Type" rules={[{ required:true }]}>
            <Select placeholder="Select type" options={RESIGNATION_TYPES.map(t => ({ value:t.value, label:<TypePill value={t.value}/> }))}/>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="resignation_date" label="Resignation Date" rules={[{ required:true }]} initialValue={dayjs()}>
                <DatePicker style={{ width:'100%' }} format="DD MMM YYYY"/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_working_day" label="Last Working Day" rules={[{ required:true }]} initialValue={dayjs().add(30,'day')}>
                <DatePicker style={{ width:'100%' }} format="DD MMM YYYY"/>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason" rules={[{ required:true },{ min:10 }]}>
            <Input placeholder="e.g. Personal reasons, Better opportunity…"/>
          </Form.Item>
          <Form.Item name="detailed_reason" label="Detailed Explanation (optional)">
            <Input.TextArea rows={3} placeholder="Additional details…"/>
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ─────────────────────────────────────────────────────── */}
      {detailRecord && (
        <Drawer
          title={
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Avatar size={36} style={{ background: avatarColor(getEmpName(detailRecord)), fontSize:11, fontWeight:700 }}>
                {initials(getEmpName(detailRecord))}
              </Avatar>
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{getEmpName(detailRecord)}</div>
                <div style={{ fontSize:11, color:'#94a3b8' }}>{lbl(detailRecord.resignation_type)} resignation</div>
              </div>
            </div>
          }
          open={!!detailRecord} onClose={() => setDetailRecord(null)} width={480}
          extra={
            <Popconfirm
              title="Delete resignation record?"
              description="This will not restore employee status."
              onConfirm={() => deleteMut.mutate(detailRecord.id)}
              okButtonProps={{ danger:true }}
            >
              <Button danger size="small" icon={<DeleteOutlined/>} style={{ borderRadius:7 }}>Delete</Button>
            </Popconfirm>
          }
          destroyOnHidden
        >
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
            <StatusPill status={detailRecord.status||'PENDING'}/>
            <TypePill value={detailRecord.resignation_type}/>
          </div>

          <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <Row gutter={12}>
              <Col span={12}>
                <Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:3 }}>Resignation Date</Text>
                <Text style={{ fontSize:13, fontWeight:700 }}>{detailRecord.resignation_date ? dayjs(detailRecord.resignation_date).format('DD MMM YYYY') : '—'}</Text>
              </Col>
              <Col span={12}>
                <Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:3 }}>Last Working Day</Text>
                <Text style={{ fontSize:13, fontWeight:700, color:'#dc2626' }}>{detailRecord.last_working_day ? dayjs(detailRecord.last_working_day).format('DD MMM YYYY') : '—'}</Text>
              </Col>
            </Row>
            {detailRecord.last_working_day && (
              <div style={{ marginTop:10 }}>
                <NoticePeriod resignDate={detailRecord.resignation_date} lastDay={detailRecord.last_working_day} status={detailRecord.status}/>
              </div>
            )}
          </div>

          {(detailRecord.department_name || detailRecord.employee?.department) && (
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
              <ApartmentOutlined style={{ color:'#94a3b8', fontSize:12 }}/>
              <Text style={{ fontSize:12 }}>{detailRecord.department_name||detailRecord.employee?.department}</Text>
            </div>
          )}
          {detailRecord.employee?.emp_code && (
            <div style={{ fontSize:11, color:'#94a3b8', marginBottom:12 }}>
              Emp Code: <span style={{ fontFamily:'monospace', color:'#374151' }}>{detailRecord.employee.emp_code}</span>
            </div>
          )}

          {detailRecord.reason && (
            <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:12, marginBottom:4 }}>{detailRecord.reason}</div>
              {detailRecord.detailed_reason && <div style={{ fontSize:12, color:'#64748b' }}>{detailRecord.detailed_reason}</div>}
            </div>
          )}

          <Divider style={{ margin:'4px 0 12px' }}/>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.05em' }}>Clearance Checklist</div>
            <span style={{ fontSize:11, color: clearanceDone(detailRecord) === CLEARANCE_ITEMS.length ? '#16a34a' : '#d97706', fontWeight:700 }}>
              {clearanceDone(detailRecord)}/{CLEARANCE_ITEMS.length} done
            </span>
          </div>
          {/* Overall clearance progress */}
          <div style={{ height:6, background:'#e5e7eb', borderRadius:3, overflow:'hidden', marginBottom:14 }}>
            <div style={{
              width:`${(clearanceDone(detailRecord)/CLEARANCE_ITEMS.length)*100}%`, height:'100%', borderRadius:3, transition:'width 0.4s',
              background: clearanceDone(detailRecord) === CLEARANCE_ITEMS.length ? '#16a34a' : '#d97706',
            }}/>
          </div>
          {CLEARANCE_ITEMS.map(c => <CheckDot key={c.key} done={!!detailRecord[c.key]} label={c.label}/>)}

          <div style={{ marginTop:16, fontSize:10, color:'#cbd5e1' }}>
            Recorded {detailRecord.created_at ? dayjs(detailRecord.created_at).format('DD MMM YYYY HH:mm') : '—'}
          </div>
        </Drawer>
      )}

      <style>{`
        .ant-table-thead > tr > th { background:#f8fafc !important; color:#64748b !important; font-size:11px !important; font-weight:700 !important; text-transform:uppercase !important; letter-spacing:0.05em !important; border-bottom:2px solid #e2e8f0 !important; }
        .ant-table-tbody > tr > td { border-bottom:1px solid #f1f5f9 !important; padding:10px 12px !important; }
        .ant-table-tbody > tr:last-child > td { border-bottom:none !important; }
        .ant-tabs-nav { margin-bottom:0 !important; }
        .row-pending   > td { background:rgba(217,119,6,0.04) !important; }
        .row-approved  > td { background:rgba(22,163,74,0.04) !important; }
        .row-rejected  > td { background:rgba(220,38,38,0.04) !important; }
        .row-completed > td { background:rgba(100,116,139,0.04) !important; }
        .row-overdue   > td { background:rgba(220,38,38,0.07) !important; border-left:3px solid #fca5a5 !important; }
        .row-pending:hover   > td { background:rgba(217,119,6,0.08)    !important; }
        .row-approved:hover  > td { background:rgba(22,163,74,0.08)    !important; }
        .row-rejected:hover  > td { background:rgba(220,38,38,0.08)    !important; }
        .row-completed:hover > td { background:rgba(100,116,139,0.08)  !important; }
        .row-overdue:hover   > td { background:rgba(220,38,38,0.12)    !important; }
        .ant-table-expanded-row > td { padding:0 !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default ResignationList;
