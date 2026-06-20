import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tabs, Spin, Typography, Row, Col, Button,
  Badge, Tooltip, Alert, Card, Space,
} from 'antd';
import {
  SettingOutlined, SyncOutlined, FunctionOutlined, CalendarOutlined,
  CalculatorOutlined, FileTextOutlined, BankOutlined, BarChartOutlined,
  DollarOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined,
  TeamOutlined, SafetyOutlined,
} from '@ant-design/icons';
import StructureTab from './tabs/StructureTab';
import AttendanceMappingTab from './tabs/AttendanceMappingTab';
import FormulaTab from './tabs/FormulaTab';
import PeriodsTab from './tabs/PeriodsTab';
import CalculationTab from './tabs/CalculationTab';
import PayslipTab from './tabs/PayslipTab';
import BankSheetTab from './tabs/BankSheetTab';
import ReportsTab from './tabs/ReportsTab';
import LoansTab from './tabs/LoansTab';
import POBExtensionsTab from './tabs/POBExtensionsTab';
import { apiCall } from './payrollApi';
import './Payroll.css';

const { Title, Text } = Typography;

const Payroll = () => {
  const [activeTab, setActiveTab] = useState('structures');
  const [periods, setPeriods] = useState([]);
  const [structures, setStructures] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingShared, setLoadingShared] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSharedData = useCallback(async (silent = false) => {
    if (!silent) setLoadingShared(true);
    else setRefreshing(true);
    try {
      const [periodsResult, structuresResult, empResult] = await Promise.allSettled([
        apiCall('/api/v1/payroll/periods/'),
        apiCall('/api/v1/payroll/structures/'),
        apiCall('/api/v1/personnel/?is_active=true&limit=1000'),
      ]);

      if (periodsResult.status === 'fulfilled') {
        setPeriods(Array.isArray(periodsResult.value) ? periodsResult.value : []);
      }
      if (structuresResult.status === 'fulfilled') {
        setStructures(Array.isArray(structuresResult.value) ? structuresResult.value : []);
      }
      if (empResult.status === 'fulfilled') {
        const val = empResult.value;
        setEmployees(Array.isArray(val) ? val : (val?.results ?? []));
      }
    } finally {
      setLoadingShared(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSharedData(); }, [loadSharedData]);

  // Derive unique departments from employees — avoids a separate API call
  const departments = useMemo(() => {
    const seen = new Map();
    for (const e of employees) {
      if (e.department_id && !seen.has(e.department_id)) {
        seen.set(e.department_id, { id: e.department_id, name: e.department || e.dept_name || `Dept ${e.department_id}` });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const openPeriods = periods.filter(p => p.status === 'open');
  const closedPeriods = periods.filter(p => p.status === 'closed');

  const tabItems = [
    {
      key: 'structures',
      label: <span className="payroll-tab-label"><SettingOutlined /> Salary Structures</span>,
      children: <StructureTab structures={structures} employees={employees} onRefresh={() => loadSharedData(true)} />,
    },
    {
      key: 'attendance',
      label: <span className="payroll-tab-label"><SyncOutlined /> Attendance Mapping</span>,
      children: <AttendanceMappingTab />,
    },
    {
      key: 'formula',
      label: <span className="payroll-tab-label"><FunctionOutlined /> Formula Lab</span>,
      children: <FormulaTab structures={structures} />,
    },
    {
      key: 'period',
      label: (
        <span className="payroll-tab-label">
          <CalendarOutlined /> Pay Periods
          {openPeriods.length > 0 && (
            <Badge count={openPeriods.length} size="small" style={{ marginLeft: 6, backgroundColor: '#1677ff' }} />
          )}
        </span>
      ),
      children: <PeriodsTab periods={periods} onRefresh={() => loadSharedData(true)} />,
    },
    {
      key: 'calculation',
      label: <span className="payroll-tab-label"><CalculatorOutlined /> Calculation</span>,
      children: <CalculationTab periods={periods} employees={employees} departments={departments} />,
    },
    {
      key: 'payslip',
      label: <span className="payroll-tab-label"><FileTextOutlined /> Payslips</span>,
      children: <PayslipTab periods={periods} employees={employees} />,
    },
    {
      key: 'bank',
      label: <span className="payroll-tab-label"><BankOutlined /> Bank Sheet</span>,
      children: <BankSheetTab periods={periods} />,
    },
    {
      key: 'reports',
      label: <span className="payroll-tab-label"><BarChartOutlined /> Reports</span>,
      children: <ReportsTab periods={periods} />,
    },
    {
      key: 'loans',
      label: <span className="payroll-tab-label"><DollarOutlined /> Loans</span>,
      children: <LoansTab employees={employees} />,
    },
    {
      key: 'pob',
      label: <span className="payroll-tab-label"><SafetyOutlined /> POB Config</span>,
      children: <POBExtensionsTab structures={structures} />,
    },
  ];

  if (loadingShared) {
    return (
      <div className="payroll-loading-screen">
        {/* Spin tip requires a child (nest pattern) in Ant Design v5 */}
        <Spin size="large">
          <div style={{ width: 120, height: 60 }} />
        </Spin>
        <Text type="secondary" style={{ marginTop: 16 }}>Loading payroll module…</Text>
      </div>
    );
  }

  return (
    <div className="payroll-module">
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Payroll Management</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                BioTime 9.5 · POB Oil &amp; Gas Extensions
              </div>
            </div>
            <Space size="middle" style={{ overflow: 'visible' }}>
              <Badge count={employees.length} showZero color="#1677ff">
                <TeamOutlined style={{ fontSize: 16 }} />
              </Badge>
              <Badge count={structures.filter(s => s.is_active).length} showZero color="#52c41a">
                <SettingOutlined style={{ fontSize: 16 }} />
              </Badge>
              <Badge count={openPeriods.length} showZero color="#d97706">
                <ClockCircleOutlined style={{ fontSize: 16 }} />
              </Badge>
              <Button icon={<ReloadOutlined />} onClick={() => loadSharedData(true)} loading={refreshing} size="small">
                Refresh
              </Button>
            </Space>
          </div>
        }
        styles={{ header: { overflow: 'visible' } }}
      >
        {/* ── Stat cards ── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #f0f0f0', borderTop: '3px solid #1677ff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}><TeamOutlined /> Employees</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1677ff', lineHeight: 1.2, marginTop: 4 }}>{employees.length.toLocaleString()}</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #f0f0f0', borderTop: '3px solid #52c41a', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}><SettingOutlined /> Active Structures</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#52c41a', lineHeight: 1.2, marginTop: 4 }}>{structures.filter(s => s.is_active).length}</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: `1px solid ${openPeriods.length > 0 ? '#fde68a' : '#f0f0f0'}`, borderTop: `3px solid ${openPeriods.length > 0 ? '#d97706' : '#94a3b8'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}><ClockCircleOutlined /> Open Periods</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: openPeriods.length > 0 ? '#d97706' : '#94a3b8', lineHeight: 1.2, marginTop: 4 }}>
                {openPeriods.length}
                {openPeriods[0] && <span style={{ fontSize: 12, marginLeft: 8, fontWeight: 400, color: '#64748b' }}>{openPeriods[0].period_name}</span>}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #f0f0f0', borderTop: '3px solid #16a34a', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}><CheckCircleOutlined /> Closed Periods</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#16a34a', lineHeight: 1.2, marginTop: 4 }}>{closedPeriods.length}</div>
            </div>
          </Col>
        </Row>

        {openPeriods.length === 0 && periods.length > 0 && (
          <Alert
            style={{ marginBottom: 16, borderRadius: 6 }}
            type="warning"
            showIcon
            message="No open pay periods — create one before running calculations."
            action={<Button size="small" onClick={() => setActiveTab('period')}>Go to Periods</Button>}
          />
        )}

        {/* ── Tabs ── */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="middle"
          type="card"
          className="payroll-main-tabs"
          destroyOnHidden={false}
        />
      </Card>
    </div>
  );
};

export default Payroll;
