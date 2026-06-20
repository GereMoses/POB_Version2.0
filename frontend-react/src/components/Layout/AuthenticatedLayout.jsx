import React, { useState, useEffect } from 'react';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Badge,
  Space,
  Button,
  Typography,
  Tooltip,
  message,
  Modal,
  Form,
  Input
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyOutlined,
  TeamOutlined,
  FileTextOutlined,
  BarChartOutlined,
  BuildOutlined,
  CalendarOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const AuthenticatedLayout = () => {
  const { user, logout, hasPermission, canAccessModule } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileForm] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();

  // Load notifications
  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await axios.get('/api/v1/notifications/unread');
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleLogout = async () => {
    Modal.confirm({
      title: 'Confirm Logout',
      content: 'Are you sure you want to logout?',
      okText: 'Yes',
      cancelText: 'No',
      onOk: async () => {
        await logout();
        navigate('/enhanced-login');
      }
    });
  };

  const handleProfileUpdate = async (values) => {
    try {
      await authService.updateProfile(values);
      setProfileModalVisible(false);
      profileForm.resetFields();
    } catch (error) {
      console.error('Profile update failed:', error);
    }
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Dashboard</Link>,
      permission: null
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: <Link to="/reports">Reports</Link>,
      permission: 'reports.view'
    },
    {
      key: 'personnel',
      icon: <TeamOutlined />,
      label: <Link to="/personnel">Personnel</Link>,
      permission: 'personnel.view'
    },
    {
      key: 'attendance',
      icon: <ClockCircleOutlined />,
      label: <Link to="/attendance">Attendance</Link>,
      permission: 'attendance.view'
    },
    {
      key: 'mustering',
      icon: <SafetyOutlined />,
      label: <Link to="/mustering">Mustering</Link>,
      permission: 'mustering.view'
    },
    {
      key: 'emergency',
      icon: <SafetyOutlined />,
      label: <Link to="/emergency">Emergency</Link>,
      permission: 'emergency.view'
    },
    {
      key: 'custom-builder',
      icon: <BuildOutlined />,
      label: <Link to="/reports/custom">Custom Builder</Link>,
      permission: 'reports.export'
    }
  ];

  // Filter menu items based on permissions
  const filteredMenuItems = menuItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => {
        profileForm.setFieldsValue({
          full_name: user?.full_name || '',
          email: user?.email || '',
          phone: user?.phone || ''
        });
        setProfileModalVisible(true);
      }
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings">Settings</Link>
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout
    }
  ];

  const getSelectedKey = () => {
    const pathname = location.pathname;
    
    if (pathname.startsWith('/reports')) return 'reports';
    if (pathname.startsWith('/personnel')) return 'personnel';
    if (pathname.startsWith('/attendance')) return 'attendance';
    if (pathname.startsWith('/mustering')) return 'mustering';
    if (pathname.startsWith('/emergency')) return 'emergency';
    if (pathname.startsWith('/dashboard')) return 'dashboard';
    
    return 'dashboard';
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUserRoleColor = (role) => {
    const roleColors = {
      admin: '#f50',
      hr: '#2db7f5',
      operations: '#52c41a',
      safety: '#faad14',
      viewer: '#108ee9'
    };
    return roleColors[role] || '#1890ff';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          background: '#001529',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.15)'
        }}
        width={250}
      >
        {/* Logo */}
        <div style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#002140',
          margin: '16px 0'
        }}>
          <div style={{
            color: '#fff',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            POB
          </div>
        </div>

        {/* Navigation Menu */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          style={{ background: '#001529', border: 'none' }}
          items={filteredMenuItems}
        />
      </Sider>

      <Layout>
        {/* Header */}
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ marginRight: '16px' }}
            />
            
            <Text strong style={{ fontSize: '16px', color: '#262626' }}>
              {user?.full_name || 'Apex POB'}
            </Text>
            
            {user?.roles && (
              <Space>
                {user.roles.map((role, index) => (
                  <Badge
                    key={index}
                    count={null}
                    style={{
                      backgroundColor: getUserRoleColor(role),
                      marginLeft: '8px'
                    }}
                  >
                    <Text style={{ 
                      color: '#fff', 
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      fontWeight: '500'
                    }}>
                      {role}
                    </Text>
                  </Badge>
                ))}
              </Space>
            )}
          </div>

          <Space size="middle">
            {/* Notifications */}
            <Tooltip title="Notifications">
              <Badge count={notifications.length} size="small">
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  style={{ border: 'none' }}
                  onClick={() => navigate('/notifications')}
                />
              </Badge>
            </Tooltip>

            {/* User Dropdown */}
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: ({ key }) => {
                  if (key === 'logout') {
                    handleLogout();
                  }
                }
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  size="small"
                  style={{
                    backgroundColor: '#1890ff',
                    color: '#fff'
                  }}
                >
                  {getUserInitials(user?.full_name)}
                </Avatar>
                <Text style={{ marginLeft: '8px' }}>
                  {user?.full_name || 'User'}
                </Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Main Content */}
        <Content
          style={{
            margin: '24px 16px',
            padding: '24px',
            background: '#f0f2f5',
            borderRadius: '8px',
            minHeight: 'calc(100vh - 112px)'
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      {/* Profile Modal */}
      <Modal
        title="Edit Profile"
        open={profileModalVisible}
        onCancel={() => setProfileModalVisible(false)}
        onOk={() => profileForm.submit()}
        width={500}
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleProfileUpdate}
        >
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter your full name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone"
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default AuthenticatedLayout;
