import React from 'react';
import { Table, Select, Button, Space, Tag, Card, Row, Col, App, Badge } from 'antd';
import { SaveOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;

const APB_MODES = [
  { v: 0, l: 'None',       tagColor: 'default', from: '#f5f5f5', to: '#d9d9d9', border: '#d9d9d9', text: '#8c8c8c',
    desc: 'Anti-passback disabled. No restrictions on access direction.' },
  { v: 1, l: 'Entry-Exit', tagColor: 'warning', from: '#fffbe6', to: '#fff1b8', border: '#ffe58f', text: '#d48806',
    desc: 'Tracks entry/exit direction — warns but does not deny on violation.' },
  { v: 2, l: 'Strict',     tagColor: 'error',   from: '#fff1f0', to: '#ffccc7', border: '#ffa39e', text: '#cf1322',
    desc: 'Strictly enforces direction — denies access if passback rule violated.' },
];

const AntiPassbackSettings = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [localSettings, setLocalSettings] = React.useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['acc-antipassback'],
    queryFn: () => apiService.get('/api/access-control/antipassback/'),
  });
  const rows = data?.data || [];

  React.useEffect(() => {
    const init = {};
    rows.forEach(r => { init[r.door_id] = r.anti_passback; });
    setLocalSettings(init);
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      const settings = Object.entries(localSettings).map(([did, apb]) => ({ door_id: +did, anti_passback: apb }));
      return apiService.put('/api/access-control/antipassback/', settings);
    },
    onSuccess: () => { message.success('Settings saved'); qc.invalidateQueries(['acc-antipassback']); },
    onError: e => message.error(e?.message || 'Error saving'),
  });

  const hasPendingChanges = rows.some(r => localSettings[r.door_id] !== r.anti_passback);
  const strictCount = Object.values(localSettings).filter(v => v === 2).length;
  const entryExitCount = Object.values(localSettings).filter(v => v === 1).length;
  const noneCount = Object.values(localSettings).filter(v => v === 0).length;

  const cols = [
    { title: 'Door', dataIndex: 'door_name', key: 'door', width: 220,
      render: v => (
        <Space>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#d46b08,#fa8c16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <StopOutlined style={{ color: 'white', fontSize: 14 }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{v}</span>
        </Space>
      )},
    { title: 'Terminal', dataIndex: 'terminal_sn', key: 'term', width: 150,
      render: v => <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#595959' }}>{v}</span> },
    { title: 'APB Mode', key: 'apb', width: 220,
      render: (_, r) => (
        <Select
          value={localSettings[r.door_id] ?? r.anti_passback}
          style={{ width: 190 }}
          onChange={v => setLocalSettings(p => ({ ...p, [r.door_id]: v }))}
          size="middle">
          {APB_MODES.map(m => (
            <Option key={m.v} value={m.v}>
              <Space>
                <div style={{ width: 8, height: 8, borderRadius: '50%',
                  background: m.v === 2 ? '#f5222d' : m.v === 1 ? '#faad14' : '#d9d9d9' }} />
                {m.l}
              </Space>
            </Option>
          ))}
        </Select>
      )},
    { title: 'Status', key: 'status', width: 130,
      render: (_, r) => {
        const mode = APB_MODES.find(m => m.v === (localSettings[r.door_id] ?? r.anti_passback));
        const changed = localSettings[r.door_id] !== r.anti_passback;
        return (
          <Space>
            <Tag color={mode?.tagColor || 'default'} style={{ borderRadius: 12, fontWeight: 500 }}>{mode?.l || 'None'}</Tag>
            {changed && <Tag color="processing" style={{ borderRadius: 12, fontSize: 10 }}>Changed</Tag>}
          </Space>
        );
      }},
    { title: 'Description', key: 'desc',
      render: (_, r) => {
        const mode = APB_MODES.find(m => m.v === (localSettings[r.door_id] ?? r.anti_passback));
        return <span style={{ color: '#8c8c8c', fontSize: 12 }}>{mode?.desc}</span>;
      }},
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24, background: '#f0f2f5' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0900 0%, #3d1a00 50%, #7c3a08 100%)',
        borderRadius: 16, padding: '22px 28px', marginBottom: 24,
        boxShadow: '0 8px 32px rgba(26,9,0,0.4)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Space size={16}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #fa8c16, #d46b08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(250,140,22,0.4)',
          }}>
            <StopOutlined style={{ color: 'white', fontSize: 24 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Anti-passback Settings</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>
              Prevent tailgating by enforcing strict entry/exit access sequences
            </div>
          </div>
        </Space>
        <Button
          type="primary" icon={<SaveOutlined />} size="large"
          onClick={() => save.mutate()} loading={save.isPending}
          disabled={!hasPendingChanges}
          style={{
            borderRadius: 10, fontWeight: 600,
            background: hasPendingChanges ? '#fa8c16' : 'rgba(255,255,255,0.1)',
            border: hasPendingChanges ? 'none' : '1px solid rgba(255,255,255,0.2)',
            boxShadow: hasPendingChanges ? '0 4px 12px rgba(250,140,22,0.4)' : 'none',
          }}>
          Save Settings
        </Button>
      </div>

      {/* Mode Cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {APB_MODES.map(m => (
          <Col key={m.v} xs={24} sm={8}>
            <Card style={{
              borderRadius: 12, border: `1px solid ${m.border}`,
              background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: m.text, marginBottom: 4 }}>{m.l}</div>
                  <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.5 }}>{m.desc}</div>
                </div>
                <div style={{
                  fontSize: 24, fontWeight: 800, color: m.text,
                  background: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '4px 10px',
                }}>
                  {m.v === 0 ? noneCount : m.v === 1 ? entryExitCount : strictCount}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {hasPendingChanges && (
        <div style={{
          background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8,
          padding: '8px 16px', marginBottom: 16, fontSize: 13, color: '#d48806',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CheckCircleOutlined />
          You have unsaved changes. Click "Save Settings" to apply them to all doors.
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

export default AntiPassbackSettings;
