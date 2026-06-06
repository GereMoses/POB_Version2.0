import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  message, Popconfirm, Upload, List, Typography, Divider,
  Card, Row, Col, Progress, Empty, Badge, Tooltip,
} from 'antd';
import { DatePicker } from 'antd';
import {
  PlusOutlined, ReloadOutlined, UploadOutlined, CheckOutlined,
  FileTextOutlined, DownloadOutlined, CalendarOutlined,
  ClockCircleOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import meetingApi from '../../../services/meetingApi';
import usePersonnel from '../../../hooks/usePersonnel';

const ACTION_STATUS = { 0: ['gold', 'Open'], 1: ['green', 'Done'], 2: ['red', 'Overdue'] };

const MeetingMinutes = () => {
  const [selected, setSelected]    = useState(null);
  const [actionModal, setActModal] = useState(false);
  const [actionForm]               = Form.useForm();
  const { empOptions }             = usePersonnel();
  const qc                         = useQueryClient();

  const { data: bookingsData, isLoading, refetch } = useQuery({
    queryKey: ['meeting-completed'],
    queryFn:  () => meetingApi.getBookings({ status: 3, limit: 100 }),
    staleTime: 60000,
  });
  const bookings = bookingsData?.data ?? [];

  const { data: minutesData, refetch: refetchMinutes } = useQuery({
    queryKey: ['booking-minutes', selected?.id],
    queryFn:  () => meetingApi.getBookingMinutes(selected.id),
    enabled:  !!selected?.id,
  });
  const minutes = minutesData?.data ?? [];

  const { data: actionsData, refetch: refetchActions } = useQuery({
    queryKey: ['booking-actions', selected?.id],
    queryFn:  () => meetingApi.getBookingActions(selected.id),
    enabled:  !!selected?.id,
  });
  const actions = actionsData?.data ?? [];

  const addActionMut = useMutation({
    mutationFn: d => meetingApi.addActionItem(selected.id, d),
    onSuccess: () => { message.success('Action item added'); refetchActions(); setActModal(false); actionForm.resetFields(); },
    onError:   e => message.error(e.message),
  });
  const updateActionMut = useMutation({
    mutationFn: ({ id, d }) => meetingApi.updateActionItem(id, d),
    onSuccess: () => { message.success('Updated'); refetchActions(); },
    onError:   e => message.error(e.message),
  });

  const handleUpload = async ({ file }) => {
    try {
      await meetingApi.uploadMinutes(selected.id, file);
      message.success('Minutes uploaded');
      refetchMinutes();
    } catch {
      message.error('Upload failed');
    }
    return false;
  };

  const doneCount = actions.filter(a => a.status === 1).length;
  const actionProgress = actions.length ? Math.round((doneCount / actions.length) * 100) : 0;

  const bookingColumns = [
    {
      title: 'Meeting', dataIndex: 'title', ellipsis: true,
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {dayjs(r.start_time).format('DD MMM YYYY')}
          </div>
        </div>
      ),
    },
    { title: 'Room', dataIndex: 'room', width: 130, render: (_, r) => r.room?.room_name ?? '—' },
    {
      title: 'Docs', width: 60,
      render: (_, r) => (
        <Badge count={0} showZero={false}>
          <FileTextOutlined style={{ color: '#888' }} />
        </Badge>
      ),
    },
    {
      title: '', width: 80,
      render: (_, r) => (
        <Button
          size="small"
          type={selected?.id === r.id ? 'primary' : 'default'}
          onClick={() => setSelected(r)}
        >
          {selected?.id === r.id ? 'Selected' : 'View'}
        </Button>
      ),
    },
  ];

  const fileExt = path => path?.split('.').pop()?.toLowerCase() ?? '';
  const extColor = { pdf: '#ff4d4f', doc: '#1677ff', docx: '#1677ff', xlsx: '#52c41a', txt: '#888' };

  return (
    <Row gutter={16}>
      {/* Left: Completed meetings list */}
      <Col xs={24} lg={10}>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Text strong style={{ fontSize: 14 }}>Completed Meetings ({bookings.length})</Typography.Text>
          <Button size="small" icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
        </div>
        <Table
          dataSource={bookings}
          columns={bookingColumns}
          rowKey="id"
          size="small"
          loading={isLoading}
          pagination={{ pageSize: 8, size: 'small' }}
          rowClassName={r => r.id === selected?.id ? 'ant-table-row-selected' : ''}
          scroll={{ x: 400 }}
        />
      </Col>

      {/* Right: Minutes and Actions */}
      <Col xs={24} lg={14}>
        {!selected ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty
              image={<FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
              imageStyle={{ height: 60 }}
              description="Select a completed meeting to view minutes and action items"
            />
          </div>
        ) : (
          <>
            {/* Meeting header */}
            <Card size="small" style={{ marginBottom: 12, borderLeft: '3px solid #0078D4' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.title}</div>
              <Space style={{ marginTop: 4 }} split={<span style={{ color: '#ccc' }}>·</span>}>
                <span style={{ fontSize: 13, color: '#555' }}>
                  <CalendarOutlined style={{ marginRight: 4 }} />
                  {dayjs(selected.start_time).format('DD MMM YYYY')}
                </span>
                <span style={{ fontSize: 13, color: '#555' }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {dayjs(selected.start_time).format('HH:mm')} — {dayjs(selected.end_time).format('HH:mm')}
                </span>
                <span style={{ fontSize: 13, color: '#555' }}>
                  {selected.room?.room_name ?? '—'}
                </span>
              </Space>
            </Card>

            {/* Minutes section */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Typography.Text strong>
                  <FileTextOutlined style={{ marginRight: 6 }} />
                  Meeting Minutes ({minutes.length})
                </Typography.Text>
                <Upload beforeUpload={() => false} showUploadList={false} onChange={({ file }) => handleUpload({ file })}>
                  <Button size="small" icon={<UploadOutlined />} type="primary" ghost>Upload</Button>
                </Upload>
              </div>
              {minutes.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#bbb', background: '#fafafa', borderRadius: 6, border: '1px dashed #e8e8e8' }}>
                  No minutes uploaded yet
                </div>
              ) : (
                <List
                  size="small"
                  bordered
                  dataSource={minutes}
                  renderItem={m => {
                    const ext = fileExt(m.minutes_path);
                    const filename = m.minutes_path?.split('/').pop() ?? 'Document';
                    return (
                      <List.Item
                        actions={[
                          <Tooltip title="Download" key="dl">
                            <Button
                              size="small"
                              type="text"
                              icon={<DownloadOutlined />}
                              href={`/api${m.minutes_path}`}
                              target="_blank"
                            />
                          </Tooltip>,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            <div style={{
                              width: 32, height: 32, borderRadius: 4,
                              background: extColor[ext] ?? '#888',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                            }}>
                              {ext || 'DOC'}
                            </div>
                          }
                          title={filename}
                          description={
                            <span style={{ fontSize: 12 }}>
                              Uploaded {dayjs(m.uploaded_time).format('DD MMM YYYY HH:mm')}
                            </span>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              )}
            </div>

            {/* Action items */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <Typography.Text strong>
                    <CheckOutlined style={{ marginRight: 6 }} />
                    Action Items ({actions.length})
                  </Typography.Text>
                  {actions.length > 0 && (
                    <span style={{ marginLeft: 12 }}>
                      <Progress
                        percent={actionProgress}
                        size="small"
                        style={{ width: 80, display: 'inline-block' }}
                        strokeColor="#52c41a"
                        showInfo={false}
                      />
                      <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>
                        {doneCount}/{actions.length} done
                      </span>
                    </span>
                  )}
                </div>
                <Button size="small" icon={<PlusOutlined />} type="primary" onClick={() => setActModal(true)}>
                  Add Item
                </Button>
              </div>

              {actions.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#bbb', background: '#fafafa', borderRadius: 6, border: '1px dashed #e8e8e8' }}>
                  No action items yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {actions.map(a => {
                    const [tagColor, tagLabel] = ACTION_STATUS[a.status] ?? ['default', '—'];
                    return (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 6,
                        background: '#fff',
                        border: '1px solid #f0f0f0',
                        opacity: a.status === 1 ? 0.7 : 1,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 500,
                            textDecoration: a.status === 1 ? 'line-through' : 'none',
                            color: a.status === 1 ? '#888' : '#333',
                          }}>
                            {a.action_desc}
                          </div>
                          <Space size={8} style={{ marginTop: 2 }}>
                            {a.assignee?.full_name && (
                              <span style={{ fontSize: 12, color: '#888' }}>
                                <TeamOutlined style={{ marginRight: 4 }} />{a.assignee.full_name}
                              </span>
                            )}
                            {a.due_date && (
                              <span style={{ fontSize: 12, color: dayjs(a.due_date).isBefore(dayjs()) && a.status !== 1 ? '#ff4d4f' : '#888' }}>
                                Due {dayjs(a.due_date).format('DD MMM')}
                              </span>
                            )}
                          </Space>
                        </div>
                        <Tag color={tagColor} style={{ margin: 0 }}>{tagLabel}</Tag>
                        {a.status !== 1 && (
                          <Button
                            size="small"
                            icon={<CheckOutlined />}
                            type="primary"
                            ghost
                            onClick={() => updateActionMut.mutate({ id: a.id, d: { status: 1 } })}
                          >
                            Done
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </Col>

      {/* Add Action Item Modal */}
      <Modal
        title="Add Action Item"
        open={actionModal}
        onCancel={() => setActModal(false)}
        onOk={() => actionForm.submit()}
        confirmLoading={addActionMut.isPending}
        destroyOnHidden
      >
        <Form form={actionForm} layout="vertical" onFinish={v => addActionMut.mutate(v)}>
          <Form.Item name="action_desc" label="Action Description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Describe the action to be taken…" />
          </Form.Item>
          <Form.Item name="assignee_emp_id" label="Assigned To" rules={[{ required: true }]}>
            <Select
              options={empOptions}
              showSearch
              filterOption={(i, o) => o.label?.toLowerCase().includes(i.toLowerCase())}
              placeholder="Select employee…"
            />
          </Form.Item>
          <Form.Item name="due_date" label="Due Date">
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
};

export default MeetingMinutes;
