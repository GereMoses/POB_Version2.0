import React from 'react';

export const Label = ({ children, htmlFor, style, className, ...props }) => (
  <label
    htmlFor={htmlFor}
    style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4, ...style }}
    className={className}
    {...props}
  >
    {children}
  </label>
);
