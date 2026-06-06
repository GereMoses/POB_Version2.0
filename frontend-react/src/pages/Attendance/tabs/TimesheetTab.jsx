import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Tag, App, Form, Drawer, Popconfirm, Modal, Alert,
  Select, DatePicker, Row, Col, Divider, Descriptions, Tooltip,
  Badge, Progress, Input, Segmented, Popover,
} from 'antd';
import {
  ReloadOutlined, EyeOutlined, DownloadOutlined,
  CalendarOutlined, ClockCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ThunderboltOutlined, DeleteOutlined,
  BarChartOutlined, TableOutlined, RiseOutlined, SettingOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';
import { ColTogglePopover, EmployeeCell, tableContainerStyle } from './shared';

const { Option } = Select;
const { RangePicker } = DatePicker;

const STATUS_COLOR = { 0:'success', 1:'warning', 2:'gold', 3:'error', 4:'processing' };
const STATUS_LABEL = { 0:'Present', 1:'Late', 2:'Early Leave', 3:'Absent', 4:'Leave' };
const STATUS_ROW   = { 0:'ts-present', 1:'ts-late', 2:'ts-early', 3:'ts-absent', 4:'ts-leave' };

const fmtHours = (min) => {
  if (!min && min !== 0) return '—';
  return `${Math.floor(min/60)}h ${min%60}m`;
};

const fmtTime = (t) => {
  if (!t) return '—';
  if (typeof t === 'string' && t.length <= 8) return t.substring(0,5);
  return dayjs(t).format('HH:mm');
};

const exportCSV = (rows, viewMode) => {
  let headers, lines;
  if (viewMode === 'daily') {
    headers = ['Employee','Code','Dept','Day','Date','Shift','Sched In','Sched Out','Check-in','Check-out','Work Time','OT','Late(min)','Early Leave(min)','Area OK','Status'];
    lines = rows.map(r => [
      r.emp_name||'', r.emp_code||'', r.dept_name||'',
      r.day_of_week||'', r.att_date||'',
      r.shift_name||'',
      r.scheduled_checkin ? fmtTime(r.scheduled_checkin) : '',
      r.scheduled_checkout ? fmtTime(r.scheduled_checkout) : '',
      r.check_in ? dayjs(r.check_in).format('HH:mm') : '',
      r.check_out ? dayjs(r.check_out).format('HH:mm') : '',
      fmtHours(r.work_minutes), fmtHours(r.ot_minutes),
      r.late_minutes??0, r.early_minutes??0,
      r.area_compliance ? 'Yes' : 'No',
      STATUS_LABEL[r.att_status]||'',
    ].join(','));
  } else {
    headers = ['Employee','Code','Dept','Present','Absent','Late','Early Leave','Leave','Work Hours','OT Hours','Att Rate%'];
    lines = rows.map(r => [
      r.emp_name||'', r.emp_code||'', r.dept_name||'',
      r.present_days??0, r.absent_days??0,
      r.late_count??0, r.early_leave_count??0, r.leave_count??0,
      fmtHours(r.total_work_minutes), fmtHours(r.total_ot_minutes),
      r.attendance_rate??0,
    ].join(','));
  }
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `timesheet_${viewMode}_${dayjs().format('YYYYMMDD')}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

const TimesheetTab = () => {
  const { message } = App.useApp();
  const [viewMode,  setViewMode]  = useState('daily');
  const [search,    setSearch]    = useState('');
  const [deptId,    setDeptId]    = useState(null);
  const [attStatus, setAttStatus] = useState(null);
  const [shiftId,   setShiftId]   = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf('week'), dayjs().endOf('week')]);
  const [page,      setPage]      = useState(1);
  const PAGE_SIZE = 100;

  const [selected,        setSelected]        = useState([]);
  const [hiddenDailyCols, setHiddenDailyCols] = useState(new Set());
  const [hiddenSumCols,   setHiddenSumCols]   = useState(new Set());
  const [colPopOpen,      setColPopOpen]       = useState(false);
  const [detailOpen,      setDetailOpen]       = useState(false);
  const [detailRec,       setDetailRec]        = useState(null);
  const [calcForm]  = Form.useForm();
  const [calcOpen,  setCalcOpen]   = useState(false);
  const qc = useQueryClient();

  const startDate = dateRange?.[0]?.format('YYYY-MM-DD') ?? dayjs().startOf('week').format('YYYY-MM-DD');
  const endDate   = dateRange?.[1]?.format('YYYY-MM-DD') ?? dayjs().endOf('week').format('YYYY-MM-DD');

  const rangePresets = [
    { label: 'Today',      value: [dayjs(), dayjs()] },
    { label: 'Yesterday',  value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
    { label: 'This Week',  value: [dayjs().startOf('week'),  dayjs().endOf('week')]  },
    { label: 'Last Week',  value: [dayjs().subtract(1, 'week').startOf('week'), dayjs().subtract(1, 'week').endOf('week')] },
    { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
    { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
  ];

  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn:  () => apiService.get('/api/v1/departments/'),
  });
  const departments = Array.isArray(deptData) ? deptData : (deptData?.data || deptData?.results || []);

  const { data: shiftData } = useQuery({
    queryKey: ['shifts'],
    queryFn:  () => apiService.get('/api/v1/attendance/shifts'),
  });
  const shifts = shiftData?.data || [];

  const { data: empData } = useQuery({
    queryKey: ['employees-active'],
    queryFn:  () => apiService.get('/api/v1/personnel/?status=ACTIVE&page_size=500'),
  });
  const employees = empData?.results || [];

  const { data: dailyData, isLoading: dailyLoading, refetch: refetchDaily } = useQuery({
    queryKey: ['att-timesheet', search, deptId, attStatus, shiftId, startDate, endDate, page],
    queryFn: () => {
      const p = new URLSearchParams();
      p.append('start_date', startDate); p.append('end_date', endDate);
      p.append('page', page); p.append('page_size', PAGE_SIZE);
      if (search)    p.append('search', search);
      if (deptId)    p.append('dept_id', deptId);
      if (attStatus !== null && attStatus !== undefined) p.append('att_status', attStatus);
      if (shiftId)   p.append('shift_id', shiftId);
      return apiService.get(`/api/v1/attendance/timesheet?${p}`);
    },
    enabled: viewMode === 'daily',
    refetchInterval: 20000,
    staleTime:       15000,
  });
  const dailyRows  = dailyData?.data  || [];
  const dailyTotal = dailyData?.total || 0;

  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['att-timesheet-summary', search, deptId, shiftId, startDate, endDate],
    queryFn: () => {
      const p = new URLSearchParams();
      p.append('start_date', startDate); p.append('end_date', endDate);
      if (search)  p.append('search', search);
      if (deptId)  p.append('dept_id', deptId);
      if (shiftId) p.append('shift_id', shiftId);
      return apiService.get(`/api/v1/attendance/timesheet/monthly-summary?${p}`);
    },
    enabled: viewMode === 'summary',
    refetchInterval: 30000,
    staleTime:       20000,
  });
  const summaryRows = summaryData?.data || [];

  const calcM = useMutation({
    mutationFn: (d) => apiService.post('/api/v1/attendance/calculate', d),
    onSuccess: (res) => {
      message.success(`Calculated ${res?.data?.processed || 0} records`);
      setCalcOpen(false); calcForm.resetFields();
      qc.invalidateQueries(['att-timesheet']);
      qc.invalidateQueries(['att-timesheet-summary']);
    },
    onError: (e) => message.error(e?.message || 'Calculation failed'),
  });

  const [clearModalOpen, setClearModalOpen] = useState(false);

  const clearM = useMutation({
    mutationFn: (includeTransactions) => {
      const p = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        include_transactions: includeTransactions ? 'true' : 'false',
      });
      return apiService.delete(`/api/v1/attendance/timesheet/clear?${p}`);
    },
    onSuccess: (res, includeTransactions) => {
      const rpt = res?.report_deleted ?? res?.deleted ?? 0;
      const txn = res?.transactions_deleted ?? 0;
      const msg = includeTransactions
        ? `Permanently cleared ${rpt} attendance records and ${txn} punch records for ${startDate} – ${endDate}`
        : `Cleared ${rpt} attendance records for ${startDate} – ${endDate} (recalculate to rebuild)`;
      message.success(msg);
      setClearModalOpen(false);
      setSelected([]);
      qc.invalidateQueries(['att-timesheet']);
      qc.invalidateQueries(['att-timesheet-summary']);
    },
    onError: (e) => message.error(e?.message || 'Failed to clear timesheet'),
  });

  const submitCalc = () => calcForm.validateFields().then((v) => {
    const calcRange = v.dateRange ?? dateRange;
    const start = calcRange?.[0] || dayjs().startOf('week');
    const end   = calcRange?.[1] || dayjs().endOf('week');
    calcM.mutate({
      emp_ids:    v.emp_id ? [v.emp_id] : null,
      start_date: start.format('YYYY-MM-DD'),
      end_date:   end.format('YYYY-MM-DD'),
    });
  }).catch(() => {});

  /* ── Stat values ── */
  const presentCount = viewMode === 'daily'
    ? dailyRows.filter(r => r.att_status === 0).length
    : summaryRows.reduce((s,r) => s + (r.present_days||0), 0);
  const absentCount  = viewMode === 'daily'
    ? dailyRows.filter(r => r.att_status === 3).length
    : summaryRows.reduce((s,r) => s + (r.absent_days||0), 0);
  const lateCount    = viewMode === 'daily'
    ? dailyRows.filter(r => r.att_status === 1).length
    : summaryRows.reduce((s,r) => s + (r.late_count||0), 0);
  const totalWorkMin = viewMode === 'daily'
    ? dailyRows.reduce((s,r) => s + (r.work_minutes||0), 0)
    : summaryRows.reduce((s,r) => s + (r.total_work_minutes||0), 0);
  const totalOtMin   = viewMode === 'daily'
    ? dailyRows.reduce((s,r) => s + (r.ot_minutes||0), 0)
    : summaryRows.reduce((s,r) => s + (r.total_ot_minutes||0), 0);
  const avgAttRate   = summaryRows.length > 0
    ? (summaryRows.reduce((s,r) => s + (parseFloat(r.attendance_rate)||0), 0) / summaryRows.length).toFixed(1)
    : '—';

  /* ── Column definitions ── */
  const DAILY_COL_DEFS = [
    { title:'Employee',  key:'emp',    fixed:'left', width:180,
      render: (_,r) => (
        <EmployeeCell
          name={r.emp_name || `#${r.emp_id}`}
          code={r.emp_code || ''}
          onClick={() => { setDetailRec(r); setDetailOpen(true); }}
        />
      ),
    },
    { title:'Day',       key:'dow',    width:55,  dataIndex:'day_of_week',
      render: d => d ? <span style={{ fontSize:12, color:'#595959' }}>{d}</span> : '—' },
    { title:'Date',      key:'date',   width:115, dataIndex:'att_date',
      render: d => d ? dayjs(d).format('DD MMM YYYY') : '—' },
    { title:'Dept',      key:'dept',   width:110, dataIndex:'dept_name', ellipsis:true, render: v => v||'—' },
    { title:'Shift',     key:'shift',  width:100, dataIndex:'shift_name', ellipsis:true,
      render: v => v ? <Tag color="geekblue" style={{ fontSize:11 }}>{v}</Tag> : '—' },
    { title:'Sched In',  key:'si',     width:85,  dataIndex:'scheduled_checkin',
      render: v => v ? <span style={{ color:'#8c8c8c', fontSize:12 }}>{fmtTime(v)}</span> : '—' },
    { title:'Sched Out', key:'so',     width:90,  dataIndex:'scheduled_checkout',
      render: v => v ? <span style={{ color:'#8c8c8c', fontSize:12 }}>{fmtTime(v)}</span> : '—' },
    { title:'Check-in',  key:'ci',     width:90,  dataIndex:'check_in',
      render: t => t ? <span style={{ color:'#52c41a', fontWeight:600 }}>{dayjs(t).format('HH:mm')}</span> : '—' },
    { title:'Check-out', key:'co',     width:95,  dataIndex:'check_out',
      render: t => t ? <span style={{ color:'#f5222d', fontWeight:600 }}>{dayjs(t).format('HH:mm')}</span> : '—' },
    { title:'Work Time', key:'wt',     width:100, dataIndex:'work_minutes', render: fmtHours },
    { title:'OT',        key:'ot',     width:80,  dataIndex:'ot_minutes',
      render: m => m ? <Tag color="orange">{fmtHours(m)}</Tag> : '—' },
    { title:'Late',      key:'lt',     width:70,  dataIndex:'late_minutes',
      render: m => m ? <Tag color="red" style={{ fontSize:11 }}>{m}m</Tag> : '—' },
    { title:'Early Lv',  key:'el',     width:80,  dataIndex:'early_minutes',
      render: m => m ? <Tag color="gold" style={{ fontSize:11 }}>{m}m</Tag> : '—' },
    { title:'Area',      key:'area',   width:65,  dataIndex:'area_compliance',
      render: v => v === false ? <Badge status="error" text="No" /> : <Badge status="success" text="OK" /> },
    { title:'Status',    key:'status', width:115, dataIndex:'att_status',
      render: s => <Badge status={STATUS_COLOR[s]||'default'} text={STATUS_LABEL[s]||'—'} /> },
  ];

  const SUMMARY_COL_DEFS = [
    { title:'Employee',   key:'emp',   fixed:'left', width:200,
      render: (_,r) => (
        <EmployeeCell name={r.emp_name||`#${r.emp_id}`} code={r.emp_code||''} />
      ),
    },
    { title:'Dept',       key:'dept',  width:120, dataIndex:'dept_name',         ellipsis:true, render: v => v||'—' },
    { title:'Present',    key:'pres',  width:80,  dataIndex:'present_days',      render: v => <Tag color="green">{v||0}</Tag> },
    { title:'Absent',     key:'abs',   width:80,  dataIndex:'absent_days',       render: v => <Tag color="red">{v||0}</Tag> },
    { title:'Late',       key:'late',  width:70,  dataIndex:'late_count',        render: v => <Tag color="orange">{v||0}</Tag> },
    { title:'Early Lv',   key:'el',    width:80,  dataIndex:'early_leave_count', render: v => <Tag color="gold">{v||0}</Tag> },
    { title:'Leave',      key:'leave', width:70,  dataIndex:'leave_count',       render: v => <Tag color="blue">{v||0}</Tag> },
    { title:'Work Hours', key:'wh',    width:110, dataIndex:'total_work_minutes',render: fmtHours },
    { title:'OT Hours',   key:'ot',    width:100, dataIndex:'total_ot_minutes',
      render: m => m ? <Tag color="orange">{fmtHours(m)}</Tag> : '—' },
    { title:'Att Rate',   key:'rate',  width:110, dataIndex:'attendance_rate',
      render: v => { const pct = parseFloat(v)||0; return <Progress percent={pct} size="small" status={pct < 80 ? 'exception' : 'normal'} style={{ minWidth:80 }} />; } },
  ];

  const toggleDailyCol = (key) => setHiddenDailyCols(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const toggleSumCol = (key) => setHiddenSumCols(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  const dailyCols = useMemo(() => {
    const visible = DAILY_COL_DEFS.filter(c => !hiddenDailyCols.has(c.key));
    return [...visible, {
      title:'', key:'act', fixed:'right', width:46,
      render: (_,r) => (
        <Tooltip title="View">
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setDetailRec(r); setDetailOpen(true); }} />
        </Tooltip>
      ),
    }];
  }, [hiddenDailyCols]);

  const summaryCols = useMemo(() =>
    SUMMARY_COL_DEFS.filter(c => !hiddenSumCols.has(c.key)),
  [hiddenSumCols]);

  const rowKey = viewMode === 'daily' ? 'id' : 'emp_id';
  const rowSelection = {
    selectedRowKeys: selected,
    onChange: (keys) => setSelected(keys),
    preserveSelectedRowKeys: false,
  };

  const exportSelected = () => {
    const srcRows = viewMode === 'daily' ? dailyRows : summaryRows;
    const selSet  = new Set(selected);
    const subset  = srcRows.filter(r => selSet.has(r[rowKey]));
    exportCSV(subset, viewMode);
    message.success(`Exported ${subset.length} selected row(s)`);
  };

  const isLoading = viewMode === 'daily' ? dailyLoading : summaryLoading;
  const colDefs   = viewMode === 'daily' ? DAILY_COL_DEFS : SUMMARY_COL_DEFS;
  const hidden    = viewMode === 'daily' ? hiddenDailyCols : hiddenSumCols;
  const onToggle  = viewMode === 'daily' ? toggleDailyCol : toggleSumCol;

  return (
    <div style={{ padding:24 }}>
      <style>{`
        .ts-present td { background:#f6ffed !important; }
        .ts-late    td { background:#fffbe6 !important; }
        .ts-early   td { background:#fff7e6 !important; }
        .ts-absent  td { background:#fff1f0 !important; }
        .ts-leave   td { background:#e6f4ff !important; }
        .ts-present:hover td { background:#d9f7be !important; }
        .ts-late:hover    td { background:#fff1b8 !important; }
        .ts-early:hover   td { background:#ffe7ba !important; }
        .ts-absent:hover  td { background:#ffd6d6 !important; }
        .ts-leave:hover   td { background:#bae0ff !important; }
        .ts-mod-table .ant-table-thead .ant-table-cell {
          background: #f8fafc !important; color: #64748b !important;
          font-size: 11px !important; font-weight: 700 !important;
          text-transform: uppercase !important; letter-spacing: 0.5px !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
      `}</style>

      {/* ── Stat cards ── */}
      <Row gutter={[14,14]} style={{ marginBottom:20 }}>
        {[
          { title:'Present',       value:presentCount,           icon:<CheckCircleOutlined />,  color:'#52c41a' },
          { title:'Absent',        value:absentCount,            icon:<CloseCircleOutlined />,  color:'#f5222d' },
          { title:'Late Arrivals', value:lateCount,              icon:<ClockCircleOutlined />,  color:'#fa8c16' },
          { title:'Work Hours',    value:fmtHours(totalWorkMin), icon:<CalendarOutlined />,     color:'#1890ff' },
          { title:'OT Hours',      value:fmtHours(totalOtMin),   icon:<RiseOutlined />,         color:'#722ed1' },
          { title:'Att Rate %',    value: viewMode==='summary' ? `${avgAttRate}%` : '—',
                                                                 icon:<BarChartOutlined />,     color:'#13c2c2' },
        ].map(s => (
          <Col xs={12} sm={8} md={4} key={s.title}>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'16px 18px', display:'flex', alignItems:'center', gap:14, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', height:'100%' }}>
              <div style={{ width:44, height:44, borderRadius:10, flexShrink:0, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {React.cloneElement(s.icon, { style:{ fontSize:20, color:s.color } })}
              </div>
              <div>
                <div style={{ color:'#8c8c8c', fontSize:12, fontWeight:500 }}>{s.title}</div>
                <div style={{ fontSize: typeof s.value === 'string' && s.value.length > 4 ? 16 : 22, fontWeight:700, color:'#1f1f1f', lineHeight:1.2, marginTop:2 }}>{s.value}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ── Filter bar ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
        <Row gutter={[12,8]} align="middle" wrap>
          <Col xs={24} sm={8} md={5}>
            <Input.Search placeholder="Search employee / code…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              allowClear style={{ width:'100%' }} />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select placeholder="Department" style={{ width:'100%' }} value={deptId}
              onChange={v => { setDeptId(v); setPage(1); }} allowClear>
              {departments.map(d => <Option key={d.id} value={d.id}>{d.dept_name||d.name}</Option>)}
            </Select>
          </Col>
          <Col xs={12} sm={5} md={3}>
            <Select placeholder="Status" style={{ width:'100%' }} value={attStatus}
              onChange={v => { setAttStatus(v ?? null); setPage(1); }} allowClear>
              {Object.entries(STATUS_LABEL).map(([k,v]) => (
                <Option key={k} value={Number(k)}>{v}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={5} md={3}>
            <Select placeholder="Shift" style={{ width:'100%' }} value={shiftId}
              onChange={v => { setShiftId(v); setPage(1); }} allowClear>
              {shifts.map(s => <Option key={s.id} value={s.id}>{s.name||s.alias}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker
              value={dateRange}
              presets={rangePresets}
              onChange={v => { if (v) { setDateRange(v); setPage(1); } }}
              format="DD MMM YYYY"
              style={{ width:'100%' }}
              allowClear={false}
            />
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setCalcOpen(true)}>
                Calculate
              </Button>
              <Button danger icon={<DeleteOutlined />} loading={clearM.isPending}
                onClick={() => setClearModalOpen(true)}>
                Clear
              </Button>
              <Button icon={<DownloadOutlined />}
                onClick={() => exportCSV(viewMode==='daily' ? dailyRows : summaryRows, viewMode)}>
                Export CSV
              </Button>
              <Button icon={<ReloadOutlined />}
                onClick={() => viewMode==='daily' ? refetchDaily() : refetchSummary()}
                loading={isLoading}>
                Refresh
              </Button>
              <Popover
                title="Show / Hide Columns" trigger="click"
                open={colPopOpen} onOpenChange={setColPopOpen}
                content={<ColTogglePopover colDefs={colDefs} hidden={hidden} onToggle={onToggle} />}>
                <Tooltip title="Adjust columns">
                  <Button icon={<SettingOutlined />} />
                </Tooltip>
              </Popover>
            </Space>
          </Col>
        </Row>
      </div>

      {/* ── View toggle ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <Segmented
          value={viewMode}
          onChange={v => { setViewMode(v); setSelected([]); }}
          options={[
            { value:'daily',   label: <Space><TableOutlined />Daily Records</Space>   },
            { value:'summary', label: <Space><BarChartOutlined />Monthly Summary</Space> },
          ]}
        />
        <span style={{ fontSize:12, color:'#8c8c8c' }}>
          {viewMode==='daily'
            ? `${dailyTotal.toLocaleString()} record${dailyTotal!==1?'s':''} (page ${page})`
            : `${summaryRows.length} employee${summaryRows.length!==1?'s':''}`}
        </span>
      </div>

      {/* ── Bulk bar ── */}
      {selected.length > 0 && (
        <div style={{ background:'#1d4ed8', borderRadius:10, padding:'10px 16px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:'#fff', fontWeight:600, fontSize:13 }}>
            {selected.length} row{selected.length !== 1 ? 's' : ''} selected
          </span>
          <Space>
            <Button icon={<DownloadOutlined />} size="small"
              style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff' }}
              onClick={exportSelected}>
              Export Selected
            </Button>
            <Button size="small" icon={<CloseOutlined />}
              style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff' }}
              onClick={() => setSelected([])}>
              Clear
            </Button>
          </Space>
        </div>
      )}

      {/* ── Table ── */}
      <div style={tableContainerStyle}>
        {viewMode === 'daily' ? (
          <Table
            className="ts-mod-table"
            columns={dailyCols}
            dataSource={dailyRows}
            loading={dailyLoading}
            rowKey="id"
            size="middle"
            scroll={{ x: 1400 }}
            rowClassName={r => STATUS_ROW[r.att_status] || ''}
            rowSelection={rowSelection}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: dailyTotal,
              onChange: (p) => setPage(p),
              showSizeChanger: false,
              showTotal: (t,r) => `${r[0]}–${r[1]} of ${t}`,
            }}
          />
        ) : (
          <Table
            className="ts-mod-table"
            columns={summaryCols}
            dataSource={summaryRows}
            loading={summaryLoading}
            rowKey="emp_id"
            size="middle"
            scroll={{ x: 900 }}
            rowSelection={rowSelection}
            pagination={{ pageSize:50, showSizeChanger:true, showTotal:(t,r)=>`${r[0]}–${r[1]} of ${t}` }}
          />
        )}
      </div>

      {/* ── Calculate Drawer ── */}
      <Drawer title={<Space><ThunderboltOutlined style={{ color:'#1890ff' }} />Calculate Attendance</Space>}
        open={calcOpen} onClose={() => { setCalcOpen(false); calcForm.resetFields(); }}
        width={460} destroyOnHidden
        footer={<Space style={{ float:'right' }}>
          <Button onClick={() => { setCalcOpen(false); calcForm.resetFields(); }}>Cancel</Button>
          <Button type="primary" onClick={submitCalc} loading={calcM.isPending}>Calculate</Button>
        </Space>}>
        <Form form={calcForm} layout="vertical" size="small">
          <Divider orientation="left"><Space><ThunderboltOutlined />Calculation Parameters</Space></Divider>
          <Form.Item name="dateRange" label="Date Range" initialValue={dateRange}>
            <RangePicker presets={rangePresets} style={{ width:'100%' }} format="DD MMM YYYY" size="middle" allowClear={false} />
          </Form.Item>
          <Form.Item name="emp_id" label="Employee (leave blank for all)">
            <Select showSearch optionFilterProp="children" size="middle" placeholder="All employees" allowClear>
              {employees.map(e => {
                const n = `${e.first_name||''} ${e.last_name||''}`.trim();
                return <Option key={e.id} value={e.id}>{n} · {e.emp_code}</Option>;
              })}
            </Select>
          </Form.Item>
          <div style={{ background:'#fffbe6', border:'1px solid #ffe58f', borderRadius:6, padding:'10px 14px', fontSize:13 }}>
            This will recalculate attendance records for the selected date range. Existing records will be overwritten.
          </div>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ── */}
      <Drawer title={<Space><EyeOutlined />Timesheet Details</Space>}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={500} destroyOnHidden>
        {detailRec && (
          <>
            <Divider orientation="left" style={{ fontSize:12 }}>Employee</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Name" span={2}><strong>{detailRec.emp_name||`#${detailRec.emp_id}`}</strong></Descriptions.Item>
              <Descriptions.Item label="Code">{detailRec.emp_code||'—'}</Descriptions.Item>
              <Descriptions.Item label="Department">{detailRec.dept_name||'—'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize:12, marginTop:14 }}>Attendance</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Date" span={2}>
                {detailRec.att_date ? `${detailRec.day_of_week||''} ${dayjs(detailRec.att_date).format('DD MMM YYYY')}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Status" span={2}>
                <Badge status={STATUS_COLOR[detailRec.att_status]||'default'} text={STATUS_LABEL[detailRec.att_status]||'—'} />
              </Descriptions.Item>
              <Descriptions.Item label="Shift">{detailRec.shift_name||'—'}</Descriptions.Item>
              <Descriptions.Item label="Area OK">
                {detailRec.area_compliance === false
                  ? <Badge status="error" text="No" />
                  : <Badge status="success" text="Yes" />}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize:12, marginTop:14 }}>Times</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Sched. In">{detailRec.scheduled_checkin ? fmtTime(detailRec.scheduled_checkin) : '—'}</Descriptions.Item>
              <Descriptions.Item label="Sched. Out">{detailRec.scheduled_checkout ? fmtTime(detailRec.scheduled_checkout) : '—'}</Descriptions.Item>
              <Descriptions.Item label="Check-in">{detailRec.check_in ? dayjs(detailRec.check_in).format('HH:mm:ss') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Check-out">{detailRec.check_out ? dayjs(detailRec.check_out).format('HH:mm:ss') : '—'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ fontSize:12, marginTop:14 }}>Metrics</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Work Time">{fmtHours(detailRec.work_minutes)}</Descriptions.Item>
              <Descriptions.Item label="OT Time">{fmtHours(detailRec.ot_minutes)}</Descriptions.Item>
              <Descriptions.Item label="Late">{detailRec.late_minutes ? `${detailRec.late_minutes} min` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Early Leave">{detailRec.early_minutes ? `${detailRec.early_minutes} min` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Scheduled">{fmtHours(detailRec.scheduled_minutes)}</Descriptions.Item>
              <Descriptions.Item label="Exceptions">{detailRec.exception_count ?? 0}</Descriptions.Item>
            </Descriptions>

            {typeof detailRec.work_minutes === 'number' && detailRec.scheduled_minutes > 0 && (
              <>
                <Divider orientation="left" style={{ fontSize:12, marginTop:14 }}>Work Progress</Divider>
                <div style={{ padding:'4px 0 8px' }}>
                  <Progress
                    percent={Math.min(100, Math.round((detailRec.work_minutes / detailRec.scheduled_minutes) * 100))}
                    status={detailRec.work_minutes >= detailRec.scheduled_minutes ? 'success' : 'normal'}
                    format={p => `${p}%`}
                  />
                </div>
              </>
            )}
          </>
        )}
      </Drawer>

      {/* ── Clear Timesheet Modal ── */}
      <Modal
        title="Clear Timesheet"
        open={clearModalOpen}
        onCancel={() => setClearModalOpen(false)}
        footer={null}
        width={520}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Choose how to clear the timesheet"
          description={`This will affect attendance data for ${startDate} – ${endDate}. Choose the option that fits your need.`}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Option 1 — Recalculate only */}
          <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Recalculate Only</div>
            <div style={{ fontSize: 13, color: '#595959', marginBottom: 12 }}>
              Deletes the calculated attendance report records only. Raw punch records are kept.
              Records will be automatically regenerated the next time a punch is received or
              you click <em>Calculate</em>.
            </div>
            <Button
              onClick={() => clearM.mutate(false)}
              loading={clearM.isPending}
              disabled={clearM.isPending}
            >
              Clear Report Only
            </Button>
          </div>

          {/* Option 2 — Full purge */}
          <div style={{ border: '1px solid #ff4d4f', borderRadius: 8, padding: 16, background: '#fff2f0' }}>
            <div style={{ fontWeight: 600, color: '#cf1322', marginBottom: 4 }}>Full Purge (Permanent)</div>
            <div style={{ fontSize: 13, color: '#595959', marginBottom: 12 }}>
              Deletes <strong>both</strong> the attendance report and the underlying raw punch records
              from the database. Also advances the device watermarks so readers will not re-upload
              the deleted records. <strong>This cannot be undone.</strong>
            </div>
            <Button
              danger
              onClick={() => clearM.mutate(true)}
              loading={clearM.isPending}
              disabled={clearM.isPending}
            >
              Full Purge (Delete Raw Punches Too)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default TimesheetTab;
