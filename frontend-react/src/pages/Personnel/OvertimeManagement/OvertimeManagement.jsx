import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Card, Row, Col,
  Tag, Popconfirm, DatePicker, TimePicker, InputNumber, Tabs, Statistic,
  Tooltip, App,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SettingOutlined, StopOutlined, TeamOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const STATUS_COLORS = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
  processed: 'blue',
};

const TYPE_COLORS = {
  daily: 'blue',
  weekly: 'purple',
  weekend: 'cyan',
  holiday: 'volcano',
  special: 'magenta',
};

const OvertimeManagement = () => {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  // ── filter state ────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');

  // ── OT request modal state ──────────────────────────────────────────────────
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [requestForm] = Form.useForm();

  // ── reject modal state ──────────────────────────────────────────────────────
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectForm] = Form.useForm();

  // ── rule modal state ────────────────────────────────────────────────────────
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm] = Form.useForm();

  // ── bulk selection ──────────────────────────────────────────────────────────
  const [selectedRequestKeys, setSelectedRequestKeys] = useState([]);
  const [selectedRuleKeys, setSelectedRuleKeys] = useState([]);

  const [activeTab, setActiveTab] = useState('requests');

  // ── queries ─────────────────────────────────────────────────────────────────

  const { data: overtimeRaw, isLoading: overtimeLoading, refetch: refetchOvertime } = useQuery({
    queryKey: ['overtime-requests'],
    queryFn: () => apiService.get('/api/v1/personnel/overtime'),
    staleTime: 30000,
  });

  const { data: rulesRaw, isLoading: rulesLoading, refetch: refetchRules } = useQuery({
    queryKey: ['overtime-rules'],
    queryFn: () => apiService.get('/api/v1/personnel/overtime/rules'),
    staleTime: 60000,
  });

  const { data: personnelRaw } = useQuery({
    queryKey: ['personnel-list-ot'],
    queryFn: () => apiService.get('/api/v1/personnel/?limit=1000'),
    staleTime: 300000,
  });

  const { data: summaryRaw } = useQuery({
    queryKey: ['overtime-summary'],
    queryFn: () => apiService.get('/api/v1/personnel/overtime/summary'),
    staleTime: 60000,
  });

  // ── derived data ─────────────────────────────────────────────────────────────

  const overtime = useMemo(() => {
    const raw = overtimeRaw?.data || overtimeRaw || [];
    return Array.isArray(raw) ? raw : [];
  }, [overtimeRaw]);

  const rules = useMemo(() => {
    const raw = rulesRaw?.data || rulesRaw || [];
    return Array.isArray(raw) ? raw : [];
  }, [rulesRaw]);

  const personnelList = useMemo(() => {
    const raw = personnelRaw?.results || personnelRaw?.data || personnelRaw || [];
    return Array.isArray(raw) ? raw : [];
  }, [personnelRaw]);

  const summary = summaryRaw?.data || summaryRaw || {};

  const filteredOvertime = useMemo(() => {
    return overtime.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterType && r.overtime_type !== filterType) return false;
      if (filterEmployee) {
        const name = (r.personnel_name || '').toLowerCase();
        const code = (r.personnel_emp_code || '').toLowerCase();
        const q = filterEmployee.toLowerCase();
        if (!name.includes(q) && !code.includes(q)) return false;
      }
      return true;
    });
  }, [overtime, filterStatus, filterType, filterEmployee]);

  // ── helpers ──────────────────────────────────────────────────────────────────

  const calcHours = useCallback((startVal, endVal) => {
    if (!startVal || !endVal) return null;
    const diff = endVal.diff(startVal, 'minute');
    if (diff <= 0) return null;
    return Math.round((diff / 60) * 100) / 100;
  }, []);

  const onTimesChange = useCallback(() => {
    setTimeout(() => {
      const start = requestForm.getFieldValue('start_time');
      const end = requestForm.getFieldValue('end_time');
      const hours = calcHours(start, end);
      if (hours !== null) {
        requestForm.setFieldsValue({ hours_worked: hours });
      }
    }, 0);
  }, [requestForm, calcHours]);

  // ── mutations ────────────────────────────────────────────────────────────────

  const invalidateOT = () => queryClient.invalidateQueries({ queryKey: ['overtime-requests'] });
  const invalidateSummary = () => queryClient.invalidateQueries({ queryKey: ['overtime-summary'] });

  const requestMutation = useMutation({
    mutationFn: (data) =>
      editingRecord
        ? apiService.put(`/api/v1/personnel/overtime/${editingRecord.id}`, data)
        : apiService.post('/api/v1/personnel/overtime', data),
    onSuccess: () => {
      message.success(editingRecord ? 'Overtime request updated' : 'Overtime request submitted');
      setRequestModalOpen(false);
      setEditingRecord(null);
      invalidateOT();
      invalidateSummary();
    },
    onError: (err) => message.error(err?.response?.data?.detail || err.message || 'Operation failed'),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => apiService.put(`/api/v1/personnel/overtime/${id}/approve`),
    onSuccess: () => { message.success('Overtime request approved'); invalidateOT(); invalidateSummary(); },
    onError: (err) => message.error(err?.response?.data?.detail || 'Approval failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, rejection_reason }) =>
      apiService.put(`/api/v1/personnel/overtime/${id}/reject`, { rejection_reason }),
    onSuccess: () => {
      message.success('Overtime request rejected');
      setRejectModalOpen(false);
      setRejectingId(null);
      rejectForm.resetFields();
      invalidateOT();
      invalidateSummary();
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Rejection failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => apiService.put(`/api/v1/personnel/overtime/${id}/cancel`),
    onSuccess: () => { message.success('Overtime request cancelled'); invalidateOT(); invalidateSummary(); },
    onError: (err) => message.error(err?.response?.data?.detail || 'Cancel failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/overtime/${id}`),
    onSuccess: () => { message.success('Overtime request deleted'); invalidateOT(); invalidateSummary(); },
    onError: (err) => message.error(err?.response?.data?.detail || 'Delete failed'),
  });

  const bulkDeleteOT = async () => {
    if (!selectedRequestKeys.length) return;
    modal.confirm({
      title: `Delete ${selectedRequestKeys.length} overtime request(s)?`,
      icon: <ExclamationCircleOutlined />,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        await Promise.all(
          selectedRequestKeys.map((id) => apiService.delete(`/api/v1/personnel/overtime/${id}`))
        );
        message.success('Selected requests deleted');
        setSelectedRequestKeys([]);
        invalidateOT();
        invalidateSummary();
      },
    });
  };

  // ── rules mutations ──────────────────────────────────────────────────────────

  const ruleMutation = useMutation({
    mutationFn: (data) =>
      editingRule
        ? apiService.put(`/api/v1/personnel/overtime/rules/${editingRule.id}`, data)
        : apiService.post('/api/v1/personnel/overtime/rules', data),
    onSuccess: () => {
      message.success(editingRule ? 'Rule updated' : 'Rule created');
      setRuleModalOpen(false);
      setEditingRule(null);
      queryClient.invalidateQueries({ queryKey: ['overtime-rules'] });
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Rule operation failed'),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/overtime/rules/${id}`),
    onSuccess: () => {
      message.success('Rule deleted');
      queryClient.invalidateQueries({ queryKey: ['overtime-rules'] });
    },
    onError: (err) => message.error(err?.response?.data?.detail || 'Delete failed'),
  });

  const bulkDeleteRules = async () => {
    if (!selectedRuleKeys.length) return;
    modal.confirm({
      title: `Delete ${selectedRuleKeys.length} rule(s)?`,
      icon: <ExclamationCircleOutlined />,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        await Promise.all(
          selectedRuleKeys.map((id) => apiService.delete(`/api/v1/personnel/overtime/rules/${id}`))
        );
        message.success('Selected rules deleted');
        setSelectedRuleKeys([]);
        queryClient.invalidateQueries({ queryKey: ['overtime-rules'] });
      },
    });
  };

  // ── handlers ─────────────────────────────────────────────────────────────────

  const openAddRequest = () => {
    setEditingRecord(null);
    setRequestModalOpen(true);
    setTimeout(() => requestForm.resetFields(), 0);
  };

  const openEditRequest = (record) => {
    setEditingRecord(record);
    setRequestModalOpen(true);
    setTimeout(() => {
      requestForm.setFieldsValue({
        ...record,
        date: record.date ? dayjs(record.date) : null,
        start_time: record.start_time ? dayjs(record.start_time, 'HH:mm:ss') : null,
        end_time: record.end_time ? dayjs(record.end_time, 'HH:mm:ss') : null,
      });
    }, 0);
  };

  const submitRequest = () => {
    requestForm.validateFields().then((values) => {
      requestMutation.mutate({
        ...values,
        date: values.date ? values.date.format('YYYY-MM-DD') : null,
        start_time: values.start_time ? values.start_time.format('HH:mm:ss') : null,
        end_time: values.end_time ? values.end_time.format('HH:mm:ss') : null,
      });
    }).catch(() => {});
  };

  const openRejectModal = (id) => {
    setRejectingId(id);
    setRejectModalOpen(true);
    setTimeout(() => rejectForm.resetFields(), 0);
  };

  const submitReject = () => {
    rejectForm.validateFields().then((values) => {
      rejectMutation.mutate({ id: rejectingId, ...values });
    }).catch(() => {});
  };

  const openAddRule = () => {
    setEditingRule(null);
    setRuleModalOpen(true);
    setTimeout(() => ruleForm.resetFields(), 0);
  };

  const openEditRule = (rule) => {
    setEditingRule(rule);
    setRuleModalOpen(true);
    setTimeout(() => ruleForm.setFieldsValue(rule), 0);
  };

  const submitRule = () => {
    ruleForm.validateFields().then((values) => {
      ruleMutation.mutate(values);
    }).catch(() => {});
  };

  // ── columns ──────────────────────────────────────────────────────────────────

  const requestColumns = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.personnel_name || `ID ${r.personnel_id}`}</div>
          {r.personnel_emp_code && (
            <div style={{ fontSize: 11, color: '#888' }}>{r.personnel_emp_code}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'overtime_type',
      render: (t) => <Tag color={TYPE_COLORS[t] || 'default'}>{t?.toUpperCase()}</Tag>,
    },
    { title: 'Date', dataIndex: 'date', render: (d) => d || '—' },
    { title: 'Start', dataIndex: 'start_time', render: (t) => t ? t.slice(0, 5) : '—' },
    { title: 'End', dataIndex: 'end_time', render: (t) => t ? t.slice(0, 5) : '—' },
    {
      title: 'Hrs Worked',
      dataIndex: 'hours_worked',
      render: (h) => h != null ? Number(h).toFixed(2) : '—',
    },
    {
      title: 'OT Hrs',
      dataIndex: 'overtime_hours',
      render: (h) => <Tag color="orange">{h != null ? Number(h).toFixed(2) : '—'}</Tag>,
    },
    {
      title: 'Compensation',
      dataIndex: 'compensation_type',
      render: (t) => t ? <Tag color="purple">{t}</Tag> : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s) => <Tag color={STATUS_COLORS[s] || 'default'}>{s?.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 220,
      render: (_, record) => (
        <Space size="small" wrap>
          {record.status === 'pending' && (
            <>
              <Tooltip title="Approve">
                <Button
                  type="primary" size="small" icon={<CheckCircleOutlined />}
                  onClick={() => approveMutation.mutate(record.id)}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  danger size="small" icon={<CloseCircleOutlined />}
                  onClick={() => openRejectModal(record.id)}
                />
              </Tooltip>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditRequest(record)} />
              </Tooltip>
            </>
          )}
          {record.status === 'approved' && (
            <Tooltip title="Cancel">
              <Button
                size="small" icon={<StopOutlined />}
                onClick={() => cancelMutation.mutate(record.id)}
              />
            </Tooltip>
          )}
          {record.status !== 'approved' && (
            <Popconfirm
              title="Delete this request?"
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button danger size="small" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const ruleColumns = [
    { title: 'Rule Name', dataIndex: 'rule_name', sorter: (a, b) => a.rule_name.localeCompare(b.rule_name) },
    {
      title: 'Type',
      dataIndex: 'rule_type',
      render: (t) => <Tag color={TYPE_COLORS[t] || 'default'}>{t?.toUpperCase()}</Tag>,
    },
    {
      title: 'Daily Threshold',
      dataIndex: 'daily_threshold_hours',
      render: (h) => h != null ? `${h}h` : '—',
    },
    {
      title: 'Weekly Threshold',
      dataIndex: 'weekly_threshold_hours',
      render: (h) => h != null ? `${h}h` : '—',
    },
    {
      title: 'Monthly Threshold',
      dataIndex: 'monthly_threshold_hours',
      render: (h) => h != null ? `${h}h` : '—',
    },
    {
      title: 'Rate Multiplier',
      dataIndex: 'rate_multiplier',
      render: (r) => <Tag color="green">{r}×</Tag>,
    },
    {
      title: 'Applies To',
      dataIndex: 'applies_to',
      render: (a) => <Tag>{a}</Tag>,
    },
    {
      title: 'Approval',
      dataIndex: 'requires_approval',
      render: (v) => <Tag color={v ? 'orange' : 'green'}>{v ? 'Required' : 'Auto'}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, rule) => (
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditRule(rule)} />
          </Tooltip>
          <Popconfirm
            title="Delete this rule?"
            onConfirm={() => deleteRuleMutation.mutate(rule.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── personnel select options ──────────────────────────────────────────────────

  const personnelOptions = personnelList.map((p) => ({
    value: p.id,
    label: `${p.first_name || ''} ${p.last_name || ''}`.trim() + (p.emp_code ? ` (${p.emp_code})` : ''),
  }));

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { title: 'Total Requests', value: summary.total ?? overtime.length, color: '#1677ff', icon: <ClockCircleOutlined /> },
          { title: 'Pending', value: summary.pending ?? overtime.filter((r) => r.status === 'pending').length, color: '#fa8c16', icon: <ExclamationCircleOutlined /> },
          { title: 'Approved', value: summary.approved ?? overtime.filter((r) => r.status === 'approved').length, color: '#52c41a', icon: <CheckCircleOutlined /> },
          { title: 'Total OT Hours', value: summary.total_overtime_hours != null ? Number(summary.total_overtime_hours).toFixed(1) : '—', color: '#722ed1', icon: <TeamOutlined /> },
        ].map((s) => (
          <Col span={6} key={s.title}>
            <Card size="small">
              <Statistic
                title={s.title}
                value={s.value}
                valueStyle={{ color: s.color }}
                prefix={s.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'requests',
              label: <span><ClockCircleOutlined style={{ marginRight: 4 }} />Overtime Requests</span>,
              children: (
                <>
                  {/* Filters */}
                  <Row gutter={12} style={{ marginBottom: 16 }}>
                    <Col span={7}>
                      <Input
                        placeholder="Search employee..."
                        value={filterEmployee}
                        onChange={(e) => setFilterEmployee(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col span={5}>
                      <Select
                        placeholder="All Types"
                        style={{ width: '100%' }}
                        value={filterType || undefined}
                        onChange={(v) => setFilterType(v || '')}
                        allowClear
                      >
                        {['daily', 'weekly', 'weekend', 'holiday', 'special'].map((t) => (
                          <Select.Option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={5}>
                      <Select
                        placeholder="All Statuses"
                        style={{ width: '100%' }}
                        value={filterStatus || undefined}
                        onChange={(v) => setFilterStatus(v || '')}
                        allowClear
                      >
                        {['pending', 'approved', 'rejected', 'cancelled', 'processed'].map((s) => (
                          <Select.Option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</Select.Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={7}>
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAddRequest}>
                          New Request
                        </Button>
                        {selectedRequestKeys.length > 0 && (
                          <Button danger icon={<DeleteOutlined />} onClick={bulkDeleteOT}>
                            Delete ({selectedRequestKeys.length})
                          </Button>
                        )}
                        <Button icon={<ReloadOutlined />} onClick={() => { refetchOvertime(); invalidateSummary(); }} />
                      </Space>
                    </Col>
                  </Row>

                  <Table
                    columns={requestColumns}
                    dataSource={filteredOvertime}
                    loading={overtimeLoading}
                    rowKey="id"
                    rowSelection={{
                      selectedRowKeys: selectedRequestKeys,
                      onChange: setSelectedRequestKeys,
                      getCheckboxProps: (r) => ({ disabled: r.status === 'approved' }),
                    }}
                    pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `Total ${t}` }}
                    scroll={{ x: 1400 }}
                    size="small"
                  />
                </>
              ),
            },
            {
              key: 'rules',
              label: <span><SettingOutlined style={{ marginRight: 4 }} />Overtime Rules</span>,
              children: (
                <>
                  <Row gutter={12} style={{ marginBottom: 16 }}>
                    <Col>
                      <Space>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAddRule}>
                          Add Rule
                        </Button>
                        {selectedRuleKeys.length > 0 && (
                          <Button danger icon={<DeleteOutlined />} onClick={bulkDeleteRules}>
                            Delete ({selectedRuleKeys.length})
                          </Button>
                        )}
                        <Button icon={<ReloadOutlined />} onClick={refetchRules} />
                      </Space>
                    </Col>
                  </Row>

                  <Table
                    columns={ruleColumns}
                    dataSource={rules}
                    loading={rulesLoading}
                    rowKey="id"
                    rowSelection={{
                      selectedRowKeys: selectedRuleKeys,
                      onChange: setSelectedRuleKeys,
                    }}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    scroll={{ x: 1200 }}
                    size="small"
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* ── Overtime Request Modal ─────────────────────────────────────────── */}
      <Modal
        title={editingRecord ? 'Edit Overtime Request' : 'New Overtime Request'}
        open={requestModalOpen}
        onOk={submitRequest}
        onCancel={() => { setRequestModalOpen(false); setEditingRecord(null); }}
        confirmLoading={requestMutation.isPending}
        width={720}
        forceRender
      >
        <Form form={requestForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Employee" rules={[{ required: true, message: 'Select employee' }]}>
                <Select
                  showSearch
                  placeholder="Select employee"
                  options={personnelOptions}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="overtime_type" label="Overtime Type" rules={[{ required: true, message: 'Select type' }]}>
                <Select placeholder="Select type">
                  {['daily', 'weekly', 'weekend', 'holiday', 'special'].map((t) => (
                    <Select.Option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Select date' }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="compensation_type" label="Compensation Type">
                <Select placeholder="Select compensation type" allowClear>
                  <Select.Option value="pay">Pay</Select.Option>
                  <Select.Option value="time_off">Time Off</Select.Option>
                  <Select.Option value="mixed">Mixed</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_time" label="Start Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} onChange={onTimesChange} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_time" label="End Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} onChange={onTimesChange} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="hours_worked" label="Hours Worked (auto)">
                <InputNumber min={0} step={0.25} style={{ width: '100%' }} precision={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="overtime_hours" label="Overtime Hours">
                <InputNumber min={0} step={0.25} style={{ width: '100%' }} precision={2} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Reason for overtime" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Reject Modal ──────────────────────────────────────────────────── */}
      <Modal
        title="Reject Overtime Request"
        open={rejectModalOpen}
        onOk={submitReject}
        onCancel={() => { setRejectModalOpen(false); setRejectingId(null); }}
        confirmLoading={rejectMutation.isPending}
        okText="Reject"
        okButtonProps={{ danger: true }}
        forceRender
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="rejection_reason"
            label="Rejection Reason"
            rules={[{ required: true, message: 'Please provide rejection reason' }]}
          >
            <Input.TextArea rows={4} placeholder="Reason for rejection" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Rule Modal ────────────────────────────────────────────────────── */}
      <Modal
        title={editingRule ? 'Edit Overtime Rule' : 'New Overtime Rule'}
        open={ruleModalOpen}
        onOk={submitRule}
        onCancel={() => { setRuleModalOpen(false); setEditingRule(null); }}
        confirmLoading={ruleMutation.isPending}
        width={680}
        forceRender
      >
        <Form form={ruleForm} layout="vertical" initialValues={{ rate_multiplier: 1.5, requires_approval: true, applies_to: 'all', is_active: true }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rule_name" label="Rule Name" rules={[{ required: true, message: 'Enter rule name' }]}>
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rule_type" label="Rule Type" rules={[{ required: true, message: 'Select type' }]}>
                <Select placeholder="Select type">
                  {['daily', 'weekly', 'weekend', 'holiday', 'special'].map((t) => (
                    <Select.Option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="daily_threshold_hours" label="Daily Threshold (hrs)">
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="weekly_threshold_hours" label="Weekly Threshold (hrs)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="monthly_threshold_hours" label="Monthly Threshold (hrs)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="rate_multiplier" label="Rate Multiplier" rules={[{ required: true }]}>
                <InputNumber min={1} max={5} step={0.1} style={{ width: '100%' }} precision={2} addonAfter="×" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_daily_hours" label="Max Daily OT Hrs">
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_weekly_hours" label="Max Weekly OT Hrs">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="applies_to" label="Applies To">
                <Select>
                  <Select.Option value="all">All</Select.Option>
                  <Select.Option value="STAFF">Staff</Select.Option>
                  <Select.Option value="CONTRACTOR">Contractor</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="requires_approval" label="Requires Approval">
                <Select>
                  <Select.Option value={true}>Yes</Select.Option>
                  <Select.Option value={false}>No (Auto)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_active" label="Status">
                <Select>
                  <Select.Option value={true}>Active</Select.Option>
                  <Select.Option value={false}>Inactive</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default OvertimeManagement;
