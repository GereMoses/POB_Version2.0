import React, { useState } from 'react';
import {
  Tabs, Button, Space, Tooltip, Table, Tag, Row, Col,
  Empty, Spin, Card, Progress, Badge,
} from 'antd';
import {
  MedicineBoxOutlined, SafetyCertificateOutlined, ToolOutlined,
  BookOutlined, CalendarOutlined, BarChartOutlined,
  ReloadOutlined, DownloadOutlined, BellOutlined,
  CheckCircleOutlined, CloseCircleOutlined, TeamOutlined,
  ClockCircleOutlined, FileTextOutlined, AlertOutlined, UserOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import MedicalRecords from './components/MedicalRecords';
import TrainingCertifications from './components/TrainingCertifications';
import PPEManagement from './components/PPEManagement';
import SafetyInduction from './components/SafetyInduction';
import ExpiryDashboard from './components/ExpiryDashboard';
import ComplianceReports from './components/ComplianceReports';

dayjs.extend(relativeTime);

/* ─── Helpers ─────────────────────────────────────────────────── */
const pct  = v => Math.min(100, Math.max(0, Math.round(v ?? 0)));
const compColor = v => v >= 95 ? '#52c41a' : v >= 80 ? '#faad14' : '#ff4d4f';
const diffDays  = d => dayjs(d).diff(dayjs(), 'day');

/* ─── GradStat tile ───────────────────────────────────────────── */
const GradStat = ({ label, value, sub, icon, from, to }) => (
  <div style={{
    borderRadius: 14, padding: '16px 20px',
    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    boxShadow: `0 4px 18px ${from}55`, position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', right: -8, top: -8, width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
    <div style={{ color: 'white', fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{value ?? '—'}</div>
    {sub && <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 3 }}>{sub}</div>}
    <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 26, color: 'rgba(255,255,255,0.12)' }}>{icon}</div>
  </div>
);

/* ─── CompRing ────────────────────────────────────────────────── */
const CompRing = ({ label, val, color, sub }) => (
  <div style={{ textAlign: 'center' }}>
    <Progress
      type="circle" percent={pct(val)} size={90}
      strokeColor={color} trailColor="rgba(0,0,0,0.06)"
      format={p => <span style={{ fontSize: 17, fontWeight: 800, color }}>{p}%</span>}
    />
    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: '#434343' }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 1 }}>{sub}</div>}
  </div>
);

/* ─── Dashboard tab ───────────────────────────────────────────── */
const DashboardTab = ({ complianceData, expiringData, nonCompliantData, pobData, isLoading }) => {
  if (isLoading) return <div style={{ padding: 60, textAlign: 'center' }}><Spin size="large" tip="Loading compliance data…" /></div>;

  const d   = complianceData?.data?.data ?? complianceData?.data ?? {};
  const exp = expiringData?.data?.data   ?? expiringData?.data   ?? {};
  const nc  = Array.isArray(nonCompliantData?.data?.data) ? nonCompliantData.data.data
            : Array.isArray(nonCompliantData?.data)       ? nonCompliantData.data : [];

  /* Active mustering events → who's currently on board */
  const activeEvents = pobData?.data ?? [];
  const onBoardLogs  = activeEvents.flatMap(ev => ev.logs ?? []);
  const onBoardIds   = new Set(onBoardLogs.map(l => l.emp_id).filter(Boolean));
  const pobNonCompliant = nc.filter(p => onBoardIds.has(p.emp_id));

  const med  = pct(d.medical_compliance);
  const cert = pct(d.cert_compliance);
  const ppe  = pct(d.ppe_compliance);
  const ind  = pct(d.induction_compliance);
  const total    = d.total_personnel ?? 0;
  const overall  = Math.round((med + cert + ppe + ind) / 4);

  /* Unified expiry list */
  const allExpiring = [
    ...(exp.medical       ?? []).map(i => ({ ...i, _cat: 'Medical',   _days: diffDays(i.next_due),    _name: i.emp_name || i.visitor_name, _item: 'Medical Checkup' })),
    ...(exp.certifications ?? []).map(i => ({ ...i, _cat: 'Cert',     _days: diffDays(i.expiry_date), _name: i.emp_name || i.visitor_name, _item: i.cert_type_name })),
    ...(exp.ppe            ?? []).map(i => ({ ...i, _cat: 'PPE',      _days: diffDays(i.expiry_date), _name: i.emp_name, _item: i.ppe_type_name })),
    ...(exp.inductions     ?? []).map(i => ({ ...i, _cat: 'Induction', _days: diffDays(i.expiry_date), _name: i.emp_name || i.visitor_name, _item: i.template_name })),
  ].sort((a, b) => a._days - b._days).slice(0, 15);

  const expiryColumns = [
    { title: 'Personnel', dataIndex: '_name', key: 'name', ellipsis: true, width: 150,
      render: v => <Space size={6}><UserOutlined style={{ color: '#8c8c8c' }} /><span style={{ fontWeight: 600 }}>{v || '—'}</span></Space> },
    { title: 'Cat.', dataIndex: '_cat', key: 'cat', width: 80,
      render: v => <Tag color={{ Medical: 'blue', Cert: 'purple', PPE: 'orange', Induction: 'cyan' }[v]} style={{ fontSize: 10, fontWeight: 600 }}>{v}</Tag> },
    { title: 'Item', dataIndex: '_item', key: 'item', ellipsis: true },
    { title: 'Status', dataIndex: '_days', key: 'days', width: 130,
      render: d => {
        if (d < 0)   return <Tag color="red"    style={{ fontWeight: 700 }}>Expired {Math.abs(d)}d ago</Tag>;
        if (d <= 7)  return <Tag color="red"    style={{ fontWeight: 700 }}>{d}d left</Tag>;
        if (d <= 30) return <Tag color="orange"                            >{d}d left</Tag>;
        return              <Tag color="green"                             >{d}d left</Tag>;
      } },
  ];

  const ncColumns = [
    { title: 'Personnel', dataIndex: 'emp_name', key: 'name', ellipsis: true, width: 160,
      render: v => <Space size={6}><UserOutlined style={{ color: '#8c8c8c' }} /><span style={{ fontWeight: 600 }}>{v || '—'}</span></Space> },
    { title: 'Dept', dataIndex: 'dept_name', key: 'dept', ellipsis: true, width: 110 },
    { title: 'Missing', key: 'missing',
      render: (_, r) => <Space size={[4, 4]} wrap>{(r.missing_items ?? []).map(m => <Tag key={m} color="error" style={{ fontSize: 10, marginBottom: 0 }}>{m}</Tag>)}</Space> },
    { title: 'Risk', key: 'risk', width: 65, align: 'center',
      render: (_, r) => {
        const n = (r.missing_items ?? []).length;
        return <Tag color={n > 3 ? 'red' : n > 1 ? 'orange' : 'gold'} style={{ fontWeight: 700 }}>{n > 3 ? 'HIGH' : n > 1 ? 'MED' : 'LOW'}</Tag>;
      } },
  ];

  const pobColumns = [
    { title: 'On Board', dataIndex: 'emp_name', key: 'name', ellipsis: true, width: 160,
      render: v => <Space size={6}><UserOutlined style={{ color: '#ff4d4f' }} /><span style={{ fontWeight: 600 }}>{v || '—'}</span></Space> },
    { title: 'Missing', key: 'missing',
      render: (_, r) => <Space size={[4, 4]} wrap>{(r.missing_items ?? []).map(m => <Tag key={m} color="error" style={{ fontSize: 10, marginBottom: 0 }}>{m}</Tag>)}</Space> },
  ];

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
        <GradStat label="Total Personnel" value={total}          icon={<TeamOutlined />}              from="#0e4a8a" to="#1a6db5" />
        <GradStat label="Overall HSE"     value={`${overall}%`}  icon={<CheckCircleOutlined />}
          from={overall >= 95 ? '#146b2e' : overall >= 80 ? '#7c5200' : '#7a1000'}
          to={overall >= 95 ? '#1f9e44' : overall >= 80 ? '#b07800' : '#b51400'} />
        <GradStat label="Medical Fit"     value={`${med}%`}      icon={<MedicineBoxOutlined />}       from="#005f3e" to="#00875a" />
        <GradStat label="Certs Valid"     value={`${cert}%`}     icon={<SafetyCertificateOutlined />} from="#37006e" to="#5b21b6" />
        <GradStat label="Expiring (30d)"  value={allExpiring.filter(i => i._days >= 0).length}
          sub={`${allExpiring.filter(i => i._days < 0).length} expired`}
          icon={<ClockCircleOutlined />}
          from={allExpiring.some(i => i._days < 0) ? '#7a2e00' : '#004d40'}
          to={allExpiring.some(i => i._days < 0) ? '#b04500' : '#00695c'} />
        <GradStat label="Non-Compliant"   value={nc.length}      icon={<AlertOutlined />}
          from={nc.length > 0 ? '#7a1010' : '#004d40'}
          to={nc.length > 0 ? '#a82020' : '#00695c'} />
      </div>

      {/* Compliance rings */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={6}>
          <Card style={{ height: '100%', textAlign: 'center', borderTop: `4px solid ${compColor(overall)}` }}
            styles={{ body: { padding: '24px 20px' } }}>
            <div style={{ color: '#8c8c8c', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Overall Compliance</div>
            <Progress type="dashboard" percent={pct(overall)} size={130}
              strokeColor={compColor(overall)}
              format={p => (
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: compColor(overall) }}>{p}%</div>
                  <div style={{ fontSize: 10, color: '#8c8c8c' }}>Target ≥ 95%</div>
                </div>
              )}
            />
            <div style={{ marginTop: 16, fontWeight: 700, fontSize: 13, color: compColor(overall) }}>
              {overall >= 95 ? '✓ Target Met' : overall >= 80 ? '⚠ Below Target' : '✗ Critical — Action Required'}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={18}>
          <Card styles={{ body: { padding: '24px 28px' } }}>
            <div style={{ color: '#595959', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 20 }}>Compliance by Category</div>
            <Row gutter={[16, 16]}>
              {[
                { label: 'Medical Fitness', val: med,  color: compColor(med),  sub: 'Fit-for-work status' },
                { label: 'Training & Certs', val: cert, color: compColor(cert), sub: 'BOSIET / OPITO / Other' },
                { label: 'PPE & Equipment',  val: ppe,  color: compColor(ppe),  sub: 'Issued & in-date' },
                { label: 'HSE Induction',    val: ind,  color: compColor(ind),  sub: 'Site orientation' },
              ].map(c => (
                <Col key={c.label} xs={12} sm={6}>
                  <CompRing label={c.label} val={c.val} color={c.color} sub={c.sub} />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Expiry + Non-compliant + POB */}
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={pobNonCompliant.length > 0 ? 10 : 14}>
          <Card
            title={<Space><ClockCircleOutlined style={{ color: '#fa8c16' }} /><b>Upcoming Expirations</b><Tag color="orange">{allExpiring.length}</Tag></Space>}
            styles={{ body: { padding: 0 } }} style={{ height: '100%' }}
          >
            <Table dataSource={allExpiring} columns={expiryColumns} rowKey={r => `${r._cat}-${r.id ?? r.emp_id ?? r._name}`} size="small"
              pagination={false} scroll={{ y: 280 }}
              rowClassName={r => r._days < 0 ? 'mtd-row-expired' : r._days <= 7 ? 'mtd-row-critical' : ''}
              locale={{ emptyText: <Empty description="No items expiring in 30 days" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={pobNonCompliant.length > 0 ? 7 : 10}>
          <Card
            title={<Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} /><b>Non-Compliant Personnel</b><Tag color="red">{nc.length}</Tag></Space>}
            styles={{ body: { padding: 0 } }} style={{ height: '100%' }}
          >
            <Table dataSource={nc.slice(0, 8)} columns={ncColumns} rowKey={r => r.emp_id ?? r.emp_code} size="small"
              pagination={false} scroll={{ y: 280 }}
              locale={{ emptyText: <Empty description="All personnel compliant" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>

        {pobNonCompliant.length > 0 && (
          <Col xs={24} xl={7}>
            <Card
              title={<Space><AlertOutlined style={{ color: '#ff4d4f' }} /><b>On Board — Non-Compliant</b><Badge count={pobNonCompliant.length} /></Space>}
              styles={{ body: { padding: 0 } }}
              style={{ height: '100%', borderTop: '3px solid #ff4d4f' }}
              extra={<Tag color="red" style={{ fontWeight: 700 }}>CRITICAL</Tag>}
            >
              <Table dataSource={pobNonCompliant} columns={pobColumns} rowKey={r => r.emp_id ?? r.emp_code} size="small"
                pagination={false} scroll={{ y: 280 }}
              />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

/* ─── Root ────────────────────────────────────────────────────── */
const MTD = () => {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');

  const { data: complianceData,   isLoading: lComp } = useQuery({
    queryKey: ['mtd-compliance'],
    queryFn:  () => apiService.get('/api/mtd/dashboard/compliance/'),
    refetchInterval: 60000,
  });
  const { data: expiringData,     isLoading: lExp  } = useQuery({
    queryKey: ['mtd-expiring'],
    queryFn:  () => apiService.get('/api/mtd/dashboard/expiring/?days=30&types=medical,cert,ppe,induction'),
    refetchInterval: 60000,
  });
  const { data: nonCompliantData, isLoading: lNC   } = useQuery({
    queryKey: ['mtd-non-compliant'],
    queryFn:  () => apiService.get('/api/mtd/compliance/non-compliant/'),
    refetchInterval: 60000,
  });
  /* Cross-module: who's currently on board */
  const { data: pobData } = useQuery({
    queryKey: ['muster-active'],
    queryFn:  () => apiService.get('/api/mustering/events/?status=0'),
    refetchInterval: 30000,
  });

  const isLoading = lComp || lExp || lNC;

  const d   = complianceData?.data?.data ?? complianceData?.data ?? {};
  const exp = expiringData?.data?.data   ?? expiringData?.data   ?? {};
  const nc  = Array.isArray(nonCompliantData?.data?.data) ? nonCompliantData.data.data
            : Array.isArray(nonCompliantData?.data)       ? nonCompliantData.data : [];

  const totalExp = Object.values(exp).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
  const expired  = Object.values(exp).reduce((s, a) => s + (Array.isArray(a) ? a.filter(i => diffDays(i.next_due || i.expiry_date) < 0).length : 0), 0);
  const overall  = Math.round((pct(d.medical_compliance) + pct(d.cert_compliance) + pct(d.ppe_compliance) + pct(d.induction_compliance)) / 4);
  const isCritical = overall < 80 || expired > 0;

  const handleRefresh = () => {
    qc.invalidateQueries(['mtd-compliance']);
    qc.invalidateQueries(['mtd-expiring']);
    qc.invalidateQueries(['mtd-non-compliant']);
    qc.invalidateQueries(['muster-active']);
  };

  const tabItems = [
    { key: 'dashboard', label: <span><BarChartOutlined style={{ marginRight: 5 }} />Dashboard</span>,
      children: <DashboardTab complianceData={complianceData} expiringData={expiringData} nonCompliantData={nonCompliantData} pobData={pobData} isLoading={isLoading} /> },
    { key: 'medical',   label: <span><MedicineBoxOutlined style={{ marginRight: 5 }} />Medical Records</span>,
      children: <MedicalRecords /> },
    { key: 'training',  label: <span><SafetyCertificateOutlined style={{ marginRight: 5 }} />Training &amp; Certs</span>,
      children: <TrainingCertifications /> },
    { key: 'ppe',       label: <span><ToolOutlined style={{ marginRight: 5 }} />PPE</span>,
      children: <PPEManagement /> },
    { key: 'induction', label: <span><BookOutlined style={{ marginRight: 5 }} />Induction</span>,
      children: <SafetyInduction /> },
    { key: 'expiry',
      label: (
        <span>
          <CalendarOutlined style={{ marginRight: 5 }} />Expiry Tracker
          {(totalExp) > 0 && <Badge count={expired || totalExp} size="small" style={{ marginLeft: 6 }} />}
        </span>
      ),
      children: <ExpiryDashboard /> },
    { key: 'reports',   label: <span><FileTextOutlined style={{ marginRight: 5 }} />Reports</span>,
      children: <ComplianceReports /> },
  ];

  const headerBg = isCritical
    ? 'linear-gradient(135deg, #1a0900 0%, #4a2000 55%, #3a1500 100%)'
    : 'linear-gradient(135deg, #0a2818 0%, #0d4a2a 55%, #0a3320 100%)';

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', width: '100%' }}>
      <style>{`
        @keyframes mtdPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(1.4)} }
        .mtd-root-tabs .ant-tabs-nav { background: transparent !important; }
        .mtd-root-tabs .ant-tabs-nav::before { border-color: rgba(255,255,255,0.1) !important; }
        .mtd-root-tabs .ant-tabs-tab { color: rgba(255,255,255,0.45) !important; font-weight: 500 !important; font-size: 13px !important; padding: 10px 16px !important; margin: 0 1px !important; border-radius: 8px 8px 0 0 !important; transition: all 0.18s !important; }
        .mtd-root-tabs .ant-tabs-tab:hover { color: rgba(255,255,255,0.88) !important; background: rgba(255,255,255,0.07) !important; }
        .mtd-root-tabs .ant-tabs-tab-active { color: white !important; background: rgba(255,255,255,0.12) !important; font-weight: 700 !important; }
        .mtd-root-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: white !important; }
        .mtd-root-tabs .ant-tabs-ink-bar { background: #52c41a !important; height: 3px !important; border-radius: 2px 2px 0 0 !important; }
        .mtd-root-tabs .ant-tabs-content-holder { background: #f0f2f5 !important; }
        .mtd-row-expired  td { background: rgba(255,77,79,0.05) !important; }
        .mtd-row-critical td { background: rgba(250,140,22,0.05) !important; }
        .mtd-row-expired:hover  td { background: rgba(255,77,79,0.1) !important; }
        .mtd-row-critical:hover td { background: rgba(250,140,22,0.1) !important; }
      `}</style>

      <div style={{ background: headerBg, transition: 'background 0.5s ease', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>

        {/* ── Row 1: Title + status chips + actions ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px 14px' }}>
          <Space size={14}>
            <div style={{
              width: 50, height: 50, borderRadius: 13, flexShrink: 0,
              background: isCritical ? 'rgba(250,140,22,0.18)' : 'rgba(82,196,26,0.15)',
              border: `1px solid ${isCritical ? 'rgba(250,140,22,0.4)' : 'rgba(82,196,26,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: isCritical ? 'mtdPulse 1.5s infinite' : 'none',
            }}>
              <MedicineBoxOutlined style={{ color: isCritical ? '#fa8c16' : '#52c41a', fontSize: 22 }} />
            </div>
            <div>
              <div style={{ color: 'white', fontSize: 19, fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                Medical, Training &amp; Development
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                HSE Compliance · Oil &amp; Gas Operations · Personnel Safety Management
              </div>
            </div>
          </Space>

          <Space size={7}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${compColor(overall)}18`, border: `1px solid ${compColor(overall)}45`, borderRadius: 8, padding: '5px 12px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: compColor(overall), animation: overall < 80 ? 'mtdPulse 1s infinite' : 'none' }} />
              <span style={{ color: compColor(overall), fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>{overall}% COMPLIANT</span>
            </div>

            {totalExp > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(250,140,22,0.15)', border: '1px solid rgba(250,140,22,0.35)', borderRadius: 8, padding: '5px 10px' }}>
                <ClockCircleOutlined style={{ fontSize: 11, color: '#fa8c16' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fa8c16' }}>{totalExp} Expiring</span>
                {expired > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#ff4d4f', background: 'rgba(255,77,79,0.15)', borderRadius: 4, padding: '1px 5px' }}>{expired} expired</span>}
              </div>
            )}

            {nc.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,77,79,0.15)', border: '1px solid rgba(255,77,79,0.35)', borderRadius: 8, padding: '5px 10px' }}>
                <AlertOutlined style={{ fontSize: 11, color: '#ff4d4f' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ff4d4f' }}>{nc.length} Non-Compliant</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 8, padding: '5px 10px' }}>
              <TeamOutlined style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{d.total_personnel ?? 0} Personnel</span>
            </div>

            <Tooltip title="Send expiry notifications">
              <Button icon={<BellOutlined />} size="small" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: 'white', borderRadius: 7, fontSize: 11 }} />
            </Tooltip>
            <Button icon={<ReloadOutlined />} size="small" onClick={handleRefresh} loading={isLoading}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: 'white', borderRadius: 7, fontSize: 11 }} />
            <Button icon={<DownloadOutlined />} size="small"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: 'white', borderRadius: 7, fontSize: 11 }}>Export</Button>
          </Space>
        </div>

        {/* ── Row 2: Tab bar ── */}
        <div style={{ padding: '0 24px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            className="mtd-root-tabs"
            tabBarStyle={{ marginBottom: 0 }}
          />
        </div>
      </div>
    </div>
  );
};

export default MTD;
