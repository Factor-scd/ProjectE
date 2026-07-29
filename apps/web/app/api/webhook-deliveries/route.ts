// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { db, webhookDeliveries } from '@project-e/db';
import { and, desc, eq, sql } from 'drizzle-orm';

// GET /api/webhook-deliveries — List webhook deliveries with filtering
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');
  const webhookId = searchParams.get('webhook_id') || '';

  const conditions = [];
  if (webhookId) {
    conditions.push(eq(webhookDeliveries.webhookId, webhookId));
  }

  const [items, countResult] = await Promise.all([
    db.select()
      .from(webhookDeliveries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(webhookDeliveries)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return NextResponse.json({
    items,
    totalItems: Number(countResult[0]?.count || 0),
    limit,
    offset,
  });
});
