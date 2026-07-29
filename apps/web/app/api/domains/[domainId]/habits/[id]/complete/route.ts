// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, habits, habitCompletions, sql } from '@project-e/db';
import { and, eq, isNull, gte, desc, count } from 'drizzle-orm';
import { z } from 'zod';

const completeHabitSchema = z.object({
  value: z.number().int().positive().optional().default(1),
  mood: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

/**
 * Calculate the current streak for a habit.
 * Streak = consecutive days with at least one completion, going backwards from today.
 * Skip days (e.g. weekends) are excluded from the streak count.
 */
async function calculateStreak(habitId: string, skipDays: number[]): Promise<number> {
  // Get all completion dates for this habit, ordered desc
  const completions = await db.select({ date: habitCompletions.date })
    .from(habitCompletions)
    .where(eq(habitCompletions.habitId, habitId))
    .orderBy(desc(habitCompletions.date));

  if (completions.length === 0) return 0;

  const completionDates = new Set(
    completions.map(c => c.date.toISOString().split('T')[0])
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(today);

  // Check up to 365 days back
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const dayOfWeek = checkDate.getDay(); // 0=Sun, 6=Sat

    if (skipDays.includes(dayOfWeek)) {
      // Skip day — move on without breaking streak
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    if (completionDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// POST /api/domains/[domainId]/habits/[id]/complete — Complete a habit
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = completeHabitSchema.parse(body);

    // Verify habit exists
    const [habit] = await db.select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.domainId, domainId), isNull(habits.deletedAt)))
      .limit(1);

    if (!habit) {
      return createErrorResponse('NOT_FOUND', 'Habit not found', 404);
    }

    // Create completion
    const [completion] = await db.insert(habitCompletions).values({
      habitId: id,
      date: new Date(),
      value: data.value,
      mood: data.mood ?? null,
      notes: data.notes ?? null,
    }).returning();

    // Recalculate streak
    const skipDays = habit.skipDays || [];
    const newStreak = await calculateStreak(id, skipDays);

    // Update habit with new streak
    const updateData: Record<string, unknown> = {
      streakCount: newStreak,
      updatedAt: new Date(),
    };

    // Update best streak if current is higher
    if (newStreak > (habit.bestStreak || 0)) {
      updateData.bestStreak = newStreak;
    }

    await db.update(habits)
      .set(updateData)
      .where(eq(habits.id, id));

    // Record activity
    await recordActivity({
      actor: user.name,
      action: 'completed',
      entityType: 'habit',
      entityId: id,
      changes: { value: data.value, mood: data.mood, streak: newStreak },
      workspaceId: domainId,
    });

    return NextResponse.json({
      completion,
      streakCount: newStreak,
      bestStreak: Math.max(newStreak, habit.bestStreak || 0),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[habit complete POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to complete habit', 500);
  }
});
