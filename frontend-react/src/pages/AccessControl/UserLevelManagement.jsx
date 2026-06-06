import React, { useState, useMemo } from 'react';
import {
  Button, Input, Select, Tag, Popconfirm, App, Badge,
  Empty, Spin, Space, DatePicker, Tooltip, Divider,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, TeamOutlined, SafetyOutlined,
  UserOutlined, SearchOutlined, ReloadOutlined, CalendarOutlined,
  WarningOutlined, CheckOutlined, CloseOutlined, SaveOutlined,
  FilterOutlined, ApiOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';

const { Option } = Select;

// ── tokens ────────────────────────────────────────────────────────────────────
const C = {
  blue:'#1677ff', blueBg:'#e6f4ff',
  green:'#52c41a', greenBg:'#f6ffed',
  orange:'#fa8c16', orangeBg:'#fff7e6',
  red:'#ff4d4f', redBg:'#fff1f0',
  teal:'#13c2c2', tealBg:'#e6fffb',
  purple:'#722ed1',
  text:'#1d2939', sub:'#6b7280',
  border:'#e4e7ec', surface:'#f9fafb', white:'#ffffff',
};

const LEVEL_PALETTE = ['#1677ff','#52c41a','#722ed1','#fa8c16','#f5222d','#13c2c2','#2f54eb','#eb2f96'];

// ── Avatar initials ───────────────────────────────────────────────────────────
const Avatar = ({ name = '', size = 36, color = C.teal }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: `linear-gradient(135deg,${color},${color}99)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.38, color: 'white', fontWeight: 700,
  }}>
    {(name || '?')[0].toUpperCase()}
  </div>
);

// ── Level badge ───────────────────────────────────────────────────────────────
const LevelBadge = ({ name, color }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: `${color}15`, border: `1px solid ${color}40`,
    borderRadius: 6, padding: '3px 10px',
  }}>
    <SafetyOutlined style={{ color, fontSize: 11 }} />
    <span style={{ color, fontWeight: 600, fontSize: 12 }}>{name}</span>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const UserLevelManagement = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();

  const [selEmpCode, setSelEmpCode] = useState(null);
  const [search,     setSearch]     = useState('');
  const [deptFilter, setDeptFilter] = useState(null);
  const [assigning,  setAssigning]  = useState(false);   // show inline assign form
  const [asnLevel,   setAsnLevel]   = useState(null);
  const [asnFrom,    setAsnFrom]    = useState(null);
  const [asnTo,      setAsnTo]      = useState(null);

  // ── queries ────────────────────────────────────────────────────────────────
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['personnel-list'],
    queryFn: () => apiService.get('/api/v1/personnel/'),
  });
  const allEmps = empData?.data || empData?.results || [];

  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.get('/api/v1/departments/'),
  });
  const departments = deptData?.data || deptData?.results || [];

  const { data: levelsData } = useQuery({
    queryKey: ['acc-levels'],
    queryFn: () => apiService.get('/api/access-control/levels/'),
  });
  const levels = levelsData?.data || [];

  const { data: allAssignData } = useQuery({
    queryKey: ['acc-user-levels-all'],
    queryFn: () => apiService.get('/api/access-control/user-levels/'),
  });
  const allAssignments = allAssignData?.data || [];

  // per-employee assignments for the selected employee
  const { data: empAssignData, refetch: refetchEmpAssign, isFetching: assignFetching } = useQuery({
    queryKey: ['acc-user-levels-emp', selEmpCode],
    queryFn: () => apiService.get(`/api/access-control/user-levels/?emp_code=${selEmpCode}`),
    enabled: !!selEmpCode,
  });
  const empAssignments = empAssignData?.data || [];

  // ── derived ────────────────────────────────────────────────────────────────
  const levelColorMap = useMemo(() => {
    const m = {};
    levels.forEach((l, i) => { m[l.id] = LEVEL_PALETTE[i % LEVEL_PALETTE.length]; });
    return m;
  }, [levels]);

  // map emp_code → count of assignments
  const assignCountMap = useMemo(() => {
    const m = {};
    allAssignments.forEach(a => { m[a.emp_code] = (m[a.emp_code] || 0) + 1; });
    return m;
  }, [allAssignments]);

  // dept map
  const deptMap = useMemo(() => {
    const m = {};
    departments.forEach(d => { m[d.id] = d.dept_name || d.name; });
    return m;
  }, [departments]);

  const selEmp = allEmps.find(e => e.emp_code === selEmpCode) || null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allEmps.filter(e => {
      const matchSearch = !q ||
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        (e.emp_code || '').toLowerCase().includes(q);
      const matchDept = !deptFilter || e.dept_id === deptFilter;
      return matchSearch && matchDept;
    });
  }, [allEmps, search, deptFilter]);

  // group by department
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(e => {
      const dept = deptMap[e.dept_id] || 'Unassigned';
      if (!g[dept]) g[dept] = [];
      g[dept].push(e);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, deptMap]);

  const stats = useMemo(() => ({
    total:    allEmps.length,
    assigned: new Set(allAssignments.map(a => a.emp_code)).size,
    pending:  allAssignments.filter(a => a.is_expired).length,
  }), [allEmps, allAssignments]);

  // ── mutations ──────────────────────────────────────────────────────────────
  const assign = useMutation({
    mutationFn: () => apiService.post(`/api/access-control/levels/${asnLevel}/assign/`, {
      emp_codes: [selEmpCode],
      valid_from: asnFrom ? asnFrom.format('YYYY-MM-DD') : null,
      valid_to:   asnTo   ? asnTo.format('YYYY-MM-DD')   : null,
    }),
    onSuccess: () => {
      message.success('Level assigned');
      qc.invalidateQueries(['acc-user-levels-emp', selEmpCode]);
      qc.invalidateQueries(['acc-user-levels-all']);
      qc.invalidateQueries(['acc-levels']);
      setAssigning(false); setAsnLevel(null); setAsnFrom(null); setAsnTo(null);
    },
    onError: e => message.error(e?.message || 'Error assigning'),
  });

  const remove = useMutation({
    mutationFn: ({ level_id, auth_id }) =>
      apiService.delete(`/api/access-control/levels/${level_id}/users/${auth_id}`),
    onSuccess: () => {
      message.success('Removed');
      qc.invalidateQueries(['acc-user-levels-emp', selEmpCode]);
      qc.invalidateQueries(['acc-user-levels-all']);
      qc.invalidateQueries(['acc-levels']);
    },
    onError: e => message.error(e?.message || 'Error'),
  });

  // ── already-assigned level IDs for this employee ──────────────────────────
  const assignedLevelIds = new Set(empAssignments.map(a => a.level_id));
  const availableLevels  = levels.filter(l => !assignedLevelIds.has(l.id));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '100vh', background: C.surface }}>

      {/* ══ LEFT — Employee list ════════════════════════════════════════════ */}
      <div style={{
        width: 300, flexShrink: 0,
        background: C.white, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        height: '100vh', position: 'sticky', top: 0,
      }}>
        {/* header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 8 }}>
            <TeamOutlined style={{ marginRight: 6, color: C.teal }} />
            Personnel
          </div>
          <Input prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Search name or code…" value={search} allowClear size="small"
            onChange={e => setSearch(e.target.value)} style={{ borderRadius: 6, marginBottom: 6 }} />
          <Select placeholder="All departments" allowClear size="small" style={{ width: '100%', borderRadius: 6 }}
            value={deptFilter} onChange={setDeptFilter} suffixIcon={<FilterOutlined style={{ color: '#bfbfbf' }} />}>
            {departments.map(d => (
              <Option key={d.id} value={d.id}>{d.dept_name || d.name}</Option>
            ))}
          </Select>
        </div>

        {/* stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
          {[
            { label: 'Total',    value: stats.total,    color: C.teal   },
            { label: 'Has Level',value: stats.assigned, color: C.green  },
            { label: 'Expired',  value: stats.pending,  color: C.red    },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '8px 0', textAlign: 'center',
              borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.sub }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* employee list grouped by dept */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {empLoading && <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>}
          {!empLoading && filtered.length === 0 &&
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No employees found" style={{ marginTop: 32 }} />}

          {grouped.map(([dept, emps]) => (
            <div key={dept}>
              {/* Department header */}
              <div style={{
                padding: '6px 14px', fontSize: 10, fontWeight: 700,
                color: C.sub, textTransform: 'uppercase', letterSpacing: '0.8px',
                background: C.surface, borderBottom: `1px solid ${C.border}`,
                borderTop: `1px solid ${C.border}`,
                position: 'sticky', top: 0, zIndex: 1,
              }}>
                {dept} · {emps.length}
              </div>

              {emps.map(emp => {
                const sel  = emp.emp_code === selEmpCode;
                const cnt  = assignCountMap[emp.emp_code] || 0;
                const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.emp_code;
                return (
                  <div key={emp.emp_code}
                    onClick={() => { setSelEmpCode(emp.emp_code); setAssigning(false); }}
                    style={{
                      padding: '9px 14px', cursor: 'pointer',
                      borderLeft: sel ? `3px solid ${C.teal}` : '3px solid transparent',
                      background: sel ? '#e6fffb' : 'transparent',
                      borderBottom: `1px solid ${C.border}`,
                      transition: 'background 0.1s',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    <Avatar name={name} size={32} color={sel ? C.teal : '#8c8c8c'} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: sel ? 700 : 500, fontSize: 13,
                        color: sel ? C.teal : C.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 11, color: C.sub }}>{emp.emp_code}</div>
                    </div>
                    {cnt > 0
                      ? <Badge count={cnt} style={{ background: C.teal }} />
                      : <Badge count={0} showZero style={{ background: '#d9d9d9' }} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ══ RIGHT — Employee Detail ═════════════════════════════════════════ */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>

        {/* placeholder */}
        {!selEmp && (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, color: C.sub, padding: 48,
          }}>
            <TeamOutlined style={{ fontSize: 56, color: '#d9d9d9' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#bfbfbf' }}>Select an employee</div>
            <div style={{ fontSize: 13 }}>Choose from the list to view and manage their access levels</div>
          </div>
        )}

        {selEmp && (() => {
          const name = `${selEmp.first_name || ''} ${selEmp.last_name || ''}`.trim() || selEmp.emp_code;
          const dept = deptMap[selEmp.dept_id] || '—';

          return (
            <>
              {/* ── Employee header ──────────────────────────────────── */}
              <div style={{
                background: 'linear-gradient(135deg,#002329 0%,#003d47 60%,#007f88 100%)',
                padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <Avatar name={name} size={56} color={C.teal} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>
                      {selEmp.emp_code} · {dept}
                      {selEmp.designation && ` · ${selEmp.designation}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Tooltip title="Refresh">
                      <Button icon={<ReloadOutlined />} loading={assignFetching}
                        onClick={() => refetchEmpAssign()}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 7 }} />
                    </Tooltip>
                    <Button
                      type="primary" icon={<PlusOutlined />}
                      onClick={() => setAssigning(v => !v)}
                      style={{ borderRadius: 7, background: assigning ? 'rgba(255,255,255,0.2)' : C.teal, border: 'none' }}
                    >
                      {assigning ? 'Cancel' : 'Assign Level'}
                    </Button>
                  </div>
                </div>

                {/* Summary chips */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SafetyOutlined style={{ color: C.teal, fontSize: 16 }} />
                    <div>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: 18, lineHeight: 1 }}>{empAssignments.length}</div>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Access Levels</div>
                    </div>
                  </div>
                  {empAssignments.filter(a => a.is_expired).length > 0 && (
                    <div style={{ background: 'rgba(255,77,79,0.15)', borderRadius: 8, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <WarningOutlined style={{ color: '#ff7875', fontSize: 16 }} />
                      <div>
                        <div style={{ color: '#ff7875', fontWeight: 700, fontSize: 18, lineHeight: 1 }}>
                          {empAssignments.filter(a => a.is_expired).length}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>Expired</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Inline assign form ────────────────────────────────── */}
              {assigning && (
                <div style={{
                  background: C.tealBg, borderBottom: `1px solid #87e8de`,
                  padding: '16px 24px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#006d75', marginBottom: 12 }}>
                    <PlusOutlined style={{ marginRight: 6 }} />
                    Assign New Access Level to {name}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '2 1 220px' }}>
                      <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Access Level *</div>
                      <Select
                        placeholder="Select access level…" size="large"
                        style={{ width: '100%' }} value={asnLevel} onChange={setAsnLevel}
                        showSearch optionFilterProp="label"
                      >
                        {availableLevels.map(l => (
                          <Option key={l.id} value={l.id} label={l.level_name || l.name}>
                            <Space>
                              <SafetyOutlined style={{ color: levelColorMap[l.id] }} />
                              {l.level_name || l.name}
                              <span style={{ fontSize: 11, color: C.sub }}>
                                {l.door_count || 0} doors
                              </span>
                            </Space>
                          </Option>
                        ))}
                      </Select>
                      {availableLevels.length === 0 && (
                        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                          All access levels are already assigned to this employee.
                        </div>
                      )}
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Valid From</div>
                      <DatePicker value={asnFrom} onChange={setAsnFrom}
                        placeholder="Immediate" size="large" style={{ width: '100%' }} format="DD MMM YYYY" />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Valid Until</div>
                      <DatePicker value={asnTo} onChange={setAsnTo}
                        placeholder="No expiry" size="large" style={{ width: '100%' }} format="DD MMM YYYY"
                        disabledDate={d => asnFrom && d.isBefore(asnFrom, 'day')} />
                    </div>
                    <Button type="primary" size="large" icon={<SaveOutlined />}
                      loading={assign.isPending}
                      disabled={!asnLevel}
                      onClick={() => assign.mutate()}
                      style={{ borderRadius: 8, background: C.teal, border: 'none', flexShrink: 0 }}>
                      Assign
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Level cards ───────────────────────────────────────── */}
              <div style={{ padding: '20px 24px' }}>
                {assignFetching && !empAssignments.length
                  ? <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
                  : empAssignments.length === 0
                    ? (
                      <Empty
                        description={
                          <span style={{ color: C.sub }}>
                            No access levels assigned to <strong>{name}</strong> yet.<br />
                            Click <strong>Assign Level</strong> above to grant access.
                          </span>
                        }
                      />
                    )
                    : (
                      <div>
                        <div style={{ fontSize: 12, color: C.sub, marginBottom: 12, fontWeight: 500 }}>
                          {empAssignments.length} access level{empAssignments.length !== 1 ? 's' : ''} assigned
                        </div>
                        {empAssignments.map(a => {
                          const color    = levelColorMap[a.level_id] || C.blue;
                          const expired  = a.is_expired;
                          const lvl      = levels.find(l => l.id === a.level_id);

                          return (
                            <div key={a.id} style={{
                              background: expired ? '#fff8f6' : C.white,
                              border: `1px solid ${expired ? '#ffd8bf' : C.border}`,
                              borderLeft: `4px solid ${expired ? C.red : color}`,
                              borderRadius: 10, padding: '14px 16px', marginBottom: 10,
                              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                  {/* Level name */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <div style={{
                                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                      background: `${color}18`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      <SafetyOutlined style={{ color, fontSize: 16 }} />
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: 14, color: expired ? C.red : C.text }}>
                                        {a.level_name}
                                        {expired && (
                                          <Tag color="error" icon={<WarningOutlined />} style={{ marginLeft: 8, fontSize: 11 }}>Expired</Tag>
                                        )}
                                        {lvl?.mustering_only && (
                                          <Tag color="warning" style={{ marginLeft: 6, fontSize: 11 }}>Muster Only</Tag>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Meta row */}
                                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    {lvl && (
                                      <span style={{ fontSize: 12, color: C.sub }}>
                                        <ApiOutlined style={{ marginRight: 4, color: C.blue }} />
                                        {lvl.door_count || 0} door{lvl.door_count !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                    <span style={{ fontSize: 12, color: a.valid_from ? C.text : C.sub }}>
                                      <CalendarOutlined style={{ marginRight: 4 }} />
                                      From: {a.valid_from ? dayjs(a.valid_from).format('DD MMM YYYY') : 'Immediate'}
                                    </span>
                                    <span style={{ fontSize: 12, color: expired ? C.red : a.valid_to ? C.text : C.sub }}>
                                      <CalendarOutlined style={{ marginRight: 4 }} />
                                      Until: {a.valid_to ? dayjs(a.valid_to).format('DD MMM YYYY') : 'No expiry'}
                                    </span>
                                  </div>
                                </div>

                                <Popconfirm
                                  title={`Remove ${a.level_name} from ${name}?`}
                                  okType="danger" okText="Remove"
                                  onConfirm={() => remove.mutate({ level_id: a.level_id, auth_id: a.id })}
                                >
                                  <Button size="small" type="text" danger icon={<DeleteOutlined />}
                                    style={{ borderRadius: 6 }} />
                                </Popconfirm>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default UserLevelManagement;
