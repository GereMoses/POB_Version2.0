import React, { useState, useEffect, useCallback } from 'react';
import {
  Segmented, Select, InputNumber, Input, Switch, Button, Table, Tag, Space,
  Row, Col, Card, Statistic, App, Divider, Descriptions, Empty, Tooltip,
} from 'antd';
import {
  DollarOutlined, PlayCircleOutlined, FileTextOutlined, BankOutlined,
  CalculatorOutlined, SaveOutlined, CheckOutlined, SafetyCertificateOutlined,
  DownloadOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { apiCall, fmt } from '../payrollApi';

const BASE = '/api/v1/payroll/statutory';
const empLabel = e => `${e.emp_code || e.id} — ${e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || ''}`;

const STATUS_COLOR = { calculated: 'blue', verified: 'gold', approved: 'green', pending: 'default' };

/* ── Compensation editor ──────────────────────────────────────────────────── */
const Compensation = ({ employees }) => {
  const { message } = App.useApp();
  const [empId, setEmpId] = useState(null);
  const [f, setF] = useState({ basic: 0, housing: 0, transport: 0, other_allowances: 0, nhf_enabled: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async id => {
    try {
      const c = await apiCall(`${BASE}/compensation/${id}`);
      setF({ ...c });
    } catch { setF({ basic: 0, housing: 0, transport: 0, other_allowances: 0, nhf_enabled: true }); }
  }, []);

  const gross = Number(f.basic || 0) + Number(f.housing || 0) + Number(f.transport || 0) + Number(f.other_allowances || 0);
  const num = k => <InputNumber style={{ width: '100%' }} min={0} value={f[k]}
    onChange={v => setF(s => ({ ...s, [k]: v }))} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/,/g, '')} />;
  const txt = k => <Input value={f[k]} onChange={e => setF(s => ({ ...s, [k]: e.target.value }))} />;

  const save = async () => {
    if (!empId) return message.warning('Select an employee');
    setSaving(true);
    try {
      await apiCall(`${BASE}/compensation/${empId}`, { method: 'PUT', body: JSON.stringify(f) });
      message.success('Compensation saved');
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Row gutter={16}>
      <Col span={14}>
        <Card size="small" title="Employee compensation">
          <Select showSearch style={{ width: '100%', marginBottom: 12 }} placeholder="Select employee"
            optionFilterProp="label" value={empId}
            onChange={id => { setEmpId(id); load(id); }}
            options={(employees || []).map(e => ({ value: e.id, label: empLabel(e) }))} />
          <Row gutter={12}>
            <Col span={12}><label>Basic</label>{num('basic')}</Col>
            <Col span={12}><label>Housing</label>{num('housing')}</Col>
            <Col span={12}><label>Transport</label>{num('transport')}</Col>
            <Col span={12}><label>Other allowances</label>{num('other_allowances')}</Col>
          </Row>
          <Divider style={{ margin: '12px 0' }}>Statutory identifiers</Divider>
          <Row gutter={12}>
            <Col span={8}><label>TIN</label>{txt('tin')}</Col>
            <Col span={8}><label>RSA PIN</label>{txt('rsa_pin')}</Col>
            <Col span={8}><label>PFA</label>{txt('pfa_name')}</Col>
            <Col span={8}><label>NHF number</label>{txt('nhf_number')}</Col>
            <Col span={8}><label>Tax state</label>{txt('tax_state')}</Col>
            <Col span={8}><label>Grade</label>{txt('grade')}</Col>
            <Col span={12}><label>Bank</label>{txt('bank_name')}</Col>
            <Col span={12}><label>Account no.</label>{txt('bank_account_no')}</Col>
          </Row>
          <Space style={{ marginTop: 14 }}>
            <span>NHF (2.5%)</span>
            <Switch checked={f.nhf_enabled} onChange={v => setF(s => ({ ...s, nhf_enabled: v }))} />
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Save</Button>
          </Space>
        </Card>
      </Col>
      <Col span={10}>
        <Card size="small" title="Gross (monthly)">
          <Statistic value={gross} prefix="₦" precision={2} valueStyle={{ color: '#1677ff' }} />
          <div style={{ color: '#8c8c8c', marginTop: 8, fontSize: 12 }}>
            Basic+Housing+Transport form the pension base (8% / 10%). NHF is 2.5% of basic.
          </div>
        </Card>
      </Col>
    </Row>
  );
};

/* ── Run payroll ──────────────────────────────────────────────────────────── */
const RunPayroll = ({ periods }) => {
  const { message } = App.useApp();
  const [pid, setPid] = useState(null);
  const [cumulative, setCumulative] = useState(true);
  const [running, setRunning] = useState(false);
  const [res, setRes] = useState(null);

  const run = async () => {
    if (!pid) return message.warning('Select a period');
    setRunning(true); setRes(null);
    try {
      const r = await apiCall(`${BASE}/run/bulk?period_id=${pid}&cumulative=${cumulative}`, { method: 'POST' });
      setRes(r); message.success(`Processed ${r.processed} employee(s)`);
    } catch (e) { message.error(e.message); } finally { setRunning(false); }
  };

  return (
    <Card size="small">
      <Space wrap>
        <Select style={{ width: 240 }} placeholder="Pay period" value={pid} onChange={setPid}
          options={(periods || []).map(p => ({ value: p.id, label: p.period_name }))} />
        <Tooltip title="Year-to-date cumulative PAYE (correct on mid-year changes)">
          <span>Cumulative PAYE <Switch checked={cumulative} onChange={setCumulative} /></span>
        </Tooltip>
        <Button type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={run}>Run bulk payroll</Button>
      </Space>
      {res && (
        <Row gutter={16} style={{ marginTop: 18 }}>
          <Col span={4}><Statistic title="Processed" value={res.processed} /></Col>
          <Col span={5}><Statistic title="Gross" value={res.totals.gross} prefix="₦" precision={2} /></Col>
          <Col span={5}><Statistic title="PAYE" value={res.totals.paye} prefix="₦" precision={2} /></Col>
          <Col span={5}><Statistic title="Pension (emp)" value={res.totals.pension_emp} prefix="₦" precision={2} /></Col>
          <Col span={5}><Statistic title="Net payout" value={res.totals.net} prefix="₦" precision={2} valueStyle={{ color: '#1a7f37' }} /></Col>
          {res.failed > 0 && <Col span={24} style={{ color: '#cf1322', marginTop: 8 }}>{res.failed} failed: {res.errors.map(e => `#${e.emp_id} ${e.error}`).join('; ')}</Col>}
        </Row>
      )}
    </Card>
  );
};

/* ── Payslips & approval (maker-checker) ──────────────────────────────────── */
const Payslips = ({ periods }) => {
  const { message } = App.useApp();
  const [pid, setPid] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async id => {
    if (!id) return;
    setLoading(true);
    try { const r = await apiCall(`${BASE}/period/${id}/salaries`); setRows(r.rows); }
    catch (e) { message.error(e.message); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { if (pid) load(pid); }, [pid, load]);

  const act = async (salaryId, action) => {
    try { await apiCall(`${BASE}/payslip/${salaryId}/${action}`, { method: 'POST' }); message.success(action + 'd'); load(pid); }
    catch (e) { message.error(e.message); }
  };
  const viewPdf = async salaryId => {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${BASE}/payslip/${salaryId}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('PDF failed');
      window.open(URL.createObjectURL(await r.blob()), '_blank');
    } catch (e) { message.error(e.message); }
  };

  const cols = [
    { title: 'Staff', dataIndex: 'emp_code', render: (v, r) => <span>{v} <span style={{ color: '#8c8c8c' }}>{r.name}</span></span> },
    { title: 'Gross', dataIndex: 'gross', align: 'right', render: fmt },
    { title: 'Deductions', dataIndex: 'deductions', align: 'right', render: fmt },
    { title: 'Net', dataIndex: 'net', align: 'right', render: v => <b>{fmt(v)}</b> },
    { title: 'Status', dataIndex: 'status', render: s => <Tag color={STATUS_COLOR[s] || 'default'}>{s.toUpperCase()}</Tag> },
    {
      title: 'Actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => viewPdf(r.salary_id)}>PDF</Button>
          {r.status === 'calculated' && <Button size="small" onClick={() => act(r.salary_id, 'verify')}>Verify</Button>}
          {r.status === 'verified' && <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => act(r.salary_id, 'approve')}>Approve</Button>}
          {(r.status === 'approved' || r.status === 'verified') && <Button size="small" danger onClick={() => act(r.salary_id, 'reopen')}>Reopen</Button>}
        </Space>
      ),
    },
  ];

  return (
    <Card size="small">
      <Space style={{ marginBottom: 12 }}>
        <Select style={{ width: 240 }} placeholder="Pay period" value={pid} onChange={setPid}
          options={(periods || []).map(p => ({ value: p.id, label: p.period_name }))} />
        <Button icon={<ReloadOutlined />} onClick={() => load(pid)} disabled={!pid}>Refresh</Button>
        <span style={{ color: '#8c8c8c', fontSize: 12 }}>Maker-checker: preparer ≠ verifier ≠ approver enforced.</span>
      </Space>
      <Table size="small" rowKey="salary_id" loading={loading} columns={cols} dataSource={rows}
        pagination={false} locale={{ emptyText: 'Run payroll for a period to see payslips' }} />
    </Card>
  );
};

/* ── Remittance schedules ─────────────────────────────────────────────────── */
const Schedules = ({ periods }) => {
  const { message } = App.useApp();
  const [pid, setPid] = useState(null);
  const [kind, setKind] = useState('paye');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id, k) => {
    if (!id) return; setLoading(true);
    try { setData(await apiCall(`${BASE}/schedule/${k}?period_id=${id}`)); }
    catch (e) { message.error(e.message); } finally { setLoading(false); }
  }, [message]);
  useEffect(() => { if (pid) load(pid, kind); }, [pid, kind, load]);

  const colsByKind = {
    paye: [['emp_code', 'Staff'], ['tin', 'TIN'], ['tax_state', 'State'], ['gross', 'Gross', 1], ['paye', 'PAYE', 1]],
    pension: [['emp_code', 'Staff'], ['rsa_pin', 'RSA PIN'], ['pfa', 'PFA'], ['employee', 'Employee', 1], ['employer', 'Employer', 1], ['total', 'Total', 1]],
    bank: [['emp_code', 'Staff'], ['bank', 'Bank'], ['account_no', 'Account'], ['amount', 'Net', 1]],
  };
  const cols = (colsByKind[kind] || []).map(([k, t, money]) => ({ title: t, dataIndex: k, align: money ? 'right' : 'left', render: money ? fmt : undefined }));

  return (
    <Card size="small">
      <Space style={{ marginBottom: 12 }}>
        <Select style={{ width: 240 }} placeholder="Pay period" value={pid} onChange={setPid}
          options={(periods || []).map(p => ({ value: p.id, label: p.period_name }))} />
        <Segmented value={kind} onChange={setKind} options={[
          { label: 'PAYE (to IRS)', value: 'paye' }, { label: 'Pension (PFA)', value: 'pension' }, { label: 'Bank payment', value: 'bank' }]} />
      </Space>
      <Table size="small" rowKey={(_, i) => i} loading={loading} columns={cols} dataSource={data?.rows || []}
        pagination={false} summary={() => data && (
          <Table.Summary.Row>
            <Table.Summary.Cell colSpan={cols.length - 1}><b>Total</b></Table.Summary.Cell>
            <Table.Summary.Cell align="right"><b>{fmt(data.total)}</b></Table.Summary.Cell>
          </Table.Summary.Row>)} />
    </Card>
  );
};

/* ── Off-cycle adjustments (arrears / bonus / one-off deductions) ─────────── */
const Adjustments = ({ periods, employees }) => {
  const { message } = App.useApp();
  const [pid, setPid] = useState(null);
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ emp_id: null, name: '', amount: 0, adj_type: 'earning', is_taxable: true });

  const load = useCallback(async id => {
    if (!id) return;
    try { setRows(await apiCall(`${BASE}/adjustments?period_id=${id}`)); }
    catch (e) { message.error(e.message); }
  }, [message]);
  useEffect(() => { if (pid) load(pid); }, [pid, load]);

  const add = async () => {
    if (!pid || !f.emp_id || !f.name) return message.warning('Period, employee and name required');
    try {
      await apiCall(`${BASE}/adjustments`, { method: 'POST', body: JSON.stringify({ ...f, period_id: pid }) });
      message.success('Added — re-run payroll to apply'); setF(s => ({ ...s, name: '', amount: 0 })); load(pid);
    } catch (e) { message.error(e.message); }
  };
  const del = async id => { try { await apiCall(`${BASE}/adjustments/${id}`, { method: 'DELETE' }); load(pid); } catch (e) { message.error(e.message); } };

  const empName = id => { const e = (employees || []).find(x => x.id === id); return e ? empLabel(e) : id; };
  return (
    <Card size="small">
      <Space wrap style={{ marginBottom: 12 }}>
        <Select style={{ width: 220 }} placeholder="Pay period" value={pid} onChange={setPid}
          options={(periods || []).map(p => ({ value: p.id, label: p.period_name }))} />
        <Select showSearch style={{ width: 240 }} placeholder="Employee" optionFilterProp="label" value={f.emp_id}
          onChange={v => setF(s => ({ ...s, emp_id: v }))}
          options={(employees || []).map(e => ({ value: e.id, label: empLabel(e) }))} />
        <Input style={{ width: 180 }} placeholder="Name e.g. May arrears" value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} />
        <InputNumber style={{ width: 130 }} min={0} placeholder="Amount" value={f.amount} onChange={v => setF(s => ({ ...s, amount: v }))} />
        <Select style={{ width: 130 }} value={f.adj_type} onChange={v => setF(s => ({ ...s, adj_type: v }))}
          options={[{ value: 'earning', label: 'Earning' }, { value: 'deduction', label: 'Deduction' }]} />
        <Tooltip title="Taxable earnings feed the PAYE base"><span>Taxable <Switch checked={f.is_taxable} onChange={v => setF(s => ({ ...s, is_taxable: v }))} /></span></Tooltip>
        <Button type="primary" onClick={add}>Add</Button>
      </Space>
      <Table size="small" rowKey="id" dataSource={rows} pagination={false}
        columns={[
          { title: 'Employee', dataIndex: 'emp_id', render: empName },
          { title: 'Name', dataIndex: 'name' },
          { title: 'Type', dataIndex: 'adj_type', render: (t, r) => <Tag color={t === 'earning' ? 'green' : 'red'}>{t}{t === 'earning' && !r.is_taxable ? ' (non-tax)' : ''}</Tag> },
          { title: 'Amount', dataIndex: 'amount', align: 'right', render: fmt },
          { title: '', render: (_, r) => <Button size="small" danger onClick={() => del(r.id)}>Remove</Button> },
        ]}
        locale={{ emptyText: 'No adjustments for this period' }} />
      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 8 }}>After adding, re-run payroll for the period (Run Payroll tab) to apply.</div>
    </Card>
  );
};

/* ── Tax preview calculator ───────────────────────────────────────────────── */
const Preview = () => {
  const { message } = App.useApp();
  const [f, setF] = useState({ basic: 300000, housing: 100000, transport: 50000, other_taxable: 50000 });
  const [res, setRes] = useState(null);
  const num = k => <InputNumber style={{ width: '100%' }} min={0} value={f[k]} onChange={v => setF(s => ({ ...s, [k]: v }))} />;
  const compute = async () => {
    try { setRes(await apiCall(`${BASE}/preview`, { method: 'POST', body: JSON.stringify(f) })); }
    catch (e) { message.error(e.message); }
  };
  return (
    <Row gutter={16}>
      <Col span={9}>
        <Card size="small" title="Salary components (monthly)">
          <Row gutter={12}>
            <Col span={12}><label>Basic</label>{num('basic')}</Col>
            <Col span={12}><label>Housing</label>{num('housing')}</Col>
            <Col span={12}><label>Transport</label>{num('transport')}</Col>
            <Col span={12}><label>Other taxable</label>{num('other_taxable')}</Col>
          </Row>
          <Button type="primary" icon={<CalculatorOutlined />} style={{ marginTop: 12 }} onClick={compute}>Compute PAYE</Button>
        </Card>
      </Col>
      <Col span={15}>
        {res ? (
          <Card size="small" title="Statutory breakdown">
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Gross (monthly)">{fmt(res.gross_monthly)}</Descriptions.Item>
              <Descriptions.Item label="Annual gross">{fmt(res.annual_gross)}</Descriptions.Item>
              <Descriptions.Item label="CRA (annual)">{fmt(res.cra_annual)}</Descriptions.Item>
              <Descriptions.Item label="Taxable (annual)">{fmt(res.taxable_annual)}</Descriptions.Item>
              <Descriptions.Item label="Pension (8%)">{fmt(res.employee_deductions.pension)}</Descriptions.Item>
              <Descriptions.Item label="NHF (2.5%)">{fmt(res.employee_deductions.nhf)}</Descriptions.Item>
              <Descriptions.Item label="PAYE">{fmt(res.employee_deductions.paye)}</Descriptions.Item>
              <Descriptions.Item label="Net pay"><b style={{ color: '#1a7f37' }}>{fmt(res.net_monthly)}</b></Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '12px 0' }}>PAYE bands (annual)</Divider>
            <Table size="small" pagination={false} rowKey={(_, i) => i} dataSource={res.paye_band_breakdown}
              columns={[{ title: 'Band', dataIndex: 'band' },
                { title: 'Amount taxed', dataIndex: 'amount_taxed', align: 'right', render: fmt },
                { title: 'Tax', dataIndex: 'tax', align: 'right', render: fmt }]} />
            {res.notes?.length > 0 && <div style={{ color: '#d46b08', marginTop: 8, fontSize: 12 }}>{res.notes.join(' ')}</div>}
          </Card>
        ) : <Empty description="Enter components and compute" style={{ marginTop: 40 }} />}
      </Col>
    </Row>
  );
};

/* ── Container ────────────────────────────────────────────────────────────── */
const StatutoryTab = ({ periods, employees }) => {
  const [view, setView] = useState('Compensation');
  const opts = [
    { label: 'Compensation', value: 'Compensation', icon: <DollarOutlined /> },
    { label: 'Run Payroll', value: 'Run Payroll', icon: <PlayCircleOutlined /> },
    { label: 'Payslips & Approval', value: 'Payslips', icon: <FileTextOutlined /> },
    { label: 'Adjustments', value: 'Adjustments', icon: <DollarOutlined /> },
    { label: 'Schedules', value: 'Schedules', icon: <BankOutlined /> },
    { label: 'Tax Preview', value: 'Preview', icon: <CalculatorOutlined /> },
  ];
  return (
    <div>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <SafetyCertificateOutlined style={{ color: '#1677ff', fontSize: 18 }} />
        <b>Nigerian Statutory Payroll</b>
        <span style={{ color: '#8c8c8c', fontSize: 12 }}>PAYE · Pension · NHF · NSITF · ITF — YTD cumulative, maker-checker, remittance schedules</span>
      </div>
      <Segmented style={{ marginBottom: 16 }} value={view} onChange={setView} options={opts} />
      {view === 'Compensation' && <Compensation employees={employees} />}
      {view === 'Run Payroll' && <RunPayroll periods={periods} />}
      {view === 'Payslips' && <Payslips periods={periods} />}
      {view === 'Adjustments' && <Adjustments periods={periods} employees={employees} />}
      {view === 'Schedules' && <Schedules periods={periods} />}
      {view === 'Preview' && <Preview />}
    </div>
  );
};

export default StatutoryTab;
