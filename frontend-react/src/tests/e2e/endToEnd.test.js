/**
 * End-to-End Tests
 * Tests complete user workflows and system integration
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import App from '../../App';

// Mock WebSocket
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
  })),
}));

// Mock API service
jest.mock('../../services/api', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    setAuthToken: jest.fn(),
    getAuthToken: jest.fn(),
    removeAuthToken: jest.fn(),
    getHeaders: jest.fn(),
  },
}));

const mockApiService = require('../../services/api').default;

// Test wrapper
const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('End-to-End Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Authentication Flow', () => {
    test('Complete login flow', async () => {
      // Mock login API response
      mockApiService.post.mockResolvedValue({
        access_token: 'test-token',
        refresh_token: 'refresh-token',
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'admin',
        },
      });

      // Mock dashboard data
      mockApiService.get.mockResolvedValue({
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should redirect to login page
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Fill login form
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'password');
      await userEvent.click(loginButton);

      // Should redirect to dashboard after successful login
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Verify token is stored
      expect(mockApiService.setAuthToken).toHaveBeenCalledWith('test-token');
    });

    test('Handles login failure', async () => {
      // Mock login error
      mockApiService.post.mockRejectedValue(new Error('Invalid credentials'));

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /login/i });

      await userEvent.type(usernameInput, 'wronguser');
      await userEvent.type(passwordInput, 'wrongpassword');
      await userEvent.click(loginButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Navigation', () => {
    test('Navigate through main sections', async () => {
      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock API responses
      mockApiService.get.mockImplementation((url) => {
        if (url.includes('/pob-status/dashboard')) {
          return Promise.resolve({
            data: {
              total_personnel: 100,
              offshore_count: 30,
              onshore_count: 70,
              transit_count: 0,
              by_location: {},
              recent_events: [],
              active_transports: [],
            },
          });
        } else if (url.includes('/personnel')) {
          return Promise.resolve({
            results: [
              {
                id: 1,
                badge_id: 'EMP001',
                full_name: 'John Doe',
                email: 'john.doe@example.com',
                company: 'Test Company',
                department: 'IT',
                role: 'Developer',
                status: 'active',
              },
            ],
          });
        } else if (url.includes('/devices')) {
          return Promise.resolve([
            {
              id: 1,
              sn: 'TEST001',
              alias: 'Test Device',
              state: 1,
              last_activity: '2024-01-15T08:00:00Z',
            },
          ]);
        }
        return Promise.resolve({});
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should start on dashboard
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Navigate to Personnel
      const personnelLink = screen.getByText(/personnel/i);
      await userEvent.click(personnelLink);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Navigate to Devices
      const devicesLink = screen.getByText(/devices/i);
      await userEvent.click(devicesLink);

      await waitFor(() => {
        expect(screen.getByText('Test Device')).toBeInTheDocument();
      });

      // Navigate back to Dashboard
      const dashboardLink = screen.getByText(/dashboard/i);
      await userEvent.click(dashboardLink);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });
    });
  });

  describe('Personnel Management', () => {
    test('Complete personnel management workflow', async () => {
      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock API responses
      mockApiService.get.mockResolvedValue({
        results: [],
      });

      mockApiService.post.mockResolvedValue({
        id: 1,
        badge_id: 'EMP001',
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        company: 'Test Company',
        department: 'IT',
        role: 'Developer',
        status: 'active',
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Navigate to Personnel
      await waitFor(() => {
        const personnelLink = screen.getByText(/personnel/i);
        userEvent.click(personnelLink);
      });

      await waitFor(() => {
        expect(screen.getByText(/personnel list/i)).toBeInTheDocument();
      });

      // Click Add Personnel button
      const addButton = screen.getByText(/add personnel/i);
      await userEvent.click(addButton);

      // Fill personnel form
      const badgeIdInput = screen.getByLabelText(/badge id/i);
      const fullNameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const companyInput = screen.getByLabelText(/company/i);
      const departmentInput = screen.getByLabelText(/department/i);
      const roleInput = screen.getByLabelText(/role/i);

      await userEvent.type(badgeIdInput, 'EMP001');
      await userEvent.type(fullNameInput, 'John Doe');
      await userEvent.type(emailInput, 'john.doe@example.com');
      await userEvent.type(companyInput, 'Test Company');
      await userEvent.type(departmentInput, 'IT');
      await userEvent.type(roleInput, 'Developer');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);

      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/personnel added successfully/i)).toBeInTheDocument();
      });

      // Verify API call
      expect(mockApiService.post).toHaveBeenCalledWith(
        '/personnel',
        expect.objectContaining({
          badge_id: 'EMP001',
          full_name: 'John Doe',
          email: 'john.doe@example.com',
        })
      );
    });
  });

  describe('Device Management', () => {
    test('Device discovery and management workflow', async () => {
      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock API responses
      mockApiService.get.mockResolvedValue([]);

      mockApiService.post.mockResolvedValue({
        devices: [
          {
            sn: 'TEST001',
            alias: 'Test Device',
            state: 1,
            last_activity: '2024-01-15T08:00:00Z',
          },
        ],
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Navigate to Devices
      await waitFor(() => {
        const devicesLink = screen.getByText(/devices/i);
        userEvent.click(devicesLink);
      });

      await waitFor(() => {
        expect(screen.getByText(/device management/i)).toBeInTheDocument();
      });

      // Click Discover Devices button
      const discoverButton = screen.getByText(/discover devices/i);
      await userEvent.click(discoverButton);

      // Verify discovery process
      await waitFor(() => {
        expect(screen.getByText(/devices discovered/i)).toBeInTheDocument();
      });

      // Verify API call
      expect(mockApiService.post).toHaveBeenCalledWith('/devices/discover');
    });
  });

  describe('Real-time Updates', () => {
    test('WebSocket connection and real-time updates', async () => {
      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock API responses
      mockApiService.get.mockResolvedValue({
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Toggle auto-refresh
      const autoRefreshButton = screen.getByText(/auto refresh: on/i);
      await userEvent.click(autoRefreshButton);

      expect(screen.getByText(/auto refresh: off/i)).toBeInTheDocument();

      // Toggle back on
      await userEvent.click(autoRefreshButton);
      expect(screen.getByText(/auto refresh: on/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('Handles API errors gracefully', async () => {
      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock API error
      mockApiService.get.mockRejectedValue(new Error('API Error'));

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    test('Handles network errors gracefully', async () => {
      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock network error
      mockApiService.get.mockImplementation(() => {
        throw new Error('Network Error');
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    test('Application loads within acceptable time', async () => {
      const startTime = performance.now();

      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock API responses
      mockApiService.get.mockResolvedValue({
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Application should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('Large dataset handling', async () => {
      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock large dataset
      const largePersonnelData = {
        results: Array.from({ length: 1000 }, (_, i) => ({
          id: i + 1,
          badge_id: `EMP${String(i + 1).padStart(4, '0')}`,
          full_name: `Person ${i + 1}`,
          email: `person${i + 1}@example.com`,
          company: `Company ${(i % 10) + 1}`,
          department: ['IT', 'HR', 'Finance', 'Operations', 'Maintenance'][i % 5],
          role: ['Developer', 'Manager', 'Analyst', 'Engineer', 'Technician'][i % 5],
          status: 'active',
        })),
      };

      mockApiService.get.mockResolvedValue(largePersonnelData);

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Navigate to Personnel
      await waitFor(() => {
        const personnelLink = screen.getByText(/personnel/i);
        userEvent.click(personnelLink);
      });

      await waitFor(() => {
        expect(screen.getByText('Person 1')).toBeInTheDocument();
      });

      // Should handle large dataset without significant performance issues
      expect(screen.getByText('Person 1000')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('Application is accessible', async () => {
      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock API responses
      mockApiService.get.mockResolvedValue({
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Check for proper semantic HTML
      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(main).toBeInTheDocument();
        
        const heading1 = screen.getByRole('heading', { level: 1 });
        expect(heading1).toBeInTheDocument();
        
        // Check for navigation
        const navigation = screen.getByRole('navigation');
        expect(navigation).toBeInTheDocument();
      });
    });
  });

  describe('Logout Flow', () => {
    test('Complete logout flow', async () => {
      // Mock authenticated user
      localStorage.setItem('authToken', 'test-token');
      mockApiService.getAuthToken.mockReturnValue('test-token');

      // Mock API responses
      mockApiService.get.mockResolvedValue({
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });

      // Find and click logout button
      const logoutButton = screen.getByText(/logout/i);
      await userEvent.click(logoutButton);

      // Should redirect to login page
      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeInTheDocument();
      });

      // Verify token is removed
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });
});
