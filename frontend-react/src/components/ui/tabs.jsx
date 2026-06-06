import React, { useState } from 'react';
import { Tabs as AntTabs } from 'antd';

const TabsContext = React.createContext({ activeKey: '', setActiveKey: () => {} });

export const Tabs = ({ children, defaultValue, value, onValueChange, className, ...props }) => {
  const [internal, setInternal] = useState(defaultValue || '');
  const activeKey = value !== undefined ? value : internal;
  const setActiveKey = (k) => {
    setInternal(k);
    onValueChange?.(k);
  };

  // Collect TabsContent children to build AntTabs items
  const items = [];
  const triggerLabels = {};

  React.Children.forEach(children, (child) => {
    if (!child) return;
    if (child.type === TabsList) {
      React.Children.forEach(child.props.children, (trigger) => {
        if (trigger?.type === TabsTrigger) {
          triggerLabels[trigger.props.value] = trigger.props.children;
        }
      });
    }
  });

  React.Children.forEach(children, (child) => {
    if (!child) return;
    if (child.type === TabsContent) {
      items.push({
        key: child.props.value,
        label: triggerLabels[child.props.value] || child.props.value,
        children: child.props.children,
      });
    }
  });

  return (
    <TabsContext.Provider value={{ activeKey, setActiveKey }}>
      <AntTabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={items}
        className={className}
        {...props}
      />
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className, ...props }) => (
  <div className={className} style={{ display: 'none' }} {...props}>{children}</div>
);

export const TabsTrigger = ({ children, value, className, ...props }) => (
  <span data-value={value} className={className} {...props}>{children}</span>
);

export const TabsContent = ({ children, value, className, ...props }) => (
  <div data-value={value} className={className} {...props}>{children}</div>
);
