import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Modal, Form, Row, Col, Tag,
  Popconfirm, DatePicker, Select, InputNumber, Tabs, Tooltip,
  Alert, App, Avatar, Drawer, Divider, Typography, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined,
  ArrowRightOutlined, RiseOutlined, FallOutlined, SwapOutlined,
  TrophyOutlined, TeamOutlined, EnvironmentOutlined, SearchOutlined,
  FilterOutlined, ApartmentOutlined, DownloadOutlined, BarChartOutlined,
  CloseOutlined, MoreOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Text } = Typography;

// ── Constants ──────────────────────────────────────────────────────────────────
const TRANSFER_TYPES = ['promotion', 'department', 'location', 'position', 'role', 'lateral'];
const STATUSES       = ['pending', 'approved', 'rejected', 'completed', 'cancelled'];

const TYPE_CFG = {
  promotion:  { color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0', icon:<TrophyOutlined />    },
  department: { color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe', icon:<TeamOutlined />       },
  location:   { color:'#d97706', bg:'#fffbeb', border:'#fde68a', icon:<EnvironmentOutlined />},
  position:   { color:'#7c3aed', bg:'#ede9fe', border:'#ddd6fe', icon:<SwapOutlined />       },
  role:       { color:'#db2777', bg:'#fdf2f8', border:'#fbcfe8', icon:<SwapOutlined />       },
  lateral:    { color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc', icon:<SwapOutlined />       },
};
const STATUS_CFG = {
  pending:   { color:'#d97706', bg:'#fffbeb', border:'#fde68a', label:'Pending'   },
  approved:  { color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe', label:'Approved'  },
  rejected:  { color:'#dc2626', bg:'#fef2f2', border:'#fecaca', label:'Rejected'  },
  completed: { color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0', label:'Completed' },
  cancelled: { color:'#64748b', bg:'#f8fafc', border:'#e2e8f0', label:'Cancelled' },
};

const AVATAR_PALETTE = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d','#9333ea','#0f766e'];
const avatarColor = name => AVATAR_PALETTE[(name||'').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = name => (name||'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
const lbl         = s => (s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

const exportCSV = (cols, rows, fname) => {
  const h = cols.map(c=>`"${c.title}"`).join(',');
  const b = rows.map(r=>cols.map(c=>`"${String(c.ev(r)).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h+'\n'+b],{type:'text/csv'})); a.download = fname; a.click(); URL.revokeObjectURL(a.href);
};

// ── Pills ──────────────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status] || { color:'#64748b', bg:'#f8fafc', border:'#e2e8f0', label:lbl(status) };
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
    <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.color, flexShrink:0 }}/>{cfg.label}
  </span>;
};
const TypePill = ({ type }) => {
  if (!type) return null;
  const cfg = TYPE_CFG[type] || { color:'#64748b', bg:'#f3f4f6', border:'#e5e7eb', icon:null };
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:700 }}>
    {cfg.icon}{lbl(type)}
  </span>;
};
const EmployeeCell = ({ name, empCode, type, dept, onClick }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, cursor:onClick?'pointer':'default' }} onClick={onClick}>
    <Avatar size={30} style={{ background:avatarColor(name), fontSize:10, fontWeight:700, flexShrink:0 }}>{initials(name)}</Avatar>
    <div>
      <div style={{ fontWeight:600, fontSize:12, color:'#111827' }}>{name||'—'}</div>
      <div style={{ display:'flex', gap:4, alignItems:'center', marginTop:2, flexWrap:'wrap' }}>
        {empCode && <span style={{ fontFamily:'monospace', fontSize:9, color:'#94a3b8', background:'#f3f4f6', borderRadius:3, padding:'0 4px' }}>{empCode}</span>}
        {dept   && <span style={{ fontSize:9, color:'#94a3b8' }}>{dept}</span>}
      </div>
    </div>
  </div>
);

const SalaryChange = ({ v }) => {
  if (v == null || v === '') return <span style={{ color:'#d1d5db' }}>—</span>;
  const n = parseFloat(v);
  if (n === 0) return <span style={{ color:'#94a3b8', fontSize:12 }}>±0</span>;
  return n > 0
    ? <span style={{ color:'#16a34a', fontWeight:700, fontSize:12 }}><RiseOutlined /> +{n.toLocaleString()}</span>
    : <span style={{ color:'#dc2626', fontWeight:700, fontSize:12 }}><FallOutlined /> {n.toLocaleString()}</span>;
};

const FromToRow = ({ label, from, to }) => {
  if (!from && !to) return null;
  return (
    <div style={{ fontSize:11, marginBottom:3, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
      <span style={{ color:'#94a3b8', fontSize:10, minWidth:26 }}>{label}</span>
      <span style={{ fontWeight:500 }}>{from||'—'}</span>
      <ArrowRightOutlined style={{ color:'#94a3b8', fontSize:9 }}/>
      <span style={{ fontWeight:700, color:'#111827' }}>{to||'—'}</span>
    </div>
  );
};

// ── Analytics ──────────────────────────────────────────────────────────────────
const AnalyticsTab = ({ transfers, summary }) => {
  const { typeDist, statusDist, monthlyTrend } = useMemo(() => {
    const tC={}, sC={}, mC={};
    transfers.forEach(t => {
      if (t.transfer_type) tC[t.transfer_type]=(tC[t.transfer_type]||0)+1;
      if (t.status)        sC[t.status]=(sC[t.status]||0)+1;
      const m = t.created_at ? dayjs(t.created_at).format('YYYY-MM') : null;
      if (m) mC[m]=(mC[m]||0)+1;
    });
    const typeDist   = TRANSFER_TYPES.filter(t=>tC[t]).map(t=>({ name:lbl(t), value:tC[t], fill:TYPE_CFG[t]?.color||'#94a3b8' }));
    const statusDist = STATUSES.filter(s=>sC[s]).map(s=>({ name:STATUS_CFG[s].label, value:sC[s], fill:STATUS_CFG[s].color }));
    const now = dayjs();
    const monthlyTrend = Array.from({length:12},(_,i)=>{ const d=now.subtract(11-i,'month'); return { name:d.format('MMM'), count:mC[d.format('YYYY-MM')]||0 }; });
    return { typeDist, statusDist, monthlyTrend };
  }, [transfers]);

  if (!transfers.length) return <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}><BarChartOutlined style={{ fontSize:40, color:'#cbd5e1' }}/><div style={{ marginTop:12 }}>No data yet</div></div>;

  const card = { background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:16 };
  const sTitle = t => <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>{t}</div>;
  const CustomPieLabel = ({ cx,cy,midAngle,innerRadius,outerRadius,percent }) => {
    if (percent<0.07) return null; const R=Math.PI/180, r=innerRadius+(outerRadius-innerRadius)*0.55;
    return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent*100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Row gutter={[12,12]}>
        {[
          { label:'Total',      value:summary.total||transfers.length,   color:'#2563eb', bg:'#eff6ff' },
          { label:'Pending',    value:summary.pending||0,                color:'#d97706', bg:'#fffbeb', alert:true },
          { label:'Completed',  value:summary.completed||0,              color:'#16a34a', bg:'#f0fdf4' },
          { label:'Net Salary', value:`${(summary.total_salary_delta||0)>=0?'+':''}${(summary.total_salary_delta||0).toLocaleString()}`, color:(summary.total_salary_delta||0)>=0?'#16a34a':'#dc2626', bg:'#f8fafc' },
        ].map(k=>(
          <Col xs={12} sm={6} key={k.label}>
            <div style={{ ...card, padding:'12px 14px' }}>
              <div style={{ fontSize:22, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
              <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>{k.label}</div>
            </div>
          </Col>
        ))}
      </Row>
      <Row gutter={[16,16]}>
        <Col xs={24} md={10}>
          <div style={card}>
            {sTitle('Transfer Type Distribution')}
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
                    <Text style={{ fontSize:12, fontWeight:700 }}>{d.value}</Text>
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
        <Col xs={24}>
          <div style={card}>
            {sTitle('Monthly Activity (12 months)')}
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={monthlyTrend} margin={{ left:-20, right:8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false}/>
                <YAxis allowDecimals={false} tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false}/>
                <RTooltip contentStyle={{ borderRadius:8, fontSize:11 }} formatter={v=>[v,'Records']}/>
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} dot={{ fill:'#2563eb', r:3 }} activeDot={{ r:5 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Col>
      </Row>
    </div>
  );
};

// ── Detail Drawer ──────────────────────────────────────────────────────────────
const DetailDrawer = ({ record, onClose, onApprove, onReject, onComplete, onCancel, onEdit, actionPending }) => {
  if (!record) return null;
  const { status } = record;
  return (
    <Drawer
      title={
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Avatar size={34} style={{ background:avatarColor(record.personnel_name), fontSize:11, fontWeight:700 }}>{initials(record.personnel_name)}</Avatar>
          <div>
            <div style={{ fontWeight:700, fontSize:13 }}>{record.personnel_name||`Personnel #${record.personnel_id}`}</div>
            <div style={{ fontSize:11, color:'#94a3b8' }}>{lbl(record.transfer_type)} — {record.effective_date ? dayjs(record.effective_date).format('DD MMM YYYY') : 'No date'}</div>
          </div>
        </div>
      }
      open={!!record} onClose={onClose} width={420} bodyStyle={{ padding:20 }}
    >
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        <StatusPill status={record.status}/>
        <TypePill type={record.transfer_type}/>
      </div>

      <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
        <FromToRow label="Dept" from={record.from_department_name} to={record.to_department_name}/>
        <FromToRow label="Pos"  from={record.from_position_name}   to={record.to_position_name}/>
        <FromToRow label="Site" from={record.from_location}         to={record.to_location}/>
        {(record.salary_change != null && record.salary_change !== '') && (
          <div style={{ marginTop:8 }}>
            <Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:3 }}>Salary Change</Text>
            <SalaryChange v={record.salary_change}/>
          </div>
        )}
      </div>
      {record.reason && <div style={{ background:'#f8fafc', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#374151', marginBottom:12 }}>{record.reason}</div>}
      {record.rejection_reason && <div style={{ background:'#fef2f2', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#991b1b', marginBottom:12 }}>Rejection: {record.rejection_reason}</div>}
      {record.personnel_emp_code && <div style={{ fontSize:11, color:'#94a3b8', marginBottom:6 }}>Emp Code: <span style={{ fontFamily:'monospace', color:'#374151' }}>{record.personnel_emp_code}</span></div>}

      <Divider style={{ margin:'14px 0 10px' }}/>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {status==='pending' && <>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={actionPending} onClick={()=>onApprove(record.id)} style={{ borderRadius:7, background:'#16a34a', borderColor:'#16a34a' }}>Approve</Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} loading={actionPending} onClick={()=>onReject(record.id)} style={{ borderRadius:7 }}>Reject</Button>
          <Button size="small" icon={<StopOutlined />} loading={actionPending} onClick={()=>onCancel(record.id)} style={{ borderRadius:7 }}>Cancel</Button>
        </>}
        {status==='approved' && <>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={actionPending} onClick={()=>onComplete(record.id)} style={{ borderRadius:7, background:'#059669', borderColor:'#059669' }}>Complete</Button>
          <Button size="small" icon={<StopOutlined />} loading={actionPending} onClick={()=>onCancel(record.id)} style={{ borderRadius:7 }}>Cancel</Button>
        </>}
        {['rejected','cancelled'].includes(status) && <Button size="small" icon={<ReloadOutlined />} loading={actionPending} onClick={()=>onApprove(record.id)} style={{ borderRadius:7 }}>Resubmit</Button>}
        {status!=='completed' && <Button size="small" icon={<EditOutlined />} onClick={()=>{ onClose(); onEdit(record); }} style={{ borderRadius:7 }}>Edit</Button>}
      </div>
    </Drawer>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const PromotionTransfer = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab,    setActiveTab]    = useState('records');
  const [filterType,   setFilterType]   = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterDept,   setFilterDept]   = useState('');
  const [searchText,   setSearchText]   = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [detailRecord, setDetailRecord] = useState(null);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingRec,   setEditingRec]   = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form] = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: transfers = [], isLoading, refetch } = useQuery({
    queryKey: ['promotion-transfers'],
    queryFn:  () => apiService.get('/api/v1/personnel/promotion-transfers?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });
  const { data: summary = {} } = useQuery({
    queryKey: ['promotion-transfers-summary'],
    queryFn:  () => apiService.get('/api/v1/personnel/promotion-transfers/meta/summary'),
    staleTime: 30000,
  });
  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel-list-pt'],
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
  const { data: positions = [] } = useQuery({
    queryKey: ['positions-list'],
    queryFn:  () => apiService.get('/api/v1/positions/'),
    staleTime: 300000,
    select: d => Array.isArray(d) ? d : (d?.data || []),
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const inv = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['promotion-transfers'] });
    queryClient.invalidateQueries({ queryKey: ['promotion-transfers-summary'] });
  }, [queryClient]);

  const deptFilter = useMemo(() => {
    const set = new Set(transfers.flatMap(t => [t.from_department_name, t.to_department_name]).filter(Boolean));
    return [...set].sort().map(d => ({ value:d, label:d }));
  }, [transfers]);

  const filtered = useMemo(() => transfers.filter(t => {
    if (filterType   && t.transfer_type !== filterType)  return false;
    if (filterStatus && t.status        !== filterStatus) return false;
    if (filterDept   && t.from_department_name !== filterDept && t.to_department_name !== filterDept) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (t.personnel_name||'').toLowerCase().includes(q) || (t.personnel_emp_code||'').toLowerCase().includes(q)
          || (t.reason||'').toLowerCase().includes(q);
    }
    return true;
  }), [transfers, filterType, filterStatus, filterDept, searchText]);

  const pendingCount = summary?.pending || 0;
  const hasFilters   = searchText || filterType || filterStatus || filterDept;

  const personnelOpts = useMemo(() => personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name||'')} ${(p.last_name||'')}`.trim() + (p.emp_code ? ` (${p.emp_code})` : ''),
  })), [personnel]);
  const deptOpts     = useMemo(() => departments.map(d => ({ value:d.id, label:d.name })), [departments]);
  const posOpts      = useMemo(() => positions.map(p => ({ value:p.id, label:p.position_name })), [positions]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/promotion-transfers', d),
    onSuccess: () => { message.success('Record created'); closeModal(); inv(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Create failed'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }) => apiService.put(`/api/v1/personnel/promotion-transfers/${id}`, d),
    onSuccess: () => { message.success('Updated'); closeModal(); inv(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Update failed'),
  });
  const deleteMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/promotion-transfers/${id}`),
    onSuccess: () => { message.success('Deleted'); inv(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action, rejectionReason }) => {
      const url = `/api/v1/personnel/promotion-transfers/${id}/${action}${rejectionReason ? `?rejection_reason=${encodeURIComponent(rejectionReason)}` : ''}`;
      return apiService.put(url);
    },
    onSuccess: (_, { action }) => { message.success(`${lbl(action)}d`); setDetailRecord(null); inv(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Action failed'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditingRec(null); setTimeout(()=>form.resetFields(),0); setModalOpen(true); };
  const openEdit = r => { setEditingRec(r); setTimeout(()=>form.setFieldsValue({ ...r, effective_date: r.effective_date?dayjs(r.effective_date):null }),0); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingRec(null); form.resetFields(); };
  const handleSave = () => form.validateFields().then(v => {
    const payload = { ...v, effective_date: v.effective_date?.format('YYYY-MM-DD')||null, salary_change: v.salary_change??null };
    if (editingRec) updateMut.mutate({ id:editingRec.id, d:payload });
    else createMut.mutate(payload);
  }).catch(()=>{});

  const exportCols = [
    { title:'Personnel',   ev:r=>r.personnel_name||'' },
    { title:'Emp Code',    ev:r=>r.personnel_emp_code||'' },
    { title:'Type',        ev:r=>r.transfer_type||'' },
    { title:'From Dept',   ev:r=>r.from_department_name||'' },
    { title:'To Dept',     ev:r=>r.to_department_name||'' },
    { title:'From Pos',    ev:r=>r.from_position_name||'' },
    { title:'To Pos',      ev:r=>r.to_position_name||'' },
    { title:'From Site',   ev:r=>r.from_location||'' },
    { title:'To Site',     ev:r=>r.to_location||'' },
    { title:'Salary Δ',    ev:r=>r.salary_change??'' },
    { title:'Effective',   ev:r=>r.effective_date||'' },
    { title:'Status',      ev:r=>r.status||'' },
  ];

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title:'Personnel', key:'personnel', width:220,
      sorter:(a,b)=>(a.personnel_name||'').localeCompare(b.personnel_name||''),
      render:(_,r)=><EmployeeCell name={r.personnel_name||`ID ${r.personnel_id}`} empCode={r.personnel_emp_code} type={r.personnel_type} onClick={()=>setDetailRecord(r)} />,
    },
    { title:'Type', key:'type', width:130, render:(_,r)=><TypePill type={r.transfer_type}/> },
    {
      title:'Movement', key:'movement', width:220,
      render:(_,r)=>(
        <div style={{ fontSize:11 }}>
          {(r.from_department_name||r.to_department_name) && <FromToRow label="Dept" from={r.from_department_name} to={r.to_department_name}/>}
          {(r.from_position_name||r.to_position_name)   && <FromToRow label="Pos"  from={r.from_position_name}   to={r.to_position_name}/>}
          {(r.from_location||r.to_location)             && <FromToRow label="Site" from={r.from_location}         to={r.to_location}/>}
        </div>
      ),
    },
    { title:'Salary Δ', key:'salary', width:110, render:(_,r)=><SalaryChange v={r.salary_change}/> },
    { title:'Effective', dataIndex:'effective_date', width:110, render:d=>d?dayjs(d).format('DD MMM YYYY'):'—' },
    { title:'Status', key:'status', width:130, render:(_,r)=><StatusPill status={r.status}/> },
    {
      title:'', key:'actions', fixed:'right', width:220,
      render:(_,r)=>(
        <Space size={3}>
          {r.status==='pending' && <>
            <Tooltip title="Approve"><Button size="small" type="primary" icon={<CheckCircleOutlined/>} loading={actionMut.isPending} onClick={()=>actionMut.mutate({id:r.id,action:'approve'})} style={{ borderRadius:6, background:'#16a34a', borderColor:'#16a34a' }}/></Tooltip>
            <Tooltip title="Reject"><Button size="small" danger icon={<CloseCircleOutlined/>} style={{ borderRadius:6 }} onClick={()=>setRejectTarget(r.id)}/></Tooltip>
            <Tooltip title="Cancel"><Button size="small" icon={<StopOutlined/>} style={{ borderRadius:6 }} onClick={()=>actionMut.mutate({id:r.id,action:'cancel'})}/></Tooltip>
          </>}
          {r.status==='approved' && <>
            <Tooltip title="Complete"><Button size="small" type="primary" icon={<CheckCircleOutlined/>} loading={actionMut.isPending} onClick={()=>actionMut.mutate({id:r.id,action:'complete'})} style={{ borderRadius:6, background:'#059669', borderColor:'#059669' }}/></Tooltip>
            <Tooltip title="Cancel"><Button size="small" icon={<StopOutlined/>} style={{ borderRadius:6 }} onClick={()=>actionMut.mutate({id:r.id,action:'cancel'})}/></Tooltip>
          </>}
          {['rejected','cancelled'].includes(r.status) && <Tooltip title="Resubmit"><Button size="small" icon={<ReloadOutlined/>} style={{ borderRadius:6 }} onClick={()=>updateMut.mutate({id:r.id,d:{status:'pending'}})}/></Tooltip>}
          <Tooltip title="Detail"><Button size="small" icon={<MoreOutlined/>} style={{ borderRadius:6 }} onClick={()=>setDetailRecord(r)}/></Tooltip>
          {r.status!=='completed' && <Tooltip title="Edit"><Button size="small" icon={<EditOutlined/>} style={{ borderRadius:6 }} onClick={()=>openEdit(r)}/></Tooltip>}
          {['pending','rejected','cancelled'].includes(r.status) && (
            <Popconfirm title="Delete this record?" onConfirm={()=>deleteMut.mutate(r.id)} okButtonProps={{ danger:true }}>
              <Button size="small" danger icon={<DeleteOutlined/>} style={{ borderRadius:6 }}/>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const containerStyle  = { background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', overflow:'hidden' };
  const paginationProps = { pageSize:20, showSizeChanger:true, showTotal:(t,r)=>`${r[0]}–${r[1]} of ${t}`, style:{ padding:'12px 16px', margin:0 } };

  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', overflow:'visible' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Promotions & Transfers</div>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:400, marginTop:2 }}>
                Manage employee movements, promotions, department and location transfers
              </div>
            </div>
            <Button type="primary" icon={<PlusOutlined/>} onClick={openAdd} size="small" style={{ fontWeight:600 }}>
              New Record
            </Button>
          </div>
        }
        styles={{ header: { overflow:'visible' } }}
      >

      {/* Stat cards */}
      <Row gutter={[12,12]} style={{ marginBottom:16 }}>
        {[
          { label:'Total',     value:summary.total||transfers.length,   color:'#2563eb', bg:'#eff6ff' },
          { label:'Pending',   value:pendingCount,                      color:'#d97706', bg:'#fffbeb', alert:pendingCount>0 },
          { label:'Approved',  value:summary.approved||0,               color:'#2563eb', bg:'#eff6ff' },
          { label:'Completed', value:summary.completed||0,              color:'#16a34a', bg:'#f0fdf4' },
        ].map(s=>(
          <Col xs={12} sm={6} key={s.label}>
            <div style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:`1px solid ${s.alert?'#fde68a':'#e2e8f0'}`, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1 }}><div style={{ fontSize:22, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div><div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>{s.label}</div></div>
            </div>
          </Col>
        ))}
      </Row>

      {pendingCount>0 && <Alert type="warning" showIcon closable style={{ marginBottom:10, borderRadius:8 }} message={`${pendingCount} record${pendingCount>1?'s':''} pending approval`} action={<Button size="small" onClick={()=>setFilterStatus('pending')}>View Pending</Button>}/>}

      {/* Tabs */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding:'0 16px' }}
          items={[
            {
              key:'records',
              label:<span><SwapOutlined/> Records {pendingCount>0&&<span style={{ marginLeft:5, background:'#d97706', color:'#fff', borderRadius:10, padding:'0 6px', fontSize:10, fontWeight:700 }}>{pendingCount}</span>}</span>,
              children:(
                <div style={{ paddingBottom:16 }}>
                  {/* Toolbar */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                    <Input placeholder="Search name, emp code, reason…" prefix={<SearchOutlined style={{ color:'#94a3b8', fontSize:12 }}/>}
                      value={searchText} onChange={e=>setSearchText(e.target.value)} allowClear style={{ flex:'1 1 200px', maxWidth:260, borderRadius:8 }}/>
                    <FilterOutlined style={{ color:'#94a3b8', fontSize:12 }}/>
                    <Select placeholder="Type" allowClear style={{ flex:'1 1 130px', minWidth:130 }}
                      value={filterType} onChange={setFilterType} options={TRANSFER_TYPES.map(t=>({ value:t, label:<TypePill type={t}/> }))}/>
                    <Select placeholder="Status" allowClear style={{ flex:'1 1 120px', minWidth:120 }}
                      value={filterStatus} onChange={setFilterStatus} options={STATUSES.map(s=>({ value:s, label:<StatusPill status={s}/> }))}/>
                    <Select placeholder="Department" allowClear showSearch optionFilterProp="label" style={{ flex:'1 1 150px', minWidth:150 }}
                      value={filterDept||undefined} onChange={v=>setFilterDept(v||'')} options={deptFilter}/>
                    {hasFilters&&<Button size="small" style={{ borderRadius:6 }} onClick={()=>{ setSearchText(''); setFilterType(null); setFilterStatus(null); setFilterDept(''); }}>Clear</Button>}
                    <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                      <Tooltip title="Export CSV"><Button icon={<DownloadOutlined/>} onClick={()=>exportCSV(exportCols,filtered,`transfers-${dayjs().format('YYYY-MM-DD')}.csv`)} style={{ borderRadius:8 }}/></Tooltip>
                      <Button icon={<ReloadOutlined/>} onClick={()=>refetch()} style={{ borderRadius:8 }}/>
                    </div>
                  </div>
                  {hasFilters&&(
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                      {filterType   &&<Tag closable onClose={()=>setFilterType(null)}   color="blue">{lbl(filterType)}</Tag>}
                      {filterStatus &&<Tag closable onClose={()=>setFilterStatus(null)} color="green">{STATUS_CFG[filterStatus]?.label}</Tag>}
                      {filterDept   &&<Tag closable onClose={()=>setFilterDept('')}     icon={<ApartmentOutlined/>}>{filterDept}</Tag>}
                      {searchText   &&<Tag closable onClose={()=>setSearchText('')}     icon={<SearchOutlined/>}>"{searchText}"</Tag>}
                    </div>
                  )}
                  {selectedKeys.length>0&&(
                    <div style={{ background:'#2563eb', borderRadius:10, padding:'10px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}>
                      <span style={{ color:'#fff', fontWeight:700, fontSize:13 }}>{selectedKeys.length} selected</span>
                      <div style={{ flex:1 }}/>
                      <Popconfirm title={`Delete ${selectedKeys.length} record(s)?`} onConfirm={async()=>{ await Promise.all(selectedKeys.map(id=>apiService.delete(`/api/v1/personnel/promotion-transfers/${id}`))); message.success(`${selectedKeys.length} deleted`); setSelectedKeys([]); inv(); }} okButtonProps={{ danger:true }}>
                        <Button size="small" danger icon={<DeleteOutlined/>} style={{ borderRadius:6, background:'#dc2626', border:'none', color:'#fff' }}>Delete</Button>
                      </Popconfirm>
                      <Button size="small" icon={<CloseOutlined/>} onClick={()=>setSelectedKeys([])} style={{ borderRadius:6, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff' }}/>
                    </div>
                  )}
                  <div style={containerStyle}>
                    <Table columns={columns} dataSource={filtered} loading={isLoading} rowKey="id"
                      rowSelection={{ selectedRowKeys:selectedKeys, onChange:setSelectedKeys, getCheckboxProps:r=>({ disabled:r.status==='completed' }) }}
                      pagination={paginationProps} scroll={{ x:1200 }} size="middle"
                      rowClassName={r=>r.status==='pending'?'row-pending':r.status==='rejected'?'row-rejected':''}
                    />
                  </div>
                </div>
              ),
            },
            {
              key:'analytics',
              label:<span><BarChartOutlined/> Analytics</span>,
              children:<div style={{ paddingBottom:16 }}><AnalyticsTab transfers={transfers} summary={summary}/></div>,
            },
          ]}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal title={<Space><div style={{ width:24, height:24, borderRadius:6, background:'linear-gradient(135deg,#2563eb,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center' }}><SwapOutlined style={{ color:'#fff', fontSize:12 }}/></div>{editingRec?'Edit Record':'New Promotion / Transfer'}</Space>}
        open={modalOpen} onOk={handleSave} onCancel={closeModal} width={740}
        confirmLoading={createMut.isPending||updateMut.isPending} forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop:12 }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="personnel_id" label="Personnel" rules={[{ required:true }]}><Select showSearch placeholder="Search…" options={personnelOpts} optionFilterProp="label" disabled={!!editingRec}/></Form.Item></Col>
            <Col span={12}><Form.Item name="transfer_type" label="Transfer Type" rules={[{ required:true }]}><Select placeholder="Select type" options={TRANSFER_TYPES.map(t=>({ value:t, label:<TypePill type={t}/> }))}/></Form.Item></Col>
          </Row>
          <Divider orientation="left" plain style={{ margin:'4px 0 12px', fontSize:11, color:'#94a3b8' }}>Department</Divider>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="from_department_id" label="From"><Select showSearch placeholder="Current dept" options={deptOpts} optionFilterProp="label" allowClear/></Form.Item></Col>
            <Col span={12}><Form.Item name="to_department_id" label="To"><Select showSearch placeholder="New dept" options={deptOpts} optionFilterProp="label" allowClear/></Form.Item></Col>
          </Row>
          <Divider orientation="left" plain style={{ margin:'4px 0 12px', fontSize:11, color:'#94a3b8' }}>Position</Divider>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="from_position_id" label="From"><Select showSearch placeholder="Current position" options={posOpts} optionFilterProp="label" allowClear/></Form.Item></Col>
            <Col span={12}><Form.Item name="to_position_id" label="To"><Select showSearch placeholder="New position" options={posOpts} optionFilterProp="label" allowClear/></Form.Item></Col>
          </Row>
          <Divider orientation="left" plain style={{ margin:'4px 0 12px', fontSize:11, color:'#94a3b8' }}>Location / Site</Divider>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="from_location" label="From"><Input placeholder="e.g. Bonga FPSO"/></Form.Item></Col>
            <Col span={12}><Form.Item name="to_location" label="To"><Input placeholder="e.g. Lagos Office"/></Form.Item></Col>
          </Row>
          <Divider orientation="left" plain style={{ margin:'4px 0 12px', fontSize:11, color:'#94a3b8' }}>Dates & Salary</Divider>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="effective_date" label="Effective Date"><DatePicker style={{ width:'100%' }} format="YYYY-MM-DD"/></Form.Item></Col>
            <Col span={12}><Form.Item name="salary_change" label="Salary Change (net)"><InputNumber style={{ width:'100%' }} placeholder="e.g. 50000 or -20000"/></Form.Item></Col>
          </Row>
          <Form.Item name="reason" label="Reason / Notes">
            <Input.TextArea rows={3} placeholder="Reason for this promotion or transfer…"/>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal */}
      <Modal title={<Space><CloseCircleOutlined style={{ color:'#dc2626' }}/>Rejection Reason</Space>}
        open={!!rejectTarget} onOk={()=>{ actionMut.mutate({ id:rejectTarget, action:'reject', rejectionReason:rejectReason||undefined }); setRejectTarget(null); setRejectReason(''); }}
        onCancel={()=>{ setRejectTarget(null); setRejectReason(''); }} okButtonProps={{ danger:true }} okText="Confirm Reject"
      >
        <Input.TextArea rows={3} placeholder="Optional reason for rejection…" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} style={{ marginTop:8 }}/>
      </Modal>

      <DetailDrawer record={detailRecord} onClose={()=>setDetailRecord(null)}
        onApprove={id=>actionMut.mutate({id,action:'approve'})}
        onReject={id=>{ setDetailRecord(null); setRejectTarget(id); }}
        onComplete={id=>actionMut.mutate({id,action:'complete'})}
        onCancel={id=>actionMut.mutate({id,action:'cancel'})}
        onEdit={r=>{ setDetailRecord(null); openEdit(r); }}
        actionPending={actionMut.isPending}
      />

      <style>{`
        .ant-table-thead > tr > th { background:#f8fafc !important; color:#64748b !important; font-size:11px !important; font-weight:700 !important; text-transform:uppercase !important; letter-spacing:0.05em !important; border-bottom:2px solid #e2e8f0 !important; }
        .ant-table-tbody > tr > td { border-bottom:1px solid #f1f5f9 !important; padding:10px 12px !important; }
        .ant-table-tbody > tr:last-child > td { border-bottom:none !important; }
        .ant-tabs-nav { margin-bottom:0 !important; }
        .row-pending { background:rgba(217,119,6,0.04) !important; }
        .row-pending:hover > td { background:rgba(217,119,6,0.08) !important; }
        .row-rejected { background:rgba(220,38,38,0.02) !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default PromotionTransfer;
