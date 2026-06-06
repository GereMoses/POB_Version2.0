import React, { useState } from 'react';
import {
  Card, Row, Col, Statistic, Table, DatePicker, Button, Tabs,
  InputNumber, Alert, List, Typography,
} from 'antd';
import { ReloadOutlined, WarningOutlined, UserOutlined, TeamOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';

const { Text } = Typography;

const DailyReport = () => {
  const [date, setDate] = useState(dayjs());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-daily-report', date?.format('YYYY-MM-DD')],
    queryFn:  () => visitorAPI.getDailyReport(date.format('YYYY-MM-DD')),
    enabled:  !!date,
    staleTime: 60000,
  });
  const report = data?.data ?? null;

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <DatePicker value={date} onChange={setDate} />
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading}>Refresh</Button>
      </div>

      {report ? (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            {[
              { title: 'Total Visitors',  value: report.total_visitors, icon: <TeamOutlined />,        color: '#1677ff' },
              { title: 'Checked In',      value: report.checked_in,    icon: <UserOutlined />,         color: '#52c41a' },
              { title: 'Checked Out',     value: report.checked_out,   icon: <UserOutlined />,         color: '#722ed1' },
              { title: 'On Site',         value: report.on_site,       icon: <UserOutlined />,         color: '#13c2c2' },
              { title: 'Overstay',        value: report.overstay,      icon: <WarningOutlined />,      color: '#ff4d4f' },
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

const OverstayReport = () => {
  const [hours, setHours] = useState(8);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-overstay-report', hours],
    queryFn:  () => visitorAPI.getOverstayReport(hours),
    staleTime: 60000,
  });
  const rows = data?.data ?? [];

  const columns = [
    { title: 'Visitor',    dataIndex: 'visitor_name',  ellipsis: true },
    { title: 'Company',    dataIndex: 'company',       ellipsis: true, render: v => v || '—' },
    { title: 'Host',       dataIndex: 'host_name',     ellipsis: true, render: v => v || '—' },
    {
      title: 'Check-In',   dataIndex: 'check_in_time', width: 140,
      render: v => v ? dayjs(v).format('DD MMM HH:mm') : '—',
    },
    {
      title: 'Hours Overdue', dataIndex: 'hours_overdue', width: 120,
      render: v => <Text type="danger">{v?.toFixed(1)}h</Text>,
    },
    {
      title: 'Contact',    dataIndex: 'contact_info',  width: 180,
      render: v => v ? <span>{v.phone || ''} {v.email || ''}</span> : '—',
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>Show visitors on site longer than</span>
        <InputNumber min={1} max={72} value={hours} onChange={setHours} style={{ width: 80 }} />
        <span>hours</span>
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
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
        scroll={{ x: 700 }}
      />
    </>
  );
};

const Reports = () => (
  <Tabs
    items={[
      { key: 'daily',    label: <span><TeamOutlined />Daily Report</span>,  children: <DailyReport /> },
      { key: 'overstay', label: <span><ClockCircleOutlined />Overstay</span>, children: <OverstayReport /> },
    ]}
  />
);

export default Reports;
