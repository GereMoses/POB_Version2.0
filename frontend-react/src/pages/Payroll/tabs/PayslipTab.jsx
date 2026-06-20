import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Button, Select, Table, Space, App,
  Modal, Form, Input, Alert, Typography, Tabs, Switch, Dropdown,
} from 'antd';
import {
  FileTextOutlined, SendOutlined, SettingOutlined,
  DownloadOutlined, MailOutlined, PlusOutlined,
  CheckCircleOutlined, MoreOutlined,
} from '@ant-design/icons';
import { apiCall, fmt } from '../payrollApi';

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

const CALC_STATUS_CFG = {
  calculated: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Calculated' },
  pending:    { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Pending'     },
  failed:     { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Failed'      },
};

const TEMPLATE_TYPE_CFG = {
  STANDARD:   { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Standard'   },
  DETAILED:   { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', label: 'Detailed'   },
  CONTRACTOR: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Contractor' },
};

const StatusPill = ({ status }) => {
  const cfg = CALC_STATUS_CFG[status?.toLowerCase()] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: status };
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>;
};

const TemplatePill = ({ type }) => {
  const cfg = TEMPLATE_TYPE_CFG[type] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: type };
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>;
};

const StatCard = ({ label, value, color }) => (
  <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '12px 14px', borderTop: `3px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
  </div>
);

const PayslipTab = ({ periods, employees }) => {
  const { message } = App.useApp();
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loadingSalaries, setLoadingSalaries] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateModal, setTemplateModal] = useState({ open: false, record: null });
  const [templateForm] = Form.useForm();
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('generate');

  const fetchSalaries = useCallback(async (pid) => {
    if (!pid) return;
    setLoadingSalaries(true);
    try {
      const data = await apiCall(`/api/v1/payroll/salaries/?period_id=${pid}`);
      setSalaries(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoadingSalaries(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await apiCall('/api/v1/payroll/payslip/template/');
      setTemplates(Array.isArray(data) ? data : []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { if (selectedPeriodId) fetchSalaries(selectedPeriodId); else setSalaries([]); }, [selectedPeriodId, fetchSalaries]);

  const targetSalaries = selectedEmpIds.length > 0
    ? salaries.filter(s => selectedEmpIds.includes(s.emp_id))
    : salaries;
  const calculatedSalaries = targetSalaries.filter(s => s.calc_status === 'calculated');

  const generateBulk = async () => {
    if (calculatedSalaries.length === 0) { message.warning('No calculated salaries to generate payslips for'); return; }
    setGenerating(true);
    try {
      await apiCall('/api/v1/payroll/payslip/bulk-generate/', { method: 'POST', body: JSON.stringify({ salary_ids: calculatedSalaries.map(s => s.id) }) });
      message.success(`${calculatedSalaries.length} payslips generated`);
    } catch (e) {
      message.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPayslip = async (salaryId, empName) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/payroll/payslip/${salaryId}/`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${empName?.replace(/\s/g, '_')}_${salaryId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error(e.message);
    }
  };

  const sendEmail = async (salaryId) => {
    try {
      await apiCall(`/api/v1/payroll/payslip/${salaryId}/send-email/`, { method: 'POST' });
      message.success('Payslip emailed successfully');
    } catch (e) {
      message.error(e.message);
    }
  };

  const bulkEmail = async () => {
    if (calculatedSalaries.length === 0) { message.warning('No calculated salaries selected'); return; }
    setEmailing(true);
    try {
      const result = await apiCall('/api/v1/payroll/payslip/bulk-email/', { method: 'POST', body: JSON.stringify({ salary_ids: calculatedSalaries.map(s => s.id) }) });
      message.success(`${result?.sent_count || calculatedSalaries.length} payslips sent by email`);
    } catch (e) {
      message.error(e.message);
    } finally {
      setEmailing(false);
    }
  };

  const saveTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      setSavingTemplate(true);
      await apiCall('/api/v1/payroll/payslip/template/', { method: 'POST', body: JSON.stringify(values) });
      message.success('Template saved');
      setTemplateModal({ open: false, record: null });
      await fetchTemplates();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const totalNetPay = calculatedSalaries.reduce((s, r) => s + (r.net_salary || 0), 0);

  const salaryColumns = [
    { title: 'Employee', dataIndex: 'employee_name', key: 'name', sorter: (a, b) => a.employee_name?.localeCompare(b.employee_name), render: v => <Text strong>{v}</Text> },
    { title: 'Badge', dataIndex: 'employee_badge_id', key: 'badge', width: 90 },
    { title: 'Net Pay', dataIndex: 'net_salary', key: 'net', align: 'right', width: 130, render: v => <Text strong style={{ color: '#2563eb' }}>{fmt(v)}</Text> },
    { title: 'Status', dataIndex: 'calc_status', key: 'status', width: 110, render: s => <StatusPill status={s} /> },
    {
      title: '', key: 'actions', width: 50,
      render: (_, record) => {
        const disabled = record.calc_status !== 'calculated';
        const items = [
          { key: 'pdf', icon: <DownloadOutlined />, label: 'Download PDF', disabled, onClick: () => downloadPayslip(record.id, record.employee_name) },
          { key: 'email', icon: <MailOutlined />, label: 'Send Email', disabled, onClick: () => sendEmail(record.id) },
        ];
        return <Dropdown trigger={['click']} menu={{ items }}><Button size="small" type="text" icon={<MoreOutlined />} /></Dropdown>;
      },
    },
  ];

  const templateColumns = [
    { title: 'Name', dataIndex: 'template_name', key: 'name', render: v => <Text strong>{v}</Text> },
    { title: 'Type', dataIndex: 'template_type', key: 'type', render: v => <TemplatePill type={v} /> },
    { title: 'Active', dataIndex: 'is_active', key: 'active', width: 80, render: v => v ? <CheckCircleOutlined style={{ color: '#16a34a' }} /> : '—' },
    { title: 'Created', dataIndex: 'created_at', key: 'created', width: 130, render: v => v ? new Date(v).toLocaleDateString() : '—' },
  ];

  return (
    <div>
      <Tabs
        activeKey={activeSubTab}
        onChange={setActiveSubTab}
        size="small"
        items={[
          {
            key: 'generate',
            label: <span><FileTextOutlined /> Generate &amp; Send</span>,
            children: (
              <div style={{ paddingTop: 12 }}>
                {/* Inline filter bar */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                  <Select
                    placeholder="Select Pay Period"
                    style={{ minWidth: 220 }}
                    onChange={setSelectedPeriodId}
                    value={selectedPeriodId}
                    showSearch
                  >
                    {periods.map(p => <Option key={p.id} value={p.id}>{p.period_name}</Option>)}
                  </Select>
                  <Select
                    mode="multiple"
                    placeholder="Filter employees (blank = all)"
                    style={{ minWidth: 240 }}
                    onChange={setSelectedEmpIds}
                    value={selectedEmpIds}
                    showSearch
                    filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())}
                    options={employees.map(e => ({ value: e.id, label: `${e.full_name || e.name} (${e.badge_id})` }))}
                    maxTagCount={2}
                  />
                  <Button type="primary" icon={<FileTextOutlined />} loading={generating} onClick={generateBulk} disabled={!selectedPeriodId}>
                    Generate ({calculatedSalaries.length})
                  </Button>
                  <Button icon={<SendOutlined />} loading={emailing} onClick={bulkEmail} disabled={!selectedPeriodId}>
                    Bulk Email
                  </Button>
                </div>

                {!selectedPeriodId ? (
                  <Alert type="info" showIcon message="Select a pay period to manage payslips." />
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                      <StatCard label="Total" value={salaries.length} color="#64748b" />
                      <StatCard label="Calculated" value={calculatedSalaries.length} color="#16a34a" />
                      <StatCard label="Total Net Pay" value={fmt(totalNetPay)} color="#2563eb" />
                      <StatCard label="Selected" value={selectedEmpIds.length || 'All'} color="#7c3aed" />
                    </div>
                    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                      <Table
                        dataSource={targetSalaries}
                        rowKey="id"
                        loading={loadingSalaries}
                        columns={salaryColumns}
                        size="small"
                        rowClassName={r => r.calc_status !== 'calculated' ? 'row-payslip-pending' : ''}
                        pagination={{ pageSize: 15, showTotal: t => `${t} employees` }}
                        rowSelection={{
                          selectedRowKeys: selectedEmpIds,
                          onChange: keys => setSelectedEmpIds(keys),
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            ),
          },
          {
            key: 'templates',
            label: <span><SettingOutlined /> Payslip Templates</span>,
            children: (
              <div style={{ paddingTop: 12 }}>
                <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <Text strong>Payslip Templates</Text>
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { templateForm.resetFields(); setTemplateModal({ open: true, record: null }); }}>
                      New Template
                    </Button>
                  </div>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5' }}>
                    <Alert type="info" showIcon message="Templates use HTML/CSS with Jinja2 variables. Three types: STANDARD (staff), DETAILED (management), CONTRACTOR." />
                  </div>
                  <Table dataSource={templates} rowKey="id" size="small" columns={templateColumns} pagination={false} />
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={templateModal.record ? 'Edit Template' : 'Create Payslip Template'}
        open={templateModal.open}
        onOk={saveTemplate}
        onCancel={() => setTemplateModal({ open: false, record: null })}
        confirmLoading={savingTemplate}
        width={740}
      >
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Use Jinja2 syntax: {{ employee_name }}, {{ net_salary }}, {{ period_name }}, {{ items }}, etc." />
        <Form form={templateForm} layout="vertical">
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="template_name" label="Template Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Standard Monthly Payslip" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="template_type" label="Type" rules={[{ required: true }]}>
                <Select>
                  <Option value="STANDARD">Standard</Option>
                  <Option value="DETAILED">Detailed</Option>
                  <Option value="CONTRACTOR">Contractor</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="header_html" label="Header HTML">
            <TextArea rows={4} style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder="<div>Company letterhead…</div>" />
          </Form.Item>
          <Form.Item name="body_html" label="Body HTML" rules={[{ required: true }]}>
            <TextArea rows={10} style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder="<table>{% for item in items %}<tr>…</tr>{% endfor %}</table>" />
          </Form.Item>
          <Form.Item name="footer_html" label="Footer HTML">
            <TextArea rows={3} style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder="<div>Verification: {{ verification_code }}</div>" />
          </Form.Item>
          <Form.Item name="css_styles" label="CSS Styles">
            <TextArea rows={4} style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder=".header { color: #333; } …" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .row-payslip-pending > td { background: rgba(217,119,6,0.03) !important; }
      `}</style>
    </div>
  );
};

export default PayslipTab;
