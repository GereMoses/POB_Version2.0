import React, { useState } from 'react';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import {
  Row, Col, Card, Statistic, Badge, Table, Typography, DatePicker, Empty,
  Spin, Tag, Space, Tooltip, Collapse, Avatar, Divider, Segmented,
} from 'antd';
import {
  TeamOutlined, ClockCircleOutlined, EnvironmentOutlined,
  LoginOutlined, LogoutOutlined, WifiOutlined, CalendarOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../../services/api';

dayjs.extend(duration);

const { Text, Title } = Typography;

const VERIFY_LABELS = { 0: 'Password', 1: 'Fingerprint', 2: 'Face', 3: 'Card' };
const VERIFY_COLORS = { 0: 'default', 1: 'blue', 2: 'purple', 3: 'cyan' };

function fmtDuration(minutes) {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return dayjs(iso).format('HH:mm');
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return dayjs(iso).format('HH:mm:ss');
}

/* ── Area summary card ─────────────────────────────────────────────── */
function AreaCard({ area, selected, onClick }) {
  const hasActivity = area.punch_count > 0;
  const borderColor = selected ? '#1890ff' : hasActivity ? '#52c41a' : '#d9d9d9';

  return (
    <Card
      size="small"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderTop: `3px solid ${borderColor}`,
        boxShadow: selected ? '0 0 0 2px #1890ff40' : undefined,
        transition: 'box-shadow .15s',
      }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text strong style={{ fontSize: 13 }}>{area.area_name}</Text>
          {area.reader_count > 0
            ? <Tag icon={<WifiOutlined />} color="blue" style={{ fontSize: 11 }}>{area.reader_count} reader{area.reader_count !== 1 ? 's' : ''}</Tag>
            : <Tag color="default" style={{ fontSize: 11 }}>No readers</Tag>}
        </div>

        <Row gutter={8}>
          <Col span={8}>
            <Statistic
              title={<span style={{ fontSize: 11, color: '#8c8c8c' }}>Present</span>}
              value={area.present_count}
              valueStyle={{ fontSize: 22, color: area.present_count > 0 ? '#52c41a' : '#bfbfbf' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span style={{ fontSize: 11, color: '#8c8c8c' }}>Punches</span>}
              value={area.punch_count}
              valueStyle={{ fontSize: 22, color: '#1890ff' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<span style={{ fontSize: 11, color: '#8c8c8c' }}>Employees</span>}
              value={area.employee_count}
              valueStyle={{ fontSize: 22, color: '#595959' }}
            />
          </Col>
        </Row>

        {area.last_activity && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            Last punch {dayjs(area.last_activity).fromNow ? dayjs(area.last_activity).format('HH:mm') : fmtTime(area.last_activity)}
          </Text>
        )}
      </Space>
    </Card>
  );
}

/* ── Main component ────────────────────────────────────────────────── */
export default function AreaAttendanceTab() {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedArea, setSelectedArea] = useState(null);
  const [sortBy, setSortBy] = useState('present');

  const dateStr = selectedDate.format('YYYY-MM-DD');
  // Pass the browser's UTC offset (minutes) so the backend uses the correct local day window.
  // e.g. Nigeria WAT = UTC+1 → tzOffset = 60
  const tzOffset = dayjs().utcOffset();

  /* Summary — all areas */
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['area-attendance-summary', dateStr, tzOffset],
    queryFn: () => apiService.get(`/api/v1/attendance/areas/?date=${dateStr}&tz_offset=${tzOffset}`),
    refetchInterval: 30000,
    staleTime: 20000,
  });

  /* Current personnel for selected area */
  const { data: currentData, isLoading: currentLoading } = useQuery({
    queryKey: ['area-current-personnel', selectedArea?.area_id, dateStr, tzOffset],
    queryFn: () => apiService.get(`/api/v1/attendance/areas/${selectedArea.area_id}/current-personnel?date=${dateStr}&tz_offset=${tzOffset}`),
    enabled: !!selectedArea,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  /* Timesheet for selected area */
  const { data: timesheetData, isLoading: timesheetLoading } = useQuery({
    queryKey: ['area-timesheet', selectedArea?.area_id, dateStr, tzOffset],
    queryFn: () => apiService.get(`/api/v1/attendance/areas/${selectedArea.area_id}/timesheet?date=${dateStr}&tz_offset=${tzOffset}`),
    enabled: !!selectedArea,
    staleTime: 20000,
  });

  const areas = (summaryData?.areas || []).slice().sort((a, b) => {
    if (sortBy === 'present') return b.present_count - a.present_count;
    if (sortBy === 'punches') return b.punch_count - a.punch_count;
    return a.area_name.localeCompare(b.area_name);
  });
  const present = currentData?.present || [];
  const records = timesheetData?.records || [];

  const handleAreaClick = (area) => {
    setSelectedArea(prev => prev?.area_id === area.area_id ? null : area);
  };

  /* Timesheet table columns */
  const timesheetCols = [
    {
      title: 'Employee',
      key: 'name',
      render: (_, r) => {
        const stillIn = !r.last_checkout;
        return (
          <Space size={8}>
            <Avatar size={28} style={{ background: '#1890ff', fontSize: 12 }}>
              {(r.name || r.emp_code)[0].toUpperCase()}
            </Avatar>
            <div>
              <Space size={6}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{r.name || r.emp_code}</span>
                {stillIn && <Tag color="success" style={{ fontSize: 10, lineHeight: '16px', padding: '0 5px', margin: 0 }}>Present</Tag>}
              </Space>
              {r.position && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.position}</div>}
            </div>
          </Space>
        );
      },
    },
    {
      title: 'First Seen',
      key: 'first_checkin',
      width: 90,
      render: (_, r) => (
        <Space size={4}>
          <LoginOutlined style={{ color: '#52c41a', fontSize: 12 }} />
          <Text style={{ fontSize: 13 }}>{fmtTime(r.first_checkin || r.first_punch)}</Text>
        </Space>
      ),
    },
    {
      title: 'Last Seen',
      key: 'last_checkout',
      width: 90,
      render: (_, r) => {
        const t = r.last_checkout || r.last_punch;
        const isOut = !!r.last_checkout;
        return t
          ? <Space size={4}>
              {isOut
                ? <LogoutOutlined style={{ color: '#f5222d', fontSize: 12 }} />
                : <ClockCircleOutlined style={{ color: '#1890ff', fontSize: 12 }} />}
              <Text style={{ fontSize: 13 }}>{fmtTime(t)}</Text>
            </Space>
          : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Duration',
      dataIndex: 'duration_minutes',
      key: 'duration',
      width: 80,
      render: v => <Text style={{ fontSize: 13 }}>{fmtDuration(v)}</Text>,
    },
    {
      title: 'Punches',
      dataIndex: 'punch_count',
      key: 'punches',
      width: 70,
      align: 'center',
      render: v => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Readers',
      dataIndex: 'readers_used',
      key: 'readers',
      ellipsis: true,
      render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
  ];

  /* Current personnel table columns */
  const currentCols = [
    {
      title: 'Employee',
      key: 'name',
      render: (_, r) => (
        <Space size={8}>
          <Avatar size={28} style={{ background: '#52c41a', fontSize: 12 }}>
            {(r.name || r.emp_code)[0].toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name || r.emp_code}</div>
            {r.position && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.position}</div>}
          </div>
        </Space>
      ),
    },
    {
      title: 'Checked in',
      dataIndex: 'punch_time',
      key: 'punch_time',
      width: 90,
      render: v => <Text style={{ fontSize: 13 }}>{fmtDateTime(v)}</Text>,
    },
    {
      title: 'Method',
      dataIndex: 'verify_type',
      key: 'verify_type',
      width: 110,
      render: v => <Tag color={VERIFY_COLORS[v] || 'default'}>{VERIFY_LABELS[v] || `Type ${v}`}</Tag>,
    },
    {
      title: 'Reader',
      dataIndex: 'terminal_alias',
      key: 'terminal',
      render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
  ];

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <EnvironmentOutlined style={{ color: '#1890ff', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>Area Attendance</Title>
          {selectedArea && (
            <>
              <Text type="secondary">/</Text>
              <Text strong style={{ color: '#1890ff' }}>{selectedArea.area_name}</Text>
            </>
          )}
        </Space>
        <Space size={8}>
          <Segmented
            size="small"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { label: 'Present', value: 'present' },
              { label: 'Punches', value: 'punches' },
              { label: 'A–Z',     value: 'name'    },
            ]}
            prefix={<SortAscendingOutlined style={{ fontSize: 12 }} />}
          />
          <DatePicker
            value={selectedDate}
            onChange={d => { setSelectedDate(d || dayjs()); setSelectedArea(null); }}
            disabledDate={d => d.isAfter(dayjs(), 'day')}
            allowClear={false}
            size="small"
            format="DD MMM YYYY"
            suffixIcon={<CalendarOutlined />}
          />
        </Space>
      </div>

      {/* Area cards */}
      <Spin spinning={summaryLoading}>
        {areas.length === 0 && !summaryLoading
          ? <Empty description="No areas configured. Assign readers to areas in the Devices section." />
          : (
            <Row gutter={[12, 12]} style={{ marginBottom: selectedArea ? 20 : 0 }}>
              {areas.map(area => (
                <Col key={area.area_id} xs={24} sm={12} md={8} lg={6}>
                  <AreaCard
                    area={area}
                    selected={selectedArea?.area_id === area.area_id}
                    onClick={() => handleAreaClick(area)}
                  />
                </Col>
              ))}
            </Row>
          )
        }
      </Spin>

      {/* Detail panel — shown when an area is selected */}
      {selectedArea && (
        <>
          <Divider style={{ margin: '16px 0' }} />

          <Row gutter={16}>
            {/* Left: currently present */}
            <Col xs={24} lg={10}>
              <Card
                size="small"
                title={
                  <Space>
                    <Badge status="processing" color="green" />
                    <Text strong>Currently Present</Text>
                    <Tag color="green">{present.length}</Tag>
                  </Space>
                }
                styles={{ body: { padding: 0 } }}
                extra={<Text type="secondary" style={{ fontSize: 11 }}>last punch = check-in</Text>}
              >
                <Spin spinning={currentLoading}>
                  {present.length === 0 && !currentLoading
                    ? <Empty style={{ padding: 24 }} description="Nobody currently checked in" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    : (
                      <Table
                        dataSource={present}
                        columns={currentCols}
                        rowKey="emp_code"
                        size="small"
                        pagination={present.length > 10 ? { pageSize: 10, size: 'small', showSizeChanger: false } : false}
                        scroll={{ x: true }}
                      />
                    )
                  }
                </Spin>
              </Card>
            </Col>

            {/* Right: timesheet */}
            <Col xs={24} lg={14}>
              <Card
                size="small"
                title={
                  <Space>
                    <TeamOutlined />
                    <Text strong>Daily Timesheet — {selectedDate.format('DD MMM YYYY')}</Text>
                    <Tag color="blue">{records.length} employees</Tag>
                  </Space>
                }
                styles={{ body: { padding: 0 } }}
              >
                <Spin spinning={timesheetLoading}>
                  {records.length === 0 && !timesheetLoading
                    ? <Empty style={{ padding: 24 }} description="No activity on this date" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    : (
                      <Table
                        dataSource={records}
                        columns={timesheetCols}
                        rowKey="emp_code"
                        size="small"
                        pagination={records.length > 15 ? { pageSize: 15, size: 'small', showSizeChanger: false } : false}
                        scroll={{ x: true }}
                      />
                    )
                  }
                </Spin>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
