'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface RealtimeEvent {
  type: string;
  collection?: string;
  record?: Record<string, unknown>;
}

interface UseRealtimeOptions {
  collections?: string[];
  onEvent?: (event: RealtimeEvent) => void;
  enabled?: boolean;
}

const MAX_RETRY_DELAY = 30000; // 30 seconds max
const INITIAL_RETRY_DELAY = 1000; // 1 second initial
const MAX_RETRIES = 10;

export function useRealtime({
  collections,
  onEvent,
  enabled = true,
}: UseRealtimeOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;

    // Close existing connection
    cleanup();

    const params = new URLSearchParams();
    if (collections && collections.length > 0) {
      params.set('collections', collections.join(','));
    }

    const url = `/api/realtime?${params.toString()}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeEvent;

        if (data.type === 'connected') {
          setConnected(true);
          setError(null);
          retryCountRef.current = 0; // Reset on successful connection
        }

        onEventRef.current?.(data);
      } catch {
        // Ignore parse errors (e.g., ping comments)
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      setError('Connection lost');

      if (!mountedRef.current) return;

      // Exponential backoff reconnection
      const retryCount = retryCountRef.current;
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
          MAX_RETRY_DELAY
        );
        retryCountRef.current = retryCount + 1;

        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      } else {
        setError('Connection failed — max retries reached');
      }
    };

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
      retryCountRef.current = 0;
    };
  }, [collections, enabled, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    setConnected(false);
    retryCountRef.current = MAX_RETRIES; // Prevent auto-reconnect
  }, [cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  return { connected, error, reconnect: connect, disconnect };
}
