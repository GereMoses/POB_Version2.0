import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Modal, Form, Row, Col, Tag,
  Popconfirm, DatePicker, Select, InputNumber, Tabs, Divider,
  Alert, Tooltip, App, Avatar, Typography, Drawer, Badge, Switch, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, StopOutlined,
  ExclamationCircleOutlined, FileTextOutlined, SyncOutlined,
  SafetyCertificateOutlined, WarningOutlined, ClockCircleOutlined,
  SearchOutlined, FilterOutlined, ApartmentOutlined, DownloadOutlined,
  BarChartOutlined, CloseOutlined, MoreOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Text } = Typography;

// ── Constants ──────────────────────────────────────────────────────────────────
const CONTRACT_TYPES    = ['permanent', 'fixed_term', 'contractor', 'intern', 'apprentice', 'temporary'];
const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated', 'suspended', 'renewed'];
const PAY_FREQUENCIES   = ['monthly', 'bi_weekly', 'weekly', 'daily'];

const STATUS_CFG = {
  draft:      { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Draft'      },
  active:     { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Active'     },
  expired:    { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Expired'    },
  terminated: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Terminated' },
  suspended:  { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa', label: 'Suspended'  },
  renewed:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Renewed'    },
};
const TYPE_CFG = {
  permanent:  { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  fixed_term: { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' },
  contractor: { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  intern:     { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  apprentice: { color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
  temporary:  { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};
const ZKTECO_CFG = {
  granted: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Granted', icon: <SafetyCertificateOutlined /> },
  pending: { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Pending',  icon: <ClockCircleOutlined />        },
  warning: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Warning',  icon: <WarningOutlined />            },
  revoked: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Revoked',  icon: <CloseCircleOutlined />        },
};
const AVATAR_PALETTE = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d','#9333ea','#0f766e'];
const avatarColor = name => AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = name => (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const lbl         = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const exportCSV = (cols, rows, fname) => {
  const h = cols.map(c => `"${c.title}"`).join(',');
  const b = rows.map(r => cols.map(c => `"${String(typeof c.ev === 'function' ? c.ev(r) : (r[c.k] ?? '')).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h+'\n'+b],{type:'text/csv;charset=utf-8;'})); a.download = fname; a.click(); URL.revokeObjectURL(a.href);
};

// ── Pills ──────────────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status] || { color:'#64748b', bg:'#f8fafc', border:'#e2e8f0', label: lbl(status) };
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
    <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.color, flexShrink:0 }} />{cfg.label}
  </span>;
};
const TypePill = ({ type }) => {
  if (!type) return null;
  const cfg = TYPE_CFG[type] || { color:'#64748b', bg:'#f3f4f6', border:'#e5e7eb' };
  return <span style={{ display:'inline-block', background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, borderRadius:6, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{lbl(type)}</span>;
};
const ZKBadge = ({ access }) => {
  const cfg = ZKTECO_CFG[access] || ZKTECO_CFG.pending;
  return <Tooltip title={`ZKTeco: ${cfg.label}`}>
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, borderRadius:6, padding:'1px 8px', fontSize:10, fontWeight:700 }}>
      {cfg.icon} {cfg.label}
    </span>
  </Tooltip>;
};
const EmployeeCell = ({ name, empCode, type, dept, inProbation, onClick }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, cursor: onClick?'pointer':'default' }} onClick={onClick}>
    <Avatar size={30} style={{ background: avatarColor(name), fontSize:10, fontWeight:700, flexShrink:0 }}>{initials(name)}</Avatar>
    <div>
      <div style={{ fontWeight:600, fontSize:12, color:'#111827' }}>{name||'—'}</div>
      <div style={{ display:'flex', gap:4, alignItems:'center', marginTop:2, flexWrap:'wrap' }}>
        {empCode && <span style={{ fontFamily:'monospace', fontSize:9, color:'#94a3b8', background:'#f3f4f6', borderRadius:3, padding:'0 4px' }}>{empCode}</span>}
        {inProbation && <span style={{ fontSize:9, fontWeight:700, background:'#ede9fe', color:'#7c3aed', borderRadius:3, padding:'0 5px' }}>Probation</span>}
        {dept && <span style={{ fontSize:9, color:'#94a3b8' }}>{dept}</span>}
      </div>
    </div>
  </div>
);

// ── Analytics ──────────────────────────────────────────────────────────────────
const AnalyticsTab = ({ contracts, summary }) => {
  const { typeDist, statusDist, monthlyTrend } = useMemo(() => {
    const tCounts={}, sCounts={}, mCounts={};
    contracts.forEach(c => {
      if (c.contract_type) tCounts[c.contract_type] = (tCounts[c.contract_type]||0)+1;
      sCounts[c.status] = (sCounts[c.status]||0)+1;
      const m = c.created_at ? dayjs(c.created_at).format('YYYY-MM') : null;
      if (m) mCounts[m] = (mCounts[m]||0)+1;
    });
    const typeDist    = Object.entries(tCounts).map(([k,v]) => ({ name:lbl(k), value:v, fill: TYPE_CFG[k]?.color||'#94a3b8' }));
    const statusDist  = CONTRACT_STATUSES.filter(s=>sCounts[s]).map(s => ({ name:STATUS_CFG[s]?.label||lbl(s), value:sCounts[s], fill:STATUS_CFG[s]?.color||'#94a3b8' }));
    const now = dayjs();
    const monthlyTrend = Array.from({length:12},(_,i)=>{ const d=now.subtract(11-i,'month'); const mk=d.format('YYYY-MM'); return { name:d.format('MMM'), count:mCounts[mk]||0 }; });
    return { typeDist, statusDist, monthlyTrend };
  }, [contracts]);

  if (!contracts.length) return <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}><BarChartOutlined style={{ fontSize:40, color:'#cbd5e1' }} /><div style={{ marginTop:12, fontSize:13 }}>No contract data yet</div></div>;

  const card = { background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)', padding:16 };
  const sTitle = t => <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>{t}</div>;
  const CustomPieLabel = ({ cx,cy,midAngle,innerRadius,outerRadius,percent }) => {
    if (percent<0.07) return null; const R=Math.PI/180, r=innerRadius+(outerRadius-innerRadius)*0.55;
    return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent*100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* ZKTeco access row */}
      {(summary.zkteco_granted!=null || summary.zkteco_pending!=null) && (
        <div style={{ ...card, padding:'12px 16px' }}>
          {sTitle('ZKTeco Access State')}
          <Row gutter={[12,12]}>
            {[
              { label:'Granted', value:summary.zkteco_granted||0, cfg:ZKTECO_CFG.granted },
              { label:'Pending', value:summary.zkteco_pending||0, cfg:ZKTECO_CFG.pending },
              { label:'Warning', value:summary.zkteco_warning||0, cfg:ZKTECO_CFG.warning },
              { label:'Revoked', value:summary.zkteco_revoked||0, cfg:ZKTECO_CFG.revoked },
            ].map(k=>(
              <Col xs={12} sm={6} key={k.label}>
                <div style={{ background:k.cfg.bg, border:`1px solid ${k.cfg.border}`, borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:800, color:k.cfg.color }}>{k.value}</div>
                  <div style={{ fontSize:11, color:k.cfg.color, fontWeight:600, marginTop:2 }}>{k.label}</div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      )}

      <Row gutter={[16,16]}>
        <Col xs={24} md={10}>
          <div style={card}>
            {sTitle('Contract Type Distribution')}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <ResponsiveContainer width="55%" height={160}>
                <PieChart><Pie data={typeDist} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={68} labelLine={false} label={CustomPieLabel}>
                  {typeDist.map((d,i)=><Cell key={i} fill={d.fill} />)}
                </Pie><RTooltip contentStyle={{ borderRadius:8, border:'1px solid #e2e8f0', fontSize:11 }} /></PieChart>
              </ResponsiveContainer>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                {typeDist.map((d,i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:7, height:7, borderRadius:'50%', background:d.fill, flexShrink:0 }} /><Text style={{ fontSize:10, color:'#374151' }}>{d.name}</Text></div>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:11, fill:'#64748b' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={{ borderRadius:8, border:'1px solid #e2e8f0', fontSize:11 }} />
                <Bar dataKey="value" radius={[4,4,0,0]}>{statusDist.map((d,i)=><Cell key={i} fill={d.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Col>
        <Col xs={24}>
          <div style={card}>
            {sTitle('Monthly Contract Activity (12 months)')}
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={monthlyTrend} margin={{ left:-20, right:8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={{ borderRadius:8, border:'1px solid #e2e8f0', fontSize:11 }} formatter={v=>[v,'Contracts']} />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} dot={{ fill:'#2563eb', r:3 }} activeDot={{ r:5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Col>
      </Row>
    </div>
  );
};

// ── Contract Detail Drawer ─────────────────────────────────────────────────────
const ContractDrawer = ({ record, onClose, onAction, onEdit, actionPending }) => {
  if (!record) return null;
  const { id, status } = record;
  return (
    <Drawer
      title={
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Avatar size={34} style={{ background:avatarColor(record.personnel_name), fontSize:11, fontWeight:700 }}>{initials(record.personnel_name)}</Avatar>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{record.personnel_name}</div>
            <div style={{ fontSize:11, color:'#94a3b8' }}>{record.contract_number} — {lbl(record.contract_type)}</div>
          </div>
        </div>
      }
      open={!!record} onClose={onClose} width={400} bodyStyle={{ padding:20 }}
    >
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        <StatusPill status={record.status} />
        <TypePill type={record.contract_type} />
        {record.zkteco_access && <ZKBadge access={record.zkteco_access} />}
      </div>

      <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
        <Row gutter={12}>
          <Col span={12}><Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:3 }}>Start Date</Text><Text style={{ fontSize:12, fontWeight:600 }}>{record.start_date ? dayjs(record.start_date).format('DD MMM YYYY') : '—'}</Text></Col>
          <Col span={12}><Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:3 }}>End Date</Text><Text style={{ fontSize:12, fontWeight:600, color: record.is_expiring_soon?'#d97706':'#374151' }}>{record.end_date ? dayjs(record.end_date).format('DD MMM YYYY') : 'Indefinite'}</Text></Col>
        </Row>
        {record.salary && (
          <Row gutter={12} style={{ marginTop:10 }}>
            <Col span={12}><Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:3 }}>Salary</Text><Text style={{ fontSize:14, fontWeight:800, color:'#059669' }}>{record.currency||'USD'} {Number(record.salary).toLocaleString()}<span style={{ fontSize:10, color:'#94a3b8' }}>/{record.payment_frequency||'mo'}</span></Text></Col>
            {record.working_hours && <Col span={12}><Text style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', fontWeight:700, display:'block', marginBottom:3 }}>Hours/Week</Text><Text style={{ fontSize:12 }}>{record.working_hours}h</Text></Col>}
          </Row>
        )}
      </div>

      {record.is_expiring_soon && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'8px 12px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
          <WarningOutlined style={{ color:'#d97706' }} />
          <Text style={{ fontSize:12, color:'#92400e' }}>{record.days_until_expiry}d until expiry — renewal recommended</Text>
        </div>
      )}
      {record.department_name && <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}><ApartmentOutlined style={{ color:'#94a3b8', fontSize:12 }} /><Text style={{ fontSize:12 }}>{record.department_name}</Text></div>}
      {record.job_title && <div style={{ fontSize:12, color:'#374151', marginBottom:8 }}>Job Title: <b>{record.job_title}</b></div>}

      <Divider style={{ margin:'14px 0 10px' }} />
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {status === 'draft'     && <Button type="primary" size="small" icon={<CheckCircleOutlined />} loading={actionPending} onClick={()=>onAction(id,'activate')}  style={{ borderRadius:7, background:'#16a34a', borderColor:'#16a34a' }}>Activate</Button>}
        {status === 'draft'     && <Button danger size="small" icon={<CloseCircleOutlined />} loading={actionPending} onClick={()=>onAction(id,'terminate')} style={{ borderRadius:7 }}>Terminate</Button>}
        {status === 'active'    && <Button size="small" icon={<StopOutlined />}        loading={actionPending} onClick={()=>onAction(id,'suspend')}   style={{ borderRadius:7 }}>Suspend</Button>}
        {status === 'active'    && <Button size="small" icon={<FileTextOutlined />}    loading={actionPending} onClick={()=>onAction(id,'renew')}     style={{ borderRadius:7 }}>Renew</Button>}
        {status === 'active'    && <Button danger size="small" icon={<CloseCircleOutlined />} loading={actionPending} onClick={()=>onAction(id,'terminate')} style={{ borderRadius:7 }}>Terminate</Button>}
        {status === 'suspended' && <Button type="primary" size="small" icon={<SyncOutlined />} loading={actionPending} onClick={()=>onAction(id,'activate')}  style={{ borderRadius:7 }}>Reactivate</Button>}
        {status === 'suspended' && <Button danger size="small" icon={<CloseCircleOutlined />} loading={actionPending} onClick={()=>onAction(id,'terminate')} style={{ borderRadius:7 }}>Terminate</Button>}
        {status === 'renewed'   && <Button size="small" icon={<StopOutlined />}        loading={actionPending} onClick={()=>onAction(id,'suspend')}   style={{ borderRadius:7 }}>Suspend</Button>}
        {status === 'renewed'   && <Button danger size="small" icon={<CloseCircleOutlined />} loading={actionPending} onClick={()=>onAction(id,'terminate')} style={{ borderRadius:7 }}>Terminate</Button>}
        {status === 'expired'   && <Button size="small" icon={<FileTextOutlined />}    loading={actionPending} onClick={()=>onAction(id,'renew')}     style={{ borderRadius:7 }}>Renew</Button>}
        {status !== 'terminated' && <Button size="small" icon={<EditOutlined />} onClick={()=>{ onClose(); onEdit(record); }} style={{ borderRadius:7 }}>Edit</Button>}
      </div>
    </Drawer>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const EmploymentContract = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab,    setActiveTab]    = useState('contracts');
  const [searchQ,      setSearchQ]      = useState('');
  const [filterType,   setFilterType]   = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterDept,   setFilterDept]   = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [detailRecord, setDetailRecord] = useState(null);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingRecord,setEditingRecord]= useState(null);
  const [form] = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: contracts = [], isLoading, refetch } = useQuery({
    queryKey: ['employment-contracts'],
    queryFn:  () => apiService.get('/api/v1/personnel/contracts?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });
  const { data: summary = {} } = useQuery({
    queryKey: ['employment-contracts-summary'],
    queryFn:  () => apiService.get('/api/v1/personnel/contracts/meta/summary'),
    staleTime: 30000,
  });
  const { data: personnel = [] } = useQuery({
    queryKey: ['personnel-list-contracts'],
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
  const inv    = useCallback((...keys) => keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] })), [queryClient]);
  const invAll = useCallback(() => inv('employment-contracts', 'employment-contracts-summary'), [inv]);

  const deptOptions = useMemo(() =>
    [...new Set(contracts.map(c => c.department_name).filter(Boolean))].sort().map(d => ({ value: d, label: d })),
  [contracts]);

  const filtered = useMemo(() => contracts.filter(c => {
    if (filterType   && c.contract_type !== filterType)  return false;
    if (filterStatus && c.status        !== filterStatus) return false;
    if (filterDept   && c.department_name !== filterDept) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return (c.personnel_name||'').toLowerCase().includes(q) || (c.personnel_emp_code||'').toLowerCase().includes(q)
          || (c.contract_number||'').toLowerCase().includes(q) || (c.job_title||'').toLowerCase().includes(q);
    }
    return true;
  }), [contracts, filterType, filterStatus, filterDept, searchQ]);

  const expiringSoon  = summary?.expiring_soon || 0;
  const zkWarning     = summary?.zkteco_warning || 0;
  const hasFilters    = searchQ || filterType || filterStatus || filterDept;

  const personnelOptions = useMemo(() => personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name||'')} ${(p.last_name||'')}`.trim() + (p.emp_code ? ` (${p.emp_code})` : ''),
  })), [personnel]);
  const deptFormOptions     = useMemo(() => departments.map(d => ({ value: d.id, label: d.name })), [departments]);
  const positionOptions     = useMemo(() => positions.map(p => ({ value: p.id, label: p.position_name })), [positions]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/contracts', d),
    onSuccess: () => { message.success('Contract created'); setModalOpen(false); setEditingRecord(null); invAll(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Create failed'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, d }) => apiService.put(`/api/v1/personnel/contracts/${id}`, d),
    onSuccess: () => { message.success('Updated'); setModalOpen(false); setEditingRecord(null); invAll(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Update failed'),
  });
  const deleteMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/contracts/${id}`),
    onSuccess: () => { message.success('Deleted'); invAll(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action }) => apiService.put(`/api/v1/personnel/contracts/${id}/${action}`),
    onSuccess: (_, { action }) => {
      const msgs = { activate:'Activated', terminate:'Terminated', suspend:'Suspended', renew:'Renewed', expire:'Expired' };
      message.success(msgs[action] || 'Done'); setDetailRecord(null); invAll();
    },
    onError: e => message.error(e?.response?.data?.detail || 'Action failed'),
  });

  const bulkDelete = useCallback(async () => {
    const deletable = selectedKeys.filter(id => contracts.find(c => c.id===id && ['draft','terminated','expired'].includes(c.status)));
    await Promise.all(deletable.map(id => apiService.delete(`/api/v1/personnel/contracts/${id}`)));
    message.success(`${deletable.length} contract(s) deleted`);
    setSelectedKeys([]); invAll();
  }, [selectedKeys, contracts, invAll]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const openAdd  = () => { setEditingRecord(null); setModalOpen(true); setTimeout(() => form.resetFields(), 0); };
  const openEdit = r => { setEditingRecord(r); setModalOpen(true); setTimeout(() => form.setFieldsValue({ ...r, start_date: r.start_date?dayjs(r.start_date):null, end_date: r.end_date?dayjs(r.end_date):null, probation_end_date: r.probation_end_date?dayjs(r.probation_end_date):null, signed_date: r.signed_date?dayjs(r.signed_date):null }), 0); };
  const handleSave = () => form.validateFields().then(v => {
    const payload = { ...v, start_date: v.start_date?.format('YYYY-MM-DD'), end_date: v.end_date?.format('YYYY-MM-DD'), probation_end_date: v.probation_end_date?.format('YYYY-MM-DD'), signed_date: v.signed_date?.format('YYYY-MM-DD') };
    if (editingRecord) updateMut.mutate({ id: editingRecord.id, d: payload });
    else createMut.mutate(payload);
  }).catch(()=>{});

  const exportCols = [
    { title:'Contract #',   ev: r=>r.contract_number||'' },
    { title:'Personnel',    ev: r=>r.personnel_name||'' },
    { title:'Emp Code',     ev: r=>r.personnel_emp_code||'' },
    { title:'Type',         ev: r=>r.personnel_type||'' },
    { title:'Department',   ev: r=>r.department_name||'' },
    { title:'Contract Type',ev: r=>r.contract_type||'' },
    { title:'Job Title',    ev: r=>r.job_title||'' },
    { title:'Start Date',   ev: r=>r.start_date||'' },
    { title:'End Date',     ev: r=>r.end_date||'' },
    { title:'Status',       ev: r=>r.status||'' },
    { title:'Salary',       ev: r=>r.salary??'' },
    { title:'Currency',     ev: r=>r.currency||'' },
    { title:'ZKTeco',       ev: r=>r.zkteco_access||'' },
  ];

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title:'Contract #', dataIndex:'contract_number', width:130,
      render: v => <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#374151', background:'#f1f5f9', borderRadius:5, padding:'2px 7px' }}>{v||'—'}</span>,
    },
    {
      title:'Employee', key:'employee', width:220,
      sorter:(a,b)=>(a.personnel_name||'').localeCompare(b.personnel_name||''),
      render:(_,r)=><EmployeeCell name={r.personnel_name||`ID ${r.personnel_id}`} empCode={r.personnel_emp_code} type={r.personnel_type} dept={r.department_name} inProbation={r.is_in_probation} onClick={()=>setDetailRecord(r)} />,
    },
    { title:'Type', dataIndex:'contract_type', width:120, render: t=><TypePill type={t} /> },
    { title:'Job Title', dataIndex:'job_title', width:140, render: v=><span style={{ fontSize:12 }}>{v||'—'}</span> },
    {
      title:'Duration', key:'duration', width:170,
      render:(_,r)=>(
        <div style={{ fontSize:11 }}>
          <div>{r.start_date ? dayjs(r.start_date).format('DD MMM YYYY') : '—'}</div>
          {r.end_date && <div style={{ color:'#94a3b8' }}>→ {dayjs(r.end_date).format('DD MMM YYYY')}</div>}
          {r.is_expiring_soon && <span style={{ fontSize:9, fontWeight:700, background:'#fffbeb', color:'#d97706', border:'1px solid #fde68a', borderRadius:4, padding:'0 6px', marginTop:2, display:'inline-block' }}><WarningOutlined /> {r.days_until_expiry}d left</span>}
        </div>
      ),
    },
    {
      title:'Salary', key:'salary', width:130,
      render:(_,r)=>r.salary ? <span style={{ fontWeight:700, fontSize:12, color:'#059669' }}>{r.currency||'USD'} {Number(r.salary).toLocaleString()}<span style={{ fontSize:10, color:'#94a3b8' }}>/{r.payment_frequency||'mo'}</span></span> : <span style={{ color:'#d1d5db' }}>—</span>,
    },
    { title:'Status', key:'status', width:130, render:(_,r)=><StatusPill status={r.status} /> },
    { title:'ZKTeco', dataIndex:'zkteco_access', width:110, render: v=><ZKBadge access={v||'pending'} /> },
    {
      title:'', key:'actions', fixed:'right', width:210,
      render:(_,r)=>(
        <Space size={3}>
          {r.status==='draft'     && <Tooltip title="Activate"><Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'activate'})} style={{ borderRadius:6, background:'#16a34a', borderColor:'#16a34a' }} /></Tooltip>}
          {r.status==='draft'     && <Tooltip title="Terminate"><Button size="small" danger icon={<CloseCircleOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'terminate'})} style={{ borderRadius:6 }} /></Tooltip>}
          {r.status==='active'    && <Tooltip title="Suspend"><Button size="small" icon={<StopOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'suspend'})} style={{ borderRadius:6 }} /></Tooltip>}
          {r.status==='active'    && <Tooltip title="Renew"><Button size="small" icon={<FileTextOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'renew'})} style={{ borderRadius:6 }} /></Tooltip>}
          {r.status==='active'    && <Tooltip title="Terminate"><Button size="small" danger icon={<CloseCircleOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'terminate'})} style={{ borderRadius:6 }} /></Tooltip>}
          {r.status==='suspended' && <Tooltip title="Reactivate"><Button size="small" type="primary" icon={<SyncOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'activate'})} style={{ borderRadius:6 }} /></Tooltip>}
          {r.status==='suspended' && <Tooltip title="Terminate"><Button size="small" danger icon={<CloseCircleOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'terminate'})} style={{ borderRadius:6 }} /></Tooltip>}
          {r.status==='renewed'   && <Tooltip title="Suspend"><Button size="small" icon={<StopOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'suspend'})} style={{ borderRadius:6 }} /></Tooltip>}
          {r.status==='renewed'   && <Tooltip title="Terminate"><Button size="small" danger icon={<CloseCircleOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'terminate'})} style={{ borderRadius:6 }} /></Tooltip>}
          {r.status==='expired'   && <Tooltip title="Renew"><Button size="small" icon={<FileTextOutlined />} onClick={()=>actionMut.mutate({id:r.id,action:'renew'})} style={{ borderRadius:6 }} /></Tooltip>}
          <Tooltip title="Detail"><Button size="small" icon={<MoreOutlined />} onClick={()=>setDetailRecord(r)} style={{ borderRadius:6 }} /></Tooltip>
          {r.status!=='terminated' && <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={()=>openEdit(r)} style={{ borderRadius:6 }} /></Tooltip>}
          {['draft','terminated','expired'].includes(r.status) && (
            <Popconfirm title="Delete contract?" onConfirm={()=>deleteMut.mutate(r.id)} okButtonProps={{ danger:true }}>
              <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius:6 }} />
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
              <div style={{ fontWeight:700, fontSize:16 }}>Employment Contracts</div>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:400, marginTop:2 }}>
                Manage employment contracts, ZKTeco access and renewal tracking
              </div>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} size="small" style={{ fontWeight:600 }}>
              New Contract
            </Button>
          </div>
        }
        styles={{ header: { overflow:'visible' } }}
      >

      {/* Stat cards */}
      <Row gutter={[12,12]} style={{ marginBottom:16 }}>
        {[
          { label:'Total',        value: summary.total||contracts.length,  color:'#2563eb', bg:'#eff6ff', icon:<FileTextOutlined /> },
          { label:'Active',       value: summary.active||0,                color:'#16a34a', bg:'#f0fdf4', icon:<CheckCircleOutlined /> },
          { label:'Expiring ≤30d',value: expiringSoon,                     color:'#d97706', bg:'#fffbeb', icon:<WarningOutlined />, alert: expiringSoon>0 },
          { label:'Terminated',   value: summary.terminated||0,            color:'#dc2626', bg:'#fef2f2', icon:<CloseCircleOutlined /> },
        ].map(s=>(
          <Col xs={12} sm={6} key={s.label}>
            <div style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:`1px solid ${s.alert?'#fde68a':'#e2e8f0'}`, boxShadow:'0 1px 3px rgba(0,0,0,0.04)', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, flexShrink:0, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, fontSize:18 }}>{s.icon}</div>
              <div><div style={{ fontSize:22, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{s.value}</div><div style={{ fontSize:11, color:'#94a3b8', marginTop:3, fontWeight:500 }}>{s.label}</div></div>
            </div>
          </Col>
        ))}
      </Row>

      {expiringSoon>0 && <Alert type="warning" showIcon closable style={{ marginBottom:10, borderRadius:8 }} message={`${expiringSoon} active contract${expiringSoon>1?'s':''} expiring within 30 days — renew to maintain ZKTeco access`} action={<Button size="small" onClick={()=>setFilterStatus('active')}>View Active</Button>} />}
      {zkWarning>0    && <Alert type="error"   showIcon closable style={{ marginBottom:10, borderRadius:8 }} message={`${zkWarning} contract${zkWarning>1?'s':''} in suspended/expired state — ZKTeco access review required`} />}

      {/* Tabs */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding:'0 16px' }}
          items={[
            {
              key:'contracts',
              label:<span><FileTextOutlined /> Contracts</span>,
              children:(
                <div style={{ padding:'0 0 16px' }}>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                    <Input placeholder="Search name, emp code, contract #, job title…" prefix={<SearchOutlined style={{ color:'#94a3b8', fontSize:12 }} />}
                      value={searchQ} onChange={e=>setSearchQ(e.target.value)} allowClear style={{ flex:'1 1 200px', maxWidth:280, borderRadius:8 }} />
                    <FilterOutlined style={{ color:'#94a3b8', fontSize:12 }} />
                    <Select placeholder="Type" allowClear style={{ flex:'1 1 130px', minWidth:130 }}
                      value={filterType} onChange={setFilterType} options={CONTRACT_TYPES.map(t=>({ value:t, label:<TypePill type={t} /> }))} />
                    <Select placeholder="Status" allowClear style={{ flex:'1 1 120px', minWidth:120 }}
                      value={filterStatus} onChange={setFilterStatus} options={CONTRACT_STATUSES.map(s=>({ value:s, label:<StatusPill status={s} /> }))} />
                    <Select placeholder="Department" allowClear showSearch optionFilterProp="label" style={{ flex:'1 1 150px', minWidth:150 }}
                      value={filterDept||undefined} onChange={v=>setFilterDept(v||'')} options={deptOptions} />
                    {hasFilters && <Button size="small" style={{ borderRadius:6 }} onClick={()=>{ setSearchQ(''); setFilterType(null); setFilterStatus(null); setFilterDept(''); }}>Clear</Button>}
                    <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                      <Tooltip title="Export CSV"><Button icon={<DownloadOutlined />} onClick={()=>exportCSV(exportCols,filtered,`contracts-${dayjs().format('YYYY-MM-DD')}.csv`)} style={{ borderRadius:8 }} /></Tooltip>
                      <Button icon={<ReloadOutlined />} onClick={()=>refetch()} style={{ borderRadius:8 }} />
                    </div>
                  </div>
                  {hasFilters && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                      {filterType   && <Tag closable onClose={()=>setFilterType(null)}   color="blue">{lbl(filterType)}</Tag>}
                      {filterStatus && <Tag closable onClose={()=>setFilterStatus(null)} color="green">{STATUS_CFG[filterStatus]?.label}</Tag>}
                      {filterDept   && <Tag closable onClose={()=>setFilterDept('')}     icon={<ApartmentOutlined />}>{filterDept}</Tag>}
                      {searchQ      && <Tag closable onClose={()=>setSearchQ('')}        icon={<SearchOutlined />}>"{searchQ}"</Tag>}
                    </div>
                  )}
                  {selectedKeys.length>0 && (
                    <div style={{ background:'#2563eb', borderRadius:10, padding:'10px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}>
                      <span style={{ color:'#fff', fontWeight:700, fontSize:13 }}>{selectedKeys.length} selected</span>
                      <div style={{ flex:1 }} />
                      <Popconfirm title={`Delete ${selectedKeys.length} contract(s)?`} description="Only draft/terminated/expired can be deleted." onConfirm={bulkDelete} okButtonProps={{ danger:true }}>
                        <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius:6, background:'#dc2626', border:'none', color:'#fff' }}>Delete</Button>
                      </Popconfirm>
                      <Button size="small" icon={<CloseOutlined />} onClick={()=>setSelectedKeys([])} style={{ borderRadius:6, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff' }} />
                    </div>
                  )}
                  <div style={containerStyle}>
                    <Table columns={columns} dataSource={filtered} loading={isLoading} rowKey="id"
                      rowSelection={{ selectedRowKeys:selectedKeys, onChange:setSelectedKeys, getCheckboxProps:r=>({ disabled:r.status==='active' }) }}
                      pagination={paginationProps} scroll={{ x:1400 }} size="middle"
                      rowClassName={r=>r.is_expiring_soon?'row-expiring':r.status==='terminated'?'row-terminated':''} />
                  </div>
                </div>
              ),
            },
            {
              key:'analytics',
              label:<span><BarChartOutlined /> Analytics</span>,
              children:<div style={{ padding:'0 0 16px' }}><AnalyticsTab contracts={contracts} summary={summary} /></div>,
            },
          ]}
        />
      </div>

      {/* Modal */}
      <Modal
        title={<Space><div style={{ width:24, height:24, borderRadius:6, background:'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex', alignItems:'center', justifyContent:'center' }}><FileTextOutlined style={{ color:'#fff', fontSize:12 }} /></div>{editingRecord?'Edit Contract':'New Employment Contract'}</Space>}
        open={modalOpen} onOk={handleSave} onCancel={()=>{ setModalOpen(false); setEditingRecord(null); }}
        confirmLoading={createMut.isPending||updateMut.isPending} width={760} forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop:12 }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="personnel_id" label="Personnel" rules={[{required:true}]}><Select showSearch placeholder="Search…" options={personnelOptions} filterOption={(i,o)=>(o?.label??'').toLowerCase().includes(i.toLowerCase())} disabled={!!editingRecord} /></Form.Item></Col>
            <Col span={12}><Form.Item name="contract_number" label="Contract Number"><Input placeholder="Auto-generated if blank" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="contract_type" label="Contract Type" rules={[{required:true}]}><Select placeholder="Select type" options={CONTRACT_TYPES.map(t=>({ value:t, label:<TypePill type={t} /> }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="job_title" label="Job Title"><Input /></Form.Item></Col>
          </Row>
          <Divider orientation="left" plain style={{ margin:'4px 0 12px', fontSize:11, color:'#94a3b8' }}>Duration</Divider>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="start_date" label="Start Date"><DatePicker style={{ width:'100%' }} format="YYYY-MM-DD" /></Form.Item></Col>
            <Col span={8}><Form.Item name="end_date" label="End Date"><DatePicker style={{ width:'100%' }} format="YYYY-MM-DD" /></Form.Item></Col>
            <Col span={8}><Form.Item name="probation_end_date" label="Probation End"><DatePicker style={{ width:'100%' }} format="YYYY-MM-DD" /></Form.Item></Col>
          </Row>
          <Divider orientation="left" plain style={{ margin:'4px 0 12px', fontSize:11, color:'#94a3b8' }}>Compensation</Divider>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="salary" label="Salary"><InputNumber style={{ width:'100%' }} min={0} /></Form.Item></Col>
            <Col span={8}><Form.Item name="currency" label="Currency" initialValue="USD"><Select options={['USD','NGN','GBP','EUR'].map(v=>({ value:v, label:v }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="payment_frequency" label="Frequency"><Select allowClear options={PAY_FREQUENCIES.map(f=>({ value:f, label:lbl(f) }))} /></Form.Item></Col>
          </Row>
          <Divider orientation="left" plain style={{ margin:'4px 0 12px', fontSize:11, color:'#94a3b8' }}>Placement</Divider>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="department_id" label="Department"><Select showSearch placeholder="Select" options={deptFormOptions} optionFilterProp="label" allowClear /></Form.Item></Col>
            <Col span={12}><Form.Item name="position_id" label="Position"><Select showSearch placeholder="Select" options={positionOptions} optionFilterProp="label" allowClear /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="working_hours" label="Working Hours / Week"><InputNumber style={{ width:'100%' }} min={1} max={84} /></Form.Item></Col>
            <Col span={12}><Form.Item name="signed_date" label="Signed Date"><DatePicker style={{ width:'100%' }} format="YYYY-MM-DD" /></Form.Item></Col>
          </Row>
          <Form.Item name="document_url" label="Document URL"><Input placeholder="Link to signed contract" /></Form.Item>
          <Form.Item name="terms" label="Terms & Conditions"><Input.TextArea rows={2} maxLength={2000} showCount /></Form.Item>
        </Form>
      </Modal>

      <ContractDrawer record={detailRecord} onClose={()=>setDetailRecord(null)} onAction={(id,action)=>actionMut.mutate({id,action})} onEdit={r=>{ setDetailRecord(null); openEdit(r); }} actionPending={actionMut.isPending} />

      <style>{`
        .ant-table-thead > tr > th { background:#f8fafc !important; color:#64748b !important; font-size:11px !important; font-weight:700 !important; text-transform:uppercase !important; letter-spacing:0.05em !important; border-bottom:2px solid #e2e8f0 !important; }
        .ant-table-tbody > tr > td { border-bottom:1px solid #f1f5f9 !important; padding:10px 12px !important; }
        .ant-table-tbody > tr:last-child > td { border-bottom:none !important; }
        .ant-tabs-nav { margin-bottom:0 !important; }
        .row-expiring { background:rgba(217,119,6,0.04) !important; }
        .row-expiring:hover > td { background:rgba(217,119,6,0.08) !important; }
        .row-terminated { background:rgba(220,38,38,0.02) !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default EmploymentContract;
