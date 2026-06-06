import React, { useState } from 'react';
import {
  Table, Button, Space, Tag, App, Form, Drawer,
  Input, Select, InputNumber, Row, Col, Divider, Descriptions, Badge, Tooltip, Switch,
} from 'antd';
import { PlusOutlined, FileTextOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import { tableContainerStyle } from './shared';

const { Option } = Select;
const UNIT_LABEL = { 0:'Days', 1:'Hours', 2:'Minutes' };

const LeaveTypesTab = () => {
  const { message } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRec,  setDetailRec]  = useState(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['att-leave-types'],
    queryFn: () => apiService.get('/api/v1/attendance/leave-types'),
  });
  const rows = data?.data || [];

  const createM = useMutation({
    mutationFn: (d) => apiService.post('/api/v1/attendance/leave-types', d),
    onSuccess: () => { message.success('Leave type created'); close_(); qc.invalidateQueries(['att-leave-types']); },
    onError:   (e) => message.error(e?.message || 'Failed to create leave type'),
  });

  const close_ = () => { setDrawerOpen(false); form.resetFields(); };
  const submit = () => form.validateFields().then((v) => createM.mutate(v)).catch(() => {});

  const cols = [
    {
      title: 'Leave Type', dataIndex: 'leave_name', key: 'name',
      render: (n,r) => (
        <button type="button"
          style={{ background:'none', border:'none', padding:0, color:'#1890ff', cursor:'pointer', fontWeight:600, fontSize:13 }}
          onClick={() => { setDetailRec(r); setDetailOpen(true); }}>{n}</button>
      ),
    },
    { title: 'Unit',      dataIndex: 'unit',              key: 'unit',  width:90,  render: v => <Tag>{UNIT_LABEL[v]||v}</Tag> },
    { title: 'Max/Year',  dataIndex: 'max_days_per_year', key: 'max',   width:100, render: v => v ?? '—' },
    { title: 'Mustering', dataIndex: 'affects_mustering', key: 'mus',   width:110,
      render: v => <Badge status={v?'warning':'default'} text={v?'Affects':'No'} /> },
    { title: 'Approval',  dataIndex: 'requires_approval', key: 'appr',  width:110,
      render: v => <Badge status={v?'processing':'default'} text={v?'Required':'Not req.'} /> },
    {
      title: 'Actions', key:'act', fixed:'right', width:80,
      render: (_,r) => (
        <Tooltip title="View"><Button size="small" icon={<EyeOutlined />} onClick={() => { setDetailRec(r); setDetailOpen(true); }} /></Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding:24 }}>
      <style>{`
        .lt-mod-table .ant-table-thead .ant-table-cell {
          background: #f8fafc !important; color: #64748b !important;
          font-size: 11px !important; font-weight: 700 !important;
          text-transform: uppercase !important; letter-spacing: 0.5px !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
      `}</style>

      {/* ── Header bar ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:14, color:'#1f1f1f' }}>Leave Types</div>
          <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Configure available leave categories</div>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>Add Leave Type</Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Refresh</Button>
        </Space>
      </div>

      {/* ── Table ── */}
      <div style={tableContainerStyle}>
        <Table
          className="lt-mod-table"
          columns={cols}
          dataSource={rows}
          loading={isLoading}
          rowKey="id"
          size="middle"
          scroll={{ x:700 }}
          onRow={r => ({
            onMouseEnter: e => { e.currentTarget.style.background = '#f8fafc'; },
            onMouseLeave: e => { e.currentTarget.style.background = ''; },
          })}
          pagination={{ pageSize:20, showSizeChanger:true, showTotal:(t,r)=>`${r[0]}–${r[1]} of ${t}` }}
        />
      </div>

      {/* ── Add Drawer ── */}
      <Drawer title={<Space><FileTextOutlined style={{ color:'#52c41a' }} />Add Leave Type</Space>}
        open={drawerOpen} onClose={close_} width={520} destroyOnHidden
        footer={<Space style={{ float:'right' }}>
          <Button onClick={close_}>Cancel</Button>
          <Button type="primary" onClick={submit} loading={createM.isPending}>Create</Button>
        </Space>}>
        <Form form={form} layout="vertical" size="small">
          <Divider orientation="left"><Space><FileTextOutlined />Leave Type Details</Space></Divider>
          <Form.Item name="leave_name" label="Leave Type Name *" rules={[{ required:true }]}>
            <Input placeholder="e.g., Annual Leave, Sick Leave" size="middle" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="unit" label="Unit" initialValue={0}>
              <Select size="middle">{Object.entries(UNIT_LABEL).map(([k,v]) => <Option key={k} value={Number(k)}>{v}</Option>)}</Select>
            </Form.Item></Col>
            <Col span={12}><Form.Item name="max_days_per_year" label="Max Days Per Year">
              <InputNumber min={1} max={365} style={{ width:'100%' }} size="middle" placeholder="Unlimited if blank" /></Form.Item></Col>
          </Row>
          <Form.Item name="accrual_rule" label="Accrual Rule">
            <Input.TextArea rows={2} size="middle" placeholder="e.g., 1.5 days per month, from first day" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="affects_mustering" label="Affects Mustering" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="Yes" unCheckedChildren="No" /></Form.Item></Col>
            <Col span={12}><Form.Item name="requires_approval" label="Requires Approval" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="Yes" unCheckedChildren="No" /></Form.Item></Col>
          </Row>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ── */}
      <Drawer title={<Space><EyeOutlined />Leave Type Details</Space>}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={420} destroyOnHidden>
        {detailRec && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Name" span={2}><strong>{detailRec.leave_name}</strong></Descriptions.Item>
            <Descriptions.Item label="Unit">{UNIT_LABEL[detailRec.unit]}</Descriptions.Item>
            <Descriptions.Item label="Max/Year">{detailRec.max_days_per_year ?? 'Unlimited'}</Descriptions.Item>
            <Descriptions.Item label="Affects Mustering"><Badge status={detailRec.affects_mustering?'warning':'default'} text={detailRec.affects_mustering?'Yes':'No'} /></Descriptions.Item>
            <Descriptions.Item label="Requires Approval"><Badge status={detailRec.requires_approval?'processing':'default'} text={detailRec.requires_approval?'Yes':'No'} /></Descriptions.Item>
            <Descriptions.Item label="Accrual Rule" span={2}>{detailRec.accrual_rule || 'None'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};
export default LeaveTypesTab;
