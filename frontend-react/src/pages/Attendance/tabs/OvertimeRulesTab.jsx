import React, { useState } from 'react';
import {
  Table, Card, Button, Space, Tag, App, Form, Drawer,
  Input, Select, InputNumber, Row, Col, Divider, Descriptions, Badge, Tooltip,
} from 'antd';
import { PlusOutlined, SettingOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';

const { Option } = Select;
const OT_TYPE = { 0:'Daily', 1:'Weekend', 2:'Holiday', 3:'Special' };
const OT_COLOR = { 0:'blue', 1:'cyan', 2:'red', 3:'purple' };

const OvertimeRulesTab = () => {
  const { message } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRec,  setDetailRec]  = useState(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['att-ot-rules'],
    queryFn: () => apiService.get('/api/v1/attendance/overtime-rules'),
  });
  const rows = data?.data || [];

  const createM = useMutation({
    mutationFn: (d) => apiService.post('/api/v1/attendance/overtime-rules', d),
    onSuccess: () => { message.success('OT rule created'); close_(); qc.invalidateQueries(['att-ot-rules']); },
    onError:   (e) => message.error(e?.message || 'Failed to create OT rule'),
  });

  const close_ = () => { setDrawerOpen(false); form.resetFields(); };
  const submit = () => form.validateFields().then((v) => createM.mutate(v)).catch(() => {});

  const cols = [
    {
      title: 'Rule Name', dataIndex:'rule_name', key:'name',
      render: (n,r) => (
        <button type="button" style={{ background:'none', border:'none', padding:0, color:'#1890ff', cursor:'pointer', fontWeight:600, fontSize:13 }}
          onClick={() => { setDetailRec(r); setDetailOpen(true); }}>{n}</button>
      ),
    },
    { title:'OT Type',    dataIndex:'ot_type',     key:'ot', width:110, render: v => <Tag color={OT_COLOR[v]}>{OT_TYPE[v]||v}</Tag> },
    { title:'Min (min)',  dataIndex:'min_minutes',  key:'mn', width:100, render: v => `${v} min` },
    { title:'Rate',       dataIndex:'rate',         key:'rt', width:90,  render: v => `${v}×` },
    { title:'Area',       dataIndex:'area_name',    key:'ar', render: n => n || 'All Areas' },
    {
      title:'Actions', key:'act', fixed:'right', width:80,
      render: (_,r) => <Tooltip title="View"><Button size="small" icon={<EyeOutlined />} onClick={() => { setDetailRec(r); setDetailOpen(true); }} /></Tooltip>,
    },
  ];

  return (
    <div style={{ padding:24 }}>
      <Card styles={{ body:{ padding:'12px 16px' } }} style={{ marginBottom:16 }}>
        <Row align="middle" justify="space-between">
          <Col><span style={{ fontWeight:600 }}>Overtime Rules — define thresholds and multiplier rates</span></Col>
          <Col><Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>Add OT Rule</Button>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Refresh</Button>
          </Space></Col>
        </Row>
      </Card>

      <Card styles={{ body:{ padding:0 } }}>
        <Table columns={cols} dataSource={rows} loading={isLoading} rowKey="id" size="middle" scroll={{ x:700 }}
          pagination={{ pageSize:20, showSizeChanger:true, showTotal:(t,r)=>`${r[0]}–${r[1]} of ${t}` }} />
      </Card>

      <Drawer title={<Space><SettingOutlined style={{ color:'#fa8c16' }} />Add OT Rule</Space>}
        open={drawerOpen} onClose={close_} width={520} destroyOnHidden
        footer={<Space style={{ float:'right' }}>
          <Button onClick={close_}>Cancel</Button>
          <Button type="primary" onClick={submit} loading={createM.isPending}>Create</Button>
        </Space>}>
        <Form form={form} layout="vertical" size="small">
          <Divider orientation="left"><Space><SettingOutlined />Rule Configuration</Space></Divider>
          <Form.Item name="rule_name" label="Rule Name *" rules={[{ required:true }]}>
            <Input placeholder="e.g., Weekend OT 1.5x" size="middle" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="ot_type" label="OT Type *" rules={[{ required:true }]}>
              <Select size="middle">{Object.entries(OT_TYPE).map(([k,v]) => <Option key={k} value={Number(k)}>{v}</Option>)}</Select>
            </Form.Item></Col>
            <Col span={12}><Form.Item name="min_minutes" label="Minimum Minutes *" rules={[{ required:true }]} initialValue={30}>
              <InputNumber min={1} max={480} style={{ width:'100%' }} size="middle" /></Form.Item></Col>
            <Col span={12}><Form.Item name="rate" label="Rate Multiplier" initialValue={1.5}>
              <InputNumber min={1} max={5} step={0.25} style={{ width:'100%' }} size="middle" /></Form.Item></Col>
          </Row>
        </Form>
      </Drawer>

      <Drawer title={<Space><EyeOutlined />OT Rule Details</Space>}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={420} destroyOnHidden>
        {detailRec && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Rule Name" span={2}><strong>{detailRec.rule_name}</strong></Descriptions.Item>
            <Descriptions.Item label="OT Type"><Tag color={OT_COLOR[detailRec.ot_type]}>{OT_TYPE[detailRec.ot_type]}</Tag></Descriptions.Item>
            <Descriptions.Item label="Min Minutes">{detailRec.min_minutes} min</Descriptions.Item>
            <Descriptions.Item label="Rate">{detailRec.rate}×</Descriptions.Item>
            <Descriptions.Item label="Area">{detailRec.area_name || 'All Areas'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};
export default OvertimeRulesTab;
