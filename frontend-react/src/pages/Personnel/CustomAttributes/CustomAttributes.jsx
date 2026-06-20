import React, { useState, useMemo } from 'react';
import {
  Table, Button, Space, Input, Select, Row, Col,
  App, Popconfirm, Form, Drawer, Descriptions,
  Divider, Tooltip, Switch, Modal, Typography, Progress, Dropdown, Card,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  ReloadOutlined, SettingOutlined, EyeOutlined,
  AppstoreOutlined, CheckCircleOutlined, DatabaseOutlined,
  FilterOutlined, DownloadOutlined, CheckSquareOutlined,
  MoreOutlined, ExclamationCircleOutlined, TagsOutlined,
  LockOutlined, UnlockOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../../services/api';
import dayjs from 'dayjs';

const { Text } = Typography;

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_CFG = {
  TEXT:         { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd',  label: 'Text',        icon: 'T'  },
  NUMBER:       { color: '#15803d', bg: '#dcfce7', border: '#86efac',  label: 'Number',       icon: '#'  },
  DATE:         { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa',  label: 'Date',         icon: 'D'  },
  BOOLEAN:      { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe',  label: 'Boolean',      icon: '✓'  },
  SELECT:       { color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd',  label: 'Select',       icon: '▾'  },
  MULTI_SELECT: { color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc',  label: 'Multi-Select', icon: '≡'  },
  FILE:         { color: '#0891b2', bg: '#e0f2fe', border: '#7dd3fc',  label: 'File',         icon: 'F'  },
  EMAIL:        { color: '#be123c', bg: '#fff1f2', border: '#fda4af',  label: 'Email',        icon: '@'  },
  PHONE:        { color: '#b45309', bg: '#fffbeb', border: '#fde68a',  label: 'Phone',        icon: '☎'  },
  URL:          { color: '#4d7c0f', bg: '#f7fee7', border: '#bef264',  label: 'URL',          icon: '↗'  },
};

const CAT_CFG = {
  PERSONAL:     { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', label: 'Personal'      },
  PROFESSIONAL: { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Professional'  },
  MEDICAL:      { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Medical'       },
  EMERGENCY:    { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa', label: 'Emergency'     },
  SYSTEM:       { color: '#4b5563', bg: '#f9fafb', border: '#e5e7eb', label: 'System'        },
  CUSTOM:       { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', label: 'Custom'        },
};

const ATTRIBUTE_TYPES = Object.entries(TYPE_CFG).map(([value, c]) => ({ value, ...c }));
const CATEGORIES      = Object.entries(CAT_CFG).map(([value, c])  => ({ value, ...c }));

const typeCfg = v => TYPE_CFG[v] || { color: '#4b5563', bg: '#f9fafb', border: '#e5e7eb', label: v || '—', icon: '?' };
const catCfg  = v => CAT_CFG[v]  || { color: '#4b5563', bg: '#f9fafb', border: '#e5e7eb', label: v || '—' };

const exportCSV = (rows, fname) => {
  const cols = [
    { h: 'Code',         v: r => r.attribute_code || '' },
    { h: 'Display Name', v: r => r.attribute_name || '' },
    { h: 'Type',         v: r => r.attribute_type || '' },
    { h: 'Category',     v: r => r.category || '' },
    { h: 'Group',        v: r => r.group_name || '' },
    { h: 'Required',     v: r => r.is_required ? 'Yes' : 'No' },
    { h: 'Active',       v: r => r.is_active !== false ? 'Yes' : 'No' },
    { h: 'Searchable',   v: r => r.is_searchable ? 'Yes' : 'No' },
    { h: 'Usage Count',  v: r => String(r.usage_count ?? 0) },
    { h: 'Options',      v: r => (r.display_options?.options || []).join(' | ') },
  ];
  const h = cols.map(c => `"${c.h}"`).join(',');
  const b = rows.map(r => cols.map(c => `"${c.v(r).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([h+'\n'+b], { type: 'text/csv' }));
  a.download = fname; a.click(); URL.revokeObjectURL(a.href);
};

// ── Pills ─────────────────────────────────────────────────────────────────────
const TypePill = ({ value }) => {
  const t = typeCfg(value);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: t.color, background: t.bg, border: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{t.icon}</span>
      {t.label}
    </span>
  );
};

const CategoryPill = ({ value }) => {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>;
  const c = catCfg(value);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
};

const StatusPill = ({ active }) => {
  const on = active !== false;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: on ? '#15803d' : '#6b7280', background: on ? '#f0fdf4' : '#f9fafb', border: `1px solid ${on ? '#bbf7d0' : '#e5e7eb'}` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? '#16a34a' : '#9ca3af', flexShrink: 0 }}/>
      {on ? 'Active' : 'Inactive'}
    </span>
  );
};

const FlagDot = ({ on, label }) => (
  <Tooltip title={label}>
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: on ? '#dbeafe' : '#f3f4f6', border: `1px solid ${on ? '#93c5fd' : '#e5e7eb'}`, fontSize: 9, fontWeight: 700, color: on ? '#1d4ed8' : '#9ca3af', cursor: 'default' }}>
      {on ? '✓' : '—'}
    </span>
  </Tooltip>
);

// ── Field icon cell ────────────────────────────────────────────────────────────
const FieldCell = ({ record, onClick }) => {
  const t = typeCfg(record.attribute_type);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: t.bg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: t.color }}>
        {t.icon}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#1d4ed8', fontFamily: 'monospace', letterSpacing: '0.3px' }}>{record.attribute_code}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{record.attribute_name}</div>
      </div>
    </div>
  );
};

// ── Usage bar ─────────────────────────────────────────────────────────────────
const UsageBar = ({ count, max }) => {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const color = pct > 75 ? '#16a34a' : pct > 25 ? '#2563eb' : '#94a3b8';
  return (
    <Tooltip title={`Used by ${count} of ${max} personnel`}>
      <div style={{ minWidth: 70 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3, color: '#6b7280' }}>
          <span style={{ fontWeight: 700, color }}>{count}</span>
          <span>{max > 0 ? `${pct}%` : '—'}</span>
        </div>
        <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }}/>
        </div>
      </div>
    </Tooltip>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const CustomAttributes = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [search,          setSearch]          = useState('');
  const [filterType,      setFilterType]      = useState(null);
  const [filterCategory,  setFilterCategory]  = useState(null);
  const [filterStatus,    setFilterStatus]    = useState(null);  // 'active' | 'inactive'
  const [filterRequired,  setFilterRequired]  = useState(null);  // 'required' | 'optional'
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkDeleting,    setBulkDeleting]    = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [form] = Form.useForm();

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord,  setDetailRecord]  = useState(null);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: raw = [], isLoading, refetch } = useQuery({
    queryKey: ['custom-attributes'],
    queryFn:  () => apiService.get('/api/v1/personnel/custom-attributes/?limit=500').then(r => {
      if (Array.isArray(r)) return r;
      return r?.data || r?.results || [];
    }),
    staleTime: 30000,
  });

  const maxUsage = useMemo(() => Math.max(1, ...raw.map(a => a.usage_count ?? 0)), [raw]);

  const attributes = useMemo(() => raw.filter(a => {
    if (filterType     && a.attribute_type !== filterType)                   return false;
    if (filterCategory && a.category !== filterCategory)                     return false;
    if (filterStatus === 'active'   && a.is_active === false)                return false;
    if (filterStatus === 'inactive' && a.is_active !== false)                return false;
    if (filterRequired === 'required' && !a.is_required)                     return false;
    if (filterRequired === 'optional' && a.is_required)                      return false;
    if (search) {
      const q = search.toLowerCase();
      return (a.attribute_code || '').toLowerCase().includes(q)
          || (a.attribute_name || '').toLowerCase().includes(q)
          || (a.group_name     || '').toLowerCase().includes(q)
          || (a.description    || '').toLowerCase().includes(q);
    }
    return true;
  }), [raw, filterType, filterCategory, filterStatus, filterRequired, search]);

  const hasFilters = search || filterType || filterCategory || filterStatus || filterRequired;
  const clearFilters = () => { setSearch(''); setFilterType(null); setFilterCategory(null); setFilterStatus(null); setFilterRequired(null); };

  // Derived stats (from raw, not filtered)
  const totalCount    = raw.length;
  const activeCount   = raw.filter(a => a.is_active !== false).length;
  const requiredCount = raw.filter(a => a.is_required).length;
  const selectCount   = raw.filter(a => ['SELECT', 'MULTI_SELECT'].includes(a.attribute_type)).length;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['custom-attributes'] });

  const saveMutation = useMutation({
    mutationFn: data => editing
      ? apiService.put(`/api/v1/personnel/custom-attributes/${editing.id}/`, data)
      : apiService.post('/api/v1/personnel/custom-attributes/', data),
    onSuccess: () => {
      message.success(editing ? 'Attribute updated' : 'Attribute created');
      setDrawerVisible(false); setEditing(null); form.resetFields(); invalidate();
    },
    onError: e => message.error(e?.response?.data?.detail || 'Operation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => apiService.delete(`/api/v1/personnel/custom-attributes/${id}`),
    onSuccess: () => { message.success('Attribute deleted'); setDetailVisible(false); invalidate(); },
    onError:   e => message.error(e?.response?.data?.detail || 'Delete failed'),
  });

  const handleBulkDelete = () => {
    Modal.confirm({
      title:   `Delete ${selectedRowKeys.length} attribute${selectedRowKeys.length > 1 ? 's' : ''}?`,
      content: 'All employee values recorded against these fields will also be removed.',
      icon:    <ExclamationCircleOutlined style={{ color: '#dc2626' }}/>,
      okText:  'Delete All', okButtonProps: { danger: true },
      onOk: async () => {
        setBulkDeleting(true);
        try {
          await Promise.all(selectedRowKeys.map(id => apiService.delete(`/api/v1/personnel/custom-attributes/${id}`)));
          message.success(`${selectedRowKeys.length} attribute(s) deleted`);
          setSelectedRowKeys([]);
          invalidate();
        } catch { message.error('Some deletions failed'); }
        finally { setBulkDeleting(false); }
      },
    });
  };

  // ── Form helpers ───────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null); form.resetFields(); setDrawerVisible(true);
  };

  const openEdit = rec => {
    setEditing(rec);
    form.setFieldsValue({
      attribute_code:      rec.attribute_code,
      attribute_name:      rec.attribute_name,
      attribute_type:      rec.attribute_type,
      category:            rec.category,
      group_name:          rec.group_name,
      sort_order:          rec.sort_order ?? 0,
      placeholder_text:    rec.placeholder_text,
      is_required:         rec.is_required ?? false,
      is_searchable:       rec.is_searchable ?? true,
      is_visible_in_list:  rec.is_visible_in_list ?? true,
      is_active:           rec.is_active ?? true,
      description:         rec.description,
      notes:               rec.notes,
      options:             rec.display_options?.options || [],
    });
    setDrawerVisible(true);
  };

  const handleSubmit = () => form.validateFields().then(values => {
    const isSelect = ['SELECT', 'MULTI_SELECT'].includes(values.attribute_type);
    saveMutation.mutate({
      attribute_code:      values.attribute_code,
      attribute_name:      values.attribute_name,
      attribute_type:      values.attribute_type,
      description:         values.description || null,
      category:            values.category || null,
      group_name:          values.group_name || null,
      sort_order:          values.sort_order ?? 0,
      placeholder_text:    values.placeholder_text || null,
      is_required:         values.is_required ?? false,
      is_searchable:       values.is_searchable ?? true,
      is_visible_in_list:  values.is_visible_in_list ?? true,
      is_active:           values.is_active ?? true,
      notes:               values.notes || null,
      display_options:     isSelect && values.options?.length ? { options: values.options } : null,
    });
  });

  // ── Row selection ──────────────────────────────────────────────────────────
  const rowSelection = {
    selectedRowKeys,
    onChange: keys => setSelectedRowKeys(keys),
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
      { key: 'active',   text: 'Select Active Only',   onSelect: () => setSelectedRowKeys(attributes.filter(a => a.is_active !== false).map(a => a.id)) },
      { key: 'required', text: 'Select Required Only',  onSelect: () => setSelectedRowKeys(attributes.filter(a => a.is_required).map(a => a.id)) },
      { key: 'unused',   text: 'Select Unused Fields',  onSelect: () => setSelectedRowKeys(attributes.filter(a => !a.usage_count).map(a => a.id)) },
    ],
  };

  // ── Expandable rows ────────────────────────────────────────────────────────
  const expandedRowRender = rec => {
    const opts = rec.display_options?.options || [];
    return (
      <div style={{ padding: '10px 16px 12px 58px', background: '#fafafa' }}>
        <Row gutter={[16, 8]}>
          {rec.description && (
            <Col xs={24} md={12}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Description</div>
              <div style={{ fontSize: 12, color: '#374151' }}>{rec.description}</div>
            </Col>
          )}
          {rec.notes && (
            <Col xs={24} md={12}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Internal Notes</div>
              <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{rec.notes}</div>
            </Col>
          )}
          {rec.placeholder_text && (
            <Col xs={24} md={12}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Placeholder</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>"{rec.placeholder_text}"</div>
            </Col>
          )}
          {opts.length > 0 && (
            <Col xs={24}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Dropdown Options ({opts.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {opts.map(o => (
                  <span key={o} style={{ padding: '2px 8px', borderRadius: 6, background: '#fff', border: '1px solid #e5e7eb', fontSize: 11, color: '#374151' }}>{o}</span>
                ))}
              </div>
            </Col>
          )}
          {!rec.description && !rec.notes && !rec.placeholder_text && opts.length === 0 && (
            <Col xs={24}><span style={{ fontSize: 12, color: '#9ca3af' }}>No additional details</span></Col>
          )}
        </Row>
      </div>
    );
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Field', key: 'field', width: 240,
      sorter: (a, b) => (a.attribute_code||'').localeCompare(b.attribute_code||''),
      defaultSortOrder: 'ascend',
      render: (_, rec) => (
        <FieldCell record={rec} onClick={() => { setDetailRecord(rec); setDetailVisible(true); }}/>
      ),
    },
    {
      title: 'Type', key: 'type', width: 140,
      sorter: (a, b) => (a.attribute_type||'').localeCompare(b.attribute_type||''),
      filters: ATTRIBUTE_TYPES.map(t => ({ text: t.label, value: t.value })),
      onFilter: (value, r) => r.attribute_type === value,
      render: (_, r) => <TypePill value={r.attribute_type}/>,
    },
    {
      title: 'Category', key: 'category', width: 140,
      sorter: (a, b) => (a.category||'').localeCompare(b.category||''),
      filters: CATEGORIES.map(c => ({ text: c.label, value: c.value })),
      onFilter: (value, r) => r.category === value,
      render: (_, r) => <CategoryPill value={r.category}/>,
    },
    {
      title: 'Group', dataIndex: 'group_name', key: 'group', width: 120, ellipsis: true,
      sorter: (a, b) => (a.group_name||'').localeCompare(b.group_name||''),
      render: v => v ? <span style={{ fontSize: 12, color: '#374151' }}>{v}</span> : <span style={{ color: '#d1d5db' }}>—</span>,
    },
    {
      title: 'Options', key: 'options', width: 160,
      sorter: (a, b) => (a.display_options?.options?.length||0) - (b.display_options?.options?.length||0),
      render: (_, r) => {
        const opts = r.display_options?.options || [];
        if (!opts.length) return <span style={{ color: '#d1d5db' }}>—</span>;
        return (
          <Tooltip title={opts.join(', ')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {opts.slice(0, 2).map(o => (
                <span key={o} style={{ padding: '1px 6px', borderRadius: 4, background: '#f3f4f6', border: '1px solid #e5e7eb', fontSize: 10, color: '#374151' }}>{o}</span>
              ))}
              {opts.length > 2 && <span style={{ padding: '1px 6px', borderRadius: 4, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 10, color: '#2563eb', fontWeight: 700 }}>+{opts.length - 2}</span>}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Flags', key: 'flags', width: 100, align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title={r.is_required ? 'Required' : 'Optional'}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: r.is_required ? '#fef2f2' : '#f9fafb', color: r.is_required ? '#dc2626' : '#9ca3af', border: `1px solid ${r.is_required ? '#fecaca' : '#e5e7eb'}` }}>
              {r.is_required ? <LockOutlined style={{ fontSize: 8 }}/> : <UnlockOutlined style={{ fontSize: 8 }}/>}
              {r.is_required ? 'Req' : 'Opt'}
            </span>
          </Tooltip>
          <FlagDot on={r.is_searchable}      label={r.is_searchable ? 'Searchable' : 'Not searchable'}/>
          <FlagDot on={r.is_visible_in_list} label={r.is_visible_in_list ? 'Visible in list' : 'Hidden in list'}/>
        </Space>
      ),
    },
    {
      title: 'Status', key: 'status', width: 100,
      sorter: (a, b) => (a.is_active === false ? 0 : 1) - (b.is_active === false ? 0 : 1),
      filters: [{ text: 'Active', value: true }, { text: 'Inactive', value: false }],
      onFilter: (value, r) => (r.is_active !== false) === value,
      render: (_, r) => <StatusPill active={r.is_active}/>,
    },
    {
      title: 'Usage', key: 'usage', width: 110,
      sorter: (a, b) => (a.usage_count ?? 0) - (b.usage_count ?? 0),
      render: (_, r) => <UsageBar count={r.usage_count ?? 0} max={maxUsage}/>,
    },
    {
      title: 'Order', dataIndex: 'sort_order', key: 'sort_order', width: 70, align: 'center',
      sorter: (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      render: v => <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{v ?? 0}</span>,
    },
    {
      title: '', key: 'actions', fixed: 'right', width: 60,
      render: (_, rec) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'view', label: 'View Details', icon: <EyeOutlined/>,
                onClick: () => { setDetailRecord(rec); setDetailVisible(true); },
              },
              {
                key: 'edit', label: 'Edit Field', icon: <EditOutlined/>,
                onClick: () => openEdit(rec),
              },
              {
                key: 'expand', icon: <AppstoreOutlined/>,
                label: expandedRowKeys.includes(rec.id) ? 'Collapse Row' : 'Show Details',
                onClick: () => setExpandedRowKeys(prev =>
                  prev.includes(rec.id) ? prev.filter(k => k !== rec.id) : [...prev, rec.id]
                ),
              },
              {
                key: 'export', label: 'Export This Row', icon: <DownloadOutlined/>,
                onClick: () => exportCSV([rec], `attribute-${rec.attribute_code}-${dayjs().format('YYYY-MM-DD')}.csv`),
              },
              { type: 'divider' },
              {
                key: 'delete', label: 'Delete', icon: <DeleteOutlined/>, danger: true,
                onClick: () => Modal.confirm({
                  title:   `Delete "${rec.attribute_code}"?`,
                  content: `${rec.usage_count ?? 0} employee record${(rec.usage_count ?? 0) !== 1 ? 's have' : ' has'} a value stored for this field — those values will also be removed.`,
                  icon:    <ExclamationCircleOutlined style={{ color: '#dc2626' }}/>,
                  okText:  'Delete', okButtonProps: { danger: true },
                  onOk:    () => deleteMutation.mutateAsync(rec.id),
                }),
              },
            ],
          }}
        >
          <Button size="small" type="text" icon={<MoreOutlined/>} style={{ borderRadius: 6 }}/>
        </Dropdown>
      ),
    },
  ];

  const selectedRecords = attributes.filter(a => selectedRowKeys.includes(a.id));

  return (
    <div className="personnel-module">
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'visible' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Custom Attributes</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                Define extra fields that extend every employee's profile — certifications, medical data, compliance records
              </div>
            </div>
            <Space size="middle" style={{ overflow: 'visible' }}>
              <Button icon={<ReloadOutlined/>} size="small" onClick={() => refetch()} loading={isLoading}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined/>} size="small" onClick={openAdd} style={{ fontWeight: 600 }}>Add Field</Button>
            </Space>
          </div>
        }
        styles={{ header: { overflow: 'visible' } }}
      >

      {/* Stat cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Fields',    value: totalCount,    color: '#2563eb', icon: <DatabaseOutlined/> },
          { label: 'Active Fields',   value: activeCount,   color: '#16a34a', icon: <CheckCircleOutlined/> },
          { label: 'Required Fields', value: requiredCount, color: '#dc2626', icon: <LockOutlined/> },
          { label: 'Dropdown Fields', value: selectCount,   color: '#7c3aed', icon: <TagsOutlined/> },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #f0f0f0', borderTop: `3px solid ${s.color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1.2, marginTop: 4 }}>{s.value}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {React.cloneElement(s.icon, { style: { color: s.color, fontSize: 18 } })}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <Input
          placeholder="Search code, name, group, description…"
          prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 12 }}/>}
          value={search} onChange={e => setSearch(e.target.value)} allowClear
          style={{ flex: '1 1 220px', maxWidth: 280, borderRadius: 8 }}
        />
        <FilterOutlined style={{ color: '#94a3b8', fontSize: 12 }}/>
        <Select placeholder="Data Type" allowClear style={{ flex: '1 1 130px', minWidth: 130 }}
          value={filterType} onChange={setFilterType}
          options={ATTRIBUTE_TYPES.map(t => ({ value: t.value, label: <TypePill value={t.value}/> }))}
        />
        <Select placeholder="Category" allowClear style={{ flex: '1 1 140px', minWidth: 140 }}
          value={filterCategory} onChange={setFilterCategory}
          options={CATEGORIES.map(c => ({ value: c.value, label: <CategoryPill value={c.value}/> }))}
        />
        <Select placeholder="Status" allowClear style={{ width: 120 }}
          value={filterStatus} onChange={setFilterStatus}
          options={[
            { value: 'active',   label: <StatusPill active={true}/>  },
            { value: 'inactive', label: <StatusPill active={false}/> },
          ]}
        />
        <Select placeholder="Required" allowClear style={{ width: 120 }}
          value={filterRequired} onChange={setFilterRequired}
          options={[
            { value: 'required', label: <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>Required</span> },
            { value: 'optional', label: <span style={{ fontSize: 12, color: '#6b7280' }}>Optional</span> },
          ]}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Tooltip title="Export visible rows to CSV">
            <Button icon={<DownloadOutlined/>} onClick={() => exportCSV(attributes, `custom-attributes-${dayjs().format('YYYY-MM-DD')}.csv`)} style={{ borderRadius: 8 }}/>
          </Tooltip>
        </div>
      </div>

      {/* Active filter pills */}
      {hasFilters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Filters:</span>
          {search && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>"{search}"<button type="button" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2563eb', fontSize: 12 }}>×</button></span>}
          {filterType && (() => { const t = typeCfg(filterType); return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>{t.label}<button type="button" onClick={() => setFilterType(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 12 }}>×</button></span>; })()}
          {filterCategory && (() => { const c = catCfg(filterCategory); return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{c.label}<button type="button" onClick={() => setFilterCategory(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 12 }}>×</button></span>; })()}
          {filterStatus && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, background: filterStatus === 'active' ? '#f0fdf4' : '#f9fafb', color: filterStatus === 'active' ? '#15803d' : '#6b7280', border: `1px solid ${filterStatus === 'active' ? '#bbf7d0' : '#e5e7eb'}` }}>{filterStatus}<button type="button" onClick={() => setFilterStatus(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 12 }}>×</button></span>}
          {filterRequired && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, background: filterRequired === 'required' ? '#fef2f2' : '#f9fafb', color: filterRequired === 'required' ? '#dc2626' : '#6b7280', border: `1px solid ${filterRequired === 'required' ? '#fecaca' : '#e5e7eb'}` }}>{filterRequired}<button type="button" onClick={() => setFilterRequired(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 12 }}>×</button></span>}
          <button type="button" onClick={clearFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 11, color: '#94a3b8', textDecoration: 'underline' }}>Clear all</button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedRowKeys.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', marginBottom: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
          <CheckSquareOutlined style={{ color: '#2563eb', fontSize: 15 }}/>
          <span style={{ fontWeight: 600, color: '#2563eb', fontSize: 13 }}>{selectedRowKeys.length} field{selectedRowKeys.length !== 1 ? 's' : ''} selected</span>
          <div style={{ flex: 1 }}/>
          <Button size="small" icon={<DownloadOutlined/>} onClick={() => exportCSV(selectedRecords, `attributes-selected-${dayjs().format('YYYY-MM-DD')}.csv`)}>Export CSV</Button>
          <Button size="small" danger icon={<DeleteOutlined/>} loading={bulkDeleting} onClick={handleBulkDelete}>Delete Selected</Button>
          <Button size="small" type="text" onClick={() => setSelectedRowKeys([])}>Clear</Button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={attributes}
          loading={isLoading}
          rowKey="id"
          rowSelection={rowSelection}
          expandable={{
            expandedRowKeys,
            onExpandedRowsChange: setExpandedRowKeys,
            expandedRowRender,
            rowExpandable: () => true,
          }}
          size="middle"
          scroll={{ x: 1200 }}
          rowClassName={r => r.is_active === false ? 'row-inactive' : ''}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => (
              <span>
                {range[0]}–{range[1]} of <strong>{total}</strong>
                {hasFilters && <span style={{ color: '#94a3b8', marginLeft: 4 }}>(from {raw.length} total)</span>}
                {selectedRowKeys.length > 0 && <span style={{ color: '#2563eb', marginLeft: 6 }}>· {selectedRowKeys.length} selected</span>}
              </span>
            ),
            style: { padding: '12px 16px', margin: 0 },
          }}
          footer={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#94a3b8' }}>
              <Space size={16}>
                {Object.entries(TYPE_CFG).map(([k, t]) => {
                  const c = attributes.filter(a => a.attribute_type === k).length;
                  return c > 0 ? (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }}/>
                      {t.label}: <strong style={{ color: '#374151' }}>{c}</strong>
                    </span>
                  ) : null;
                })}
              </Space>
              <Button size="small" type="text" icon={<DownloadOutlined/>} style={{ color: '#94a3b8' }}
                onClick={() => exportCSV(attributes, `custom-attributes-${dayjs().format('YYYY-MM-DD')}.csv`)}>
                Export all ({attributes.length})
              </Button>
            </div>
          )}
        />
      </div>

      {/* ── Add / Edit Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: editing ? '#dbeafe' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {editing ? <EditOutlined style={{ color: '#2563eb', fontSize: 12 }}/> : <PlusOutlined style={{ color: '#16a34a', fontSize: 12 }}/>}
            </div>
            {editing ? `Edit: ${editing.attribute_code}` : 'Add Custom Field'}
          </Space>
        }
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setEditing(null); form.resetFields(); }}
        width={680}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => { setDrawerVisible(false); setEditing(null); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit} loading={saveMutation.isPending}>
              {editing ? 'Save Changes' : 'Create Field'}
            </Button>
          </Space>
        }
        destroyOnHidden
      >
        <Form form={form} layout="vertical" size="small">

          <Divider orientation="left"><Space><DatabaseOutlined style={{ color: '#2563eb' }}/>Identity</Space></Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="attribute_code" label="Attribute Code"
                rules={[{ required: true, message: 'Required' }, { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: 'Letters, numbers, underscores only' }]}>
                <Input placeholder="e.g., offshore_certification" disabled={!!editing} style={editing ? { background: '#fafafa' } : {}}/>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="attribute_name" label="Display Name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g., Offshore Certification"/>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="attribute_type" label="Data Type" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select data type" size="middle"
                  options={ATTRIBUTE_TYPES.map(t => ({ value: t.value, label: <TypePill value={t.value}/> }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category">
                <Select placeholder="Select category" size="middle" allowClear
                  options={CATEGORIES.map(c => ({ value: c.value, label: <CategoryPill value={c.value}/> }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item noStyle shouldUpdate={(p, c) => p.attribute_type !== c.attribute_type}>
            {({ getFieldValue }) => ['SELECT','MULTI_SELECT'].includes(getFieldValue('attribute_type')) ? (
              <>
                <Divider orientation="left"><Space><FilterOutlined style={{ color: '#7c3aed' }}/>Dropdown Options</Space></Divider>
                <Form.Item name="options" label="Options" rules={[{ required: true, message: 'Add at least one option' }]}>
                  <Select mode="tags" placeholder="Type an option and press Enter" size="middle" tokenSeparators={[',']} style={{ width: '100%' }}/>
                </Form.Item>
              </>
            ) : null}
          </Form.Item>

          <Divider orientation="left"><Space><AppstoreOutlined style={{ color: '#c2410c' }}/>Configuration</Space></Divider>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="placeholder_text" label="Placeholder Text">
                <Input placeholder="Hint shown inside the field"/>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sort_order" label="Sort Order" initialValue={0}>
                <Input type="number" min={0}/>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="group_name" label="Group Name">
            <Input placeholder="Optional section grouping label"/>
          </Form.Item>

          <Divider orientation="left"><Space><CheckCircleOutlined style={{ color: '#16a34a' }}/>Behaviour</Space></Divider>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="is_required" label="Required" valuePropName="checked" initialValue={false}>
                <Switch/>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_searchable" label="Searchable" valuePropName="checked" initialValue={true}>
                <Switch/>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_visible_in_list" label="Show in List" valuePropName="checked" initialValue={true}>
                <Switch/>
              </Form.Item>
            </Col>
          </Row>
          {editing && (
            <Form.Item name="is_active" label="Active" valuePropName="checked" initialValue={true}>
              <Switch/>
            </Form.Item>
          )}

          <Divider orientation="left"><Space><EditOutlined style={{ color: '#8c8c8c' }}/>Description & Notes</Space></Divider>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Explain what this field captures"/>
          </Form.Item>
          <Form.Item name="notes" label="Internal Notes">
            <Input.TextArea rows={2} placeholder="Notes for administrators only"/>
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ─────────────────────────────────────────────────────── */}
      <Drawer
        title={
          detailRecord && (
            <Space>
              {detailRecord.attribute_type && (
                <div style={{ width: 28, height: 28, borderRadius: 6, background: typeCfg(detailRecord.attribute_type).bg, border: `1px solid ${typeCfg(detailRecord.attribute_type).border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: 11, color: typeCfg(detailRecord.attribute_type).color }}>
                  {typeCfg(detailRecord.attribute_type).icon}
                </div>
              )}
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{detailRecord.attribute_code}</span>
              <TypePill value={detailRecord.attribute_type}/>
            </Space>
          )
        }
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={500}
        extra={
          <Space>
            <Button icon={<EditOutlined/>} size="small" onClick={() => { setDetailVisible(false); openEdit(detailRecord); }}>Edit</Button>
            <Popconfirm title="Delete this attribute?" description={`${detailRecord?.usage_count ?? 0} employee values will be removed.`}
              onConfirm={() => deleteMutation.mutate(detailRecord?.id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Button danger icon={<DeleteOutlined/>} size="small">Delete</Button>
            </Popconfirm>
          </Space>
        }
        destroyOnHidden
      >
        {detailRecord && (() => {
          const rec = detailRecord;
          const opts = rec.display_options?.options || [];
          return (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <StatusPill active={rec.is_active}/>
                <CategoryPill value={rec.category}/>
                {rec.is_required && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <LockOutlined style={{ fontSize: 9 }}/> Required
                  </span>
                )}
              </div>

              <Divider orientation="left" style={{ fontSize: 12 }}>Identity</Divider>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Code" span={2}><span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{rec.attribute_code}</span></Descriptions.Item>
                <Descriptions.Item label="Display Name" span={2}>{rec.attribute_name}</Descriptions.Item>
                <Descriptions.Item label="Group">{rec.group_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Sort Order">{rec.sort_order ?? 0}</Descriptions.Item>
              </Descriptions>

              <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Behaviour</Divider>
              <Row gutter={[10, 10]}>
                {[
                  { label: 'Required',       on: rec.is_required },
                  { label: 'Searchable',     on: rec.is_searchable },
                  { label: 'Visible in List',on: rec.is_visible_in_list },
                  { label: 'Active',         on: rec.is_active !== false },
                ].map(f => (
                  <Col span={12} key={f.label}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: f.on ? '#f0fdf4' : '#f9fafb', border: `1px solid ${f.on ? '#bbf7d0' : '#e5e7eb'}` }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.on ? '#16a34a' : '#9ca3af', flexShrink: 0 }}/>
                      <span style={{ fontSize: 12, color: f.on ? '#15803d' : '#6b7280', fontWeight: 500 }}>{f.label}</span>
                    </div>
                  </Col>
                ))}
              </Row>

              <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Usage</Divider>
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>Personnel records with a value</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#2563eb' }}>{rec.usage_count ?? 0}</span>
                </div>
                <Progress percent={maxUsage > 0 ? Math.round(((rec.usage_count ?? 0) / maxUsage) * 100) : 0}
                  strokeColor="#2563eb" trailColor="#e5e7eb" showInfo={false} size="small"/>
              </div>

              {opts.length > 0 && (
                <>
                  <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Options ({opts.length})</Divider>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {opts.map(o => (
                      <span key={o} style={{ padding: '3px 10px', borderRadius: 8, background: '#ede9fe', border: '1px solid #ddd6fe', fontSize: 12, color: '#6d28d9', fontWeight: 500 }}>{o}</span>
                    ))}
                  </div>
                </>
              )}

              {rec.placeholder_text && (
                <>
                  <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Placeholder</Divider>
                  <div style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>"{rec.placeholder_text}"</div>
                </>
              )}

              {(rec.description || rec.notes) && (
                <>
                  <Divider orientation="left" style={{ fontSize: 12, marginTop: 14 }}>Notes</Divider>
                  {rec.description && <div style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>{rec.description}</div>}
                  {rec.notes && <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{rec.notes}</div>}
                </>
              )}

              <div style={{ marginTop: 16, fontSize: 11, color: '#d1d5db' }}>
                Created {rec.created_at ? dayjs(rec.created_at).format('DD MMM YYYY') : '—'}
                {rec.updated_at && ` · Updated ${dayjs(rec.updated_at).format('DD MMM YYYY')}`}
              </div>
            </>
          );
        })()}
      </Drawer>

      <style>{`
        .ant-table-thead > tr > th { background:#f8fafc !important; color:#64748b !important; font-size:11px !important; font-weight:700 !important; text-transform:uppercase !important; letter-spacing:0.05em !important; border-bottom:2px solid #e2e8f0 !important; }
        .ant-table-tbody > tr > td  { border-bottom:1px solid #f1f5f9 !important; padding:10px 12px !important; }
        .ant-table-tbody > tr:last-child > td { border-bottom:none !important; }
        .row-inactive > td { background:rgba(100,116,139,0.04) !important; opacity:0.75; }
        .row-inactive:hover > td { background:rgba(100,116,139,0.08) !important; opacity:1; }
        .row-inactive > td:first-child { border-left:3px solid #cbd5e1 !important; }
        .ant-table-expanded-row > td { padding:0 !important; }
      `}</style>
      </Card>
    </div>
  );
};

export default CustomAttributes;
