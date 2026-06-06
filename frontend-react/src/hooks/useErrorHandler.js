/**
 * Custom hook for error handling
 * Provides centralized error handling for React components
 */

import { useState, useCallback } from 'react';
import { message } from 'antd';
import { ErrorHandler, ErrorNotifier, ErrorRecovery } from '../utils/errorHandling';

export const useErrorHandler = (options = {}) => {
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Handle API errors
  const handleAPIError = useCallback((error, context = {}) => {
    const errorResult = ErrorHandler.handleAPIError(error, context);
    
    setErrors(prev => [...prev, errorResult]);
    ErrorNotifier.showError(errorResult);
    
    return errorResult;
  }, []);

  // Handle validation errors
  const handleValidationError = useCallback((field, message, details = null) => {
    const errorResult = ErrorHandler.handleValidationError(field, message, details);
    
    setErrors(prev => [...prev, errorResult]);
    ErrorNotifier.showError(errorResult);
    
    return errorResult;
  }, []);

  // Handle authentication errors
  const handleAuthError = useCallback((message, details = null) => {
    const errorResult = ErrorHandler.handleAuthError(message, details);
    
    setErrors(prev => [...prev, errorResult]);
    ErrorNotifier.showError(errorResult);
    
    return errorResult;
  }, []);

  // Handle generic errors
  const handleError = useCallback((error, context = {}) => {
    const errorResult = ErrorHandler.handleError(error, context);
    
    setErrors(prev => [...prev, errorResult]);
    ErrorNotifier.showError(errorResult);
    
    return errorResult;
  }, []);

  // Clear specific error
  const clearError = useCallback((errorId) => {
    setErrors(prev => prev.filter(e => e.errorId !== errorId));
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors([]);
    setRetryCount(0);
  }, []);

  // Execute async operation with error handling
  const executeAsync = useCallback(async (asyncFn, options = {}) => {
    setIsLoading(true);
    clearAllErrors();
    
    try {
      const result = await asyncFn();
      setRetryCount(0);
      return { success: true, data: result };
    } catch (error) {
      const errorResult = handleAPIError(error, options.context);
      
      // Attempt recovery if possible
      if (ErrorRecovery.isRecoverable(errorResult) && options.enableRetry !== false) {
        try {
          await ErrorRecovery.executeRecovery(errorResult, {
            retryFunction: () => executeAsync(asyncFn, { ...options, enableRetry: false }),
            ...options.recoveryOptions
          });
          setRetryCount(prev => prev + 1);
        } catch (recoveryError) {
          // Recovery failed
          console.error('Recovery failed:', recoveryError);
        }
      }
      
      return { success: false, error: errorResult };
    } finally {
      setIsLoading(false);
    }
  }, [handleAPIError, clearAllErrors]);

  // Retry last failed operation
  const retry = useCallback(async () => {
    if (errors.length > 0) {
      const lastError = errors[errors.length - 1];
      if (ErrorRecovery.isRecoverable(lastError)) {
        try {
          await ErrorRecovery.executeRecovery(lastError, {
            retryFunction: options.retryFunction
          });
          setRetryCount(prev => prev + 1);
          clearAllErrors();
          return true;
        } catch (error) {
          console.error('Retry failed:', error);
          return false;
        }
      }
    }
    return false;
  }, [errors, options.retryFunction, clearAllErrors]);

  return {
    errors,
    isLoading,
    retryCount,
    handleAPIError,
    handleValidationError,
    handleAuthError,
    handleError,
    clearError,
    clearAllErrors,
    executeAsync,
    retry,
    hasErrors: errors.length > 0,
    lastError: errors[errors.length - 1] || null
  };
};

export default useErrorHandler;
