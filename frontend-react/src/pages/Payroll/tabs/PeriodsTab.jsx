import React, { useState, useEffect } from 'react';
import {
  Table, Button, Space, App, Row, Col, Alert, Modal, Form, Input,
  Timeline, Dropdown, Typography,
} from 'antd';
import {
  PlusOutlined, SyncOutlined, MoreOutlined,
  CalendarOutlined, ClockCircleOutlined, CheckCircleOutlined,
  StopOutlined, LockOutlined, UnlockOutlined, EditOutlined,
} from '@ant-design/icons';
import { apiCall } from '../payrollApi';
import dayjs from 'dayjs';

const { Text } = Typography;

const STATUS_CFG = {
  open:        { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Open'        },
  calculating: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Calculating' },
  closed:      { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Closed'      },
  cancelled:   { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Cancelled'   },
};

const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status?.toLowerCase()] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: status };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label?.toUpperCase()}
    </span>
  );
};

const StatCard = ({ label, value, color, icon }) => (
  <div style={{
    flex: 1, background: '#fff', borderRadius: 8, padding: '14px 16px',
    borderTop: `3px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ color, fontSize: 15, background: `${color}18`, borderRadius: 6, padding: '3px 6px', display: 'flex' }}>{icon}</span>
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
  </div>
);

const PeriodsTab = ({ periods: propPeriods, onRefresh }) => {
  const { message, modal } = App.useApp();
  const [periods, setPeriods] = useState(propPeriods || []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [periodModal, setPeriodModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();

  useEffect(() => { setPeriods(propPeriods || []); }, [propPeriods]);

  const refreshPeriods = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/api/v1/payroll/periods/');
      setPeriods(Array.isArray(data) ? data : []);
      onRefresh();
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const savePeriod = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const { record } = periodModal;
      if (record) {
        await apiCall(`/api/v1/payroll/periods/${record.id}`, { method: 'PUT', body: JSON.stringify(values) });
        message.success('Period updated');
      } else {
        await apiCall('/api/v1/payroll/periods/', { method: 'POST', body: JSON.stringify(values) });
        message.success('Period created');
      }
      setPeriodModal({ open: false, record: null });
      await refreshPeriods();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const closePeriod = (id) => modal.confirm({
    title: 'Close this pay period?',
    content: 'Attendance will be locked. Employees cannot have new attendance added for this period.',
    okText: 'Close Period', okType: 'danger',
    onOk: async () => {
      await apiCall(`/api/v1/payroll/periods/${id}/close/`, { method: 'POST' });
      message.success('Period closed and attendance locked');
      await refreshPeriods();
    },
  });

  const reopenPeriod = (id) => modal.confirm({
    title: 'Reopen this period?',
    content: 'This will unlock attendance. Requires admin privileges.',
    okText: 'Reopen',
    onOk: async () => {
      await apiCall(`/api/v1/payroll/periods/${id}/reopen/`, { method: 'POST' });
      message.success('Period reopened');
      await refreshPeriods();
    },
  });

  const counts = periods.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});

  const columns = [
    {
      title: 'Period Name', dataIndex: 'period_name', key: 'name',
      sorter: (a, b) => new Date(a.start_date) - new Date(b.start_date),
      render: v => <Text strong>{v}</Text>,
    },
    { title: 'Start', dataIndex: 'start_date', key: 'start', width: 120, render: d => d ? dayjs(d).format('DD MMM YYYY') : '—' },
    { title: 'End', dataIndex: 'end_date', key: 'end', width: 120, render: d => d ? dayjs(d).format('DD MMM YYYY') : '—' },
    { title: 'Pay Date', dataIndex: 'pay_date', key: 'pay', width: 120, render: d => d ? dayjs(d).format('DD MMM YYYY') : <Text type="secondary">Not set</Text> },
    {
      title: 'Days', key: 'days', width: 60, align: 'center',
      render: (_, r) => (!r.start_date || !r.end_date) ? '—' : dayjs(r.end_date).diff(dayjs(r.start_date), 'day') + 1,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      filters: Object.keys(STATUS_CFG).map(s => ({ text: STATUS_CFG[s].label, value: s })),
      onFilter: (val, r) => r.status === val,
      render: s => <StatusPill status={s} />,
    },
    {
      title: '', key: 'actions', width: 50,
      render: (_, record) => {
        const items = [];
        if (record.status !== 'closed' && record.status !== 'cancelled') {
          items.push({ key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => { form.setFieldsValue({ ...record, pay_date: record.pay_date || '' }); setPeriodModal({ open: true, record }); } });
        }
        if (record.status === 'open' || record.status === 'calculating') {
          items.push({ key: 'close', icon: <LockOutlined />, label: 'Close Period', danger: true, onClick: () => closePeriod(record.id) });
        }
        if (record.status === 'closed') {
          items.push({ key: 'reopen', icon: <UnlockOutlined />, label: 'Reopen Period', onClick: () => reopenPeriod(record.id) });
        }
        if (!items.length) return null;
        return <Dropdown trigger={['click']} menu={{ items }}><Button size="small" type="text" icon={<MoreOutlined />} /></Dropdown>;
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <StatCard label="Total Periods" value={periods.length} color="#64748b" icon={<CalendarOutlined />} />
        <StatCard label="Open" value={counts.open || 0} color="#2563eb" icon={<ClockCircleOutlined />} />
        <StatCard label="Calculating" value={counts.calculating || 0} color="#d97706" icon={<SyncOutlined />} />
        <StatCard label="Closed" value={counts.closed || 0} color="#16a34a" icon={<CheckCircleOutlined />} />
        <StatCard label="Cancelled" value={counts.cancelled || 0} color="#dc2626" icon={<StopOutlined />} />
      </div>

      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Pay Periods</Text>
              <Space size={8}>
                <Button size="small" icon={<SyncOutlined />} onClick={refreshPeriods} loading={loading}>Refresh</Button>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setPeriodModal({ open: true, record: null }); }}>New Period</Button>
              </Space>
            </div>
            <Table
              dataSource={periods}
              rowKey="id"
              loading={loading}
              columns={columns}
              size="small"
              rowClassName={r => `row-period-${r.status}`}
              pagination={{ pageSize: 12, showTotal: t => `${t} periods` }}
            />
          </div>
        </Col>

        <Col xs={24} xl={8}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', maxHeight: 520, overflowY: 'auto' }}>
            <Text strong style={{ fontSize: 14 }}>Recent Periods</Text>
            <div style={{ marginTop: 12 }}>
              {periods.length === 0 ? (
                <Alert message="No periods created yet" type="info" showIcon />
              ) : (
                <Timeline
                  mode="right"
                  items={[...periods]
                    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
                    .slice(0, 15)
                    .map(p => {
                      const cfg = STATUS_CFG[p.status] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
                      return {
                        color: cfg.color,
                        children: (
                          <div style={{ paddingBottom: 4 }}>
                            <Text strong style={{ fontSize: 12 }}>{p.period_name}</Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                                {p.status?.toUpperCase()}
                              </span>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {dayjs(p.start_date).format('DD MMM')} – {dayjs(p.end_date).format('DD MMM YYYY')}
                              </Text>
                            </div>
                          </div>
                        ),
                      };
                    })}
                />
              )}
            </div>
          </div>
        </Col>
      </Row>

      <Modal
        title={periodModal.record ? 'Edit Pay Period' : 'Create Pay Period'}
        open={periodModal.open}
        onOk={savePeriod}
        onCancel={() => setPeriodModal({ open: false, record: null })}
        confirmLoading={saving}
        width={500}
      >
        <Alert type="warning" showIcon message="Periods must not overlap. A period cannot be shortened after salaries are calculated." style={{ marginBottom: 16 }} />
        <Form form={form} layout="vertical">
          <Form.Item name="period_name" label="Period Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. June 2026, Q2-2026" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="start_date" label="Start Date" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="end_date" label="End Date" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
          </Row>
          <Form.Item name="pay_date" label="Pay Date (optional)"><Input type="date" /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <style>{`
        .row-period-open > td { background: rgba(37,99,235,0.03) !important; }
        .row-period-calculating > td { background: rgba(217,119,6,0.04) !important; }
        .row-period-closed > td { background: rgba(22,163,74,0.03) !important; }
        .row-period-cancelled > td { background: rgba(220,38,38,0.03) !important; }
      `}</style>
    </div>
  );
};

export default PeriodsTab;
