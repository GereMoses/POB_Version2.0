import React, { createContext, useContext, useReducer, useEffect } from 'react';
import authService from '../services/authService';

// Initial state
const initialState = {
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null,
  permissions: [],
  loginStats: {
    loginCount: 0,
    lastLogin: null,
    failedAttempts: 0,
    isBlocked: false
  }
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  VALIDATE_SESSION: 'VALIDATE_SESSION',
  UPDATE_USER: 'UPDATE_USER',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_LOGIN_STATS: 'UPDATE_LOGIN_STATS'
};

// Reducer function
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        loading: false,
        error: null,
        permissions: action.payload.permissions || []
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false,
        error: action.payload,
        permissions: []
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null,
        permissions: []
      };

    case AUTH_ACTIONS.VALIDATE_SESSION:
      return {
        ...state,
        isAuthenticated: action.payload.valid,
        user: action.payload.user,
        loading: false,
        permissions: action.payload.permissions || []
      };

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case AUTH_ACTIONS.UPDATE_LOGIN_STATS:
      return {
        ...state,
        loginStats: action.payload
      };

    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if user is already authenticated
        if (authService.isAuthenticated()) {
          // Validate existing session
          const sessionValid = await authService.validateSession();
          if (sessionValid) {
            const user = authService.getCurrentUser();
            const permissions = authService.getUserPermissions();
            const loginStats = authService.getLoginStats();

            dispatch({
              type: AUTH_ACTIONS.VALIDATE_SESSION,
              payload: { valid: true, user, permissions }
            });

            dispatch({
              type: AUTH_ACTIONS.UPDATE_LOGIN_STATS,
              payload: loginStats
            });
          } else {
            // Clear invalid session
            authService.clearSession();
            dispatch({
              type: AUTH_ACTIONS.LOGOUT
            });
          }
        } else {
          // No existing session
          dispatch({
            type: AUTH_ACTIONS.VALIDATE_SESSION,
            payload: { valid: false, user: null, permissions: [] }
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        dispatch({
          type: AUTH_ACTIONS.LOGIN_FAILURE,
          payload: 'Failed to initialize authentication'
        });
      }
    };

    initializeAuth();
  }, []);

  // Action creators
  const login = async (credentials) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const result = await authService.login(credentials);
      
      if (result.success) {
        const permissions = authService.getUserPermissions();
        const loginStats = authService.getLoginStats();

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user: result.user, permissions }
        });

        dispatch({
          type: AUTH_ACTIONS.UPDATE_LOGIN_STATS,
          payload: loginStats
        });
      } else {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_FAILURE,
          payload: result.error
        });
      }
    } catch (error) {
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: error.message || 'Login failed'
      });
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  const updateUser = (userData) => {
    dispatch({
      type: AUTH_ACTIONS.UPDATE_USER,
      payload: userData
    });
  };

  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const hasRole = (role) => {
    return authService.hasRole(role);
  };

  const hasAnyRole = (roles) => {
    return authService.hasAnyRole(roles);
  };

  const hasPermission = (permission) => {
    return authService.hasPermission(permission);
  };

  const canAccessModule = (module) => {
    return authService.canAccessModule(module);
  };

  const updateLoginStats = () => {
    const loginStats = authService.getLoginStats();
    dispatch({
      type: AUTH_ACTIONS.UPDATE_LOGIN_STATS,
      payload: loginStats
    });
  };

  const value = {
    ...state,
    login,
    logout,
    updateUser,
    clearError,
    hasRole,
    hasAnyRole,
    hasPermission,
    canAccessModule,
    updateLoginStats,
    // Convenience getters
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    loading: state.loading,
    error: state.error,
    permissions: state.permissions,
    loginStats: state.loginStats
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component for protected routes
export const withAuth = (Component) => {
  const WithAuthComponent = (props) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f0f2f5'
        }}>
          <div>Loading authentication...</div>
        </div>
      );
    }

    if (!isAuthenticated) {
      // Redirect to login or handle as needed
      return <div>Please log in to access this page.</div>;
    }

    return <Component {...props} />;
  };

  return WithAuthComponent;
};

export { AuthContext, AUTH_ACTIONS };
