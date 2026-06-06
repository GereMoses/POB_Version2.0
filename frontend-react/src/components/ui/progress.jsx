import React from 'react';
import { Progress as AntProgress } from 'antd';

export const Progress = ({ value = 0, className, ...props }) => (
  <AntProgress percent={value} showInfo={false} className={className} {...props} />
);
