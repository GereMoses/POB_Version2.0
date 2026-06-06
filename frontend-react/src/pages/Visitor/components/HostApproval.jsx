import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select, message, Descriptions,
} from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';

const STATUS_MAP = {
  0: { color: 'gold',    text: 'Pending' },
  1: { color: 'green',   text: 'Approved' },
  2: { color: 'red',     text: 'Rejected' },
  3: { color: 'blue',    text: 'Checked In' },
  4: { color: 'default', text: 'Checked Out' },
  5: { color: 'orange',  text: 'Expired' },
};

const HostApproval = () => {
  const [statusFilter, setSF] = useState(0);
  const [detail, setDetail]   = useState(null);
  const [noteModal, setNoteM] = useState(null); // { id, action }
  const [noteForm]            = Form.useForm();
  const qc                    = useQueryClient();
  const inv                   = () => { qc.invalidateQueries(['host-approvals']); qc.invalidateQueries(['visitor-stats']); };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['host-approvals', statusFilter],
    queryFn:  () => visitorAPI.getPreRegistrations({ ...(statusFilter !== undefined ? { status: statusFilter } : {}) }),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const rows = data?.data ?? [];

  const approveMut = useMutation({
    mutationFn: ({ id, status, note }) => visitorAPI.approvePreRegistration(id, { status, note }),
    onSuccess: () => { message.success('Done'); inv(); setNoteM(null); noteForm.resetFields(); },
    onError: e => message.error(e.message),
  });

  const handleApprove = (id, status) => {
    setNoteM({ id, status });
  };

  const columns = [
    {
      title: 'Visitor', ellipsis: true,
      render: (_, r) => <span><strong>{r.visitor?.full_name || '—'}</strong><br /><small>{r.visitor?.company || ''}</small></span>,
    },
    { title: 'Host',      ellipsis: true, render: (_, r) => r.host_employee?.full_name || '—' },
    {
      title: 'Visit Date', dataIndex: 'visit_date', width: 110,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    { title: 'Purpose', dataIndex: 'purpose', ellipsis: true, render: v => v || '—' },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: v => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.text ?? v}</Tag>,
    },
    {
      title: '', width: 130,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)} />
          {r.status === 0 && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(r.id, 1)}>Approve</Button>
              <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleApprove(r.id, 2)}>Reject</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Select
          value={statusFilter}
          onChange={setSF}
          style={{ width: 140 }}
          allowClear
          placeholder="All statuses"
          options={Object.entries(STATUS_MAP).map(([v, { text }]) => ({ value: Number(v), label: text }))}
        />
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 700 }}
      />

      {/* Details Modal */}
      <Modal title="Pre-Registration Details" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={520}>
        {detail && (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Visitor">{detail.visitor?.full_name}</Descriptions.Item>
            <Descriptions.Item label="Company">{detail.visitor?.company || '—'}</Descriptions.Item>
            <Descriptions.Item label="Phone">{detail.visitor?.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="ID">{detail.visitor?.id_no || '—'}</Descriptions.Item>
            <Descriptions.Item label="Host">{detail.host_employee?.full_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Visit Date">{detail.visit_date ? dayjs(detail.visit_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Time">{detail.visit_time_start || '—'} – {detail.visit_time_end || '—'}</Descriptions.Item>
            <Descriptions.Item label="Purpose">{detail.purpose || '—'}</Descriptions.Item>
            <Descriptions.Item label="Vehicle">{detail.vehicle_no || '—'}</Descriptions.Item>
            <Descriptions.Item label="Contractor">{detail.contractor_visitor ? 'Yes' : 'No'}</Descriptions.Item>
            <Descriptions.Item label="Safety Induction">{detail.safety_induction_done ? 'Done' : 'Not done'}</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color={STATUS_MAP[detail.status]?.color}>{STATUS_MAP[detail.status]?.text}</Tag></Descriptions.Item>
            {detail.approval_note && <Descriptions.Item label="Approval Note">{detail.approval_note}</Descriptions.Item>}
          </Descriptions>
        )}
      </Modal>

      {/* Note Modal for approve/reject */}
      <Modal
        title={noteModal?.status === 1 ? 'Approve Pre-Registration' : 'Reject Pre-Registration'}
        open={!!noteModal}
        onCancel={() => { setNoteM(null); noteForm.resetFields(); }}
        onOk={() => noteForm.submit()}
        confirmLoading={approveMut.isPending}
        okButtonProps={{ danger: noteModal?.status === 2 }}
        destroyOnHidden
      >
        <Form form={noteForm} layout="vertical"
          onFinish={v => approveMut.mutate({ id: noteModal.id, status: noteModal.status, note: v.note ?? '' })}>
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={3} placeholder="Add a note…" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default HostApproval;
