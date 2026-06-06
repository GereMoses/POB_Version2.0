import React from 'react';
import { Tabs, Card, Statistic, Row, Col, Typography, Spin } from 'antd';
import {
  UserOutlined, UserAddOutlined, LoginOutlined, LogoutOutlined,
  UnorderedListOutlined, StopOutlined, CheckCircleOutlined,
  SettingOutlined, FileTextOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import visitorAPI from '../../services/visitorAPI';

import VisitorProfiles  from './components/VisitorProfiles';
import PreRegistration  from './components/PreRegistration';
import CheckIn          from './components/CheckIn';
import CheckOut         from './components/CheckOut';
import VisitorRecords   from './components/VisitorRecords';
import Blacklist        from './components/Blacklist';
import HostApproval     from './components/HostApproval';
import VisitorTypes     from './components/VisitorTypes';
import Reports          from './components/Reports';

const { Title } = Typography;

const Visitor = () => {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['visitor-stats'],
    queryFn:  () => visitorAPI.getDashboardStats(),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const stats = statsData?.data ?? {};

  const tabItems = [
    { key: 'visitors',      label: <span><UserOutlined />Visitors</span>,          children: <VisitorProfiles /> },
    { key: 'pre-register',  label: <span><UserAddOutlined />Pre-Registration</span>, children: <PreRegistration /> },
    { key: 'check-in',      label: <span><LoginOutlined />Check-In</span>,         children: <CheckIn /> },
    { key: 'check-out',     label: <span><LogoutOutlined />Check-Out</span>,       children: <CheckOut /> },
    { key: 'records',       label: <span><UnorderedListOutlined />Visit Records</span>, children: <VisitorRecords /> },
    { key: 'blacklist',     label: <span><StopOutlined />Blacklist</span>,         children: <Blacklist /> },
    { key: 'approval',      label: <span><CheckCircleOutlined />Host Approval</span>, children: <HostApproval /> },
    { key: 'types',         label: <span><SettingOutlined />Visitor Types</span>,  children: <VisitorTypes /> },
    { key: 'reports',       label: <span><FileTextOutlined />Reports</span>,       children: <Reports /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 16 }}>Visitor Management</Title>

      <Spin spinning={statsLoading}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          {[
            { title: 'Total Visitors',    value: stats.total_visitors  ?? 0, color: '#1677ff', prefix: <UserOutlined /> },
            { title: 'On Site',           value: stats.on_site         ?? 0, color: '#52c41a', prefix: <LoginOutlined /> },
            { title: 'Pending Approval',  value: stats.pending_approval ?? 0, color: '#faad14', prefix: <CheckCircleOutlined /> },
            { title: 'Blacklisted',       value: stats.blacklisted     ?? 0, color: '#ff4d4f', prefix: <StopOutlined /> },
            { title: "Today's Check-ins", value: stats.today_checkins  ?? 0, color: '#722ed1', prefix: <TeamOutlined /> },
          ].map(({ title, value, color, prefix }) => (
            <Col span={4} key={title}>
              <Card size="small">
                <Statistic title={title} value={value} prefix={prefix} valueStyle={{ color }} />
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      <Card>
        <Tabs items={tabItems} size="small" />
      </Card>
    </div>
  );
};

export default Visitor;
