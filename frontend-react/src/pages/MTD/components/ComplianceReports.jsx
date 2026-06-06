import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Select, Row, Col, Card,
  Progress, Empty, Spin, Statistic, Tooltip, Divider,
} from 'antd';
import {
  BarChartOutlined, UserOutlined, DownloadOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, WarningOutlined,
  TeamOutlined, AlertOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const pct = v => Math.min(100, Math.max(0, Math.round(v ?? 0)));
const compColor = v => v >= 95 ? '#52c41a' : v >= 80 ? '#faad14' : '#ff4d4f';
const compBg    = v => v >= 95 ? '#f6ffed' : v >= 80 ? '#fffbe6' : '#fff1f0';

/* ─── Dept compliance bar ─────────────────────────────────────── */
const DeptBar = ({ name, value, total, onClick, active }) => (
  <div
    onClick={onClick}
    style={{
      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
      background: active ? compBg(value) : 'white',
      border: `1.5px solid ${active ? compColor(value) : '#e8e8e8'}`,
      transition: 'all 0.15s', marginBottom: 8,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 13, color: '#141414' }}>{name}</span>
      <Space size={8}>
        <span style={{ color: '#8c8c8c', fontSize: 11 }}>{total} people</span>
        <Tag style={{ color: compColor(value), background: compBg(value), borderColor: compColor(value), fontWeight: 700 }}>
          {value}%
        </Tag>
      </Space>
    </div>
    <Progress
      percent={pct(value)} size="small" showInfo={false}
      strokeColor={compColor(value)} trailColor="#f0f0f0"
    />
  </div>
);

/* ─── Main component ─────────────────────────────────────────── */
const ComplianceReports = () => {
  const qc = useQueryClient();
  const [deptFilter, setDeptFilter] = useState(null);
  const [missingFilter, setMissingFilter] = useState('all');

  const { data: compData,  isLoading: lComp } = useQuery({
    queryKey: ['mtd-compliance'],
    queryFn:  () => apiService.get('/api/mtd/dashboard/compliance/'),
    refetchInterval: 60000,
  });
  const { data: ncData, isLoading: lNC } = useQuery({
    queryKey: ['mtd-non-compliant'],
    queryFn:  () => apiService.get('/api/mtd/compliance/non-compliant/'),
    refetchInterval: 60000,
  });
  const { data: matrixData, isLoading: lMx } = useQuery({
    queryKey: ['mtd-matrix'],
    queryFn:  () => apiService.get('/api/mtd/compliance/matrix/'),
  });

  const d  = compData?.data?.data ?? compData?.data ?? {};
  const nc = Array.isArray(ncData?.data?.data) ? ncData.data.data
           : Array.isArray(ncData?.data)       ? ncData.data : [];
  const matrix = matrixData?.data?.data ?? matrixData?.data ?? {};

  const isLoading = lComp || lNC || lMx;

  /* Build dept breakdown from non-compliant list */
  const deptStats = useMemo(() => {
    if (!d.total_personnel) return [];
    const total = d.total_personnel;
    const depts = {};
    nc.forEach(p => {
      const dept = p.dept_name || 'Unassigned';
      if (!depts[dept]) depts[dept] = { name: dept, nc: 0, total: 0 };
      depts[dept].nc++;
    });
    /* We only know NC people per dept; total per dept requires matrix or separate endpoint */
    return Object.values(depts).map(dep => ({
      ...dep,
      total: dep.total || dep.nc,
      pct: dep.total ? Math.round(((dep.total - dep.nc) / dep.total) * 100) : 0,
    }));
  }, [nc, d]);

  /* Overall stats */
  const med  = pct(d.medical_compliance);
  const cert = pct(d.cert_compliance);
  const ppe  = pct(d.ppe_compliance);
  const ind  = pct(d.induction_compliance);
  const overall = Math.round((med + cert + ppe + ind) / 4);

  /* Filter NC list */
  const filteredNC = nc.filter(p => {
    const deptOk    = !deptFilter || p.dept_name === deptFilter;
    const missingOk = missingFilter === 'all'
      || (p.missing_items ?? []).some(m => m.toLowerCase().includes(missingFilter.toLowerCase()));
    return deptOk && missingOk;
  });

  const uniqueDepts = [...new Set(nc.map(p => p.dept_name).filter(Boolean))];

  const ncColumns = [
    { title: '#', key: 'i', width: 45, align: 'center',
      render: (_, __, i) => <span style={{ color: '#8c8c8c', fontSize: 12 }}>{i + 1}</span> },
    { title: 'Personnel', key: 'name', ellipsis: true, width: 190,
      render: (_, r) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#8c8c8c' }} />
          <div>
            <span style={{ fontWeight: 600 }}>{r.emp_name || '—'}</span>
            {r.emp_code && <span style={{ color: '#8c8c8c', fontSize: 11 }}> ({r.emp_code})</span>}
          </div>
        </Space>
      )},
    { title: 'Department', dataIndex: 'dept_name', key: 'dept', ellipsis: true, width: 140 },
    { title: 'Position', dataIndex: 'position_name', key: 'pos', ellipsis: true, width: 140 },
    { title: 'Missing Items', key: 'missing',
      render: (_, r) => (
        <Space size={[4, 4]} wrap>
          {(r.missing_items ?? []).map(m => <Tag key={m} color="error" style={{ fontSize: 10, marginBottom: 0 }}>{m}</Tag>)}
        </Space>
      )},
    { title: 'Risk Level', key: 'risk', width: 80, align: 'center',
      render: (_, r) => {
        const n = (r.missing_items ?? []).length;
        return <Tag color={n > 3 ? 'red' : n > 1 ? 'orange' : 'gold'} style={{ fontWeight: 700 }}>
          {n > 3 ? 'HIGH' : n > 1 ? 'MED' : 'LOW'}
        </Tag>;
      }},
  ];

  if (isLoading) return <div style={{ padding: 60, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Overall compliance summary */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={8}>
          <Card style={{ textAlign: 'center', borderTop: `4px solid ${compColor(overall)}` }}
            styles={{ body: { padding: '20px 24px' } }}>
            <div style={{ color: '#8c8c8c', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
              Overall Compliance
            </div>
            <Progress type="dashboard" percent={pct(overall)} size={120}
              strokeColor={compColor(overall)}
              format={p => (
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: compColor(overall) }}>{p}%</div>
                  <div style={{ fontSize: 10, color: '#8c8c8c' }}>Target ≥ 95%</div>
                </div>
              )}
            />
            <div style={{ marginTop: 12, fontWeight: 700, fontSize: 13, color: compColor(overall) }}>
              {overall >= 95 ? '✓ Target Met' : overall >= 80 ? '⚠ Below Target' : '✗ Requires Action'}
            </div>
            <Divider style={{ margin: '14px 0' }} />
            <Row gutter={[8, 8]}>
              {[
                { label: 'Medical',   val: med  },
                { label: 'Training',  val: cert },
                { label: 'PPE',       val: ppe  },
                { label: 'Induction', val: ind  },
              ].map(c => (
                <Col key={c.label} span={12}>
                  <div style={{ background: compBg(c.val), borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ color: compColor(c.val), fontSize: 16, fontWeight: 800 }}>{c.val}%</div>
                    <div style={{ color: compColor(c.val), fontSize: 10, fontWeight: 600 }}>{c.label}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Space><TeamOutlined style={{ color: '#1890ff' }} /><b>Compliance by Department</b></Space>}
            styles={{ body: { padding: '14px 20px', maxHeight: 320, overflowY: 'auto' } }}
            style={{ height: '100%' }}
          >
            {deptStats.length === 0 ? (
              <Empty description="No department data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              deptStats.sort((a, b) => a.pct - b.pct).map(dep => (
                <DeptBar
                  key={dep.name}
                  name={dep.name}
                  value={dep.pct}
                  total={dep.nc}
                  onClick={() => setDeptFilter(deptFilter === dep.name ? null : dep.name)}
                  active={deptFilter === dep.name}
                />
              ))
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<Space><BarChartOutlined style={{ color: '#722ed1' }} /><b>Quick Stats</b></Space>}
            styles={{ body: { padding: '16px 20px' } }}
            style={{ height: '100%' }}
          >
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fafafa', borderRadius: 8 }}>
                <Space size={8}><TeamOutlined style={{ color: '#1890ff' }} /><span style={{ fontWeight: 600 }}>Total Personnel</span></Space>
                <Tag color="blue" style={{ fontWeight: 700, fontSize: 14 }}>{d.total_personnel ?? 0}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: nc.length > 0 ? '#fff1f0' : '#f6ffed', borderRadius: 8 }}>
                <Space size={8}><AlertOutlined style={{ color: nc.length > 0 ? '#cf1322' : '#389e0d' }} /><span style={{ fontWeight: 600 }}>Non-Compliant</span></Space>
                <Tag color={nc.length > 0 ? 'red' : 'green'} style={{ fontWeight: 700, fontSize: 14 }}>{nc.length}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f6ffed', borderRadius: 8 }}>
                <Space size={8}><CheckCircleOutlined style={{ color: '#389e0d' }} /><span style={{ fontWeight: 600 }}>Fully Compliant</span></Space>
                <Tag color="green" style={{ fontWeight: 700, fontSize: 14 }}>{(d.total_personnel ?? 0) - nc.length}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fafafa', borderRadius: 8 }}>
                <Space size={8}><WarningOutlined style={{ color: '#fa8c16' }} /><span style={{ fontWeight: 600 }}>High Risk</span></Space>
                <Tag color="orange" style={{ fontWeight: 700, fontSize: 14 }}>
                  {nc.filter(p => (p.missing_items ?? []).length > 3).length}
                </Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fafafa', borderRadius: 8 }}>
                <Space size={8}><TeamOutlined style={{ color: '#8c8c8c' }} /><span style={{ fontWeight: 600 }}>Depts Affected</span></Space>
                <Tag style={{ fontWeight: 700, fontSize: 14 }}>{uniqueDepts.length}</Tag>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Non-compliant personnel table */}
      <Card
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#cf1322' }} />
            <b>Non-Compliant Personnel</b>
            <Tag color="red">{nc.length}</Tag>
            {deptFilter && <Tag closable onClose={() => setDeptFilter(null)} color="blue">Dept: {deptFilter}</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Select value={deptFilter ?? 'all'} onChange={v => setDeptFilter(v === 'all' ? null : v)} style={{ width: 160 }}>
              <Select.Option value="all">All Departments</Select.Option>
              {uniqueDepts.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
            </Select>
            <Select value={missingFilter} onChange={setMissingFilter} style={{ width: 160 }}>
              <Select.Option value="all">All Missing Items</Select.Option>
              <Select.Option value="medical">Medical</Select.Option>
              <Select.Option value="cert">Certifications</Select.Option>
              <Select.Option value="ppe">PPE</Select.Option>
              <Select.Option value="induction">Induction</Select.Option>
            </Select>
            <Tooltip title="Export non-compliant list to CSV">
              <Button icon={<DownloadOutlined />} onClick={() => {
                const rows = filteredNC.map(p => `${p.emp_code || ''},${p.emp_name || ''},${p.dept_name || ''},"${(p.missing_items ?? []).join(', ')}"`);
                const csv  = ['Code,Name,Department,Missing Items', ...rows].join('\n');
                const a    = document.createElement('a');
                a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
                a.download = `mtd_non_compliant_${dayjs().format('YYYYMMDD')}.csv`;
                a.click();
              }}>Export CSV</Button>
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries(['mtd-non-compliant'])}>Refresh</Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table
          dataSource={filteredNC}
          columns={ncColumns}
          rowKey={r => r.emp_id ?? r.emp_code}
          size="small"
          loading={lNC}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `${t} non-compliant` }}
          scroll={{ x: 800 }}
          locale={{ emptyText: <Empty description="All personnel compliant" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          rowClassName={r => (r.missing_items ?? []).length > 3 ? 'mtd-row-expired' : 'mtd-row-critical'}
        />
      </Card>
    </div>
  );
};

export default ComplianceReports;
