import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Card, Row, Col,
  Tag, Popconfirm, DatePicker, InputNumber, Tabs, Switch, Statistic,
  Tooltip, Progress, Alert, Badge, App, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  BookOutlined, UserOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
  CloseCircleOutlined, PlayCircleOutlined, ExclamationCircleOutlined,
  FileProtectOutlined, WarningOutlined, TeamOutlined, DownloadOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import CertificateTemplate from './CertificateTemplate';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const CATEGORY_COLORS = {
  safety: 'red', technical: 'blue', compliance: 'orange', soft_skills: 'cyan',
  leadership: 'purple', induction: 'green', refresher: 'gold', certification: 'magenta',
};
const STATUS_COLORS = {
  enrolled: 'blue', in_progress: 'orange', completed: 'green',
  failed: 'red', cancelled: 'default', certified: 'purple',
};
const TYPE_COLORS = { STAFF: 'blue', CONTRACTOR: 'orange', VISITOR: 'cyan' };
const CERT_STATUS_COLORS = { valid: 'green', expiring: 'orange', expired: 'red', no_expiry: 'default' };
const ISSUE_COLORS = { never_enrolled: 'red', expired: 'red', expiring_soon: 'orange', failed: 'volcano' };

const CATEGORIES = ['safety','technical','compliance','soft_skills','leadership','induction','refresher','certification'];

const label = (s) => s.replace(/_/g,' ').replace(/\b\w/g,(l)=>l.toUpperCase());

const TrainingManagement = () => {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  // ── filters ─────────────────────────────────────────────────────────────────
  const [courseSearch, setCourseSearch]       = useState('');
  const [courseCategory, setCourseCategory]   = useState('');
  const [enrollSearch, setEnrollSearch]       = useState('');
  const [enrollStatus, setEnrollStatus]       = useState('');
  const [enrollCategory, setEnrollCategory]   = useState('');
  const [enrollType, setEnrollType]           = useState('');
  const [compType, setCompType]               = useState('');
  const [compIssue, setCompIssue]             = useState('');
  const [compCourse, setCompCourse]           = useState(null);

  // ── modals ───────────────────────────────────────────────────────────────────
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse]     = useState(null);
  const [courseForm] = Form.useForm();

  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [editingEnroll, setEditingEnroll]     = useState(null);
  const [enrollForm] = Form.useForm();

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionId, setActionId]               = useState(null);
  const [actionType, setActionType]           = useState('complete');
  const [actionForm] = Form.useForm();

  const [certModalOpen, setCertModalOpen]     = useState(false);
  const [certEnrollment, setCertEnrollment]   = useState(null);

  // ── selection ────────────────────────────────────────────────────────────────
  const [selectedCourseKeys, setSelectedCourseKeys] = useState([]);
  const [selectedEnrollKeys, setSelectedEnrollKeys] = useState([]);

  const [activeTab, setActiveTab] = useState('courses');

  // ── queries ──────────────────────────────────────────────────────────────────
  const { data: coursesRaw, isLoading: coursesLoading, refetch: refetchCourses } = useQuery({
    queryKey: ['training-courses'],
    queryFn: () => apiService.get('/api/v1/personnel/training/courses'),
    staleTime: 30000,
  });
  const { data: enrollRaw, isLoading: enrollLoading, refetch: refetchEnroll } = useQuery({
    queryKey: ['training-enrollments'],
    queryFn: () => apiService.get('/api/v1/personnel/training/enrollments'),
    staleTime: 30000,
  });
  const { data: complianceRaw, isLoading: compLoading, refetch: refetchComp } = useQuery({
    queryKey: ['training-compliance'],
    queryFn: () => apiService.get('/api/v1/personnel/training/compliance'),
    staleTime: 60000,
    enabled: activeTab === 'compliance',
  });
  const { data: personnelRaw } = useQuery({
    queryKey: ['personnel-list-training'],
    queryFn: () => apiService.get('/api/v1/personnel/?limit=1000'),
    staleTime: 300000,
  });
  const { data: summaryRaw } = useQuery({
    queryKey: ['training-summary'],
    queryFn: () => apiService.get('/api/v1/personnel/training/summary'),
    staleTime: 60000,
  });

  // ── derived ──────────────────────────────────────────────────────────────────
  const courses     = useMemo(() => { const r = coursesRaw?.data||coursesRaw||[]; return Array.isArray(r)?r:[]; }, [coursesRaw]);
  const enrollments = useMemo(() => { const r = enrollRaw?.data||enrollRaw||[]; return Array.isArray(r)?r:[]; }, [enrollRaw]);
  const compliance  = useMemo(() => { const r = complianceRaw?.data||complianceRaw||[]; return Array.isArray(r)?r:[]; }, [complianceRaw]);
  const personnel   = useMemo(() => { const r = personnelRaw?.results||personnelRaw?.data||personnelRaw||[]; return Array.isArray(r)?r:[]; }, [personnelRaw]);
  const summary     = summaryRaw?.data||summaryRaw||{};

  const filteredCourses = useMemo(() => courses.filter(c => {
    if (courseCategory && c.category !== courseCategory) return false;
    if (courseSearch) { const q=courseSearch.toLowerCase(); return (c.course_name||'').toLowerCase().includes(q)||(c.course_code||'').toLowerCase().includes(q); }
    return true;
  }), [courses, courseCategory, courseSearch]);

  const filteredEnroll = useMemo(() => enrollments.filter(e => {
    if (enrollStatus && e.status !== enrollStatus) return false;
    if (enrollCategory && e.course_category !== enrollCategory) return false;
    if (enrollType && e.personnel_type !== enrollType) return false;
    if (enrollSearch) {
      const q = enrollSearch.toLowerCase();
      return (e.personnel_name||'').toLowerCase().includes(q)
          || (e.personnel_emp_code||'').toLowerCase().includes(q)
          || (e.course_name||'').toLowerCase().includes(q);
    }
    return true;
  }), [enrollments, enrollStatus, enrollCategory, enrollType, enrollSearch]);

  const mandatoryCourseOptions = useMemo(() =>
    courses
      .filter(c => c.is_mandatory)
      .map(c => ({ value: c.id, label: `${c.course_code} — ${c.course_name}`, course: c })),
    [courses],
  );

  const selectedCompCourse = useMemo(() =>
    compCourse ? courses.find(c => c.id === compCourse) : null,
    [courses, compCourse],
  );

  const filteredCompliance = useMemo(() => compliance.filter(c => {
    if (compCourse && c.course_id !== compCourse) return false;
    if (compType && c.personnel_type !== compType) return false;
    if (compIssue && c.issue !== compIssue) return false;
    return true;
  }), [compliance, compCourse, compType, compIssue]);

  // ── invalidators ─────────────────────────────────────────────────────────────
  const inv = (...keys) => keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
  const invAll = () => inv('training-courses','training-enrollments','training-summary','training-compliance');

  // ── course mutations ──────────────────────────────────────────────────────────
  const courseMut = useMutation({
    mutationFn: d => editingCourse
      ? apiService.put(`/api/v1/personnel/training/courses/${editingCourse.id}`, d)
      : apiService.post('/api/v1/personnel/training/courses', d),
    onSuccess: () => { message.success(editingCourse?'Course updated':'Course created'); setCourseModalOpen(false); setEditingCourse(null); inv('training-courses','training-summary'); },
    onError: e => message.error(e?.response?.data?.detail||e.message||'Failed'),
  });
  const delCourseMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/training/courses/${id}`),
    onSuccess: () => { message.success('Course deleted'); inv('training-courses','training-summary'); },
    onError: e => message.error(e?.response?.data?.detail||'Delete failed'),
  });

  // ── enrollment mutations ──────────────────────────────────────────────────────
  const enrollMut = useMutation({
    mutationFn: d => editingEnroll
      ? apiService.put(`/api/v1/personnel/training/enrollments/${editingEnroll.id}`, d)
      : apiService.post('/api/v1/personnel/training/enrollments', d),
    onSuccess: () => { message.success(editingEnroll?'Enrollment updated':'Enrolled successfully'); setEnrollModalOpen(false); setEditingEnroll(null); invAll(); },
    onError: e => message.error(e?.response?.data?.detail||e.message||'Failed'),
  });
  const delEnrollMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/training/enrollments/${id}`),
    onSuccess: () => { message.success('Enrollment deleted'); invAll(); },
    onError: e => message.error(e?.response?.data?.detail||'Delete failed'),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, action, data }) => apiService.put(`/api/v1/personnel/training/enrollments/${id}/${action}`, data||{}),
    onSuccess: (_, { action }) => {
      const msgs = { start:'Training started', complete:'Marked complete', certify:'Certificate issued', fail:'Marked failed', cancel:'Enrollment cancelled' };
      message.success(msgs[action]||'Updated');
      setActionModalOpen(false);
      invAll();
    },
    onError: e => message.error(e?.response?.data?.detail||'Action failed'),
  });

  // ── bulk delete ───────────────────────────────────────────────────────────────
  const bulkDelCourses = () => {
    if (!selectedCourseKeys.length) return;
    modal.confirm({
      title: `Delete ${selectedCourseKeys.length} course(s)?`, icon: <ExclamationCircleOutlined />,
      okText:'Delete', okButtonProps:{danger:true},
      onOk: async () => {
        await Promise.all(selectedCourseKeys.map(id => apiService.delete(`/api/v1/personnel/training/courses/${id}`)));
        message.success('Deleted'); setSelectedCourseKeys([]); inv('training-courses','training-summary');
      },
    });
  };
  const bulkDelEnroll = () => {
    if (!selectedEnrollKeys.length) return;
    modal.confirm({
      title: `Delete ${selectedEnrollKeys.length} enrollment(s)?`, icon: <ExclamationCircleOutlined />,
      okText:'Delete', okButtonProps:{danger:true},
      onOk: async () => {
        await Promise.all(selectedEnrollKeys.map(id => apiService.delete(`/api/v1/personnel/training/enrollments/${id}`)));
        message.success('Deleted'); setSelectedEnrollKeys([]); invAll();
      },
    });
  };

  // ── import standard courses ───────────────────────────────────────────────────
  const importStandardMut = useMutation({
    mutationFn: () => apiService.post('/api/v1/personnel/training/import-standard-courses'),
    onSuccess: (res) => {
      const d = res?.data || res || {};
      message.success(`Imported ${d.created ?? 0} course(s). ${d.skipped ?? 0} already existed.`);
      inv('training-courses', 'training-summary');
    },
    onError: (e) => message.error(e?.response?.data?.detail || 'Import failed'),
  });

  const confirmImport = () => {
    modal.confirm({
      title: 'Import Standard O&G Courses',
      content: 'This will add all 24 standard offshore oil & gas training courses (BOSIET, H₂S, HUET, FOET, Permit to Work, etc.) to your catalogue. Existing courses will be skipped.',
      okText: 'Import',
      onOk: () => importStandardMut.mutate(),
    });
  };

  // ── certificate ───────────────────────────────────────────────────────────────
  const openCertificate = (enrollment) => {
    setCertEnrollment(enrollment);
    setCertModalOpen(true);
  };

  // ── handlers ─────────────────────────────────────────────────────────────────
  const openAddCourse = () => { setEditingCourse(null); setCourseModalOpen(true); setTimeout(()=>courseForm.resetFields(),0); };
  const openEditCourse = r => { setEditingCourse(r); setCourseModalOpen(true); setTimeout(()=>courseForm.setFieldsValue(r),0); };
  const submitCourse = () => courseForm.validateFields().then(v=>courseMut.mutate(v)).catch(()=>{});

  const openAddEnroll = () => {
    setEditingEnroll(null); setEnrollModalOpen(true);
    setTimeout(()=>{ enrollForm.resetFields(); enrollForm.setFieldsValue({enrollment_date:dayjs(),status:'enrolled'}); },0);
  };
  const openEditEnroll = r => {
    setEditingEnroll(r); setEnrollModalOpen(true);
    setTimeout(()=>enrollForm.setFieldsValue({
      ...r,
      enrollment_date: r.enrollment_date?dayjs(r.enrollment_date):null,
      completion_date: r.completion_date?dayjs(r.completion_date):null,
    }),0);
  };
  const submitEnroll = () => enrollForm.validateFields().then(v=>enrollMut.mutate({
    ...v,
    enrollment_date: v.enrollment_date?v.enrollment_date.format('YYYY-MM-DD'):null,
    completion_date: v.completion_date?v.completion_date.format('YYYY-MM-DD'):null,
  })).catch(()=>{});

  const openAction = (id, action) => {
    setActionId(id); setActionType(action); setActionModalOpen(true);
    setTimeout(()=>{ actionForm.resetFields(); if(action!=='cancel') actionForm.setFieldsValue({completion_date:dayjs()}); },0);
  };
  const submitAction = () => actionForm.validateFields().then(v=>statusMut.mutate({
    id:actionId, action:actionType,
    data:{ ...v, completion_date: v.completion_date?v.completion_date.format('YYYY-MM-DD'):null },
  })).catch(()=>{});

  // ── personnel options ─────────────────────────────────────────────────────────
  const personnelOptions = personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name||'')} ${(p.last_name||'')}`.trim() + (p.emp_code?` (${p.emp_code})`:'') + (p.personnel_type&&p.personnel_type!=='STAFF'?` [${p.personnel_type}]`:''),
  }));
  const courseOptions = courses.map(c => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` }));

  // ── columns ───────────────────────────────────────────────────────────────────
  const courseColumns = [
    { title:'Code', dataIndex:'course_code', width:110, sorter:(a,b)=>a.course_code.localeCompare(b.course_code), render:c=><Tag style={{fontFamily:'monospace'}}>{c}</Tag> },
    { title:'Course Name', dataIndex:'course_name', sorter:(a,b)=>a.course_name.localeCompare(b.course_name) },
    { title:'Category', dataIndex:'category', render:c=>c?<Tag color={CATEGORY_COLORS[c]||'default'}>{label(c)}</Tag>:'—' },
    { title:'Duration', dataIndex:'duration_hours', width:90, render:h=>h?`${h}h`:'—' },
    { title:'Validity', dataIndex:'valid_period_months', render:m=>m?`${m} months`:<Tag color="green">No Expiry</Tag> },
    { title:'Mandatory', dataIndex:'is_mandatory', render:v=><Tag color={v?'red':'default'}>{v?'Mandatory':'Optional'}</Tag> },
    { title:'Enrolled', dataIndex:'enrollment_count', width:90, render:n=><Badge count={n??0} showZero color="#1677ff" /> },
    {
      title:'Actions', key:'actions', fixed:'right', width:110,
      render:(_,r)=>(
        <Space>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined/>} onClick={()=>openEditCourse(r)}/></Tooltip>
          <Popconfirm title="Delete this course?" onConfirm={()=>delCourseMut.mutate(r.id)} okText="Delete" okButtonProps={{danger:true,disabled:(r.enrollment_count||0)>0}}>
            <Tooltip title={(r.enrollment_count||0)>0?'Has enrollments — cannot delete':'Delete'}>
              <Button danger size="small" icon={<DeleteOutlined/>} disabled={(r.enrollment_count||0)>0}/>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const enrollColumns = [
    {
      title:'Person', key:'person', sorter:(a,b)=>(a.personnel_name||'').localeCompare(b.personnel_name||''),
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
      title:'Course', key:'course',
      render:(_,r)=>(
        <div>
          <div>{r.course_name||`ID ${r.course_id}`}</div>
          {r.course_category&&<Tag color={CATEGORY_COLORS[r.course_category]||'default'} style={{fontSize:10,marginTop:2}}>{label(r.course_category)}</Tag>}
          {r.is_mandatory&&<Tag color="red" style={{fontSize:10,marginTop:2}}>Mandatory</Tag>}
        </div>
      ),
    },
    { title:'Enrolled', dataIndex:'enrollment_date', sorter:(a,b)=>(a.enrollment_date||'').localeCompare(b.enrollment_date||''), render:d=>d||'—' },
    { title:'Completed', dataIndex:'completion_date', render:d=>d||'—' },
    {
      title:'Score', dataIndex:'score',
      render:s=>{
        if(s==null) return '—';
        const n=Number(s);
        return <Progress percent={n} size="small" strokeColor={n>=70?'#52c41a':'#ff4d4f'} format={p=>`${p}%`} style={{width:80}}/>;
      },
    },
    {
      title:'Status', dataIndex:'status',
      render:s=><Tag color={STATUS_COLORS[s]||'default'}>{label(s)}</Tag>,
    },
    {
      title:'Certificate / Expiry', key:'cert',
      render:(_,r)=>(
        <div>
          {r.expiry_date&&(
            <Tag color={CERT_STATUS_COLORS[r.cert_status]||'default'} style={{fontSize:10}}>
              {r.cert_status==='expired'?`Expired ${r.expiry_date}`:
               r.cert_status==='expiring'?`Expires ${r.expiry_date}`:
               `Valid to ${r.expiry_date}`}
            </Tag>
          )}
          {!r.expiry_date&&r.status==='certified'&&<Tag color="green" style={{fontSize:10}}>No Expiry</Tag>}
          {r.certificate_url&&<div style={{marginTop:2}}><a href={r.certificate_url} target="_blank" rel="noopener noreferrer"><SafetyCertificateOutlined/> View Cert</a></div>}
        </div>
      ),
    },
    {
      title:'Actions', key:'actions', fixed:'right', width:190,
      render:(_,r)=>(
        <Space size={2} wrap>
          {r.status==='enrolled'&&<Tooltip title="Start Training"><Button size="small" icon={<PlayCircleOutlined/>} onClick={()=>statusMut.mutate({id:r.id,action:'start'})}/></Tooltip>}
          {['enrolled','in_progress'].includes(r.status)&&<>
            <Tooltip title="Mark Complete"><Button size="small" type="primary" icon={<CheckCircleOutlined/>} onClick={()=>openAction(r.id,'complete')}/></Tooltip>
            <Tooltip title="Mark Failed"><Button size="small" danger icon={<CloseCircleOutlined/>} onClick={()=>openAction(r.id,'fail')}/></Tooltip>
            <Popconfirm title="Cancel enrollment?" onConfirm={()=>statusMut.mutate({id:r.id,action:'cancel'})} okText="Cancel" okButtonProps={{danger:true}}>
              <Tooltip title="Cancel"><Button size="small" icon={<CloseCircleOutlined/>}/></Tooltip>
            </Popconfirm>
          </>}
          {r.status==='completed'&&<Tooltip title="Issue Certificate"><Button size="small" icon={<SafetyCertificateOutlined/>} onClick={()=>openAction(r.id,'certify')}/></Tooltip>}
          {r.status==='certified'&&(
            <Tooltip title="Generate Certificate">
              <Button size="small" type="primary" icon={<DownloadOutlined/>} style={{background:'#047857',borderColor:'#047857'}} onClick={()=>openCertificate(r)}>Cert</Button>
            </Tooltip>
          )}
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined/>} onClick={()=>openEditEnroll(r)}/></Tooltip>
          <Popconfirm title="Delete enrollment?" onConfirm={()=>delEnrollMut.mutate(r.id)} okText="Delete" okButtonProps={{danger:true}}>
            <Tooltip title="Delete"><Button danger size="small" icon={<DeleteOutlined/>}/></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const complianceColumns = [
    {
      title:'Personnel', key:'person',
      render:(_,r)=>(
        <div>
          <Space size={4}>
            <Tag color={TYPE_COLORS[r.personnel_type]||'default'} style={{fontSize:10,padding:'0 4px'}}>{r.personnel_type}</Tag>
            <span style={{fontWeight:500}}>{r.personnel_name}</span>
          </Space>
          <div style={{fontSize:11,color:'#888'}}>{r.personnel_emp_code}{r.personnel_company?` · ${r.personnel_company}`:''}</div>
        </div>
      ),
    },
    {
      title:'Issue', dataIndex:'issue', width:160,
      render:i=><Tag color={ISSUE_COLORS[i]||'default'}>{i==='never_enrolled'?'Never Enrolled':i==='expiring_soon'?'Expiring Soon':label(i)}</Tag>,
    },
    {
      title:'Expiry / Overdue', key:'expiry', width:200,
      render:(_,r)=>{
        if(!r.expiry_date) return <span style={{color:'#bbb'}}>—</span>;
        const days = r.days_until_expiry;
        if(days<0) return <Tag color="red">Expired {Math.abs(days)}d ago</Tag>;
        return <Tag color="orange">Expires in {days}d ({r.expiry_date})</Tag>;
      },
    },
    {
      title:'Action', key:'action', width:130,
      render:(_,r)=>(
        <Button size="small" type="primary" icon={<PlusOutlined/>} onClick={()=>{
          setActiveTab('enrollments');
          setTimeout(()=>{ openAddEnroll(); enrollForm.setFieldsValue({personnel_id:r.personnel_id,course_id:r.course_id,enrollment_date:dayjs(),status:'enrolled'}); },100);
        }}>
          {r.issue==='never_enrolled'?'Enroll Now':'Re-enroll'}
        </Button>
      ),
    },
  ];

  const actionTitles = { complete:'Mark Training Complete', certify:'Issue Training Certificate', fail:'Mark Training Failed' };

  // ── render ────────────────────────────────────────────────────────────────────
  const totalComplianceGaps = compliance.filter(c=>c.issue==='never_enrolled'||c.issue==='expired').length;
  const complianceGaps = compCourse
    ? filteredCompliance.filter(c=>c.issue==='never_enrolled'||c.issue==='expired').length
    : totalComplianceGaps;

  return (
    <div style={{padding:24}}>
      {/* Stats */}
      <Row gutter={16} style={{marginBottom:24}}>
        {[
          {title:'Total Courses',   value:summary.total_courses??courses.length,                                  color:'#1677ff',  icon:<BookOutlined/>},
          {title:'Mandatory',       value:summary.mandatory_courses??courses.filter(c=>c.is_mandatory).length,    color:'#ff4d4f',  icon:<ExclamationCircleOutlined/>},
          {title:'Certified',       value:summary.certified??enrollments.filter(e=>e.status==='certified').length, color:'#722ed1', icon:<FileProtectOutlined/>},
          {title:'Expired Certs',   value:summary.expired_certs??enrollments.filter(e=>e.cert_status==='expired').length, color:'#cf1322', icon:<WarningOutlined/>},
        ].map(s=>(
          <Col span={6} key={s.title}>
            <Card size="small"><Statistic title={s.title} value={s.value} valueStyle={{color:s.color}} prefix={s.icon}/></Card>
          </Col>
        ))}
      </Row>

      {/* Personnel type breakdown */}
      {summary.by_personnel_type && Object.keys(summary.by_personnel_type).length>0 && (
        <Row gutter={8} style={{marginBottom:16}}>
          {Object.entries(summary.by_personnel_type).map(([type,count])=>(
            <Col key={type}>
              <Tag color={TYPE_COLORS[type]||'default'} style={{padding:'4px 10px',fontSize:13}}>
                <TeamOutlined style={{marginRight:4}}/>{type}: {count} enrollment{count!==1?'s':''}
              </Tag>
            </Col>
          ))}
        </Row>
      )}

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          // ── COURSES ──────────────────────────────────────────────────────────
          {
            key:'courses',
            label:<span><BookOutlined style={{marginRight:4}}/>Course Catalogue</span>,
            children:(
              <>
                <Row gutter={12} style={{marginBottom:16}}>
                  <Col span={8}><Input placeholder="Search name or code..." value={courseSearch} onChange={e=>setCourseSearch(e.target.value)} allowClear/></Col>
                  <Col span={5}>
                    <Select placeholder="All Categories" style={{width:'100%'}} value={courseCategory||undefined} onChange={v=>setCourseCategory(v||'')} allowClear>
                      {CATEGORIES.map(c=><Select.Option key={c} value={c}>{label(c)}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={11}>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined/>} onClick={openAddCourse}>Add Course</Button>
                      <Button icon={<ImportOutlined/>} onClick={confirmImport} loading={importStandardMut.isPending}>Import O&amp;G Standards</Button>
                      {selectedCourseKeys.length>0&&<Button danger icon={<DeleteOutlined/>} onClick={bulkDelCourses}>Delete ({selectedCourseKeys.length})</Button>}
                      <Button icon={<ReloadOutlined/>} onClick={refetchCourses}/>
                    </Space>
                  </Col>
                </Row>
                <Table columns={courseColumns} dataSource={filteredCourses} loading={coursesLoading} rowKey="id"
                  rowSelection={{selectedRowKeys:selectedCourseKeys,onChange:setSelectedCourseKeys}}
                  pagination={{pageSize:20,showSizeChanger:true,showTotal:t=>`Total ${t}`}} scroll={{x:1100}} size="small"/>
              </>
            ),
          },

          // ── ENROLLMENTS ───────────────────────────────────────────────────────
          {
            key:'enrollments',
            label:<span><UserOutlined style={{marginRight:4}}/>Enrollments</span>,
            children:(
              <>
                <Row gutter={12} style={{marginBottom:16}}>
                  <Col span={6}><Input placeholder="Search person or course..." value={enrollSearch} onChange={e=>setEnrollSearch(e.target.value)} allowClear/></Col>
                  <Col span={4}>
                    <Select placeholder="Type" style={{width:'100%'}} value={enrollType||undefined} onChange={v=>setEnrollType(v||'')} allowClear>
                      {['STAFF','CONTRACTOR','VISITOR'].map(t=><Select.Option key={t} value={t}>{t}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Select placeholder="Status" style={{width:'100%'}} value={enrollStatus||undefined} onChange={v=>setEnrollStatus(v||'')} allowClear>
                      {['enrolled','in_progress','completed','failed','cancelled','certified'].map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Select placeholder="Category" style={{width:'100%'}} value={enrollCategory||undefined} onChange={v=>setEnrollCategory(v||'')} allowClear>
                      {CATEGORIES.map(c=><Select.Option key={c} value={c}>{label(c)}</Select.Option>)}
                    </Select>
                  </Col>
                  <Col span={6}>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined/>} onClick={openAddEnroll}>Enroll</Button>
                      {selectedEnrollKeys.length>0&&<Button danger icon={<DeleteOutlined/>} onClick={bulkDelEnroll}>Delete ({selectedEnrollKeys.length})</Button>}
                      <Button icon={<ReloadOutlined/>} onClick={refetchEnroll}/>
                    </Space>
                  </Col>
                </Row>
                <Table columns={enrollColumns} dataSource={filteredEnroll} loading={enrollLoading} rowKey="id"
                  rowSelection={{selectedRowKeys:selectedEnrollKeys,onChange:setSelectedEnrollKeys}}
                  pagination={{pageSize:20,showSizeChanger:true,showTotal:t=>`Total ${t}`}} scroll={{x:1500}} size="small"/>
              </>
            ),
          },

          // ── COMPLIANCE ────────────────────────────────────────────────────────
          {
            key:'compliance',
            label:(
              <span>
                <WarningOutlined style={{marginRight:4}}/>
                Compliance Gaps
                {totalComplianceGaps>0&&<Badge count={totalComplianceGaps} size="small" style={{marginLeft:6}}/>}
              </span>
            ),
            children:(
              <>
                {/* Step 1: Course picker */}
                <Card size="small" style={{marginBottom:16,background:'#fafbfc',border:'1px solid #e8e8e8'}}>
                  <div style={{fontWeight:600,color:'#262626',marginBottom:8}}>
                    <WarningOutlined style={{marginRight:6,color:'#faad14'}}/>
                    Select a mandatory course to view personnel compliance gaps:
                  </div>
                  <Row gutter={12} align="middle">
                    <Col flex="auto">
                      <Select
                        showSearch
                        placeholder="Choose a mandatory training course..."
                        style={{width:'100%'}}
                        value={compCourse||undefined}
                        onChange={v=>{setCompCourse(v||null);setCompType('');setCompIssue('');}}
                        allowClear
                        options={mandatoryCourseOptions}
                        filterOption={(i,o)=>(o?.label??'').toLowerCase().includes(i.toLowerCase())}
                        notFoundContent={mandatoryCourseOptions.length===0?'No mandatory courses found — mark courses as Mandatory in the Course Catalogue first':'No match'}
                      />
                    </Col>
                    <Col flex="none">
                      <Button icon={<ReloadOutlined/>} onClick={refetchComp} loading={compLoading}/>
                    </Col>
                  </Row>
                  {selectedCompCourse&&(
                    <Row gutter={16} style={{marginTop:8}} align="middle">
                      <Col><Tag color={CATEGORY_COLORS[selectedCompCourse.category]||'default'}>{label(selectedCompCourse.category||'general')}</Tag></Col>
                      {selectedCompCourse.duration_hours&&<Col><span style={{fontSize:12,color:'#555'}}>Duration: <b>{selectedCompCourse.duration_hours}h</b></span></Col>}
                      <Col>
                        <span style={{fontSize:12,color:'#555'}}>
                          Validity: <b>{selectedCompCourse.valid_period_months?`${selectedCompCourse.valid_period_months} months`:'No Expiry'}</b>
                        </span>
                      </Col>
                      <Col><Tag color="red" style={{fontSize:11}}>Mandatory</Tag></Col>
                    </Row>
                  )}
                </Card>

                {!compCourse ? (
                  <div style={{textAlign:'center',padding:'48px 0',color:'#aaa'}}>
                    <BookOutlined style={{fontSize:40,display:'block',marginBottom:12}}/>
                    <div style={{fontSize:15,marginBottom:4}}>No course selected</div>
                    <div style={{fontSize:13}}>Pick a mandatory course above to see which personnel need to be enrolled or re-enrolled.</div>
                  </div>
                ) : (
                  <>
                    {complianceGaps>0&&(
                      <Alert type="warning" showIcon style={{marginBottom:12}}
                        message={`${complianceGaps} personnel have critical gaps (never enrolled or expired) for this course`}/>
                    )}
                    {complianceGaps===0&&filteredCompliance.length===0&&!compLoading&&(
                      <Alert type="success" showIcon style={{marginBottom:12}}
                        message="All personnel are compliant for this course"/>
                    )}

                    {/* Filters */}
                    <Row gutter={12} style={{marginBottom:12}}>
                      <Col span={5}>
                        <Select placeholder="All Types" style={{width:'100%'}} value={compType||undefined} onChange={v=>setCompType(v||'')} allowClear>
                          {['STAFF','CONTRACTOR','VISITOR'].map(t=><Select.Option key={t} value={t}>{t}</Select.Option>)}
                        </Select>
                      </Col>
                      <Col span={5}>
                        <Select placeholder="All Issues" style={{width:'100%'}} value={compIssue||undefined} onChange={v=>setCompIssue(v||'')} allowClear>
                          {['never_enrolled','expired','expiring_soon','failed'].map(i=><Select.Option key={i} value={i}>{i==='never_enrolled'?'Never Enrolled':i==='expiring_soon'?'Expiring Soon':label(i)}</Select.Option>)}
                        </Select>
                      </Col>
                    </Row>

                    <Table
                      columns={complianceColumns}
                      dataSource={filteredCompliance}
                      loading={compLoading}
                      rowKey={r=>`${r.personnel_id}-${r.course_id}`}
                      pagination={{pageSize:20,showSizeChanger:true,showTotal:t=>`${t} personnel with gaps`}}
                      size="small"
                    />
                  </>
                )}
              </>
            ),
          },
        ]}/>
      </Card>

      {/* ── Course Modal ────────────────────────────────────────── */}
      <Modal title={editingCourse?'Edit Course':'Add Training Course'} open={courseModalOpen}
        onOk={submitCourse} onCancel={()=>{setCourseModalOpen(false);setEditingCourse(null);}}
        confirmLoading={courseMut.isPending} width={680} forceRender>
        <Form form={courseForm} layout="vertical" initialValues={{is_mandatory:false}}>
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="course_code" label="Course Code" rules={[{required:true,message:'Enter code'}]}>
                <Input placeholder="e.g. SAF-001" maxLength={20} disabled={!!editingCourse}/>
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="course_name" label="Course Name" rules={[{required:true,message:'Enter name'}]}>
                <Input maxLength={200}/>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category">
                <Select placeholder="Select category" allowClear>
                  {CATEGORIES.map(c=><Select.Option key={c} value={c}>{label(c)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="duration_hours" label="Duration (hours)" rules={[{required:true,message:'Enter duration'}]}>
                <InputNumber min={1} style={{width:'100%'}}/>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="valid_period_months" label="Certificate Validity (months)">
                <InputNumber min={1} style={{width:'100%'}} placeholder="Leave blank = never expires"/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_mandatory" label="Mandatory Training" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No"/>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={1000} showCount/>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Enrollment Modal ─────────────────────────────────────── */}
      <Modal title={editingEnroll?'Edit Enrollment':'Enroll in Training'} open={enrollModalOpen}
        onOk={submitEnroll} onCancel={()=>{setEnrollModalOpen(false);setEditingEnroll(null);}}
        confirmLoading={enrollMut.isPending} width={600} forceRender>
        <Form form={enrollForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Person (Staff / Contractor / Visitor)" rules={[{required:true,message:'Select person'}]}>
                <Select showSearch placeholder="Select person" options={personnelOptions} disabled={!!editingEnroll}
                  filterOption={(i,o)=>(o?.label??'').toLowerCase().includes(i.toLowerCase())}/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="course_id" label="Course" rules={[{required:true,message:'Select course'}]}>
                <Select showSearch placeholder="Select course" options={courseOptions} disabled={!!editingEnroll}
                  filterOption={(i,o)=>(o?.label??'').toLowerCase().includes(i.toLowerCase())}/>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="enrollment_date" label="Enrollment Date" rules={[{required:true,message:'Select date'}]}>
                <DatePicker style={{width:'100%'}} format="YYYY-MM-DD"/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select>
                  {['enrolled','in_progress','completed','failed','cancelled','certified'].map(s=><Select.Option key={s} value={s}>{label(s)}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="score" label="Score (%)">
                <InputNumber min={0} max={100} style={{width:'100%'}}/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="certificate_url" label="Certificate URL / Reference">
                <Input placeholder="https:// or document ref"/>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Certificate Modal ────────────────────────────────────── */}
      <Modal
        title={<span><SafetyCertificateOutlined style={{marginRight:8,color:'#047857'}}/>Training Certificate — {certEnrollment?.personnel_name}</span>}
        open={certModalOpen}
        onCancel={()=>{ setCertModalOpen(false); setCertEnrollment(null); }}
        footer={null}
        width={1000}
        styles={{ body: { padding: '16px 24px', background: '#f5f5f5', overflowX: 'auto' } }}
      >
        {certEnrollment && <CertificateTemplate enrollment={certEnrollment} />}
      </Modal>

      {/* ── Action Modal (complete / certify / fail) ─────────────── */}
      <Modal title={actionTitles[actionType]||'Update'} open={actionModalOpen}
        onOk={submitAction} onCancel={()=>setActionModalOpen(false)}
        confirmLoading={statusMut.isPending} okButtonProps={actionType==='fail'?{danger:true}:{}} forceRender>
        <Form form={actionForm} layout="vertical">
          {['complete','fail'].includes(actionType)&&<>
            <Form.Item name="completion_date" label="Date">
              <DatePicker style={{width:'100%'}} format="YYYY-MM-DD"/>
            </Form.Item>
            <Form.Item name="score" label="Score (%)">
              <InputNumber min={0} max={100} style={{width:'100%'}}/>
            </Form.Item>
          </>}
          {['complete','certify'].includes(actionType)&&(
            <Form.Item name="certificate_url" label="Certificate URL / Reference No.">
              <Input placeholder="https:// or reference number — stored as evidence"/>
            </Form.Item>
          )}
          {actionType==='certify'&&(
            <Alert type="info" showIcon message="Issuing a certificate will set the expiry date automatically based on the course validity period." style={{marginTop:8}}/>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default TrainingManagement;
