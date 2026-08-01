// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess } from '@/lib/auth';
import { db, habits, habitCompletions } from '@project-e/db';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/dashboard/widgets/habit-checklist
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const activeHabits = await db.select()
    .from(habits)
    .where(and(
      eq(habits.domainId, domainId),
      eq(habits.active, true),
      isNull(habits.deletedAt),
    ));

  // Check which habits are completed today
  const items = [];
  for (const habit of activeHabits) {
    const [completion] = await db.select({ count: sql<number>`count(*)` })
      .from(habitCompletions)
      .where(and(
        eq(habitCompletions.habitId, habit.id),
        gte(habitCompletions.date, today),
        lte(habitCompletions.date, tomorrow),
      ));

    const completed = Number(completion?.count || 0) > 0;
    items.push({
      ...habit,
      completedToday: completed,
    });
  }

  return NextResponse.json({ items });
});
