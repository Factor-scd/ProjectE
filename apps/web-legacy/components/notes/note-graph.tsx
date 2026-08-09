'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading graph...</p>
    </div>
  ),
});

interface Note {
  id: string;
  title: string;
  domain: string;
}

interface GraphNode {
  id: string;
  title: string;
  domain: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface NoteGraphProps {
  notes: Note[];
}

export function NoteGraph({ notes }: NoteGraphProps) {
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const graphRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 500 });

  useEffect(() => {
    fetchGraphData();
  }, []);

  useEffect(() => {
    if (graphRef.current) {
      const { width, height } = graphRef.current.getBoundingClientRect();
      setDimensions({ width: Math.floor(width) || 300, height: Math.floor(height) || 500 });
    }
  }, []);

  async function fetchGraphData() {
    try {
      const response = await fetch('/api/notes/graph');
      if (response.ok) {
        const data = await response.json();

        const nodes: GraphNode[] = (data.nodes || []).map(
          (node: { id: string; title: string; domain: string; connectionCount?: number }) => ({
            id: node.id,
            title: node.title,
            domain: node.domain,
            val: (node.connectionCount || 0) + 1,
          })
        );

        const links: GraphLink[] = (data.edges || []).map(
          (edge: { source: string; target: string }) => ({
            source: edge.source,
            target: edge.target,
          })
        );

        setGraphData({ nodes, links });
      }
    } catch (error) {
      console.error('Failed to fetch graph data:', error);
    }
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No graph data available</p>
      </div>
    );
  }

  return (
    <div ref={graphRef} className="h-[500px] w-full">
      <ForceGraph2D
        graphData={graphData}
        nodeLabel="title"
        nodeAutoColorBy="domain"
        nodeRelSize={6}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={0.99}
        onNodeClick={(node: Record<string, unknown>) => {
          console.log('Clicked node:', node);
        }}
        width={dimensions.width}
        height={dimensions.height}
      />
    </div>
  );
}
