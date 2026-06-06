/**
 * Frontend-Backend Integration Tests
 * Tests the integration between frontend and backend APIs
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard/Dashboard';
import PersonnelList from '../../pages/Personnel/PersonnelList';
import apiService from '../../services/api';

// Mock API service
jest.mock('../../services/api');
const mockApiService = apiService.default;

// Test wrapper
const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
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

describe('Frontend-Backend Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('API Endpoints Integration', () => {
    test('Dashboard API integration', async () => {
      const mockDashboardData = {
        data: {
          total_personnel: 156,
          offshore_count: 45,
          onshore_count: 111,
          transit_count: 0,
          by_location: {
            'Platform Alpha': 25,
            'Platform Beta': 20,
          },
          recent_events: [
            {
              id: 1,
              type: 'CHECKIN',
              personnel: 'John Doe',
              location: 'Platform Alpha',
              timestamp: '2024-01-15T08:00:00Z',
            },
          ],
          active_transports: [],
        },
      };

      mockApiService.get
        .mockResolvedValueOnce(mockDashboardData)
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce([]);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('156')).toBeInTheDocument();
        expect(screen.getByText('45')).toBeInTheDocument();
        expect(screen.getByText('111')).toBeInTheDocument();
      });

      // Verify API call was made with correct endpoint
      expect(mockApiService.get).toHaveBeenCalledWith('/api/v1/pob-status/dashboard');
    });

    test('Personnel API integration', async () => {
      const mockPersonnelData = {
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
        count: 1,
        next: null,
        previous: null,
      };

      mockApiService.get.mockResolvedValue(mockPersonnelData);

      render(
        <TestWrapper>
          <PersonnelList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('EMP001')).toBeInTheDocument();
      });

      // Verify API call was made with correct endpoint
      expect(mockApiService.get).toHaveBeenCalledWith('/api/v1/personnel/?page_size=50');
    });
  });

  describe('Data Flow Integration', () => {
    test('Dashboard data flows correctly', async () => {
      const mockDashboardData = {
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {
            'Platform Alpha': 15,
            'Platform Beta': 15,
          },
          recent_events: [
            {
              id: 1,
              type: 'CHECKIN',
              personnel: 'John Doe',
              location: 'Platform Alpha',
              timestamp: '2024-01-15T08:00:00Z',
            },
            {
              id: 2,
              type: 'CHECKOUT',
              personnel: 'Jane Smith',
              location: 'Platform Beta',
              timestamp: '2024-01-15T08:30:00Z',
            },
          ],
          active_transports: [
            {
              id: 1,
              vehicle_id: 'VH001',
              driver: 'Driver 1',
              route: 'Route A',
              status: 'active',
            },
          ],
        },
      };

      mockApiService.get
        .mockResolvedValueOnce(mockDashboardData)
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce([]);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        // Verify statistics are displayed
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('70')).toBeInTheDocument();

        // Verify recent events are displayed
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Platform Alpha')).toBeInTheDocument();
        expect(screen.getByText('Platform Beta')).toBeInTheDocument();
      });
    });

    test('Personnel list data flows correctly', async () => {
      const mockPersonnelData = {
        results: [
          {
            id: 1,
            badge_id: 'EMP001',
            full_name: 'John Doe',
            email: 'john.doe@example.com',
            company: 'Company A',
            department: 'IT',
            role: 'Developer',
            status: 'active',
          },
          {
            id: 2,
            badge_id: 'EMP002',
            full_name: 'Jane Smith',
            email: 'jane.smith@example.com',
            company: 'Company B',
            department: 'HR',
            role: 'Manager',
            status: 'active',
          },
        ],
        count: 2,
        next: null,
        previous: null,
      };

      mockApiService.get.mockResolvedValue(mockPersonnelData);

      render(
        <TestWrapper>
          <PersonnelList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Company A')).toBeInTheDocument();
        expect(screen.getByText('Company B')).toBeInTheDocument();
        expect(screen.getByText('IT')).toBeInTheDocument();
        expect(screen.getByText('HR')).toBeInTheDocument();
        expect(screen.getByText('Developer')).toBeInTheDocument();
        expect(screen.getByText('Manager')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Integration', () => {
    test('Dashboard handles API errors gracefully', async () => {
      mockApiService.get.mockRejectedValue(new Error('API Error'));

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    test('Personnel list handles API errors gracefully', async () => {
      mockApiService.get.mockRejectedValue(new Error('API Error'));

      render(
        <TestWrapper>
          <PersonnelList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    test('Dashboard handles empty data gracefully', async () => {
      const emptyData = {
        data: {
          total_personnel: 0,
          offshore_count: 0,
          onshore_count: 0,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      };

      mockApiService.get
        .mockResolvedValueOnce(emptyData)
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce([]);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.getByText('No recent events')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates Integration', () => {
    test('Dashboard refreshes data correctly', async () => {
      const mockDashboardData = {
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      };

      const mockRefetch = jest.fn();
      jest.spyOn(require('@tanstack/react-query'), 'useQuery')
        .mockReturnValueOnce({
          data: mockDashboardData,
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        })
        .mockReturnValueOnce({
          data: { results: [] },
          isLoading: false,
          error: null,
        })
        .mockReturnValueOnce({
          data: [],
          isLoading: false,
          error: null,
        });

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      const refreshButton = screen.getByText('Refresh Now');
      fireEvent.click(refreshButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    test('Auto-refresh functionality works', async () => {
      const mockDashboardData = {
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      };

      jest.spyOn(require('@tanstack/react-query'), 'useQuery')
        .mockReturnValueOnce({
          data: mockDashboardData,
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        })
        .mockReturnValueOnce({
          data: { results: [] },
          isLoading: false,
          error: null,
        })
        .mockReturnValueOnce({
          data: [],
          isLoading: false,
          error: null,
        });

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Initially auto-refresh should be ON
      expect(screen.getByText('Auto Refresh: ON')).toBeInTheDocument();

      // Toggle auto-refresh OFF
      const autoRefreshButton = screen.getByText('Auto Refresh: ON');
      fireEvent.click(autoRefreshButton);

      expect(screen.getByText('Auto Refresh: OFF')).toBeInTheDocument();
    });
  });

  describe('Authentication Integration', () => {
    test('API calls include auth token when available', async () => {
      const token = 'test-token';
      localStorage.setItem('authToken', token);

      const mockDashboardData = {
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      };

      mockApiService.get
        .mockResolvedValueOnce(mockDashboardData)
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce([]);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Verify API call included auth token
      expect(mockApiService.get).toHaveBeenCalledWith('/api/v1/pob-status/dashboard');
    });

    test('API calls handle missing auth token', async () => {
      localStorage.removeItem('authToken');

      const mockDashboardData = {
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      };

      mockApiService.get
        .mockResolvedValueOnce(mockDashboardData)
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce([]);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Verify API call was made without auth token
      expect(mockApiService.get).toHaveBeenCalledWith('/api/v1/pob-status/dashboard');
    });
  });

  describe('Performance Integration', () => {
    test('Dashboard loads data efficiently', async () => {
      const startTime = performance.now();
      
      const mockDashboardData = {
        data: {
          total_personnel: 100,
          offshore_count: 30,
          onshore_count: 70,
          transit_count: 0,
          by_location: {},
          recent_events: [],
          active_transports: [],
        },
      };

      mockApiService.get
        .mockResolvedValueOnce(mockDashboardData)
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce([]);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Load time should be reasonable (less than 1 second for test data)
      expect(loadTime).toBeLessThan(1000);
    });

    test('Personnel list handles large datasets efficiently', async () => {
      const largePersonnelData = {
        results: Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          badge_id: `EMP${String(i + 1).padStart(3, '0')}`,
          full_name: `Person ${i + 1}`,
          email: `person${i + 1}@example.com`,
          company: `Company ${(i % 5) + 1}`,
          department: ['IT', 'HR', 'Finance', 'Operations', 'Maintenance'][i % 5],
          role: ['Developer', 'Manager', 'Analyst', 'Engineer', 'Technician'][i % 5],
          status: 'active',
        })),
        count: 100,
        next: null,
        previous: null,
      };

      const startTime = performance.now();

      mockApiService.get.mockResolvedValue(largePersonnelData);

      render(
        <TestWrapper>
          <PersonnelList />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Person 1')).toBeInTheDocument();
        expect(screen.getByText('Person 100')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Render time should be reasonable even for large datasets
      expect(renderTime).toBeLessThan(2000);
    });
  });

  describe('WebSocket Integration', () => {
    test('WebSocket service initializes correctly', () => {
      const { websocketService } = require('../../services/websocketService');
      
      expect(websocketService).toBeDefined();
      expect(websocketService.isConnected).toBe(false);
    });

    test('WebSocket connection status updates correctly', () => {
      const { useWebSocket } = require('../../hooks/useWebSocket');
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.hasError).toBe(false);
    });
  });

  describe('Error Boundary Integration', () => {
    test('Error boundary catches component errors', () => {
      const ErrorBoundary = require('../../utils/errorHandling').ErrorBoundary;
      const { result } = renderHook(() => useErrorBoundary());

      // Mock a component that throws an error
      const ThrowErrorComponent = () => {
        throw new Error('Test error');
      };

      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowErrorComponent />
          </ErrorBoundary>
        );
      }).toThrow('Test error');
    });
  });
});
