import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import authService from '../../services/authService';

const ProtectedRoute = ({ children, requiredRoles, requiredPermissions, fallbackPath = '/login' }) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is authenticated
        if (!authService.isAuthenticated()) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        // Validate current session
        const sessionValid = await authService.validateSession();
        if (!sessionValid) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        // Check role requirements
        if (requiredRoles && requiredRoles.length > 0) {
          const hasRequiredRole = authService.hasAnyRole(requiredRoles);
          if (!hasRequiredRole) {
            setAccessDenied(true);
            setAuthorized(false);
            setLoading(false);
            return;
          }
        }

        // Check permission requirements
        if (requiredPermissions && requiredPermissions.length > 0) {
          const hasRequiredPermission = requiredPermissions.some(perm => 
            authService.hasPermission(perm)
          );
          if (!hasRequiredPermission) {
            setAccessDenied(true);
            setAuthorized(false);
            setLoading(false);
            return;
          }
        }

        // All checks passed
        setAuthorized(true);
        setAccessDenied(false);
        
      } catch (error) {
        console.error('Auth check error:', error);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [requiredRoles, requiredPermissions]);

  // Show loading spinner
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5'
      }}>
        <Spin
          size="large"
          indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
          tip="Authenticating..."
        />
      </div>
    );
  }

  // Show access denied
  if (accessDenied) {
    return (
      <Result
        status="403"
        title="Access Denied"
        subTitle="You don't have permission to access this page."
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            Go Back
          </Button>
        }
      />
    );
  }

  // Redirect to login if not authorized
  if (!authorized) {
    return (
      <Navigate 
        to={fallbackPath} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Render children if authorized
  return children;
};

export default ProtectedRoute;
