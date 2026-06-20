import React, { useState } from 'react';
import {
  Card, Row, Col, Statistic, Table, DatePicker, Button, Tabs,
  InputNumber, Alert, Typography, Space, Tag, message,
} from 'antd';
import {
  ReloadOutlined, WarningOutlined, UserOutlined, TeamOutlined,
  ClockCircleOutlined, DownloadOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';

const { Text } = Typography;

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Daily Report ─────────────────────────────────────────────────────────────
const DailyReport = () => {
  const [date, setDate] = useState(dayjs());
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-daily-report', date?.format('YYYY-MM-DD')],
    queryFn:  () => visitorAPI.getDailyReport(date.format('YYYY-MM-DD')),
    enabled:  !!date,
    staleTime: 60000,
  });
  const report = data?.data ?? null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const d = date?.format('YYYY-MM-DD');
      const { blob, filename } = await visitorAPI.exportVisitorRecords({
        start_date: d,
        end_date: d,
      });
      triggerDownload(blob, filename);
      message.success('Exported');
    } catch (e) {
      message.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <DatePicker value={date} onChange={setDate} />
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading}>Refresh</Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>Export CSV</Button>
      </div>

      {report ? (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            {[
              { title: 'Total Visitors', value: report.total_visitors, icon: <TeamOutlined />,   color: '#1677ff' },
              { title: 'Checked In',     value: report.checked_in,    icon: <UserOutlined />,    color: '#52c41a' },
              { title: 'Checked Out',    value: report.checked_out,   icon: <UserOutlined />,    color: '#722ed1' },
              { title: 'On Site',        value: report.on_site,       icon: <UserOutlined />,    color: '#13c2c2' },
              { title: 'Overstay',       value: report.overstay,      icon: <WarningOutlined />, color: '#ff4d4f' },
            ].map(({ title, value, icon, color }) => (
              <Col span={4} key={title}>
                <Card size="small">
                  <Statistic title={title} value={value} prefix={icon} valueStyle={{ color }} />
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Card title="By Visitor Type" size="small">
                <Table
                  dataSource={report.by_type}
                  rowKey="type"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Type',  dataIndex: 'type',  ellipsis: true },
                    { title: 'Count', dataIndex: 'count', width: 80 },
                  ]}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="By Host" size="small">
                <Table
                  dataSource={report.by_host}
                  rowKey="host"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Host',  dataIndex: 'host',  ellipsis: true },
                    { title: 'Count', dataIndex: 'count', width: 80 },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </>
      ) : !isLoading ? (
        <Alert type="info" message="No data for selected date." />
      ) : null}
    </>
  );
};

// ── Overstay Report ───────────────────────────────────────────────────────────
const OverstayReport = () => {
  const [hours, setHours]     = useState(8);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-overstay-report', hours],
    queryFn:  () => visitorAPI.getOverstayReport(hours),
    staleTime: 60000,
  });
  const rows = data?.data ?? [];

  const handleExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await visitorAPI.exportVisitorRecords({ status: 0 });
      triggerDownload(blob, `overstay_${hours}h_${dayjs().format('YYYYMMDD')}.csv`);
      message.success('Exported');
    } catch (e) {
      message.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { title: 'Visitor',      dataIndex: 'visitor_name',  ellipsis: true },
    { title: 'Company',      dataIndex: 'company',       ellipsis: true, render: (v) => v || '—' },
    { title: 'Host',         dataIndex: 'host_name',     ellipsis: true, render: (v) => v || '—' },
    {
      title: 'Check-In', dataIndex: 'check_in_time', width: 140,
      render: (v) => v ? dayjs(v).format('DD MMM HH:mm') : '—',
    },
    {
      title: 'Hours Overdue', dataIndex: 'hours_overdue', width: 120,
      render: (v) => <Text type="danger" strong>{v?.toFixed(1)}h</Text>,
      sorter: (a, b) => b.hours_overdue - a.hours_overdue,
    },
    {
      title: 'Contact', dataIndex: 'contact_info', width: 200,
      render: (v) => v ? <span>{v.phone || ''} {v.email ? `· ${v.email}` : ''}</span> : '—',
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>Show visitors on site longer than</span>
        <InputNumber min={1} max={72} value={hours} onChange={setHours} style={{ width: 80 }} />
        <span>hours</span>
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
        <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>Export CSV</Button>
      </div>

      {rows.length > 0 && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          message={`${rows.length} visitor(s) have exceeded the ${hours}h limit`}
          style={{ marginBottom: 12 }}
          showIcon
        />
      )}

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="visitor_id"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 750 }}
      />
    </>
  );
};

// ── Visitor Frequency Report ──────────────────────────────────────────────────
const FrequencyReport = () => {
  const [limit, setLimit] = useState(50);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-frequency', limit],
    queryFn: () => visitorAPI.getVisitorFrequency(limit),
    staleTime: 60000,
  });
  const rows = data?.data ?? [];

  const columns = [
    {
      title: '#', width: 50,
      render: (_, __, idx) => <Text type="secondary">{idx + 1}</Text>,
    },
    {
      title: 'Visitor', ellipsis: true,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.full_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.company || ''}</Text>
        </Space>
      ),
    },
    {
      title: 'Code', dataIndex: 'visitor_code', width: 130,
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Type', dataIndex: 'visitor_type', width: 110,
      render: (v) => v ? <Tag>{v}</Tag> : '—',
    },
    { title: 'Phone', dataIndex: 'phone', width: 130, render: (v) => v || '—' },
    {
      title: 'Visits', dataIndex: 'visit_count', width: 80,
      sorter: (a, b) => b.visit_count - a.visit_count,
      defaultSortOrder: 'ascend',
      render: (v) => <Text strong style={{ color: '#1677ff' }}>{v}</Text>,
    },
    {
      title: 'Last Visit', dataIndex: 'last_visit', width: 130,
      render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '—',
      sorter: (a, b) => dayjs(a.last_visit).unix() - dayjs(b.last_visit).unix(),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>Show top</span>
        <InputNumber min={10} max={200} value={limit} onChange={setLimit} style={{ width: 80 }} step={10} />
        <span>visitors</span>
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="visitor_id"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 750 }}
      />
    </>
  );
};

// ── Main Reports Page ─────────────────────────────────────────────────────────
const Reports = () => (
  <Tabs
    items={[
      { key: 'daily',     label: <span><TeamOutlined />Daily Report</span>,         children: <DailyReport /> },
      { key: 'overstay',  label: <span><ClockCircleOutlined />Overstay</span>,       children: <OverstayReport /> },
      { key: 'frequency', label: <span><TrophyOutlined />Visitor Frequency</span>,  children: <FrequencyReport /> },
    ]}
  />
);

export default Reports;
