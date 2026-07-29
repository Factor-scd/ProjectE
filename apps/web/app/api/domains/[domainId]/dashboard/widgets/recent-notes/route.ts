// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess } from '@/lib/auth';
import { db, notes } from '@project-e/db';
import { and, desc, eq, isNull } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/dashboard/widgets/recent-notes
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const items = await db.select({
    id: notes.id,
    title: notes.title,
    updatedAt: notes.updatedAt,
    isPinned: notes.isPinned,
  })
    .from(notes)
    .where(and(
      eq(notes.domainId, domainId),
      eq(notes.isArchived, false),
      isNull(notes.deletedAt),
    ))
    .orderBy(desc(notes.updatedAt))
    .limit(5);

  return NextResponse.json({ items });
});
