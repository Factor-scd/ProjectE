// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess } from '@/lib/auth';
import { db, tasks, habits, habitCompletions } from '@project-e/db';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/dashboard/widgets/weekly-stats
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Task completions this week
  const [taskCompletions] = await db.select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(and(
      eq(tasks.domainId, domainId),
      eq(tasks.status, 'done'),
      gte(tasks.completedAt, weekStart),
      lte(tasks.completedAt, weekEnd),
      isNull(tasks.deletedAt),
    ));

  // Habit completions this week
  const [habitCompletionsCount] = await db.select({ count: sql<number>`count(*)` })
    .from(habitCompletions)
    .innerJoin(habits, eq(habitCompletions.habitId, habits.id))
    .where(and(
      eq(habits.domainId, domainId),
      gte(habitCompletions.date, weekStart),
      lte(habitCompletions.date, weekEnd),
      isNull(habits.deletedAt),
    ));

  // Streak counts
  const activeHabits = await db.select({ id: habits.id, streakCount: habits.streakCount, bestStreak: habits.bestStreak })
    .from(habits)
    .where(and(
      eq(habits.domainId, domainId),
      eq(habits.active, true),
      isNull(habits.deletedAt),
    ));

  const totalStreak = activeHabits.reduce((sum, h) => sum + (h.streakCount || 0), 0);
  const bestStreak = Math.max(...activeHabits.map(h => h.bestStreak || 0), 0);

  return NextResponse.json({
    taskCompletions: Number(taskCompletions?.count || 0),
    habitCompletions: Number(habitCompletionsCount?.count || 0),
    totalStreak,
    bestStreak,
    activeHabits: activeHabits.length,
  });
});
