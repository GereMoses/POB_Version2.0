import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Descriptions, Select, DatePicker,
  Input, Row, Col, Badge,
} from 'antd';
import { ReloadOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';

const { RangePicker } = DatePicker;

const STATUS = {
  0: { color: 'processing', text: 'On Site' },
  1: { color: 'success',    text: 'Checked Out' },
  2: { color: 'error',      text: 'Overstay' },
};

const duration = (checkIn, checkOut) => {
  if (!checkIn) return '—';
  const ms = (checkOut ? dayjs(checkOut) : dayjs()).diff(dayjs(checkIn));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
};

const VisitorRecords = () => {
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState(undefined);
  const [dateRange, setDateRange] = useState([null, null]);
  const [detail, setDetail]     = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-records', search, status, dateRange],
    queryFn: () => visitorAPI.getVisitorRecords({
      search,
      ...(status !== undefined ? { status } : {}),
      ...(dateRange[0] ? { start_date: dateRange[0].format('YYYY-MM-DD') } : {}),
      ...(dateRange[1] ? { end_date: dateRange[1].format('YYYY-MM-DD') } : {}),
      limit: 200,
    }),
    staleTime: 20000,
  });
  const rows = data?.data ?? [];

  const columns = [
    {
      title: 'Visitor', ellipsis: true,
      render: (_, r) => (
        <span>
          <strong>{r.visitor?.full_name || '—'}</strong>
          <br /><small style={{ color: '#888' }}>{r.visitor?.company || ''}</small>
        </span>
      ),
    },
    { title: 'Host',     ellipsis: true, render: (_, r) => r.host_employee?.full_name || '—' },
    {
      title: 'Check-In', dataIndex: 'check_in_time', width: 140,
      render: v => v ? dayjs(v).format('DD MMM HH:mm') : '—',
    },
    {
      title: 'Check-Out', dataIndex: 'check_out_time', width: 140,
      render: v => v ? dayjs(v).format('DD MMM HH:mm') : '—',
    },
    {
      title: 'Duration', width: 90,
      render: (_, r) => duration(r.check_in_time, r.check_out_time),
    },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: v => <Badge status={STATUS[v]?.color} text={STATUS[v]?.text ?? v} />,
    },
    {
      title: '', width: 50,
      render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)} />,
    },
  ];

  return (
    <>
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search visitor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
        </Col>
        <Col>
          <Select
            placeholder="Status"
            value={status}
            onChange={setStatus}
            allowClear
            style={{ width: 130 }}
            options={Object.entries(STATUS).map(([v, { text }]) => ({ value: Number(v), label: text }))}
          />
        </Col>
        <Col>
          <RangePicker
            value={dateRange}
            onChange={v => setDateRange(v ?? [null, null])}
            format="DD/MM/YYYY"
          />
        </Col>
        <Col flex={1} />
        <Col>
          <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
        </Col>
      </Row>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 800 }}
      />

      <Modal
        title="Visit Details"
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={560}
      >
        {detail && (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Visitor">{detail.visitor?.full_name}</Descriptions.Item>
            <Descriptions.Item label="Company">{detail.visitor?.company || '—'}</Descriptions.Item>
            <Descriptions.Item label="Phone">{detail.visitor?.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Email">{detail.visitor?.email || '—'}</Descriptions.Item>
            <Descriptions.Item label="Host">{detail.host_employee?.full_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Check-In">{detail.check_in_time ? dayjs(detail.check_in_time).format('DD MMM YYYY HH:mm') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Check-Out">{detail.check_out_time ? dayjs(detail.check_out_time).format('DD MMM YYYY HH:mm') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Duration">{duration(detail.check_in_time, detail.check_out_time)}</Descriptions.Item>
            <Descriptions.Item label="Area">{detail.area?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Temp Card">{detail.card_no || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge status={STATUS[detail.status]?.color} text={STATUS[detail.status]?.text} />
            </Descriptions.Item>
            {detail.pre_registration && (
              <Descriptions.Item label="Purpose">{detail.pre_registration.purpose || '—'}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </>
  );
};

export default VisitorRecords;
