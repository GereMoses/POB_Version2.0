import React, { useState } from 'react';
import {
  Row, Col, Card, Statistic, Table, Tag, Badge, Button,
  Select, Space, Alert, Empty, Progress, Divider,
} from 'antd';
import {
  ReloadOutlined, DatabaseOutlined, SafetyOutlined,
  ClockCircleOutlined, ThunderboltOutlined, BarChartOutlined,
  TeamOutlined, WifiOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiService from '../../../services/api';

const BASE = '/api/v1/biotime/analytics';

const biotimeApi = {
  dashboard:      ()       => apiService.get(`${BASE}/dashboard`),
  verifyMetrics:  (days)   => apiService.get(`${BASE}/performance/verification-metrics`, { days }),
  usageTrends:    (days)   => apiService.get(`${BASE}/compliance/usage-trends`, { days }),
  deviceActivity: (days)   => apiService.get(`${BASE}/usage/device-activity`, { days }),
  templates:      ()       => apiService.get(`${BASE}/usage/biometric-templates`),
  quality:        ()       => apiService.get(`${BASE}/compliance/biometric-quality`),
};

const VERIFY_COLORS = { fingerprint: '#0078D4', face: '#52c41a', card: '#fa8c16', password: '#8c8c8c' };

const BiotimeAnalytics = () => {
  const [trendDays, setTrendDays] = useState(30);
  const [metricDays, setMetricDays] = useState(30);

  const { data: dashData, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ['bt-dashboard'],
    queryFn:  biotimeApi.dashboard,
    staleTime: 30000,
    retry: false,
  });
  const dash = dashData?.data ?? dashData ?? {};
  const overview = dash.overview ?? {};

  const { data: verifyData, isLoading: verifyLoading, refetch: refetchVerify } = useQuery({
    queryKey: ['bt-verify', metricDays],
    queryFn:  () => biotimeApi.verifyMetrics(metricDays),
    staleTime: 60000,
    retry: false,
  });
  const verify = verifyData?.data ?? verifyData ?? {};

  const { data: trendData, isLoading: trendLoading, refetch: refetchTrend } = useQuery({
    queryKey: ['bt-trends', trendDays],
    queryFn:  () => biotimeApi.usageTrends(trendDays),
    staleTime: 60000,
    retry: false,
  });
  const trends = trendData?.data ?? trendData ?? {};
  const dailyUsage = trends.daily_usage ?? {};

  const { data: deviceData, isLoading: deviceLoading, refetch: refetchDevices } = useQuery({
    queryKey: ['bt-devices', 7],
    queryFn:  () => biotimeApi.deviceActivity(7),
    staleTime: 60000,
    retry: false,
  });
  const devices = deviceData?.data ?? deviceData ?? {};

  const { data: qualityData, refetch: refetchQuality } = useQuery({
    queryKey: ['bt-quality'],
    queryFn:  biotimeApi.quality,
    staleTime: 60000,
    retry: false,
  });
  const quality = qualityData?.data ?? qualityData ?? {};

  const refetchAll = () => {
    refetchDash(); refetchVerify(); refetchTrend(); refetchDevices(); refetchQuality();
  };

  // Build hourly bar data from verify.hourly_distribution
  const hourlyData = Object.entries(verify.hourly_distribution ?? {})
    .map(([h, cnt]) => ({ hour: `${h.padStart(2, '0')}:00`, count: cnt }))
    .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  const maxHourly = Math.max(...hourlyData.map(d => d.count), 1);

  // Trend chart data — last 14 entries
  const trendEntries = Object.entries(dailyUsage)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14);
  const maxTrend = Math.max(...trendEntries.map(([, v]) => v), 1);

  // Verification type data for display
  const typeData = Object.entries(verify.verification_type_distribution ?? {})
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count);
  const totalVerify = typeData.reduce((s, d) => s + d.count, 0);

  // Device activity columns
  const deviceColumns = [
    {
      title: 'Device',
      dataIndex: 'name',
      ellipsis: true,
      render: (v, r) => (
        <>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>{r.terminal_sn}</div>
        </>
      ),
    },
    {
      title: 'Punches (7d)', dataIndex: 'punch_count', width: 120,
      sorter: (a, b) => a.punch_count - b.punch_count,
      defaultSortOrder: 'descend',
      render: v => <><ThunderboltOutlined style={{ color: '#0078D4', marginRight: 4 }} />{v.toLocaleString()}</>,
    },
    { title: 'Unique Employees', dataIndex: 'unique_employees', width: 140, render: v => <><TeamOutlined style={{ marginRight: 4 }} />{v}</> },
    {
      title: 'Last Seen', dataIndex: 'last_seen', width: 150,
      render: v => v ? dayjs(v).format('DD MMM HH:mm') : '—',
    },
  ];

  const alerts = dash.alerts ?? [];

  return (
    <div>
      {/* Alerts */}
      {alerts.length > 0 && alerts.map((a, i) => (
        <Alert key={i} type="warning" showIcon message={a} style={{ marginBottom: 8 }} closable />
      ))}

      {/* KPI row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: '#595959', fontSize: 13 }}>
          BioTime device analytics — live data from enrolled devices
        </span>
        <Button size="small" icon={<ReloadOutlined />} onClick={refetchAll} loading={dashLoading}>
          Refresh All
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Total Personnel"
              value={overview.total_personnel ?? 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#0078D4' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Biometric Enrolled"
              value={overview.biometric_enrolled ?? 0}
              suffix={<span style={{ fontSize: 12, color: '#52c41a' }}> {overview.enrollment_rate ?? 0}%</span>}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: overview.enrollment_rate >= 80 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Punches (24h)"
              value={overview.recent_activity_24h ?? 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#0078D4' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Total Transactions"
              value={(overview.total_transactions ?? 0).toLocaleString()}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#0078D4' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Online Devices"
              value={overview.online_devices ?? 0}
              suffix={<span style={{ fontSize: 12, color: '#8c8c8c' }}>/ {overview.total_devices ?? 0}</span>}
              prefix={<WifiOutlined />}
              valueStyle={{ color: (overview.online_devices ?? 0) === (overview.total_devices ?? 0) && (overview.total_devices ?? 0) > 0 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small">
            <Statistic
              title="Avg Daily Punches"
              value={verify.avg_daily_verifications ?? 0}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#0078D4' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Hourly punch distribution */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Hourly Punch Distribution</span>
                <Select
                  size="small"
                  value={metricDays}
                  onChange={setMetricDays}
                  style={{ width: 120 }}
                  options={[
                    { value: 7,  label: 'Last 7 days' },
                    { value: 30, label: 'Last 30 days' },
                    { value: 90, label: 'Last 90 days' },
                  ]}
                />
              </div>
            }
            loading={verifyLoading}
          >
            {hourlyData.length === 0 ? (
              <Empty description="No punch data" style={{ padding: '20px 0' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, padding: '8px 0' }}>
                {hourlyData.map(({ hour, count }) => {
                  const pct = Math.round((count / maxHourly) * 100);
                  const isDay = parseInt(hour) >= 7 && parseInt(hour) <= 18;
                  return (
                    <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div
                        title={`${hour}: ${count} punches`}
                        style={{
                          width: '100%',
                          height: `${Math.max(pct, 2)}%`,
                          background: isDay ? '#0078D4' : '#91b4e7',
                          borderRadius: '2px 2px 0 0',
                          minHeight: count > 0 ? 3 : 0,
                          cursor: 'default',
                        }}
                      />
                      {parseInt(hour) % 4 === 0 && (
                        <div style={{ fontSize: 9, color: '#8c8c8c', marginTop: 2 }}>{hour.slice(0, 2)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
              Total: <strong>{(verify.total_verifications ?? 0).toLocaleString()}</strong> punches over {metricDays} days
            </div>
          </Card>
        </Col>

        {/* Verification method breakdown */}
        <Col xs={24} lg={10}>
          <Card size="small" title="Verification Methods" loading={verifyLoading}>
            {typeData.length === 0 ? (
              <Empty description="No data" style={{ padding: '20px 0' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {typeData.map(({ method, count }) => {
                  const pct = totalVerify > 0 ? Math.round((count / totalVerify) * 100) : 0;
                  const color = VERIFY_COLORS[method] ?? '#8c8c8c';
                  return (
                    <div key={method}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{method}</span>
                        <span style={{ fontSize: 13, color: '#595959' }}>
                          {count.toLocaleString()} <span style={{ color: '#8c8c8c', fontSize: 11 }}>({pct}%)</span>
                        </span>
                      </div>
                      <Progress percent={pct} showInfo={false} strokeColor={color} size="small" />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Daily usage trend */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Daily Punch Trend</span>
                <Space size={8}>
                  <Select
                    size="small"
                    value={trendDays}
                    onChange={setTrendDays}
                    style={{ width: 120 }}
                    options={[
                      { value: 14, label: 'Last 14 days' },
                      { value: 30, label: 'Last 30 days' },
                      { value: 60, label: 'Last 60 days' },
                    ]}
                  />
                  {trends.trends && (
                    <Tag color={trends.trends.growth_trend_percent >= 0 ? 'green' : 'red'}>
                      {trends.trends.growth_trend_percent >= 0 ? '↑' : '↓'} {Math.abs(trends.trends.growth_trend_percent ?? 0)}% WoW
                    </Tag>
                  )}
                </Space>
              </div>
            }
            loading={trendLoading}
          >
            {trendEntries.length === 0 ? (
              <Empty description="No trend data" style={{ padding: '20px 0' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, padding: '8px 0' }}>
                {trendEntries.map(([day, count]) => {
                  const pct = Math.round((count / maxTrend) * 100);
                  return (
                    <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div
                        title={`${dayjs(day).format('DD MMM')}: ${count}`}
                        style={{
                          width: '100%',
                          height: `${Math.max(pct, 2)}%`,
                          background: '#0078D4',
                          borderRadius: '2px 2px 0 0',
                          opacity: 0.8,
                          cursor: 'default',
                        }}
                      />
                      <div style={{ fontSize: 9, color: '#8c8c8c', marginTop: 2 }}>
                        {dayjs(day).format('DD')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {trends.trends && (
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4, display: 'flex', gap: 16 }}>
                <span>Avg: <strong>{trends.trends.average_daily_usage}</strong></span>
                <span>Peak: <strong>{trends.trends.peak_daily_usage}</strong></span>
                <span>Min: <strong>{trends.trends.minimum_daily_usage}</strong></span>
              </div>
            )}
          </Card>
        </Col>

        {/* Biometric quality */}
        <Col xs={24} lg={10}>
          <Card size="small" title="Biometric Enrollment Quality">
            {!quality.total_personnel ? (
              <Empty description="No quality data" style={{ padding: '20px 0' }} />
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>Overall Enrollment</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: (quality.compliance_rate ?? 0) >= 80 ? '#52c41a' : '#faad14' }}>
                      {quality.compliance_rate ?? 0}%
                    </span>
                  </div>
                  <Progress
                    percent={quality.compliance_rate ?? 0}
                    showInfo={false}
                    strokeColor={(quality.compliance_rate ?? 0) >= 80 ? '#52c41a' : '#faad14'}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Both modalities', key: 'both_modalities', color: '#0078D4' },
                    { label: 'Fingerprint only', key: 'fingerprint_only', color: '#52c41a' },
                    { label: 'Face only',        key: 'face_only',       color: '#fa8c16' },
                    { label: 'Not enrolled',     key: 'not_enrolled',    color: '#ff4d4f' },
                  ].map(({ label, key, color }) => {
                    const val = quality.quality_distribution?.[key] ?? 0;
                    const total = quality.total_personnel ?? 1;
                    return (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                          <span style={{ fontSize: 12, color: '#595959' }}>{label}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {val} <span style={{ color: '#8c8c8c', fontWeight: 400 }}>({Math.round((val / total) * 100)}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {quality.recommendations?.length > 0 && (
                  <>
                    <Divider style={{ margin: '10px 0' }} />
                    {quality.recommendations.map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#faad14', marginBottom: 4 }}>
                        ⚠ {r}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </Card>
        </Col>

        {/* Device activity table */}
        <Col xs={24}>
          <Card
            size="small"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Device Activity (Last 7 Days)</span>
                <Button size="small" icon={<ReloadOutlined />} onClick={refetchDevices} loading={deviceLoading} />
              </div>
            }
          >
            <Table
              dataSource={(devices.device_usage ?? []).map((d, i) => ({ ...d, key: i }))}
              columns={deviceColumns}
              size="small"
              loading={deviceLoading}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: <Empty description="No device activity in last 7 days" /> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default BiotimeAnalytics;
