import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Card, Row, Col,
  Tag, Popconfirm, DatePicker, Tabs, Statistic, Tooltip, Alert,
  Badge, App, Divider, Timeline, Empty,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  WarningOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, SearchOutlined, FileProtectOutlined,
  TeamOutlined, AuditOutlined, SafetyCertificateOutlined,
  RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

// ── constants ─────────────────────────────────────────────────────────────────
const INCIDENT_TYPES = [
  'safety_violation','hse_breach','misconduct','attendance',
  'substance_abuse','theft','harassment','insubordination',
  'negligence','policy_violation','other',
];
const SEVERITY_LEVELS = ['minor','moderate','major','critical'];
const ACTION_TYPES = [
  'verbal_warning','written_warning','final_warning',
  'suspension','demotion','termination','retraining','fine','other',
];
const STATUSES      = ['open','under_investigation','resolved','appealed','closed'];
const APPEAL_STATUSES = ['pending','upheld','dismissed'];

const SEVERITY_COLORS = { minor:'green', moderate:'orange', major:'volcano', critical:'red' };
const STATUS_COLORS   = {
  open:'blue', under_investigation:'orange', resolved:'green',
  appealed:'purple', closed:'default',
};
const ACTION_COLORS = {
  verbal_warning:'cyan', written_warning:'blue', final_warning:'orange',
  suspension:'volcano', demotion:'purple', termination:'red',
  retraining:'green', fine:'gold', other:'default',
};
const TYPE_COLORS = { STAFF:'blue', CONTRACTOR:'orange', VISITOR:'cyan' };

const label = s => (s||'').replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());

// Incident type icons / context
const INCIDENT_HSE = ['safety_violation','hse_breach','substance_abuse','negligence'];

// ── component ─────────────────────────────────────────────────────────────────
const DisciplinaryManagement = () => {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  // ── state ─────────────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterType,     setFilterType]     = useState('');
  const [filterAction,   setFilterAction]   = useState('');
  const [filterPType,    setFilterPType]    = useState('');

  const [caseModalOpen,  setCaseModalOpen]  = useState(false);
  const [editingCase,    setEditingCase]    = useState(null);
  const [detailCase,     setDetailCase]     = useState(null);
  const [detailOpen,     setDetailOpen]     = useState(false);
  const [caseForm]                          = Form.useForm();

  const [activeTab, setActiveTab] = useState('cases');

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: casesRaw, isLoading, refetch } = useQuery({
    queryKey: ['disc-cases'],
    queryFn: () => apiService.get('/api/v1/personnel/disciplinary/cases'),
    staleTime: 30000,
  });
  const { data: summaryRaw, refetch: refetchSummary } = useQuery({
    queryKey: ['disc-summary'],
    queryFn: () => apiService.get('/api/v1/personnel/disciplinary/summary'),
    staleTime: 60000,
  });
  const { data: personnelRaw } = useQuery({
    queryKey: ['personnel-list-disc'],
    queryFn: () => apiService.get('/api/v1/personnel/?limit=1000'),
    staleTime: 300000,
  });

  // ── derived ───────────────────────────────────────────────────────────────
  const cases     = useMemo(() => { const r = casesRaw?.data||casesRaw||[]; return Array.isArray(r)?r:[]; }, [casesRaw]);
  const summary   = summaryRaw?.data || summaryRaw || {};
  const personnel = useMemo(() => { const r = personnelRaw?.results||personnelRaw?.data||personnelRaw||[]; return Array.isArray(r)?r:[]; }, [personnelRaw]);

  const filtered = useMemo(() => cases.filter(c => {
    if (filterStatus   && c.status !== filterStatus)           return false;
    if (filterSeverity && c.severity_level !== filterSeverity) return false;
    if (filterType     && c.incident_type !== filterType)      return false;
    if (filterAction   && c.action_type !== filterAction)      return false;
    if (filterPType    && c.personnel_type !== filterPType)    return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.personnel_name||'').toLowerCase().includes(q)
          || (c.case_number||'').toLowerCase().includes(q)
          || (c.personnel_emp_code||'').toLowerCase().includes(q)
          || (c.description||'').toLowerCase().includes(q);
    }
    return true;
  }), [cases, filterStatus, filterSeverity, filterType, filterAction, filterPType, search]);

  const invAll = () => ['disc-cases','disc-summary'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));

  // ── mutations ─────────────────────────────────────────────────────────────
  const caseMut = useMutation({
    mutationFn: d => editingCase
      ? apiService.put(`/api/v1/personnel/disciplinary/cases/${editingCase.id}`, d)
      : apiService.post('/api/v1/personnel/disciplinary/cases', d),
    onSuccess: () => { message.success(editingCase?'Case updated':'Case raised'); setCaseModalOpen(false); setEditingCase(null); invAll(); },
    onError: e => message.error(e?.response?.data?.detail||'Failed'),
  });
  const delMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/disciplinary/cases/${id}`),
    onSuccess: () => { message.success('Case deleted'); invAll(); },
    onError: e => message.error(e?.response?.data?.detail||'Delete failed'),
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action }) => apiService.put(`/api/v1/personnel/disciplinary/cases/${id}/${action}`),
    onSuccess: (_, { action }) => {
      const msgs = { investigate:'Investigation started', resolve:'Case resolved', appeal:'Appeal recorded', close:'Case closed', reopen:'Case reopened' };
      message.success(msgs[action]||'Updated');
      invAll();
    },
    onError: e => message.error(e?.response?.data?.detail||'Action failed'),
  });

  // ── handlers ──────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingCase(null); setCaseModalOpen(true);
    setTimeout(()=>{ caseForm.resetFields(); caseForm.setFieldsValue({status:'open',incident_date:dayjs()}); },0);
  };
  const openEdit = r => {
    setEditingCase(r); setCaseModalOpen(true);
    setTimeout(()=>caseForm.setFieldsValue({...r,incident_date:r.incident_date?dayjs(r.incident_date):null,resolution_date:r.resolution_date?dayjs(r.resolution_date):null}),0);
  };
  const openDetail = r => { setDetailCase(r); setDetailOpen(true); };
  const submit = () => caseForm.validateFields().then(v=>caseMut.mutate({
    ...v,
    incident_date:   v.incident_date?.format('YYYY-MM-DD'),
    resolution_date: v.resolution_date?.format('YYYY-MM-DD'),
  })).catch(()=>{});

  const personnelOptions = personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name||'')} ${(p.last_name||'')}`.trim()+(p.emp_code?` (${p.emp_code})`:'')+((p.personnel_type&&p.personnel_type!=='STAFF')?` [${p.personnel_type}]`:''),
  }));

  // ── columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      title:'Case #', dataIndex:'case_number', width:150,
      render:(n,r)=>(
        <Button type="link" style={{padding:0,fontFamily:'monospace',fontWeight:600}} onClick={()=>openDetail(r)}>{n}</Button>
      ),
    },
    {
      title:'Personnel', key:'person',
      render:(_,r)=>(
        <div>
          <Space size={4}>
            <Tag color={TYPE_COLORS[r.personnel_type]||'default'} style={{fontSize:10,padding:'0 4px'}}>{r.personnel_type||'STAFF'}</Tag>
            <span style={{fontWeight:500}}>{r.personnel_name||`ID ${r.personnel_id}`}</span>
          </Space>
          <div style={{fontSize:11,color:'#888'}}>{r.personnel_emp_code}{r.personnel_company?` · ${r.personnel_company}`:''}</div>
          {(r.open_cases_count||0)>1&&<Tag color="red" style={{fontSize:10,marginTop:2}}>⚠ {r.open_cases_count} active cases</Tag>}
        </div>
      ),
    },
    { title:'Incident Date', dataIndex:'incident_date', width:120, sorter:(a,b)=>(a.incident_date||'').localeCompare(b.incident_date||'') },
    {
      title:'Incident Type', dataIndex:'incident_type', width:150,
      render:t=>{
        if (!t) return '—';
        const isHse = INCIDENT_HSE.includes(t);
        return <Tag color={isHse?'red':'orange'} icon={isHse?<WarningOutlined/>:null}>{label(t)}</Tag>;
      },
    },
    { title:'Severity', dataIndex:'severity_level', width:100, render:s=>s?<Tag color={SEVERITY_COLORS[s]||'default'}>{label(s)}</Tag>:'—' },
    { title:'Action', dataIndex:'action_type', width:140, render:a=>a?<Tag color={ACTION_COLORS[a]||'default'}>{label(a)}</Tag>:'—' },
    {
      title:'Training Gap', key:'tgap', width:110,
      render:(_,r)=>{
        if (r.has_active_training_gap == null) return <span style={{color:'#bbb'}}>—</span>;
        return r.has_active_training_gap
          ? <Tag color="red" icon={<WarningOutlined/>} style={{fontSize:10}}>Cert Gap</Tag>
          : <Tag color="green" icon={<CheckCircleOutlined/>} style={{fontSize:10}}>Compliant</Tag>;
      },
    },
    { title:'Status', dataIndex:'status', width:150, render:s=><Tag color={STATUS_COLORS[s]||'default'}>{label(s)}</Tag> },
    {
      title:'Actions', key:'actions', fixed:'right', width:220,
      render:(_,r)=>(
        <Space size={2} wrap>
          {r.status==='open'&&<Tooltip title="Start Investigation"><Button size="small" icon={<SearchOutlined/>} onClick={()=>actionMut.mutate({id:r.id,action:'investigate'})}/></Tooltip>}
          {['open','under_investigation'].includes(r.status)&&<Tooltip title="Resolve"><Button size="small" type="primary" icon={<CheckCircleOutlined/>} style={{background:'#52c41a',borderColor:'#52c41a'}} onClick={()=>actionMut.mutate({id:r.id,action:'resolve'})}/></Tooltip>}
          {['resolved','under_investigation'].includes(r.status)&&<Tooltip title="Record Appeal"><Button size="small" icon={<AuditOutlined/>} onClick={()=>actionMut.mutate({id:r.id,action:'appeal'})}/></Tooltip>}
          {r.status!=='closed'&&<Tooltip title="Close Case"><Button size="small" icon={<CloseCircleOutlined/>} onClick={()=>modal.confirm({title:'Close this case?',onOk:()=>actionMut.mutate({id:r.id,action:'close'})})}/></Tooltip>}
          {r.status==='closed'&&<Tooltip title="Reopen"><Button size="small" icon={<ReloadOutlined/>} onClick={()=>actionMut.mutate({id:r.id,action:'reopen'})}/></Tooltip>}
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined/>} onClick={()=>openEdit(r)}/></Tooltip>
          <Popconfirm title="Delete case?" onConfirm={()=>delMut.mutate(r.id)} okText="Delete" okButtonProps={{danger:true,disabled:!['open','closed'].includes(r.status)}}>
            <Tooltip title={!['open','closed'].includes(r.status)?'Cannot delete active case':'Delete'}>
              <Button danger size="small" icon={<DeleteOutlined/>} disabled={!['open','closed'].includes(r.status)}/>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── analytics derived data ────────────────────────────────────────────────
  const analyticsData = useMemo(() => {
    // Status distribution
    const statusMap = { open:0, under_investigation:0, resolved:0, appealed:0, closed:0 };
    const severityMap = { minor:0, moderate:0, major:0, critical:0 };
    const typeMap = {};
    const actionMap = {};
    const pTypeMap = {};
    const monthMap = {};

    cases.forEach(c => {
      // status
      if (c.status in statusMap) statusMap[c.status]++;
      // severity
      if (c.severity_level && c.severity_level in severityMap) severityMap[c.severity_level]++;
      // incident type
      if (c.incident_type) typeMap[c.incident_type] = (typeMap[c.incident_type]||0)+1;
      // action
      if (c.action_type) actionMap[c.action_type] = (actionMap[c.action_type]||0)+1;
      // personnel type
      const pt = c.personnel_type||'STAFF';
      pTypeMap[pt] = (pTypeMap[pt]||0)+1;
      // monthly trend (last 12 months)
      if (c.incident_date) {
        const m = c.incident_date.slice(0,7); // YYYY-MM
        monthMap[m] = (monthMap[m]||0)+1;
      }
    });

    // Build last 12 months array
    const months = [];
    for (let i=11; i>=0; i--) {
      const d = dayjs().subtract(i,'month');
      const key = d.format('YYYY-MM');
      months.push({ month: d.format('MMM YY'), cases: monthMap[key]||0 });
    }

    const statusChartData = Object.entries(statusMap)
      .map(([k,v])=>({name:label(k), value:v, key:k}))
      .filter(d=>d.value>0);

    const severityChartData = SEVERITY_LEVELS
      .map(s=>({name:label(s), count:severityMap[s]||0, key:s}));

    const typeChartData = Object.entries(typeMap)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,8)
      .map(([k,v])=>({name:label(k), count:v, hse:INCIDENT_HSE.includes(k)}));

    const actionChartData = Object.entries(actionMap)
      .sort((a,b)=>b[1]-a[1])
      .map(([k,v])=>({name:label(k), count:v, key:k}));

    const pTypeChartData = Object.entries(pTypeMap)
      .map(([k,v])=>({name:k, value:v}));

    // Repeat offenders: group active cases by person
    const personActive = {};
    cases.filter(c=>['open','under_investigation','appealed'].includes(c.status)).forEach(c=>{
      const key = c.personnel_id;
      if (!personActive[key]) personActive[key] = { name:c.personnel_name||`ID ${c.personnel_id}`, type:c.personnel_type, count:0, emp_code:c.personnel_emp_code };
      personActive[key].count++;
    });
    const repeatOffenders = Object.values(personActive)
      .filter(p=>p.count>=2)
      .sort((a,b)=>b.count-a.count);

    // HSE vs non-HSE
    const hseTotal = cases.filter(c=>INCIDENT_HSE.includes(c.incident_type)).length;
    const nonHse   = cases.length - hseTotal;

    return { statusChartData, severityChartData, typeChartData, actionChartData, pTypeChartData, months, repeatOffenders, hseTotal, nonHse };
  }, [cases]);

  // ── chart colour palettes ─────────────────────────────────────────────────
  const STATUS_PIE_COLORS  = { open:'#1677ff', under_investigation:'#fa8c16', resolved:'#52c41a', appealed:'#722ed1', closed:'#8c8c8c' };
  const SEVERITY_BAR_COLORS= { minor:'#52c41a', moderate:'#faad14', major:'#fa541c', critical:'#f5222d' };
  const PTYPE_PIE_COLORS   = ['#1677ff','#fa8c16','#13c2c2'];

  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent*100).toFixed(0)}%`}</text>;
  };

  // ── analytics tab ─────────────────────────────────────────────────────────
  const { statusChartData, severityChartData, typeChartData, actionChartData, pTypeChartData, months, repeatOffenders, hseTotal, nonHse } = analyticsData;
  const noData = cases.length === 0;

  const SummaryTab = () => (
    <div>
      {noData && <Empty description="No disciplinary cases yet — analytics will populate as cases are raised" style={{padding:'40px 0'}}/>}

      {!noData && <>
        {/* Repeat offender alert */}
        {repeatOffenders.length>0&&(
          <Alert type="error" showIcon style={{marginBottom:16}}
            message={`${repeatOffenders.length} personnel with 2+ active cases — repeat offender risk`}
            description={
              <Space wrap style={{marginTop:4}}>
                {repeatOffenders.map(r=>(
                  <Tag key={r.name} color="red" style={{fontSize:12}}>
                    {r.name} {r.emp_code?`(${r.emp_code})`:''} — {r.count} active
                  </Tag>
                ))}
              </Space>
            }
          />
        )}

        {/* HSE risk banner */}
        {hseTotal>0&&(
          <Alert type="warning" showIcon style={{marginBottom:16}}
            message={`${hseTotal} of ${cases.length} cases are HSE-related (safety violations, breaches, substance abuse, negligence) — regulatory documentation required`}
          />
        )}

        {/* Row 1: Status donut + Monthly trend */}
        <Row gutter={16} style={{marginBottom:16}}>
          <Col span={8}>
            <Card size="small" title="Case Status Distribution">
              {statusChartData.length===0
                ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data"/>
                : <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={50} outerRadius={90} labelLine={false} label={CustomPieLabel}>
                        {statusChartData.map(d=><Cell key={d.key} fill={STATUS_PIE_COLORS[d.key]||'#bbb'}/>)}
                      </Pie>
                      <RTooltip formatter={(v,n)=>[v+' case(s)',n]}/>
                      <Legend iconType="circle" iconSize={10}/>
                    </PieChart>
                  </ResponsiveContainer>
              }
            </Card>
          </Col>
          <Col span={16}>
            <Card size="small" title="Monthly Case Trend (Last 12 Months)">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={months} margin={{top:5,right:16,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="month" tick={{fontSize:11}}/>
                  <YAxis allowDecimals={false} tick={{fontSize:11}} width={28}/>
                  <RTooltip formatter={v=>[v+' case(s)','Cases']}/>
                  <Line type="monotone" dataKey="cases" stroke="#1677ff" strokeWidth={2}
                    dot={{r:3}} activeDot={{r:5}}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Row 2: Severity + Personnel type */}
        <Row gutter={16} style={{marginBottom:16}}>
          <Col span={14}>
            <Card size="small" title="Cases by Severity Level">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={severityChartData} margin={{top:5,right:16,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="name" tick={{fontSize:11}}/>
                  <YAxis allowDecimals={false} tick={{fontSize:11}} width={28}/>
                  <RTooltip formatter={v=>[v+' case(s)','Count']}/>
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {severityChartData.map(d=><Cell key={d.key} fill={SEVERITY_BAR_COLORS[d.key]||'#bbb'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={10}>
            <Card size="small" title="Cases by Personnel Type">
              {pTypeChartData.length===0
                ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" style={{height:180}}/>
                : <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pTypeChartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        outerRadius={70} labelLine={false} label={CustomPieLabel}>
                        {pTypeChartData.map((d,i)=><Cell key={d.name} fill={PTYPE_PIE_COLORS[i%PTYPE_PIE_COLORS.length]}/>)}
                      </Pie>
                      <RTooltip formatter={(v,n)=>[v+' case(s)',n]}/>
                      <Legend iconType="circle" iconSize={10}/>
                    </PieChart>
                  </ResponsiveContainer>
              }
            </Card>
          </Col>
        </Row>

        {/* Row 3: Incident types + Actions */}
        <Row gutter={16} style={{marginBottom:16}}>
          <Col span={12}>
            <Card size="small" title="Top Incident Types">
              {typeChartData.length===0
                ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data"/>
                : <ResponsiveContainer width="100%" height={Math.max(180, typeChartData.length*36)}>
                    <BarChart data={typeChartData} layout="vertical" margin={{top:4,right:24,left:8,bottom:4}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                      <XAxis type="number" allowDecimals={false} tick={{fontSize:11}}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={130}/>
                      <RTooltip formatter={v=>[v+' case(s)','Count']}/>
                      <Bar dataKey="count" radius={[0,4,4,0]}>
                        {typeChartData.map(d=><Cell key={d.name} fill={d.hse?'#f5222d':'#fa8c16'}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
              <div style={{marginTop:8,fontSize:11,color:'#888'}}>
                <span style={{display:'inline-block',width:10,height:10,background:'#f5222d',borderRadius:2,marginRight:4}}/>HSE-related
                <span style={{display:'inline-block',width:10,height:10,background:'#fa8c16',borderRadius:2,marginLeft:12,marginRight:4}}/>Other
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title="Actions Taken">
              {actionChartData.length===0
                ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No actions recorded yet"/>
                : <ResponsiveContainer width="100%" height={Math.max(180, actionChartData.length*36)}>
                    <BarChart data={actionChartData} layout="vertical" margin={{top:4,right:24,left:8,bottom:4}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
                      <XAxis type="number" allowDecimals={false} tick={{fontSize:11}}/>
                      <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={120}/>
                      <RTooltip formatter={v=>[v+' case(s)','Count']}/>
                      <Bar dataKey="count" radius={[0,4,4,0]}>
                        {actionChartData.map(d=><Cell key={d.key}
                          fill={d.key==='termination'?'#f5222d':d.key==='suspension'?'#fa541c':d.key==='final_warning'?'#fa8c16':d.key==='written_warning'?'#1677ff':d.key==='retraining'?'#52c41a':'#8c8c8c'}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
            </Card>
          </Col>
        </Row>

        {/* Row 4: Repeat offenders table */}
        {repeatOffenders.length>0&&(
          <Card size="small" title={<span style={{color:'#cf1322'}}>⚠ Repeat Offenders — Active Cases</span>}>
            <Table
              size="small"
              dataSource={repeatOffenders}
              rowKey="name"
              pagination={false}
              columns={[
                { title:'Personnel', dataIndex:'name', render:(n,r)=><Space size={4}><Tag color={TYPE_COLORS[r.type]||'default'} style={{fontSize:10}}>{r.type||'STAFF'}</Tag><b>{n}</b>{r.emp_code&&<span style={{color:'#888',fontSize:11}}>({r.emp_code})</span>}</Space> },
                { title:'Active Cases', dataIndex:'count', width:120, render:n=><Tag color="red" style={{fontWeight:700,fontSize:13}}>{n}</Tag> },
                { title:'Risk Level', key:'risk', width:120, render:(_,r)=>r.count>=3?<Tag color="red">High Risk</Tag>:<Tag color="orange">Elevated</Tag> },
              ]}
            />
          </Card>
        )}
      </>}
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────
  const openCount  = cases.filter(c=>c.status==='open').length;
  const activeCount= cases.filter(c=>['open','under_investigation','appealed'].includes(c.status)).length;
  const critCount  = cases.filter(c=>c.severity_level==='critical').length;
  const hseCount   = cases.filter(c=>INCIDENT_HSE.includes(c.incident_type)).length;

  return (
    <div style={{padding:24}}>
      {/* Stats */}
      <Row gutter={16} style={{marginBottom:24}}>
        {[
          {title:'Total Cases',   value:summary.total??cases.length,     color:'#1677ff', icon:<FileProtectOutlined/>},
          {title:'Active',        value:activeCount,                       color:'#fa8c16', icon:<ExclamationCircleOutlined/>},
          {title:'Critical',      value:critCount,                         color:'#f5222d', icon:<WarningOutlined/>},
          {title:'HSE Violations',value:hseCount,                          color:'#cf1322', icon:<SafetyCertificateOutlined/>},
        ].map(s=>(
          <Col span={6} key={s.title}>
            <Card size="small"><Statistic title={s.title} value={s.value} valueStyle={{color:s.color}} prefix={s.icon}/></Card>
          </Col>
        ))}
      </Row>

      {critCount>0&&<Alert type="error" showIcon style={{marginBottom:12}} message={`${critCount} critical severity case(s) require immediate attention`}/>}
      {openCount>0&&<Alert type="warning" showIcon style={{marginBottom:12}} message={`${openCount} case(s) are open and awaiting investigation`}/>}

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[

          // ── CASES ──────────────────────────────────────────────────────────
          {
            key:'cases',
            label:<span><FileProtectOutlined style={{marginRight:4}}/>Cases {activeCount>0&&<Badge count={activeCount} size="small" style={{marginLeft:6}}/>}</span>,
            children:(
              <>
                <Row gutter={12} style={{marginBottom:16}}>
                  <Col span={5}><Input placeholder="Search name, case #, ID..." value={search} onChange={e=>setSearch(e.target.value)} allowClear prefix={<SearchOutlined/>}/></Col>
                  <Col span={3}>
                    <Select placeholder="Type" style={{width:'100%'}} value={filterPType||undefined} onChange={v=>setFilterPType(v||'')} allowClear>
                      {['STAFF','CONTRACTOR','VISITOR'].map(t=><Select.Option key={t} value={t}>{t}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={3}>
                    <Select placeholder="Status" style={{width:'100%'}} value={filterStatus||undefined} onChange={v=>setFilterStatus(v||'')} allowClear>
                      {STATUSES.map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={3}>
                    <Select placeholder="Severity" style={{width:'100%'}} value={filterSeverity||undefined} onChange={v=>setFilterSeverity(v||'')} allowClear>
                      {SEVERITY_LEVELS.map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Select placeholder="Incident Type" style={{width:'100%'}} value={filterType||undefined} onChange={v=>setFilterType(v||'')} allowClear>
                      {INCIDENT_TYPES.map(t=><Select.Option key={t} value={t}>{label(t)}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={6}>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined/>} onClick={openAdd}>Raise Case</Button>
                      <Button icon={<ReloadOutlined/>} onClick={()=>{refetch();refetchSummary();}}/>
                    </Space>
                  </Col>
                </Row>
                <Table
                  columns={columns} dataSource={filtered} loading={isLoading}
                  rowKey="id" size="small" scroll={{x:1500}}
                  pagination={{pageSize:20,showSizeChanger:true,showTotal:t=>`${t} case(s)`}}
                  rowClassName={r=>r.severity_level==='critical'?'ant-table-row-danger':r.severity_level==='major'?'ant-table-row-warning':''}
                />
              </>
            ),
          },

          // ── SUMMARY ────────────────────────────────────────────────────────
          {
            key:'summary',
            label:<span><AuditOutlined style={{marginRight:4}}/>Analytics</span>,
            children:<SummaryTab/>,
          },

        ]}/>
      </Card>

      {/* ── Case Form Modal ────────────────────────────────────── */}
      <Modal
        title={editingCase?`Edit Case — ${editingCase.case_number}`:'Raise Disciplinary Case'}
        open={caseModalOpen}
        onOk={submit} onCancel={()=>{setCaseModalOpen(false);setEditingCase(null);}}
        confirmLoading={caseMut.isPending} width={740} forceRender
      >
        <Form form={caseForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Personnel" rules={[{required:true,message:'Select person'}]}>
                <Select showSearch placeholder="Select person" options={personnelOptions} disabled={!!editingCase}
                  filterOption={(i,o)=>(o?.label??'').toLowerCase().includes(i.toLowerCase())}/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="case_number" label="Case Number (auto-generated if blank)">
                <Input placeholder="e.g. DISC-2026-0001" maxLength={50} disabled={!!editingCase}/>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="incident_date" label="Incident Date" rules={[{required:true,message:'Select date'}]}>
                <DatePicker style={{width:'100%'}} format="YYYY-MM-DD"/>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="incident_type" label="Incident Type" rules={[{required:true,message:'Select type'}]}>
                <Select placeholder="Select type">
                  {INCIDENT_TYPES.map(t=><Select.Option key={t} value={t}>{label(t)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="severity_level" label="Severity" rules={[{required:true,message:'Select severity'}]}>
                <Select placeholder="Select severity">
                  {SEVERITY_LEVELS.map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="action_type" label="Action Taken">
                <Select placeholder="Select action" allowClear>
                  {ACTION_TYPES.map(a=><Select.Option key={a} value={a}>{label(a)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select>
                  {STATUSES.map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="appeal_status" label="Appeal Status">
                <Select placeholder="N/A" allowClear>
                  {APPEAL_STATUSES.map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Incident Description" rules={[{required:true,message:'Describe the incident'}]}>
            <Input.TextArea rows={3} placeholder="Describe what happened, where, and who was involved..." maxLength={2000} showCount/>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="resolution_date" label="Resolution Date">
                <DatePicker style={{width:'100%'}} format="YYYY-MM-DD"/>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="resolution_notes" label="Resolution / Decision Notes">
            <Input.TextArea rows={2} placeholder="Document the outcome, decision rationale, or corrective actions..." maxLength={2000} showCount/>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Case Detail Modal ──────────────────────────────────── */}
      <Modal
        title={<span><FileProtectOutlined style={{marginRight:8}}/>{detailCase?.case_number}</span>}
        open={detailOpen} onCancel={()=>setDetailOpen(false)} footer={[
          <Button key="edit" onClick={()=>{setDetailOpen(false);openEdit(detailCase);}}>Edit Case</Button>,
          <Button key="close" type="primary" onClick={()=>setDetailOpen(false)}>Close</Button>,
        ]} width={680}
      >
        {detailCase&&(
          <div>
            <Row gutter={16} style={{marginBottom:16}}>
              <Col span={12}>
                <div style={{fontSize:12,color:'#888'}}>Personnel</div>
                <Space size={4}>
                  <Tag color={TYPE_COLORS[detailCase.personnel_type]||'default'}>{detailCase.personnel_type||'STAFF'}</Tag>
                  <span style={{fontWeight:600}}>{detailCase.personnel_name}</span>
                </Space>
                <div style={{fontSize:12,color:'#888'}}>{detailCase.personnel_emp_code}</div>
              </Col>
              <Col span={12}>
                <div style={{fontSize:12,color:'#888'}}>Status</div>
                <Tag color={STATUS_COLORS[detailCase.status]||'default'} style={{fontSize:13}}>{label(detailCase.status)}</Tag>
                {detailCase.has_active_training_gap&&<Tag color="red" style={{fontSize:11,marginLeft:4}}>⚠ Training Gap</Tag>}
              </Col>
            </Row>
            <Row gutter={16} style={{marginBottom:16}}>
              <Col span={8}><div style={{fontSize:12,color:'#888'}}>Incident Date</div><b>{detailCase.incident_date}</b></Col>
              <Col span={8}><div style={{fontSize:12,color:'#888'}}>Incident Type</div><Tag color={INCIDENT_HSE.includes(detailCase.incident_type)?'red':'orange'}>{label(detailCase.incident_type)}</Tag></Col>
              <Col span={8}><div style={{fontSize:12,color:'#888'}}>Severity</div><Tag color={SEVERITY_COLORS[detailCase.severity_level]||'default'}>{label(detailCase.severity_level)}</Tag></Col>
            </Row>
            {detailCase.action_type&&<Row style={{marginBottom:16}}><Col><div style={{fontSize:12,color:'#888'}}>Action Taken</div><Tag color={ACTION_COLORS[detailCase.action_type]||'default'}>{label(detailCase.action_type)}</Tag></Col></Row>}
            <Divider style={{margin:'8px 0'}}/>
            <div style={{fontSize:12,color:'#888',marginBottom:4}}>Incident Description</div>
            <div style={{background:'#fafafa',padding:'8px 12px',borderRadius:6,marginBottom:12}}>{detailCase.description||'—'}</div>
            {detailCase.resolution_notes&&<>
              <div style={{fontSize:12,color:'#888',marginBottom:4}}>Resolution / Decision</div>
              <div style={{background:'#f6ffed',padding:'8px 12px',borderRadius:6,border:'1px solid #b7eb8f',marginBottom:12}}>{detailCase.resolution_notes}</div>
            </>}
            {detailCase.appeal_status&&<Row><Col><div style={{fontSize:12,color:'#888'}}>Appeal Status</div><Tag color="purple">{label(detailCase.appeal_status)}</Tag></Col></Row>}
            <Divider style={{margin:'8px 0'}}/>
            <div style={{fontSize:12,color:'#888'}}>Case timeline</div>
            <Timeline style={{marginTop:8}} items={[
              {color:'blue',  children:`Case raised — ${detailCase.created_at?.slice(0,10)||'—'}`},
              ...(detailCase.status!=='open'?[{color:'orange',children:`Investigation / Action — ${detailCase.updated_at?.slice(0,10)||'—'}`}]:[]),
              ...(detailCase.resolution_date?[{color:'green',children:`Resolved — ${detailCase.resolution_date}`}]:[]),
              ...(detailCase.appeal_status?[{color:'purple',children:`Appeal: ${label(detailCase.appeal_status)}`}]:[]),
              ...(detailCase.status==='closed'?[{color:'default',children:'Case closed'}]:[]),
            ]}/>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DisciplinaryManagement;
