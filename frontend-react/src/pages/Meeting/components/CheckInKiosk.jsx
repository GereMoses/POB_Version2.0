import React, { useState, useEffect } from 'react';
import {
  Card, Tabs, Form, Input, Select, Button, message, Alert,
  Descriptions, Tag, List, Avatar, Badge, Row, Col, Empty,
  Statistic, Divider,
} from 'antd';
import {
  QrcodeOutlined, UserOutlined, LoginOutlined, LogoutOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import meetingApi from '../../../services/meetingApi';
import usePersonnel from '../../../hooks/usePersonnel';

const STATUS = { 0: ['gold', 'Pending'], 1: ['green', 'Approved'], 2: ['red', 'Rejected'], 3: ['blue', 'Completed'], 4: ['default', 'Cancelled'] };

const CheckInKiosk = () => {
  const [meeting, setMeeting]     = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [lastResult, setResult]   = useState(null);
  const [now, setNow]             = useState(dayjs());
  const [qrForm]                  = Form.useForm();
  const [manualForm]              = Form.useForm();
  const { empOptions }            = usePersonnel();

  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: roomsData } = useQuery({
    queryKey: ['meeting-rooms'],
    queryFn:  () => meetingApi.getRooms(),
    staleTime: 60000,
  });
  const roomOptions = (roomsData?.data ?? []).map(r => ({ value: r.id, label: r.room_name }));

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['today-meetings'],
    queryFn:  () => meetingApi.getBookings({ status: 1, limit: 20 }),
    staleTime: 60000,
    refetchInterval: 120000,
  });
  const todayMeetings = (todayData?.data ?? []).filter(b => dayjs(b.start_time).isSame(dayjs(), 'day'));

  const lookupMut = useMutation({
    mutationFn: code => meetingApi.getBookings({ meeting_code: code, limit: 1 }),
    onSuccess: d => {
      const b = d?.data?.[0];
      if (b) { setMeeting(b); fetchAttendees(b.id); }
      else message.warning('Meeting code not found');
    },
    onError: () => message.error('Lookup failed'),
  });

  const fetchAttendees = async (bid) => {
    try {
      const res = await meetingApi.getBookingAttendees(bid);
      setAttendees(res?.data ?? []);
    } catch {}
  };

  const checkInMut = useMutation({
    mutationFn: d => meetingApi.checkInAttendee(d),
    onSuccess: d => {
      const name = d?.data?.attendee_name ?? '';
      message.success(`Check-in successful! Welcome, ${name}`);
      setResult({ type: 'checkin', name, time: dayjs() });
      if (meeting) fetchAttendees(meeting.id);
    },
    onError: e => {
      message.error(e.response?.data?.detail || 'Check-in failed');
      setResult({ type: 'error', msg: e.response?.data?.detail || 'Check-in failed', time: dayjs() });
    },
  });

  const handleQRCheckIn = v => {
    checkInMut.mutate({ meeting_code: v.code, verify_type: 100 });
  };

  const handleManualCheckIn = v => {
    checkInMut.mutate({ emp_code: v.emp_code, room_id: v.room_id, verify_type: 100 });
  };

  const checkedInCount = attendees.filter(a => a.attendance_records?.length > 0).length;

  const qrTabContent = (
    <div style={{ maxWidth: 520 }}>
      <Form form={qrForm} layout="vertical" onFinish={handleQRCheckIn}>
        <Form.Item name="code" label="Meeting Code / QR Code">
          <Input.Search
            placeholder="Scan or type meeting code…"
            size="large"
            enterButton={<><QrcodeOutlined /> Look Up</>}
            onSearch={v => { if (v) lookupMut.mutate(v); }}
            loading={lookupMut.isPending}
            onChange={e => { if (!e.target.value) { setMeeting(null); setAttendees([]); } }}
          />
        </Form.Item>
      </Form>

      {lastResult && (
        <Alert
          type={lastResult.type === 'checkin' ? 'success' : 'error'}
          showIcon
          closable
          onClose={() => setResult(null)}
          style={{ marginBottom: 12 }}
          message={lastResult.type === 'checkin'
            ? `Welcome, ${lastResult.name}! Checked in at ${lastResult.time.format('HH:mm')}`
            : lastResult.msg
          }
        />
      )}

      {meeting && (
        <>
          <Alert type="success" icon={<CheckCircleOutlined />} showIcon message="Meeting found" style={{ marginBottom: 12 }} />
          <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Title" span={2}>{meeting.title}</Descriptions.Item>
            <Descriptions.Item label="Room">{meeting.room?.room_name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              {(() => { const [c, t] = STATUS[meeting.status] ?? ['default', '—']; return <Tag color={c}>{t}</Tag>; })()}
            </Descriptions.Item>
            <Descriptions.Item label="Start">{dayjs(meeting.start_time).format('DD MMM YYYY HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="End">{dayjs(meeting.end_time).format('HH:mm')}</Descriptions.Item>
          </Descriptions>

          <Row gutter={8} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Statistic
                title="Attendees"
                value={attendees.length}
                prefix={<UserOutlined />}
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Checked In"
                value={checkedInCount}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ fontSize: 20, color: '#52c41a' }}
              />
            </Col>
          </Row>

          <Button
            type="primary"
            icon={<LoginOutlined />}
            block
            size="large"
            loading={checkInMut.isPending}
            onClick={() => checkInMut.mutate({ meeting_code: meeting.meeting_code, verify_type: 100 })}
          >
            Confirm Check-In
          </Button>

          {attendees.length > 0 && (
            <>
              <Divider style={{ margin: '16px 0 8px' }} />
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                Attendee List
              </div>
              <List
                size="small"
                dataSource={attendees}
                renderItem={a => (
                  <List.Item style={{ padding: '6px 0' }}>
                    <List.Item.Meta
                      avatar={
                        <Badge
                          dot
                          color={a.attendance_records?.length ? '#52c41a' : '#d9d9d9'}
                          offset={[-2, 28]}
                        >
                          <Avatar icon={<UserOutlined />} size="small" />
                        </Badge>
                      }
                      title={<span style={{ fontSize: 13 }}>{a.employee?.full_name || a.ext_name || '—'}</span>}
                      description={
                        <span style={{ fontSize: 12, color: a.attendance_records?.length ? '#52c41a' : '#aaa' }}>
                          {a.attendance_records?.length ? 'Checked in' : 'Not yet checked in'}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </>
      )}
    </div>
  );

  const manualTabContent = (
    <div style={{ maxWidth: 420 }}>
      <Form form={manualForm} layout="vertical" onFinish={handleManualCheckIn}>
        <Form.Item name="room_id" label="Room" rules={[{ required: true }]}>
          <Select options={roomOptions} placeholder="Select room…" size="large" />
        </Form.Item>
        <Form.Item name="emp_code" label="Employee Code" rules={[{ required: true }]}>
          <Input placeholder="e.g. EMP001" size="large" prefix={<UserOutlined />} />
        </Form.Item>
        <Button type="primary" icon={<LoginOutlined />} htmlType="submit" loading={checkInMut.isPending} block size="large">
          Check In
        </Button>
      </Form>
    </div>
  );

  const todayTabContent = (
    <div>
      {todayLoading ? null : todayMeetings.length === 0 ? (
        <Empty description="No meetings scheduled today" style={{ padding: '40px 0' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todayMeetings.map(b => {
            const isNow = dayjs().isAfter(b.start_time) && dayjs().isBefore(b.end_time);
            const isPast = dayjs().isAfter(b.end_time);
            return (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 6,
                background: '#fff',
                border: '1px solid #f0f0f0',
                borderLeft: `3px solid ${isNow ? '#52c41a' : '#0078D4'}`,
                opacity: isPast ? 0.6 : 1,
              }}>
                <div style={{ flex: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    <CalendarOutlined style={{ marginRight: 4 }} />
                    {dayjs(b.start_time).format('HH:mm')} — {dayjs(b.end_time).format('HH:mm')}
                    {' · '}{b.room?.room_name ?? '—'}
                  </div>
                </div>
                {isNow && <Tag color="green">In Progress</Tag>}
                {!isNow && !isPast && <Tag color="blue">Upcoming</Tag>}
                {isPast && <Tag color="default">Ended</Tag>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Row gutter={16}>
      <Col xs={24} lg={16}>
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><LoginOutlined /> Check-In Station</span>
              <div style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: 700, color: '#0078D4' }}>
                {now.format('HH:mm:ss')}
              </div>
            </div>
          }
        >
          <Tabs
            items={[
              { key: 'qr',     label: <span><QrcodeOutlined />QR / Code</span>,   children: qrTabContent },
              { key: 'manual', label: <span><UserOutlined />Manual Entry</span>,  children: manualTabContent },
            ]}
          />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card
          title={<span><CalendarOutlined /> Today's Schedule</span>}
          size="small"
          extra={<span style={{ fontSize: 12, color: '#888' }}>{now.format('DD MMM YYYY')}</span>}
        >
          {todayTabContent}
        </Card>
      </Col>
    </Row>
  );
};

export default CheckInKiosk;
