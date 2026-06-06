import React from 'react';
import { Button as AntButton } from 'antd';

const VARIANT_MAP = {
  default: 'default',
  destructive: 'danger',
  outline: 'default',
  secondary: 'default',
  ghost: 'text',
  link: 'link',
};

const SIZE_MAP = {
  default: 'middle',
  sm: 'small',
  lg: 'large',
  icon: 'small',
};

export const Button = ({ children, variant = 'default', size = 'default', className, ...props }) => (
  <AntButton
    type={variant === 'destructive' ? 'primary' : variant === 'ghost' || variant === 'link' ? variant : 'default'}
    danger={variant === 'destructive'}
    size={SIZE_MAP[size] || 'middle'}
    className={className}
    {...props}
  >
    {children}
  </AntButton>
);
