// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, habits, habitTags, tags as tagsTable } from '@project-e/db';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const habitFrequencyEnum = z.enum(['daily', 'weekly', 'custom']);
const habitDifficultyEnum = z.enum(['easy', 'medium', 'hard']);

const createHabitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  domain: z.string().min(1, 'Domain is required'),
  frequency: habitFrequencyEnum.optional().default('daily'),
  difficulty: habitDifficultyEnum.optional().default('medium'),
  completionMode: z.enum(['quick', 'checklist', 'timer']).optional().default('quick'),
  goalPerPeriod: z.number().int().positive().optional().default(1),
  active: z.boolean().optional().default(true),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional(),
});

// GET /api/habits — List habits with filtering, sorting, pagination
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')));
  const filter = searchParams.get('filter') || undefined;
  const sort = searchParams.get('sort') || '-created';
  const domainId = searchParams.get('domain') || undefined;

  const sortDir = sort.startsWith('-') ? 'desc' : 'asc';
  const sortField = sort.replace(/^-/, '');
  const sortColumns: Record<string, any> = {
    created: habits.createdAt,
    updated: habits.updatedAt,
    name: habits.name,
    frequency: habits.frequency,
    difficulty: habits.difficulty,
  };
  const orderBy = sortDir === 'asc'
    ? asc(sortColumns[sortField] || habits.createdAt)
    : desc(sortColumns[sortField] || habits.createdAt);

  const conditions: any[] = [isNull(habits.deletedAt)];
  if (domainId) conditions.push(eq(habits.domainId, domainId));
  if (filter) {
    conditions.push(ilike(habits.name, `%${filter}%`));
  }

  const offset = (page - 1) * perPage;

  const [items, countResult] = await Promise.all([
    db.select()
      .from(habits)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(habits)
      .where(and(...conditions)),
  ]);

  const totalItems = Number(countResult[0]?.count || 0);

  return NextResponse.json({
    items,
    totalItems,
    totalPages: Math.ceil(totalItems / perPage),
    page,
    perPage,
  });
});

// POST /api/habits — Create a habit
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const data = createHabitSchema.parse(body);

    const [habit] = await db.insert(habits).values({
      name: data.name,
      description: data.description ?? null,
      domainId: data.domain,
      frequency: data.frequency,
      difficulty: data.difficulty,
      completionMode: data.completionMode,
      goalPerPeriod: data.goalPerPeriod,
      active: data.active,
      color: data.color ?? null,
      icon: data.icon ?? null,
    }).returning();

    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(habitTags).values(
        data.tagIds.map(tagId => ({ habitId: habit.id, tagId }))
      );
    }

    await recordActivity({
      actor: user.name,
      action: 'created',
      entityType: 'habit',
      entityId: habit.id,
      changes: { name: habit.name },
      workspaceId: data.domain,
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    console.error('[habits POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create habit', 500);
  }
});
