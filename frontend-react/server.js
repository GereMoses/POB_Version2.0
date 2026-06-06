const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API proxy to backend
app.use('/api', (req, res) => {
  const targetUrl = `http://localhost:8000${req.originalUrl}`;
  fetch(targetUrl, {
    method: req.method,
    headers: req.headers,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  }).then(response => {
    res.status(response.status);
    response.headers.forEach((value, name) => {
      res.set(name, value);
    });
    return response.text();
  }).then(body => {
    res.send(body);
  }).catch(error => {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  });
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 POB Frontend running on http://localhost:${PORT}`);
  console.log(`📡 Proxying API calls to http://localhost:8000`);
});
