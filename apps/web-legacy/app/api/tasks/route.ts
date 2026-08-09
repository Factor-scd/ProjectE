// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse, resolveActiveDomain } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks, taskTags, tags as tagsTable } from '@project-e/db';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const taskStatusEnum = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  status: taskStatusEnum.optional().default('todo'),
  priority: taskPriorityEnum.optional().default('medium'),
  domain: z.string().min(1, 'Domain is required'),
  projectId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  order: z.number().int().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

// GET /api/tasks — List tasks with filtering, sorting, pagination
export const GET = withAuth(async (request: NextRequest, user) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')));
  const filter = searchParams.get('filter') || undefined;
  const status = searchParams.get('status');
  const sort = searchParams.get('sort') || '-created';
  let domainId = searchParams.get('domain') || undefined;
  if (!domainId) {
    const active = await resolveActiveDomain(user);
    domainId = active.id;
  }

  const sortDir = sort.startsWith('-') ? 'desc' : 'asc';
  const sortField = sort.replace(/^-/, '');
  const sortColumns: Record<string, any> = {
    created: tasks.createdAt,
    updated: tasks.updatedAt,
    title: tasks.title,
    status: tasks.status,
    priority: tasks.priority,
    order: tasks.order,
    due_date: tasks.dueDate,
  };
  const orderBy = sortDir === 'asc'
    ? asc(sortColumns[sortField] || tasks.createdAt)
    : desc(sortColumns[sortField] || tasks.createdAt);

  const conditions: any[] = [isNull(tasks.deletedAt)];
  if (domainId) conditions.push(eq(tasks.domainId, domainId));
  if (status) {
    const statuses = status.split(',');
    conditions.push(inArray(tasks.status, statuses as any));
  }
  if (filter) {
    conditions.push(
      or(
        ilike(tasks.title, `%${filter}%`),
        ilike(tasks.description, `%${filter}%`),
      )!
    );
  }

  const offset = (page - 1) * perPage;

  const [items, countResult] = await Promise.all([
    db.select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(tasks)
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

// POST /api/tasks — Create a task
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const data = createTaskSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    const [task] = await db.insert(tasks).values({
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      domainId: data.domain,
      projectId: data.projectId ?? null,
      sectionId: data.sectionId ?? null,
      parentId: data.parentId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      order: data.order ?? 0,
    }).returning();

    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(taskTags).values(
        data.tagIds.map(tagId => ({ taskId: task.id, tagId }))
      );
    }

    await recordActivity({
      actor: user.name,
      action: 'created',
      entityType: 'task',
      entityId: task.id,
      changes: { title: task.title },
      workspaceId: data.domain,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    console.error('[tasks POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create task', 500);
  }
});
