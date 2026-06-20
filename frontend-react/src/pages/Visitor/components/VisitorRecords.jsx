import React, { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Descriptions, Select, DatePicker,
  Input, Row, Col, Badge, Popconfirm, message, Tooltip, Typography,
} from 'antd';
import {
  ReloadOutlined, SearchOutlined, EyeOutlined, DownloadOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import visitorAPI from '../../../services/visitorAPI';

const { RangePicker } = DatePicker;
const { Text } = Typography;

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

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const VisitorRecords = () => {
  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState(undefined);
  const [dateRange, setDateRange] = useState([null, null]);
  const [detail, setDetail]       = useState(null);
  const [exporting, setExporting] = useState(false);
  const qc                        = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['visitor-records', search, status, dateRange],
    queryFn: () => visitorAPI.getVisitorRecords({
      search,
      ...(status !== undefined ? { status } : {}),
      ...(dateRange[0] ? { start_date: dateRange[0].format('YYYY-MM-DD') } : {}),
      ...(dateRange[1] ? { end_date:   dateRange[1].format('YYYY-MM-DD') } : {}),
      limit: 200,
    }),
    staleTime: 20000,
  });
  const rows = data?.data ?? [];

  const forceOutMut = useMutation({
    mutationFn: (logId) => visitorAPI.forceCheckOut(logId),
    onSuccess: () => {
      message.success('Visitor checked out');
      qc.invalidateQueries(['visitor-records']);
      qc.invalidateQueries(['visitor-stats']);
      qc.invalidateQueries(['visitor-on-site']);
    },
    onError: (e) => message.error(e.message),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {
        ...(search                        ? { search }    : {}),
        ...(status !== undefined          ? { status }    : {}),
        ...(dateRange[0]                  ? { start_date: dateRange[0].format('YYYY-MM-DD') } : {}),
        ...(dateRange[1]                  ? { end_date:   dateRange[1].format('YYYY-MM-DD') } : {}),
      };
      const { blob, filename } = await visitorAPI.exportVisitorRecords(params);
      triggerDownload(blob, filename);
      message.success('Export downloaded');
    } catch (e) {
      message.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      title: 'Visitor',
      ellipsis: true,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.visitor?.full_name || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.visitor?.company || ''}</Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      width: 100,
      render: (_, r) => r.visitor?.visitor_type?.type_name
        ? <Tag>{r.visitor.visitor_type.type_name}</Tag>
        : null,
    },
    {
      title: 'Host',
      ellipsis: true,
      render: (_, r) => r.host_employee
        ? `${r.host_employee.first_name || ''} ${r.host_employee.last_name || ''}`.trim()
        : '—',
    },
    {
      title: 'Check-In',
      dataIndex: 'check_in_time',
      width: 140,
      render: (v) => v ? dayjs(v).format('DD MMM HH:mm') : '—',
    },
    {
      title: 'Check-Out',
      dataIndex: 'check_out_time',
      width: 140,
      render: (v) => v ? dayjs(v).format('DD MMM HH:mm') : '—',
    },
    {
      title: 'Duration',
      width: 90,
      render: (_, r) => duration(r.check_in_time, r.check_out_time),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (v) => <Badge status={STATUS[v]?.color} text={STATUS[v]?.text ?? v} />,
    },
    {
      title: '',
      width: 80,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View Details">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)} />
          </Tooltip>
          {r.status === 0 && (
            <Tooltip title="Force Check-Out">
              <Popconfirm
                title={`Check out ${r.visitor?.full_name || 'this visitor'}?`}
                onConfirm={() => forceOutMut.mutate(r.id)}
                okText="Check Out"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<LogoutOutlined />}
                  loading={forceOutMut.isPending && forceOutMut.variables === r.id}
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
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
            onChange={(e) => setSearch(e.target.value)}
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
            onChange={(v) => setDateRange(v ?? [null, null])}
            format="DD/MM/YYYY"
          />
        </Col>
        <Col flex={1} />
        <Col>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={exporting}
            >
              Export CSV
            </Button>
            <Button icon={<ReloadOutlined />} onClick={refetch} loading={isLoading} />
          </Space>
        </Col>
      </Row>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 900 }}
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
            <Descriptions.Item label="Visitor Type">
              {detail.visitor?.visitor_type?.type_name
                ? <Tag>{detail.visitor.visitor_type.type_name}</Tag>
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Host">
              {detail.host_employee
                ? `${detail.host_employee.first_name || ''} ${detail.host_employee.last_name || ''}`.trim()
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Check-In">
              {detail.check_in_time ? dayjs(detail.check_in_time).format('DD MMM YYYY HH:mm') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Check-Out">
              {detail.check_out_time ? dayjs(detail.check_out_time).format('DD MMM YYYY HH:mm') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Duration">{duration(detail.check_in_time, detail.check_out_time)}</Descriptions.Item>
            <Descriptions.Item label="Area">{detail.area?.area_name || '—'}</Descriptions.Item>
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
