import React, { useState } from 'react';
import {
  Table, Button, Space, Tag, App, Popconfirm, Form, Drawer,
  Input, Select, DatePicker, Row, Col, Divider, Descriptions, Badge, Tooltip,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, CalendarOutlined,
  EyeOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';
import { tableContainerStyle } from './shared';

const { Option } = Select;

const HOLIDAY_TYPE  = { 0:'Public', 1:'Company', 2:'Religious', 3:'Special' };
const HOLIDAY_COLOR = { 0:'red', 1:'blue', 2:'gold', 3:'purple' };

const HolidaysTab = () => {
  const { message } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRec,  setDetailRec]  = useState(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['att-holidays'],
    queryFn: () => apiService.get('/api/v1/attendance/holidays'),
  });
  const rows = data?.data || [];

  const createM = useMutation({
    mutationFn: (d) => apiService.post('/api/v1/attendance/holidays', d),
    onSuccess: () => { message.success('Holiday created'); close_(); qc.invalidateQueries(['att-holidays']); },
    onError:   (e) => message.error(e?.response?.data?.detail || 'Failed'),
  });

  const close_ = () => { setDrawerOpen(false); form.resetFields(); };

  const submit = () => form.validateFields().then((v) => {
    createM.mutate({
      ...v,
      start_date: v.start_date.format('YYYY-MM-DD'),
      end_date:   v.end_date.format('YYYY-MM-DD'),
    });
  }).catch(() => {});

  const getStatus = (start, end) => {
    const now = dayjs();
    if (now.isBefore(dayjs(start))) return { label:'Upcoming', color:'processing' };
    if (now.isAfter(dayjs(end)))    return { label:'Past',     color:'default' };
    return { label:'Active', color:'success' };
  };

  const cols = [
    {
      title: 'Holiday', dataIndex: 'holiday_name', key: 'name',
      render: (n, r) => (
        <button type="button"
          style={{ background:'none', border:'none', padding:0, color:'#1890ff', cursor:'pointer', fontWeight:600, fontSize:13 }}
          onClick={() => { setDetailRec(r); setDetailOpen(true); }}>{n}</button>
      ),
    },
    {
      title: 'Type', dataIndex: 'holiday_type', key: 'type', width:120,
      render: t => <Tag color={HOLIDAY_COLOR[t]||'default'}>{HOLIDAY_TYPE[t]||t}</Tag>,
    },
    { title: 'Start', dataIndex: 'start_date', key: 'sd', width:120, render: d => d ? dayjs(d).format('DD MMM YYYY') : '—' },
    { title: 'End',   dataIndex: 'end_date',   key: 'ed', width:120, render: d => d ? dayjs(d).format('DD MMM YYYY') : '—' },
    {
      title: 'Status', key: 'status', width:100,
      render: (_,r) => { const s = getStatus(r.start_date, r.end_date); return <Badge status={s.color} text={s.label} />; },
    },
    {
      title: 'Actions', key: 'act', fixed:'right', width:90,
      render: (_,r) => (
        <Space size={4}>
          <Tooltip title="View"><Button size="small" icon={<EyeOutlined />} onClick={() => { setDetailRec(r); setDetailOpen(true); }} /></Tooltip>
          <Popconfirm title="Delete holiday?" onConfirm={() => message.info('Delete not yet wired')} okText="Delete" okButtonProps={{ danger:true }}>
            <Tooltip title="Delete"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .hol-mod-table .ant-table-thead .ant-table-cell {
          background: #f8fafc !important; color: #64748b !important;
          font-size: 11px !important; font-weight: 700 !important;
          text-transform: uppercase !important; letter-spacing: 0.5px !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
      `}</style>

      {/* ── Header bar ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:14, color:'#1f1f1f' }}>Holiday Calendar</div>
          <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Public, company, and religious holidays</div>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>Add Holiday</Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Refresh</Button>
        </Space>
      </div>

      {/* ── Table ── */}
      <div style={tableContainerStyle}>
        <Table
          className="hol-mod-table"
          columns={cols}
          dataSource={rows}
          loading={isLoading}
          rowKey="id"
          size="middle"
          scroll={{ x:750 }}
          onRow={r => ({
            onMouseEnter: e => { e.currentTarget.style.background = '#f8fafc'; },
            onMouseLeave: e => { e.currentTarget.style.background = ''; },
          })}
          pagination={{ pageSize:20, showSizeChanger:true, showTotal:(t,r)=>`${r[0]}–${r[1]} of ${t}` }}
        />
      </div>

      {/* ── Add Drawer ── */}
      <Drawer title={<Space><CalendarOutlined style={{ color:'#fa8c16' }} />Add Holiday</Space>}
        open={drawerOpen} onClose={close_} width={520} destroyOnHidden
        footer={<Space style={{ float:'right' }}>
          <Button onClick={close_}>Cancel</Button>
          <Button type="primary" onClick={submit} loading={createM.isPending}>Create</Button>
        </Space>}>
        <Form form={form} layout="vertical" size="small">
          <Divider orientation="left"><Space><CalendarOutlined />Details</Space></Divider>
          <Form.Item name="holiday_name" label="Holiday Name *" rules={[{ required:true }]}>
            <Input placeholder="e.g., New Year Day" size="middle" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="start_date" label="Start Date *" rules={[{ required:true }]}>
              <DatePicker style={{ width:'100%' }} format="DD MMM YYYY" size="middle" /></Form.Item></Col>
            <Col span={12}><Form.Item name="end_date" label="End Date *" rules={[{ required:true }]}>
              <DatePicker style={{ width:'100%' }} format="DD MMM YYYY" size="middle" /></Form.Item></Col>
          </Row>
          <Form.Item name="holiday_type" label="Holiday Type" initialValue={0}>
            <Select size="middle">
              {Object.entries(HOLIDAY_TYPE).map(([k,v]) => <Option key={k} value={Number(k)}>{v}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ── */}
      <Drawer title={<Space><EyeOutlined />Holiday Details</Space>}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={420} destroyOnHidden>
        {detailRec && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Name" span={2}><strong>{detailRec.holiday_name}</strong></Descriptions.Item>
            <Descriptions.Item label="Type"><Tag color={HOLIDAY_COLOR[detailRec.holiday_type]}>{HOLIDAY_TYPE[detailRec.holiday_type]}</Tag></Descriptions.Item>
            <Descriptions.Item label="Status">
              {(() => { const s = getStatus(detailRec.start_date, detailRec.end_date); return <Badge status={s.color} text={s.label} />; })()}
            </Descriptions.Item>
            <Descriptions.Item label="Start">{detailRec.start_date ? dayjs(detailRec.start_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="End">{detailRec.end_date ? dayjs(detailRec.end_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};
export default HolidaysTab;
