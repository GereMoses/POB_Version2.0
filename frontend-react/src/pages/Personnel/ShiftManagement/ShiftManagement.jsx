import React, { useState, lazy, Suspense } from 'react';
import {
  Table, Button, Space, Select, Modal, Form, Card, Row, Col,
  Tag, App, Popconfirm, TimePicker, Switch, InputNumber, Tabs,
  DatePicker, Input, Badge, Tooltip, Statistic, Typography, Alert,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  ClockCircleOutlined, CalendarOutlined, UserOutlined,
  CheckCircleOutlined, WarningOutlined, InfoCircleOutlined,
  TeamOutlined, FilterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const WeeklyRosterBuilder = lazy(() => import('./WeeklyRosterBuilder'));

const { Text } = Typography;

// ── constants ───────────────────────────────────────────────────────────────────
const SHIFT_TYPE_COLOR = {
  MORNING: 'gold', EVENING: 'orange', NIGHT: 'purple',
  CUSTOM: 'blue', ROTATING: 'green',
};
const STATUS_COLOR  = { scheduled: 'processing', completed: 'success', cancelled: 'error' };
const STATUS_LABEL  = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };

const fmtTime = (t) => (t ? t.slice(0, 5) : '—');

// ── component ──────────────────────────────────────────────────────────────────
const ShiftManagement = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  // ── ui state ─────────────────────────────────────────────────────────────────
  const [activeTab,              setActiveTab]              = useState('shifts');
  const [isShiftModalVisible,    setIsShiftModalVisible]    = useState(false);
  const [editingShift,           setEditingShift]           = useState(null);
  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
  const [editingSchedule,        setEditingSchedule]        = useState(null);
  const [isBulkModalVisible,     setIsBulkModalVisible]     = useState(false);
  const [bulkResult,             setBulkResult]             = useState(null);
  // shift filter for the schedule table (BioTime-style roster filter)
  const [shiftFilter,            setShiftFilter]            = useState(null);
  // track which date is selected in each modal so we can query occupancy
  const [scheduleModalDate,      setScheduleModalDate]      = useState(null);
  const [bulkModalDate,          setBulkModalDate]          = useState(null);

  const [shiftForm]    = Form.useForm();
  const [scheduleForm] = Form.useForm();
  const [bulkForm]     = Form.useForm();

  // ── queries ──────────────────────────────────────────────────────────────────
  const { data: shiftsRaw, isLoading: shiftsLoading, refetch: refetchShifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => apiService.get('/api/v1/personnel/shifts'),
    refetchInterval: 60000,
  });

  const { data: personnelRaw } = useQuery({
    queryKey: ['personnel-dropdown'],
    queryFn: () => apiService.get('/api/v1/personnel/?page_size=500'),
  });

  const { data: schedulesRaw, isLoading: schedulesLoading, refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => apiService.get('/api/v1/personnel/schedules?limit=300'),
    refetchInterval: 60000,
  });

  // ── personnel-status query ───────────────────────────────────────────────────
  // Fires when either modal has a date selected — tells us who's already scheduled
  // on that date so we can disable them in the dropdown (BioTime one-shift-per-day rule)
  const statusDate = scheduleModalDate || bulkModalDate;
  const { data: personnelStatusRaw, isFetching: statusFetching } = useQuery({
    queryKey: ['personnel-status', statusDate],
    queryFn: () => apiService.get(`/api/v1/personnel/schedules/personnel-status?schedule_date=${statusDate}`),
    enabled: !!statusDate,
    staleTime: 15000,
  });
  // { personnel_id → shift_id } for the selected date
  const scheduledOnDate = Object.fromEntries(
    (personnelStatusRaw?.scheduled || []).map(({ personnel_id, shift_id }) => [personnel_id, shift_id])
  );

  // ── derived data ─────────────────────────────────────────────────────────────
  const shifts    = Array.isArray(shiftsRaw)    ? shiftsRaw    : (shiftsRaw?.results    || shiftsRaw?.data    || []);
  const personnel = Array.isArray(personnelRaw) ? personnelRaw : (personnelRaw?.results || personnelRaw?.data || []);
  const schedules = Array.isArray(schedulesRaw) ? schedulesRaw : (schedulesRaw?.results || schedulesRaw?.data || []);

  const personnelMap = Object.fromEntries(personnel.map((p) => [p.id, p]));
  const shiftMap     = Object.fromEntries(shifts.map((s) => [s.id, s]));

  // Schedule table filtered by the shift selector
  const filteredSchedules = shiftFilter
    ? schedules.filter((s) => s.shift_id === shiftFilter)
    : schedules;

  // Today's schedules (for stat cards)
  const todayStr      = dayjs().format('YYYY-MM-DD');
  const todaySchedules = schedules.filter(
    (s) => s.schedule_date && dayjs(s.schedule_date).format('YYYY-MM-DD') === todayStr
  );

  // Build personnel Select options — when disableScheduled=true, already-booked
  // employees are shown disabled with which shift they're already on (BioTime style)
  const buildPersonnelOptions = (disableScheduled = false) =>
    personnel.map((p) => {
      const scheduledShiftId = scheduledOnDate[p.id];
      const isScheduled      = scheduledShiftId !== undefined;
      const scheduledShiftName = isScheduled
        ? (shiftMap[scheduledShiftId]?.shift_name || 'another shift')
        : null;
      const code     = p.badge_id || p.emp_code || '';
      const baseName = p.full_name
        ? `${p.full_name}${code ? ` (${code})` : ''}`
        : (code || `#${p.id}`);
      return {
        value:    p.id,
        label:    isScheduled
          ? `${baseName} — already on: ${scheduledShiftName}`
          : baseName,
        disabled: disableScheduled && isScheduled,
      };
    });

  // ── mutations ────────────────────────────────────────────────────────────────
  const shiftMutation = useMutation({
    mutationFn: (data) => editingShift
      ? apiService.put(`/api/v1/personnel/shifts/${editingShift.id}`, data)
      : apiService.post('/api/v1/personnel/shifts', data),
    onSuccess: () => {
      message.success(editingShift ? 'Shift updated' : 'Shift created');
      setIsShiftModalVisible(false); setEditingShift(null); shiftForm.resetFields();
      queryClient.invalidateQueries(['shifts']);
    },
    onError: (e) => message.error(e.message || 'Operation failed'),
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/shifts/${id}`),
    onSuccess: () => { message.success('Shift deleted'); queryClient.invalidateQueries(['shifts']); },
    onError: (e) => message.error(e.message || 'Delete failed'),
  });

  const scheduleMutation = useMutation({
    mutationFn: (data) => editingSchedule
      ? apiService.put(`/api/v1/personnel/schedules/${editingSchedule.id}`, data)
      : apiService.post('/api/v1/personnel/schedules', data),
    onSuccess: () => {
      message.success(editingSchedule ? 'Schedule updated' : 'Shift assigned');
      closeScheduleModal();
      queryClient.invalidateQueries(['schedules']);
      queryClient.invalidateQueries(['personnel-status', scheduleModalDate]);
    },
    onError: (e) => message.error(e.message || 'Operation failed'),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/schedules/${id}`),
    onSuccess: () => {
      message.success('Schedule removed');
      queryClient.invalidateQueries(['schedules']);
      queryClient.invalidateQueries(['personnel-status']);
    },
    onError: (e) => message.error(e.message || 'Delete failed'),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: ({ shiftId, personnelIds, scheduleDate }) => {
      const params = new URLSearchParams();
      params.append('shift_id', shiftId);
      personnelIds.forEach((id) => params.append('personnel_ids', id));
      params.append('schedule_date', dayjs(scheduleDate).format('YYYY-MM-DD'));
      return apiService.post(`/api/v1/personnel/schedules/bulk-assign?${params.toString()}`);
    },
    onSuccess: (data) => {
      setBulkResult(data);
      queryClient.invalidateQueries(['schedules']);
      queryClient.invalidateQueries(['personnel-status']);
      bulkForm.resetFields();
    },
    onError: (e) => message.error(e.message || 'Bulk assignment failed'),
  });

  // ── handlers ─────────────────────────────────────────────────────────────────
  const closeScheduleModal = () => {
    setIsScheduleModalVisible(false);
    setEditingSchedule(null);
    setScheduleModalDate(null);
    scheduleForm.resetFields();
  };

  const closeBulkModal = () => {
    setIsBulkModalVisible(false);
    setBulkResult(null);
    setBulkModalDate(null);
    bulkForm.resetFields();
  };

  const handleShiftAdd   = () => { setEditingShift(null); shiftForm.resetFields(); setIsShiftModalVisible(true); };
  const handleShiftEdit  = (record) => {
    setEditingShift(record);
    shiftForm.setFieldsValue({
      ...record,
      start_time: record.start_time ? dayjs(record.start_time, 'HH:mm:ss') : null,
      end_time:   record.end_time   ? dayjs(record.end_time,   'HH:mm:ss') : null,
    });
    setIsShiftModalVisible(true);
  };
  const handleShiftModalOk = () => {
    shiftForm.validateFields().then((values) => {
      shiftMutation.mutate({
        ...values,
        start_time: values.start_time?.format('HH:mm:ss') ?? null,
        end_time:   values.end_time?.format('HH:mm:ss')   ?? null,
      });
    });
  };

  const handleScheduleAdd  = () => { setEditingSchedule(null); scheduleForm.resetFields(); setIsScheduleModalVisible(true); };
  const handleScheduleEdit = (record) => {
    setEditingSchedule(record);
    scheduleForm.setFieldsValue({
      personnel_id:  record.personnel_id,
      shift_id:      record.shift_id,
      schedule_date: record.schedule_date ? dayjs(record.schedule_date) : null,
      status:        record.status || 'scheduled',
      notes:         record.notes,
    });
    setScheduleModalDate(record.schedule_date ? dayjs(record.schedule_date).format('YYYY-MM-DD') : null);
    setIsScheduleModalVisible(true);
  };
  const handleScheduleModalOk = () => {
    scheduleForm.validateFields().then((values) => {
      scheduleMutation.mutate({
        ...values,
        schedule_date: values.schedule_date?.toISOString() ?? null,
      });
    });
  };

  const handleScheduleDateChange = (date) => {
    setScheduleModalDate(date ? date.format('YYYY-MM-DD') : null);
    // Reset personnel selection so user picks again with fresh availability
    if (!editingSchedule) scheduleForm.setFieldValue('personnel_id', undefined);
  };

  const handleBulkDateChange = (date) => {
    setBulkModalDate(date ? date.format('YYYY-MM-DD') : null);
    // Clear personnel selection — availability changes with date
    bulkForm.setFieldValue('personnel_ids', []);
  };

  // ── shift stats (all computed from live query data — auto-update on add/edit) ──
  const activeShifts   = shifts.filter((s) =>  s.is_active);
  const inactiveShifts = shifts.filter((s) => !s.is_active);
  const nightShifts    = shifts.filter((s) =>  s.is_night_shift);
  const flexibleShifts = shifts.filter((s) =>  s.is_flexible);
  const weekendShifts  = shifts.filter((s) =>  s.is_weekend_shift);
  // Type distribution — works regardless of how many shift types exist
  const shiftTypeBreakdown = shifts.reduce((acc, s) => {
    acc[s.shift_type] = (acc[s.shift_type] || 0) + 1;
    return acc;
  }, {});

  // ── schedule stats ────────────────────────────────────────────────────────────
  const weekStart         = dayjs().startOf('week');
  const weekEnd           = dayjs().endOf('week');
  const thisWeekSchedules = schedules.filter((s) => {
    const d = dayjs(s.schedule_date);
    return d.isAfter(weekStart.subtract(1, 'ms')) && d.isBefore(weekEnd.add(1, 'ms'));
  });

  // ── SHIFT TABLE columns ───────────────────────────────────────────────────────
  const shiftColumns = [
    {
      title: 'Code', dataIndex: 'shift_code', key: 'shift_code', width: 100,
      render: (v) => <Text strong style={{ fontFamily: 'monospace' }}>{v}</Text>,
    },
    {
      title: 'Shift Name', dataIndex: 'shift_name', key: 'shift_name', width: 170,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Space size={4}>
            {r.is_night_shift  && <Tag color="purple" style={{ fontSize: 10, padding: '0 4px' }}>Night</Tag>}
            {r.is_flexible     && <Tag color="cyan"   style={{ fontSize: 10, padding: '0 4px' }}>Flexible</Tag>}
            {r.is_weekend_shift && <Tag color="orange" style={{ fontSize: 10, padding: '0 4px' }}>Weekend</Tag>}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Hours', key: 'hours', width: 160,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text><ClockCircleOutlined style={{ marginRight: 4, color: '#1890ff' }} />{fmtTime(r.start_time)} – {fmtTime(r.end_time)}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.working_hours}h work · {r.break_duration ?? 0}min break</Text>
        </Space>
      ),
    },
    {
      title: 'Type', dataIndex: 'shift_type', key: 'shift_type', width: 100,
      render: (t) => <Tag color={SHIFT_TYPE_COLOR[t] || 'default'}>{t}</Tag>,
    },
    {
      title: 'Attendance Rules', key: 'rules', width: 230,
      render: (_, r) => (
        <Space direction="vertical" size={0} style={{ fontSize: 12 }}>
          <Tooltip title="Clock-in within this window after shift start counts as on-time">
            <Text type="secondary">
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
              Grace: <Text strong>{r.grace_period_minutes ?? 15}min</Text>
            </Text>
          </Tooltip>
          <Tooltip title="Late arrivals beyond this limit are marked absent">
            <Text type="secondary">
              <WarningOutlined style={{ color: '#faad14', marginRight: 4 }} />
              Max late: <Text strong>{r.max_late_minutes ?? 60}min</Text>
            </Text>
          </Tooltip>
          <Tooltip title="Minutes worked past shift end before counted as overtime">
            <Text type="secondary">
              <InfoCircleOutlined style={{ color: '#1890ff', marginRight: 4 }} />
              OT after: <Text strong>{r.overtime_threshold_minutes ?? 30}min</Text>
            </Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (v) => <Badge status={v ? 'success' : 'default'} text={v ? 'Active' : 'Inactive'} />,
    },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="primary" icon={<EditOutlined />} size="small" onClick={() => handleShiftEdit(record)}>Edit</Button>
          <Popconfirm
            title="Delete this shift?"
            description="Schedules using this shift will also be affected."
            onConfirm={() => deleteShiftMutation.mutate(record.id)}
            okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} size="small">Del</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── SCHEDULE TABLE columns ─────────────────────────────────────────────────────
  const scheduleColumns = [
    {
      title: 'Date', dataIndex: 'schedule_date', key: 'schedule_date', width: 115,
      sorter: (a, b) => new Date(a.schedule_date) - new Date(b.schedule_date),
      defaultSortOrder: 'descend',
      render: (d) => {
        if (!d) return '—';
        const dj      = dayjs(d);
        const isToday = dj.format('YYYY-MM-DD') === todayStr;
        return (
          <Space direction="vertical" size={0}>
            <Text strong style={isToday ? { color: '#1890ff' } : {}}>{dj.format('DD MMM YYYY')}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{dj.format('ddd')}{isToday ? ' · Today' : ''}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Personnel', dataIndex: 'personnel_id', key: 'personnel_id',
      render: (id) => {
        const p    = personnelMap[id];
        const name = p ? (p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.emp_code) : `#${id}`;
        const code = p?.badge_id || p?.emp_code || '';
        return (
          <Space>
            <UserOutlined style={{ color: '#8c8c8c' }} />
            <Space direction="vertical" size={0}>
              <Text strong>{name}</Text>
              {code && <Text type="secondary" style={{ fontSize: 11 }}>{code}</Text>}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Shift', dataIndex: 'shift_id', key: 'shift_id',
      filters: shifts.map((s) => ({ text: s.shift_name, value: s.id })),
      onFilter: (value, record) => record.shift_id === value,
      render: (id) => {
        const s = shiftMap[id];
        if (!s) return `Shift #${id}`;
        return (
          <Space direction="vertical" size={0}>
            <Space>
              <Tag color={SHIFT_TYPE_COLOR[s.shift_type] || 'default'} style={{ marginRight: 0 }}>{s.shift_type}</Tag>
              <Text strong>{s.shift_name}</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 11 }}>
              <ClockCircleOutlined style={{ marginRight: 3 }} />{fmtTime(s.start_time)} – {fmtTime(s.end_time)} · {s.working_hours}h
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      filters: [
        { text: 'Scheduled',  value: 'scheduled'  },
        { text: 'Completed',  value: 'completed'  },
        { text: 'Cancelled',  value: 'cancelled'  },
      ],
      onFilter: (value, record) => record.status === value,
      render: (s) => <Badge status={STATUS_COLOR[s] || 'default'} text={STATUS_LABEL[s] || s} />,
    },
    {
      title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true,
      render: (v) => v ? <Text type="secondary">{v}</Text> : null,
    },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="primary" icon={<EditOutlined />} size="small" onClick={() => handleScheduleEdit(record)}>Edit</Button>
          <Popconfirm
            title="Remove this schedule assignment?"
            onConfirm={() => deleteScheduleMutation.mutate(record.id)}
            okText="Remove" cancelText="Cancel" okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} size="small">Del</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── modal availability counts ─────────────────────────────────────────────────
  const scheduledCount = Object.keys(scheduledOnDate).length;
  const availableCount = personnel.length - scheduledCount;

  // ── render ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px' }}>
      <Card styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 16px' }}
          items={[
            // ═══════════════════════════════════════════════════════════════════
            //  SHIFTS TAB
            // ═══════════════════════════════════════════════════════════════════
            {
              key:   'shifts',
              label: <span><ClockCircleOutlined style={{ marginRight: 6 }} />Shifts</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  {/* Summary cards — always meaningful, auto-update when shifts are added */}
                  <Row gutter={[12, 12]} style={{ padding: '12px 16px 16px' }}>
                    {/* Card 1: Total with active/inactive split */}
                    <Col xs={12} sm={6}>
                      <Card size="small" styles={{ body: { padding: '12px 14px' } }}>
                        <Statistic
                          title="Total Shifts"
                          value={shifts.length}
                          valueStyle={{ color: '#1890ff', fontSize: 22 }}
                        />
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <Badge status="success" />{' '}{activeShifts.length} active
                            <span style={{ margin: '0 6px' }}>·</span>
                            <Badge status="default" />{' '}{inactiveShifts.length} inactive
                          </Text>
                        </div>
                      </Card>
                    </Col>

                    {/* Card 2: Type distribution — dynamic, new shift types appear automatically */}
                    <Col xs={12} sm={6}>
                      <Card size="small" styles={{ body: { padding: '12px 14px' } }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>By Shift Type</Text>
                        <div style={{ marginTop: 8 }}>
                          {Object.keys(shiftTypeBreakdown).length === 0
                            ? <Text type="secondary" style={{ fontSize: 12 }}>No shifts defined</Text>
                            : Object.entries(shiftTypeBreakdown).map(([type, count]) => (
                                <Tag key={type} color={SHIFT_TYPE_COLOR[type] || 'default'} style={{ marginBottom: 4, fontSize: 12 }}>
                                  {type}: {count}
                                </Tag>
                              ))
                          }
                        </div>
                      </Card>
                    </Col>

                    {/* Card 3: Attribute flags (night-spanning / flexible / weekend) */}
                    <Col xs={12} sm={6}>
                      <Card size="small" styles={{ body: { padding: '12px 14px' } }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Attributes</Text>
                        <div style={{ marginTop: 8 }}>
                          <Space direction="vertical" size={3}>
                            <Text style={{ fontSize: 12 }}>
                              Night-spanning:{' '}
                              <strong style={{ color: '#722ed1' }}>{nightShifts.length}</strong>
                              <Text type="secondary" style={{ fontSize: 11 }}> (spans midnight)</Text>
                            </Text>
                            <Text style={{ fontSize: 12 }}>
                              Flexible hours:{' '}
                              <strong style={{ color: '#13c2c2' }}>{flexibleShifts.length}</strong>
                            </Text>
                            <Text style={{ fontSize: 12 }}>
                              Weekend shifts:{' '}
                              <strong style={{ color: '#fa8c16' }}>{weekendShifts.length}</strong>
                            </Text>
                          </Space>
                        </div>
                      </Card>
                    </Col>

                    {/* Card 4: Schedule count per shift (cross-reference) */}
                    <Col xs={12} sm={6}>
                      <Card size="small" styles={{ body: { padding: '12px 14px' } }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Assignments per Shift</Text>
                        <div style={{ marginTop: 8 }}>
                          {activeShifts.length === 0
                            ? <Text type="secondary" style={{ fontSize: 12 }}>No active shifts</Text>
                            : activeShifts.map((s) => {
                                const count = schedules.filter((sc) => sc.shift_id === s.id).length;
                                return (
                                  <div key={s.id} style={{ marginBottom: 3 }}>
                                    <Text style={{ fontSize: 12 }}>
                                      <Tag color={SHIFT_TYPE_COLOR[s.shift_type] || 'default'}
                                        style={{ fontSize: 10, padding: '0 4px', marginRight: 4 }}>
                                        {s.shift_code}
                                      </Tag>
                                      <strong>{count}</strong> assigned
                                    </Text>
                                  </div>
                                );
                              })
                          }
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* Toolbar */}
                  <div style={{ padding: '0 16px 12px' }}>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleShiftAdd}>Add Shift</Button>
                      <Button icon={<ReloadOutlined />} onClick={() => refetchShifts()}>Refresh</Button>
                    </Space>
                  </div>

                  <Table
                    columns={shiftColumns}
                    dataSource={shifts}
                    loading={shiftsLoading}
                    rowKey="id"
                    pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} shifts` }}
                    scroll={{ x: 1000 }}
                    size="small"
                    style={{ padding: '0 16px' }}
                    rowClassName={(r) => !r.is_active ? 'ant-table-row-disabled' : ''}
                  />
                </div>
              ),
            },

            // ═══════════════════════════════════════════════════════════════════
            //  SCHEDULE TAB
            // ═══════════════════════════════════════════════════════════════════
            {
              key:   'schedule',
              label: <span><CalendarOutlined style={{ marginRight: 6 }} />Schedule</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  {/* Summary cards — total-based so they always show real numbers */}
                  <Row gutter={[12, 12]} style={{ padding: '12px 16px 16px' }}>
                    {/* Card 1: All-time totals with today/week sub-line */}
                    <Col xs={12} sm={6}>
                      <Card size="small" styles={{ body: { padding: '12px 14px' } }}>
                        <Statistic
                          title="Total Assignments"
                          value={schedules.length}
                          valueStyle={{ color: '#1890ff', fontSize: 22 }}
                        />
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {todaySchedules.length} today · {thisWeekSchedules.length} this week
                          </Text>
                        </div>
                      </Card>
                    </Col>

                    {/* Card 2: Status breakdown — compact, no separate card per status */}
                    <Col xs={12} sm={6}>
                      <Card size="small" styles={{ body: { padding: '12px 14px' } }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>By Status</Text>
                        <div style={{ marginTop: 8 }}>
                          <Space direction="vertical" size={3}>
                            {[
                              { key: 'scheduled', label: 'Scheduled', color: '#1890ff' },
                              { key: 'completed', label: 'Completed', color: '#52c41a' },
                              { key: 'cancelled', label: 'Cancelled', color: '#ff4d4f' },
                            ].map((st) => (
                              <Text key={st.key} style={{ fontSize: 12 }}>
                                <Badge status={STATUS_COLOR[st.key]} />
                                {' '}{st.label}:{' '}
                                <strong style={{ color: st.color }}>
                                  {schedules.filter((s) => s.status === st.key).length}
                                </strong>
                              </Text>
                            ))}
                          </Space>
                        </div>
                      </Card>
                    </Col>

                    {/* Card 3: Per-shift total — one compact list, scales to any number of shifts */}
                    <Col xs={12} sm={6}>
                      <Card size="small" styles={{ body: { padding: '12px 14px' } }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>By Shift (All-time)</Text>
                        <div style={{ marginTop: 8 }}>
                          {shifts.filter((s) => s.is_active).length === 0
                            ? <Text type="secondary" style={{ fontSize: 12 }}>No active shifts</Text>
                            : shifts.filter((s) => s.is_active).map((s) => {
                                const total = schedules.filter((sc) => sc.shift_id === s.id).length;
                                return (
                                  <div key={s.id} style={{ marginBottom: 3 }}>
                                    <Text style={{ fontSize: 12 }}>
                                      <Tag color={SHIFT_TYPE_COLOR[s.shift_type] || 'default'}
                                        style={{ fontSize: 10, padding: '0 4px', marginRight: 4 }}>
                                        {s.shift_type}
                                      </Tag>
                                      {s.shift_name}: <strong>{total}</strong>
                                    </Text>
                                  </div>
                                );
                              })
                          }
                        </div>
                      </Card>
                    </Col>

                    {/* Card 4: Today's snapshot (useful when non-zero, graceful when zero) */}
                    <Col xs={12} sm={6}>
                      <Card size="small" styles={{ body: { padding: '12px 14px' } }}>
                        <Statistic
                          title="Today's Scheduled"
                          value={todaySchedules.length}
                          valueStyle={{
                            color: todaySchedules.length > 0 ? '#52c41a' : '#bfbfbf',
                            fontSize: 22,
                          }}
                        />
                        <div style={{ marginTop: 4 }}>
                          {todaySchedules.length > 0
                            ? shifts.filter((s) => s.is_active).map((s) => {
                                const n = todaySchedules.filter((sc) => sc.shift_id === s.id).length;
                                return n > 0 ? (
                                  <Text key={s.id} type="secondary" style={{ fontSize: 11, display: 'block' }}>
                                    {s.shift_name}: {n}
                                  </Text>
                                ) : null;
                              })
                            : <Text type="secondary" style={{ fontSize: 12 }}>No schedules today</Text>
                          }
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* Toolbar — actions left, shift filter right (BioTime roster pattern) */}
                  <div style={{ padding: '0 16px 12px' }}>
                    <Row justify="space-between" align="middle" gutter={[0, 8]}>
                      <Col>
                        <Space wrap>
                          <Button type="primary" icon={<PlusOutlined />} onClick={handleScheduleAdd}>Assign Shift</Button>
                          <Button icon={<TeamOutlined />} onClick={() => { setBulkResult(null); setIsBulkModalVisible(true); }}>
                            Bulk Assign
                          </Button>
                          <Button icon={<ReloadOutlined />} onClick={() => refetchSchedules()}>Refresh</Button>
                        </Space>
                      </Col>
                      <Col>
                        <Space align="center">
                          <FilterOutlined style={{ color: '#8c8c8c' }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>Shift:</Text>
                          <Select
                            allowClear
                            placeholder="All Shifts"
                            value={shiftFilter}
                            onChange={(v) => setShiftFilter(v ?? null)}
                            style={{ width: 230 }}
                            options={shifts.filter((s) => s.is_active).map((s) => ({
                              value: s.id,
                              label: `${s.shift_name} · ${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`,
                            }))}
                          />
                        </Space>
                      </Col>
                    </Row>
                  </div>

                  {/* Show active filter badge */}
                  {shiftFilter && (
                    <div style={{ padding: '0 16px 8px' }}>
                      <Alert
                        type="info"
                        showIcon
                        message={
                          <span>
                            Showing only <strong>{shiftMap[shiftFilter]?.shift_name}</strong> employees
                            ({filteredSchedules.length} of {schedules.length} assignments).
                            <Button type="link" size="small" onClick={() => setShiftFilter(null)} style={{ padding: '0 4px' }}>
                              Show all
                            </Button>
                          </span>
                        }
                        style={{ padding: '4px 12px' }}
                      />
                    </div>
                  )}

                  <Table
                    columns={scheduleColumns}
                    dataSource={filteredSchedules}
                    loading={schedulesLoading}
                    rowKey="id"
                    pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} assignments` }}
                    scroll={{ x: 900 }}
                    size="small"
                    style={{ padding: '0 16px' }}
                  />
                </div>
              ),
            },
            // ═══════════════════════════════════════════════════════════════════
            //  WEEKLY ROSTER TAB
            // ═══════════════════════════════════════════════════════════════════
            {
              key:   'roster',
              label: <span><CalendarOutlined style={{ marginRight: 6 }} />Weekly Roster</span>,
              children: (
                <Suspense fallback={<div style={{ padding: 32, textAlign: 'center' }}><span>Loading…</span></div>}>
                  <WeeklyRosterBuilder />
                </Suspense>
              ),
            },
          ]}
        />
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          SHIFT MODAL (Add / Edit)
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        title={editingShift ? `Edit Shift — ${editingShift.shift_name}` : 'Add New Shift'}
        open={isShiftModalVisible}
        onOk={handleShiftModalOk}
        onCancel={() => { setIsShiftModalVisible(false); setEditingShift(null); shiftForm.resetFields(); }}
        confirmLoading={shiftMutation.isPending}
        width={820}
        okText={editingShift ? 'Update Shift' : 'Create Shift'}
      >
        <Form form={shiftForm} layout="vertical" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="shift_code" label="Shift Code" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g., MORNING, EVE-1" disabled={!!editingShift} style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="shift_name" label="Shift Name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g., Morning Shift" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_time" label="Start Time" rules={[{ required: true, message: 'Required' }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_time" label="End Time" rules={[{ required: true, message: 'Required' }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="shift_type" label="Shift Type" rules={[{ required: true }]} initialValue="CUSTOM">
                <Select>
                  {Object.entries(SHIFT_TYPE_COLOR).map(([v, c]) => (
                    <Select.Option key={v} value={v}><Tag color={c}>{v}</Tag></Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="working_hours" label="Working Hours" rules={[{ required: true }]} initialValue={8}>
                <InputNumber min={1} max={24} addonAfter="hrs" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="break_duration" label="Break Duration" initialValue={30}>
                <InputNumber min={0} max={120} addonAfter="min" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="overtime_threshold_minutes" label="OT Threshold" initialValue={30}
                tooltip="Minutes worked past shift end before counted as overtime">
                <InputNumber min={0} max={120} addonAfter="min" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="grace_period_minutes" label="Grace Period" initialValue={15}
                tooltip="Clock-in within this window after shift start = on-time">
                <InputNumber min={0} max={60} addonAfter="min" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_late_minutes" label="Max Late" initialValue={60}
                tooltip="Beyond grace period up to this = late. Beyond this = absent">
                <InputNumber min={0} max={180} addonAfter="min" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_early_departure_minutes" label="Max Early Departure" initialValue={30}
                tooltip="Allowed early checkout before flagged">
                <InputNumber min={0} max={120} addonAfter="min" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="is_night_shift" label="Night Shift" valuePropName="checked"
                tooltip="Enable for shifts spanning midnight (e.g. 22:00–06:00)">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="is_flexible" label="Flexible Hours" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="is_weekend_shift" label="Weekend Shift" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional shift description" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          SCHEDULE MODAL (Single Assign / Edit)
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        title={editingSchedule ? 'Edit Schedule Assignment' : 'Assign Shift to Personnel'}
        open={isScheduleModalVisible}
        onOk={handleScheduleModalOk}
        onCancel={closeScheduleModal}
        confirmLoading={scheduleMutation.isPending}
        width={480}
        okText={editingSchedule ? 'Update' : 'Assign'}
      >
        <Alert
          type="info"
          showIcon
          message="BioTime rule: one shift per employee per day"
          description="Select a date first — employees already scheduled on that day will be shown as disabled."
          style={{ marginBottom: 12 }}
        />
        <Form form={scheduleForm} layout="vertical">
          {/* Date first — determines which employees are available */}
          <Form.Item name="schedule_date" label="Date" rules={[{ required: true, message: 'Select date' }]}>
            <DatePicker
              style={{ width: '100%' }}
              format="DD MMM YYYY"
              onChange={handleScheduleDateChange}
            />
          </Form.Item>
          <Form.Item name="personnel_id" label="Personnel" rules={[{ required: true, message: 'Select personnel' }]}>
            <Select
              showSearch
              placeholder={
                scheduleModalDate
                  ? `Select personnel (${scheduledCount} already scheduled on this date)`
                  : 'Select a date above to check availability'
              }
              optionFilterProp="label"
              loading={statusFetching}
              options={buildPersonnelOptions(!!scheduleModalDate && !editingSchedule)}
            />
          </Form.Item>
          <Form.Item name="shift_id" label="Shift" rules={[{ required: true, message: 'Select shift' }]}>
            <Select
              placeholder="Select shift"
              options={shifts.filter((s) => s.is_active).map((s) => ({
                value: s.id,
                label: `${s.shift_name} · ${fmtTime(s.start_time)}–${fmtTime(s.end_time)} (${s.working_hours}h)`,
              }))}
            />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="scheduled">
            <Select>
              <Select.Option value="scheduled">Scheduled</Select.Option>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="cancelled">Cancelled</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          BULK ASSIGN MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        title={<span><TeamOutlined style={{ marginRight: 8 }} />Bulk Shift Assignment</span>}
        open={isBulkModalVisible}
        onCancel={closeBulkModal}
        footer={bulkResult ? [
          <Button key="close" onClick={closeBulkModal}>Close</Button>,
        ] : [
          <Button key="cancel" onClick={closeBulkModal}>Cancel</Button>,
          <Button
            key="submit" type="primary" icon={<TeamOutlined />}
            loading={bulkAssignMutation.isPending}
            onClick={() => bulkForm.validateFields().then((v) =>
              bulkAssignMutation.mutate({ shiftId: v.shift_id, personnelIds: v.personnel_ids, scheduleDate: v.schedule_date })
            )}
          >
            Assign to All Selected
          </Button>,
        ]}
        width={580}
      >
        {bulkResult ? (
          <div>
            <Alert
              type={bulkResult.errors?.length ? 'warning' : 'success'}
              message={`Bulk assignment complete for ${bulkResult.date}`}
              description={
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  <li><strong>{bulkResult.created}</strong> schedules created</li>
                  <li><strong>{bulkResult.skipped_conflicts}</strong> skipped (already scheduled)</li>
                  {bulkResult.errors?.length > 0 && (
                    <li style={{ color: '#ff4d4f' }}>{bulkResult.errors.join(', ')}</li>
                  )}
                </ul>
              }
              showIcon
            />
            <p style={{ marginTop: 12, color: '#8c8c8c', fontSize: 12 }}>
              Assignments written to schedule_management and att_schedule (ZKTeco-native) simultaneously.
            </p>
          </div>
        ) : (
          <Form form={bulkForm} layout="vertical">
            <Alert
              type="info"
              showIcon
              message="BioTime-compatible bulk assignment"
              description="Select a date first — personnel already on a shift for that day are shown as disabled."
              style={{ marginBottom: 16 }}
            />

            {/* Date first — same UX as BioTime: date defines who's available */}
            <Form.Item name="schedule_date" label="Date" rules={[{ required: true, message: 'Select date' }]}>
              <DatePicker
                style={{ width: '100%' }}
                format="DD MMM YYYY"
                onChange={handleBulkDateChange}
              />
            </Form.Item>

            {/* Availability summary once a date is selected */}
            {bulkModalDate && (
              <div style={{ marginBottom: 8, padding: '6px 10px', background: '#f6ffed', borderRadius: 4, border: '1px solid #b7eb8f' }}>
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text style={{ fontSize: 12 }}>
                    <strong>{availableCount}</strong> available · <strong>{scheduledCount}</strong> already scheduled on {bulkModalDate}
                  </Text>
                </Space>
              </div>
            )}

            <Form.Item name="shift_id" label="Shift to Assign" rules={[{ required: true, message: 'Select shift' }]}>
              <Select
                placeholder="Select shift"
                options={shifts.filter((s) => s.is_active).map((s) => ({
                  value: s.id,
                  label: `${s.shift_name} · ${fmtTime(s.start_time)}–${fmtTime(s.end_time)} (${s.working_hours}h)`,
                }))}
              />
            </Form.Item>

            <Form.Item name="personnel_ids" label="Select Personnel" rules={[{ required: true, message: 'Select at least one person' }]}>
              <Select
                mode="multiple"
                showSearch
                placeholder={
                  bulkModalDate
                    ? `Select personnel (${availableCount} available, ${scheduledCount} disabled)`
                    : 'Select a date above first'
                }
                optionFilterProp="label"
                maxTagCount={4}
                loading={statusFetching && !!bulkModalDate}
                options={buildPersonnelOptions(!!bulkModalDate)}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ShiftManagement;
