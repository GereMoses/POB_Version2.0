import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Card, Row, Col,
  Tag, Popconfirm, DatePicker, InputNumber, Tabs, Statistic, Tooltip,
  Alert, Badge, App, Progress, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  TrophyOutlined, CalendarOutlined, UserOutlined, CheckCircleOutlined,
  CloseCircleOutlined, PlayCircleOutlined, FileProtectOutlined,
  ExclamationCircleOutlined, SendOutlined, SafetyCertificateOutlined,
  WarningOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

// ── constants ──────────────────────────────────────────────────────────────────
const STATUSES   = ['draft','submitted','in_progress','completed','approved','rejected'];
const RATINGS    = ['excellent','very_good','good','satisfactory','needs_improvement','poor'];
const CYCLE_STATUSES = ['open','closed','draft'];

const STATUS_COLORS = {
  draft:'default', submitted:'blue', in_progress:'orange',
  completed:'cyan', approved:'green', rejected:'red',
};
const RATING_COLORS = {
  excellent:'#722ed1', very_good:'#1677ff', good:'#52c41a',
  satisfactory:'#faad14', needs_improvement:'#fa8c16', poor:'#f5222d',
};
const TYPE_COLORS = { STAFF:'blue', CONTRACTOR:'orange', VISITOR:'cyan' };

const label = s => (s || '').replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());

const ratingStars = r => {
  const map = { excellent:5, very_good:4, good:3, satisfactory:2, needs_improvement:1, poor:0 };
  const n = map[r] ?? null;
  if (n === null) return null;
  return '★'.repeat(n) + '☆'.repeat(5 - n);
};

// ── component ──────────────────────────────────────────────────────────────────
const PerformanceManagement = () => {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  // ── filters ──────────────────────────────────────────────────────────────────
  const [cycleSearch,   setCycleSearch]   = useState('');
  const [cycleStatus,   setCycleStatus]   = useState('');
  const [apprSearch,    setApprSearch]    = useState('');
  const [apprStatus,    setApprStatus]    = useState('');
  const [apprRating,    setApprRating]    = useState('');
  const [apprType,      setApprType]      = useState('');
  const [apprCycle,     setApprCycle]     = useState('');

  // ── modals ────────────────────────────────────────────────────────────────────
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [editingCycle,   setEditingCycle]   = useState(null);
  const [cycleForm]                         = Form.useForm();

  const [apprModalOpen, setApprModalOpen]   = useState(false);
  const [editingAppr,   setEditingAppr]     = useState(null);
  const [apprForm]                          = Form.useForm();

  const [activeTab, setActiveTab] = useState('appraisals');

  // ── queries ───────────────────────────────────────────────────────────────────
  const { data: cyclesRaw, isLoading: cyclesLoading, refetch: refetchCycles } = useQuery({
    queryKey: ['perf-cycles'],
    queryFn: () => apiService.get('/api/v1/personnel/performance/cycles'),
    staleTime: 60000,
  });
  const { data: appraisalsRaw, isLoading: apprLoading, refetch: refetchAppr } = useQuery({
    queryKey: ['perf-appraisals'],
    queryFn: () => apiService.get('/api/v1/personnel/performance/appraisals'),
    staleTime: 30000,
  });
  const { data: summaryRaw } = useQuery({
    queryKey: ['perf-summary'],
    queryFn: () => apiService.get('/api/v1/personnel/performance/summary'),
    staleTime: 60000,
  });
  const { data: personnelRaw } = useQuery({
    queryKey: ['personnel-list-perf'],
    queryFn: () => apiService.get('/api/v1/personnel/?limit=1000'),
    staleTime: 300000,
  });

  // ── derived ───────────────────────────────────────────────────────────────────
  const cycles     = useMemo(() => { const r = cyclesRaw?.data||cyclesRaw||[]; return Array.isArray(r)?r:[]; }, [cyclesRaw]);
  const appraisals = useMemo(() => { const r = appraisalsRaw?.data||appraisalsRaw||[]; return Array.isArray(r)?r:[]; }, [appraisalsRaw]);
  const summary    = summaryRaw?.data || summaryRaw || {};
  const personnel  = useMemo(() => { const r = personnelRaw?.results||personnelRaw?.data||personnelRaw||[]; return Array.isArray(r)?r:[]; }, [personnelRaw]);

  const filteredCycles = useMemo(() => cycles.filter(c => {
    if (cycleStatus && c.status !== cycleStatus) return false;
    if (cycleSearch) { const q = cycleSearch.toLowerCase(); return (c.cycle_name||'').toLowerCase().includes(q)||(c.cycle_code||'').toLowerCase().includes(q); }
    return true;
  }), [cycles, cycleStatus, cycleSearch]);

  const filteredAppraisals = useMemo(() => appraisals.filter(a => {
    if (apprStatus && a.status !== apprStatus) return false;
    if (apprRating && a.overall_rating !== apprRating) return false;
    if (apprType && a.personnel_type !== apprType) return false;
    if (apprCycle && String(a.cycle_id) !== String(apprCycle)) return false;
    if (apprSearch) {
      const q = apprSearch.toLowerCase();
      return (a.personnel_name||'').toLowerCase().includes(q)
          || (a.personnel_emp_code||'').toLowerCase().includes(q)
          || (a.cycle_name||'').toLowerCase().includes(q);
    }
    return true;
  }), [appraisals, apprStatus, apprRating, apprType, apprCycle, apprSearch]);

  // ── invalidators ─────────────────────────────────────────────────────────────
  const invAll = () => ['perf-cycles','perf-appraisals','perf-summary'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));

  // ── mutations ─────────────────────────────────────────────────────────────────
  const cycleMut = useMutation({
    mutationFn: d => editingCycle
      ? apiService.put(`/api/v1/personnel/performance/cycles/${editingCycle.id}`, d)
      : apiService.post('/api/v1/personnel/performance/cycles', d),
    onSuccess: () => { message.success(editingCycle?'Cycle updated':'Cycle created'); setCycleModalOpen(false); setEditingCycle(null); invAll(); },
    onError: e => message.error(e?.response?.data?.detail||'Failed'),
  });
  const delCycleMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/performance/cycles/${id}`),
    onSuccess: () => { message.success('Cycle deleted'); invAll(); },
    onError: e => message.error(e?.response?.data?.detail||'Delete failed'),
  });

  const apprMut = useMutation({
    mutationFn: d => editingAppr
      ? apiService.put(`/api/v1/personnel/performance/appraisals/${editingAppr.id}`, d)
      : apiService.post('/api/v1/personnel/performance/appraisals', d),
    onSuccess: () => { message.success(editingAppr?'Appraisal updated':'Appraisal created'); setApprModalOpen(false); setEditingAppr(null); invAll(); },
    onError: e => message.error(e?.response?.data?.detail||'Failed'),
  });
  const delApprMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/performance/appraisals/${id}`),
    onSuccess: () => { message.success('Deleted'); invAll(); },
    onError: e => message.error(e?.response?.data?.detail||'Delete failed'),
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action }) => apiService.put(`/api/v1/personnel/performance/appraisals/${id}/${action}`),
    onSuccess: (_, { action }) => {
      const msgs = { submit:'Submitted for review', start:'Review started', complete:'Marked complete', approve:'Appraisal approved', reject:'Appraisal rejected', reopen:'Reopened as draft' };
      message.success(msgs[action]||'Updated');
      invAll();
    },
    onError: e => message.error(e?.response?.data?.detail||'Action failed'),
  });

  // ── handlers ──────────────────────────────────────────────────────────────────
  const openAddCycle = () => { setEditingCycle(null); setCycleModalOpen(true); setTimeout(()=>{ cycleForm.resetFields(); cycleForm.setFieldsValue({status:'open'}); },0); };
  const openEditCycle = r => { setEditingCycle(r); setCycleModalOpen(true); setTimeout(()=>cycleForm.setFieldsValue({...r,start_date:r.start_date?dayjs(r.start_date):null,end_date:r.end_date?dayjs(r.end_date):null}),0); };
  const submitCycle = () => cycleForm.validateFields().then(v=>cycleMut.mutate({...v,start_date:v.start_date?.format('YYYY-MM-DD'),end_date:v.end_date?.format('YYYY-MM-DD')})).catch(()=>{});

  const openAddAppr = (prefill={}) => {
    setEditingAppr(null); setApprModalOpen(true);
    setTimeout(()=>{ apprForm.resetFields(); apprForm.setFieldsValue({status:'draft',appraisal_date:dayjs(),...prefill}); },0);
  };
  const openEditAppr = r => {
    setEditingAppr(r); setApprModalOpen(true);
    setTimeout(()=>apprForm.setFieldsValue({...r,appraisal_date:r.appraisal_date?dayjs(r.appraisal_date):null}),0);
  };
  const submitAppr = () => apprForm.validateFields().then(v=>apprMut.mutate({...v,appraisal_date:v.appraisal_date?.format('YYYY-MM-DD')})).catch(()=>{});

  // ── options ───────────────────────────────────────────────────────────────────
  const personnelOptions = personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name||'')} ${(p.last_name||'')}`.trim()+(p.emp_code?` (${p.emp_code})`:'')+((p.personnel_type&&p.personnel_type!=='STAFF')?` [${p.personnel_type}]`:''),
  }));
  const cycleOptions = cycles.map(c => ({ value: c.id, label: `${c.cycle_code} — ${c.cycle_name}` }));

  // ── columns ───────────────────────────────────────────────────────────────────
  const cycleColumns = [
    { title:'Code', dataIndex:'cycle_code', width:120, render:c=><Tag style={{fontFamily:'monospace'}}>{c}</Tag> },
    { title:'Cycle Name', dataIndex:'cycle_name', sorter:(a,b)=>a.cycle_name.localeCompare(b.cycle_name) },
    { title:'Period', key:'period', render:(_,r)=>`${r.start_date} → ${r.end_date}` },
    { title:'Status', dataIndex:'status', width:110, render:s=><Tag color={s==='open'?'green':s==='closed'?'default':'orange'}>{label(s||'open')}</Tag> },
    { title:'Appraisals', dataIndex:'appraisal_count', width:100, render:n=><Badge count={n??0} showZero color="#1677ff"/> },
    {
      title:'Actions', key:'actions', fixed:'right', width:120,
      render:(_,r)=>(
        <Space>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined/>} onClick={()=>openEditCycle(r)}/></Tooltip>
          <Popconfirm title="Delete cycle?" onConfirm={()=>delCycleMut.mutate(r.id)} okText="Delete" okButtonProps={{danger:true,disabled:(r.appraisal_count||0)>0}}>
            <Tooltip title={(r.appraisal_count||0)>0?'Has appraisals — cannot delete':'Delete'}>
              <Button danger size="small" icon={<DeleteOutlined/>} disabled={(r.appraisal_count||0)>0}/>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const apprColumns = [
    {
      title:'Personnel', key:'person', sorter:(a,b)=>(a.personnel_name||'').localeCompare(b.personnel_name||''),
      render:(_,r)=>(
        <div>
          <Space size={4}>
            <Tag color={TYPE_COLORS[r.personnel_type]||'default'} style={{fontSize:10,padding:'0 4px'}}>{r.personnel_type||'STAFF'}</Tag>
            <span style={{fontWeight:500}}>{r.personnel_name||`ID ${r.personnel_id}`}</span>
          </Space>
          <div style={{fontSize:11,color:'#888'}}>{r.personnel_emp_code}{r.personnel_company?` · ${r.personnel_company}`:''}</div>
        </div>
      ),
    },
    {
      title:'Cycle', key:'cycle',
      render:(_,r)=><div><div style={{fontSize:12,fontWeight:500}}>{r.cycle_name||`Cycle ${r.cycle_id}`}</div><Tag style={{fontSize:10,fontFamily:'monospace'}}>{r.cycle_code}</Tag></div>,
    },
    { title:'Date', dataIndex:'appraisal_date', width:110, sorter:(a,b)=>(a.appraisal_date||'').localeCompare(b.appraisal_date||'') },
    {
      title:'Score', key:'scores', width:140,
      render:(_,r)=>(
        <div>
          {r.performance_score!=null&&<div style={{fontSize:11}}><span style={{color:'#888'}}>Score:</span> <b>{Number(r.performance_score).toFixed(0)}%</b></div>}
          {r.goals_achieved!=null&&<div style={{fontSize:11}}><span style={{color:'#888'}}>Goals:</span> <b>{Number(r.goals_achieved).toFixed(0)}%</b></div>}
        </div>
      ),
    },
    {
      title:'Rating', dataIndex:'overall_rating', width:160,
      render:r=>r?(
        <div>
          <Tag color={RATING_COLORS[r]||'default'}>{label(r)}</Tag>
          <div style={{fontSize:11,color:'#faad14',letterSpacing:1}}>{ratingStars(r)}</div>
        </div>
      ):'—',
    },
    {
      title:'Training', key:'training', width:110,
      render:(_,r)=>{
        if (r.training_compliance == null) return <span style={{color:'#bbb',fontSize:12}}>—</span>;
        const color = r.training_compliance>=80?'#52c41a':r.training_compliance>=50?'#faad14':'#f5222d';
        return (
          <Tooltip title={`${r.expired_certs||0} expired mandatory cert(s)`}>
            <div>
              <Progress percent={r.training_compliance} size="small" strokeColor={color} format={p=>`${p}%`} style={{width:80}}/>
              {r.expired_certs>0&&<Tag color="red" style={{fontSize:10,marginTop:2}}>{r.expired_certs} expired</Tag>}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title:'Status', dataIndex:'status', width:120,
      render:s=><Tag color={STATUS_COLORS[s]||'default'}>{label(s)}</Tag>,
    },
    {
      title:'Actions', key:'actions', fixed:'right', width:200,
      render:(_,r)=>(
        <Space size={2} wrap>
          {r.status==='draft'&&<Tooltip title="Submit for Review"><Button size="small" type="primary" icon={<SendOutlined/>} onClick={()=>actionMut.mutate({id:r.id,action:'submit'})}/></Tooltip>}
          {r.status==='submitted'&&<Tooltip title="Start Review"><Button size="small" icon={<PlayCircleOutlined/>} onClick={()=>actionMut.mutate({id:r.id,action:'start'})}/></Tooltip>}
          {r.status==='in_progress'&&<Tooltip title="Mark Complete"><Button size="small" type="primary" icon={<CheckCircleOutlined/>} onClick={()=>actionMut.mutate({id:r.id,action:'complete'})}/></Tooltip>}
          {r.status==='completed'&&<>
            <Tooltip title="Approve"><Button size="small" type="primary" icon={<CheckCircleOutlined/>} style={{background:'#52c41a',borderColor:'#52c41a'}} onClick={()=>actionMut.mutate({id:r.id,action:'approve'})}/></Tooltip>
            <Tooltip title="Reject"><Button size="small" danger icon={<CloseCircleOutlined/>} onClick={()=>actionMut.mutate({id:r.id,action:'reject'})}/></Tooltip>
          </>}
          {r.status==='rejected'&&<Tooltip title="Reopen as Draft"><Button size="small" icon={<ReloadOutlined/>} onClick={()=>actionMut.mutate({id:r.id,action:'reopen'})}/></Tooltip>}
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined/>} onClick={()=>openEditAppr(r)}/></Tooltip>
          <Popconfirm title="Delete appraisal?" onConfirm={()=>delApprMut.mutate(r.id)} okText="Delete" okButtonProps={{danger:true,disabled:r.status==='approved'}}>
            <Tooltip title={r.status==='approved'?'Cannot delete approved appraisal':'Delete'}>
              <Button danger size="small" icon={<DeleteOutlined/>} disabled={r.status==='approved'}/>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── render ────────────────────────────────────────────────────────────────────
  const pendingReview = appraisals.filter(a=>['submitted','in_progress'].includes(a.status)).length;
  const lowTrainingCount = appraisals.filter(a=>a.training_compliance!=null&&a.training_compliance<70).length;

  return (
    <div style={{padding:24}}>
      {/* Stats */}
      <Row gutter={16} style={{marginBottom:24}}>
        {[
          { title:'Total Appraisals', value:summary.total??appraisals.length,        color:'#1677ff', icon:<FileProtectOutlined/> },
          { title:'Open Cycles',      value:summary.open_cycles??cycles.filter(c=>c.status==='open').length, color:'#52c41a', icon:<CalendarOutlined/> },
          { title:'Pending Review',   value:pendingReview,                             color:'#fa8c16', icon:<ExclamationCircleOutlined/> },
          { title:'Avg Score',        value:summary.avg_score!=null?`${summary.avg_score}%`:'—', color:'#722ed1', icon:<TrophyOutlined/> },
        ].map(s=>(
          <Col span={6} key={s.title}>
            <Card size="small"><Statistic title={s.title} value={s.value} valueStyle={{color:s.color}} prefix={s.icon}/></Card>
          </Col>
        ))}
      </Row>

      {/* Alerts */}
      {pendingReview>0&&<Alert type="warning" showIcon style={{marginBottom:12}} message={`${pendingReview} appraisal(s) are awaiting review action`}/>}
      {lowTrainingCount>0&&(
        <Alert type="error" showIcon style={{marginBottom:12}}
          message={`${lowTrainingCount} personnel have training compliance below 70% — review recommended`}
          description="Personnel with low training compliance may have expired mandatory certifications. Check the Training Management module."
        />
      )}

      {/* Personnel type breakdown */}
      {summary.by_type&&Object.keys(summary.by_type).length>0&&(
        <Row gutter={8} style={{marginBottom:16}}>
          {Object.entries(summary.by_type).map(([type,count])=>(
            <Col key={type}>
              <Tag color={TYPE_COLORS[type]||'default'} style={{padding:'4px 10px',fontSize:13}}>
                <TeamOutlined style={{marginRight:4}}/>{type}: {count}
              </Tag>
            </Col>
          ))}
        </Row>
      )}

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[

          // ── APPRAISALS ──────────────────────────────────────────────────────
          {
            key:'appraisals',
            label:<span><FileProtectOutlined style={{marginRight:4}}/>Appraisals {pendingReview>0&&<Badge count={pendingReview} size="small" style={{marginLeft:6}}/>}</span>,
            children:(
              <>
                <Row gutter={12} style={{marginBottom:16}}>
                  <Col span={5}><Input placeholder="Search person or cycle..." value={apprSearch} onChange={e=>setApprSearch(e.target.value)} allowClear/></Col>
                  <Col span={4}>
                    <Select placeholder="Cycle" style={{width:'100%'}} value={apprCycle||undefined} onChange={v=>setApprCycle(v||'')} allowClear>
                      {cycles.map(c=><Select.Option key={c.id} value={c.id}>{c.cycle_code}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={3}>
                    <Select placeholder="Type" style={{width:'100%'}} value={apprType||undefined} onChange={v=>setApprType(v||'')} allowClear>
                      {['STAFF','CONTRACTOR','VISITOR'].map(t=><Select.Option key={t} value={t}>{t}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Select placeholder="Status" style={{width:'100%'}} value={apprStatus||undefined} onChange={v=>setApprStatus(v||'')} allowClear>
                      {STATUSES.map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Select placeholder="Rating" style={{width:'100%'}} value={apprRating||undefined} onChange={v=>setApprRating(v||'')} allowClear>
                      {RATINGS.map(r=><Select.Option key={r} value={r}>{label(r)}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined/>} onClick={()=>openAddAppr()}>New Appraisal</Button>
                      <Button icon={<ReloadOutlined/>} onClick={refetchAppr}/>
                    </Space>
                  </Col>
                </Row>
                <Table
                  columns={apprColumns} dataSource={filteredAppraisals} loading={apprLoading}
                  rowKey="id" size="small" scroll={{x:1400}}
                  pagination={{pageSize:20,showSizeChanger:true,showTotal:t=>`Total ${t}`}}
                  rowClassName={r=>r.training_compliance!=null&&r.training_compliance<70?'ant-table-row-warning':''}
                />
              </>
            ),
          },

          // ── CYCLES ──────────────────────────────────────────────────────────
          {
            key:'cycles',
            label:<span><CalendarOutlined style={{marginRight:4}}/>Appraisal Cycles</span>,
            children:(
              <>
                <Row gutter={12} style={{marginBottom:16}}>
                  <Col span={8}><Input placeholder="Search name or code..." value={cycleSearch} onChange={e=>setCycleSearch(e.target.value)} allowClear/></Col>
                  <Col span={4}>
                    <Select placeholder="All Statuses" style={{width:'100%'}} value={cycleStatus||undefined} onChange={v=>setCycleStatus(v||'')} allowClear>
                      {CYCLE_STATUSES.map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={12}>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined/>} onClick={openAddCycle}>New Cycle</Button>
                      <Button icon={<ReloadOutlined/>} onClick={refetchCycles}/>
                    </Space>
                  </Col>
                </Row>
                <Table
                  columns={cycleColumns} dataSource={filteredCycles} loading={cyclesLoading}
                  rowKey="id" size="small" scroll={{x:800}}
                  pagination={{pageSize:20,showSizeChanger:true,showTotal:t=>`Total ${t}`}}
                />
              </>
            ),
          },

        ]}/>
      </Card>

      {/* ── Cycle Modal ──────────────────────────────────────── */}
      <Modal title={editingCycle?'Edit Appraisal Cycle':'New Appraisal Cycle'} open={cycleModalOpen}
        onOk={submitCycle} onCancel={()=>{setCycleModalOpen(false);setEditingCycle(null);}}
        confirmLoading={cycleMut.isPending} width={640} forceRender>
        <Form form={cycleForm} layout="vertical">
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="cycle_code" label="Cycle Code" rules={[{required:true,message:'Enter code'}]}>
                <Input placeholder="e.g. Q1-2026" maxLength={20} disabled={!!editingCycle}/>
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="cycle_name" label="Cycle Name" rules={[{required:true,message:'Enter name'}]}>
                <Input placeholder="e.g. Q1 2026 Offshore Review" maxLength={100}/>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_date" label="Start Date" rules={[{required:true,message:'Select date'}]}>
                <DatePicker style={{width:'100%'}} format="YYYY-MM-DD"/>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_date" label="End Date" rules={[{required:true,message:'Select date'}]}>
                <DatePicker style={{width:'100%'}} format="YYYY-MM-DD"/>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select>
                  {CYCLE_STATUSES.map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={500} showCount/>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Appraisal Modal ──────────────────────────────────── */}
      <Modal title={editingAppr?'Edit Appraisal':'New Performance Appraisal'} open={apprModalOpen}
        onOk={submitAppr} onCancel={()=>{setApprModalOpen(false);setEditingAppr(null);}}
        confirmLoading={apprMut.isPending} width={720} forceRender>
        <Form form={apprForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Personnel (Staff / Contractor / Visitor)" rules={[{required:true,message:'Select person'}]}>
                <Select showSearch placeholder="Select person" options={personnelOptions} disabled={!!editingAppr}
                  filterOption={(i,o)=>(o?.label??'').toLowerCase().includes(i.toLowerCase())}/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cycle_id" label="Appraisal Cycle" rules={[{required:true,message:'Select cycle'}]}>
                <Select showSearch placeholder="Select cycle" options={cycleOptions} disabled={!!editingAppr}
                  filterOption={(i,o)=>(o?.label??'').toLowerCase().includes(i.toLowerCase())}/>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="appraisal_date" label="Appraisal Date" rules={[{required:true,message:'Select date'}]}>
                <DatePicker style={{width:'100%'}} format="YYYY-MM-DD"/>
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
              <Form.Item name="overall_rating" label="Overall Rating">
                <Select allowClear placeholder="Select rating">
                  {RATINGS.map(r=><Select.Option key={r} value={r}>{label(r)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="performance_score" label="Performance Score (0–100)">
                <InputNumber min={0} max={100} style={{width:'100%'}} placeholder="Overall performance score"/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="goals_achieved" label="Goals Achieved (%)">
                <InputNumber min={0} max={100} style={{width:'100%'}} placeholder="% of set goals achieved"/>
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{margin:'8px 0'}}/>
          <Form.Item name="strengths" label="Strengths">
            <Input.TextArea rows={2} placeholder="Key strengths observed during this period" maxLength={1000} showCount/>
          </Form.Item>
          <Form.Item name="areas_for_improvement" label="Areas for Improvement / Training Needs">
            <Input.TextArea rows={2} placeholder="Identify skill gaps or mandatory training renewals needed" maxLength={1000} showCount/>
          </Form.Item>
          <Form.Item name="comments" label="Reviewer Comments">
            <Input.TextArea rows={2} placeholder="Additional notes from the reviewer" maxLength={1000} showCount/>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PerformanceManagement;
