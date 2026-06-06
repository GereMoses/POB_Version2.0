import React from 'react';
import { Input } from 'antd';

export const Textarea = React.forwardRef(({ className, rows = 4, ...props }, ref) => (
  <Input.TextArea ref={ref} rows={rows} className={className} {...props} />
));
Textarea.displayName = 'Textarea';
