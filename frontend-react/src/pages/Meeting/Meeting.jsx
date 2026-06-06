import React, { useState } from 'react';
import { Tabs, Statistic, Row, Col, Card, Badge } from 'antd';
import {
  AppstoreOutlined, CalendarOutlined, LoginOutlined, CheckCircleOutlined,
  FileTextOutlined, ToolOutlined, BarChartOutlined,
  HomeOutlined, TeamOutlined, ClockCircleOutlined, SafetyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import meetingApi from '../../services/meetingApi';

import RoomManagement     from './components/RoomManagement';
import BookingManagement  from './components/BookingManagement';
import CheckInKiosk       from './components/CheckInKiosk';
import MeetingApproval    from './components/MeetingApproval';
import MeetingMinutes     from './components/MeetingMinutes';
import EquipmentManagement from './components/EquipmentManagement';
import MeetingReports     from './components/MeetingReports';

const Meeting = () => {
  const [activeTab, setActiveTab] = useState('rooms');

  const { data: statsData } = useQuery({
    queryKey: ['meeting-stats'],
    queryFn:  () => meetingApi.getDashboardStats(),
    staleTime: 30000,
    refetchInterval: 30000,
  });
  const stats = statsData?.data ?? {};

  const tabItems = [
    {
      key: 'rooms',
      label: <span><AppstoreOutlined style={{ marginRight: 6 }} />Rooms</span>,
      children: <RoomManagement onSchedule={() => setActiveTab('bookings')} />,
    },
    {
      key: 'bookings',
      label: <span><CalendarOutlined style={{ marginRight: 6 }} />Bookings</span>,
      children: <BookingManagement />,
    },
    {
      key: 'checkin',
      label: <span><LoginOutlined style={{ marginRight: 6 }} />Check-In</span>,
      children: <CheckInKiosk />,
    },
    {
      key: 'approval',
      label: (
        <span>
          <CheckCircleOutlined style={{ marginRight: 6 }} />
          <Badge count={stats.pending_approvals ?? 0} size="small" offset={[6, -2]}>
            Approval
          </Badge>
        </span>
      ),
      children: <MeetingApproval />,
    },
    {
      key: 'minutes',
      label: <span><FileTextOutlined style={{ marginRight: 6 }} />Minutes</span>,
      children: <MeetingMinutes />,
    },
    {
      key: 'equipment',
      label: <span><ToolOutlined style={{ marginRight: 6 }} />Equipment</span>,
      children: <EquipmentManagement />,
    },
    {
      key: 'reports',
      label: <span><BarChartOutlined style={{ marginRight: 6 }} />Reports</span>,
      children: <MeetingReports />,
    },
  ];

  return (
    <div>
      {/* KPI row — same pattern as Dashboard */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={24 / 5}>
          <Card>
            <Statistic
              title="Total Rooms"
              value={stats.total_rooms ?? 0}
              prefix={<HomeOutlined />}
              valueStyle={{ color: '#0078D4' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={24 / 5}>
          <Card>
            <Statistic
              title="Available Now"
              value={stats.available_rooms ?? 0}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={24 / 5}>
          <Card>
            <Statistic
              title="Today's Bookings"
              value={stats.today_bookings ?? 0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#0078D4' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={24 / 5}>
          <Card>
            <Statistic
              title="Pending Approval"
              value={stats.pending_approvals ?? 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: stats.pending_approvals > 0 ? '#faad14' : '#0078D4' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={24 / 5}>
          <Card>
            <Statistic
              title="Active Now"
              value={stats.active_meetings ?? 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: stats.active_meetings > 0 ? '#52c41a' : '#0078D4' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main tabs */}
      <Card styles={{ body: { padding: '0 24px 24px' } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="line"
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default Meeting;
