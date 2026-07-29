// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse } from '@/lib/auth';
import { db, habits, habitCompletions } from '@project-e/db';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// GET /api/domains/[domainId]/habits/[id]/completions — List completions with date range
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  // Verify habit exists
  const [habit] = await db.select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.domainId, domainId), isNull(habits.deletedAt)))
    .limit(1);

  if (!habit) {
    return createErrorResponse('NOT_FOUND', 'Habit not found', 404);
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = Math.min(parseInt(searchParams.get('limit') || '365'), 1000);
  const offset = parseInt(searchParams.get('offset') || '0');
  const order = searchParams.get('order') || 'desc';

  const conditions: any[] = [eq(habitCompletions.habitId, id)];

  if (from) conditions.push(gte(habitCompletions.date, new Date(from)));
  if (to) conditions.push(lte(habitCompletions.date, new Date(to)));

  const orderFn = order === 'asc' ? asc : desc;

  const [items, countResult] = await Promise.all([
    db.select()
      .from(habitCompletions)
      .where(and(...conditions))
      .orderBy(orderFn(habitCompletions.date))
      .limit(limit)
      .offset(offset),
    db.select({ count: db.$count(habitCompletions) })
      .from(habitCompletions)
      .where(and(...conditions)),
  ]);

  return NextResponse.json({
    items,
    totalItems: Number(countResult[0]?.count || 0),
    limit,
    offset,
  });
});
