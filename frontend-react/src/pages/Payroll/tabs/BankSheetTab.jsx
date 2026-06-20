import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Button, Select, Table, Space, App,
  Alert, Typography,
} from 'antd';
import {
  DownloadOutlined, BankOutlined, SyncOutlined, WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { apiCall, fmt, downloadBlob } from '../payrollApi';

const { Option } = Select;
const { Text } = Typography;

const CALC_STATUS_CFG = {
  calculated: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Calculated' },
  pending:    { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Pending'     },
  failed:     { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Failed'      },
};

const StatusPill = ({ status }) => {
  const cfg = CALC_STATUS_CFG[status?.toLowerCase()] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: status };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
};

const StatCard = ({ label, value, color, icon, sub }) => (
  <div style={{
    flex: 1, background: '#fff', borderRadius: 8, padding: '14px 16px',
    borderTop: `3px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      {icon && <span style={{ color, fontSize: 15, background: `${color}18`, borderRadius: 6, padding: '3px 6px', display: 'flex' }}>{icon}</span>}
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
  </div>
);

const BankSheetTab = ({ periods }) => {
  const { message } = App.useApp();
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [format, setFormat] = useState('xlsx');
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchSalaries = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await apiCall(`/api/v1/payroll/salaries/?period_id=${pid}`);
      setSalaries(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPeriodId) fetchSalaries(selectedPeriodId);
    else setSalaries([]);
  }, [selectedPeriodId, fetchSalaries]);

  const handleExport = async () => {
    if (!selectedPeriodId) { message.warning('Select a period first'); return; }
    setExporting(true);
    try {
      const period = periods.find(p => p.id === selectedPeriodId);
      const periodName = period?.period_name?.replace(/\s/g, '_') || selectedPeriodId;
      await downloadBlob(
        `/api/v1/payroll/bank-sheet/?period_id=${selectedPeriodId}&format=${format}`,
        `bank_sheet_${periodName}.${format}`
      );
      message.success('Bank sheet downloaded');
    } catch (e) {
      message.error(e.message);
    } finally {
      setExporting(false);
    }
  };

  const PERIOD_STATUS_CFG = {
    closed: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    open:   { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  };

  const calculated = salaries.filter(s => s.calc_status === 'calculated');
  const totalNet = calculated.reduce((s, r) => s + (r.net_salary || 0), 0);
  const missingBank = calculated.filter(s => !s.bank_account_no);

  const columns = [
    { title: '#', key: 'idx', width: 45, render: (_, __, i) => <Text type="secondary" style={{ fontSize: 11 }}>{i + 1}</Text> },
    { title: 'Emp Code', dataIndex: 'employee_badge_id', key: 'code', width: 100 },
    {
      title: 'Employee Name', dataIndex: 'employee_name', key: 'name',
      sorter: (a, b) => a.employee_name?.localeCompare(b.employee_name),
      render: v => <Text strong>{v}</Text>,
    },
    {
      title: 'Bank', key: 'bank', width: 140,
      render: (_, r) => r.bank_name
        ? <Text>{r.bank_name}</Text>
        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a' }}><WarningOutlined /> Not set</span>,
    },
    {
      title: 'Account No', key: 'account', width: 160,
      render: (_, r) => r.bank_account_no
        ? <Text copyable={{ text: r.bank_account_no }}>{`****${r.bank_account_no.slice(-4)}`}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Sort Code', key: 'sort', width: 100,
      render: (_, r) => r.bank_sort_code || <Text type="secondary">—</Text>,
    },
    {
      title: 'Net Pay (₦)', dataIndex: 'net_salary', key: 'net', align: 'right', width: 140,
      sorter: (a, b) => (a.net_salary || 0) - (b.net_salary || 0),
      render: v => <Text strong style={{ color: '#16a34a' }}>{fmt(v)}</Text>,
    },
    {
      title: 'Status', dataIndex: 'calc_status', key: 'status', width: 110,
      render: s => <StatusPill status={s} />,
    },
    {
      title: 'Ready', key: 'ready', width: 70, align: 'center',
      render: (_, r) => r.calc_status === 'calculated' && r.bank_account_no
        ? <CheckCircleOutlined style={{ color: '#16a34a' }} />
        : <WarningOutlined style={{ color: '#d97706' }} />,
    },
  ];

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <Select
          placeholder="Select Pay Period"
          style={{ minWidth: 260 }}
          onChange={setSelectedPeriodId}
          value={selectedPeriodId}
          showSearch
        >
          {periods.map(p => {
            const cfg = PERIOD_STATUS_CFG[p.status] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
            return (
              <Option key={p.id} value={p.id}>
                <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, marginRight: 6 }}>
                  {p.status}
                </span>
                {p.period_name}
              </Option>
            );
          })}
        </Select>
        <Select value={format} onChange={setFormat} style={{ width: 140 }}>
          <Option value="xlsx">Excel (.xlsx)</Option>
          <Option value="csv">CSV (.csv)</Option>
          <Option value="txt">Text (.txt)</Option>
        </Select>
        <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} loading={exporting} disabled={!selectedPeriodId}>
          Export Bank Sheet
        </Button>
        <Button icon={<SyncOutlined />} onClick={() => fetchSalaries(selectedPeriodId)} loading={loading} disabled={!selectedPeriodId}>
          Refresh
        </Button>
      </div>

      {!selectedPeriodId ? (
        <Alert type="info" showIcon message="Select a pay period to preview and export the bank payment sheet." />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <StatCard label="Total Payees" value={calculated.length} color="#2563eb" icon={<BankOutlined />} />
            <StatCard label="Total Transfer" value={fmt(totalNet)} color="#16a34a" sub="net pay" />
            <StatCard label="Average Net Pay" value={calculated.length > 0 ? fmt(Math.round(totalNet / calculated.length)) : '₦0'} color="#0891b2" />
            <StatCard
              label="Missing Bank Details"
              value={missingBank.length}
              color={missingBank.length > 0 ? '#dc2626' : '#16a34a'}
              icon={missingBank.length > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
            />
          </div>

          {missingBank.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`${missingBank.length} employee(s) have no bank account on file and will be excluded from the export.`}
              description={missingBank.slice(0, 5).map(s => s.employee_name).join(', ') + (missingBank.length > 5 ? ` +${missingBank.length - 5} more` : '')}
            />
          )}

          <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
              <Space>
                <Text strong>Bank Transfer Preview</Text>
                <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  {calculated.length} payees
                </span>
              </Space>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>Export</Button>
            </div>
            <Table
              dataSource={calculated}
              rowKey="id"
              loading={loading}
              columns={columns}
              size="small"
              scroll={{ x: 900 }}
              pagination={{ pageSize: 20, showTotal: t => `${t} records`, showSizeChanger: true }}
              rowClassName={r => !r.bank_account_no ? 'row-bank-warn' : ''}
              summary={() => calculated.length > 0 && (
                <Table.Summary.Row style={{ fontWeight: 600, background: '#e6f4ff' }}>
                  <Table.Summary.Cell index={0} colSpan={6}>
                    <Text strong>TOTAL ({calculated.length} transfers)</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong style={{ color: '#2563eb', fontSize: 15 }}>{fmt(totalNet)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} colSpan={2} />
                </Table.Summary.Row>
              )}
            />
          </div>
        </>
      )}

      <style>{`
        .row-bank-warn > td { background: rgba(217,119,6,0.03) !important; }
      `}</style>
    </div>
  );
};

export default BankSheetTab;
