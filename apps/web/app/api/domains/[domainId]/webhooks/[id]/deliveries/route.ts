// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse } from '@/lib/auth';
import { db, webhooks, webhookDeliveries } from '@project-e/db';
import { and, desc, eq, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// GET /api/domains/[domainId]/webhooks/[id]/deliveries — List deliveries for a webhook
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  // Verify webhook exists in this workspace
  const [webhook] = await db.select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.workspaceId, domainId)))
    .limit(1);

  if (!webhook) {
    return createErrorResponse('NOT_FOUND', 'Webhook not found', 404);
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');

  const [items, countResult] = await Promise.all([
    db.select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id)),
  ]);

  return NextResponse.json({
    items,
    totalItems: Number(countResult[0]?.count || 0),
    limit,
    offset,
  });
});
