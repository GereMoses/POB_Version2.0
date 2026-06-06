/**
 * API Service Tests
 * Tests the API service functionality
 */

import apiService from '../../services/api';

// Mock fetch
global.fetch = jest.fn();

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Authentication', () => {
    test('sets auth token', () => {
      const token = 'test-token';
      apiService.setAuthToken(token);
      expect(localStorage.getItem('authToken')).toBe(token);
    });

    test('gets auth token', () => {
      const token = 'test-token';
      localStorage.setItem('authToken', token);
      expect(apiService.getAuthToken()).toBe(token);
    });

    test('removes auth token', () => {
      localStorage.setItem('authToken', 'test-token');
      apiService.removeAuthToken();
      expect(localStorage.getItem('authToken')).toBeNull();
    });

    test('gets headers with auth token', () => {
      const token = 'test-token';
      localStorage.setItem('authToken', token);
      const headers = apiService.getHeaders();
      expect(headers.Authorization).toBe(`Bearer ${token}`);
    });

    test('gets headers without auth token', () => {
      const headers = apiService.getHeaders();
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe('HTTP Methods', () => {
    test('makes GET request', async () => {
      const mockResponse = { data: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiService.get('/test');
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/test',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });

    test('makes POST request', async () => {
      const mockResponse = { data: 'test' };
      const postData = { name: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiService.post('/test', postData);
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/test',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postData),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    test('makes PUT request', async () => {
      const mockResponse = { data: 'test' };
      const putData = { name: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiService.put('/test', putData);
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/test',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(putData),
        }
      );
      expect(result).toEqual(mockResponse);
    });

    test('makes DELETE request', async () => {
      const mockResponse = { data: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiService.delete('/test');
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/test',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Error Handling', () => {
    test('handles network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(apiService.get('/test')).rejects.toThrow('Network Error');
    });

    test('handles HTTP error response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      await expect(apiService.get('/test')).rejects.toThrow();
    });

    test('handles JSON parsing error', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(apiService.get('/test')).rejects.toThrow();
    });
  });

  describe('Request Headers', () => {
    test('includes auth token in headers when available', async () => {
      const token = 'test-token';
      apiService.setAuthToken(token);
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      await apiService.get('/test');
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/test',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
    });

    test('includes custom headers', async () => {
      const customHeaders = { 'X-Custom-Header': 'value' };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      await apiService.get('/test', {}, customHeaders);
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/test',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'value',
          },
        }
      );
    });
  });

  describe('URL Construction', () => {
    test('constructs correct URL for GET request', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      await apiService.get('/personnel');
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/personnel',
        expect.any(Object)
      );
    });

    test('constructs correct URL for POST request', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      await apiService.post('/personnel', { name: 'test' });
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/personnel',
        expect.any(Object)
      );
    });
  });

  describe('Query Parameters', () => {
    test('includes query parameters', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      await apiService.get('/personnel', { page: 1, limit: 10 });
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/personnel?page=1&limit=10',
        expect.any(Object)
      );
    });

    test('handles complex query parameters', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      const params = {
        search: 'john',
        status: 'active',
        department: 'IT',
      };

      await apiService.get('/personnel', params);
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/personnel?search=john&status=active&department=IT',
        expect.any(Object)
      );
    });
  });
});
