import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Row, Col,
  Tag, Popconfirm, DatePicker, InputNumber, Tabs, Tooltip,
  Alert, Badge, App, Progress, Divider, Avatar, Typography,
  Drawer, Descriptions, Empty, Spin, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  TrophyOutlined, CalendarOutlined, CheckCircleOutlined,
  CloseCircleOutlined, PlayCircleOutlined, FileProtectOutlined,
  ExclamationCircleOutlined, SendOutlined, SafetyCertificateOutlined,
  WarningOutlined, TeamOutlined, SearchOutlined, FilterOutlined,
  DownloadOutlined, StarOutlined, BarChartOutlined, CloseOutlined,
  ArrowUpOutlined, ArrowDownOutlined, UserOutlined, CheckOutlined,
  MoreOutlined, ApartmentOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, RadialBarChart, RadialBar, Legend,
  PieChart, Pie,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Text } = Typography;

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUSES      = ['draft', 'submitted', 'in_progress', 'completed', 'approved', 'rejected'];
const RATINGS       = ['excellent', 'very_good', 'good', 'satisfactory', 'needs_improvement', 'poor'];
const CYCLE_STATUSES = ['open', 'closed', 'draft'];

const STATUS_CFG = {
  draft:       { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', label: 'Draft'       },
  submitted:   { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Submitted'   },
  in_progress: { color: '#d97706', bg: '#fffbeb', border: '#fed7aa', label: 'In Review'   },
  completed:   { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', label: 'Completed'   },
  approved:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Approved'    },
  rejected:    { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Rejected'    },
};

const RATING_CFG = {
  excellent:         { color: '#7c3aed', bg: '#ede9fe', stars: 5, bar: '#7c3aed' },
  very_good:         { color: '#1d4ed8', bg: '#dbeafe', stars: 4, bar: '#3b82f6' },
  good:              { color: '#15803d', bg: '#dcfce7', stars: 3, bar: '#22c55e' },
  satisfactory:      { color: '#b45309', bg: '#fef9c3', stars: 2, bar: '#eab308' },
  needs_improvement: { color: '#c2410c', bg: '#ffedd5', stars: 1, bar: '#f97316' },
  poor:              { color: '#b91c1c', bg: '#fee2e2', stars: 0, bar: '#ef4444' },
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
const avatarColor = (name) =>
  AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials = (name) =>
  (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const label = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

// ── Helpers ────────────────────────────────────────────────────────────────────
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
  const cfg = STATUS_CFG[status] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: label(status) };
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

// ── Rating Badge ───────────────────────────────────────────────────────────────
const RatingBadge = ({ rating, showStars = true }) => {
  if (!rating) return <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>;
  const cfg = RATING_CFG[rating] || { color: '#64748b', bg: '#f3f4f6', stars: 0 };
  return (
    <div>
      <span style={{
        display: 'inline-block',
        background: cfg.bg, color: cfg.color,
        borderRadius: 5, padding: '2px 8px',
        fontSize: 11, fontWeight: 700,
      }}>
        {label(rating)}
      </span>
      {showStars && (
        <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 1, marginTop: 2 }}>
          {'★'.repeat(cfg.stars)}
          <span style={{ color: '#e5e7eb' }}>{'★'.repeat(5 - cfg.stars)}</span>
        </div>
      )}
    </div>
  );
};

// ── Score Bar ──────────────────────────────────────────────────────────────────
const ScoreBar = ({ score, label: lbl }) => {
  if (score == null) return <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>;
  const pct = Number(score);
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#2563eb' : pct >= 40 ? '#d97706' : '#dc2626';
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={{ fontSize: 10, color: '#94a3b8' }}>{lbl}</Text>
        <Text style={{ fontSize: 11, fontWeight: 700, color }}>{pct.toFixed(0)}%</Text>
      </div>
      <Progress percent={pct} size="small" strokeColor={color} trailColor="#f1f5f9" showInfo={false} />
    </div>
  );
};

// ── Employee Cell ──────────────────────────────────────────────────────────────
const EmployeeCell = ({ name, empCode, type, company, department }) => {
  const typeCfg = TYPE_CFG[type] || TYPE_CFG.STAFF;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar size={32} style={{ background: avatarColor(name), fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
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
          {department && (
            <span style={{ fontSize: 9, color: '#94a3b8' }}>{department}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Training Compliance Cell ───────────────────────────────────────────────────
const TrainingCell = ({ pct, expired }) => {
  if (pct == null) return <span style={{ color: '#d1d5db', fontSize: 11 }}>N/A</span>;
  const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
  return (
    <Tooltip title={expired > 0 ? `${expired} expired mandatory cert(s)` : 'All mandatory certs current'}>
      <div style={{ minWidth: 80 }}>
        <Progress
          percent={pct} size="small" strokeColor={color} trailColor="#f1f5f9"
          format={p => <span style={{ fontSize: 10, fontWeight: 700, color }}>{p}%</span>}
        />
        {expired > 0 && (
          <div style={{
            marginTop: 2, fontSize: 9, fontWeight: 700,
            color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <WarningOutlined /> {expired} expired
          </div>
        )}
      </div>
    </Tooltip>
  );
};

// ── Cycle Status Pill ──────────────────────────────────────────────────────────
const CycleStatusPill = ({ status }) => {
  const cfg = {
    open:   { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Open'   },
    closed: { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Closed' },
    draft:  { color: '#d97706', bg: '#fffbeb', border: '#fed7aa', label: 'Draft'  },
  }[status] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
      {cfg.label}
    </span>
  );
};

// ── Bulk action bar ────────────────────────────────────────────────────────────
const BulkBar = ({ count, onClear, onDelete, deletePending, onSubmit, submitPending, onApprove, approvePending }) =>
  count > 0 ? (
    <div style={{
      background: '#1d4ed8', borderRadius: 10, padding: '10px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 12px rgba(29,78,216,0.3)',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
        {count} appraisal{count !== 1 ? 's' : ''} selected
      </span>
      <div style={{ flex: 1 }} />
      {onSubmit && (
        <Button size="small" icon={<SendOutlined />} loading={submitPending} onClick={onSubmit}
          style={{ borderRadius: 6, background: '#2563eb', border: 'none', color: '#fff' }}>
          Submit all
        </Button>
      )}
      {onApprove && (
        <Button size="small" icon={<CheckOutlined />} loading={approvePending} onClick={onApprove}
          style={{ borderRadius: 6, background: '#16a34a', border: 'none', color: '#fff' }}>
          Approve all
        </Button>
      )}
      <Popconfirm title={`Delete ${count} appraisal${count !== 1 ? 's' : ''}?`} description="This cannot be undone."
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

// ── Cycle Card ─────────────────────────────────────────────────────────────────
const CycleCard = ({ cycle, onEdit, onDelete, onAddAppraisal, cycleOptions }) => {
  const isOpen = cycle.status === 'open';
  const daysLeft = cycle.end_date ? dayjs(cycle.end_date).diff(dayjs(), 'day') : null;
  const progress = (cycle.start_date && cycle.end_date)
    ? Math.min(100, Math.max(0, Math.round(
        (dayjs().diff(dayjs(cycle.start_date), 'day') /
         dayjs(cycle.end_date).diff(dayjs(cycle.start_date), 'day')) * 100
      )))
    : null;

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${isOpen ? '#bbf7d0' : '#e2e8f0'}`,
      boxShadow: isOpen ? '0 2px 8px rgba(22,163,74,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
      padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
              background: '#f1f5f9', color: '#475569', borderRadius: 5, padding: '2px 7px',
            }}>
              {cycle.cycle_code}
            </span>
            <CycleStatusPill status={cycle.status} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{cycle.cycle_name}</div>
          {cycle.description && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{cycle.description}</div>
          )}
        </div>
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(cycle)} style={{ borderRadius: 6 }} />
          <Tooltip title={(cycle.appraisal_count || 0) > 0 ? 'Has appraisals' : 'Delete'}>
            <Popconfirm title="Delete cycle?" onConfirm={() => onDelete(cycle.id)} okButtonProps={{ danger: true }}
              disabled={(cycle.appraisal_count || 0) > 0}>
              <Button danger size="small" icon={<DeleteOutlined />} disabled={(cycle.appraisal_count || 0) > 0} style={{ borderRadius: 6 }} />
            </Popconfirm>
          </Tooltip>
        </Space>
      </div>

      {/* Dates */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Start', date: cycle.start_date },
          { label: 'End',   date: cycle.end_date   },
        ].map(({ label: l, date }) => (
          <div key={l} style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              {date ? dayjs(date).format('DD MMM YYYY') : '—'}
            </div>
          </div>
        ))}
        <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 2 }}>Appraisals</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#2563eb' }}>{cycle.appraisal_count || 0}</div>
        </div>
      </div>

      {/* Progress bar (for open cycles) */}
      {isOpen && progress != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>Cycle progress</Text>
            {daysLeft != null && (
              <Text style={{ fontSize: 10, fontWeight: 600, color: daysLeft < 7 ? '#dc2626' : '#64748b' }}>
                {daysLeft < 0 ? 'Overdue' : `${daysLeft} days left`}
              </Text>
            )}
          </div>
          <Progress
            percent={progress} size="small"
            strokeColor={daysLeft != null && daysLeft < 7 ? '#dc2626' : '#22c55e'}
            trailColor="#e5e7eb" showInfo={false}
          />
        </div>
      )}

      {/* Add appraisal button */}
      {isOpen && (
        <Button
          size="small" type="dashed" icon={<PlusOutlined />}
          onClick={() => onAddAppraisal(cycle)}
          style={{ borderRadius: 8, fontSize: 11 }}
        >
          Add Appraisal
        </Button>
      )}
    </div>
  );
};

// ── Analytics Tab ──────────────────────────────────────────────────────────────
const AnalyticsTab = ({ summary, appraisals, cycles }) => {
  const [selectedCycle, setSelectedCycle] = useState('');
  const cycleOptions = [{ value: '', label: 'All Cycles' }, ...cycles.map(c => ({ value: c.id, label: `${c.cycle_code} — ${c.cycle_name}` }))];

  const filtered = useMemo(() =>
    selectedCycle ? appraisals.filter(a => String(a.cycle_id) === String(selectedCycle)) : appraisals,
  [appraisals, selectedCycle]);

  // Rating distribution for selected cycle
  const ratingDist = useMemo(() => {
    const counts = {};
    filtered.forEach(a => { if (a.overall_rating) counts[a.overall_rating] = (counts[a.overall_rating] || 0) + 1; });
    return ['excellent', 'very_good', 'good', 'satisfactory', 'needs_improvement', 'poor']
      .map(r => ({ name: label(r), value: counts[r] || 0, fill: RATING_CFG[r]?.bar || '#94a3b8', rating: r }))
      .filter(d => d.value > 0);
  }, [filtered]);

  // Score distribution buckets
  const scoreDist = useMemo(() => {
    const buckets = [
      { name: '0–20', range: [0, 20],   count: 0, fill: '#ef4444' },
      { name: '21–40', range: [21, 40], count: 0, fill: '#f97316' },
      { name: '41–60', range: [41, 60], count: 0, fill: '#eab308' },
      { name: '61–80', range: [61, 80], count: 0, fill: '#3b82f6' },
      { name: '81–100', range: [81, 100], count: 0, fill: '#22c55e' },
    ];
    filtered.forEach(a => {
      if (a.performance_score != null) {
        const s = Number(a.performance_score);
        const b = buckets.find(b => s >= b.range[0] && s <= b.range[1]);
        if (b) b.count++;
      }
    });
    return buckets;
  }, [filtered]);

  // Status breakdown
  const statusDist = useMemo(() => {
    const counts = {};
    filtered.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
    return Object.entries(counts).map(([s, v]) => ({
      name: STATUS_CFG[s]?.label || label(s),
      value: v,
      fill: STATUS_CFG[s]?.color || '#94a3b8',
    }));
  }, [filtered]);

  // Department scores
  const deptScores = useMemo(() => {
    const map = {};
    filtered.forEach(a => {
      const d = a.department_name || 'No Department';
      if (!map[d]) map[d] = { total: 0, scores: [], goals: [] };
      map[d].total++;
      if (a.performance_score != null) map[d].scores.push(Number(a.performance_score));
      if (a.goals_achieved != null) map[d].goals.push(Number(a.goals_achieved));
    });
    return Object.entries(map)
      .map(([dept, d]) => ({
        name: dept.length > 18 ? dept.slice(0, 16) + '…' : dept,
        avg_score: d.scores.length ? Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length) : 0,
        avg_goals: d.goals.length ? Math.round(d.goals.reduce((s, v) => s + v, 0) / d.goals.length) : 0,
        total: d.total,
      }))
      .filter(d => d.avg_score > 0)
      .sort((a, b) => b.avg_score - a.avg_score);
  }, [filtered]);

  const avgScore = useMemo(() => {
    const scores = filtered.filter(a => a.performance_score != null).map(a => Number(a.performance_score));
    return scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1) : null;
  }, [filtered]);
  const avgGoals = useMemo(() => {
    const goals = filtered.filter(a => a.goals_achieved != null).map(a => Number(a.goals_achieved));
    return goals.length ? (goals.reduce((s, v) => s + v, 0) / goals.length).toFixed(1) : null;
  }, [filtered]);

  if (appraisals.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <BarChartOutlined style={{ fontSize: 40, color: '#cbd5e1' }} />
        <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>No appraisal data to visualize</div>
      </div>
    );
  }

  const cardStyle = {
    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16,
  };
  const sectionTitle = (t) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t}</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cycle filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CalendarOutlined style={{ color: '#94a3b8' }} />
        <Select value={selectedCycle || ''} onChange={setSelectedCycle} style={{ width: 260 }} options={cycleOptions} />
        <Text type="secondary" style={{ fontSize: 12 }}>{filtered.length} appraisals</Text>
      </div>

      {/* KPI row */}
      <Row gutter={[12, 12]}>
        {[
          { label: 'Avg Score',  value: avgScore != null ? `${avgScore}%` : '—', color: '#2563eb', icon: <TrophyOutlined />, bg: '#eff6ff' },
          { label: 'Avg Goals',  value: avgGoals != null ? `${avgGoals}%` : '—', color: '#16a34a', icon: <CheckCircleOutlined />, bg: '#f0fdf4' },
          { label: 'Total',      value: filtered.length,  color: '#7c3aed', icon: <FileProtectOutlined />, bg: '#ede9fe' },
          { label: 'Completed',  value: filtered.filter(a => a.status === 'approved').length, color: '#0891b2', icon: <SafetyCertificateOutlined />, bg: '#ecfeff' },
        ].map(k => (
          <Col xs={12} sm={6} key={k.label}>
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color, fontSize: 16 }}>
                {k.icon}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* Rating distribution */}
        <Col xs={24} md={12}>
          <div style={cardStyle}>
            {sectionTitle('Rating Distribution')}
            {ratingDist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 12 }}>No ratings recorded</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ratingDist} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Count">
                    {ratingDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Col>

        {/* Status breakdown pie */}
        <Col xs={24} md={12}>
          <div style={cardStyle}>
            {sectionTitle('Status Breakdown')}
            {statusDist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 12 }}>No data</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                      {statusDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {statusDist.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                        <Text style={{ fontSize: 11, color: '#374151' }}>{d.name}</Text>
                      </div>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{d.value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Col>

        {/* Score distribution histogram */}
        <Col xs={24} md={12}>
          <div style={cardStyle}>
            {sectionTitle('Score Distribution')}
            {scoreDist.every(b => b.count === 0) ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 12 }}>No scores recorded</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={scoreDist} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={(v) => [v, 'Appraisals']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Appraisals">
                    {scoreDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Col>

        {/* Department avg score */}
        {deptScores.length > 0 && (
          <Col xs={24} md={12}>
            <div style={cardStyle}>
              {sectionTitle('Avg Score by Department')}
              <ResponsiveContainer width="100%" height={Math.max(180, deptScores.length * 36)}>
                <BarChart data={deptScores} layout="vertical" margin={{ left: 4, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={90} />
                  <RTooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }}
                    formatter={(v, n, p) => [`${v}% (${p.payload.total} appraisals)`, 'Avg Score']}
                  />
                  <Bar dataKey="avg_score" name="Avg Score" radius={[0, 4, 4, 0]} fill="#3b82f6">
                    {deptScores.map((d, i) => (
                      <Cell key={i} fill={d.avg_score >= 80 ? '#22c55e' : d.avg_score >= 60 ? '#3b82f6' : d.avg_score >= 40 ? '#f59e0b' : '#ef4444'} />
                    ))}
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

// ── Appraisal Detail Drawer ────────────────────────────────────────────────────
const AppraisalDrawer = ({ record, leaveTypes, onClose, onAction, actionPending }) => {
  if (!record) return null;
  const { color, bg, border, label: statusLabel } = STATUS_CFG[record.status] || {};
  const ratingCfg = record.overall_rating ? RATING_CFG[record.overall_rating] : null;

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={36} style={{ background: avatarColor(record.personnel_name), fontSize: 13, fontWeight: 700 }}>
            {initials(record.personnel_name)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{record.personnel_name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{record.cycle_name}</div>
          </div>
        </div>
      }
      open={!!record} onClose={onClose} width={420}
      bodyStyle={{ padding: 20 }}
    >
      {/* Status + rating */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatusPill status={record.status} />
        {record.overall_rating && <RatingBadge rating={record.overall_rating} />}
      </div>

      {/* Scores */}
      {(record.performance_score != null || record.goals_achieved != null) && (
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <Row gutter={16}>
            {record.performance_score != null && (
              <Col span={12}>
                <ScoreBar score={record.performance_score} label="Performance Score" />
              </Col>
            )}
            {record.goals_achieved != null && (
              <Col span={12}>
                <ScoreBar score={record.goals_achieved} label="Goals Achieved" />
              </Col>
            )}
          </Row>
        </div>
      )}

      {/* Training */}
      {record.training_compliance != null && (
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Training Compliance</Text>
          <TrainingCell pct={record.training_compliance} expired={record.expired_certs || 0} />
        </div>
      )}

      {/* Text sections */}
      {[
        { key: 'strengths',             label: 'Strengths',                color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
        { key: 'areas_for_improvement', label: 'Areas for Improvement',    color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
        { key: 'comments',              label: 'Reviewer Comments',         color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
      ].filter(s => record[s.key]).map(s => (
        <div key={s.key} style={{
          background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10,
          padding: '10px 12px', marginBottom: 10,
        }}>
          <Text style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: s.color, display: 'block', marginBottom: 4 }}>
            {s.label}
          </Text>
          <Text style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{record[s.key]}</Text>
        </div>
      ))}

      {/* Meta */}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {record.reviewer_name && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <UserOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>Reviewed by {record.reviewer_name}</Text>
          </div>
        )}
        {record.appraisal_date && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CalendarOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{dayjs(record.appraisal_date).format('DD MMMM YYYY')}</Text>
          </div>
        )}
        {record.department_name && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ApartmentOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{record.department_name}</Text>
          </div>
        )}
      </div>

      {/* Workflow action buttons */}
      <Divider style={{ margin: '16px 0' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {record.status === 'draft' && (
          <Button type="primary" icon={<SendOutlined />} loading={actionPending} size="small"
            onClick={() => onAction(record.id, 'submit')} style={{ borderRadius: 7 }}>
            Submit for Review
          </Button>
        )}
        {record.status === 'submitted' && (
          <Button icon={<PlayCircleOutlined />} loading={actionPending} size="small"
            onClick={() => onAction(record.id, 'start')} style={{ borderRadius: 7 }}>
            Start Review
          </Button>
        )}
        {record.status === 'in_progress' && (
          <Button type="primary" icon={<CheckCircleOutlined />} loading={actionPending} size="small"
            onClick={() => onAction(record.id, 'complete')} style={{ borderRadius: 7 }}>
            Mark Complete
          </Button>
        )}
        {record.status === 'completed' && (
          <>
            <Button type="primary" icon={<CheckCircleOutlined />} loading={actionPending} size="small"
              style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 7 }}
              onClick={() => onAction(record.id, 'approve')}>
              Approve
            </Button>
            <Button danger icon={<CloseCircleOutlined />} loading={actionPending} size="small"
              onClick={() => onAction(record.id, 'reject')} style={{ borderRadius: 7 }}>
              Reject
            </Button>
          </>
        )}
        {record.status === 'rejected' && (
          <Button icon={<ReloadOutlined />} loading={actionPending} size="small"
            onClick={() => onAction(record.id, 'reopen')} style={{ borderRadius: 7 }}>
            Reopen as Draft
          </Button>
        )}
      </div>
    </Drawer>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const PerformanceManagement = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab,    setActiveTab]    = useState('appraisals');
  const [searchText,   setSearchText]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterCycle,  setFilterCycle]  = useState('');
  const [filterDept,   setFilterDept]   = useState('');
  const [cycleSearch,  setCycleSearch]  = useState('');
  const [cycleStatus,  setCycleStatus]  = useState('');

  const [selectedKeys, setSelectedKeys] = useState([]);
  const [detailRecord, setDetailRecord] = useState(null);

  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [editingCycle,   setEditingCycle]   = useState(null);
  const [cycleForm] = Form.useForm();

  const [apprModalOpen, setApprModalOpen] = useState(false);
  const [editingAppr,   setEditingAppr]   = useState(null);
  const [apprForm] = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────────
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
  const { data: summaryRaw, refetch: refetchSummary } = useQuery({
    queryKey: ['perf-summary'],
    queryFn: () => apiService.get('/api/v1/personnel/performance/summary'),
    staleTime: 60000,
  });
  const { data: personnelRaw } = useQuery({
    queryKey: ['personnel-list-perf'],
    queryFn: () => apiService.get('/api/v1/personnel/?limit=1000'),
    staleTime: 300000,
  });
  const { data: departmentsRaw } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.get('/api/v1/departments/'),
    staleTime: 120000,
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const cycles     = useMemo(() => { const r = cyclesRaw?.data || cyclesRaw || []; return Array.isArray(r) ? r : []; }, [cyclesRaw]);
  const appraisals = useMemo(() => { const r = appraisalsRaw?.data || appraisalsRaw || []; return Array.isArray(r) ? r : []; }, [appraisalsRaw]);
  const summary    = useMemo(() => summaryRaw?.data || summaryRaw || {}, [summaryRaw]);
  const personnel  = useMemo(() => { const r = personnelRaw?.results || personnelRaw?.data || personnelRaw || []; return Array.isArray(r) ? r : []; }, [personnelRaw]);
  const departments = useMemo(() => { const r = departmentsRaw?.results || departmentsRaw || []; return Array.isArray(r) ? r : []; }, [departmentsRaw]);

  const filteredCycles = useMemo(() => cycles.filter(c => {
    if (cycleStatus && c.status !== cycleStatus) return false;
    if (cycleSearch) {
      const q = cycleSearch.toLowerCase();
      return (c.cycle_name || '').toLowerCase().includes(q) || (c.cycle_code || '').toLowerCase().includes(q);
    }
    return true;
  }), [cycles, cycleStatus, cycleSearch]);

  const filteredAppraisals = useMemo(() => appraisals.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterRating && a.overall_rating !== filterRating) return false;
    if (filterType && a.personnel_type !== filterType) return false;
    if (filterCycle && String(a.cycle_id) !== String(filterCycle)) return false;
    if (filterDept && a.department_name !== filterDept) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (a.personnel_name || '').toLowerCase().includes(q)
          || (a.personnel_emp_code || '').toLowerCase().includes(q)
          || (a.cycle_name || '').toLowerCase().includes(q)
          || (a.department_name || '').toLowerCase().includes(q);
    }
    return true;
  }), [appraisals, filterStatus, filterRating, filterType, filterCycle, filterDept, searchText]);

  const invAll = useCallback(() => {
    ['perf-cycles', 'perf-appraisals', 'perf-summary'].forEach(k =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  }, [queryClient]);

  // Derived options
  const personnelOptions = useMemo(() =>
    personnel.map(p => ({
      value: p.id,
      label: `${(p.first_name || '')} ${(p.last_name || '')}`.trim()
        + (p.emp_code ? ` (${p.emp_code})` : '')
        + (p.personnel_type && p.personnel_type !== 'STAFF' ? ` [${p.personnel_type}]` : ''),
    })),
  [personnel]);
  const cycleOptions = useMemo(() => cycles.map(c => ({ value: c.id, label: `${c.cycle_code} — ${c.cycle_name}` })), [cycles]);
  const deptOptions  = useMemo(() => [...new Set(appraisals.map(a => a.department_name).filter(Boolean))].sort().map(d => ({ value: d, label: d })), [appraisals]);
  const pendingReview = useMemo(() => appraisals.filter(a => ['submitted', 'in_progress'].includes(a.status)).length, [appraisals]);
  const lowTraining   = useMemo(() => appraisals.filter(a => a.training_compliance != null && a.training_compliance < 70).length, [appraisals]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const cycleMut = useMutation({
    mutationFn: d => editingCycle
      ? apiService.put(`/api/v1/personnel/performance/cycles/${editingCycle.id}`, d)
      : apiService.post('/api/v1/personnel/performance/cycles', d),
    onSuccess: () => { message.success(editingCycle ? 'Cycle updated' : 'Cycle created'); setCycleModalOpen(false); setEditingCycle(null); invAll(); },
    onError: e => message.error(e?.response?.data?.detail || 'Failed'),
  });
  const delCycleMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/performance/cycles/${id}`),
    onSuccess: () => { message.success('Cycle deleted'); invAll(); },
    onError: e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const apprMut = useMutation({
    mutationFn: d => editingAppr
      ? apiService.put(`/api/v1/personnel/performance/appraisals/${editingAppr.id}`, d)
      : apiService.post('/api/v1/personnel/performance/appraisals', d),
    onSuccess: () => { message.success(editingAppr ? 'Appraisal updated' : 'Appraisal created'); setApprModalOpen(false); setEditingAppr(null); setDetailRecord(null); invAll(); },
    onError: e => message.error(e?.response?.data?.detail || 'Failed'),
  });
  const delApprMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/performance/appraisals/${id}`),
    onSuccess: () => { message.success('Deleted'); invAll(); },
    onError: e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action }) => apiService.put(`/api/v1/personnel/performance/appraisals/${id}/${action}`),
    onSuccess: (data, { action }) => {
      const msgs = { submit: 'Submitted for review', start: 'Review started', complete: 'Marked complete', approve: 'Appraisal approved', reject: 'Appraisal rejected', reopen: 'Reopened as draft' };
      message.success(msgs[action] || 'Updated');
      setDetailRecord(null);
      invAll();
    },
    onError: e => message.error(e?.response?.data?.detail || 'Action failed'),
  });

  // Bulk actions
  const bulkDelete = useCallback(async () => {
    const eligible = selectedKeys.filter(id => {
      const a = appraisals.find(x => x.id === id);
      return a && a.status !== 'approved';
    });
    try {
      await Promise.all(eligible.map(id => apiService.delete(`/api/v1/personnel/performance/appraisals/${id}`)));
      message.success(`${eligible.length} appraisal(s) deleted`);
      setSelectedKeys([]);
      invAll();
    } catch (e) { message.error('Bulk delete failed'); }
  }, [selectedKeys, appraisals, invAll]);

  const bulkSubmit = useCallback(async () => {
    const ids = selectedKeys.filter(id => appraisals.find(x => x.id === id)?.status === 'draft');
    const results = await Promise.allSettled(ids.map(id => apiService.put(`/api/v1/personnel/performance/appraisals/${id}/submit`)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    if (ok) message.success(`${ok} appraisal(s) submitted`);
    setSelectedKeys([]);
    invAll();
  }, [selectedKeys, appraisals, invAll]);

  const bulkApprove = useCallback(async () => {
    const ids = selectedKeys.filter(id => appraisals.find(x => x.id === id)?.status === 'completed');
    const results = await Promise.allSettled(ids.map(id => apiService.put(`/api/v1/personnel/performance/appraisals/${id}/approve`)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    if (ok) message.success(`${ok} appraisal(s) approved`);
    setSelectedKeys([]);
    invAll();
  }, [selectedKeys, appraisals, invAll]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const openAddCycle = () => {
    setEditingCycle(null); setCycleModalOpen(true);
    setTimeout(() => { cycleForm.resetFields(); cycleForm.setFieldsValue({ status: 'open' }); }, 0);
  };
  const openEditCycle = r => {
    setEditingCycle(r); setCycleModalOpen(true);
    setTimeout(() => cycleForm.setFieldsValue({
      ...r,
      start_date: r.start_date ? dayjs(r.start_date) : null,
      end_date: r.end_date ? dayjs(r.end_date) : null,
    }), 0);
  };
  const submitCycle = () =>
    cycleForm.validateFields().then(v =>
      cycleMut.mutate({ ...v, start_date: v.start_date?.format('YYYY-MM-DD'), end_date: v.end_date?.format('YYYY-MM-DD') })
    ).catch(() => {});

  const openAddAppr = (prefill = {}) => {
    setEditingAppr(null); setApprModalOpen(true);
    setTimeout(() => { apprForm.resetFields(); apprForm.setFieldsValue({ status: 'draft', appraisal_date: dayjs(), ...prefill }); }, 0);
  };
  const openEditAppr = r => {
    setEditingAppr(r); setApprModalOpen(true);
    setTimeout(() => apprForm.setFieldsValue({ ...r, appraisal_date: r.appraisal_date ? dayjs(r.appraisal_date) : null }), 0);
  };
  const submitAppr = () =>
    apprForm.validateFields().then(v =>
      apprMut.mutate({ ...v, appraisal_date: v.appraisal_date?.format('YYYY-MM-DD') })
    ).catch(() => {});

  const clearFilters = () => {
    setFilterStatus(''); setFilterRating(''); setFilterType('');
    setFilterCycle(''); setFilterDept(''); setSearchText('');
  };
  const hasFilters = filterStatus || filterRating || filterType || filterCycle || filterDept || searchText;

  // ── Export CSV ────────────────────────────────────────────────────────────────
  const apprExportCols = [
    { title: 'Employee',    exportValue: r => r.personnel_name || '' },
    { title: 'Emp Code',    exportValue: r => r.personnel_emp_code || '' },
    { title: 'Type',        exportValue: r => r.personnel_type || '' },
    { title: 'Department',  exportValue: r => r.department_name || '' },
    { title: 'Cycle',       exportValue: r => r.cycle_name || '' },
    { title: 'Cycle Code',  exportValue: r => r.cycle_code || '' },
    { title: 'Date',        exportValue: r => r.appraisal_date || '' },
    { title: 'Status',      exportValue: r => r.status || '' },
    { title: 'Rating',      exportValue: r => r.overall_rating || '' },
    { title: 'Score (%)',   exportValue: r => r.performance_score ?? '' },
    { title: 'Goals (%)',   exportValue: r => r.goals_achieved ?? '' },
    { title: 'Training %',  exportValue: r => r.training_compliance ?? '' },
    { title: 'Strengths',   exportValue: r => r.strengths || '' },
    { title: 'Improvements', exportValue: r => r.areas_for_improvement || '' },
    { title: 'Comments',    exportValue: r => r.comments || '' },
    { title: 'Reviewer',    exportValue: r => r.reviewer_name || '' },
  ];

  // ── Row selection ─────────────────────────────────────────────────────────────
  const rowSelection = {
    selectedRowKeys: selectedKeys,
    onChange: setSelectedKeys,
    getCheckboxProps: r => ({
      disabled: r.status === 'approved',
      title: r.status === 'approved' ? 'Approved appraisals cannot be modified' : '',
    }),
  };

  // ── Table columns ─────────────────────────────────────────────────────────────
  const apprColumns = [
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
          />
        </div>
      ),
    },
    {
      title: 'Cycle', key: 'cycle', width: 170,
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{r.cycle_name || `Cycle ${r.cycle_id}`}</div>
          <span style={{
            fontFamily: 'monospace', fontSize: 9, color: '#94a3b8',
            background: '#f1f5f9', borderRadius: 4, padding: '1px 5px',
          }}>
            {r.cycle_code}
          </span>
          {r.appraisal_date && (
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
              {dayjs(r.appraisal_date).format('DD MMM YYYY')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Scores', key: 'scores', width: 160,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {r.performance_score != null && <ScoreBar score={r.performance_score} label="Score" />}
          {r.goals_achieved != null && <ScoreBar score={r.goals_achieved} label="Goals" />}
          {r.performance_score == null && r.goals_achieved == null && (
            <span style={{ color: '#d1d5db', fontSize: 11 }}>No scores yet</span>
          )}
        </div>
      ),
    },
    {
      title: 'Rating', key: 'rating', width: 150,
      sorter: (a, b) => {
        const order = ['excellent', 'very_good', 'good', 'satisfactory', 'needs_improvement', 'poor'];
        return (order.indexOf(a.overall_rating) || 99) - (order.indexOf(b.overall_rating) || 99);
      },
      render: (_, r) => <RatingBadge rating={r.overall_rating} />,
    },
    {
      title: 'Training', key: 'training', width: 110,
      render: (_, r) => <TrainingCell pct={r.training_compliance} expired={r.expired_certs || 0} />,
    },
    {
      title: 'Status', key: 'status', width: 120,
      render: (_, r) => <StatusPill status={r.status} />,
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 160,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.status === 'draft' && (
            <Tooltip title="Submit for Review">
              <Button size="small" type="primary" icon={<SendOutlined />}
                onClick={() => actionMut.mutate({ id: r.id, action: 'submit' })}
                style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          {r.status === 'submitted' && (
            <Tooltip title="Start Review">
              <Button size="small" icon={<PlayCircleOutlined />}
                onClick={() => actionMut.mutate({ id: r.id, action: 'start' })}
                style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          {r.status === 'in_progress' && (
            <Tooltip title="Mark Complete">
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                onClick={() => actionMut.mutate({ id: r.id, action: 'complete' })}
                style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          {r.status === 'completed' && (
            <>
              <Tooltip title="Approve">
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 6 }}
                  onClick={() => actionMut.mutate({ id: r.id, action: 'approve' })} />
              </Tooltip>
              <Tooltip title="Reject">
                <Button size="small" danger icon={<CloseCircleOutlined />}
                  onClick={() => actionMut.mutate({ id: r.id, action: 'reject' })}
                  style={{ borderRadius: 6 }} />
              </Tooltip>
            </>
          )}
          {r.status === 'rejected' && (
            <Tooltip title="Reopen as Draft">
              <Button size="small" icon={<ReloadOutlined />}
                onClick={() => actionMut.mutate({ id: r.id, action: 'reopen' })}
                style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditAppr(r)} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Tooltip title="Detail">
            <Button size="small" icon={<MoreOutlined />} onClick={() => setDetailRecord(r)} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Popconfirm title="Delete appraisal?" onConfirm={() => delApprMut.mutate(r.id)} okButtonProps={{ danger: true }}
            disabled={r.status === 'approved'}>
            <Tooltip title={r.status === 'approved' ? 'Cannot delete approved' : 'Delete'}>
              <Button danger size="small" icon={<DeleteOutlined />} disabled={r.status === 'approved'} style={{ borderRadius: 6 }} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Expandable rows — shows strengths / areas / comments
  const expandedRowRender = (r) => (
    <div style={{ padding: '8px 16px 8px 48px', background: '#fafafa' }}>
      <Row gutter={24}>
        {r.strengths && (
          <Col xs={24} md={8}>
            <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Strengths</Text>
            <Text style={{ fontSize: 11, color: '#374151' }}>{r.strengths}</Text>
          </Col>
        )}
        {r.areas_for_improvement && (
          <Col xs={24} md={8}>
            <Text style={{ fontSize: 10, color: '#d97706', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Areas for Improvement</Text>
            <Text style={{ fontSize: 11, color: '#374151' }}>{r.areas_for_improvement}</Text>
          </Col>
        )}
        {r.comments && (
          <Col xs={24} md={8}>
            <Text style={{ fontSize: 10, color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Comments</Text>
            <Text style={{ fontSize: 11, color: '#374151' }}>{r.comments}</Text>
          </Col>
        )}
        {!r.strengths && !r.areas_for_improvement && !r.comments && (
          <Col><Text type="secondary" style={{ fontSize: 11 }}>No narrative recorded</Text></Col>
        )}
      </Row>
    </div>
  );
  const rowExpandable = r => !!(r.strengths || r.areas_for_improvement || r.comments);

  const containerStyle = {
    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
  };
  const paginationProps = {
    pageSize: 20, showSizeChanger: true, showQuickJumper: true,
    showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`,
    style: { padding: '12px 16px', margin: 0 },
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Performance Management</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                Appraisal cycles, performance reviews, ratings and training compliance
              </div>
            </div>
            <Space size="middle" style={{ overflow: 'visible' }}>
              <Badge count={pendingReview} showZero color="#d97706">
                <ExclamationCircleOutlined style={{ fontSize: 16 }} />
              </Badge>
              <Badge count={lowTraining} showZero color="#dc2626">
                <WarningOutlined style={{ fontSize: 16 }} />
              </Badge>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddAppr()} size="small" style={{ fontWeight: 600 }}>
                New Appraisal
              </Button>
            </Space>
          </div>
        }
        styles={{ header: { overflow: 'visible' } }}
      >

      {/* Stat cards — from /summary (unfiltered) */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Appraisals', value: summary.total ?? appraisals.length,                    color: '#2563eb', bg: '#eff6ff', icon: <FileProtectOutlined /> },
          { label: 'Open Cycles',      value: summary.open_cycles ?? 0,                               color: '#16a34a', bg: '#f0fdf4', icon: <CalendarOutlined />   },
          { label: 'Pending Review',   value: pendingReview,                                           color: '#d97706', bg: '#fffbeb', icon: <ExclamationCircleOutlined /> },
          { label: 'Avg Score',        value: summary.avg_score != null ? `${summary.avg_score}%` : '—', color: '#7c3aed', bg: '#ede9fe', icon: <TrophyOutlined />  },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
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
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Alerts */}
      {pendingReview > 0 && (
        <Alert type="warning" showIcon closable style={{ marginBottom: 10, borderRadius: 8 }}
          message={`${pendingReview} appraisal(s) need review action (submitted or in progress)`} />
      )}
      {lowTraining > 0 && (
        <Alert type="error" showIcon closable style={{ marginBottom: 10, borderRadius: 8 }}
          message={`${lowTraining} personnel have training compliance below 70%`}
          description="Check Training Management for expired mandatory certifications."
        />
      )}

      {/* Tabs */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding: '0 16px' }}
          items={[

            // ── APPRAISALS ─────────────────────────────────────────────────────
            {
              key: 'appraisals',
              label: (
                <span>
                  <FileProtectOutlined /> Appraisals
                  {pendingReview > 0 && <Badge count={pendingReview} size="small" style={{ marginLeft: 6 }} />}
                </span>
              ),
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  {/* Filter bar */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                    <Input
                      placeholder="Search person, cycle…"
                      prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
                      value={searchText} onChange={e => setSearchText(e.target.value)} allowClear
                      style={{ flex: '1 1 180px', maxWidth: 220, borderRadius: 8 }}
                    />
                    <FilterOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                    <Select placeholder="Cycle" allowClear style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={filterCycle || undefined} onChange={v => setFilterCycle(v || '')}
                      options={cycleOptions} />
                    <Select placeholder="Status" allowClear style={{ flex: '1 1 120px', minWidth: 120 }}
                      value={filterStatus || undefined} onChange={v => setFilterStatus(v || '')}
                      options={STATUSES.map(s => ({ value: s, label: <StatusPill status={s} /> }))} />
                    <Select placeholder="Rating" allowClear style={{ flex: '1 1 130px', minWidth: 130 }}
                      value={filterRating || undefined} onChange={v => setFilterRating(v || '')}
                      options={RATINGS.map(r => ({ value: r, label: <RatingBadge rating={r} showStars={false} /> }))} />
                    <Select placeholder="Type" allowClear style={{ flex: '1 1 110px', minWidth: 110 }}
                      value={filterType || undefined} onChange={v => setFilterType(v || '')}
                      options={['STAFF', 'CONTRACTOR', 'VISITOR'].map(t => ({ value: t, label: t }))} />
                    <Select placeholder="Department" allowClear showSearch optionFilterProp="label"
                      style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={filterDept || undefined} onChange={v => setFilterDept(v || '')}
                      options={deptOptions} />
                    {hasFilters && (
                      <Button size="small" style={{ borderRadius: 6 }} onClick={clearFilters}>Clear</Button>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Tooltip title="Export CSV">
                        <Button icon={<DownloadOutlined />}
                          onClick={() => exportCSV(apprExportCols, filteredAppraisals, `appraisals-${dayjs().format('YYYY-MM-DD')}.csv`)}
                          style={{ borderRadius: 8 }} />
                      </Tooltip>
                      <Button icon={<ReloadOutlined />} onClick={refetchAppr} style={{ borderRadius: 8 }} />
                    </div>
                  </div>

                  {/* Active filter pills */}
                  {hasFilters && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {filterStatus && <Tag closable onClose={() => setFilterStatus('')} color="blue">{STATUS_CFG[filterStatus]?.label}</Tag>}
                      {filterRating && <Tag closable onClose={() => setFilterRating('')} color="purple">{label(filterRating)}</Tag>}
                      {filterType && <Tag closable onClose={() => setFilterType('')}>{filterType}</Tag>}
                      {filterCycle && <Tag closable onClose={() => setFilterCycle('')} icon={<CalendarOutlined />}>{cycles.find(c => c.id === filterCycle)?.cycle_code}</Tag>}
                      {filterDept && <Tag closable onClose={() => setFilterDept('')} icon={<TeamOutlined />}>{filterDept}</Tag>}
                      {searchText && <Tag closable onClose={() => setSearchText('')} icon={<SearchOutlined />}>"{searchText}"</Tag>}
                    </div>
                  )}

                  {/* Bulk bar */}
                  <BulkBar
                    count={selectedKeys.length}
                    onClear={() => setSelectedKeys([])}
                    onDelete={bulkDelete}
                    onSubmit={bulkSubmit}
                    onApprove={bulkApprove}
                  />

                  <div style={containerStyle}>
                    <Table
                      columns={apprColumns}
                      dataSource={filteredAppraisals}
                      loading={apprLoading}
                      rowKey="id"
                      size="middle"
                      scroll={{ x: 1200 }}
                      rowSelection={rowSelection}
                      pagination={paginationProps}
                      expandable={{ expandedRowRender, rowExpandable }}
                      rowClassName={r => r.training_compliance != null && r.training_compliance < 70 ? 'row-low-training' : ''}
                      onRow={r => ({
                        onMouseEnter: e => { e.currentTarget.style.background = '#f8fafc'; },
                        onMouseLeave: e => { e.currentTarget.style.background = ''; },
                      })}
                    />
                  </div>
                </div>
              ),
            },

            // ── CYCLES ────────────────────────────────────────────────────────
            {
              key: 'cycles',
              label: <span><CalendarOutlined /> Appraisal Cycles</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                    <Input
                      placeholder="Search name or code…"
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      value={cycleSearch} onChange={e => setCycleSearch(e.target.value)} allowClear
                      style={{ flex: '1 1 200px', maxWidth: 260, borderRadius: 8 }}
                    />
                    <Select placeholder="Status" allowClear style={{ width: 130 }}
                      value={cycleStatus || undefined} onChange={v => setCycleStatus(v || '')}
                      options={CYCLE_STATUSES.map(s => ({ value: s, label: <CycleStatusPill status={s} /> }))} />
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={openAddCycle} style={{ borderRadius: 8 }}>New Cycle</Button>
                      <Button icon={<ReloadOutlined />} onClick={refetchCycles} style={{ borderRadius: 8 }} />
                    </div>
                  </div>
                  {cyclesLoading ? (
                    <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
                  ) : filteredCycles.length === 0 ? (
                    <Empty description="No cycles found" />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {filteredCycles.map(c => (
                        <Col key={c.id} xs={24} sm={12} xl={8}>
                          <CycleCard
                            cycle={c}
                            onEdit={openEditCycle}
                            onDelete={id => delCycleMut.mutate(id)}
                            onAddAppraisal={cycle => openAddAppr({ cycle_id: cycle.id })}
                          />
                        </Col>
                      ))}
                    </Row>
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
                  <AnalyticsTab summary={summary} appraisals={appraisals} cycles={cycles} />
                </div>
              ),
            },

          ]}
        />
      </div>

      {/* ── Cycle Modal ──────────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingCycle ? 'Edit Appraisal Cycle' : 'New Appraisal Cycle'}
          </Space>
        }
        open={cycleModalOpen}
        onOk={submitCycle}
        onCancel={() => { setCycleModalOpen(false); setEditingCycle(null); }}
        confirmLoading={cycleMut.isPending}
        width={600} forceRender
      >
        <Form form={cycleForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="cycle_code" label="Cycle Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. Q1-2026" maxLength={20} disabled={!!editingCycle} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="cycle_name" label="Cycle Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Q1 2026 Offshore Review" maxLength={100} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_date" label="Start Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_date" label="End Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select options={CYCLE_STATUSES.map(s => ({ value: s, label: <CycleStatusPill status={s} /> }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Appraisal Modal ──────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileProtectOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingAppr ? 'Edit Appraisal' : 'New Performance Appraisal'}
          </Space>
        }
        open={apprModalOpen}
        onOk={submitAppr}
        onCancel={() => { setApprModalOpen(false); setEditingAppr(null); }}
        confirmLoading={apprMut.isPending}
        width={720} forceRender
      >
        <Form form={apprForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Personnel" rules={[{ required: true }]}>
                <Select showSearch placeholder="Select person" options={personnelOptions} disabled={!!editingAppr}
                  filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cycle_id" label="Appraisal Cycle" rules={[{ required: true }]}>
                <Select showSearch placeholder="Select cycle" options={cycleOptions} disabled={!!editingAppr}
                  filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="appraisal_date" label="Appraisal Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select options={STATUSES.map(s => ({ value: s, label: <StatusPill status={s} /> }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="overall_rating" label="Overall Rating">
                <Select allowClear placeholder="Select rating"
                  options={RATINGS.map(r => ({ value: r, label: <RatingBadge rating={r} showStars={false} /> }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="performance_score" label="Performance Score (0–100)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="Overall performance score" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="goals_achieved" label="Goals Achieved (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="% of set goals achieved" />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '8px 0' }} />
          <Form.Item name="strengths" label="Strengths">
            <Input.TextArea rows={2} placeholder="Key strengths observed" maxLength={1000} showCount />
          </Form.Item>
          <Form.Item name="areas_for_improvement" label="Areas for Improvement / Training Needs">
            <Input.TextArea rows={2} placeholder="Skill gaps or mandatory training renewals needed" maxLength={1000} showCount />
          </Form.Item>
          <Form.Item name="comments" label="Reviewer Comments">
            <Input.TextArea rows={2} placeholder="Additional notes from reviewer" maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Appraisal Detail Drawer ──────────────────────────────────────────── */}
      <AppraisalDrawer
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        onAction={(id, action) => actionMut.mutate({ id, action })}
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
        .row-low-training { background: rgba(220,38,38,0.03) !important; }
        .row-low-training:hover > td { background: rgba(220,38,38,0.06) !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default PerformanceManagement;
