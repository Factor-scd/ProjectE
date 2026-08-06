// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse, requireWorkspaceAccess } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, habits, habitTags } from '@project-e/db';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

const habitFrequencyEnum = z.enum(['daily', 'weekly', 'custom']);
const habitDifficultyEnum = z.enum(['easy', 'medium', 'hard']);

const updateHabitSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().nullable().optional(),
  domain: z.string().min(1, 'Domain is required').optional(),
  frequency: habitFrequencyEnum.optional(),
  difficulty: habitDifficultyEnum.optional(),
  goalPerPeriod: z.number().int().positive().optional(),
  active: z.boolean().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/habits/[id] — Get a single habit
export const GET = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const [habit] = await db.select()
    .from(habits)
    .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
    .limit(1);

  if (!habit) {
    return createErrorResponse('NOT_FOUND', 'Habit not found', 404);
  }

  return NextResponse.json(habit);
});

// PATCH /api/habits/[id] — Update a habit
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { id } = await context!.params;

  try {
    const body = await request.json();
    const data = updateHabitSchema.parse(body);

    if (data.domain) {
      await requireWorkspaceAccess(data.domain);
    }

    const updateValues: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.domain !== undefined) updateValues.domainId = data.domain;
    if (data.frequency !== undefined) updateValues.frequency = data.frequency;
    if (data.difficulty !== undefined) updateValues.difficulty = data.difficulty;
    if (data.goalPerPeriod !== undefined) updateValues.goalPerPeriod = data.goalPerPeriod;
    if (data.active !== undefined) updateValues.active = data.active;

    const [habit] = await db.update(habits)
      .set(updateValues)
      .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
      .returning();

    if (!habit) {
      return createErrorResponse('NOT_FOUND', 'Habit not found', 404);
    }

    if (data.tagIds) {
      await db.delete(habitTags).where(eq(habitTags.habitId, id));
      if (data.tagIds.length > 0) {
        await db.insert(habitTags).values(
          data.tagIds.map(tagId => ({ habitId: id, tagId }))
        );
      }
    }

    await recordActivity({
      actor: user.name,
      action: 'updated',
      entityType: 'habit',
      entityId: habit.id,
      changes: { name: habit.name },
      workspaceId: habit.domainId,
    });

    return NextResponse.json(habit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});

// DELETE /api/habits/[id] — Soft-delete a habit
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { id } = await context!.params;

  const [habit] = await db.update(habits)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
    .returning();

  if (!habit) {
    return createErrorResponse('NOT_FOUND', 'Habit not found', 404);
  }

  await recordActivity({
    actor: user.name,
    action: 'deleted',
    entityType: 'habit',
    entityId: habit.id,
    changes: { name: habit.name },
    workspaceId: habit.domainId,
  });

  return new NextResponse(null, { status: 204 });
});
