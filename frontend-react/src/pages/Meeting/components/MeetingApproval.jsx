import React, { useState } from 'react';
import {
  Table, Button, Space, Modal, Input, message, Tabs, Badge, Empty, Avatar,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, ReloadOutlined, CalendarOutlined, TeamOutlined,
  ClockCircleOutlined, HomeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import meetingApi from '../../../services/meetingApi';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  0: { color: '#d97706', bg: '#fffbeb', border: '#fed7aa', label: 'Pending'   },
  1: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Approved'  },
  2: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Rejected'  },
  3: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Completed' },
  4: { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Cancelled' },
};

const AVATAR_PALETTE = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706', '#dc2626', '#0891b2', '#65a30d', '#9333ea', '#0f766e'];
const avatarColor = name => AVATAR_PALETTE[(name || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = name => (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const StatusPill = ({ status }) => {
  const cfg = STATUS_CFG[status] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: '—' };
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

const MetaChip = ({ icon, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
    {icon}{children}
  </span>
);

const MeetingApproval = () => {
  const [noteModal, setNoteModal] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [action, setAction]       = useState(null);
  const [note, setNote]           = useState('');
  const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries(['meeting-pending']);
    qc.invalidateQueries(['meeting-history']);
    qc.invalidateQueries(['meeting-stats']);
  };

  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['meeting-pending'],
    queryFn:  () => meetingApi.getBookings({ status: 0, limit: 100 }),
    staleTime: 30000,
  });
  const pending = pendingData?.data ?? [];

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['meeting-history'],
    queryFn:  () => meetingApi.getBookings({ limit: 200 }),
    staleTime: 30000,
  });
  const history = (historyData?.data ?? []).filter(b => b.status !== 0);

  const approveMut = useMutation({
    mutationFn: ({ id, status, note }) => meetingApi.approveBooking(id, { status, note }),
    onSuccess: () => {
      message.success(action === 'approve' ? 'Meeting approved' : 'Meeting rejected');
      inv(); setNoteModal(false); setNote('');
    },
    onError: e => message.error(e.message),
  });

  const openAction = (rec, act) => { setSelected(rec); setAction(act); setNote(''); setNoteModal(true); };
  const confirmAction = () => approveMut.mutate({ id: selected.id, status: action === 'approve' ? 1 : 2, note });

  const historyColumns = [
    {
      title: 'Meeting', dataIndex: 'title', ellipsis: true,
      render: (v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={32} style={{ background: avatarColor(v), fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {initials(v)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{v}</div>
            <div style={{ fontSize: 9, color: '#94a3b8' }}><HomeOutlined style={{ fontSize: 9, marginRight: 3 }} />{r.room?.room_name ?? '—'}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Date', dataIndex: 'start_time', width: 150,
      sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time),
      render: v => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{dayjs(v).format('DD MMM YYYY')}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{dayjs(v).format('HH:mm')}</div>
        </div>
      ),
    },
    { title: 'Organizer', dataIndex: 'organizer', width: 160, render: (_, r) => <span style={{ fontSize: 12 }}>{r.organizer?.full_name ?? '—'}</span> },
    { title: 'Status', dataIndex: 'status', width: 130, render: v => <StatusPill status={v} /> },
    { title: 'Note', dataIndex: 'approval_note', ellipsis: true, render: v => <span style={{ fontSize: 12, color: '#374151' }}>{v || '—'}</span> },
  ];

  const containerStyle = {
    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
  };

  return (
    <div style={{ padding: '0 0 16px' }}>
      <Tabs
        items={[
          {
            key: 'pending',
            label: <span>Pending Approval {pending.length > 0 && <Badge count={pending.length} size="small" style={{ marginLeft: 6 }} />}</span>,
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: 13 }}>
                    {pending.length === 0 ? 'No pending requests' : `${pending.length} request${pending.length > 1 ? 's' : ''} awaiting approval`}
                  </span>
                  <Button size="small" icon={<ReloadOutlined />} onClick={refetchPending} loading={pendingLoading} style={{ borderRadius: 8 }} />
                </div>

                {pending.length === 0 ? (
                  <div style={{ ...containerStyle, padding: '40px 0' }}>
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="All caught up — no pending approvals" />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pending.map(r => (
                      <div key={r.id} style={{
                        background: '#fff', border: '1px solid #e2e8f0', borderLeft: '4px solid #d97706',
                        borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                      }}>
                        <Avatar size={42} style={{ background: avatarColor(r.title), fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                          {initials(r.title)}
                        </Avatar>
                        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{r.title}</span>
                            <StatusPill status={0} />
                          </div>
                          <Space size={16} wrap>
                            <MetaChip icon={<CalendarOutlined style={{ marginRight: 4 }} />}>{dayjs(r.start_time).format('DD MMM YYYY')}</MetaChip>
                            <MetaChip icon={<ClockCircleOutlined style={{ marginRight: 4 }} />}>{dayjs(r.start_time).format('HH:mm')} — {dayjs(r.end_time).format('HH:mm')}</MetaChip>
                            <MetaChip icon={<HomeOutlined style={{ marginRight: 4 }} />}>{r.room?.room_name ?? '—'}</MetaChip>
                            <MetaChip icon={<TeamOutlined style={{ marginRight: 4 }} />}>{r.attendee_count} attendees</MetaChip>
                            {r.organizer?.full_name && <span style={{ fontSize: 12, color: '#94a3b8' }}>by {r.organizer.full_name}</span>}
                          </Space>
                          {r.agenda && (
                            <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                              {r.agenda.length > 120 ? r.agenda.slice(0, 120) + '…' : r.agenda}
                            </div>
                          )}
                        </div>
                        <Space style={{ flexShrink: 0 }}>
                          <Button danger icon={<CloseOutlined />} style={{ borderRadius: 7 }} onClick={() => openAction(r, 'reject')}>Reject</Button>
                          <Button type="primary" icon={<CheckOutlined />} style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 7 }} onClick={() => openAction(r, 'approve')}>Approve</Button>
                        </Space>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'history',
            label: <span>History {history.length > 0 && <Badge count={history.length} size="small" style={{ marginLeft: 6, background: '#94a3b8' }} />}</span>,
            children: (
              <div>
                <div style={{ textAlign: 'right', marginBottom: 10 }}>
                  <Button size="small" icon={<ReloadOutlined />} onClick={refetchHistory} loading={historyLoading} style={{ borderRadius: 8 }} />
                </div>
                <div style={containerStyle}>
                  <Table
                    dataSource={history}
                    columns={historyColumns}
                    rowKey="id"
                    size="middle"
                    loading={historyLoading}
                    scroll={{ x: 800 }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No approval history" /> }}
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t, rng) => `${rng[0]}–${rng[1]} of ${t}`, style: { padding: '12px 16px', margin: 0 } }}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={action === 'approve' ? 'Approve Meeting' : 'Reject Meeting'}
        open={noteModal}
        onCancel={() => setNoteModal(false)}
        onOk={confirmAction}
        okText={action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
        okButtonProps={{ danger: action === 'reject', loading: approveMut.isPending, style: action === 'approve' ? { background: '#16a34a', borderColor: '#16a34a' } : {} }}
        destroyOnHidden
      >
        {selected && (
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Avatar size={36} style={{ background: avatarColor(selected.title), fontSize: 13, fontWeight: 700 }}>{initials(selected.title)}</Avatar>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{selected.title}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{selected.room?.room_name ?? '—'}</div>
              </div>
            </div>
            <Space size={16} wrap>
              <MetaChip icon={<CalendarOutlined style={{ marginRight: 4 }} />}>{dayjs(selected.start_time).format('DD MMM YYYY HH:mm')} — {dayjs(selected.end_time).format('HH:mm')}</MetaChip>
              {selected.organizer?.full_name && <MetaChip icon={<TeamOutlined style={{ marginRight: 4 }} />}>{selected.organizer.full_name}</MetaChip>}
            </Space>
          </div>
        )}
        <Input.TextArea
          rows={3}
          placeholder={action === 'approve' ? 'Optional note…' : 'Reason for rejection…'}
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default MeetingApproval;
