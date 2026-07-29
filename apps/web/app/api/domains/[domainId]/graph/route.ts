// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess } from '@/lib/auth';
import { getGraphData } from '@/lib/graph-service';

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/graph — Get graph data for one domain
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const graphData = await getGraphData(domainId);

  return NextResponse.json(graphData, {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
    },
  });
});
