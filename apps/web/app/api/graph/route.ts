// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { getGlobalGraphData } from '@/lib/graph-service';

// GET /api/graph — Get global graph data (all domains the user has access to)
export const GET = withAuth(async (request: NextRequest, user) => {
  const graphData = await getGlobalGraphData();

  return NextResponse.json(graphData, {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
    },
  });
});
