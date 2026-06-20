/**
 * Weekly Roster Builder
 * Assign personnel to shifts across a 7-day week.
 * Grid: rows = shifts, columns = Mon–Sun.
 * Click a cell to add/remove personnel from that shift on that day.
 */
import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Button, Select, Space, Typography, Tag, Modal,
  Tooltip, Badge, Spin, Empty, App, DatePicker, Divider,
} from 'antd';
import {
  LeftOutlined, RightOutlined, PlusOutlined, UserOutlined,
  CalendarOutlined, ReloadOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

const { Text, Title } = Typography;
const { Option } = Select;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_COLORS = {
  Mon: '#3B82F6', Tue: '#8B5CF6', Wed: '#10B981',
  Thu: '#F59E0B', Fri: '#EF4444', Sat: '#EC4899', Sun: '#6366F1',
};

const getWeekDates = (weekStart) =>
  DAYS.map((d, i) => weekStart.add(i, 'day'));

const WeeklyRosterBuilder = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('isoWeek'));
  const [assignModal, setAssignModal] = useState(null); // { shift, date, dateStr }
  const [selectedPersonnel, setSelectedPersonnel] = useState([]);

  const weekDates = getWeekDates(weekStart);
  const weekLabel = `${weekStart.format('DD MMM')} – ${weekStart.add(6, 'day').format('DD MMM YYYY')}`;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: shiftsData, isLoading: shiftsLoading } = useQuery({
    queryKey: ['roster-shifts'],
    queryFn: () => apiService.get('/api/v1/personnel/shifts'),
    staleTime: 60000,
  });
  const shifts = shiftsData?.shifts ?? shiftsData?.data ?? shiftsData ?? [];

  const { data: personnelData, isLoading: personnelLoading } = useQuery({
    queryKey: ['roster-personnel'],
    queryFn: () => apiService.get('/api/v1/personnel/?status=ACTIVE&page_size=500'),
    staleTime: 60000,
  });
  const personnel = personnelData?.data ?? personnelData?.personnel ?? personnelData ?? [];

  // Fetch assignments for each day of the week
  const { data: assignmentsData, isLoading: assignLoading, refetch } = useQuery({
    queryKey: ['roster-assignments', weekStart.format('YYYY-MM-DD')],
    queryFn: async () => {
      const start = weekStart.format('YYYY-MM-DD');
      const end   = weekStart.add(6, 'day').format('YYYY-MM-DD');
      try {
        const res = await apiService.get(
          `/api/v1/personnel/schedules?start_date=${start}&end_date=${end}&page_size=1000`
        );
        return res?.schedules ?? res?.data ?? res ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });
  const assignments = assignmentsData ?? [];

  // Map: `${shiftId}_${dateStr}` → [personnelId, ...]
  const assignMap = useMemo(() => {
    const m = {};
    for (const a of assignments) {
      const key = `${a.shift_id}_${a.schedule_date?.slice(0, 10)}`;
      if (!m[key]) m[key] = [];
      m[key].push(a.personnel_id);
    }
    return m;
  }, [assignments]);

  const personnelMap = useMemo(() => {
    const m = {};
    for (const p of personnel) m[p.id] = p;
    return m;
  }, [personnel]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const assignM = useMutation({
    mutationFn: ({ shiftId, personnelIds, dateStr }) =>
      Promise.all(personnelIds.map(pid =>
        apiService.post(`/api/v1/personnel/shifts/${shiftId}/assign`, {
          personnel_id: pid,
          start_date: dateStr,
          end_date: dateStr,
        })
      )),
    onSuccess: () => {
      qc.invalidateQueries(['roster-assignments']);
      message.success('Roster updated');
      setAssignModal(null);
      setSelectedPersonnel([]);
    },
    onError: e => message.error(e?.message || 'Failed to save'),
  });

  // ── Cell render ────────────────────────────────────────────────────────────
  const renderCell = (shift, date) => {
    const dateStr = date.format('YYYY-MM-DD');
    const key     = `${shift.id}_${dateStr}`;
    const pIds    = assignMap[key] || [];
    const isWeekend = date.isoWeekday() >= 6;

    return (
      <div
        key={key}
        onClick={() => {
          setAssignModal({ shift, date, dateStr });
          setSelectedPersonnel(pIds);
        }}
        style={{
          minHeight: 60, padding: 6, cursor: 'pointer',
          background: isWeekend ? '#FFF7ED' : '#F9FAFB',
          border: '1px solid #E5E7EB', borderRadius: 6,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; }}
        onMouseLeave={e => { e.currentTarget.style.background = isWeekend ? '#FFF7ED' : '#F9FAFB'; }}
      >
        {pIds.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#D1D5DB', fontSize: 18, lineHeight: '48px' }}>+</div>
        ) : (
          <Space wrap size={3} style={{ width: '100%' }}>
            {pIds.slice(0, 3).map(pid => {
              const p = personnelMap[pid];
              const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : `#${pid}`;
              return (
                <Tooltip key={pid} title={name}>
                  <Tag style={{ fontSize: 10, padding: '0 5px', margin: 0 }}>
                    {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Tag>
                </Tooltip>
              );
            })}
            {pIds.length > 3 && (
              <Tag style={{ fontSize: 10, padding: '0 5px', margin: 0, background: '#E0E7FF', color: '#3730A3' }}>
                +{pIds.length - 3}
              </Tag>
            )}
          </Space>
        )}
      </div>
    );
  };

  if (shiftsLoading || personnelLoading) return <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>;

  return (
    <div style={{ padding: 24 }}>
      {/* Header / week nav */}
      <Card styles={{ body: { padding: '12px 16px' } }} style={{ marginBottom: 12 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <CalendarOutlined style={{ color: '#3B82F6', fontSize: 16 }} />
              <Title level={5} style={{ margin: 0 }}>Weekly Roster — {weekLabel}</Title>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<LeftOutlined />} size="small"
                onClick={() => setWeekStart(d => d.subtract(1, 'week'))} />
              <Button size="small"
                onClick={() => setWeekStart(dayjs().startOf('isoWeek'))}>
                This Week
              </Button>
              <Button icon={<RightOutlined />} size="small"
                onClick={() => setWeekStart(d => d.add(1, 'week'))} />
              <Button icon={<ReloadOutlined />} size="small"
                onClick={() => refetch()} loading={assignLoading} />
            </Space>
          </Col>
        </Row>
      </Card>

      {shifts.length === 0 ? (
        <Empty description="No shifts defined. Create shifts first in the Shifts tab." style={{ padding: 48 }} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 140, padding: '10px 12px', background: '#F3F4F6', textAlign: 'left', fontSize: 13, fontWeight: 700, borderBottom: '2px solid #E5E7EB' }}>
                    Shift
                  </th>
                  {weekDates.map((date, i) => {
                    const isToday = date.isSame(dayjs(), 'day');
                    const color   = DAY_COLORS[DAYS[i]];
                    return (
                      <th key={i} style={{
                        padding: '10px 8px', textAlign: 'center', borderBottom: '2px solid #E5E7EB',
                        background: isToday ? `${color}15` : '#F3F4F6',
                        borderLeft: `3px solid ${isToday ? color : 'transparent'}`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? color : '#374151' }}>
                          {DAYS[i]}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7A8D' }}>
                          {date.format('DD MMM')}
                        </div>
                        {isToday && <Tag color="blue" style={{ fontSize: 9, padding: '0 4px', marginTop: 2 }}>Today</Tag>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shifts.map(shift => (
                  <tr key={shift.id}>
                    <td style={{
                      padding: '8px 12px', borderBottom: '1px solid #F0F0F0',
                      background: '#FAFAFA', verticalAlign: 'middle',
                    }}>
                      <Text strong style={{ fontSize: 13, display: 'block' }}>{shift.name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {shift.start_time} – {shift.end_time}
                      </Text>
                    </td>
                    {weekDates.map((date, i) => (
                      <td key={i} style={{
                        padding: 4, borderBottom: '1px solid #F0F0F0',
                        borderLeft: '1px solid #F5F5F5', verticalAlign: 'top', minWidth: 100,
                      }}>
                        {renderCell(shift, date)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Assign personnel modal */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            {assignModal
              ? `Assign to: ${assignModal.shift.name} on ${assignModal.date.format('ddd DD MMM')}`
              : 'Assign'}
          </Space>
        }
        open={!!assignModal}
        onCancel={() => { setAssignModal(null); setSelectedPersonnel([]); }}
        onOk={() => {
          if (!assignModal) return;
          if (selectedPersonnel.length === 0) {
            message.warning('Select at least one person');
            return;
          }
          assignM.mutate({
            shiftId: assignModal.shift.id,
            personnelIds: selectedPersonnel,
            dateStr: assignModal.dateStr,
          });
        }}
        okText="Save Roster"
        confirmLoading={assignM.isPending}
        width={480}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Select personnel to assign"
            value={selectedPersonnel}
            onChange={setSelectedPersonnel}
            showSearch
            optionFilterProp="label"
            options={personnel.map(p => ({
              value: p.id,
              label: `${p.first_name || ''} ${p.last_name || ''}`.trim() + (p.emp_code ? ` (${p.emp_code})` : ''),
            }))}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Selecting personnel will assign them to this shift for the selected date.
            Previously assigned personnel remain unless removed.
          </Text>
        </Space>
      </Modal>
    </div>
  );
};

export default WeeklyRosterBuilder;
