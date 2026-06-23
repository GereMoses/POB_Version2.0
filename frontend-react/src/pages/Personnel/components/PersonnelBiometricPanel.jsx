/**
 * PersonnelBiometricPanel
 * Shown in the employee detail drawer — lets admins view, register,
 * and manage biometric credentials (fingerprints, face, RFID card).
 */
import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Tag, Button, Space, Alert, Divider,
  Input, InputNumber, Select, Tooltip, Popconfirm, Modal,
  Form, Spin, Badge, Progress, App, Empty, Typography,
} from 'antd';
import {
  ScanOutlined, DeleteOutlined, ReloadOutlined, SyncOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CreditCardOutlined,
  ThunderboltOutlined, WifiOutlined, DisconnectOutlined,
  SendOutlined, DownloadOutlined, WarningOutlined, InfoCircleOutlined,
  UserOutlined, PlusOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Text } = Typography;
const { Option } = Select;

// ── Constants ─────────────────────────────────────────────────────────────────

const FINGER_LABELS = {
  0: 'Right Thumb', 1: 'Right Index', 2: 'Right Middle', 3: 'Right Ring', 4: 'Right Pinky',
  5: 'Left Thumb',  6: 'Left Index',  7: 'Left Middle',  8: 'Left Ring',  9: 'Left Pinky',
};
const FINGER_SLOTS = Array.from({ length: 10 }, (_, i) => i);
const FACE_FIDS    = new Set([-1, 10, 11, 12, 13, 14, 15]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function SlotDot({ enrolled, label }) {
  return (
    <Tooltip title={label}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: '50%', fontSize: 10, fontWeight: 700,
        background: enrolled ? '#f0fdf4' : '#f8fafc',
        border: `2px solid ${enrolled ? '#22c55e' : '#e2e8f0'}`,
        color: enrolled ? '#15803d' : '#94a3b8',
        cursor: 'default',
      }}>
        {enrolled ? '✓' : '○'}
      </span>
    </Tooltip>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PersonnelBiometricPanel = ({ empCode, personnelId }) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [enrollModal, setEnrollModal]     = useState(false);
  const [pushModal, setPushModal]         = useState(false);
  const [enrollForm] = Form.useForm();
  const [pushForm]   = Form.useForm();

  // ── Data queries ───────────────────────────────────────────────────────────

  const { data: statusRes, isLoading, refetch } = useQuery({
    queryKey: ['biometric-status', empCode],
    queryFn:  () => apiService.get(`/api/device/enrollment/status/?emp_code=${encodeURIComponent(empCode)}`),
    staleTime: 15_000,
    enabled:  !!empCode,
  });

  const enrollment = statusRes?.data?.[0] ?? null;

  const { data: terminalsRes } = useQuery({
    queryKey: ['device-terminals'],
    queryFn:  () => apiService.get('/api/device/terminals/'),
    staleTime: 60_000,
  });
  const terminals = Array.isArray(terminalsRes) ? terminalsRes : (terminalsRes?.data ?? []);

  // A reader is "ADMS" (remote/cloud) unless explicitly direct/both. ADMS readers
  // can only be driven through the command queue — direct ZKLib pull/enroll fails.
  const isAdmsMode = (m) => !['direct', 'both'].includes(String(m || 'adms').toLowerCase());
  const termIsAdms = (t) => isAdmsMode(t?.connection_mode);

  // Watch the device chosen in the Enroll modal so we can lock the mode: a remote
  // (ADMS) reader must use the ADMS path — Direct TCP can't reach it.
  const watchedSn = Form.useWatch('sn', enrollForm);
  const selectedTerminal = terminals.find(t => (t.sn || t.serial_number) === watchedSn);
  const selectedIsAdms = selectedTerminal ? termIsAdms(selectedTerminal) : false;

  useEffect(() => {
    if (selectedIsAdms) enrollForm.setFieldsValue({ mode: 'adms' });
  }, [selectedIsAdms]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ──────────────────────────────────────────────────────────

  const enrolledSlots = new Set(
    (enrollment?.fingerprints ?? []).map(s => {
      const m = s.match(/fp(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    }).filter(n => n !== null)
  );
  const faceEnrolled = enrollment?.face_enrolled ?? false;
  const cardNumber   = enrollment?.card_number ?? null;
  const totalTemplates = enrollment?.total_templates ?? 0;

  // ── Card mutation ──────────────────────────────────────────────────────────

  const [cardInput, setCardInput] = useState('');
  const cardMutation = useMutation({
    mutationFn: (card_number) => apiService.post('/api/device/enrollment/card/assign', {
      emp_code: empCode,
      card_number: card_number ?? null,
    }),
    onSuccess: (res) => {
      message.success(res?.data?.message ?? 'Card updated');
      setCardInput('');
      queryClient.invalidateQueries({ queryKey: ['biometric-status', empCode] });
    },
    onError: (e) => message.error(e?.response?.data?.detail ?? 'Card update failed'),
  });

  const cardSyncMutation = useMutation({
    mutationFn: ({ target_sns }) => apiService.post('/api/device/enrollment/card/sync', {
      emp_code: empCode,
      target_sns,
    }),
    onSuccess: (res) => {
      const d = res?.data;
      message.success(`Card synced to ${d?.synced ?? 0} / ${d?.total ?? 0} device(s)`);
    },
    onError: (e) => message.error(e?.response?.data?.detail ?? 'Card sync failed'),
  });

  // ── Enrollment mutations ───────────────────────────────────────────────────

  // ADMS: queue ENROLL_FP command on device (device shows enrollment screen)
  const admsEnrollMutation = useMutation({
    mutationFn: ({ sn, finger_id }) =>
      apiService.post(`/api/device/enrollment/enable/?sn=${encodeURIComponent(sn)}&emp_code=${encodeURIComponent(empCode)}&finger_id=${finger_id ?? 0}`),
    onSuccess: (res) => {
      message.success(res?.data?.message ?? 'Enrollment command queued — employee should now scan on the device');
      setEnrollModal(false);
      enrollForm.resetFields();
    },
    onError: (e) => message.error(e?.response?.data?.detail ?? 'Failed to queue enrollment command'),
  });

  // Direct: trigger CMD_STARTENROLL over TCP
  const directEnrollMutation = useMutation({
    mutationFn: ({ sn, finger_id }) => apiService.post('/api/device/enrollment/enroll-direct/', {
      sn,
      emp_code: empCode,
      finger_id,
    }),
    onSuccess: (res) => {
      const d = res?.data;
      if (d?.captured) {
        message.success('Fingerprint captured and saved');
      } else {
        message.info(d?.message ?? 'Enrollment triggered on device — pull templates after scanning');
      }
      setEnrollModal(false);
      enrollForm.resetFields();
      setTimeout(() => refetch(), 2000);
    },
    onError: (e) => message.error(e?.response?.data?.detail ?? 'Direct enrollment failed'),
  });

  // Pull templates from device into DB after direct enrollment
  const pullMutation = useMutation({
    mutationFn: (sn) => apiService.post(`/api/device/enrollment/pull-from-device/?sn=${encodeURIComponent(sn)}`),
    onSuccess: (res) => {
      const d = res?.data;
      message.success(`Synced ${d?.saved ?? 0} template(s) from device`);
      queryClient.invalidateQueries({ queryKey: ['biometric-status', empCode] });
    },
    onError: (e) => message.error(e?.response?.data?.detail ?? 'Pull failed'),
  });

  // Push templates to selected devices
  const pushMutation = useMutation({
    mutationFn: ({ target_sns, include_fp, include_face }) =>
      apiService.post('/api/device/enrollment/push/', {
        emp_code: empCode,
        target_sns,
        include_fp,
        include_face,
      }),
    onSuccess: (res) => {
      const d = res?.data;
      message.success(`Pushed ${d?.commands_queued ?? 0} command(s) to ${d?.devices_targeted ?? 0} device(s)`);
      setPushModal(false);
      pushForm.resetFields();
    },
    onError: (e) => message.error(e?.response?.data?.detail ?? 'Push failed'),
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: ({ finger_id }) => {
      const params = new URLSearchParams({ emp_code: empCode, push_to_devices: 'true' });
      if (finger_id !== undefined && finger_id !== null) params.set('finger_id', finger_id);
      return apiService.delete(`/api/device/enrollment/template/?${params}`);
    },
    onSuccess: (res) => {
      message.success(`${res?.data?.templates_removed ?? 0} template(s) removed`);
      queryClient.invalidateQueries({ queryKey: ['biometric-status', empCode] });
    },
    onError: (e) => message.error(e?.response?.data?.detail ?? 'Delete failed'),
  });

  const onEnrollSubmit = (values) => {
    // A remote (ADMS) reader can never use Direct TCP — force the ADMS path.
    const selTerm = terminals.find(t => (t.sn || t.serial_number) === values.sn);
    const fid = values.finger_id ?? 0;
    if (values.mode === 'adms' || termIsAdms(selTerm)) {
      admsEnrollMutation.mutate({ sn: values.sn, finger_id: fid });
    } else {
      directEnrollMutation.mutate({ sn: values.sn, finger_id: fid });
    }
  };

  const onPushSubmit = (values) => {
    pushMutation.mutate({
      target_sns: values.target_sns,
      include_fp:   values.include_fp   ?? true,
      include_face: values.include_face ?? true,
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!empCode) {
    return <Alert type="warning" message="No employee code — cannot load biometric status." />;
  }

  return (
    <Spin spinning={isLoading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Header strip ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ScanOutlined style={{ color: '#1890ff' }} />
            <Text strong>Biometric Registration</Text>
            <Tag style={{ fontFamily: 'monospace' }}>{empCode}</Tag>
          </Space>
          <Space>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setEnrollModal(true)}>
              Enroll
            </Button>
            {totalTemplates > 0 && (
              <Button size="small" icon={<SendOutlined />} onClick={() => setPushModal(true)}>
                Push to Device
              </Button>
            )}
          </Space>
        </div>

        {/* ── Summary cards ────────────────────────────────────────── */}
        <Row gutter={10}>
          <Col span={8}>
            <Card size="small" style={{ borderTop: `3px solid ${enrolledSlots.size > 0 ? '#22c55e' : '#e2e8f0'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: enrolledSlots.size > 0 ? '#15803d' : '#94a3b8' }}>
                {enrolledSlots.size}/10
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Finger Slots</div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderTop: `3px solid ${faceEnrolled ? '#7c3aed' : '#e2e8f0'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: faceEnrolled ? '#7c3aed' : '#94a3b8' }}>
                {faceEnrolled ? '✓' : '—'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Face ID</div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderTop: `3px solid ${cardNumber ? '#0891b2' : '#e2e8f0'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: cardNumber ? '#0891b2' : '#94a3b8', fontFamily: 'monospace' }}>
                {cardNumber ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>RFID Card</div>
            </Card>
          </Col>
        </Row>

        {/* ── Fingerprint slots grid ────────────────────────────────── */}
        <Card size="small" title={<Space size={6}><ScanOutlined />Fingerprint Slots</Space>}
          extra={
            enrolledSlots.size > 0 && (
              <Popconfirm title="Delete ALL fingerprint templates?" okText="Delete All" okType="danger"
                onConfirm={() => deleteMutation.mutate({ finger_id: undefined })} >
                <Button size="small" danger icon={<DeleteOutlined />}>Clear All</Button>
              </Popconfirm>
            )
          }
        >
          {enrollment === null && !isLoading
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No enrollment data — click Enroll to get started" style={{ padding: '12px 0' }} />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Visual slot grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {FINGER_SLOTS.map(slot => {
                    const enrolled = enrolledSlots.has(slot);
                    return (
                      <div key={slot} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '8px 4px', borderRadius: 8,
                        background: enrolled ? '#f0fdf4' : '#f8fafc',
                        border: `1px solid ${enrolled ? '#bbf7d0' : '#e2e8f0'}`,
                      }}>
                        <SlotDot enrolled={enrolled} label={FINGER_LABELS[slot]} />
                        <span style={{ fontSize: 9, color: enrolled ? '#15803d' : '#94a3b8', textAlign: 'center', lineHeight: 1.2 }}>
                          {FINGER_LABELS[slot]}
                        </span>
                        {enrolled && (
                          <Popconfirm title={`Delete ${FINGER_LABELS[slot]} template?`} okText="Delete" okType="danger"
                            onConfirm={() => deleteMutation.mutate({ finger_id: slot })}>
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 10, height: 18, padding: '0 4px' }} />
                          </Popconfirm>
                        )}
                      </div>
                    );
                  })}
                </div>

                {enrolledSlots.size === 0 && (
                  <Alert type="info" showIcon icon={<InfoCircleOutlined />}
                    message="No fingerprints enrolled yet"
                    description="Click Enroll to trigger fingerprint capture on a connected reader."
                    style={{ fontSize: 12 }}
                  />
                )}
              </div>
            )
          }
        </Card>

        {/* ── Face enrollment ───────────────────────────────────────── */}
        <Card size="small" title={<Space size={6}><UserOutlined />Face ID</Space>}>
          {faceEnrolled
            ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <CheckCircleOutlined style={{ color: '#22c55e' }} />
                  <Text style={{ color: '#15803d', fontWeight: 500 }}>Face template enrolled</Text>
                  {(enrollment?.source_devices ?? []).length > 0 && (
                    <Tag style={{ fontSize: 10 }}>from {enrollment.source_devices[0]}</Tag>
                  )}
                </Space>
                <Popconfirm title="Delete face template?" okText="Delete" okType="danger"
                  onConfirm={() => deleteMutation.mutate({ finger_id: -1 })}>
                  <Button size="small" danger icon={<DeleteOutlined />}>Remove</Button>
                </Popconfirm>
              </div>
            )
            : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <WarningOutlined style={{ color: '#d97706' }} />
                  <Text style={{ color: '#92400e' }}>No face template enrolled</Text>
                </Space>
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => {
                  setEnrollModal(true);
                  setTimeout(() => enrollForm.setFieldsValue({ finger_id: 10 }), 0);
                }}>
                  Enroll Face
                </Button>
              </div>
            )
          }
        </Card>

        {/* ── RFID Card ─────────────────────────────────────────────── */}
        <Card size="small" title={<Space size={6}><CreditCardOutlined />RFID Card</Space>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InputNumber
                value={cardInput !== '' ? cardInput : (cardNumber ?? undefined)}
                onChange={v => setCardInput(v ?? '')}
                placeholder="Enter card number…"
                style={{ flex: 1, fontFamily: 'monospace' }}
                min={1}
                controls={false}
              />
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={cardMutation.isPending}
                disabled={cardInput === ''}
                onClick={() => cardMutation.mutate(cardInput || null)}
              >
                Assign
              </Button>
              {cardNumber && (
                <Popconfirm title="Unassign card from employee?" okText="Unassign" okType="danger"
                  onConfirm={() => { setCardInput(''); cardMutation.mutate(null); }}>
                  <Button danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              )}
            </div>

            {cardNumber && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdff', border: '1px solid #a5f3fc', borderRadius: 6, padding: '6px 10px' }}>
                <Space>
                  <CreditCardOutlined style={{ color: '#0891b2' }} />
                  <Text style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0891b2' }}>{cardNumber}</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>currently assigned</Text>
                </Space>
                <Button size="small" icon={<SyncOutlined />} loading={cardSyncMutation.isPending}
                  onClick={() => {
                    const sns = terminals.map(t => t.sn || t.serial_number).filter(Boolean);
                    if (!sns.length) { message.warning('No devices available to sync'); return; }
                    cardSyncMutation.mutate({ target_sns: sns });
                  }}>
                  Sync to Devices
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* ── Source devices ────────────────────────────────────────── */}
        {(enrollment?.source_devices ?? []).length > 0 && (
          <Card size="small" title={<Space size={6}><WifiOutlined />Enrolled On Devices</Space>}>
            <Space wrap>
              {enrollment.source_devices.map(sn => {
                const term = terminals.find(t => (t.sn || t.serial_number) === sn);
                const label = term?.alias || term?.device_name || sn;
                const isAdms = termIsAdms(term);
                return (
                  <div key={sn} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag icon={<ThunderboltOutlined />} color="geekblue">{label}</Tag>
                    {isAdms ? (
                      <Tooltip title="Remote (ADMS) reader — templates sync back automatically on enrollment. Manual pull isn't available over the internet.">
                        <Button size="small" icon={<DownloadOutlined />} disabled>Auto-sync</Button>
                      </Tooltip>
                    ) : (
                      <Popconfirm title={`Pull latest templates from ${label}?`} okText="Pull"
                        onConfirm={() => pullMutation.mutate(sn)}>
                        <Button size="small" icon={<DownloadOutlined />} loading={pullMutation.isPending}>Pull</Button>
                      </Popconfirm>
                    )}
                  </div>
                );
              })}
            </Space>
          </Card>
        )}

      </div>

      {/* ── Enroll Modal ─────────────────────────────────────────────── */}
      <Modal
        title={<Space><ScanOutlined />Enroll Biometric</Space>}
        open={enrollModal}
        onCancel={() => { setEnrollModal(false); enrollForm.resetFields(); }}
        onOk={() => enrollForm.validateFields().then(onEnrollSubmit)}
        okText="Start Enrollment"
        confirmLoading={admsEnrollMutation.isPending || directEnrollMutation.isPending}
        width={480}
      >
        <Form form={enrollForm} layout="vertical" style={{ marginTop: 12 }}
          initialValues={{ mode: 'adms', finger_id: 0 }}>

          <Alert type="info" showIcon style={{ marginBottom: 16, fontSize: 12 }}
            message="How enrollment works"
            description={
              <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12 }}>
                <li><strong>ADMS mode</strong>: Queues a command to the device — the device screen opens an enrollment UI and the employee scans directly on the reader.</li>
                <li><strong>Direct mode</strong>: Sends a live TCP command to the reader. Employee must press their finger within ~10 seconds. The server then pulls the template automatically.</li>
              </ul>
            }
          />

          <Form.Item label="Device" name="sn" rules={[{ required: true, message: 'Select a device' }]}>
            <Select placeholder="Select reader" showSearch optionFilterProp="children">
              {terminals.map(t => {
                const sn = t.sn || t.serial_number;
                const label = t.alias || t.device_name || sn;
                const ip = t.ip_address;
                return (
                  <Option key={sn} value={sn}>
                    <Space>
                      {t.state === 1 || t.status === 'online'
                        ? <Badge status="success" />
                        : <Badge status="default" />
                      }
                      {label}
                      <Tag color={termIsAdms(t) ? 'blue' : 'green'} style={{ fontSize: 10 }}>
                        {termIsAdms(t) ? 'ADMS' : 'Direct'}
                      </Tag>
                      {ip && <Tag style={{ fontSize: 10 }}>{ip}</Tag>}
                    </Space>
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          {selectedIsAdms && (
            <Alert type="success" showIcon style={{ marginBottom: 16, fontSize: 12 }}
              message="Remote (ADMS) reader — enrollment runs on the device"
              description="The enrollment is queued to the reader. Walk to the device: it opens the fingerprint screen for this employee, they scan, and the template syncs back automatically. Live Direct-TCP capture isn't available for remote readers." />
          )}

          <Form.Item label="Enrollment Mode" name="mode" rules={[{ required: true }]}
            tooltip={selectedIsAdms ? 'This reader is remote (ADMS) — Direct TCP is not available.' : undefined}>
            <Select disabled={selectedIsAdms}>
              <Option value="adms">ADMS (device-side enrollment — recommended)</Option>
              <Option value="direct" disabled={selectedIsAdms}>
                Direct TCP (live capture){selectedIsAdms ? ' — not available for remote readers' : ''}
              </Option>
            </Select>
          </Form.Item>

          <Form.Item label="Finger Slot" name="finger_id" rules={[{ required: true }]}
            tooltip="Which finger to enroll. For face capture, select Face.">
            <Select>
              {FINGER_SLOTS.map(i => (
                <Option key={i} value={i}>{FINGER_LABELS[i]}</Option>
              ))}
              <Option value={10}>Face</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Push to Devices Modal ──────────────────────────────────────── */}
      <Modal
        title={<Space><SendOutlined />Push Templates to Devices</Space>}
        open={pushModal}
        onCancel={() => { setPushModal(false); pushForm.resetFields(); }}
        onOk={() => pushForm.validateFields().then(onPushSubmit)}
        okText="Push"
        confirmLoading={pushMutation.isPending}
        width={440}
      >
        <Form form={pushForm} layout="vertical" style={{ marginTop: 12 }}
          initialValues={{ include_fp: true, include_face: true }}>

          <Form.Item label="Target Devices" name="target_sns" rules={[{ required: true, message: 'Select at least one device' }]}>
            <Select mode="multiple" placeholder="Select devices…" showSearch optionFilterProp="children">
              {terminals.map(t => {
                const sn = t.sn || t.serial_number;
                const label = t.alias || t.device_name || sn;
                return <Option key={sn} value={sn}>{label}</Option>;
              })}
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Include Fingerprints" name="include_fp" valuePropName="checked">
                <Select>
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Include Face" name="include_face" valuePropName="checked">
                <Select>
                  <Option value={true}>Yes</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Alert type="info" showIcon style={{ fontSize: 12 }}
            message="Queues DATA UPDATE FINGER / FACE commands. The device downloads the templates the next time it polls the server." />
        </Form>
      </Modal>
    </Spin>
  );
};

export default PersonnelBiometricPanel;
