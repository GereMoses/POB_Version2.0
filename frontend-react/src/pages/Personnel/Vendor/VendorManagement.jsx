import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Input, Select, Row, Col,
  App, Popconfirm, DatePicker, Form, Drawer, Dropdown,
  Descriptions, Divider, Tooltip, Alert, InputNumber, Tabs, Modal, Avatar, Card,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined,
  UserOutlined, FileTextOutlined, CheckCircleOutlined, EyeOutlined,
  TeamOutlined, ShopOutlined, SafetyCertificateOutlined, PhoneOutlined,
  BankOutlined, WarningOutlined, EditOutlined, MoreOutlined,
  CheckSquareOutlined, DownloadOutlined, FilterOutlined,
  ExclamationCircleOutlined, ExpandAltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

// ── Hex color configs ──────────────────────────────────────────────────────────
const VENDOR_TYPE_CFG = {
  SERVICE_PROVIDER:     { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd',  label: 'Service Provider'     },
  EQUIPMENT_SUPPLIER:   { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc',  label: 'Equipment Supplier'   },
  CONSULTING_FIRM:      { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe',  label: 'Consulting Firm'      },
  STAFFING_AGENCY:      { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0',  label: 'Staffing Agency'      },
  TRAINING_PROVIDER:    { color: '#b45309', bg: '#fffbeb', border: '#fde68a',  label: 'Training Provider'    },
  MAINTENANCE_PROVIDER: { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa',  label: 'Maintenance Provider' },
  SOFTWARE_VENDOR:      { color: '#4b5563', bg: '#f9fafb', border: '#e5e7eb',  label: 'Software Vendor'      },
};

const VENDOR_STATUS_CFG = {
  ACTIVE:           { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', row: 'rgba(22,163,74,0.04)',   label: 'Active'            },
  INACTIVE:         { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', row: 'rgba(107,114,128,0.04)', label: 'Inactive'          },
  SUSPENDED:        { color: '#d97706', bg: '#fffbeb', border: '#fde68a', row: 'rgba(217,119,6,0.06)',   label: 'Suspended'         },
  BLACKLISTED:      { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', row: 'rgba(220,38,38,0.06)',   label: 'Blacklisted'       },
  PENDING_APPROVAL: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', row: 'rgba(37,99,235,0.04)',   label: 'Pending Approval'  },
};

const COMPLIANCE_CFG = {
  COMPLIANT:     { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Compliant'     },
  NON_COMPLIANT: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Non-Compliant' },
  PENDING:       { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Pending'       },
  EXPIRED:       { color: '#9f1239', bg: '#fff1f2', border: '#fda4af', label: 'Expired'       },
};

const BG_CFG = {
  CLEARED:      { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Cleared'      },
  PENDING:      { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Pending'      },
  FAILED:       { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Failed'       },
  NOT_REQUIRED: { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', label: 'Not Required' },
};

const MED_CFG = {
  CLEARED:      { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Cleared'      },
  PENDING:      { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Pending'      },
  FAILED:       { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Failed'       },
  EXPIRED:      { color: '#9f1239', bg: '#fff1f2', border: '#fda4af', label: 'Expired'      },
  NOT_REQUIRED: { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', label: 'Not Required' },
};

const AVAIL_CFG = {
  AVAILABLE:   { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Available'   },
  ASSIGNED:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Assigned'    },
  ON_LEAVE:    { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'On Leave'    },
  UNAVAILABLE: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Unavailable' },
};

const pillStyle = (cfg, val, fallback) => {
  const c = cfg[val] || { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', label: fallback || val || '—' };
  return { c, s: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' } };
};

const AVATAR_PALETTE = ['#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d'];
const avatarColor = n => AVATAR_PALETTE[(n||'').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = n => (n||'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';

const exportCSV = (cols, rows, fname) => {
  const h = cols.map(c=>`"${c.t}"`).join(',');
  const b = rows.map(r=>cols.map(c=>`"${String(c.v(r)||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h+'\n'+b],{type:'text/csv'})); a.download=fname; a.click(); URL.revokeObjectURL(a.href);
};

// ── Pills ──────────────────────────────────────────────────────────────────────
const VendorTypePill = ({ value }) => {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>;
  const { c, s } = pillStyle(VENDOR_TYPE_CFG, value);
  return <span style={s}>{c.label}</span>;
};
const VendorStatusPill = ({ value }) => {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>;
  const { c, s } = pillStyle(VENDOR_STATUS_CFG, value);
  return <span style={s}><span style={{ width:6,height:6,borderRadius:'50%',background:c.color,flexShrink:0 }}/>{c.label}</span>;
};
const CompliancePill = ({ value }) => {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>;
  const { c, s } = pillStyle(COMPLIANCE_CFG, value);
  return <span style={s}>{c.label}</span>;
};
const BgPill = ({ value }) => {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>;
  const { c, s } = pillStyle(BG_CFG, value);
  return <span style={s}>{c.label}</span>;
};
const MedPill = ({ value }) => {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>;
  const { c, s } = pillStyle(MED_CFG, value);
  return <span style={s}>{c.label}</span>;
};
const AvailPill = ({ value }) => {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>;
  const { c, s } = pillStyle(AVAIL_CFG, value);
  return <span style={s}><span style={{ width:6,height:6,borderRadius:'50%',background:c.color,flexShrink:0 }}/>{c.label}</span>;
};

// ── Contract expiry inline badge ───────────────────────────────────────────────
const ContractBadge = ({ date }) => {
  if (!date) return null;
  const days = dayjs(date).diff(dayjs(), 'days');
  let color, bg, border, text;
  if (days < 0)   { color='#dc2626'; bg='#fef2f2'; border='#fecaca'; text='Expired'; }
  else if (days<=30)  { color='#dc2626'; bg='#fff1f2'; border='#fda4af'; text=`${days}d left`; }
  else if (days<=90)  { color='#d97706'; bg='#fffbeb'; border='#fde68a'; text=`${days}d left`; }
  else                { color='#15803d'; bg='#f0fdf4'; border='#bbf7d0'; text='Active'; }
  return <span style={{ display:'inline-flex',alignItems:'center',padding:'1px 7px',borderRadius:999,fontSize:10,fontWeight:700,color,background:bg,border:`1px solid ${border}` }}>{text}</span>;
};

// ── Vendor name / contractor cell ──────────────────────────────────────────────
const VendorCell = ({ rec, onClick }) => {
  const t = VENDOR_TYPE_CFG[rec.vendor_type];
  return (
    <div style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer' }} onClick={onClick}>
      <div style={{ width:32,height:32,borderRadius:8,flexShrink:0,background:t?.bg||'#f3f4f6',border:`1px solid ${t?.border||'#e5e7eb'}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,color:t?.color||'#6b7280' }}>
        {(rec.vendor_name||'?')[0].toUpperCase()}
      </div>
      <div>
        <div style={{ fontWeight:700,fontSize:12,color:'#111827' }}>{rec.vendor_name}</div>
        <div style={{ fontSize:10,color:'#94a3b8',fontFamily:'monospace' }}>{rec.vendor_code}</div>
      </div>
    </div>
  );
};

const ContractorCell = ({ rec, onClick }) => {
  const name = `${rec.first_name||''} ${rec.last_name||''}`.trim();
  return (
    <div style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer' }} onClick={onClick}>
      <Avatar size={30} style={{ background:avatarColor(name),fontSize:10,fontWeight:700,flexShrink:0 }}>{initials(name)}</Avatar>
      <div>
        <div style={{ fontWeight:600,fontSize:12,color:'#111827' }}>{name||'—'}</div>
        <div style={{ display:'flex',gap:4,marginTop:1,flexWrap:'wrap' }}>
          {rec.contractor_code && <span style={{ fontFamily:'monospace',fontSize:9,color:'#94a3b8',background:'#f3f4f6',borderRadius:3,padding:'0 4px' }}>{rec.contractor_code}</span>}
          {rec.job_title && <span style={{ fontSize:9,color:'#94a3b8' }}>{rec.job_title}</span>}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const VendorManagement = () => {
  const { message } = App.useApp();
  const [activeTab,      setActiveTab]      = useState('vendors');
  const [search,         setSearch]         = useState('');
  const [filterType,     setFilterType]     = useState(null);
  const [filterStatus,   setFilterStatus]   = useState(null);
  const [filterAvail,    setFilterAvail]    = useState(null);
  const [selectedVendors,      setSelectedVendors]      = useState([]);
  const [selectedContractors,  setSelectedContractors]  = useState([]);
  const [expandedVendors,      setExpandedVendors]      = useState([]);
  const [expandedContractors,  setExpandedContractors]  = useState([]);

  const [vendorDrawerOpen,     setVendorDrawerOpen]     = useState(false);
  const [editingVendor,        setEditingVendor]        = useState(null);
  const [vendorForm]     = Form.useForm();

  const [contractorDrawerOpen, setContractorDrawerOpen] = useState(false);
  const [editingContractor,    setEditingContractor]    = useState(null);
  const [contractorForm] = Form.useForm();

  const [detailVisible,  setDetailVisible]  = useState(false);
  const [detailRecord,   setDetailRecord]   = useState(null);
  const [detailType,     setDetailType]     = useState('vendor');

  const queryClient = useQueryClient();

  // ── Queries (fetch-all, filter client-side) ────────────────────────────────
  const { data: allVendors = [], isLoading: vendorsLoading, refetch: refetchVendors } = useQuery({
    queryKey: ['vendors'],
    queryFn:  () => apiService.get('/api/v1/personnel/vendor-contractor/vendors?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });

  const { data: allContractors = [], isLoading: contractorsLoading, refetch: refetchContractors } = useQuery({
    queryKey: ['contractors'],
    queryFn:  () => apiService.get('/api/v1/personnel/vendor-contractor/contractors?limit=500'),
    staleTime: 30000,
    select: d => Array.isArray(d) ? d : (d?.data || d?.results || []),
  });

  // ── Client-side filter ─────────────────────────────────────────────────────
  const vendors = useMemo(() => allVendors.filter(v => {
    if (filterType   && v.vendor_type !== filterType)   return false;
    if (filterStatus && v.status      !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (v.vendor_name||'').toLowerCase().includes(q) || (v.vendor_code||'').toLowerCase().includes(q) || (v.contact_person||'').toLowerCase().includes(q);
    }
    return true;
  }), [allVendors, filterType, filterStatus, search]);

  const contractors = useMemo(() => allContractors.filter(c => {
    if (filterAvail && c.availability_status !== filterAvail) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${c.first_name||''} ${c.last_name||''}`.toLowerCase();
      return name.includes(q) || (c.contractor_code||'').toLowerCase().includes(q) || (c.job_title||'').toLowerCase().includes(q);
    }
    return true;
  }), [allContractors, filterAvail, search]);

  const hasVendorFilters      = search || filterType || filterStatus;
  const hasContractorFilters  = search || filterAvail;
  const clearVendorFilters    = () => { setSearch(''); setFilterType(null); setFilterStatus(null); };
  const clearContractorFilters= () => { setSearch(''); setFilterAvail(null); };

  // Derived stats (always from full dataset)
  const activeVendors   = allVendors.filter(v => v.status === 'ACTIVE').length;
  const expiringCount   = allVendors.filter(v => { if (!v.contract_end) return false; const d=dayjs(v.contract_end).diff(dayjs(),'days'); return d>=0&&d<=30; }).length;
  const expiredCount    = allVendors.filter(v => v.contract_end && dayjs(v.contract_end).isBefore(dayjs())).length;
  const availableCount  = allContractors.filter(c => c.availability_status === 'AVAILABLE').length;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const inv = key => queryClient.invalidateQueries({ queryKey: [key] });

  const createVendorMut = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/vendor-contractor/vendors', d),
    onSuccess: () => { message.success('Vendor registered'); setVendorDrawerOpen(false); vendorForm.resetFields(); inv('vendors'); },
    onError:   e => message.error(e?.response?.data?.detail || 'Failed to create'),
  });
  const updateVendorMut = useMutation({
    mutationFn: ({ id, ...d }) => apiService.put(`/api/v1/personnel/vendor-contractor/vendors/${id}`, d),
    onSuccess: () => { message.success('Vendor updated'); setVendorDrawerOpen(false); vendorForm.resetFields(); inv('vendors'); },
    onError:   e => message.error(e?.response?.data?.detail || 'Failed to update'),
  });
  const deleteVendorMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/vendor-contractor/vendors/${id}`),
    onSuccess: () => { message.success('Vendor deleted'); setDetailVisible(false); inv('vendors'); },
    onError:   e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const createContractorMut = useMutation({
    mutationFn: d => apiService.post('/api/v1/personnel/vendor-contractor/contractors', d),
    onSuccess: () => { message.success('Contractor registered'); setContractorDrawerOpen(false); contractorForm.resetFields(); inv('contractors'); },
    onError:   e => message.error(e?.response?.data?.detail || 'Failed to register'),
  });
  const updateContractorMut = useMutation({
    mutationFn: ({ id, ...d }) => apiService.put(`/api/v1/personnel/vendor-contractor/contractors/${id}`, d),
    onSuccess: () => { message.success('Contractor updated'); setContractorDrawerOpen(false); contractorForm.resetFields(); inv('contractors'); },
    onError:   e => message.error(e?.response?.data?.detail || 'Failed to update'),
  });

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openVendorDrawer = (rec=null) => {
    setEditingVendor(rec); setVendorDrawerOpen(true);
    rec ? vendorForm.setFieldsValue({ ...rec, contract_start: rec.contract_start?dayjs(rec.contract_start):null, contract_end: rec.contract_end?dayjs(rec.contract_end):null })
        : vendorForm.resetFields();
  };
  const openContractorDrawer = (rec=null) => {
    setEditingContractor(rec); setContractorDrawerOpen(true);
    rec ? contractorForm.setFieldsValue({ ...rec, date_of_birth: rec.date_of_birth?dayjs(rec.date_of_birth):null, work_permit_expiry: rec.work_permit_expiry?dayjs(rec.work_permit_expiry):null, background_check_date: rec.background_check_date?dayjs(rec.background_check_date):null, medical_clearance_date: rec.medical_clearance_date?dayjs(rec.medical_clearance_date):null })
        : contractorForm.resetFields();
  };

  const handleVendorSubmit = () => vendorForm.validateFields().then(v => {
    const p = { ...v, contract_start: v.contract_start?v.contract_start.toISOString():null, contract_end: v.contract_end?v.contract_end.toISOString():null };
    editingVendor ? updateVendorMut.mutate({ id:editingVendor.id, ...p }) : createVendorMut.mutate(p);
  }).catch(()=>{});

  const handleContractorSubmit = () => contractorForm.validateFields().then(v => {
    const p = { ...v, date_of_birth: v.date_of_birth?v.date_of_birth.toISOString():null, work_permit_expiry: v.work_permit_expiry?v.work_permit_expiry.toISOString():null, background_check_date: v.background_check_date?v.background_check_date.toISOString():null, medical_clearance_date: v.medical_clearance_date?v.medical_clearance_date.toISOString():null };
    editingContractor ? updateContractorMut.mutate({ id:editingContractor.id, ...p }) : createContractorMut.mutate(p);
  }).catch(()=>{});

  // ── Export helpers ─────────────────────────────────────────────────────────
  const vendorExportCols = [
    { t:'Code',        v:r=>r.vendor_code||'' },
    { t:'Name',        v:r=>r.vendor_name||'' },
    { t:'Type',        v:r=>r.vendor_type||'' },
    { t:'Status',      v:r=>r.status||'' },
    { t:'Contact',     v:r=>r.contact_person||'' },
    { t:'Email',       v:r=>r.email||'' },
    { t:'Phone',       v:r=>r.phone||'' },
    { t:'Contract End',v:r=>r.contract_end?dayjs(r.contract_end).format('YYYY-MM-DD'):'' },
    { t:'Compliance',  v:r=>r.compliance_status||'' },
    { t:'Contractors', v:r=>String(allContractors.filter(c=>c.vendor_id===r.id).length) },
  ];
  const contractorExportCols = [
    { t:'Code',       v:r=>r.contractor_code||'' },
    { t:'Name',       v:r=>`${r.first_name||''} ${r.last_name||''}`.trim() },
    { t:'Vendor',     v:r=>allVendors.find(v=>v.id===r.vendor_id)?.vendor_name||'' },
    { t:'Job Title',  v:r=>r.job_title||'' },
    { t:'Availability',v:r=>r.availability_status||'' },
    { t:'BG Check',   v:r=>r.background_check_status||'' },
    { t:'Medical',    v:r=>r.medical_clearance_status||'' },
    { t:'WP Expiry',  v:r=>r.work_permit_expiry?dayjs(r.work_permit_expiry).format('YYYY-MM-DD'):'' },
  ];

  // ── Expandable rows ────────────────────────────────────────────────────────
  const vendorExpandRender = rec => (
    <div style={{ padding:'10px 16px 14px 58px', background:'#fafafa' }}>
      <Row gutter={[16,8]}>
        {rec.description && <Col xs={24} md={16}><div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Services Offered</div><div style={{ fontSize:12,color:'#374151' }}>{rec.description}</div></Col>}
        <Col xs={24} md={8}>
          <div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Contact</div>
          <div style={{ fontSize:11,color:'#374151' }}>{rec.contact_person||'—'}</div>
          {rec.email && <div style={{ fontSize:11,color:'#6b7280' }}>{rec.email}</div>}
          {rec.phone && <div style={{ fontSize:11,color:'#6b7280' }}>{rec.phone}</div>}
        </Col>
        {(rec.business_registration||rec.tax_id) && (
          <Col xs={24} md={12}>
            <div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Registration</div>
            {rec.business_registration && <div style={{ fontSize:11,color:'#374151' }}>RC: <strong>{rec.business_registration}</strong></div>}
            {rec.tax_id && <div style={{ fontSize:11,color:'#374151' }}>TIN: <strong>{rec.tax_id}</strong></div>}
          </Col>
        )}
        {rec.notes && <Col xs={24}><div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Notes</div><div style={{ fontSize:11,color:'#6b7280',fontStyle:'italic' }}>{rec.notes}</div></Col>}
        {!rec.description&&!rec.notes&&!rec.business_registration&&<Col xs={24}><span style={{ fontSize:12,color:'#9ca3af' }}>No additional details</span></Col>}
      </Row>
    </div>
  );

  const contractorExpandRender = rec => {
    const vendor = allVendors.find(v=>v.id===rec.vendor_id);
    return (
      <div style={{ padding:'10px 16px 14px 54px', background:'#fafafa' }}>
        <Row gutter={[16,8]}>
          {rec.specialization && <Col xs={24} md={8}><div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Specialization</div><div style={{ fontSize:12,color:'#374151' }}>{rec.specialization}</div></Col>}
          <Col xs={12} md={4}><div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Experience</div><div style={{ fontSize:12,color:'#374151' }}>{rec.experience_years!=null?`${rec.experience_years} yrs`:'—'}</div></Col>
          <Col xs={12} md={5}><div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Daily Rate</div><div style={{ fontSize:12,color:'#374151' }}>{rec.daily_rate!=null?`${rec.currency||'USD'} ${rec.daily_rate}`:'—'}</div></Col>
          {vendor && <Col xs={24} md={7}><div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Company</div><div style={{ fontSize:12,color:'#374151' }}>{vendor.vendor_name}</div></Col>}
          {(rec.national_id||rec.passport_number) && (
            <Col xs={24} md={12}>
              <div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Identity</div>
              {rec.national_id      && <div style={{ fontSize:11,color:'#374151' }}>NIN: <strong style={{ fontFamily:'monospace' }}>{rec.national_id}</strong></div>}
              {rec.passport_number  && <div style={{ fontSize:11,color:'#374151' }}>Passport: <strong style={{ fontFamily:'monospace' }}>{rec.passport_number}</strong></div>}
            </Col>
          )}
          {rec.notes && <Col xs={24}><div style={{ fontSize:11,fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4 }}>Notes / Certifications</div><div style={{ fontSize:11,color:'#6b7280',fontStyle:'italic' }}>{rec.notes}</div></Col>}
        </Row>
      </div>
    );
  };

  // ── Vendor table columns ───────────────────────────────────────────────────
  const vendorColumns = [
    {
      title:'Vendor', key:'vendor', width:230,
      sorter:(a,b)=>(a.vendor_name||'').localeCompare(b.vendor_name||''),
      render:(_,r)=><VendorCell rec={r} onClick={()=>{ setDetailRecord(r); setDetailType('vendor'); setDetailVisible(true); }}/>,
    },
    {
      title:'Type', key:'type', width:165,
      sorter:(a,b)=>(a.vendor_type||'').localeCompare(b.vendor_type||''),
      filters: Object.entries(VENDOR_TYPE_CFG).map(([k,v])=>({ text:v.label, value:k })),
      onFilter: (val,r) => r.vendor_type===val,
      render:(_,r)=><VendorTypePill value={r.vendor_type}/>,
    },
    {
      title:'Contract', key:'contract', width:200,
      sorter:(a,b)=>dayjs(a.contract_end||0).diff(dayjs(b.contract_end||0)),
      render:(_,r)=>{
        if (!r.contract_start&&!r.contract_end) return <span style={{ color:'#d1d5db' }}>—</span>;
        return (
          <div>
            <div style={{ fontSize:11, color:'#374151' }}>
              {r.contract_start?dayjs(r.contract_start).format('DD MMM YY'):'?'} → {r.contract_end?dayjs(r.contract_end).format('DD MMM YY'):'?'}
            </div>
            {r.contract_end && <div style={{ marginTop:3 }}><ContractBadge date={r.contract_end}/></div>}
          </div>
        );
      },
    },
    {
      title:'Contractors', key:'ctrs', width:110, align:'center',
      sorter:(a,b)=>allContractors.filter(c=>c.vendor_id===a.id).length - allContractors.filter(c=>c.vendor_id===b.id).length,
      render:(_,r)=>{
        const count = allContractors.filter(c=>c.vendor_id===r.id).length;
        return (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center' }}>
            <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 10px',borderRadius:999,fontSize:12,fontWeight:700,color:count>0?'#2563eb':'#9ca3af',background:count>0?'#eff6ff':'#f9fafb',border:`1px solid ${count>0?'#bfdbfe':'#e5e7eb'}` }}>
              <TeamOutlined style={{ fontSize:10 }}/> {count}
            </span>
          </div>
        );
      },
    },
    {
      title:'Status', key:'status', width:140,
      sorter:(a,b)=>(a.status||'').localeCompare(b.status||''),
      filters: Object.entries(VENDOR_STATUS_CFG).map(([k,v])=>({ text:v.label, value:k })),
      onFilter: (val,r) => r.status===val,
      render:(_,r)=><VendorStatusPill value={r.status}/>,
    },
    {
      title:'Compliance', key:'compliance', width:135,
      sorter:(a,b)=>(a.compliance_status||'').localeCompare(b.compliance_status||''),
      render:(_,r)=><CompliancePill value={r.compliance_status}/>,
    },
    {
      title:'', key:'actions', fixed:'right', width:56,
      render:(_,r)=>(
        <Dropdown trigger={['click']} menu={{ items:[
          { key:'view',   label:'View Details',  icon:<EyeOutlined/>,   onClick:()=>{ setDetailRecord(r); setDetailType('vendor'); setDetailVisible(true); } },
          { key:'edit',   label:'Edit Vendor',   icon:<EditOutlined/>,  onClick:()=>openVendorDrawer(r) },
          { key:'expand', icon:<ExpandAltOutlined/>, label:expandedVendors.includes(r.id)?'Collapse Row':'Expand Details', onClick:()=>setExpandedVendors(p=>p.includes(r.id)?p.filter(k=>k!==r.id):[...p,r.id]) },
          { key:'export', label:'Export Row',    icon:<DownloadOutlined/>, onClick:()=>exportCSV(vendorExportCols,[r],`vendor-${r.vendor_code||r.id}-${dayjs().format('YYYY-MM-DD')}.csv`) },
          { type:'divider' },
          { key:'delete', label:'Delete', icon:<DeleteOutlined/>, danger:true, onClick:()=>Modal.confirm({
            title:`Delete "${r.vendor_name}"?`,
            content:'All associated contractors will be unlinked.',
            icon:<ExclamationCircleOutlined style={{ color:'#dc2626' }}/>,
            okText:'Delete', okButtonProps:{ danger:true },
            onOk:()=>deleteVendorMut.mutateAsync(r.id),
          })},
        ]}}>
          <Button size="small" type="text" icon={<MoreOutlined/>} style={{ borderRadius:6 }}/>
        </Dropdown>
      ),
    },
  ];

  // ── Contractor table columns ───────────────────────────────────────────────
  const contractorColumns = [
    {
      title:'Contractor', key:'name', width:210,
      sorter:(a,b)=>`${a.first_name||''} ${a.last_name||''}`.localeCompare(`${b.first_name||''} ${b.last_name||''}`),
      render:(_,r)=><ContractorCell rec={r} onClick={()=>{ setDetailRecord(r); setDetailType('contractor'); setDetailVisible(true); }}/>,
    },
    {
      title:'Company', key:'vendor', width:160, ellipsis:true,
      sorter:(a,b)=>{
        const va=allVendors.find(v=>v.id===a.vendor_id)?.vendor_name||'';
        const vb=allVendors.find(v=>v.id===b.vendor_id)?.vendor_name||'';
        return va.localeCompare(vb);
      },
      render:(_,r)=>{
        const v = allVendors.find(x=>x.id===r.vendor_id);
        return v ? <VendorTypePill value={v.vendor_type}/> && <span style={{ fontSize:11,color:'#374151' }}>{v.vendor_name}</span> : <span style={{ color:'#d1d5db' }}>Unassigned</span>;
      },
    },
    {
      title:'Work Permit', key:'wp', width:165,
      sorter:(a,b)=>dayjs(a.work_permit_expiry||0).diff(dayjs(b.work_permit_expiry||0)),
      render:(_,r)=>r.work_permit_expiry ? (
        <div>
          <div style={{ fontSize:11,color:'#374151' }}>{dayjs(r.work_permit_expiry).format('DD MMM YYYY')}</div>
          <div style={{ marginTop:3 }}><ContractBadge date={r.work_permit_expiry}/></div>
        </div>
      ) : <span style={{ color:'#d1d5db' }}>—</span>,
    },
    {
      title:'Background', key:'bg', width:120,
      filters: Object.entries(BG_CFG).map(([k,v])=>({ text:v.label, value:k })),
      onFilter: (val,r)=>r.background_check_status===val,
      render:(_,r)=><BgPill value={r.background_check_status}/>,
    },
    {
      title:'Medical', key:'med', width:110,
      filters: Object.entries(MED_CFG).map(([k,v])=>({ text:v.label, value:k })),
      onFilter: (val,r)=>r.medical_clearance_status===val,
      render:(_,r)=><MedPill value={r.medical_clearance_status}/>,
    },
    {
      title:'Availability', key:'avail', width:120,
      sorter:(a,b)=>(a.availability_status||'').localeCompare(b.availability_status||''),
      filters: Object.entries(AVAIL_CFG).map(([k,v])=>({ text:v.label, value:k })),
      onFilter: (val,r)=>r.availability_status===val,
      render:(_,r)=><AvailPill value={r.availability_status}/>,
    },
    {
      title:'', key:'actions', fixed:'right', width:56,
      render:(_,r)=>(
        <Dropdown trigger={['click']} menu={{ items:[
          { key:'view',   label:'View Details',    icon:<EyeOutlined/>,   onClick:()=>{ setDetailRecord(r); setDetailType('contractor'); setDetailVisible(true); } },
          { key:'edit',   label:'Edit Contractor', icon:<EditOutlined/>,  onClick:()=>openContractorDrawer(r) },
          { key:'expand', icon:<ExpandAltOutlined/>, label:expandedContractors.includes(r.id)?'Collapse Row':'Expand Details', onClick:()=>setExpandedContractors(p=>p.includes(r.id)?p.filter(k=>k!==r.id):[...p,r.id]) },
          { key:'export', label:'Export Row', icon:<DownloadOutlined/>, onClick:()=>exportCSV(contractorExportCols,[r],`contractor-${r.contractor_code||r.id}-${dayjs().format('YYYY-MM-DD')}.csv`) },
        ]}}>
          <Button size="small" type="text" icon={<MoreOutlined/>} style={{ borderRadius:6 }}/>
        </Dropdown>
      ),
    },
  ];

  const selectedVendorRecs     = vendors.filter(v=>selectedVendors.includes(v.id));
  const selectedContractorRecs = contractors.filter(c=>selectedContractors.includes(c.id));

  const rec = detailRecord;

  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', overflow:'visible' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Contractor & Vendor Management</div>
              <div style={{ fontSize:12, color:'#64748b', fontWeight:400, marginTop:2 }}>
                Manage vendors, contractors, compliance and clearances
              </div>
            </div>
            <Space size="middle" style={{ overflow:'visible' }}>
              <Button icon={<ReloadOutlined/>} size="small" onClick={()=>{ refetchVendors(); refetchContractors(); }} loading={vendorsLoading||contractorsLoading}>Refresh</Button>
              <Button icon={<PlusOutlined/>} size="small" onClick={()=>openContractorDrawer()}>Add Contractor</Button>
              <Button type="primary" icon={<PlusOutlined/>} size="small" onClick={()=>openVendorDrawer()} style={{ background:'#7c3aed', borderColor:'#7c3aed', fontWeight:600 }}>Add Vendor</Button>
            </Space>
          </div>
        }
        styles={{ header: { overflow:'visible' } }}
      >

      {/* Stat cards */}
      <Row gutter={[12,12]} style={{ marginBottom:16 }}>
        {[
          { label:'Total Vendors',      value:allVendors.length,     color:'#7c3aed', icon:<ShopOutlined/>          },
          { label:'Active Vendors',     value:activeVendors,         color:'#15803d', icon:<CheckCircleOutlined/>   },
          { label:'Total Contractors',  value:allContractors.length, color:'#2563eb', icon:<TeamOutlined/>          },
          { label:'Available Now',      value:availableCount,        color:'#059669', icon:<UserOutlined/>          },
          { label:'Contracts Expiring', value:expiringCount+expiredCount, color: (expiringCount+expiredCount)>0?'#dc2626':'#94a3b8', icon:<WarningOutlined/> },
        ].map(s=>(
          <Col xs={12} sm={24/5} key={s.label} style={{ minWidth:120 }}>
            <div style={{ background:'#fff', borderRadius:12, padding:'14px 18px', border:'1px solid #f0f0f0', borderTop:`3px solid ${s.color}`, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:10, color:'#8c8c8c', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.5px' }}>{s.label}</div>
                  <div style={{ fontSize:24, fontWeight:700, color:s.color, lineHeight:1.2, marginTop:4 }}>{s.value}</div>
                </div>
                <div style={{ width:36, height:36, borderRadius:9, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, fontSize:16 }}>
                  {s.icon}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {(expiringCount>0||expiredCount>0) && (
        <Alert message={`${expiredCount} vendor contract(s) expired · ${expiringCount} expiring within 30 days`} type="warning" showIcon closable style={{ marginBottom:12, borderRadius:8 }}
          action={<Button size="small" onClick={()=>{ setActiveTab('vendors'); setFilterStatus(null); }}>View Vendors</Button>}/>
      )}

      {/* Tabs */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding:'0 16px' }} items={[

          // ── Vendors tab ────────────────────────────────────────────────────
          {
            key:'vendors',
            label:<span><ShopOutlined/> Vendors <span style={{ marginLeft:4, fontSize:11, color:'#94a3b8' }}>({vendors.length})</span></span>,
            children:(
              <div style={{ paddingBottom:16 }}>
                {/* Filter bar */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                  <Input placeholder="Search vendor name, code, contact…" prefix={<SearchOutlined style={{ color:'#94a3b8',fontSize:12 }}/>}
                    value={search} onChange={e=>setSearch(e.target.value)} allowClear style={{ flex:'1 1 200px', maxWidth:280, borderRadius:8 }}/>
                  <FilterOutlined style={{ color:'#94a3b8', fontSize:12 }}/>
                  <Select placeholder="Type" allowClear style={{ flex:'1 1 160px', minWidth:160 }}
                    value={filterType} onChange={setFilterType}
                    options={Object.entries(VENDOR_TYPE_CFG).map(([k,v])=>({ value:k, label:<VendorTypePill value={k}/> }))}/>
                  <Select placeholder="Status" allowClear style={{ flex:'1 1 145px', minWidth:145 }}
                    value={filterStatus} onChange={setFilterStatus}
                    options={Object.entries(VENDOR_STATUS_CFG).map(([k,v])=>({ value:k, label:<VendorStatusPill value={k}/> }))}/>
                  <Tooltip title="Export visible rows">
                    <Button icon={<DownloadOutlined/>} onClick={()=>exportCSV(vendorExportCols,vendors,`vendors-${dayjs().format('YYYY-MM-DD')}.csv`)} style={{ borderRadius:8 }}/>
                  </Tooltip>
                </div>

                {hasVendorFilters && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>Filters:</span>
                    {search && <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:999,fontSize:11,background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe' }}>"{search}"<button type="button" onClick={()=>setSearch('')} style={{ background:'none',border:'none',cursor:'pointer',padding:0,color:'#2563eb',fontSize:12 }}>×</button></span>}
                    {filterType && (() => { const c=VENDOR_TYPE_CFG[filterType]; return <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:999,fontSize:11,background:c.bg,color:c.color,border:`1px solid ${c.border}` }}>{c.label}<button type="button" onClick={()=>setFilterType(null)} style={{ background:'none',border:'none',cursor:'pointer',padding:0,color:'inherit',fontSize:12 }}>×</button></span>; })()}
                    {filterStatus && (() => { const c=VENDOR_STATUS_CFG[filterStatus]; return <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:999,fontSize:11,background:c.bg,color:c.color,border:`1px solid ${c.border}` }}>{c.label}<button type="button" onClick={()=>setFilterStatus(null)} style={{ background:'none',border:'none',cursor:'pointer',padding:0,color:'inherit',fontSize:12 }}>×</button></span>; })()}
                    <button type="button" onClick={clearVendorFilters} style={{ background:'none',border:'none',cursor:'pointer',padding:'2px 6px',fontSize:11,color:'#94a3b8',textDecoration:'underline' }}>Clear all</button>
                  </div>
                )}

                {selectedVendors.length>0 && (
                  <div style={{ display:'flex',alignItems:'center',gap:12,padding:'8px 14px',marginBottom:10,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8 }}>
                    <CheckSquareOutlined style={{ color:'#2563eb',fontSize:15 }}/>
                    <span style={{ fontWeight:600,color:'#2563eb',fontSize:13 }}>{selectedVendors.length} vendor{selectedVendors.length!==1?'s':''} selected</span>
                    <div style={{ flex:1 }}/>
                    <Button size="small" icon={<DownloadOutlined/>} onClick={()=>exportCSV(vendorExportCols,selectedVendorRecs,`vendors-selected-${dayjs().format('YYYY-MM-DD')}.csv`)}>Export CSV</Button>
                    <Button size="small" type="text" onClick={()=>setSelectedVendors([])}>Clear</Button>
                  </div>
                )}

                <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid #e2e8f0' }}>
                  <Table columns={vendorColumns} dataSource={vendors} loading={vendorsLoading} rowKey="id" size="middle" scroll={{ x:1050 }}
                    rowSelection={{ selectedRowKeys:selectedVendors, onChange:setSelectedVendors, selections:[Table.SELECTION_ALL,Table.SELECTION_INVERT,Table.SELECTION_NONE,{ key:'active',text:'Select Active',onSelect:()=>setSelectedVendors(vendors.filter(v=>v.status==='ACTIVE').map(v=>v.id)) }] }}
                    expandable={{ expandedRowKeys:expandedVendors, onExpandedRowsChange:setExpandedVendors, expandedRowRender:vendorExpandRender, rowExpandable:()=>true }}
                    pagination={{ pageSize:20,showSizeChanger:true,showTotal:(t,r)=><span>{r[0]}–{r[1]} of <strong>{t}</strong>{hasVendorFilters&&<span style={{ color:'#94a3b8',marginLeft:4 }}>(from {allVendors.length})</span>}</span>,style:{ padding:'12px 16px',margin:0 } }}
                    rowClassName={r=>{
                      if (['BLACKLISTED','SUSPENDED'].includes(r.status)) return 'row-danger';
                      if (r.status==='PENDING_APPROVAL') return 'row-pending';
                      if (r.status==='INACTIVE') return 'row-inactive';
                      if (r.contract_end&&dayjs(r.contract_end).isBefore(dayjs())) return 'row-expired';
                      return '';
                    }}
                    footer={()=>(
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'#94a3b8' }}>
                        <Space size={16}>
                          {Object.entries(VENDOR_STATUS_CFG).map(([k,v])=>{ const c=vendors.filter(x=>x.status===k).length; return c>0?<span key={k} style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:6,height:6,borderRadius:'50%',background:v.color }}/>{v.label}: <strong style={{ color:'#374151' }}>{c}</strong></span>:null; })}
                        </Space>
                        <Button size="small" type="text" icon={<DownloadOutlined/>} style={{ color:'#94a3b8' }} onClick={()=>exportCSV(vendorExportCols,vendors,`vendors-${dayjs().format('YYYY-MM-DD')}.csv`)}>Export all ({vendors.length})</Button>
                      </div>
                    )}
                  />
                </div>
              </div>
            ),
          },

          // ── Contractors tab ────────────────────────────────────────────────
          {
            key:'contractors',
            label:<span><TeamOutlined/> Contractors <span style={{ marginLeft:4,fontSize:11,color:'#94a3b8' }}>({contractors.length})</span></span>,
            children:(
              <div style={{ paddingBottom:16 }}>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                  <Input placeholder="Search contractor name, code, job title…" prefix={<SearchOutlined style={{ color:'#94a3b8',fontSize:12 }}/>}
                    value={search} onChange={e=>setSearch(e.target.value)} allowClear style={{ flex:'1 1 220px', maxWidth:300, borderRadius:8 }}/>
                  <FilterOutlined style={{ color:'#94a3b8', fontSize:12 }}/>
                  <Select placeholder="Availability" allowClear style={{ flex:'1 1 140px', minWidth:140 }}
                    value={filterAvail} onChange={setFilterAvail}
                    options={Object.entries(AVAIL_CFG).map(([k,v])=>({ value:k, label:<AvailPill value={k}/> }))}/>
                  <Tooltip title="Export visible rows">
                    <Button icon={<DownloadOutlined/>} onClick={()=>exportCSV(contractorExportCols,contractors,`contractors-${dayjs().format('YYYY-MM-DD')}.csv`)} style={{ borderRadius:8 }}/>
                  </Tooltip>
                </div>

                {hasContractorFilters && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>Filters:</span>
                    {search && <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:999,fontSize:11,background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe' }}>"{search}"<button type="button" onClick={()=>setSearch('')} style={{ background:'none',border:'none',cursor:'pointer',padding:0,color:'#2563eb',fontSize:12 }}>×</button></span>}
                    {filterAvail && (() => { const c=AVAIL_CFG[filterAvail]; return <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:999,fontSize:11,background:c.bg,color:c.color,border:`1px solid ${c.border}` }}>{c.label}<button type="button" onClick={()=>setFilterAvail(null)} style={{ background:'none',border:'none',cursor:'pointer',padding:0,color:'inherit',fontSize:12 }}>×</button></span>; })()}
                    <button type="button" onClick={clearContractorFilters} style={{ background:'none',border:'none',cursor:'pointer',padding:'2px 6px',fontSize:11,color:'#94a3b8',textDecoration:'underline' }}>Clear all</button>
                  </div>
                )}

                {selectedContractors.length>0 && (
                  <div style={{ display:'flex',alignItems:'center',gap:12,padding:'8px 14px',marginBottom:10,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8 }}>
                    <CheckSquareOutlined style={{ color:'#2563eb',fontSize:15 }}/>
                    <span style={{ fontWeight:600,color:'#2563eb',fontSize:13 }}>{selectedContractors.length} contractor{selectedContractors.length!==1?'s':''} selected</span>
                    <div style={{ flex:1 }}/>
                    <Button size="small" icon={<DownloadOutlined/>} onClick={()=>exportCSV(contractorExportCols,selectedContractorRecs,`contractors-selected-${dayjs().format('YYYY-MM-DD')}.csv`)}>Export CSV</Button>
                    <Button size="small" type="text" onClick={()=>setSelectedContractors([])}>Clear</Button>
                  </div>
                )}

                <div style={{ borderRadius:8, overflow:'hidden', border:'1px solid #e2e8f0' }}>
                  <Table columns={contractorColumns} dataSource={contractors} loading={contractorsLoading} rowKey="id" size="middle" scroll={{ x:1100 }}
                    rowSelection={{ selectedRowKeys:selectedContractors, onChange:setSelectedContractors, selections:[Table.SELECTION_ALL,Table.SELECTION_INVERT,Table.SELECTION_NONE,{ key:'avail',text:'Select Available',onSelect:()=>setSelectedContractors(contractors.filter(c=>c.availability_status==='AVAILABLE').map(c=>c.id)) }] }}
                    expandable={{ expandedRowKeys:expandedContractors, onExpandedRowsChange:setExpandedContractors, expandedRowRender:contractorExpandRender, rowExpandable:()=>true }}
                    pagination={{ pageSize:20,showSizeChanger:true,showTotal:(t,r)=><span>{r[0]}–{r[1]} of <strong>{t}</strong>{hasContractorFilters&&<span style={{ color:'#94a3b8',marginLeft:4 }}>(from {allContractors.length})</span>}</span>,style:{ padding:'12px 16px',margin:0 } }}
                    rowClassName={r=>{
                      if (r.background_check_status==='FAILED'||r.medical_clearance_status==='FAILED') return 'row-danger';
                      if (r.availability_status==='UNAVAILABLE') return 'row-inactive';
                      if (r.work_permit_expiry&&dayjs(r.work_permit_expiry).isBefore(dayjs())) return 'row-expired';
                      const a=(r.availability_status||'').toLowerCase().replace(/_/g,'-');
                      return `row-${a}`;
                    }}
                    footer={()=>(
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'#94a3b8' }}>
                        <Space size={16}>
                          {Object.entries(AVAIL_CFG).map(([k,v])=>{ const c=contractors.filter(x=>x.availability_status===k).length; return c>0?<span key={k} style={{ display:'inline-flex',alignItems:'center',gap:4 }}><span style={{ width:6,height:6,borderRadius:'50%',background:v.color }}/>{v.label}: <strong style={{ color:'#374151' }}>{c}</strong></span>:null; })}
                        </Space>
                        <Button size="small" type="text" icon={<DownloadOutlined/>} style={{ color:'#94a3b8' }} onClick={()=>exportCSV(contractorExportCols,contractors,`contractors-${dayjs().format('YYYY-MM-DD')}.csv`)}>Export all ({contractors.length})</Button>
                      </div>
                    )}
                  />
                </div>
              </div>
            ),
          },
        ]}/>
      </div>

      {/* ── Add/Edit Vendor Drawer ─────────────────────────────────────────── */}
      <Drawer
        title={<Space><div style={{ width:24,height:24,borderRadius:6,background:editingVendor?'#dbeafe':'#ede9fe',display:'flex',alignItems:'center',justifyContent:'center' }}>{editingVendor?<EditOutlined style={{ color:'#2563eb',fontSize:12 }}/>:<PlusOutlined style={{ color:'#7c3aed',fontSize:12 }}/>}</div>{editingVendor?`Edit: ${editingVendor.vendor_name}`:'Register Vendor'}</Space>}
        open={vendorDrawerOpen} onClose={()=>{ setVendorDrawerOpen(false); vendorForm.resetFields(); }} width={680}
        footer={<Space style={{ float:'right' }}><Button onClick={()=>{ setVendorDrawerOpen(false); vendorForm.resetFields(); }}>Cancel</Button><Button type="primary" onClick={handleVendorSubmit} loading={createVendorMut.isPending||updateVendorMut.isPending}>{editingVendor?'Save Changes':'Register Vendor'}</Button></Space>}
        destroyOnHidden
      >
        <Form form={vendorForm} layout="vertical" size="small">
          <Divider orientation="left"><Space><ShopOutlined style={{ color:'#7c3aed' }}/>Basic Information</Space></Divider>
          <Row gutter={12}>
            <Col span={10}><Form.Item name="vendor_code" label="Vendor Code" rules={[{ required:true }]}><Input placeholder="VEND-001" size="middle" disabled={!!editingVendor}/></Form.Item></Col>
            <Col span={14}><Form.Item name="vendor_type" label="Vendor Type" rules={[{ required:true }]}><Select placeholder="Select type" size="middle" options={Object.entries(VENDOR_TYPE_CFG).map(([k,v])=>({ value:k, label:<VendorTypePill value={k}/> }))}/></Form.Item></Col>
            <Col span={24}><Form.Item name="vendor_name" label="Vendor Name" rules={[{ required:true }]}><Input placeholder="e.g., Halliburton Nigeria Ltd" size="middle"/></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="Services Offered"><Input.TextArea rows={2} placeholder="e.g., Drilling services, well completion…" size="middle"/></Form.Item></Col>
          </Row>
          <Divider orientation="left"><Space><PhoneOutlined style={{ color:'#15803d' }}/>Contact Details</Space></Divider>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="contact_person" label="Contact Person"><Input placeholder="Primary contact name" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="Email"><Input placeholder="vendor@company.com" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="Phone"><Input placeholder="+234-800-000-0000" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="mobile" label="Mobile"><Input placeholder="+234-800-000-0000" size="middle"/></Form.Item></Col>
            <Col span={24}><Form.Item name="address_line1" label="Address"><Input placeholder="Street address" size="middle"/></Form.Item></Col>
            <Col span={8}><Form.Item name="city" label="City"><Input placeholder="City" size="middle"/></Form.Item></Col>
            <Col span={8}><Form.Item name="state" label="State"><Input placeholder="State" size="middle"/></Form.Item></Col>
            <Col span={8}><Form.Item name="country" label="Country" initialValue="Nigeria"><Input placeholder="Country" size="middle"/></Form.Item></Col>
          </Row>
          <Divider orientation="left"><Space><FileTextOutlined style={{ color:'#2563eb' }}/>Contract & Payment</Space></Divider>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="contract_start" label="Contract Start"><DatePicker style={{ width:'100%' }} format="DD MMM YYYY" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="contract_end" label="Contract End"><DatePicker style={{ width:'100%' }} format="DD MMM YYYY" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="payment_terms" label="Payment Terms"><Input placeholder="e.g., Net 30" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="currency" label="Currency" initialValue="USD"><Select size="middle" options={['USD','NGN','GBP','EUR'].map(c=>({ value:c, label:c }))}/></Form.Item></Col>
          </Row>
          <Divider orientation="left"><Space><BankOutlined style={{ color:'#d97706' }}/>Registration & Status</Space></Divider>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="business_registration" label="Business Registration (RC No.)"><Input placeholder="CAC/RC Number" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="tax_id" label="Tax ID (TIN)"><Input placeholder="Tax Identification Number" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="website" label="Website"><Input placeholder="https://..." size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="status" label="Status" initialValue="ACTIVE"><Select size="middle" options={Object.entries(VENDOR_STATUS_CFG).map(([k,v])=>({ value:k, label:<VendorStatusPill value={k}/> }))}/></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="Notes"><Input.TextArea rows={2} size="middle"/></Form.Item></Col>
          </Row>
        </Form>
      </Drawer>

      {/* ── Add/Edit Contractor Drawer ─────────────────────────────────────── */}
      <Drawer
        title={<Space><div style={{ width:24,height:24,borderRadius:6,background:editingContractor?'#dbeafe':'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center' }}>{editingContractor?<EditOutlined style={{ color:'#2563eb',fontSize:12 }}/>:<PlusOutlined style={{ color:'#15803d',fontSize:12 }}/>}</div>{editingContractor?`Edit: ${editingContractor.first_name} ${editingContractor.last_name}`:'Register Contractor'}</Space>}
        open={contractorDrawerOpen} onClose={()=>{ setContractorDrawerOpen(false); contractorForm.resetFields(); }} width={680}
        footer={<Space style={{ float:'right' }}><Button onClick={()=>{ setContractorDrawerOpen(false); contractorForm.resetFields(); }}>Cancel</Button><Button type="primary" onClick={handleContractorSubmit} loading={createContractorMut.isPending||updateContractorMut.isPending} style={{ background:'#15803d',borderColor:'#15803d' }}>{editingContractor?'Save Changes':'Register Contractor'}</Button></Space>}
        destroyOnHidden
      >
        <Form form={contractorForm} layout="vertical" size="small">
          <Divider orientation="left"><Space><UserOutlined style={{ color:'#2563eb' }}/>Personal Information</Space></Divider>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="first_name" label="First Name" rules={[{ required:true }]}><Input size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="last_name" label="Last Name" rules={[{ required:true }]}><Input size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="contractor_code" label="Contractor Code"><Input placeholder="Auto-generated if blank" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="vendor_id" label="Company (Vendor)" rules={[{ required:true }]}><Select placeholder="Select vendor" showSearch optionFilterProp="label" size="middle" options={allVendors.map(v=>({ value:v.id, label:v.vendor_name }))}/></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="Email"><Input placeholder="contractor@email.com" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="Phone"><Input size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="date_of_birth" label="Date of Birth"><DatePicker style={{ width:'100%' }} format="DD MMM YYYY" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="national_id" label="National ID (NIN)"><Input size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="passport_number" label="Passport Number"><Input size="middle"/></Form.Item></Col>
          </Row>
          <Divider orientation="left"><Space><FileTextOutlined style={{ color:'#15803d' }}/>Professional Details</Space></Divider>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="job_title" label="Job Title"><Input placeholder="e.g., Drilling Engineer" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="specialization" label="Specialization"><Input placeholder="e.g., Well Completion" size="middle"/></Form.Item></Col>
            <Col span={8}><Form.Item name="experience_years" label="Experience (yrs)"><InputNumber min={0} max={60} style={{ width:'100%' }} size="middle"/></Form.Item></Col>
            <Col span={8}><Form.Item name="daily_rate" label="Daily Rate"><InputNumber min={0} style={{ width:'100%' }} size="middle"/></Form.Item></Col>
            <Col span={8}><Form.Item name="currency" label="Currency" initialValue="USD"><Select size="middle" options={['USD','NGN','GBP','EUR'].map(c=>({ value:c, label:c }))}/></Form.Item></Col>
            <Col span={12}><Form.Item name="availability_status" label="Availability" initialValue="AVAILABLE"><Select size="middle" options={Object.entries(AVAIL_CFG).map(([k,v])=>({ value:k, label:<AvailPill value={k}/> }))}/></Form.Item></Col>
          </Row>
          <Divider orientation="left"><Space><SafetyCertificateOutlined style={{ color:'#d97706' }}/>Work Permit & Clearances</Space></Divider>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="work_permit_number" label="Work Permit Number"><Input size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="work_permit_expiry" label="Work Permit Expiry"><DatePicker style={{ width:'100%' }} format="DD MMM YYYY" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="background_check_status" label="Background Check" initialValue="PENDING"><Select size="middle" options={Object.entries(BG_CFG).map(([k,v])=>({ value:k, label:<BgPill value={k}/> }))}/></Form.Item></Col>
            <Col span={12}><Form.Item name="background_check_date" label="BG Check Date"><DatePicker style={{ width:'100%' }} format="DD MMM YYYY" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="medical_clearance_status" label="Medical Clearance" initialValue="PENDING"><Select size="middle" options={Object.entries(MED_CFG).map(([k,v])=>({ value:k, label:<MedPill value={k}/> }))}/></Form.Item></Col>
            <Col span={12}><Form.Item name="medical_clearance_date" label="Medical Date"><DatePicker style={{ width:'100%' }} format="DD MMM YYYY" size="middle"/></Form.Item></Col>
            <Col span={12}><Form.Item name="security_clearance" label="Security Clearance"><Select placeholder="Select level" allowClear size="middle" options={['NONE','BASIC','STANDARD','HIGH','TOP_SECRET'].map(s=>({ value:s, label:s.replace('_',' ') }))}/></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="Notes / Certifications"><Input.TextArea rows={2} placeholder="HSE certs, BOSIET, HUET, special qualifications…" size="middle"/></Form.Item></Col>
          </Row>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ──────────────────────────────────────────────────── */}
      <Drawer
        title={rec && (
          <Space>
            {detailType==='vendor'
              ? <div style={{ width:28,height:28,borderRadius:7,background:VENDOR_TYPE_CFG[rec.vendor_type]?.bg||'#f3f4f6',border:`1px solid ${VENDOR_TYPE_CFG[rec.vendor_type]?.border||'#e5e7eb'}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,color:VENDOR_TYPE_CFG[rec.vendor_type]?.color||'#6b7280' }}>{(rec.vendor_name||'?')[0].toUpperCase()}</div>
              : <Avatar size={28} style={{ background:avatarColor(`${rec.first_name} ${rec.last_name}`),fontSize:10,fontWeight:700 }}>{initials(`${rec.first_name||''} ${rec.last_name||''}`)}</Avatar>
            }
            <span style={{ fontWeight:700 }}>{detailType==='vendor'?rec.vendor_name:`${rec.first_name} ${rec.last_name}`}</span>
            {detailType==='vendor' && <VendorStatusPill value={rec.status}/>}
            {detailType==='contractor' && <AvailPill value={rec.availability_status}/>}
          </Space>
        )}
        open={detailVisible} onClose={()=>setDetailVisible(false)} width={500}
        extra={<Space><Button icon={<EditOutlined/>} size="small" onClick={()=>{ setDetailVisible(false); detailType==='vendor'?openVendorDrawer(rec):openContractorDrawer(rec); }}>Edit</Button>{detailType==='vendor'&&<Popconfirm title="Delete this vendor?" onConfirm={()=>deleteVendorMut.mutate(rec?.id)} okText="Delete" okButtonProps={{ danger:true }}><Button danger icon={<DeleteOutlined/>} size="small">Delete</Button></Popconfirm>}</Space>}
        destroyOnHidden
      >
        {rec && detailType==='vendor' && (
          <>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
              <VendorTypePill value={rec.vendor_type}/>
              <VendorStatusPill value={rec.status}/>
              {rec.compliance_status && <CompliancePill value={rec.compliance_status}/>}
            </div>
            <Divider orientation="left" style={{ fontSize:12 }}>Basic</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Code"><span style={{ fontFamily:'monospace',fontWeight:700 }}>{rec.vendor_code}</span></Descriptions.Item>
              <Descriptions.Item label="Website">{rec.website||'—'}</Descriptions.Item>
              <Descriptions.Item label="Name" span={2}><strong>{rec.vendor_name}</strong></Descriptions.Item>
              {rec.description && <Descriptions.Item label="Services" span={2}>{rec.description}</Descriptions.Item>}
            </Descriptions>
            <Divider orientation="left" style={{ fontSize:12,marginTop:12 }}>Contact</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Person">{rec.contact_person||'—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{rec.email||'—'}</Descriptions.Item>
              <Descriptions.Item label="Phone">{rec.phone||'—'}</Descriptions.Item>
              <Descriptions.Item label="Mobile">{rec.mobile||'—'}</Descriptions.Item>
              <Descriptions.Item label="Address" span={2}>{[rec.address_line1,rec.city,rec.state,rec.country].filter(Boolean).join(', ')||'—'}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left" style={{ fontSize:12,marginTop:12 }}>Contract</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Start">{rec.contract_start?dayjs(rec.contract_start).format('DD MMM YYYY'):'—'}</Descriptions.Item>
              <Descriptions.Item label="End">{rec.contract_end ? <Space>{dayjs(rec.contract_end).format('DD MMM YYYY')}<ContractBadge date={rec.contract_end}/></Space> : '—'}</Descriptions.Item>
              <Descriptions.Item label="Payment">{rec.payment_terms||'—'}</Descriptions.Item>
              <Descriptions.Item label="Currency">{rec.currency||'—'}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left" style={{ fontSize:12,marginTop:12 }}>Registration</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="RC No.">{rec.business_registration||'—'}</Descriptions.Item>
              <Descriptions.Item label="TIN">{rec.tax_id||'—'}</Descriptions.Item>
            </Descriptions>
            {rec.notes && <><Divider style={{ margin:'12px 0 8px' }}/><div style={{ fontSize:12,color:'#374151' }}>{rec.notes}</div></>}
            <div style={{ marginTop:12,fontSize:10,color:'#d1d5db' }}>Registered {rec.created_at?dayjs(rec.created_at).format('DD MMM YYYY HH:mm'):'—'}</div>
          </>
        )}
        {rec && detailType==='contractor' && (
          <>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
              <AvailPill value={rec.availability_status}/>
              <BgPill value={rec.background_check_status}/>
              <MedPill value={rec.medical_clearance_status}/>
            </div>
            <Divider orientation="left" style={{ fontSize:12 }}>Personal</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Code"><span style={{ fontFamily:'monospace',fontWeight:700 }}>{rec.contractor_code||'—'}</span></Descriptions.Item>
              <Descriptions.Item label="Company">{allVendors.find(v=>v.id===rec.vendor_id)?.vendor_name||'—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{rec.email||'—'}</Descriptions.Item>
              <Descriptions.Item label="Phone">{rec.phone||'—'}</Descriptions.Item>
              <Descriptions.Item label="NIN">{rec.national_id||'—'}</Descriptions.Item>
              <Descriptions.Item label="Passport">{rec.passport_number||'—'}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left" style={{ fontSize:12,marginTop:12 }}>Professional</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Job Title">{rec.job_title||'—'}</Descriptions.Item>
              <Descriptions.Item label="Specialization">{rec.specialization||'—'}</Descriptions.Item>
              <Descriptions.Item label="Experience">{rec.experience_years!=null?`${rec.experience_years} yrs`:'—'}</Descriptions.Item>
              <Descriptions.Item label="Daily Rate">{rec.daily_rate!=null?`${rec.currency||'USD'} ${rec.daily_rate}`:'—'}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left" style={{ fontSize:12,marginTop:12 }}>Clearances</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Work Permit">{rec.work_permit_number||'—'}</Descriptions.Item>
              <Descriptions.Item label="WP Expiry">{rec.work_permit_expiry?<Space>{dayjs(rec.work_permit_expiry).format('DD MMM YYYY')}<ContractBadge date={rec.work_permit_expiry}/></Space>:'—'}</Descriptions.Item>
              <Descriptions.Item label="BG Check" span={2}><Space><BgPill value={rec.background_check_status}/>{rec.background_check_date&&<span style={{ fontSize:11,color:'#6b7280' }}>{dayjs(rec.background_check_date).format('DD MMM YYYY')}</span>}</Space></Descriptions.Item>
              <Descriptions.Item label="Medical" span={2}><Space><MedPill value={rec.medical_clearance_status}/>{rec.medical_clearance_date&&<span style={{ fontSize:11,color:'#6b7280' }}>{dayjs(rec.medical_clearance_date).format('DD MMM YYYY')}</span>}</Space></Descriptions.Item>
              <Descriptions.Item label="Security">{rec.security_clearance||'—'}</Descriptions.Item>
            </Descriptions>
            {rec.notes && <><Divider style={{ margin:'12px 0 8px' }}/><div style={{ fontSize:12,color:'#374151' }}>{rec.notes}</div></>}
            <div style={{ marginTop:12,fontSize:10,color:'#d1d5db' }}>Registered {rec.created_at?dayjs(rec.created_at).format('DD MMM YYYY HH:mm'):'—'}</div>
          </>
        )}
      </Drawer>

      <style>{`
        .ant-table-thead > tr > th { background:#f8fafc !important; color:#64748b !important; font-size:11px !important; font-weight:700 !important; text-transform:uppercase !important; letter-spacing:0.05em !important; border-bottom:2px solid #e2e8f0 !important; }
        .ant-table-tbody > tr > td  { border-bottom:1px solid #f1f5f9 !important; padding:10px 12px !important; }
        .ant-table-tbody > tr:last-child > td { border-bottom:none !important; }
        .ant-tabs-nav { margin-bottom:0 !important; }
        .row-danger   > td { background:rgba(220,38,38,0.05) !important; }
        .row-danger   > td:first-child { border-left:3px solid #fca5a5 !important; }
        .row-pending  > td { background:rgba(217,119,6,0.04) !important; }
        .row-pending  > td:first-child { border-left:3px solid #fde68a !important; }
        .row-inactive > td { background:rgba(107,114,128,0.04) !important; opacity:0.75; }
        .row-expired  > td { background:rgba(220,38,38,0.03) !important; }
        .row-available > td { background:rgba(22,163,74,0.02) !important; }
        .row-assigned  > td { background:rgba(37,99,235,0.03) !important; }
        .ant-table-expanded-row > td { padding:0 !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default VendorManagement;
