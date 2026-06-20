import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Row, Col,
  Tag, Popconfirm, DatePicker, Tabs, Tooltip, Alert, Badge,
  App, Divider, Avatar, Typography, Drawer, Timeline, Empty,
  Spin, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  WarningOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, SearchOutlined, FileProtectOutlined,
  AuditOutlined, SafetyCertificateOutlined, FilterOutlined,
  DownloadOutlined, CloseOutlined, TeamOutlined, UserOutlined,
  CalendarOutlined, ApartmentOutlined, MoreOutlined,
  AlertOutlined, PlayCircleOutlined, StopOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Text } = Typography;

// ── Constants ──────────────────────────────────────────────────────────────────
const INCIDENT_TYPES = [
  'safety_violation', 'hse_breach', 'misconduct', 'attendance',
  'substance_abuse', 'theft', 'harassment', 'insubordination',
  'negligence', 'policy_violation', 'other',
];
const SEVERITY_LEVELS  = ['minor', 'moderate', 'major', 'critical'];
const ACTION_TYPES = [
  'verbal_warning', 'written_warning', 'final_warning',
  'suspension', 'demotion', 'termination', 'retraining', 'fine', 'other',
];
const STATUSES        = ['open', 'under_investigation', 'resolved', 'appealed', 'closed'];
const APPEAL_STATUSES = ['pending', 'upheld', 'dismissed'];
const INCIDENT_HSE    = new Set(['safety_violation', 'hse_breach', 'substance_abuse', 'negligence']);

const STATUS_CFG = {
  open:                { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Open'                },
  under_investigation: { color: '#d97706', bg: '#fffbeb', border: '#fed7aa', label: 'Under Investigation' },
  resolved:            { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Resolved'            },
  appealed:            { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', label: 'Appealed'            },
  closed:              { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Closed'              },
};

const SEVERITY_CFG = {
  minor:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', bar: '#22c55e' },
  moderate: { color: '#d97706', bg: '#fffbeb', border: '#fed7aa', bar: '#f59e0b' },
  major:    { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa', bar: '#f97316' },
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', bar: '#ef4444' },
};

const ACTION_CFG = {
  verbal_warning:  { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  written_warning: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  final_warning:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  suspension:      { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa' },
  demotion:        { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' },
  termination:     { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  retraining:      { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  fine:            { color: '#b45309', bg: '#fef9c3', border: '#fde68a' },
  other:           { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

const APPEAL_CFG = {
  pending:   { color: '#d97706', bg: '#fffbeb' },
  upheld:    { color: '#16a34a', bg: '#f0fdf4' },
  dismissed: { color: '#dc2626', bg: '#fef2f2' },
};

const TYPE_CFG = {
  STAFF:      { color: '#1d4ed8', bg: '#dbeafe' },
  CONTRACTOR: { color: '#c2410c', bg: '#ffedd5' },
  VISITOR:    { color: '#0891b2', bg: '#cffafe' },
};

const AVATAR_PALETTE = [
  '#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706',
  '#dc2626', '#0891b2', '#65a30d', '#9333ea', '#0f766e',
];
const avatarColor = name => AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = name => (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const lbl         = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const exportCSV = (columns, rows, filename) => {
  const headers = columns.map(c => `"${c.title}"`).join(',');
  const body = rows.map(r =>
    columns.map(c => {
      const raw = typeof c.exportValue === 'function' ? c.exportValue(r) : (r[c.dataIndex] ?? '');
      return `"${String(raw).replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\n');
  const blob = new Blob([headers + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── Status Pill ────────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: lbl(status) };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

// ── Severity Badge ─────────────────────────────────────────────────────────────
const SeverityBadge = ({ level }) => {
  if (!level) return <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>;
  const cfg = SEVERITY_CFG[level] || { color: '#64748b', bg: '#f3f4f6', border: '#e5e7eb' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 6, padding: '2px 8px',
      fontSize: 11, fontWeight: 700,
    }}>
      {level === 'critical' && <WarningOutlined style={{ fontSize: 10 }} />}
      {lbl(level)}
    </span>
  );
};

// ── Action Badge ───────────────────────────────────────────────────────────────
const ActionBadge = ({ action }) => {
  if (!action) return <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>;
  const cfg = ACTION_CFG[action] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  return (
    <span style={{
      display: 'inline-block', background: cfg.bg,
      border: `1px solid ${cfg.border}`, color: cfg.color,
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>
      {lbl(action)}
    </span>
  );
};

// ── Incident Type Badge ────────────────────────────────────────────────────────
const IncidentBadge = ({ type }) => {
  if (!type) return <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>;
  const isHse = INCIDENT_HSE.has(type);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: isHse ? '#fef2f2' : '#fff7ed',
      border: `1px solid ${isHse ? '#fecaca' : '#fed7aa'}`,
      color: isHse ? '#dc2626' : '#c2410c',
      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
    }}>
      {isHse && <AlertOutlined style={{ fontSize: 10 }} />}
      {lbl(type)}
    </span>
  );
};

// ── Employee Cell ──────────────────────────────────────────────────────────────
const EmployeeCell = ({ name, empCode, type, company, department, openCount }) => {
  const typeCfg = TYPE_CFG[type] || TYPE_CFG.STAFF;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar size={32} style={{ background: avatarColor(name), fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
        {initials(name)}
      </Avatar>
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
          {name || '—'}
          {openCount >= 2 && (
            <span style={{
              fontSize: 9, fontWeight: 800, background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fecaca', borderRadius: 10, padding: '0 5px',
            }}>
              ⚠ {openCount} active
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
          {empCode && (
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#94a3b8', background: '#f3f4f6', borderRadius: 3, padding: '0 4px' }}>
              {empCode}
            </span>
          )}
          {type && type !== 'STAFF' && (
            <span style={{ fontSize: 9, fontWeight: 700, background: typeCfg.bg, color: typeCfg.color, borderRadius: 3, padding: '0 5px' }}>
              {type}
            </span>
          )}
          {department && <span style={{ fontSize: 9, color: '#94a3b8' }}>{department}</span>}
        </div>
      </div>
    </div>
  );
};

// ── Bulk action bar ────────────────────────────────────────────────────────────
const BulkBar = ({ count, onClear, onClose, closePending, onDelete, deletePending }) =>
  count > 0 ? (
    <div style={{
      background: '#dc2626', borderRadius: 10, padding: '10px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
        {count} case{count !== 1 ? 's' : ''} selected
      </span>
      <div style={{ flex: 1 }} />
      {onClose && (
        <Popconfirm title={`Close ${count} case${count !== 1 ? 's' : ''}?`} onConfirm={onClose} okButtonProps={{ danger: true }}>
          <Button size="small" icon={<StopOutlined />} loading={closePending}
            style={{ borderRadius: 6, background: '#b91c1c', border: 'none', color: '#fff' }}>
            Close all
          </Button>
        </Popconfirm>
      )}
      <Popconfirm title={`Delete ${count} case${count !== 1 ? 's' : ''}?`} description="Only open/closed cases can be deleted."
        onConfirm={onDelete} okText="Delete" okButtonProps={{ danger: true }}>
        <Button size="small" danger icon={<DeleteOutlined />} loading={deletePending}
          style={{ borderRadius: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>
          Delete
        </Button>
      </Popconfirm>
      <Button size="small" icon={<CloseOutlined />} onClick={onClear}
        style={{ borderRadius: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }} />
    </div>
  ) : null;

// ── Case Detail Drawer ─────────────────────────────────────────────────────────
const CaseDrawer = ({ record, onClose, onAction, onEdit, actionPending }) => {
  if (!record) return null;
  const cfg = STATUS_CFG[record.status] || {};

  const timelineItems = [
    { color: '#2563eb', children: `Case raised — ${record.created_at?.slice(0, 10) || '—'}` },
    ...(record.status !== 'open' ? [{ color: '#d97706', children: `Under investigation / action — ${record.updated_at?.slice(0, 10) || '—'}` }] : []),
    ...(record.resolution_date ? [{ color: '#16a34a', children: `Resolved — ${record.resolution_date}` }] : []),
    ...(record.appeal_status ? [{ color: '#7c3aed', children: `Appeal: ${lbl(record.appeal_status)}` }] : []),
    ...(record.status === 'closed' ? [{ color: '#64748b', children: 'Case closed' }] : []),
  ];

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={36} style={{ background: avatarColor(record.personnel_name), fontSize: 13, fontWeight: 700 }}>
            {initials(record.personnel_name)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{record.personnel_name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{record.case_number}</span>
            </div>
          </div>
        </div>
      }
      open={!!record} onClose={onClose} width={440}
      bodyStyle={{ padding: 20 }}
    >
      {/* Status + severity */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatusPill status={record.status} />
        <SeverityBadge level={record.severity_level} />
        {record.has_active_training_gap && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
            borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
          }}>
            <WarningOutlined style={{ fontSize: 10 }} /> Cert Gap
          </span>
        )}
      </div>

      {/* Incident details */}
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Incident Type</Text>
            <IncidentBadge type={record.incident_type} />
          </Col>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Action Taken</Text>
            <ActionBadge action={record.action_type} />
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 10 }}>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Incident Date</Text>
            <Text style={{ fontSize: 12, fontWeight: 600 }}>{record.incident_date ? dayjs(record.incident_date).format('DD MMM YYYY') : '—'}</Text>
          </Col>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Department</Text>
            <Text style={{ fontSize: 12 }}>{record.department_name || '—'}</Text>
          </Col>
        </Row>
      </div>

      {/* Description */}
      {record.description && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <Text style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: '#c2410c', display: 'block', marginBottom: 4 }}>Incident Description</Text>
          <Text style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{record.description}</Text>
        </div>
      )}

      {/* Resolution notes */}
      {record.resolution_notes && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <Text style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: '#15803d', display: 'block', marginBottom: 4 }}>Resolution / Decision</Text>
          <Text style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{record.resolution_notes}</Text>
        </div>
      )}

      {/* Appeal */}
      {record.appeal_status && (
        <div style={{
          background: APPEAL_CFG[record.appeal_status]?.bg || '#f8fafc',
          border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 12px', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Appeal Status</Text>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: APPEAL_CFG[record.appeal_status]?.color || '#64748b',
            background: APPEAL_CFG[record.appeal_status]?.bg || '#f8fafc',
            borderRadius: 5, padding: '2px 8px', border: '1px solid #ddd6fe',
          }}>
            {lbl(record.appeal_status)}
          </span>
        </div>
      )}

      {/* Meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {record.reporter_name && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <UserOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>Reported by {record.reporter_name}</Text>
          </div>
        )}
        {record.assignee_name && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <TeamOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>Assigned to {record.assignee_name}</Text>
          </div>
        )}
        {record.resolution_date && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CalendarOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>Resolved {dayjs(record.resolution_date).format('DD MMMM YYYY')}</Text>
          </div>
        )}
      </div>

      {/* Timeline */}
      <Divider style={{ margin: '12px 0 10px' }} />
      <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>Case Timeline</Text>
      <Timeline items={timelineItems} style={{ fontSize: 12 }} />

      {/* Actions */}
      <Divider style={{ margin: '12px 0 10px' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {record.status === 'open' && (
          <Button icon={<SearchOutlined />} loading={actionPending} size="small" onClick={() => onAction(record.id, 'investigate')} style={{ borderRadius: 7 }}>
            Investigate
          </Button>
        )}
        {['open', 'under_investigation'].includes(record.status) && (
          <Button type="primary" icon={<CheckCircleOutlined />} loading={actionPending} size="small"
            style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 7 }}
            onClick={() => onAction(record.id, 'resolve')}>
            Resolve
          </Button>
        )}
        {['resolved', 'under_investigation'].includes(record.status) && (
          <Button icon={<AuditOutlined />} loading={actionPending} size="small" onClick={() => onAction(record.id, 'appeal')} style={{ borderRadius: 7 }}>
            Record Appeal
          </Button>
        )}
        {record.status !== 'closed' && (
          <Button icon={<StopOutlined />} loading={actionPending} size="small" onClick={() => onAction(record.id, 'close')} style={{ borderRadius: 7 }}>
            Close
          </Button>
        )}
        {record.status === 'closed' && (
          <Button icon={<ReloadOutlined />} loading={actionPending} size="small" onClick={() => onAction(record.id, 'reopen')} style={{ borderRadius: 7 }}>
            Reopen
          </Button>
        )}
        <Button icon={<EditOutlined />} size="small" onClick={() => { onClose(); onEdit(record); }} style={{ borderRadius: 7 }}>
          Edit
        </Button>
      </div>
    </Drawer>
  );
};

// ── Analytics Tab ──────────────────────────────────────────────────────────────
const AnalyticsTab = ({ cases, summary }) => {
  const noData = cases.length === 0;

  // ── Chart data derived from client-side cases list ─────────────────────────
  const { statusData, severityData, typeData, actionData, monthData, pTypeData, repeatOffenders, hseCount, deptData } = useMemo(() => {
    const sCounts = {}, sevCounts = {}, tCounts = {}, aCounts = {}, ptCounts = {}, mCounts = {}, dCounts = {};
    cases.forEach(c => {
      sCounts[c.status]                  = (sCounts[c.status] || 0) + 1;
      if (c.severity_level) sevCounts[c.severity_level] = (sevCounts[c.severity_level] || 0) + 1;
      if (c.incident_type)  tCounts[c.incident_type]    = (tCounts[c.incident_type] || 0) + 1;
      if (c.action_type)    aCounts[c.action_type]      = (aCounts[c.action_type] || 0) + 1;
      const pt = c.personnel_type || 'STAFF';
      ptCounts[pt] = (ptCounts[pt] || 0) + 1;
      if (c.incident_date) {
        const mk = c.incident_date.slice(0, 7);
        mCounts[mk] = (mCounts[mk] || 0) + 1;
      }
      const d = c.department_name || 'No Department';
      if (!dCounts[d]) dCounts[d] = { total: 0, critical: 0, hse: 0, active: 0 };
      dCounts[d].total++;
      if (c.severity_level === 'critical') dCounts[d].critical++;
      if (INCIDENT_HSE.has(c.incident_type)) dCounts[d].hse++;
      if (['open', 'under_investigation', 'appealed'].includes(c.status)) dCounts[d].active++;
    });

    // Last 12 months
    const months = [];
    for (let i = 11; i >= 0; i--) {
      let yr = dayjs().subtract(i, 'month').year();
      let mo = dayjs().subtract(i, 'month').month() + 1;
      const mk = `${yr}-${String(mo).padStart(2, '0')}`;
      months.push({ month: dayjs().subtract(i, 'month').format('MMM YY'), count: mCounts[mk] || 0 });
    }

    const statusData   = Object.entries(sCounts).map(([k, v]) => ({ name: STATUS_CFG[k]?.label || lbl(k), value: v, key: k, fill: STATUS_CFG[k]?.color || '#94a3b8' })).filter(d => d.value > 0);
    const severityData = SEVERITY_LEVELS.map(s => ({ name: lbl(s), count: sevCounts[s] || 0, fill: SEVERITY_CFG[s]?.bar || '#94a3b8', key: s }));
    const typeData     = Object.entries(tCounts).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([k, v]) => ({ name: lbl(k), count: v, hse: INCIDENT_HSE.has(k) }));
    const actionData   = Object.entries(aCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: lbl(k), count: v, fill: ACTION_CFG[k]?.color || '#94a3b8', key: k }));
    const pTypeData    = Object.entries(ptCounts).map(([k, v]) => ({ name: k, value: v }));
    const hseCount     = cases.filter(c => INCIDENT_HSE.has(c.incident_type)).length;
    const deptData     = Object.entries(dCounts).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
      .map(([dept, d]) => ({ name: dept.length > 18 ? dept.slice(0, 16) + '…' : dept, ...d }));

    const personActive = {};
    cases.filter(c => ['open', 'under_investigation', 'appealed'].includes(c.status)).forEach(c => {
      if (!personActive[c.personnel_id]) personActive[c.personnel_id] = { name: c.personnel_name || `ID ${c.personnel_id}`, emp_code: c.personnel_emp_code, type: c.personnel_type, count: 0 };
      personActive[c.personnel_id].count++;
    });
    const repeatOffenders = Object.values(personActive).filter(p => p.count >= 2).sort((a, b) => b.count - a.count);

    return { statusData, severityData, typeData, actionData, monthData: months, pTypeData, repeatOffenders, hseCount, deptData };
  }, [cases]);

  if (noData) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <AuditOutlined style={{ fontSize: 40, color: '#cbd5e1' }} />
      <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>No disciplinary cases yet</div>
    </div>
  );

  const PTYPE_COLORS = ['#2563eb', '#c2410c', '#0891b2'];
  const cardStyle = {
    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16,
  };
  const sectionTitle = t => (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t}</div>
  );
  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.06) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Repeat offender alert */}
      {repeatOffenders.length > 0 && (
        <Alert type="error" showIcon style={{ borderRadius: 8 }}
          message={`${repeatOffenders.length} personnel with 2+ active cases — repeat offender risk`}
          description={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {repeatOffenders.map(r => (
                <span key={r.name} style={{
                  fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#dc2626',
                  border: '1px solid #fecaca', borderRadius: 12, padding: '2px 10px',
                }}>
                  {r.name}{r.emp_code ? ` (${r.emp_code})` : ''} — {r.count} active
                </span>
              ))}
            </div>
          }
        />
      )}

      {/* HSE banner */}
      {hseCount > 0 && (
        <Alert type="warning" showIcon style={{ borderRadius: 8 }}
          message={`${hseCount} of ${cases.length} cases are HSE-related — safety violations, breaches, substance abuse, negligence. Regulatory documentation required.`}
        />
      )}

      {/* Row 1: Status donut + Monthly trend */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <div style={cardStyle}>
            {sectionTitle('Case Status')}
            {statusData.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" /> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ResponsiveContainer width="55%" height={160}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={70} labelLine={false} label={CustomPieLabel}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {statusData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                        <Text style={{ fontSize: 10, color: '#374151' }}>{d.name}</Text>
                      </div>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{d.value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Col>
        <Col xs={24} md={16}>
          <div style={cardStyle}>
            {sectionTitle('Monthly Case Trend (Last 12 Months)')}
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={monthData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Cases']} />
                <Line type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2} dot={{ r: 3, fill: '#dc2626' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Col>
      </Row>

      {/* Row 2: Severity + Personnel type */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <div style={cardStyle}>
            {sectionTitle('Cases by Severity')}
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={severityData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Cases']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Col>
        <Col xs={24} md={10}>
          <div style={cardStyle}>
            {sectionTitle('By Personnel Type')}
            {pTypeData.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" style={{ height: 160 }} /> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ResponsiveContainer width="60%" height={140}>
                  <PieChart>
                    <Pie data={pTypeData} dataKey="value" cx="50%" cy="50%" outerRadius={60} labelLine={false} label={CustomPieLabel}>
                      {pTypeData.map((d, i) => <Cell key={i} fill={PTYPE_COLORS[i % PTYPE_COLORS.length]} />)}
                    </Pie>
                    <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pTypeData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: PTYPE_COLORS[i % PTYPE_COLORS.length], flexShrink: 0 }} />
                        <Text style={{ fontSize: 10, color: '#374151' }}>{d.name}</Text>
                      </div>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{d.value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Col>
      </Row>

      {/* Row 3: Incident types + Actions taken */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <div style={cardStyle}>
            {sectionTitle('Top Incident Types')}
            {typeData.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No incidents" /> : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(180, typeData.length * 34)}>
                  <BarChart data={typeData} layout="vertical" margin={{ left: 4, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={110} />
                    <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Cases']} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {typeData.map((d, i) => <Cell key={i} fill={d.hse ? '#ef4444' : '#f97316'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 10, color: '#94a3b8' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />HSE-related</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#f97316', borderRadius: 2, marginRight: 4 }} />Other</span>
                </div>
              </>
            )}
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div style={cardStyle}>
            {sectionTitle('Actions Taken')}
            {actionData.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No actions recorded" /> : (
              <ResponsiveContainer width="100%" height={Math.max(180, actionData.length * 34)}>
                <BarChart data={actionData} layout="vertical" margin={{ left: 4, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={110} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Cases']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {actionData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Col>
      </Row>

      {/* Row 4: Department breakdown */}
      {deptData.length > 0 && (
        <div style={cardStyle}>
          {sectionTitle('Cases by Department')}
          <ResponsiveContainer width="100%" height={Math.max(200, deptData.length * 36)}>
            <BarChart data={deptData} layout="vertical" margin={{ left: 4, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={100} />
              <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="total"    name="Total"    radius={[0, 2, 2, 0]} fill="#3b82f6" />
              <Bar dataKey="active"   name="Active"   radius={[0, 2, 2, 0]} fill="#f97316" />
              <Bar dataKey="critical" name="Critical" radius={[0, 2, 2, 0]} fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Repeat offenders table */}
      {repeatOffenders.length > 0 && (
        <div style={{ ...cardStyle, borderColor: '#fecaca' }}>
          {sectionTitle('⚠ Repeat Offenders — Active Cases')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {repeatOffenders.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fef2f2', borderRadius: 8, padding: '8px 12px',
                border: '1px solid #fecaca',
              }}>
                <Avatar size={28} style={{ background: avatarColor(r.name), fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {initials(r.name)}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                    {r.name}
                    {r.emp_code && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>({r.emp_code})</span>}
                  </div>
                  {r.type && r.type !== 'STAFF' && <span style={{ fontSize: 9, color: '#c2410c', fontWeight: 700 }}>{r.type}</span>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{r.count}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500 }}>active cases</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, borderRadius: 12, padding: '2px 10px',
                  background: r.count >= 3 ? '#dc2626' : '#f97316', color: '#fff',
                }}>
                  {r.count >= 3 ? 'HIGH RISK' : 'ELEVATED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const DisciplinaryManagement = () => {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab,    setActiveTab]    = useState('cases');
  const [search,       setSearch]       = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterType,     setFilterType]     = useState('');
  const [filterAction,   setFilterAction]   = useState('');
  const [filterPType,    setFilterPType]    = useState('');
  const [filterDept,     setFilterDept]     = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [detailRecord, setDetailRecord] = useState(null);
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [editingCase,   setEditingCase]   = useState(null);
  const [caseForm] = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────────
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
  const { data: departmentsRaw } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.get('/api/v1/departments/'),
    staleTime: 120000,
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const cases     = useMemo(() => { const r = casesRaw?.data || casesRaw || []; return Array.isArray(r) ? r : []; }, [casesRaw]);
  const summary   = useMemo(() => summaryRaw?.data || summaryRaw || {}, [summaryRaw]);
  const personnel = useMemo(() => { const r = personnelRaw?.results || personnelRaw?.data || personnelRaw || []; return Array.isArray(r) ? r : []; }, [personnelRaw]);
  const departments = useMemo(() => { const r = departmentsRaw?.results || departmentsRaw || []; return Array.isArray(r) ? r : []; }, [departmentsRaw]);

  const filtered = useMemo(() => cases.filter(c => {
    if (filterStatus   && c.status !== filterStatus)           return false;
    if (filterSeverity && c.severity_level !== filterSeverity) return false;
    if (filterType     && c.incident_type !== filterType)      return false;
    if (filterAction   && c.action_type !== filterAction)      return false;
    if (filterPType    && c.personnel_type !== filterPType)    return false;
    if (filterDept     && c.department_name !== filterDept)    return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.personnel_name || '').toLowerCase().includes(q)
          || (c.case_number    || '').toLowerCase().includes(q)
          || (c.personnel_emp_code || '').toLowerCase().includes(q)
          || (c.description    || '').toLowerCase().includes(q)
          || (c.department_name || '').toLowerCase().includes(q);
    }
    return true;
  }), [cases, filterStatus, filterSeverity, filterType, filterAction, filterPType, filterDept, search]);

  const hasFilters = filterStatus || filterSeverity || filterType || filterAction || filterPType || filterDept || search;
  const deptOptions = useMemo(() => [...new Set(cases.map(c => c.department_name).filter(Boolean))].sort().map(d => ({ value: d, label: d })), [cases]);

  const activeCount = useMemo(() => cases.filter(c => ['open', 'under_investigation', 'appealed'].includes(c.status)).length, [cases]);
  const critCount   = useMemo(() => cases.filter(c => c.severity_level === 'critical').length, [cases]);
  const hseCount    = useMemo(() => cases.filter(c => INCIDENT_HSE.has(c.incident_type)).length, [cases]);
  const openCount   = useMemo(() => cases.filter(c => c.status === 'open').length, [cases]);

  const invAll = useCallback(() => {
    ['disc-cases', 'disc-summary'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
  }, [queryClient]);

  const personnelOptions = useMemo(() => personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name || '')} ${(p.last_name || '')}`.trim()
      + (p.emp_code ? ` (${p.emp_code})` : '')
      + (p.personnel_type && p.personnel_type !== 'STAFF' ? ` [${p.personnel_type}]` : ''),
  })), [personnel]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const caseMut = useMutation({
    mutationFn: d => editingCase
      ? apiService.put(`/api/v1/personnel/disciplinary/cases/${editingCase.id}`, d)
      : apiService.post('/api/v1/personnel/disciplinary/cases', d),
    onSuccess: () => { message.success(editingCase ? 'Case updated' : 'Case raised'); setCaseModalOpen(false); setEditingCase(null); invAll(); },
    onError: e => message.error(e?.response?.data?.detail || 'Failed'),
  });
  const delMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/disciplinary/cases/${id}`),
    onSuccess: () => { message.success('Case deleted'); invAll(); },
    onError: e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action }) => apiService.put(`/api/v1/personnel/disciplinary/cases/${id}/${action}`),
    onSuccess: (data, { action }) => {
      const msgs = { investigate: 'Investigation started', resolve: 'Case resolved', appeal: 'Appeal recorded', close: 'Case closed', reopen: 'Case reopened' };
      message.success(msgs[action] || 'Updated');
      // Update detail drawer if open
      if (detailRecord && detailRecord.id === data?.data?.id || detailRecord?.id) setDetailRecord(null);
      invAll();
    },
    onError: e => message.error(e?.response?.data?.detail || 'Action failed'),
  });

  // Bulk operations
  const bulkDelete = useCallback(async () => {
    const eligible = selectedKeys.filter(id => {
      const c = cases.find(x => x.id === id);
      return c && ['open', 'closed'].includes(c.status);
    });
    if (eligible.length === 0) { message.warning('No deletable cases selected (only open/closed)'); return; }
    await Promise.allSettled(eligible.map(id => apiService.delete(`/api/v1/personnel/disciplinary/cases/${id}`)));
    message.success(`${eligible.length} case(s) deleted`);
    setSelectedKeys([]);
    invAll();
  }, [selectedKeys, cases, invAll]);

  const bulkClose = useCallback(async () => {
    const eligible = selectedKeys.filter(id => {
      const c = cases.find(x => x.id === id);
      return c && c.status !== 'closed';
    });
    await Promise.allSettled(eligible.map(id => apiService.put(`/api/v1/personnel/disciplinary/cases/${id}/close`)));
    message.success(`${eligible.length} case(s) closed`);
    setSelectedKeys([]);
    invAll();
  }, [selectedKeys, cases, invAll]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingCase(null); setCaseModalOpen(true);
    setTimeout(() => { caseForm.resetFields(); caseForm.setFieldsValue({ status: 'open', incident_date: dayjs() }); }, 0);
  };
  const openEdit = r => {
    setEditingCase(r); setCaseModalOpen(true);
    setTimeout(() => caseForm.setFieldsValue({
      ...r,
      incident_date:   r.incident_date   ? dayjs(r.incident_date)   : null,
      resolution_date: r.resolution_date ? dayjs(r.resolution_date) : null,
    }), 0);
  };
  const submitCase = () => caseForm.validateFields().then(v => caseMut.mutate({
    ...v,
    incident_date:   v.incident_date?.format('YYYY-MM-DD'),
    resolution_date: v.resolution_date?.format('YYYY-MM-DD'),
  })).catch(() => {});

  const clearFilters = () => {
    setFilterStatus(''); setFilterSeverity(''); setFilterType('');
    setFilterAction(''); setFilterPType(''); setFilterDept(''); setSearch('');
  };

  // ── Export cols ───────────────────────────────────────────────────────────────
  const exportCols = [
    { title: 'Case #',       exportValue: r => r.case_number || '' },
    { title: 'Personnel',    exportValue: r => r.personnel_name || '' },
    { title: 'Emp Code',     exportValue: r => r.personnel_emp_code || '' },
    { title: 'Type',         exportValue: r => r.personnel_type || '' },
    { title: 'Department',   exportValue: r => r.department_name || '' },
    { title: 'Incident Date', exportValue: r => r.incident_date || '' },
    { title: 'Incident Type', exportValue: r => r.incident_type || '' },
    { title: 'Severity',     exportValue: r => r.severity_level || '' },
    { title: 'Action',       exportValue: r => r.action_type || '' },
    { title: 'Status',       exportValue: r => r.status || '' },
    { title: 'Reporter',     exportValue: r => r.reporter_name || '' },
    { title: 'Assignee',     exportValue: r => r.assignee_name || '' },
    { title: 'Resolution Date', exportValue: r => r.resolution_date || '' },
    { title: 'Appeal Status', exportValue: r => r.appeal_status || '' },
    { title: 'Description',  exportValue: r => r.description || '' },
    { title: 'Resolution Notes', exportValue: r => r.resolution_notes || '' },
  ];

  // ── Row selection ─────────────────────────────────────────────────────────────
  const rowSelection = {
    selectedRowKeys: selectedKeys,
    onChange: setSelectedKeys,
  };

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Case #', dataIndex: 'case_number', width: 155,
      sorter: (a, b) => (a.case_number || '').localeCompare(b.case_number || ''),
      render: (n, r) => (
        <div style={{ cursor: 'pointer' }} onClick={() => setDetailRecord(r)}>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: '#2563eb' }}>{n}</div>
          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{r.incident_date ? dayjs(r.incident_date).format('DD MMM YYYY') : '—'}</div>
          {r.has_active_training_gap && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', display: 'block', marginTop: 2 }}>
              <WarningOutlined style={{ fontSize: 8 }} /> Cert gap
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Personnel', key: 'person', width: 220,
      sorter: (a, b) => (a.personnel_name || '').localeCompare(b.personnel_name || ''),
      render: (_, r) => (
        <div onClick={() => setDetailRecord(r)} style={{ cursor: 'pointer' }}>
          <EmployeeCell
            name={r.personnel_name || `ID ${r.personnel_id}`}
            empCode={r.personnel_emp_code}
            type={r.personnel_type}
            company={r.personnel_company}
            department={r.department_name}
            openCount={r.open_cases_count}
          />
        </div>
      ),
    },
    {
      title: 'Incident', key: 'incident', width: 160,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <IncidentBadge type={r.incident_type} />
          <SeverityBadge level={r.severity_level} />
        </div>
      ),
    },
    {
      title: 'Action', key: 'action', width: 140,
      render: (_, r) => <ActionBadge action={r.action_type} />,
    },
    {
      title: 'Status', key: 'status', width: 160,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <StatusPill status={r.status} />
          {r.appeal_status && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: APPEAL_CFG[r.appeal_status]?.color || '#64748b',
              background: APPEAL_CFG[r.appeal_status]?.bg || '#f8fafc',
              borderRadius: 5, padding: '1px 7px',
              border: '1px solid #ddd6fe', display: 'inline-block',
            }}>
              Appeal: {lbl(r.appeal_status)}
            </span>
          )}
        </div>
      ),
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 200,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.status === 'open' && (
            <Tooltip title="Start Investigation">
              <Button size="small" icon={<SearchOutlined />} onClick={() => actionMut.mutate({ id: r.id, action: 'investigate' })} style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          {['open', 'under_investigation'].includes(r.status) && (
            <Tooltip title="Resolve">
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 6 }}
                onClick={() => actionMut.mutate({ id: r.id, action: 'resolve' })} />
            </Tooltip>
          )}
          {['resolved', 'under_investigation'].includes(r.status) && (
            <Tooltip title="Record Appeal">
              <Button size="small" icon={<AuditOutlined />} onClick={() => actionMut.mutate({ id: r.id, action: 'appeal' })} style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          {r.status !== 'closed' && (
            <Tooltip title="Close Case">
              <Button size="small" icon={<StopOutlined />}
                onClick={() => modal.confirm({ title: 'Close this case?', onOk: () => actionMut.mutate({ id: r.id, action: 'close' }) })}
                style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          {r.status === 'closed' && (
            <Tooltip title="Reopen">
              <Button size="small" icon={<ReloadOutlined />} onClick={() => actionMut.mutate({ id: r.id, action: 'reopen' })} style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          <Tooltip title="Detail">
            <Button size="small" icon={<MoreOutlined />} onClick={() => setDetailRecord(r)} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Popconfirm title="Delete case?" onConfirm={() => delMut.mutate(r.id)} okButtonProps={{ danger: true }}
            disabled={!['open', 'closed'].includes(r.status)}>
            <Tooltip title={!['open', 'closed'].includes(r.status) ? 'Cannot delete active case' : 'Delete'}>
              <Button danger size="small" icon={<DeleteOutlined />} disabled={!['open', 'closed'].includes(r.status)} style={{ borderRadius: 6 }} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Expandable rows — description + resolution
  const expandedRowRender = r => (
    <div style={{ padding: '8px 16px 8px 48px', background: '#fafafa' }}>
      <Row gutter={24}>
        {r.description && (
          <Col xs={24} md={r.resolution_notes ? 12 : 24}>
            <Text style={{ fontSize: 10, color: '#c2410c', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Incident Description</Text>
            <Text style={{ fontSize: 11, color: '#374151', lineHeight: 1.6 }}>{r.description}</Text>
          </Col>
        )}
        {r.resolution_notes && (
          <Col xs={24} md={r.description ? 12 : 24}>
            <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Resolution / Decision</Text>
            <Text style={{ fontSize: 11, color: '#374151', lineHeight: 1.6 }}>{r.resolution_notes}</Text>
          </Col>
        )}
        {!r.description && !r.resolution_notes && (
          <Col><Text type="secondary" style={{ fontSize: 11 }}>No narrative recorded</Text></Col>
        )}
      </Row>
    </div>
  );
  const rowExpandable = r => !!(r.description || r.resolution_notes);

  const containerStyle = {
    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Disciplinary Management</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                Case tracking, incident management, HSE violations and disciplinary actions
              </div>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}
              size="small" style={{ fontWeight: 600, background: '#dc2626', borderColor: '#dc2626' }}>
              Raise Case
            </Button>
          </div>
        }
        styles={{ header: { overflow: 'visible' } }}
      >

      {/* Stat cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Cases',   value: summary.total   ?? cases.length,    color: '#2563eb', bg: '#eff6ff',  icon: <FileProtectOutlined /> },
          { label: 'Active',        value: activeCount,                          color: '#d97706', bg: '#fffbeb',  icon: <ExclamationCircleOutlined /> },
          { label: 'Critical',      value: critCount,                            color: '#dc2626', bg: '#fef2f2',  icon: <WarningOutlined />          },
          { label: 'HSE Violations', value: hseCount,                            color: '#b91c1c', bg: '#fef2f2',  icon: <SafetyCertificateOutlined /> },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <div style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              border: `1px solid ${critCount > 0 && s.label === 'Critical' ? '#fecaca' : '#e2e8f0'}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 18 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Alerts */}
      {critCount > 0 && (
        <Alert type="error" showIcon closable style={{ marginBottom: 10, borderRadius: 8 }}
          message={`${critCount} critical severity case${critCount > 1 ? 's' : ''} require immediate action`} />
      )}
      {openCount > 0 && (
        <Alert type="warning" showIcon closable style={{ marginBottom: 10, borderRadius: 8 }}
          message={`${openCount} case${openCount > 1 ? 's' : ''} open and awaiting investigation`} />
      )}

      {/* Tabs */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding: '0 16px' }}
          items={[

            // ── CASES TAB ──────────────────────────────────────────────────────
            {
              key: 'cases',
              label: (
                <span>
                  <FileProtectOutlined /> Cases
                  {activeCount > 0 && <Badge count={activeCount} size="small" style={{ marginLeft: 6 }} />}
                </span>
              ),
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  {/* Filter bar */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                    <Input
                      placeholder="Search name, case #, description…"
                      prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
                      value={search} onChange={e => setSearch(e.target.value)} allowClear
                      style={{ flex: '1 1 200px', maxWidth: 240, borderRadius: 8 }}
                    />
                    <FilterOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                    <Select placeholder="Status" allowClear style={{ flex: '1 1 140px', minWidth: 140 }}
                      value={filterStatus || undefined} onChange={v => setFilterStatus(v || '')}
                      options={STATUSES.map(s => ({ value: s, label: <StatusPill status={s} /> }))} />
                    <Select placeholder="Severity" allowClear style={{ flex: '1 1 120px', minWidth: 120 }}
                      value={filterSeverity || undefined} onChange={v => setFilterSeverity(v || '')}
                      options={SEVERITY_LEVELS.map(s => ({ value: s, label: <SeverityBadge level={s} /> }))} />
                    <Select placeholder="Incident Type" allowClear style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={filterType || undefined} onChange={v => setFilterType(v || '')}
                      options={INCIDENT_TYPES.map(t => ({ value: t, label: <IncidentBadge type={t} /> }))} />
                    <Select placeholder="Action" allowClear style={{ flex: '1 1 140px', minWidth: 140 }}
                      value={filterAction || undefined} onChange={v => setFilterAction(v || '')}
                      options={ACTION_TYPES.map(a => ({ value: a, label: <ActionBadge action={a} /> }))} />
                    <Select placeholder="Pers. Type" allowClear style={{ flex: '1 1 110px', minWidth: 110 }}
                      value={filterPType || undefined} onChange={v => setFilterPType(v || '')}
                      options={['STAFF', 'CONTRACTOR', 'VISITOR'].map(t => ({ value: t, label: t }))} />
                    <Select placeholder="Department" allowClear showSearch optionFilterProp="label"
                      style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={filterDept || undefined} onChange={v => setFilterDept(v || '')}
                      options={deptOptions} />
                    {hasFilters && <Button size="small" style={{ borderRadius: 6 }} onClick={clearFilters}>Clear</Button>}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Tooltip title="Export CSV">
                        <Button icon={<DownloadOutlined />}
                          onClick={() => exportCSV(exportCols, filtered, `disciplinary-cases-${dayjs().format('YYYY-MM-DD')}.csv`)}
                          style={{ borderRadius: 8 }} />
                      </Tooltip>
                      <Button icon={<ReloadOutlined />} onClick={() => { refetch(); refetchSummary(); }} style={{ borderRadius: 8 }} />
                    </div>
                  </div>

                  {/* Active filter pills */}
                  {hasFilters && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {filterStatus   && <Tag closable onClose={() => setFilterStatus('')}   color="blue">{STATUS_CFG[filterStatus]?.label}</Tag>}
                      {filterSeverity && <Tag closable onClose={() => setFilterSeverity('')} color="volcano">{lbl(filterSeverity)}</Tag>}
                      {filterType     && <Tag closable onClose={() => setFilterType('')}     color="orange">{lbl(filterType)}</Tag>}
                      {filterAction   && <Tag closable onClose={() => setFilterAction('')}   color="purple">{lbl(filterAction)}</Tag>}
                      {filterPType    && <Tag closable onClose={() => setFilterPType('')}>{filterPType}</Tag>}
                      {filterDept     && <Tag closable onClose={() => setFilterDept('')}     icon={<TeamOutlined />}>{filterDept}</Tag>}
                      {search         && <Tag closable onClose={() => setSearch('')}          icon={<SearchOutlined />}>"{search}"</Tag>}
                    </div>
                  )}

                  {/* Bulk bar */}
                  <BulkBar
                    count={selectedKeys.length}
                    onClear={() => setSelectedKeys([])}
                    onClose={bulkClose}
                    onDelete={bulkDelete}
                  />

                  <div style={containerStyle}>
                    <Table
                      columns={columns}
                      dataSource={filtered}
                      loading={isLoading}
                      rowKey="id"
                      size="middle"
                      scroll={{ x: 1200 }}
                      rowSelection={rowSelection}
                      pagination={{
                        pageSize: 20, showSizeChanger: true, showQuickJumper: true,
                        showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`,
                        style: { padding: '12px 16px', margin: 0 },
                      }}
                      expandable={{ expandedRowRender, rowExpandable }}
                      rowClassName={r =>
                        r.severity_level === 'critical' ? 'row-critical' :
                        r.severity_level === 'major'    ? 'row-major' : ''
                      }
                      onRow={r => ({
                        onMouseEnter: e => { e.currentTarget.style.background = '#f8fafc'; },
                        onMouseLeave: e => { e.currentTarget.style.background = ''; },
                      })}
                    />
                  </div>
                </div>
              ),
            },

            // ── ANALYTICS TAB ──────────────────────────────────────────────────
            {
              key: 'analytics',
              label: <span><AuditOutlined /> Analytics</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <AnalyticsTab cases={cases} summary={summary} />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ── Case Form Modal ──────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileProtectOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingCase ? `Edit Case — ${editingCase.case_number}` : 'Raise Disciplinary Case'}
          </Space>
        }
        open={caseModalOpen}
        onOk={submitCase}
        onCancel={() => { setCaseModalOpen(false); setEditingCase(null); }}
        confirmLoading={caseMut.isPending}
        width={740} forceRender
      >
        <Form form={caseForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="personnel_id" label="Personnel" rules={[{ required: true, message: 'Select person' }]}>
                <Select showSearch placeholder="Select person" options={personnelOptions} disabled={!!editingCase}
                  filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="case_number" label="Case # (auto if blank)">
                <Input placeholder="e.g. DISC-2026-0001" maxLength={50} disabled={!!editingCase} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="incident_date" label="Incident Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="incident_type" label="Incident Type" rules={[{ required: true }]}>
                <Select placeholder="Select type" options={INCIDENT_TYPES.map(t => ({ value: t, label: <IncidentBadge type={t} /> }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="severity_level" label="Severity" rules={[{ required: true }]}>
                <Select placeholder="Select severity" options={SEVERITY_LEVELS.map(s => ({ value: s, label: <SeverityBadge level={s} /> }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="action_type" label="Action Taken">
                <Select placeholder="Select action" allowClear options={ACTION_TYPES.map(a => ({ value: a, label: <ActionBadge action={a} /> }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select options={STATUSES.map(s => ({ value: s, label: <StatusPill status={s} /> }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="appeal_status" label="Appeal Status">
                <Select placeholder="N/A" allowClear options={APPEAL_STATUSES.map(s => ({ value: s, label: lbl(s) }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Incident Description" rules={[{ required: true, message: 'Describe the incident' }]}>
            <Input.TextArea rows={3} placeholder="Describe what happened, where, and who was involved…" maxLength={2000} showCount />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="resolution_date" label="Resolution Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="resolution_notes" label="Resolution / Decision Notes">
            <Input.TextArea rows={2} placeholder="Document the outcome, decision rationale, corrective actions…" maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Case Detail Drawer ───────────────────────────────────────────────── */}
      <CaseDrawer
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        onAction={(id, action) => actionMut.mutate({ id, action })}
        onEdit={r => { setDetailRecord(null); openEdit(r); }}
        actionPending={actionMut.isPending}
      />

      <style>{`
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
        .ant-tabs-nav { margin-bottom: 0 !important; }
        .ant-table-expanded-row > td { padding: 0 !important; }
        .row-critical { background: rgba(220,38,38,0.04) !important; }
        .row-critical:hover > td { background: rgba(220,38,38,0.08) !important; }
        .row-major { background: rgba(249,115,22,0.03) !important; }
        .row-major:hover > td { background: rgba(249,115,22,0.07) !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default DisciplinaryManagement;
