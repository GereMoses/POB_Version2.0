import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ConfigProvider, Button, Card, Typography, Layout as AntLayout, Menu } from 'antd';

const { Header, Content, Sider } = AntLayout;
const { Title, Paragraph } = Typography;

// Simple working components for testing
const Dashboard = () => (
  <Card style={{ margin: '20px' }}>
    <Title level={2}>Dashboard</Title>
    <Paragraph>Welcome to POB Management System</Paragraph>
    <Button type="primary">Test Dashboard</Button>
  </Card>
);

const Personnel = () => (
  <Card style={{ margin: '20px' }}>
    <Title level={2}>Personnel Management</Title>
    <Paragraph>Manage personnel records</Paragraph>
    <Button type="primary">Test Personnel</Button>
  </Card>
);

const MainLayout = ({ children }) => {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
        <Menu theme="dark" mode="inline" defaultSelectedKeys={['dashboard']}>
          <Menu.Item key="dashboard">
            Dashboard
          </Menu.Item>
          <Menu.Item key="personnel">
            Personnel
          </Menu.Item>
        </Menu>
      </Sider>
      <AntLayout>
        <Header style={{ background: '#fff', padding: 0 }}>
          <div style={{ color: '#000', fontSize: '16px', fontWeight: 'bold', padding: '0 24px' }}>
            POB Management System
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => {
  const isAuthenticated = true; // Simple auth check for testing

  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<div>Login Page</div>} />
            </Routes>
          </Router>
        </ConfigProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <Router>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/personnel" element={<Personnel />} />
            </Routes>
          </MainLayout>
        </Router>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
