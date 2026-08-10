import { useState, useEffect, useRef } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { Bot, Filter, Calendar, RefreshCw, ExternalLink, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState } from "@/components/state";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Agent, AgentActivity, PaginatedResponse } from "@/lib/types";
import { format, parseISO } from "date-fns";

const ACTION_TYPES = [
  { id: "created", label: "Created", color: "bg-green-500" },
  { id: "updated", label: "Updated", color: "bg-blue-500" },
  { id: "deleted", label: "Deleted", color: "bg-red-500" },
  { id: "completed", label: "Completed", color: "bg-purple-500" },
];

function AgentActivityPage() {
  const queryClient = useQueryClient();
  const [agentFilter, setAgentFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [liveActivities, setLiveActivities] = useState<AgentActivity[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const activeDomainId = useApiDomain();

  // Keep latest filters reachable from the SSE effect without reconnecting.
  const filtersRef = useRef({ agentFilter, actionFilter, dateFrom, dateTo });
  filtersRef.current = { agentFilter, actionFilter, dateFrom, dateTo };

  // Live entries are transient and never filtered server-side, so clear them
  // whenever the user changes any filter.
  useEffect(() => {
    setLiveActivities([]);
  }, [agentFilter, actionFilter, dateFrom, dateTo]);

  // Fetch agents for filter dropdown
  const { data: agentsData } = useApiQuery<PaginatedResponse<Agent>>(["agents-list", activeDomainId], "/agents" + (activeDomainId ? "?domain=" + activeDomainId : ""));
  const agents = agentsData?.items || [];

  // Build query params
  const params = new URLSearchParams({ limit: "100" });
  if (activeDomainId) params.set("domain", activeDomainId);
  if (agentFilter && agentFilter !== "all") params.set("agentId", agentFilter);
  if (actionFilter && actionFilter !== "all") params.set("action", actionFilter);
  if (dateFrom) params.set("from", dateFrom);
  if (dateTo) params.set("to", dateTo);

  const { data: activityData, isLoading } = useApiQuery<{ items: AgentActivity[]; totalItems: number }>(
    ["agent-activity", agentFilter, actionFilter, dateFrom, dateTo],
    "/agents/" + (agentFilter && agentFilter !== "all" ? agentFilter : "_all") + "/activity?" + params.toString()
  );

  const activities = [...liveActivities, ...(activityData?.items || [])];

  // SSE for live updates
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeDomainId) params.set("workspace_id", activeDomainId);
    const es = new EventSource("/api/realtime" + (params.toString() ? "?" + params.toString() : ""));
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Realtime events are flat: { type: entityType, action, id, workspace_id }.
        // Match only agent events for the active workspace so unrelated task/habit
        // etc. activity (or another workspace's events) doesn't leak in.
        if (data.type !== "agent") return;
        if (activeDomainId && data.workspace_id !== activeDomainId) return;

        const { agentFilter, actionFilter, dateFrom, dateTo } = filtersRef.current;
        if (agentFilter && agentFilter !== "all" && data.id !== agentFilter) return;
        if (actionFilter && actionFilter !== "all" && data.action !== actionFilter) return;
        const now = new Date();
        const nowKey = now.toISOString().slice(0, 10);
        if (dateFrom && nowKey < dateFrom) return;
        if (dateTo && nowKey > dateTo) return;

        const entry: AgentActivity = {
          id: `${data.id}-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          agentId: data.id,
          action: data.action,
          description: `Live update: ${data.action}`,
          entityType: "agent",
          entityId: data.id,
          metadata: null,
          createdAt: now.toISOString(),
        };
        setLiveActivities((prev) => [entry, ...prev].slice(0, 5));
      } catch {}
    };
    es.onerror = () => {};
    return () => { es.close(); };
  }, [activeDomainId]);

  const getActionColor = (action: string) => {
    const found = ACTION_TYPES.find((a) => a.id === action);
    return found?.color || "bg-slate-500";
  };

  const getAgentName = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || "Unknown Agent";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agent Activity</h1>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["agent-activity"] })}>
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-44">
            <Bot className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-36">
            <Activity className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTION_TYPES.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-9" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-9" placeholder="To" />
      </div>

      {/* Timeline */}
      {isLoading ? (
        <LoadingState label="Loading activity..." />
      ) : activities.length === 0 ? (
        <EmptyState title="No activity found" description="Agent activity will appear here as agents run" />
      ) : (
        <div className="space-y-1">
          {activities.map((a, idx) => (
            <div key={a.id || idx} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex flex-col items-center shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getAgentName(a.agentId).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {idx < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{getAgentName(a.agentId)}</span>
                  <div className={cn("w-1.5 h-1.5 rounded-full", getActionColor(a.action))} />
                  <span className="text-sm text-muted-foreground">{a.action}</span>
                  <Badge variant="outline" className="text-[10px]">{a.entityType}</Badge>
                </div>
                {a.description && <p className="text-sm text-muted-foreground mt-0.5">{a.description}</p>}
                {!a.description && a.details && Object.keys(a.details).length > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5">{JSON.stringify(a.details)}</p>
                )}
                {a.errorMessage && <p className="text-sm text-destructive mt-0.5">{a.errorMessage}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{format(parseISO(a.createdAt), "MMM d, HH:mm:ss")}</span>
                  {a.entityId && (
                    <span className="text-xs text-muted-foreground">
                      <ExternalLink className="h-3 w-3 inline mr-0.5" />
                      {a.entityId.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/agents/activity",
  component: AgentActivityPage,
});
