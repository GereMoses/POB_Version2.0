import React from 'react';
import { Modal } from 'antd';

export const Dialog = ({ children, open, onOpenChange, ...props }) => (
  <Modal
    open={open}
    onCancel={() => onOpenChange?.(false)}
    footer={null}
    {...props}
  >
    {children}
  </Modal>
);

export const DialogContent = ({ children, ...props }) => <div {...props}>{children}</div>;
export const DialogHeader = ({ children, style, ...props }) => (
  <div style={{ marginBottom: 16, ...style }} {...props}>{children}</div>
);
export const DialogTitle = ({ children, style, ...props }) => (
  <h3 style={{ fontWeight: 600, fontSize: 16, margin: 0, ...style }} {...props}>{children}</h3>
);
export const DialogDescription = ({ children, style, ...props }) => (
  <p style={{ color: '#888', ...style }} {...props}>{children}</p>
);
export const DialogFooter = ({ children, style, ...props }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, ...style }} {...props}>{children}</div>
);
export const DialogTrigger = ({ children, asChild, ...props }) => <span {...props}>{children}</span>;
