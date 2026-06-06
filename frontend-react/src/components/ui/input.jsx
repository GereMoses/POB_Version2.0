import React from 'react';
import { Input as AntInput } from 'antd';

export const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <AntInput ref={ref} type={type} className={className} {...props} />
));
Input.displayName = 'Input';
