import React from 'react';
import { Alert as AntAlert } from 'antd';

const VARIANT_TYPE = {
  default: 'info',
  destructive: 'error',
  warning: 'warning',
  success: 'success',
};

export const Alert = ({ children, variant = 'default', className, title, ...props }) => (
  <AntAlert
    type={VARIANT_TYPE[variant] || 'info'}
    message={title}
    description={children}
    className={className}
    showIcon
    style={{ marginBottom: 8 }}
    {...props}
  />
);

export const AlertTitle = ({ children, ...props }) => (
  <strong {...props}>{children}</strong>
);

export const AlertDescription = ({ children, ...props }) => (
  <span {...props}>{children}</span>
);
