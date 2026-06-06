import React, { useState } from 'react';
import {
  Table, Button, Space, Tag, Card, Row, Col, Statistic, Select,
  DatePicker, Input, App, Badge,
} from 'antd';
import {
  DownloadOutlined, FilterOutlined, ReloadOutlined,
  FileTextOutlined, ApiOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;
const { RangePicker } = DatePicker;

const EVENT_TYPE = {
  0: { label: 'Normal Access',   color: 'green',  bg: '#f6ffed', text: '#52c41a' },
  1: { label: 'Door Open',       color: 'blue',   bg: '#e6f7ff', text: '#1890ff' },
  2: { label: 'Door Alarm',      color: 'red',    bg: '#fff1f0', text: '#f5222d' },
  3: { label: 'Anti-passback',   color: 'gold',   bg: '#fffbe6', text: '#d4a017' },
  4: { label: 'Duress',          color: 'red',    bg: '#fff1f0', text: '#f5222d' },
  5: { label: 'Fire Unlock',     color: 'orange', bg: '#fff7e6', text: '#fa8c16' },
  6: { label: 'Emergency Lock',  color: 'red',    bg: '#fff1f0', text: '#f5222d' },
  7: { label: 'Mustering Check', color: 'purple', bg: '#f9f0ff', text: '#722ed1' },
};

const AccessReports = () => {
  const { message } = App.useApp();
  const [activeReport, setActiveReport] = useState('events');
  const [range, setRange]             = useState(null);
  const [doorFilter, setDoorFilter]   = useState(null);
  const [typeFilter, setTypeFilter]   = useState(null);
  const [empFilter, setEmpFilter]     = useState('');
  const [applied, setApplied]         = useState({});

  const { data: doorsData } = useQuery({
    queryKey: ['acc-doors'],
    queryFn: () => apiService.get('/api/access-control/doors/'),
  });
  const doors = doorsData?.data || [];

  const eventsParams = new URLSearchParams();
  if (applied.range?.[0]) eventsParams.append('start_time', applied.range[0]);
  if (applied.range?.[1]) eventsParams.append('end_time',   applied.range[1]);
  if (applied.door)       eventsParams.append('door_id',    applied.door);
  if (applied.type != null) eventsParams.append('event_type', applied.type);
  if (applied.emp)        eventsParams.append('emp_code',   applied.emp);
  eventsParams.append('limit', 500);

  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['acc-report-events', eventsParams.toString()],
    queryFn: () => apiService.get(`/api/access-control/events/?${eventsParams}`),
    enabled: activeReport === 'events',
  });
  const events = eventsData?.data || [];

  const { data: doorStatusData, isLoading: doorStatusLoading, refetch: refetchDoorStatus } = useQuery({
    queryKey: ['acc-report-door-status'],
    queryFn: () => apiService.get('/api/access-control/reports/door-status/'),
    enabled: activeReport === 'doorstatus',
  });
  const doorStatus = doorStatusData?.data?.doors || [];

  const applyFilters = () => setApplied({
    range: range ? [range[0].toISOString(), range[1].toISOString()] : null,
    door: doorFilter, type: typeFilter, emp: empFilter,
  });

  const downloadCSV = (rows, filename) => {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    message.success(`Exported ${filename}`);
  };

  const exportCSV = () => {
    if (activeReport === 'events') {
      const hdrs = ['Time', 'Employee', 'Emp Code', 'Door', 'Terminal', 'Event Type', 'Direction', 'Description'];
      const rows = events.map(e => [
        e.event_time ? new Date(e.event_time).toLocaleString() : '',
        e.emp_name || '', e.emp_code || '', e.door_name || '', e.terminal_sn || '',
        EVENT_TYPE[e.event_type]?.label || '',
        e.in_out === 0 ? 'In' : e.in_out === 1 ? 'Out' : '',
        e.description || '',
      ]);
      downloadCSV([hdrs, ...rows], 'access_events.csv');
    } else {
      const hdrs = ['Door', 'Terminal', 'Status', 'APB', 'First Card', 'Mustering'];
      const rows = doorStatus.map(d => [
        d.door_name || '', d.terminal_sn || '',
        d.is_online ? 'Online' : 'Offline',
        d.anti_passback ?? 0, d.first_card_open ? 'Yes' : 'No', d.mustering_mode ? 'Yes' : 'No',
      ]);
      downloadCSV([hdrs, ...rows], 'door_status.csv');
    }
  };

  const granted = events.filter(e => e.in_out === 0).length;
  const alarms  = events.filter(e => [2,4,5,6].includes(e.event_type)).length;

  const eventCols = [
    { title: 'Time', dataIndex: 'event_time', key: 'time', width: 160,
      render: v => v ? <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{new Date(v).toLocaleString()}</span> : '—' },
    { title: 'Type', dataIndex: 'event_type', key: 'type', width: 155,
      render: v => {
        const t = EVENT_TYPE[v] || { label: 'Unknown', bg: '#f5f5f5', text: '#595959' };
        return <div style={{ display: 'inline-flex', alignItems: 'center', background: t.bg, borderRadius: 6, padding: '3px 10px', color: t.text, fontWeight: 500, fontSize: 12 }}>{t.label}</div>;
      }},
    { title: 'Employee', key: 'emp', width: 180,
      render: (_, r) => r.emp_name
        ? <div><div style={{ fontWeight: 600, fontSize: 13 }}>{r.emp_name}</div><div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.emp_code}</div></div>
        : <Tag style={{ fontSize: 11 }}>{r.emp_code || '—'}</Tag> },
    { title: 'Door',     dataIndex: 'door_name',   width: 150, render: v => v || '—' },
    { title: 'Terminal', dataIndex: 'terminal_sn', width: 130, render: v => <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Dir', dataIndex: 'in_out', width: 70,
      render: v => v === 0 ? <Tag color="blue" style={{ borderRadius: 12, fontSize: 11 }}>IN</Tag>
        : v === 1 ? <Tag color="orange" style={{ borderRadius: 12, fontSize: 11 }}>OUT</Tag> : '—' },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: v => <span style={{ fontSize: 12, color: '#8c8c8c' }}>{v || '—'}</span> },
  ];

  const doorStatusCols = [
    { title: 'Door',     dataIndex: 'door_name',   key: 'door', render: v => <b>{v}</b> },
    { title: 'Terminal', dataIndex: 'terminal_sn', key: 'term', width: 150,
      render: v => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Status', key: 'online', width: 110,
      render: (_, r) => (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: r.is_online ? '#f6ffed' : '#fff1f0',
          border: `1px solid ${r.is_online ? '#b7eb8f' : '#ffa39e'}`,
          borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500,
          color: r.is_online ? '#52c41a' : '#f5222d',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.is_online ? '#52c41a' : '#f5222d' }} />
          {r.is_online ? 'Online' : 'Offline'}
        </div>
      )},
    { title: 'APB', dataIndex: 'anti_passback', width: 120,
      render: v => <Tag color={v > 0 ? 'warning' : 'default'} style={{ borderRadius: 6 }}>{v === 0 ? 'None' : v === 1 ? 'Entry-Exit' : 'Strict'}</Tag> },
    { title: 'First Card', dataIndex: 'first_card_open', width: 110,
      render: v => <Tag color={v ? 'green' : 'default'} style={{ borderRadius: 6 }}>{v ? 'Enabled' : 'Off'}</Tag> },
    { title: 'Mustering', dataIndex: 'mustering_mode', width: 110,
      render: v => <Tag color={v ? 'orange' : 'default'} style={{ borderRadius: 6 }}>{v ? 'Active' : 'Off'}</Tag> },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24, background: '#f0f2f5' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #001529 0%, #002766 50%, #003a8c 100%)',
        borderRadius: 16, padding: '22px 28px', marginBottom: 24,
        boxShadow: '0 8px 32px rgba(0,21,41,0.4)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Space size={16}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #1890ff, #003a8c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(24,144,255,0.4)',
          }}>
            <FileTextOutlined style={{ color: 'white', fontSize: 24 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Access Control Reports</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>
              Generate, filter, and export access event logs and door status reports
            </div>
          </div>
        </Space>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={exportCSV}
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, fontWeight: 600 }}>
            Export CSV
          </Button>
        </Space>
      </div>

      {/* Report type switcher */}
      <Row gutter={12} style={{ marginBottom: 20 }}>
        {[
          { key: 'events',     label: 'Events Report',     icon: <FileTextOutlined />, color: '#1890ff', from: '#1890ff', to: '#096dd9' },
          { key: 'doorstatus', label: 'Door Status Report', icon: <ApiOutlined />,      color: '#722ed1', from: '#722ed1', to: '#531dab' },
        ].map(r => (
          <Col key={r.key} span={6}>
            <Card
              onClick={() => setActiveReport(r.key)}
              style={{
                borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                background: activeReport === r.key ? `linear-gradient(135deg,${r.from},${r.to})` : 'white',
                border: activeReport === r.key ? 'none' : '2px solid #f0f0f0',
                boxShadow: activeReport === r.key ? `0 4px 16px ${r.from}55` : '0 1px 4px rgba(0,0,0,0.04)',
              }}>
              <Space>
                <span style={{ fontSize: 18, color: activeReport === r.key ? 'white' : r.color }}>{r.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: activeReport === r.key ? 'white' : '#262626' }}>{r.label}</span>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Stats */}
      {activeReport === 'events' && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {[
            { label: 'Total Events', value: events.length,  color: '#1890ff', bg: '#e6f7ff' },
            { label: 'Entry (IN)',   value: granted,         color: '#52c41a', bg: '#f6ffed' },
            { label: 'Exit (OUT)',   value: events.filter(e => e.in_out === 1).length, color: '#fa8c16', bg: '#fff7e6' },
            { label: 'Alarms',      value: alarms,          color: '#f5222d', bg: '#fff1f0' },
          ].map(s => (
            <Col key={s.label} xs={12} sm={6}>
              <Card style={{ borderRadius: 10, background: s.bg, border: 'none', boxShadow: 'none' }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {activeReport === 'doorstatus' && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {[
            { label: 'Total Doors', value: doorStatus.length,                              color: '#722ed1', bg: '#f9f0ff' },
            { label: 'Online',      value: doorStatus.filter(d => d.is_online).length,     color: '#52c41a', bg: '#f6ffed' },
            { label: 'Offline',     value: doorStatus.filter(d => !d.is_online).length,    color: '#f5222d', bg: '#fff1f0' },
            { label: 'Mustering',   value: doorStatus.filter(d => d.mustering_mode).length, color: '#fa8c16', bg: '#fff7e6' },
          ].map(s => (
            <Col key={s.label} xs={12} sm={6}>
              <Card style={{ borderRadius: 10, background: s.bg, border: 'none', boxShadow: 'none' }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Filters (events only) */}
      {activeReport === 'events' && (
        <Card size="small" style={{ borderRadius: 10, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <Row gutter={[8, 8]} align="middle">
            <Col xs={24} sm={8}>
              <RangePicker showTime style={{ width: '100%' }} size="small"
                onChange={v => setRange(v ? [v[0], v[1]] : null)} />
            </Col>
            <Col xs={12} sm={4}>
              <Select allowClear placeholder="Door" style={{ width: '100%' }} size="small"
                value={doorFilter} onChange={setDoorFilter} showSearch optionFilterProp="label">
                {doors.map(d => <Option key={d.id} value={d.id} label={d.door_name}>{d.door_name}</Option>)}
              </Select>
            </Col>
            <Col xs={12} sm={4}>
              <Select allowClear placeholder="Event type" style={{ width: '100%' }} size="small"
                value={typeFilter} onChange={setTypeFilter}>
                {Object.entries(EVENT_TYPE).map(([v, t]) => <Option key={v} value={+v}>{t.label}</Option>)}
              </Select>
            </Col>
            <Col xs={12} sm={3}>
              <Input placeholder="Emp code" value={empFilter} size="small"
                onChange={e => setEmpFilter(e.target.value)} allowClear />
            </Col>
            <Col>
              <Button type="primary" size="small" icon={<FilterOutlined />} onClick={applyFilters} style={{ borderRadius: 6 }}>Apply</Button>
            </Col>
            <Col>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchEvents()} style={{ borderRadius: 6 }}>Refresh</Button>
            </Col>
            <Col>
              <Button size="small" icon={<CloseCircleOutlined />} style={{ borderRadius: 6 }}
                onClick={() => { setRange(null); setDoorFilter(null); setTypeFilter(null); setEmpFilter(''); setApplied({}); }}>
                Clear
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      {activeReport === 'doorstatus' && (
        <div style={{ marginBottom: 12 }}>
          <Button icon={<ReloadOutlined />} size="small" onClick={() => refetchDoorStatus()} style={{ borderRadius: 6 }}>Refresh</Button>
        </div>
      )}

      <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        styles={{ body: { padding: 0 } }}>
        {activeReport === 'events' ? (
          <Table columns={eventCols} dataSource={events} rowKey={(r, i) => r.id ?? i}
            loading={eventsLoading} size="small" scroll={{ x: 1000 }}
            pagination={{ pageSize: 50, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
            rowClassName={r => [2,4,5,6].includes(r.event_type) ? 'ac-row-danger' : ''}
            style={{ borderRadius: 12, overflow: 'hidden' }} />
        ) : (
          <Table columns={doorStatusCols} dataSource={doorStatus} rowKey="id"
            loading={doorStatusLoading} size="middle" pagination={false}
            style={{ borderRadius: 12, overflow: 'hidden' }} />
        )}
      </Card>
      <style>{`
        .ac-row-danger td { background: #fff8f7 !important; }
        .ac-row-danger:hover td { background: #ffe8e6 !important; }
      `}</style>
    </div>
  );
};

export default AccessReports;
