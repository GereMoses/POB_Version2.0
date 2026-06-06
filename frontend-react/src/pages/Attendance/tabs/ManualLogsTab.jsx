import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Tag, App, Popconfirm, Form, Drawer,
  Select, DatePicker, Row, Col, Divider, Descriptions, Badge, Tooltip,
  Input, Popover,
} from 'antd';
import {
  PlusOutlined, CheckOutlined, CloseOutlined, ToolOutlined,
  EyeOutlined, ReloadOutlined, SearchOutlined, SettingOutlined,
  ClockCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';
import { PUNCH_STATE, pState, ColTogglePopover, EmployeeCell, tableContainerStyle } from './shared';

const { Option } = Select;
const STATUS_CFG = {
  0: { label:'Pending',  badge:'warning' },
  1: { label:'Approved', badge:'success' },
  2: { label:'Rejected', badge:'error'   },
};

const ManualLogsTab = () => {
  const { message } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRec,  setDetailRec]  = useState(null);
  const [empSearch,  setEmpSearch]  = useState('');
  const [filterSt,   setFilterSt]   = useState(null);
  const [selected,   setSelected]   = useState([]);
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [colPopOpen, setColPopOpen] = useState(false);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['att-manual-logs', empSearch, filterSt],
    queryFn: () => {
      const p = new URLSearchParams();
      if (empSearch)         p.append('search', empSearch);
      if (filterSt !== null) p.append('status', filterSt);
      return apiService.get(`/api/v1/attendance/manual-logs?${p}`);
    },
    refetchInterval: 30000,
  });
  const rows = data?.data || [];

  const { data: empData } = useQuery({
    queryKey:['employees-active'],
    queryFn: () => apiService.get('/api/v1/personnel/?status=ACTIVE&page_size=500'),
  });
  const employees = empData?.results || [];

  const createM = useMutation({
    mutationFn: (d) => apiService.post('/api/v1/attendance/manual-logs', d),
    onSuccess: () => { message.success('Manual log submitted'); close_(); qc.invalidateQueries(['att-manual-logs']); },
    onError:   (e) => message.error(e?.message || 'Failed to submit log'),
  });

  const approveM = useMutation({
    mutationFn: ({ id, action }) => apiService.post(`/api/v1/attendance/manual-logs/${id}/approve`, { action }),
    onSuccess: (_,v) => {
      message.success(`Log ${v.action === 'approve' ? 'approved' : 'rejected'} successfully`);
      qc.invalidateQueries(['att-manual-logs']);
    },
    onError: (e) => message.error(e?.message || 'Failed to update log'),
  });

  const bulkApproveM = useMutation({
    mutationFn: ({ ids, action }) =>
      Promise.all(ids.map(id => apiService.post(`/api/v1/attendance/manual-logs/${id}/approve`, { action }))),
    onSuccess: (_, v) => {
      message.success(`${v.ids.length} log(s) ${v.action === 'approve' ? 'approved' : 'rejected'}`);
      setSelected([]);
      qc.invalidateQueries(['att-manual-logs']);
    },
    onError: (e) => message.error(e?.message || 'Bulk action failed'),
  });

  const close_ = () => { setDrawerOpen(false); form.resetFields(); };
  const submit = () => form.validateFields().then((v) => {
    createM.mutate({
      emp_id:      v.emp_id,
      punch_time:  v.punch_time.toISOString(),
      punch_state: v.punch_state,
      reason:      v.reason || null,
    });
  }).catch(() => {});

  const toggleCol = (key) => setHiddenCols(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  const pending  = rows.filter(r => r.approval_status === 0).length;
  const approved = rows.filter(r => r.approval_status === 1).length;

  const pendingSelected = selected.filter(id => {
    const row = rows.find(r => r.id === id);
    return row?.approval_status === 0;
  });

  const COL_DEFS = [
    { title:'Employee', key:'employee',
      render: (_,r) => (
        <EmployeeCell
          name={r.emp_name || `Employee #${r.emp_id}`}
          code={r.emp_code || ''}
          onClick={() => { setDetailRec(r); setDetailOpen(true); }}
        />
      ),
    },
    { title:'Punch Time', key:'pt', dataIndex:'punch_time', width:160,
      render: d => d ? dayjs(d).format('DD MMM YYYY HH:mm') : '—' },
    { title:'Type', key:'ps', dataIndex:'punch_state', width:110,
      render: s => { const p = pState(s); return <Tag color={p.color}>{p.label}</Tag>; } },
    { title:'Reason', key:'rs', dataIndex:'reason', ellipsis:true },
    { title:'Status', key:'status', dataIndex:'approval_status', width:110,
      render: s => { const c = STATUS_CFG[s]; return c ? <Badge status={c.badge} text={c.label} /> : '—'; } },
  ];

  const cols = useMemo(() => {
    const visible = COL_DEFS.filter(c => !hiddenCols.has(c.key));
    return [...visible, {
      title:'Actions', key:'act', fixed:'right', width:130,
      render: (_,r) => (
        <Space size={4}>
          <Tooltip title="View">
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setDetailRec(r); setDetailOpen(true); }} />
          </Tooltip>
          {r.approval_status === 0 && (
            <>
              <Popconfirm title="Approve this log?" onConfirm={() => approveM.mutate({ id:r.id, action:'approve' })} okText="Approve">
                <Tooltip title="Approve"><Button size="small" type="primary" icon={<CheckOutlined />} /></Tooltip>
              </Popconfirm>
              <Popconfirm title="Reject this log?" onConfirm={() => approveM.mutate({ id:r.id, action:'reject' })} okText="Reject" okButtonProps={{ danger:true }}>
                <Tooltip title="Reject"><Button size="small" danger icon={<CloseOutlined />} /></Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    }];
  }, [hiddenCols]);

  const rowSelection = {
    selectedRowKeys: selected,
    onChange: setSelected,
  };

  return (
    <div style={{ padding:24 }}>
      <style>{`
        .ml-mod-table .ant-table-thead .ant-table-cell {
          background: #f8fafc !important; color: #64748b !important;
          font-size: 11px !important; font-weight: 700 !important;
          text-transform: uppercase !important; letter-spacing: 0.5px !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
      `}</style>

      {/* ── Stat cards ── */}
      <Row gutter={[14,14]} style={{ marginBottom:20 }}>
        {[
          { title:'Pending Approvals', value:pending,     icon:<ClockCircleOutlined />, color:'#fa8c16' },
          { title:'Approved Logs',     value:approved,    icon:<CheckCircleOutlined />, color:'#52c41a' },
          { title:'Total Logs',        value:rows.length, icon:<ToolOutlined />,        color:'#1890ff' },
        ].map(s => (
          <Col xs={12} sm={8} key={s.title}>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'16px 18px', display:'flex', alignItems:'center', gap:14, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', height:'100%' }}>
              <div style={{ width:44, height:44, borderRadius:10, flexShrink:0, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {React.cloneElement(s.icon, { style:{ fontSize:20, color:s.color } })}
              </div>
              <div>
                <div style={{ color:'#8c8c8c', fontSize:12, fontWeight:500 }}>{s.title}</div>
                <div style={{ fontSize:22, fontWeight:700, color:'#1f1f1f', lineHeight:1.2, marginTop:2 }}>{s.value}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ── Filter bar ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'12px 16px', marginBottom:16 }}>
        <Row gutter={[12,8]} align="middle">
          <Col xs={24} sm={10} md={8}>
            <Input placeholder="Search employee…" prefix={<SearchOutlined style={{ color:'#94a3b8' }} />} value={empSearch}
              onChange={e => setEmpSearch(e.target.value)} allowClear />
          </Col>
          <Col xs={12} sm={5} md={4}>
            <Select placeholder="Status" style={{ width:'100%' }} value={filterSt}
              onChange={setFilterSt} allowClear>
              {Object.entries(STATUS_CFG).map(([k,v]) => <Option key={k} value={Number(k)}>{v.label}</Option>)}
            </Select>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
                Add Manual Log
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Refresh</Button>
              <Popover
                title="Show / Hide Columns" trigger="click"
                open={colPopOpen} onOpenChange={setColPopOpen}
                content={<ColTogglePopover colDefs={COL_DEFS} hidden={hiddenCols} onToggle={toggleCol} />}>
                <Tooltip title="Adjust columns">
                  <Button icon={<SettingOutlined />} />
                </Tooltip>
              </Popover>
            </Space>
          </Col>
        </Row>
      </div>

      {/* ── Bulk bar ── */}
      {selected.length > 0 && (
        <div style={{ background:'#1d4ed8', borderRadius:10, padding:'10px 16px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:'#fff', fontWeight:600, fontSize:13 }}>
            {selected.length} log{selected.length !== 1 ? 's' : ''} selected
            {pendingSelected.length > 0 && (
              <span style={{ color:'#93c5fd', marginLeft:8, fontWeight:400 }}>
                ({pendingSelected.length} pending)
              </span>
            )}
          </span>
          <Space>
            {pendingSelected.length > 0 && (
              <>
                <Popconfirm
                  title={`Approve ${pendingSelected.length} selected log(s)?`}
                  onConfirm={() => bulkApproveM.mutate({ ids: pendingSelected, action: 'approve' })}
                  okText="Approve All">
                  <Button size="small" icon={<CheckOutlined />}
                    style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff' }}
                    loading={bulkApproveM.isPending}>
                    Approve {pendingSelected.length}
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title={`Reject ${pendingSelected.length} selected log(s)?`}
                  onConfirm={() => bulkApproveM.mutate({ ids: pendingSelected, action: 'reject' })}
                  okText="Reject All" okButtonProps={{ danger: true }}>
                  <Button size="small" icon={<CloseOutlined />}
                    style={{ background:'rgba(239,68,68,0.2)', border:'1px solid rgba(239,68,68,0.4)', color:'#fca5a5' }}
                    loading={bulkApproveM.isPending}>
                    Reject {pendingSelected.length}
                  </Button>
                </Popconfirm>
              </>
            )}
            <Button size="small" icon={<CloseOutlined />}
              style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff' }}
              onClick={() => setSelected([])}>
              Clear
            </Button>
          </Space>
        </div>
      )}

      {/* ── Table ── */}
      <div style={tableContainerStyle}>
        <Table
          className="ml-mod-table"
          columns={cols}
          dataSource={rows}
          loading={isLoading}
          rowKey="id"
          size="middle"
          scroll={{ x:950 }}
          rowSelection={rowSelection}
          onRow={r => ({
            onMouseEnter: e => { e.currentTarget.style.background = '#f8fafc'; },
            onMouseLeave: e => { e.currentTarget.style.background = ''; },
          })}
          pagination={{ pageSize:20, showSizeChanger:true, showTotal:(t,r)=>`${r[0]}–${r[1]} of ${t}` }}
        />
      </div>

      {/* ── Add Manual Log Drawer ── */}
      <Drawer title={<Space><ToolOutlined style={{ color:'#722ed1' }} />Add Manual Punch Log</Space>}
        open={drawerOpen} onClose={close_} width={680} destroyOnHidden
        footer={<Space style={{ float:'right' }}>
          <Button onClick={close_}>Cancel</Button>
          <Button type="primary" onClick={submit} loading={createM.isPending}>Submit</Button>
        </Space>}>
        <Form form={form} layout="vertical" size="small">
          <Divider orientation="left"><Space><ToolOutlined />Punch Correction</Space></Divider>
          <Form.Item name="emp_id" label="Employee *" rules={[{ required:true }]}>
            <Select showSearch optionFilterProp="children" size="middle" placeholder="Select employee">
              {employees.map(e => {
                const n = e.full_name||`${e.first_name||''} ${e.last_name||''}`.trim();
                return <Option key={e.id} value={e.id}>{n} · {e.emp_code}</Option>;
              })}
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="punch_time" label="Punch Date & Time *" rules={[{ required:true }]}>
                <DatePicker showTime style={{ width:'100%' }} format="DD MMM YYYY HH:mm" size="middle" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="punch_state" label="Punch Type *" rules={[{ required:true }]}>
                <Select size="middle" placeholder="Check-in / Check-out">
                  {Object.entries(PUNCH_STATE).map(([k,v]) => <Option key={k} value={Number(k)}>{v.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason *"
            rules={[{ required:true, min:5, message:'Please provide a reason (min 5 chars)' }]}>
            <Input.TextArea rows={3} size="middle" placeholder="Reason for manual log correction…" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ── */}
      <Drawer title={<Space><EyeOutlined />Manual Log Details</Space>}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={460} destroyOnHidden>
        {detailRec && (
          <>
            <Divider orientation="left" style={{ fontSize:12 }}>Employee</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Name" span={2}><strong>{detailRec.emp_name||`#${detailRec.emp_id}`}</strong></Descriptions.Item>
              <Descriptions.Item label="Code">{detailRec.emp_code||'—'}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left" style={{ fontSize:12, marginTop:14 }}>Log Details</Divider>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Status" span={2}>
                {(() => { const c = STATUS_CFG[detailRec.approval_status]; return c ? <Badge status={c.badge} text={c.label} /> : '—'; })()}
              </Descriptions.Item>
              <Descriptions.Item label="Punch Time">{detailRec.punch_time ? dayjs(detailRec.punch_time).format('DD MMM YYYY HH:mm') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Type">{(() => { const p = pState(detailRec.punch_state); return <Tag color={p.color}>{p.label}</Tag>; })()}</Descriptions.Item>
              <Descriptions.Item label="Reason" span={2}>{detailRec.reason||'—'}</Descriptions.Item>
              <Descriptions.Item label="Approved At" span={2}>{detailRec.approved_at ? dayjs(detailRec.approved_at).format('DD MMM YYYY HH:mm') : '—'}</Descriptions.Item>
            </Descriptions>
            {detailRec.approval_status === 0 && (
              <div style={{ marginTop:16, display:'flex', gap:10 }}>
                <Button type="primary" icon={<CheckOutlined />} block
                  onClick={() => { approveM.mutate({ id:detailRec.id, action:'approve' }); setDetailOpen(false); }}>
                  Approve
                </Button>
                <Button danger icon={<CloseOutlined />} block
                  onClick={() => { approveM.mutate({ id:detailRec.id, action:'reject' }); setDetailOpen(false); }}>
                  Reject
                </Button>
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};
export default ManualLogsTab;
