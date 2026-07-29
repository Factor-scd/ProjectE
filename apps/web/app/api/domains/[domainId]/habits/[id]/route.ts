// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, habits, habitCompletions, habitTags, tags as tagsTable } from '@project-e/db';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

const habitFrequencyEnum = z.enum(['daily', 'weekly', 'custom']);
const habitDifficultyEnum = z.enum(['easy', 'medium', 'hard']);

const updateHabitSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  frequency: habitFrequencyEnum.optional(),
  difficulty: habitDifficultyEnum.optional(),
  goalPerPeriod: z.number().int().positive().optional(),
  unit: z.string().optional().nullable(),
  reminderTime: z.string().optional().nullable(),
  skipDays: z.array(z.number().int().min(0).max(6)).optional(),
  moodTracking: z.boolean().optional(),
  active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// GET /api/domains/[domainId]/habits/[id] — Get a single habit with streak + recent completions
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [habit] = await db.select()
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.domainId, domainId), isNull(habits.deletedAt)))
    .limit(1);

  if (!habit) {
    return createErrorResponse('NOT_FOUND', 'Habit not found', 404);
  }

  // Fetch recent completions (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentCompletions = await db.select()
    .from(habitCompletions)
    .where(and(
      eq(habitCompletions.habitId, id),
      gte(habitCompletions.date, thirtyDaysAgo),
    ))
    .orderBy(desc(habitCompletions.date));

  // Fetch tags
  const tagRows = await db.select({
    id: tagsTable.id,
    name: tagsTable.name,
    color: tagsTable.color,
  })
    .from(habitTags)
    .innerJoin(tagsTable, eq(habitTags.tagId, tagsTable.id))
    .where(eq(habitTags.habitId, id));

  return NextResponse.json({
    ...habit,
    recentCompletions,
    tags: tagRows,
  });
});

// PATCH /api/domains/[domainId]/habits/[id] — Update a habit
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = updateHabitSchema.parse(body);

    const [existing] = await db.select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.domainId, domainId), isNull(habits.deletedAt)))
      .limit(1);

    if (!existing) {
      return createErrorResponse('NOT_FOUND', 'Habit not found', 404);
    }

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.frequency !== undefined) updateValues.frequency = data.frequency;
    if (data.difficulty !== undefined) updateValues.difficulty = data.difficulty;
    if (data.goalPerPeriod !== undefined) updateValues.goalPerPeriod = data.goalPerPeriod;
    if (data.unit !== undefined) updateValues.unit = data.unit;
    if (data.reminderTime !== undefined) updateValues.reminderTime = data.reminderTime;
    if (data.skipDays !== undefined) updateValues.skipDays = data.skipDays;
    if (data.moodTracking !== undefined) updateValues.moodTracking = data.moodTracking;
    if (data.active !== undefined) updateValues.active = data.active;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(habits)
      .set(updateValues)
      .where(eq(habits.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: 'updated',
      entityType: 'habit',
      entityId: id,
      changes: { ...data, previousName: existing.name },
      workspaceId: domainId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[habits PATCH] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update habit', 500);
  }
});

// DELETE /api/domains/[domainId]/habits/[id] — Soft delete a habit
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [existing] = await db.select()
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.domainId, domainId), isNull(habits.deletedAt)))
    .limit(1);

  if (!existing) {
    return createErrorResponse('NOT_FOUND', 'Habit not found', 404);
  }

  await db.update(habits)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(habits.id, id));

  await recordActivity({
    actor: user.name,
    action: 'deleted',
    entityType: 'habit',
    entityId: id,
    changes: { name: existing.name },
    workspaceId: domainId,
  });

  return new NextResponse(null, { status: 204 });
});
