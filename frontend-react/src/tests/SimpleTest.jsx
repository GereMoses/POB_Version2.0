import React, { useState, useEffect } from 'react';
import { Card, Button, Spin, Alert } from 'antd';

const SimpleTest = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Test basic fetch
        const token = localStorage.getItem('authToken');
        console.log('Token found:', !!token);
        
        const response = await fetch('/api/v1/departments/', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response error:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Response data:', result);
        
        setData(result);
        setLoading(false);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <Card title="Simple API Test" style={{ marginBottom: 16 }}>
        <Spin spinning={loading}>
          {error && (
            <Alert
              message="Error"
              description={error}
              type="error"
              style={{ marginBottom: 16 }}
            />
          )}
          
          {data ? (
            <div>
              <h3>API Response:</h3>
              <pre style={{ background: '#f5f5f5', padding: '16px', borderRadius: '4px' }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          ) : (
            <p>No data loaded yet...</p>
          )}
        </Spin>
      </Card>
      
      <Card title="Debug Info">
        <p><strong>Token exists:</strong> {localStorage.getItem('authToken') ? 'Yes' : 'No'}</p>
        <p><strong>Current URL:</strong> {window.location.href}</p>
        <p><strong>API Base:</strong> /api/v1/departments/</p>
      </Card>
    </div>
  );
};

export default SimpleTest;
