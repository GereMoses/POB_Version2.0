import React from 'react';
import { Tag } from 'antd';

const VARIANT_COLOR = {
  default: 'default',
  secondary: 'blue',
  destructive: 'red',
  outline: 'default',
  success: 'green',
  warning: 'orange',
};

export const Badge = ({ children, variant = 'default', className, ...props }) => (
  <Tag color={VARIANT_COLOR[variant] || 'default'} className={className} {...props}>
    {children}
  </Tag>
);
