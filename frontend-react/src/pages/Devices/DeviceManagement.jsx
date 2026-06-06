/**
 * Legacy DeviceManagement Component
 * This file now redirects to the new consolidated Device module
 * Maintained for backward compatibility
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

const DeviceManagement = () => {
  // Redirect to the new consolidated Device module
  return <Navigate to="/device" replace />;
};

export default DeviceManagement;
