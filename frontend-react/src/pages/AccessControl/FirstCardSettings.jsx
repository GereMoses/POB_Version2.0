import React from 'react';
import { Table, Button, Space, Tag, Card, Row, Col, App, Badge, Switch } from 'antd';
import { SaveOutlined, KeyOutlined, CheckCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const FirstCardSettings = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [local, setLocal] = React.useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['acc-firstcard'],
    queryFn: () => apiService.get('/api/access-control/first-card/'),
  });
  const rows = data?.data || [];

  React.useEffect(() => {
    const init = {};
    rows.forEach(r => { init[r.door_id] = { enabled: r.first_card_open }; });
    setLocal(init);
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      const settings = Object.entries(local).map(([did, v]) => ({ door_id: +did, first_card_open: v.enabled }));
      return apiService.put('/api/access-control/first-card/', settings);
    },
    onSuccess: () => { message.success('Settings saved'); qc.invalidateQueries(['acc-firstcard']); },
    onError: e => message.error(e?.message || 'Error saving'),
  });

  const enabledCount = Object.values(local).filter(v => v.enabled).length;
  const hasPending   = rows.some(r => local[r.door_id]?.enabled !== r.first_card_open);

  const cols = [
    { title: 'Door', dataIndex: 'door_name', key: 'door', width: 220,
      render: v => (
        <Space>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#237804,#52c41a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KeyOutlined style={{ color: 'white', fontSize: 14 }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{v}</span>
        </Space>
      )},
    { title: 'Terminal', dataIndex: 'terminal_sn', key: 'term', width: 150,
      render: v => <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#595959' }}>{v}</span> },
    { title: 'First Card Open', key: 'enabled', width: 180,
      render: (_, r) => (
        <Switch
          checked={local[r.door_id]?.enabled ?? r.first_card_open}
          onChange={v => setLocal(p => ({ ...p, [r.door_id]: { ...p[r.door_id], enabled: v } }))}
          checkedChildren={<Space size={4}><CheckCircleOutlined />Enabled</Space>}
          unCheckedChildren="Disabled"
          style={{ minWidth: 110, background: (local[r.door_id]?.enabled ?? r.first_card_open) ? '#52c41a' : undefined }}
        />
      )},
    { title: 'Status', key: 'status', width: 120,
      render: (_, r) => {
        const on = local[r.door_id]?.enabled ?? r.first_card_open;
        const changed = local[r.door_id]?.enabled !== r.first_card_open;
        return (
          <Space>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: on ? '#f6ffed' : '#f5f5f5',
              border: `1px solid ${on ? '#b7eb8f' : '#d9d9d9'}`,
              borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500,
              color: on ? '#52c41a' : '#8c8c8c',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: on ? '#52c41a' : '#d9d9d9' }} />
              {on ? 'Active' : 'Inactive'}
            </div>
            {changed && <Tag color="processing" style={{ fontSize: 10, borderRadius: 10 }}>Changed</Tag>}
          </Space>
        );
      }},
    { title: 'Last First Card', key: 'last', ellipsis: true,
      render: (_, r) => r.last_first_card_emp ? (
        <Space size={6}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e6f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserOutlined style={{ fontSize: 11, color: '#1890ff' }} />
          </div>
          <div>
            <span style={{ fontWeight: 500, fontSize: 12 }}>{r.last_first_card_emp}</span>
            {r.last_first_card_time && (
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{new Date(r.last_first_card_time).toLocaleString()}</div>
            )}
          </div>
        </Space>
      ) : <span style={{ color: '#bfbfbf', fontSize: 12 }}>Not triggered yet</span> },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24, background: '#f0f2f5' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #031a00 0%, #092b00 50%, #135200 100%)',
        borderRadius: 16, padding: '22px 28px', marginBottom: 24,
        boxShadow: '0 8px 32px rgba(3,26,0,0.4)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Space size={16}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #52c41a, #237804)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(82,196,26,0.4)',
          }}>
            <KeyOutlined style={{ color: 'white', fontSize: 24 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>First Card Open</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>
              Door stays locked until the first authorised card unlocks it for the time-zone window
            </div>
          </div>
        </Space>
        <Button
          type="primary" icon={<SaveOutlined />} size="large"
          onClick={() => save.mutate()} loading={save.isPending}
          disabled={!hasPending}
          style={{
            borderRadius: 10, fontWeight: 600,
            background: hasPending ? '#52c41a' : 'rgba(255,255,255,0.1)',
            border: hasPending ? 'none' : '1px solid rgba(255,255,255,0.2)',
            boxShadow: hasPending ? '0 4px 12px rgba(82,196,26,0.4)' : 'none',
          }}>
          Save Settings
        </Button>
      </div>

      {/* Stats + info cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, background: 'linear-gradient(135deg,#52c41a,#237804)', border: 'none', boxShadow: '0 4px 16px rgba(82,196,26,0.3)' }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 4 }}>Enabled</div>
            <div style={{ color: 'white', fontSize: 28, fontWeight: 800 }}>{enabledCount}</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, background: '#f5f5f5', border: '1px solid #e8e8e8', boxShadow: 'none' }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Disabled</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#595959' }}>{rows.length - enabledCount}</div>
          </Card>
        </Col>
        {[
          { title: 'Main Entrance',  desc: 'First manager arrival unlocks for the day',     color: '#1890ff' },
          { title: 'Shift Change',   desc: 'Useful for shift-based facilities',             color: '#722ed1' },
        ].map(c => (
          <Col key={c.title} xs={12} sm={6}>
            <Card style={{ borderRadius: 12, border: `1px solid ${c.color}30`, background: `${c.color}08`, boxShadow: 'none', height: '100%' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: c.color }}>{c.title}</div>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>{c.desc}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {hasPending && (
        <div style={{
          background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8,
          padding: '8px 16px', marginBottom: 16, fontSize: 13, color: '#52c41a',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CheckCircleOutlined />
          You have unsaved changes. Click "Save Settings" to apply.
        </div>
      )}

      <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        styles={{ body: { padding: 0 } }}>
        <Table columns={cols} dataSource={rows} rowKey="door_id" loading={isLoading}
          size="middle" pagination={false}
          style={{ borderRadius: 12, overflow: 'hidden' }} />
      </Card>
    </div>
  );
};

export default FirstCardSettings;
