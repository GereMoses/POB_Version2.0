import React, { useState, useMemo, useCallback } from 'react';
import {
  Button, Input, Select, Tag, Popconfirm, Form, InputNumber,
  Space, Spin, App, Progress, DatePicker, Switch,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  SafetyCertificateOutlined, CalendarOutlined,
  SearchOutlined, CloseOutlined, SaveOutlined,
  ReloadOutlined, CaretDownOutlined, CaretRightOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiService from '../../services/api';

const { Option } = Select;
const { TextArea } = Input;

const STATUS = {
  pending:     { color: '#8c8c8c', bg: '#f5f5f5', label: 'Pending' },
  in_progress: { color: '#1677ff', bg: '#e6f4ff', label: 'In Progress' },
  completed:   { color: '#52c41a', bg: '#f6ffed', label: 'Completed' },
  missed:      { color: '#f5222d', bg: '#fff1f0', label: 'Missed' },
};

const C = {
  bg: '#f0f2f5',
  panel: 'white',
  border: '#f0f0f0',
  selBg: '#e6f4ff',
  darkHeader: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
};

/* ── Checkpoint timeline ─────────────────────────────────────────────── */
const CheckpointTimeline = ({ checkpoints, compliance }) => {
  if (!checkpoints?.length)
    return <div style={{ color: '#bfbfbf', fontSize: 13, padding: '12px 0' }}>No checkpoints defined</div>;

  const cpMap = {};
  compliance?.checkpoints?.forEach(c => { cpMap[c.door_id] = c; });

  return (
    <div>
      {checkpoints.map((cp, i) => {
        const isLast = i === checkpoints.length - 1;
        const cpData = cpMap[cp.door_id];
        const scanned = cpData?.scanned;
        const scanTime = cpData?.scan_time;
        const hasCompliance = !!compliance;

        return (
          <div key={i} style={{ display: 'flex', gap: 14 }}>
            {/* Line + circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', zIndex: 1,
                background: hasCompliance
                  ? (scanned ? '#52c41a' : '#f5222d')
                  : '#1677ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: 12,
                boxShadow: `0 2px 6px ${hasCompliance ? (scanned ? 'rgba(82,196,26,0.4)' : 'rgba(245,34,45,0.3)') : 'rgba(22,119,255,0.3)'}`,
              }}>
                {hasCompliance
                  ? (scanned ? <CheckCircleOutlined style={{ fontSize: 14 }} /> : <CloseCircleOutlined style={{ fontSize: 14 }} />)
                  : i + 1}
              </div>
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 24, background: '#e8e8e8', margin: '2px 0' }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16, paddingTop: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{cp.door_name || `Door #${cp.door_id}`}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {cp.time_window_minutes} min window
                </span>
                {hasCompliance && scanned && scanTime && (
                  <span style={{ fontSize: 11, color: '#52c41a' }}>
                    Scanned {dayjs(scanTime).format('HH:mm')}
                  </span>
                )}
                {hasCompliance && !scanned && (
                  <span style={{ fontSize: 11, color: '#f5222d' }}>Missed</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Checkpoint builder row ──────────────────────────────────────────── */
const CpBuilderRow = ({ cp, index, doors, onChange, onRemove, canRemove }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
    <div style={{
      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
      background: '#1677ff', color: 'white', fontWeight: 700, fontSize: 11,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{index + 1}</div>
    <Select
      style={{ flex: 1 }}
      placeholder="Select door / reader"
      value={cp.door_id}
      onChange={v => onChange({ ...cp, door_id: v })}
      showSearch optionFilterProp="label"
    >
      {doors.map(d => <Option key={d.id} value={d.id} label={d.door_name}>{d.door_name}</Option>)}
    </Select>
    <InputNumber
      min={1} max={120} value={cp.time_window_minutes}
      onChange={v => onChange({ ...cp, time_window_minutes: v })}
      addonAfter="min" style={{ width: 110 }}
    />
    <Button size="small" type="text" danger icon={<DeleteOutlined />}
      disabled={!canRemove} onClick={onRemove} />
  </div>
);

/* ── Schedule card with inline compliance ────────────────────────────── */
const ScheduleCard = ({ sched, onSelect, isExpanded, compliance, complianceFetching }) => {
  const s = STATUS[sched.status] || STATUS.pending;
  const pct = compliance?.compliance_pct ?? null;

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 10, overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Header row */}
      <div
        style={{
          padding: '10px 14px', cursor: 'pointer',
          background: isExpanded ? '#fafafa' : 'white',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
        onClick={onSelect}
      >
        {isExpanded
          ? <CaretDownOutlined style={{ fontSize: 10, color: '#8c8c8c', flexShrink: 0 }} />
          : <CaretRightOutlined style={{ fontSize: 10, color: '#bfbfbf', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {sched.guard_name_full || sched.guard_emp_code}
            </span>
            <div style={{
              fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '1px 7px',
              background: s.bg, color: s.color,
            }}>{s.label}</div>
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
            {sched.scheduled_start ? dayjs(sched.scheduled_start).format('DD MMM YYYY HH:mm') : '—'}
          </div>
        </div>
        {pct !== null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: pct === 100 ? '#52c41a' : pct > 50 ? '#1677ff' : '#f5222d',
            }}>{pct}%</div>
            <div style={{ fontSize: 10, color: '#8c8c8c' }}>compliance</div>
          </div>
        )}
      </div>

      {/* Expanded compliance */}
      {isExpanded && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: '#fafafa' }}>
          {complianceFetching ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}><Spin size="small" /></div>
          ) : compliance ? (
            <>
              <Progress
                percent={compliance.compliance_pct}
                size="small"
                strokeColor={compliance.compliance_pct === 100 ? '#52c41a' : compliance.compliance_pct > 50 ? '#1677ff' : '#f5222d'}
                format={p => `${compliance.scanned || 0}/${compliance.total || 0}`}
                style={{ marginBottom: 10 }}
              />
              <CheckpointTimeline checkpoints={compliance.checkpoints} compliance={compliance} />
            </>
          ) : (
            <div style={{ color: '#bfbfbf', fontSize: 12 }}>No compliance data available</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main component ─────────────────────────────────────────────────── */
export default function GuardTour() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form]  = Form.useForm();
  const [sform] = Form.useForm();

  const [selId,        setSelId]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [editMode,     setEditMode]     = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [scheduling,   setScheduling]   = useState(false);
  const [expandedSched, setExpandedSched] = useState(null);
  const [cpRows, setCpRows] = useState([{ door_id: null, sequence_order: 1, time_window_minutes: 10 }]);

  // ── Queries ────────────────────────────────────────────────────────
  const { data: toursData, isLoading, refetch } = useQuery({
    queryKey: ['guard-tours'],
    queryFn:  () => apiService.get('/api/access-control/guard-tour/'),
  });
  const tours = toursData?.data || [];

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn:  () => apiService.get('/api/access-control/doors/'),
  });
  const doors = doorsData?.data || [];

  const { data: empData } = useQuery({
    queryKey: ['personnel-list'],
    queryFn:  () => apiService.get('/api/v1/personnel/'),
  });
  const employees = empData?.data || empData?.results || [];

  const { data: schedsData, refetch: refetchScheds } = useQuery({
    queryKey: ['guard-tour-schedules', selId],
    queryFn:  () => apiService.get(`/api/access-control/guard-tour/schedules/?tour_id=${selId}`),
    enabled:  !!selId,
    refetchInterval: 30000,
  });
  const schedules = schedsData?.data || [];

  const { data: complianceData, isFetching: compFetching } = useQuery({
    queryKey: ['guard-tour-compliance', expandedSched],
    queryFn:  () => apiService.get(`/api/access-control/guard-tour/schedules/${expandedSched}/compliance/`),
    enabled:  !!expandedSched,
  });
  const compliance = complianceData?.data;

  // ── Derived ────────────────────────────────────────────────────────
  const selTour = useMemo(() => tours.find(t => t.id === selId) || null, [tours, selId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? tours.filter(t => t.tour_name?.toLowerCase().includes(q)) : tours;
  }, [tours, search]);

  const activeTours  = tours.filter(t => t.is_active).length;
  const totalScheds  = schedules.length;
  const completedScheds = schedules.filter(s => s.status === 'completed').length;

  // ── Mutations ──────────────────────────────────────────────────────
  const saveTour = useMutation({
    mutationFn: body => adding
      ? apiService.post('/api/access-control/guard-tour/', body)
      : apiService.put(`/api/access-control/guard-tour/${selId}`, body),
    onSuccess: res => {
      message.success(adding ? 'Tour created' : 'Tour updated');
      qc.invalidateQueries(['guard-tours']);
      if (adding) { setAdding(false); setSelId(res?.data?.id ?? null); }
      setEditMode(false);
    },
    onError: e => message.error(e?.message || 'Error saving tour'),
  });

  const deleteTour = useMutation({
    mutationFn: id => apiService.delete(`/api/access-control/guard-tour/${id}`),
    onSuccess: () => {
      message.success('Tour deleted');
      qc.invalidateQueries(['guard-tours']);
      setSelId(null); setEditMode(false);
    },
  });

  const createSched = useMutation({
    mutationFn: body => apiService.post('/api/access-control/guard-tour/schedules/', body),
    onSuccess: () => {
      message.success('Round scheduled');
      qc.invalidateQueries(['guard-tour-schedules', selId]);
      setScheduling(false); sform.resetFields();
    },
    onError: e => message.error(e?.message || 'Error creating schedule'),
  });

  // ── Handlers ──────────────────────────────────────────────────────
  const startAdd = () => {
    form.resetFields();
    form.setFieldsValue({ interval_minutes: 60, is_active: true });
    setCpRows([{ door_id: null, sequence_order: 1, time_window_minutes: 10 }]);
    setSelId(null); setEditMode(false); setAdding(true); setScheduling(false);
  };

  const startEdit = () => {
    if (!selTour) return;
    form.setFieldsValue({
      tour_name: selTour.tour_name,
      description: selTour.description,
      interval_minutes: selTour.interval_minutes,
      is_active: selTour.is_active,
    });
    setCpRows(selTour.checkpoints?.length
      ? selTour.checkpoints.map(c => ({ door_id: c.door_id, sequence_order: c.sequence_order, time_window_minutes: c.time_window_minutes }))
      : [{ door_id: null, sequence_order: 1, time_window_minutes: 10 }]);
    setEditMode(true); setScheduling(false);
  };

  const handleSave = () => {
    form.validateFields().then(vals => {
      saveTour.mutate({
        ...vals,
        checkpoints: cpRows
          .filter(r => r.door_id)
          .map((r, i) => ({ ...r, sequence_order: i + 1 })),
      });
    });
  };

  const handleSchedule = () => {
    sform.validateFields().then(vals => {
      createSched.mutate({
        tour_id: selId,
        guard_emp_code: vals.guard_emp_code,
        scheduled_start: vals.scheduled_start?.toISOString(),
        scheduled_end:   vals.scheduled_end?.toISOString(),
      });
    });
  };

  const selectTour = id => {
    setSelId(id);
    setEditMode(false);
    setAdding(false);
    setScheduling(false);
    setExpandedSched(null);
  };

  const cancelEdit = () => { setEditMode(false); setAdding(false); };

  const updateCpRow = useCallback((i, val) => {
    setCpRows(rows => rows.map((r, j) => j === i ? val : r));
  }, []);
  const removeCpRow = useCallback(i => {
    setCpRows(rows => rows.filter((_, j) => j !== i).map((r, j) => ({ ...r, sequence_order: j + 1 })));
  }, []);
  const addCpRow = () => {
    setCpRows(rows => [...rows, { door_id: null, sequence_order: rows.length + 1, time_window_minutes: 10 }]);
  };

  // ── Tour form content ─────────────────────────────────────────────
  const renderTourForm = () => (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
      <Form form={form} layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 16px', alignItems: 'start' }}>
          <Form.Item name="tour_name" label="Tour Name" rules={[{ required: true, message: 'Required' }]}>
            <Input size="large" placeholder="e.g. Night Patrol Route A" />
          </Form.Item>
          <Form.Item name="interval_minutes" label="Interval (min)">
            <InputNumber min={5} max={1440} size="large" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>
        <Form.Item name="description" label="Description">
          <TextArea rows={2} placeholder="Describe this patrol route..." />
        </Form.Item>
      </Form>

      <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 12 }}>
        Checkpoints — patrol sequence
      </div>
      {cpRows.map((cp, i) => (
        <CpBuilderRow
          key={i} cp={cp} index={i} doors={doors}
          onChange={v => updateCpRow(i, v)}
          onRemove={() => removeCpRow(i)}
          canRemove={cpRows.length > 1}
        />
      ))}
      <Button size="small" icon={<PlusOutlined />} onClick={addCpRow} style={{ marginTop: 4 }}>
        Add Checkpoint
      </Button>
    </div>
  );

  // ── Tour view content ─────────────────────────────────────────────
  const renderTourView = () => {
    if (!selTour) return null;
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>

        {/* Tour meta */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
            <div style={{ fontSize: 13, color: '#595959' }}>{selTour.description || 'No description'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 4 }}>Interval</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1677ff' }}>{selTour.interval_minutes}<span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 2 }}>min</span></div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 4 }}>Checkpoints</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#52c41a' }}>{selTour.checkpoints?.length || 0}</div>
          </div>
        </div>

        {/* Checkpoint timeline */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: 12 }}>
          Patrol Route
        </div>
        <div style={{ marginBottom: 24 }}>
          <CheckpointTimeline checkpoints={selTour.checkpoints} compliance={null} />
        </div>

        {/* Scheduled rounds */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase' }}>
            Scheduled Rounds ({totalScheds})
          </div>
          <Space size={6}>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchScheds()} />
            <Button size="small" type="primary" icon={<CalendarOutlined />}
              onClick={() => { setScheduling(true); sform.resetFields(); }}>
              Schedule Round
            </Button>
          </Space>
        </div>

        {/* Inline schedule form */}
        {scheduling && (
          <div style={{
            background: '#e6f4ff', border: '1px solid #91caff',
            borderRadius: 10, padding: '16px 18px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1677ff', marginBottom: 12 }}>New Round — {selTour.tour_name}</div>
            <Form form={sform} layout="inline" style={{ gap: 8 }}>
              <Form.Item name="guard_emp_code" label="Guard" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select guard" showSearch optionFilterProp="label" style={{ width: 200 }}>
                  {employees.map(e => (
                    <Option key={e.emp_code} value={e.emp_code} label={`${e.first_name} ${e.last_name}`}>
                      {e.first_name} {e.last_name} — {e.emp_code}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="scheduled_start" label="Start" rules={[{ required: true }]}>
                <DatePicker showTime format="DD MMM HH:mm" style={{ width: 160 }} />
              </Form.Item>
              <Form.Item name="scheduled_end" label="End">
                <DatePicker showTime format="DD MMM HH:mm" style={{ width: 160 }} />
              </Form.Item>
            </Form>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button type="primary" size="small" loading={createSched.isPending} onClick={handleSchedule}>
                Confirm
              </Button>
              <Button size="small" onClick={() => setScheduling(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Rounds list */}
        {schedules.length === 0 ? (
          <div style={{ color: '#bfbfbf', fontSize: 13, padding: '12px 0' }}>No rounds scheduled for this tour</div>
        ) : schedules.map(sched => (
          <ScheduleCard
            key={sched.id}
            sched={sched}
            isExpanded={expandedSched === sched.id}
            onSelect={() => setExpandedSched(prev => prev === sched.id ? null : sched.id)}
            compliance={expandedSched === sched.id ? compliance : null}
            complianceFetching={expandedSched === sched.id && compFetching}
          />
        ))}
      </div>
    );
  };

  const renderEmpty = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <SafetyCertificateOutlined style={{ fontSize: 52, color: '#d9d9d9' }} />
      <div style={{ fontSize: 15, color: '#8c8c8c', fontWeight: 500 }}>Select a tour to view details</div>
      <div style={{ color: '#bfbfbf', fontSize: 13 }}>or</div>
      <Button type="primary" icon={<PlusOutlined />} onClick={startAdd}>Create Tour</Button>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg }}>

      {/* Top header */}
      <div style={{
        background: C.darkHeader,
        padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <Space size={14}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #52c41a, #389e0d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(82,196,26,0.4)',
          }}>
            <SafetyCertificateOutlined style={{ color: 'white', fontSize: 22 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>Guard Tour</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
              {tours.length} routes &bull; {activeTours} active &bull; {completedScheds}/{totalScheds} rounds completed
            </div>
          </div>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} />
      </div>

      {/* Split panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left panel ────────────────────────────────────────── */}
        <div style={{
          width: 280, flexShrink: 0,
          background: C.panel,
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <Button type="primary" icon={<PlusOutlined />} block onClick={startAdd}
              style={{ borderRadius: 8, marginBottom: 8, fontWeight: 600 }}>
              New Tour
            </Button>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Search tours..."
              value={search} onChange={e => setSearch(e.target.value)}
              allowClear style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#bfbfbf', fontSize: 13 }}>No tours found</div>
            ) : filtered.map(tour => {
              const selected = tour.id === selId;
              const cpCount  = tour.checkpoints?.length || 0;
              return (
                <div
                  key={tour.id}
                  onClick={() => selectTour(tour.id)}
                  style={{
                    padding: '12px 14px', cursor: 'pointer',
                    background: selected ? C.selBg : 'transparent',
                    borderLeft: `3px solid ${selected ? '#1677ff' : 'transparent'}`,
                    borderBottom: `1px solid ${C.border}`,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f9f9f9'; }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? C.selBg : 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: tour.is_active
                        ? 'linear-gradient(135deg, #52c41a, #389e0d)'
                        : 'linear-gradient(135deg, #bfbfbf, #8c8c8c)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <SafetyCertificateOutlined style={{ color: 'white', fontSize: 16 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13, color: '#141414',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {tour.tour_name}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, borderRadius: 6, padding: '1px 6px',
                          background: '#e6f4ff', color: '#1677ff',
                        }}>{cpCount} checkpoints</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, borderRadius: 6, padding: '1px 6px',
                          background: '#f5f5f5', color: '#8c8c8c',
                        }}>{tour.interval_minutes}m</span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '2px 6px', flexShrink: 0,
                      background: tour.is_active ? '#f6ffed' : '#f5f5f5',
                      color: tour.is_active ? '#52c41a' : '#8c8c8c',
                    }}>
                      {tour.is_active ? 'ON' : 'OFF'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8f9fb' }}>

          {adding ? (
            <>
              <div style={{
                background: 'linear-gradient(135deg, #092b00, #135200)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexShrink: 0,
              }}>
                <Space size={12}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PlusOutlined style={{ color: 'white', fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>New Guard Tour</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Define checkpoints in patrol order</div>
                  </div>
                </Space>
                <Space>
                  <Button onClick={cancelEdit} icon={<CloseOutlined />}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>Cancel</Button>
                  <Button type="primary" loading={saveTour.isPending} icon={<SaveOutlined />}
                    onClick={handleSave} style={{ fontWeight: 600 }}>Create Tour</Button>
                </Space>
              </div>
              {renderTourForm()}
            </>

          ) : selTour ? (
            <>
              <div style={{
                background: selTour.is_active
                  ? 'linear-gradient(135deg, #092b00, #135200)'
                  : 'linear-gradient(135deg, #1c1c1c, #2d2d2d)',
                padding: '16px 24px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexShrink: 0,
              }}>
                <Space size={14}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 14,
                    background: selTour.is_active
                      ? 'linear-gradient(135deg, #52c41a, #389e0d)'
                      : 'linear-gradient(135deg, #595959, #262626)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 14px ${selTour.is_active ? 'rgba(82,196,26,0.5)' : 'rgba(0,0,0,0.4)'}`,
                  }}>
                    <SafetyCertificateOutlined style={{ color: 'white', fontSize: 22 }} />
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{selTour.tour_name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3, display: 'flex', gap: 10 }}>
                      <span>{selTour.checkpoints?.length || 0} checkpoints</span>
                      <span>{selTour.interval_minutes} min interval</span>
                      <span style={{ color: selTour.is_active ? '#52c41a' : '#8c8c8c' }}>
                        {selTour.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </Space>
                <Space size={8}>
                  {editMode ? (
                    <>
                      <Button onClick={cancelEdit} icon={<CloseOutlined />}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>Cancel</Button>
                      <Button type="primary" loading={saveTour.isPending} icon={<SaveOutlined />}
                        onClick={handleSave} style={{ fontWeight: 600 }}>Save</Button>
                    </>
                  ) : (
                    <Button icon={<EditOutlined />} onClick={startEdit}
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white' }}>Edit</Button>
                  )}
                  <Popconfirm
                    title="Delete this tour?"
                    description="All associated schedules will also be removed."
                    okText="Delete" okType="danger"
                    onConfirm={() => deleteTour.mutate(selTour.id)}
                  >
                    <Button danger icon={<DeleteOutlined />}
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(245,34,45,0.5)' }} />
                  </Popconfirm>
                </Space>
              </div>

              {editMode ? renderTourForm() : renderTourView()}
            </>

          ) : renderEmpty()}
        </div>
      </div>
    </div>
  );
}
