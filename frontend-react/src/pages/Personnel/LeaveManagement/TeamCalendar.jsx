import React, { useState, useMemo, useCallback } from 'react';
import {
  Button, Select, Input, Tooltip, Popover, Drawer, Tag, Badge,
  Avatar, Space, Typography, Spin, Empty, Row, Col, DatePicker,
} from 'antd';
import {
  LeftOutlined, RightOutlined, CalendarOutlined, UnorderedListOutlined,
  BarChartOutlined, SearchOutlined, ReloadOutlined, AimOutlined,
  TeamOutlined, FilterOutlined, UserOutlined, ClockCircleOutlined,
  CheckCircleOutlined, ArrowRightOutlined, DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const { Text } = Typography;

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  annual:        { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  sick:          { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
  maternity:     { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8' },
  paternity:     { bg: '#cffafe', text: '#0e7490', border: '#a5f3fc' },
  compassionate: { bg: '#ede9fe', text: '#7c3aed', border: '#ddd6fe' },
  unpaid:        { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
  study:         { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  military:      { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  personal:      { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
  other:         { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
};
const typeStyle = (code) => TYPE_COLORS[code] || TYPE_COLORS.other;

const AVATAR_PALETTE = [
  '#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706',
  '#dc2626', '#0891b2', '#65a30d', '#9333ea', '#0f766e',
];
const avatarColor = (name) =>
  AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials = (name) =>
  (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const exportCSV = (rows, filename) => {
  const headers = ['Employee', 'Emp Code', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status'];
  const lines = rows.map(r => [
    r.personnel_name || '',
    r.emp_code || '',
    r.department_name || '',
    r.leave_type || '',
    r.start_date || '',
    r.end_date || '',
    r.days_count || '',
    r.status || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── Employee Avatar Pill ───────────────────────────────────────────────────────
const EmployeePill = ({ entry, leaveTypes, onClick, compact = false }) => {
  const { bg, text } = typeStyle(entry.leave_type);
  const typeName = leaveTypes.find(lt => lt.code === entry.leave_type)?.name || entry.leave_type;
  return (
    <div
      onClick={() => onClick && onClick(entry)}
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? 4 : 5,
        background: bg, border: `1px solid ${typeStyle(entry.leave_type).border}`,
        borderRadius: 5, padding: compact ? '1px 5px' : '2px 6px',
        cursor: 'pointer', overflow: 'hidden',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {!compact && (
        <Avatar size={14} style={{ background: avatarColor(entry.personnel_name), fontSize: 8, fontWeight: 700, flexShrink: 0 }}>
          {initials(entry.personnel_name)}
        </Avatar>
      )}
      <span style={{
        fontSize: compact ? 9 : 10, fontWeight: 600, color: text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: compact ? 60 : 90,
      }}>
        {entry.personnel_name?.split(' ')[0] || '—'}
      </span>
    </div>
  );
};

// ── Day detail Popover content ─────────────────────────────────────────────────
const DayPopoverContent = ({ entries, dateStr, leaveTypes, onOpenDrawer }) => (
  <div style={{ minWidth: 220, maxWidth: 320 }}>
    <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
      {dayjs(dateStr).format('dddd, D MMMM YYYY')} · {entries.length} on leave
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map((e, i) => {
        const typeName = leaveTypes.find(lt => lt.code === e.leave_type)?.name || e.leave_type;
        const { bg, text, border } = typeStyle(e.leave_type);
        return (
          <div
            key={i}
            onClick={() => onOpenDrawer(e)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 6px', borderRadius: 6,
              background: '#fafafa', border: '1px solid #f1f5f9',
              cursor: 'pointer',
            }}
          >
            <Avatar size={26} style={{ background: avatarColor(e.personnel_name), fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {initials(e.personnel_name)}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.personnel_name}
              </div>
              {e.department_name && (
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{e.department_name}</div>
              )}
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, background: bg, color: text, border: `1px solid ${border}`, borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
              {typeName}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Leave detail Drawer ────────────────────────────────────────────────────────
const LeaveDetailDrawer = ({ entry, leaveTypes, onClose }) => {
  if (!entry) return null;
  const typeName = leaveTypes.find(lt => lt.code === entry.leave_type)?.name || entry.leave_type;
  const { bg, text, border } = typeStyle(entry.leave_type);
  const start = dayjs(entry.start_date);
  const end = dayjs(entry.end_date);
  const daysTotal = entry.days_count;

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={36} style={{ background: avatarColor(entry.personnel_name), fontSize: 13, fontWeight: 700 }}>
            {initials(entry.personnel_name)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{entry.personnel_name}</div>
            {entry.emp_code && (
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{entry.emp_code}</span>
            )}
          </div>
        </div>
      }
      open={!!entry}
      onClose={onClose}
      width={360}
      bodyStyle={{ padding: 20 }}
    >
      {/* Leave type badge */}
      <div style={{ marginBottom: 20 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: bg, color: text, border: `1px solid ${border}`,
          borderRadius: 8, padding: '4px 14px', fontSize: 13, fontWeight: 700,
        }}>
          {typeName}
        </span>
        {entry.status === 'on_leave' && (
          <span style={{
            marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
            borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            Currently on leave
          </span>
        )}
      </div>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
          <Row gutter={0}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3 }}>From</Text>
              <Text style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{start.format('DD MMM')}</Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{start.format('YYYY, dddd')}</Text>
            </Col>
            <Col span={12} style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 12 }}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3 }}>To</Text>
              <Text style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{end.format('DD MMM')}</Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{end.format('YYYY, dddd')}</Text>
            </Col>
          </Row>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{daysTotal}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>working days</div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>
              {dayjs().isBefore(start) ? `In ${start.diff(dayjs(), 'day')} days`
                : dayjs().isAfter(end) ? 'Completed'
                : `${end.diff(dayjs(), 'day') + 1} days left`}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>status</div>
          </div>
        </div>

        {entry.department_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ color: '#94a3b8', fontSize: 13 }} />
            <Text style={{ fontSize: 12, color: '#374151' }}>{entry.department_name}</Text>
          </div>
        )}

        {entry.reason && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
            <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Reason</Text>
            <Text style={{ fontSize: 12, color: '#374151' }}>{entry.reason}</Text>
          </div>
        )}
      </div>
    </Drawer>
  );
};

// ── Month View ─────────────────────────────────────────────────────────────────
const MonthView = ({ calMonth, calData, leaveTypes, onDayClick, onEntryClick, filterType, filterDept }) => {
  const days = calData?.days || calData || {};
  const todayStr = dayjs().format('YYYY-MM-DD');
  const daysInMonth = calMonth.daysInMonth();
  const firstDow = calMonth.startOf('month').day();
  const WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build cell array: nulls for padding + day numbers
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  // Max entries in any cell — for heatmap scaling
  const maxEntries = Math.max(1, ...Object.values(days).map(arr => arr.length));

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
        {WEEK_LABELS.map((d, i) => (
          <div key={d} style={{
            padding: '8px 10px', fontSize: 10, fontWeight: 800, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: (i === 0 || i === 6) ? '#cbd5e1' : '#64748b',
            borderRight: i < 6 ? '1px solid #e2e8f0' : 'none',
            textAlign: 'center',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {Array.from({ length: cells.length / 7 }).map((_, wi) => (
        <div
          key={wi}
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: wi < cells.length / 7 - 1 ? '1px solid #f1f5f9' : 'none',
          }}
        >
          {cells.slice(wi * 7, wi * 7 + 7).map((day, ci) => {
            const colIndex = wi * 7 + ci;
            const isWeekend = ci === 0 || ci === 6;
            const dateStr = day ? calMonth.date(day).format('YYYY-MM-DD') : null;
            const rawEntries = (dateStr && days[dateStr]) || [];
            const entries = rawEntries.filter(e =>
              (!filterType || e.leave_type === filterType) &&
              (!filterDept || e.department_id === filterDept)
            );
            const isToday = dateStr === todayStr;
            const count = entries.length;
            // Heatmap: 0 people = white, many = soft blue tint
            const heatOpacity = count > 0 ? Math.min(0.08 + (count / maxEntries) * 0.18, 0.26) : 0;

            const visibleMax = 4;
            const visible = entries.slice(0, visibleMax);
            const overflow = entries.length - visibleMax;

            const cellContent = (
              <div
                onClick={() => day && count > 0 && onDayClick(dateStr, entries)}
                style={{
                  minHeight: 110, padding: '6px 8px',
                  borderRight: ci < 6 ? '1px solid #f1f5f9' : 'none',
                  background: !day
                    ? '#f9fafb'
                    : isToday
                      ? `rgba(37,99,235,${heatOpacity + 0.04})`
                      : isWeekend
                        ? `rgba(248,250,252,1)`
                        : count > 0
                          ? `rgba(239,246,255,${heatOpacity * 3})`
                          : '#fff',
                  cursor: day && count > 0 ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (day && count > 0) e.currentTarget.style.background = 'rgba(239,246,255,0.6)'; }}
                onMouseLeave={e => {
                  if (day && count > 0) {
                    e.currentTarget.style.background = isToday
                      ? `rgba(37,99,235,${heatOpacity + 0.04})`
                      : `rgba(239,246,255,${heatOpacity * 3})`;
                  }
                }}
              >
                {day && (
                  <>
                    {/* Date number */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: isToday ? '#2563eb' : 'transparent',
                        fontSize: 11, fontWeight: isToday ? 800 : 500,
                        color: isToday ? '#fff' : isWeekend ? '#cbd5e1' : '#374151',
                      }}>
                        {day}
                      </div>
                      {count > 0 && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: '#2563eb',
                          background: '#eff6ff', borderRadius: 10, padding: '1px 5px',
                        }}>
                          {count}
                        </span>
                      )}
                    </div>

                    {/* Entry pills */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {visible.map((e, i) => (
                        <EmployeePill key={i} entry={e} leaveTypes={leaveTypes}
                          onClick={() => onEntryClick(e)} />
                      ))}
                      {overflow > 0 && (
                        <div style={{
                          fontSize: 9, color: '#64748b', fontWeight: 600,
                          paddingLeft: 4, paddingTop: 1, cursor: 'pointer',
                        }}>
                          +{overflow} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );

            return (
              <div key={ci}>{cellContent}</div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ── Week View ─────────────────────────────────────────────────────────────────
const WeekView = ({ weekStart, calData, leaveTypes, onEntryClick }) => {
  const days = calData?.days || {};
  const todayStr = dayjs().format('YYYY-MM-DD');
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
        {weekDays.map((d, i) => {
          const isToday = d.format('YYYY-MM-DD') === todayStr;
          const count = (days[d.format('YYYY-MM-DD')] || []).length;
          return (
            <div key={i} style={{
              padding: '10px 12px', textAlign: 'center',
              borderRight: i < 6 ? '1px solid #e2e8f0' : 'none',
              background: isToday ? '#eff6ff' : 'transparent',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 2 }}>
                {DAY_LABELS[i]}
              </div>
              <div style={{
                fontSize: 20, fontWeight: 800, lineHeight: 1.1,
                color: isToday ? '#2563eb' : '#0f172a',
              }}>
                {d.format('D')}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{d.format('MMM')}</div>
              {count > 0 && (
                <Badge count={count} size="small" style={{ background: '#2563eb', marginTop: 4 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* All-day leave rows */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 200 }}>
        {weekDays.map((d, i) => {
          const dateStr = d.format('YYYY-MM-DD');
          const entries = days[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isWeekend = i >= 5;
          return (
            <div key={i} style={{
              padding: '10px 8px',
              borderRight: i < 6 ? '1px solid #f1f5f9' : 'none',
              background: isToday ? '#fafeff' : isWeekend ? '#f9fafb' : '#fff',
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              {entries.length === 0 ? (
                isWeekend
                  ? <div style={{ fontSize: 10, color: '#e2e8f0', textAlign: 'center', marginTop: 20 }}>Weekend</div>
                  : null
              ) : entries.map((e, j) => {
                const typeName = leaveTypes.find(lt => lt.code === e.leave_type)?.name || e.leave_type;
                const { bg, text, border } = typeStyle(e.leave_type);
                return (
                  <div
                    key={j}
                    onClick={() => onEntryClick(e)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: bg, border: `1px solid ${border}`,
                      borderRadius: 7, padding: '6px 8px', cursor: 'pointer',
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={el => el.currentTarget.style.opacity = '0.75'}
                    onMouseLeave={el => el.currentTarget.style.opacity = '1'}
                  >
                    <Avatar size={22} style={{ background: avatarColor(e.personnel_name), fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                      {initials(e.personnel_name)}
                    </Avatar>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.personnel_name?.split(' ')[0]}
                      </div>
                      <div style={{ fontSize: 9, color: text, opacity: 0.75 }}>{typeName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Timeline / Gantt View ─────────────────────────────────────────────────────
const TimelineView = ({ calMonth, calData, leaveTypes, onEntryClick, filterDept, filterType }) => {
  const spans = (calData?.spans || []).filter(e =>
    (!filterType || e.leave_type === filterType) &&
    (!filterDept || e.department_id === filterDept)
  );

  const todayStr = dayjs().format('YYYY-MM-DD');
  const monthStart = calMonth.startOf('month');
  const daysInMonth = calMonth.daysInMonth();
  const dayWidth = 28; // px per day column
  const rowHeight = 40;
  const leftWidth = 180;

  // Group by employee, deduplicate
  const byEmployee = useMemo(() => {
    const map = {};
    spans.forEach(span => {
      if (!map[span.personnel_id]) {
        map[span.personnel_id] = {
          personnel_id: span.personnel_id,
          personnel_name: span.personnel_name,
          emp_code: span.emp_code,
          department_name: span.department_name,
          leaves: [],
        };
      }
      map[span.personnel_id].leaves.push(span);
    });
    return Object.values(map).sort((a, b) =>
      (a.department_name || '').localeCompare(b.department_name || '') ||
      (a.personnel_name || '').localeCompare(b.personnel_name || '')
    );
  }, [spans]);

  // Day columns
  const days = Array.from({ length: daysInMonth }, (_, i) => monthStart.add(i, 'day'));
  const todayOffset = dayjs().isSame(calMonth, 'month')
    ? dayjs().date() - 1
    : -1;

  // Clamp a date to the visible month range → column offset
  const dayCol = (dateStr) => {
    const d = dayjs(dateStr);
    const start = Math.max(0, d.diff(monthStart, 'day'));
    return Math.min(start, daysInMonth);
  };
  const spanWidth = (startStr, endStr) => {
    const s = Math.max(0, dayjs(startStr).diff(monthStart, 'day'));
    const e = Math.min(daysInMonth - 1, dayjs(endStr).diff(monthStart, 'day'));
    return Math.max(1, e - s + 1);
  };

  if (byEmployee.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 48, textAlign: 'center' }}>
        <CalendarOutlined style={{ fontSize: 32, color: '#cbd5e1' }} />
        <div style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>No approved leaves in this period</div>
      </div>
    );
  }

  // Department groups
  const departments = [...new Set(byEmployee.map(e => e.department_name || 'No Department'))];

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Scrollable container */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 600 }}>
        <div style={{ minWidth: leftWidth + daysInMonth * dayWidth }}>

          {/* Header row: day numbers */}
          <div style={{
            display: 'flex', position: 'sticky', top: 0, zIndex: 10,
            background: '#f8fafc', borderBottom: '2px solid #e2e8f0',
          }}>
            {/* Left spacer */}
            <div style={{
              width: leftWidth, minWidth: leftWidth, flexShrink: 0,
              padding: '8px 12px', borderRight: '2px solid #e2e8f0',
              fontSize: 10, fontWeight: 700, color: '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              position: 'sticky', left: 0, background: '#f8fafc', zIndex: 11,
            }}>
              Employee
            </div>
            {/* Day headers */}
            {days.map((d, i) => {
              const isToday = i === todayOffset;
              const isWeekend = d.day() === 0 || d.day() === 6;
              return (
                <div key={i} style={{
                  width: dayWidth, minWidth: dayWidth, textAlign: 'center',
                  padding: '4px 0',
                  background: isToday ? '#eff6ff' : isWeekend ? '#f9fafb' : 'transparent',
                  borderRight: '1px solid #f1f5f9',
                }}>
                  <div style={{ fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {d.format('ddd')}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: isToday ? 800 : 500,
                    color: isToday ? '#2563eb' : isWeekend ? '#cbd5e1' : '#374151',
                    width: 20, height: 20, borderRadius: '50%',
                    background: isToday ? '#dbeafe' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '2px auto 0',
                  }}>
                    {d.date()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Department groups + employee rows */}
          {departments.map(dept => {
            const deptEmployees = byEmployee.filter(e => (e.department_name || 'No Department') === dept);
            return (
              <React.Fragment key={dept}>
                {/* Department header */}
                <div style={{
                  display: 'flex',
                  background: '#f1f5f9',
                  borderBottom: '1px solid #e2e8f0',
                  borderTop: '1px solid #e2e8f0',
                  position: 'sticky', left: 0,
                }}>
                  <div style={{
                    width: '100%', padding: '4px 12px',
                    fontSize: 10, fontWeight: 800, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <TeamOutlined style={{ fontSize: 11 }} />
                    {dept}
                    <span style={{
                      background: '#e2e8f0', borderRadius: 10, padding: '0 6px',
                      fontSize: 10, fontWeight: 700, color: '#475569',
                    }}>
                      {deptEmployees.length}
                    </span>
                  </div>
                </div>

                {/* Employee rows */}
                {deptEmployees.map((emp, ei) => (
                  <div key={emp.personnel_id} style={{
                    display: 'flex', position: 'relative', alignItems: 'center',
                    borderBottom: '1px solid #f8fafc',
                    background: ei % 2 === 0 ? '#fff' : '#fafafa',
                    height: rowHeight,
                  }}>
                    {/* Employee name cell (sticky) */}
                    <div style={{
                      width: leftWidth, minWidth: leftWidth, flexShrink: 0,
                      padding: '0 12px', borderRight: '2px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', gap: 8,
                      position: 'sticky', left: 0, zIndex: 5,
                      background: ei % 2 === 0 ? '#fff' : '#fafafa',
                      height: '100%',
                    }}>
                      <Avatar size={24} style={{ background: avatarColor(emp.personnel_name), fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                        {initials(emp.personnel_name)}
                      </Avatar>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.personnel_name}
                        </div>
                        {emp.emp_code && (
                          <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#94a3b8' }}>{emp.emp_code}</div>
                        )}
                      </div>
                    </div>

                    {/* Day grid background + leave bars */}
                    <div style={{ position: 'relative', display: 'flex', flex: 1, height: '100%', alignItems: 'center' }}>
                      {/* Grid lines */}
                      {days.map((d, i) => {
                        const isWeekend = d.day() === 0 || d.day() === 6;
                        const isToday = i === todayOffset;
                        return (
                          <div key={i} style={{
                            width: dayWidth, minWidth: dayWidth, height: '100%',
                            background: isToday ? 'rgba(37,99,235,0.04)' : isWeekend ? 'rgba(0,0,0,0.015)' : 'transparent',
                            borderRight: '1px solid #f8fafc',
                            flexShrink: 0,
                          }} />
                        );
                      })}

                      {/* Leave bars (absolutely positioned over the grid) */}
                      {emp.leaves.map((leave, li) => {
                        const colStart = dayCol(leave.start_date);
                        const widthCols = spanWidth(leave.start_date, leave.end_date);
                        const { bg, text, border } = typeStyle(leave.leave_type);
                        const typeName = leaveTypes.find(lt => lt.code === leave.leave_type)?.name || leave.leave_type;
                        return (
                          <Tooltip
                            key={li}
                            title={`${typeName} · ${dayjs(leave.start_date).format('D MMM')} – ${dayjs(leave.end_date).format('D MMM')} (${leave.days_count} days)`}
                          >
                            <div
                              onClick={() => onEntryClick(leave)}
                              style={{
                                position: 'absolute',
                                left: colStart * dayWidth + 2,
                                width: Math.max(widthCols * dayWidth - 4, dayWidth - 4),
                                height: 24, top: '50%', transform: 'translateY(-50%)',
                                background: bg, border: `1px solid ${border}`, color: text,
                                borderRadius: 5, fontSize: 10, fontWeight: 700,
                                display: 'flex', alignItems: 'center',
                                padding: '0 6px', overflow: 'hidden',
                                cursor: 'pointer', whiteSpace: 'nowrap',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                transition: 'opacity 0.15s, transform 0.1s',
                                zIndex: 2,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-50%) scaleY(1.08)'; }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(-50%) scaleY(1)'; }}
                            >
                              {widthCols >= 2 ? typeName : ''}
                            </div>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </React.Fragment>
            );
          })}

          {/* Today indicator line */}
          {todayOffset >= 0 && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: leftWidth + todayOffset * dayWidth + dayWidth / 2,
              width: 2, background: '#2563eb', opacity: 0.4,
              pointerEvents: 'none', zIndex: 20,
            }} />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Summary bar — "who's out today" ──────────────────────────────────────────
const SummaryBar = ({ calData, leaveTypes, today }) => {
  const todayStr = today.format('YYYY-MM-DD');
  const days = calData?.days || {};
  const todayEntries = days[todayStr] || [];
  const spans = calData?.spans || [];

  // Department breakdown for today
  const deptMap = {};
  todayEntries.forEach(e => {
    const d = e.department_name || 'Other';
    deptMap[d] = (deptMap[d] || 0) + 1;
  });

  // Leave type breakdown for entire period
  const typeMap = {};
  spans.forEach(e => { typeMap[e.leave_type] = (typeMap[e.leave_type] || 0) + 1; });

  if (todayEntries.length === 0 && spans.length === 0) return null;

  return (
    <div style={{
      display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14,
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', alignItems: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Today count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12, borderRight: '1px solid #f1f5f9' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ClockCircleOutlined style={{ color: '#2563eb', fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{todayEntries.length}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>out today</div>
        </div>
      </div>

      {/* This month total */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12, borderRight: '1px solid #f1f5f9' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{spans.length}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>this period</div>
        </div>
      </div>

      {/* Today's department breakdown */}
      {Object.entries(deptMap).length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingRight: 12, borderRight: '1px solid #f1f5f9' }}>
          <Text type="secondary" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Depts</Text>
          {Object.entries(deptMap).slice(0, 4).map(([dept, cnt]) => (
            <span key={dept} style={{
              fontSize: 10, fontWeight: 600, background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 4, padding: '2px 7px', color: '#475569',
            }}>
              {dept} ({cnt})
            </span>
          ))}
        </div>
      )}

      {/* Leave type pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Types</Text>
        {Object.entries(typeMap).slice(0, 4).map(([type, cnt]) => {
          const { bg, text } = typeStyle(type);
          const label = leaveTypes.find(lt => lt.code === type)?.name || type;
          return (
            <span key={type} style={{
              fontSize: 10, fontWeight: 700, background: bg, color: text,
              borderRadius: 4, padding: '2px 7px',
            }}>
              {label} ×{cnt}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ── Main TeamCalendar Component ───────────────────────────────────────────────
const TeamCalendar = ({ calData, calLoading, refetchCal, leaveTypes, calMonth, setCalMonth, departments }) => {
  const [view, setView] = useState('month'); // month | week | timeline
  const [filterType, setFilterType] = useState(null);
  const [filterDept, setFilterDept] = useState(null);
  const [searchEmp, setSearchEmp] = useState('');
  const [drawerEntry, setDrawerEntry] = useState(null);
  const [dayDrawer, setDayDrawer] = useState(null); // { dateStr, entries }
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('isoWeek'));
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const today = dayjs();
  const deptOptions = useMemo(() =>
    departments.map(d => ({ value: d.id, label: d.name })),
  [departments]);

  // Navigate functions
  const prevMonth = () => setCalMonth(m => m.subtract(1, 'month'));
  const nextMonth = () => setCalMonth(m => m.add(1, 'month'));
  const goToday = () => {
    setCalMonth(dayjs().startOf('month'));
    setWeekStart(dayjs().startOf('isoWeek'));
  };
  const prevWeek = () => setWeekStart(w => w.subtract(1, 'week'));
  const nextWeek = () => setWeekStart(w => w.add(1, 'week'));

  // Filter calData client-side by employee name search
  const filteredCalData = useMemo(() => {
    if (!calData || !searchEmp) return calData;
    const q = searchEmp.toLowerCase();
    const filterEntry = (e) => (e.personnel_name || '').toLowerCase().includes(q);
    const days = {};
    Object.entries(calData.days || {}).forEach(([k, arr]) => {
      const filtered = arr.filter(filterEntry);
      if (filtered.length > 0) days[k] = filtered;
    });
    return {
      days,
      spans: (calData.spans || []).filter(filterEntry),
    };
  }, [calData, searchEmp]);

  const handleEntryClick = useCallback((entry) => {
    setDrawerEntry(entry);
  }, []);

  const handleDayClick = useCallback((dateStr, entries) => {
    setDayDrawer({ dateStr, entries });
  }, []);

  // Export filtered spans as CSV
  const handleExport = () => {
    const spans = filteredCalData?.spans || [];
    exportCSV(spans, `team-calendar-${calMonth.format('YYYY-MM')}.csv`);
  };

  return (
    <div style={{ padding: '0 0 20px' }}>
      {/* Filter / Nav bar */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 12,
      }}>
        {/* View switcher */}
        <div style={{
          display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2, flexShrink: 0,
        }}>
          {[
            { key: 'month',    icon: <CalendarOutlined />,    label: 'Month'    },
            { key: 'week',     icon: <UnorderedListOutlined />, label: 'Week'   },
            { key: 'timeline', icon: <BarChartOutlined />,    label: 'Timeline' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: view === v.key ? '#fff' : 'transparent',
                border: 'none', borderRadius: 6, padding: '5px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                color: view === v.key ? '#2563eb' : '#64748b',
                boxShadow: view === v.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {/* Month navigation (month/timeline view) */}
        {(view === 'month' || view === 'timeline') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button size="small" icon={<LeftOutlined />} onClick={prevMonth} style={{ borderRadius: 6 }} />
            <DatePicker
              picker="month"
              value={calMonth}
              onChange={v => setCalMonth(v.startOf('month'))}
              allowClear={false}
              style={{ width: 130 }}
              format="MMMM YYYY"
              size="small"
            />
            <Button size="small" icon={<RightOutlined />} onClick={nextMonth} style={{ borderRadius: 6 }} />
          </div>
        )}

        {/* Week navigation */}
        {view === 'week' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button size="small" icon={<LeftOutlined />} onClick={prevWeek} style={{ borderRadius: 6 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', padding: '0 6px' }}>
              {weekStart.format('D MMM')} – {weekStart.add(6, 'day').format('D MMM YYYY')}
            </span>
            <Button size="small" icon={<RightOutlined />} onClick={nextWeek} style={{ borderRadius: 6 }} />
          </div>
        )}

        {/* Today button */}
        <Button
          size="small" icon={<AimOutlined />} onClick={goToday}
          style={{ borderRadius: 6, fontWeight: 600 }}
        >
          Today
        </Button>

        <div style={{ height: 20, width: 1, background: '#e2e8f0', flexShrink: 0 }} />

        {/* Filters */}
        <Input
          placeholder="Search employee…"
          prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
          value={searchEmp}
          onChange={e => setSearchEmp(e.target.value)}
          allowClear
          size="small"
          style={{ width: 160, borderRadius: 7 }}
        />
        <Select
          placeholder="Leave type" allowClear size="small"
          style={{ width: 130 }}
          value={filterType} onChange={setFilterType}
          options={leaveTypes.map(lt => ({
            value: lt.code,
            label: <span style={{ fontSize: 11, fontWeight: 600 }}>{lt.name}</span>,
          }))}
        />
        <Select
          placeholder="Department" allowClear size="small" showSearch optionFilterProp="label"
          style={{ width: 150 }}
          value={filterDept} onChange={setFilterDept}
          options={deptOptions}
        />

        {(filterType || filterDept || searchEmp) && (
          <Button
            size="small" style={{ borderRadius: 6 }}
            onClick={() => { setFilterType(null); setFilterDept(null); setSearchEmp(''); }}
          >
            Clear filters
          </Button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Tooltip title="Export CSV">
            <Button size="small" icon={<DownloadOutlined />} onClick={handleExport} style={{ borderRadius: 7 }} />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button size="small" icon={<ReloadOutlined />} onClick={refetchCal} loading={calLoading} style={{ borderRadius: 7 }} />
          </Tooltip>
        </div>
      </div>

      {/* Summary stats bar */}
      {!calLoading && filteredCalData && (
        <SummaryBar calData={filteredCalData} leaveTypes={leaveTypes} today={today} />
      )}

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {leaveTypes.map(lt => {
          const { bg, text, border } = typeStyle(lt.code);
          const count = (filteredCalData?.spans || []).filter(s => s.leave_type === lt.code).length;
          if (count === 0) return null;
          return (
            <button
              key={lt.code}
              onClick={() => setFilterType(f => f === lt.code ? null : lt.code)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: filterType === lt.code ? bg : '#f8fafc',
                color: filterType === lt.code ? text : '#64748b',
                border: `1px solid ${filterType === lt.code ? border : '#e2e8f0'}`,
                borderRadius: 20, padding: '3px 10px', cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              {lt.name}
              <span style={{
                background: filterType === lt.code ? text : '#e2e8f0',
                color: filterType === lt.code ? bg : '#64748b',
                borderRadius: 10, padding: '0 5px', fontSize: 10,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Calendar body */}
      {calLoading ? (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300,
        }}>
          <Spin size="large" />
        </div>
      ) : !filteredCalData || (!Object.keys(filteredCalData?.days || {}).length && !filteredCalData?.spans?.length) ? (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200,
          flexDirection: 'column', gap: 12,
        }}>
          <CalendarOutlined style={{ fontSize: 36, color: '#cbd5e1' }} />
          <Text type="secondary" style={{ fontSize: 13 }}>No approved leaves in this period</Text>
        </div>
      ) : (
        <>
          {view === 'month' && (
            <MonthView
              calMonth={calMonth}
              calData={filteredCalData}
              leaveTypes={leaveTypes}
              onDayClick={handleDayClick}
              onEntryClick={handleEntryClick}
              filterType={filterType}
              filterDept={filterDept}
            />
          )}
          {view === 'week' && (
            <WeekView
              weekStart={weekStart}
              calData={filteredCalData}
              leaveTypes={leaveTypes}
              onEntryClick={handleEntryClick}
            />
          )}
          {view === 'timeline' && (
            <TimelineView
              calMonth={calMonth}
              calData={filteredCalData}
              leaveTypes={leaveTypes}
              onEntryClick={handleEntryClick}
              filterDept={filterDept}
              filterType={filterType}
            />
          )}
        </>
      )}

      {/* Day detail drawer */}
      <Drawer
        title={
          dayDrawer && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                {dayjs(dayDrawer.dateStr).format('dddd, D MMMM YYYY')}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {dayDrawer.entries.length} employee{dayDrawer.entries.length !== 1 ? 's' : ''} on leave
              </div>
            </div>
          )
        }
        open={!!dayDrawer}
        onClose={() => setDayDrawer(null)}
        width={380}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(dayDrawer?.entries || []).map((e, i) => {
            const typeName = leaveTypes.find(lt => lt.code === e.leave_type)?.name || e.leave_type;
            const { bg, text, border } = typeStyle(e.leave_type);
            return (
              <div
                key={i}
                onClick={() => { setDrawerEntry(e); setDayDrawer(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={el => el.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={el => el.currentTarget.style.background = '#f8fafc'}
              >
                <Avatar size={34} style={{ background: avatarColor(e.personnel_name), fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {initials(e.personnel_name)}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.personnel_name}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    {e.department_name || e.emp_code || ''}
                    {e.department_name && e.emp_code ? ' · ' + e.emp_code : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, background: bg, color: text,
                    border: `1px solid ${border}`, borderRadius: 5, padding: '2px 7px', display: 'block',
                  }}>
                    {typeName}
                  </span>
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                    until {dayjs(e.end_date).format('D MMM')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Drawer>

      {/* Leave detail drawer */}
      <LeaveDetailDrawer
        entry={drawerEntry}
        leaveTypes={leaveTypes}
        onClose={() => setDrawerEntry(null)}
      />
    </div>
  );
};

export default TeamCalendar;
