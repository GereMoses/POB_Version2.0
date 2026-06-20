import React, { useState, useMemo } from 'react';
import {
  Table, Card, Button, Space, Tag, App, Form, Drawer,
  Input, Select, InputNumber, Row, Col, Divider, Tooltip,
  Badge, Popconfirm, Typography, Switch, TimePicker, Empty, Segmented,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined,
  EyeOutlined, ReloadOutlined, ClockCircleOutlined, RetweetOutlined,
  FieldTimeOutlined, TagOutlined, SafetyCertificateOutlined,
  AppstoreOutlined, BarsOutlined, SearchOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import {
  SHIFT_CFG, SHIFT_TYPES, CYCLE_UNIT, CYCLE_COLOR,
  ROSTER_TYPE, ROSTER_COLOR, ROSTER_HEX, DAYS,
  fmtT, toMin, parseWorkDays, DayBadges, TimeBar,
} from './shared';

const { Option } = Select;
const { Text } = Typography;

/* ── Shift Card ─────────────────────────────────────────────────────────── */
const ShiftCard = ({ rec, onView, onEdit, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const type     = rec.shift_type || 'CUSTOM';
  const cfg      = SHIFT_CFG[type] || SHIFT_CFG.CUSTOM;
  const rosterType = rec.roster_type ?? 0;
  const isActive = rec.is_active !== false;
  const activeDays = parseWorkDays(rec.work_days || rec.days_of_week || '').length;

  return (
    <Card
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        border: `1.5px solid ${hovered ? cfg.accent : cfg.border}`,
        boxShadow: hovered ? `0 6px 20px ${cfg.accent}22` : '0 1px 4px #0000000a',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}
      styles={{ body: { padding: 0 } }}
    >
      {/* Top accent strip */}
      <div style={{ height: 4, background: cfg.accent }} />

      <div style={{ padding: '14px 16px 12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <div style={{
              fontWeight: 700, fontSize: 14, color: '#1f1f1f', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {rec.alias || rec.name}
            </div>
            {rec.shift_code && (
              <span style={{
                fontFamily: 'monospace', fontSize: 10, color: '#8c8c8c',
                background: '#f5f5f5', borderRadius: 3, padding: '0 5px',
                marginTop: 3, display: 'inline-block', border: '1px solid #e8e8e8',
              }}>
                {rec.shift_code}
              </span>
            )}
          </div>
          <Space size={3} style={{ flexShrink: 0 }}>
            <Tag color={cfg.tag} style={{ margin: 0, fontSize: 10, lineHeight: '18px', padding: '0 5px' }}>
              {type}
            </Tag>
            <Tag
              color={isActive ? 'success' : 'default'}
              style={{ margin: 0, fontSize: 10, lineHeight: '18px', padding: '0 5px' }}
            >
              {isActive ? 'Active' : 'Off'}
            </Tag>
          </Space>
        </div>

        {/* Timing block */}
        <div style={{
          background: `${cfg.accent}10`, borderRadius: 8,
          padding: '8px 10px', marginBottom: 10,
          border: `1px solid ${cfg.accent}25`,
        }}>
          {rec.start_time ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: cfg.text }}>{fmtT(rec.start_time)}</span>
                <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500 }}>
                  {rec.working_hours ? `${rec.working_hours}h` : ''}
                  {rec.break_duration > 0 ? ` · ${rec.break_duration}m break` : ''}
                  {rec.is_night_shift ? ' 🌙' : ''}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: cfg.text }}>{fmtT(rec.end_time)}</span>
              </div>
              <TimeBar startTime={rec.start_time} endTime={rec.end_time} color={cfg.accent} />
            </>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>No time defined</Text>
          )}
        </div>

        {/* Work days */}
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <DayBadges value={rec.work_days || rec.days_of_week || ''} accent={cfg.accent} />
          <Text type="secondary" style={{ fontSize: 11 }}>{activeDays}/7</Text>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid #f0f0f0', paddingTop: 8,
        }}>
          <Space size={5}>
            <Tag color={ROSTER_COLOR[rosterType]} style={{ margin: 0, fontSize: 10, padding: '0 5px' }}>
              {ROSTER_TYPE[rosterType]}
            </Tag>
            {(rec.schedule_count ?? 0) > 0 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                <TeamOutlined style={{ marginRight: 2, fontSize: 10 }} />
                {rec.schedule_count}
              </Text>
            )}
            {rec.timetable_name && (
              <Tooltip title={`Timetable: ${rec.timetable_name}`}>
                <Tag style={{
                  margin: 0, fontSize: 10, padding: '0 5px',
                  background: '#e6f7ff', border: '1px solid #91d5ff', color: '#0958d9',
                }}>
                  <ClockCircleOutlined style={{ marginRight: 2 }} />
                  {rec.timetable_name.length > 10 ? rec.timetable_name.slice(0, 10) + '…' : rec.timetable_name}
                </Tag>
              </Tooltip>
            )}
          </Space>
          <Space size={0}>
            <Tooltip title="View details">
              <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => onView(rec)}
                style={{ color: '#8c8c8c' }} />
            </Tooltip>
            <Tooltip title="Edit">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(rec)}
                style={{ color: '#8c8c8c' }} />
            </Tooltip>
            <Popconfirm
              title="Delete shift pattern?"
              description="Any schedules using this pattern will also be removed."
              onConfirm={() => onDelete(rec.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </div>
      </div>
    </Card>
  );
};

/* ── Detail Drawer Content ──────────────────────────────────────────────── */
const ShiftDetail = ({ rec }) => {
  if (!rec) return null;
  const type     = rec.shift_type || 'CUSTOM';
  const cfg      = SHIFT_CFG[type] || SHIFT_CFG.CUSTOM;
  const isActive = rec.is_active !== false;
  const rosterType = rec.roster_type ?? 0;

  const RuleBox = ({ label, value, unit }) => (
    <div style={{
      background: '#fafafa', border: '1px solid #f0f0f0',
      borderRadius: 8, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1890ff', lineHeight: 1.2 }}>
        {value}
        <span style={{ fontSize: 11, fontWeight: 400, color: '#8c8c8c', marginLeft: 2 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 3 }}>{label}</div>
    </div>
  );

  const SectionLabel = ({ icon, title }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
      {icon && React.cloneElement(icon, { style: { marginRight: 5 } })}
      {title}
    </div>
  );

  return (
    <div>
      {/* Identity */}
      <div style={{
        background: cfg.bg, border: `1.5px solid ${cfg.border}`,
        borderRadius: 12, padding: '16px', marginBottom: 16, overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cfg.accent,
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#1f1f1f', lineHeight: 1.2 }}>
              {rec.alias || rec.name}
            </div>
            {rec.shift_code && (
              <span style={{
                fontFamily: 'monospace', fontSize: 12, color: cfg.text,
                background: '#fff', border: `1px solid ${cfg.border}`,
                borderRadius: 4, padding: '1px 7px', marginTop: 6, display: 'inline-block',
              }}>
                {rec.shift_code}
              </span>
            )}
          </div>
          <Space direction="vertical" align="end" size={4}>
            <Tag color={cfg.tag} style={{ margin: 0 }}>{type}</Tag>
            <Tag color={isActive ? 'success' : 'default'} style={{ margin: 0 }}>
              {isActive ? 'Active' : 'Inactive'}
            </Tag>
          </Space>
        </div>
        {rec.description && (
          <Text type="secondary" style={{ fontSize: 12, marginTop: 10, display: 'block' }}>
            {rec.description}
          </Text>
        )}
      </div>

      {/* Timing */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel icon={<ClockCircleOutlined />} title="Schedule Timing" />
        <div style={{
          background: '#f9f9f9', border: '1px solid #f0f0f0',
          borderRadius: 10, padding: '16px',
        }}>
          {rec.start_time ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: cfg.accent }}>{fmtT(rec.start_time)}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>Start</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1f1f1f' }}>
                    {rec.working_hours || '?'}h
                  </div>
                  {rec.break_duration > 0 && (
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{rec.break_duration}min break</div>
                  )}
                  <Space size={3} style={{ marginTop: 5 }}>
                    {rec.is_night_shift    && <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>Night</Tag>}
                    {rec.is_weekend_shift  && <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>Weekend</Tag>}
                    {rec.is_flexible       && <Tag color="cyan"   style={{ margin: 0, fontSize: 10 }}>Flexible</Tag>}
                  </Space>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: cfg.accent }}>{fmtT(rec.end_time)}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>End</div>
                </div>
              </div>
              <TimeBar startTime={rec.start_time} endTime={rec.end_time} color={cfg.accent} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                {['00:00', '06:00', '12:00', '18:00', '24:00'].map(t => (
                  <Text key={t} type="secondary" style={{ fontSize: 9 }}>{t}</Text>
                ))}
              </div>
            </>
          ) : (
            <Text type="secondary">No time configured for this shift</Text>
          )}
        </div>
      </div>

      {/* Work Pattern */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel icon={<RetweetOutlined />} title="Work Pattern" />
        <DayBadges value={rec.work_days || rec.days_of_week || ''} accent={cfg.accent} />
        <Space size={6} style={{ marginTop: 8 }}>
          <Tag color={ROSTER_COLOR[rosterType]} style={{ margin: 0 }}>{ROSTER_TYPE[rosterType]}</Tag>
          <span style={{
            background: `${CYCLE_COLOR[rec.cycle_unit ?? 1]}15`,
            color: CYCLE_COLOR[rec.cycle_unit ?? 1],
            border: `1px solid ${CYCLE_COLOR[rec.cycle_unit ?? 1]}40`,
            borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700,
          }}>
            {CYCLE_UNIT[rec.cycle_unit ?? 1]} ×{rec.cycle_count ?? 1}
          </span>
        </Space>
      </div>

      {/* Linked Timetable */}
      {rec.timetable_name && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel icon={<CalendarOutlined />} title="Linked Timetable" />
          <div style={{
            background: '#e6f7ff', border: '1px solid #91d5ff',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <Space>
              <ClockCircleOutlined style={{ color: '#0958d9' }} />
              <strong style={{ color: '#0958d9' }}>{rec.timetable_name}</strong>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {fmtT(rec.timetable_start)} → {fmtT(rec.timetable_end)}
              </Text>
            </Space>
            {rec.timetable_start && (
              <div style={{ marginTop: 6 }}>
                <TimeBar startTime={rec.timetable_start} endTime={rec.timetable_end} color="#0958d9" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Rules */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel icon={<SafetyCertificateOutlined />} title="Attendance Rules" />
        <Row gutter={[8, 8]}>
          <Col span={12}><RuleBox label="Grace Period"    value={rec.grace_period_minutes        ?? 15} unit="min" /></Col>
          <Col span={12}><RuleBox label="Max Late"        value={rec.max_late_minutes            ?? 60} unit="min" /></Col>
          <Col span={12}><RuleBox label="Max Early Exit"  value={rec.max_early_departure_minutes ?? 30} unit="min" /></Col>
          <Col span={12}><RuleBox label="OT Threshold"    value={rec.overtime_threshold_minutes  ?? 30} unit="min" /></Col>
        </Row>
      </div>

      {/* Schedules count */}
      {(rec.schedule_count ?? 0) > 0 && (
        <div style={{
          background: '#f6ffed', border: '1px solid #b7eb8f',
          borderRadius: 8, padding: '10px 14px',
        }}>
          <Space>
            <TeamOutlined style={{ color: '#52c41a' }} />
            <Text style={{ color: '#389e0d' }}>
              <strong>{rec.schedule_count}</strong> employee{rec.schedule_count !== 1 ? 's' : ''} currently on this shift
            </Text>
          </Space>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════ */
const ShiftsTab = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [detailOpen,   setDetailOpen]   = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [detailRec,    setDetailRec]    = useState(null);
  const [viewMode,     setViewMode]     = useState('cards');
  const [searchText,   setSearchText]   = useState('');
  const [filterType,   setFilterType]   = useState('ALL');
  const [filterActive, setFilterActive] = useState('all');
  const [form] = Form.useForm();

  /* ── queries ──────────────────────────────────────────────────────────── */
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['att-shifts'],
    queryFn: () => apiService.get('/api/v1/attendance/shifts'),
  });
  const rows = useMemo(() => {
    const r = data?.data || data || [];
    return Array.isArray(r) ? r : [];
  }, [data]);

  const { data: timetablesRaw } = useQuery({
    queryKey: ['att-timetables'],
    queryFn: () => apiService.get('/api/v1/attendance/timetables'),
    staleTime: 60000,
  });
  const timetables = useMemo(() => {
    const r = timetablesRaw?.data || timetablesRaw || [];
    return Array.isArray(r) ? r : [];
  }, [timetablesRaw]);

  /* ── mutations ────────────────────────────────────────────────────────── */
  const saveM = useMutation({
    mutationFn: (d) => editing
      ? apiService.put(`/api/v1/attendance/shifts/${editing.id}`, d)
      : apiService.post('/api/v1/attendance/shifts', d),
    onSuccess: () => {
      message.success(editing ? 'Shift pattern updated' : 'Shift pattern created');
      close_();
      qc.invalidateQueries({ queryKey: ['att-shifts'] });
    },
    onError: (e) => message.error(e?.message || 'Failed to save shift'),
  });

  const deleteM = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/attendance/shifts/${id}`),
    onSuccess: () => {
      message.success('Shift pattern deleted');
      qc.invalidateQueries({ queryKey: ['att-shifts'] });
    },
    onError: (e) => message.error(e?.message || 'Failed to delete shift'),
  });

  /* ── handlers ─────────────────────────────────────────────────────────── */
  const open_ = (rec = null) => {
    setEditing(rec); setDrawerOpen(true);
    if (rec) {
      const wd = parseWorkDays(rec.work_days || rec.days_of_week || '');
      form.setFieldsValue({
        ...rec,
        work_days:    wd,
        timetable_id: rec.timetable_id,
        start_time:   rec.start_time ? dayjs(rec.start_time, 'HH:mm:ss') : null,
        end_time:     rec.end_time   ? dayjs(rec.end_time,   'HH:mm:ss') : null,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        shift_type: 'CUSTOM', is_night_shift: false,
        is_weekend_shift: false, is_flexible: false, is_active: true,
      });
    }
  };
  const close_ = () => { setDrawerOpen(false); form.resetFields(); setEditing(null); };

  const submit = () => form.validateFields().then(v =>
    saveM.mutate({
      ...v,
      work_days:  Array.isArray(v.work_days) ? v.work_days.join('') : (v.work_days || '12345'),
      start_time: v.start_time ? v.start_time.format('HH:mm:ss') : null,
      end_time:   v.end_time   ? v.end_time.format('HH:mm:ss')   : null,
    })
  ).catch(() => {});

  /* ── filtered list ────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let r = rows;
    if (searchText) {
      const q = searchText.toLowerCase();
      r = r.filter(x =>
        (x.alias || x.name || '').toLowerCase().includes(q) ||
        (x.shift_code || '').toLowerCase().includes(q)
      );
    }
    if (filterType !== 'ALL') r = r.filter(x => (x.shift_type || 'CUSTOM') === filterType);
    if (filterActive === 'active')   r = r.filter(x => x.is_active !== false);
    if (filterActive === 'inactive') r = r.filter(x => x.is_active === false);
    return r;
  }, [rows, searchText, filterType, filterActive]);

  const activeCount    = rows.filter(r => r.is_active !== false).length;
  const scheduledCount = rows.filter(r => (r.schedule_count ?? 0) > 0).length;

  /* ── table columns ────────────────────────────────────────────────────── */
  const cols = [
    {
      title: 'Shift Pattern', key: 'alias', minWidth: 220,
      render: (_, r) => {
        const type = r.shift_type || 'CUSTOM';
        const cfg  = SHIFT_CFG[type] || SHIFT_CFG.CUSTOM;
        const isActive = r.is_active !== false;
        return (
          <button type="button"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            onClick={() => { setDetailRec(r); setDetailOpen(true); }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
              <div style={{ width: 3, borderRadius: 2, background: cfg.accent, flexShrink: 0 }} />
              <div>
                <Space size={4}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: cfg.text }}>{r.alias || r.name}</span>
                  <Tag color={cfg.tag} style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>{type}</Tag>
                  {!isActive && <Tag style={{ margin: 0, fontSize: 10 }}>Inactive</Tag>}
                </Space>
                {r.shift_code && (
                  <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace', display: 'block' }}>
                    {r.shift_code}
                  </Text>
                )}
              </div>
            </div>
          </button>
        );
      },
    },
    {
      title: 'Timing', key: 'time', width: 200,
      render: (_, r) => r.start_time ? (
        <div>
          <Space size={4}>
            <span style={{ fontWeight: 600, fontSize: 12 }}>{fmtT(r.start_time)}</span>
            <span style={{ color: '#bfbfbf' }}>→</span>
            <span style={{ fontWeight: 600, fontSize: 12 }}>{fmtT(r.end_time)}</span>
            {r.working_hours && <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>{r.working_hours}h</Tag>}
          </Space>
          <div style={{ marginTop: 5 }}>
            <TimeBar
              startTime={r.start_time} endTime={r.end_time}
              color={SHIFT_CFG[r.shift_type]?.accent || '#1890ff'}
              width={140}
            />
          </div>
        </div>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Work Days', key: 'days', width: 230,
      render: (_, r) => (
        <DayBadges
          value={r.work_days || r.days_of_week || ''}
          accent={SHIFT_CFG[r.shift_type]?.accent || '#1890ff'}
        />
      ),
    },
    {
      title: 'Roster / Cycle', key: 'cycle', width: 150,
      render: (_, r) => (
        <Space direction="vertical" size={3}>
          <Tag color={ROSTER_COLOR[r.roster_type ?? 0]} style={{ margin: 0 }}>
            {ROSTER_TYPE[r.roster_type ?? 0]}
          </Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {CYCLE_UNIT[r.cycle_unit ?? 1]} ×{r.cycle_count ?? 1}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Sched', key: 'sched', width: 72, align: 'center',
      render: (_, r) => (r.schedule_count ?? 0) > 0 ? (
        <Tooltip title={`${r.schedule_count} employees`}>
          <Badge count={r.schedule_count} style={{ background: '#1890ff' }} overflowCount={99} />
        </Tooltip>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: '', key: 'act', fixed: 'right', width: 100,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => { setDetailRec(r); setDetailOpen(true); }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => open_(r)} />
          </Tooltip>
          <Popconfirm
            title="Delete shift pattern?"
            description="Any schedules using this pattern will also be removed."
            onConfirm={() => deleteM.mutate(r.id)}
            okText="Delete" okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /* ── render ───────────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: 24 }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between" wrap={false}>
          <Col>
            <Space size={10} align="center">
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px #722ed140',
              }}>
                <RetweetOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1f1f1f', lineHeight: 1.2 }}>
                  Shift Patterns
                </div>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 2 }}>
                  {rows.length} patterns · {activeCount} active · {scheduledCount} with assigned schedules
                </div>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Segmented
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { value: 'cards', icon: <AppstoreOutlined /> },
                  { value: 'table', icon: <BarsOutlined /> },
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={() => open_()}>
                Add Pattern
              </Button>
              <Tooltip title="Refresh">
                <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading} />
              </Tooltip>
            </Space>
          </Col>
        </Row>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────── */}
      <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 6]} align="middle" wrap>
          <Col flex="220px">
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search name or code…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              size="small"
            />
          </Col>
          <Col flex="auto">
            <Space size={4} wrap>
              {['ALL', ...SHIFT_TYPES].map(t => (
                <Tag.CheckableTag
                  key={t}
                  checked={filterType === t}
                  onChange={() => setFilterType(t)}
                  style={{ fontSize: 11, cursor: 'pointer' }}
                >
                  {t === 'ALL' ? 'All Types' : t}
                </Tag.CheckableTag>
              ))}
            </Space>
          </Col>
          <Col>
            <Space size={4}>
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'inactive', label: 'Inactive' },
              ].map(s => (
                <Tag.CheckableTag
                  key={s.key}
                  checked={filterActive === s.key}
                  onChange={() => setFilterActive(s.key)}
                  style={{ fontSize: 11, cursor: 'pointer' }}
                >
                  {s.label}
                </Tag.CheckableTag>
              ))}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Cards view ──────────────────────────────────────────────────── */}
      {viewMode === 'cards' && (
        filtered.length === 0 ? (
          <Card>
            <Empty
              description={
                searchText || filterType !== 'ALL' || filterActive !== 'all'
                  ? 'No shift patterns match your filters'
                  : 'No shift patterns yet — create your first one'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              {!searchText && filterType === 'ALL' && filterActive === 'all' && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => open_()}>
                  Add Pattern
                </Button>
              )}
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map(rec => (
              <Col key={rec.id} xs={24} sm={12} lg={8} xl={6}>
                <ShiftCard
                  rec={rec}
                  onView={r => { setDetailRec(r); setDetailOpen(true); }}
                  onEdit={open_}
                  onDelete={id => deleteM.mutate(id)}
                />
              </Col>
            ))}
          </Row>
        )
      )}

      {/* ── Table view ──────────────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <Card styles={{ body: { padding: 0 } }}>
          <Table
            columns={cols}
            dataSource={filtered}
            loading={isLoading}
            rowKey="id"
            size="middle"
            scroll={{ x: 900 }}
            pagination={{
              pageSize: 20, showSizeChanger: true,
              showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`,
            }}
          />
        </Card>
      )}

      {/* ══ ADD / EDIT DRAWER ══════════════════════════════════════════════ */}
      <Drawer
        title={
          <Space>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FieldTimeOutlined style={{ color: '#fff', fontSize: 13 }} />
            </div>
            {editing ? `Edit — ${editing.alias || editing.name}` : 'New Shift Pattern'}
          </Space>
        }
        open={drawerOpen}
        onClose={close_}
        width={580}
        destroyOnHidden
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={close_}>Cancel</Button>
            <Button type="primary" onClick={submit} loading={saveM.isPending}>
              {editing ? 'Update Pattern' : 'Create Pattern'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" size="small">

          {/* Identity */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c', marginTop: 0 }}>
            <Space size={4}><TagOutlined />Identity</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="alias" label="Shift Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="e.g., Day Shift, Rotating Week A" size="middle" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="shift_code" label="Code" tooltip="Unique short code (e.g. DS001)">
                <Input placeholder="DS001" size="middle" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="shift_type" label="Shift Type" initialValue="CUSTOM">
                <Select size="middle">
                  {SHIFT_TYPES.map(t => (
                    <Option key={t} value={t}>
                      <Tag color={SHIFT_CFG[t]?.tag || 'default'} style={{ margin: 0 }}>{t}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="is_active" label="Status" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>

          {/* Timing */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>
            <Space size={4}><ClockCircleOutlined />Timing</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="start_time" label="Start Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} size="middle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="End Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} size="middle" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="working_hours" label="Work Hours" initialValue={8}>
                <Space.Compact style={{ width: '100%' }}><InputNumber min={1} max={24} size="middle" style={{ flex: 1 }} /><Input readOnly value="h" style={{ width: 36, textAlign: 'center' }} size="middle" /></Space.Compact>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="break_duration" label="Break" initialValue={0}>
                <Space.Compact style={{ width: '100%' }}><InputNumber min={0} max={120} size="middle" style={{ flex: 1 }} /><Input readOnly value="min" style={{ width: 44, textAlign: 'center' }} size="middle" /></Space.Compact>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_night_shift" label="Night Shift" valuePropName="checked" initialValue={false}>
                <Switch size="small" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="is_weekend_shift" label="Includes Weekend" valuePropName="checked" initialValue={false}>
                <Switch size="small" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_flexible" label="Flexible Hours" valuePropName="checked" initialValue={false}>
                <Switch size="small" />
              </Form.Item>
            </Col>
          </Row>

          {/* Linked Timetable */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>
            <Space size={4}><CalendarOutlined />Linked Timetable</Space>
          </Divider>
          <Form.Item name="timetable_id" label="Device Timetable"
            tooltip="BioTime timetable pushed to biometric readers. Auto-created from timing above if left blank.">
            <Select allowClear size="middle" placeholder="Select timetable (optional)">
              {timetables.map(t => (
                <Option key={t.id} value={t.id}>
                  {t.alias || t.name}
                  {(t.start_time || t.checkin_time) &&
                    ` · ${fmtT(t.start_time || t.checkin_time)}–${fmtT(t.end_time || t.checkout_time)}`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* Rotation */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>
            <Space size={4}><RetweetOutlined />Rotation</Space>
          </Divider>
          <Form.Item name="work_days" label="Working Days" initialValue={['1', '2', '3', '4', '5']}>
            <Select mode="multiple" size="middle" placeholder="Select working days">
              {DAYS.map((d, i) => (
                <Option key={String(i + 1)} value={String(i + 1)}>{d}</Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="cycle_unit" label="Cycle Unit" initialValue={1}>
                <Select size="middle">
                  {Object.entries(CYCLE_UNIT).map(([k, v]) => (
                    <Option key={k} value={Number(k)}>{v}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cycle_count" label="Cycle Count" initialValue={1}
                tooltip="e.g., 2 = a 2-week rotation">
                <InputNumber min={1} max={52} style={{ width: '100%' }} size="middle" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="roster_type" label="Roster Type" initialValue={0}>
                <Select size="middle">
                  {Object.entries(ROSTER_TYPE).map(([k, v]) => (
                    <Option key={k} value={Number(k)}>
                      <Tag color={ROSTER_COLOR[Number(k)]} style={{ margin: 0 }}>{v}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Attendance Rules */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>
            <Space size={4}><SafetyCertificateOutlined />Attendance Rules</Space>
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="grace_period_minutes" label="Grace Period" initialValue={15}
                tooltip="Minutes after start before marking late">
                <Space.Compact style={{ width: '100%' }}><InputNumber min={0} max={60} size="middle" style={{ flex: 1 }} /><Input readOnly value="min" style={{ width: 44, textAlign: 'center' }} size="middle" /></Space.Compact>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_late_minutes" label="Max Late" initialValue={60}>
                <Space.Compact style={{ width: '100%' }}><InputNumber min={0} max={180} size="middle" style={{ flex: 1 }} /><Input readOnly value="min" style={{ width: 44, textAlign: 'center' }} size="middle" /></Space.Compact>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="max_early_departure_minutes" label="Max Early Exit" initialValue={30}>
                <Space.Compact style={{ width: '100%' }}><InputNumber min={0} max={120} size="middle" style={{ flex: 1 }} /><Input readOnly value="min" style={{ width: 44, textAlign: 'center' }} size="middle" /></Space.Compact>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="overtime_threshold_minutes" label="OT After" initialValue={30}
                tooltip="Minutes past end time before counting as overtime">
                <Space.Compact style={{ width: '100%' }}><InputNumber min={0} max={120} size="middle" style={{ flex: 1 }} /><Input readOnly value="min" style={{ width: 44, textAlign: 'center' }} size="middle" /></Space.Compact>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional notes about this shift" size="middle" />
          </Form.Item>

        </Form>
      </Drawer>

      {/* ══ DETAIL DRAWER ══════════════════════════════════════════════════ */}
      <Drawer
        title={<Space><EyeOutlined />Shift Details</Space>}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={480}
        destroyOnHidden
        extra={
          <Button
            icon={<EditOutlined />}
            size="small"
            type="primary"
            ghost
            onClick={() => { setDetailOpen(false); open_(detailRec); }}
          >
            Edit
          </Button>
        }
      >
        <ShiftDetail rec={detailRec} />
      </Drawer>

    </div>
  );
};

export default ShiftsTab;
