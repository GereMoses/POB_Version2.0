import React from 'react';
import { Tabs, Card, Row, Col, Badge } from 'antd';
import {
  UserOutlined, UserAddOutlined, LoginOutlined, LogoutOutlined,
  UnorderedListOutlined, StopOutlined, CheckCircleOutlined,
  SettingOutlined, FileTextOutlined, TeamOutlined,
  MonitorOutlined, BarChartOutlined, WarningOutlined,
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
import OnSiteMonitor    from './components/OnSiteMonitor';
import VisitorAnalytics from './components/VisitorAnalytics';

const Visitor = () => {
  const { data: statsData } = useQuery({
    queryKey: ['visitor-stats'],
    queryFn:  () => visitorAPI.getDashboardStats(),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const stats = statsData?.data ?? {};
  const pending = stats.pending_approval ?? 0;
  const onSite  = stats.on_site ?? 0;

  const tabItems = [
    { key: 'on-site',     label: <span><MonitorOutlined /> On-Site Monitor {onSite > 0 && <Badge count={onSite} size="small" style={{ marginLeft: 6 }} />}</span>, children: <OnSiteMonitor /> },
    { key: 'check-in',    label: <span><LoginOutlined /> Check-In</span>,             children: <CheckIn /> },
    { key: 'check-out',   label: <span><LogoutOutlined /> Check-Out</span>,           children: <CheckOut /> },
    { key: 'visitors',    label: <span><UserOutlined /> Visitors</span>,              children: <VisitorProfiles /> },
    { key: 'pre-register',label: <span><UserAddOutlined /> Pre-Registration</span>,   children: <PreRegistration /> },
    { key: 'records',     label: <span><UnorderedListOutlined /> Visit Records</span>,children: <VisitorRecords /> },
    { key: 'approval',    label: <span><CheckCircleOutlined /> Host Approval {pending > 0 && <Badge count={pending} size="small" style={{ marginLeft: 6 }} />}</span>, children: <HostApproval /> },
    { key: 'blacklist',   label: <span><StopOutlined /> Blacklist</span>,             children: <Blacklist /> },
    { key: 'analytics',   label: <span><BarChartOutlined /> Analytics</span>,         children: <VisitorAnalytics /> },
    { key: 'reports',     label: <span><FileTextOutlined /> Reports</span>,           children: <Reports /> },
    { key: 'types',       label: <span><SettingOutlined /> Visitor Types</span>,      children: <VisitorTypes /> },
  ];

  const kpis = [
    { label: 'Total Visitors',    value: stats.total_visitors   ?? 0, color: '#2563eb', bg: '#eff6ff', icon: <UserOutlined /> },
    { label: 'On Site',           value: onSite,                      color: '#16a34a', bg: '#f0fdf4', icon: <MonitorOutlined /> },
    { label: 'Pending Approval',  value: pending,                     color: '#d97706', bg: '#fffbeb', icon: <CheckCircleOutlined /> },
    { label: "Today's Check-ins", value: stats.today_checkins   ?? 0, color: '#7c3aed', bg: '#ede9fe', icon: <TeamOutlined /> },
    { label: 'Overstay',          value: stats.overstay_count   ?? 0, color: '#c2410c', bg: '#ffedd5', icon: <WarningOutlined /> },
    { label: 'Blacklisted',       value: stats.blacklisted      ?? 0, color: '#dc2626', bg: '#fef2f2', icon: <StopOutlined /> },
  ];

  return (
    <div className="visitor-module" style={{ padding: 24 }}>
      <Card
        title={
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Visitor Management</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
              Pre-registration, host approval, check-in/out, mustering and on-site monitoring
            </div>
          </div>
        }
        styles={{ header: { overflow: 'visible' } }}
      >
        {/* Stat cards */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {kpis.map(s => (
            <Col xs={12} sm={8} md={4} key={s.label}>
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
          <Tabs items={tabItems} size="small" defaultActiveKey="on-site" style={{ padding: '0 16px' }} />
        </div>
      </Card>

      <style>{`
        .visitor-module .ant-table-thead > tr > th {
          background: #f8fafc !important;
          color: #64748b !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
        .visitor-module .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 10px 12px !important;
        }
        .visitor-module .ant-table-tbody > tr:last-child > td { border-bottom: none !important; }
        .visitor-module .ant-tabs-nav { margin-bottom: 0 !important; }
        .visitor-module .ant-table-expanded-row > td { padding: 0 !important; }
        .visitor-module .row-blacklisted { background: rgba(220,38,38,0.04) !important; }
        .visitor-module .row-blacklisted:hover > td { background: rgba(220,38,38,0.08) !important; }
      `}</style>
    </div>
  );
};

export default Visitor;
