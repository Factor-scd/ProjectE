import { useState, useRef, useCallback, useEffect } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { Search, ZoomIn, ZoomOut, RotateCcw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { GraphNode, GraphEdge } from "@/lib/types";

const ENTITY_TYPES = ["task", "habit", "project", "note", "section", "tag", "domain"];
const ENTITY_COLORS: Record<string, string> = {
  task: "#3b82f6",
  habit: "#10b981",
  project: "#8b5cf6",
  note: "#f59e0b",
  section: "#ec4899",
  tag: "#6b7280",
  domain: "#6366f1",
};

function GraphPage() {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useRealtime({ enabled: true });

  const { data: nodesData } = useApiQuery<{ items: GraphNode[]; totalItems: number }>(
    ["graph", "nodes"],
    "/graph/nodes?domain=placeholder"
  );

  const { data: edgesData } = useApiQuery<{ items: GraphEdge[]; totalItems: number }>(
    ["graph", "edges"],
    "/graph/edges?domain=placeholder"
  );

  const allNodes = nodesData?.items || [];
  const allEdges = edgesData?.items || [];

  const filteredNodes = allNodes.filter((n) => enabledTypes.has(n.type));
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = allEdges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

  const toggleType = (type: string) => {
    const next = new Set(enabledTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setEnabledTypes(next);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 md:-m-6">
      {/* Graph canvas area */}
      <div ref={containerRef} className="flex-1 relative bg-muted/20">
        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Find a node..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-64 bg-background/90 backdrop-blur"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setFilterOpen(true)} aria-label="Filters">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Graph visualization */}
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <svg width="400" height="400" viewBox="0 0 400 400" className="mx-auto mb-4">
              {/* Simple force-directed graph visualization */}
              {filteredEdges.map((edge, i) => {
                const source = filteredNodes.find((n) => n.id === edge.source);
                const target = filteredNodes.find((n) => n.id === edge.target);
                if (!source || !target) return null;
                // Simple circular layout
                const srcIdx = filteredNodes.indexOf(source);
                const tgtIdx = filteredNodes.indexOf(target);
                const total = filteredNodes.length;
                const angle1 = (2 * Math.PI * srcIdx) / Math.max(total, 1);
                const angle2 = (2 * Math.PI * tgtIdx) / Math.max(total, 1);
                const r = 150;
                const x1 = 200 + r * Math.cos(angle1);
                const y1 = 200 + r * Math.sin(angle1);
                const x2 = 200 + r * Math.cos(angle2);
                const y2 = 200 + r * Math.sin(angle2);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#333" strokeWidth={0.5} opacity={0.3} />;
              })}
              {filteredNodes.map((node, i) => {
                const total = filteredNodes.length;
                const angle = (2 * Math.PI * i) / Math.max(total, 1);
                const r = 150;
                const x = 200 + r * Math.cos(angle);
                const y = 200 + r * Math.sin(angle);
                return (
                  <g key={node.id} onClick={() => { setSelectedNode(node); setDetailOpen(true); }} style={{ cursor: "pointer" }}>
                    <circle cx={x} cy={y} r={6} fill={node.color || "#6b7280"} stroke="white" strokeWidth={2} />
                    <text x={x} y={y - 10} textAnchor="middle" fontSize={8} fill="currentColor" className="fill-foreground">
                      {node.label.length > 15 ? node.label.slice(0, 15) + "..." : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <p className="text-sm">
              {filteredNodes.length} nodes, {filteredEdges.length} edges
            </p>
            <p className="text-xs mt-1">
              Full interactive graph with react-force-graph-2d will be available in T8.
            </p>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="right" className="w-64">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <h3 className="text-sm font-semibold">Entity Types</h3>
            {ENTITY_TYPES.map((type) => (
              <div key={type} className="flex items-center gap-2">
                <Checkbox
                  id={"type-" + type}
                  checked={enabledTypes.has(type)}
                  onCheckedChange={() => toggleType(type)}
                />
                <Label htmlFor={"type-" + type} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ENTITY_COLORS[type] }} />
                  {type.charAt(0).toUpperCase() + type.slice(1)}s
                </Label>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Node detail panel */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>{selectedNode?.label || "Node"}</SheetTitle>
          </SheetHeader>
          {selectedNode && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color }} />
                <Badge variant="secondary">{selectedNode.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">ID: {selectedNode.id}</p>
              <Separator />
              <h4 className="text-sm font-semibold">Connected nodes</h4>
              <div className="space-y-1">
                {filteredEdges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e, i) => {
                    const connectedId = e.source === selectedNode.id ? e.target : e.source;
                    const connected = allNodes.find((n) => n.id === connectedId);
                    return connected ? (
                      <div key={i} className="flex items-center gap-2 text-sm py-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: connected.color }} />
                        <span className="truncate">{connected.label}</span>
                        <Badge variant="outline" className="text-[10px]">{e.type}</Badge>
                      </div>
                    ) : null;
                  })}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/graph",
  component: GraphPage,
});
