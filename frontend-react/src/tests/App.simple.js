import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ConfigProvider, Button, Card, Typography } from 'antd';

const { Title, Paragraph } = Typography;

// Simple pages for testing
const HomePage = () => (
  <Card style={{ margin: '20px' }}>
    <Title level={2}>POB Management System - Hot Reload Active!</Title>
    <Paragraph>Welcome to the Personnel On Board Management System</Paragraph>
    <Button type="primary" onClick={() => alert('Hello World!')}>
      Test Button
    </Button>
  </Card>
);

const LoginPage = () => (
  <Card style={{ margin: '20px', maxWidth: '400px' }}>
    <Title level={3}>Login</Title>
    <Paragraph>Simple login page for testing</Paragraph>
    <Button type="primary" block>
      Login
    </Button>
  </Card>
);

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

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <Router>
          <Routes>
            <Route path="/" element={isAuthenticated ? <HomePage /> : <LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<HomePage />} />
          </Routes>
        </Router>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
