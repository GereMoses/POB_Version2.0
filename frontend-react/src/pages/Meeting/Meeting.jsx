import React, { useState } from 'react';
import { Tabs, Row, Col, Card, Badge } from 'antd';
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
  const pending = stats.pending_approvals ?? 0;
  const active  = stats.active_meetings ?? 0;

  const tabItems = [
    { key: 'rooms',     label: <span><AppstoreOutlined /> Rooms</span>,        children: <RoomManagement onSchedule={() => setActiveTab('bookings')} /> },
    { key: 'bookings',  label: <span><CalendarOutlined /> Bookings</span>,     children: <BookingManagement /> },
    { key: 'checkin',   label: <span><LoginOutlined /> Check-In</span>,        children: <CheckInKiosk /> },
    { key: 'approval',  label: <span><CheckCircleOutlined /> Approval {pending > 0 && <Badge count={pending} size="small" style={{ marginLeft: 6 }} />}</span>, children: <MeetingApproval /> },
    { key: 'minutes',   label: <span><FileTextOutlined /> Minutes</span>,      children: <MeetingMinutes /> },
    { key: 'equipment', label: <span><ToolOutlined /> Equipment</span>,        children: <EquipmentManagement /> },
    { key: 'reports',   label: <span><BarChartOutlined /> Reports</span>,      children: <MeetingReports /> },
  ];

  const kpis = [
    { label: 'Total Rooms',      value: stats.total_rooms     ?? 0, color: '#2563eb', bg: '#eff6ff', icon: <HomeOutlined /> },
    { label: 'Available Now',    value: stats.available_rooms ?? 0, color: '#16a34a', bg: '#f0fdf4', icon: <SafetyOutlined /> },
    { label: "Today's Bookings", value: stats.today_bookings  ?? 0, color: '#7c3aed', bg: '#ede9fe', icon: <CalendarOutlined /> },
    { label: 'Pending Approval', value: pending,                    color: '#d97706', bg: '#fffbeb', icon: <ClockCircleOutlined /> },
    { label: 'Active Now',       value: active,                     color: '#0891b2', bg: '#ecfeff', icon: <TeamOutlined /> },
  ];

  return (
    <div className="meeting-module" style={{ padding: 24 }}>
      <Card
        title={
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Meeting Management</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
              Room booking, approvals, check-in, minutes, equipment and utilization reports
            </div>
          </div>
        }
        styles={{ header: { overflow: 'visible' } }}
      >
        {/* Stat cards */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {kpis.map(s => (
            <Col flex="1 1 160px" key={s.label}>
              <div style={{
                background: '#fff', borderRadius: 12, padding: '14px 16px',
                border: `1px solid ${s.label === 'Pending Approval' && pending > 0 ? '#fde68a' : '#e2e8f0'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: s.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 18,
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* Themed tabs container */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} type="line" items={tabItems} size="small" style={{ padding: '0 16px' }} />
        </div>
      </Card>

      <style>{`
        .meeting-module .ant-table-thead > tr > th {
          background: #f8fafc !important;
          color: #64748b !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
        .meeting-module .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 10px 12px !important;
        }
        .meeting-module .ant-table-tbody > tr:last-child > td { border-bottom: none !important; }
        .meeting-module .ant-tabs-nav { margin-bottom: 0 !important; }
      `}</style>
    </div>
  );
};

export default Meeting;
