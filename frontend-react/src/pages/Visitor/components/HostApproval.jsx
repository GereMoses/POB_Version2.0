import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Select, message, Tooltip,
  Drawer, Avatar, Typography, Divider, Row, Col, Empty,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, ReloadOutlined, MailOutlined, WarningFilled,
  SearchOutlined, FilterOutlined, MoreOutlined, UserOutlined, CalendarOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';

const { Text } = Typography;

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  0: { color: '#d97706', bg: '#fffbeb', border: '#fed7aa', label: 'Pending'      },
  1: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Approved'     },
  2: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Rejected'     },
  3: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Checked In'   },
  4: { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Checked Out'  },
  5: { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa', label: 'Expired'      },
};

const AVATAR_PALETTE = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706', '#dc2626', '#0891b2', '#65a30d', '#9333ea', '#0f766e'];
const avatarColor = name => AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = name => (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const empName     = e => e ? (e.full_name || [e.first_name, e.last_name].filter(Boolean).join(' ') || '—') : '—';

// ── Status Pill ──────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

// ── Visitor Cell ─────────────────────────────────────────────────────────────
const VisitorCell = ({ visitor }) => {
  const name = visitor?.full_name || '—';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar size={32} src={visitor?.photo || undefined}
        style={{ background: avatarColor(name), fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
        {initials(name)}
      </Avatar>
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
          {name}
          {visitor?.is_blacklist && (
            <span style={{ fontSize: 9, fontWeight: 800, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, padding: '0 5px' }}>
              <WarningFilled /> Blacklisted
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
          {visitor?.company && <span style={{ fontSize: 9, color: '#94a3b8' }}>{visitor.company}</span>}
          {visitor?.id_no && (
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#94a3b8', background: '#f3f4f6', borderRadius: 3, padding: '0 4px' }}>
              {visitor.id_no}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Bulk bar ─────────────────────────────────────────────────────────────────
const BulkBar = ({ count, onClear, onApprove, onReject }) =>
  count > 0 ? (
    <div style={{
      background: '#2563eb', borderRadius: 10, padding: '10px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{count} selected</span>
      <div style={{ flex: 1 }} />
      <Button size="small" icon={<CheckOutlined />} onClick={onApprove}
        style={{ borderRadius: 6, background: '#16a34a', border: 'none', color: '#fff' }}>Approve all</Button>
      <Button size="small" icon={<CloseOutlined />} onClick={onReject}
        style={{ borderRadius: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}>Reject all</Button>
      <Button size="small" icon={<CloseOutlined />} onClick={onClear}
        style={{ borderRadius: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }} />
    </div>
  ) : null;

// ── Detail Drawer ────────────────────────────────────────────────────────────
const lblBox = { fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 };

const DetailDrawer = ({ record, onClose, onApprove, onReject, onResend, resending }) => {
  if (!record) return null;
  const v = record.visitor;
  const blacklisted = !!v?.is_blacklist;
  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={36} src={v?.photo || undefined} style={{ background: avatarColor(v?.full_name), fontSize: 13, fontWeight: 700 }}>
            {initials(v?.full_name)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{v?.full_name || '—'}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{v?.company || 'Visitor'}</div>
          </div>
        </div>
      }
      open={!!record} onClose={onClose} width={440} styles={{ body: { padding: 20 } }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatusPill status={record.status} />
        {blacklisted && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
            <WarningFilled style={{ fontSize: 10 }} /> Blacklisted
          </span>
        )}
        {record.contractor_visitor && (
          <span style={{ background: '#ffedd5', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Contractor</span>
        )}
      </div>

      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        <Row gutter={16}>
          <Col span={12}><Text style={lblBox}>Visit Date</Text><Text style={{ fontSize: 12, fontWeight: 600 }}>{record.visit_date ? dayjs(record.visit_date).format('DD MMM YYYY') : '—'}</Text></Col>
          <Col span={12}><Text style={lblBox}>Time</Text><Text style={{ fontSize: 12 }}>{record.visit_time_start || '—'} – {record.visit_time_end || '—'}</Text></Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 10 }}>
          <Col span={12}><Text style={lblBox}>Host</Text><Text style={{ fontSize: 12 }}>{empName(record.host_employee)}</Text></Col>
          <Col span={12}><Text style={lblBox}>Vehicle</Text><Text style={{ fontSize: 12 }}>{record.vehicle_no || '—'}</Text></Col>
        </Row>
      </div>

      {record.purpose && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <Text style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: '#c2410c', display: 'block', marginBottom: 4 }}>Purpose of Visit</Text>
          <Text style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{record.purpose}</Text>
        </div>
      )}

      {record.approval_note && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
          <Text style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: '#15803d', display: 'block', marginBottom: 4 }}>Approval Note</Text>
          <Text style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{record.approval_note}</Text>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {v?.phone && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><UserOutlined style={{ color: '#94a3b8', fontSize: 12 }} /><Text style={{ fontSize: 12 }}>{v.phone}</Text></div>}
        {v?.email && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MailOutlined style={{ color: '#94a3b8', fontSize: 12 }} /><Text style={{ fontSize: 12 }}>{v.email}</Text></div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SafetyCertificateOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
          <Text style={{ fontSize: 12 }}>Safety induction: {record.safety_induction_done ? 'Done' : 'Not done'}</Text>
        </div>
        {record.approval_time && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <CalendarOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>Decided {dayjs(record.approval_time).format('DD MMM YYYY HH:mm')}</Text>
          </div>
        )}
      </div>

      <Divider style={{ margin: '12px 0 10px' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {record.status === 0 && (
          <>
            <Tooltip title={blacklisted ? 'Blacklisted — cannot approve' : ''}>
              <Button type="primary" icon={<CheckOutlined />} size="small" disabled={blacklisted}
                style={{ background: blacklisted ? undefined : '#16a34a', borderColor: blacklisted ? undefined : '#16a34a', borderRadius: 7 }}
                onClick={() => onApprove(record.id)}>Approve</Button>
            </Tooltip>
            <Button danger icon={<CloseOutlined />} size="small" style={{ borderRadius: 7 }} onClick={() => onReject(record.id)}>Reject</Button>
          </>
        )}
        <Button icon={<MailOutlined />} size="small" loading={resending} style={{ borderRadius: 7 }} onClick={() => onResend(record.id)}>Resend</Button>
      </div>
    </Drawer>
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────
const HostApproval = () => {
  const [statusFilter, setSF] = useState(0);
  const [search, setSearch]   = useState('');
  const [detail, setDetail]   = useState(null);
  const [noteModal, setNoteM] = useState(null); // { id?, bulk?, status }
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [noteForm]            = Form.useForm();
  const qc                    = useQueryClient();
  const inv = () => { qc.invalidateQueries(['host-approvals']); qc.invalidateQueries(['visitor-stats']); };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['host-approvals', statusFilter],
    queryFn:  () => visitorAPI.getPreRegistrations({ ...(statusFilter !== undefined ? { status: statusFilter } : {}) }),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const filtered = useMemo(() => {
    const rows = data?.data ?? [];
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      (r.visitor?.full_name || '').toLowerCase().includes(q)
      || (r.visitor?.company || '').toLowerCase().includes(q)
      || (r.purpose || '').toLowerCase().includes(q)
      || (empName(r.host_employee) || '').toLowerCase().includes(q));
  }, [data, search]);

  const closeNote = () => { setNoteM(null); noteForm.resetFields(); };

  const approveMut = useMutation({
    mutationFn: ({ id, status, note }) => visitorAPI.approvePreRegistration(id, { status, note }),
    onSuccess: () => { message.success('Done'); inv(); closeNote(); setDetail(null); },
    onError: e => message.error(e.message),
  });
  const bulkMut = useMutation({
    mutationFn: ({ ids, status, note }) => visitorAPI.bulkApprovePreRegistrations({ ids, status, note }),
    onSuccess: (res) => {
      const r = res?.data || {};
      message.success(res?.message || 'Done');
      (r.failed || []).forEach(f => message.warning(`#${f.id}: ${f.error}`));
      setSelectedKeys([]); inv(); closeNote();
    },
    onError: e => message.error(e.message),
  });
  const resendMut = useMutation({
    mutationFn: (id) => visitorAPI.resendPreRegistration(id),
    onSuccess: () => message.success('Notification resent'),
    onError: e => message.error(e.message),
  });

  const submitNote = (v) => {
    if (noteModal.bulk) bulkMut.mutate({ ids: selectedKeys, status: noteModal.status, note: v.note ?? '' });
    else approveMut.mutate({ id: noteModal.id, status: noteModal.status, note: v.note ?? '' });
  };

  const isBlacklisted = r => !!r.visitor?.is_blacklist;

  const columns = [
    {
      title: 'Visitor', key: 'visitor', width: 240,
      render: (_, r) => <div style={{ cursor: 'pointer' }} onClick={() => setDetail(r)}><VisitorCell visitor={r.visitor} /></div>,
    },
    { title: 'Host', key: 'host', width: 150, render: (_, r) => <span style={{ fontSize: 12 }}>{empName(r.host_employee)}</span> },
    {
      title: 'Visit', key: 'visit', width: 150,
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{r.visit_date ? dayjs(r.visit_date).format('DD MMM YYYY') : '—'}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{r.visit_time_start || '—'}{r.visit_time_end ? ` – ${r.visit_time_end}` : ''}</div>
        </div>
      ),
    },
    { title: 'Purpose', dataIndex: 'purpose', ellipsis: true, render: v => <span style={{ fontSize: 12, color: '#374151' }}>{v || '—'}</span> },
    { title: 'Status', key: 'status', width: 120, render: (_, r) => <StatusPill status={r.status} /> },
    {
      title: '', key: 'actions', fixed: 'right', width: 170,
      render: (_, r) => (
        <Space size={4}>
          {r.status === 0 && (
            <>
              <Tooltip title={isBlacklisted(r) ? 'Blacklisted — cannot approve' : 'Approve'}>
                <Button size="small" type="primary" icon={<CheckOutlined />} disabled={isBlacklisted(r)}
                  style={{ background: isBlacklisted(r) ? undefined : '#16a34a', borderColor: isBlacklisted(r) ? undefined : '#16a34a', borderRadius: 6 }}
                  onClick={() => setNoteM({ id: r.id, status: 1 })} />
              </Tooltip>
              <Tooltip title="Reject"><Button size="small" danger icon={<CloseOutlined />} style={{ borderRadius: 6 }} onClick={() => setNoteM({ id: r.id, status: 2 })} /></Tooltip>
            </>
          )}
          <Tooltip title="Resend notification"><Button size="small" icon={<MailOutlined />} loading={resendMut.isPending} style={{ borderRadius: 6 }} onClick={() => resendMut.mutate(r.id)} /></Tooltip>
          <Tooltip title="Detail"><Button size="small" icon={<MoreOutlined />} style={{ borderRadius: 6 }} onClick={() => setDetail(r)} /></Tooltip>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedKeys,
    onChange: setSelectedKeys,
    getCheckboxProps: r => ({ disabled: r.status !== 0 }),
  };

  return (
    <div style={{ padding: '0 0 16px' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <Input placeholder="Search visitor, company, host, purpose…" prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }} />}
          value={search} onChange={e => setSearch(e.target.value)} allowClear style={{ flex: '1 1 220px', maxWidth: 280, borderRadius: 8 }} />
        <FilterOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
        <Select placeholder="All statuses" allowClear style={{ flex: '1 1 150px', minWidth: 150 }}
          value={statusFilter} onChange={setSF}
          options={Object.keys(STATUS_CFG).map(v => ({ value: Number(v), label: <StatusPill status={Number(v)} /> }))} />
        <div style={{ marginLeft: 'auto' }}>
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} style={{ borderRadius: 8 }} />
        </div>
      </div>

      <BulkBar
        count={selectedKeys.length}
        onClear={() => setSelectedKeys([])}
        onApprove={() => setNoteM({ bulk: true, status: 1 })}
        onReject={() => setNoteM({ bulk: true, status: 2 })}
      />

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={isLoading}
          rowSelection={rowSelection}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pre-registrations" /> }}
          rowClassName={r => isBlacklisted(r) ? 'row-blacklisted' : ''}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`, style: { padding: '12px 16px', margin: 0 } }}
        />
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        record={detail}
        onClose={() => setDetail(null)}
        onApprove={id => setNoteM({ id, status: 1 })}
        onReject={id => setNoteM({ id, status: 2 })}
        onResend={id => resendMut.mutate(id)}
        resending={resendMut.isPending}
      />

      {/* Approve/reject note modal (single or bulk) */}
      <Modal
        title={`${noteModal?.status === 1 ? 'Approve' : 'Reject'} ${noteModal?.bulk ? `${selectedKeys.length} Pre-Registrations` : 'Pre-Registration'}`}
        open={!!noteModal}
        onCancel={closeNote}
        onOk={() => noteForm.submit()}
        confirmLoading={approveMut.isPending || bulkMut.isPending}
        okButtonProps={{ danger: noteModal?.status === 2 }}
        destroyOnHidden
      >
        <Form form={noteForm} layout="vertical" onFinish={submitNote}>
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={3} placeholder="Add a note…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HostApproval;
