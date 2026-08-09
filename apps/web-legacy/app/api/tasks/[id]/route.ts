// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks } from '@project-e/db';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

const taskStatusEnum = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().nullable().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  projectId: z.string().uuid().nullable().optional(),
  sectionId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  order: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/tasks/[id] — Get a single task
export const GET = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const [task] = await db.select()
    .from(tasks)
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .limit(1);

  if (!task) {
    return createErrorResponse('NOT_FOUND', 'Task not found', 404);
  }

  return NextResponse.json(task);
});

// PATCH /api/tasks/[id] — Update a task
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { id } = await context!.params;

  try {
    const body = await request.json();
    const data = updateTaskSchema.parse(body);

    if (data.parentId) {
      const [parent] = await db.select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, data.parentId), isNull(tasks.deletedAt)))
        .limit(1);
      if (!parent) {
        return createErrorResponse('NOT_FOUND', 'Parent task not found', 404);
      }
    }

    const updateValues: Record<string, any> = { updatedAt: new Date() };
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.priority !== undefined) updateValues.priority = data.priority;
    if (data.projectId !== undefined) updateValues.projectId = data.projectId;
    if (data.sectionId !== undefined) updateValues.sectionId = data.sectionId;
    if (data.parentId !== undefined) updateValues.parentId = data.parentId;
    if (data.dueDate !== undefined) updateValues.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.estimatedMinutes !== undefined) updateValues.estimatedMinutes = data.estimatedMinutes;
    if (data.order !== undefined) updateValues.order = data.order;

    const [task] = await db.update(tasks)
      .set(updateValues)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .returning();

    if (!task) {
      return createErrorResponse('NOT_FOUND', 'Task not found', 404);
    }

    await recordActivity({
      actor: user.name,
      action: 'updated',
      entityType: 'task',
      entityId: task.id,
      changes: { title: task.title, status: task.status },
      workspaceId: task.domainId,
    });

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});

// DELETE /api/tasks/[id] — Soft-delete a task
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { id } = await context!.params;

  const [task] = await db.update(tasks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .returning();

  if (!task) {
    return createErrorResponse('NOT_FOUND', 'Task not found', 404);
  }

  await recordActivity({
    actor: user.name,
    action: 'deleted',
    entityType: 'task',
    entityId: task.id,
    changes: { title: task.title },
    workspaceId: task.domainId,
  });

  return new NextResponse(null, { status: 204 });
});
