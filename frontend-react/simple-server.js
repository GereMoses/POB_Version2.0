const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

// Simple HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // API proxy to backend
  if (parsedUrl.pathname.startsWith('/api')) {
    const targetUrl = `http://localhost:8000${parsedUrl.pathname}${parsedUrl.search}`;
    
    const options = {
      method: req.method,
      headers: {
        ...req.headers,
        host: 'localhost:8000'
      }
    };
    
    const proxyReq = require('http').request(targetUrl, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (error) => {
      console.error('Proxy error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error' }));
    });
    
    if (req.method !== 'GET') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
    
    return;
  }
  
  // Serve static files
  let filePath = path.join(__dirname, 'public', parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - Not Found</h1>');
      return;
    }
    
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    }[ext] || 'text/plain';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 POB Frontend running on http://localhost:${PORT}`);
  console.log(`📡 Proxying API calls to http://localhost:8000`);
  console.log(`⚡ Instant startup - No build process required!`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please close the other application and try again.`);
  } else {
    console.error('❌ Server error:', error);
  }
});
