import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Select, Row, Col, Card,
  Tooltip, Progress, Empty, Spin, Badge, Alert,
} from 'antd';
import {
  ClockCircleOutlined, WarningOutlined, CheckCircleOutlined, ReloadOutlined,
  BellOutlined, UserOutlined, MedicineBoxOutlined, SafetyCertificateOutlined,
  ToolOutlined, BookOutlined, FilterOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const diffDays = d => d ? dayjs(d).diff(dayjs(), 'day') : null;

const URGENCY_BANDS = [
  { key: 'expired',  label: 'Expired',      color: '#cf1322', bg: '#fff1f0', border: '#ffa39e', icon: <WarningOutlined />,      range: [-9999, -1] },
  { key: 'critical', label: 'Critical ≤7d',  color: '#cf1322', bg: '#fff1f0', border: '#ffa39e', icon: <WarningOutlined />,      range: [0, 7]     },
  { key: 'warning',  label: 'Expiring ≤30d', color: '#d48806', bg: '#fffbe6', border: '#ffe58f', icon: <ClockCircleOutlined />,  range: [8, 30]    },
  { key: 'ok',       label: 'Valid >30d',    color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f', icon: <CheckCircleOutlined />,  range: [31, 9999] },
];

const CAT_META = {
  Medical:   { color: '#1890ff', icon: <MedicineBoxOutlined />,       tag: 'blue'   },
  Cert:      { color: '#722ed1', icon: <SafetyCertificateOutlined />,  tag: 'purple' },
  PPE:       { color: '#fa8c16', icon: <ToolOutlined />,               tag: 'orange' },
  Induction: { color: '#08979c', icon: <BookOutlined />,               tag: 'cyan'   },
};

const getBand = days => {
  if (days === null)  return 'ok';
  if (days < 0)       return 'expired';
  if (days <= 7)      return 'critical';
  if (days <= 30)     return 'warning';
  return 'ok';
};

const UrgencyTag = ({ days }) => {
  if (days === null) return <Tag color="default">No expiry</Tag>;
  const band = getBand(days);
  const cfg  = URGENCY_BANDS.find(b => b.key === band);
  if (days < 0)  return <Tag color="red"    style={{ fontWeight: 700 }}>Expired {Math.abs(days)}d ago</Tag>;
  if (days <= 7) return <Tag color="red"    style={{ fontWeight: 700 }}>{days}d left</Tag>;
  if (days <= 30) return <Tag color="orange"                            >{days}d left</Tag>;
  return              <Tag color="green"                                >{days}d left</Tag>;
};

const ExpiryDashboard = () => {
  const qc = useQueryClient();
  const [catFilter,  setCatFilter]  = useState('all');
  const [bandFilter, setBandFilter] = useState('all');
  const [days,       setDays]       = useState(30);

  const { data: expiringData, isLoading } = useQuery({
    queryKey: ['mtd-expiring', days],
    queryFn:  () => apiService.get(`/api/mtd/dashboard/expiring/?days=${days}&types=medical,cert,ppe,induction`),
    refetchInterval: 60000,
  });

  const exp = expiringData?.data?.data ?? expiringData?.data ?? {};

  const allItems = useMemo(() => [
    ...(exp.medical       ?? []).map(i => ({ ...i, _cat: 'Medical',   _days: diffDays(i.next_due),    _name: i.emp_name || i.visitor_name, _item: 'Medical Checkup', _type: i.person_type === 0 ? 'Employee' : 'Visitor' })),
    ...(exp.certifications ?? []).map(i => ({ ...i, _cat: 'Cert',     _days: diffDays(i.expiry_date), _name: i.emp_name || i.visitor_name, _item: i.cert_type_name,  _type: i.person_type === 0 ? 'Employee' : 'Visitor', _critical: i.is_critical })),
    ...(exp.ppe            ?? []).map(i => ({ ...i, _cat: 'PPE',      _days: diffDays(i.expiry_date), _name: i.emp_name, _item: i.ppe_type_name, _type: 'Employee' })),
    ...(exp.inductions     ?? []).map(i => ({ ...i, _cat: 'Induction', _days: diffDays(i.expiry_date), _name: i.emp_name || i.visitor_name, _item: i.template_name, _type: i.person_type === 0 ? 'Employee' : 'Visitor' })),
  ].sort((a, b) => (a._days ?? 9999) - (b._days ?? 9999)), [exp]);

  const filtered = allItems.filter(i =>
    (catFilter  === 'all' || i._cat    === catFilter)  &&
    (bandFilter === 'all' || getBand(i._days) === bandFilter)
  );

  /* Band counts */
  const counts = useMemo(() => {
    const c = { expired: 0, critical: 0, warning: 0, ok: 0 };
    allItems.forEach(i => { c[getBand(i._days)]++; });
    return c;
  }, [allItems]);

  /* Category counts */
  const catCounts = useMemo(() => {
    const c = {};
    allItems.forEach(i => { c[i._cat] = (c[i._cat] ?? 0) + 1; });
    return c;
  }, [allItems]);

  const columns = [
    { title: '#', key: 'rank', width: 48, align: 'center',
      render: (_, __, i) => <span style={{ color: '#8c8c8c', fontSize: 12 }}>{i + 1}</span> },
    { title: 'Personnel', key: 'name', ellipsis: true, width: 190,
      render: (_, r) => (
        <Space size={6}>
          <UserOutlined style={{ color: '#8c8c8c' }} />
          <div>
            <span style={{ fontWeight: 600 }}>{r._name || '—'}</span>
            <span style={{ marginLeft: 6 }}><Tag color={r._type === 'Employee' ? 'blue' : 'purple'} style={{ fontSize: 10 }}>{r._type}</Tag></span>
          </div>
        </Space>
      )},
    { title: 'Category', key: 'cat', width: 100,
      render: (_, r) => {
        const m = CAT_META[r._cat] ?? {};
        return <Tag color={m.tag} icon={m.icon} style={{ fontWeight: 600 }}>{r._cat}</Tag>;
      }},
    { title: 'Item', key: 'item', ellipsis: true,
      render: (_, r) => (
        <Space size={6}>
          {r._critical && <Tag color="orange" style={{ fontSize: 10 }}>CRITICAL</Tag>}
          <span>{r._item || '—'}</span>
        </Space>
      )},
    { title: 'Due Date', key: 'due', width: 120,
      render: (_, r) => {
        const date = r.next_due || r.expiry_date;
        return date ? dayjs(date).format('DD MMM YYYY') : '—';
      }},
    { title: 'Status', key: 'status', width: 145,
      render: (_, r) => <UrgencyTag days={r._days} /> },
    { title: 'Dept', key: 'dept', width: 120, ellipsis: true,
      render: (_, r) => r.dept_name || <span style={{ color: '#d9d9d9' }}>—</span> },
  ];

  if (isLoading) return <div style={{ padding: 60, textAlign: 'center' }}><Spin size="large" /></div>;

  const hasCritical = counts.expired + counts.critical > 0;

  return (
    <div style={{ padding: '20px 24px' }}>
      {hasCritical && (
        <Alert
          type="error" showIcon
          message={`${counts.expired + counts.critical} item(s) require immediate attention — expired or expiring within 7 days`}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" icon={<BellOutlined />} danger>
              Send Notifications
            </Button>
          }
        />
      )}

      {/* Urgency band summary */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {URGENCY_BANDS.map(b => (
          <Col key={b.key} xs={6}>
            <div
              onClick={() => setBandFilter(bandFilter === b.key ? 'all' : b.key)}
              style={{
                background: bandFilter === b.key ? b.bg : 'white',
                border: `1.5px solid ${bandFilter === b.key ? b.color : '#e8e8e8'}`,
                borderRadius: 10, padding: '12px 16px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{ color: b.color, fontSize: 26, fontWeight: 800 }}>{counts[b.key]}</div>
              <div style={{ color: b.color, fontSize: 11, fontWeight: 600, marginTop: 2 }}>{b.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Category breakdown */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {Object.entries(CAT_META).map(([cat, meta]) => (
          <Col key={cat} xs={6}>
            <div
              onClick={() => setCatFilter(catFilter === cat ? 'all' : cat)}
              style={{
                background: catFilter === cat ? `${meta.color}08` : 'white',
                border: `1.5px solid ${catFilter === cat ? meta.color : '#e8e8e8'}`,
                borderRadius: 8, padding: '8px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Space size={8}>
                <span style={{ color: meta.color, fontSize: 16 }}>{meta.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#434343' }}>{cat}</span>
              </Space>
              <Tag color={catFilter === cat ? meta.tag : 'default'} style={{ fontWeight: 700 }}>
                {catCounts[cat] ?? 0}
              </Tag>
            </div>
          </Col>
        ))}
      </Row>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Space size={6} style={{ color: '#595959', fontSize: 13 }}>
          <FilterOutlined />
          <span>Showing items expiring within</span>
        </Space>
        <Select value={days} onChange={setDays} style={{ width: 130 }}>
          <Select.Option value={7}>7 days</Select.Option>
          <Select.Option value={14}>14 days</Select.Option>
          <Select.Option value={30}>30 days</Select.Option>
          <Select.Option value={60}>60 days</Select.Option>
          <Select.Option value={90}>90 days</Select.Option>
          <Select.Option value={365}>All (1 yr)</Select.Option>
        </Select>
        <span style={{ color: '#8c8c8c', fontSize: 12 }}>+ all expired</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {(catFilter !== 'all' || bandFilter !== 'all') && (
            <Button onClick={() => { setCatFilter('all'); setBandFilter('all'); }}>Clear Filters</Button>
          )}
          <Tooltip title="Send notification emails for all expiring items">
            <Button icon={<BellOutlined />} onClick={() => apiService.post('/api/mtd/dashboard/notify/', { days })}>
              Notify All ({allItems.length})
            </Button>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries(['mtd-expiring'])}>Refresh</Button>
        </div>
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey={r => `${r._cat}-${r.id ?? r.emp_id ?? r._name}-${r._item ?? ''}`}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} items` }}
        scroll={{ x: 900 }}
        rowClassName={r => {
          const b = getBand(r._days);
          return b === 'expired' || b === 'critical' ? 'mtd-row-expired' : b === 'warning' ? 'mtd-row-critical' : '';
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span>No items expiring within {days} days <CheckCircleOutlined style={{ color: '#52c41a' }} /></span>}
            />
          ),
        }}
      />
    </div>
  );
};

export default ExpiryDashboard;
