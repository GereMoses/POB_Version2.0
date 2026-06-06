import React from 'react';
import { Card as AntCard } from 'antd';

export const Card = ({ children, className, style, ...props }) => (
  <AntCard style={style} className={className} {...props}>{children}</AntCard>
);

export const CardHeader = ({ children, style, ...props }) => (
  <div style={{ marginBottom: 12, ...style }} {...props}>{children}</div>
);

export const CardTitle = ({ children, style, ...props }) => (
  <h3 style={{ fontWeight: 600, fontSize: 16, margin: 0, ...style }} {...props}>{children}</h3>
);

export const CardContent = ({ children, style, ...props }) => (
  <div style={style} {...props}>{children}</div>
);

export const CardDescription = ({ children, style, ...props }) => (
  <p style={{ color: '#888', margin: '4px 0 0', ...style }} {...props}>{children}</p>
);
