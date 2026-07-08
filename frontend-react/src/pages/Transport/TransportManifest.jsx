import React, { useState, useCallback } from 'react';
import {
  Table, Button, Select, DatePicker, Drawer, Descriptions,
  Form, Input, AutoComplete, Modal, Alert, App, Tabs, Dropdown, Card, Space,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ExclamationCircleOutlined,
  AuditOutlined, ReloadOutlined, DeleteOutlined, MoreOutlined,
  SearchOutlined, WarningOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiService from '../../services/api';

const TRANSPORT_TYPES = [
  { value: 3, label: 'Helicopter' },
  { value: 4, label: 'Vessel' },
  { value: 1, label: 'Fixed Wing' },
  { value: 2, label: 'Vehicle' },
];

const FLIGHT_STATUS_CFG = {
  SCHEDULED:  { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Scheduled'  },
  CONFIRMED:  { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', label: 'Confirmed'  },
  IN_TRANSIT: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'In Transit' },
  COMPLETED:  { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Completed'  },
  CANCELLED:  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Cancelled'  },
};

const ENTRY_STATUS_CFG = {
  MANIFESTED: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Manifested' },
  CONFIRMED:  { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Confirmed'  },
  NO_SHOW:    { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'No Show'    },
  OFFLOADED:  { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Offloaded'  },
};

const DIRECTION_CFG = {
  INBOUND:  { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Inbound'  },
  OUTBOUND: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Outbound' },
};

const TRANSPORT_TYPE_CFG = {
  3: { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', label: 'Helicopter' },
  4: { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', label: 'Vessel'     },
  1: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Fixed Wing' },
  2: { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'Vehicle'    },
};

const StatusPill = ({ status, cfg }) => {
  const c = cfg?.[status] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: status };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
};

const TransportPill = ({ type }) => {
  const c = TRANSPORT_TYPE_CFG[type] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: `Type ${type}` };
  return (
    <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
};

const StatCard = ({ label, value, color, icon }) => (
  <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '14px 16px', borderTop: `3px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      {icon && <span style={{ color, fontSize: 14, background: `${color}18`, borderRadius: 6, padding: '3px 6px', display: 'flex' }}>{icon}</span>}
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
  </div>
);

// ─── Flight list ──────────────────────────────────────────────────────────────

function FlightList({ onSelectFlight }) {
  const { message } = App.useApp();
  const [flightForm] = Form.useForm();
  const [showCreate, setShowCreate] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(7, 'day'), dayjs().add(7, 'day')]);
  const [statusFilter, setStatusFilter] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transport-flights', dateRange, statusFilter],
    queryFn: () => apiService.get('/api/v1/transport/flights', {
      date_from: dateRange[0].format('YYYY-MM-DD'),
      date_to:   dateRange[1].format('YYYY-MM-DD'),
      ...(statusFilter ? { status: statusFilter } : {}),
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
      message.success('Journey created');
      qc.invalidateQueries({ queryKey: ['transport-flights'] });
      flightForm.resetFields();
      setShowCreate(false);
    },
    onError: (e) => message.error(e.message || 'Failed to create flight'),
  });

  const flights = data?.flights ?? [];
  // Known locations for the From/To combo boxes (from existing journeys); free text still allowed.
  const locOpts = [...new Set(flights.flatMap(f => [f.departure_location, f.arrival_location]).filter(Boolean))].map(v => ({ value: v }));

  const columns = [
    {
      title: 'Journey',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 700, color: '#1e293b' }}>{row.transport?.identifier ?? '—'}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
            <TransportPill type={row.transport?.type} />
            {row.transport?.operator && <span style={{ fontSize: 11, color: '#64748b' }}>{row.transport.operator}</span>}
          </div>
        </div>
      ),
    },
    {
      title: 'Route',
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{row.departure_location}</span>
          <span style={{ color: '#94a3b8', fontSize: 11 }}>→</span>
          <span style={{ fontWeight: 500 }}>{row.arrival_location}</span>
        </div>
      ),
    },
    {
      title: 'Departure',
      dataIndex: 'departure_time',
      render: (v) => v ? dayjs(v).format('DD MMM HH:mm') : '—',
      sorter: (a, b) => new Date(a.departure_time) - new Date(b.departure_time),
      defaultSortOrder: 'ascend',
    },
    {
      title: 'PAX',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span title="Confirmed" style={{ padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            {row.pax_confirmed}
          </span>
          <span title="Manifested" style={{ padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            {row.pax_manifested}
          </span>
          {row.pax_no_show > 0 && (
            <span title="No Show" style={{ padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}>
              {row.pax_no_show}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#94a3b8' }}>/ {row.transport?.capacity ?? '?'}</span>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (s) => <StatusPill status={s} cfg={FLIGHT_STATUS_CFG} />,
    },
    {
      title: '',
      width: 70,
      render: (_, row) => (
        <Button
          size="small"
          type="primary"
          ghost
          onClick={(e) => { e.stopPropagation(); onSelectFlight(row); }}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(v) => v && setDateRange(v)}
          format="DD MMM"
          size="small"
        />
        <Select
          placeholder="All statuses"
          allowClear
          size="small"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={Object.entries(FLIGHT_STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))}
        />
        <Button icon={<ReloadOutlined />} size="small" onClick={() => refetch()} />
        <div style={{ marginLeft: 'auto' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>
            New Journey
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <StatCard label="Total Journeys" value={flights.length} color="#64748b" />
        <StatCard label="Scheduled" value={flights.filter(f => f.status === 'SCHEDULED').length} color="#2563eb" icon={<AuditOutlined />} />
        <StatCard label="In Transit" value={flights.filter(f => f.status === 'IN_TRANSIT').length} color="#d97706" icon={<SyncOutlined />} />
        <StatCard label="Completed" value={flights.filter(f => f.status === 'COMPLETED').length} color="#16a34a" icon={<CheckCircleOutlined />} />
      </div>

      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Table
          dataSource={flights}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15 }}
          size="small"
          rowClassName={(r) => {
            if (r.status === 'CANCELLED') return 'row-flight-cancelled';
            if (r.status === 'IN_TRANSIT') return 'row-flight-transit';
            if (r.status === 'COMPLETED')  return 'row-flight-completed';
            return '';
          }}
          onRow={(row) => ({ onClick: () => onSelectFlight(row), style: { cursor: 'pointer' } })}
        />
      </div>

      <Modal
        title="New Journey"
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        onOk={() => flightForm.submit()}
        confirmLoading={createFlight.isPending}
        width={600}
      >
        <Form form={flightForm} layout="vertical" onFinish={(v) => createFlight.mutate(v)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="transport_identifier" label="Transport ID / Tail No." rules={[{ required: true }]}>
              <Input placeholder="e.g. ZS-HEL1" />
            </Form.Item>
            <Form.Item name="transport_type" label="Type" initialValue={3}>
              <Select options={TRANSPORT_TYPES} />
            </Form.Item>
            <Form.Item name="transport_operator" label="Operator">
              <Input placeholder="e.g. Offshore Air" />
            </Form.Item>
            <Form.Item name="transport_capacity" label="Capacity" initialValue={12}>
              <Input type="number" min={1} />
            </Form.Item>
            <Form.Item name="departure_location" label="From" rules={[{ required: true }]}>
              <AutoComplete options={locOpts} placeholder="Select or type a location"
                filterOption={(i, o) => (o?.value ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="arrival_location" label="To" rules={[{ required: true }]}>
              <AutoComplete options={locOpts} placeholder="Select or type a location"
                filterOption={(i, o) => (o?.value ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="departure_time" label="Departure Time" rules={[{ required: true }]}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="arrival_time" label="ETA (optional)">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="schedule_type" label="Schedule Type" initialValue="CHARTER" style={{ marginTop: 4 }}>
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
  const { message, modal } = App.useApp();
  const [addForm] = Form.useForm();
  const [showAdd, setShowAdd] = useState(false);
  const [paxOptions, setPaxOptions] = useState([]);
  const [reconcileResult, setReconcileResult] = useState(null);
  const [reconciling, setReconciling] = useState(false);
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
      })));
    } catch (_) {}
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
    mutationFn: ({ entryId, status }) =>
      apiService.patch(`/api/v1/transport/flights/${flight.id}/manifest/${entryId}`, { status }),
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

  const runReconcile = async () => {
    setReconciling(true);
    try {
      const result = await apiService.get(`/api/v1/transport/flights/${flight.id}/reconcile`);
      setReconcileResult(result);
    } catch (e) {
      message.error(e.message || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const confirmDelete = (entryId) => modal.confirm({
    title: 'Remove from manifest?',
    content: 'This passenger will be removed from this flight.',
    okType: 'danger',
    okText: 'Remove',
    onOk: async () => { await deleteEntry.mutateAsync(entryId); },
  });

  const entries = data?.entries ?? [];
  const inbound  = entries.filter(e => e.direction === 'INBOUND');
  const outbound = entries.filter(e => e.direction === 'OUTBOUND');
  const confirmedInbound  = inbound.filter(e => e.status === 'CONFIRMED').length;
  const confirmedOutbound = outbound.filter(e => e.status === 'CONFIRMED').length;
  const outstanding = entries.filter(e => e.status === 'MANIFESTED').length;
  const noShows    = entries.filter(e => e.status === 'NO_SHOW').length;

  const makeEntryMenuItems = (row) => [
    row.status !== 'CONFIRMED' && {
      key: 'confirm',
      icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
      label: 'Confirm',
      onClick: () => updateEntry.mutate({ entryId: row.id, status: 'CONFIRMED' }),
    },
    row.status !== 'NO_SHOW' && {
      key: 'noshow',
      icon: <CloseCircleOutlined style={{ color: '#dc2626' }} />,
      label: 'Mark No Show',
      onClick: () => updateEntry.mutate({ entryId: row.id, status: 'NO_SHOW' }),
    },
    row.status !== 'MANIFESTED' && {
      key: 'reset',
      icon: <SyncOutlined />,
      label: 'Reset to Manifested',
      onClick: () => updateEntry.mutate({ entryId: row.id, status: 'MANIFESTED' }),
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Remove',
      danger: true,
      onClick: () => confirmDelete(row.id),
    },
  ].filter(Boolean);

  const entryColumns = [
    {
      title: 'Passenger',
      dataIndex: 'passenger_name',
      render: (name, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          {row.emp_code && (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {row.emp_code}{row.company ? ` · ${row.company}` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 115,
      render: (s) => <StatusPill status={s} cfg={ENTRY_STATUS_CFG} />,
    },
    {
      title: '',
      width: 50,
      render: (_, row) => (
        <Dropdown trigger={['click']} menu={{ items: makeEntryMenuItems(row) }}>
          <Button size="small" type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const sectionHeader = (label, count, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 8px', borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
      {label === 'Inbound'
        ? <ArrowDownOutlined style={{ color }} />
        : <ArrowUpOutlined style={{ color }} />}
      <span style={{ fontWeight: 600, color }}>{label}</span>
      <span style={{ padding: '0 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}40` }}>
        {count}
      </span>
    </div>
  );

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AuditOutlined />
          <span>Manifest — {flight?.transport?.identifier ?? `#${flight?.id}`}</span>
          {flight?.status && <StatusPill status={flight.status} cfg={FLIGHT_STATUS_CFG} />}
        </div>
      }
      width={720}
      open={!!flight}
      onClose={onClose}
      extra={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            size="small"
            icon={<SafetyCertificateOutlined />}
            loading={reconciling}
            onClick={runReconcile}
          >
            Reconcile
          </Button>
          <Select
            size="small"
            value={flight?.status}
            style={{ width: 130 }}
            onChange={(v) => updateFlightStatus.mutate(v)}
            options={Object.entries(FLIGHT_STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAdd(true)}>
            Add PAX
          </Button>
        </div>
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

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <StatCard label="Arrivals Confirmed" value={confirmedInbound} color="#16a34a" icon={<ArrowDownOutlined />} />
            <StatCard label="Departures Confirmed" value={confirmedOutbound} color="#2563eb" icon={<ArrowUpOutlined />} />
            <StatCard label="Outstanding" value={outstanding} color={outstanding > 0 ? '#d97706' : '#94a3b8'} icon={<SyncOutlined />} />
            <StatCard label="No Shows" value={noShows} color={noShows > 0 ? '#dc2626' : '#94a3b8'} icon={<CloseCircleOutlined />} />
          </div>

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
              {sectionHeader('Inbound', inbound.length, '#16a34a')}
              <Table
                dataSource={inbound}
                columns={entryColumns}
                rowKey="id"
                pagination={false}
                size="small"
                loading={isLoading}
                rowClassName={(r) => r.status === 'NO_SHOW' ? 'row-entry-noshow' : r.status === 'CONFIRMED' ? 'row-entry-confirmed' : ''}
              />
            </>
          )}

          {outbound.length > 0 && (
            <>
              {sectionHeader('Outbound', outbound.length, '#2563eb')}
              <Table
                dataSource={outbound}
                columns={entryColumns}
                rowKey="id"
                pagination={false}
                size="small"
                loading={isLoading}
                rowClassName={(r) => r.status === 'NO_SHOW' ? 'row-entry-noshow' : r.status === 'CONFIRMED' ? 'row-entry-confirmed' : ''}
              />
            </>
          )}

          {entries.length === 0 && !isLoading && (
            <Alert type="info" showIcon message="No passengers on manifest yet. Click 'Add PAX' to start." />
          )}
        </>
      )}

      {/* Add passenger modal */}
      <Modal
        title="Add Passenger to Manifest"
        open={showAdd}
        onCancel={() => { setShowAdd(false); addForm.resetFields(); }}
        onOk={() => addForm.submit()}
        confirmLoading={addEntry.isPending}
      >
        <Form form={addForm} layout="vertical" onFinish={(v) => addEntry.mutate(v)}>
          <Form.Item name="passenger_name" label="Passenger Name" rules={[{ required: true }]}>
            <AutoComplete
              options={paxOptions}
              onSearch={(v) => searchPersonnel(v)}
              onSelect={(val, opt) => {
                addForm.setFieldsValue({ passenger_name: val, emp_code: opt.emp_code, company: opt.company });
              }}
              placeholder="Type name or emp code to search..."
            >
              <Input prefix={<SearchOutlined />} />
            </AutoComplete>
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="direction" label="Direction" initialValue="INBOUND" rules={[{ required: true }]}>
              <Select options={[
                { value: 'INBOUND',  label: '↓ Inbound (arriving)' },
                { value: 'OUTBOUND', label: '↑ Outbound (departing)' },
              ]} />
            </Form.Item>
            <Form.Item name="emp_code" label="Emp Code">
              <Input placeholder="EMP001" />
            </Form.Item>
            <Form.Item name="company" label="Company">
              <Input />
            </Form.Item>
            <Form.Item name="id_number" label="Passport / ID No.">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="remarks" label="Remarks" style={{ marginTop: 4 }}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reconcile result modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: reconcileResult?.reconciled ? '#16a34a' : '#dc2626' }} />
            <span>Muster Reconciliation</span>
            {reconcileResult && (
              <span style={{
                padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                color: reconcileResult.reconciled ? '#16a34a' : '#dc2626',
                background: reconcileResult.reconciled ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${reconcileResult.reconciled ? '#bbf7d0' : '#fecaca'}`,
              }}>
                {reconcileResult.reconciled ? 'All Clear' : 'Discrepancies Found'}
              </span>
            )}
          </div>
        }
        open={!!reconcileResult}
        onCancel={() => setReconcileResult(null)}
        footer={<Button onClick={() => setReconcileResult(null)}>Close</Button>}
        width={560}
      >
        {reconcileResult && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Manifest Total',    value: reconcileResult.summary?.manifest_total    ?? 0, color: '#64748b' },
                { label: 'Verified',          value: reconcileResult.summary?.verified          ?? 0, color: '#16a34a' },
                { label: 'Missing in Muster', value: reconcileResult.summary?.missing_in_muster ?? 0, color: '#dc2626' },
                { label: 'Extra on Platform', value: reconcileResult.summary?.extra_on_platform ?? 0, color: '#d97706' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: `${s.color}0d`, border: `1px solid ${s.color}30` }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
              Source: {reconcileResult.headcount_source === 'active_muster' ? 'Active Muster Event' : 'Last 24h Attendance'}
              &nbsp;·&nbsp;Generated {dayjs(reconcileResult.generated_at).format('HH:mm')}
            </div>

            {reconcileResult.missing_in_muster?.length > 0 && (
              <>
                <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <WarningOutlined /> Missing in Muster ({reconcileResult.missing_in_muster.length})
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                  {reconcileResult.missing_in_muster.map(p => (
                    <div key={p.emp_code} style={{ fontSize: 13, padding: '2px 0' }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 12 }}>{p.emp_code}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reconcileResult.extra_on_platform?.length > 0 && (
              <>
                <div style={{ fontWeight: 600, color: '#d97706', marginBottom: 6 }}>
                  Extra on Platform ({reconcileResult.extra_on_platform.length})
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                  {reconcileResult.extra_on_platform.map(p => (
                    <div key={p.emp_code} style={{ fontSize: 13, padding: '2px 0' }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 12 }}>{p.emp_code}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {reconcileResult.reconciled && (
              <Alert type="success" showIcon message="All manifested passengers are accounted for in the muster. Safe to proceed." />
            )}
          </>
        )}
      </Modal>
    </Drawer>
  );
}

// ─── POB Summary tab ──────────────────────────────────────────────────────────

function POBSummary() {
  const [summaryDate, setSummaryDate] = useState(dayjs());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pob-summary', summaryDate.format('YYYY-MM-DD')],
    queryFn: () => apiService.get('/api/v1/transport/pob-summary', {
      summary_date: summaryDate.format('YYYY-MM-DD'),
    }),
    refetchInterval: 60_000,
  });

  const discrepancies = data?.discrepancies ?? [];
  const pobDelta = data?.pob_delta ?? 0;

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <DatePicker
          value={summaryDate}
          onChange={(v) => v && setSummaryDate(v)}
          format="DD MMM YYYY"
          size="small"
          allowClear={false}
        />
        <Button icon={<ReloadOutlined />} size="small" onClick={() => refetch()} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {data?.flights_today ?? 0} flight(s) on this day
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <StatCard
          label="Confirmed Arrivals"
          value={isLoading ? '—' : data?.confirmed_arrivals ?? 0}
          color="#16a34a"
          icon={<ArrowDownOutlined />}
        />
        <StatCard
          label="Confirmed Departures"
          value={isLoading ? '—' : data?.confirmed_departures ?? 0}
          color="#2563eb"
          icon={<ArrowUpOutlined />}
        />
        <StatCard
          label="Net POB Change"
          value={isLoading ? '—' : pobDelta > 0 ? `+${pobDelta}` : pobDelta}
          color={pobDelta > 0 ? '#16a34a' : pobDelta < 0 ? '#dc2626' : '#94a3b8'}
          icon={pobDelta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        />
        <StatCard
          label="No Shows"
          value={isLoading ? '—' : data?.no_shows ?? 0}
          color={(data?.no_shows ?? 0) > 0 ? '#dc2626' : '#94a3b8'}
          icon={<ExclamationCircleOutlined />}
        />
      </div>

      {discrepancies.length > 0 ? (
        <>
          <Alert
            type="warning"
            showIcon
            message={`${discrepancies.length} unreconciled passenger(s) on completed flights`}
            style={{ marginBottom: 12 }}
          />
          <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <Table
              dataSource={discrepancies}
              rowKey={(r, i) => `${r.flight_id}-${i}`}
              size="small"
              pagination={false}
              columns={[
                { title: 'Passenger', dataIndex: 'passenger_name', render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
                { title: 'Emp Code', dataIndex: 'emp_code', render: v => v || '—' },
                {
                  title: 'Direction', dataIndex: 'direction',
                  render: v => <StatusPill status={v} cfg={DIRECTION_CFG} />,
                },
                { title: 'Flight', dataIndex: 'flight_id', render: v => `#${v}` },
              ]}
            />
          </div>
        </>
      ) : !isLoading && (
        <Alert type="success" showIcon message="No unreconciled passengers. All completed flights are fully reconciled." />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TransportManifest() {
  const [selectedFlight, setSelectedFlight] = useState(null);

  return (
    <div className="transport-module">
      <Card
        title={
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Journey Management &amp; Reconciliation</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
              Helideck / gangway check-in — maintain accurate POB count
            </div>
          </div>
        }
      >
        <Tabs
          defaultActiveKey="flights"
          size="middle"
          type="card"
          items={[
            {
              key: 'flights',
              label: <Space size={5}><AuditOutlined />Flights</Space>,
              children: <FlightList onSelectFlight={setSelectedFlight} />,
            },
            {
              key: 'pob',
              label: <Space size={5}><ExclamationCircleOutlined />POB Impact</Space>,
              children: <POBSummary />,
            },
          ]}
        />

        <ManifestDrawer
          flight={selectedFlight}
          onClose={() => setSelectedFlight(null)}
        />

        <style>{`
          .row-flight-cancelled > td { background: rgba(220,38,38,0.03) !important; }
          .row-flight-transit > td   { background: rgba(217,119,6,0.03) !important; }
          .row-flight-completed > td { background: rgba(22,163,74,0.03) !important; }
          .row-entry-noshow > td     { background: rgba(220,38,38,0.04) !important; }
          .row-entry-confirmed > td  { background: rgba(22,163,74,0.03) !important; }
        `}</style>
      </Card>
    </div>
  );
}
