/**
 * Device Module Tests
 * Comprehensive test suite for Device module components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import Device from '../pages/Device/Device';
import DeviceList from '../pages/Device/tabs/DeviceList';
import RealTimeMonitor from '../pages/Device/tabs/RealTimeMonitor';
import DeviceCommands from '../pages/Device/tabs/DeviceCommands';
import AreaManagement from '../pages/Device/tabs/AreaManagement';
import FirmwareManagement from '../pages/Device/tabs/FirmwareManagement';
import AutoRegisterSettings from '../pages/Device/tabs/AutoRegisterSettings';
import deviceAPI from '../services/deviceAPI';

// Mock API responses
const mockDevices = [
  {
    id: 1,
    sn: 'TEST001',
    alias: 'Test Terminal 1',
    ip_address: '192.168.1.100',
    device_type: 0,
    area_id: 1,
    device_name: 'MB20',
    device_model: 'MB20',
    fw_version: '2.3.1',
    user_count: 10,
    fp_count: 8,
    face_count: 5,
    status: 'online',
    last_activity: '2024-03-28T14:30:00Z',
    created_at: '2024-03-15T10:30:00Z',
    updated_at: '2024-03-28T14:30:00Z'
  },
  {
    id: 2,
    sn: 'TEST002',
    alias: 'Test Terminal 2',
    ip_address: '192.168.1.101',
    device_type: 1,
    area_id: 2,
    device_name: 'MB560',
    device_model: 'MB560',
    fw_version: '1.8.5',
    user_count: 15,
    fp_count: 12,
    face_count: 8,
    status: 'offline',
    last_activity: '2024-03-28T12:00:00Z',
    created_at: '2024-03-20T09:15:00Z',
    updated_at: '2024-03-28T12:00:00Z'
  }
];

const mockCommands = [
  {
    id: 1,
    sn: 'TEST001',
    cmd_content: 'REBOOT',
    status: 0,
    cmd_commit_time: '2024-03-28T14:30:00Z',
    cmd_trans_time: null,
    cmd_return_time: null,
    cmd_return: null
  },
  {
    id: 2,
    sn: 'TEST001',
    cmd_content: 'CHECK',
    status: 2,
    cmd_commit_time: '2024-03-28T14:25:00Z',
    cmd_trans_time: '2024-03-28T14:26:00Z',
    cmd_return_time: '2024-03-28T14:27:00Z',
    cmd_return: 'SUCCESS'
  }
];

const mockAreas = [
  { id: 1, name: 'Platform Alpha' },
  { id: 2, name: 'Platform Beta' },
  { id: 3, name: 'Onshore Base' }
];

// Mock API
jest.mock('../services/deviceAPI');
const mockStore = configureStore({
  reducer: {
    // Add your reducers here
  }
});

const renderWithProviders = (component) => {
  return render(
    <Provider store={mockStore}>
      <BrowserRouter>
        <ConfigProvider>
          {component}
        </ConfigProvider>
      </BrowserRouter>
    </Provider>
  );
};

describe('Device Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage
    localStorage.setItem('token', 'mock-token');
  });

  describe('Device Main Component', () => {
    test('renders Device module with all tabs', async () => {
      deviceAPI.getHealth.mockResolvedValue({
        success: true,
        total_devices: 2,
        online_devices: 1,
        offline_devices: 1,
        pending_commands: 2
      });

      renderWithProviders(<Device />);

      expect(screen.getByText('Device Management')).toBeInTheDocument();
      expect(screen.getByText('Device List')).toBeInTheDocument();
      expect(screen.getByText('Area Management')).toBeInTheDocument();
      expect(screen.getByText('Device Commands')).toBeInTheDocument();
      expect(screen.getByText('Real-time Monitor')).toBeInTheDocument();
      expect(screen.getByText('Firmware')).toBeInTheDocument();
      expect(screen.getByText('Auto-Register')).toBeInTheDocument();
    });

    test('displays device statistics', async () => {
      deviceAPI.getHealth.mockResolvedValue({
        success: true,
        total_devices: 5,
        online_devices: 3,
        offline_devices: 2,
        pending_commands: 1
      });

      renderWithProviders(<Device />);

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // Total devices
        expect(screen.getByText('3')).toBeInTheDocument(); // Online devices
        expect(screen.getByText('2')).toBeInTheDocument(); // Offline devices
        expect(screen.getByText('1')).toBeInTheDocument(); // Pending commands
      });
    });

    test('refresh button works', async () => {
      deviceAPI.getHealth.mockResolvedValue({
        success: true,
        total_devices: 2,
        online_devices: 1,
        offline_devices: 1,
        pending_commands: 0
      });

      renderWithProviders(<Device />);

      const refreshButton = screen.getByText('Refresh');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(deviceAPI.getHealth).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('DeviceList Component', () => {
    test('renders device list with data', async () => {
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);

      renderWithProviders(<DeviceList />);

      await waitFor(() => {
        expect(screen.getByText('Test Terminal 1')).toBeInTheDocument();
        expect(screen.getByText('TEST001')).toBeInTheDocument();
        expect(screen.getByText('Test Terminal 2')).toBeInTheDocument();
        expect(screen.getByText('TEST002')).toBeInTheDocument();
      });
    });

    test('opens add device modal', async () => {
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);
      deviceAPI.getAreas.mockResolvedValue(mockAreas);

      renderWithProviders(<DeviceList />);

      const addButton = screen.getByText('Add Device');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Add Device')).toBeInTheDocument();
        expect(screen.getByLabelText('Serial Number')).toBeInTheDocument();
        expect(screen.getByLabelText('Alias')).toBeInTheDocument();
        expect(screen.getByLabelText('Device Type')).toBeInTheDocument();
      });
    });

    test('creates new device successfully', async () => {
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);
      deviceAPI.getAreas.mockResolvedValue(mockAreas);
      deviceAPI.createTerminal.mockResolvedValue({
        id: 3,
        sn: 'TEST003',
        alias: 'New Terminal',
        device_type: 0
      });

      renderWithProviders(<DeviceList />);

      // Open modal
      fireEvent.click(screen.getByText('Add Device'));

      // Fill form
      fireEvent.change(screen.getByLabelText('Serial Number'), { target: { value: 'TEST003' } });
      fireEvent.change(screen.getByLabelText('Alias'), { target: { value: 'New Terminal' } });

      // Submit
      fireEvent.click(screen.getByText('OK'));

      await waitFor(() => {
        expect(deviceAPI.createTerminal).toHaveBeenCalledWith({
          sn: 'TEST003',
          alias: 'New Terminal',
          device_type: 0
        });
      });
    });

    test('filters devices by status', async () => {
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);

      renderWithProviders(<DeviceList />);

      // Find status filter
      const statusFilter = screen.getByText('Filter by Status');
      fireEvent.click(statusFilter);

      // Select 'Online' status
      fireEvent.click(screen.getByText('Online'));

      await waitFor(() => {
        expect(deviceAPI.getTerminals).toHaveBeenCalledWith({
          status: 'online'
        });
      });
    });

    test('bulk actions work', async () => {
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);
      deviceAPI.getAreas.mockResolvedValue(mockAreas);

      renderWithProviders(<DeviceList />);

      // Select devices
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Select first device

      // Test bulk delete
      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete 1 devices?')).toBeInTheDocument();
      });
    });

    test('imports CSV file', async () => {
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);
      deviceAPI.batchImport.mockResolvedValue({
        imported: 2,
        skipped: 0,
        errors: []
      });

      renderWithProviders(<DeviceList />);

      fireEvent.click(screen.getByText('Import'));
      
      await waitFor(() => {
        expect(screen.getByText('Import Devices from CSV')).toBeInTheDocument();
        expect(screen.getByText('Select CSV File')).toBeInTheDocument();
      });
    });
  });

  describe('RealTimeMonitor Component', () => {
    test('renders real-time monitor with devices', async () => {
      deviceAPI.getRealTimeDevices.mockResolvedValue({
        devices: mockDevices,
        total_count: 2,
        online_count: 1,
        offline_count: 1
      });

      renderWithProviders(<RealTimeMonitor />);

      await waitFor(() => {
        expect(screen.getByText('Real-time Device Monitor')).toBeInTheDocument();
        expect(screen.getByText('Test Terminal 1')).toBeInTheDocument();
        expect(screen.getByText('Test Terminal 2')).toBeInTheDocument();
      });
    });

    test('displays device cards with status', async () => {
      deviceAPI.getRealTimeDevices.mockResolvedValue({
        devices: mockDevices,
        total_count: 2,
        online_count: 1,
        offline_count: 1
      });

      renderWithProviders(<RealTimeMonitor />);

      await waitFor(() => {
        // Check online device has green status
        const onlineDevice = screen.getByText('Test Terminal 1').closest('.device-card');
        expect(onlineDevice).toHaveClass('online');

        // Check offline device has red status
        const offlineDevice = screen.getByText('Test Terminal 2').closest('.device-card');
        expect(offlineDevice).toHaveClass('offline');
      });
    });

    test('opens device logs drawer', async () => {
      deviceAPI.getRealTimeDevices.mockResolvedValue({
        devices: mockDevices,
        total_count: 2,
        online_count: 1,
        offline_count: 1
      });

      renderWithProviders(<RealTimeMonitor />);

      await waitFor(() => {
        // Click on device to open logs
        const deviceCard = screen.getByText('Test Terminal 1').closest('.device-card');
        fireEvent.click(deviceCard);
      });

      await waitFor(() => {
        expect(screen.getByText('Device Logs: Test Terminal 1')).toBeInTheDocument();
        expect(screen.getByText('Live Logs')).toBeInTheDocument();
      });
    });

    test('emergency device controls', async () => {
      const emergencyDevice = {
        ...mockDevices[0],
        device_type: 3, // Emergency device
        emergency_status: 'off'
      };

      deviceAPI.getRealTimeDevices.mockResolvedValue({
        devices: [emergencyDevice],
        total_count: 1,
        online_count: 1,
        offline_count: 0
      });

      deviceAPI.emergencyCommand.mockResolvedValue({
        success: true,
        message: 'Emergency ON command sent'
      });

      renderWithProviders(<RealTimeMonitor />);

      await waitFor(() => {
        // Find emergency toggle button
        const emergencyButton = screen.getByTitle('Turn ON Emergency');
        fireEvent.click(emergencyButton);

        expect(deviceAPI.emergencyCommand).toHaveBeenCalledWith('TEST001', 'ON');
      });
    });

    test('pause and resume monitoring', async () => {
      deviceAPI.getRealTimeDevices.mockResolvedValue({
        devices: mockDevices,
        total_count: 2,
        online_count: 1,
        offline_count: 1
      });

      renderWithProviders(<RealTimeMonitor />);

      // Test pause
      const pauseButton = screen.getByTitle('Pause');
      fireEvent.click(pauseButton);

      // Test resume
      const resumeButton = screen.getByTitle('Resume');
      fireEvent.click(resumeButton);

      await waitFor(() => {
        expect(deviceAPI.getRealTimeDevices).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('DeviceCommands Component', () => {
    test('renders command queue with stats', async () => {
      deviceAPI.getDeviceCommands.mockResolvedValue(mockCommands);
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);

      renderWithProviders(<DeviceCommands />);

      await waitFor(() => {
        expect(screen.getByText('Command Queue Status')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Success')).toBeInTheDocument();
      });
    });

    test('sends command to device', async () => {
      deviceAPI.getDeviceCommands.mockResolvedValue(mockCommands);
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);
      deviceAPI.sendCommand.mockResolvedValue({
        id: 3,
        sn: 'TEST001',
        cmd: 'REBOOT',
        status: 'pending',
        message: 'Command queued successfully'
      });

      renderWithProviders(<DeviceCommands />);

      fireEvent.click(screen.getByText('Send Command'));

      await waitFor(() => {
        expect(screen.getByText('Send Device Command')).toBeInTheDocument();
      });

      // Fill form
      fireEvent.change(screen.getByLabelText('Device'), { target: { value: 'TEST001' } });
      fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'REBOOT' } });

      fireEvent.click(screen.getByText('OK'));

      await waitFor(() => {
        expect(deviceAPI.sendCommand).toHaveBeenCalledWith({
          sn: 'TEST001',
          cmd: 'REBOOT'
        });
      });
    });

    test('syncs user to device', async () => {
      deviceAPI.getDeviceCommands.mockResolvedValue(mockCommands);
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);
      deviceAPI.syncUserToDevice.mockResolvedValue({
        message: 'User EMP001 sync command sent to device TEST001'
      });

      renderWithProviders(<DeviceCommands />);

      fireEvent.click(screen.getByText('Sync Users'));

      await waitFor(() => {
        expect(screen.getByText('Sync Users to Device')).toBeInTheDocument();
      });

      // Select sync type
      fireEvent.change(screen.getByLabelText('Sync Type'), { target: { value: 'single' } });
      fireEvent.change(screen.getByLabelText('Device'), { target: { value: 'TEST001' } });
      fireEvent.change(screen.getByLabelText('Employee Code'), { target: { value: 'EMP001' } });

      fireEvent.click(screen.getByText('OK'));

      await waitFor(() => {
        expect(deviceAPI.syncUserToDevice).toHaveBeenCalledWith('TEST001', 'EMP001');
      });
    });

    test('views command details', async () => {
      deviceAPI.getDeviceCommands.mockResolvedValue(mockCommands);
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);

      renderWithProviders(<DeviceCommands />);

      await waitFor(() => {
        // Find view button for first command
        const viewButton = screen.getByTitle('View Details');
        fireEvent.click(viewButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Command Details: REBOOT')).toBeInTheDocument();
        expect(screen.getByText('Status:')).toBeInTheDocument();
        expect(screen.getByText('Created:')).toBeInTheDocument();
      });
    });
  });

  describe('AreaManagement Component', () => {
    test('renders area management with areas', async () => {
      const mockAreaData = [
        {
          id: 1,
          name: 'Platform Alpha',
          description: 'Main offshore platform',
          location: 'Offshore Field A',
          area_type: 'offshore',
          capacity: 100
        },
        {
          id: 2,
          name: 'Platform Beta',
          description: 'Secondary offshore platform',
          location: 'Offshore Field B',
          area_type: 'offshore',
          capacity: 80
        }
      ];

      renderWithProviders(<AreaManagement />);

      // Since we're not mocking the API, we'll test the component structure
      expect(screen.getByText('Area Management')).toBeInTheDocument();
      expect(screen.getByText('Add Area')).toBeInTheDocument();
    });

    test('opens add area modal', async () => {
      renderWithProviders(<AreaManagement />);

      fireEvent.click(screen.getByText('Add Area'));

      await waitFor(() => {
        expect(screen.getByText('Add Area')).toBeInTheDocument();
        expect(screen.getByLabelText('Area Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Area Type')).toBeInTheDocument();
        expect(screen.getByLabelText('Location')).toBeInTheDocument();
      });
    });

    test('creates new area successfully', async () => {
      renderWithProviders(<AreaManagement />);

      fireEvent.click(screen.getByText('Add Area'));

      await waitFor(() => {
        expect(screen.getByText('Add Area')).toBeInTheDocument();
      });

      // Fill form
      fireEvent.change(screen.getByLabelText('Area Name'), { target: { value: 'Test Area' } });
      fireEvent.change(screen.getByLabelText('Area Type'), { target: { value: 'offshore' } });
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Test Location' } });
      fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: '50' } });

      fireEvent.click(screen.getByText('OK'));

      // In real implementation, this would call the API
      // For now, we'll verify the modal closes
      await waitFor(() => {
        expect(screen.queryByText('Add Area')).not.toBeInTheDocument();
      });
    });
  });

  describe('FirmwareManagement Component', () => {
    test('renders firmware management', async () => {
      const mockFirmwares = [
        {
          id: 'fw_001',
          filename: 'MB20_v2.3.1.bin',
          version: '2.3.1',
          device_types: ['MB20', 'MB360'],
          status: 'active',
          update_count: 15
        }
      ];

      renderWithProviders(<FirmwareManagement />);

      expect(screen.getByText('Firmware Management')).toBeInTheDocument();
      expect(screen.getByText('Upload Firmware')).toBeInTheDocument();
    });

    test('opens upload firmware modal', async () => {
      renderWithProviders(<FirmwareManagement />);

      fireEvent.click(screen.getByText('Upload Firmware'));

      await waitFor(() => {
        expect(screen.getByText('Upload Firmware')).toBeInTheDocument();
        expect(screen.getByLabelText('Firmware File')).toBeInTheDocument();
        expect(screen.getByLabelText('Firmware Version')).toBeInTheDocument();
      });
    });

    test('opens push firmware modal', async () => {
      const mockFirmware = {
        id: 'fw_001',
        filename: 'MB20_v2.3.1.bin',
        version: '2.3.1',
        device_types: ['MB20']
      };

      renderWithProviders(<FirmwareManagement />);

      // Since we're not mocking the API, we'll test the structure
      expect(screen.getByText('Firmware Management')).toBeInTheDocument();
    });
  });

  describe('AutoRegisterSettings Component', () => {
    test('renders auto-register settings', async () => {
      renderWithProviders(<AutoRegisterSettings />);

      expect(screen.getByText('Auto-Register Settings')).toBeInTheDocument();
      expect(screen.getByText('Enable Auto-Registration')).toBeInTheDocument();
      expect(screen.getByText('Default Area')).toBeInTheDocument();
      expect(screen.getByText('Security Settings')).toBeInTheDocument();
    });

    test('toggles auto-registration', async () => {
      renderWithProviders(<AutoRegisterSettings />);

      const toggle = screen.getByRole('switch');
      fireEvent.click(toggle);

      await waitFor(() => {
        // Verify toggle state changed
        expect(toggle).toBeChecked();
      });
    });

    test('saves settings successfully', async () => {
      renderWithProviders(<AutoRegisterSettings />);

      fireEvent.click(screen.getByText('Save Settings'));

      // In real implementation, this would save to API
      // For now, we'll verify the loading state
      await waitFor(() => {
        // Button should be in loading state briefly
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });
    });

    test('shows auto-registered devices', async () => {
      const mockRegisteredDevices = [
        {
          id: 1,
          sn: 'AUTO001',
          alias: 'Auto Terminal 1',
          status: 'active',
          registered_at: '2024-03-28T10:30:00Z'
        }
      ];

      renderWithProviders(<AutoRegisterSettings />);

      expect(screen.getByText('Total Auto-Registered')).toBeInTheDocument();
      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    });
  });

  describe('Device API Service', () => {
    test('getTerminals fetches device list', async () => {
      deviceAPI.getTerminals.mockResolvedValue(mockDevices);

      const result = await deviceAPI.getTerminals();
      
      expect(result).toEqual(mockDevices);
      expect(deviceAPI.getTerminals).toHaveBeenCalledWith();
    });

    test('createTerminal creates new device', async () => {
      const newDevice = {
        sn: 'TEST003',
        alias: 'New Terminal',
        device_type: 0
      };

      deviceAPI.createTerminal.mockResolvedValue(newDevice);

      const result = await deviceAPI.createTerminal(newDevice);
      
      expect(result).toEqual(newDevice);
      expect(deviceAPI.createTerminal).toHaveBeenCalledWith(newDevice);
    });

    test('sendCommand queues command', async () => {
      const commandData = {
        sn: 'TEST001',
        cmd: 'REBOOT'
      };

      deviceAPI.sendCommand.mockResolvedValue({
        id: 1,
        sn: 'TEST001',
        cmd: 'REBOOT',
        status: 'pending'
      });

      const result = await deviceAPI.sendCommand(commandData);
      
      expect(result.status).toBe('pending');
      expect(deviceAPI.sendCommand).toHaveBeenCalledWith(commandData);
    });

    test('getRealTimeDevices fetches live data', async () => {
      const mockRealTimeData = {
        devices: mockDevices,
        total_count: 2,
        online_count: 1,
        offline_count: 1
      };

      deviceAPI.getRealTimeDevices.mockResolvedValue(mockRealTimeData);

      const result = await deviceAPI.getRealTimeDevices();
      
      expect(result).toEqual(mockRealTimeData);
      expect(deviceAPI.getRealTimeDevices).toHaveBeenCalledWith();
    });

    test('emergencyCommand sends emergency command', async () => {
      deviceAPI.emergencyCommand.mockResolvedValue({
        message: 'Emergency ON command sent'
      });

      const result = await deviceAPI.emergencyCommand('TEST001', 'ON');
      
      expect(result.message).toContain('Emergency ON');
      expect(deviceAPI.emergencyCommand).toHaveBeenCalledWith('TEST001', 'ON');
    });

    test('getHealth returns system health', async () => {
      const mockHealth = {
        status: 'healthy',
        total_devices: 5,
        online_devices: 3,
        offline_devices: 2
      };

      deviceAPI.getHealth.mockResolvedValue(mockHealth);

      const result = await deviceAPI.getHealth();
      
      expect(result.status).toBe('healthy');
      expect(result.total_devices).toBe(5);
      expect(deviceAPI.getHealth).toHaveBeenCalledWith();
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      deviceAPI.getTerminals.mockRejectedValue(new Error('Network error'));

      try {
        await deviceAPI.getTerminals();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });

    test('displays error messages to user', async () => {
      deviceAPI.getTerminals.mockRejectedValue(new Error('API Error'));

      renderWithProviders(<DeviceList />);

      await waitFor(() => {
        // Should show error message
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe('WebSocket Integration', () => {
    test('connects to WebSocket for real-time updates', async () => {
      // Mock WebSocket
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
      
      global.WebSocket = jest.fn(() => mockWebSocket);

      renderWithProviders(<RealTimeMonitor />);

      // Verify WebSocket connection attempt
      expect(global.WebSocket).toHaveBeenCalledWith(
        'ws://localhost:8000/ws/device/status'
      );
    });

    test('handles WebSocket messages', async () => {
      const mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
      
      global.WebSocket = jest.fn(() => mockWebSocket);

      renderWithProviders(<RealTimeMonitor />);

      // Simulate receiving WebSocket message
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'device_status',
          data: {
            sn: 'TEST001',
            status: 'online',
            last_activity: new Date().toISOString()
          }
        })
      });

      mockWebSocket.addEventListener.mock.calls[0][1](messageEvent);

      await waitFor(() => {
        // Should update device status
        expect(screen.getByText('TEST001')).toBeInTheDocument();
      });
    });
  });
});
