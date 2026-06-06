import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Input, message, Tabs, Descriptions,
  Badge, Empty, Row, Col, Divider,
} from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined, CalendarOutlined, TeamOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import meetingApi from '../../../services/meetingApi';

const STATUS_MAP = {
  0: { color: 'gold',    label: 'Pending' },
  1: { color: 'green',   label: 'Approved' },
  2: { color: 'red',     label: 'Rejected' },
  3: { color: 'blue',    label: 'Completed' },
  4: { color: 'default', label: 'Cancelled' },
};

const MeetingApproval = () => {
  const [noteModal, setNoteModal]   = useState(false);
  const [selected, setSelected]     = useState(null);
  const [action, setAction]         = useState(null);
  const [note, setNote]             = useState('');
  const qc                          = useQueryClient();
  const inv                         = () => {
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
      inv();
      setNoteModal(false);
      setNote('');
    },
    onError: e => message.error(e.message),
  });

  const openAction = (rec, act) => { setSelected(rec); setAction(act); setNote(''); setNoteModal(true); };
  const confirmAction = () => approveMut.mutate({ id: selected.id, status: action === 'approve' ? 1 : 2, note });

  const historyColumns = [
    {
      title: 'Meeting', dataIndex: 'title', ellipsis: true,
      render: (v, r) => (
        <>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.room?.room_name ?? '—'}</div>
        </>
      ),
    },
    {
      title: 'Date', dataIndex: 'start_time', width: 150,
      sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time),
      render: v => (
        <>
          <div>{dayjs(v).format('DD MMM YYYY')}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{dayjs(v).format('HH:mm')}</div>
        </>
      ),
    },
    { title: 'Organizer', dataIndex: 'organizer', width: 150, render: (_, r) => r.organizer?.full_name ?? '—' },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: v => { const s = STATUS_MAP[v] ?? { color: 'default', label: '—' }; return <Tag color={s.color}>{s.label}</Tag>; },
    },
    { title: 'Note', dataIndex: 'approval_note', ellipsis: true, render: v => v || '—' },
  ];

  return (
    <>
      <Tabs
        items={[
          {
            key: 'pending',
            label: (
              <Badge count={pending.length} size="small" offset={[8, 0]}>
                Pending Approval
              </Badge>
            ),
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                  <span style={{ color: '#595959', fontSize: 13 }}>
                    {pending.length === 0 ? 'No pending requests' : `${pending.length} request${pending.length > 1 ? 's' : ''} awaiting approval`}
                  </span>
                  <Button size="small" icon={<ReloadOutlined />} onClick={refetchPending} loading={pendingLoading} />
                </div>

                {pending.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="All caught up — no pending approvals" style={{ padding: '40px 0' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pending.map(r => (
                      <div key={r.id} style={{
                        background: '#fff',
                        border: '1px solid #f0f0f0',
                        borderLeft: '3px solid #faad14',
                        borderRadius: 6,
                        padding: '12px 16px',
                      }}>
                        <Row align="middle" gutter={8}>
                          <Col flex="auto">
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{r.title}</div>
                            <Space size={16} wrap style={{ fontSize: 13, color: '#595959' }}>
                              <span><CalendarOutlined style={{ marginRight: 4 }} />{dayjs(r.start_time).format('DD MMM YYYY')}</span>
                              <span>{dayjs(r.start_time).format('HH:mm')} — {dayjs(r.end_time).format('HH:mm')}</span>
                              <span>{r.room?.room_name ?? '—'}</span>
                              <span><TeamOutlined style={{ marginRight: 4 }} />{r.attendee_count} attendees</span>
                              {r.organizer?.full_name && <span style={{ color: '#8c8c8c' }}>by {r.organizer.full_name}</span>}
                            </Space>
                            {r.agenda && (
                              <div style={{ marginTop: 6, fontSize: 12, color: '#8c8c8c', fontStyle: 'italic' }}>
                                {r.agenda.length > 120 ? r.agenda.slice(0, 120) + '…' : r.agenda}
                              </div>
                            )}
                          </Col>
                          <Col flex="none">
                            <Space>
                              <Button
                                danger
                                icon={<CloseOutlined />}
                                onClick={() => openAction(r, 'reject')}
                              >
                                Reject
                              </Button>
                              <Button
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={() => openAction(r, 'approve')}
                              >
                                Approve
                              </Button>
                            </Space>
                          </Col>
                        </Row>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ),
          },
          {
            key: 'history',
            label: `History (${history.length})`,
            children: (
              <>
                <div style={{ textAlign: 'right', marginBottom: 8 }}>
                  <Button size="small" icon={<ReloadOutlined />} onClick={refetchHistory} loading={historyLoading} />
                </div>
                <Table
                  dataSource={history}
                  columns={historyColumns}
                  rowKey="id"
                  size="small"
                  loading={historyLoading}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 800 }}
                />
              </>
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
        okButtonProps={{ danger: action === 'reject', loading: approveMut.isPending }}
        destroyOnHidden
      >
        {selected && (
          <Descriptions bordered size="small" column={1} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="Meeting">{selected.title}</Descriptions.Item>
            <Descriptions.Item label="Room">{selected.room?.room_name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Time">
              {dayjs(selected.start_time).format('DD MMM YYYY HH:mm')} — {dayjs(selected.end_time).format('HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="Organizer">{selected.organizer?.full_name ?? '—'}</Descriptions.Item>
          </Descriptions>
        )}
        <Input.TextArea
          rows={3}
          placeholder={action === 'approve' ? 'Optional note…' : 'Reason for rejection…'}
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default MeetingApproval;
