import React, { useState, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, DatePicker,
  Drawer, Descriptions, Badge, Statistic, Row, Col, Tooltip, Popconfirm,
  Alert, Typography, Divider, message, AutoComplete, Tabs,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ExclamationCircleOutlined,
  AuditOutlined, ReloadOutlined, DeleteOutlined, EditOutlined,
  UserOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiService from '../../services/api';

const { Title, Text } = Typography;

const TRANSPORT_TYPES = [
  { value: 3, label: 'Helicopter' },
  { value: 4, label: 'Vessel' },
  { value: 1, label: 'Fixed Wing' },
  { value: 2, label: 'Vehicle' },
];

const STATUS_COLOR = {
  SCHEDULED: 'blue',
  CONFIRMED: 'cyan',
  IN_TRANSIT: 'orange',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

const ENTRY_STATUS_CONFIG = {
  MANIFESTED:  { color: 'blue',   icon: <SyncOutlined />,         label: 'Manifested' },
  CONFIRMED:   { color: 'green',  icon: <CheckCircleOutlined />,  label: 'Confirmed' },
  NO_SHOW:     { color: 'red',    icon: <CloseCircleOutlined />,  label: 'No Show' },
  OFFLOADED:   { color: 'orange', icon: <ExclamationCircleOutlined />, label: 'Offloaded' },
};

function EntryStatusTag({ status }) {
  const cfg = ENTRY_STATUS_CONFIG[status] || ENTRY_STATUS_CONFIG.MANIFESTED;
  return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
}

// ─── Flight list ──────────────────────────────────────────────────────────────

function FlightList({ onSelectFlight }) {
  const [flightForm] = Form.useForm();
  const [showCreate, setShowCreate] = useState(false);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(7, 'day'),
    dayjs().add(7, 'day'),
  ]);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transport-flights', dateRange],
    queryFn: () => apiService.get('/api/v1/transport/flights', {
      date_from: dateRange[0].format('YYYY-MM-DD'),
      date_to:   dateRange[1].format('YYYY-MM-DD'),
    }),
  });

  const createFlight = useMutation({
    mutationFn: (values) => apiService.post('/api/v1/transport/flights', {
      transport_identifier: values.transport_identifier,
      transport_type: values.transport_type,
      transport_operator: values.transport_operator,
      transport_capacity: values.transport_capacity || 12,
      schedule_type: values.schedule_type || 'CHARTER',
      departure_location: values.departure_location,
      arrival_location: values.arrival_location,
      departure_time: values.departure_time.toISOString(),
      arrival_time: values.arrival_time ? values.arrival_time.toISOString() : undefined,
      notes: values.notes,
    }),
    onSuccess: () => {
      message.success('Flight created');
      qc.invalidateQueries({ queryKey: ['transport-flights'] });
      flightForm.resetFields();
      setShowCreate(false);
    },
    onError: (e) => message.error(e.message || 'Failed to create flight'),
  });

  const columns = [
    {
      title: 'Flight',
      dataIndex: 'transport',
      render: (t, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{t?.identifier ?? '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {TRANSPORT_TYPES.find(x => x.value === t?.type)?.label ?? 'Unknown'} · {t?.operator ?? ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Route',
      render: (_, row) => (
        <Space>
          <Text>{row.departure_location}</Text>
          <ArrowDownOutlined style={{ color: '#1890ff' }} />
          <Text>{row.arrival_location}</Text>
        </Space>
      ),
    },
    {
      title: 'Departure',
      dataIndex: 'departure_time',
      render: (v) => v ? dayjs(v).format('DD MMM HH:mm') : '—',
      sorter: (a, b) => new Date(a.departure_time) - new Date(b.departure_time),
    },
    {
      title: 'PAX',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Confirmed">
            <Tag color="green">{row.pax_confirmed}</Tag>
          </Tooltip>
          <Tooltip title="Manifested">
            <Tag color="blue">{row.pax_manifested}</Tag>
          </Tooltip>
          {row.pax_no_show > 0 && (
            <Tooltip title="No Show">
              <Tag color="red">{row.pax_no_show}</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: '',
      render: (_, row) => (
        <Button size="small" type="primary" ghost onClick={() => onSelectFlight(row)}>
          Manifest
        </Button>
      ),
    },
  ];

  const flights = data?.flights ?? [];

  return (
    <>
      <Card
        title={<Space><AuditOutlined /> Flights</Space>}
        extra={
          <Space>
            <DatePicker.RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD MMM"
              size="small"
            />
            <Button icon={<ReloadOutlined />} size="small" onClick={() => refetch()} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>
              New Flight
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={flights}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="small"
          onRow={(row) => ({ onClick: () => onSelectFlight(row), style: { cursor: 'pointer' } })}
        />
      </Card>

      <Modal
        title="Create Flight / Voyage"
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        onOk={() => flightForm.submit()}
        confirmLoading={createFlight.isPending}
        width={600}
      >
        <Form form={flightForm} layout="vertical" onFinish={(v) => createFlight.mutate(v)}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="transport_identifier" label="Transport ID / Tail No." rules={[{ required: true }]}>
                <Input placeholder="e.g. ZS-HEL1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="transport_type" label="Type" initialValue={3}>
                <Select options={TRANSPORT_TYPES} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="transport_operator" label="Operator">
                <Input placeholder="e.g. Offshore Air" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="transport_capacity" label="Capacity" initialValue={12}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="departure_location" label="From" rules={[{ required: true }]}>
                <Input placeholder="e.g. Base Airport" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="arrival_location" label="To" rules={[{ required: true }]}>
                <Input placeholder="e.g. Platform Alpha" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="departure_time" label="Departure Time" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="arrival_time" label="ETA (optional)">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="schedule_type" label="Schedule Type" initialValue="CHARTER">
            <Select options={[
              { value: 'REGULAR', label: 'Regular' },
              { value: 'CHARTER', label: 'Charter' },
              { value: 'STANDBY', label: 'Standby' },
            ]} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ─── Manifest drawer ──────────────────────────────────────────────────────────

function ManifestDrawer({ flight, onClose }) {
  const [addForm] = Form.useForm();
  const [showAdd, setShowAdd] = useState(false);
  const [paxSearch, setPaxSearch] = useState('');
  const [paxOptions, setPaxOptions] = useState([]);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['manifest', flight?.id],
    queryFn: () => apiService.get(`/api/v1/transport/flights/${flight.id}/manifest`),
    enabled: !!flight,
  });

  const searchPersonnel = useCallback(async (term) => {
    if (term.length < 2) return;
    try {
      const res = await apiService.get('/api/v1/transport/personnel-search', { q: term });
      setPaxOptions((res || []).map(p => ({
        value: p.name,
        label: `${p.name} (${p.emp_code})`,
        emp_code: p.emp_code,
        company: p.company,
        id: p.id,
      })));
    } catch (_) { /* ignore */ }
  }, []);

  const addEntry = useMutation({
    mutationFn: (values) => apiService.post(`/api/v1/transport/flights/${flight.id}/manifest`, {
      passenger_name: values.passenger_name,
      direction: values.direction,
      emp_code: values.emp_code,
      company: values.company,
      id_number: values.id_number,
      remarks: values.remarks,
    }),
    onSuccess: () => {
      message.success('Passenger added');
      qc.invalidateQueries({ queryKey: ['manifest', flight.id] });
      qc.invalidateQueries({ queryKey: ['transport-flights'] });
      addForm.resetFields();
      setShowAdd(false);
    },
    onError: (e) => message.error(e.message || 'Failed to add passenger'),
  });

  const updateEntry = useMutation({
    mutationFn: ({ entryId, status, remarks }) =>
      apiService.patch(`/api/v1/transport/flights/${flight.id}/manifest/${entryId}`, { status, remarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manifest', flight.id] });
      qc.invalidateQueries({ queryKey: ['transport-flights'] });
      qc.invalidateQueries({ queryKey: ['pob-summary'] });
    },
    onError: (e) => message.error(e.message || 'Failed to update'),
  });

  const deleteEntry = useMutation({
    mutationFn: (entryId) =>
      apiService.delete(`/api/v1/transport/flights/${flight.id}/manifest/${entryId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manifest', flight.id] });
      qc.invalidateQueries({ queryKey: ['transport-flights'] });
    },
    onError: (e) => message.error(e.message || 'Failed to delete'),
  });

  const updateFlightStatus = useMutation({
    mutationFn: (newStatus) =>
      apiService.patch(`/api/v1/transport/flights/${flight.id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transport-flights'] });
      qc.invalidateQueries({ queryKey: ['pob-summary'] });
      message.success('Flight status updated');
    },
    onError: (e) => message.error(e.message || 'Failed to update flight status'),
  });

  const entries = data?.entries ?? [];
  const inbound  = entries.filter(e => e.direction === 'INBOUND');
  const outbound = entries.filter(e => e.direction === 'OUTBOUND');

  const entryColumns = (dirEntries) => [
    {
      title: 'Passenger',
      dataIndex: 'passenger_name',
      render: (name, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {row.emp_code && <Text type="secondary" style={{ fontSize: 11 }}>{row.emp_code} · {row.company ?? ''}</Text>}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (s) => <EntryStatusTag status={s} />,
    },
    {
      title: 'Actions',
      width: 180,
      render: (_, row) => (
        <Space size={4}>
          {row.status !== 'CONFIRMED' && (
            <Tooltip title="Confirm arrival/departure">
              <Button
                size="small" type="primary" ghost
                icon={<CheckCircleOutlined />}
                onClick={() => updateEntry.mutate({ entryId: row.id, status: 'CONFIRMED' })}
              />
            </Tooltip>
          )}
          {row.status !== 'NO_SHOW' && (
            <Tooltip title="Mark no-show">
              <Button
                size="small" danger ghost
                icon={<CloseCircleOutlined />}
                onClick={() => updateEntry.mutate({ entryId: row.id, status: 'NO_SHOW' })}
              />
            </Tooltip>
          )}
          {row.status !== 'MANIFESTED' && (
            <Tooltip title="Reset to manifested">
              <Button
                size="small" ghost
                icon={<SyncOutlined />}
                onClick={() => updateEntry.mutate({ entryId: row.id, status: 'MANIFESTED' })}
              />
            </Tooltip>
          )}
          <Popconfirm title="Remove from manifest?" onConfirm={() => deleteEntry.mutate(row.id)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const confirmedInbound  = inbound.filter(e => e.status === 'CONFIRMED').length;
  const confirmedOutbound = outbound.filter(e => e.status === 'CONFIRMED').length;
  const outstanding = entries.filter(e => e.status === 'MANIFESTED').length;

  return (
    <Drawer
      title={
        <Space>
          <AuditOutlined />
          <span>Manifest — {flight?.transport?.identifier ?? flight?.id}</span>
          <Tag color={STATUS_COLOR[flight?.status] ?? 'default'}>{flight?.status}</Tag>
        </Space>
      }
      width={720}
      open={!!flight}
      onClose={onClose}
      extra={
        <Space>
          <Select
            size="small"
            value={flight?.status}
            style={{ width: 140 }}
            onChange={(v) => updateFlightStatus.mutate(v)}
            options={[
              { value: 'SCHEDULED',  label: 'Scheduled' },
              { value: 'CONFIRMED',  label: 'Confirmed' },
              { value: 'IN_TRANSIT', label: 'In Transit' },
              { value: 'COMPLETED',  label: 'Completed' },
              { value: 'CANCELLED',  label: 'Cancelled' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAdd(true)}>
            Add PAX
          </Button>
        </Space>
      }
    >
      {flight && (
        <>
          <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Route">
              {flight.departure_location} → {flight.arrival_location}
            </Descriptions.Item>
            <Descriptions.Item label="Departure">
              {flight.departure_time ? dayjs(flight.departure_time).format('DD MMM YYYY HH:mm') : '—'}
            </Descriptions.Item>
          </Descriptions>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Arrivals Confirmed"
                  value={confirmedInbound}
                  prefix={<ArrowDownOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Departures Confirmed"
                  value={confirmedOutbound}
                  prefix={<ArrowUpOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="Outstanding"
                  value={outstanding}
                  prefix={<SyncOutlined />}
                  valueStyle={{ color: outstanding > 0 ? '#faad14' : '#999' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="No Shows"
                  value={entries.filter(e => e.status === 'NO_SHOW').length}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#f5222d' }}
                />
              </Card>
            </Col>
          </Row>

          {outstanding > 0 && flight?.status === 'COMPLETED' && (
            <Alert
              type="warning"
              showIcon
              message={`${outstanding} passenger(s) not yet reconciled on a completed flight`}
              style={{ marginBottom: 16 }}
            />
          )}

          {inbound.length > 0 && (
            <>
              <Divider orientation="left">
                <Space>
                  <ArrowDownOutlined style={{ color: '#52c41a' }} />
                  <Text strong>Inbound ({inbound.length})</Text>
                </Space>
              </Divider>
              <Table
                dataSource={inbound}
                columns={entryColumns(inbound)}
                rowKey="id"
                pagination={false}
                size="small"
                loading={isLoading}
                rowClassName={(r) => r.status === 'NO_SHOW' ? 'row-no-show' : ''}
              />
            </>
          )}

          {outbound.length > 0 && (
            <>
              <Divider orientation="left">
                <Space>
                  <ArrowUpOutlined style={{ color: '#1890ff' }} />
                  <Text strong>Outbound ({outbound.length})</Text>
                </Space>
              </Divider>
              <Table
                dataSource={outbound}
                columns={entryColumns(outbound)}
                rowKey="id"
                pagination={false}
                size="small"
                loading={isLoading}
              />
            </>
          )}

          {entries.length === 0 && !isLoading && (
            <Alert
              type="info"
              showIcon
              message="No passengers on manifest yet. Click 'Add PAX' to start."
            />
          )}
        </>
      )}

      {/* Add passenger modal */}
      <Modal
        title="Add Passenger to Manifest"
        open={showAdd}
        onCancel={() => setShowAdd(false)}
        onOk={() => addForm.submit()}
        confirmLoading={addEntry.isPending}
      >
        <Form form={addForm} layout="vertical" onFinish={(v) => addEntry.mutate(v)}>
          <Form.Item name="passenger_name" label="Passenger Name" rules={[{ required: true }]}>
            <AutoComplete
              options={paxOptions}
              onSearch={(v) => { setPaxSearch(v); searchPersonnel(v); }}
              onSelect={(val, opt) => {
                addForm.setFieldsValue({
                  passenger_name: val,
                  emp_code: opt.emp_code,
                  company: opt.company,
                });
              }}
              placeholder="Type name or emp code to search..."
            >
              <Input prefix={<SearchOutlined />} />
            </AutoComplete>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="direction" label="Direction" initialValue="INBOUND" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'INBOUND',  label: '↓ Inbound (arriving)' },
                  { value: 'OUTBOUND', label: '↑ Outbound (departing)' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="emp_code" label="Emp Code">
                <Input placeholder="EMP001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="company" label="Company">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="id_number" label="Passport / ID No.">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="Remarks">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
}

// ─── POB Summary tab ──────────────────────────────────────────────────────────

function POBSummary() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pob-summary'],
    queryFn: () => apiService.get('/api/v1/transport/pob-summary'),
    refetchInterval: 60_000,
  });

  const discrepancies = data?.discrepancies ?? [];

  return (
    <Card
      title="Today's POB Impact"
      extra={<Button icon={<ReloadOutlined />} size="small" onClick={() => refetch()} />}
      loading={isLoading}
    >
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Statistic
            title="Confirmed Arrivals"
            value={data?.confirmed_arrivals ?? 0}
            prefix={<ArrowDownOutlined />}
            valueStyle={{ color: '#52c41a', fontSize: 32 }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Confirmed Departures"
            value={data?.confirmed_departures ?? 0}
            prefix={<ArrowUpOutlined />}
            valueStyle={{ color: '#1890ff', fontSize: 32 }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Net POB Change"
            value={data?.pob_delta ?? 0}
            prefix={data?.pob_delta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            valueStyle={{
              color: (data?.pob_delta ?? 0) > 0 ? '#52c41a' : (data?.pob_delta ?? 0) < 0 ? '#f5222d' : '#999',
              fontSize: 32,
            }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="No Shows"
            value={data?.no_shows ?? 0}
            prefix={<ExclamationCircleOutlined />}
            valueStyle={{ color: data?.no_shows > 0 ? '#f5222d' : '#999', fontSize: 32 }}
          />
        </Col>
      </Row>

      {discrepancies.length > 0 && (
        <>
          <Alert
            type="warning"
            showIcon
            message={`${discrepancies.length} unreconciled passenger(s) on completed flights`}
            style={{ marginBottom: 16 }}
          />
          <Table
            dataSource={discrepancies}
            rowKey={(r, i) => `${r.flight_id}-${i}`}
            size="small"
            pagination={false}
            columns={[
              { title: 'Name', dataIndex: 'passenger_name' },
              { title: 'Emp Code', dataIndex: 'emp_code', render: v => v || '—' },
              { title: 'Direction', dataIndex: 'direction', render: v => <Tag>{v}</Tag> },
              { title: 'Flight', dataIndex: 'flight_id', render: v => `#${v}` },
            ]}
          />
        </>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TransportManifest() {
  const [selectedFlight, setSelectedFlight] = useState(null);

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Transport Manifest & Reconciliation</Title>
        <Text type="secondary">Helideck / gangway check-in — maintain accurate POB count</Text>
      </div>

      <Tabs
        defaultActiveKey="flights"
        items={[
          {
            key: 'flights',
            label: <Space><AuditOutlined />Flights</Space>,
            children: (
              <FlightList onSelectFlight={setSelectedFlight} />
            ),
          },
          {
            key: 'pob',
            label: <Space><ExclamationCircleOutlined />POB Impact</Space>,
            children: <POBSummary />,
          },
        ]}
      />

      <ManifestDrawer
        flight={selectedFlight}
        onClose={() => setSelectedFlight(null)}
      />
    </div>
  );
}
