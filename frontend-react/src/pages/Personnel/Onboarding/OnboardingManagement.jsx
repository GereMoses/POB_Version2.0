import { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, DatePicker, Popconfirm,
  Drawer, Form, Row, Col, Divider, Tooltip, Alert, App, Avatar,
  Tabs, Progress, Typography, Dropdown, Modal, Card,
} from 'antd';
import {
  PlusOutlined, CheckOutlined, CloseOutlined, FileTextOutlined,
  UserOutlined, ReloadOutlined, SearchOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, ClockCircleOutlined, FilterOutlined,
  ApartmentOutlined, DownloadOutlined, BarChartOutlined, CloseCircleOutlined,
  MoreOutlined, CheckSquareOutlined, EyeOutlined, ExpandAltOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;

// ── Constants ──────────────────────────────────────────────────────────────────
const ONBOARDING_TYPES = [
  { value: 'NEW_HIRE',          label: 'New Hire',          color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { value: 'REHIRE',            label: 'Re-hire',           color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { value: 'INTERNAL_TRANSFER', label: 'Internal Transfer', color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' },
  { value: 'PROMOTION',         label: 'Promotion',         color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { value: 'CONTRACT_RENEWAL',  label: 'Contract Renewal',  color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
];

const STATUS_CFG = {
  NOT_STARTED:    { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', row: 'rgba(100,116,139,0.03)', label: 'Not Started'    },
  IN_PROGRESS:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', row: 'rgba(37,99,235,0.04)',   label: 'In Progress'    },
  PENDING_REVIEW: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', row: 'rgba(217,119,6,0.05)',   label: 'Pending Review' },
  APPROVED:       { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', row: 'rgba(22,163,74,0.04)',   label: 'Approved'       },
  REJECTED:       { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', row: 'rgba(220,38,38,0.04)',   label: 'Rejected'       },
  COMPLETED:      { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', row: 'rgba(5,150,105,0.04)',   label: 'Completed'      },
  CANCELLED:      { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', row: 'rgba(148,163,184,0.04)', label: 'Cancelled'      },
};

const AVATAR_PALETTE = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d','#9333ea','#0f766e'];
const avatarColor = name => AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = name => (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const lbl         = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const typeInfo    = v => ONBOARDING_TYPES.find(t => t.value === v) || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: lbl(v) };

const exportCSV = (cols, rows, fname) => {
  const h = cols.map(c => `"${c.title}"`).join(',');
  const b = rows.map(r => cols.map(c => `"${String(c.ev(r)).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h+'\n'+b],{type:'text/csv'})); a.download = fname; a.click(); URL.revokeObjectURL(a.href);
};

// ── Pills ──────────────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status] || { color:'#64748b', bg:'#f8fafc', border:'#e2e8f0', label: lbl(status) };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, borderRadius:999, padding:'2px 10px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.color, flexShrink:0 }}/>{cfg.label}
    </span>
  );
};

const TypePill = ({ value }) => {
  const t = typeInfo(value);
  return (
    <span style={{ display:'inline-block', background:t.bg, border:`1px solid ${t.border}`, color:t.color, borderRadius:999, padding:'2px 10px', fontSize:11, fontWeight:700 }}>
      {t.label}
    </span>
  );
};

const EmployeeCell = ({ name, empCode, dept, onClick }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }} onClick={onClick}>
    <Avatar size={32} style={{ background:avatarColor(name), fontSize:10, fontWeight:700, flexShrink:0 }}>{initials(name)}</Avatar>
    <div>
      <div style={{ fontWeight:600, fontSize:12, color:'#111827' }}>{name||'—'}</div>
      <div style={{ display:'flex', gap:4, marginTop:2, flexWrap:'wrap' }}>
        {empCode && <span style={{ fontFamily:'monospace', fontSize:9, color:'#94a3b8', background:'#f3f4f6', borderRadius:3, padding:'0 4px' }}>{empCode}</span>}
        {dept   && <span style={{ fontSize:9, color:'#94a3b8' }}>{dept}</span>}
      </div>
    </div>
  </div>
);

// ── Analytics Tab (charts only — no duplicate stat cards) ──────────────────────
const AnalyticsTab = ({ records }) => {
  const { typeDist, statusDist, monthlyTrend, deptDist } = useMemo(() => {
    const tC={}, sC={}, mC={}, dC={};
    records.forEach(r => {
      if (r.onboarding_type) tC[r.onboarding_type]=(tC[r.onboarding_type]||0)+1;
      if (r.status) sC[r.status]=(sC[r.status]||0)+1;
      const m = r.created_at ? dayjs(r.created_at).format('YYYY-MM') : null;
      if (m) mC[m]=(mC[m]||0)+1;
      const dept = r.department_name || r.employee?.department || null;
      if (dept) dC[dept]=(dC[dept]||0)+1;
    });
    const typeDist   = ONBOARDING_TYPES.filter(t=>tC[t.value]).map(t=>({ name:t.label, value:tC[t.value], fill:t.color }));
    const statusDist = Object.keys(STATUS_CFG).filter(s=>sC[s]).map(s=>({ name:STATUS_CFG[s].label, value:sC[s], fill:STATUS_CFG[s].color }));
    const now = dayjs();
    const monthlyTrend = Array.from({length:12},(_,i)=>{ const d=now.subtract(11-i,'month'); return { name:d.format('MMM'), count:mC[d.format('YYYY-MM')]||0 }; });
    const deptDist = Object.entries(dC).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,value])=>({ name, value }));
    return { typeDist, statusDist, monthlyTrend, deptDist };
  }, [records]);

  if (!records.length) return <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}><BarChartOutlined style={{ fontSize:40, color:'#cbd5e1' }}/><div style={{ marginTop:12 }}>No data yet</div></div>;
  const card = { background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:16 };
  const sTitle = t => <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>{t}</div>;
  const CustomPieLabel = ({ cx,cy,midAngle,innerRadius,outerRadius,percent }) => {
    if (percent<0.07) return null; const R=Math.PI/180, r=innerRadius+(outerRadius-innerRadius)*0.55;
    return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent*100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Row gutter={[16,16]}>
        <Col xs={24} md={10}>
          <div style={card}>
            {sTitle('Onboarding Type Distribution')}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <ResponsiveContainer width="55%" height={160}>
                <PieChart><Pie data={typeDist} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={68} labelLine={false} label={CustomPieLabel}>
                  {typeDist.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                </Pie><RTooltip contentStyle={{ borderRadius:8, fontSize:11 }}/></PieChart>
              </ResponsiveContainer>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                {typeDist.map((d,i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:7, height:7, borderRadius:'50%', background:d.fill, flexShrink:0 }}/><Text style={{ fontSize:10 }}>{d.name}</Text></div>
                    <Text style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{d.value}</Text>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Col>
        <Col xs={24} md={14}>
          <div style={card}>
            {sTitle('Status Breakdown')}
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={statusDist} margin={{ left:-20, right:8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false}/>
                <RTooltip contentStyle={{ borderRadius:8, fontSize:11 }}/>
                <Bar dataKey="value" radius={[4,4,0,0]}>{statusDist.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Col>
        <Col xs={24} md={14}>
          <div style={card}>
            {sTitle('Monthly Activity (12 months)')}
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={monthlyTrend} margin={{ left:-20, right:8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false}/>
                <RTooltip contentStyle={{ borderRadius:8, fontSize:11 }} formatter={v=>[v,'Onboardings']}/>
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} dot={{ fill:'#2563eb', r:3 }} activeDot={{ r:5 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Col>
        {deptDist.length > 0 && (
          <Col xs={24} md={10}>
            <div style={card}>
              {sTitle('By Department')}
              <ResponsiveContainer width="100%" height={150}>
                <BarChart layout="vertical" data={deptDist} margin={{ left:0, right:16, top:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false}/>
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize:9, fill:'#374151' }} tickLine={false} axisLine={false}/>
                  <RTooltip contentStyle={{ borderRadius:8, fontSize:11 }}/>
                  <Bar dataKey="value" radius={[0,4,4,0]} fill="#7c3aed"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}
      </Row>
    </div>
  );
};

// ── Tasks mini-table ───────────────────────────────────────────────────────────
const TASK_STATUS_CFG = {
  NOT_STARTED: { color:'#64748b', bg:'#f8fafc', label:'Not Started' },
  IN_PROGRESS: { color:'#2563eb', bg:'#eff6ff', label:'In Progress' },
  COMPLETED:   { color:'#059669', bg:'#ecfdf5', label:'Completed'   },
  CANCELLED:   { color:'#94a3b8', bg:'#f8fafc', label:'Cancelled'   },
};
const TaskStatusPill = ({ status }) => {
  const cfg = TASK_STATUS_CFG[status] || { color:'#94a3b8', bg:'#f8fafc', label: status||'Unknown' };
  return <span style={{ background:cfg.bg, color:cfg.color, borderRadius:999, padding:'1px 8px', fontSize:10, fontWeight:700, border:`1px solid ${cfg.color}22` }}>{cfg.label}</span>;
};

// ── Main Component ─────────────────────────────────────────────────────────────
const OnboardingManagement = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab,      setActiveTab]      = useState('onboarding');
  const [search,         setSearch]         = useState('');
  const [filterType,     setFilterType]     = useState(null);
  const [filterStatus,   setFilterStatus]   = useState(null);
  const [filterDept,     setFilterDept]     = useState('');
  const [selectedKeys,   setSelectedKeys]   = useState([]);
  const [expandedRowKeys,setExpandedRowKeys]= useState([]);
  const [detailRecord,   setDetailRecord]   = useState(null);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [rejectTarget,   setRejectTarget]   = useState(null);
  const [form]        = Form.useForm();
  const [rejectForm]  = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: allRecords = [], isLoading, refetch } = useQuery({
    queryKey: ['onboarding-records'],
    queryFn:  () => apiService.get('/api/v1/personnel/onboarding/?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['onboarding-tasks', detailRecord?.id],
    queryFn:  () => apiService.get(`/api/v1/personnel/onboarding/${detailRecord.id}/tasks`),
    enabled:  !!detailRecord?.id,
    staleTime: 15000,
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel-list-ob'],
    queryFn:  () => apiService.get('/api/v1/personnel/?limit=1000'),
    staleTime: 300000,
    select: d => Array.isArray(d) ? d : (d?.results || d?.data || []),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn:  () => apiService.get('/api/v1/departments/'),
    staleTime: 300000,
    select: d => Array.isArray(d) ? d : (d?.results || []),
  });

  const tasks = Array.isArray(tasksData) ? tasksData : (tasksData?.data || tasksData?.results || []);
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;

  // ── Derived ──────────────────────────────────────────────────────────────────
  const inv = useCallback(() => queryClient.invalidateQueries({ queryKey: ['onboarding-records'] }), [queryClient]);

  const getEmployeeName = r => r.employee?.full_name || `${r.employee?.first_name||''} ${r.employee?.last_name||''}`.trim() || `Personnel #${r.personnel_id}`;
  const isOverdue = r => r.planned_end_date && dayjs(r.planned_end_date).isBefore(dayjs()) && !['COMPLETED','CANCELLED','REJECTED'].includes(r.status);

  const deptOptions = useMemo(() => {
    const set = new Set(allRecords.map(r => r.department_name || r.employee?.department).filter(Boolean));
    return [...set].sort().map(d => ({ value: d, label: d }));
  }, [allRecords]);

  const filtered = useMemo(() => allRecords.filter(r => {
    if (filterType   && r.onboarding_type !== filterType)  return false;
    if (filterStatus && r.status          !== filterStatus) return false;
    const dept = r.department_name || r.employee?.department;
    if (filterDept && dept !== filterDept) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = getEmployeeName(r).toLowerCase();
      return name.includes(q) || (r.job_title||'').toLowerCase().includes(q)
          || (r.employee?.emp_code||'').toLowerCase().includes(q);
    }
    return true;
  }), [allRecords, filterType, filterStatus, filterDept, search]);

  const pendingReviewCount = allRecords.filter(r => r.status === 'PENDING_REVIEW').length;
  const overdueCount       = allRecords.filter(r => isOverdue(r)).length;
  const hasFilters         = search || filterType || filterStatus || filterDept;
  const clearFilters       = () => { setSearch(''); setFilterType(null); setFilterStatus(null); setFilterDept(''); };

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/onboarding/', d),
    onSuccess: () => { message.success('Onboarding started'); setCreateOpen(false); form.resetFields(); inv(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Failed to create'),
  });
  const completeMut = useMutation({
    mutationFn: id => apiService.post(`/api/v1/personnel/onboarding/${id}/complete`, {}),
    onSuccess: () => { message.success('Onboarding completed — employee is now ACTIVE'); setDetailRecord(null); inv(); queryClient.invalidateQueries({ queryKey: ['personnel'] }); },
    onError:   e => message.error(e?.response?.data?.detail || 'Failed to complete'),
  });
  const approveMut = useMutation({
    mutationFn: id => apiService.post(`/api/v1/personnel/onboarding/${id}/approve`, {}),
    onSuccess: () => { message.success('Approved'); inv(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Failed to approve'),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => apiService.post(`/api/v1/personnel/onboarding/${id}/reject?rejection_reason=${encodeURIComponent(reason)}`, {}),
    onSuccess: () => { message.success('Rejected'); setRejectTarget(null); rejectForm.resetFields(); inv(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Failed to reject'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleCreate = () => form.validateFields().then(v => {
    createMut.mutate({
      personnel_id:     v.personnel_id,
      onboarding_type:  v.onboarding_type,
      start_date:       v.start_date?.toISOString(),
      planned_end_date: v.planned_end_date?.toISOString(),
      job_title:        v.job_title,
      job_description:  v.job_description || null,
      department_id:    v.department_id || null,
      notes:            v.notes || null,
    });
  }).catch(() => {});

  const personnelOptions = useMemo(() => personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name||'')} ${(p.last_name||'')}`.trim() + (p.emp_code ? ` (${p.emp_code})` : ''),
  })), [personnel]);

  const exportCols = [
    { title:'Employee',    ev:r=>getEmployeeName(r) },
    { title:'Emp Code',    ev:r=>r.employee?.emp_code||'' },
    { title:'Department',  ev:r=>r.department_name||r.employee?.department||'' },
    { title:'Type',        ev:r=>r.onboarding_type||'' },
    { title:'Job Title',   ev:r=>r.job_title||'' },
    { title:'Status',      ev:r=>r.status||'' },
    { title:'Progress %',  ev:r=>String(r.completion_percentage??0) },
    { title:'Start Date',  ev:r=>r.start_date ? dayjs(r.start_date).format('YYYY-MM-DD') : '' },
    { title:'Planned End', ev:r=>r.planned_end_date ? dayjs(r.planned_end_date).format('YYYY-MM-DD') : '' },
    { title:'Overdue',     ev:r=>isOverdue(r) ? 'Yes' : 'No' },
  ];

  // ── Expandable rows ───────────────────────────────────────────────────────────
  const expandedRowRender = rec => (
    <div style={{ padding:'10px 16px 14px 56px', background:'#fafafa' }}>
      <Row gutter={[16, 8]}>
        {rec.job_description && (
          <Col xs={24} md={12}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>Job Description</div>
            <div style={{ fontSize:12, color:'#374151' }}>{rec.job_description}</div>
          </Col>
        )}
        {rec.notes && (
          <Col xs={24} md={12}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>Notes</div>
            <div style={{ fontSize:12, color:'#6b7280', fontStyle:'italic' }}>{rec.notes}</div>
          </Col>
        )}
        {rec.rejection_reason && (
          <Col xs={24}>
            <div style={{ fontSize:11, fontWeight:700, color:'#dc2626', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>Rejection Reason</div>
            <div style={{ fontSize:12, color:'#dc2626', background:'#fef2f2', padding:'6px 10px', borderRadius:6, border:'1px solid #fecaca' }}>{rec.rejection_reason}</div>
          </Col>
        )}
        <Col xs={24}>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:11, color:'#6b7280' }}>
            <span>Start: <strong style={{ color:'#374151' }}>{rec.start_date ? dayjs(rec.start_date).format('DD MMM YYYY') : '—'}</strong></span>
            <span>Planned End: <strong style={{ color: isOverdue(rec) ? '#dc2626' : '#374151' }}>{rec.planned_end_date ? dayjs(rec.planned_end_date).format('DD MMM YYYY') : '—'}{isOverdue(rec) ? ' ⚠ overdue' : ''}</strong></span>
            {rec.actual_end_date && <span>Actual End: <strong style={{ color:'#059669' }}>{dayjs(rec.actual_end_date).format('DD MMM YYYY')}</strong></span>}
          </div>
        </Col>
        {!rec.job_description && !rec.notes && !rec.rejection_reason && (
          <Col xs={24}><span style={{ fontSize:12, color:'#9ca3af' }}>No additional details</span></Col>
        )}
      </Row>
    </div>
  );

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title:'Employee', key:'employee', width:230,
      sorter:(a,b)=>getEmployeeName(a).localeCompare(getEmployeeName(b)),
      render:(_,r)=><EmployeeCell name={getEmployeeName(r)} empCode={r.employee?.emp_code} dept={r.department_name||r.employee?.department} onClick={()=>setDetailRecord(r)} />,
    },
    {
      title:'Type', key:'type', width:155,
      sorter:(a,b)=>(a.onboarding_type||'').localeCompare(b.onboarding_type||''),
      filters: ONBOARDING_TYPES.map(t => ({ text: t.label, value: t.value })),
      onFilter: (value, r) => r.onboarding_type === value,
      render:(_,r)=><TypePill value={r.onboarding_type} />,
    },
    {
      title:'Job Title', dataIndex:'job_title', width:160, ellipsis:true,
      sorter:(a,b)=>(a.job_title||'').localeCompare(b.job_title||''),
      render:v=><span style={{ fontSize:12 }}>{v||'—'}</span>,
    },
    {
      title:'Department', key:'dept', width:140, ellipsis:true,
      sorter:(a,b)=>(a.department_name||a.employee?.department||'').localeCompare(b.department_name||b.employee?.department||''),
      render:(_,r)=>{
        const d = r.department_name || r.employee?.department;
        return d ? <span style={{ fontSize:11, color:'#374151' }}>{d}</span> : <span style={{ color:'#d1d5db' }}>—</span>;
      },
    },
    {
      title:'Timeline', key:'timeline', width:160,
      sorter:(a,b)=>dayjs(a.start_date||0).diff(dayjs(b.start_date||0)),
      render:(_,r)=>{
        const overdue = isOverdue(r);
        return (
          <div style={{ fontSize:11 }}>
            <div style={{ color:'#374151', fontWeight:500 }}>{r.start_date ? dayjs(r.start_date).format('DD MMM YYYY') : '—'}</div>
            {r.planned_end_date && (
              <div style={{ color: overdue ? '#dc2626' : '#94a3b8', marginTop:2 }}>
                → {dayjs(r.planned_end_date).format('DD MMM YYYY')}
                {overdue && <span style={{ marginLeft:4, fontSize:10, fontWeight:700, color:'#dc2626' }}>OVERDUE</span>}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title:'Progress', key:'progress', width:140,
      sorter:(a,b)=>(a.completion_percentage||0)-(b.completion_percentage||0),
      render:(_,r)=>(
        <div>
          <Progress percent={r.completion_percentage||0} size="small" status={r.completion_percentage===100?'success':'active'} style={{ margin:0, lineHeight:1 }} />
          <div style={{ fontSize:9, color:'#94a3b8', marginTop:1 }}>{r.completion_percentage||0}% complete</div>
        </div>
      ),
    },
    {
      title:'Status', key:'status', width:145,
      sorter:(a,b)=>(a.status||'').localeCompare(b.status||''),
      filters: Object.entries(STATUS_CFG).map(([k,v]) => ({ text: v.label, value: k })),
      onFilter: (value, r) => r.status === value,
      render:(_,r)=><StatusPill status={r.status} />,
    },
    {
      title:'', key:'actions', fixed:'right', width:56,
      render:(_,r)=>(
        <Dropdown
          trigger={['click']}
          menu={{
            items:[
              {
                key:'view', label:'View Tasks', icon:<EyeOutlined/>,
                onClick:()=>setDetailRecord(r),
              },
              {
                key:'expand', icon:<ExpandAltOutlined/>,
                label: expandedRowKeys.includes(r.id) ? 'Collapse Row' : 'Expand Row',
                onClick:()=>setExpandedRowKeys(prev =>
                  prev.includes(r.id) ? prev.filter(k=>k!==r.id) : [...prev,r.id]
                ),
              },
              {
                key:'export', label:'Export Row', icon:<DownloadOutlined/>,
                onClick:()=>exportCSV(exportCols,[r],`onboarding-${r.employee?.emp_code||r.id}-${dayjs().format('YYYY-MM-DD')}.csv`),
              },
              ...(r.status === 'PENDING_REVIEW' ? [
                { type:'divider' },
                {
                  key:'approve', label:'Approve', icon:<CheckOutlined/>,
                  onClick:()=>approveMut.mutate(r.id),
                },
                {
                  key:'reject', label:'Reject', icon:<CloseOutlined/>, danger:true,
                  onClick:()=>setRejectTarget(r),
                },
              ] : []),
              ...(r.status === 'APPROVED' ? [
                { type:'divider' },
                {
                  key:'complete', label:'Mark Complete', icon:<CheckCircleOutlined/>,
                  onClick:()=>Modal.confirm({
                    title:'Complete onboarding?',
                    content:'Employee status will be set to ACTIVE.',
                    okText:'Complete', okButtonProps:{ style:{ background:'#059669' } },
                    onOk:()=>completeMut.mutateAsync(r.id),
                  }),
                },
              ] : []),
              ...(['IN_PROGRESS','PENDING_REVIEW'].includes(r.status) && r.status !== 'PENDING_REVIEW' ? [
                { type:'divider' },
                {
                  key:'reject2', label:'Reject', icon:<CloseOutlined/>, danger:true,
                  onClick:()=>setRejectTarget(r),
                },
              ] : []),
            ].filter(Boolean),
          }}
        >
          <Button size="small" type="text" icon={<MoreOutlined/>} style={{ borderRadius:6 }}/>
        </Dropdown>
      ),
    },
  ];

  const selectedRecords = filtered.filter(r => selectedKeys.includes(r.id));
  const selectedPending = selectedRecords.filter(r => r.status === 'PENDING_REVIEW');

  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', overflow:'visible' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Onboarding Management</div>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:400, marginTop:2 }}>
                Track employee onboarding processes and task completion
              </div>
            </div>
            <Space size="middle" style={{ overflow:'visible' }}>
              <Button icon={<ReloadOutlined/>} size="small" onClick={()=>refetch()} loading={isLoading}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined/>} size="small"
                onClick={()=>{ form.resetFields(); setCreateOpen(true); }}
                style={{ fontWeight:600, background:'#16a34a', borderColor:'#16a34a' }}>
                Start Onboarding
              </Button>
            </Space>
          </div>
        }
        styles={{ header: { overflow:'visible' } }}
      >

      {/* Stat cards */}
      <Row gutter={[12,12]} style={{ marginBottom:16 }}>
        {[
          { label:'Total',          value:allRecords.length,                                          color:'#2563eb', icon:<FileTextOutlined />       },
          { label:'In Progress',    value:allRecords.filter(r=>r.status==='IN_PROGRESS').length,      color:'#2563eb', icon:<ClockCircleOutlined />     },
          { label:'Pending Review', value:pendingReviewCount,                                          color:'#d97706', icon:<ExclamationCircleOutlined/> },
          { label:'Completed',      value:allRecords.filter(r=>r.status==='COMPLETED').length,        color:'#059669', icon:<CheckCircleOutlined />      },
        ].map(s=>(
          <Col xs={12} sm={6} key={s.label}>
            <div style={{ background:'#fff', borderRadius:12, padding:'14px 18px', border:'1px solid #f0f0f0', borderTop:`3px solid ${s.color}`, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:11, color:'#8c8c8c', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.5px' }}>{s.label}</div>
                  <div style={{ fontSize:26, fontWeight:700, color:s.color, lineHeight:1.2, marginTop:4 }}>{s.value}</div>
                </div>
                <div style={{ width:40, height:40, borderRadius:10, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, fontSize:18 }}>
                  {s.icon}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {pendingReviewCount > 0 && <Alert type="warning" showIcon closable style={{ marginBottom:10, borderRadius:8 }} message={`${pendingReviewCount} onboarding${pendingReviewCount>1?'s':''} waiting for approval`} action={<Button size="small" onClick={()=>setFilterStatus('PENDING_REVIEW')}>View</Button>} />}
      {overdueCount > 0       && <Alert type="error"   showIcon closable style={{ marginBottom:10, borderRadius:8 }} message={`${overdueCount} onboarding${overdueCount>1?'s':''} past their planned end date`} action={<Button size="small" danger onClick={()=>{ setFilterStatus(null); /* highlight */ }}>View All</Button>} />}

      {/* Tabs */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding:'0 16px' }}
          items={[
            {
              key:'onboarding',
              label:(
                <span>
                  <UserOutlined /> Onboardings
                  {pendingReviewCount > 0 && <span style={{ marginLeft:5, background:'#d97706', color:'#fff', borderRadius:10, padding:'0 6px', fontSize:10, fontWeight:700 }}>{pendingReviewCount}</span>}
                </span>
              ),
              children:(
                <div style={{ paddingBottom:16 }}>
                  {/* Filter bar */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                    <Input placeholder="Search name, emp code, job title…" prefix={<SearchOutlined style={{ color:'#94a3b8', fontSize:12 }}/>}
                      value={search} onChange={e=>setSearch(e.target.value)} allowClear style={{ flex:'1 1 200px', maxWidth:260, borderRadius:8 }} />
                    <FilterOutlined style={{ color:'#94a3b8', fontSize:12 }}/>
                    <Select placeholder="Type" allowClear style={{ flex:'1 1 140px', minWidth:140 }}
                      value={filterType} onChange={setFilterType} options={ONBOARDING_TYPES.map(t=>({ value:t.value, label:<TypePill value={t.value}/> }))} />
                    <Select placeholder="Status" allowClear style={{ flex:'1 1 145px', minWidth:145 }}
                      value={filterStatus} onChange={setFilterStatus} options={Object.keys(STATUS_CFG).map(s=>({ value:s, label:<StatusPill status={s}/> }))} />
                    <Select placeholder="Department" allowClear showSearch optionFilterProp="label" style={{ flex:'1 1 150px', minWidth:150 }}
                      value={filterDept||undefined} onChange={v=>setFilterDept(v||'')} options={deptOptions} />
                    <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                      <Tooltip title="Export visible rows to CSV">
                        <Button icon={<DownloadOutlined/>} onClick={()=>exportCSV(exportCols,filtered,`onboarding-${dayjs().format('YYYY-MM-DD')}.csv`)} style={{ borderRadius:8 }}/>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Active filter pills */}
                  {hasFilters && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                      <span style={{ fontSize:11, color:'#94a3b8' }}>Filters:</span>
                      {search && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe' }}>"{search}"<button type="button" onClick={()=>setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'#2563eb', fontSize:12 }}>×</button></span>}
                      {filterType && (() => { const t=typeInfo(filterType); return <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background:t.bg, color:t.color, border:`1px solid ${t.border}` }}>{t.label}<button type="button" onClick={()=>setFilterType(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'inherit', fontSize:12 }}>×</button></span>; })()}
                      {filterStatus && (() => { const s=STATUS_CFG[filterStatus]||{}; return <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.label}<button type="button" onClick={()=>setFilterStatus(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'inherit', fontSize:12 }}>×</button></span>; })()}
                      {filterDept && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:999, fontSize:11, background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0' }}><ApartmentOutlined style={{ fontSize:9 }}/>{filterDept}<button type="button" onClick={()=>setFilterDept('')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, color:'inherit', fontSize:12 }}>×</button></span>}
                      <button type="button" onClick={clearFilters} style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 6px', fontSize:11, color:'#94a3b8', textDecoration:'underline' }}>Clear all</button>
                    </div>
                  )}

                  {/* Bulk action bar */}
                  {selectedKeys.length > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 14px', marginBottom:10, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8 }}>
                      <CheckSquareOutlined style={{ color:'#2563eb', fontSize:15 }}/>
                      <span style={{ fontWeight:600, color:'#2563eb', fontSize:13 }}>{selectedKeys.length} record{selectedKeys.length!==1?'s':''} selected</span>
                      <div style={{ flex:1 }}/>
                      {selectedPending.length > 0 && (
                        <Button size="small" style={{ background:'#16a34a', borderColor:'#16a34a', color:'#fff' }} icon={<CheckOutlined/>}
                          loading={approveMut.isPending}
                          onClick={()=>Modal.confirm({
                            title:`Approve ${selectedPending.length} onboarding${selectedPending.length>1?'s':''}?`,
                            okText:'Approve All', okButtonProps:{ style:{ background:'#16a34a' } },
                            onOk:()=>Promise.all(selectedPending.map(r=>approveMut.mutateAsync(r.id))).then(()=>setSelectedKeys([])),
                          })}>
                          Approve {selectedPending.length > 1 ? `(${selectedPending.length})` : ''}
                        </Button>
                      )}
                      <Button size="small" icon={<DownloadOutlined/>}
                        onClick={()=>exportCSV(exportCols,selectedRecords,`onboarding-selected-${dayjs().format('YYYY-MM-DD')}.csv`)}>
                        Export CSV
                      </Button>
                      <Button size="small" type="text" onClick={()=>setSelectedKeys([])}>Clear</Button>
                    </div>
                  )}

                  <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
                    <Table
                      columns={columns} dataSource={filtered} loading={isLoading} rowKey="id"
                      rowSelection={{
                        selectedRowKeys: selectedKeys,
                        onChange: setSelectedKeys,
                        selections: [
                          Table.SELECTION_ALL,
                          Table.SELECTION_INVERT,
                          Table.SELECTION_NONE,
                          { key:'pending',   text:'Select Pending Review', onSelect:()=>setSelectedKeys(filtered.filter(r=>r.status==='PENDING_REVIEW').map(r=>r.id)) },
                          { key:'overdue',   text:'Select Overdue Only',   onSelect:()=>setSelectedKeys(filtered.filter(r=>isOverdue(r)).map(r=>r.id)) },
                          { key:'progress',  text:'Select In Progress',    onSelect:()=>setSelectedKeys(filtered.filter(r=>r.status==='IN_PROGRESS').map(r=>r.id)) },
                        ],
                      }}
                      expandable={{
                        expandedRowKeys,
                        onExpandedRowsChange: setExpandedRowKeys,
                        expandedRowRender,
                        rowExpandable: () => true,
                      }}
                      pagination={{
                        pageSize: 20, showSizeChanger:true, showQuickJumper:true,
                        showTotal:(total,range)=>(
                          <span>
                            {range[0]}–{range[1]} of <strong>{total}</strong>
                            {hasFilters && <span style={{ color:'#94a3b8', marginLeft:4 }}>(from {allRecords.length} total)</span>}
                            {selectedKeys.length>0 && <span style={{ color:'#2563eb', marginLeft:6 }}>· {selectedKeys.length} selected</span>}
                          </span>
                        ),
                        style:{ padding:'12px 16px', margin:0 },
                      }}
                      scroll={{ x:1150 }} size="middle"
                      rowClassName={r=>{
                        if (isOverdue(r)) return 'row-overdue';
                        const s = (r.status||'').toLowerCase().replace(/_/g,'-');
                        return `row-${s}`;
                      }}
                      footer={()=>(
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'#94a3b8' }}>
                          <Space size={16}>
                            {Object.entries(STATUS_CFG).map(([k,v])=>{
                              const c = filtered.filter(r=>r.status===k).length;
                              return c>0 ? <span key={k} style={{ display:'inline-flex', alignItems:'center', gap:4 }}><span style={{ width:6, height:6, borderRadius:'50%', background:v.color }}/>{v.label}: <strong style={{ color:'#374151' }}>{c}</strong></span> : null;
                            })}
                          </Space>
                          <Button size="small" type="text" icon={<DownloadOutlined/>} style={{ color:'#94a3b8' }}
                            onClick={()=>exportCSV(exportCols,filtered,`onboarding-${dayjs().format('YYYY-MM-DD')}.csv`)}>
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
              key:'analytics',
              label:<span><BarChartOutlined /> Analytics</span>,
              children:<div style={{ paddingBottom:16 }}><AnalyticsTab records={allRecords} /></div>,
            },
          ]}
        />
      </div>

      {/* ── Start Onboarding Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={<Space><div style={{ width:24, height:24, borderRadius:6, background:'linear-gradient(135deg,#16a34a,#15803d)', display:'flex', alignItems:'center', justifyContent:'center' }}><UserOutlined style={{ color:'#fff', fontSize:12 }}/></div>Start Employee Onboarding</Space>}
        open={createOpen} onClose={()=>{ setCreateOpen(false); form.resetFields(); }} width={680}
        footer={<Space style={{ float:'right' }}><Button onClick={()=>{ setCreateOpen(false); form.resetFields(); }}>Cancel</Button><Button type="primary" onClick={handleCreate} loading={createMut.isPending} style={{ background:'#16a34a', borderColor:'#16a34a' }}>Start Onboarding</Button></Space>}
        destroyOnHidden
      >
        <Alert message="Creating an onboarding record will set the employee status to pending and initiate the intake checklist." type="info" showIcon style={{ marginBottom:16, borderRadius:8 }}/>
        <Form form={form} layout="vertical">
          <Form.Item name="personnel_id" label="Employee" rules={[{ required:true }]}>
            <Select showSearch placeholder="Search by name or emp code" options={personnelOptions} filterOption={(i,o)=>(o?.label??'').toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="onboarding_type" label="Onboarding Type" rules={[{ required:true }]}>
              <Select placeholder="Select type" options={ONBOARDING_TYPES.map(t=>({ value:t.value, label:<TypePill value={t.value}/> }))} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="department_id" label="Department">
              <Select showSearch placeholder="Optional" allowClear options={departments.map(d=>({ value:d.id, label:d.name }))} optionFilterProp="label" />
            </Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="start_date" label="Start Date" rules={[{ required:true }]} initialValue={dayjs()}>
              <DatePicker style={{ width:'100%' }} format="DD MMM YYYY" />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="planned_end_date" label="Planned End Date" rules={[{ required:true }]} initialValue={dayjs().add(30,'day')}>
              <DatePicker style={{ width:'100%' }} format="DD MMM YYYY" />
            </Form.Item></Col>
          </Row>
          <Form.Item name="job_title" label="Job Title" rules={[{ required:true }]}>
            <Input placeholder="e.g. Offshore Drilling Engineer" />
          </Form.Item>
          <Form.Item name="job_description" label="Job Description" rules={[{ min:10, message:'Min 10 characters' }]}>
            <Input.TextArea rows={3} placeholder="Brief description of duties and responsibilities…" />
          </Form.Item>
          <Form.Item name="notes" label="Additional Notes">
            <Input.TextArea rows={2} placeholder="Any additional remarks…" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Detail / Tasks Drawer ─────────────────────────────────────────────── */}
      {detailRecord && (
        <Drawer
          title={
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Avatar size={34} style={{ background:avatarColor(getEmployeeName(detailRecord)), fontSize:11, fontWeight:700 }}>{initials(getEmployeeName(detailRecord))}</Avatar>
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{getEmployeeName(detailRecord)}</div>
                <div style={{ fontSize:11, color:'#94a3b8' }}>{detailRecord.job_title} — {lbl(detailRecord.onboarding_type)}</div>
              </div>
            </div>
          }
          open={!!detailRecord} onClose={()=>setDetailRecord(null)} width={520}
          extra={
            <Space>
              {detailRecord.status==='PENDING_REVIEW' && <Button type="primary" size="small" icon={<CheckOutlined/>} loading={approveMut.isPending} onClick={()=>approveMut.mutate(detailRecord.id)} style={{ borderRadius:7, background:'#16a34a', borderColor:'#16a34a' }}>Approve</Button>}
              {detailRecord.status==='APPROVED' && <Popconfirm title="Complete onboarding? Employee becomes ACTIVE." onConfirm={()=>completeMut.mutate(detailRecord.id)}><Button type="primary" size="small" icon={<CheckCircleOutlined/>} loading={completeMut.isPending} style={{ borderRadius:7, background:'#059669', borderColor:'#059669' }}>Complete</Button></Popconfirm>}
              {['IN_PROGRESS','PENDING_REVIEW'].includes(detailRecord.status) && <Button size="small" danger icon={<CloseCircleOutlined/>} style={{ borderRadius:7 }} onClick={()=>{ setDetailRecord(null); setRejectTarget(detailRecord); }}>Reject</Button>}
            </Space>
          }
          destroyOnHidden
        >
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
            <StatusPill status={detailRecord.status}/>
            <TypePill value={detailRecord.onboarding_type}/>
            {isOverdue(detailRecord) && <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:999, fontSize:11, fontWeight:700, color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca' }}>⚠ Overdue</span>}
          </div>

          <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
            <Row gutter={12}>
              <Col span={12}><Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:3 }}>Start Date</Text><Text style={{ fontSize:12, fontWeight:600 }}>{detailRecord.start_date ? dayjs(detailRecord.start_date).format('DD MMM YYYY') : '—'}</Text></Col>
              <Col span={12}><Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:3 }}>Planned End</Text><Text style={{ fontSize:12, fontWeight:600, color: isOverdue(detailRecord)?'#dc2626':undefined }}>{detailRecord.planned_end_date ? dayjs(detailRecord.planned_end_date).format('DD MMM YYYY') : '—'}</Text></Col>
            </Row>
            <div style={{ marginTop:10 }}>
              <Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:5 }}>Task Progress</Text>
              <Progress percent={detailRecord.completion_percentage||0} status={detailRecord.completion_percentage===100?'success':'active'}/>
              <Text style={{ fontSize:11, color:'#94a3b8' }}>{completedTasks} / {tasks.length} tasks completed</Text>
            </div>
          </div>

          {detailRecord.department_name && <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}><ApartmentOutlined style={{ color:'#94a3b8', fontSize:12 }}/><Text style={{ fontSize:12 }}>{detailRecord.department_name}</Text></div>}
          {detailRecord.employee?.emp_code && <div style={{ fontSize:12, color:'#374151', marginBottom:8 }}>Emp Code: <span style={{ fontFamily:'monospace', fontWeight:700 }}>{detailRecord.employee.emp_code}</span></div>}
          {detailRecord.job_description && <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#374151', marginBottom:12 }}>{detailRecord.job_description}</div>}
          {detailRecord.rejection_reason && <Alert type="error" showIcon style={{ marginBottom:12, borderRadius:8 }} message="Rejection Reason" description={detailRecord.rejection_reason}/>}

          <Divider style={{ margin:'14px 0 10px' }}/>
          <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Tasks ({tasks.length})</div>
          <Table
            size="small" rowKey="id" dataSource={tasks} loading={tasksLoading} pagination={false}
            locale={{ emptyText:'No tasks assigned yet' }}
            columns={[
              { title:'Task', dataIndex:'task_name', render:(name,r)=><div><div style={{ fontWeight:600, fontSize:12 }}>{name}</div>{r.task_type&&<span style={{ fontSize:9, color:'#94a3b8' }}>{lbl(r.task_type)}</span>}</div> },
              { title:'Due', dataIndex:'due_date', width:90, render:d=>d?dayjs(d).format('DD MMM'):'-' },
              { title:'Status', dataIndex:'status', width:110, render:v=><TaskStatusPill status={v}/> },
              { title:'Req', dataIndex:'is_required', width:50, render:r=>r?<span style={{ fontSize:10, color:'#dc2626', fontWeight:700 }}>●</span>:<span style={{ color:'#d1d5db', fontSize:10 }}>○</span> },
            ]}
          />
          {detailRecord.notes && <><Divider style={{ margin:'14px 0 8px' }}/><div style={{ fontSize:12, color:'#374151' }}>{detailRecord.notes}</div></>}
          <div style={{ marginTop:10, fontSize:10, color:'#cbd5e1' }}>Created {detailRecord.created_at ? dayjs(detailRecord.created_at).format('DD MMM YYYY HH:mm') : '—'}</div>
        </Drawer>
      )}

      {/* ── Reject Drawer ─────────────────────────────────────────────────────── */}
      {rejectTarget && (
        <Drawer
          title={<Space><CloseCircleOutlined style={{ color:'#dc2626' }}/><span>Reject Onboarding — {getEmployeeName(rejectTarget)}</span></Space>}
          open={!!rejectTarget} onClose={()=>{ setRejectTarget(null); rejectForm.resetFields(); }} width={440}
          footer={<Space style={{ float:'right' }}><Button onClick={()=>{ setRejectTarget(null); rejectForm.resetFields(); }}>Cancel</Button><Button danger loading={rejectMut.isPending} onClick={()=>rejectForm.validateFields().then(v=>rejectMut.mutate({ id:rejectTarget.id, reason:v.rejection_reason })).catch(()=>{})}>Confirm Rejection</Button></Space>}
          destroyOnHidden
        >
          <Form form={rejectForm} layout="vertical">
            <Form.Item name="rejection_reason" label="Reason for Rejection" rules={[{ required:true, message:'Required' },{min:10}]}>
              <Input.TextArea rows={4} placeholder="Explain why this onboarding is being rejected…"/>
            </Form.Item>
          </Form>
        </Drawer>
      )}

      <style>{`
        .ant-table-thead > tr > th { background:#f8fafc !important; color:#64748b !important; font-size:11px !important; font-weight:700 !important; text-transform:uppercase !important; letter-spacing:0.05em !important; border-bottom:2px solid #e2e8f0 !important; }
        .ant-table-tbody > tr > td  { border-bottom:1px solid #f1f5f9 !important; padding:10px 12px !important; }
        .ant-table-tbody > tr:last-child > td { border-bottom:none !important; }
        .ant-tabs-nav { margin-bottom:0 !important; }
        .row-not-started > td    { background:rgba(100,116,139,0.03) !important; }
        .row-in-progress > td    { background:rgba(37,99,235,0.04) !important; }
        .row-pending-review > td { background:rgba(217,119,6,0.05) !important; }
        .row-pending-review > td:first-child { border-left:3px solid #fde68a !important; }
        .row-approved > td       { background:rgba(22,163,74,0.04) !important; }
        .row-rejected > td       { background:rgba(220,38,38,0.04) !important; }
        .row-completed > td      { background:rgba(5,150,105,0.04) !important; }
        .row-cancelled > td      { background:rgba(148,163,184,0.04) !important; opacity:0.7; }
        .row-overdue > td        { background:rgba(220,38,38,0.06) !important; }
        .row-overdue > td:first-child { border-left:3px solid #fca5a5 !important; }
        .ant-table-expanded-row > td { padding:0 !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default OnboardingManagement;
