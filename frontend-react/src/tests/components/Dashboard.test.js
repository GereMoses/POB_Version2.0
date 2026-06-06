/**
 * Dashboard Component Tests
 * Tests the main dashboard functionality
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard/Dashboard';
import * as apiService from '../../services/api';

// Mock API service
jest.mock('../../services/api');
const mockApiService = apiService.default;

// Test data
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
};

const mockDeviceData = [
  {
    id: 1,
    sn: 'TEST001',
    alias: 'Test Device',
    state: 1,
    last_activity: '2024-01-15T08:00:00Z',
  },
];

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

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders dashboard with loading state', () => {
    mockApiService.get.mockImplementation(() => new Promise(() => {}));

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Total Personnel')).toBeInTheDocument();
    expect(screen.getByText('Offshore')).toBeInTheDocument();
    expect(screen.getByText('Onshore')).toBeInTheDocument();
    expect(screen.getByText('Transit')).toBeInTheDocument();
  });

  test('renders dashboard with data', async () => {
    mockApiService.get
      .mockResolvedValueOnce(mockDashboardData)
      .mockResolvedValueOnce(mockPersonnelData)
      .mockResolvedValueOnce(mockDeviceData);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('156')).toBeInTheDocument(); // Total Personnel
      expect(screen.getByText('45')).toBeInTheDocument(); // Offshore
      expect(screen.getByText('111')).toBeInTheDocument(); // Onshore
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Platform Alpha')).toBeInTheDocument();
  });

  test('handles refresh button click', async () => {
    const mockRefetch = jest.fn();
    jest.spyOn(require('@tanstack/react-query'), 'useQuery')
      .mockReturnValueOnce({
        data: mockDashboardData,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      })
      .mockReturnValueOnce({
        data: mockPersonnelData,
        isLoading: false,
        error: null,
      })
      .mockReturnValueOnce({
        data: mockDeviceData,
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

  test('toggles auto refresh', async () => {
    mockApiService.get
      .mockResolvedValueOnce(mockDashboardData)
      .mockResolvedValueOnce(mockPersonnelData)
      .mockResolvedValueOnce(mockDeviceData);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Auto Refresh: ON')).toBeInTheDocument();
    });

    const autoRefreshButton = screen.getByText('Auto Refresh: ON');
    fireEvent.click(autoRefreshButton);

    expect(screen.getByText('Auto Refresh: OFF')).toBeInTheDocument();
  });

  test('displays error state when API fails', async () => {
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

  test('displays device status pie chart', async () => {
    mockApiService.get
      .mockResolvedValueOnce(mockDashboardData)
      .mockResolvedValueOnce(mockPersonnelData)
      .mockResolvedValueOnce([
        { state: 1 }, // Online
        { state: 0 }, // Offline
        { state: 2 }, // Error
      ]);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Device Status')).toBeInTheDocument();
    });
  });

  test('displays recent events table', async () => {
    mockApiService.get
      .mockResolvedValueOnce(mockDashboardData)
      .mockResolvedValueOnce(mockPersonnelData)
      .mockResolvedValueOnce(mockDeviceData);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Recent Events')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Platform Alpha')).toBeInTheDocument();
    });
  });

  test('formats timestamps correctly', async () => {
    const eventData = {
      ...mockDashboardData,
      data: {
        ...mockDashboardData.data,
        recent_events: [
          {
            id: 1,
            type: 'CHECKIN',
            personnel: 'John Doe',
            location: 'Platform Alpha',
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
          },
        ],
      },
    };

    mockApiService.get
      .mockResolvedValueOnce(eventData)
      .mockResolvedValueOnce(mockPersonnelData)
      .mockResolvedValueOnce(mockDeviceData);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/5.*min.*ago/i)).toBeInTheDocument();
    });
  });
});

describe('Dashboard Component - Edge Cases', () => {
  test('handles empty data gracefully', async () => {
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

  test('handles network error gracefully', async () => {
    mockApiService.get.mockRejectedValue(new Error('Network Error'));

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  test('handles malformed API response', async () => {
    mockApiService.get.mockResolvedValue({ invalid: 'data' });

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Total Personnel')).toBeInTheDocument();
    });
  });
});
