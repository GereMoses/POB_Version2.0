/**
 * SSE hook — opens a persistent connection to /api/v1/notifications/stream
 * and delivers real-time notification events to the caller.
 *
 * Reconnects automatically with exponential backoff on disconnect.
 * Usage:
 *   const { latest } = useNotificationStream();
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const BASE_BACKOFF = 3000;
const MAX_BACKOFF  = 60000;

const useNotificationStream = ({ enabled = true } = {}) => {
  const [latest, setLatest] = useState(null);
  const esRef     = useRef(null);
  const backoffRef = useRef(BASE_BACKOFF);
  const timerRef  = useRef(null);

  const connect = useCallback(async () => {
    if (!enabled) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    // Obtain a short-lived single-use ticket so the full JWT never appears in URL logs.
    // Falls back to ?token= if the ticket endpoint is unavailable.
    let streamUrl;
    try {
      const res = await fetch('/api/v1/auth/sse-ticket', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { ticket } = await res.json();
        streamUrl = `/api/v1/notifications/stream?ticket=${encodeURIComponent(ticket)}`;
      }
    } catch (_) { /* fall through to token fallback */ }

    if (!streamUrl) {
      streamUrl = `/api/v1/notifications/stream?token=${encodeURIComponent(token)}`;
    }

    const es = new EventSource(streamUrl);
    esRef.current = es;

    es.onopen = () => {
      backoffRef.current = BASE_BACKOFF; // reset on success
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'connected') {
          setLatest(data);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      timerRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
        connect();
      }, backoffRef.current);
    };
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (timerRef.current) { clearTimeout(timerRef.current); }
    };
  }, [connect]);

  return { latest };
};

export default useNotificationStream;
