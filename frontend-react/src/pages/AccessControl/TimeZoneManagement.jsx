import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Button, Input, Tag, Tooltip, Popconfirm, App, Badge,
  Empty, Spin, Switch, Divider, Space,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined,
  SaveOutlined, CloseOutlined, SearchOutlined, ReloadOutlined,
  WarningOutlined, CheckOutlined, CopyOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

// ── constants ─────────────────────────────────────────────────────────────────
const DAYS = [
  { key: 'mon', label: 'Monday',    short: 'Mon', type: 'week' },
  { key: 'tue', label: 'Tuesday',   short: 'Tue', type: 'week' },
  { key: 'wed', label: 'Wednesday', short: 'Wed', type: 'week' },
  { key: 'thu', label: 'Thursday',  short: 'Thu', type: 'week' },
  { key: 'fri', label: 'Friday',    short: 'Fri', type: 'week' },
  { key: 'sat', label: 'Saturday',  short: 'Sat', type: 'weekend' },
  { key: 'sun', label: 'Sunday',    short: 'Sun', type: 'weekend' },
  { key: 'hol1', label: 'Holiday 1', short: 'H1', type: 'holiday' },
  { key: 'hol2', label: 'Holiday 2', short: 'H2', type: 'holiday' },
  { key: 'hol3', label: 'Holiday 3', short: 'H3', type: 'holiday' },
];

const PERIOD_COLORS = ['#1677ff', '#52c41a', '#fa8c16'];
const PERIOD_BG     = ['rgba(22,119,255,0.18)', 'rgba(82,196,26,0.18)', 'rgba(250,140,22,0.18)'];
const TZ_RE = /^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const HOUR_MARKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

const C = {
  blue:'#1677ff', blueBg:'#e6f4ff', blueBd:'#91caff',
  green:'#52c41a', orange:'#fa8c16', purple:'#722ed1',
  text:'#1d2939', sub:'#6b7280',
  border:'#e4e7ec', surface:'#f9fafb', white:'#ffffff',
};

// ── helpers ───────────────────────────────────────────────────────────────────
const toMin = t => {
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length < 2) return null;
  return +parts[0] * 60 + +parts[1];
};

const parsePeriod = str => {
  if (!str || !TZ_RE.test(str.trim())) return null;
  const [s, e] = str.trim().split('-');
  const start = toMin(s), end = toMin(e);
  if (start == null || end == null || end <= start) return null;
  return { start, end, str: str.trim() };
};

const pct = min => `${((min / 1440) * 100).toFixed(3)}%`;

const dayPeriods = (record, dayKey) =>
  [1, 2, 3].map(n => record?.[`${dayKey}_time${n}`] || '').filter(Boolean);

const summarise = record => {
  const active = DAYS.slice(0, 7).filter(d => dayPeriods(record, d.key).length > 0);
  if (!active.length) return 'No schedule';
  const first = active[0];
  const p     = dayPeriods(record, first.key)[0];
  return `${active.length}d · ${p}`;
};

// ── 24-hour visual timeline bar ───────────────────────────────────────────────
const TimeBar = ({ dayKey, periods, height = 22 }) => {
  const segments = periods.map((s, i) => ({ ...parsePeriod(s), i })).filter(Boolean);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Bar background */}
      <div style={{
        position: 'relative', height, borderRadius: 5,
        background: '#f0f0f0', overflow: 'hidden',
        border: '1px solid #e0e0e0',
      }}>
        {segments.map(seg => (
          <div key={seg.i} style={{
            position: 'absolute',
            left: pct(seg.start), width: pct(seg.end - seg.start),
            top: 0, bottom: 0,
            background: PERIOD_COLORS[seg.i],
            opacity: 0.85,
            borderRadius: 3,
          }} />
        ))}
        {/* Hour grid lines */}
        {HOUR_MARKS.slice(1, -1).map(h => (
          <div key={h} style={{
            position: 'absolute', left: pct(h * 60),
            top: 0, bottom: 0, width: 1,
            background: 'rgba(0,0,0,0.08)',
          }} />
        ))}
      </div>
      {/* Hour labels */}
      <div style={{ position: 'relative', height: 14, marginTop: 1 }}>
        {HOUR_MARKS.map(h => (
          <span key={h} style={{
            position: 'absolute',
            left: pct(h * 60),
            transform: h === 0 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)',
            fontSize: 9, color: '#bfbfbf', lineHeight: 1,
          }}>
            {h === 24 ? '24' : `${h}`}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── per-day row in the schedule editor ───────────────────────────────────────
const DayRow = ({ day, periods, onChange, editMode }) => {
  const typeColor = {
    week:    C.blue,
    weekend: C.orange,
    holiday: C.purple,
  }[day.type];

  const typeBg = {
    week:    '#e6f4ff',
    weekend: '#fff7e6',
    holiday: '#f9f0ff',
  }[day.type];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '96px 1fr',
      gap: 12,
      padding: '10px 0',
      borderBottom: `1px solid ${C.border}`,
      alignItems: 'start',
    }}>
      {/* Day label */}
      <div style={{ paddingTop: 2 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: typeBg,
          border: `1px solid ${typeColor}33`,
          borderRadius: 6, padding: '2px 8px',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: typeColor }}>{day.short}</span>
        </div>
        <div style={{ fontSize: 10, color: C.sub, marginTop: 3, paddingLeft: 2 }}>{day.label}</div>
      </div>

      {/* Timeline + inputs */}
      <div>
        <TimeBar dayKey={day.key} periods={periods} />
        {editMode && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {[0, 1, 2].map(n => {
              const val = periods[n] || '';
              const valid = !val || TZ_RE.test(val);
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: PERIOD_COLORS[n], flexShrink: 0 }} />
                  <Input
                    size="small"
                    value={val}
                    placeholder="08:00-17:00"
                    status={val && !valid ? 'error' : ''}
                    style={{
                      width: 115, fontFamily: 'monospace', fontSize: 11, borderRadius: 5,
                      borderColor: val && !valid ? '#ff4d4f' : val ? PERIOD_COLORS[n] : undefined,
                    }}
                    onChange={e => {
                      const next = [...periods];
                      next[n] = e.target.value;
                      onChange(next);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        {!editMode && periods.length === 0 && (
          <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 2 }}>No access this day</div>
        )}
        {!editMode && periods.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {periods.map((p, i) => (
              <span key={i} style={{
                fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                color: PERIOD_COLORS[i], background: PERIOD_BG[i],
                border: `1px solid ${PERIOD_COLORS[i]}44`,
                borderRadius: 4, padding: '1px 7px',
              }}>{p}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── small stat ────────────────────────────────────────────────────────────────
const Stat = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{label}</div>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const TimeZoneManagement = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [selId,    setSelId]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [editMode, setEditMode] = useState(false);
  const [isNew,    setIsNew]    = useState(false);

  // local draft state for the right-panel editor
  const [draftName,      setDraftName]      = useState('');
  const [draftOverride,  setDraftOverride]  = useState(false);
  const [draftSchedule,  setDraftSchedule]  = useState({}); // { dayKey: [p1,p2,p3] }

  // ── queries ────────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['acc-timezones'],
    queryFn: () => apiService.get('/api/access-control/timezones/'),
  });
  const rows = useMemo(() => data?.data || [], [data]);
  const selZone = rows.find(r => r.id === selId) || null;

  // ── seed draft from selected zone ─────────────────────────────────────────
  useEffect(() => {
    if (selZone && !isNew) {
      setDraftName(selZone.timezone_name || '');
      setDraftOverride(!!selZone.emergency_override);
      const sched = {};
      DAYS.forEach(d => {
        sched[d.key] = [1, 2, 3].map(n => selZone[`${d.key}_time${n}`] || '');
      });
      setDraftSchedule(sched);
    }
  }, [selZone, isNew]);

  const setDayPeriods = useCallback((dayKey, arr) => {
    setDraftSchedule(prev => ({ ...prev, [dayKey]: arr }));
  }, []);

  // ── build API payload from draft ──────────────────────────────────────────
  const buildPayload = () => {
    const payload = {
      timezone_name:      draftName,
      emergency_override: draftOverride,
    };
    DAYS.forEach(d => {
      const periods = draftSchedule[d.key] || ['', '', ''];
      [0, 1, 2].forEach(n => {
        const val = (periods[n] || '').trim();
        payload[`${d.key}_time${n + 1}`] = TZ_RE.test(val) ? val : null;
      });
    });
    return payload;
  };

  // ── mutations ──────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      return isNew
        ? apiService.post('/api/access-control/timezones/', payload)
        : apiService.put(`/api/access-control/timezones/${selId}`, payload);
    },
    onSuccess: (res) => {
      message.success(isNew ? 'Time zone created' : 'Changes saved');
      qc.invalidateQueries(['acc-timezones']);
      setEditMode(false);
      if (isNew && res?.data?.id) setSelId(res.data.id);
      setIsNew(false);
    },
    onError: e => message.error(e?.message || 'Error saving'),
  });

  const del = useMutation({
    mutationFn: (id) => apiService.delete(`/api/access-control/timezones/${id}`),
    onSuccess: () => {
      message.success('Deleted');
      qc.invalidateQueries(['acc-timezones']);
      setSelId(null); setEditMode(false);
    },
    onError: e => message.error(e?.message || 'Cannot delete — in use by an access level'),
  });

  const copyZone = useMutation({
    mutationFn: async () => {
      if (!selZone) return;
      const payload = buildPayload();
      payload.timezone_name = `Copy of ${selZone.timezone_name}`;
      return apiService.post('/api/access-control/timezones/', payload);
    },
    onSuccess: (res) => {
      message.success('Copied');
      qc.invalidateQueries(['acc-timezones']);
      if (res?.data?.id) setSelId(res.data.id);
    },
    onError: e => message.error(e?.message || 'Error'),
  });

  // ── helpers ────────────────────────────────────────────────────────────────
  const startNew = () => {
    const emptySchedule = {};
    DAYS.forEach(d => { emptySchedule[d.key] = ['', '', '']; });
    setDraftName('');
    setDraftOverride(false);
    setDraftSchedule(emptySchedule);
    setIsNew(true); setEditMode(true); setSelId(null);
  };

  const cancelEdit = () => {
    if (isNew) { setIsNew(false); setSelId(null); }
    setEditMode(false);
    // restore from selZone
    if (selZone) {
      setDraftName(selZone.timezone_name || '');
      setDraftOverride(!!selZone.emergency_override);
      const sched = {};
      DAYS.forEach(d => { sched[d.key] = [1,2,3].map(n => selZone[`${d.key}_time${n}`] || ''); });
      setDraftSchedule(sched);
    }
  };

  const filtered = useMemo(() =>
    rows.filter(r => (r.timezone_name || '').toLowerCase().includes(search.toLowerCase())),
    [rows, search]);

  const stats = useMemo(() => ({
    total:    rows.length,
    override: rows.filter(r => r.emergency_override).length,
    active:   rows.filter(r => DAYS.slice(0,7).some(d => dayPeriods(r, d.key).length > 0)).length,
  }), [rows]);

  // active period count for selected zone
  const activeDays = useMemo(() => {
    if (!selZone && !isNew) return 0;
    const src = isNew ? draftSchedule : selZone;
    if (!src) return 0;
    return DAYS.slice(0, 7).filter(d => {
      const periods = isNew
        ? (draftSchedule[d.key] || []).filter(p => TZ_RE.test((p || '').trim()))
        : dayPeriods(selZone, d.key);
      return periods.length > 0;
    }).length;
  }, [selZone, isNew, draftSchedule]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh', background: C.surface }}>

      {/* ══ LEFT — Zone list ═══════════════════════════════════════════════ */}
      <div style={{
        width: 280, flexShrink: 0,
        background: C.white, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        height: '100vh', position: 'sticky', top: 0,
      }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>Time Zones</span>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={startNew} style={{ borderRadius: 6 }}>New</Button>
          </div>
          <Input prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Search time zones…" value={search} allowClear size="small"
            onChange={e => setSearch(e.target.value)} style={{ borderRadius: 6 }} />
        </div>

        {/* stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
          {[
            { label: 'Total', value: stats.total, color: C.purple },
            { label: 'Active', value: stats.active, color: C.blue },
            { label: 'Override', value: stats.override, color: C.orange },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '8px 0', textAlign: 'center',
              borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.sub }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading && <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>}
          {!isLoading && filtered.length === 0 &&
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No time zones" style={{ marginTop: 32 }} />}
          {filtered.map(tz => {
            const sel = tz.id === selId;
            const active = DAYS.slice(0, 7).some(d => dayPeriods(tz, d.key).length > 0);
            return (
              <div key={tz.id}
                onClick={() => { setSelId(tz.id); setEditMode(false); setIsNew(false); }}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderLeft: sel ? `3px solid ${C.purple}` : '3px solid transparent',
                  background: sel ? '#f9f0ff' : 'transparent',
                  borderBottom: `1px solid ${C.border}`,
                  transition: 'background 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                    background: sel ? 'linear-gradient(135deg,#f9f0ff,#d3adf7)'
                      : 'linear-gradient(135deg,#f5f5f5,#e0e0e0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ClockCircleOutlined style={{ color: sel ? C.purple : '#8c8c8c', fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: sel ? 700 : 600, fontSize: 13,
                      color: sel ? C.purple : C.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {tz.timezone_name}
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>{summarise(tz)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                    <Badge status={active ? 'processing' : 'default'} />
                    {tz.emergency_override && (
                      <Tooltip title="Emergency Override"><WarningOutlined style={{ fontSize: 11, color: C.orange }} /></Tooltip>
                    )}
                  </div>
                </div>
                {/* Mini schedule preview */}
                <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                  {DAYS.slice(0, 7).map(d => {
                    const hasPeriod = dayPeriods(tz, d.key).length > 0;
                    return (
                      <Tooltip key={d.key} title={`${d.short}: ${hasPeriod ? dayPeriods(tz, d.key).join(', ') : 'off'}`}>
                        <div style={{
                          flex: 1, height: 5, borderRadius: 2,
                          background: hasPeriod ? C.purple : '#e0e0e0',
                          opacity: hasPeriod ? 1 : 0.4,
                        }} />
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ RIGHT — Schedule Editor ════════════════════════════════════════ */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>

        {/* placeholder */}
        {!selZone && !isNew && (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, color: C.sub, padding: 48,
          }}>
            <ClockCircleOutlined style={{ fontSize: 56, color: '#d9d9d9' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#bfbfbf' }}>Select a time zone</div>
            <div style={{ fontSize: 13 }}>Choose from the list or create a new one</div>
            <Button type="primary" icon={<PlusOutlined />} onClick={startNew} style={{ marginTop: 8 }}>
              Create Time Zone
            </Button>
          </div>
        )}

        {(selZone || isNew) && (
          <div>
            {/* ── Zone header / toolbar ───────────────────────────────── */}
            <div style={{
              background: 'linear-gradient(135deg,#13002b 0%,#2d0f5e 60%,#4a1fa3 100%)',
              padding: '18px 24px',
            }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Space size={8}>
                  {!editMode ? (
                    <>
                      <Button icon={<EditOutlined />} onClick={() => setEditMode(true)}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 7 }}>
                        Edit Schedule
                      </Button>
                      <Tooltip title="Duplicate this time zone">
                        <Button icon={<CopyOutlined />} loading={copyZone.isPending}
                          onClick={() => copyZone.mutate()}
                          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 7 }}>
                          Copy
                        </Button>
                      </Tooltip>
                      <Button icon={<ReloadOutlined />} onClick={() => refetch()}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 7 }}>
                        Refresh
                      </Button>
                      {selZone && (
                        <Popconfirm
                          title="Delete this time zone?"
                          description="It cannot be deleted if used by an access level."
                          icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                          okType="danger" okText="Delete"
                          onConfirm={() => del.mutate(selId)}
                        >
                          <Button danger icon={<DeleteOutlined />} style={{ borderRadius: 7 }}>Delete</Button>
                        </Popconfirm>
                      )}
                    </>
                  ) : (
                    <>
                      <Button type="primary" icon={<SaveOutlined />} loading={save.isPending}
                        onClick={() => save.mutate()}
                        style={{ borderRadius: 7 }}>
                        {isNew ? 'Create Time Zone' : 'Save Changes'}
                      </Button>
                      <Button icon={<CloseOutlined />} onClick={cancelEdit}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 7 }}>
                        Cancel
                      </Button>
                    </>
                  )}
                </Space>
                <Space size={6}>
                  {draftOverride && <Tag color="warning" icon={<WarningOutlined />}>Emergency Override</Tag>}
                  {isNew && <Tag color="purple">New</Tag>}
                </Space>
              </div>

              {/* Name + override */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 11, flexShrink: 0,
                  background: 'linear-gradient(135deg,#722ed1,#9254de)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                }}>
                  <ClockCircleOutlined style={{ color: 'white', fontSize: 22 }} />
                </div>
                <div style={{ flex: 1 }}>
                  {editMode ? (
                    <Input
                      value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      placeholder="Time zone name *"
                      size="large"
                      style={{ borderRadius: 8, fontWeight: 700, maxWidth: 360 }}
                    />
                  ) : (
                    <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>
                      {draftName || (isNew ? 'New Time Zone' : '')}
                    </div>
                  )}
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4 }}>
                    {isNew ? 'Configure daily access windows below' : `${activeDays} active day${activeDays !== 1 ? 's' : ''} this week`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Emergency Override</span>
                  <Switch
                    checked={draftOverride}
                    onChange={v => setEditMode(true) || setDraftOverride(v)}
                    checkedChildren={<WarningOutlined />}
                    unCheckedChildren={<CloseOutlined />}
                    disabled={!editMode && !isNew}
                    style={{ background: draftOverride ? C.orange : undefined }}
                  />
                </div>
              </div>

              {/* Summary chips */}
              {!isNew && selZone && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DAYS.slice(0, 7).map(d => {
                    const periods = dayPeriods(selZone, d.key);
                    return (
                      <div key={d.key} style={{
                        background: periods.length ? 'rgba(114,46,209,0.25)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${periods.length ? 'rgba(146,84,222,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 6, padding: '3px 10px',
                      }}>
                        <span style={{ color: periods.length ? '#d3adf7' : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: periods.length ? 600 : 400 }}>
                          {d.short} {periods.length ? `✓` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Schedule grid ─────────────────────────────────────────── */}
            <div style={{ padding: '20px 24px', background: C.white }}>

              {/* How-to banner in edit mode */}
              {editMode && (
                <div style={{
                  background: '#f9f0ff', border: '1px solid #d3adf7',
                  borderRadius: 8, padding: '9px 14px', marginBottom: 16,
                  fontSize: 12, color: C.purple,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <ClockCircleOutlined />
                  <span>
                    Enter periods as <strong style={{ fontFamily: 'monospace' }}>HH:MM-HH:MM</strong>.
                    Up to 3 non-overlapping periods per day.
                    The timeline updates as you type.
                  </span>
                </div>
              )}

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                {[0, 1, 2].map(n => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.sub }}>
                    <div style={{ width: 14, height: 10, borderRadius: 2, background: PERIOD_COLORS[n] }} />
                    Period {n + 1}
                  </div>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11, color: C.sub }}>← 00:00 ─────────────────────────── 24:00 →</div>
              </div>

              {/* Weekdays */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 2 }}>
                Weekdays
              </div>
              {DAYS.filter(d => d.type === 'week').map(day => (
                <DayRow
                  key={day.key} day={day}
                  periods={editMode
                    ? (draftSchedule[day.key] || ['', '', ''])
                    : dayPeriods(isNew ? {} : (selZone || {}), day.key)}
                  onChange={arr => setDayPeriods(day.key, arr)}
                  editMode={editMode}
                />
              ))}

              <Divider style={{ margin: '12px 0' }} />

              {/* Weekend */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 2 }}>
                Weekend
              </div>
              {DAYS.filter(d => d.type === 'weekend').map(day => (
                <DayRow
                  key={day.key} day={day}
                  periods={editMode
                    ? (draftSchedule[day.key] || ['', '', ''])
                    : dayPeriods(isNew ? {} : (selZone || {}), day.key)}
                  onChange={arr => setDayPeriods(day.key, arr)}
                  editMode={editMode}
                />
              ))}

              <Divider style={{ margin: '12px 0' }} />

              {/* Holidays */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 2 }}>
                Holiday Overrides
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>
                When a public holiday is declared, these windows override the weekday schedule.
              </div>
              {DAYS.filter(d => d.type === 'holiday').map(day => (
                <DayRow
                  key={day.key} day={day}
                  periods={editMode
                    ? (draftSchedule[day.key] || ['', '', ''])
                    : dayPeriods(isNew ? {} : (selZone || {}), day.key)}
                  onChange={arr => setDayPeriods(day.key, arr)}
                  editMode={editMode}
                />
              ))}

              {/* Save footer in edit mode */}
              {editMode && (
                <div style={{
                  marginTop: 20, padding: '14px 0', borderTop: `1px solid ${C.border}`,
                  display: 'flex', gap: 10, justifyContent: 'flex-end',
                }}>
                  <Button onClick={cancelEdit} icon={<CloseOutlined />}>Cancel</Button>
                  <Button type="primary" size="large" icon={<SaveOutlined />}
                    loading={save.isPending} onClick={() => save.mutate()}
                    style={{ borderRadius: 8, minWidth: 140 }}>
                    {isNew ? 'Create Time Zone' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeZoneManagement;
