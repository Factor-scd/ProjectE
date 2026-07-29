// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks, taskTags, tags as tagsTable, taskDependencies, domains } from '@project-e/db';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const taskStatusEnum = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  status: taskStatusEnum.optional().default('todo'),
  priority: taskPriorityEnum.optional().default('medium'),
  projectId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  order: z.number().int().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/tasks — List tasks with filtering, sorting, pagination
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const tag = searchParams.get('tag');
  const search = searchParams.get('search');
  const parentId = searchParams.get('parent_id');
  const projectId = searchParams.get('project_id');
  const sectionId = searchParams.get('section_id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');
  const sort = searchParams.get('sort') || 'order';
  const order = searchParams.get('order') || 'asc';

  // Build where conditions
  const conditions: any[] = [
    eq(tasks.domainId, domainId),
    isNull(tasks.deletedAt),
  ];

  if (status) {
    const statuses = status.split(',');
    conditions.push(inArray(tasks.status, statuses as any));
  }
  if (priority) {
    const priorities = priority.split(',');
    conditions.push(inArray(tasks.priority, priorities as any));
  }
  if (search) {
    conditions.push(ilike(tasks.title, `%${search}%`));
  }
  if (parentId === 'null') {
    conditions.push(isNull(tasks.parentId));
  } else if (parentId) {
    conditions.push(eq(tasks.parentId, parentId));
  }
  if (projectId) {
    conditions.push(eq(tasks.projectId, projectId));
  }
  if (sectionId) {
    conditions.push(eq(tasks.sectionId, sectionId));
  }

  // Build order
  const orderFn = order === 'desc' ? desc : asc;
  let orderColumn;
  switch (sort) {
    case 'title': orderColumn = orderFn(tasks.title); break;
    case 'status': orderColumn = orderFn(tasks.status); break;
    case 'priority': orderColumn = orderFn(tasks.priority); break;
    case 'due_date': orderColumn = orderFn(tasks.dueDate); break;
    case 'created_at': orderColumn = orderFn(tasks.createdAt); break;
    case 'updated_at': orderColumn = orderFn(tasks.updatedAt); break;
    default: orderColumn = orderFn(tasks.order); break;
  }

  const [items, countResult] = await Promise.all([
    db.select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(...conditions)),
  ]);

  const totalItems = Number(countResult[0]?.count || 0);

  // If tag filter is specified, filter in-memory (or we could do a subquery)
  let filteredItems = items;
  if (tag) {
    const tagIds = tag.split(',');
    const taskTagRows = await db.select({ taskId: taskTags.taskId })
      .from(taskTags)
      .where(inArray(taskTags.tagId, tagIds));
    const matchingTaskIds = new Set(taskTagRows.map(r => r.taskId));
    filteredItems = items.filter(t => matchingTaskIds.has(t.id));
  }

  // Fetch tags for all tasks
  let taskTagMap = new Map<string, { id: string; name: string; color: string | null }[]>();
  if (filteredItems.length > 0) {
    const taskIds = filteredItems.map(t => t.id);
    const tagRows = await db.select({
      taskId: taskTags.taskId,
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
    })
      .from(taskTags)
      .innerJoin(tagsTable, eq(taskTags.tagId, tagsTable.id))
      .where(inArray(taskTags.taskId, taskIds));

    for (const row of tagRows) {
      if (!taskTagMap.has(row.taskId)) taskTagMap.set(row.taskId, []);
      taskTagMap.get(row.taskId)!.push({ id: row.id, name: row.name, color: row.color });
    }
  }

  const itemsWithTags = filteredItems.map(t => ({
    ...t,
    tags: taskTagMap.get(t.id) || [],
  }));

  return NextResponse.json({
    items: itemsWithTags,
    totalItems,
    limit,
    offset,
  });
});

// POST /api/domains/[domainId]/tasks — Create a task
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = createTaskSchema.parse(body);

    // Validate domain_id matches route param
    // domainId is already validated via requireWorkspaceAccess

    // Cycle detection for parentId (subtask)
    if (data.parentId) {
      // Verify parent exists and is not deleted
      const [parent] = await db.select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, data.parentId), isNull(tasks.deletedAt)))
        .limit(1);
      if (!parent) {
        return createErrorResponse('NOT_FOUND', 'Parent task not found', 404);
      }
    }

    const [task] = await db.insert(tasks).values({
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      domainId,
      projectId: data.projectId ?? null,
      sectionId: data.sectionId ?? null,
      parentId: data.parentId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      order: data.order ?? 0,
      customFields: data.customFields ?? {},
    }).returning();

    // Insert tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(taskTags).values(
        data.tagIds.map(tagId => ({ taskId: task.id, tagId }))
      );
    }

    // Record activity
    await recordActivity({
      actor: user.name,
      action: 'created',
      entityType: 'task',
      entityId: task.id,
      changes: { title: task.title, status: task.status, priority: task.priority },
      workspaceId: domainId,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[tasks POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create task', 500);
  }
});
