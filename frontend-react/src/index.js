import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Suppress antd's findDOMNode deprecation warnings — these come from antd v5 internals
// (Tooltip, ResizeObserver) and are not actionable in user code.
if (process.env.NODE_ENV === 'development') {
  const origError = console.error.bind(console);
  const origWarn  = console.warn.bind(console);
  const suppress  = (msg) =>
    msg.includes('findDOMNode') ||
    msg.includes('findHostInstanceWithWarning') ||
    msg.includes('[antd]') ||
    msg.includes('deprecated usage');
  console.error = (...args) => {
    const msg = String(args[0] ?? '');
    if (suppress(msg)) return;
    origError(...args);
  };
  console.warn = (...args) => {
    const msg = String(args[0] ?? '');
    if (suppress(msg)) return;
    origWarn(...args);
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
