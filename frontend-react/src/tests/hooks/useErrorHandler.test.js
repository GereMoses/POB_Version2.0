/**
 * useErrorHandler Hook Tests
 * Tests the error handling hook functionality
 */

import { renderHook, act } from '@testing-library/react';
import { message } from 'antd';
import useErrorHandler from '../../hooks/useErrorHandler';

// Mock Ant Design message
jest.mock('antd', () => ({
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

describe('useErrorHandler Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initial state is correct', () => {
    const { result } = renderHook(() => useErrorHandler());

    expect(result.current.errors).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.lastError).toBeNull();
  });

  test('handles API error correctly', () => {
    const { result } = renderHook(() => useErrorHandler());

    const apiError = new Error('API Error');
    apiError.response = {
      status: 400,
      data: { message: 'Bad Request' }
    };

    act(() => {
      result.current.handleAPIError(apiError);
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.lastError.error.message).toBe('Bad Request');
    expect(message.error).toHaveBeenCalledWith('Bad Request');
  });

  test('handles validation error correctly', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleValidationError('email', 'Invalid email format');
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.lastError.field).toBe('email');
    expect(message.error).toHaveBeenCalledWith('Invalid email format');
  });

  test('handles authentication error correctly', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleAuthError('Authentication failed');
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.lastError.requiresAuth).toBe(true);
    expect(message.error).toHaveBeenCalledWith('Authentication failed');
  });

  test('handles generic error correctly', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error('Generic error'));
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.lastError.error.type).toBe('UNKNOWN');
    expect(message.error).toHaveBeenCalledWith('An unexpected error occurred. Please try again.');
  });

  test('clears specific error', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleAPIError(new Error('Error 1'));
    });

    act(() => {
      result.current.handleAPIError(new Error('Error 2'));
    });

    expect(result.current.errors).toHaveLength(2);

    act(() => {
      result.current.clearError(result.current.errors[0].errorId);
    });

    expect(result.current.errors).toHaveLength(1);
  });

  test('clears all errors', () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleAPIError(new Error('Error 1'));
    });

    act(() => {
      result.current.handleAPIError(new Error('Error 2'));
    });

    expect(result.current.errors).toHaveLength(2);

    act(() => {
      result.current.clearAllErrors();
    });

    expect(result.current.errors).toEqual([]);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.lastError).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });

  test('executes async operation successfully', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const asyncFn = jest.fn().mockResolvedValue('success');

    let response;
    await act(async () => {
      response = await result.current.executeAsync(asyncFn);
    });

    expect(response).toEqual({ success: true, data: 'success' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasErrors).toBe(false);
    expect(asyncFn).toHaveBeenCalled();
  });

  test('handles async operation failure', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const asyncFn = jest.fn().mockRejectedValue(new Error('Async error'));

    let response;
    await act(async () => {
      response = await result.current.executeAsync(asyncFn);
    });

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasErrors).toBe(true);
    expect(message.error).toHaveBeenCalled();
  });

  test('sets loading state during async operation', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const asyncFn = jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve('success'), 100));
    });

    expect(result.current.isLoading).toBe(false);

    const promise = act(async () => {
      return result.current.executeAsync(asyncFn);
    });

    expect(result.current.isLoading).toBe(true);

    await promise;

    expect(result.current.isLoading).toBe(false);
  });

  test('retries operation when recoverable', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const asyncFn = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('success');

    const recoverableError = {
      shouldRetry: true,
      error: new Error('Network error')
    };

    jest.spyOn(result.current, 'handleAPIError').mockReturnValue(recoverableError);

    let response;
    await act(async () => {
      response = await result.current.executeAsync(asyncFn, {
        enableRetry: true
      });
    });

    expect(response.success).toBe(true);
    expect(asyncFn).toHaveBeenCalledTimes(2);
    expect(result.current.retryCount).toBe(1);
  });

  test('does not retry when not recoverable', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const asyncFn = jest.fn().mockRejectedValue(new Error('Validation error'));

    const nonRecoverableError = {
      shouldRetry: false,
      error: new Error('Validation error')
    };

    jest.spyOn(result.current, 'handleAPIError').mockReturnValue(nonRecoverableError);

    let response;
    await act(async () => {
      response = await result.current.executeAsync(asyncFn);
    });

    expect(response.success).toBe(false);
    expect(asyncFn).toHaveBeenCalledTimes(1);
    expect(result.current.retryCount).toBe(0);
  });

  test('retry functionality', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const retryFn = jest.fn().mockResolvedValue('success');

    // Add an error that is recoverable
    const recoverableError = {
      shouldRetry: true,
      error: new Error('Network error')
    };

    act(() => {
      result.current.handleAPIError(recoverableError);
    });

    let retryResult;
    await act(async () => {
      retryResult = await result.current.retry({
        retryFunction: retryFn
      });
    });

    expect(retryResult).toBe(true);
    expect(retryFn).toHaveBeenCalled();
    expect(result.current.retryCount).toBe(1);
    expect(result.current.hasErrors).toBe(false);
  });

  test('retry fails when no recoverable errors', async () => {
    const { result } = renderHook(() => useErrorHandler());

    let retryResult;
    await act(async () => {
      retryResult = await result.current.retry();
    });

    expect(retryResult).toBe(false);
    expect(result.current.retryCount).toBe(0);
  });
});
