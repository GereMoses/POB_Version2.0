import React from 'react';
import { Card, Button, Alert } from 'antd';
import apiService from './services/api';

const DebugTest = () => {
  const [testResults, setTestResults] = React.useState({});

  const runTests = async () => {
    const results = {};
    
    // Test 1: Check if token exists
    const token = localStorage.getItem('authToken');
    results.tokenExists = !!token;
    results.tokenValue = token ? `${token.substring(0, 20)}...` : 'none';
    
    // Test 2: Test API service
    try {
      const response = await apiService.get('/api/v1/departments/');
      results.apiCall = 'SUCCESS';
      results.apiData = response;
    } catch (error) {
      results.apiCall = 'ERROR';
      results.apiError = error.message;
    }
    
    // Test 3: Test direct fetch
    try {
      const directResponse = await fetch('/api/v1/departments/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      results.directCall = 'SUCCESS';
      results.directStatus = directResponse.status;
      results.directData = await directResponse.json();
    } catch (error) {
      results.directCall = 'ERROR';
      results.directError = error.message;
    }
    
    setTestResults(results);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title="Debug Test" style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={runTests}>
          Run Debug Tests
        </Button>
      </Card>
      
      {Object.keys(testResults).length > 0 && (
        <Card title="Test Results">
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </Card>
      )}
      
      <Card title="Common Issues">
        <Alert
          message="If all pages are blank, check:"
          description={
            <ul>
              <li>Browser console for JavaScript errors</li>
              <li>Network tab for failed API calls</li>
              <li>Authentication token in localStorage</li>
              <li>CORS errors in browser console</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Card>
    </div>
  );
};

export default DebugTest;
