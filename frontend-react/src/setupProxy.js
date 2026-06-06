const { createProxyMiddleware } = require('http-proxy-middleware');

// Inside Docker: BACKEND_URL=http://pob_backend:8000
// Outside Docker (local dev): defaults to http://localhost:8000
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

module.exports = function (app) {
  const onError = (err, req, res) => {
    console.error(`[Proxy] Error forwarding ${req.method} ${req.url} to ${backendUrl}:`, err.message);
    if (res.writeHead) res.status(502).json({ error: 'Backend unavailable', detail: err.message });
  };

  // HTTP-only proxy for backend REST paths.
  // ws: true is intentionally absent — all app WebSocket connections use explicit ws://host:8000/...
  // URLs and connect directly to the backend, bypassing this proxy. Adding ws: true here would
  // install a global upgrade listener that intercepts the webpack HMR socket at /ws.
  const backendProxy = createProxyMiddleware({
    target: backendUrl,
    changeOrigin: true,
    autoRewrite: true,
    logLevel: 'warn',
    onError,
  });

  // WebSocket proxy — ONLY for /ws/<subpath> (e.g. /ws/device/status, /ws/mustering/events/1)
  // Deliberately excludes the bare /ws path which webpack-dev-server uses for its own HMR socket
  const wsProxy = createProxyMiddleware(
    (pathname) => /^\/ws\/.+/.test(pathname),
    {
      target: backendUrl,
      changeOrigin: true,
      ws: true,
      logLevel: 'warn',
      onError,
    }
  );

  app.use('/api', backendProxy);   // /api/v1/*, /api/emergency/*, /api/meeting/*, /api/visitor/*, etc.
  app.use('/health', backendProxy);
  app.use('/iclock', backendProxy);
  app.use(wsProxy);                // /ws/<subpath> only — does NOT intercept CRA HMR at /ws
};
