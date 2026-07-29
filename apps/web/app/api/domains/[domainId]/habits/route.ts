// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, habits, habitTags, tags as tagsTable } from '@project-e/db';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const habitFrequencyEnum = z.enum(['daily', 'weekly', 'custom']);
const habitDifficultyEnum = z.enum(['easy', 'medium', 'hard']);

const createHabitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  frequency: habitFrequencyEnum.optional().default('daily'),
  difficulty: habitDifficultyEnum.optional().default('medium'),
  goalPerPeriod: z.number().int().positive().optional().default(1),
  unit: z.string().optional().nullable(),
  reminderTime: z.string().optional().nullable(),
  skipDays: z.array(z.number().int().min(0).max(6)).optional().default([]),
  moodTracking: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  tagIds: z.array(z.string().uuid()).optional(),
});

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/habits — List habits with filtering
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const { searchParams } = new URL(request.url);
  const active = searchParams.get('active');
  const frequency = searchParams.get('frequency');
  const difficulty = searchParams.get('difficulty');
  const search = searchParams.get('search');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');
  const sort = searchParams.get('sort') || 'name';
  const order = searchParams.get('order') || 'asc';

  const conditions: any[] = [
    eq(habits.domainId, domainId),
    isNull(habits.deletedAt),
  ];

  if (active === 'true') conditions.push(eq(habits.active, true));
  else if (active === 'false') conditions.push(eq(habits.active, false));
  if (frequency) conditions.push(eq(habits.frequency, frequency as any));
  if (difficulty) conditions.push(eq(habits.difficulty, difficulty as any));
  if (search) conditions.push(ilike(habits.name, `%${search}%`));

  const orderFn = order === 'desc' ? desc : asc;
  let orderColumn;
  switch (sort) {
    case 'frequency': orderColumn = orderFn(habits.frequency); break;
    case 'difficulty': orderColumn = orderFn(habits.difficulty); break;
    case 'streak_count': orderColumn = orderFn(habits.streakCount); break;
    case 'created_at': orderColumn = orderFn(habits.createdAt); break;
    case 'updated_at': orderColumn = orderFn(habits.updatedAt); break;
    default: orderColumn = orderFn(habits.name); break;
  }

  const [items, countResult] = await Promise.all([
    db.select()
      .from(habits)
      .where(and(...conditions))
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(habits)
      .where(and(...conditions)),
  ]);

  const totalItems = Number(countResult[0]?.count || 0);

  // Fetch tags for all habits
  let habitTagMap = new Map<string, { id: string; name: string; color: string | null }[]>();
  if (items.length > 0) {
    const habitIds = items.map(h => h.id);
    const tagRows = await db.select({
      habitId: habitTags.habitId,
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
    })
      .from(habitTags)
      .innerJoin(tagsTable, eq(habitTags.tagId, tagsTable.id))
      .where(inArray(habitTags.habitId, habitIds));

    for (const row of tagRows) {
      if (!habitTagMap.has(row.habitId)) habitTagMap.set(row.habitId, []);
      habitTagMap.get(row.habitId)!.push({ id: row.id, name: row.name, color: row.color });
    }
  }

  const itemsWithTags = items.map(h => ({
    ...h,
    tags: habitTagMap.get(h.id) || [],
  }));

  return NextResponse.json({
    items: itemsWithTags,
    totalItems,
    limit,
    offset,
  });
});

// POST /api/domains/[domainId]/habits — Create a habit
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = createHabitSchema.parse(body);

    const [habit] = await db.insert(habits).values({
      name: data.name,
      description: data.description ?? null,
      domainId,
      frequency: data.frequency,
      difficulty: data.difficulty,
      goalPerPeriod: data.goalPerPeriod,
      unit: data.unit ?? null,
      reminderTime: data.reminderTime ?? null,
      skipDays: data.skipDays,
      moodTracking: data.moodTracking,
      active: data.active,
    }).returning();

    // Insert tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(habitTags).values(
        data.tagIds.map(tagId => ({ habitId: habit.id, tagId }))
      );
    }

    // Record activity
    await recordActivity({
      actor: user.name,
      action: 'created',
      entityType: 'habit',
      entityId: habit.id,
      changes: { name: habit.name, frequency: habit.frequency, difficulty: habit.difficulty },
      workspaceId: domainId,
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[habits POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create habit', 500);
  }
});
