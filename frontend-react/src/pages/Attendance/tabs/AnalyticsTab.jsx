import React, { useState, useMemo } from 'react';
import {
  Card, Button, Space, Row, Col, Divider,
  Select, DatePicker, Statistic, Table, Tag,
  Badge, Tooltip, Progress, App, Spin, Alert,
} from 'antd';
import {
  ReloadOutlined, BarChartOutlined, TeamOutlined,
  ClockCircleOutlined, WarningOutlined, CheckCircleOutlined,
  RiseOutlined, FallOutlined, UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

const fmtHours = (min) => {
  if (!min && min !== 0) return '—';
  return `${Math.floor(min/60)}h ${min%60}m`;
};

const EX_COLOR = {
  late_arrival:    'orange',
  early_departure: 'gold',
  absent:          'red',
  missing_punch:   'volcano',
  overtime:        'blue',
  area_mismatch:   'purple',
};
const EX_LABEL = {
  late_arrival:    'Late Arrivals',
  early_departure: 'Early Departures',
  absent:          'Absences',
  missing_punch:   'Missing Punches',
  overtime:        'Overtime',
  area_mismatch:   'Area Mismatch',
};

const AnalyticsTab = () => {
  const [selMonth, setSelMonth]   = useState(dayjs());
  const [selDept,  setSelDept]    = useState(null);

  /* ---- dashboard stats ---- */
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['att-dashboard-stats', selMonth?.format('YYYY-MM'), selDept],
    queryFn: () => {
      const p = new URLSearchParams();
      // API requires a specific date; use today when viewing current month, else last day of selected month
      const targetDate = selMonth && !selMonth.isSame(dayjs(), 'month')
        ? selMonth.endOf('month').format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');
      p.append('date', targetDate);
      if (selDept) p.append('department_id', selDept);
      return apiService.get(`/api/v1/attendance/analytics/dashboard-stats?${p}`);
    },
    refetchInterval: 60000,
  });
  const stats = useMemo(() => statsData?.data || {}, [statsData]);

  /* ---- exception breakdown ---- */
  const { data: exData, isLoading: exLoading } = useQuery({
    queryKey: ['att-exception-breakdown', selMonth?.format('YYYY-MM'), selDept],
    queryFn: () => {
      const p = new URLSearchParams();
      if (selMonth) p.append('month', selMonth.format('YYYY-MM'));
      if (selDept)  p.append('dept_id', selDept);
      return apiService.get(`/api/v1/attendance/analytics/exceptions?${p}`);
    },
    refetchInterval: 60000,
  });
  const exBreakdown = useMemo(() => exData?.data || [], [exData]);

  /* ---- top exceptions by employee ---- */
  const { data: topExData, isLoading: topExLoading } = useQuery({
    queryKey: ['att-top-exceptions', selMonth?.format('YYYY-MM'), selDept],
    queryFn: () => {
      const p = new URLSearchParams();
      if (selMonth) p.append('month', selMonth.format('YYYY-MM'));
      if (selDept)  p.append('dept_id', selDept);
      p.append('limit', 10);
      return apiService.get(`/api/v1/attendance/analytics/top-exceptions?${p}`);
    },
    refetchInterval: 60000,
  });
  const topEx = useMemo(() => topExData?.data || [], [topExData]);

  /* ---- attendance trends ---- */
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['att-trends', selMonth?.format('YYYY-MM'), selDept],
    queryFn: () => {
      const p = new URLSearchParams();
      if (selMonth) p.append('month', selMonth.format('YYYY-MM'));
      if (selDept)  p.append('dept_id', selDept);
      return apiService.get(`/api/v1/attendance/analytics/trends?${p}`);
    },
    refetchInterval: 60000,
  });
  const trends = useMemo(() => trendData?.data || [], [trendData]);

  /* ---- departments for filter ---- */
  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.get('/api/v1/departments/'),
  });
  const departments = useMemo(() => deptData?.data || deptData?.results || [], [deptData]);
  const exTotal     = useMemo(() => exBreakdown.reduce((s, e) => s + (e.count || 0), 0), [exBreakdown]);

  const isAnyLoading = statsLoading || exLoading || topExLoading || trendLoading;

  /* ---- top exception employee columns ---- */
  const topExCols = [
    { title:'#', key:'rank', width:42, render:(_,__,i) => <span style={{ color:'#8c8c8c', fontSize:12 }}>{i+1}</span> },
    {
      title:'Employee', key:'emp',
      render: (_,r) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight:600, fontSize:13 }}>{r.emp_name||`#${r.emp_id}`}</span>
          <span style={{ fontSize:11, color:'#8c8c8c' }}>{r.emp_code||''}</span>
        </Space>
      ),
    },
    { title:'Exceptions', dataIndex:'total_exceptions', key:'total', width:100,
      render: v => <Tag color={v>10?'red':v>5?'orange':'default'}>{v}</Tag> },
    { title:'Late', dataIndex:'late_count',    key:'late',  width:70, render: v => v || 0 },
    { title:'Absent', dataIndex:'absent_count', key:'abs',   width:70, render: v => v || 0 },
    { title:'Dept',  dataIndex:'dept_name',    key:'dept',  ellipsis:true, render: v => v||'—' },
  ];

  /* ---- trend columns ---- */
  const trendCols = [
    { title:'Date',        dataIndex:'att_date',     key:'date',  width:130, render: d => d ? dayjs(d).format('DD MMM YYYY') : '—' },
    { title:'Present',     dataIndex:'present_count',key:'pres',  width:90,  render: v => <Tag color="green">{v||0}</Tag> },
    { title:'Absent',      dataIndex:'absent_count', key:'abs',   width:90,  render: v => <Tag color="red">{v||0}</Tag> },
    { title:'Late',        dataIndex:'late_count',   key:'late',  width:90,  render: v => <Tag color="orange">{v||0}</Tag> },
    { title:'On Leave',    dataIndex:'leave_count',  key:'leave', width:90,  render: v => <Tag color="blue">{v||0}</Tag> },
    { title:'Total OT (h)',dataIndex:'ot_minutes',   key:'ot',    width:110, render: m => fmtHours(m) },
    {
      title:'Attendance %', key:'pct', width:130,
      render: (_,r) => {
        const total = (r.present_count||0) + (r.absent_count||0);
        const pct   = total > 0 ? Math.round(((r.present_count||0) / total) * 100) : 0;
        return <Progress percent={pct} size="small" status={pct < 80 ? 'exception' : 'normal'} style={{ minWidth:90 }} />;
      },
    },
  ];

  return (
    <div style={{ padding:24 }}>
      {/* Filter bar */}
      <Card styles={{ body:{ padding:'12px 16px' } }} style={{ marginBottom:16 }}>
        <Row gutter={[12,8]} align="middle">
          <Col>
            <Space><BarChartOutlined style={{ color:'#722ed1' }} /><span style={{ fontWeight:600 }}>Analytics</span></Space>
          </Col>
          <Col xs={12} sm={5} md={3}>
            <DatePicker picker="month" value={selMonth} onChange={setSelMonth}
              format="MMM YYYY" style={{ width:'100%' }} allowClear={false} />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select placeholder="All departments" style={{ width:'100%' }} value={selDept}
              onChange={setSelDept} allowClear>
              {departments.map(d => <Option key={d.id} value={d.id}>{d.dept_name||d.name}</Option>)}
            </Select>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={refetchStats} loading={isAnyLoading}>Refresh</Button>
          </Col>
        </Row>
      </Card>

      {/* Summary stat cards */}
      <Row gutter={[16,16]} style={{ marginBottom:20 }}>
        {[
          { title:'Today\'s Punches',    value: stats.today_punches    ?? '—', icon:<ClockCircleOutlined />, color:'#1890ff' },
          { title:'Present Today',        value: stats.present_today    ?? '—', icon:<CheckCircleOutlined />, color:'#52c41a' },
          { title:'Absent Today',         value: stats.absent_today     ?? '—', icon:<WarningOutlined />,     color:'#f5222d' },
          { title:'Open Exceptions',      value: stats.open_exceptions  ?? '—', icon:<WarningOutlined />,     color:'#fa8c16' },
          { title:'Pending Approvals',    value: stats.pending_approvals?? '—', icon:<ClockCircleOutlined />, color:'#722ed1' },
          { title:'Active Employees',     value: stats.active_employees ?? '—', icon:<TeamOutlined />,        color:'#13c2c2' },
        ].map(s => (
          <Col xs={12} sm={8} md={4} key={s.title}>
            <Card styles={{ body:{ padding:'14px 18px' } }} style={{ borderTop:`3px solid ${s.color}` }}>
              <Statistic title={s.title} value={s.value} prefix={s.icon}
                valueStyle={{ color:s.color, fontSize:22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16,16]}>
        {/* Exception breakdown */}
        <Col xs={24} md={10}>
          <Card title={<Space><WarningOutlined style={{ color:'#fa8c16' }} />Exception Breakdown</Space>}
            styles={{ body:{ padding:'12px 16px' } }} style={{ height:'100%' }}
            loading={exLoading}>
            {exBreakdown.length === 0
              ? <div style={{ textAlign:'center', color:'#8c8c8c', padding:'24px 0' }}>No exceptions this period</div>
              : exBreakdown.map(ex => {
                const pct = exTotal > 0 ? Math.round(((ex.count || 0) / exTotal) * 100) : 0;
                return (
                  <div key={ex.exception_type} style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <Tag color={EX_COLOR[ex.exception_type]||'default'} style={{ marginRight:0 }}>
                        {EX_LABEL[ex.exception_type]||ex.exception_type}
                      </Tag>
                      <span style={{ fontWeight:600 }}>{ex.count}</span>
                    </div>
                    <Progress percent={pct} showInfo={false} strokeColor={EX_COLOR[ex.exception_type]||'#1890ff'} size="small" />
                  </div>
                );
              })
            }
          </Card>
        </Col>

        {/* Monthly KPIs */}
        <Col xs={24} md={14}>
          <Card title={<Space><RiseOutlined style={{ color:'#52c41a' }} />Monthly KPIs — {selMonth?.format('MMMM YYYY')}</Space>}
            styles={{ body:{ padding:'12px 16px' } }}
            loading={statsLoading}>
            <Row gutter={[16,12]}>
              {[
                { label:'Avg Daily Attendance',  value: stats.avg_attendance_pct != null ? `${stats.avg_attendance_pct}%` : '—', color:'#52c41a' },
                { label:'Avg Work Hours/Day',     value: fmtHours(stats.avg_work_minutes),                                        color:'#1890ff' },
                { label:'Total OT Hours',         value: fmtHours(stats.total_ot_minutes),                                        color:'#fa8c16' },
                { label:'Late Arrival Rate',      value: stats.late_rate != null ? `${stats.late_rate}%` : '—',                   color:'#faad14' },
                { label:'Absenteeism Rate',       value: stats.absent_rate != null ? `${stats.absent_rate}%` : '—',               color:'#f5222d' },
                { label:'Exceptions Handled',     value: stats.handled_exceptions ?? '—',                                         color:'#13c2c2' },
              ].map(k => (
                <Col xs={12} sm={8} key={k.label}>
                  <div style={{ borderLeft:`3px solid ${k.color}`, paddingLeft:10 }}>
                    <div style={{ fontSize:11, color:'#8c8c8c' }}>{k.label}</div>
                    <div style={{ fontWeight:700, fontSize:18, color:k.color }}>{k.value}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Top exception employees */}
      <Card title={<Space><UserOutlined style={{ color:'#f5222d' }} />Top Employees by Exceptions — {selMonth?.format('MMM YYYY')}</Space>}
        styles={{ body:{ padding:0 } }} style={{ marginTop:16 }}>
        <Table columns={topExCols} dataSource={topEx} loading={topExLoading}
          rowKey={(r) => r.emp_id || r.id} size="middle"
          pagination={false} scroll={{ x:620 }} />
      </Card>

      {/* Daily attendance trends */}
      <Card title={<Space><BarChartOutlined style={{ color:'#1890ff' }} />Daily Attendance Trends — {selMonth?.format('MMMM YYYY')}</Space>}
        styles={{ body:{ padding:0 } }} style={{ marginTop:16 }}>
        <Table columns={trendCols} dataSource={trends} loading={trendLoading}
          rowKey="att_date" size="middle" scroll={{ x:780 }}
          pagination={{ pageSize:15, showSizeChanger:false, showTotal:(t,r)=>`${r[0]}–${r[1]} of ${t} days` }} />
      </Card>
    </div>
  );
};
export default AnalyticsTab;
