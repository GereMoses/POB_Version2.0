import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Button, Select, Table, Space, App,
  Modal, Form, Input, InputNumber, Alert, Typography,
  Divider, Progress, Drawer, Descriptions, Tabs, Dropdown,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, EyeOutlined, DollarOutlined,
  ClockCircleOutlined, CloseCircleOutlined, SyncOutlined,
  CalculatorOutlined, MoreOutlined,
} from '@ant-design/icons';
import { apiCall, fmt } from '../payrollApi';

const { Option } = Select;
const { Text } = Typography;

const STATUS_CFG = {
  pending:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', row: 'rgba(217,119,6,0.04)',   label: 'Pending'   },
  active:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', row: 'rgba(22,163,74,0.04)',   label: 'Active'    },
  completed: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', row: 'rgba(37,99,235,0.03)',   label: 'Completed' },
  cancelled: { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', row: 'rgba(148,163,184,0.03)', label: 'Cancelled' },
};

const LOAN_TYPE_CFG = {
  SALARY_ADVANCE:  { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', label: 'Salary Advance'  },
  PERSONAL_LOAN:   { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Personal Loan'   },
  EMERGENCY_LOAN:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Emergency Loan'  },
  HOUSING_LOAN:    { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Housing Loan'    },
  VEHICLE_LOAN:    { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', label: 'Vehicle Loan'    },
};

const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status?.toLowerCase()] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: status };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.label?.toUpperCase()}
    </span>
  );
};

const TypePill = ({ type }) => {
  const cfg = LOAN_TYPE_CFG[type] || { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', label: type?.replace('_', ' ') || type };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
};

const StatCard = ({ label, value, color, icon }) => (
  <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '14px 16px', borderTop: `3px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      {icon && <span style={{ color, fontSize: 15, background: `${color}18`, borderRadius: 6, padding: '3px 6px', display: 'flex' }}>{icon}</span>}
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
  </div>
);

const LoansTab = ({ employees }) => {
  const { message, modal } = App.useApp();
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [applyModal, setApplyModal] = useState(false);
  const [applyForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [emiPreview, setEmiPreview] = useState(null);
  const [previewingEmi, setPreviewingEmi] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState({ open: false, loan: null });

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const data = await apiCall(`/api/v1/payroll/loans/${params}`);
      setLoans(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiCall('/api/v1/payroll/loans/summary/');
      setStats(data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchLoans(); fetchStats(); }, [fetchLoans, fetchStats]);

  const approveLoan = (id, emi) => modal.confirm({
    title: 'Approve this loan?',
    content: `EMI of ${fmt(emi)}/month will be deducted from payroll.`,
    okText: 'Approve',
    onOk: async () => {
      await apiCall(`/api/v1/payroll/loans/${id}/approve/`, { method: 'POST' });
      message.success('Loan approved');
      fetchLoans(); fetchStats();
    },
  });

  const openDetail = async (loan) => {
    try {
      const detail = await apiCall(`/api/v1/payroll/loans/${loan.id}/details/`);
      setDetailDrawer({ open: true, loan: detail });
    } catch {
      setDetailDrawer({ open: true, loan });
    }
  };

  const previewEmi = async () => {
    const values = applyForm.getFieldsValue();
    if (!values.loan_amount || !values.total_installments) {
      message.warning('Enter loan amount and number of installments first');
      return;
    }
    setPreviewingEmi(true);
    try {
      const result = await apiCall('/api/v1/payroll/loans/calculate-emi/', {
        method: 'POST',
        body: JSON.stringify({
          loan_amount: Number(values.loan_amount),
          total_installments: Number(values.total_installments),
          interest_rate: parseFloat(values.interest_rate || 0),
        }),
      });
      setEmiPreview(result);
    } catch (e) {
      message.error('EMI preview failed: ' + e.message);
    } finally {
      setPreviewingEmi(false);
    }
  };

  const submitLoan = async () => {
    try {
      const values = await applyForm.validateFields();
      setSaving(true);
      await apiCall('/api/v1/payroll/loans/', {
        method: 'POST',
        body: JSON.stringify({ ...values, loan_amount: Number(values.loan_amount), total_installments: Number(values.total_installments), interest_rate: parseFloat(values.interest_rate || 0) }),
      });
      message.success('Loan application submitted');
      setApplyModal(false);
      applyForm.resetFields();
      setEmiPreview(null);
      fetchLoans(); fetchStats();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredLoans = statusFilter === 'all' ? loans : loans.filter(l => l.status === statusFilter);
  const pendingCount = loans.filter(l => l.status === 'pending').length;

  const columns = [
    {
      title: 'Employee', dataIndex: 'employee_name', key: 'name',
      sorter: (a, b) => a.employee_name?.localeCompare(b.employee_name),
      render: v => <Text strong>{v}</Text>,
    },
    { title: 'Type', dataIndex: 'loan_type', key: 'type', width: 140, render: v => <TypePill type={v} /> },
    { title: 'Loan Amount', dataIndex: 'loan_amount', key: 'amount', align: 'right', width: 130, render: v => fmt(v) },
    { title: 'EMI/Month', dataIndex: 'emi_amount', key: 'emi', align: 'right', width: 120, render: v => <Text strong>{fmt(v)}</Text> },
    {
      title: 'Balance', dataIndex: 'balance', key: 'balance', align: 'right', width: 150,
      render: (v, r) => (
        <div>
          <Text style={{ color: v > 0 ? '#dc2626' : '#16a34a' }}>{fmt(v)}</Text>
          {r.loan_amount > 0 && (
            <Progress percent={Math.round((1 - v / r.loan_amount) * 100)} size="small" showInfo={false} status={v <= 0 ? 'success' : 'active'} style={{ marginTop: 2 }} />
          )}
        </div>
      ),
    },
    { title: 'Start', dataIndex: 'start_date', key: 'start', width: 110, render: d => d ? new Date(d).toLocaleDateString() : '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, render: s => <StatusPill status={s} /> },
    {
      title: '', key: 'actions', width: 50,
      render: (_, record) => {
        const items = [
          { key: 'view', icon: <EyeOutlined />, label: 'View Details', onClick: () => openDetail(record) },
        ];
        if (record.status === 'pending') {
          items.push({ key: 'approve', icon: <CheckCircleOutlined />, label: 'Approve Loan', onClick: () => approveLoan(record.id, record.emi_amount) });
        }
        return <Dropdown trigger={['click']} menu={{ items }}><Button size="small" type="text" icon={<MoreOutlined />} /></Dropdown>;
      },
    },
  ];

  return (
    <div>
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <StatCard label="Total Loans" value={stats.total_count || 0} color="#64748b" />
          <StatCard label="Active" value={stats.active_count || 0} color="#16a34a" icon={<CheckCircleOutlined />} />
          <StatCard label="Pending Approval" value={stats.pending_count || 0} color="#d97706" icon={<ClockCircleOutlined />} />
          <StatCard label="Total Outstanding" value={fmt(stats.total_outstanding || 0)} color="#dc2626" />
          <StatCard label="Monthly Deductions" value={fmt(stats.monthly_deductions || 0)} color="#2563eb" icon={<DollarOutlined />} />
        </div>
      )}

      {/* Filter tabs + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Tabs
          activeKey={statusFilter}
          onChange={k => setStatusFilter(k)}
          size="small"
          style={{ marginBottom: 0 }}
          items={[
            { key: 'all', label: 'All' },
            { key: 'pending', label: pendingCount > 0 ? <span>Pending <span style={{ display: 'inline-block', padding: '0 6px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: '#fff', background: '#d97706', marginLeft: 4 }}>{pendingCount}</span></span> : 'Pending' },
            { key: 'active', label: 'Active' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <Space size={8}>
          <Button icon={<SyncOutlined />} size="small" onClick={() => { fetchLoans(); fetchStats(); }}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { applyForm.resetFields(); setEmiPreview(null); setApplyModal(true); }}>
            New Loan / Advance
          </Button>
        </Space>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Table
          dataSource={filteredLoans}
          rowKey="id"
          loading={loading}
          columns={columns}
          size="small"
          rowClassName={r => `row-loan-${r.status}`}
          pagination={{ pageSize: 15, showTotal: t => `${t} loans` }}
        />
      </div>

      {/* Apply Loan Modal */}
      <Modal
        title={<span><DollarOutlined /> New Loan / Advance Application</span>}
        open={applyModal}
        onOk={submitLoan}
        onCancel={() => { setApplyModal(false); setEmiPreview(null); }}
        confirmLoading={saving}
        width={600}
      >
        <Form form={applyForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="emp_id" label="Employee" rules={[{ required: true }]}>
            <Select showSearch placeholder="Search employee…" filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())}
              options={employees.map(e => ({ value: e.id, label: `${e.full_name || e.name} (${e.badge_id})` }))} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="loan_type" label="Loan Type" initialValue="SALARY_ADVANCE" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(LOAN_TYPE_CFG).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="loan_amount" label="Loan Amount (₦)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChange={() => setEmiPreview(null)} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="total_installments" label="Installments" rules={[{ required: true }]}>
                <InputNumber min={1} max={60} style={{ width: '100%' }} onChange={() => setEmiPreview(null)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="interest_rate" label="Interest Rate (%)" initialValue={0}>
                <InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} onChange={() => setEmiPreview(null)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="start_date" label="Start Date" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="purpose" label="Purpose / Notes">
            <Input.TextArea rows={2} placeholder="Reason for loan application" />
          </Form.Item>
          <Button icon={<CalculatorOutlined />} onClick={previewEmi} loading={previewingEmi} style={{ marginBottom: 12 }}>
            Preview EMI Schedule
          </Button>
          {emiPreview && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div><div style={{ fontSize: 11, color: '#64748b' }}>Monthly EMI</div><div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>{fmt(emiPreview.emi_amount)}</div></div>
                <div><div style={{ fontSize: 11, color: '#64748b' }}>Total Repayment</div><div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{fmt(emiPreview.total_repayment)}</div></div>
                <div><div style={{ fontSize: 11, color: '#64748b' }}>Total Interest</div><div style={{ fontSize: 18, fontWeight: 700, color: emiPreview.total_interest > 0 ? '#d97706' : '#16a34a' }}>{fmt(emiPreview.total_interest)}</div></div>
              </div>
              {emiPreview.schedule?.length > 0 && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <Table
                    dataSource={emiPreview.schedule.slice(0, 6)}
                    rowKey="installment_no"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: '#', dataIndex: 'installment_no', key: 'no', width: 40 },
                      { title: 'EMI', dataIndex: 'emi', key: 'emi', align: 'right', render: v => fmt(v) },
                      { title: 'Principal', dataIndex: 'principal', key: 'pri', align: 'right', render: v => fmt(v) },
                      { title: 'Interest', dataIndex: 'interest', key: 'int', align: 'right', render: v => fmt(v) },
                      { title: 'Balance', dataIndex: 'balance', key: 'bal', align: 'right', render: v => fmt(v) },
                    ]}
                    footer={() => emiPreview.schedule.length > 6
                      ? <Text type="secondary">… and {emiPreview.schedule.length - 6} more installments</Text>
                      : null}
                  />
                </>
              )}
            </div>
          )}
        </Form>
      </Modal>

      {/* Loan Detail Drawer */}
      <Drawer
        title={`Loan Details — ${detailDrawer.loan?.employee_name}`}
        open={detailDrawer.open}
        onClose={() => setDetailDrawer({ open: false, loan: null })}
        width={540}
      >
        {detailDrawer.loan && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Loan Type"><TypePill type={detailDrawer.loan.loan_type} /></Descriptions.Item>
              <Descriptions.Item label="Status"><StatusPill status={detailDrawer.loan.status} /></Descriptions.Item>
              <Descriptions.Item label="Loan Amount">{fmt(detailDrawer.loan.loan_amount)}</Descriptions.Item>
              <Descriptions.Item label="Balance"><Text style={{ color: detailDrawer.loan.balance > 0 ? '#dc2626' : '#16a34a' }}>{fmt(detailDrawer.loan.balance)}</Text></Descriptions.Item>
              <Descriptions.Item label="EMI/Month">{fmt(detailDrawer.loan.emi_amount)}</Descriptions.Item>
              <Descriptions.Item label="Interest Rate">{detailDrawer.loan.interest_rate || 0}%</Descriptions.Item>
              <Descriptions.Item label="Start Date">{detailDrawer.loan.start_date ? new Date(detailDrawer.loan.start_date).toLocaleDateString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="End Date">{detailDrawer.loan.end_date ? new Date(detailDrawer.loan.end_date).toLocaleDateString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="Installments" span={2}>{detailDrawer.loan.paid_installments || 0} / {detailDrawer.loan.total_installments || 0} paid</Descriptions.Item>
            </Descriptions>
            {detailDrawer.loan.loan_amount > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">Repayment Progress</Text>
                <Progress percent={Math.round((1 - (detailDrawer.loan.balance || 0) / detailDrawer.loan.loan_amount) * 100)} status={detailDrawer.loan.balance <= 0 ? 'success' : 'active'} format={p => `${p}% repaid`} />
              </div>
            )}
            {detailDrawer.loan.deductions?.length > 0 && (
              <>
                <Divider orientation="left">Deduction History</Divider>
                <Table
                  dataSource={detailDrawer.loan.deductions}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 8 }}
                  columns={[
                    { title: 'Period', dataIndex: 'period_id', key: 'period', width: 80 },
                    { title: 'EMI', dataIndex: 'emi_amount', key: 'emi', align: 'right', render: v => fmt(v) },
                    { title: 'Principal', dataIndex: 'principal_amount', key: 'pri', align: 'right', render: v => fmt(v) },
                    { title: 'Interest', dataIndex: 'interest_amount', key: 'int', align: 'right', render: v => fmt(v) },
                    { title: 'Date', dataIndex: 'deduction_date', key: 'date', width: 110, render: d => d ? new Date(d).toLocaleDateString() : '—' },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Drawer>

      <style>{`
        .row-loan-pending > td { background: rgba(217,119,6,0.04) !important; }
        .row-loan-active > td { background: rgba(22,163,74,0.03) !important; }
        .row-loan-completed > td { background: rgba(37,99,235,0.03) !important; }
        .row-loan-cancelled > td { background: rgba(148,163,184,0.03) !important; }
      `}</style>
    </div>
  );
};

export default LoansTab;
