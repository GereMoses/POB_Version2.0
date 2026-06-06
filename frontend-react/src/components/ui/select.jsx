import React, { useState } from 'react';
import { Select as AntSelect } from 'antd';

const SelectContext = React.createContext({ value: '', onChange: () => {} });

export const Select = ({ children, value, defaultValue, onValueChange, ...props }) => {
  const [internal, setInternal] = useState(defaultValue || '');
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const handleChange = (v) => {
    if (!controlled) setInternal(v);
    onValueChange?.(v);
  };

  // Collect SelectItem children
  const items = [];
  React.Children.forEach(children, (child) => {
    if (!child) return;
    if (child.type === SelectContent) {
      React.Children.forEach(child.props.children, (item) => {
        if (item?.type === SelectItem) {
          items.push({ value: item.props.value, label: item.props.children });
        }
      });
    }
  });

  return (
    <AntSelect value={current} onChange={handleChange} options={items} style={{ minWidth: 120 }} {...props} />
  );
};

export const SelectTrigger = ({ children, className, ...props }) => (
  <span className={className} style={{ display: 'none' }} {...props}>{children}</span>
);
export const SelectValue = ({ placeholder }) => <span>{placeholder}</span>;
export const SelectContent = ({ children, ...props }) => <span style={{ display: 'none' }} {...props}>{children}</span>;
export const SelectItem = ({ children, value, ...props }) => <span data-value={value} {...props}>{children}</span>;
