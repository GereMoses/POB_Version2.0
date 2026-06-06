import React from 'react';

const MinimalTest = () => {
  return (
    <div style={{ padding: '24px' }}>
      <h1>Minimal Test Component</h1>
      <p>If you can see this, React is working.</p>
      <div style={{ 
        background: 'red', 
        color: 'white', 
        padding: '20px', 
        margin: '10px 0',
        borderRadius: '4px' 
      }}>
        This should be visible if React is rendering properly.
      </div>
      <h2>Current Time: {new Date().toLocaleString()}</h2>
      <p>URL: {window.location.href}</p>
    </div>
  );
};

export default MinimalTest;
