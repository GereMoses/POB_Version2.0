/**
 * Animated Button Component for Access Control
 * Provides smooth animations and hover effects
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

const AnimatedButton = ({ 
  children, 
  onClick, 
  loading = false, 
  variant = 'primary',
  size = 'default',
  className = '',
  disabled = false 
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);

  const getVariantClasses = () => {
    const baseClasses = 'px-4 py-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
    
    const variants = {
      primary: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 focus:ring-offset-2',
      secondary: 'bg-gray-200 hover:bg-gray-300 focus:ring-2 focus:ring-offset-2',
      success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 focus:ring-offset-2',
      danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 focus:ring-offset-2',
      outline: 'border-2 border-gray-300 hover:bg-gray-100 focus:ring-2 focus:ring-offset-2',
      ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
    };
    
    return `${baseClasses} ${variants[variant]} ${className}`;
  };

  const getLoadingClasses = () => {
    const loadingClasses = 'opacity-50 cursor-not-allowed';
    const spinnerClasses = 'animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent';
    
    if (loading) {
      return `${loadingClasses} ${spinnerClasses}`;
    }
    
    return `${baseClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      disabled={disabled || loading}
      className={`${getVariantClasses()} ${getLoadingClasses()} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-5 h-5" />
      ) : (
        children
      )}
    </button>
  );
};

export default AnimatedButton;
