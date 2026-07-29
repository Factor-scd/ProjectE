// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { getBacklinks } from '@/lib/services/note-service';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/notes/[id]/backlinks — Get notes that link to this note
export const GET = withAuth<RouteContext>(
  async (request: NextRequest, _user, context) => {
    const { id } = await context!.params;
    const backlinks = await getBacklinks(id);

    return NextResponse.json({
      items: backlinks,
      totalItems: backlinks.length,
    });
  }
);
