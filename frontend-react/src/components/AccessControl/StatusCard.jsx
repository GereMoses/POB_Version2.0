/**
 * Status Card Component for Access Control
 * Displays status information with visual indicators
 */

import React from 'react';
import { 
  CheckCircle, XCircle, AlertTriangle, Wifi, WifiOff, 
  Clock, TrendingUp, TrendingDown, Activity
} from 'lucide-react';

const StatusCard = ({ 
  title, 
  status, 
  description, 
  value, 
  maxValue = 100,
  unit = '',
  trend = 'neutral',
  icon: Icon,
  className = ''
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'text-green-600';
      case 'offline': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return TrendingUp;
      case 'down': return TrendingDown;
      default: return null;
    }
  };

  const getProgressBarColor = () => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    if (value >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getProgressBarWidth = (value) => {
    return `${Math.min(value, maxValue)}%`;
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
          {icon && (
            <Icon className={`w-5 h-5 mr-2 ${getStatusColor(status)}`} />
          )}
        </div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
      </div>
      
      {/* Status Indicator */}
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`}>
          {status === 'online' && <CheckCircle className="w-4 h-4 text-white" />}
          {status === 'offline' && <WifiOff className="w-4 h-4 text-white" />}
          {status === 'error' && <XCircle className="w-4 h-4 text-white" />}
        </div>
      </div>
      
      {/* Value Display */}
      {unit && (
        <div className="text-2xl font-bold text-gray-900">
          {value}
          <span className="text-sm text-gray-500 ml-2">{unit}</span>
        </div>
      )}
      
      {/* Progress Bar */}
      {maxValue > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className={`h-2 text-sm text-gray-600 mb-1`}
            style={{ width: getProgressBarWidth(value) }}
          >
            <div 
              className={`h-2 bg-${getProgressBarColor(value)} text-white rounded-full transition-all duration-500`}
              style={{ width: getProgressBarWidth(value) }}
            ></div>
          </div>
          <div className="text-center text-sm text-gray-600 mt-1">
            {value}{unit}
          </div>
        </div>
      )}
      
      {/* Trend Indicator */}
      {trend && (
        <div className="flex items-center">
          <span className="text-sm text-gray-600">vs yesterday</span>
          {getTrendIcon(trend) && (
            <getTrendIcon(trend)
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default StatusCard;
