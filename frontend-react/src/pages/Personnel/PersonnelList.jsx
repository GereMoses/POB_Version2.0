import React, { useState, useRef, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Row, Col,
  Tag, App, Popconfirm, Avatar, Switch, Drawer, Descriptions, Divider,
  Tooltip, DatePicker, Form, Tabs, Badge, Modal, Steps, Upload, Progress,
  Alert, Spin, Empty,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  UserOutlined, ReloadOutlined, EyeOutlined, TeamOutlined,
  SafetyOutlined, ToolOutlined, IdcardOutlined, MailOutlined,
  PhoneOutlined, EnvironmentOutlined, MedicineBoxOutlined,
  SolutionOutlined, ApartmentOutlined, GlobalOutlined,
  ScanOutlined, CalendarOutlined, BankOutlined, AlertOutlined,
  CheckCircleOutlined, FilterOutlined, CreditCardOutlined,
  CloseOutlined, ExportOutlined, ImportOutlined, AppstoreOutlined,
  UnorderedListOutlined, DownloadOutlined, InboxOutlined,
  ClockCircleOutlined, ThunderboltOutlined, CameraOutlined,
  FileTextOutlined, CheckOutlined, WarningOutlined, StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import PersonnelMTDPanel from './components/PersonnelMTDPanel';
import PersonnelBiometricPanel from './components/PersonnelBiometricPanel';

dayjs.extend(relativeTime);

const { Option } = Select;
const { Dragger } = Upload;

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'OFFSHORE', 'ONSHORE', 'TRANSIT'];

const STATUS_PILL = {
  ACTIVE:   { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#22c55e' },
  INACTIVE: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', dot: '#ef4444' },
  ON_LEAVE: { bg: '#fffbeb', border: '#fed7aa', text: '#b45309', dot: '#f59e0b' },
  OFFSHORE: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', dot: '#3b82f6' },
  ONSHORE:  { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e', dot: '#14b8a6' },
  TRANSIT:  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce', dot: '#a855f7' },
};
const TYPE_COLOR     = { STAFF: 'blue', CONTRACTOR: 'orange', VISITOR: 'purple' };
const EMP_TYPE_COLOR = { EMPLOYEE: 'default', CONTRACTOR: 'orange', SUBCONTRACTOR: 'gold' };
const BLOOD_GROUPS   = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const PUNCH_META = {
  0: { label: 'Check In',  color: '#52c41a', bg: '#f6ffed' },
  1: { label: 'Check Out', color: '#1677ff', bg: '#e6f4ff' },
  2: { label: 'Break Out', color: '#fa8c16', bg: '#fff7e6' },
  3: { label: 'Break In',  color: '#722ed1', bg: '#f9f0ff' },
};

const AVATAR_PALETTE = [
  '#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d',
];
const avatarColor = (str) => AVATAR_PALETTE[(str || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = (name) =>
  (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// ── StatusPill ─────────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const s = (status || '').toUpperCase();
  const c = STATUS_PILL[s] || { bg: '#f4f4f5', border: '#e4e4e7', text: '#52525b', dot: '#a1a1aa' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {s.replace('_', ' ')}
    </span>
  );
};

// ── BiometricChips ─────────────────────────────────────────────────────────────
const BiometricChips = ({ rec }) => {
  const hasFp   = rec.biometric_enrolled || rec.fingerprint_enrolled;
  const hasFace = rec.face_enrolled;
  const hasCard = !!(rec.badge_id && rec.badge_id !== rec.emp_code);
  const chip = (enrolled, label, icon, colors) => (
    <Tooltip title={enrolled ? `${label} enrolled` : `No ${label}`}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600,
        background: enrolled ? colors.bg : '#f9fafb',
        border:     `1px solid ${enrolled ? colors.border : '#e5e7eb'}`,
        color:      enrolled ? colors.text : '#9ca3af',
      }}>
        {icon}{label}
      </span>
    </Tooltip>
  );
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {chip(hasFp,   'FP',   <ScanOutlined style={{ fontSize: 9 }} />,         { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' })}
      {chip(hasFace, 'Face', <UserOutlined style={{ fontSize: 9 }} />,         { bg: '#fffbeb', border: '#fed7aa', text: '#b45309' })}
      {chip(hasCard, 'Card', <CreditCardOutlined style={{ fontSize: 9 }} />,   { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' })}
    </div>
  );
};

// ── EmployeeCard (grid view) ────────────────────────────────────────────────────
const EmployeeCard = ({ rec, onView, onEdit, onDelete, onDeactivate, isNonCompliant, ncItems }) => {
  const name = rec.full_name || `${rec.first_name || ''} ${rec.last_name || ''}`.trim();
  return (
    <div
      style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        overflow: 'hidden', transition: 'box-shadow 0.18s, transform 0.18s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = ''; }}
    >
      {/* colour accent bar */}
      <div style={{ height: 4, background: rec.safety_critical ? '#ef4444' : '#667eea' }} />

      <div style={{ padding: '14px 14px 10px' }}>
        {/* header row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar
              src={rec.photo_url || undefined}
              size={52}
              style={{ background: avatarColor(name), fontSize: 16, fontWeight: 700 }}
            >
              {initials(name)}
            </Avatar>
            {rec.is_onboard && (
              <span style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 12, height: 12, borderRadius: '50%',
                background: '#22c55e', border: '2px solid #fff',
              }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => onView(rec)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontWeight: 700, fontSize: 13, color: '#0f172a', textAlign: 'left',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: '100%', display: 'block',
              }}
            >
              {name || '—'}
            </button>
            <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', marginTop: 1 }}>
              {rec.emp_code}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[rec.company, rec.role || rec.position].filter(Boolean).join(' · ') || <span style={{ color: '#d1d5db' }}>No org info</span>}
            </div>
          </div>
        </div>

        {/* status row */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <StatusPill status={rec.status} />
          {rec.is_onboard && (
            <span style={{
              background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0',
              borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700,
            }}>ON</span>
          )}
          {rec.safety_critical && (
            <Tooltip title="Safety Critical">
              <span style={{
                background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca',
                borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700,
              }}>⚠ SAFETY</span>
            </Tooltip>
          )}
          {rec.personnel_type && rec.personnel_type !== 'STAFF' && (
            <Tag color={TYPE_COLOR[rec.personnel_type] || 'default'} style={{ fontSize: 10, margin: 0, borderRadius: 10, padding: '0 6px' }}>
              {rec.personnel_type}
            </Tag>
          )}
        </div>

        {/* biometrics */}
        <div style={{ marginBottom: 8 }}>
          <BiometricChips rec={rec} />
        </div>

        {/* compliance + last seen */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#94a3b8' }}>
          {isNonCompliant ? (
            <span style={{ color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
              <AlertOutlined style={{ fontSize: 10 }} />{ncItems?.length || 0} MTD issue{(ncItems?.length || 0) !== 1 ? 's' : ''}
            </span>
          ) : (
            <span style={{ color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
              <CheckCircleOutlined style={{ fontSize: 10 }} />MTD OK
            </span>
          )}
          {rec.last_seen && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <ClockCircleOutlined style={{ fontSize: 9 }} />
              {dayjs(rec.last_seen).fromNow()}
            </span>
          )}
        </div>
      </div>

      {/* action footer */}
      <div style={{
        display: 'flex', borderTop: '1px solid #f1f5f9',
        marginTop: 'auto',
      }}>
        {[
          { icon: <EyeOutlined />,  label: 'View', onClick: () => onView(rec), style: {} },
          { icon: <EditOutlined />, label: 'Edit', onClick: () => onEdit(rec), style: { color: '#2563eb' } },
        ].map(btn => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.onClick}
            style={{
              flex: 1, background: 'none', border: 'none',
              padding: '8px 0', fontSize: 11, color: '#64748b',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 4, transition: 'background 0.15s',
              ...btn.style,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; }}
          >
            {btn.icon}{btn.label}
          </button>
        ))}
        <Popconfirm
          title="Set employee to inactive?"
          onConfirm={() => onDeactivate(rec.id)}
          okText="Deactivate" cancelText="Cancel"
        >
          <button
            type="button"
            style={{
              flex: 1, background: 'none', border: 'none',
              padding: '8px 0', fontSize: 11, color: '#d97706',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 4, transition: 'background 0.15s',
              borderLeft: '1px solid #f1f5f9',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fffbeb'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; }}
          >
            <StopOutlined />Disable
          </button>
        </Popconfirm>
        <Popconfirm
          title="Permanently delete this employee?"
          description="This cannot be undone. All assignments will also be removed."
          onConfirm={() => onDelete(rec.id)}
          okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
        >
          <button
            type="button"
            style={{
              flex: 1, background: 'none', border: 'none',
              padding: '8px 0', fontSize: 11, color: '#ef4444',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 4, transition: 'background 0.15s',
              borderLeft: '1px solid #f1f5f9',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; }}
          >
            <DeleteOutlined />Delete
          </button>
        </Popconfirm>
      </div>
    </div>
  );
};

// ── CSV parser (client-side preview) ──────────────────────────────────────────
function parseCSVPreview(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line, idx) => {
    const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    return { _row: idx + 2, ...headers.reduce((obj, h, i) => ({ ...obj, [h]: cells[i] ?? '' }), {}) };
  }).filter(r => Object.values(r).some(v => v !== '' && v !== undefined));
  return { headers, rows, totalRows: rows.length };
}

// ── Export CSV helper ──────────────────────────────────────────────────────────
function exportCSV(employees, filename) {
  const FIELDS = [
    'emp_code','full_name','company','department','role','position',
    'employment_type','personnel_type','status','is_onboard',
    'email','phone','nationality','blood_group','hire_date',
    'emergency_contact_name','emergency_contact_phone',
  ];
  const escape = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = employees.map(e => FIELDS.map(f => {
    if (f === 'is_onboard') return e[f] ? 'Yes' : 'No';
    return escape(e[f]);
  }).join(','));
  const csv = [FIELDS.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Activity Tab component ─────────────────────────────────────────────────────
const ActivityTab = ({ empCode }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['emp-activity', empCode],
    queryFn:  () => apiService.get(`/api/device/transactions/live/?limit=20&emp_code=${empCode}`),
    enabled:  !!empCode,
    staleTime: 30_000,
  });
  const tx = data?.data ?? [];
  if (isLoading) return <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>;
  if (tx.length === 0) return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={
      <span style={{ color: '#94a3b8', fontSize: 12 }}>No punch records found for this employee</span>
    } />
  );
  return (
    <div>
      {tx.map((r, i) => {
        const m = PUNCH_META[r.punch_state] ?? { label: 'Punch', color: '#8c8c8c', bg: '#fafafa' };
        const name = r.emp_name || r.emp_code || '?';
        return (
          <div key={r.id ?? i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 6px', borderBottom: '1px solid #f1f5f9',
            borderLeft: `3px solid ${m.color}`, paddingLeft: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: m.bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: m.color, fontSize: 12,
            }}>
              {r.punch_state === 0 ? '↓' : r.punch_state === 1 ? '↑' : '—'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{m.label}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(r.device_alias || r.terminal_sn || '').trim() || 'Unknown reader'}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                {dayjs(r.punch_time).format('HH:mm')}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                {dayjs(r.punch_time).format('DD MMM')} · {dayjs(r.punch_time).fromNow()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── ImportModal ────────────────────────────────────────────────────────────────
const ImportModal = ({ open, onClose, onSuccess }) => {
  const [step, setStep] = useState(0);           // 0=template  1=upload  2=results
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);  // { headers, rows, totalRows }
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => { setStep(0); setFile(null); setPreview(null); setResult(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = (file) => {
    const f = file;
    setFile(f);
    if (f && f.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try { setPreview(parseCSVPreview(e.target.result)); }
        catch { setPreview({ headers: [], rows: [], totalRows: 0, parseError: true }); }
      };
      reader.readAsText(f);
    } else {
      setPreview(null);
    }
    if (f) setStep(1);
    return false; // prevent auto-upload
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const endpoint = isExcel ? '/api/v1/personnel/import/excel' : '/api/v1/personnel/import/csv';
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Import failed');
      setResult(data);
      setStep(2);
      if (data.statistics?.successful_imports > 0) onSuccess?.();
    } catch (err) {
      setResult({ error: err.message });
      setStep(2);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = (fmt) => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const url = `/api/v1/personnel/import/template/${fmt}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `personnel_import_template.${fmt === 'excel' ? 'xlsx' : 'csv'}`;
        a.click();
      });
  };

  const REQUIRED_COLS = ['emp_code', 'full_name'];
  const OPTIONAL_COLS = ['company', 'role', 'email', 'phone', 'department', 'position', 'status', 'employment_type', 'personnel_type', 'blood_group', 'hire_date', 'medical_conditions'];

  const stepItems = [
    { title: 'Template' },
    { title: 'Upload' },
    { title: 'Results' },
  ];

  const stats = result?.statistics;

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ImportOutlined style={{ color: '#fff', fontSize: 13 }} />
          </div>
          Bulk Import Employees
        </div>
      }
      width={720}
      footer={null}
      destroyOnHidden
    >
      <Steps current={step} items={stepItems} size="small" style={{ margin: '16px 0 24px' }} />

      {/* ── Step 0: Template info ── */}
      {step === 0 && (
        <div>
          <Alert
            type="info" showIcon
            message="Before uploading, download a template to ensure correct column names."
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate('csv')} style={{ flex: 1, borderRadius: 8, height: 48 }}>
              Download CSV Template
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate('excel')} type="primary" ghost style={{ flex: 1, borderRadius: 8, height: 48 }}>
              Download Excel Template
            </Button>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 8 }}>Required columns</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {REQUIRED_COLS.map(c => (
                <Tag key={c} color="red" style={{ fontFamily: 'monospace', borderRadius: 6 }}>{c}</Tag>
              ))}
            </div>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 8 }}>Optional columns</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {OPTIONAL_COLS.map(c => (
                <Tag key={c} style={{ fontFamily: 'monospace', borderRadius: 6 }}>{c}</Tag>
              ))}
            </div>
          </div>

          <Dragger
            accept=".csv,.xlsx,.xls"
            beforeUpload={handleFileChange}
            showUploadList={false}
            style={{ borderRadius: 10 }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p style={{ fontWeight: 600, color: '#374151' }}>Drop your CSV or Excel file here</p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>Supports .csv, .xlsx, .xls</p>
          </Dragger>
        </div>
      )}

      {/* ── Step 1: Preview ── */}
      {step === 1 && file && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <FileTextOutlined style={{ color: '#16a34a', fontSize: 16 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>{file.name}</div>
              <div style={{ fontSize: 11, color: '#16a34a' }}>
                {preview ? `${preview.totalRows} row${preview.totalRows !== 1 ? 's' : ''} detected` : 'Excel file ready to import'}
              </div>
            </div>
            <Button size="small" style={{ marginLeft: 'auto' }} onClick={() => { setFile(null); setPreview(null); setStep(0); }}>
              Change file
            </Button>
          </div>

          {preview && !preview.parseError && preview.rows.length > 0 ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                Preview (first {Math.min(preview.rows.length, 8)} rows)
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {preview.headers.map(h => (
                        <th key={h} style={{
                          padding: '6px 10px', textAlign: 'left',
                          fontWeight: 700, color: REQUIRED_COLS.includes(h) ? '#dc2626' : '#64748b',
                          borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                          fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {h}{REQUIRED_COLS.includes(h) ? ' *' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 8).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {preview.headers.map(h => (
                          <td key={h} style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row[h] || <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.totalRows > 8 && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'right' }}>
                  + {preview.totalRows - 8} more rows
                </div>
              )}
            </div>
          ) : preview?.parseError ? (
            <Alert type="warning" message="Could not parse CSV preview — the file will still be imported by the server." />
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Button onClick={() => { setFile(null); setPreview(null); setStep(0); }}>Back</Button>
            <Button
              type="primary" icon={<ImportOutlined />}
              loading={importing}
              onClick={handleImport}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Start Import
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Results ── */}
      {step === 2 && (
        <div>
          {result?.error ? (
            <Alert type="error" showIcon message="Import failed" description={result.error} style={{ borderRadius: 8 }} />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Total rows',  value: stats?.total_rows ?? 0,            color: '#2563eb', bg: '#eff6ff' },
                  { label: 'Imported',    value: stats?.successful_imports ?? 0,    color: '#16a34a', bg: '#f0fdf4' },
                  { label: 'Failed',      value: stats?.failed_imports ?? 0,        color: '#dc2626', bg: '#fef2f2' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {stats?.successful_imports > 0 && (
                <Alert type="success" showIcon message={`${stats.successful_imports} employee${stats.successful_imports !== 1 ? 's' : ''} imported successfully!`} style={{ borderRadius: 8, marginBottom: 12 }} />
              )}

              {stats?.errors?.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 8 }}>
                    Errors ({stats.errors.length})
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #fecaca', borderRadius: 8 }}>
                    {stats.errors.map((e, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 8, padding: '6px 10px',
                        borderBottom: i < stats.errors.length - 1 ? '1px solid #fee2e2' : 'none',
                        background: i % 2 === 0 ? '#fff' : '#fff5f5',
                      }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>Row {e.row}</span>
                        <span style={{ fontSize: 11, color: '#dc2626' }}>{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Button onClick={handleClose}>Close</Button>
            {stats?.failed_imports > 0 && (
              <Button onClick={() => { setStep(0); setFile(null); setPreview(null); setResult(null); }}>
                Import more
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

// ── PersonnelList ──────────────────────────────────────────────────────────────
const PersonnelList = () => {
  const { message } = App.useApp();

  // filters
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState(null);
  const [filterType,    setFilterType]    = useState(null);
  const [filterDept,    setFilterDept]    = useState(null);
  const [filterCompany, setFilterCompany] = useState('');
  const [filterPOB,     setFilterPOB]     = useState(false);

  // view
  const [viewMode,      setViewMode]      = useState('table'); // 'table' | 'grid'
  const [pageSize,      setPageSize]      = useState(25);

  // drawers / modals
  const [regVisible,    setRegVisible]    = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [formFirstName, setFormFirstName] = useState('');

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord,  setDetailRecord]  = useState(null);
  const [activeTab,     setActiveTab]     = useState('overview');

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [importVisible,   setImportVisible]   = useState(false);

  // photo upload
  const [photoFile, setPhotoFile] = useState(null);
  const photoInputRef = useRef(null);

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: personnelData, isLoading, refetch } = useQuery({
    queryKey: ['personnel', search, filterStatus, filterType, filterDept],
    queryFn: () => {
      const p = new URLSearchParams({ page_size: '200' });
      if (search)       p.append('search', search);
      if (filterStatus) p.append('status', filterStatus);
      if (filterType)   p.append('personnel_type', filterType);
      return apiService.get(`/api/v1/personnel/?${p}`);
    },
    refetchInterval: 30000,
  });

  const { data: dashStats } = useQuery({
    queryKey: ['personnel-dashboard'],
    queryFn: () => apiService.get('/api/v1/personnel/dashboard'),
    refetchInterval: 30000,
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.get('/api/v1/departments/'),
  });

  const { data: zonesData } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiService.get('/api/v1/zones/'),
  });

  const { data: ncData } = useQuery({
    queryKey: ['mtd-non-compliant'],
    queryFn: () => apiService.get('/api/mtd/compliance/non-compliant/'),
    staleTime: 60000,
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const ncList   = Array.isArray(ncData?.data?.data) ? ncData.data.data
                 : Array.isArray(ncData?.data)        ? ncData.data : [];
  const ncMap    = new Map(ncList.map(p => [p.emp_id, p.missing_items ?? []]));

  const employees   = personnelData?.results || [];
  const deptList    = Array.isArray(departmentsData) ? departmentsData : (departmentsData?.results || []);
  const zoneList    = Array.isArray(zonesData) ? zonesData : (zonesData?.results || []);

  // unique companies for filter dropdown
  const companyList = [...new Set(employees.map(e => e.company).filter(Boolean))].sort();

  let displayData = filterDept    ? employees.filter(e => e.department_id === filterDept)   : employees;
  if (filterCompany) displayData  = displayData.filter(e => (e.company || '').toLowerCase().includes(filterCompany.toLowerCase()));
  if (filterPOB)     displayData  = displayData.filter(e => e.is_onboard);

  const totalPersonnel  = dashStats?.total_personnel  ?? personnelData?.count ?? 0;
  const offshoreCount   = dashStats?.offshore_count   ?? employees.filter(e => (e.status || '').toUpperCase() === 'OFFSHORE').length;
  const onboardCount    = employees.filter(e => e.is_onboard).length;
  const contractorCount = employees.filter(e => e.personnel_type === 'CONTRACTOR').length;
  const safetyCount     = employees.filter(e => e.safety_critical).length;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const newHireMTDMutation = useMutation({
    mutationFn: ({ emp_id, hire_date }) =>
      apiService.post('/api/mtd/compliance/setup-new-hire/', { emp_id, hire_date }),
    onSuccess: (res) => {
      const count = res?.data?.data?.created?.length ?? 0;
      if (count > 0) message.info(`MTD: ${res.data.data.message}`);
      queryClient.invalidateQueries(['mtd-non-compliant']);
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: ({ id, file }) => apiService.upload(`/api/v1/personnel/${id}/upload-photo`, file),
    onSuccess: () => {
      queryClient.invalidateQueries(['personnel']);
      message.success('Photo uploaded');
    },
    onError: () => message.warning('Employee saved but photo upload failed'),
  });

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingRecord
        ? apiService.put(`/api/v1/personnel/${editingRecord.id}/`, payload)
        : apiService.post('/api/v1/personnel/', payload),
    onSuccess: (res) => {
      const isNew = !editingRecord;
      message.success(isNew ? 'Employee registered successfully' : 'Employee updated successfully');
      const savedId = res?.data?.id ?? res?.id ?? editingRecord?.id;
      setRegVisible(false);
      setEditingRecord(null);
      form.resetFields();
      queryClient.invalidateQueries(['personnel']);
      queryClient.invalidateQueries(['personnel-dashboard']);
      // photo upload
      if (photoFile && savedId) {
        uploadPhotoMutation.mutate({ id: savedId, file: photoFile });
        setPhotoFile(null);
      }
      // MTD setup for new employee
      if (isNew && savedId) {
        const hireDate = form.getFieldValue('hire_date');
        newHireMTDMutation.mutate({ emp_id: savedId, hire_date: hireDate ? hireDate.format('YYYY-MM-DD') : null });
      }
    },
    onError: (err) => message.error(err?.response?.data?.detail || err.message || 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/${id}/`),
    onSuccess: () => {
      message.success('Employee permanently deleted');
      setDetailVisible(false);
      queryClient.invalidateQueries(['personnel']);
      queryClient.invalidateQueries(['personnel-dashboard']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Delete failed'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => apiService.put(`/api/v1/personnel/${id}/`, { status: 'inactive' }),
    onSuccess: () => {
      message.success('Employee set to inactive');
      setDetailVisible(false);
      queryClient.invalidateQueries(['personnel']);
      queryClient.invalidateQueries(['personnel-dashboard']);
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Deactivate failed'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openAdd = () => { setEditingRecord(null); setPhotoFile(null); form.resetFields(); setFormFirstName(''); setRegVisible(true); };

  const openEdit = (rec) => {
    setEditingRecord(rec);
    setPhotoFile(null);
    form.setFieldsValue({
      emp_code:                rec.emp_code,
      first_name:              rec.first_name,
      last_name:               rec.last_name,
      card_no:                 rec.badge_id !== rec.emp_code ? rec.badge_id : undefined,
      hire_date:               rec.hire_date ? dayjs(rec.hire_date) : undefined,
      nationality:             rec.nationality,
      id_number:               rec.id_number,
      passport_number:         rec.passport_number,
      email:                   rec.email,
      phone:                   rec.phone,
      address:                 rec.address,
      company:                 rec.company,
      dept_id:                 rec.department_id,
      role:                    rec.role,
      position:                rec.position,
      employment_type:         rec.employment_type || 'EMPLOYEE',
      personnel_type:          rec.personnel_type  || 'STAFF',
      status:                  (rec.status || 'ACTIVE').toUpperCase(),
      is_onboard:              rec.is_onboard || false,
      safety_critical:         rec.safety_critical || false,
      zone_id:                 rec.current_zone_id,
      blood_group:             rec.blood_group,
      emergency_contact_name:  rec.emergency_contact_name,
      emergency_contact_phone: rec.emergency_contact_phone,
      medical_conditions:      rec.medical_conditions,
    });
    setFormFirstName(rec.first_name || '');
    setRegVisible(true);
  };

  const handleSubmit = () => {
    form.validateFields().catch(() => {}).then((values) => {
      if (!values) return;
      const dept = deptList.find(d => d.id === values.dept_id);
      saveMutation.mutate({
        emp_code:                values.emp_code,
        first_name:              values.first_name,
        last_name:               values.last_name,
        card_no:                 values.card_no || null,
        hire_date:               values.hire_date ? values.hire_date.format('YYYY-MM-DD') : null,
        nationality:             values.nationality || null,
        id_number:               values.id_number   || null,
        passport_number:         values.passport_number || null,
        email:                   values.email    || null,
        phone:                   values.phone    || null,
        address:                 values.address  || null,
        company:                 values.company  || null,
        department_id:           values.dept_id  || null,
        department:              dept ? (dept.name || dept.dept_name) : null,
        role:                    values.role     || null,
        position:                values.position || null,
        employment_type:         values.employment_type || 'EMPLOYEE',
        personnel_type:          values.personnel_type  || 'STAFF',
        status:                  values.status   || 'ACTIVE',
        is_onboard:              values.is_onboard    || false,
        safety_critical:         values.safety_critical || false,
        current_zone_id:         values.zone_id   || null,
        blood_group:             values.blood_group || null,
        emergency_contact_name:  values.emergency_contact_name  || null,
        emergency_contact_phone: values.emergency_contact_phone || null,
        medical_conditions:      values.medical_conditions || null,
      });
    });
  };

  const openDetail = (rec) => { setDetailRecord(rec); setActiveTab('overview'); setDetailVisible(true); };

  const handleExport = () => {
    const data = selectedRowKeys.length > 0
      ? displayData.filter(e => selectedRowKeys.includes(e.id))
      : displayData;
    exportCSV(data, `personnel_export_${dayjs().format('YYYY-MM-DD')}.csv`);
    message.success(`Exported ${data.length} employee${data.length !== 1 ? 's' : ''}`);
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Employee',
      key: 'employee',
      width: 260,
      render: (_, rec) => {
        const name = rec.full_name || `${rec.first_name || ''} ${rec.last_name || ''}`.trim();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar
              src={rec.photo_url || undefined}
              size={38}
              style={{ background: avatarColor(name), fontSize: 13, fontWeight: 700, flexShrink: 0 }}
            >
              {initials(name)}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <button
                type="button"
                style={{
                  background: 'none', border: 'none', padding: 0, margin: 0,
                  color: '#111827', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer', textAlign: 'left',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170,
                }}
                onClick={() => openDetail(rec)}
              >
                {name || '—'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '0 4px' }}>
                  {rec.emp_code}
                </span>
                {rec.email && (
                  <span style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                    {rec.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Organization',
      key: 'org',
      width: 200,
      render: (_, rec) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 185 }}>
            {rec.company || <span style={{ color: '#d1d5db' }}>—</span>}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 185 }}>
            {[rec.department, rec.role || rec.position].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      key: 'type',
      width: 110,
      render: (_, rec) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {rec.personnel_type && (
            <Tag color={TYPE_COLOR[rec.personnel_type] || 'default'} style={{ fontSize: 10, margin: 0, borderRadius: 4 }}>
              {rec.personnel_type}
            </Tag>
          )}
          {rec.employment_type && rec.employment_type !== 'EMPLOYEE' && (
            <Tag color={EMP_TYPE_COLOR[rec.employment_type] || 'default'} style={{ fontSize: 10, margin: 0, borderRadius: 4 }}>
              {rec.employment_type}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 115,
      render: (_, rec) => <StatusPill status={rec.status} />,
    },
    {
      title: 'POB',
      key: 'pob',
      width: 55,
      align: 'center',
      render: (_, rec) => rec.is_onboard ? (
        <span style={{ display: 'inline-block', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>ON</span>
      ) : (
        <span style={{ display: 'inline-block', background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>OFF</span>
      ),
    },
    {
      title: 'Biometrics',
      key: 'biometrics',
      width: 140,
      render: (_, rec) => {
        const quality = rec.biometric_quality_score;
        return (
          <div>
            <BiometricChips rec={rec} />
            {rec.biometric_enrolled && quality != null && (
              <div style={{ marginTop: 4, fontSize: 10, color: quality >= 80 ? '#16a34a' : quality >= 50 ? '#b45309' : '#dc2626' }}>
                Quality: {quality}%
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'MTD',
      key: 'mtd',
      width: 70,
      align: 'center',
      render: (_, rec) => {
        const missing = ncMap.get(rec.id);
        if (missing && missing.length > 0) {
          return (
            <Tooltip title={`Non-Compliant: ${missing.join(', ')}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'default' }}>
                <AlertOutlined style={{ fontSize: 9 }} />{missing.length}
              </span>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="MTD Compliant">
            <span style={{ display: 'inline-flex', alignItems: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 20, padding: '2px 8px', fontSize: 10, cursor: 'default' }}>
              <CheckCircleOutlined />
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Last Seen',
      key: 'last_seen',
      width: 100,
      render: (_, rec) => rec.last_seen ? (
        <Tooltip title={dayjs(rec.last_seen).format('DD MMM YYYY HH:mm')}>
          <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ClockCircleOutlined style={{ fontSize: 10, color: '#94a3b8' }} />
            {dayjs(rec.last_seen).fromNow()}
          </span>
        </Tooltip>
      ) : <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 126,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="View Profile">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(rec)} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" type="primary" icon={<EditOutlined />} onClick={() => openEdit(rec)} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Popconfirm
            title="Set employee to inactive?"
            onConfirm={() => deactivateMutation.mutate(rec.id)}
            okText="Deactivate" cancelText="Cancel"
          >
            <Tooltip title="Deactivate">
              <Button size="small" icon={<StopOutlined />} style={{ borderRadius: 6, color: '#d97706', borderColor: '#fcd34d' }} />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="Permanently delete this employee?"
            description="This cannot be undone."
            onConfirm={() => deleteMutation.mutate(rec.id)}
            okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
          >
            <Tooltip title="Permanently Delete">
              <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  // ── Detail drawer tabs ─────────────────────────────────────────────────────
  const rec = detailRecord;
  const detailTabs = rec ? [
    {
      key: 'overview',
      label: <><SolutionOutlined /> Overview</>,
      children: (
        <>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Emp Code">
              <Tag style={{ fontFamily: 'monospace', fontWeight: 700 }}>{rec.emp_code}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Badge / Card">
              {rec.badge_id && rec.badge_id !== rec.emp_code ? rec.badge_id : <span style={{ color: '#bbb' }}>—</span>}
            </Descriptions.Item>
            <Descriptions.Item label="Full Name" span={2}>
              <strong>{rec.full_name || `${rec.first_name || ''} ${rec.last_name || ''}`.trim()}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Status"><StatusPill status={rec.status} /></Descriptions.Item>
            <Descriptions.Item label="POB">
              <Tag color={rec.is_onboard ? 'green' : 'default'} style={{ fontWeight: 700 }}>
                {rec.is_onboard ? 'ON BOARD' : 'OFF BOARD'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Personnel Type">
              <Tag color={TYPE_COLOR[rec.personnel_type] || 'default'}>{rec.personnel_type || '—'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Employment Type">{rec.employment_type || '—'}</Descriptions.Item>
            <Descriptions.Item label="Hire Date">
              {rec.hire_date ? dayjs(rec.hire_date).format('DD MMM YYYY') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Nationality">{rec.nationality || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider orientation="left" style={{ fontSize: 12, margin: '12px 0' }}>Employment</Divider>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Company" span={2}>{rec.company || '—'}</Descriptions.Item>
            <Descriptions.Item label="Department">{rec.department || '—'}</Descriptions.Item>
            <Descriptions.Item label="Role">{rec.role || '—'}</Descriptions.Item>
            <Descriptions.Item label="Position">{rec.position || '—'}</Descriptions.Item>
            <Descriptions.Item label="Zone">{rec.current_zone_id ? `Zone #${rec.current_zone_id}` : '—'}</Descriptions.Item>
          </Descriptions>

          <Divider orientation="left" style={{ fontSize: 12, margin: '12px 0' }}>Contact</Divider>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={<><MailOutlined /> Email</>}>{rec.email || '—'}</Descriptions.Item>
            <Descriptions.Item label={<><PhoneOutlined /> Phone</>}>{rec.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label={<><EnvironmentOutlined /> Address</>}>{rec.address || '—'}</Descriptions.Item>
          </Descriptions>
        </>
      ),
    },
    {
      key: 'medical',
      label: <><MedicineBoxOutlined /> Medical & Safety</>,
      children: (
        <>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Blood Group">
              {rec.blood_group ? <Tag color="red" style={{ fontWeight: 700 }}>{rec.blood_group}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Safety Critical">
              {rec.safety_critical ? <Tag color="red"><SafetyOutlined /> YES</Tag> : 'No'}
            </Descriptions.Item>
            <Descriptions.Item label="ID Number">{rec.id_number || '—'}</Descriptions.Item>
            <Descriptions.Item label="Passport No.">{rec.passport_number || '—'}</Descriptions.Item>
          </Descriptions>
          {(rec.emergency_contact_name || rec.emergency_contact_phone) && (
            <>
              <Divider orientation="left" style={{ fontSize: 12, margin: '12px 0' }}>Emergency Contact</Divider>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Name">{rec.emergency_contact_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Phone">{rec.emergency_contact_phone || '—'}</Descriptions.Item>
              </Descriptions>
            </>
          )}
          {rec.medical_conditions && (
            <>
              <Divider orientation="left" style={{ fontSize: 12, margin: '12px 0' }}>Medical Conditions</Divider>
              <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
                {rec.medical_conditions}
              </div>
            </>
          )}
        </>
      ),
    },
    {
      key: 'mtd',
      label: (
        <Space size={4}>
          <MedicineBoxOutlined />MTD Compliance
          {ncMap.has(rec.id) && ncMap.get(rec.id).length > 0 && <Badge dot status="error" />}
        </Space>
      ),
      children: <PersonnelMTDPanel empId={rec.id} />,
    },
    {
      key: 'biotime',
      label: (
        <Space size={4}>
          <ScanOutlined />Biometrics
          {rec.biometric_enrolled
            ? <Badge dot status="success" />
            : <Badge dot status="default" />
          }
        </Space>
      ),
      children: activeTab === 'biotime'
        ? <PersonnelBiometricPanel empCode={rec.emp_code} personnelId={rec.id} />
        : null,
    },
    {
      key: 'activity',
      label: <><ThunderboltOutlined /> Activity</>,
      children: activeTab === 'activity' ? <ActivityTab empCode={rec.emp_code} /> : null,
    },
  ] : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  const STATS = [
    { label: 'Total Personnel', value: totalPersonnel,  icon: <TeamOutlined />,        color: '#2563eb', bg: '#eff6ff' },
    { label: 'On Board (POB)',  value: onboardCount,    icon: <SafetyOutlined />,       color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Offshore',        value: offshoreCount,   icon: <EnvironmentOutlined />,  color: '#7c3aed', bg: '#fdf4ff' },
    { label: 'Contractors',     value: contractorCount, icon: <ToolOutlined />,         color: '#d97706', bg: '#fffbeb' },
    { label: 'Safety Critical', value: safetyCount,     icon: <MedicineBoxOutlined />,  color: '#dc2626', bg: '#fef2f2' },
  ];

  const activeFilters = [search, filterStatus, filterType, filterDept, filterCompany, filterPOB].filter(Boolean).length;

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>
              Personnel Directory
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              Manage and track all personnel, contractors, and visitors
            </p>
          </div>
          <Space wrap>
            <Tooltip title="Toggle table / card view">
              <span>
                <Space.Compact style={{ borderRadius: 8, overflow: 'hidden' }}>
                  <Button
                    icon={<UnorderedListOutlined />}
                    type={viewMode === 'table' ? 'primary' : 'default'}
                    onClick={() => setViewMode('table')}
                  />
                  <Button
                    icon={<AppstoreOutlined />}
                    type={viewMode === 'grid' ? 'primary' : 'default'}
                    onClick={() => setViewMode('grid')}
                  />
                </Space.Compact>
              </span>
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading} style={{ borderRadius: 8 }}>
              Refresh
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport} style={{ borderRadius: 8 }}>
              Export CSV
            </Button>
            <Button icon={<ImportOutlined />} onClick={() => setImportVisible(true)} style={{ borderRadius: 8 }}>
              Import
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} style={{ borderRadius: 8, fontWeight: 600 }}>
              Register Employee
            </Button>
          </Space>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {STATS.map((s) => (
          <Col xs={12} sm={8} md={24 / 5} key={s.label}>
            <div style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: s.bg, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: s.color, fontSize: 18,
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        padding: '12px 16px', marginBottom: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <Input
          placeholder="Search name, code, email, company…"
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ flex: '1 1 200px', borderRadius: 8, maxWidth: 280 }}
        />
        <Select
          placeholder="Department"
          style={{ flex: '1 1 140px', minWidth: 140, maxWidth: 190 }}
          value={filterDept} onChange={setFilterDept} allowClear
        >
          {deptList.map(d => <Option key={d.id} value={d.id}>{d.name || d.dept_name}</Option>)}
        </Select>
        <Select
          placeholder="Company"
          style={{ flex: '1 1 140px', minWidth: 140, maxWidth: 190 }}
          value={filterCompany || undefined}
          onChange={v => setFilterCompany(v || '')}
          allowClear
          showSearch
          optionFilterProp="children"
        >
          {companyList.map(c => <Option key={c} value={c}>{c}</Option>)}
        </Select>
        <Select
          placeholder="Status"
          style={{ flex: '1 1 120px', minWidth: 120, maxWidth: 160 }}
          value={filterStatus} onChange={setFilterStatus} allowClear
        >
          {STATUS_OPTIONS.map(s => <Option key={s} value={s}>{s.replace('_', ' ')}</Option>)}
        </Select>
        <Select
          placeholder="Type"
          style={{ flex: '1 1 110px', minWidth: 110, maxWidth: 150 }}
          value={filterType} onChange={setFilterType} allowClear
        >
          <Option value="STAFF">Staff</Option>
          <Option value="CONTRACTOR">Contractor</Option>
          <Option value="VISITOR">Visitor</Option>
        </Select>
        <Tooltip title="Show only personnel currently on board">
          <Button
            type={filterPOB ? 'primary' : 'default'}
            size="small"
            onClick={() => setFilterPOB(!filterPOB)}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 12 }}
          >
            POB Only
          </Button>
        </Tooltip>
        {activeFilters > 0 && (
          <Button
            size="small"
            style={{ borderRadius: 6, fontSize: 12 }}
            onClick={() => { setSearch(''); setFilterDept(null); setFilterStatus(null); setFilterType(null); setFilterCompany(''); setFilterPOB(false); setSelectedRowKeys([]); }}
          >
            Clear {activeFilters > 0 ? `(${activeFilters})` : ''}
          </Button>
        )}
        <div style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
          {displayData.length} employee{displayData.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Bulk action bar ──────────────────────────────────────────────── */}
      {selectedRowKeys.length > 0 && (
        <div style={{
          background: '#1d4ed8', borderRadius: 10, padding: '10px 16px',
          marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 12px rgba(29,78,216,0.3)',
        }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
            {selectedRowKeys.length} selected
          </span>
          <div style={{ flex: 1 }} />
          <Button
            size="small" icon={<ExportOutlined />} onClick={handleExport}
            style={{ borderRadius: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}
          >
            Export selected
          </Button>
          <Popconfirm
            title={`Delete ${selectedRowKeys.length} employee${selectedRowKeys.length !== 1 ? 's' : ''}?`}
            description="This action cannot be undone."
            onConfirm={() => {
              Promise.all(selectedRowKeys.map(id => apiService.delete(`/api/v1/personnel/${id}/`)))
                .then(() => {
                  message.success(`${selectedRowKeys.length} employee(s) deleted`);
                  setSelectedRowKeys([]);
                  queryClient.invalidateQueries(['personnel']);
                  queryClient.invalidateQueries(['personnel-dashboard']);
                })
                .catch(() => message.error('Some deletions failed'));
            }}
            okText="Delete all" okButtonProps={{ danger: true }}
          >
            <Button
              size="small" danger icon={<DeleteOutlined />}
              style={{ borderRadius: 6, background: '#dc2626', border: 'none', color: '#fff' }}
            >
              Delete selected
            </Button>
          </Popconfirm>
          <Button
            size="small" icon={<CloseOutlined />}
            onClick={() => setSelectedRowKeys([])}
            style={{ borderRadius: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
          />
        </div>
      )}

      {/* ── Table view ───────────────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <Table
            columns={columns}
            dataSource={displayData}
            loading={isLoading}
            rowKey="id"
            size="middle"
            scroll={{ x: 1200 }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
            }}
            pagination={{
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ['10', '25', '50', '100'],
              onShowSizeChange: (_, size) => setPageSize(size),
              showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} employees`,
              style: { padding: '12px 16px', margin: 0 },
            }}
            rowClassName={(rec) => rec.safety_critical ? 'row-safety' : ''}
            onRow={(rec) => ({
              style: { cursor: 'default' },
              onMouseEnter: (e) => { e.currentTarget.style.background = '#f8fafc'; },
              onMouseLeave: (e) => { e.currentTarget.style.background = ''; },
            })}
          />
        </div>
      )}

      {/* ── Grid view ────────────────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
          ) : displayData.length === 0 ? (
            <Empty description="No employees found" style={{ padding: 48 }} />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 14,
            }}>
              {displayData.map(e => (
                <EmployeeCard
                  key={e.id}
                  rec={e}
                  onView={openDetail}
                  onEdit={openEdit}
                  onDeactivate={(id) => deactivateMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  isNonCompliant={ncMap.has(e.id) && ncMap.get(e.id).length > 0}
                  ncItems={ncMap.get(e.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={760}
        styles={{ body: { padding: 0 } }}
        extra={
          rec && (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => { setDetailVisible(false); openEdit(rec); }}>Edit</Button>
              <Popconfirm
                title="Set employee to inactive?"
                onConfirm={() => deactivateMutation.mutate(rec?.id)}
                okText="Deactivate" cancelText="Cancel"
              >
                <Button icon={<StopOutlined />} style={{ color: '#d97706', borderColor: '#fcd34d' }}>Deactivate</Button>
              </Popconfirm>
              <Popconfirm
                title="Permanently delete this employee?"
                description="This cannot be undone. All assignments will also be removed."
                onConfirm={() => deleteMutation.mutate(rec?.id)}
                okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />}>Delete</Button>
              </Popconfirm>
            </Space>
          )
        }
        title={null}
        destroyOnHidden
      >
        {rec && (
          <>
            {/* Hero header */}
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              padding: '24px 24px 20px',
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Avatar with camera button */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar
                    src={rec.photo_url || undefined}
                    size={72}
                    style={{ background: avatarColor(rec.full_name || `${rec.first_name} ${rec.last_name}`), fontSize: 22, fontWeight: 700, border: '3px solid rgba(255,255,255,0.2)' }}
                  >
                    {initials(rec.full_name || `${rec.first_name || ''} ${rec.last_name || ''}`)}
                  </Avatar>
                  {rec.is_onboard && (
                    <span style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: '#22c55e', border: '2px solid #1e293b' }} />
                  )}
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>
                    {rec.full_name || `${rec.first_name || ''} ${rec.last_name || ''}`.trim()}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                    <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4 }}>{rec.emp_code}</span>
                    {rec.company ? <span style={{ marginLeft: 8 }}>· {rec.company}</span> : null}
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                    {[rec.role || rec.position, rec.department].filter(Boolean).join(' · ')}
                  </div>

                  {/* tags row */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <StatusPill status={rec.status} />
                    {rec.is_onboard && (
                      <span style={{ background: '#22c55e', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>ON BOARD</span>
                    )}
                    {rec.safety_critical && (
                      <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>⚠ SAFETY CRITICAL</span>
                    )}
                    {rec.personnel_type && rec.personnel_type !== 'STAFF' && (
                      <Tag color={TYPE_COLOR[rec.personnel_type] || 'default'} style={{ margin: 0, borderRadius: 10 }}>{rec.personnel_type}</Tag>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick stats strip */}
              <div style={{ display: 'flex', gap: 16, marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { label: 'Compliance', value: `${rec.compliance_score ?? 0}%`, color: rec.compliance_score >= 90 ? '#22c55e' : rec.compliance_score >= 70 ? '#f59e0b' : '#ef4444' },
                  { label: 'Blood Group', value: rec.blood_group || '—', color: '#f87171' },
                  { label: 'Last Seen', value: rec.last_seen ? dayjs(rec.last_seen).fromNow() : '—', color: '#94a3b8' },
                  { label: 'Hire Date', value: rec.hire_date ? dayjs(rec.hire_date).format('MMM YYYY') : '—', color: '#94a3b8' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ padding: '0 24px 24px' }}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={detailTabs}
                size="small"
                style={{ marginTop: 4 }}
              />
            </div>
          </>
        )}
      </Drawer>

      {/* ── Registration / Edit Drawer ───────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IdcardOutlined style={{ color: '#fff', fontSize: 13 }} />
            </div>
            {editingRecord ? 'Edit Employee' : 'Register New Employee'}
          </Space>
        }
        open={regVisible}
        onClose={() => { setRegVisible(false); setEditingRecord(null); setPhotoFile(null); form.resetFields(); }}
        width={860}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => { setRegVisible(false); setEditingRecord(null); setPhotoFile(null); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit} loading={saveMutation.isPending}>
              {editingRecord ? 'Update Employee' : 'Register Employee'}
            </Button>
          </Space>
        }
        forceRender
      >
        <Form form={form} layout="vertical" size="small" onValuesChange={(changed) => { if ('first_name' in changed) setFormFirstName(changed.first_name || ''); }}>

          {/* ── Photo upload ── */}
          <Divider orientation="left"><Space><CameraOutlined style={{ color: '#9333ea' }} />Profile Photo</Space></Divider>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <Avatar
              src={photoFile ? URL.createObjectURL(photoFile) : (editingRecord?.photo_url || undefined)}
              size={72}
              style={{ background: avatarColor(formFirstName), fontSize: 22, fontWeight: 700, flexShrink: 0, border: '2px dashed #e2e8f0' }}
              icon={<UserOutlined />}
            />
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setPhotoFile(f);
                }}
              />
              <Button icon={<CameraOutlined />} onClick={() => photoInputRef.current?.click()} style={{ borderRadius: 8, marginBottom: 4 }}>
                {photoFile ? 'Change Photo' : 'Upload Photo'}
              </Button>
              {photoFile && (
                <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2 }}>
                  <CheckOutlined /> {photoFile.name}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>JPG, PNG or GIF. Max 5MB.</div>
            </div>
          </div>

          <Divider orientation="left"><Space><ScanOutlined style={{ color: '#2563eb' }} />BioTime Identity</Space></Divider>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="emp_code" label="Employee Code (PIN)" rules={[{ required: true, message: 'Required — must be unique' }]}>
                <Input placeholder="e.g. EMP001" disabled={!!editingRecord} style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="first_name" label="First Name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="John" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="last_name" label="Last Name">
                <Input placeholder="Doe" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="card_no" label="Badge / Card No" tooltip="RFID card number assigned to this employee">
                <Input placeholder="Card number (optional)" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="hire_date" label="Hire Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="Select date" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="nationality" label="Nationality">
                <Input placeholder="e.g. Nigerian" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left"><Space><BankOutlined style={{ color: '#16a34a' }} />Employment</Space></Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="company" label="Company / Employer">
                <Input placeholder="e.g. Marconi.ng EPC Limited" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dept_id" label="Department">
                <Select placeholder="Select department" allowClear showSearch optionFilterProp="children">
                  {deptList.map(d => <Option key={d.id} value={d.id}>{d.name || d.dept_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="role" label="Job Title / Role">
                <Input placeholder="e.g. Offshore Engineer" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="position" label="Position / Grade">
                <Input placeholder="e.g. Senior Engineer" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="employment_type" label="Employment Type" initialValue="EMPLOYEE">
                <Select>
                  <Option value="EMPLOYEE">Employee</Option>
                  <Option value="CONTRACTOR">Contractor</Option>
                  <Option value="SUBCONTRACTOR">Subcontractor</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left"><Space><ApartmentOutlined style={{ color: '#7c3aed' }} />POB Status & Zone</Space></Divider>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="personnel_type" label="Personnel Type" initialValue="STAFF">
                <Select>
                  <Option value="STAFF">Staff</Option>
                  <Option value="CONTRACTOR">Contractor</Option>
                  <Option value="VISITOR">Visitor</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Employment Status" initialValue="ACTIVE">
                <Select>
                  {STATUS_OPTIONS.map(s => <Option key={s} value={s}>{s.replace('_', ' ')}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="zone_id" label="Current Zone / Area">
                <Select placeholder="Select zone" allowClear showSearch optionFilterProp="children">
                  {zoneList.map(z => <Option key={z.id} value={z.id}>{z.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="is_onboard" label="Currently On Board" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="ON" unCheckedChildren="OFF" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="safety_critical" label="Safety Critical" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left"><Space><GlobalOutlined style={{ color: '#d97706' }} />Contact & Identity Documents</Space></Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="email" label="Email Address" rules={[{ type: 'email', message: 'Invalid email' }]}>
                <Input placeholder="john.doe@company.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone / Mobile">
                <Input placeholder="+234 801 234 5678" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="address" label="Home Address">
                <Input placeholder="Street, City, State" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="id_number" label="National ID / NIN">
                <Input placeholder="ID number" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="passport_number" label="Passport Number">
                <Input placeholder="Passport number" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left"><Space><MedicineBoxOutlined style={{ color: '#dc2626' }} />Medical & Emergency</Space></Divider>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="blood_group" label="Blood Group">
                <Select placeholder="Select" allowClear>
                  {BLOOD_GROUPS.map(b => <Option key={b} value={b}>{b}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="emergency_contact_name" label="Emergency Contact Name">
                <Input placeholder="Contact full name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="emergency_contact_phone" label="Emergency Contact Phone">
                <Input placeholder="+234..." />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item name="medical_conditions" label="Medical Conditions / Allergies">
                <Input.TextArea rows={2} placeholder="List any medical conditions, allergies, or special requirements..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>

      {/* ── Import Modal ─────────────────────────────────────────────────── */}
      <ImportModal
        open={importVisible}
        onClose={() => setImportVisible(false)}
        onSuccess={() => {
          queryClient.invalidateQueries(['personnel']);
          queryClient.invalidateQueries(['personnel-dashboard']);
        }}
      />

      <style>{`
        .row-safety td { background: #fff5f5 !important; }
        .row-safety:hover td { background: #fee2e2 !important; }
        .ant-table-thead > tr > th {
          background: #f8fafc !important;
          color: #64748b !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 10px 12px !important;
        }
        .ant-table-tbody > tr:last-child > td { border-bottom: none !important; }
      `}</style>
    </div>
  );
};

export default PersonnelList;
