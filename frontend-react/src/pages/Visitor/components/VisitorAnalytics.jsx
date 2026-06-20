import React, { useState } from 'react';
import {
  Card, Row, Col, Statistic, Typography, Space, Spin, Select,
  Progress, Tag, Empty, Button, Divider, List, Avatar,
} from 'antd';
import {
  UserOutlined, TeamOutlined, ClockCircleOutlined, LoginOutlined,
  WarningOutlined, StopOutlined, CheckCircleOutlined, RiseOutlined,
  ReloadOutlined, BarChartOutlined, TrophyOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';

const { Text, Title } = Typography;

// ── colour palette (matches POBStatus pattern) ───────────────────────────────
const PIE_COLORS = ['#1677ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];

const RANGE_OPTIONS = [
  { label: 'Last 7 days',  value: 7  },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 365 days',value: 365},
];

// ── small helpers ─────────────────────────────────────────────────────────────
const kpiColor = (key) => ({
  total_visitors:          '#1677ff',
  active_visitors:         '#52c41a',
  total_visits:            '#722ed1',
  avg_visit_duration_hours:'#13c2c2',
  today_checkins:          '#fa8c16',
  overstay_count:          '#ff4d4f',
  blacklist_count:         '#cf1322',
  pre_reg_rate:            '#52c41a',
}[key] || '#1677ff');

const complianceColor = (pct) => {
  if (pct >= 90) return '#52c41a';
  if (pct >= 70) return '#faad14';
  return '#ff4d4f';
};

// ── custom tooltip for recharts ───────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px' }}>
      <div style={{ marginBottom: 4 }}><Text strong>{label}</Text></div>
      {payload.map((p) => (
        <div key={p.dataKey}>
          <Text style={{ color: p.color }}>{p.name ?? p.dataKey}: </Text>
          <Text strong>{p.value}</Text>
        </div>
      ))}
    </div>
  );
};

// ── KPI card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ title, value, suffix, icon, colorKey }) => (
  <Card size="small" style={{ height: '100%' }}>
    <Statistic
      title={title}
      value={value ?? 0}
      suffix={suffix}
      prefix={icon}
      valueStyle={{ color: kpiColor(colorKey), fontSize: 22 }}
    />
  </Card>
);

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ title, children, extra }) => (
  <Card
    title={<Text strong style={{ fontSize: 14 }}>{title}</Text>}
    extra={extra}
    size="small"
    style={{ height: '100%' }}
    bodyStyle={{ padding: '12px 16px' }}
  >
    {children}
  </Card>
);

// ── Main component ────────────────────────────────────────────────────────────
const VisitorAnalytics = () => {
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['visitor-analytics', days],
    queryFn:  () => visitorAPI.getAnalytics(days),
    staleTime: 120000,
    keepPreviousData: true,
  });

  const analytics = data?.data ?? null;
  const ov        = analytics?.overview ?? {};

  return (
    <div>
      {/* ── Header row ───────────────────────────────────────────────────── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space align="baseline">
            <BarChartOutlined style={{ fontSize: 18, color: '#1677ff' }} />
            <Title level={5} style={{ margin: 0 }}>Visitor Analytics</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs().subtract(days, 'day').format('DD MMM')} – {dayjs().format('DD MMM YYYY')}
            </Text>
          </Space>
        </Col>
        <Col>
          <Space>
            <Select
              value={days}
              onChange={setDays}
              options={RANGE_OPTIONS}
              style={{ width: 140 }}
              size="small"
            />
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={refetch}
              loading={isFetching}
            >
              Refresh
            </Button>
          </Space>
        </Col>
      </Row>

      <Spin spinning={isLoading && !analytics}>

        {/* ── Row 1 — KPI cards ─────────────────────────────────────────── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            { title: 'Total Visitors',    colorKey: 'total_visitors',          value: ov.total_visitors,          icon: <UserOutlined />,         suffix: '' },
            { title: 'On Site Now',       colorKey: 'active_visitors',         value: ov.active_visitors,         icon: <LoginOutlined />,        suffix: '' },
            { title: 'Visits (Period)',   colorKey: 'total_visits',            value: ov.total_visits,            icon: <TeamOutlined />,         suffix: '' },
            { title: "Today's Check-ins", colorKey: 'today_checkins',          value: ov.today_checkins,          icon: <CheckCircleOutlined />,  suffix: '' },
            { title: 'Avg Duration',      colorKey: 'avg_visit_duration_hours',value: ov.avg_visit_duration_hours,icon: <ClockCircleOutlined />,  suffix: 'h' },
            { title: 'Pre-reg Rate',      colorKey: 'pre_reg_rate',            value: ov.pre_reg_rate,            icon: <RiseOutlined />,         suffix: '%' },
            { title: 'Overstay',          colorKey: 'overstay_count',          value: ov.overstay_count,          icon: <WarningOutlined />,      suffix: '' },
            { title: 'Blacklisted',       colorKey: 'blacklist_count',         value: ov.blacklist_count,         icon: <StopOutlined />,         suffix: '' },
          ].map(({ title, colorKey, value, icon, suffix }) => (
            <Col span={3} key={colorKey}>
              <KpiCard title={title} value={value} suffix={suffix} icon={icon} colorKey={colorKey} />
            </Col>
          ))}
        </Row>

        {/* ── Row 2 — Daily trend + Visitor type pie ────────────────────── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col span={16}>
            <Section title={`Daily Visit Trend — Last ${days} Days`}>
              {analytics?.daily_trend?.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analytics.daily_trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="visitorGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1677ff" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#1677ff" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => dayjs(v).format('DD MMM')}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <ReTooltip
                      content={<ChartTooltip />}
                      labelFormatter={(v) => dayjs(v).format('DD MMM YYYY')}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Visits"
                      stroke="#1677ff"
                      strokeWidth={2}
                      fill="url(#visitorGrad)"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No trend data" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
              )}
            </Section>
          </Col>

          <Col span={8}>
            <Section title="Visitor Type Distribution">
              {analytics?.type_distribution?.length ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={analytics.type_distribution}
                        dataKey="count"
                        nameKey="type_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        innerRadius={30}
                      >
                        {analytics.type_distribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip
                        content={({ active, payload }) =>
                          active && payload?.[0] ? (
                            <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 6, padding: '6px 10px' }}>
                              <Text strong>{payload[0].name}</Text>
                              <br />
                              <Text>{payload[0].value} visits ({payload[0].payload.percentage}%)</Text>
                            </div>
                          ) : null
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ maxHeight: 80, overflowY: 'auto' }}>
                    {analytics.type_distribution.map((t, i) => (
                      <Row key={t.type_name} justify="space-between" align="middle" style={{ marginBottom: 4 }}>
                        <Col>
                          <Space size={6}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], display: 'inline-block' }} />
                            <Text style={{ fontSize: 12 }}>{t.type_name}</Text>
                          </Space>
                        </Col>
                        <Col>
                          <Space size={4}>
                            <Text strong style={{ fontSize: 12 }}>{t.count}</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>({t.percentage}%)</Text>
                          </Space>
                        </Col>
                      </Row>
                    ))}
                  </div>
                </>
              ) : (
                <Empty description="No type data" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
              )}
            </Section>
          </Col>
        </Row>

        {/* ── Row 3 — Peak hours + Top hosts ───────────────────────────── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col span={14}>
            <Section title="Peak Visit Hours">
              {analytics?.peak_hours?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.peak_hours} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <ReTooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Visits" radius={[4, 4, 0, 0]}>
                      {analytics.peak_hours.map((entry, i) => {
                        const maxCount = Math.max(...analytics.peak_hours.map(h => h.count));
                        const intensity = entry.count / (maxCount || 1);
                        const fill = intensity > 0.7 ? '#1677ff' : intensity > 0.4 ? '#4096ff' : '#91caff';
                        return <Cell key={i} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No peak hour data" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
              )}
            </Section>
          </Col>

          <Col span={10}>
            <Section
              title="Top Hosts by Visitors Received"
              extra={<Tag icon={<TrophyOutlined />} color="gold">Period Ranking</Tag>}
            >
              {analytics?.top_hosts?.length ? (
                <List
                  size="small"
                  dataSource={analytics.top_hosts.slice(0, 8)}
                  renderItem={(item, index) => {
                    const maxCount = analytics.top_hosts[0]?.count || 1;
                    const pct = Math.round((item.count / maxCount) * 100);
                    const medalColor = ['#FFD700', '#C0C0C0', '#CD7F32'][index] ?? '#1677ff';
                    return (
                      <List.Item style={{ padding: '5px 0' }}>
                        <Row style={{ width: '100%' }} align="middle" gutter={8}>
                          <Col flex="24px">
                            <Avatar
                              size={20}
                              style={{
                                background: medalColor,
                                fontSize: 10,
                                lineHeight: '20px',
                              }}
                            >
                              {index + 1}
                            </Avatar>
                          </Col>
                          <Col flex="1" style={{ minWidth: 0 }}>
                            <Text
                              ellipsis
                              style={{ fontSize: 12, display: 'block' }}
                            >
                              {item.host || '—'}
                            </Text>
                            <Progress
                              percent={pct}
                              showInfo={false}
                              size="small"
                              strokeColor="#1677ff"
                              style={{ margin: 0 }}
                            />
                          </Col>
                          <Col flex="30px" style={{ textAlign: 'right' }}>
                            <Text strong style={{ fontSize: 12, color: '#1677ff' }}>{item.count}</Text>
                          </Col>
                        </Row>
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Empty description="No host data" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '30px 0' }} />
              )}
            </Section>
          </Col>
        </Row>

        {/* ── Row 4 — Quick stats summary ──────────────────────────────── */}
        <Row gutter={[12, 12]}>
          <Col span={12}>
            <Section title="Pre-Registration Adoption">
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div>
                  <Row justify="space-between" style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 13 }}>Pre-registered visits</Text>
                    <Text strong style={{ color: complianceColor(ov.pre_reg_rate ?? 0) }}>
                      {ov.pre_reg_rate ?? 0}%
                    </Text>
                  </Row>
                  <Progress
                    percent={ov.pre_reg_rate ?? 0}
                    showInfo={false}
                    strokeColor={complianceColor(ov.pre_reg_rate ?? 0)}
                  />
                </div>
                <Row gutter={12}>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: 'center', background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                      <Text strong style={{ fontSize: 18, color: '#52c41a', display: 'block' }}>{ov.total_visits ?? 0}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>Total Visits</Text>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: 'center', background: '#e6f4ff', border: '1px solid #91caff' }}>
                      <Text strong style={{ fontSize: 18, color: '#1677ff', display: 'block' }}>{ov.active_visitors ?? 0}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>On Site Now</Text>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ textAlign: 'center', background: '#fff7e6', border: '1px solid #ffd591' }}>
                      <Text strong style={{ fontSize: 18, color: '#fa8c16', display: 'block' }}>{ov.overstay_count ?? 0}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>Overstay</Text>
                    </Card>
                  </Col>
                </Row>
              </Space>
            </Section>
          </Col>

          <Col span={12}>
            <Section title="Security & Compliance Summary">
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {[
                  {
                    label: 'Blacklisted visitors blocked',
                    value: ov.blacklist_count ?? 0,
                    icon: <StopOutlined />,
                    color: '#ff4d4f',
                    suffix: 'profiles',
                    bg: '#fff2f0',
                    border: '#ffccc7',
                  },
                  {
                    label: 'Avg. visit duration',
                    value: ov.avg_visit_duration_hours ?? 0,
                    icon: <ClockCircleOutlined />,
                    color: '#13c2c2',
                    suffix: 'hours',
                    bg: '#e6fffb',
                    border: '#87e8de',
                  },
                  {
                    label: "Today's check-ins",
                    value: ov.today_checkins ?? 0,
                    icon: <CheckCircleOutlined />,
                    color: '#52c41a',
                    suffix: 'visitors',
                    bg: '#f6ffed',
                    border: '#b7eb8f',
                  },
                ].map(({ label, value, icon, color, suffix, bg, border }) => (
                  <Row
                    key={label}
                    align="middle"
                    gutter={12}
                    style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '8px 12px' }}
                  >
                    <Col flex="28px">
                      <span style={{ color, fontSize: 18 }}>{icon}</span>
                    </Col>
                    <Col flex="1">
                      <Text style={{ fontSize: 12 }}>{label}</Text>
                    </Col>
                    <Col>
                      <Text strong style={{ color, fontSize: 15 }}>{value}</Text>
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>{suffix}</Text>
                    </Col>
                  </Row>
                ))}
              </Space>
            </Section>
          </Col>
        </Row>

      </Spin>
    </div>
  );
};

export default VisitorAnalytics;
