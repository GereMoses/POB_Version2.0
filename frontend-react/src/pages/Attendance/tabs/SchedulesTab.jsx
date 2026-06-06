import React, { useState, useMemo, useCallback } from 'react';
import {
  Card, Button, Space, Tag, App, Form, Drawer, Select, DatePicker,
  Row, Col, Divider, Tooltip, Popconfirm, Input, Avatar, Table,
  Badge, Popover, Switch, Spin, Empty, Typography, Segmented, Progress,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, CarryOutOutlined, ReloadOutlined,
  SearchOutlined, UserOutlined, LeftOutlined, RightOutlined,
  UnorderedListOutlined, CalendarOutlined, TeamOutlined,
  CheckCircleOutlined, PercentageOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';
import { SHIFT_CFG, shiftCfg, fmtT } from './shared';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

const AVATAR_COLORS = ['#1890ff', '#52c41a', '#722ed1', '#fa8c16', '#eb2f96', '#13c2c2'];
const avatarColor = (n) => AVATAR_COLORS[(n || '').charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (n) => (n || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const isWeekend = (year, month, day) => {
  const d = new Date(year, month - 1, day).getDay();
  return d === 0 || d === 6;
};

/* ═══════════════════════════════════════════════════════════════════════════
   ROSTER CALENDAR VIEW
═══════════════════════════════════════════════════════════════════════════ */
const RosterView = ({ year, month, deptId, shifts }) => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const today = dayjs();
  const daysInMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [empSearch, setEmpSearch] = useState('');
  const [cellPop,  setCellPop]   = useState(null);
  const [cellShift, setCellShift] = useState(null);

  /* Roster data */
  const { data: rosterRaw, isLoading } = useQuery({
    queryKey: ['att-roster', year, month, deptId],
    queryFn: () => apiService.get(
      `/api/v1/attendance/schedules/roster?month=${year}-${String(month).padStart(2, '0')}` +
      (deptId ? `&dept_id=${deptId}` : '')
    ),
    staleTime: 30000,
  });
  const allEmployees = useMemo(() => rosterRaw?.employees || [], [rosterRaw]);

  /* Filter by search */
  const employees = useMemo(() => {
    if (!empSearch.trim()) return allEmployees;
    const q = empSearch.toLowerCase();
    return allEmployees.filter(e =>
      (e.emp_name || '').toLowerCase().includes(q) ||
      (e.emp_code || '').toLowerCase().includes(q)
    );
  }, [allEmployees, empSearch]);

  /* Per-day coverage (% of employees with a shift assigned) */
  const coverageByDay = useMemo(() => {
    if (!allEmployees.length) return {};
    return days.reduce((acc, d) => {
      const covered = allEmployees.filter(e => e.schedule?.[String(d)]).length;
      acc[d] = Math.round((covered / allEmployees.length) * 100);
      return acc;
    }, {});
  }, [allEmployees, days]);

  /* Stats */
  const totalEmp = allEmployees.length;
  const scheduledEmp = allEmployees.filter(e =>
    Object.keys(e.schedule || {}).length > 0
  ).length;
  const avgCoverage = days.length
    ? Math.round(days.reduce((s, d) => s + (coverageByDay[d] || 0), 0) / days.length)
    : 0;

  /* Mutations */
  const assignM = useMutation({
    mutationFn: ({ emp_code, shift_id, day }) => {
      const d = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return apiService.post('/api/v1/attendance/schedules/batch-range', {
        emp_codes: [emp_code], shift_id, start_date: d, end_date: d, overwrite: true,
      });
    },
    onSuccess: () => {
      message.success('Shift assigned');
      setCellPop(null);
      qc.invalidateQueries({ queryKey: ['att-roster'] });
      qc.invalidateQueries({ queryKey: ['att-schedules'] });
    },
    onError: (e) => message.error(e?.message || 'Failed to assign'),
  });

  const clearM = useMutation({
    mutationFn: ({ emp_code, day }) => {
      const d = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return apiService.delete(
        `/api/v1/attendance/schedules/range?emp_code=${emp_code}&start_date=${d}&end_date=${d}`
      );
    },
    onSuccess: () => {
      message.success('Shift cleared');
      setCellPop(null);
      qc.invalidateQueries({ queryKey: ['att-roster'] });
      qc.invalidateQueries({ queryKey: ['att-schedules'] });
    },
    onError: (e) => message.error(e?.message || 'Failed to clear'),
  });

  const CellPopoverContent = useCallback(({ emp_code, day, current }) => (
    <div style={{ width: 230 }}>
      {current ? (
        <div style={{ marginBottom: 10 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>Currently assigned</Text>
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Tag color={shiftCfg(current.shift_type).tag} style={{ margin: 0 }}>
              {current.shift_name}
            </Tag>
            <Button
              size="small" danger type="text"
              loading={clearM.isPending}
              onClick={() => clearM.mutate({ emp_code, day })}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 10 }}>
          No shift assigned for this day
        </Text>
      )}
      <Select
        size="small"
        placeholder="Select shift to assign…"
        style={{ width: '100%' }}
        value={cellShift}
        onChange={v => setCellShift(v)}
      >
        {shifts.map(s => {
          const cfg = shiftCfg(s.shift_type);
          return (
            <Option key={s.id} value={s.id}>
              <Space size={4}>
                <Tag color={cfg.tag} style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
                  {s.shift_type || 'CUSTOM'}
                </Tag>
                <span>{s.alias || s.name}</span>
                {s.start_time && (
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    {fmtT(s.start_time)}–{fmtT(s.end_time)}
                  </Text>
                )}
              </Space>
            </Option>
          );
        })}
      </Select>
      <Button
        type="primary" size="small" block style={{ marginTop: 8 }}
        loading={assignM.isPending}
        disabled={!cellShift}
        onClick={() => assignM.mutate({ emp_code, shift_id: cellShift, day })}
      >
        Assign Shift
      </Button>
    </div>
  ), [cellShift, shifts, assignM, clearM]);

  const CELL_W = 38;
  const NAME_W = 210;

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div>
      {/* ── Stats bar + employee search ───────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa',
        gap: 12, flexWrap: 'wrap',
      }}>
        <Space size={20}>
          <Space size={5}>
            <TeamOutlined style={{ color: '#1890ff' }} />
            <Text style={{ fontSize: 12 }}>
              <strong style={{ color: '#1890ff' }}>{scheduledEmp}</strong>
              <Text type="secondary"> / {totalEmp} employees scheduled</Text>
            </Text>
          </Space>
          <Space size={5}>
            <PercentageOutlined style={{ color: '#52c41a' }} />
            <Text style={{ fontSize: 12 }}>
              <strong style={{ color: '#52c41a' }}>{avgCoverage}%</strong>
              <Text type="secondary"> avg daily coverage</Text>
            </Text>
          </Space>
        </Space>
        <Input
          size="small"
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Find employee…"
          value={empSearch}
          onChange={e => setEmpSearch(e.target.value)}
          allowClear
          style={{ width: 200 }}
        />
      </div>

      {/* ── Calendar grid ─────────────────────────────────────────────── */}
      {!allEmployees.length ? (
        <Empty description="No active employees found for this department" style={{ padding: 60 }} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {/* Day header */}
          <div style={{
            display: 'flex', borderBottom: '2px solid #e8e8e8',
            background: '#fafafa', position: 'sticky', top: 0, zIndex: 10,
            minWidth: NAME_W + daysInMonth * CELL_W,
          }}>
            <div style={{
              width: NAME_W, flexShrink: 0, padding: '8px 12px',
              borderRight: '2px solid #e8e8e8',
              fontWeight: 700, fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase',
              letterSpacing: 0.5, position: 'sticky', left: 0,
              background: '#fafafa', zIndex: 11,
              display: 'flex', alignItems: 'center',
            }}>
              Employee
            </div>
            {days.map(d => {
              const isToday = today.year() === year && today.month() + 1 === month && today.date() === d;
              const isSat   = isWeekend(year, month, d);
              const dow     = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(year, month - 1, d).getDay()];
              const cov     = coverageByDay[d] || 0;
              const covColor = cov >= 80 ? '#52c41a' : cov >= 50 ? '#fa8c16' : '#ff4d4f';
              return (
                <div key={d} style={{
                  width: CELL_W, flexShrink: 0, textAlign: 'center', padding: '3px 0 4px',
                  background: isToday ? '#e6f7ff' : isSat ? '#fff7e6' : 'transparent',
                  borderRight: '1px solid #f0f0f0',
                  position: 'relative',
                }}>
                  <div style={{ fontSize: 9, color: isSat ? '#fa8c16' : '#8c8c8c', lineHeight: 1.3 }}>{dow}</div>
                  <div style={{
                    fontSize: 12, fontWeight: isToday ? 800 : 500, lineHeight: 1.2,
                    color: isToday ? '#1890ff' : isSat ? '#fa8c16' : '#262626',
                  }}>{d}</div>
                  {/* Coverage dot */}
                  <Tooltip title={`${cov}% covered`} mouseEnterDelay={0.8}>
                    <div style={{
                      width: 20, height: 3, borderRadius: 2,
                      background: cov > 0 ? covColor : '#f0f0f0',
                      margin: '3px auto 0',
                      opacity: cov > 0 ? Math.max(0.4, cov / 100) : 1,
                    }} />
                  </Tooltip>
                </div>
              );
            })}
          </div>

          {/* Employee rows grouped by department */}
          {(() => {
            const byDept = employees.reduce((acc, e) => {
              const k = e.dept_name || 'No Department';
              (acc[k] = acc[k] || []).push(e);
              return acc;
            }, {});

            return Object.entries(byDept).map(([deptName, emps]) => (
              <div key={deptName}>
                {/* Dept separator */}
                <div style={{
                  background: 'linear-gradient(90deg, #f0f5ff 0%, #fafafa 100%)',
                  padding: '5px 12px',
                  fontSize: 11, fontWeight: 700, color: '#2f54eb',
                  letterSpacing: 0.5, textTransform: 'uppercase',
                  borderBottom: '1px solid #e8e8e8',
                  borderTop: '1px solid #e8e8e8',
                  minWidth: NAME_W + daysInMonth * CELL_W,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <TeamOutlined />
                  {deptName}
                  <span style={{ fontWeight: 400, color: '#8c8c8c' }}>({emps.length})</span>
                </div>

                {emps.map((emp, idx) => (
                  <div
                    key={emp.emp_code}
                    style={{
                      display: 'flex', minWidth: NAME_W + daysInMonth * CELL_W,
                      borderBottom: '1px solid #f0f0f0',
                      background: idx % 2 === 0 ? '#fff' : '#fcfcfc',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fcfcfc'; }}
                  >
                    {/* Sticky employee name */}
                    <div style={{
                      width: NAME_W, flexShrink: 0, padding: '6px 12px',
                      borderRight: '2px solid #e8e8e8',
                      position: 'sticky', left: 0, zIndex: 5,
                      background: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Avatar
                        size={26}
                        style={{ background: avatarColor(emp.emp_name), fontSize: 9, flexShrink: 0 }}
                      >
                        {initials(emp.emp_name)}
                      </Avatar>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: '#262626',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {emp.emp_name}
                        </div>
                        <div style={{ fontSize: 10, color: '#8c8c8c' }}>{emp.emp_code}</div>
                      </div>
                    </div>

                    {/* Day cells */}
                    {days.map(d => {
                      const entry  = emp.schedule?.[String(d)];
                      const isToday = today.year() === year && today.month() + 1 === month && today.date() === d;
                      const isSat   = isWeekend(year, month, d);
                      const isOpen  = cellPop?.emp_code === emp.emp_code && cellPop?.day === d;
                      const sc      = entry ? shiftCfg(entry.shift_type) : null;

                      return (
                        <Popover
                          key={d}
                          open={isOpen}
                          onOpenChange={open => {
                            if (open) {
                              setCellPop({ emp_code: emp.emp_code, day: d, current: entry });
                              setCellShift(null);
                            } else {
                              setCellPop(null);
                            }
                          }}
                          trigger="click"
                          title={
                            <Space size={4}>
                              <CalendarOutlined style={{ color: '#1890ff' }} />
                              <span style={{ fontWeight: 600 }}>
                                {dayjs(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`).format('DD MMM YYYY')}
                              </span>
                              <Text type="secondary" style={{ fontSize: 11 }}>· {emp.emp_name}</Text>
                            </Space>
                          }
                          content={<CellPopoverContent emp_code={emp.emp_code} day={d} current={entry} />}
                          placement="bottom"
                          destroyTooltipOnHide
                        >
                          <div style={{
                            width: CELL_W, flexShrink: 0, height: 38,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            borderRight: '1px solid #f0f0f0',
                            background: isToday
                              ? '#dbeffe'
                              : isSat
                              ? '#fff7e6'
                              : 'transparent',
                          }}>
                            {entry ? (
                              <Tooltip
                                title={`${entry.shift_name}${entry.shift_code ? ` (${entry.shift_code})` : ''}${entry.start_time ? ` · ${fmtT(entry.start_time)}–${fmtT(entry.end_time)}` : ''}`}
                                mouseEnterDelay={0.5}
                              >
                                <div style={{
                                  background: sc.bg,
                                  border: `1px solid ${sc.border}`,
                                  borderRadius: 3, padding: '1px 3px',
                                  fontSize: 9, fontWeight: 700, color: sc.text,
                                  maxWidth: 34, overflow: 'hidden',
                                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  lineHeight: 1.6, textAlign: 'center',
                                }}>
                                  {(entry.shift_code || entry.shift_name || '').slice(0, 4)}
                                </div>
                              </Tooltip>
                            ) : (
                              <div style={{
                                width: 16, height: 2, borderRadius: 1,
                                background: isSat ? '#ffd591' : '#ebebeb',
                              }} />
                            )}
                          </div>
                        </Popover>
                      );
                    })}
                  </div>
                ))}
              </div>
            ));
          })()}

          {/* Legend */}
          <div style={{
            padding: '10px 16px', borderTop: '1px solid #f0f0f0',
            background: '#fafafa', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Legend
            </Text>
            {shifts.filter(s => s.is_active !== false).map(s => {
              const c = shiftCfg(s.shift_type);
              return (
                <Space key={s.id} size={4}>
                  <div style={{
                    width: 26, height: 15, background: c.bg, border: `1px solid ${c.border}`,
                    borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: c.text }}>
                      {(s.shift_code || s.alias || '').slice(0, 4)}
                    </span>
                  </div>
                  <Text style={{ fontSize: 11 }}>{s.alias || s.name}</Text>
                  {s.start_time && (
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      {fmtT(s.start_time)}–{fmtT(s.end_time)}
                    </Text>
                  )}
                </Space>
              );
            })}
            <Space size={4}>
              <div style={{ width: 26, height: 15, background: '#dbeffe', border: '1px solid #91caff', borderRadius: 2 }} />
              <Text style={{ fontSize: 11, color: '#1890ff' }}>Today</Text>
            </Space>
            <Space size={4}>
              <div style={{ width: 26, height: 15, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 2 }} />
              <Text style={{ fontSize: 11, color: '#fa8c16' }}>Weekend</Text>
            </Space>
            <Space size={4}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {[['#52c41a', '≥80%'], ['#fa8c16', '50–79%'], ['#ff4d4f', '<50%']].map(([c, l]) => (
                  <Space key={l} size={2}>
                    <div style={{ width: 14, height: 4, background: c, borderRadius: 2 }} />
                    <Text style={{ fontSize: 10, color: c }}>{l}</Text>
                  </Space>
                ))}
              </div>
              <Text type="secondary" style={{ fontSize: 10 }}>daily coverage</Text>
            </Space>
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   LIST VIEW
═══════════════════════════════════════════════════════════════════════════ */
const ListView = ({ onAssign }) => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const today = dayjs();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['att-schedules', search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      return apiService.get(`/api/v1/attendance/schedules?${p}`);
    },
  });
  const rows = useMemo(() => {
    const r = data?.data || data || [];
    return Array.isArray(r) ? r : [];
  }, [data]);

  const deleteM = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/attendance/schedules/${id}`),
    onSuccess: () => {
      message.success('Schedule removed');
      qc.invalidateQueries({ queryKey: ['att-schedules'] });
      qc.invalidateQueries({ queryKey: ['att-roster'] });
    },
    onError: (e) => message.error(e?.message || 'Failed to remove'),
  });

  const getDuration = (start, end) => {
    if (!start || !end) return null;
    const d = dayjs(end).diff(dayjs(start), 'day') + 1;
    if (d <= 1)  return '1 day';
    if (d < 7)   return `${d} days`;
    if (d < 31)  return `${Math.round(d / 7)}w`;
    return `${Math.round(d / 30)}mo`;
  };

  const getStatus = (r) => {
    if (!r.end_date) return <Tag color="blue">Active</Tag>;
    if (dayjs(r.end_date).isBefore(today, 'day')) return <Tag color="default">Expired</Tag>;
    if (dayjs(r.end_date).isSame(today, 'day'))  return <Tag color="orange">Ends Today</Tag>;
    const left = dayjs(r.end_date).diff(today, 'day');
    if (left <= 7) return <Tag color="gold">{left}d left</Tag>;
    return <Tag color="green">Active</Tag>;
  };

  const cols = [
    {
      title: 'Employee',
      key: 'emp',
      render: (_, r) => {
        const name = r.emp_name || r.emp_code || '—';
        return (
          <Space size={8}>
            <Avatar size={30} style={{ background: avatarColor(name), fontSize: 10, flexShrink: 0 }}>
              {initials(name)}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1f1f1f' }}>{name}</div>
              <Text type="secondary" style={{ fontSize: 11 }}>{r.emp_code}</Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Assigned Shift',
      key: 'shift',
      width: 200,
      render: (_, r) => {
        if (!r.shift_name) return <Text type="secondary" style={{ fontSize: 12 }}>No shift</Text>;
        const cfg = shiftCfg(r.shift_type);
        return (
          <div>
            <Tag color={cfg.tag} style={{ margin: 0, fontWeight: 600 }}>{r.shift_name}</Tag>
            {r.start_time && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 3 }}>
                {fmtT(r.start_time)} → {fmtT(r.end_time)}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Period',
      key: 'period',
      width: 260,
      render: (_, r) => {
        const dur = getDuration(r.start_date, r.end_date);
        return (
          <div>
            <Space size={5}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {r.start_date ? dayjs(r.start_date).format('DD MMM YYYY') : '—'}
              </span>
              <span style={{ color: '#bfbfbf' }}>→</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {r.end_date ? dayjs(r.end_date).format('DD MMM YYYY') : 'Open'}
              </span>
            </Space>
            {dur && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{dur} total</Text>}
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, r) => getStatus(r),
    },
    {
      title: '',
      key: 'act',
      width: 60,
      render: (_, r) => (
        <Popconfirm
          title="Remove this schedule?"
          description="This unassigns the shift from the employee."
          onConfirm={() => deleteM.mutate(r.id)}
          okText="Remove"
          okButtonProps={{ danger: true }}
        >
          <Tooltip title="Remove">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ padding: '14px 16px 0' }}>
        <Row gutter={12} align="middle" justify="space-between" style={{ marginBottom: 12 }}>
          <Col xs={24} sm={10}>
            <Input
              placeholder="Search employee name or code…"
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              size="small"
            />
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={onAssign} size="small">
                Assign Schedule
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading} size="small">
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </div>
      <Table
        columns={cols}
        dataSource={rows}
        loading={isLoading}
        rowKey="id"
        size="middle"
        scroll={{ x: 800 }}
        pagination={{
          pageSize: 20, showSizeChanger: true,
          showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`,
        }}
      />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
const SchedulesTab = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [view,            setView]           = useState('roster');
  const [drawerOpen,      setDrawerOpen]     = useState(false);
  const [overwrite,       setOverwrite]      = useState(false);
  const [drawerDept,      setDrawerDept]     = useState(null);
  const [assignMode,      setAssignMode]     = useState('employees'); // 'employees' | 'department'
  const [drawerDeptAssign, setDrawerDeptAssign] = useState(null);
  const [form] = Form.useForm();

  /* Month navigation */
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const year  = currentMonth.year();
  const month = currentMonth.month() + 1;

  /* Dept filter */
  const [deptId, setDeptId] = useState(null);

  /* Data queries */
  const { data: deptRaw } = useQuery({
    queryKey: ['schedule-depts'],
    queryFn: () => apiService.get('/api/v1/attendance/schedules/departments'),
    staleTime: 120000,
  });
  const departments = useMemo(() => deptRaw?.data || [], [deptRaw]);

  const { data: shiftRaw } = useQuery({
    queryKey: ['att-shifts'],
    queryFn: () => apiService.get('/api/v1/attendance/shifts'),
    staleTime: 60000,
  });
  const shifts = useMemo(() => {
    const r = shiftRaw?.data || shiftRaw || [];
    return Array.isArray(r) ? r : [];
  }, [shiftRaw]);

  const { data: empRaw } = useQuery({
    queryKey: ['personnel-active'],
    queryFn: () => apiService.get('/api/v1/personnel/?status=ACTIVE&page_size=500'),
    staleTime: 60000,
  });
  const allEmployees = useMemo(() => {
    const r = empRaw?.results || empRaw?.data || empRaw || [];
    return Array.isArray(r) ? r : [];
  }, [empRaw]);

  /* Filter employees in drawer by dept */
  const drawerEmployees = useMemo(() => {
    if (!drawerDept) return allEmployees;
    return allEmployees.filter(e =>
      e.department_id === drawerDept ||
      (e.dept_name || '').toLowerCase() === (drawerDept + '').toLowerCase()
    );
  }, [allEmployees, drawerDept]);

  /* Employee count preview for department mode */
  const deptEmpCount = useMemo(() =>
    allEmployees.filter(e => e.department_id === drawerDeptAssign).length,
  [allEmployees, drawerDeptAssign]);

  /* Batch assign mutation */
  const batchM = useMutation({
    mutationFn: (d) => apiService.post('/api/v1/attendance/schedules/batch-range', d),
    onSuccess: (res) => {
      const d = res?.data || res || {};
      message.success(
        `Assigned to ${d.created ?? 0} employee(s)` +
        (d.skipped    > 0 ? ` · ${d.skipped} skipped (conflict)`    : '') +
        (d.overwritten > 0 ? ` · ${d.overwritten} overwritten`      : '')
      );
      closeDrawer();
      qc.invalidateQueries({ queryKey: ['att-roster'] });
      qc.invalidateQueries({ queryKey: ['att-schedules'] });
    },
    onError: (e) => message.error(e?.message || 'Failed to assign'),
  });

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerDept(null);
    setDrawerDeptAssign(null);
    setAssignMode('employees');
    setOverwrite(false);
    form.resetFields();
  };

  const submit = () => {
    if (assignMode === 'department') {
      if (!drawerDeptAssign) { message.error('Please select a department'); return; }
      form.validateFields(['shift_id', 'date_range']).then(v =>
        batchM.mutate({
          emp_codes:  [],
          dept_id:    drawerDeptAssign,
          shift_id:   v.shift_id,
          start_date: v.date_range[0].format('YYYY-MM-DD'),
          end_date:   v.date_range[1].format('YYYY-MM-DD'),
          overwrite,
        })
      ).catch(() => {});
    } else {
      form.validateFields().then(v =>
        batchM.mutate({
          emp_codes:  v.emp_codes,
          shift_id:   v.shift_id,
          start_date: v.date_range[0].format('YYYY-MM-DD'),
          end_date:   v.date_range[1].format('YYYY-MM-DD'),
          overwrite,
        })
      ).catch(() => {});
    }
  };

  /* Watched form field for shift preview */
  const watchedShiftId = Form.useWatch('shift_id', form);
  const previewShift = shifts.find(s => s.id === watchedShiftId);

  return (
    <div style={{ padding: 24 }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between" wrap={false}>
          <Col>
            <Space size={10} align="center">
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #52c41a 0%, #237804 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px #52c41a40',
              }}>
                <CarryOutOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1f1f1f', lineHeight: 1.2 }}>
                  Schedule Management
                </div>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 2 }}>
                  {currentMonth.format('MMMM YYYY')} · assign shifts to employees
                </div>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              {/* Month navigator */}
              <Space size={2}>
                <Button
                  size="small" icon={<LeftOutlined />}
                  onClick={() => setCurrentMonth(m => m.subtract(1, 'month'))}
                />
                <Button
                  size="small"
                  style={{ minWidth: 110, fontWeight: 600 }}
                  onClick={() => setCurrentMonth(dayjs().startOf('month'))}
                >
                  {currentMonth.format('MMM YYYY')}
                </Button>
                <Button
                  size="small" icon={<RightOutlined />}
                  onClick={() => setCurrentMonth(m => m.add(1, 'month'))}
                />
              </Space>
              {/* Dept filter */}
              <Select
                placeholder="All departments" allowClear
                style={{ width: 170 }} size="small"
                value={deptId} onChange={setDeptId}
              >
                {departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
              </Select>
              {/* View toggle */}
              <Segmented
                value={view}
                onChange={setView}
                size="small"
                options={[
                  { value: 'roster', label: <Space size={4}><CalendarOutlined />Roster</Space> },
                  { value: 'list',   label: <Space size={4}><UnorderedListOutlined />List</Space> },
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)} size="small">
                Assign
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* ── View panel ──────────────────────────────────────────────────── */}
      <Card styles={{ body: { padding: 0 } }}>
        {view === 'roster'
          ? <RosterView year={year} month={month} deptId={deptId} shifts={shifts} />
          : <ListView onAssign={() => setDrawerOpen(true)} />
        }
      </Card>

      {/* ══ BATCH ASSIGN DRAWER ════════════════════════════════════════════ */}
      <Drawer
        title={
          <Space>
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg, #52c41a 0%, #237804 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CarryOutOutlined style={{ color: '#fff', fontSize: 13 }} />
            </div>
            Assign Schedule
          </Space>
        }
        open={drawerOpen}
        onClose={closeDrawer}
        width={560}
        destroyOnHidden
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={closeDrawer}>Cancel</Button>
            <Button type="primary" onClick={submit} loading={batchM.isPending}>
              Assign Schedule
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" size="small">

          {/* Mode toggle */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c', marginTop: 0 }}>
            <Space size={4}><UserOutlined />Employees</Space>
          </Divider>

          <Segmented
            value={assignMode}
            onChange={v => {
              setAssignMode(v);
              setDrawerDept(null);
              setDrawerDeptAssign(null);
              form.setFieldValue('emp_codes', []);
            }}
            options={[
              { value: 'employees', label: <Space size={4}><UserOutlined />Select Employees</Space> },
              { value: 'department', label: <Space size={4}><TeamOutlined />By Department</Space> },
            ]}
            style={{ width: '100%', marginBottom: 16 }}
          />

          {assignMode === 'employees' ? (
            <>
              {/* Dept filter to narrow employee list */}
              <Row gutter={12} style={{ marginBottom: 4 }}>
                <Col span={24}>
                  <Select
                    placeholder="Filter by department (optional)"
                    allowClear style={{ width: '100%' }} size="small"
                    value={drawerDept} onChange={v => { setDrawerDept(v); form.setFieldValue('emp_codes', []); }}
                  >
                    {departments.map(d => <Option key={d.id} value={d.id}>{d.name}</Option>)}
                  </Select>
                </Col>
              </Row>
              <Form.Item
                name="emp_codes"
                label="Select Employees"
                rules={[{ required: true, message: 'Select at least one employee' }]}
              >
                <Select
                  mode="multiple" showSearch optionFilterProp="label" size="middle"
                  placeholder="Search and select employees…" maxTagCount={4}
                  options={drawerEmployees.map(e => {
                    const name = (e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim()) || e.emp_code;
                    return { label: `${name} · ${e.emp_code}`, value: e.emp_code };
                  })}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#262626' }}>
                  Department
                </div>
                <Select
                  showSearch optionFilterProp="label"
                  placeholder="Select a department…"
                  style={{ width: '100%' }} size="middle"
                  value={drawerDeptAssign}
                  onChange={v => setDrawerDeptAssign(v)}
                  options={departments.map(d => ({ label: d.name, value: d.id }))}
                />
              </div>
              {drawerDeptAssign && (
                <div style={{
                  background: '#f0f5ff', border: '1px solid #adc6ff',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 8,
                }}>
                  <Space size={8}>
                    <TeamOutlined style={{ color: '#2f54eb', fontSize: 16 }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#2f54eb', fontSize: 13 }}>
                        {departments.find(d => d.id === drawerDeptAssign)?.name}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {deptEmpCount > 0
                          ? `~${deptEmpCount} employees will be assigned`
                          : 'All active employees in this department will be assigned'
                        }
                        {' '}(including ADMS-synced)
                      </Text>
                    </div>
                  </Space>
                </div>
              )}
              {/* hidden emp_codes so form doesn't fail validation */}
              <Form.Item name="emp_codes" hidden><Select mode="multiple" /></Form.Item>
            </>
          )}

          {/* Shift & Period */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#8c8c8c' }}>
            <Space size={4}><CalendarOutlined />Shift &amp; Period</Space>
          </Divider>

          <Form.Item name="shift_id" label="Shift" rules={[{ required: true, message: 'Select a shift' }]}>
            <Select size="middle" placeholder="Select shift pattern">
              {shifts.map(s => {
                const cfg = shiftCfg(s.shift_type);
                return (
                  <Option key={s.id} value={s.id}>
                    <Space size={6}>
                      <Tag color={cfg.tag} style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
                        {s.shift_type || 'CUSTOM'}
                      </Tag>
                      {s.alias || s.name}
                      {s.start_time && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {fmtT(s.start_time)}–{fmtT(s.end_time)}
                        </Text>
                      )}
                    </Space>
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          {/* Shift preview card */}
          {previewShift && (() => {
            const cfg = shiftCfg(previewShift.shift_type);
            return (
              <div style={{
                background: cfg.bg, border: `1px solid ${cfg.border}`,
                borderRadius: 8, padding: '10px 14px', marginTop: -8, marginBottom: 16,
              }}>
                <Space size={8}>
                  <div style={{ width: 3, height: 40, background: cfg.accent, borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: cfg.text }}>{previewShift.alias || previewShift.name}</div>
                    {previewShift.start_time && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {fmtT(previewShift.start_time)} → {fmtT(previewShift.end_time)}
                        {previewShift.working_hours ? ` · ${previewShift.working_hours}h` : ''}
                      </Text>
                    )}
                  </div>
                  <Tag color={cfg.tag} style={{ margin: 0 }}>{previewShift.shift_type || 'CUSTOM'}</Tag>
                </Space>
              </div>
            );
          })()}

          <Form.Item
            name="date_range"
            label="Schedule Period"
            rules={[{ required: true, message: 'Select a date range' }]}
          >
            <RangePicker style={{ width: '100%' }} format="DD MMM YYYY" size="middle" />
          </Form.Item>

          {/* Overwrite toggle */}
          <Divider style={{ margin: '12px 0' }} />
          <div style={{
            background: overwrite ? '#fff1f0' : '#f6ffed',
            border: `1px solid ${overwrite ? '#ffa39e' : '#b7eb8f'}`,
            borderRadius: 8, padding: '12px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: overwrite ? '#cf1322' : '#389e0d' }}>
                {overwrite ? 'Overwrite mode ON' : 'Skip conflicts'}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {overwrite
                  ? 'Existing schedules in this period will be replaced'
                  : 'Employees with existing schedules will be skipped'
                }
              </Text>
            </div>
            <Switch
              checked={overwrite}
              onChange={setOverwrite}
              checkedChildren="Overwrite"
              unCheckedChildren="Skip"
            />
          </div>

        </Form>
      </Drawer>

    </div>
  );
};

export default SchedulesTab;
