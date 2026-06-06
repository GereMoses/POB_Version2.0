import React, { useState, useMemo } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, Switch, Tooltip,
  Progress, Row, Col, Card, Statistic, Popconfirm, Tabs, Badge, Alert,
  Typography, Divider, App, List, Input,
} from 'antd';
import {
  UserOutlined, ReloadOutlined, SendOutlined, DeleteOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  DownloadOutlined, ScanOutlined, InfoCircleOutlined, ThunderboltOutlined,
  PoweroffOutlined, WarningOutlined, SearchOutlined, FilterOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import deviceAPI from '../../../services/deviceAPI';
import usePersonnel from '../../../hooks/usePersonnel';

const { Text } = Typography;

/* ── Enrollment status table ──────────────────────────────────────────────── */

const STATUS_CFG = {
  active:   { color: 'success',   label: 'Active'    },
  inactive: { color: 'error',     label: 'Inactive'  },
  on_leave: { color: 'warning',   label: 'On Leave'  },
  offshore: { color: 'processing',label: 'Offshore'  },
  onshore:  { color: 'cyan',      label: 'Onshore'   },
  transit:  { color: 'purple',    label: 'In Transit'},
};

const EnrollmentStatus = ({ terminals }) => {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [enrollModal, setEnrollModal] = useState(false);
  const [pushModal, setPushModal] = useState(false);
  const [cardModal, setCardModal] = useState(false);
  const [cardSyncModal, setCardSyncModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [selectedEmpRow, setSelectedEmpRow] = useState(null);
  const [enrollForm] = Form.useForm();
  const [pushForm] = Form.useForm();
  const [cardForm] = Form.useForm();
  const [cardSyncForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [enrollFilter, setEnrollFilter] = useState('all');

  const { personnel } = usePersonnel();
  const empCodeOptions = (personnel || []).map(p => ({
    value: p.emp_code,
    label: `${p.emp_code} — ${[p.first_name, p.last_name].filter(Boolean).join(' ')}`,
  }));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['enrollment-status'],
    queryFn: () => deviceAPI.getEnrollmentStatus(),
    staleTime: 0,
    refetchOnMount: true,
  });

  const allRows = data?.data ?? [];

  // Client-side filtering
  const rows = useMemo(() => {
    let r = allRows;
    if (searchText) {
      const q = searchText.toLowerCase();
      r = r.filter(e =>
        e.emp_code?.toLowerCase().includes(q) ||
        e.emp_name?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') r = r.filter(e => (e.status || 'active') === statusFilter);
    if (enrollFilter === 'enrolled')     r = r.filter(e => e.total_templates > 0);
    if (enrollFilter === 'not_enrolled') r = r.filter(e => e.total_templates === 0);
    return r;
  }, [allRows, searchText, statusFilter, enrollFilter]);

  // ADMS queue enrollment (legacy push-mode devices)
  const admsEnrollMutation = useMutation({
    mutationFn: ({ sn, emp_code }) => deviceAPI.enableEnrollmentMode(sn, emp_code),
    onSuccess: () => {
      message.success('Enrollment command queued — device will prompt on next poll');
      setEnrollModal(false);
      enrollForm.resetFields();
    },
    onError: (e) => message.error(e.message),
  });

  const pushMutation = useMutation({
    mutationFn: (payload) => deviceAPI.pushTemplates(payload),
    onSuccess: (res) => {
      message.success(`${res?.data?.commands_queued ?? 0} push commands queued`);
      setPushModal(false);
      pushForm.resetFields();
      qc.invalidateQueries(['enrollment-status']);
    },
    onError: (e) => message.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ emp_code, finger_id }) => deviceAPI.deleteTemplate(emp_code, finger_id),
    onSuccess: () => { message.success('Template deleted'); qc.invalidateQueries(['enrollment-status']); },
    onError: (e) => message.error(e.message),
  });

  const resetDeviceMutation = useMutation({
    mutationFn: (sn) => deviceAPI.cancelEnrollment(sn),
    onSuccess: () => message.success('Device reset — enrollment cancelled, device re-enabled'),
    onError: (e) => message.error(e.message || 'Reset failed'),
  });

  const directEnrollMutation = useMutation({
    mutationFn: ({ sn, emp_code, finger_id }) =>
      deviceAPI.enrollDirect({ sn, emp_code, finger_id }),
    onSuccess: (res) => {
      const d = res?.data;
      if (d?.captured) {
        message.success('Fingerprint captured and saved to database');
      } else {
        message.info(d?.message ?? 'Enrollment triggered — pull templates after the employee scans');
      }
      setEnrollModal(false);
      enrollForm.resetFields();
      setEnrollSN(null);
      qc.invalidateQueries(['enrollment-status']);
    },
    onError: (e) => message.error(e?.response?.data?.detail ?? e.message ?? 'Direct enrollment failed'),
  });

  const pullMutation = useMutation({
    mutationFn: (sn) => deviceAPI.pullTemplatesFromDevice(sn),
    onSuccess: (res) => {
      const d = res?.data;
      message.success(`Synced ${d?.saved ?? 0} template(s) from device`);
      qc.invalidateQueries(['enrollment-status']);
    },
    onError: (e) => message.error(e?.response?.data?.detail ?? e.message ?? 'Pull failed'),
  });

  const terminalOptions = (terminals ?? []).map(t => ({ value: t.sn, label: t.alias || t.sn }));

  // A terminal with an IP address can be enrolled directly via ZKLib
  const [enrollSN, setEnrollSN] = useState(null);
  const [directFingerId, setDirectFingerId] = useState(0);
  const selectedTerminal = (terminals ?? []).find(t => t.sn === enrollSN);
  const isDirect = !!(selectedTerminal?.ip_address);

  // Bulk mutations
  const bulkDeleteMutation = useMutation({
    mutationFn: (codes) => Promise.all(codes.map(c => deviceAPI.deleteTemplate(c))),
    onSuccess: () => {
      message.success(`Templates deleted for ${selectedRowKeys.length} employee(s)`);
      setSelectedRowKeys([]);
      qc.invalidateQueries(['enrollment-status']);
    },
    onError: (e) => message.error(e.message || 'Bulk delete failed'),
  });

  // Card mutations
  const assignCardMutation = useMutation({
    mutationFn: (vals) => deviceAPI.assignCard({ emp_code: vals.emp_code, card_number: vals.card_number || null }),
    onSuccess: (res) => {
      const d = res?.data ?? {};
      message.success(d.message || 'Card updated');
      setCardModal(false);
      cardForm.resetFields();
      qc.invalidateQueries(['enrollment-status']);
    },
    onError: (e) => message.error(e.message || 'Failed to assign card'),
  });

  const syncCardMutation = useMutation({
    mutationFn: (vals) => deviceAPI.syncCard({ emp_code: vals.emp_code, target_sns: vals.target_sns }),
    onSuccess: (res) => {
      const d = res?.data ?? {};
      message.success(`Card synced to ${d.synced ?? 0} of ${d.total ?? 0} device(s)`);
      setCardSyncModal(false);
      cardSyncForm.resetFields();
    },
    onError: (e) => message.error(e.message || 'Card sync failed'),
  });

  const columns = [
    {
      title: 'Employee',
      sorter: (a, b) => (a.emp_name || '').localeCompare(b.emp_name || ''),
      render: (_, r) => {
        const sc = STATUS_CFG[r.status] || STATUS_CFG.active;
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {r.emp_name || '—'}
              <Tag
                color={sc.color}
                style={{ fontSize: 10, padding: '0 5px', lineHeight: '16px', marginLeft: 2 }}
              >
                {r.separation_reason || sc.label}
              </Tag>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>
              {r.emp_code}
              {r.department && <span style={{ marginLeft: 8, color: '#6B7280' }}>· {r.department}</span>}
              {r.position  && <span style={{ marginLeft: 4, color: '#9CA3AF' }}>· {r.position}</span>}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Fingerprints',
      render: (_, r) => r.fingerprints.length === 0
        ? <Tag color="default" style={{ fontSize: 11 }}>None enrolled</Tag>
        : r.fingerprints.map(fp => (
          <Tag key={fp} color="blue" style={{ fontSize: 11 }}>{fp.toUpperCase()}</Tag>
        )),
    },
    {
      title: 'Face',
      dataIndex: 'face_enrolled',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.face_enrolled ? 1 : 0) - (b.face_enrolled ? 1 : 0),
      render: (v, r) => v
        ? (
          <Tooltip title={r.source_devices?.length ? `From device: ${r.source_devices.join(', ')}` : 'Face template enrolled'}>
            <Tag color="gold" style={{ fontSize: 10, padding: '0 5px', cursor: 'default' }}>
              <CheckCircleOutlined /> Face
            </Tag>
          </Tooltip>
        )
        : <CloseCircleOutlined style={{ color: '#d9d9d9', fontSize: 14 }} />,
    },
    {
      title: 'Templates',
      dataIndex: 'total_templates',
      width: 85,
      align: 'center',
      sorter: (a, b) => a.total_templates - b.total_templates,
      render: v => <Badge count={v} showZero color={v > 0 ? '#1890ff' : '#d9d9d9'} />,
    },
    {
      title: 'Card',
      width: 130,
      align: 'center',
      sorter: (a, b) => (a.card_number ? 1 : 0) - (b.card_number ? 1 : 0),
      render: (_, r) => r.card_number
        ? (
          <Tooltip title={`RFID: ${r.card_number}`}>
            <Tag
              color="geekblue"
              style={{ cursor: 'pointer', fontSize: 11 }}
              onClick={() => { setSelectedEmpRow(r); cardForm.setFieldsValue({ emp_code: r.emp_code, card_number: r.card_number }); setCardModal(true); }}
            >
              ● {r.badge_id || r.card_number}
            </Tag>
          </Tooltip>
        )
        : (
          <Tooltip title="Assign a physical access card">
            <Button
              size="small" type="dashed" style={{ fontSize: 11 }}
              onClick={() => { setSelectedEmpRow(r); cardForm.setFieldsValue({ emp_code: r.emp_code, card_number: undefined }); setCardModal(true); }}
            >
              + Assign Card
            </Button>
          </Tooltip>
        ),
    },
    {
      title: 'Actions',
      width: 155,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Enroll fingerprint on device">
            <Button size="small" icon={<ScanOutlined />}
              onClick={() => { setSelectedEmp(r.emp_code); setEnrollSN(null); setEnrollModal(true); }}>
              Enroll
            </Button>
          </Tooltip>
          <Tooltip title="Push stored templates to device(s)">
            <Button size="small" icon={<SendOutlined />} type="primary" ghost
              disabled={r.total_templates === 0}
              onClick={() => { setSelectedEmp(r.emp_code); setPushModal(true); }}>
              Push
            </Button>
          </Tooltip>
          <Tooltip title={r.card_number ? 'Sync card to device(s)' : 'Assign card first'}>
            <Button size="small" icon={<SendOutlined />}
              disabled={!r.card_number}
              onClick={() => {
                setSelectedEmpRow(r);
                cardSyncForm.setFieldsValue({ emp_code: r.emp_code, target_sns: [] });
                setCardSyncModal(true);
              }}
            >
              Card
            </Button>
          </Tooltip>
          <Popconfirm
            title="Delete ALL templates for this employee?"
            onConfirm={() => deleteMutation.mutate({ emp_code: r.emp_code })}
            okText="Delete" okType="danger"
            disabled={r.total_templates === 0}
          >
            <Tooltip title="Remove all stored templates">
              <Button size="small" danger icon={<DeleteOutlined />} disabled={r.total_templates === 0} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Summary counts
  const totalActive   = allRows.filter(r => (r.status || 'active') === 'active').length;
  const totalInactive = allRows.filter(r => r.status === 'inactive').length;
  const totalEnrolled = allRows.filter(r => r.total_templates > 0).length;

  return (
    <>
      <Alert
        type="info" showIcon icon={<InfoCircleOutlined />}
        style={{ marginBottom: 14 }}
        message="Recommended enrollment workflow"
        description={
          <div style={{ fontSize: 12.5, marginTop: 4 }}>
            <strong>Direct-connect devices (F18):</strong> Employee enrolls at the device menu → come back and click <strong>Pull Templates</strong> in the Per-Device Report tab.<br />
            <strong>ADMS devices:</strong> Click <em>Enroll</em> → command is queued → device prompts employee on next poll.<br />
            <strong>Device stuck?</strong> Use <em>Enroll → Reset Device</em>.
          </div>
        }
      />

      {/* Summary bar */}
      <Row gutter={12} style={{ marginBottom: 14 }}>
        {[
          { label: 'Total',        value: allRows.length,   color: '#1890ff' },
          { label: 'Active',       value: totalActive,      color: '#52c41a' },
          { label: 'Inactive',     value: totalInactive,    color: '#ff4d4f' },
          { label: 'Enrolled',     value: totalEnrolled,    color: '#722ed1' },
          { label: 'Not Enrolled', value: allRows.length - totalEnrolled, color: '#faad14' },
        ].map(s => (
          <Col key={s.label} flex="1">
            <Card size="small" style={{ textAlign: 'center' }} styles={{ body: { padding: '8px 4px' } }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filter / search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input.Search
          placeholder="Search name, code, department…"
          allowClear
          style={{ width: 240 }}
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          onSearch={setSearchText}
          onChange={e => !e.target.value && setSearchText('')}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 140 }}
          options={[
            { value: 'all',      label: 'All Statuses' },
            { value: 'active',   label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'on_leave', label: 'On Leave' },
            { value: 'offshore', label: 'Offshore' },
            { value: 'onshore',  label: 'Onshore' },
            { value: 'transit',  label: 'In Transit' },
          ]}
          suffixIcon={<FilterOutlined />}
        />
        <Select
          value={enrollFilter}
          onChange={setEnrollFilter}
          style={{ width: 150 }}
          options={[
            { value: 'all',         label: 'All Employees' },
            { value: 'enrolled',    label: 'Enrolled only' },
            { value: 'not_enrolled',label: 'Not enrolled' },
          ]}
        />
        <div style={{ marginLeft: 'auto' }}>
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading}>Refresh</Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedRowKeys.length > 0 && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
          padding: '8px 14px', marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontWeight: 600, color: '#1D4ED8' }}>
            {selectedRowKeys.length} employee{selectedRowKeys.length > 1 ? 's' : ''} selected
          </span>
          <Button
            size="small" icon={<SendOutlined />} type="primary" ghost
            onClick={() => {
              setSelectedEmp(selectedRowKeys[0]);
              setPushModal(true);
            }}
          >
            Push Templates
          </Button>
          <Popconfirm
            title={`Delete all templates for ${selectedRowKeys.length} employee(s)?`}
            description="This cannot be undone."
            onConfirm={() => bulkDeleteMutation.mutate(selectedRowKeys)}
            okText="Delete All" okType="danger"
          >
            <Button size="small" danger icon={<DeleteOutlined />}
              loading={bulkDeleteMutation.isPending}>
              Delete Templates
            </Button>
          </Popconfirm>
          <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear</Button>
        </div>
      )}

      <Table
        dataSource={rows}
        columns={columns}
        rowKey={r => r.emp_code}
        size="small"
        loading={isLoading}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          getCheckboxProps: r => ({ name: r.emp_code }),
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} employees`,
        }}
        scroll={{ x: 700 }}
        rowClassName={r => r.status === 'inactive' ? 'row-inactive' : r.total_templates === 0 ? 'row-unenrolled' : ''}
      />

      {/* Enroll Modal */}
      <Modal
        title={<Space><ScanOutlined />Fingerprint Enrollment</Space>}
        open={enrollModal}
        onCancel={() => { setEnrollModal(false); enrollForm.resetFields(); setEnrollSN(null); }}
        footer={null}
        destroyOnHidden
        width={560}
      >
        <Form
          form={enrollForm}
          layout="vertical"
          initialValues={{ emp_code: selectedEmp }}
          onFinish={(vals) => {
            admsEnrollMutation.mutate({ sn: vals.sn, emp_code: String(vals.emp_code) });
          }}
        >
          <Form.Item name="sn" label="Target Device" rules={[{ required: true, message: 'Select a device' }]}>
            <Select options={terminalOptions} placeholder="Select device" onChange={(v) => setEnrollSN(v)} />
          </Form.Item>

          {/* Direct-connect: live remote capture */}
          {isDirect && (
            <>
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                style={{ marginBottom: 14 }}
                message={`Remote enrollment supported — ${selectedTerminal?.alias || enrollSN}`}
                description={
                  <span style={{ fontSize: 12 }}>
                    This device is reachable over the network. Click <strong>Start Enrollment</strong> below — the
                    device will activate its fingerprint scanner. The employee then presses their finger on the
                    reader (they do <em>not</em> need to navigate the device menu).
                  </span>
                }
              />

              {/* Employee selector */}
              <Form.Item name="emp_code" label="Employee" rules={[{ required: true, message: 'Select an employee' }]}>
                <Select
                  options={empCodeOptions}
                  showSearch
                  placeholder="Select employee"
                  filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())}
                />
              </Form.Item>

              {/* Finger slot selector */}
              <Form.Item label="Finger Slot" required>
                <Select
                  value={directFingerId}
                  onChange={setDirectFingerId}
                  style={{ width: '100%' }}
                >
                  {[
                    [0,'Right Thumb'],[1,'Right Index'],[2,'Right Middle'],[3,'Right Ring'],[4,'Right Pinky'],
                    [5,'Left Thumb'], [6,'Left Index'], [7,'Left Middle'], [8,'Left Ring'], [9,'Left Pinky'],
                    [10,'Face'],
                  ].map(([id, label]) => (
                    <Select.Option key={id} value={id}>{label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 14, fontSize: 12 }}
                message="The employee must be standing at the reader. After clicking Start Enrollment the device activates — the employee has about 10 seconds to press their finger."
              />

              <Divider style={{ margin: '12px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Popconfirm
                    title="Pull all templates from this device?"
                    description="Imports every template stored on the device into the database."
                    onConfirm={() => { const sn = enrollForm.getFieldValue('sn'); if (sn) pullMutation.mutate(sn); }}
                    okText="Pull"
                  >
                    <Button size="small" icon={<DownloadOutlined />} loading={pullMutation.isPending}>
                      Pull Templates
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="Reset the device?"
                    description="Cancels any pending enrollment and re-enables the reader."
                    onConfirm={() => { const sn = enrollForm.getFieldValue('sn'); if (sn) resetDeviceMutation.mutate(sn); else message.warning('Select a device first'); }}
                    okText="Reset" okType="danger"
                  >
                    <Button danger size="small" icon={<PoweroffOutlined />} loading={resetDeviceMutation.isPending}>
                      Reset Device
                    </Button>
                  </Popconfirm>
                </Space>
                <Space>
                  <Button onClick={() => { setEnrollModal(false); enrollForm.resetFields(); setEnrollSN(null); }}>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    icon={<ScanOutlined />}
                    loading={directEnrollMutation.isPending}
                    onClick={() => {
                      enrollForm.validateFields().then(vals => {
                        directEnrollMutation.mutate({
                          sn: vals.sn,
                          emp_code: String(vals.emp_code),
                          finger_id: directFingerId,
                        });
                      });
                    }}
                  >
                    Start Enrollment
                  </Button>
                </Space>
              </div>
            </>
          )}

          {/* ADMS: employee field + submit */}
          {!isDirect && enrollSN && (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 14, fontSize: 12 }}
                message="The enrollment command will be queued. The device will prompt the employee on its screen at the next poll cycle."
              />
              <Form.Item name="emp_code" label="Employee" rules={[{ required: true }]}>
                <Select options={empCodeOptions} showSearch placeholder="Select employee"
                  filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
              <div style={{ textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => { setEnrollModal(false); enrollForm.resetFields(); setEnrollSN(null); }}>Cancel</Button>
                  <Button type="primary" htmlType="submit" loading={admsEnrollMutation.isPending}>
                    Queue Enrollment Command
                  </Button>
                </Space>
              </div>
            </>
          )}
        </Form>
      </Modal>

      {/* Push Templates Modal */}
      <Modal
        title={`Push Templates — ${selectedEmp}`}
        open={pushModal}
        onCancel={() => { setPushModal(false); pushForm.resetFields(); }}
        onOk={() => pushForm.submit()}
        confirmLoading={pushMutation.isPending}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 14, fontSize: 12 }}
          message="Push queues DATA UPDATE commands. ADMS devices pick them up on their next poll. Direct-connect devices are not affected by this — use Enroll instead."
        />
        <Form form={pushForm} layout="vertical"
          initialValues={{ emp_code: selectedEmp, include_fp: true, include_face: true }}
          onFinish={v => pushMutation.mutate(v)}>
          <Form.Item name="emp_code" label="Employee" rules={[{ required: true }]}>
            <Select options={empCodeOptions} showSearch
              filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="target_sns" label="Target Devices" rules={[{ required: true, type: 'array', min: 1 }]}>
            <Select mode="multiple" options={terminalOptions} placeholder="Select one or more devices" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="include_fp" label="Include Fingerprints" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="include_face" label="Include Face" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Assign Card Modal */}
      <Modal
        title={<Space><span>Assign RFID Access Card</span></Space>}
        open={cardModal}
        onCancel={() => { setCardModal(false); cardForm.resetFields(); setSelectedEmpRow(null); }}
        onOk={() => cardForm.submit()}
        confirmLoading={assignCardMutation.isPending}
        okText="Save Card"
        destroyOnHidden
        width={460}
      >
        {selectedEmpRow && (
          <div style={{
            background: '#F3F4F6', borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedEmpRow.emp_name}</span>
            <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>
              {selectedEmpRow.emp_code}
              {selectedEmpRow.badge_id && (
                <span style={{ marginLeft: 8 }}>· Badge ID: <strong>{selectedEmpRow.badge_id}</strong></span>
              )}
            </span>
          </div>
        )}
        <Form
          form={cardForm}
          layout="vertical"
          onFinish={(vals) => {
            assignCardMutation.mutate({
              emp_code: selectedEmpRow?.emp_code,
              card_number: vals.card_number ? Number(vals.card_number) : null,
            });
          }}
        >
          <Form.Item name="emp_code" hidden><Input /></Form.Item>
          <Form.Item
            name="card_number"
            label="RFID Card Number"
            extra="The numeric value encoded on the physical card (printed on card or read by a card scanner). Leave blank to remove the assigned card."
            rules={[
              {
                validator: (_, v) => {
                  if (!v) return Promise.resolve();
                  const n = Number(v);
                  if (!Number.isInteger(n) || n <= 0) return Promise.reject('Must be a positive integer');
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              type="number"
              placeholder="e.g. 123456789"
              min={1}
              style={{ width: '100%' }}
              suffix={
                selectedEmpRow?.card_number
                  ? <Tag color="geekblue" style={{ fontSize: 11 }}>Current: {selectedEmpRow.card_number}</Tag>
                  : <Tag style={{ fontSize: 11 }}>No card</Tag>
              }
            />
          </Form.Item>
          {selectedEmpRow?.card_number && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 4, fontSize: 12 }}
              message="Clearing the card number will remove access for the currently assigned card. The change is applied to devices on the next sync."
            />
          )}
        </Form>
      </Modal>

      {/* Sync Card to Devices Modal */}
      <Modal
        title="Sync Card to Devices"
        open={cardSyncModal}
        onCancel={() => { setCardSyncModal(false); cardSyncForm.resetFields(); setSelectedEmpRow(null); }}
        onOk={() => cardSyncForm.submit()}
        confirmLoading={syncCardMutation.isPending}
        okText="Sync Card"
        destroyOnHidden
        width={480}
      >
        {selectedEmpRow && (
          <div style={{
            background: '#F3F4F6', borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedEmpRow.emp_name}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2, fontFamily: 'monospace' }}>
              {selectedEmpRow.emp_code}
            </div>
            {selectedEmpRow.card_number && (
              <div style={{ marginTop: 8 }}>
                <Tag color="geekblue" style={{ fontSize: 12 }}>
                  RFID Card: {selectedEmpRow.card_number}
                </Tag>
                {selectedEmpRow.badge_id && (
                  <Tag color="default" style={{ fontSize: 12 }}>
                    Badge: {selectedEmpRow.badge_id}
                  </Tag>
                )}
              </div>
            )}
          </div>
        )}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 14, fontSize: 12 }}
          message="This pushes the employee's card number to the selected devices via ZKLib (direct-connect only). The employee can then use their physical card to clock in/out at those readers."
        />
        <Form
          form={cardSyncForm}
          layout="vertical"
          onFinish={(vals) => {
            syncCardMutation.mutate({
              emp_code: selectedEmpRow?.emp_code,
              target_sns: vals.target_sns,
            });
          }}
        >
          <Form.Item name="emp_code" hidden><Input /></Form.Item>
          <Form.Item
            name="target_sns"
            label="Target Devices"
            rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one device' }]}
            extra="Only direct-connect (IP-based) readers are shown — ADMS devices receive card data automatically on the next personnel sync."
          >
            <Select
              mode="multiple"
              placeholder="Select one or more devices"
              options={(terminals ?? [])
                .filter(t => t.ip_address)
                .map(t => ({ value: t.sn, label: t.alias || t.sn }))}
              notFoundContent={
                <span style={{ fontSize: 12, color: '#6B7280' }}>
                  No direct-connect devices available
                </span>
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

/* ── Enrollment report per device ─────────────────────────────────────────── */

const EnrollmentReport = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['enrollment-report'],
    queryFn: () => deviceAPI.getEnrollmentReport(),
    staleTime: 60000,
  });

  const pullMutation = useMutation({
    mutationFn: (sn) => deviceAPI.pullTemplatesFromDevice(sn),
    onSuccess: (res) => {
      const d = res?.data ?? {};
      message.success(
        `Pulled ${d.saved ?? 0} templates from device (${d.templates_on_device ?? 0} on device, ${d.skipped_no_user_match ?? 0} skipped)`
      );
      qc.invalidateQueries(['enrollment-report']);
      qc.invalidateQueries(['enrollment-status']);
    },
    onError: (e) => message.error(e.message || 'Failed to pull templates'),
  });

  const resetMutation = useMutation({
    mutationFn: (sn) => deviceAPI.cancelEnrollment(sn),
    onSuccess: () => message.success('Device reset — enrollment cancelled, device re-enabled'),
    onError: (e) => message.error(e.message || 'Reset failed'),
  });

  const report = data?.data ?? {};
  const devices = report.devices ?? [];

  const columns = [
    {
      title: 'Device',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.alias}</div>
          <Tag color={r.ip_address ? 'green' : 'blue'} style={{ fontSize: 10, marginTop: 2 }}>
            {r.ip_address ? `Direct · ${r.ip_address}` : 'ADMS'}
          </Tag>
        </div>
      ),
    },
    { title: 'SN', dataIndex: 'sn', width: 140, render: v => <Text code style={{ fontSize: 11 }}>{v}</Text> },
    {
      title: 'Enrolled',
      render: (_, r) => (
        <Space>
          <span style={{ fontWeight: 700 }}>{r.enrolled_employees}</span>
          <span style={{ color: '#8c8c8c' }}>/ {r.total_employees}</span>
          <Progress
            percent={r.enrollment_pct}
            size="small"
            style={{ width: 80 }}
            strokeColor={r.enrollment_pct >= 80 ? '#52c41a' : r.enrollment_pct >= 50 ? '#faad14' : '#ff4d4f'}
          />
        </Space>
      ),
    },
    { title: 'FP', dataIndex: 'fp_templates', width: 70, align: 'center', render: v => <Tag color="blue">{v}</Tag> },
    { title: 'Face', dataIndex: 'face_templates', width: 70, align: 'center', render: v => <Tag color="purple">{v}</Tag> },
    {
      title: 'Actions',
      width: 200,
      align: 'center',
      render: (_, r) => {
        if (!r.ip_address) return <Text type="secondary" style={{ fontSize: 11 }}>ADMS only</Text>;
        return (
          <Space size={4}>
            <Tooltip title="Import all fingerprint/face templates currently stored on this device into the database">
              <Button
                size="small"
                icon={<DownloadOutlined />}
                loading={pullMutation.isPending && pullMutation.variables === r.sn}
                onClick={() => pullMutation.mutate(r.sn)}
              >
                Pull Templates
              </Button>
            </Tooltip>
            <Popconfirm
              title="Reset device?"
              description="Cancels any pending enrollment and re-enables the reader. Use this if the device is stuck."
              onConfirm={() => resetMutation.mutate(r.sn)}
              okText="Reset" okType="danger"
            >
              <Tooltip title="Cancel stuck enrollment and re-enable reader">
                <Button
                  size="small"
                  danger
                  icon={<PoweroffOutlined />}
                  loading={resetMutation.isPending && resetMutation.variables === r.sn}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Alert
        type="info"
        showIcon
        icon={<ThunderboltOutlined />}
        style={{ marginBottom: 14 }}
        message='Use "Pull Templates" to import fingerprints already enrolled on the physical device'
        description="If employees enrolled their fingerprints directly at the reader (via the device's on-screen menu), click Pull Templates to sync those templates into this system's database. This is required before you can push templates to other devices."
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Total Employees" value={report.total_employees ?? 0} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Enrolled" value={report.enrolled_employees ?? 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Not Enrolled" value={report.not_enrolled ?? 0} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Coverage" value={`${report.enrollment_pct ?? 0}%`} valueStyle={{ color: '#1890ff' }} /></Card></Col>
      </Row>

      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading}>Refresh</Button>
      </div>

      <Table
        dataSource={devices}
        columns={columns}
        rowKey="sn"
        size="small"
        loading={isLoading}
        pagination={false}
      />
    </>
  );
};

/* ── Main export ──────────────────────────────────────────────────────────── */

const BiometricEnrollment = ({ terminals }) => {
  const tabItems = [
    {
      key: 'status',
      label: <span><UserOutlined /> Enrollment Status</span>,
      children: <EnrollmentStatus terminals={terminals} />,
    },
    {
      key: 'report',
      label: <span><ScanOutlined /> Per-Device Report</span>,
      children: <EnrollmentReport />,
    },
  ];
  return <Tabs items={tabItems} size="small" />;
};

export default BiometricEnrollment;
