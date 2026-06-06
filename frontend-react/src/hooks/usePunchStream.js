import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Connects to the backend SSE punch stream and invalidates attendance
 * query caches the instant a new punch arrives — giving <1 s update latency.
 *
 * Usage:  call usePunchStream() in any component that should react to live punches.
 */
const STREAM_BASE = '/api/v1/attendance/punch-stream';
const RECONNECT_DELAY_MS = 3000;

function getStreamUrl() {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  return token ? `${STREAM_BASE}?token=${encodeURIComponent(token)}` : STREAM_BASE;
}

export function usePunchStream() {
  const qc = useQueryClient();
  const esRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;

    function connect() {
      if (!active) return;

      const es = new EventSource(getStreamUrl());
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'ping') return;

          // A real punch arrived — refresh all attendance data immediately
          qc.invalidateQueries({ queryKey: ['att-transactions'] });
          qc.invalidateQueries({ queryKey: ['attendance-dashboard-stats'] });
          qc.invalidateQueries({ queryKey: ['att-timesheet'] });
          qc.invalidateQueries({ queryKey: ['att-timesheet-summary'] });
        } catch (_) {}
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (active) {
          timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    }

    connect();

    return () => {
      active = false;
      clearTimeout(timerRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [qc]);
}
