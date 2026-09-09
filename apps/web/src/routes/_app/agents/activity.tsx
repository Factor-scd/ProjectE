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

const AGENT_COLORS = [
  "bg-cyan-500", "bg-amber-500", "bg-violet-500", "bg-rose-500",
  "bg-emerald-500", "bg-orange-500", "bg-sky-500", "bg-pink-500",
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

  const getAgentColor = (agentId: string) => {
    const idx = agents.findIndex((a) => a.id === agentId);
    return AGENT_COLORS[idx >= 0 ? idx % AGENT_COLORS.length : 0];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Agent Activity</h1>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["agent-activity"] })}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-44 h-8">
            <Bot className="h-3.5 w-3.5 mr-1.5" />
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
          <SelectTrigger className="w-36 h-8">
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTION_TYPES.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-8 font-mono text-xs" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-8 font-mono text-xs" placeholder="To" />
      </div>

      {/* Timeline */}
      {isLoading ? (
        <LoadingState label="Loading activity..." />
      ) : activities.length === 0 ? (
        <EmptyState title="No activity found" description="Agent activity will appear here as agents run" />
      ) : (
        <div className="border rounded-lg divide-y divide-border">
          {activities.map((a, idx) => (
            <div key={a.id || idx} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/20 transition-colors">
              {/* Colored agent indicator */}
              <div className="flex flex-col items-center shrink-0 pt-0.5">
                <div className={cn("w-2 h-2 rounded-full", getAgentColor(a.agentId))} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{getAgentName(a.agentId)}</span>
                  <span className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded",
                    getActionColor(a.action) + "/15",
                    "text-foreground"
                  )}>
                    {a.action}
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">{a.entityType}</Badge>
                </div>
                {a.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.description}</p>}
                {!a.description && a.details && Object.keys(a.details).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{JSON.stringify(a.details)}</p>
                )}
                {a.errorMessage && <p className="text-xs text-destructive mt-0.5">{a.errorMessage}</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{format(parseISO(a.createdAt), "MMM d, HH:mm:ss")}</span>
                  {a.entityId && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      <ExternalLink className="h-2.5 w-2.5 inline mr-0.5" />
                      {a.entityId.slice(0, 8)}
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
