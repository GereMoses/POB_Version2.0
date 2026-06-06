import React, { useState } from 'react';
import {
  Table, Button, Select, Card, Statistic, Row, Col, Progress,
  message, Space, Tag, Segmented, Divider,
} from 'antd';
import { DatePicker } from 'antd';
import {
  BarChartOutlined, ReloadOutlined, DownloadOutlined,
  CalendarOutlined, TeamOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import meetingApi from '../../../services/meetingApi';

const { RangePicker } = DatePicker;

const DATE_PRESETS = [
  { label: 'Last 7 days',  value: '7d',   range: () => [dayjs().subtract(7, 'day'),  dayjs()] },
  { label: 'Last 30 days', value: '30d',  range: () => [dayjs().subtract(30, 'day'), dayjs()] },
  { label: 'This month',   value: 'month', range: () => [dayjs().startOf('month'),    dayjs()] },
  { label: 'Custom',       value: 'custom' },
];

const MeetingReports = () => {
  const [reportType, setReportType] = useState('utilization');
  const [preset, setPreset]         = useState('30d');
  const [range, setRange]           = useState([dayjs().subtract(30, 'day'), dayjs()]);

  const start = range?.[0]?.format('YYYY-MM-DD');
  const end   = range?.[1]?.format('YYYY-MM-DD');

  const applyPreset = (val) => {
    setPreset(val);
    if (val !== 'custom') {
      const p = DATE_PRESETS.find(d => d.value === val);
      if (p?.range) setRange(p.range());
    }
  };

  const { data: utilData, isLoading: utilLoading, refetch: refetchUtil } = useQuery({
    queryKey: ['meeting-util-report', start, end],
    queryFn:  () => meetingApi.getUtilizationReport({ start_date: start, end_date: end }),
    enabled:  reportType === 'utilization' && !!start && !!end,
    staleTime: 60000,
  });
  const utilReport = utilData?.data ?? {};

  const { data: noShowData, isLoading: noShowLoading, refetch: refetchNoShow } = useQuery({
    queryKey: ['meeting-noshow-report', start, end],
    queryFn:  () => meetingApi.getNoShowReport({ start_date: start, end_date: end }),
    enabled:  reportType === 'no-show' && !!start && !!end,
    staleTime: 60000,
  });
  const noShowReport = noShowData?.data ?? {};

  const isLoading = reportType === 'utilization' ? utilLoading : noShowLoading;
  const utilRooms = Object.values(utilReport.room_utilization ?? {});

  const handleRefresh = () => {
    if (reportType === 'utilization') refetchUtil();
    else refetchNoShow();
  };

  const handleExport = () => {
    let csv = '';
    if (reportType === 'utilization' && utilReport.room_utilization) {
      csv = 'Room,Total Hours,Bookings,Utilization %\n';
      Object.values(utilReport.room_utilization).forEach(r => {
        csv += `${r.room_name},${r.total_hours?.toFixed(1)},${r.booking_count},${r.utilization_percentage?.toFixed(1)}\n`;
      });
    } else if (reportType === 'no-show' && noShowReport.no_shows) {
      csv = 'Employee,No-Show Count,No-Show Rate %\n';
      noShowReport.no_shows.forEach(r => {
        csv += `${r.employee_name},${r.no_show_count},${r.no_show_rate?.toFixed(1)}\n`;
      });
    }
    if (!csv) { message.warning('No data to export'); return; }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `meeting_${reportType}_${start}_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const utilizationColumns = [
    {
      title: 'Room', dataIndex: 'room_name', ellipsis: true,
      render: v => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Bookings', dataIndex: 'booking_count', width: 90,
      sorter: (a, b) => a.booking_count - b.booking_count,
      render: v => <><CalendarOutlined style={{ color: '#888', marginRight: 4 }} />{v}</>,
    },
    {
      title: 'Total Hours', dataIndex: 'total_hours', width: 110,
      sorter: (a, b) => a.total_hours - b.total_hours,
      render: v => <><ClockCircleOutlined style={{ color: '#888', marginRight: 4 }} />{v?.toFixed(1) ?? '0'}h</>,
    },
    {
      title: 'Utilization', dataIndex: 'utilization_percentage', width: 200,
      sorter: (a, b) => a.utilization_percentage - b.utilization_percentage,
      defaultSortOrder: 'descend',
      render: v => {
        const pct = Math.min(v ?? 0, 100);
        const color = pct >= 70 ? '#52c41a' : pct >= 40 ? '#1677ff' : '#faad14';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={pct}
              size="small"
              style={{ flex: 1, marginBottom: 0 }}
              showInfo={false}
              strokeColor={color}
            />
            <span style={{ minWidth: 44, textAlign: 'right', color, fontWeight: 600 }}>
              {(v ?? 0).toFixed(1)}%
            </span>
          </div>
        );
      },
    },
  ];

  const noShowColumns = [
    { title: 'Employee', dataIndex: 'employee_name', ellipsis: true },
    {
      title: 'No-Show Count', dataIndex: 'no_show_count', width: 130,
      sorter: (a, b) => a.no_show_count - b.no_show_count,
      render: v => <><TeamOutlined style={{ color: '#888', marginRight: 4 }} />{v}</>,
    },
    {
      title: 'No-Show Rate', dataIndex: 'no_show_rate', width: 150,
      sorter: (a, b) => a.no_show_rate - b.no_show_rate,
      defaultSortOrder: 'descend',
      render: v => {
        const color = v > 20 ? '#ff4d4f' : v > 10 ? '#fa8c16' : '#52c41a';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={Math.min(v ?? 0, 100)}
              size="small"
              style={{ flex: 1, marginBottom: 0 }}
              showInfo={false}
              strokeColor={color}
            />
            <Tag color={color} style={{ minWidth: 52, textAlign: 'center', margin: 0 }}>
              {(v ?? 0).toFixed(1)}%
            </Tag>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          value={reportType}
          onChange={setReportType}
          style={{ width: 180 }}
          options={[
            { value: 'utilization', label: <><BarChartOutlined /> Room Utilization</> },
            { value: 'no-show',     label: <><TeamOutlined /> No-Show Report</> },
          ]}
        />
        <Segmented
          value={preset}
          onChange={applyPreset}
          options={DATE_PRESETS.map(d => ({ value: d.value, label: d.label }))}
        />
        {preset === 'custom' && (
          <RangePicker value={range} onChange={setRange} format="DD MMM YYYY" />
        )}
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isLoading} />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Export CSV</Button>
        </Space>
      </div>

      {/* Period display */}
      <div style={{ marginBottom: 12, fontSize: 13, color: '#888' }}>
        Report period: <strong>{range?.[0]?.format('DD MMM YYYY')}</strong> — <strong>{range?.[1]?.format('DD MMM YYYY')}</strong>
        {utilReport.period?.working_days && (
          <> ({utilReport.period.working_days} working days)</>
        )}
      </div>

      {/* Utilization Report */}
      {reportType === 'utilization' && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
                <Statistic
                  title={<span style={{ fontSize: 12 }}>Total Meeting Hours</span>}
                  value={utilReport.total_meeting_hours?.toFixed(1) ?? '0'}
                  suffix="h"
                  valueStyle={{ color: '#0078D4' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
                <Statistic
                  title={<span style={{ fontSize: 12 }}>Overall Utilization</span>}
                  value={(utilReport.overall_utilization ?? 0).toFixed(1)}
                  suffix="%"
                  valueStyle={{ color: '#0078D4' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
                <Statistic
                  title={<span style={{ fontSize: 12 }}>Total Bookings</span>}
                  value={utilRooms.reduce((s, r) => s + (r.booking_count ?? 0), 0)}
                  valueStyle={{ color: '#0078D4' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
                <Statistic
                  title={<span style={{ fontSize: 12 }}>Rooms Tracked</span>}
                  value={utilRooms.length}
                  valueStyle={{ color: '#0078D4' }}
                />
              </Card>
            </Col>
          </Row>

          <Table
            dataSource={utilRooms.map((r, i) => ({ ...r, key: i }))}
            columns={utilizationColumns}
            size="small"
            loading={utilLoading}
            pagination={false}
            locale={{ emptyText: 'No utilization data for this period' }}
          />
        </>
      )}

      {/* No-Show Report */}
      {reportType === 'no-show' && (
        <>
          {noShowReport.no_shows?.length > 0 && (
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={12} sm={6}>
                <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
                  <Statistic
                    title={<span style={{ fontSize: 12 }}>Employees with No-Shows</span>}
                    value={noShowReport.no_shows?.length ?? 0}
                    valueStyle={{ color: '#0078D4' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
                  <Statistic
                    title={<span style={{ fontSize: 12 }}>Worst Rate</span>}
                    value={(noShowReport.no_shows?.[0]?.no_show_rate ?? 0).toFixed(1)}
                    suffix="%"
                    valueStyle={{ color: (noShowReport.no_shows?.[0]?.no_show_rate ?? 0) > 20 ? '#ff4d4f' : '#0078D4' }}
                  />
                </Card>
              </Col>
            </Row>
          )}
          <Table
            dataSource={(noShowReport.no_shows ?? []).map((r, i) => ({ ...r, key: i }))}
            columns={noShowColumns}
            size="small"
            loading={noShowLoading}
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: 'No no-show data for this period' }}
          />
        </>
      )}
    </div>
  );
};

export default MeetingReports;
