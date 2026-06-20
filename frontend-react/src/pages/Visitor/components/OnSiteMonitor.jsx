import React, { useState, useEffect } from 'react';
import {
  Table, Button, Tag, Badge, Card, Row, Col, Statistic, Tooltip,
  Popconfirm, message, Typography, Progress, Space,
} from 'antd';
import {
  ReloadOutlined, LogoutOutlined, ClockCircleOutlined,
  UserOutlined, TeamOutlined, WarningOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import visitorAPI from '../../../services/visitorAPI';

dayjs.extend(duration);

const { Text } = Typography;

const liveDuration = (checkInTime) => {
  if (!checkInTime) return { text: '—', hours: 0 };
  const ms = dayjs().diff(dayjs(checkInTime));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { text: `${h}h ${m}m`, hours: h + m / 60 };
};

const durationColor = (hours) => {
  if (hours >= 8) return '#ff4d4f';   // red – overstay
  if (hours >= 6) return '#fa8c16';   // orange – approaching
  return '#52c41a';                    // green – ok
};

const durationPercent = (hours, max = 8) =>
  Math.min(Math.round((hours / max) * 100), 100);

const OnSiteMonitor = () => {
  const qc = useQueryClient();
  const [tick, setTick] = useState(0);

  // Live clock – re-renders durations every minute
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-on-site'],
    queryFn: () => visitorAPI.getOnSiteVisitors(),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const rows = data?.data ?? [];

  const forceOutMut = useMutation({
    mutationFn: (logId) => visitorAPI.forceCheckOut(logId),
    onSuccess: () => {
      message.success('Visitor checked out');
      qc.invalidateQueries(['visitor-on-site']);
      qc.invalidateQueries(['visitor-stats']);
      qc.invalidateQueries(['visitor-records']);
    },
    onError: (e) => message.error(e.message),
  });

  // Summary counts
  const overstayCount = rows.filter(r => liveDuration(r.check_in_time).hours >= 8).length;
  const approachingCount = rows.filter(r => {
    const h = liveDuration(r.check_in_time).hours;
    return h >= 6 && h < 8;
  }).length;

  const columns = [
    {
      title: 'Visitor',
      ellipsis: true,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.visitor?.full_name || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.visitor?.company || ''}</Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      width: 110,
      render: (_, r) => r.visitor?.visitor_type?.type_name
        ? <Tag>{r.visitor.visitor_type.type_name}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Host',
      ellipsis: true,
      render: (_, r) => r.host_employee
        ? `${r.host_employee.first_name || ''} ${r.host_employee.last_name || ''}`.trim()
        : '—',
    },
    {
      title: 'Checked In',
      dataIndex: 'check_in_time',
      width: 130,
      render: (v) => v ? dayjs(v).format('HH:mm, DD MMM') : '—',
    },
    {
      title: 'Duration',
      width: 180,
      render: (_, r) => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const { text, hours } = liveDuration(r.check_in_time);
        const color = durationColor(hours);
        const pct = durationPercent(hours);
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Text style={{ color, fontWeight: 600 }}>{text}</Text>
            <Progress
              percent={pct}
              showInfo={false}
              size="small"
              strokeColor={color}
              style={{ margin: 0 }}
            />
          </Space>
        );
      },
    },
    {
      title: 'Card',
      dataIndex: 'card_no',
      width: 110,
      render: (v) => v ? <Tag color="blue">{v}</Tag> : '—',
    },
    {
      title: 'Area',
      width: 100,
      render: (_, r) => r.area?.area_name || '—',
    },
    {
      title: '',
      width: 70,
      render: (_, r) => (
        <Tooltip title="Force Check-Out">
          <Popconfirm
            title={`Check out ${r.visitor?.full_name || 'this visitor'}?`}
            onConfirm={() => forceOutMut.mutate(r.id)}
            okText="Check Out"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<LogoutOutlined />}
              loading={forceOutMut.isPending && forceOutMut.variables === r.id}
            />
          </Popconfirm>
        </Tooltip>
      ),
    },
  ];

  const rowClassName = (record) => {
    const { hours } = liveDuration(record.check_in_time);
    if (hours >= 8) return 'visitor-row-overstay';
    if (hours >= 6) return 'visitor-row-approaching';
    return '';
  };

  return (
    <>
      <style>{`
        .visitor-row-overstay > td { background: #fff2f0 !important; }
        .visitor-row-approaching > td { background: #fff7e6 !important; }
      `}</style>

      {/* Summary bar */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="On Site Now"
              value={rows.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="OK (< 6h)"
              value={rows.length - approachingCount - overstayCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Approaching Limit"
              value={approachingCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Overstay (8h+)"
              value={overstayCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Badge color="#52c41a" text="< 6h" />
          <Badge color="#fa8c16" text="6–8h (approaching)" />
          <Badge color="#ff4d4f" text="8h+ (overstay)" />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} size="small">
          Refresh
        </Button>
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        rowClassName={rowClassName}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 900 }}
        locale={{ emptyText: 'No visitors on site' }}
      />
    </>
  );
};

export default OnSiteMonitor;
