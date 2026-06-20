import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Row, Col,
  Tag, Popconfirm, DatePicker, TimePicker, InputNumber, Tabs,
  Tooltip, App, Switch, Avatar, Typography, Drawer, Badge, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SettingOutlined, StopOutlined, ExclamationCircleOutlined,
  DownloadOutlined, SearchOutlined, FilterOutlined, ApartmentOutlined,
  TeamOutlined, BarChartOutlined, CloseOutlined, MoreOutlined,
  CalendarOutlined, DollarOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Text } = Typography;

// ── Constants ──────────────────────────────────────────────────────────────────
const OT_TYPES    = ['daily', 'weekly', 'weekend', 'holiday', 'special'];
const OT_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'processed'];
const COMP_TYPES  = ['pay', 'time_off', 'mixed'];

const STATUS_CFG = {
  pending:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Pending'   },
  approved:  { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Approved'  },
  rejected:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Rejected'  },
  cancelled: { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Cancelled' },
  processed: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Processed' },
};

const TYPE_CFG = {
  daily:   { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  weekly:  { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' },
  weekend: { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  holiday: { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa' },
  special: { color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
};

const COMP_CFG = {
  pay:      { color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', label: 'Pay'       },
  time_off: { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', label: 'Time Off'  },
  mixed:    { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', label: 'Mixed'     },
};

const PERS_TYPE_CFG = {
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
const lbl         = s => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fmtHrs      = h => h != null ? `${Number(h).toFixed(2)}h` : '—';

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

// ── Pills ──────────────────────────────────────────────────────────────────────
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

const TypePill = ({ type }) => {
  if (!type) return null;
  const cfg = TYPE_CFG[type] || { color: '#64748b', bg: '#f3f4f6', border: '#e5e7eb' };
  return (
    <span style={{
      display: 'inline-block', background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 700,
    }}>
      {lbl(type)}
    </span>
  );
};

const CompPill = ({ type }) => {
  if (!type) return null;
  const cfg = COMP_CFG[type] || { color: '#64748b', bg: '#f3f4f6', border: '#e5e7eb', label: lbl(type) };
  return (
    <span style={{
      display: 'inline-block', background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 6, padding: '1px 8px', fontSize: 10, fontWeight: 700,
    }}>
      {cfg.label}
    </span>
  );
};

// ── Employee cell ──────────────────────────────────────────────────────────────
const EmployeeCell = ({ name, empCode, type, department, onClick }) => {
  const typeCfg = PERS_TYPE_CFG[type] || PERS_TYPE_CFG.STAFF;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
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
const BulkBar = ({ count, onClear, onApproveAll, onDelete, approvePending, deletePending }) =>
  count > 0 ? (
    <div style={{
      background: '#d97706', borderRadius: 10, padding: '10px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 12px rgba(217,119,6,0.3)',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
        {count} request{count !== 1 ? 's' : ''} selected
      </span>
      <div style={{ flex: 1 }} />
      {onApproveAll && (
        <Button size="small" icon={<CheckCircleOutlined />} loading={approvePending}
          onClick={onApproveAll}
          style={{ borderRadius: 6, background: '#16a34a', border: 'none', color: '#fff' }}>
          Approve All
        </Button>
      )}
      <Popconfirm title={`Delete ${count} request(s)?`} description="Cannot delete approved records."
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

// ── Request detail drawer ──────────────────────────────────────────────────────
const RequestDrawer = ({ record, onClose, onApprove, onReject, onCancel, onEdit, loading }) => {
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
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{lbl(record.overtime_type)} — {record.date}</div>
          </div>
        </div>
      }
      open={!!record} onClose={onClose} width={400}
      bodyStyle={{ padding: 20 }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatusPill status={record.status} />
        <TypePill type={record.overtime_type} />
        {record.compensation_type && <CompPill type={record.compensation_type} />}
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        <Row gutter={12}>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Date</Text>
            <Text style={{ fontSize: 12, fontWeight: 600 }}>{record.date ? dayjs(record.date).format('DD MMM YYYY') : '—'}</Text>
          </Col>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>OT Hours</Text>
            <Text style={{ fontSize: 16, fontWeight: 800, color: '#d97706' }}>{fmtHrs(record.overtime_hours)}</Text>
          </Col>
        </Row>
        <Row gutter={12} style={{ marginTop: 10 }}>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Start → End</Text>
            <Text style={{ fontSize: 11 }}>
              {record.start_time ? String(record.start_time).slice(0, 5) : '—'} → {record.end_time ? String(record.end_time).slice(0, 5) : '—'}
            </Text>
          </Col>
          <Col span={12}>
            <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>Hours Worked</Text>
            <Text style={{ fontSize: 11 }}>{fmtHrs(record.hours_worked)}</Text>
          </Col>
        </Row>
      </div>

      {record.department_name && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <ApartmentOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
          <Text style={{ fontSize: 12 }}>{record.department_name}</Text>
        </div>
      )}

      {record.reason && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <Text style={{ fontSize: 9, color: '#92400e', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 4 }}>Reason</Text>
          <Text style={{ fontSize: 12, color: '#374151' }}>{record.reason}</Text>
        </div>
      )}

      {record.rejection_reason && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <Text style={{ fontSize: 9, color: '#991b1b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 4 }}>Rejection Reason</Text>
          <Text style={{ fontSize: 12, color: '#374151' }}>{record.rejection_reason}</Text>
        </div>
      )}

      <Divider style={{ margin: '14px 0 10px' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {record.status === 'pending' && (
          <>
            <Button type="primary" icon={<CheckCircleOutlined />} size="small" loading={loading}
              onClick={() => onApprove(record.id)}
              style={{ borderRadius: 7, background: '#16a34a', borderColor: '#16a34a' }}>
              Approve
            </Button>
            <Button danger icon={<CloseCircleOutlined />} size="small" loading={loading}
              onClick={() => { onClose(); onReject(record.id); }} style={{ borderRadius: 7 }}>
              Reject
            </Button>
          </>
        )}
        {record.status === 'approved' && (
          <Button icon={<StopOutlined />} size="small" loading={loading}
            onClick={() => onCancel(record.id)} style={{ borderRadius: 7 }}>
            Cancel
          </Button>
        )}
        {record.status === 'pending' && (
          <Button icon={<EditOutlined />} size="small" onClick={() => { onClose(); onEdit(record); }} style={{ borderRadius: 7 }}>
            Edit
          </Button>
        )}
      </div>
    </Drawer>
  );
};

// ── Analytics tab ──────────────────────────────────────────────────────────────
const AnalyticsTab = ({ overtime, summary }) => {
  const { statusDist, typeDist, compDist, monthlyTrend, deptDist, topEmployees } = useMemo(() => {
    const sCounts = {}, tCounts = {}, cCounts = {}, dCounts = {}, empHours = {};

    overtime.forEach(r => {
      sCounts[r.status] = (sCounts[r.status] || 0) + 1;
      if (r.overtime_type) tCounts[r.overtime_type] = (tCounts[r.overtime_type] || 0) + 1;
      const ct = r.compensation_type || 'unspecified';
      cCounts[ct] = (cCounts[ct] || 0) + 1;
      const dept = r.department_name || 'No Dept';
      if (!dCounts[dept]) dCounts[dept] = { total: 0, hours: 0 };
      dCounts[dept].total++;
      if (r.overtime_hours) dCounts[dept].hours += Number(r.overtime_hours);
      if (r.status === 'approved' && r.overtime_hours) {
        const key = r.personnel_name || `ID ${r.personnel_id}`;
        if (!empHours[key]) empHours[key] = 0;
        empHours[key] += Number(r.overtime_hours);
      }
    });

    const statusDist = Object.entries(sCounts).map(([k, v]) => ({
      name: STATUS_CFG[k]?.label || lbl(k), value: v, fill: STATUS_CFG[k]?.color || '#94a3b8',
    })).filter(d => d.value > 0);
    const typeDist = Object.entries(tCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
      name: lbl(k), count: v, fill: TYPE_CFG[k]?.color || '#94a3b8',
    }));
    const compDist = Object.entries(cCounts).map(([k, v]) => ({
      name: COMP_CFG[k]?.label || lbl(k), value: v, fill: COMP_CFG[k]?.color || '#94a3b8',
    })).filter(d => d.value > 0);
    const monthlyTrend = (summary?.monthly_trend || []).map(m => ({ ...m, name: m.month?.slice(5) || m.month }));
    const deptDist = Object.entries(dCounts).sort((a, b) => b[1].total - a[1].total).slice(0, 12)
      .map(([dept, d]) => ({ name: dept.length > 18 ? dept.slice(0, 16) + '…' : dept, total: d.total, hours: Math.round(d.hours * 10) / 10 }));
    const topEmployees = Object.entries(empHours).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, h]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, hours: Math.round(h * 10) / 10 }));

    return { statusDist, typeDist, compDist, monthlyTrend, deptDist, topEmployees };
  }, [overtime, summary]);

  if (overtime.length === 0) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <BarChartOutlined style={{ fontSize: 40, color: '#cbd5e1' }} />
      <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>No overtime data to visualize</div>
    </div>
  );

  const card = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16 };
  const sTitle = t => <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t}</div>;
  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.08) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <Row gutter={[12, 12]}>
        {[
          { label: 'Total Requests',    value: summary.total    ?? overtime.length,              color: '#2563eb', bg: '#eff6ff', icon: <ClockCircleOutlined /> },
          { label: 'Pending Approval',  value: summary.pending  ?? 0,                            color: '#d97706', bg: '#fffbeb', icon: <ExclamationCircleOutlined /> },
          { label: 'Approved Hours',    value: summary.approved_hours != null ? `${Number(summary.approved_hours).toFixed(1)}h` : '—', color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircleOutlined /> },
          { label: 'Total OT Hours',    value: summary.total_overtime_hours != null ? `${Number(summary.total_overtime_hours).toFixed(1)}h` : '—', color: '#7c3aed', bg: '#ede9fe', icon: <TeamOutlined /> },
        ].map(k => (
          <Col xs={12} sm={6} key={k.label}>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
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
        {/* Monthly trend */}
        {monthlyTrend.length > 0 && (
          <Col xs={24} md={14}>
            <div style={card}>
              {sTitle('Monthly Requests (12 months)')}
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyTrend} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Requests']} />
                  <Line type="monotone" dataKey="count" stroke="#d97706" strokeWidth={2.5} dot={{ fill: '#d97706', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}

        {/* Status donut */}
        <Col xs={24} md={10}>
          <div style={card}>
            {sTitle('Status Distribution')}
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
          </div>
        </Col>

        {/* By OT type */}
        {typeDist.length > 0 && (
          <Col xs={24} md={12}>
            <div style={card}>
              {sTitle('Requests by Overtime Type')}
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={typeDist} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [v, 'Requests']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {typeDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}

        {/* Compensation type */}
        {compDist.length > 0 && (
          <Col xs={24} md={12}>
            <div style={card}>
              {sTitle('Compensation Type Split')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ResponsiveContainer width="55%" height={140}>
                  <PieChart>
                    <Pie data={compDist} dataKey="value" cx="50%" cy="50%" outerRadius={60} labelLine={false} label={CustomPieLabel}>
                      {compDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {compDist.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                        <Text style={{ fontSize: 11, color: '#374151' }}>{d.name}</Text>
                      </div>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{d.value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Col>
        )}

        {/* Top employees by approved OT hours */}
        {topEmployees.length > 0 && (
          <Col xs={24} md={14}>
            <div style={card}>
              {sTitle('Top 10 by Approved OT Hours')}
              <ResponsiveContainer width="100%" height={Math.max(180, topEmployees.length * 30)}>
                <BarChart data={topEmployees} layout="vertical" margin={{ left: 4, right: 36 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} unit="h" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={110} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [`${v}h`, 'Approved OT']} />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]} fill="#d97706" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>
        )}

        {/* Dept OT hours */}
        {deptDist.length > 0 && (
          <Col xs={24} md={10}>
            <div style={card}>
              {sTitle('OT Hours by Department')}
              <ResponsiveContainer width="100%" height={Math.max(180, deptDist.length * 30)}>
                <BarChart data={deptDist} layout="vertical" margin={{ left: 4, right: 36 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} unit="h" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={90} />
                  <RTooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} formatter={v => [`${v}h`, 'OT Hours']} />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]} fill="#7c3aed" />
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
const OvertimeManagement = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('requests');

  // Filters
  const [searchQ,       setSearchQ]       = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [filterComp,    setFilterComp]    = useState('');
  const [filterDept,    setFilterDept]    = useState('');

  // Selection
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedRuleKeys, setSelectedRuleKeys] = useState([]);

  // Detail drawer
  const [detailRecord, setDetailRecord] = useState(null);

  // Request modal
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [editingRecord,    setEditingRecord]    = useState(null);
  const [requestForm] = Form.useForm();

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId,     setRejectingId]     = useState(null);
  const [rejectForm] = Form.useForm();

  // Rule modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule,   setEditingRule]   = useState(null);
  const [ruleForm] = Form.useForm();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: overtimeRaw, isLoading: overtimeLoading, refetch: refetchOvertime } = useQuery({
    queryKey: ['overtime-requests'],
    queryFn:  () => apiService.get('/api/v1/personnel/overtime'),
    staleTime: 30000,
  });
  const { data: rulesRaw, isLoading: rulesLoading, refetch: refetchRules } = useQuery({
    queryKey: ['overtime-rules'],
    queryFn:  () => apiService.get('/api/v1/personnel/overtime/rules'),
    staleTime: 60000,
  });
  const { data: personnelRaw } = useQuery({
    queryKey: ['personnel-list-ot'],
    queryFn:  () => apiService.get('/api/v1/personnel/?limit=1000'),
    staleTime: 300000,
  });
  const { data: summaryRaw } = useQuery({
    queryKey: ['overtime-summary'],
    queryFn:  () => apiService.get('/api/v1/personnel/overtime/summary'),
    staleTime: 60000,
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const overtime    = useMemo(() => { const r = overtimeRaw?.data || overtimeRaw || []; return Array.isArray(r) ? r : []; }, [overtimeRaw]);
  const rules       = useMemo(() => { const r = rulesRaw?.data    || rulesRaw    || []; return Array.isArray(r) ? r : []; }, [rulesRaw]);
  const personnel   = useMemo(() => { const r = personnelRaw?.results || personnelRaw?.data || personnelRaw || []; return Array.isArray(r) ? r : []; }, [personnelRaw]);
  const summary     = useMemo(() => summaryRaw?.data || summaryRaw || {}, [summaryRaw]);

  const inv         = useCallback((...keys) => keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] })), [queryClient]);
  const invOT       = useCallback(() => inv('overtime-requests', 'overtime-summary'), [inv]);

  const deptOptions = useMemo(() =>
    [...new Set(overtime.map(r => r.department_name).filter(Boolean))].sort().map(d => ({ value: d, label: d })),
  [overtime]);

  const filteredOvertime = useMemo(() => overtime.filter(r => {
    if (filterStatus && r.status !== filterStatus)         return false;
    if (filterType   && r.overtime_type !== filterType)    return false;
    if (filterComp   && r.compensation_type !== filterComp) return false;
    if (filterDept   && r.department_name !== filterDept)  return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return (r.personnel_name     || '').toLowerCase().includes(q)
          || (r.personnel_emp_code || '').toLowerCase().includes(q)
          || (r.department_name    || '').toLowerCase().includes(q);
    }
    return true;
  }), [overtime, filterStatus, filterType, filterComp, filterDept, searchQ]);

  const pendingCount = useMemo(() => overtime.filter(r => r.status === 'pending').length, [overtime]);
  const hasFilters   = searchQ || filterStatus || filterType || filterComp || filterDept;

  const personnelOptions = useMemo(() =>
    personnel.map(p => ({
      value: p.id,
      label: `${(p.first_name || '')} ${(p.last_name || '')}`.trim() + (p.emp_code ? ` (${p.emp_code})` : ''),
    })),
  [personnel]);

  // ── Auto-calculate hours on time change ──────────────────────────────────────
  const onTimesChange = useCallback(() => {
    setTimeout(() => {
      const start = requestForm.getFieldValue('start_time');
      const end   = requestForm.getFieldValue('end_time');
      if (start && end) {
        const diff = end.diff(start, 'minute');
        if (diff > 0) requestForm.setFieldsValue({ hours_worked: Math.round((diff / 60) * 100) / 100 });
      }
    }, 0);
  }, [requestForm]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const requestMut = useMutation({
    mutationFn: d => editingRecord
      ? apiService.put(`/api/v1/personnel/overtime/${editingRecord.id}`, d)
      : apiService.post('/api/v1/personnel/overtime', d),
    onSuccess: () => { message.success(editingRecord ? 'Updated' : 'Request submitted'); setRequestModalOpen(false); setEditingRecord(null); invOT(); },
    onError: e => message.error(e?.response?.data?.detail || 'Failed'),
  });
  const approveMut = useMutation({
    mutationFn: id => apiService.put(`/api/v1/personnel/overtime/${id}/approve`),
    onSuccess: () => { message.success('Approved'); invOT(); },
    onError: e => message.error(e?.response?.data?.detail || 'Approval failed'),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, rejection_reason }) => apiService.put(`/api/v1/personnel/overtime/${id}/reject`, { rejection_reason }),
    onSuccess: () => { message.success('Rejected'); setRejectModalOpen(false); setRejectingId(null); rejectForm.resetFields(); invOT(); },
    onError: e => message.error(e?.response?.data?.detail || 'Rejection failed'),
  });
  const cancelMut = useMutation({
    mutationFn: id => apiService.put(`/api/v1/personnel/overtime/${id}/cancel`),
    onSuccess: () => { message.success('Cancelled'); invOT(); },
    onError: e => message.error(e?.response?.data?.detail || 'Cancel failed'),
  });
  const deleteMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/overtime/${id}`),
    onSuccess: () => { message.success('Deleted'); invOT(); },
    onError: e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });
  const ruleMut = useMutation({
    mutationFn: d => editingRule
      ? apiService.put(`/api/v1/personnel/overtime/rules/${editingRule.id}`, d)
      : apiService.post('/api/v1/personnel/overtime/rules', d),
    onSuccess: () => { message.success(editingRule ? 'Rule updated' : 'Rule created'); setRuleModalOpen(false); setEditingRule(null); inv('overtime-rules'); },
    onError: e => message.error(e?.response?.data?.detail || 'Failed'),
  });
  const delRuleMut = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/overtime/rules/${id}`),
    onSuccess: () => { message.success('Rule deleted'); inv('overtime-rules'); },
    onError: e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });

  const bulkApprove = useCallback(async () => {
    const pendingIds = selectedKeys.filter(id => overtime.find(r => r.id === id && r.status === 'pending'));
    await Promise.all(pendingIds.map(id => apiService.put(`/api/v1/personnel/overtime/${id}/approve`)));
    message.success(`${pendingIds.length} request(s) approved`);
    setSelectedKeys([]);
    invOT();
  }, [selectedKeys, overtime, invOT]);

  const bulkDelete = useCallback(async () => {
    const deletable = selectedKeys.filter(id => overtime.find(r => r.id === id && r.status !== 'approved'));
    await Promise.all(deletable.map(id => apiService.delete(`/api/v1/personnel/overtime/${id}`)));
    message.success(`${deletable.length} request(s) deleted`);
    setSelectedKeys([]);
    invOT();
  }, [selectedKeys, overtime, invOT]);

  const bulkDelRules = useCallback(async () => {
    await Promise.all(selectedRuleKeys.map(id => apiService.delete(`/api/v1/personnel/overtime/rules/${id}`)));
    message.success(`${selectedRuleKeys.length} rule(s) deleted`);
    setSelectedRuleKeys([]);
    inv('overtime-rules');
  }, [selectedRuleKeys, inv]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const openAddRequest  = () => { setEditingRecord(null); setRequestModalOpen(true); setTimeout(() => requestForm.resetFields(), 0); };
  const openEditRequest = r  => { setEditingRecord(r); setRequestModalOpen(true); setTimeout(() => requestForm.setFieldsValue({
    ...r,
    date:       r.date       ? dayjs(r.date)               : null,
    start_time: r.start_time ? dayjs(r.start_time, 'HH:mm:ss') : null,
    end_time:   r.end_time   ? dayjs(r.end_time,   'HH:mm:ss') : null,
  }), 0); };
  const submitRequest = () => requestForm.validateFields().then(v => requestMut.mutate({
    ...v,
    date:       v.date?.format('YYYY-MM-DD'),
    start_time: v.start_time?.format('HH:mm:ss'),
    end_time:   v.end_time?.format('HH:mm:ss'),
  })).catch(() => {});

  const openReject  = id => { setRejectingId(id); setRejectModalOpen(true); setTimeout(() => rejectForm.resetFields(), 0); };
  const submitReject = () => rejectForm.validateFields().then(v => rejectMut.mutate({ id: rejectingId, ...v })).catch(() => {});

  const openAddRule  = () => { setEditingRule(null); setRuleModalOpen(true); setTimeout(() => ruleForm.resetFields(), 0); };
  const openEditRule = r  => { setEditingRule(r); setRuleModalOpen(true); setTimeout(() => ruleForm.setFieldsValue(r), 0); };
  const submitRule   = () => ruleForm.validateFields().then(v => ruleMut.mutate(v)).catch(() => {});

  // ── Export ────────────────────────────────────────────────────────────────────
  const exportCols = [
    { title: 'Personnel',    exportValue: r => r.personnel_name    || '' },
    { title: 'Emp Code',     exportValue: r => r.personnel_emp_code || '' },
    { title: 'Type',         exportValue: r => r.personnel_type    || '' },
    { title: 'Department',   exportValue: r => r.department_name   || '' },
    { title: 'OT Type',      exportValue: r => r.overtime_type     || '' },
    { title: 'Date',         exportValue: r => r.date              || '' },
    { title: 'Start',        exportValue: r => r.start_time        || '' },
    { title: 'End',          exportValue: r => r.end_time          || '' },
    { title: 'Hours Worked', exportValue: r => r.hours_worked      ?? '' },
    { title: 'OT Hours',     exportValue: r => r.overtime_hours    ?? '' },
    { title: 'Compensation', exportValue: r => r.compensation_type || '' },
    { title: 'Status',       exportValue: r => r.status            || '' },
    { title: 'Reason',       exportValue: r => r.reason            || '' },
  ];

  // ── Table columns ─────────────────────────────────────────────────────────────
  const TYPE_CFG_COLORS = { daily:'#2563eb', weekly:'#7c3aed', weekend:'#0891b2', holiday:'#c2410c', special:'#be185d' };

  const requestColumns = [
    {
      title: 'Employee', key: 'employee', width: 210,
      sorter: (a, b) => (a.personnel_name || '').localeCompare(b.personnel_name || ''),
      render: (_, r) => (
        <EmployeeCell
          name={r.personnel_name || `ID ${r.personnel_id}`}
          empCode={r.personnel_emp_code}
          type={r.personnel_type}
          department={r.department_name}
          onClick={() => setDetailRecord(r)}
        />
      ),
    },
    {
      title: 'Date', dataIndex: 'date', width: 120,
      sorter: (a, b) => (a.date || '').localeCompare(b.date || ''),
      render: d => d ? <span style={{ fontWeight: 600, fontSize: 12 }}>{dayjs(d).format('DD MMM YYYY')}</span> : '—',
    },
    {
      title: 'OT Type', dataIndex: 'overtime_type', width: 110,
      render: t => <TypePill type={t} />,
    },
    {
      title: 'Time', key: 'time', width: 110,
      render: (_, r) => (r.start_time || r.end_time)
        ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151' }}>
            {String(r.start_time || '').slice(0, 5)} → {String(r.end_time || '').slice(0, 5)}
          </span>
        : '—',
    },
    {
      title: 'OT Hrs', dataIndex: 'overtime_hours', width: 90,
      sorter: (a, b) => (Number(a.overtime_hours) || 0) - (Number(b.overtime_hours) || 0),
      render: h => <span style={{ fontWeight: 800, fontSize: 14, color: '#d97706' }}>{fmtHrs(h)}</span>,
    },
    {
      title: 'Comp', dataIndex: 'compensation_type', width: 100,
      render: t => <CompPill type={t} />,
    },
    {
      title: 'Status', key: 'status', width: 120,
      render: (_, r) => <StatusPill status={r.status} />,
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 190,
      render: (_, r) => (
        <Space size={3}>
          {r.status === 'pending' && (
            <>
              <Tooltip title="Approve">
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  onClick={() => approveMut.mutate(r.id)} loading={approveMut.isPending}
                  style={{ borderRadius: 6, background: '#16a34a', borderColor: '#16a34a' }} />
              </Tooltip>
              <Tooltip title="Reject">
                <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => openReject(r.id)} style={{ borderRadius: 6 }} />
              </Tooltip>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditRequest(r)} style={{ borderRadius: 6 }} />
              </Tooltip>
            </>
          )}
          {r.status === 'approved' && (
            <Tooltip title="Cancel">
              <Button size="small" icon={<StopOutlined />} onClick={() => cancelMut.mutate(r.id)} style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          <Tooltip title="Detail">
            <Button size="small" icon={<MoreOutlined />} onClick={() => setDetailRecord(r)} style={{ borderRadius: 6 }} />
          </Tooltip>
          {r.status !== 'approved' && (
            <Popconfirm title="Delete request?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const ruleColumns = [
    {
      title: 'Rule Name', dataIndex: 'rule_name', width: 200,
      sorter: (a, b) => a.rule_name.localeCompare(b.rule_name),
      render: n => <span style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{n}</span>,
    },
    { title: 'Type', dataIndex: 'rule_type', width: 110, render: t => <TypePill type={t} /> },
    {
      title: 'Thresholds', key: 'thresholds', width: 160,
      render: (_, r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {r.daily_threshold_hours   != null && <span style={{ fontSize: 10 }}>Daily: <b>{r.daily_threshold_hours}h</b></span>}
          {r.weekly_threshold_hours  != null && <span style={{ fontSize: 10 }}>Weekly: <b>{r.weekly_threshold_hours}h</b></span>}
          {r.monthly_threshold_hours != null && <span style={{ fontSize: 10 }}>Monthly: <b>{r.monthly_threshold_hours}h</b></span>}
        </div>
      ),
    },
    {
      title: 'Rate', dataIndex: 'rate_multiplier', width: 80,
      render: r => (
        <span style={{ fontWeight: 800, fontSize: 14, color: '#059669' }}>{Number(r).toFixed(1)}×</span>
      ),
    },
    {
      title: 'Applies To', dataIndex: 'applies_to', width: 110,
      render: a => {
        const cfg = PERS_TYPE_CFG[a] || { color: '#374151', bg: '#f1f5f9' };
        return (
          <span style={{ fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, borderRadius: 6, padding: '2px 8px' }}>
            {a === 'all' ? 'All' : a}
          </span>
        );
      },
    },
    {
      title: 'Approval', dataIndex: 'requires_approval', width: 90,
      render: v => <span style={{ fontSize: 11, fontWeight: 700, color: v ? '#d97706' : '#16a34a' }}>{v ? 'Required' : 'Auto'}</span>,
    },
    {
      title: 'Active', dataIndex: 'is_active', width: 80,
      render: v => <Switch size="small" checked={v} disabled />,
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 100,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEditRule(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Popconfirm title="Delete rule?" onConfirm={() => delRuleMut.mutate(r.id)} okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const containerStyle = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' };
  const paginationProps = { pageSize: 20, showSizeChanger: true, showQuickJumper: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`, style: { padding: '12px 16px', margin: 0 } };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>Overtime Management</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              Track, approve and analyse overtime requests across all personnel
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddRequest}
            style={{ borderRadius: 8, fontWeight: 600, background: '#d97706', borderColor: '#d97706' }}>
            New OT Request
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Requests',   value: summary.total    ?? overtime.length,                                          color: '#2563eb', bg: '#eff6ff', icon: <ClockCircleOutlined />      },
          { label: 'Pending Approval', value: summary.pending  ?? pendingCount,                                              color: '#d97706', bg: '#fffbeb', icon: <ExclamationCircleOutlined />, alert: pendingCount > 0 },
          { label: 'Approved',         value: summary.approved ?? overtime.filter(r => r.status === 'approved').length,      color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircleOutlined />      },
          { label: 'Total OT Hours',   value: summary.total_overtime_hours != null ? `${Number(summary.total_overtime_hours).toFixed(1)}h` : '—', color: '#7c3aed', bg: '#ede9fe', icon: <TeamOutlined /> },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <div style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              border: `1px solid ${s.alert ? '#fde68a' : '#e2e8f0'}`,
              boxShadow: s.alert ? '0 0 0 2px rgba(217,119,6,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 18 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Tabs */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding: '0 16px' }}
          items={[

            // ── REQUESTS ──────────────────────────────────────────────────────
            {
              key: 'requests',
              label: (
                <span>
                  <ClockCircleOutlined /> Overtime Requests
                  {pendingCount > 0 && <Badge count={pendingCount} size="small" style={{ marginLeft: 6 }} />}
                </span>
              ),
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                    <Input placeholder="Search employee, department…" prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
                      value={searchQ} onChange={e => setSearchQ(e.target.value)} allowClear
                      style={{ flex: '1 1 200px', maxWidth: 240, borderRadius: 8 }} />
                    <FilterOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                    <Select placeholder="Status" allowClear style={{ flex: '1 1 120px', minWidth: 120 }}
                      value={filterStatus || undefined} onChange={v => setFilterStatus(v || '')}
                      options={OT_STATUSES.map(s => ({ value: s, label: <StatusPill status={s} /> }))} />
                    <Select placeholder="OT Type" allowClear style={{ flex: '1 1 110px', minWidth: 110 }}
                      value={filterType || undefined} onChange={v => setFilterType(v || '')}
                      options={OT_TYPES.map(t => ({ value: t, label: <TypePill type={t} /> }))} />
                    <Select placeholder="Compensation" allowClear style={{ flex: '1 1 130px', minWidth: 130 }}
                      value={filterComp || undefined} onChange={v => setFilterComp(v || '')}
                      options={COMP_TYPES.map(t => ({ value: t, label: <CompPill type={t} /> }))} />
                    <Select placeholder="Department" allowClear showSearch optionFilterProp="label"
                      style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={filterDept || undefined} onChange={v => setFilterDept(v || '')} options={deptOptions} />
                    {hasFilters && (
                      <Button size="small" style={{ borderRadius: 6 }}
                        onClick={() => { setSearchQ(''); setFilterStatus(''); setFilterType(''); setFilterComp(''); setFilterDept(''); }}>
                        Clear
                      </Button>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Tooltip title="Export CSV">
                        <Button icon={<DownloadOutlined />} onClick={() => exportCSV(exportCols, filteredOvertime, `overtime-${dayjs().format('YYYY-MM-DD')}.csv`)} style={{ borderRadius: 8 }} />
                      </Tooltip>
                      <Button icon={<ReloadOutlined />} onClick={() => { refetchOvertime(); }} style={{ borderRadius: 8 }} />
                    </div>
                  </div>
                  {hasFilters && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {filterStatus && <Tag closable onClose={() => setFilterStatus('')} color="orange">{STATUS_CFG[filterStatus]?.label}</Tag>}
                      {filterType   && <Tag closable onClose={() => setFilterType('')}   color="blue">{lbl(filterType)}</Tag>}
                      {filterComp   && <Tag closable onClose={() => setFilterComp('')}   color="purple">{COMP_CFG[filterComp]?.label}</Tag>}
                      {filterDept   && <Tag closable onClose={() => setFilterDept('')}   icon={<ApartmentOutlined />}>{filterDept}</Tag>}
                      {searchQ      && <Tag closable onClose={() => setSearchQ('')}      icon={<SearchOutlined />}>"{searchQ}"</Tag>}
                    </div>
                  )}
                  <BulkBar
                    count={selectedKeys.length}
                    onClear={() => setSelectedKeys([])}
                    onApproveAll={bulkApprove}
                    onDelete={bulkDelete}
                    approvePending={approveMut.isPending}
                  />
                  <div style={containerStyle}>
                    <Table
                      columns={requestColumns}
                      dataSource={filteredOvertime}
                      loading={overtimeLoading}
                      rowKey="id"
                      rowSelection={{
                        selectedRowKeys: selectedKeys,
                        onChange: setSelectedKeys,
                        getCheckboxProps: r => ({ disabled: r.status === 'approved' }),
                      }}
                      pagination={paginationProps}
                      scroll={{ x: 1200 }}
                      size="middle"
                      rowClassName={r => r.status === 'pending' ? 'row-pending' : ''}
                    />
                  </div>
                </div>
              ),
            },

            // ── RULES ─────────────────────────────────────────────────────────
            {
              key: 'rules',
              label: <span><SettingOutlined /> Overtime Rules</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    {selectedRuleKeys.length > 0 && (
                      <div style={{ background: '#7c3aed', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{selectedRuleKeys.length} selected</span>
                        <Popconfirm title={`Delete ${selectedRuleKeys.length} rule(s)?`} onConfirm={bulkDelRules} okButtonProps={{ danger: true }}>
                          <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 5, background: '#dc2626', border: 'none', color: '#fff' }} />
                        </Popconfirm>
                        <Button size="small" icon={<CloseOutlined />} onClick={() => setSelectedRuleKeys([])}
                          style={{ borderRadius: 5, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }} />
                      </div>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={openAddRule} style={{ borderRadius: 8 }}>Add Rule</Button>
                      <Button icon={<ReloadOutlined />} onClick={refetchRules} style={{ borderRadius: 8 }} />
                    </div>
                  </div>
                  <div style={containerStyle}>
                    <Table
                      columns={ruleColumns}
                      dataSource={rules}
                      loading={rulesLoading}
                      rowKey="id"
                      rowSelection={{ selectedRowKeys: selectedRuleKeys, onChange: setSelectedRuleKeys }}
                      pagination={paginationProps}
                      scroll={{ x: 1000 }}
                      size="middle"
                    />
                  </div>
                </div>
              ),
            },

            // ── ANALYTICS ─────────────────────────────────────────────────────
            {
              key: 'analytics',
              label: <span><BarChartOutlined /> Analytics</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <AnalyticsTab overtime={overtime} summary={summary} />
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ── Request Modal ─────────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#d97706,#b45309)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClockCircleOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingRecord ? 'Edit Overtime Request' : 'New Overtime Request'}
          </Space>
        }
        open={requestModalOpen} onOk={submitRequest}
        onCancel={() => { setRequestModalOpen(false); setEditingRecord(null); }}
        confirmLoading={requestMut.isPending} width={720} forceRender
      >
        <Form form={requestForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Employee" rules={[{ required: true }]}>
                <Select showSearch placeholder="Select employee" options={personnelOptions}
                  filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
                  disabled={!!editingRecord} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="overtime_type" label="Overtime Type" rules={[{ required: true }]}>
                <Select placeholder="Select type" options={OT_TYPES.map(t => ({ value: t, label: <TypePill type={t} /> }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="compensation_type" label="Compensation Type">
                <Select placeholder="Pay / Time Off / Mixed" allowClear
                  options={COMP_TYPES.map(t => ({ value: t, label: <CompPill type={t} /> }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_time" label="Start Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} onChange={onTimesChange} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_time" label="End Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} onChange={onTimesChange} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="hours_worked" label="Hours Worked (auto)">
                <InputNumber min={0} step={0.25} style={{ width: '100%' }} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="overtime_hours" label="OT Hours">
                <InputNumber min={0} step={0.25} style={{ width: '100%' }} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} maxLength={500} showCount placeholder="Reason for overtime" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Reject Modal ──────────────────────────────────────────────────────── */}
      <Modal
        title="Reject Overtime Request" open={rejectModalOpen} onOk={submitReject}
        onCancel={() => { setRejectModalOpen(false); setRejectingId(null); }}
        confirmLoading={rejectMut.isPending}
        okText="Reject" okButtonProps={{ danger: true }} forceRender
      >
        <Form form={rejectForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="rejection_reason" label="Rejection Reason" rules={[{ required: true, message: 'Please provide a reason' }]}>
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Rule Modal ────────────────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#0f172a,#1e293b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SettingOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingRule ? 'Edit Overtime Rule' : 'New Overtime Rule'}
          </Space>
        }
        open={ruleModalOpen} onOk={submitRule}
        onCancel={() => { setRuleModalOpen(false); setEditingRule(null); }}
        confirmLoading={ruleMut.isPending} width={680} forceRender
      >
        <Form form={ruleForm} layout="vertical"
          initialValues={{ rate_multiplier: 1.5, requires_approval: true, applies_to: 'all', is_active: true }}
          style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rule_name" label="Rule Name" rules={[{ required: true }]}>
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rule_type" label="Rule Type" rules={[{ required: true }]}>
                <Select placeholder="Select type" options={OT_TYPES.map(t => ({ value: t, label: <TypePill type={t} /> }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="daily_threshold_hours" label="Daily Threshold (hrs)">
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="weekly_threshold_hours" label="Weekly Threshold (hrs)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="monthly_threshold_hours" label="Monthly Threshold (hrs)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="rate_multiplier" label="Rate Multiplier" rules={[{ required: true }]}>
                <InputNumber min={1} max={5} step={0.1} style={{ width: '100%' }} precision={2} addonAfter="×" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_daily_hours" label="Max Daily OT Hrs">
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_weekly_hours" label="Max Weekly OT Hrs">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="applies_to" label="Applies To">
                <Select options={[
                  { value: 'all', label: 'All Personnel' },
                  { value: 'STAFF', label: 'Staff Only' },
                  { value: 'CONTRACTOR', label: 'Contractors Only' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="requires_approval" label="Requires Approval" valuePropName="checked">
                <Switch checkedChildren="Required" unCheckedChildren="Auto" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Detail Drawer ─────────────────────────────────────────────────────── */}
      <RequestDrawer
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        onApprove={id => { approveMut.mutate(id); setDetailRecord(null); }}
        onReject={id => openReject(id)}
        onCancel={id => { cancelMut.mutate(id); setDetailRecord(null); }}
        onEdit={r => openEditRequest(r)}
        loading={approveMut.isPending || cancelMut.isPending}
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
        .row-pending { background: rgba(217,119,6,0.03) !important; }
        .row-pending:hover > td { background: rgba(217,119,6,0.07) !important; }
      `}</style>
    </div>
  );
};

export default OvertimeManagement;
