import React, { useState, useMemo, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, Row, Col,
  Tag, App, Popconfirm, DatePicker, InputNumber, Tabs, Descriptions,
  Alert, Progress, Switch, Tooltip, Typography, Checkbox, Avatar,
  Badge, Empty, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FileTextOutlined, WalletOutlined, StopOutlined, ThunderboltOutlined,
  InfoCircleOutlined, SearchOutlined, FilterOutlined, CloseOutlined,
  UserOutlined, ArrowRightOutlined, DownloadOutlined, CheckOutlined,
  TeamOutlined, LeftOutlined, RightOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import TeamCalendar from './TeamCalendar';

dayjs.extend(isBetween);

const { Text } = Typography;
const { RangePicker } = DatePicker;

// ── Shared helpers ──────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  '#2563eb','#7c3aed','#db2777','#059669','#d97706','#dc2626','#0891b2','#65a30d',
];
const avatarColor = (str) => AVATAR_PALETTE[(str || '').charCodeAt(0) % AVATAR_PALETTE.length];
const initials    = (name) =>
  (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// Working-days calc: exclude Saturdays (6) and Sundays (0)
const countWorkingDays = (start, end) => {
  if (!start || !end) return 0;
  let count = 0;
  let cur = start.startOf('day');
  const last = end.startOf('day');
  while (cur.isBefore(last) || cur.isSame(last, 'day')) {
    const dow = cur.day();
    if (dow !== 0 && dow !== 6) count++;
    cur = cur.add(1, 'day');
  }
  return count;
};

// CSV export helper
const exportCSV = (columns, rows, filename) => {
  const headers = columns.map(c => `"${c.title}"`).join(',');
  const body = rows.map(r =>
    columns.map(c => {
      const raw = typeof c.exportValue === 'function' ? c.exportValue(r) : (r[c.dataIndex] ?? '');
      return `"${String(raw).replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\n');
  const blob = new Blob([headers + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ── Status pills ────────────────────────────────────────────────────────────────
const STATUS_PILL_CFG = {
  pending:   { bg: '#fffbeb', border: '#fed7aa', text: '#b45309', dot: '#f59e0b', label: 'Pending'   },
  approved:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#22c55e', label: 'Approved'  },
  on_leave:  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', dot: '#3b82f6', label: 'On Leave'  },
  rejected:  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', dot: '#ef4444', label: 'Rejected'  },
  cancelled: { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', dot: '#9ca3af', label: 'Cancelled' },
};
const LeaveStatusPill = ({ status }) => {
  const c = STATUS_PILL_CFG[status] || { bg: '#f4f4f5', border: '#e4e4e7', text: '#52525b', dot: '#a1a1aa', label: status };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  );
};

// ── Bulk action bar ─────────────────────────────────────────────────────────────
const BulkBar = ({ count, noun, onClear, onDelete, deletePending, onApprove, approvePending }) =>
  count > 0 ? (
    <div style={{
      background: '#1d4ed8', borderRadius: 10, padding: '10px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 12px rgba(29,78,216,0.3)',
    }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
        {count} {noun}{count !== 1 ? 's' : ''} selected
      </span>
      <div style={{ flex: 1 }} />
      {onApprove && (
        <Button
          size="small" icon={<CheckOutlined />}
          loading={approvePending}
          onClick={onApprove}
          style={{ borderRadius: 6, background: '#16a34a', border: 'none', color: '#fff' }}
        >
          Approve all
        </Button>
      )}
      <Popconfirm
        title={`Delete ${count} ${noun}${count !== 1 ? 's' : ''}?`}
        description="This cannot be undone."
        onConfirm={onDelete}
        okText="Delete" okButtonProps={{ danger: true }}
      >
        <Button
          size="small" danger icon={<DeleteOutlined />}
          loading={deletePending}
          style={{ borderRadius: 6, background: '#dc2626', border: 'none', color: '#fff' }}
        >
          Delete selected
        </Button>
      </Popconfirm>
      <Button
        size="small" icon={<CloseOutlined />} onClick={onClear}
        style={{ borderRadius: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
      />
    </div>
  ) : null;

// ── EmployeeCell ────────────────────────────────────────────────────────────────
const EmployeeCell = ({ name, empCode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <Avatar size={32} style={{ background: avatarColor(name), fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
      {initials(name)}
    </Avatar>
    <div>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>{name || '—'}</div>
      {empCode && (
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '0 4px' }}>
          {empCode}
        </span>
      )}
    </div>
  </div>
);


// ──────────────────────────────────────────────────────────────────────────────
const LeaveManagement = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab,     setActiveTab]     = useState('requests');
  const [searchText,    setSearchText]    = useState('');
  const [filterStatus,  setFilterStatus]  = useState(null);
  const [filterType,    setFilterType]    = useState(null);
  const [filterDateRange, setFilterDateRange] = useState(null);
  const [filterDept,    setFilterDept]    = useState(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [editingLeave,     setEditingLeave]     = useState(null);
  const [requestForm] = Form.useForm();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingLeave,  setRejectingLeave]  = useState(null);
  const [rejectReason,    setRejectReason]    = useState('');

  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [editingBalance,   setEditingBalance]   = useState(null);
  const [balanceForm] = Form.useForm();

  const [blackoutModalOpen, setBlackoutModalOpen] = useState(false);
  const [editingBlackout,   setEditingBlackout]   = useState(null);
  const [blackoutForm] = Form.useForm();

  const [initModalOpen,    setInitModalOpen]    = useState(false);
  const [initYear,         setInitYear]         = useState(dayjs().year());
  const [initCarryForward, setInitCarryForward] = useState(false);
  const [initLeaveTypes,   setInitLeaveTypes]   = useState([]);

  const [selectedLeaveKeys,   setSelectedLeaveKeys]   = useState([]);
  const [selectedBalanceKeys, setSelectedBalanceKeys] = useState([]);
  const [bulkApprovePending,  setBulkApprovePending]  = useState(false);

  const [balanceSearch,     setBalanceSearch]     = useState('');
  const [balanceFilterType, setBalanceFilterType] = useState(null);
  const [balanceFilterYear, setBalanceFilterYear] = useState(null);
  const [balanceFilterLow,  setBalanceFilterLow]  = useState(false);
  const [balanceDeptFilter, setBalanceDeptFilter] = useState(null);

  const [balanceCheckKey, setBalanceCheckKey] = useState({ personnel_id: null, leave_type: null });

  // Calendar state
  const [calMonth, setCalMonth] = useState(dayjs().startOf('month'));

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: leaveTypesRaw } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => apiService.get('/api/v1/personnel/leave/types'),
    staleTime: Infinity,
  });
  const leaveTypes = leaveTypesRaw || [];

  const { data: personnelRaw } = useQuery({
    queryKey: ['personnel-list-leave'],
    queryFn: () => apiService.get('/api/v1/personnel/?page_size=500'),
    staleTime: 60000,
  });
  const personnel = useMemo(() => {
    const raw = personnelRaw?.results || personnelRaw?.data || personnelRaw || [];
    return Array.isArray(raw) ? raw : [];
  }, [personnelRaw]);

  const personnelOptions = useMemo(() =>
    personnel.map((p) => {
      const code  = p.badge_id || p.emp_code || '';
      const label = p.full_name
        ? `${p.full_name}${code ? ` (${code})` : ''}`
        : (code || `#${p.id}`);
      return { value: p.id, label };
    }),
  [personnel]);

  const { data: departmentsRaw } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.get('/api/v1/departments/'),
    staleTime: 120000,
  });
  const departments = useMemo(() => {
    const raw = departmentsRaw?.results || departmentsRaw || [];
    return Array.isArray(raw) ? raw : [];
  }, [departmentsRaw]);

  const deptOptions = useMemo(() =>
    departments.map(d => ({ value: d.id, label: d.name })),
  [departments]);

  // Unfiltered stats — always shows full-database counts regardless of UI filters
  const { data: statsData } = useQuery({
    queryKey: ['leave-stats'],
    queryFn: () => apiService.get('/api/v1/personnel/leave/stats'),
    refetchInterval: 30000,
  });
  const stats = useMemo(() => ({
    total:    statsData?.total    ?? 0,
    pending:  statsData?.pending  ?? 0,
    approved: statsData?.approved ?? 0,
    rejected: statsData?.rejected ?? 0,
  }), [statsData]);

  const leaveQueryParams = useMemo(() => {
    const p = {};
    if (filterStatus)             p.status     = filterStatus;
    if (filterType)               p.leave_type = filterType;
    if (filterDept)               p.department_id = filterDept;
    if (filterDateRange?.[0])     p.start_date = filterDateRange[0].format('YYYY-MM-DD');
    if (filterDateRange?.[1])     p.end_date   = filterDateRange[1].format('YYYY-MM-DD');
    return p;
  }, [filterStatus, filterType, filterDept, filterDateRange]);

  const { data: leavesRaw, isLoading: leavesLoading, refetch: refetchLeaves } = useQuery({
    queryKey: ['leave-requests', leaveQueryParams],
    queryFn: () => apiService.get('/api/v1/personnel/leave', leaveQueryParams),
    refetchInterval: 30000,
  });
  const leaves = useMemo(() => {
    const raw = leavesRaw?.data || leavesRaw || [];
    return Array.isArray(raw) ? raw : [];
  }, [leavesRaw]);

  const { data: balancesRaw, isLoading: balancesLoading, refetch: refetchBalances } = useQuery({
    queryKey: ['leave-balances', balanceDeptFilter],
    queryFn: () => {
      const params = { limit: 5000 };
      if (balanceDeptFilter) params.department_id = balanceDeptFilter;
      return apiService.get('/api/v1/personnel/leave/balance', params);
    },
    enabled: activeTab === 'balances',
  });
  const balances = useMemo(() => {
    const raw = balancesRaw?.data || balancesRaw || [];
    return Array.isArray(raw) ? raw : [];
  }, [balancesRaw]);

  const balanceYears = useMemo(() => {
    const arr = Array.isArray(balances) ? balances : [];
    return [...new Set(arr.map((b) => b.year))].sort((a, b) => b - a);
  }, [balances]);

  const { data: blackoutsRaw, isLoading: blackoutsLoading, refetch: refetchBlackouts } = useQuery({
    queryKey: ['leave-blackouts'],
    queryFn: () => apiService.get('/api/v1/personnel/leave/blackout'),
    enabled: activeTab === 'blackout',
  });
  const blackouts = useMemo(() => {
    const raw = blackoutsRaw?.data || blackoutsRaw || [];
    return Array.isArray(raw) ? raw : [];
  }, [blackoutsRaw]);

  // Calendar query — fetches a wider range (prev + cur + next month) for smooth nav
  const calStart = calMonth.startOf('month').format('YYYY-MM-DD');
  const calEnd   = calMonth.endOf('month').format('YYYY-MM-DD');
  const { data: calRaw, isLoading: calLoading, refetch: refetchCal } = useQuery({
    queryKey: ['leave-calendar', calStart, calEnd],
    queryFn: () => apiService.get('/api/v1/personnel/leave/calendar', { start_date: calStart, end_date: calEnd }),
    enabled: activeTab === 'calendar',
    staleTime: 60000,
  });
  // New backend returns { days: {...}, spans: [...] }
  const calData = useMemo(() => {
    const raw = calRaw?.data || calRaw || {};
    // Support both new shape { days, spans } and legacy shape (plain date-keyed object)
    if (raw && typeof raw === 'object' && ('days' in raw || 'spans' in raw)) return raw;
    return { days: raw, spans: [] };
  }, [calRaw]);

  const filteredBalances = useMemo(() => {
    let result = balances;
    if (balanceSearch) {
      const q = balanceSearch.toLowerCase();
      result = result.filter(
        (b) =>
          (b.personnel_name     || '').toLowerCase().includes(q) ||
          (b.personnel_emp_code || '').toLowerCase().includes(q)
      );
    }
    if (balanceFilterType) result = result.filter((b) => b.leave_type === balanceFilterType);
    if (balanceFilterYear) result = result.filter((b) => b.year === balanceFilterYear);
    if (balanceFilterLow)  result = result.filter((b) => Number(b.balance_days) <= 0);
    return result;
  }, [balances, balanceSearch, balanceFilterType, balanceFilterYear, balanceFilterLow]);

  const { data: balanceCheck, isFetching: balanceChecking } = useQuery({
    queryKey: ['balance-check', balanceCheckKey.personnel_id, balanceCheckKey.leave_type],
    queryFn:  () => apiService.get('/api/v1/personnel/leave/balance/check', {
      personnel_id: balanceCheckKey.personnel_id,
      leave_type:   balanceCheckKey.leave_type,
      year:         dayjs().year(),
    }),
    enabled:   !!(balanceCheckKey.personnel_id && balanceCheckKey.leave_type),
    staleTime: 10000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const leaveMutation = useMutation({
    mutationFn: (data) =>
      editingLeave
        ? apiService.put(`/api/v1/personnel/leave/${editingLeave.id}`, data)
        : apiService.post('/api/v1/personnel/leave', data),
    onSuccess: () => {
      message.success(editingLeave ? 'Leave request updated' : 'Leave request submitted');
      setRequestModalOpen(false); setEditingLeave(null); requestForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Operation failed'}`),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => apiService.put(`/api/v1/personnel/leave/${id}/approve`),
    onSuccess: () => {
      message.success('Leave request approved');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Approval failed'}`),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, rejection_reason }) =>
      apiService.put(`/api/v1/personnel/leave/${id}/reject`, { rejection_reason }),
    onSuccess: () => {
      message.success('Leave request rejected');
      setRejectModalOpen(false); setRejectingLeave(null); setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Reject failed'}`),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => apiService.put(`/api/v1/personnel/leave/${id}/cancel`),
    onSuccess: () => {
      message.success('Leave request cancelled');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Cancel failed'}`),
  });

  const deleteRequestMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/leave/${id}`),
    onSuccess: () => {
      message.success('Leave request deleted');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Delete failed'}`),
  });

  const balanceMutation = useMutation({
    mutationFn: (data) =>
      editingBalance
        ? apiService.put(`/api/v1/personnel/leave/balance/${editingBalance.id}`, data)
        : apiService.post('/api/v1/personnel/leave/balance', data),
    onSuccess: () => {
      message.success(editingBalance ? 'Balance updated' : 'Balance created');
      setBalanceModalOpen(false); setEditingBalance(null); balanceForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Operation failed'}`),
  });

  const deleteBalanceMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/leave/balance/${id}`),
    onSuccess: () => {
      message.success('Balance record deleted');
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Delete failed'}`),
  });

  const blackoutMutation = useMutation({
    mutationFn: (data) =>
      editingBlackout
        ? apiService.put(`/api/v1/personnel/leave/blackout/${editingBlackout.id}`, data)
        : apiService.post('/api/v1/personnel/leave/blackout', data),
    onSuccess: () => {
      message.success(editingBlackout ? 'Blackout period updated' : 'Blackout period created');
      setBlackoutModalOpen(false); setEditingBlackout(null); blackoutForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['leave-blackouts'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Operation failed'}`),
  });

  const deleteBlackoutMutation = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/personnel/leave/blackout/${id}`),
    onSuccess: () => {
      message.success('Blackout period deleted');
      queryClient.invalidateQueries({ queryKey: ['leave-blackouts'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Delete failed'}`),
  });

  const initializeBalancesMutation = useMutation({
    mutationFn: (data) => apiService.post('/api/v1/personnel/leave/balance/initialize', data),
    onSuccess: (res) => {
      const result = res?.data || res || {};
      message.success(
        `Balances initialized for ${result.year || initYear}: ` +
        `${result.created ?? 0} records created, ${result.skipped ?? 0} already existed.`
      );
      setInitModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
    onError: (err) => message.error(`Error: ${err.message || 'Initialization failed'}`),
  });

  // ── Bulk handlers ────────────────────────────────────────────────────────────
  const bulkDeleteLeaves = async () => {
    try {
      await Promise.all(selectedLeaveKeys.map((id) => apiService.delete(`/api/v1/personnel/leave/${id}`)));
      message.success(`${selectedLeaveKeys.length} request(s) deleted`);
      setSelectedLeaveKeys([]);
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
    } catch (err) { message.error(`Bulk delete failed: ${err.message}`); }
  };

  const bulkApproveLeaves = async () => {
    setBulkApprovePending(true);
    const ids = selectedLeaveKeys.filter(id =>
      leaves.find(l => l.id === id)?.status === 'pending'
    );
    try {
      const results = await Promise.allSettled(
        ids.map(id => apiService.put(`/api/v1/personnel/leave/${id}/approve`))
      );
      const ok  = results.filter(r => r.status === 'fulfilled').length;
      const bad = results.filter(r => r.status === 'rejected').length;
      if (ok)  message.success(`${ok} request(s) approved`);
      if (bad) message.warning(`${bad} request(s) failed (balance may be insufficient)`);
      setSelectedLeaveKeys([]);
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
    } catch (err) { message.error(`Bulk approve failed: ${err.message}`); }
    finally { setBulkApprovePending(false); }
  };

  const bulkDeleteBalances = async () => {
    try {
      await Promise.all(selectedBalanceKeys.map((id) => apiService.delete(`/api/v1/personnel/leave/balance/${id}`)));
      message.success(`${selectedBalanceKeys.length} balance record(s) deleted`);
      setSelectedBalanceKeys([]);
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    } catch (err) { message.error(`Bulk delete failed: ${err.message}`); }
  };

  // ── Row selection ────────────────────────────────────────────────────────────
  const leaveRowSelection = {
    selectedRowKeys: selectedLeaveKeys,
    onChange: setSelectedLeaveKeys,
    getCheckboxProps: (record) => ({
      disabled: record.status !== 'pending',
      title:    record.status !== 'pending' ? 'Only pending requests can be selected' : '',
    }),
    selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
  };
  const balanceRowSelection = {
    selectedRowKeys: selectedBalanceKeys,
    onChange: setSelectedBalanceKeys,
    selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const autoCalcDays = useCallback(() => {
    setTimeout(() => {
      const start = requestForm.getFieldValue('start_date');
      const end   = requestForm.getFieldValue('end_date');
      if (start && end && dayjs.isDayjs(start) && dayjs.isDayjs(end) && !end.isBefore(start)) {
        const working = countWorkingDays(start, end);
        if (working > 0) requestForm.setFieldValue('days_count', working);
      }
    }, 0);
  }, [requestForm]);

  const openRequestModal = (record = null) => {
    setEditingLeave(record);
    setRequestModalOpen(true);
    setTimeout(() => {
      requestForm.resetFields();
      if (record) {
        requestForm.setFieldsValue({
          ...record,
          start_date: record.start_date ? dayjs(record.start_date) : null,
          end_date:   record.end_date   ? dayjs(record.end_date)   : null,
        });
        setBalanceCheckKey({ personnel_id: record.personnel_id, leave_type: record.leave_type });
      } else {
        setBalanceCheckKey({ personnel_id: null, leave_type: null });
      }
    }, 0);
  };

  const openBalanceModal = (record = null) => {
    setEditingBalance(record);
    setBalanceModalOpen(true);
    setTimeout(() => { balanceForm.resetFields(); if (record) balanceForm.setFieldsValue({ ...record }); }, 0);
  };

  const openBlackoutModal = (record = null) => {
    setEditingBlackout(record);
    setBlackoutModalOpen(true);
    setTimeout(() => {
      blackoutForm.resetFields();
      if (record) blackoutForm.setFieldsValue({
        ...record,
        start_date: record.start_date ? dayjs(record.start_date) : null,
        end_date:   record.end_date   ? dayjs(record.end_date)   : null,
      });
    }, 0);
  };

  const handleRequestOk = () =>
    requestForm.validateFields().then((values) =>
      leaveMutation.mutate({
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date:   values.end_date?.format('YYYY-MM-DD'),
      })
    ).catch(() => {});

  const handleBalanceOk  = () => balanceForm.validateFields().then((v) => balanceMutation.mutate(v)).catch(() => {});
  const handleBlackoutOk = () =>
    blackoutForm.validateFields().then((values) =>
      blackoutMutation.mutate({
        ...values,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date:   values.end_date?.format('YYYY-MM-DD'),
      })
    ).catch(() => {});

  // ── Client-side search ───────────────────────────────────────────────────────
  const filteredLeaves = useMemo(() => {
    if (!searchText) return leaves;
    const q = searchText.toLowerCase();
    return leaves.filter((l) =>
      (l.personnel_name     || '').toLowerCase().includes(q) ||
      (l.personnel_emp_code || '').toLowerCase().includes(q) ||
      (l.leave_type         || '').toLowerCase().includes(q) ||
      (l.reason             || '').toLowerCase().includes(q)
    );
  }, [leaves, searchText]);

  const leaveTypeColor = (code) => leaveTypes.find((lt) => lt.code === code)?.color || 'default';
  const leaveTypeLabel = (code) => leaveTypes.find((lt) => lt.code === code)?.name  || code;

  // ── CSV export configs ───────────────────────────────────────────────────────
  const leaveExportColumns = [
    { title: 'Employee',    exportValue: r => r.personnel_name || '' },
    { title: 'Emp Code',    exportValue: r => r.personnel_emp_code || '' },
    { title: 'Leave Type',  exportValue: r => leaveTypeLabel(r.leave_type) },
    { title: 'Start Date',  exportValue: r => r.start_date || '' },
    { title: 'End Date',    exportValue: r => r.end_date || '' },
    { title: 'Days',        exportValue: r => r.days_count || '' },
    { title: 'Status',      exportValue: r => r.status || '' },
    { title: 'Reason',      exportValue: r => r.reason || '' },
    { title: 'Approved By', exportValue: r => r.approved_by_name || '' },
    { title: 'Approved At', exportValue: r => r.approved_at ? dayjs(r.approved_at).format('YYYY-MM-DD HH:mm') : '' },
    { title: 'Rejection Reason', exportValue: r => r.rejection_reason || '' },
    { title: 'Submitted',   exportValue: r => r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm') : '' },
  ];

  const balanceExportColumns = [
    { title: 'Employee',       exportValue: r => r.personnel_name || '' },
    { title: 'Emp Code',       exportValue: r => r.personnel_emp_code || '' },
    { title: 'Leave Type',     exportValue: r => leaveTypeLabel(r.leave_type) },
    { title: 'Year',           exportValue: r => r.year || '' },
    { title: 'Total Days',     exportValue: r => r.total_days || '' },
    { title: 'Used Days',      exportValue: r => r.used_days || '' },
    { title: 'Balance Days',   exportValue: r => r.balance_days || '' },
    { title: 'Carry Forward',  exportValue: r => r.carry_forward_days || '' },
  ];

  // ── Table columns ────────────────────────────────────────────────────────────
  const leaveColumns = [
    {
      title: 'Employee',
      key: 'employee',
      width: 200,
      render: (_, r) => (
        <EmployeeCell
          name={r.personnel_name || `ID: ${r.personnel_id}`}
          empCode={r.personnel_emp_code}
        />
      ),
    },
    {
      title: 'Leave Type',
      key: 'leave_type',
      width: 140,
      render: (_, r) => (
        <Tag
          color={leaveTypeColor(r.leave_type)}
          style={{ borderRadius: 5, fontWeight: 600, fontSize: 11 }}
        >
          {leaveTypeLabel(r.leave_type)}
        </Tag>
      ),
    },
    {
      title: 'Period',
      key: 'period',
      width: 210,
      render: (_, r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: '#374151' }}>
            <span>{r.start_date ? dayjs(r.start_date).format('DD MMM YYYY') : '—'}</span>
            <ArrowRightOutlined style={{ fontSize: 9, color: '#9ca3af' }} />
            <span>{r.end_date ? dayjs(r.end_date).format('DD MMM YYYY') : '—'}</span>
          </div>
          {r.days_count && (
            <span style={{
              display: 'inline-block', marginTop: 3,
              background: '#f3f4f6', border: '1px solid #e5e7eb',
              color: '#4b5563', borderRadius: 4, padding: '0 6px',
              fontSize: 10, fontWeight: 600,
            }}>
              {r.days_count} working day{Number(r.days_count) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (v) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v || <span style={{ color: '#d1d5db' }}>—</span>}</span>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 115,
      render: (_, r) => <LeaveStatusPill status={r.status} />,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.status === 'pending' && (
            <>
              <Tooltip title="Approve">
                <Button
                  type="primary" size="small" icon={<CheckCircleOutlined />}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(r.id)}
                  style={{ borderRadius: 6, background: '#16a34a', borderColor: '#16a34a' }}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  danger size="small" icon={<CloseCircleOutlined />}
                  onClick={() => { setRejectingLeave(r); setRejectModalOpen(true); }}
                  style={{ borderRadius: 6 }}
                />
              </Tooltip>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openRequestModal(r)} style={{ borderRadius: 6 }} />
              </Tooltip>
              <Popconfirm title="Delete this request?" onConfirm={() => deleteRequestMutation.mutate(r.id)} okButtonProps={{ danger: true }}>
                <Tooltip title="Delete">
                  <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          {(r.status === 'approved' || r.status === 'on_leave') && (
            <Popconfirm title="Cancel this leave?" onConfirm={() => cancelMutation.mutate(r.id)} okButtonProps={{ danger: true }}>
              <Tooltip title="Cancel leave">
                <Button danger size="small" icon={<StopOutlined />} style={{ borderRadius: 6 }}>Cancel</Button>
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ── Expandable row — shows rejection reason, approver, submitted date ─────────
  const expandedRowRender = (r) => (
    <div style={{ padding: '8px 16px 8px 48px', background: '#fafafa' }}>
      <Row gutter={24}>
        {r.rejection_reason && (
          <Col>
            <Text type="secondary" style={{ fontSize: 11 }}>Rejection reason: </Text>
            <Text style={{ fontSize: 12, color: '#b91c1c' }}>{r.rejection_reason}</Text>
          </Col>
        )}
        {r.approved_by_name && (
          <Col>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {r.status === 'rejected' ? 'Rejected by: ' : 'Approved by: '}
            </Text>
            <Text style={{ fontSize: 12 }}>{r.approved_by_name}</Text>
            {r.approved_at && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {' '}· {dayjs(r.approved_at).format('DD MMM YYYY HH:mm')}
              </Text>
            )}
          </Col>
        )}
        <Col>
          <Text type="secondary" style={{ fontSize: 11 }}>Submitted: </Text>
          <Text style={{ fontSize: 12 }}>{r.created_at ? dayjs(r.created_at).format('DD MMM YYYY HH:mm') : '—'}</Text>
        </Col>
      </Row>
    </div>
  );

  const rowExpandable = (r) =>
    !!(r.rejection_reason || r.approved_by_name || r.approved_at || r.created_at);

  const balanceColumns = [
    {
      title: 'Employee',
      key: 'employee',
      width: 200,
      render: (_, r) => (
        <EmployeeCell
          name={r.personnel_name || `ID: ${r.personnel_id}`}
          empCode={r.personnel_emp_code}
        />
      ),
    },
    {
      title: 'Leave Type',
      key: 'leave_type',
      width: 140,
      render: (_, r) => (
        <Tag color={leaveTypeColor(r.leave_type)} style={{ borderRadius: 5, fontWeight: 600, fontSize: 11 }}>
          {leaveTypeLabel(r.leave_type)}
        </Tag>
      ),
    },
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      width: 70,
      align: 'center',
      render: (y) => (
        <span style={{
          background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 5,
          padding: '1px 7px', fontSize: 11, fontWeight: 700, color: '#374151',
        }}>{y}</span>
      ),
    },
    {
      title: 'Balance',
      key: 'balance',
      width: 200,
      render: (_, r) => {
        const total   = Number(r.total_days)   || 0;
        const used    = Number(r.used_days)    || 0;
        const balance = Number(r.balance_days) || 0;
        const pct     = total > 0 ? Math.round((used / total) * 100) : 0;
        const color   = balance > 5 ? '#16a34a' : balance > 0 ? '#d97706' : '#dc2626';
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <Text style={{ fontSize: 11, color: '#6b7280' }}>Used {used.toFixed(1)} / {total.toFixed(1)} d</Text>
              <Text style={{ fontSize: 11, fontWeight: 700, color }}>{balance.toFixed(1)} left</Text>
            </div>
            <Progress
              percent={pct}
              size="small"
              strokeColor={color}
              trailColor="#e5e7eb"
              showInfo={false}
              style={{ marginBottom: 0 }}
            />
          </div>
        );
      },
    },
    {
      title: 'Carry Fwd',
      dataIndex: 'carry_forward_days',
      key: 'carry_forward_days',
      width: 90,
      align: 'center',
      render: (d) => {
        const n = Number(d);
        return n > 0
          ? <Tag color="blue" style={{ borderRadius: 4, fontSize: 10 }}>+{n.toFixed(1)}</Tag>
          : <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>;
      },
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 76,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openBalanceModal(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Popconfirm title="Delete balance record?" onConfirm={() => deleteBalanceMutation.mutate(r.id)} okButtonProps={{ danger: true }}>
            <Tooltip title="Delete"><Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6 }} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const blackoutColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (v) => <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{v}</span>,
    },
    {
      title: 'Period',
      key: 'period',
      width: 230,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <span style={{ fontWeight: 500 }}>{r.start_date ? dayjs(r.start_date).format('DD MMM YYYY') : '—'}</span>
          <ArrowRightOutlined style={{ fontSize: 9, color: '#9ca3af' }} />
          <span style={{ fontWeight: 500 }}>{r.end_date   ? dayjs(r.end_date).format('DD MMM YYYY')   : '—'}</span>
        </div>
      ),
    },
    {
      title: 'Applies To',
      dataIndex: 'applies_to',
      key: 'applies_to',
      width: 120,
      render: (v) => (
        <Tag color="purple" style={{ borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
          {(v || 'all').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (v) => <span style={{ fontSize: 12, color: '#6b7280' }}>{v || <span style={{ color: '#d1d5db' }}>—</span>}</span>,
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 76,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openBlackoutModal(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Popconfirm title="Delete blackout period?" onConfirm={() => deleteBlackoutMutation.mutate(r.id)} okButtonProps={{ danger: true }}>
            <Tooltip title="Delete"><Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6 }} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Stat cards ───────────────────────────────────────────────────────────────
  const STATS = [
    { label: 'Total Requests',      value: stats.total,    icon: <FileTextOutlined />,       color: '#2563eb', bg: '#eff6ff' },
    { label: 'Pending Approval',    value: stats.pending,  icon: <CalendarOutlined />,        color: '#d97706', bg: '#fffbeb' },
    { label: 'Approved / On Leave', value: stats.approved, icon: <CheckCircleOutlined />,     color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Rejected',            value: stats.rejected, icon: <CloseCircleOutlined />,     color: '#dc2626', bg: '#fef2f2' },
  ];

  const tableContainerStyle = {
    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
  };
  const paginationProps = {
    pageSize: 20, showSizeChanger: true, showQuickJumper: true,
    showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}`,
    style: { padding: '12px 16px', margin: 0 },
  };

  // Calendar tab renders the standalone TeamCalendar component

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Leave Management</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                Manage leave requests, balances, blackout periods and team calendar
              </div>
            </div>
            <Space size="middle" style={{ overflow: 'visible' }}>
              <Badge count={stats.pending} showZero color="#d97706">
                <CalendarOutlined style={{ fontSize: 16 }} />
              </Badge>
              <Badge count={stats.approved} showZero color="#16a34a">
                <CheckCircleOutlined style={{ fontSize: 16 }} />
              </Badge>
              <Button
                type="primary" icon={<PlusOutlined />}
                onClick={() => openRequestModal()}
                size="small" style={{ fontWeight: 600 }}
              >
                New Leave Request
              </Button>
            </Space>
          </div>
        }
        styles={{ header: { overflow: 'visible' } }}
      >

      {/* Stat cards — always from unfiltered /leave/stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {STATS.map((s) => (
          <Col xs={12} sm={6} key={s.label}>
            <div style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: s.bg, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: s.color, fontSize: 18,
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Tabs */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 16px' }}
          items={[

            // ── TAB 1: Requests ──────────────────────────────────────────────
            {
              key: 'requests',
              label: <span><FileTextOutlined /> Leave Requests</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  {/* Filter bar */}
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                    marginBottom: 12,
                  }}>
                    <Input
                      placeholder="Search employee or reason…"
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      allowClear
                      style={{ flex: '1 1 180px', maxWidth: 240, borderRadius: 8 }}
                    />
                    <FilterOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                    <Select
                      placeholder="Status" allowClear
                      style={{ flex: '1 1 120px', minWidth: 120 }}
                      value={filterStatus} onChange={setFilterStatus}
                      options={Object.entries(STATUS_PILL_CFG).map(([v, { label }]) => ({ value: v, label }))}
                    />
                    <Select
                      placeholder="Leave Type" allowClear
                      style={{ flex: '1 1 140px', minWidth: 140 }}
                      value={filterType} onChange={setFilterType}
                      options={leaveTypes.map((lt) => ({
                        value: lt.code,
                        label: <Tag color={lt.color} style={{ margin: 0 }}>{lt.name}</Tag>,
                      }))}
                    />
                    <Select
                      placeholder="Department" allowClear showSearch optionFilterProp="label"
                      style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={filterDept} onChange={setFilterDept}
                      options={deptOptions}
                    />
                    <RangePicker
                      style={{ flex: '1 1 220px' }}
                      value={filterDateRange}
                      onChange={setFilterDateRange}
                      placeholder={['From', 'To']}
                      format="DD MMM YYYY"
                    />
                    {(filterStatus || filterType || filterDept || filterDateRange) && (
                      <Button
                        size="small" style={{ borderRadius: 6 }}
                        onClick={() => { setFilterStatus(null); setFilterType(null); setFilterDept(null); setFilterDateRange(null); }}
                      >
                        Clear
                      </Button>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <Tooltip title="Export to CSV">
                        <Button
                          icon={<DownloadOutlined />}
                          onClick={() => exportCSV(leaveExportColumns, filteredLeaves, `leave-requests-${dayjs().format('YYYY-MM-DD')}.csv`)}
                          style={{ borderRadius: 8 }}
                        />
                      </Tooltip>
                      <Button
                        icon={<ReloadOutlined />} onClick={() => { refetchLeaves(); setSelectedLeaveKeys([]); }}
                        style={{ borderRadius: 8 }}
                      />
                    </div>
                  </div>

                  {/* Active filter pills */}
                  {(filterStatus || filterType || filterDept || filterDateRange) && (
                    <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {filterStatus && <Tag closable onClose={() => setFilterStatus(null)} color="blue">{STATUS_PILL_CFG[filterStatus]?.label}</Tag>}
                      {filterType && <Tag closable onClose={() => setFilterType(null)} color="purple">{leaveTypeLabel(filterType)}</Tag>}
                      {filterDept && <Tag closable onClose={() => setFilterDept(null)} icon={<TeamOutlined />}>{deptOptions.find(d => d.value === filterDept)?.label}</Tag>}
                      {filterDateRange && <Tag closable onClose={() => setFilterDateRange(null)} icon={<CalendarOutlined />}>{filterDateRange[0]?.format('DD MMM')} – {filterDateRange[1]?.format('DD MMM YYYY')}</Tag>}
                    </div>
                  )}

                  {/* Bulk bar */}
                  <BulkBar
                    count={selectedLeaveKeys.length}
                    noun="request"
                    onClear={() => setSelectedLeaveKeys([])}
                    onDelete={bulkDeleteLeaves}
                    onApprove={bulkApproveLeaves}
                    approvePending={bulkApprovePending}
                  />

                  <div style={tableContainerStyle}>
                    <Table
                      columns={leaveColumns}
                      dataSource={filteredLeaves}
                      loading={leavesLoading}
                      rowKey="id"
                      size="middle"
                      scroll={{ x: 1000 }}
                      rowSelection={leaveRowSelection}
                      pagination={paginationProps}
                      expandable={{ expandedRowRender, rowExpandable }}
                      onRow={() => ({
                        onMouseEnter: (e) => { e.currentTarget.style.background = '#f8fafc'; },
                        onMouseLeave: (e) => { e.currentTarget.style.background = ''; },
                      })}
                    />
                  </div>
                </div>
              ),
            },

            // ── TAB 2: Balances ──────────────────────────────────────────────
            {
              key: 'balances',
              label: <span><WalletOutlined /> Leave Balances</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <Alert
                    style={{ marginBottom: 12, borderRadius: 8 }}
                    type="info" showIcon
                    message="How balances work"
                    description={
                      <span>
                        <b>Initialize</b> creates balance records for all active employees at the start of each year.
                        Balances are automatically deducted when a leave is <b>approved</b> and restored when <b>cancelled</b>.
                      </span>
                    }
                  />

                  {/* Filter bar */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <Input
                      placeholder="Search employee…"
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      value={balanceSearch}
                      onChange={(e) => { setBalanceSearch(e.target.value); setSelectedBalanceKeys([]); }}
                      allowClear
                      style={{ flex: '1 1 180px', maxWidth: 240, borderRadius: 8 }}
                    />
                    <FilterOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                    <Select
                      placeholder="Leave Type" allowClear
                      style={{ flex: '1 1 130px', minWidth: 130 }}
                      value={balanceFilterType}
                      onChange={(v) => { setBalanceFilterType(v); setSelectedBalanceKeys([]); }}
                      options={leaveTypes.map((lt) => ({
                        value: lt.code,
                        label: <Tag color={lt.color} style={{ margin: 0 }}>{lt.name}</Tag>,
                      }))}
                    />
                    <Select
                      placeholder="Year" allowClear
                      style={{ flex: '1 1 80px', minWidth: 80 }}
                      value={balanceFilterYear}
                      onChange={(v) => { setBalanceFilterYear(v); setSelectedBalanceKeys([]); }}
                      options={balanceYears.map((y) => ({ value: y, label: y }))}
                    />
                    <Select
                      placeholder="Department" allowClear showSearch optionFilterProp="label"
                      style={{ flex: '1 1 150px', minWidth: 150 }}
                      value={balanceDeptFilter}
                      onChange={(v) => { setBalanceDeptFilter(v); setSelectedBalanceKeys([]); }}
                      options={deptOptions}
                    />
                    <Tooltip title="Show only exhausted balances">
                      <Button
                        type={balanceFilterLow ? 'primary' : 'default'}
                        danger={balanceFilterLow}
                        onClick={() => { setBalanceFilterLow((v) => !v); setSelectedBalanceKeys([]); }}
                        style={{ borderRadius: 8 }}
                        size="small"
                        icon={<ExclamationCircleOutlined />}
                      >
                        Exhausted{balanceFilterLow ? ' ×' : ''}
                      </Button>
                    </Tooltip>
                    {(balanceSearch || balanceFilterType || balanceFilterYear || balanceFilterLow || balanceDeptFilter) && (
                      <Button
                        size="small" style={{ borderRadius: 6 }}
                        onClick={() => { setBalanceSearch(''); setBalanceFilterType(null); setBalanceFilterYear(null); setBalanceFilterLow(false); setBalanceDeptFilter(null); setSelectedBalanceKeys([]); }}
                      >
                        Clear
                      </Button>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                        {filteredBalances.length} / {balances.length} records
                      </Text>
                      <Tooltip title="Export to CSV">
                        <Button
                          icon={<DownloadOutlined />}
                          onClick={() => exportCSV(balanceExportColumns, filteredBalances, `leave-balances-${dayjs().format('YYYY-MM-DD')}.csv`)}
                          style={{ borderRadius: 8 }}
                        />
                      </Tooltip>
                      <Tooltip title="Creates leave balance records for all active employees">
                        <Button
                          type="primary" icon={<ThunderboltOutlined />}
                          onClick={() => setInitModalOpen(true)}
                          style={{ borderRadius: 8 }}
                        >
                          Initialize Year
                        </Button>
                      </Tooltip>
                      <Button icon={<PlusOutlined />} onClick={() => openBalanceModal()} style={{ borderRadius: 8 }}>
                        Add Single
                      </Button>
                      <Button icon={<ReloadOutlined />} onClick={() => { refetchBalances(); setSelectedBalanceKeys([]); }} style={{ borderRadius: 8 }} />
                    </div>
                  </div>

                  {/* Bulk bar */}
                  <BulkBar
                    count={selectedBalanceKeys.length}
                    noun="balance record"
                    onClear={() => setSelectedBalanceKeys([])}
                    onDelete={bulkDeleteBalances}
                  />

                  <div style={tableContainerStyle}>
                    <Table
                      columns={balanceColumns}
                      dataSource={filteredBalances}
                      loading={balancesLoading}
                      rowKey="id"
                      size="middle"
                      scroll={{ x: 900 }}
                      rowSelection={balanceRowSelection}
                      pagination={paginationProps}
                      onRow={() => ({
                        onMouseEnter: (e) => { e.currentTarget.style.background = '#f8fafc'; },
                        onMouseLeave: (e) => { e.currentTarget.style.background = ''; },
                      })}
                    />
                  </div>
                </div>
              ),
            },

            // ── TAB 3: Calendar ──────────────────────────────────────────────
            {
              key: 'calendar',
              label: <span><CalendarOutlined /> Team Calendar</span>,
              children: (
                <TeamCalendar
                  calData={calData}
                  calLoading={calLoading}
                  refetchCal={refetchCal}
                  leaveTypes={leaveTypes}
                  calMonth={calMonth}
                  setCalMonth={setCalMonth}
                  departments={departments}
                />
              ),
            },

            // ── TAB 4: Blackout Periods ──────────────────────────────────────
            {
              key: 'blackout',
              label: <span><StopOutlined /> Blackout Periods</span>,
              children: (
                <div style={{ padding: '0 0 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openBlackoutModal()} style={{ borderRadius: 8 }}>
                      Add Blackout Period
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={() => refetchBlackouts()} style={{ borderRadius: 8 }} />
                  </div>
                  <div style={tableContainerStyle}>
                    <Table
                      columns={blackoutColumns}
                      dataSource={blackouts}
                      loading={blackoutsLoading}
                      rowKey="id"
                      size="middle"
                      scroll={{ x: 800 }}
                      pagination={paginationProps}
                      onRow={() => ({
                        onMouseEnter: (e) => { e.currentTarget.style.background = '#f8fafc'; },
                        onMouseLeave: (e) => { e.currentTarget.style.background = ''; },
                      })}
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ── Leave Request Modal ────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display:'flex',alignItems:'center',justifyContent:'center' }}>
              <FileTextOutlined style={{ color: '#fff', fontSize: 12 }} />
            </div>
            {editingLeave ? 'Edit Leave Request' : 'New Leave Request'}
          </Space>
        }
        open={requestModalOpen}
        onOk={handleRequestOk}
        onCancel={() => { setRequestModalOpen(false); setEditingLeave(null); requestForm.resetFields(); }}
        confirmLoading={leaveMutation.isPending}
        width={680} forceRender
      >
        <Form form={requestForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Employee" rules={[{ required: true, message: 'Select employee' }]}>
                <Select showSearch placeholder="Select employee" optionFilterProp="label" options={personnelOptions} onChange={(val) => {
                  const lt = requestForm.getFieldValue('leave_type');
                  setBalanceCheckKey({ personnel_id: val || null, leave_type: lt || null });
                }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="leave_type" label="Leave Type" rules={[{ required: true, message: 'Select leave type' }]}>
                <Select placeholder="Select leave type" onChange={(val) => {
                  const pid = requestForm.getFieldValue('personnel_id');
                  setBalanceCheckKey({ personnel_id: pid || null, leave_type: val || null });
                }} options={leaveTypes.map((lt) => ({
                  value: lt.code,
                  label: <span><Tag color={lt.color} style={{ marginRight: 6 }}>{lt.name}</Tag>{lt.paid ? '(Paid)' : '(Unpaid)'}</span>,
                }))} />
              </Form.Item>
            </Col>
          </Row>

          {/* Balance indicator */}
          {balanceCheckKey.personnel_id && balanceCheckKey.leave_type && (
            <div style={{ marginBottom: 16 }}>
              {balanceChecking ? (
                <Alert message="Checking available balance…" type="info" showIcon />
              ) : balanceCheck?.has_balance === false ? (
                <Alert
                  message={`No balance record for ${balanceCheckKey.leave_type} in ${dayjs().year()}. Ask HR to initialize balances.`}
                  type="warning" showIcon
                />
              ) : balanceCheck?.has_balance ? (
                <div style={{
                  background: balanceCheck.balance_days <= 0 ? '#fff1f0' : '#f6ffed',
                  border: `1px solid ${balanceCheck.balance_days <= 0 ? '#ffa39e' : '#b7eb8f'}`,
                  borderRadius: 8, padding: '12px 14px',
                }}>
                  <Row gutter={16} align="middle">
                    <Col span={18}>
                      <Text strong style={{ fontSize: 12 }}>
                        {balanceCheckKey.leave_type} Balance ({balanceCheck.year})
                      </Text>
                      <Progress
                        percent={balanceCheck.total_days > 0
                          ? Math.round((balanceCheck.used_days / balanceCheck.total_days) * 100) : 0}
                        strokeColor={balanceCheck.balance_days <= 0 ? '#ff4d4f' : '#52c41a'}
                        trailColor="#e8f5e9" size="small" style={{ marginBottom: 0, marginTop: 4 }}
                      />
                    </Col>
                    <Col span={6} style={{ textAlign: 'right' }}>
                      <Text type="secondary" style={{ fontSize: 10 }}>Available</Text>
                      <div>
                        <Text strong style={{ fontSize: 20, color: balanceCheck.balance_days <= 0 ? '#ff4d4f' : '#52c41a' }}>
                          {balanceCheck.balance_days.toFixed(1)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}> / {balanceCheck.total_days.toFixed(1)} d</Text>
                      </div>
                    </Col>
                  </Row>
                  {balanceCheck.balance_days <= 0 && (
                    <Alert message="No remaining balance — this request will be blocked." type="error" showIcon style={{ marginTop: 8 }} banner />
                  )}
                </div>
              ) : null}
            </div>
          )}

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_date" label="Start Date" rules={[{ required: true, message: 'Select start date' }]}>
                <DatePicker
                  style={{ width: '100%' }} format="YYYY-MM-DD"
                  onChange={autoCalcDays}
                  disabledDate={(d) => d && d.day() === 0 || d && d.day() === 6}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_date" label="End Date" rules={[
                { required: true, message: 'Select end date' },
                ({ getFieldValue }) => ({
                  validator(_, v) {
                    if (!v || !getFieldValue('start_date') || !v.isBefore(getFieldValue('start_date')))
                      return Promise.resolve();
                    return Promise.reject('End date must be on or after start date');
                  },
                }),
              ]}>
                <DatePicker
                  style={{ width: '100%' }} format="YYYY-MM-DD"
                  onChange={autoCalcDays}
                  disabledDate={(d) => d && d.day() === 0 || d && d.day() === 6}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="days_count" label="Working Days"
                extra={balanceCheck?.has_balance ? `Max: ${balanceCheck.balance_days.toFixed(1)} days` : 'Weekends excluded automatically'}
                rules={[
                  { required: true, message: 'Enter days' },
                  { validator: (_, val) => (balanceCheck?.has_balance && val > balanceCheck.balance_days)
                      ? Promise.reject(`Exceeds balance (${balanceCheck.balance_days.toFixed(1)} d)`)
                      : Promise.resolve() },
                ]}
              >
                <InputNumber
                  min={0.5} step={0.5}
                  max={balanceCheck?.has_balance ? Math.max(0.5, balanceCheck.balance_days) : 365}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Reason for leave request" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Reject Modal ──────────────────────────────────────────────────── */}
      <Modal
        title="Reject Leave Request"
        open={rejectModalOpen}
        onOk={() => {
          if (!rejectReason.trim()) {
            message.warning('Please enter a rejection reason.');
            return;
          }
          rejectMutation.mutate({ id: rejectingLeave?.id, rejection_reason: rejectReason });
        }}
        onCancel={() => { setRejectModalOpen(false); setRejectingLeave(null); setRejectReason(''); }}
        confirmLoading={rejectMutation.isPending}
        okButtonProps={{ danger: true }} okText="Reject" forceRender
      >
        {rejectingLeave && (
          <Descriptions size="small" column={1} style={{ marginBottom: 16, background: '#f9fafb', borderRadius: 8, padding: 12 }}>
            <Descriptions.Item label="Employee">{rejectingLeave.personnel_name || rejectingLeave.personnel_id}</Descriptions.Item>
            <Descriptions.Item label="Leave Type">{leaveTypeLabel(rejectingLeave.leave_type)}</Descriptions.Item>
            <Descriptions.Item label="Period">
              {dayjs(rejectingLeave.start_date).format('DD MMM YYYY')} – {dayjs(rejectingLeave.end_date).format('DD MMM YYYY')} ({rejectingLeave.days_count} days)
            </Descriptions.Item>
          </Descriptions>
        )}
        <Input.TextArea
          rows={4} placeholder="Rejection reason (required)"
          value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
          maxLength={500} showCount status={!rejectReason.trim() ? 'warning' : ''}
        />
        {!rejectReason.trim() && (
          <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            A rejection reason is required so the employee understands why.
          </Text>
        )}
      </Modal>

      {/* ── Balance Modal ──────────────────────────────────────────────────── */}
      <Modal
        title={editingBalance ? 'Edit Leave Balance' : 'Add Leave Balance'}
        open={balanceModalOpen}
        onOk={handleBalanceOk}
        onCancel={() => { setBalanceModalOpen(false); setEditingBalance(null); balanceForm.resetFields(); }}
        confirmLoading={balanceMutation.isPending}
        width={560} forceRender
      >
        <Form form={balanceForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_id" label="Employee" rules={[{ required: true }]}>
                <Select showSearch placeholder="Select employee" optionFilterProp="label" options={personnelOptions} disabled={!!editingBalance} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="leave_type" label="Leave Type" rules={[{ required: true }]}>
                <Select placeholder="Select type" options={leaveTypes.map((lt) => ({ value: lt.code, label: lt.name }))} disabled={!!editingBalance} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="year" label="Year" rules={[{ required: true }]}>
                <InputNumber min={2020} max={2100} style={{ width: '100%' }} disabled={!!editingBalance} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="total_days" label="Total Days" rules={[{ required: true }]}>
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="carry_forward_days" label="Carry Forward" initialValue={0}>
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          {editingBalance && (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="used_days" label="Used Days">
                  <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="balance_days" label="Balance Days">
                  <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>

      {/* ── Blackout Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={editingBlackout ? 'Edit Blackout Period' : 'New Blackout Period'}
        open={blackoutModalOpen}
        onOk={handleBlackoutOk}
        onCancel={() => { setBlackoutModalOpen(false); setEditingBlackout(null); blackoutForm.resetFields(); }}
        confirmLoading={blackoutMutation.isPending}
        width={560} forceRender
      >
        <Form form={blackoutForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}>
            <Input placeholder="e.g. Year-End Freeze" maxLength={100} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_date" label="Start Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="End Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="applies_to" label="Applies To" initialValue="all">
                <Select options={[
                  { value: 'all',        label: 'All Personnel'   },
                  { value: 'department', label: 'Specific Department' },
                ]} onChange={(v) => {
                  if (v !== 'department') blackoutForm.setFieldValue('department_id', undefined);
                }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.applies_to !== cur.applies_to}
              >
                {({ getFieldValue }) =>
                  getFieldValue('applies_to') === 'department' ? (
                    <Form.Item name="department_id" label="Department" rules={[{ required: true, message: 'Select a department' }]}>
                      <Select showSearch optionFilterProp="label" placeholder="Select department" options={deptOptions} />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Initialize Balances Modal ──────────────────────────────────────── */}
      <Modal
        title={<Space><ThunderboltOutlined style={{ color: '#2563eb' }} /> Initialize Year Balances</Space>}
        open={initModalOpen}
        onOk={() => initializeBalancesMutation.mutate({
          year: initYear,
          carry_forward: initCarryForward,
          leave_type_codes: initLeaveTypes.length > 0 ? initLeaveTypes : null,
        })}
        onCancel={() => { setInitModalOpen(false); setInitLeaveTypes([]); }}
        confirmLoading={initializeBalancesMutation.isPending}
        okText={`Initialize${initLeaveTypes.length > 0 ? ` (${initLeaveTypes.length} type${initLeaveTypes.length > 1 ? 's' : ''})` : ' All Types'}`}
        width={540}
      >
        <Alert
          style={{ marginBottom: 16, borderRadius: 8 }}
          type="info" showIcon
          message="Creates leave balance records for all active employees. Existing records are skipped."
        />
        <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
          <Col span={10}>
            <Text strong>Year</Text>
            <InputNumber value={initYear} onChange={(v) => setInitYear(v)} min={2020} max={2100} style={{ width: '100%', marginTop: 4 }} />
          </Col>
          <Col span={14}>
            <Text strong>Carry forward unused balance from {initYear - 1}?</Text>
            <div style={{ marginTop: 4 }}>
              <Switch checked={initCarryForward} onChange={setInitCarryForward} checkedChildren="Yes" unCheckedChildren="No" />
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                Rolls unused {initYear - 1} balance into {initYear}
              </Text>
            </div>
          </Col>
        </Row>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text strong style={{ fontSize: 13 }}>Leave Types to Initialize</Text>
            <Space size={4}>
              <Button size="small" type="link" style={{ padding: 0 }} onClick={() => setInitLeaveTypes(leaveTypes.map((lt) => lt.code))}>Select All</Button>
              <Text type="secondary">|</Text>
              <Button size="small" type="link" style={{ padding: 0 }} onClick={() => setInitLeaveTypes([])}>Clear</Button>
            </Space>
          </div>
          {initLeaveTypes.length === 0 && (
            <Alert type="warning" showIcon message="No types selected — all types will be initialized." style={{ marginBottom: 10 }} banner />
          )}
          <Checkbox.Group value={initLeaveTypes} onChange={setInitLeaveTypes} style={{ width: '100%' }}>
            <Row gutter={[8, 10]}>
              {leaveTypes.map((lt) => (
                <Col span={12} key={lt.code}>
                  <Checkbox value={lt.code}>
                    <Tag color={lt.color} style={{ marginRight: 4 }}>{lt.name}</Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>{lt.default_days} days</Text>
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        </div>
      </Modal>

      <style>{`
        .ant-table-thead > tr > th {
          background: #f8fafc !important;
          color: #64748b !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          border-bottom: 2px solid #e2e8f0 !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f1f5f9 !important;
          padding: 10px 12px !important;
        }
        .ant-table-tbody > tr:last-child > td { border-bottom: none !important; }
        .ant-tabs-nav { margin-bottom: 0 !important; }
        .ant-table-expanded-row > td { padding: 0 !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default LeaveManagement;
