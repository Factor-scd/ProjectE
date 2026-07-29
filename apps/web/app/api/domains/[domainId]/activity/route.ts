// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse } from '@/lib/auth';
import { db, activityFeed } from '@project-e/db';
import { and, desc, eq, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/activity — List activity feed for a workspace
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get('entity_type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  const conditions: any[] = [eq(activityFeed.workspaceId, domainId)];

  if (entityType) {
    conditions.push(eq(activityFeed.entityType, entityType));
  }

  const [items, countResult] = await Promise.all([
    db.select()
      .from(activityFeed)
      .where(and(...conditions))
      .orderBy(desc(activityFeed.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(activityFeed)
      .where(and(...conditions)),
  ]);

  return NextResponse.json({
    items,
    totalItems: Number(countResult[0]?.count || 0),
    limit,
    offset,
  });
});
