import { useState, useEffect, useRef } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { Bot, Filter, Calendar, RefreshCw, ExternalLink, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  // Fetch agents for filter dropdown
  const { data: agentsData } = useApiQuery<PaginatedResponse<Agent>>(["agents-list"], "/agents");
  const agents = agentsData?.items || [];

  // Build query params
  const params = new URLSearchParams({ limit: "100" });
  if (agentFilter) params.set("agentId", agentFilter);
  if (actionFilter) params.set("action", actionFilter);
  if (dateFrom) params.set("from", dateFrom);
  if (dateTo) params.set("to", dateTo);

  const { data: activityData, isLoading } = useApiQuery<{ items: AgentActivity[]; totalItems: number }>(
    ["agent-activity", agentFilter, actionFilter, dateFrom, dateTo],
    "/agents/" + (agentFilter || "_all") + "/activity?" + params.toString()
  );

  const activities = [...liveActivities, ...(activityData?.items || [])];

  // SSE for live updates
  useEffect(() => {
    const es = new EventSource("/api/realtime");
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "agent_activity" || data.type === "activity") {
          setLiveActivities((prev) => [data.payload, ...prev].slice(0, 5));
        }
      } catch {}
    };
    es.onerror = () => {};
    return () => { es.close(); };
  }, []);

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
            <SelectItem value=" ">All agents</SelectItem>
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
            <SelectItem value=" ">All actions</SelectItem>
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
        <div className="flex items-center justify-center py-12 text-muted-foreground">Loading activity...</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No activity found</div>
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
