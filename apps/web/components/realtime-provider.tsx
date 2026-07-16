'use client';

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import { useRealtime, type RealtimeEvent } from '@/hooks/use-realtime';

type EventCallback = (event: RealtimeEvent) => void;

interface RealtimeContextType {
  connected: boolean;
  error: string | null;
  reconnect: () => void;
  disconnect: () => void;
  subscribe: (
    collections: string[],
    callback: EventCallback
  ) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const subscribersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const [, forceRender] = useState(0);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    const collection = event.collection || '*';
    const collectionSubs = subscribersRef.current.get(collection);
    const globalSubs = subscribersRef.current.get('*');

    if (collectionSubs) {
      collectionSubs.forEach((cb) => cb(event));
    }
    if (globalSubs) {
      globalSubs.forEach((cb) => cb(event));
    }
  }, []);

  const { connected, error, reconnect, disconnect } = useRealtime({
    onEvent: handleEvent,
  });

  const subscribe = useCallback(
    (collections: string[], callback: EventCallback) => {
      for (const collection of collections) {
        if (!subscribersRef.current.has(collection)) {
          subscribersRef.current.set(collection, new Set());
        }
        subscribersRef.current.get(collection)!.add(callback);
      }
      // Also register as a global subscriber
      if (!subscribersRef.current.has('*')) {
        subscribersRef.current.set('*', new Set());
      }
      subscribersRef.current.get('*')!.add(callback);

      forceRender((n) => n + 1);

      // Return unsubscribe function
      return () => {
        for (const collection of collections) {
          subscribersRef.current.get(collection)?.delete(callback);
        }
        subscribersRef.current.get('*')?.delete(callback);
        forceRender((n) => n + 1);
      };
    },
    []
  );

  return (
    <RealtimeContext.Provider
      value={{ connected, error, reconnect, disconnect, subscribe }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error(
      'useRealtimeContext must be used within a RealtimeProvider'
    );
  }
  return context;
}
