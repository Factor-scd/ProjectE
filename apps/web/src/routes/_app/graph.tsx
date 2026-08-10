import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery } from "@/lib/api";
import { useActiveDomainId } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { Search, ZoomIn, ZoomOut, RotateCcw, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState } from "@/components/state";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { GraphNode, GraphEdge } from "@/lib/types";
import ForceGraph2D from "react-force-graph-2d";

const ENTITY_TYPES = ["task", "habit", "project", "note", "section", "tag", "domain"];
const RELATIONSHIP_TYPES = ["depends_on", "related_to", "part_of", "references", "parent_of", "child_of", "connects_to"];

const ENTITY_COLORS: Record<string, string> = {
  task: "#3b82f6",
  habit: "#10b981",
  project: "#8b5cf6",
  note: "#f59e0b",
  section: "#ec4899",
  tag: "#6b7280",
  domain: "#6366f1",
};

// Graph node types that have a detail page. section/tag/domain nodes appear in
// the graph but have no detail route, so they are intentionally absent.
const NODE_TYPE_ROUTES: Record<string, string> = {
  task: "/tasks/$id",
  habit: "/habits/$id",
  project: "/projects/$id",
  note: "/notes/$id",
};

const MAX_NODES = 500;

function GraphPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(undefined);
  // Simulated node positions, keyed by node id. react-force-graph assigns x/y to
  // the node objects it renders during the simulation; the raw API nodes
  // (displayNodes) never gain coordinates, so fly-to must look here instead.
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(new Set(ENTITY_TYPES));
  const [enabledRelationships, setEnabledRelationships] = useState<Set<string>>(new Set(RELATIONSHIP_TYPES));
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);

  useRealtime({ enabled: true });

  // ResizeObserver for reactive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { data: domainsData } = useApiQuery<{ items: { id: string; name: string }[] }>(
    ["domains"],
    "/domains"
  );
  // Use the active domain from the store, falling back to the first domain
  // while unset. Validate against the fetched list so a persisted id that no
  // longer exists doesn't produce a query for a deleted domain.
  const storedDomainId = useActiveDomainId();
  const activeDomainId =
    (storedDomainId && domainsData?.items?.some((d) => d.id === storedDomainId) ? storedDomainId : null) ||
    domainsData?.items?.[0]?.id ||
    "";

  const { data: nodesData, isLoading: nodesLoading } = useApiQuery<{ items: GraphNode[]; totalItems: number }>(
    ["graph", "nodes", activeDomainId],
    "/graph/nodes?domain=" + activeDomainId,
    { enabled: !!activeDomainId }
  );

  const { data: edgesData } = useApiQuery<{ items: GraphEdge[]; totalItems: number }>(
    ["graph", "edges", activeDomainId],
    "/graph/edges?domain=" + activeDomainId,
    { enabled: !!activeDomainId }
  );

  const allNodes = nodesData?.items || [];
  const allEdges = edgesData?.items || [];

  // Filter by entity type
  const filteredNodes = allNodes.filter((n) => enabledTypes.has(n.type));
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = allEdges.filter(
    (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target) && enabledRelationships.has(e.type)
  );

  // Performance cap
  const displayNodes = filteredNodes.slice(0, MAX_NODES);
  const displayNodeIds = new Set(displayNodes.map((n) => n.id));
  const displayEdges = filteredEdges.filter(
    (e) => displayNodeIds.has(e.source) && displayNodeIds.has(e.target)
  );
  const exceeded = filteredNodes.length > MAX_NODES;

  // Graph data for react-force-graph-2d
  const graphData = useMemo(() => ({
    nodes: displayNodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      color: n.color || ENTITY_COLORS[n.type] || "#6b7280",
    })),
    links: displayEdges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
    })),
  }), [displayNodes, displayEdges]);

  // Hover highlight: connected nodes/edges
  const highlightNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>([hoveredNode.id]);
    displayEdges.forEach((e) => {
      if (e.source === hoveredNode.id) connected.add(e.target);
      if (e.target === hoveredNode.id) connected.add(e.source);
    });
    return connected;
  }, [hoveredNode, displayEdges]);

  const highlightLinks = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>();
    displayEdges.forEach((e) => {
      if (e.source === hoveredNode.id || e.target === hoveredNode.id) {
        connected.add(`${e.source}-${e.target}`);
      }
    });
    return connected;
  }, [hoveredNode, displayEdges]);

  const toggleType = (type: string) => {
    const next = new Set(enabledTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setEnabledTypes(next);
  };

  const toggleRelationship = (type: string) => {
    const next = new Set(enabledRelationships);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setEnabledRelationships(next);
  };

  // Search: fly to node
  const trackNodePosition = useCallback((node: any) => {
    if (node && typeof node.x === "number" && typeof node.y === "number") {
      positionsRef.current.set(String(node.id), { x: node.x, y: node.y });
    }
  }, []);

  // Snapshot every simulated node's position once the force simulation settles.
  const snapshotPositions = useCallback(() => {
    const nodes = graphRef.current?.graphData()?.nodes;
    if (!nodes) return;
    for (const node of nodes) {
      trackNodePosition(node);
    }
  }, [trackNodePosition]);

  const handleSearch = useCallback(() => {
    if (!search.trim() || !graphRef.current) return;
    const found = displayNodes.find(
      (n) => n.label.toLowerCase().includes(search.toLowerCase())
    );
    if (!found) return;
    const pos = positionsRef.current.get(found.id);
    if (pos) {
      graphRef.current.centerAt(pos.x, pos.y, 1000);
      graphRef.current.zoom(3, 1000);
    } else {
      // No coordinates yet (e.g. simulation still warming up) — fit the view instead.
      graphRef.current.zoomToFit(1000, 50);
    }
  }, [search, displayNodes]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  // Node click → side panel
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as GraphNode);
    setDetailOpen(true);
  }, []);

  // Close the detail panel and navigate to the node's detail page when one
  // exists (task/habit/project/note). No-ops for types without a detail route.
  const handleOpenEntity = useCallback((node: GraphNode) => {
    const to = NODE_TYPE_ROUTES[node.type];
    if (!to) return;
    setDetailOpen(false);
    navigate({ to, params: { id: node.id } });
  }, [navigate]);

  // Node hover → highlight
  const handleNodeHover = useCallback((node: any | null) => {
    setHoveredNode(node as GraphNode | null);
  }, []);

  // Custom node renderer
  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isHighlighted = highlightNodes.size === 0 || highlightNodes.has(node.id);
      const isHovered = hoveredNode?.id === node.id;
      const label = node.label || "";
      const fontSize = Math.max(8, 12 / globalScale);
      const radius = isHovered ? 8 : 6;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isHighlighted ? node.color : `${node.color}33`;
      ctx.fill();
      ctx.strokeStyle = isHovered ? "#fff" : "#fff";
      ctx.lineWidth = isHovered ? 2 / globalScale : 1 / globalScale;
      ctx.stroke();

      // Label below node
      ctx.font = `${fontSize}px Sans-Serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = isHighlighted
        ? (document.documentElement.classList.contains("dark") ? "#e2e8f0" : "#1e293b")
        : "#94a3b8";
      const displayLabel = label.length > 15 ? label.slice(0, 15) + "…" : label;
      ctx.fillText(displayLabel, node.x, node.y + radius + 2);
    },
    [highlightNodes, hoveredNode]
  );

  // Custom link renderer with arrows
  const linkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isHighlighted = highlightLinks.size === 0 || highlightLinks.has(`${link.source.id}-${link.target.id}`);
      const width = isHighlighted ? 1.5 / globalScale : 0.5 / globalScale;
      const opacity = isHighlighted ? 0.6 : 0.1;

      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`;
      ctx.lineWidth = width;
      ctx.stroke();

      // Arrow at midpoint
      if (isHighlighted && globalScale > 0.5) {
        const midX = (link.source.x + link.target.x) / 2;
        const midY = (link.source.y + link.target.y) / 2;
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const ux = dx / len;
          const uy = dy / len;
          const arrowSize = 4 / globalScale;
          ctx.beginPath();
          ctx.moveTo(midX + ux * arrowSize, midY + uy * arrowSize);
          ctx.lineTo(midX - ux * arrowSize + uy * arrowSize * 0.5, midY - uy * arrowSize - ux * arrowSize * 0.5);
          ctx.lineTo(midX - ux * arrowSize - uy * arrowSize * 0.5, midY - uy * arrowSize + ux * arrowSize * 0.5);
          ctx.closePath();
          ctx.fillStyle = `rgba(148, 163, 184, ${opacity})`;
          ctx.fill();
        }
      }
    },
    [highlightLinks]
  );

  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      const newZoom = Math.min(graphRef.current.zoom() * 1.3, 10);
      graphRef.current.zoom(newZoom, 400);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      const newZoom = Math.max(graphRef.current.zoom() / 1.3, 0.1);
      graphRef.current.zoom(newZoom, 400);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  }, []);

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 md:-m-6">
      {/* Graph canvas area */}
      <div ref={containerRef} className="flex-1 relative bg-muted/20">
        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Find a node..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-8 w-40 sm:w-64 bg-background/90 backdrop-blur"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setFilterOpen(true)} aria-label="Filters">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
          <Button variant="secondary" size="icon" onClick={handleZoomIn} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={handleZoomOut} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={handleReset} aria-label="Reset view">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Performance warning */}
        {exceeded && (
          <div className="absolute top-4 right-4 z-10">
            <Badge variant="destructive" className="text-xs">
              Showing {MAX_NODES} of {filteredNodes.length} nodes (cap reached)
            </Badge>
          </div>
        )}

        {/* Force graph */}
        {activeDomainId && nodesLoading ? (
          <LoadingState label="Loading graph..." />
        ) : displayNodes.length === 0 ? (
          <EmptyState
            title="No graph data yet"
            description="Create tasks, habits, or projects to see them connected here"
          />
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeCanvasObject={nodeCanvasObject}
            linkCanvasObject={linkCanvasObject}
            linkDirectionalArrowLength={0}
            linkDirectionalArrowRelPos={0.5}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onNodeDrag={trackNodePosition}
            onEngineStop={snapshotPositions}
            nodeRelSize={6}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            cooldownTicks={100}
            warmupTicks={40}
            backgroundColor="transparent"
          />
        )}
      </div>

      {/* Filter panel */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="right" className="w-72">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6 pt-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">Entity Types</h3>
                {ENTITY_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={"type-" + type}
                      checked={enabledTypes.has(type)}
                      onCheckedChange={() => toggleType(type)}
                    />
                    <Label htmlFor={"type-" + type} className="flex items-center gap-2 text-sm cursor-pointer">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ENTITY_COLORS[type] }} />
                      {type.charAt(0).toUpperCase() + type.slice(1)}s
                    </Label>
                  </div>
                ))}
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">Relationship Types</h3>
                {RELATIONSHIP_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={"rel-" + type}
                      checked={enabledRelationships.has(type)}
                      onCheckedChange={() => toggleRelationship(type)}
                    />
                    <Label htmlFor={"rel-" + type} className="text-sm cursor-pointer">
                      {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
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
              {NODE_TYPE_ROUTES[selectedNode.type] ? (
                <Button
                  className="w-full"
                  onClick={() => handleOpenEntity(selectedNode)}
                >
                  Open {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No detail page for {selectedNode.type}
                </p>
              )}
              <Separator />
              <h4 className="text-sm font-semibold">Connected nodes</h4>
              <div className="space-y-1">
                {displayEdges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e, i) => {
                    const connectedId = e.source === selectedNode.id ? e.target : e.source;
                    const connected = allNodes.find((n) => n.id === connectedId);
                    return connected ? (
                      <div key={i} className="flex items-center gap-2 text-sm py-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: connected.color }} />
                        {NODE_TYPE_ROUTES[connected.type] ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEntity(connected)}
                            className="truncate flex-1 text-left hover:underline"
                          >
                            {connected.label}
                          </button>
                        ) : (
                          <>
                            <span className="truncate flex-1">{connected.label}</span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              No detail page for {connected.type}
                            </span>
                          </>
                        )}
                        <Badge variant="outline" className="text-[10px]">{e.type.replace(/_/g, " ")}</Badge>
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
