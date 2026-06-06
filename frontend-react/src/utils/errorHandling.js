/**
 * Frontend Error Handling Utilities
 * Comprehensive error handling, logging, and recovery mechanisms
 */

import { message, notification } from 'antd';

// Error types
export const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  API: 'API',
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  SERVER: 'SERVER',
  CLIENT: 'CLIENT',
  UNKNOWN: 'UNKNOWN'
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Custom error class
export class AppError extends Error {
  constructor(message, type = ERROR_TYPES.UNKNOWN, severity = ERROR_SEVERITY.MEDIUM, details = null, code = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.details = details;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

// Network error class
export class NetworkError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_TYPES.NETWORK, ERROR_SEVERITY.HIGH, details);
    this.name = 'NetworkError';
  }
}

// API error class
export class APIError extends AppError {
  constructor(message, status = null, details = null, code = null) {
    const severity = status >= 500 ? ERROR_SEVERITY.HIGH : ERROR_SEVERITY.MEDIUM;
    super(message, ERROR_TYPES.API, severity, details, code);
    this.name = 'APIError';
    this.status = status;
  }
}

// Validation error class
export class ValidationError extends AppError {
  constructor(message, field = null, details = null) {
    super(message, ERROR_TYPES.VALIDATION, ERROR_SEVERITY.MEDIUM, details);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// Authentication error class
export class AuthenticationError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_TYPES.AUTHENTICATION, ERROR_SEVERITY.HIGH, details);
    this.name = 'AuthenticationError';
  }
}

// Authorization error class
export class AuthorizationError extends AppError {
  constructor(message, details = null) {
    super(message, ERROR_TYPES.AUTHORIZATION, ERROR_SEVERITY.MEDIUM, details);
    this.name = 'AuthorizationError';
  }
}

// Error logger
class ErrorLogger {
  constructor() {
    this.errors = [];
    this.maxLogSize = 1000;
  }

  // Log error
  log(error, context = {}) {
    const errorLog = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: error.type || ERROR_TYPES.UNKNOWN,
      severity: error.severity || ERROR_SEVERITY.MEDIUM,
      message: error.message,
      details: error.details,
      code: error.code,
      stack: error.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errors.unshift(errorLog);
    
    // Keep only recent errors
    if (this.errors.length > this.maxLogSize) {
      this.errors = this.errors.slice(0, this.maxLogSize);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', errorLog);
    }

    // Send to error tracking service (if configured)
    this.sendToErrorService(errorLog);

    return errorLog.id;
  }

  // Generate unique error ID
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Send error to external service
  async sendToErrorService(errorLog) {
    // In production, send to error tracking service like Sentry, LogRocket, etc.
    if (process.env.NODE_ENV === 'production' && window.ERROR_TRACKING_URL) {
      try {
        await fetch(window.ERROR_TRACKING_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(errorLog)
        });
      } catch (e) {
        console.warn('Failed to send error to tracking service:', e);
      }
    }
  }

  // Get error statistics
  getStats() {
    const stats = {
      total: this.errors.length,
      byType: {},
      bySeverity: {},
      recent: this.errors.slice(0, 10)
    };

    this.errors.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  // Clear error log
  clear() {
    this.errors = [];
  }
}

// Global error logger instance
export const errorLogger = new ErrorLogger();

// Error handler utility
export const ErrorHandler = {
  // Handle API errors
  handleAPIError(error, context = {}) {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;
      
      let errorMessage = 'An error occurred';
      let errorType = ERROR_TYPES.API;
      let errorCode = data?.error || data?.code;
      let errorDetails = data?.details || data?.errors;

      // Handle specific error codes
      switch (status) {
        case 400:
          errorMessage = data?.message || 'Invalid request data';
          errorType = ERROR_TYPES.VALIDATION;
          break;
        case 401:
          errorMessage = 'Authentication required';
          errorType = ERROR_TYPES.AUTHENTICATION;
          break;
        case 403:
          errorMessage = 'Access denied';
          errorType = ERROR_TYPES.AUTHORIZATION;
          break;
        case 404:
          errorMessage = 'Resource not found';
          break;
        case 422:
          errorMessage = data?.message || 'Validation failed';
          errorType = ERROR_TYPES.VALIDATION;
          break;
        case 429:
          errorMessage = 'Too many requests. Please try again later.';
          break;
        case 500:
          errorMessage = 'Server error. Please try again later.';
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = 'Service unavailable. Please try again later.';
          break;
        default:
          errorMessage = data?.message || `Request failed with status ${status}`;
      }

      const apiError = new APIError(errorMessage, status, errorDetails, errorCode);
      const errorId = errorLogger.log(apiError, { ...context, status, response: data });
      
      return {
        error: apiError,
        errorId,
        userMessage: errorMessage,
        shouldRetry: status >= 500 || status === 429,
        requiresAuth: status === 401
      };

    } else if (error.request) {
      // Request was made but no response received
      const networkError = new NetworkError('Network error. Please check your connection.', {
        url: error.config?.url,
        method: error.config?.method
      });
      
      const errorId = errorLogger.log(networkError, context);
      
      return {
        error: networkError,
        errorId,
        userMessage: 'Network error. Please check your connection.',
        shouldRetry: true,
        requiresAuth: false
      };

    } else {
      // Request setup error
      const clientError = new AppError(error.message, ERROR_TYPES.CLIENT, ERROR_SEVERITY.MEDIUM, {
        config: error.config
      });
      
      const errorId = errorLogger.log(clientError, context);
      
      return {
        error: clientError,
        errorId,
        userMessage: 'Request failed. Please try again.',
        shouldRetry: false,
        requiresAuth: false
      };
    }
  },

  // Handle validation errors
  handleValidationError(field, message, details = null) {
    const validationError = new ValidationError(message, field, details);
    const errorId = errorLogger.log(validationError, { field });
    
    return {
      error: validationError,
      errorId,
      userMessage: message,
      field,
      shouldRetry: false,
      requiresAuth: false
    };
  },

  // Handle authentication errors
  handleAuthError(message = 'Authentication failed', details = null) {
    const authError = new AuthenticationError(message, details);
    const errorId = errorLogger.log(authError);
    
    return {
      error: authError,
      errorId,
      userMessage: message,
      shouldRetry: false,
      requiresAuth: true
    };
  },

  // Handle generic errors
  handleError(error, context = {}) {
    if (error instanceof AppError) {
      const errorId = errorLogger.log(error, context);
      return {
        error,
        errorId,
        userMessage: error.message,
        shouldRetry: error.type === ERROR_TYPES.NETWORK,
        requiresAuth: error.type === ERROR_TYPES.AUTHENTICATION
      };
    } else {
      const genericError = new AppError(error.message || 'An unexpected error occurred', ERROR_TYPES.UNKNOWN, ERROR_SEVERITY.MEDIUM, { originalError: error });
      const errorId = errorLogger.log(genericError, context);
      
      return {
        error: genericError,
        errorId,
        userMessage: 'An unexpected error occurred. Please try again.',
        shouldRetry: false,
        requiresAuth: false
      };
    }
  }
};

// Error notification system
export const ErrorNotifier = {
  // Show error message
  showError(errorResult, duration = 5) {
    if (errorResult?.requiresAuth) {
      // Authentication errors need special handling
      notification.error({
        message: 'Authentication Required',
        description: errorResult.userMessage,
        duration,
        placement: 'topRight'
      });
    } else if (errorResult?.error?.severity === ERROR_SEVERITY.CRITICAL) {
      // Critical errors
      notification.error({
        message: 'Critical Error',
        description: errorResult.userMessage,
        duration: 0, // Don't auto-close
        placement: 'topRight'
      });
    } else {
      // Regular errors
      message.error(errorResult.userMessage, duration);
    }
  },

  // Show warning message
  showWarning(message, duration = 3) {
    message.warning(message, duration);
  },

  // Show success message
  showSuccess(message, duration = 3) {
    message.success(message, duration);
  },

  // Show info message
  showInfo(message, duration = 3) {
    message.info(message, duration);
  }
};

// Error boundary component
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    
    // Log the error
    errorLogger.log(error, {
      component: 'ErrorBoundary',
      errorInfo
    });

    // Show error notification
    ErrorNotifier.showError({
      error,
      userMessage: 'A critical error occurred. The application has been reset.',
      requiresAuth: false
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '50px',
          textAlign: 'center',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h2>Something went wrong</h2>
          <p>We apologize for the inconvenience. The application has encountered an error.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '20px', textAlign: 'left' }}>
              <summary>Error Details</summary>
              <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Retry mechanism with exponential backoff
export const RetryManager = {
  // Execute function with retry logic
  async executeWithRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors or authentication errors
        if (error.type === ERROR_TYPES.CLIENT || error.type === ERROR_TYPES.AUTHENTICATION) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  },

  // Create retryable API call
  createRetryableAPICall(apiCall, maxRetries = 3) {
    return (...args) => {
      return this.executeWithRetry(() => apiCall(...args), maxRetries);
    };
  }
};

// Error recovery utilities
export const ErrorRecovery = {
  // Check if error is recoverable
  isRecoverable(errorResult) {
    return errorResult?.shouldRetry || false;
  },

  // Get recovery action
  getRecoveryAction(errorResult) {
    if (errorResult?.requiresAuth) {
      return 'AUTHENTICATE';
    } else if (errorResult?.shouldRetry) {
      return 'RETRY';
    } else if (errorResult?.error?.type === ERROR_TYPES.VALIDATION) {
      return 'VALIDATE';
    } else {
      return 'CONTACT_SUPPORT';
    }
  },

  // Execute recovery action
  async executeRecovery(errorResult, options = {}) {
    const action = this.getRecoveryAction(errorResult);
    
    switch (action) {
      case 'AUTHENTICATE':
        if (options.onAuthRequired) {
          options.onAuthRequired();
        } else {
          // Redirect to login
          window.location.href = '/login';
        }
        break;
        
      case 'RETRY':
        if (options.retryFunction) {
          try {
            return await options.retryFunction();
          } catch (e) {
            throw e;
          }
        }
        break;
        
      case 'VALIDATE':
        if (options.onValidationError) {
          options.onValidationError(errorResult.error);
        }
        break;
        
      case 'CONTACT_SUPPORT':
        ErrorNotifier.showInfo('Please contact support if the problem persists.');
        break;
        
      default:
        // Default action
        break;
    }
  }
};

// Global error handler for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const error = new AppError(
      event.message,
      ERROR_TYPES.CLIENT,
      ERROR_SEVERITY.HIGH,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    );
    errorLogger.log(error, { unhandled: true });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const error = new AppError(
      event.reason?.message || 'Unhandled promise rejection',
      ERROR_TYPES.CLIENT,
      ERROR_SEVERITY.HIGH,
      { reason: event.reason }
    );
    errorLogger.log(error, { unhandled: true, promiseRejection: true });
  });
}

export default {
  ErrorHandler,
  ErrorLogger,
  ErrorNotifier,
  ErrorBoundary,
  RetryManager,
  ErrorRecovery,
  ERROR_TYPES,
  ERROR_SEVERITY,
  AppError,
  NetworkError,
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError
};
