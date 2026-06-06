import React, { useState, useMemo } from 'react';
import {
  Tabs, Card, Table, Button, Space, Tag, App, Form, Modal, Drawer,
  Input, Select, Switch, Row, Col, Divider, Badge, Alert,
  Checkbox, Popconfirm, Typography, Statistic, Tooltip, Empty, Spin, Progress,
} from 'antd';
import {
  UserOutlined, TeamOutlined, LockOutlined, AuditOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined,
  SafetyOutlined, BankOutlined, ReloadOutlined, CheckOutlined,
  CloseOutlined, SettingOutlined, ClockCircleOutlined,
  DatabaseOutlined, CloudServerOutlined, DownloadOutlined,
  CheckCircleOutlined, WarningOutlined, SyncOutlined,
  ApiOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;
const { Password } = Input;

// ── Permission module ordering / labels ──────────────────────────────────────
const MODULE_ORDER = [
  'personnel','attendance','devices','access_control',
  'visitors','reports','pob','emergency','mustering','settings',
];
const MODULE_LABEL = {
  personnel: 'Personnel', attendance: 'Attendance', devices: 'Devices',
  access_control: 'Access Control', visitors: 'Visitors', reports: 'Reports',
  pob: 'POB Status', emergency: 'Emergency', mustering: 'Mustering', settings: 'Settings',
};

// ════════════════════════════════════════════════════════════════════════════
// USERS TAB
// ════════════════════════════════════════════════════════════════════════════
const UsersTab = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editUser, setEditUser]     = useState(null);
  const [pwOpen, setPwOpen]         = useState(false);
  const [pwUser, setPwUser]         = useState(null);
  const [rolesOpen, setRolesOpen]   = useState(false);
  const [rolesUser, setRolesUser]   = useState(null);
  const [form]   = Form.useForm();
  const [pwForm] = Form.useForm();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings-users', search],
    queryFn: () => {
      const p = new URLSearchParams({ page: 1, page_size: 100 });
      if (search) p.append('search', search);
      return apiService.get(`/api/v1/settings/users?${p}`);
    },
  });
  const users = data?.data || [];
  const total = data?.total || 0;

  const { data: rolesData } = useQuery({
    queryKey: ['settings-roles-list'],
    queryFn: () => apiService.get('/api/v1/settings/roles'),
  });
  const allRoles = rolesData || [];

  const createM = useMutation({
    mutationFn: (body) => apiService.post('/api/v1/settings/users', body),
    onSuccess: () => {
      message.success('User created');
      qc.invalidateQueries(['settings-users']);
      setDrawerOpen(false);
      form.resetFields();
    },
    onError: (e) => message.error(e?.message ||'Failed to create user'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }) => apiService.put(`/api/v1/settings/users/${id}`, body),
    onSuccess: () => {
      message.success('User updated');
      qc.invalidateQueries(['settings-users']);
      setDrawerOpen(false);
    },
    onError: (e) => message.error(e?.message ||'Failed to update user'),
  });
  const deleteM = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/settings/users/${id}`),
    onSuccess: () => { message.success('User deleted'); qc.invalidateQueries(['settings-users']); },
    onError: (e) => message.error(e?.message ||'Cannot delete user'),
  });
  const pwM = useMutation({
    mutationFn: ({ id, body }) => apiService.put(`/api/v1/settings/users/${id}/password`, body),
    onSuccess: () => { message.success('Password changed'); setPwOpen(false); pwForm.resetFields(); },
    onError: (e) => message.error(e?.message ||'Failed to change password'),
  });
  const rolesM = useMutation({
    mutationFn: ({ id, role_ids }) => apiService.put(`/api/v1/settings/users/${id}/roles`, { role_ids }),
    onSuccess: () => { message.success('Roles updated'); qc.invalidateQueries(['settings-users']); setRolesOpen(false); },
    onError: (e) => message.error(e?.message ||'Failed to update roles'),
  });

  const openCreate = () => { setEditUser(null); form.resetFields(); setDrawerOpen(true); };
  const openEdit   = (u) => { setEditUser(u); form.setFieldsValue({ ...u }); setDrawerOpen(true); };
  const openPw     = (u) => { setPwUser(u); pwForm.resetFields(); setPwOpen(true); };
  const openRoles  = (u) => { setRolesUser(u); setRolesOpen(true); };
  const onSave     = (vals) => editUser ? updateM.mutate({ id: editUser.id, body: vals }) : createM.mutate(vals);

  const cols = [
    {
      title: 'User', key: 'user',
      render: (_, r) => (
        <Space>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1890ff22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserOutlined style={{ color: '#1890ff' }} />
          </div>
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>
              {r.first_name || r.last_name ? `${r.first_name || ''} ${r.last_name || ''}`.trim() : r.username}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>@{r.username}</Text>
          </Space>
        </Space>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email', render: v => v || '—' },
    {
      title: 'Roles', key: 'roles',
      render: (_, r) => (
        <Space wrap size={4}>
          {r.is_superuser && <Tag color="red"><SafetyOutlined /> Superuser</Tag>}
          {(r.roles || []).map(rl => <Tag key={rl.id} color="blue">{rl.name}</Tag>)}
          {!r.is_superuser && !r.roles?.length && <Text type="secondary" style={{ fontSize: 11 }}>No roles</Text>}
        </Space>
      ),
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'status', width: 90,
      render: v => <Badge status={v ? 'success' : 'default'} text={v ? 'Active' : 'Inactive'} />,
    },
    {
      title: 'Last Login', dataIndex: 'last_login', key: 'last_login', width: 150,
      render: v => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—',
    },
    {
      title: 'Actions', key: 'act', fixed: 'right', width: 160,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Roles"><Button size="small" icon={<TeamOutlined />} onClick={() => openRoles(r)} /></Tooltip>
          <Tooltip title="Password"><Button size="small" icon={<KeyOutlined />} onClick={() => openPw(r)} /></Tooltip>
          <Popconfirm title="Delete this user?" onConfirm={() => deleteM.mutate(r.id)} okText="Delete" okType="danger">
            <Tooltip title="Delete"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Users',  value: total,                                                              color: '#1890ff', icon: <UserOutlined /> },
          { title: 'Active',       value: users.filter(u => u.is_active).length,                             color: '#52c41a', icon: <CheckOutlined /> },
          { title: 'Superusers',   value: users.filter(u => u.is_superuser).length,                         color: '#f5222d', icon: <SafetyOutlined /> },
          { title: 'Without Role', value: users.filter(u => !u.roles?.length && !u.is_superuser).length,    color: '#fa8c16', icon: <TeamOutlined /> },
        ].map(s => (
          <Col xs={12} sm={6} key={s.title}>
            <Card styles={{ body: { padding: '14px 18px' } }} style={{ borderTop: `3px solid ${s.color}` }}>
              <Statistic title={s.title} value={s.value} prefix={s.icon} valueStyle={{ color: s.color, fontSize: 24 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card styles={{ body: { padding: '12px 16px' } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col flex={1}>
            <Search placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)}
              onSearch={setSearch} allowClear style={{ maxWidth: 320 }} />
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Refresh</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New User</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={cols} dataSource={users} loading={isLoading} rowKey="id" size="middle"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }} />
      </Card>

      {/* Create / Edit Drawer */}
      <Drawer
        title={<Space>{editUser ? <EditOutlined /> : <PlusOutlined />}{editUser ? `Edit User — ${editUser.username}` : 'New User'}</Space>}
        open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditUser(null); form.resetFields(); }} width={460} destroyOnHidden>
        <Form
          key={editUser ? `edit-${editUser.id}` : 'create'}
          form={form}
          layout="vertical"
          onFinish={onSave}
          initialValues={{ is_active: true, is_superuser: false }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="first_name" label="First Name"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_name" label="Last Name"><Input /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="username" label="Username" rules={[{ required: !editUser, message: 'Required' }]}>
            <Input prefix={<UserOutlined />} disabled={!!editUser} />
          </Form.Item>
          {!editUser && (
            <Form.Item name="password" label="Password"
              rules={[{ required: true, message: 'Required' }, { min: 6, message: 'Minimum 6 characters' }]}>
              <Password prefix={<LockOutlined />} />
            </Form.Item>
          )}
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
            <Input />
          </Form.Item>
          {!editUser && (
            <Form.Item name="role_ids" label="Roles">
              <Select
                mode="multiple"
                placeholder="Assign roles (optional)"
                optionFilterProp="label"
                options={(allRoles || []).map(r => ({ value: r.id, label: r.name }))}
                allowClear
              />
            </Form.Item>
          )}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_superuser" label="Superuser" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
          <Divider />
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setDrawerOpen(false); setEditUser(null); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createM.isPending || updateM.isPending}>
              {editUser ? 'Save Changes' : 'Create User'}
            </Button>
          </Space>
        </Form>
      </Drawer>

      {/* Change Password Modal */}
      <Modal
        title={<Space><KeyOutlined />Change Password — {pwUser?.username}</Space>}
        open={pwOpen} onCancel={() => setPwOpen(false)} footer={null} destroyOnHidden>
        <Form form={pwForm} layout="vertical"
          onFinish={v => pwM.mutate({ id: pwUser.id, body: { new_password: v.new_password } })}>
          <Form.Item name="new_password" label="New Password"
            rules={[{ required: true, message: 'Required' }, { min: 6, message: 'Minimum 6 characters' }]}>
            <Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item name="confirm" label="Confirm Password"
            dependencies={['new_password']}
            rules={[{ required: true }, ({ getFieldValue }) => ({
              validator(_, v) {
                if (!v || getFieldValue('new_password') === v) return Promise.resolve();
                return Promise.reject(new Error('Passwords do not match'));
              },
            })]}>
            <Password prefix={<LockOutlined />} />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={pwM.isPending}>Change Password</Button>
          </Space>
        </Form>
      </Modal>

      {/* Assign Roles Modal */}
      <Modal
        title={<Space><TeamOutlined />Assign Roles — {rolesUser?.username}</Space>}
        open={rolesOpen} onCancel={() => setRolesOpen(false)} footer={null} destroyOnHidden>
        {rolesUser && (
          <RolesSelector
            allRoles={allRoles}
            currentRoles={(rolesUser.roles || []).map(r => r.id)}
            onSave={(role_ids) => rolesM.mutate({ id: rolesUser.id, role_ids })}
            onCancel={() => setRolesOpen(false)}
            loading={rolesM.isPending}
          />
        )}
      </Modal>
    </div>
  );
};

const RolesSelector = ({ allRoles, currentRoles, onSave, onCancel, loading }) => {
  const [selected, setSelected] = useState(currentRoles);
  return (
    <div>
      <Checkbox.Group value={selected} onChange={setSelected} style={{ width: '100%' }}>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          {allRoles.map(r => (
            <Checkbox key={r.id} value={r.id}>
              <Space>
                <Text strong>{r.name}</Text>
                {r.description && <Text type="secondary" style={{ fontSize: 12 }}>— {r.description}</Text>}
              </Space>
            </Checkbox>
          ))}
        </Space>
      </Checkbox.Group>
      <Divider style={{ margin: '12px 0' }} />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={() => onSave(selected)} loading={loading}>Save Roles</Button>
      </Space>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════════
// ROLES & PERMISSIONS TAB
// ════════════════════════════════════════════════════════════════════════════
const RolesTab = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editRole, setEditRole]         = useState(null);
  const [form] = Form.useForm();

  const { data: rolesData, isLoading: rolesLoading, refetch } = useQuery({
    queryKey: ['settings-roles'],
    queryFn: () => apiService.get('/api/v1/settings/roles'),
  });
  const roles = Array.isArray(rolesData) ? rolesData : [];

  const { data: permsData, isLoading: permsLoading } = useQuery({
    queryKey: ['settings-permissions'],
    queryFn: () => apiService.get('/api/v1/settings/permissions'),
  });
  const allPerms = Array.isArray(permsData) ? permsData : [];

  const { data: roleDetailData } = useQuery({
    queryKey: ['settings-role-detail', selectedRole],
    queryFn: () => apiService.get(`/api/v1/settings/roles/${selectedRole}`),
    enabled: !!selectedRole,
  });
  const roleDetail = roleDetailData;

  const createM = useMutation({
    mutationFn: (body) => apiService.post('/api/v1/settings/roles', body),
    onSuccess: () => {
      message.success('Role created');
      qc.invalidateQueries(['settings-roles']);
      setDrawerOpen(false);
      form.resetFields();
    },
    onError: (e) => {
      const msg = e?.message || 'Failed to create role';
      if (msg.toLowerCase().includes('already exists')) {
        form.setFields([{ name: 'name', errors: [msg] }]);
      } else {
        message.error(msg);
      }
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }) => apiService.put(`/api/v1/settings/roles/${id}`, body),
    onSuccess: () => {
      message.success('Role updated');
      qc.invalidateQueries(['settings-roles']);
      qc.invalidateQueries(['settings-role-detail']);
      setDrawerOpen(false);
    },
    onError: (e) => {
      const msg = e?.message || 'Failed to update role';
      if (msg.toLowerCase().includes('already exists')) {
        form.setFields([{ name: 'name', errors: [msg] }]);
      } else {
        message.error(msg);
      }
    },
  });
  const deleteM = useMutation({
    mutationFn: (id) => apiService.delete(`/api/v1/settings/roles/${id}`),
    onSuccess: () => {
      message.success('Role deleted');
      qc.invalidateQueries(['settings-roles']);
      setSelectedRole(null);
    },
    onError: (e) => message.error(e?.message ||'Cannot delete role'),
  });
  const permsM = useMutation({
    mutationFn: ({ id, permission_ids }) =>
      apiService.put(`/api/v1/settings/roles/${id}/permissions`, { permission_ids }),
    onSuccess: () => {
      qc.invalidateQueries(['settings-role-detail', selectedRole]);
      qc.invalidateQueries(['settings-roles']);
    },
    onError: (e) => message.error(e?.message ||'Failed to save permissions'),
  });

  const openCreate = () => { setEditRole(null); form.resetFields(); setDrawerOpen(true); };
  const openEdit   = (r) => { setEditRole(r); form.setFieldsValue(r); setDrawerOpen(true); };

  const onSave = (v) => {
    // Client-side duplicate check before hitting the server
    const trimmed = v.name?.trim() ?? '';
    const conflict = roles.find(r =>
      r.name.toLowerCase() === trimmed.toLowerCase() &&
      r.id !== editRole?.id
    );
    if (conflict) {
      form.setFields([{ name: 'name', errors: [`A role named "${conflict.name}" already exists`] }]);
      return;
    }
    editRole ? updateM.mutate({ id: editRole.id, body: v }) : createM.mutate(v);
  };

  const permsByModule = useMemo(() => {
    const map = {};
    allPerms.forEach(p => {
      if (!map[p.module]) map[p.module] = [];
      map[p.module].push(p);
    });
    return map;
  }, [allPerms]);

  const rolePermIds = useMemo(() => new Set((roleDetail?.permissions || []).map(p => p.id)), [roleDetail]);

  const togglePerm = (permId) => {
    if (!selectedRole) return;
    const newSet = new Set(rolePermIds);
    if (newSet.has(permId)) newSet.delete(permId); else newSet.add(permId);
    permsM.mutate({ id: selectedRole, permission_ids: Array.from(newSet) });
  };

  const toggleModule = (module) => {
    if (!selectedRole) return;
    const modulePerms = (permsByModule[module] || []).map(p => p.id);
    const allChecked  = modulePerms.every(id => rolePermIds.has(id));
    const newSet      = new Set(rolePermIds);
    if (allChecked) modulePerms.forEach(id => newSet.delete(id));
    else            modulePerms.forEach(id => newSet.add(id));
    permsM.mutate({ id: selectedRole, permission_ids: Array.from(newSet) });
  };

  const roleCols = [
    {
      title: 'Role', key: 'role',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: selectedRole === r.id ? '#1890ff' : undefined }}>{r.name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.description || '—'}</Text>
        </Space>
      ),
    },
    { title: 'Users', dataIndex: 'user_count',      key: 'users', width: 60,  render: v => <Tag>{v}</Tag> },
    { title: 'Perms', dataIndex: 'permission_count', key: 'perms', width: 60,  render: v => <Tag color="blue">{v}</Tag> },
    {
      title: '', key: 'act', width: 90,
      render: (_, r) => (
        <Space size={4} onClick={e => e.stopPropagation()}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title={`Delete "${r.name}"?`} onConfirm={() => deleteM.mutate(r.id)} okType="danger" okText="Delete">
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} disabled={r.user_count > 0} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <style>{`.role-row-selected td { background: #e6f4ff !important; } .role-row-hover { cursor: pointer; }`}</style>
      <Row gutter={16}>
        {/* Left: role list — click any row to manage its permissions */}
        <Col xs={24} lg={8}>
          <Card
            title={<Space><TeamOutlined />Roles ({roles.length})</Space>}
            extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>New</Button>}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              columns={roleCols}
              dataSource={roles}
              loading={rolesLoading}
              rowKey="id"
              size="small"
              pagination={false}
              rowClassName={r => `role-row-hover${r.id === selectedRole ? ' role-row-selected' : ''}`}
              onRow={r => ({ onClick: () => setSelectedRole(r.id) })}
            />
          </Card>
        </Col>

        {/* Right: permission matrix */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <LockOutlined />
                {selectedRole && roleDetail
                  ? `Permissions — ${roleDetail.name}`
                  : selectedRole
                  ? 'Loading permissions…'
                  : 'Select a role to manage its permissions'}
              </Space>
            }
            styles={{ body: { padding: '16px 20px' } }}
          >
            {!selectedRole ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span>
                    Click any row in the role list on the left<br />to view and edit its permissions
                  </span>
                }
              />
            ) : permsLoading ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#8c8c8c' }}>Loading permissions…</div>
            ) : allPerms.length === 0 ? (
              <Empty description="No permissions found. Check the backend." />
            ) : (
              MODULE_ORDER.map(module => {
                const perms = permsByModule[module];
                if (!perms || perms.length === 0) return null;
                const allChecked  = perms.every(p => rolePermIds.has(p.id));
                const someChecked = perms.some(p => rolePermIds.has(p.id));
                return (
                  <div key={module} style={{ marginBottom: 16 }}>
                    <Checkbox
                      checked={allChecked}
                      indeterminate={someChecked && !allChecked}
                      onChange={() => toggleModule(module)}
                      style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'block' }}
                    >
                      {MODULE_LABEL[module] || module}
                    </Checkbox>
                    <Row gutter={[8, 4]} style={{ paddingLeft: 24 }}>
                      {perms.map(p => (
                        <Col xs={24} sm={12} md={8} key={p.id}>
                          <Checkbox checked={rolePermIds.has(p.id)} onChange={() => togglePerm(p.id)}>
                            <Tooltip title={p.description}>
                              <span style={{ fontSize: 12 }}>{p.name}</span>
                            </Tooltip>
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                    <Divider style={{ margin: '10px 0' }} />
                  </div>
                );
              })
            )}
          </Card>
        </Col>
      </Row>

      <Drawer title={editRole ? `Edit Role — ${editRole.name}` : 'New Role'} open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditRole(null); form.resetFields(); }} width={400} destroyOnHidden>
        <Form
          key={editRole ? `edit-${editRole.id}` : 'create'}
          form={form}
          layout="vertical"
          onFinish={onSave}
          initialValues={{ is_active: true }}
        >
          <Form.Item name="name" label="Role Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Site Manager" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Brief description of this role's responsibilities" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
          <Divider />
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setDrawerOpen(false); setEditRole(null); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createM.isPending || updateM.isPending}>
              {editRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </Space>
        </Form>
      </Drawer>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════════
// COMPANY TAB
// ════════════════════════════════════════════════════════════════════════════
const CompanyTab = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings-company'],
    queryFn: () => apiService.get('/api/v1/settings/company'),
  });
  const company = data || {};

  React.useEffect(() => {
    if (company.id) form.setFieldsValue(company);
  }, [company.id]);

  const updateM = useMutation({
    mutationFn: (body) => apiService.put('/api/v1/settings/company', body),
    onSuccess: () => {
      message.success('Company settings saved');
      qc.invalidateQueries(['settings-company']);
      setEditing(false);
    },
    onError: (e) => message.error(e?.message ||'Failed to save'),
  });

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <Card
        title={<Space><BankOutlined />Company Information</Space>}
        extra={
          editing
            ? <Space>
                <Button icon={<CloseOutlined />} onClick={() => { setEditing(false); form.setFieldsValue(company); }}>Cancel</Button>
                <Button type="primary" icon={<CheckOutlined />} loading={updateM.isPending} onClick={() => form.submit()}>Save</Button>
              </Space>
            : <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit</Button>
        }
        loading={isLoading}
      >
        <Form form={form} layout="vertical" onFinish={v => updateM.mutate(v)}>
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Company Name" rules={[{ required: true }]}>
                <Input disabled={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="short_name" label="Short Name">
                <Input disabled={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="industry" label="Industry">
                <Input disabled={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="country" label="Country">
                <Input disabled={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="city" label="City">
                <Input disabled={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="state" label="State / Province">
                <Input disabled={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="phone" label="Phone">
                <Input disabled={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} disabled={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email">
                <Input disabled={!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="website" label="Website">
                <Input disabled={!editing} />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left" style={{ fontSize: 13 }}>System Preferences</Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="timezone" label="Timezone">
                <Select disabled={!editing} showSearch>
                  {['Africa/Lagos','UTC','Africa/Nairobi','Europe/London','America/New_York','Asia/Dubai'].map(tz => (
                    <Option key={tz} value={tz}>{tz}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="date_format" label="Date Format">
                <Select disabled={!editing}>
                  <Option value="DD/MM/YYYY">DD/MM/YYYY</Option>
                  <Option value="MM/DD/YYYY">MM/DD/YYYY</Option>
                  <Option value="YYYY-MM-DD">YYYY-MM-DD</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="time_format" label="Time Format">
                <Select disabled={!editing}>
                  <Option value="24h">24-hour</Option>
                  <Option value="12h">12-hour</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════════
// AUDIT LOG TAB
// ════════════════════════════════════════════════════════════════════════════
const AuditLogTab = () => {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const pageSize = 50;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings-audit', search, page],
    queryFn: () => {
      const p = new URLSearchParams({ page, page_size: pageSize });
      if (search) p.append('search', search);
      return apiService.get(`/api/v1/settings/audit-log?${p}`);
    },
  });
  const rows  = data?.data  || [];
  const total = data?.total || 0;

  const ACTION_COLOR = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'cyan', LOGOUT: 'default' };

  const cols = [
    {
      title: 'Time', dataIndex: 'created_at', key: 'time', width: 160,
      render: v => v ? dayjs(v).format('DD MMM YYYY HH:mm:ss') : '—',
    },
    {
      title: 'User', key: 'user', width: 140,
      render: (_, r) => r.username
        ? <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 12 }}>
              {r.first_name || r.last_name ? `${r.first_name||''} ${r.last_name||''}`.trim() : r.username}
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>@{r.username}</Text>
          </Space>
        : '—',
    },
    {
      title: 'Action', dataIndex: 'action', key: 'action', width: 90,
      render: v => <Tag color={ACTION_COLOR[v?.toUpperCase()] || 'default'}>{v}</Tag>,
    },
    { title: 'Table',      dataIndex: 'table_name', key: 'table', width: 140, render: v => v || '—' },
    { title: 'Record ID',  dataIndex: 'record_id',  key: 'rec',   width: 90 },
    { title: 'IP Address', dataIndex: 'ip_address', key: 'ip',    width: 120, render: v => v || '—' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card styles={{ body: { padding: '12px 16px' } }} style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col flex={1}>
            <Search placeholder="Search by user, action, table…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              onSearch={v => { setSearch(v); setPage(1); }} allowClear style={{ maxWidth: 360 }} />
          </Col>
          <Col><Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Refresh</Button></Col>
        </Row>
      </Card>
      <Card styles={{ body: { padding: 0 } }}>
        <Table columns={cols} dataSource={rows} loading={isLoading} rowKey="id" size="small"
          scroll={{ x: 900 }}
          pagination={{ current: page, pageSize, total, onChange: setPage, showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }} />
      </Card>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS PAGE
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// SECURITY TAB
// ════════════════════════════════════════════════════════════════════════════

const TIMEOUT_PRESETS = [
  { label: '30 minutes',  value: 30 },
  { label: '1 hour',      value: 60 },
  { label: '4 hours',     value: 240 },
  { label: '8 hours',     value: 480 },
  { label: '12 hours',    value: 720 },
  { label: '24 hours',    value: 1440 },
  { label: '7 days',      value: 10080 },
  { label: '30 days',     value: 43200 },
  { label: 'Never (monitoring / 24-7 dashboards)', value: 0 },
];

const SecurityTab = () => {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [customMode, setCustomMode] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['settings-security'],
    queryFn: () => apiService.get('/api/v1/settings/security'),
  });

  React.useEffect(() => {
    if (data) {
      const mins = data?.session_timeout_minutes ?? 480;
      const isPreset = TIMEOUT_PRESETS.some(p => p.value === mins);
      setCustomMode(!isPreset);
      form.setFieldsValue({ timeout_preset: isPreset ? mins : '__custom__', timeout_custom: isPreset ? undefined : mins });
    }
  }, [data]);

  const saveM = useMutation({
    mutationFn: (mins) => apiService.put('/api/v1/settings/security', { session_timeout_minutes: mins }),
    onSuccess: (_, mins) => {
      const label = mins === 0 ? 'Never' : mins >= 1440
        ? `${Math.round(mins / 1440)} day(s)`
        : mins >= 60 ? `${Math.round(mins / 60)} hour(s)` : `${mins} minute(s)`;
      message.success(`Session timeout set to: ${label}. Users must log in again for the new timeout to take effect.`);
      qc.invalidateQueries(['settings-security']);
    },
    onError: (e) => message.error(e?.message || 'Failed to save'),
  });

  const submit = () => form.validateFields().then((v) => {
    const mins = v.timeout_preset === '__custom__' ? Number(v.timeout_custom) : Number(v.timeout_preset);
    saveM.mutate(mins);
  }).catch(() => {});

  const currentMins = data?.session_timeout_minutes ?? 480;
  const currentLabel = currentMins === 0
    ? 'Never expires'
    : currentMins >= 43200 ? `${Math.round(currentMins / 1440)} days`
    : currentMins >= 1440 ? `${Math.round(currentMins / 1440)} day(s)`
    : currentMins >= 60 ? `${Math.round(currentMins / 60)} hour(s)`
    : `${currentMins} minutes`;

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <Card
        styles={{ body: { padding: '12px 16px' } }}
        style={{ marginBottom: 16 }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <ClockCircleOutlined style={{ color: '#722ed1', fontSize: 16 }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>Session Timeout</span>
              <Tag color={currentMins === 0 ? 'green' : 'blue'} style={{ marginLeft: 8 }}>
                Current: {currentLabel}
              </Tag>
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} size="small" onClick={() => qc.invalidateQueries(['settings-security'])} loading={isLoading}>
              Reload
            </Button>
          </Col>
        </Row>
      </Card>

      <Card styles={{ body: { padding: '20px 24px' } }}>
        <Divider orientation="left" style={{ marginTop: 0 }}>
          <Space><ClockCircleOutlined />Configure Session Timeout</Space>
        </Divider>

        <div style={{ background: '#f6f8fa', border: '1px solid #e8ecf0', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#555' }}>
          This setting controls how long a user stays logged in before the system requires them to log in again.
          Set to <strong>Never</strong> for 24/7 monitoring stations or dashboards that must stay active indefinitely.
          Changes apply to the <em>next login</em> — existing sessions are not affected.
        </div>

        <Form form={form} layout="vertical">
          <Form.Item name="timeout_preset" label="Session Timeout Duration">
            <Select
              size="middle"
              style={{ width: 380 }}
              onChange={(v) => setCustomMode(v === '__custom__')}
              placeholder="Select a timeout duration"
            >
              {TIMEOUT_PRESETS.map(p => (
                <Option key={p.value} value={p.value}>{p.label}</Option>
              ))}
              <Option value="__custom__">Custom (enter minutes)</Option>
            </Select>
          </Form.Item>

          {customMode && (
            <Form.Item
              name="timeout_custom"
              label="Custom Timeout (minutes)"
              rules={[{ required: true, message: 'Enter number of minutes' }, { type: 'number', min: 1, max: 525960, message: 'Must be between 1 and 525960' }]}
            >
              <Input type="number" min={1} max={525960} style={{ width: 200 }} addonAfter="min" placeholder="e.g. 360 for 6 hours" />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" onClick={submit} loading={saveM.isPending} icon={<CheckOutlined />}>
              Save Timeout Setting
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════════
// BACKUP TAB
// ════════════════════════════════════════════════════════════════════════════
const BackupTab = () => {
  const { message: msg } = App.useApp();
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState(false);

  const token = localStorage.getItem('token') || localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}` };

  const { data: statusRaw, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['backup-status'],
    queryFn:  () => apiService.get('/api/v1/backup/status'),
    refetchInterval: 30_000,
  });

  const { data: listRaw, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: ['backup-list'],
    queryFn:  () => apiService.get('/api/v1/backup/list'),
    refetchInterval: 60_000,
  });

  const status  = statusRaw  || {};
  const backups = listRaw?.backups || [];

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await fetch('/api/v1/backup/trigger', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Backup failed');
      msg.success(`Backup completed: ${data.filename} (${data.size})`);
      queryClient.invalidateQueries(['backup-list']);
      queryClient.invalidateQueries(['backup-status']);
    } catch (e) {
      msg.error(e.message);
    } finally {
      setTriggering(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      const res = await fetch(`/api/v1/backup/download/${encodeURIComponent(filename)}`, { headers });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      msg.error(e.message);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (filename) =>
      fetch(`/api/v1/backup/${encodeURIComponent(filename)}`, { method: 'DELETE', headers })
        .then(r => r.json()),
    onSuccess: () => {
      msg.success('Backup deleted');
      queryClient.invalidateQueries(['backup-list']);
      queryClient.invalidateQueries(['backup-status']);
    },
    onError: (e) => msg.error(e.message),
  });

  const TYPE_COLOR = { manual: 'blue', daily: 'green', weekly: 'orange', monthly: 'purple' };

  const cols = [
    {
      title: 'Filename', dataIndex: 'filename', key: 'filename',
      render: (v, r) => (
        <Space>
          <DatabaseOutlined style={{ color: '#6B7A8D' }} />
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>
          <Tag color={TYPE_COLOR[r.type] || 'default'} style={{ fontSize: 10 }}>{r.type}</Tag>
        </Space>
      ),
    },
    {
      title: 'Size', dataIndex: 'size_human', key: 'size', width: 90,
      render: v => <Text strong>{v}</Text>,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created', width: 170,
      render: v => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD MMM YYYY HH:mm')}</Text>,
      sorter: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Actions', key: 'actions', width: 130, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="Download">
            <Button
              size="small" icon={<DownloadOutlined />} type="link"
              onClick={() => handleDownload(r.filename)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this backup?"
            description="This cannot be undone."
            onConfirm={() => deleteMutation.mutate(r.filename)}
            okText="Delete" okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button size="small" icon={<DeleteOutlined />} type="link" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* ── Status cards ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="NAS / Storage"
              value={status.nas_connected ? 'Connected' : 'Not connected'}
              prefix={status.nas_connected
                ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                : <WarningOutlined    style={{ color: '#faad14' }} />}
              valueStyle={{ color: status.nas_connected ? '#52c41a' : '#faad14', fontSize: 16 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>{status.backup_directory}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Total Backups"
              value={status.total_backups || 0}
              prefix={<DatabaseOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>{status.total_size || '0 B'} used</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Last Backup"
              value={status.last_backup ? dayjs(status.last_backup.created_at).fromNow() : 'Never'}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ fontSize: 14 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {status.last_backup ? dayjs(status.last_backup.created_at).format('DD MMM YYYY HH:mm') : '—'}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Schedule"
              value="Daily 02:00 UTC"
              prefix={<SyncOutlined />}
              valueStyle={{ fontSize: 14 }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {status.daily_count || 0} daily · {status.manual_count || 0} manual
            </Text>
          </Card>
        </Col>
      </Row>

      {/* ── NAS warning ── */}
      {!status.nas_connected && !statusLoading && (
        <Alert
          type="warning"
          showIcon
          icon={<CloudServerOutlined />}
          message="NAS storage not connected"
          description="Backups are stored on the local server disk. Connect a NAS drive and set BACKUP_DIR in .env.prod to point to the NAS mount path for off-server backup storage."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── Actions row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Text strong>Backup Files</Text>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            {backups.length} files · {listRaw?.total_size || '0 B'} total
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { refetchStatus(); refetchList(); }}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={triggering ? <SyncOutlined spin /> : <DatabaseOutlined />}
            loading={triggering}
            onClick={handleTrigger}
          >
            Backup Now
          </Button>
        </Space>
      </div>

      {/* ── Backup table ── */}
      <Table
        columns={cols}
        dataSource={backups.map((b, i) => ({ ...b, key: i }))}
        loading={listLoading}
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: t => `${t} backups` }}
        scroll={{ x: 700 }}
        locale={{ emptyText: <Empty description="No backups yet — click 'Backup Now' to create the first one" /> }}
      />

      {/* ── NAS setup guide ── */}
      <Divider />
      <Card size="small" title={<Space><CloudServerOutlined />NAS Configuration Guide</Space>} style={{ background: '#FAFAFA' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          To store backups on a NAS drive, mount it on the host server and set the path in your environment file:
        </Text>
        <pre style={{ background: '#1F2937', color: '#E5E7EB', padding: '12px 16px', borderRadius: 8, fontSize: 12, overflow: 'auto' }}>
{`# 1. Mount your NAS on the host server (run on the server, not in Docker):
#    NFS:
sudo mount -t nfs 192.168.1.100:/nas/pob-backups /mnt/nas-backups

#    SMB/CIFS (Windows NAS / Synology):
sudo mount -t cifs //192.168.1.100/pob-backups /mnt/nas-backups \\
  -o username=nasuser,password=naspass,uid=1000

# 2. Make it permanent — add to /etc/fstab:
192.168.1.100:/nas/pob-backups  /mnt/nas-backups  nfs  defaults,_netdev  0 0

# 3. Set the backup path in .env.prod:
BACKUP_DIR=/mnt/nas-backups

# 4. In docker-compose.prod.yml, change the db-backup volume to a bind mount:
#    volumes:
#      - \${BACKUP_DIR:-/backups}:/backups

# 5. Restart the backup container:
docker compose -f docker-compose.prod.yml up -d --no-deps db-backup`}
        </pre>
      </Card>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════════
// HR INTEGRATION TAB — SeamlessHR connector
// ════════════════════════════════════════════════════════════════════════════
const HRIntegrationTab = () => {
  const { message: msg } = App.useApp();
  const queryClient = useQueryClient();
  const [syncing,     setSyncing]     = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [previewDate, setPreviewDate] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [apiKeyEditing, setApiKeyEditing] = useState(false);

  const [form] = Form.useForm();

  const token   = localStorage.getItem('token') || localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const { data: cfgRaw, isLoading: cfgLoading, refetch: refetchCfg } = useQuery({
    queryKey: ['hr-config'],
    queryFn:  () => apiService.get('/api/v1/hr-integration/config'),
  });

  const { data: statusRaw, refetch: refetchStatus } = useQuery({
    queryKey: ['hr-status'],
    queryFn:  () => apiService.get('/api/v1/hr-integration/sync/status'),
    refetchInterval: 60_000,
  });

  const { data: histRaw, isLoading: histLoading, refetch: refetchHist } = useQuery({
    queryKey: ['hr-history'],
    queryFn:  () => apiService.get('/api/v1/hr-integration/sync/history?limit=30'),
    refetchInterval: 60_000,
  });

  // Populate form when config loads
  React.useEffect(() => {
    if (cfgRaw) {
      form.setFieldsValue({
        api_base_url:        cfgRaw.api_base_url        || 'https://api.seamlesshr.com',
        api_key:             cfgRaw.configured ? cfgRaw.api_key_masked : '',
        org_id:              cfgRaw.org_id              || '',
        auth_header_name:    cfgRaw.auth_header_name    || 'Authorization',
        attendance_endpoint: cfgRaw.attendance_endpoint || '/v1/attendance/clock-records',
        employee_endpoint:   cfgRaw.employee_endpoint   || '/v1/employees',
        is_enabled:          cfgRaw.is_enabled           || false,
        sync_time:           cfgRaw.sync_time            || '00:00',
      });
    }
  }, [cfgRaw, form]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/hr-integration/config', {
        method: 'PUT', headers,
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Save failed');
      msg.success('Configuration saved');
      setApiKeyEditing(false);
      queryClient.invalidateQueries(['hr-config']);
      queryClient.invalidateQueries(['hr-status']);
    } catch (e) { msg.error(e.message); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res  = await fetch('/api/v1/hr-integration/test-connection', { method: 'POST', headers });
      const data = await res.json();
      if (data.success) msg.success(`✓ ${data.message}`);
      else              msg.error(`✗ ${data.message}`);
    } catch (e) { msg.error(e.message); }
    finally { setTesting(false); }
  };

  const handleSync = async (syncDate) => {
    setSyncing(true);
    try {
      const res  = await fetch('/api/v1/hr-integration/sync', {
        method: 'POST', headers,
        body: JSON.stringify({ sync_date: syncDate || null }),
      });
      const data = await res.json();
      const level = data.status === 'success' ? 'success' : data.status === 'partial' ? 'warning' : 'error';
      msg[level](`${data.message}`);
      queryClient.invalidateQueries(['hr-history']);
      queryClient.invalidateQueries(['hr-status']);
    } catch (e) { msg.error(e.message); }
    finally { setSyncing(false); }
  };

  const handlePreview = async () => {
    if (!previewDate) return;
    try {
      const res  = await fetch(`/api/v1/hr-integration/preview/${previewDate}`, { headers });
      const data = await res.json();
      setPreviewData(data);
    } catch (e) { msg.error(e.message); }
  };

  const status  = statusRaw  || {};
  const history = histRaw?.history || [];

  const STATUS_COLOR = { success: 'success', partial: 'warning', failed: 'error', skipped: 'default' };
  const STATUS_TAG   = { success: 'green', partial: 'orange', failed: 'red', skipped: 'default' };

  const histCols = [
    { title: 'Date', dataIndex: 'sync_date', key: 'date', width: 110,
      render: v => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: s => <Tag color={STATUS_TAG[s] || 'default'}>{(s || '').toUpperCase()}</Tag> },
    { title: 'Sent', dataIndex: 'records_sent', key: 'sent', width: 70,
      render: v => <Text strong style={{ color: '#52c41a' }}>{v}</Text> },
    { title: 'Failed', dataIndex: 'records_failed', key: 'failed', width: 70,
      render: v => <Text strong style={{ color: v > 0 ? '#f5222d' : '#9CA3AF' }}>{v}</Text> },
    { title: 'Triggered by', dataIndex: 'triggered_by', key: 'by', width: 120,
      render: v => <Text style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Message', dataIndex: 'message', key: 'msg',
      render: v => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Time', dataIndex: 'created_at', key: 'time', width: 145,
      render: v => <Text style={{ fontSize: 11 }}>{v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—'}</Text> },
  ];

  const previewCols = [
    { title: 'Employee ID',   dataIndex: 'employee_id',   key: 'emp', width: 120 },
    { title: 'Date',          dataIndex: 'date',           key: 'date', width: 110 },
    { title: 'Clock In',      dataIndex: 'clock_in',       key: 'in',  width: 90 },
    { title: 'Clock Out',     dataIndex: 'clock_out',      key: 'out', width: 90, render: v => v || '—' },
    { title: 'Total (mins)',  dataIndex: 'total_minutes',  key: 'mins', width: 110, render: v => v ?? '—' },
  ];

  return (
    <div style={{ padding: 24 }}>

      {/* ── Connection status banner ── */}
      {status.configured && (
        <Alert
          type={status.enabled ? 'success' : 'warning'}
          showIcon
          message={
            status.enabled
              ? `SeamlessHR sync is active — runs daily at ${status.sync_time} UTC`
              : 'SeamlessHR integration is configured but disabled — enable it below'
          }
          description={status.last_sync
            ? `Last sync: ${status.last_sync.status?.toUpperCase()} · ${status.last_sync.records_sent} records sent · ${dayjs(status.last_sync.created_at).fromNow()}`
            : 'No syncs have run yet'}
          style={{ marginBottom: 20 }}
          action={
            <Button size="small" loading={syncing} onClick={() => handleSync(null)}>
              Sync Yesterday
            </Button>
          }
        />
      )}

      {!status.configured && (
        <Alert
          type="info" showIcon
          message="Configure your SeamlessHR API credentials below to enable attendance sync"
          description="Once configured, attendance records will be pushed to SeamlessHR automatically every night so HR can process payroll."
          style={{ marginBottom: 20 }}
        />
      )}

      <Row gutter={[16, 16]}>

        {/* ── Config form ── */}
        <Col xs={24} lg={14}>
          <Card
            title={<Space><ApiOutlined />SeamlessHR API Settings</Space>}
            extra={
              <Space>
                <Button size="small" loading={testing} onClick={handleTest}
                  disabled={!cfgRaw?.configured}>
                  Test Connection
                </Button>
              </Space>
            }
          >
            <Form form={form} layout="vertical" onFinish={handleSave}>

              <Form.Item label="API Base URL" name="api_base_url"
                rules={[{ required: true, message: 'Enter the SeamlessHR API base URL' }]}
                extra="Obtain from SeamlessHR — typically https://api.seamlesshr.com">
                <Input placeholder="https://api.seamlesshr.com" />
              </Form.Item>

              <Form.Item
                label={
                  <Space>
                    API Key
                    {cfgRaw?.configured && !apiKeyEditing && (
                      <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }}
                        onClick={() => { setApiKeyEditing(true); form.setFieldValue('api_key', ''); }}>
                        Change
                      </Button>
                    )}
                  </Space>
                }
                name="api_key"
                rules={[{ required: !cfgRaw?.configured || apiKeyEditing, message: 'Enter your SeamlessHR API key' }]}
                extra="Provided by SeamlessHR when they set up your API access">
                <Input.Password
                  placeholder={cfgRaw?.configured && !apiKeyEditing ? cfgRaw.api_key_masked : 'Enter API key'}
                  disabled={cfgRaw?.configured && !apiKeyEditing}
                />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Organisation ID" name="org_id"
                    extra="Your company ID in SeamlessHR (if required)">
                    <Input placeholder="e.g. marconi-nigeria" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Auth Header" name="auth_header_name"
                    extra="Usually 'Authorization' (Bearer token)">
                    <Input placeholder="Authorization" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={14}>
                  <Form.Item label="Attendance Endpoint" name="attendance_endpoint"
                    extra="Path to POST attendance records">
                    <Input placeholder="/v1/attendance/clock-records" />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item label="Daily Sync Time (UTC)" name="sync_time"
                    extra="Time to run the nightly sync">
                    <Input placeholder="00:00" maxLength={5} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="is_enabled" valuePropName="checked">
                <Switch checkedChildren="Sync Enabled" unCheckedChildren="Sync Disabled" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" htmlType="submit" loading={saving}>
                    Save Configuration
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* ── Right panel: manual sync + preview ── */}
        <Col xs={24} lg={10}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>

            <Card title="Manual Sync" size="small">
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                Manually push attendance records for a specific date to SeamlessHR.
              </Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  type="date"
                  value={previewDate}
                  onChange={e => setPreviewDate(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary" loading={syncing}
                  onClick={() => handleSync(previewDate || null)}
                  disabled={!status.configured}
                >
                  Sync
                </Button>
              </Space.Compact>
              <Button
                block style={{ marginTop: 8 }} size="small"
                onClick={() => handleSync(null)} loading={syncing}
                disabled={!status.configured}
              >
                Sync Yesterday (default)
              </Button>
            </Card>

            <Card title="Preview Records" size="small">
              <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                See exactly which records would be sent for a date before syncing.
              </Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input type="date" value={previewDate} onChange={e => setPreviewDate(e.target.value)} />
                <Button onClick={handlePreview} disabled={!previewDate}>Preview</Button>
              </Space.Compact>
              {previewData && (
                <div style={{ marginTop: 12 }}>
                  <Text strong style={{ fontSize: 12 }}>{previewData.total} records for {previewData.sync_date}</Text>
                  {previewData.truncated && <Text type="secondary" style={{ fontSize: 11 }}> (showing first 100)</Text>}
                  <Table
                    columns={previewCols} size="small"
                    dataSource={previewData.records.map((r, i) => ({ ...r, key: i }))}
                    pagination={{ pageSize: 5, size: 'small' }}
                    style={{ marginTop: 8 }}
                  />
                </div>
              )}
            </Card>

          </Space>
        </Col>
      </Row>

      {/* ── Sync History ── */}
      <Card
        title={<Space><SyncOutlined />Sync History</Space>}
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => { refetchHist(); refetchStatus(); }}>Refresh</Button>}
        style={{ marginTop: 16 }}
      >
        <Table
          columns={histCols}
          dataSource={history.map((h, i) => ({ ...h, key: i }))}
          loading={histLoading}
          size="small"
          pagination={{ pageSize: 10, showTotal: t => `${t} sync runs` }}
          scroll={{ x: 800 }}
          locale={{ emptyText: <Empty description="No sync history yet" /> }}
        />
      </Card>

      {/* ── Data format note ── */}
      <Card size="small" style={{ marginTop: 16, background: '#F9FAFB' }}
        title="Data sent to SeamlessHR (per employee per day)">
        <pre style={{ background: '#1F2937', color: '#E5E7EB', padding: '12px 16px', borderRadius: 8, fontSize: 12, margin: 0 }}>
{`{
  "records": [
    {
      "employee_id":   "EMP001",      // same as emp_code in POB
      "date":          "2026-06-06",
      "clock_in":      "08:02:14",    // first biometric check-in of the day
      "clock_out":     "17:45:00",    // last biometric check-out of the day
      "total_minutes": 583,
      "source":        "POB_BIOMETRIC"
    }
  ]
}`}
        </pre>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          Update the Attendance Endpoint above once SeamlessHR shares their API documentation.
        </Text>
      </Card>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════════════════
// BUSINESS CENTRAL INTEGRATION TAB
// ════════════════════════════════════════════════════════════════════════════
const BCIntegrationTab = () => {
  const { message: msg } = App.useApp();
  const queryClient = useQueryClient();
  const [syncing,        setSyncing]        = useState(false);
  const [testing,        setTesting]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [companies,      setCompanies]      = useState([]);
  const [secretEditing,  setSecretEditing]  = useState(false);
  const [previewDate,    setPreviewDate]    = useState('');
  const [previewData,    setPreviewData]    = useState(null);
  const [form] = Form.useForm();

  const token   = localStorage.getItem('token') || localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const { data: cfgRaw,    isLoading: cfgLoading, refetch: refetchCfg }    = useQuery({ queryKey: ['bc-config'],  queryFn: () => apiService.get('/api/v1/bc-integration/config') });
  const { data: statusRaw, refetch: refetchStatus } = useQuery({ queryKey: ['bc-status'], queryFn: () => apiService.get('/api/v1/bc-integration/sync/status'), refetchInterval: 60_000 });
  const { data: histRaw,   isLoading: histLoading,  refetch: refetchHist }  = useQuery({ queryKey: ['bc-history'], queryFn: () => apiService.get('/api/v1/bc-integration/sync/history?limit=30'), refetchInterval: 60_000 });

  React.useEffect(() => {
    if (cfgRaw) {
      form.setFieldsValue({
        tenant_id:     cfgRaw.tenant_id     || '',
        client_id:     cfgRaw.client_id     || '',
        client_secret: cfgRaw.configured    ? cfgRaw.client_secret_masked : '',
        environment:   cfgRaw.environment   || 'Production',
        company_id:    cfgRaw.company_id    || '',
        is_enabled:    cfgRaw.is_enabled    || false,
        sync_time:     cfgRaw.sync_time     || '01:00',
      });
    }
  }, [cfgRaw, form]);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res  = await fetch('/api/v1/bc-integration/test-connection', { method: 'POST', headers });
      const data = await res.json();
      if (data.success) {
        msg.success(`✓ ${data.message}`);
        if (data.companies?.length) setCompanies(data.companies);
      } else {
        msg.error(`✗ ${data.message}`);
      }
    } catch (e) { msg.error(e.message); }
    finally { setTesting(false); }
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = { ...values };
      if (cfgRaw?.configured && !secretEditing) payload.client_secret = cfgRaw.client_secret_masked;
      const selected = companies.find(c => c.id === values.company_id);
      if (selected) payload.company_name = selected.name;
      const res  = await fetch('/api/v1/bc-integration/config', { method: 'PUT', headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Save failed');
      msg.success('Configuration saved');
      setSecretEditing(false);
      queryClient.invalidateQueries(['bc-config']);
      queryClient.invalidateQueries(['bc-status']);
    } catch (e) { msg.error(e.message); }
    finally { setSaving(false); }
  };

  const handleSync = async (syncDate) => {
    setSyncing(true);
    try {
      const res  = await fetch('/api/v1/bc-integration/sync', { method: 'POST', headers, body: JSON.stringify({ sync_date: syncDate || null }) });
      const data = await res.json();
      const level = data.status === 'success' ? 'success' : data.status === 'partial' ? 'warning' : 'error';
      msg[level](data.message);
      queryClient.invalidateQueries(['bc-history']);
      queryClient.invalidateQueries(['bc-status']);
    } catch (e) { msg.error(e.message); }
    finally { setSyncing(false); }
  };

  const handlePreview = async () => {
    if (!previewDate) return;
    try {
      const res  = await fetch(`/api/v1/bc-integration/preview/${previewDate}`, { headers });
      const data = await res.json();
      setPreviewData(data);
    } catch (e) { msg.error(e.message); }
  };

  const status  = statusRaw  || {};
  const history = histRaw?.history || [];
  const STATUS_TAG = { success: 'green', partial: 'orange', failed: 'red', skipped: 'default' };

  const histCols = [
    { title: 'Date',    dataIndex: 'sync_date',       key: 'date',   width: 110, render: v => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Status',  dataIndex: 'status',          key: 'status', width: 90,  render: s => <Tag color={STATUS_TAG[s] || 'default'}>{(s||'').toUpperCase()}</Tag> },
    { title: 'Sent',    dataIndex: 'records_sent',    key: 'sent',   width: 70,  render: v => <Text strong style={{ color: '#52c41a' }}>{v}</Text> },
    { title: 'Failed',  dataIndex: 'records_failed',  key: 'fail',   width: 70,  render: v => <Text strong style={{ color: v > 0 ? '#f5222d' : '#9CA3AF' }}>{v}</Text> },
    { title: 'By',      dataIndex: 'triggered_by',    key: 'by',     width: 120, render: v => <Text style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Message', dataIndex: 'message',         key: 'msg',               render: v => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> },
    { title: 'Time',    dataIndex: 'created_at',      key: 'time',   width: 145, render: v => <Text style={{ fontSize: 11 }}>{v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—'}</Text> },
  ];

  const previewCols = [
    { title: 'Employee No.',  dataIndex: 'employee_number', key: 'emp',  width: 120 },
    { title: 'Date',          dataIndex: 'date',            key: 'date', width: 110 },
    { title: 'Clock In',      dataIndex: 'clock_in',        key: 'in',   width: 90  },
    { title: 'Clock Out',     dataIndex: 'clock_out',       key: 'out',  width: 90, render: v => v || '—' },
    { title: 'Hours',         dataIndex: 'hours',           key: 'hrs',  width: 80, render: v => v != null ? <Text strong>{v}</Text> : '—' },
  ];

  return (
    <div style={{ padding: 24 }}>

      {status.configured && (
        <Alert
          type={status.enabled ? 'success' : 'warning'}
          showIcon
          message={
            status.enabled
              ? `Business Central sync active — ${status.company_name || ''} (${status.environment}) · runs daily at ${status.sync_time} UTC`
              : 'Business Central integration configured but disabled'
          }
          description={status.last_sync
            ? `Last sync: ${status.last_sync.status?.toUpperCase()} · ${status.last_sync.records_sent} entries sent · ${dayjs(status.last_sync.created_at).fromNow()}`
            : 'No syncs have run yet'}
          style={{ marginBottom: 20 }}
          action={<Button size="small" loading={syncing} onClick={() => handleSync(null)}>Sync Yesterday</Button>}
        />
      )}
      {!status.configured && (
        <Alert type="info" showIcon
          message="Configure your Azure AD app credentials below to enable Business Central attendance sync"
          description="Attendance hours are posted as Time Registration Entries in BC so Finance/HR can run payroll."
          style={{ marginBottom: 20 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={<Space><ApiOutlined />Azure AD + Business Central Settings</Space>}
            extra={<Button size="small" loading={testing} onClick={handleTest} disabled={!cfgRaw?.configured}>Test Connection</Button>}
          >
            {/* Azure AD setup guide */}
            <Alert type="info" showIcon style={{ marginBottom: 16, fontSize: 12 }}
              message="Azure AD App Registration required"
              description={
                <span>
                  In the Azure Portal: <strong>App Registrations → New → API Permissions → Dynamics 365 BC → Financials.ReadWrite.All</strong>.
                  Copy the Tenant ID, Client ID, and create a Client Secret.
                </span>
              }
            />

            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Tenant ID (Directory ID)" name="tenant_id" rules={[{ required: true }]}
                    extra="From Azure Portal → Azure Active Directory → Overview">
                    <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Client ID (Application ID)" name="client_id" rules={[{ required: true }]}
                    extra="From App Registration → Overview">
                    <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={
                  <Space>Client Secret
                    {cfgRaw?.configured && !secretEditing && (
                      <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }}
                        onClick={() => { setSecretEditing(true); form.setFieldValue('client_secret', ''); }}>
                        Change
                      </Button>
                    )}
                  </Space>
                }
                name="client_secret"
                rules={[{ required: !cfgRaw?.configured || secretEditing }]}
                extra="From App Registration → Certificates & Secrets">
                <Input.Password
                  placeholder={cfgRaw?.configured && !secretEditing ? cfgRaw.client_secret_masked : 'Enter client secret'}
                  disabled={cfgRaw?.configured && !secretEditing}
                />
              </Form.Item>

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item label="Environment" name="environment" extra="Usually 'Production' or 'Sandbox'">
                    <Select options={[{ label: 'Production', value: 'Production' }, { label: 'Sandbox', value: 'Sandbox' }]} />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item label="Company" name="company_id" extra="Click Test Connection first to load companies">
                    <Select
                      placeholder="Test connection first to load companies"
                      options={[
                        ...(cfgRaw?.company_id ? [{ label: cfgRaw.company_name || cfgRaw.company_id, value: cfgRaw.company_id }] : []),
                        ...companies.filter(c => c.id !== cfgRaw?.company_id).map(c => ({ label: c.name, value: c.id })),
                      ]}
                      allowClear
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Sync Time (UTC)" name="sync_time" extra="Daily sync time">
                    <Input placeholder="01:00" maxLength={5} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="is_enabled" valuePropName="checked">
                <Switch checkedChildren="Sync Enabled" unCheckedChildren="Sync Disabled" />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={saving}>Save Configuration</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card title="Manual Sync" size="small">
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                Push time entries for a specific date to Business Central.
              </Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input type="date" value={previewDate} onChange={e => setPreviewDate(e.target.value)} style={{ flex: 1 }} />
                <Button type="primary" loading={syncing} onClick={() => handleSync(previewDate || null)} disabled={!status.configured}>Sync</Button>
              </Space.Compact>
              <Button block style={{ marginTop: 8 }} size="small" onClick={() => handleSync(null)} loading={syncing} disabled={!status.configured}>
                Sync Yesterday (default)
              </Button>
            </Card>

            <Card title="Preview Entries" size="small">
              <Space.Compact style={{ width: '100%' }}>
                <Input type="date" value={previewDate} onChange={e => setPreviewDate(e.target.value)} />
                <Button onClick={handlePreview} disabled={!previewDate}>Preview</Button>
              </Space.Compact>
              {previewData && (
                <div style={{ marginTop: 12 }}>
                  <Text strong style={{ fontSize: 12 }}>{previewData.total} entries for {previewData.sync_date}</Text>
                  <Table columns={previewCols} size="small"
                    dataSource={previewData.entries.map((r, i) => ({ ...r, key: i }))}
                    pagination={{ pageSize: 5, size: 'small' }} style={{ marginTop: 8 }} />
                </div>
              )}
            </Card>

            <Card size="small" title="Payload sent to Business Central" style={{ background: '#F9FAFB' }}>
              <pre style={{ background: '#1F2937', color: '#E5E7EB', padding: '10px 14px', borderRadius: 8, fontSize: 11, margin: 0 }}>
{`POST /companies({id})/timeRegistrationEntries

{
  "employeeNumber": "EMP001",
  "date":           "2026-06-06",
  "quantity":       8.72,   // hours worked
  "status":         "Open"
}`}
              </pre>
            </Card>
          </Space>
        </Col>
      </Row>

      <Card title={<Space><SyncOutlined />Sync History</Space>}
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => { refetchHist(); refetchStatus(); }}>Refresh</Button>}
        style={{ marginTop: 16 }}>
        <Table columns={histCols} dataSource={history.map((h, i) => ({ ...h, key: i }))}
          loading={histLoading} size="small"
          pagination={{ pageSize: 10, showTotal: t => `${t} sync runs` }}
          scroll={{ x: 800 }}
          locale={{ emptyText: <Empty description="No sync history yet" /> }} />
      </Card>
    </div>
  );
};


const Settings = () => {
  const [activeTab, setActiveTab] = useState('users');

  const tabItems = [
    { key: 'users',     label: <Space><UserOutlined />Users</Space>,               children: <UsersTab /> },
    { key: 'roles',     label: <Space><LockOutlined />Roles & Permissions</Space>, children: <RolesTab /> },
    { key: 'company',   label: <Space><BankOutlined />Company</Space>,             children: <CompanyTab /> },
    { key: 'security',  label: <Space><ClockCircleOutlined />Security</Space>,     children: <SecurityTab /> },
    { key: 'audit-log', label: <Space><AuditOutlined />Audit Log</Space>,          children: <AuditLogTab /> },
    { key: 'backup',         label: <Space><DatabaseOutlined />Database Backup</Space>,    children: <BackupTab /> },
    { key: 'hr-integration', label: <Space><ApiOutlined />HR Integration</Space>,          children: <HRIntegrationTab /> },
    { key: 'bc-integration', label: <Space><LinkOutlined />Business Central</Space>,       children: <BCIntegrationTab /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          <Space><SettingOutlined />System Settings</Space>
        </Title>
        <Text type="secondary">Manage users, roles, permissions and company configuration</Text>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          size="small"
          style={{ padding: '8px 8px 0' }}
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default Settings;
