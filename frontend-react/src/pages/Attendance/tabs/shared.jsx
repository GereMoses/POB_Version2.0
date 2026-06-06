import React from 'react';
import { Space, Checkbox, Avatar } from 'antd';

/* ── Shift type config ───────────────────────────────────────────────────── */
export const SHIFT_CFG = {
  MORNING:  { bg: '#fff7e6', border: '#ffd591', text: '#d46b08', accent: '#fa8c16', tag: 'orange'   },
  EVENING:  { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab', accent: '#722ed1', tag: 'purple'   },
  NIGHT:    { bg: '#e6f4ff', border: '#91caff', text: '#0958d9', accent: '#1677ff', tag: 'blue'     },
  ROTATING: { bg: '#e6fffb', border: '#87e8de', text: '#006d75', accent: '#13c2c2', tag: 'cyan'     },
  CUSTOM:   { bg: '#f0f5ff', border: '#adc6ff', text: '#1d39c4', accent: '#2f54eb', tag: 'geekblue' },
  DEFAULT:  { bg: '#fafafa', border: '#d9d9d9', text: '#595959', accent: '#8c8c8c', tag: 'default'  },
};

/** Return the config for a shift type, falling back to DEFAULT. */
export const shiftCfg = (type) => SHIFT_CFG[type] || SHIFT_CFG.DEFAULT;

/* ── Roster / Cycle lookup tables ────────────────────────────────────────── */
export const CYCLE_UNIT   = { 0: 'Daily', 1: 'Weekly', 2: 'Monthly' };
export const CYCLE_COLOR  = { 0: '#52c41a', 1: '#1890ff', 2: '#722ed1' };
export const ROSTER_TYPE  = { 0: 'Regular', 1: 'Rotating', 2: 'Flexible' };
export const ROSTER_COLOR = { 0: 'blue', 1: 'orange', 2: 'cyan' };
export const ROSTER_HEX   = { 0: '#1890ff', 1: '#fa8c16', 2: '#13c2c2' };

export const SHIFT_TYPES  = ['MORNING', 'EVENING', 'NIGHT', 'ROTATING', 'CUSTOM'];
export const DAYS         = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ── Time helpers ────────────────────────────────────────────────────────── */
/** Format "HH:mm:ss" → "HH:mm", returns "—" for falsy input. */
export const fmtT = (t) => (t ? t.slice(0, 5) : '—');

/** Convert "HH:mm" or "HH:mm:ss" to total minutes since midnight. */
export const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

/** Parse work_days string ("12345", "Mon,Tue,…") to an array of index strings "1"–"7". */
export function parseWorkDays(wd = '') {
  if (!wd) return ['1', '2', '3', '4', '5'];
  if (/^[0-9]+$/.test(wd)) return wd.split('');
  const nameMap = { Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6', Sun: '7' };
  return wd.split(',').map(d => nameMap[d.trim()]).filter(Boolean);
}

/* ── DayBadges ───────────────────────────────────────────────────────────── */
/**
 * Row of Mon–Sun badges, active days highlighted in the given accent colour.
 * @param {string} value  work_days string ("12345" or "Mon,Tue,…")
 * @param {string} accent hex colour for active badges
 */
export const DayBadges = ({ value = '', accent = '#1890ff' }) => (
  <Space size={3}>
    {DAYS.map((d, i) => {
      const active = value.includes(String(i + 1)) || value.includes(d.slice(0, 3));
      return (
        <span key={d} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 20, borderRadius: 3, fontSize: 10, fontWeight: 600,
          background: active ? accent : '#f5f5f5',
          color:      active ? '#fff'  : '#bfbfbf',
          border:     `1px solid ${active ? accent : '#d9d9d9'}`,
        }}>
          {d.slice(0, 2)}
        </span>
      );
    })}
  </Space>
);

/* ── BioTime verify type map ─────────────────────────────────────────────── */
export const VERIFY_TYPE = {
  0:   { label: 'Password',    color: 'default', bg: '#f0f0f0' },
  1:   { label: 'Password',    color: 'default', bg: '#f0f0f0' },
  3:   { label: 'Fingerprint', color: 'blue',    bg: '#e6f4ff' },
  4:   { label: 'Fingerprint', color: 'blue',    bg: '#e6f4ff' },
  11:  { label: 'Face',        color: 'purple',  bg: '#f9f0ff' },
  15:  { label: 'Face',        color: 'purple',  bg: '#f9f0ff' },
  30:  { label: 'Card',        color: 'cyan',    bg: '#e6fffb' },
  200: { label: 'Mobile',      color: 'green',   bg: '#f6ffed' },
};

/* ── BioTime punch state map ─────────────────────────────────────────────── */
export const PUNCH_STATE = {
  0:   { label: 'Check-in',    status: 'success',    color: '#52c41a' },
  1:   { label: 'Check-out',   status: 'error',      color: '#f5222d' },
  2:   { label: 'Break-out',   status: 'warning',    color: '#fa8c16' },
  3:   { label: 'Break-in',    status: 'processing', color: '#1890ff' },
  4:   { label: 'OT-in',       status: 'default',    color: '#722ed1' },
  5:   { label: 'OT-out',      status: 'default',    color: '#eb2f96' },
  255: { label: 'Auto-detect', status: 'default',    color: '#13c2c2' },
};

export const vLabel = (v) => VERIFY_TYPE[v] || { label: `Type ${v}`,  color: 'default', bg: '#fafafa' };
export const pState = (s) => PUNCH_STATE[s] || { label: `State ${s}`, status: 'default', color: '#8c8c8c' };

/* Resolve effective punch type for display, using server-classified direction for state-255. */
export const resolvedPunchState = (punch_state, classified_direction) => {
  if (punch_state !== 255 && punch_state !== undefined && punch_state !== null) {
    return pState(punch_state);
  }
  if (classified_direction === 'in')  return { label: 'Check-in ↑',  status: 'success',    color: '#52c41a', inferred: true };
  if (classified_direction === 'out') return { label: 'Check-out ↓', status: 'error',      color: '#f5222d', inferred: true };
  return { label: 'Auto-detect', status: 'default', color: '#13c2c2', inferred: false };
};

/* ── ColTogglePopover ────────────────────────────────────────────────────── */
export const ColTogglePopover = ({ colDefs, hidden, onToggle }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', padding: '4px 0', minWidth: 220 }}>
    {colDefs.map(c => (
      <Checkbox key={c.key} checked={!hidden.has(c.key)} onChange={() => onToggle(c.key)} style={{ fontSize: 12 }}>
        {c.title || c.key}
      </Checkbox>
    ))}
  </div>
);

/* ── TimeBar ─────────────────────────────────────────────────────────────── */
/**
 * Proportional 24-hour bar showing where startTime–endTime falls in the day.
 * @param {string}        startTime  "HH:mm" or "HH:mm:ss"
 * @param {string}        endTime    "HH:mm" or "HH:mm:ss"
 * @param {string}        color      fill colour
 * @param {string|number} width      CSS width (default "100%")
 */
/* ── Avatar / Employee helpers ───────────────────────────────────────────── */
export const AVATAR_PALETTE = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#0284c7','#16a34a'];
export const avatarColor = (str) => AVATAR_PALETTE[(str||'').split('').reduce((a,c) => a + c.charCodeAt(0), 0) % AVATAR_PALETTE.length];
export const initials    = (name) => (name||'').split(' ').filter(Boolean).slice(0,2).map(p => p[0].toUpperCase()).join('') || '?';

/* ── Shared table container style ────────────────────────────────────────── */
export const tableContainerStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

/* ── EmployeeCell ────────────────────────────────────────────────────────── */
export const EmployeeCell = ({ name, code, dept, onClick }) => (
  <div
    style={{ display:'flex', alignItems:'center', gap:10, cursor: onClick ? 'pointer' : 'default' }}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
  >
    <Avatar size={32} style={{ background: avatarColor(name||code), flexShrink:0, fontSize:12, fontWeight:600 }}>
      {initials(name)}
    </Avatar>
    <div style={{ minWidth:0 }}>
      <div style={{ fontWeight:600, fontSize:13, color: onClick ? '#1890ff' : '#1f1f1f', lineHeight:1.3 }}>
        {name || `#${code}`}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
        <span style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:3, padding:'0 4px', fontFamily:'monospace', fontSize:10, color:'#64748b' }}>
          {code}
        </span>
        {dept && <span style={{ fontSize:11, color:'#94a3b8' }}>{dept}</span>}
      </div>
    </div>
  </div>
);

export const TimeBar = ({ startTime, endTime, color = '#1890ff', width = '100%' }) => {
  const startMin = toMin(startTime);
  const endMin   = toMin(endTime);
  const isNight  = endMin > 0 && endMin < startMin;
  const leftPct  = (startMin / 1440) * 100;
  const widthPct = isNight
    ? ((1440 - startMin + endMin) / 1440) * 100
    : Math.max(((endMin - startMin) / 1440) * 100, 0);

  return (
    <div style={{
      position: 'relative', height: 6,
      background: '#f0f0f0', borderRadius: 3,
      width, overflow: 'visible',
    }}>
      <div style={{
        position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`,
        height: '100%', background: color, borderRadius: 3, minWidth: 4,
      }} />
      {[0, 25, 50, 75, 100].map(p => (
        <div key={p} style={{
          position: 'absolute', left: `${p}%`, top: -2,
          width: 1, height: 10,
          background: p === 0 || p === 100 ? '#bfbfbf' : '#e8e8e8',
        }} />
      ))}
    </div>
  );
};
