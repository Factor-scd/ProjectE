import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeEvent } from "@/lib/types";

const API_BASE = "/api";

interface UseRealtimeOptions {
  workspaceId?: string;
  enabled?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { workspaceId, enabled = true } = options;
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempts = useRef(0);

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      const entityType = event.type;
      const queryKeys: string[][] = [];

      switch (entityType) {
        case "task":
          queryKeys.push(["tasks"]);
          break;
        case "habit":
          queryKeys.push(["habits"]);
          break;
        case "project":
          queryKeys.push(["projects"]);
          break;
        case "note":
          queryKeys.push(["notes"]);
          break;
        case "calendar_event":
          queryKeys.push(["calendar-events"]);
          break;
        case "graph_edge":
          queryKeys.push(["graph"]);
          break;
        default:
          queryKeys.push([entityType]);
      }

      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [queryClient]
  );

  useEffect(() => {
    if (!enabled) return;

    const connect = () => {
      const params = new URLSearchParams();
      if (workspaceId) params.set("workspace_id", workspaceId);

      const url = `${API_BASE}/realtime${params.toString() ? "?" + params.toString() : ""}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        reconnectAttempts.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RealtimeEvent;
          if (data.type === "connected") return;
          handleEvent(data);
        } catch {
          // Ignore malformed messages
        }
      };

      es.onerror = () => {
        es.close();
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [workspaceId, enabled, handleEvent]);
}
