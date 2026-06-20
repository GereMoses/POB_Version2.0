import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Row, Col,
  Tag, Popconfirm, DatePicker, InputNumber, Tabs, Switch,
  Tooltip, Progress, Alert, Badge, App, Divider, Avatar,
  Typography, Drawer, Empty, Spin, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  BookOutlined, UserOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
  CloseCircleOutlined, PlayCircleOutlined, ExclamationCircleOutlined,
  FileProtectOutlined, WarningOutlined, TeamOutlined, DownloadOutlined,
  ImportOutlined, SearchOutlined, FilterOutlined, ApartmentOutlined,
  CloseOutlined, BarChartOutlined, CalendarOutlined, MoreOutlined,
} from '@ant-design/icons';
import CertificateTemplate from './CertificateTemplate';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Text } = Typography;

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORIES = ['safety','technical','compliance','soft_skills','leadership','induction','refresher','certification'];
const ENROLL_STATUSES = ['enrolled','in_progress','completed','failed','cancelled','certified'];

const CATEGORY_CFG = {
  safety:        { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  technical:     { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  compliance:    { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  soft_skills:   { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  leadership:    { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' },
  induction:     { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  refresher:     { color: '#b45309', bg: '#fef9c3', border: '#fde68a' },
  certification: { color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
};

const STATUS_CFG = {
  enrolled:    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Enrolled'    },
  in_progress: { color: '#d97706', bg: '#fffbeb', border: '#fed7aa', label: 'In Progress' },
  completed:   { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', label: 'Completed'   },
  failed:      { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Failed'      },
  cancelled:   { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Cancelled'   },
  certified:   { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', label: 'Certified'   },
};

const CERT_CFG = {
  valid:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Valid'      },
  expiring: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Expiring'   },
  expired:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Expired'    },
  no_expiry:{ color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'No Expiry'  },
};

const ISSUE_CFG = {
  never_enrolled: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Never Enrolled' },
  expired:        { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Expired'         },
  expiring_soon:  { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Expiring Soon'   },
  failed:         { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa', label: 'Failed/Cancelled' },
};

const TYPE_CFG = {
  STAFF:      { color: '#1d4ed8', bg: '#dbeafe' },
  CONTRACTOR: { color: '#c2410c', bg: '#ffedd5' },
  VISITOR:    { color: '#0891b2', bg: '#cffafe' },
};

const AVATAR_PALETTE = [
  '#2563eb','#7c3aed','#db2777','#059669','#d97706',
  '#dc2626','#0891b2','#65a30d','#9333ea','#0f766e',
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

// ── Pills & badges ─────────────────────────────────────────────────────────────
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

const CategoryPill = ({ category }) => {
  if (!category) return null;
  const cfg = CATEGORY_CFG[category] || { color: '#64748b', bg: '#f3f4f6', border: '#e5e7eb' };
  return (
    <span style={{
      display: 'inline-block', background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 700,
    }}>
      {lbl(category)}
    </span>
  );
};

const CertBadge = ({ certStatus, expiryDate }) => {
  if (!certStatus || certStatus === 'no_expiry') {
    return <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>No Expiry</span>;
  }
  const cfg = CERT_CFG[certStatus] || CERT_CFG.valid;
  const daysLeft = expiryDate ? dayjs(expiryDate).diff(dayjs(), 'day') : null;
  return (
    <div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        color: cfg.color, borderRadius: 6, padding: '2px 8px',
        fontSize: 10, fontWeight: 700,
      }}>
        {cfg.label}
      </span>
      {expiryDate && (
        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
          {daysLeft !== null && daysLeft < 0
            ? `Expired ${Math.abs(daysLeft)}d ago`
            : daysLeft !== null
            ? `Expires in ${daysLeft}d`
            : expiryDate}
          {' '}({dayjs(expiryDate).format('DD MMM YYYY')})
        </div>
      )}
    </div>
  );
};

const IssueBadge = ({ issue }) => {
  if (!issue) return null;
  const cfg = ISSUE_CFG[issue] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: lbl(issue) };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 6, padding: '2px 8px',
      fontSize: 11, fontWeight: 700,
    }}>
      {(issue === 'never_enrolled' || issue === 'expired') && <WarningOutlined style={{ fontSize: 10 }} />}
      {cfg.label}
    </span>
  );
};

// ── Employee cell ──────────────────────────────────────────────────────────────
const EmployeeCell = ({ name, empCode, type, company, department }) => {
  const typeCfg = TYPE_CFG[type] || TYPE_CFG.STAFF;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar size={30} style={{ background: avatarColor(name), fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
        {initials(name)}
      </Avatar>
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{name || '—'}</div>
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

// ── Bulk bar ───────────────────────────────────────────────────────────────────
const BulkBar = ({ count, label: barLabel, onClear, onDelete, deletePending, extra }) =>
  count > 0 ? (
    <div style={{
      background: '#7c3aed', borderRadius: 10, padding: '10px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
        {count} {barLabel || 'item'}{count !== 1 ? 's' : ''} selected
      </span>
      <div style={{ flex: 1 }} />
      {extra}
      <Popconfirm title={`Delete ${count} item(s)?`} description="This cannot be undone."
        onConfirm={onDelete} okText="Delete" okButtonProps={{ danger: true }}>
        <Button size="small" danger icon={<DeleteOutlined />} loading={deletePending}
          style={{ borderRadius: 6, background: '#dc2626', border: 'none', color: '#fff' }}>
          Delete
        </Button>
      </Popconfirm>
      <Button size="small" icon={<CloseOutlined />} onClick={onClear}
        style={{ borderRadius: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }} />
    </div>
  ) : null;

// ── Enrollment detail drawer ───────────────────────────────────────────────────
const EnrollmentDrawer = ({ record, onClose, onAction, onEdit, actionPending, onCertificate }) => {
  if (!record) return null;
  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={34} style={{ background: avatarColor(record.personnel_name), fontSize: 11, fontWeight: 700 }}>
            {initials(record.personnel_name)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{record.personnel_name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{record.course_name}</div>
          </div>
        </div>
      }
      open={!!record} onClose={onClose} width={400}
      bodyStyle={{ padding: 20 }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatusPill status={record.status} />
        {record.is_mandatory && (
          <span style={{ fontSize: 10, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px' }}>
            Mandatory
          </span>
        )}
        {record.course_category && <CategoryPill category={record.course_category} />}
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        <Row gutter={12}>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Course Code</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{record.course_code}</Text>
          </Col>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Duration</Text>
            <Text style={{ fontSize: 12 }}>{record.duration_hours ? `${record.duration_hours}h` : '—'}</Text>
          </Col>
        </Row>
        <Row gutter={12} style={{ marginTop: 10 }}>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Enrolled</Text>
            <Text style={{ fontSize: 12 }}>{record.enrollment_date ? dayjs(record.enrollment_date).format('DD MMM YYYY') : '—'}</Text>
          </Col>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Completed</Text>
            <Text style={{ fontSize: 12 }}>{record.completion_date ? dayjs(record.completion_date).format('DD MMM YYYY') : '—'}</Text>
          </Col>
        </Row>
      </div>

      {record.score != null && (
        <div style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Score</Text>
          <Progress percent={Number(record.score)} strokeColor={Number(record.score) >= 70 ? '#16a34a' : '#dc2626'} trailColor="#f1f5f9" />
        </div>
      )}

      {record.status === 'certified' && (
        <div style={{ background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <Text style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#7c3aed', display: 'block', marginBottom: 6 }}>Certificate</Text>
          <CertBadge certStatus={record.cert_status} expiryDate={record.expiry_date} />
          {record.valid_period_months && (
            <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, display: 'block' }}>
              Validity: {record.valid_period_months} months
            </Text>
          )}
        </div>
      )}

      {record.department_name && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <ApartmentOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
          <Text style={{ fontSize: 12 }}>{record.department_name}</Text>
        </div>
      )}

      <Divider style={{ margin: '14px 0 10px' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {record.status === 'enrolled' && (
          <Button icon={<PlayCircleOutlined />} size="small" loading={actionPending}
            onClick={() => onAction(record.id, 'start')} style={{ borderRadius: 7 }}>
            Start
          </Button>
        )}
        {['enrolled', 'in_progress'].includes(record.status) && (
          <>
            <Button type="primary" icon={<CheckCircleOutlined />} size="small" loading={actionPending}
              onClick={() => onAction(record.id, 'complete', {})} style={{ borderRadius: 7 }}>
              Complete
            </Button>
            <Button danger icon={<CloseCircleOutlined />} size="small" loading={actionPending}
              onClick={() => onAction(record.id, 'fail', {})} style={{ borderRadius: 7 }}>
              Fail
            </Button>
          </>
        )}
        {record.status === 'completed' && (
          <Button icon={<SafetyCertificateOutlined />} size="small" loading={actionPending}
            onClick={() => onAction(record.id, 'certify', {})} style={{ borderRadius: 7, background: '#7c3aed', border: 'none', color: '#fff' }}>
            Issue Certificate
          </Button>
        )}
        {record.status === 'certified' && (
          <Button type="primary" icon={<DownloadOutlined />} size="small"
            style={{ background: '#059669', borderColor: '#059669', borderRadius: 7 }}
            onClick={() => onCertificate(record)}>
            View Certificate
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
const AnalyticsTab = ({ enrollments, courses, summary }) => {
  const { statusDist, categoryDist, expiryTimeline, deptDist, mandatoryRatio } = useMemo(() => {
    const sCounts = {}, catCounts = {}, dCounts = {};
    let mandatory = 0, optional = 0;
    const now = dayjs();

    enrollments.forEach(e => {
      sCounts[e.status] = (sCounts[e.status] || 0) + 1;
      if (e.course_category) catCounts[e.course_category] = (catCounts[e.course_category] || 0) + 1;
      const d = e.department_name || 'No Dept';
      if (!dCounts[d]) dCounts[d] = { certified: 0, total: 0 };
      dCounts[d].total++;
      if (e.status === 'certified') dCounts[d].certified++;
      if (e.is_mandatory) mandatory++; else optional++;
    });

    // Expiry buckets: expired / 0-30d / 31-60d / 61-90d / >90d
    const expiryBuckets = [
      { name: 'Expired',   count: 0, fill: '#ef4444' },
      { name: '0–30 days', count: 0, fill: '#f97316' },
      { name: '31–60 days', count: 0, fill: '#eab308' },
      { name: '61–90 days', count: 0, fill: '#3b82f6' },
    ];
    enrollments.filter(e => e.status === 'certified' && e.expiry_date).forEach(e => {
      const days = dayjs(e.expiry_date).diff(now, 'day');
      if (days < 0)       expiryBuckets[0].count++;
      else if (days <= 30) expiryBuckets[1].count++;
      else if (days <= 60) expiryBuckets[2].count++;
      else if (days <= 90) expiryBuckets[3].count++;
    });

    const statusDist   = Object.entries(sCounts).map(([k, v]) => ({ name: STATUS_CFG[k]?.label || lbl(k), value: v, fill: STATUS_CFG[k]?.color || '#94a3b8', key: k })).filter(d => d.value > 0);
    const categoryDist = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: lbl(k), count: v, fill: CATEGORY_CFG[k]?.color || '#94a3b8' }));
    const deptDist     = Object.entries(dCounts).sort((a, b) => b[1].total - a[1].total).slice(0, 12)
      .map(([dept, d]) => ({ name: dept.length > 18 ? dept.slice(0, 16) + '…' : dept, ...d, rate: d.total ? Math.round(d.certified / d.total * 100) : 0 }));

    return { statusDist, categoryDist, expiryTimeline: expiryBuckets, deptDist, mandatoryRatio: [{ name: 'Mandatory', value: mandatory, fill: '#ef4444' }, { name: 'Optional', value: optional, fill: '#3b82f6' }] };
  }, [enrollments]);

  if (enrollments.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <BarChartOutlined style={{ fontSize: 40, color: '#cbd5e1' }} />
      <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>No enrollment data to visualize</div>
    </div>
  );

  const cardStyle = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16 };
  const sTitle = t => <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t}</div>;
  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.07) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <Row gutter={[12, 12]}>
        {[
          { label: 'Total Courses',   value: summary.total_courses ?? courses.length,                                       color: '#2563eb', bg: '#eff6ff', icon: <BookOutlined /> },
          { label: 'Mandatory',       value: summary.mandatory_courses ?? courses.filter(c => c.is_mandatory).length,       color: '#dc2626', bg: '#fef2f2', icon: <ExclamationCircleOutlined /> },
          { label: 'Certified',       value: summary.certified ?? enrollments.filter(e => e.status === 'certified').length,  color: '#7c3aed', bg: '#ede9fe', icon: <FileProtectOutlined /> },
          { label: 'Expired Certs',   value: summary.expired_certs ?? enrollments.filter(e => e.cert_status === 'expired').length, color: '#b91c1c', bg: '#fef2f2', icon: <WarningOutlined /> },
        ].map(k => (
          <Col xs={12} sm={6} key={k.label}>
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color, fontSize: 16 }}>{k.icon}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* Status distribution */}
        <Col xs={24} md={10}>
          <div style={cardStyle}>
            {sTitle('Enrollment Status')}
            {statusDist.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ResponsiveContainer width="55%" height={160}>
                  <PieChart>
                    <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={68} labelLine={false} label={CustomPieLabel}>
                      {statusDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {statusDist.map((d, i) => (
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

        {/* Expiry timeline */}
        <Col xs={24} md={14}>
          <div style={cardStyle}>
            {sTitle('Certificate Expiry Urgency')}
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={expiryTimeline} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Certs']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Certs">
                  {expiryTimeline.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Col>

        {/* Category breakdown */}
        {categoryDist.length > 0 && (
          <Col xs={24} md={14}>
            <div style={cardStyle}>
              {sTitle('Enrollments by Category')}
              <ResponsiveContainer width="100%" height={Math.max(180, categoryDist.length * 34)}>
                <BarChart data={categoryDist} layout="vertical" margin={{ left: 4, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={80} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Enrollments']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {categoryDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}

        {/* Mandatory vs optional */}
        <Col xs={24} md={10}>
          <div style={cardStyle}>
            {sTitle('Mandatory vs Optional')}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ResponsiveContainer width="55%" height={140}>
                <PieChart>
                  <Pie data={mandatoryRatio.filter(d => d.value > 0)} dataKey="value" cx="50%" cy="50%" outerRadius={60} labelLine={false} label={CustomPieLabel}>
                    {mandatoryRatio.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mandatoryRatio.filter(d => d.value > 0).map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                      <Text style={{ fontSize: 11, color: '#374151' }}>{d.name}</Text>
                    </div>
                    <Text style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{d.value}</Text>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Col>

        {/* Certification rate by department */}
        {deptDist.length > 0 && (
          <Col xs={24}>
            <div style={cardStyle}>
              {sTitle('Certification Rate by Department')}
              <ResponsiveContainer width="100%" height={Math.max(200, deptDist.length * 36)}>
                <BarChart data={deptDist} layout="vertical" margin={{ left: 4, right: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={100} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={(v, n, p) => [`${v}% (${p.payload.certified}/${p.payload.total})`, 'Cert Rate']} />
                  <Bar dataKey="rate" name="Cert Rate %" radius={[0, 4, 4, 0]}>
                    {deptDist.map((d, i) => <Cell key={i} fill={d.rate >= 80 ? '#22c55e' : d.rate >= 60 ? '#3b82f6' : d.rate >= 40 ? '#f59e0b' : '#ef4444'} />)}
                  </Bar>
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
const TrainingManagement = () => {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('courses');

  // Course filters
  const [courseSearch,    setCourseSearch]    = useState('');
  const [courseCategory,  setCourseCategory]  = useState('');

  // Enrollment filters
  const [enrollSearch,   setEnrollSearch]   = useState('');
  const [enrollStatus,   setEnrollStatus]   = useState('');
  const [enrollCategory, setEnrollCategory] = useState('');
  const [enrollType,     setEnrollType]     = useState('');
  const [enrollDept,     setEnrollDept]     = useState('');
  const [enrollExpiring, setEnrollExpiring] = useState(false);

  // Compliance filters
  const [compType,   setCompType]   = useState('');
  const [compIssue,  setCompIssue]  = useState('');
  const [compCourse, setCompCourse] = useState(null);
  const [compDept,   setCompDept]   = useState('');

  // Selection
  const [selectedCourseKeys, setSelectedCourseKeys] = useState([]);
  const [selectedEnrollKeys, setSelectedEnrollKeys] = useState([]);

  // Modals / drawers
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse,   setEditingCourse]   = useState(null);
  const [courseForm] = Form.useForm();

  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [editingEnroll,   setEditingEnroll]   = useState(null);
  const [enrollForm] = Form.useForm();

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionId,        setActionId]        = useState(null);
  const [actionType,      setActionType]      = useState('complete');
  const [actionForm] = Form.useForm();

  const [detailEnroll, setDetailEnroll] = useState(null);

  const [certModalOpen,   setCertModalOpen]   = useState(false);
  const [certEnrollment,  setCertEnrollment]  = useState(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
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

  // ── Derived ──────────────────────────────────────────────────────────────────
  const courses     = useMemo(() => { const r = coursesRaw?.data || coursesRaw || []; return Array.isArray(r) ? r : []; }, [coursesRaw]);
  const enrollments = useMemo(() => { const r = enrollRaw?.data  || enrollRaw  || []; return Array.isArray(r) ? r : []; }, [enrollRaw]);
  const compliance  = useMemo(() => { const r = complianceRaw?.data || complianceRaw || []; return Array.isArray(r) ? r : []; }, [complianceRaw]);
  const personnel   = useMemo(() => { const r = personnelRaw?.results || personnelRaw?.data || personnelRaw || []; return Array.isArray(r) ? r : []; }, [personnelRaw]);
  const summary     = useMemo(() => summaryRaw?.data || summaryRaw || {}, [summaryRaw]);

  const inv    = useCallback((...keys) => keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] })), [queryClient]);
  const invAll = useCallback(() => inv('training-courses', 'training-enrollments', 'training-summary', 'training-compliance'), [inv]);

  const expiredCount   = useMemo(() => enrollments.filter(e => e.cert_status === 'expired').length, [enrollments]);
  const expiringCount  = useMemo(() => enrollments.filter(e => e.cert_status === 'expiring').length, [enrollments]);
  const totalGaps      = useMemo(() => compliance.filter(c => ['never_enrolled', 'expired'].includes(c.issue)).length, [compliance]);

  const mandatoryCourseOptions = useMemo(() =>
    courses.filter(c => c.is_mandatory).map(c => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` })),
  [courses]);
  const selectedCompCourse = useMemo(() => compCourse ? courses.find(c => c.id === compCourse) : null, [courses, compCourse]);
  const personnelOptions   = useMemo(() => personnel.map(p => ({
    value: p.id,
    label: `${(p.first_name || '')} ${(p.last_name || '')}`.trim()
      + (p.emp_code ? ` (${p.emp_code})` : '')
      + (p.personnel_type && p.personnel_type !== 'STAFF' ? ` [${p.personnel_type}]` : ''),
  })), [personnel]);
  const courseOptions = useMemo(() => courses.map(c => ({ value: c.id, label: `${c.course_code} — ${c.course_name}` })), [courses]);
  const enrollDeptOptions = useMemo(() => [...new Set(enrollments.map(e => e.department_name).filter(Boolean))].sort().map(d => ({ value: d, label: d })), [enrollments]);

  // Filtered lists
  const filteredCourses = useMemo(() => courses.filter(c => {
    if (courseCategory && c.category !== courseCategory) return false;
    if (courseSearch) {
      const q = courseSearch.toLowerCase();
      return (c.course_name || '').toLowerCase().includes(q) || (c.course_code || '').toLowerCase().includes(q);
    }
    return true;
  }), [courses, courseCategory, courseSearch]);

  const filteredEnroll = useMemo(() => enrollments.filter(e => {
    if (enrollStatus   && e.status !== enrollStatus)           return false;
    if (enrollCategory && e.course_category !== enrollCategory) return false;
    if (enrollType     && e.personnel_type !== enrollType)     return false;
    if (enrollDept     && e.department_name !== enrollDept)    return false;
    if (enrollExpiring && !['expiring', 'expired'].includes(e.cert_status)) return false;
    if (enrollSearch) {
      const q = enrollSearch.toLowerCase();
      return (e.personnel_name || '').toLowerCase().includes(q)
          || (e.personnel_emp_code || '').toLowerCase().includes(q)
          || (e.course_name || '').toLowerCase().includes(q)
          || (e.course_code || '').toLowerCase().includes(q)
          || (e.department_name || '').toLowerCase().includes(q);
    }
    return true;
  }), [enrollments, enrollStatus, enrollCategory, enrollType, enrollDept, enrollExpiring, enrollSearch]);

  const filteredCompliance = useMemo(() => compliance.filter(c => {
    if (compCourse && c.course_id !== compCourse) return false;
    if (compType   && c.personnel_type !== compType)   return false;
    if (compIssue  && c.issue !== compIssue)           return false;
    if (compDept   && c.department_name !== compDept)  return false;
    return true;
  }), [compliance, compCourse, compType, compIssue, compDept]);

  const complianceGaps = useMemo(() =>
    filteredCompliance.filter(c => ['never_enrolled', 'expired'].includes(c.issue)).length,
  [filteredCompliance]);

  const hasEnrollFilters = enrollStatus || enrollCategory || enrollType || enrollDept || enrollExpiring || enrollSearch;

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const courseMut = useMutation({
    mutationFn: d => editingCourse
      ? apiService.put(`/api/v1/personnel/training/courses/${editingCourse.id}`, d)
      : apiService.post('/api/v1/personnel/training/courses', d),
    onSuccess: () => { message.success(editingCourse ? 'Course updated' : 'Course created'); setCourseModalOpen(false); setEditingCourse(null); inv('training-courses', 'training-summary'); },
    onError: e => message.error(e?.response?.data?.detail || 'Failed'),
  });
  const delCourseMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/training/courses/${id}`),
    onSuccess: () => { message.success('Course deleted'); inv('training-courses', 'training-summary'); },
    onError: e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const enrollMut = useMutation({
    mutationFn: d => editingEnroll
      ? apiService.put(`/api/v1/personnel/training/enrollments/${editingEnroll.id}`, d)
      : apiService.post('/api/v1/personnel/training/enrollments', d),
    onSuccess: () => { message.success(editingEnroll ? 'Enrollment updated' : 'Enrolled successfully'); setEnrollModalOpen(false); setEditingEnroll(null); invAll(); },
    onError: e => message.error(e?.response?.data?.detail || 'Failed'),
  });
  const delEnrollMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/training/enrollments/${id}`),
    onSuccess: () => { message.success('Enrollment deleted'); invAll(); },
    onError: e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, action, data }) => apiService.put(`/api/v1/personnel/training/enrollments/${id}/${action}`, data || {}),
    onSuccess: (_, { action }) => {
      const msgs = { start: 'Training started', complete: 'Marked complete', certify: 'Certificate issued', fail: 'Marked failed', cancel: 'Cancelled' };
      message.success(msgs[action] || 'Updated');
      setActionModalOpen(false); setDetailEnroll(null); invAll();
    },
    onError: e => message.error(e?.response?.data?.detail || 'Action failed'),
  });
  const importMut = useMutation({
    mutationFn: () => apiService.post('/api/v1/personnel/training/import-standard-courses'),
    onSuccess: res => {
      const d = res?.data || res || {};
      message.success(`Imported ${d.created ?? 0} course(s). ${d.skipped ?? 0} already existed.`);
      inv('training-courses', 'training-summary');
    },
    onError: e => message.error(e?.response?.data?.detail || 'Import failed'),
  });

  // Bulk
  const bulkDelCourses = useCallback(async () => {
    await Promise.all(selectedCourseKeys.map(id => apiService.delete(`/api/v1/personnel/training/courses/${id}`)));
    message.success(`${selectedCourseKeys.length} course(s) deleted`);
    setSelectedCourseKeys([]);
    inv('training-courses', 'training-summary');
  }, [selectedCourseKeys, inv]);
  const bulkDelEnroll = useCallback(async () => {
    await Promise.all(selectedEnrollKeys.map(id => apiService.delete(`/api/v1/personnel/training/enrollments/${id}`)));
    message.success(`${selectedEnrollKeys.length} enrollment(s) deleted`);
    setSelectedEnrollKeys([]);
    invAll();
  }, [selectedEnrollKeys, invAll]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const openAddCourse  = () => { setEditingCourse(null); setCourseModalOpen(true); setTimeout(() => courseForm.resetFields(), 0); };
  const openEditCourse = r => { setEditingCourse(r); setCourseModalOpen(true); setTimeout(() => courseForm.setFieldsValue(r), 0); };
  const submitCourse   = () => courseForm.validateFields().then(v => courseMut.mutate(v)).catch(() => {});

  const openAddEnroll  = (prefill = {}) => {
    setEditingEnroll(null); setEnrollModalOpen(true);
    setTimeout(() => { enrollForm.resetFields(); enrollForm.setFieldsValue({ enrollment_date: dayjs(), status: 'enrolled', ...prefill }); }, 0);
  };
  const openEditEnroll = r => {
    setEditingEnroll(r); setEnrollModalOpen(true);
    setTimeout(() => enrollForm.setFieldsValue({ ...r, enrollment_date: r.enrollment_date ? dayjs(r.enrollment_date) : null, completion_date: r.completion_date ? dayjs(r.completion_date) : null }), 0);
  };
  const submitEnroll   = () => enrollForm.validateFields().then(v => enrollMut.mutate({
    ...v,
    enrollment_date: v.enrollment_date?.format('YYYY-MM-DD'),
    completion_date: v.completion_date?.format('YYYY-MM-DD'),
  })).catch(() => {});

  const openAction  = (id, type) => { setActionId(id); setActionType(type); setActionModalOpen(true); setTimeout(() => { actionForm.resetFields(); if (type !== 'cancel') actionForm.setFieldsValue({ completion_date: dayjs() }); }, 0); };
  const submitAction = () => actionForm.validateFields().then(v => statusMut.mutate({
    id: actionId, action: actionType,
    data: { ...v, completion_date: v.completion_date?.format('YYYY-MM-DD') },
  })).catch(() => {});
  const openCertificate = r => { setCertEnrollment(r); setCertModalOpen(true); };

  // ── Export cols ───────────────────────────────────────────────────────────────
  const enrollExportCols = [
    { title: 'Personnel',   exportValue: r => r.personnel_name || '' },
    { title: 'Emp Code',    exportValue: r => r.personnel_emp_code || '' },
    { title: 'Type',        exportValue: r => r.personnel_type || '' },
    { title: 'Department',  exportValue: r => r.department_name || '' },
    { title: 'Course Code', exportValue: r => r.course_code || '' },
    { title: 'Course Name', exportValue: r => r.course_name || '' },
    { title: 'Category',    exportValue: r => r.course_category || '' },
    { title: 'Mandatory',   exportValue: r => r.is_mandatory ? 'Yes' : 'No' },
    { title: 'Enrolled',    exportValue: r => r.enrollment_date || '' },
    { title: 'Completed',   exportValue: r => r.completion_date || '' },
    { title: 'Status',      exportValue: r => r.status || '' },
    { title: 'Score (%)',   exportValue: r => r.score ?? '' },
    { title: 'Cert Status', exportValue: r => r.cert_status || '' },
    { title: 'Expiry Date', exportValue: r => r.expiry_date || '' },
  ];

  // ── Table columns ─────────────────────────────────────────────────────────────
  const courseColumns = [
    {
      title: 'Code', dataIndex: 'course_code', width: 120,
      sorter: (a, b) => (a.course_code || '').localeCompare(b.course_code || ''),
      render: c => <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#374151', background: '#f1f5f9', borderRadius: 5, padding: '2px 7px' }}>{c}</span>,
    },
    {
      title: 'Course Name', dataIndex: 'course_name',
      sorter: (a, b) => (a.course_name || '').localeCompare(b.course_name || ''),
      render: (n, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{n}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
            {r.category && <CategoryPill category={r.category} />}
            {r.is_mandatory && <span style={{ fontSize: 9, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '1px 6px' }}>Mandatory</span>}
          </div>
          {r.description && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{r.description.slice(0, 80)}{r.description.length > 80 ? '…' : ''}</div>}
        </div>
      ),
    },
    {
      title: 'Duration', dataIndex: 'duration_hours', width: 90,
      render: h => h ? <span style={{ fontWeight: 600, fontSize: 12 }}>{h}h</span> : '—',
    },
    {
      title: 'Validity', dataIndex: 'valid_period_months', width: 120,
      render: m => m
        ? <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>{m} months</span>
        : <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>No Expiry</span>,
    },
    {
      title: 'Enrolled', dataIndex: 'enrollment_count', width: 90,
      sorter: (a, b) => (a.enrollment_count || 0) - (b.enrollment_count || 0),
      render: n => <span style={{ fontSize: 14, fontWeight: 800, color: '#2563eb' }}>{n ?? 0}</span>,
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 100,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEditCourse(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Popconfirm title="Delete course?" onConfirm={() => delCourseMut.mutate(r.id)} okButtonProps={{ danger: true }} disabled={(r.enrollment_count || 0) > 0}>
            <Tooltip title={(r.enrollment_count || 0) > 0 ? 'Has enrollments — cannot delete' : 'Delete'}>
              <Button danger size="small" icon={<DeleteOutlined />} disabled={(r.enrollment_count || 0) > 0} style={{ borderRadius: 6 }} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const enrollColumns = [
    {
      title: 'Personnel', key: 'person', width: 220,
      sorter: (a, b) => (a.personnel_name || '').localeCompare(b.personnel_name || ''),
      render: (_, r) => (
        <div onClick={() => setDetailEnroll(r)} style={{ cursor: 'pointer' }}>
          <EmployeeCell
            name={r.personnel_name || `ID ${r.personnel_id}`}
            empCode={r.personnel_emp_code}
            type={r.personnel_type}
            company={r.personnel_company}
            department={r.department_name}
          />
        </div>
      ),
    },
    {
      title: 'Course', key: 'course', width: 210,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{r.course_name}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#94a3b8', background: '#f1f5f9', borderRadius: 3, padding: '0 4px' }}>{r.course_code}</span>
            {r.course_category && <CategoryPill category={r.course_category} />}
            {r.is_mandatory && <span style={{ fontSize: 9, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '0 5px' }}>Mandatory</span>}
          </div>
          {r.enrollment_date && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Enrolled: {dayjs(r.enrollment_date).format('DD MMM YYYY')}</div>}
        </div>
      ),
    },
    {
      title: 'Score', dataIndex: 'score', width: 110,
      sorter: (a, b) => (a.score ?? -1) - (b.score ?? -1),
      render: s => {
        if (s == null) return <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>;
        const n = Number(s);
        return <Progress percent={n} size="small" strokeColor={n >= 70 ? '#16a34a' : '#dc2626'} trailColor="#f1f5f9" format={p => <span style={{ fontSize: 10, fontWeight: 700 }}>{p}%</span>} />;
      },
    },
    {
      title: 'Status', key: 'status', width: 130,
      render: (_, r) => <StatusPill status={r.status} />,
    },
    {
      title: 'Certificate', key: 'cert', width: 170,
      render: (_, r) => r.status === 'certified'
        ? <CertBadge certStatus={r.cert_status} expiryDate={r.expiry_date} />
        : <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>,
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 210,
      render: (_, r) => (
        <Space size={3} wrap>
          {r.status === 'enrolled' && (
            <Tooltip title="Start"><Button size="small" icon={<PlayCircleOutlined />} onClick={() => statusMut.mutate({ id: r.id, action: 'start' })} style={{ borderRadius: 6 }} /></Tooltip>
          )}
          {['enrolled', 'in_progress'].includes(r.status) && (
            <>
              <Tooltip title="Complete"><Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => openAction(r.id, 'complete')} style={{ borderRadius: 6 }} /></Tooltip>
              <Tooltip title="Fail"><Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => openAction(r.id, 'fail')} style={{ borderRadius: 6 }} /></Tooltip>
            </>
          )}
          {r.status === 'completed' && (
            <Tooltip title="Issue Certificate">
              <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => openAction(r.id, 'certify')}
                style={{ borderRadius: 6, background: '#7c3aed', border: 'none', color: '#fff' }} />
            </Tooltip>
          )}
          {r.status === 'certified' && (
            <Tooltip title="View Certificate">
              <Button size="small" icon={<DownloadOutlined />} onClick={() => openCertificate(r)}
                style={{ borderRadius: 6, background: '#059669', border: 'none', color: '#fff' }} />
            </Tooltip>
          )}
          <Tooltip title="Detail"><Button size="small" icon={<MoreOutlined />} onClick={() => setDetailEnroll(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEditEnroll(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Popconfirm title="Delete enrollment?" onConfirm={() => delEnrollMut.mutate(r.id)} okButtonProps={{ danger: true }}>
            <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const complianceColumns = [
    {
      title: 'Personnel', key: 'person', width: 220,
      sorter: (a, b) => (a.personnel_name || '').localeCompare(b.personnel_name || ''),
      render: (_, r) => (
        <EmployeeCell
          name={r.personnel_name}
          empCode={r.personnel_emp_code}
          type={r.personnel_type}
          company={r.personnel_company}
          department={r.department_name}
        />
      ),
    },
    { title: 'Issue', dataIndex: 'issue', width: 160, render: i => <IssueBadge issue={i} /> },
    {
      title: 'Expiry', key: 'expiry', width: 180,
      sorter: (a, b) => (a.days_until_expiry ?? 9999) - (b.days_until_expiry ?? 9999),
      render: (_, r) => {
        if (!r.expiry_date) return <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>;
        const days = r.days_until_expiry;
        return (
          <div>
            <span style={{ fontWeight: 600, fontSize: 11, color: days < 0 ? '#dc2626' : days < 30 ? '#d97706' : '#374151' }}>
              {days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d`}
            </span>
            <div style={{ fontSize: 9, color: '#94a3b8' }}>{r.expiry_date}</div>
          </div>
        );
      },
    },
    {
      title: '', key: 'action', width: 130,
      render: (_, r) => (
        <Button size="small" type="primary" icon={<PlusOutlined />} style={{ borderRadius: 7 }}
          onClick={() => {
            setActiveTab('enrollments');
            setTimeout(() => openAddEnroll({ personnel_id: r.personnel_id, course_id: r.course_id }), 100);
          }}>
          {r.issue === 'never_enrolled' ? 'Enroll Now' : 'Re-enroll'}
        </Button>
      ),
    },
  ];

  const containerStyle = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' };
  const paginationProps = { pageSize: 20, showSizeChanger: true, showQuickJumper: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`, style: { padding: '12px 16px', margin: 0 } };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Training Management</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                Course catalogue, enrollment tracking, certifications and compliance gaps
              </div>
            </div>
            <Space size="middle" style={{ overflow: 'visible' }}>
              <Badge count={expiredCount} showZero color="#b91c1c">
                <WarningOutlined style={{ fontSize: 16 }} />
              </Badge>
              <Badge count={expiringCount} showZero color="#d97706">
                <ExclamationCircleOutlined style={{ fontSize: 16 }} />
              </Badge>
              <Button icon={<ImportOutlined />} size="small" onClick={() => modal.confirm({
                title: 'Import Standard O&G Courses',
                content: 'Adds 24 standard offshore training courses (BOSIET, H₂S, HUET, FOET, Permit to Work, etc.). Existing codes are skipped.',
                okText: 'Import', onOk: () => importMut.mutate(),
              })} loading={importMut.isPending}>
                Import O&G Standards
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddCourse} size="small" style={{ fontWeight: 600 }}>
                Add Course
              </Button>
            </Space>
          </div>
        }
        styles={{ header: { overflow: 'visible' } }}
      >

      {/* Stat cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Courses',  value: summary.total_courses  ?? courses.length,                                      color: '#2563eb', bg: '#eff6ff', icon: <BookOutlined />           },
          { label: 'Mandatory',      value: summary.mandatory_courses ?? courses.filter(c => c.is_mandatory).length,       color: '#dc2626', bg: '#fef2f2', icon: <ExclamationCircleOutlined /> },
          { label: 'Certified',      value: summary.certified      ?? enrollments.filter(e => e.status === 'certified').length, color: '#7c3aed', bg: '#ede9fe', icon: <FileProtectOutlined /> },
          { label: 'Expired Certs',  value: expiredCount,                                                                   color: '#b91c1c', bg: '#fef2f2', icon: <WarningOutlined />        },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: `1px solid ${expiredCount > 0 && s.label === 'Expired Certs' ? '#fecaca' : '#e2e8f0'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 18 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Alerts */}
      {expiredCount > 0 && (
        <Alert type="error" showIcon closable style={{ marginBottom: 10, borderRadius: 8 }}
          message={`${expiredCount} certified training record${expiredCount > 1 ? 's have' : ' has'} expired certificates — re-enrollment required`} />
      )}
      {expiringCount > 0 && (
        <Alert type="warning" showIcon closable style={{ marginBottom: 10, borderRadius: 8 }}
          message={`${expiringCount} certificate${expiringCount > 1 ? 's are' : ' is'} expiring within 30 days`} />
      )}

      {/* Tabs */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding: '0 16px' }}
          items={[

            // ── COURSES ────────────────────────────────────────────────────────
            {
              key: 'courses',
              label: <span><BookOutlined /> Course Catalogue</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                    <Input placeholder="Search name or code…" prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
                      value={courseSearch} onChange={e => setCourseSearch(e.target.value)} allowClear
                      style={{ flex: '1 1 200px', maxWidth: 260, borderRadius: 8 }} />
                    <Select placeholder="Category" allowClear style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={courseCategory || undefined} onChange={v => setCourseCategory(v || '')}
                      options={CATEGORIES.map(c => ({ value: c, label: <CategoryPill category={c} /> }))} />
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Button icon={<ReloadOutlined />} onClick={refetchCourses} style={{ borderRadius: 8 }} />
                    </div>
                  </div>
                  <BulkBar count={selectedCourseKeys.length} label="course" onClear={() => setSelectedCourseKeys([])} onDelete={bulkDelCourses} />
                  <div style={containerStyle}>
                    <Table columns={courseColumns} dataSource={filteredCourses} loading={coursesLoading} rowKey="id"
                      rowSelection={{ selectedRowKeys: selectedCourseKeys, onChange: setSelectedCourseKeys }}
                      pagination={paginationProps} scroll={{ x: 900 }} size="middle" />
                  </div>
                </div>
              ),
            },

            // ── ENROLLMENTS ───────────────────────────────────────────────────
            {
              key: 'enrollments',
              label: <span><UserOutlined /> Enrollments</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                    <Input placeholder="Search person, course, dept…" prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
                      value={enrollSearch} onChange={e => setEnrollSearch(e.target.value)} allowClear
                      style={{ flex: '1 1 200px', maxWidth: 240, borderRadius: 8 }} />
                    <FilterOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                    <Select placeholder="Status" allowClear style={{ flex: '1 1 130px', minWidth: 130 }}
                      value={enrollStatus || undefined} onChange={v => setEnrollStatus(v || '')}
                      options={ENROLL_STATUSES.map(s => ({ value: s, label: <StatusPill status={s} /> }))} />
                    <Select placeholder="Category" allowClear style={{ flex: '1 1 130px', minWidth: 130 }}
                      value={enrollCategory || undefined} onChange={v => setEnrollCategory(v || '')}
                      options={CATEGORIES.map(c => ({ value: c, label: <CategoryPill category={c} /> }))} />
                    <Select placeholder="Pers. Type" allowClear style={{ flex: '1 1 110px', minWidth: 110 }}
                      value={enrollType || undefined} onChange={v => setEnrollType(v || '')}
                      options={['STAFF', 'CONTRACTOR', 'VISITOR'].map(t => ({ value: t, label: t }))} />
                    <Select placeholder="Department" allowClear showSearch optionFilterProp="label"
                      style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={enrollDept || undefined} onChange={v => setEnrollDept(v || '')} options={enrollDeptOptions} />
                    <Tooltip title="Show expiring/expired certs only">
                      <Button size="small" type={enrollExpiring ? 'primary' : 'default'} icon={<WarningOutlined />}
                        style={{ borderRadius: 7, background: enrollExpiring ? '#d97706' : undefined, borderColor: enrollExpiring ? '#d97706' : undefined }}
                        onClick={() => setEnrollExpiring(v => !v)}>
                        Expiring
                      </Button>
                    </Tooltip>
                    {hasEnrollFilters && <Button size="small" style={{ borderRadius: 6 }} onClick={() => { setEnrollSearch(''); setEnrollStatus(''); setEnrollCategory(''); setEnrollType(''); setEnrollDept(''); setEnrollExpiring(false); }}>Clear</Button>}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Tooltip title="Export CSV">
                        <Button icon={<DownloadOutlined />} onClick={() => exportCSV(enrollExportCols, filteredEnroll, `training-enrollments-${dayjs().format('YYYY-MM-DD')}.csv`)} style={{ borderRadius: 8 }} />
                      </Tooltip>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddEnroll()} style={{ borderRadius: 8 }}>Enroll</Button>
                      <Button icon={<ReloadOutlined />} onClick={refetchEnroll} style={{ borderRadius: 8 }} />
                    </div>
                  </div>
                  {hasEnrollFilters && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {enrollStatus   && <Tag closable onClose={() => setEnrollStatus('')}   color="blue">{STATUS_CFG[enrollStatus]?.label}</Tag>}
                      {enrollCategory && <Tag closable onClose={() => setEnrollCategory('')} color="purple">{lbl(enrollCategory)}</Tag>}
                      {enrollType     && <Tag closable onClose={() => setEnrollType('')}>{enrollType}</Tag>}
                      {enrollDept     && <Tag closable onClose={() => setEnrollDept('')}     icon={<TeamOutlined />}>{enrollDept}</Tag>}
                      {enrollExpiring && <Tag closable onClose={() => setEnrollExpiring(false)} color="orange">Expiring/Expired only</Tag>}
                      {enrollSearch   && <Tag closable onClose={() => setEnrollSearch('')}   icon={<SearchOutlined />}>"{enrollSearch}"</Tag>}
                    </div>
                  )}
                  <BulkBar count={selectedEnrollKeys.length} label="enrollment" onClear={() => setSelectedEnrollKeys([])} onDelete={bulkDelEnroll} />
                  <div style={containerStyle}>
                    <Table columns={enrollColumns} dataSource={filteredEnroll} loading={enrollLoading} rowKey="id"
                      rowSelection={{ selectedRowKeys: selectedEnrollKeys, onChange: setSelectedEnrollKeys }}
                      pagination={paginationProps} scroll={{ x: 1300 }} size="middle"
                      rowClassName={r => r.cert_status === 'expired' ? 'row-expired' : r.cert_status === 'expiring' ? 'row-expiring' : ''}
                    />
                  </div>
                </div>
              ),
            },

            // ── COMPLIANCE ────────────────────────────────────────────────────
            {
              key: 'compliance',
              label: (
                <span>
                  <WarningOutlined /> Compliance Gaps
                  {totalGaps > 0 && <Badge count={totalGaps} size="small" style={{ marginLeft: 6 }} />}
                </span>
              ),
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  {/* Course picker */}
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#b45309', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <WarningOutlined /> Select a mandatory course to view compliance gaps:
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Select showSearch placeholder="Choose mandatory training course…" style={{ flex: '1 1 300px' }}
                        value={compCourse || undefined} onChange={v => { setCompCourse(v || null); setCompType(''); setCompIssue(''); setCompDept(''); }}
                        allowClear options={mandatoryCourseOptions}
                        filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
                        notFoundContent={mandatoryCourseOptions.length === 0 ? 'No mandatory courses — mark courses as Mandatory in Course Catalogue first' : 'No match'} />
                      <Button icon={<ReloadOutlined />} onClick={refetchComp} loading={compLoading} style={{ borderRadius: 8 }} />
                    </div>
                    {selectedCompCourse && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <CategoryPill category={selectedCompCourse.category} />
                        {selectedCompCourse.duration_hours && <Text style={{ fontSize: 11, color: '#92400e' }}>Duration: <b>{selectedCompCourse.duration_hours}h</b></Text>}
                        <Text style={{ fontSize: 11, color: '#92400e' }}>
                          Validity: <b>{selectedCompCourse.valid_period_months ? `${selectedCompCourse.valid_period_months} months` : 'No Expiry'}</b>
                        </Text>
                        <span style={{ fontSize: 9, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '1px 7px' }}>Mandatory</span>
                      </div>
                    )}
                  </div>

                  {!compCourse ? (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                      <BookOutlined style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
                      <div style={{ fontSize: 14, marginBottom: 4, fontWeight: 500 }}>No course selected</div>
                      <div style={{ fontSize: 12 }}>Pick a mandatory course above to see which personnel need enrollment or re-enrollment.</div>
                    </div>
                  ) : (
                    <>
                      {complianceGaps > 0 && (
                        <Alert type="warning" showIcon style={{ marginBottom: 10, borderRadius: 8 }}
                          message={`${complianceGaps} personnel have critical gaps (never enrolled or expired) for this course`} />
                      )}
                      {complianceGaps === 0 && filteredCompliance.length === 0 && !compLoading && (
                        <Alert type="success" showIcon style={{ marginBottom: 10, borderRadius: 8 }}
                          message="All personnel are compliant for this course" />
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                        <Select placeholder="Pers. Type" allowClear style={{ minWidth: 120 }}
                          value={compType || undefined} onChange={v => setCompType(v || '')}
                          options={['STAFF', 'CONTRACTOR', 'VISITOR'].map(t => ({ value: t, label: t }))} />
                        <Select placeholder="Issue" allowClear style={{ minWidth: 150 }}
                          value={compIssue || undefined} onChange={v => setCompIssue(v || '')}
                          options={Object.entries(ISSUE_CFG).map(([k, c]) => ({ value: k, label: <IssueBadge issue={k} /> }))} />
                        <Select placeholder="Department" allowClear showSearch optionFilterProp="label"
                          style={{ minWidth: 160 }}
                          value={compDept || undefined} onChange={v => setCompDept(v || '')}
                          options={[...new Set(compliance.map(c => c.department_name).filter(Boolean))].sort().map(d => ({ value: d, label: d }))} />
                      </div>
                      <div style={containerStyle}>
                        <Table columns={complianceColumns} dataSource={filteredCompliance} loading={compLoading}
                          rowKey={r => `${r.personnel_id}-${r.course_id}`}
                          pagination={paginationProps} size="middle"
                          rowClassName={r => ['never_enrolled', 'expired'].includes(r.issue) ? 'row-expired' : r.issue === 'expiring_soon' ? 'row-expiring' : ''}
                        />
                      </div>
                    </>
                  )}
                </div>
              ),
            },

            // ── ANALYTICS ─────────────────────────────────────────────────────
            {
              key: 'analytics',
              label: <span><BarChartOutlined /> Analytics</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <AnalyticsTab enrollments={enrollments} courses={courses} summary={summary} />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ── Course Modal ─────────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingCourse ? 'Edit Course' : 'Add Training Course'}
          </Space>
        }
        open={courseModalOpen} onOk={submitCourse}
        onCancel={() => { setCourseModalOpen(false); setEditingCourse(null); }}
        confirmLoading={courseMut.isPending} width={680} forceRender
      >
        <Form form={courseForm} layout="vertical" initialValues={{ is_mandatory: false }} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="course_code" label="Course Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. SAF-001" maxLength={20} disabled={!!editingCourse} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="course_name" label="Course Name" rules={[{ required: true }]}>
                <Input maxLength={200} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category">
                <Select placeholder="Select category" allowClear
                  options={CATEGORIES.map(c => ({ value: c, label: <CategoryPill category={c} /> }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="duration_hours" label="Duration (hours)" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="valid_period_months" label="Certificate Validity (months)">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Leave blank = never expires" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_mandatory" label="Mandatory Training" valuePropName="checked">
                <Switch checkedChildren="Mandatory" unCheckedChildren="Optional" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Enrollment Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingEnroll ? 'Edit Enrollment' : 'Enroll in Training'}
          </Space>
        }
        open={enrollModalOpen} onOk={submitEnroll}
        onCancel={() => { setEnrollModalOpen(false); setEditingEnroll(null); }}
        confirmLoading={enrollMut.isPending} width={620} forceRender
      >
        <Form form={enrollForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Person" rules={[{ required: true }]}>
                <Select showSearch placeholder="Select person" options={personnelOptions} disabled={!!editingEnroll}
                  filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="course_id" label="Course" rules={[{ required: true }]}>
                <Select showSearch placeholder="Select course" options={courseOptions} disabled={!!editingEnroll}
                  filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="enrollment_date" label="Enrollment Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select options={ENROLL_STATUSES.map(s => ({ value: s, label: <StatusPill status={s} /> }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="score" label="Score (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="completion_date" label="Completion Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="certificate_url" label="Certificate URL / Reference">
            <Input placeholder="https:// or document reference number" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Action Modal (complete / certify / fail) ──────────────────────── */}
      <Modal
        title={{ complete: 'Mark Training Complete', certify: 'Issue Training Certificate', fail: 'Mark Training Failed' }[actionType] || 'Update'}
        open={actionModalOpen} onOk={submitAction}
        onCancel={() => setActionModalOpen(false)}
        confirmLoading={statusMut.isPending}
        okButtonProps={actionType === 'fail' ? { danger: true } : actionType === 'certify' ? { style: { background: '#7c3aed', borderColor: '#7c3aed' } } : {}}
        forceRender
      >
        <Form form={actionForm} layout="vertical" style={{ marginTop: 16 }}>
          {['complete', 'fail'].includes(actionType) && (
            <>
              <Form.Item name="completion_date" label="Date"><DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" /></Form.Item>
              <Form.Item name="score" label="Score (%)"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
            </>
          )}
          {['complete', 'certify'].includes(actionType) && (
            <Form.Item name="certificate_url" label="Certificate URL / Reference No.">
              <Input placeholder="https:// or reference number — stored as evidence" />
            </Form.Item>
          )}
          {actionType === 'certify' && (
            <Alert type="info" showIcon style={{ marginTop: 8, borderRadius: 8 }}
              message="Issuing a certificate will calculate the expiry date automatically from the course validity period." />
          )}
        </Form>
      </Modal>

      {/* ── Certificate Preview Modal ─────────────────────────────────────── */}
      <Modal
        title={<span><SafetyCertificateOutlined style={{ marginRight: 8, color: '#059669' }} />Training Certificate — {certEnrollment?.personnel_name}</span>}
        open={certModalOpen}
        onCancel={() => { setCertModalOpen(false); setCertEnrollment(null); }}
        footer={null} width={1000}
        styles={{ body: { padding: '16px 24px', background: '#f5f5f5', overflowX: 'auto' } }}
      >
        {certEnrollment && <CertificateTemplate enrollment={certEnrollment} />}
      </Modal>

      {/* ── Enrollment Detail Drawer ──────────────────────────────────────── */}
      <EnrollmentDrawer
        record={detailEnroll}
        onClose={() => setDetailEnroll(null)}
        onAction={(id, action, data) => { statusMut.mutate({ id, action, data: data || {} }); }}
        onEdit={r => { setDetailEnroll(null); openEditEnroll(r); }}
        actionPending={statusMut.isPending}
        onCertificate={r => { setDetailEnroll(null); openCertificate(r); }}
      />

      <style>{`
        .ant-table-thead > tr > th {
          background: #f8fafc !important; color: #64748b !important;
          font-size: 11px !important; font-weight: 700 !important;
          text-transform: uppercase !important; letter-spacing: 0.05em !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f1f5f9 !important; padding: 10px 12px !important;
        }
        .ant-table-tbody > tr:last-child > td { border-bottom: none !important; }
        .ant-tabs-nav { margin-bottom: 0 !important; }
        .row-expired { background: rgba(220,38,38,0.04) !important; }
        .row-expired:hover > td { background: rgba(220,38,38,0.08) !important; }
        .row-expiring { background: rgba(217,119,6,0.04) !important; }
        .row-expiring:hover > td { background: rgba(217,119,6,0.08) !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default TrainingManagement;
