'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ZoomIn, ZoomOut, RotateCcw, Filter } from 'lucide-react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading graph...</p>
    </div>
  ),
});

interface GraphNode {
  id: string;
  label: string;
  type: string;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  task: '#3b82f6',
  habit: '#10b981',
  project: '#8b5cf6',
  note: '#f59e0b',
  section: '#ec4899',
  tag: '#6b7280',
  domain: '#6366f1',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  task: 'Tasks',
  habit: 'Habits',
  project: 'Projects',
  note: 'Notes',
  section: 'Sections',
  tag: 'Tags',
  domain: 'Domains',
};

export default function GraphPage() {
  const router = useRouter();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set(['task', 'habit', 'project', 'note', 'section', 'tag', 'domain']));
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Fetch domains
  useEffect(() => {
    fetch('/api/domains?sort=sort_order')
      .then((res) => res.json())
      .then((data) => {
        const items = data.items || [];
        setDomains(items);
        if (items.length > 0 && !domainId) {
          setDomainId(items[0].id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch graph data
  useEffect(() => {
    if (domainId) {
      fetchGraphData();
    }
  }, [domainId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update dimensions on resize
  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.floor(width) || 800, height: Math.floor(height) || 600 });
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function fetchGraphData() {
    if (!domainId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/domains/${domainId}/graph`);
      if (!response.ok) throw new Error('Unable to load graph data.');
      const data = await response.json();
      // Convert edges to links for react-force-graph-2d
      setGraphData({
        nodes: data.nodes || [],
        links: (data.edges || []).map((e: any) => ({
          source: e.source,
          target: e.target,
          type: e.type,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch graph data:', error);
      setError('Unable to load graph data.');
    } finally {
      setLoading(false);
    }
  }

  const toggleFilterType = useCallback((type: string) => {
    setFilterTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Filter nodes and links
  const filteredData = {
    nodes: graphData.nodes.filter(
      (n) => filterTypes.has(n.type) && (!searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    links: graphData.links.filter(
      (l) => {
        const sourceNode = graphData.nodes.find((n) => n.id === l.source);
        const targetNode = graphData.nodes.find((n) => n.id === l.target);
        return sourceNode && targetNode && filterTypes.has(sourceNode.type) && filterTypes.has(targetNode.type);
      }
    ),
  };

  function handleNodeClick(node: any) {
    const n = node as GraphNode;
    switch (n.type) {
      case 'task':
        router.push(`/tasks?taskId=${n.id}`);
        break;
      case 'habit':
        router.push(`/habits?habitId=${n.id}`);
        break;
      case 'project':
        router.push(`/projects/${n.id}`);
        break;
      case 'note':
        router.push(`/notes?noteId=${n.id}`);
        break;
      case 'domain':
        router.push(`/dashboard?domainId=${n.id}`);
        break;
      default:
        break;
    }
  }

  function handleZoomIn() {
    if (graphRef.current) {
      const current = graphRef.current.zoom();
      graphRef.current.zoom(current * 1.3, 400);
    }
  }

  function handleZoomOut() {
    if (graphRef.current) {
      const current = graphRef.current.zoom();
      graphRef.current.zoom(current / 1.3, 400);
    }
  }

  function handleReset() {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  }

  if (loading && graphData.nodes.length === 0) {
    return <p className="text-muted-foreground" role="status">Loading graph...</p>;
  }

  if (error) {
    return <div className="space-y-3"><p className="text-muted-foreground" role="alert">{error}</p><Button onClick={fetchGraphData}>Retry</Button></div>;
  }

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Graph</h1>
          <p className="mt-1 text-muted-foreground">
            Visualize connections between all your entities
          </p>
        </div>
        <div className="flex items-center gap-2">
          {domains.length > 1 && (
            <select
              value={domainId || ''}
              onChange={(e) => setDomainId(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              aria-label="Select domain"
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <Button variant="outline" size="icon" onClick={handleZoomIn} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleReset} aria-label="Reset view">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4">
        {/* Filter sidebar */}
        <Card className="w-56 shrink-0 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            {Object.entries(ENTITY_TYPE_LABELS).map(([type, label]) => (
              <button
                key={type}
                onClick={() => toggleFilterType(type)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  filterTypes.has(type) ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ENTITY_TYPE_COLORS[type] }}
                />
                <span className="flex-1 text-left">{label}</span>
                <Badge variant="outline" className="text-[10px] px-1">
                  {graphData.nodes.filter((n) => n.type === type).length}
                </Badge>
              </button>
            ))}
          </div>
          <div className="mt-4 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {filteredData.nodes.length} nodes · {filteredData.links.length} edges
            </p>
          </div>
        </Card>

        {/* Graph canvas */}
        <Card className="flex-1 overflow-hidden" ref={containerRef}>
          {filteredData.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No matching nodes found' : 'No graph data available'}
              </p>
            </div>
          ) : (
            <div className="relative h-full w-full">
              <ForceGraph2D
                ref={graphRef}
                graphData={filteredData}
                nodeLabel="label"
                nodeColor="color"
                nodeVal={(node: any) => {
                  const edgeCount = filteredData.links.filter(
                    (e) => e.source === node.id || e.target === node.id
                  ).length;
                  return Math.max(2, Math.min(edgeCount + 2, 20));
                }}
                linkColor={() => '#374151'}
                linkWidth={0.5}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={0.99}
                onNodeClick={(node: any) => handleNodeClick(node)}
                onNodeHover={(node: any | null) => {
                  if (node) {
                    setHoveredNode(node as GraphNode);
                  } else {
                    setHoveredNode(null);
                  }
                }}
                width={dimensions.width}
                height={dimensions.height}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                cooldownTicks={100}
                warmupTicks={40}
              />

              {/* Tooltip */}
              {hoveredNode && (
                <div
                  className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border bg-background p-3 shadow-lg"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: hoveredNode.color }}
                    />
                    <span className="text-sm font-medium">{hoveredNode.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Type: {ENTITY_TYPE_LABELS[hoveredNode.type] || hoveredNode.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ID: {hoveredNode.id.slice(0, 8)}...
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
