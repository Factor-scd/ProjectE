// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { getNoteGraph } from '@/lib/services/note-service';

// GET /api/notes/graph — Get note graph data for visualization
export const GET = withAuth(async () => {
  const graph = await getNoteGraph();
  return NextResponse.json(graph, {
    headers: {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    },
  });
});
