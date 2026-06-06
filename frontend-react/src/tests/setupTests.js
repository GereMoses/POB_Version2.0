/**
 * Test Setup Configuration
 * Configures testing environment for the POB frontend
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
  asyncWrapperTimeout: 2000,
});

// Mock WebSocket for testing
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
  })),
}));

// Mock Ant Design message
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    loading: jest.fn(),
  },
  notification: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock fetch API
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Setup test environment
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset localStorage
  localStorageMock.clear();
  sessionStorageMock.clear();
  
  // Reset fetch mock
  fetch.mockClear();
});

// Global test utilities
global.testUtils = {
  // Create mock API response
  createMockResponse: (data, status = 200, ok = true) => ({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }),
  
  // Create mock error response
  createMockError: (message, status = 500) => {
    const error = new Error(message);
    error.status = status;
    return error;
  },
  
  // Wait for async operations
  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock user data
  createMockUser: (overrides = {}) => ({
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'admin',
    ...overrides,
  }),
  
  // Create mock personnel data
  createMockPersonnel: (overrides = {}) => ({
    id: 1,
    badge_id: 'EMP001',
    full_name: 'John Doe',
    email: 'john.doe@example.com',
    company: 'Test Company',
    department: 'IT',
    role: 'Developer',
    status: 'active',
    is_active: true,
    ...overrides,
  }),
  
  // Create mock device data
  createMockDevice: (overrides = {}) => ({
    id: 1,
    sn: 'TEST001',
    alias: 'Test Device',
    state: 1,
    last_activity: new Date().toISOString(),
    ...overrides,
  }),
  
  // Create mock event data
  createMockEvent: (overrides = {}) => ({
    id: 1,
    event_type: 'CHECKIN',
    personnel_id: 1,
    timestamp: new Date().toISOString(),
    raw_data: {},
    ...overrides,
  }),
};

// Custom matchers
expect.extend({
  toBeInTheDocument: (received) => {
    const pass = received && document.body.contains(received);
    return {
      message: () => pass
        ? `expected element not to be in the document`
        : `expected element to be in the document`,
      pass,
    };
  },
  
  toHaveClass: (received, className) => {
    const pass = received && received.classList && received.classList.contains(className);
    return {
      message: () => pass
        ? `expected element not to have class "${className}"`
        : `expected element to have class "${className}"`,
      pass,
    };
  },
  
  toBeDisabled: (received) => {
    const pass = received && received.disabled;
    return {
      message: () => pass
        ? `expected element not to be disabled`
        : `expected element to be disabled`,
      pass,
    };
  },
});

// Suppress console warnings in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
  
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('componentWillReceiveProps')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
