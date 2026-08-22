import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import type { RealtimeEvent } from "@/lib/types";

const API_BASE = "/api";

interface UseRealtimeOptions {
  workspaceId?: string;
  enabled?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { workspaceId: explicitWorkspace, enabled = true } = options;
  // Default to the user's active domain so clients never receive (or act on)
  // events from other workspaces. Callers can still pin a specific workspace.
  const activeDomainId = useApiDomain();
  const workspaceId = explicitWorkspace || activeDomainId || undefined;
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const handleEvent = useCallback(
    (event: RealtimeEvent) => {
      const entityType = event.type;
      const queryKeys: string[][] = [];

      switch (entityType) {
        case "task":
          // Singular keys (e.g. ["task", id]) refresh open detail pages live.
          queryKeys.push(["tasks"], ["task"], ["tasks-due"], ["stats"], ["productivity-chart"], ["analytics-daily"], ["analytics-projects"]);
          break;
        case "habit":
          queryKeys.push(["habits"], ["habit"], ["habits-today"], ["streaks"], ["analytics-habits"]);
          break;
        case "project":
          queryKeys.push(["projects"], ["project"], ["active-projects"], ["analytics-projects"]);
          break;
        case "note":
          queryKeys.push(["notes"], ["note"], ["recent-notes"]);
          break;
        case "calendar_event":
          queryKeys.push(["calendar-events"], ["upcoming-events"]);
          break;
        case "dashboard_widget":
          queryKeys.push(["dashboard-widgets"]);
          break;
        case "daily_note":
          queryKeys.push(["daily-notes-list"], ["daily-note"]);
          break;
        case "agent":
          queryKeys.push(["agents"], ["agents-list"], ["agent-activity"]);
          break;
        case "webhook":
          queryKeys.push(["webhooks"]);
          break;
        case "custom_field":
          queryKeys.push(["custom-fields"]);
          break;
        case "section":
        case "member":
          queryKeys.push(["projects"]);
          break;
        case "comment":
        case "attachment":
          queryKeys.push(["tasks"], ["task"]);
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
