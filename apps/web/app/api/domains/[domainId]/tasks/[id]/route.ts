// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks, taskTags, tags as tagsTable, taskDependencies } from '@project-e/db';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

const taskStatusEnum = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  projectId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  order: z.number().int().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// GET /api/domains/[domainId]/tasks/[id] — Get a single task with subtasks + dependencies
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [task] = await db.select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.domainId, domainId), isNull(tasks.deletedAt)))
    .limit(1);

  if (!task) {
    return createErrorResponse('NOT_FOUND', 'Task not found', 404);
  }

  // Fetch subtasks
  const subtasks = await db.select()
    .from(tasks)
    .where(and(eq(tasks.parentId, id), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.order));

  // Fetch tags
  const tagRows = await db.select({
    id: tagsTable.id,
    name: tagsTable.name,
    color: tagsTable.color,
  })
    .from(taskTags)
    .innerJoin(tagsTable, eq(taskTags.tagId, tagsTable.id))
    .where(eq(taskTags.taskId, id));

  // Fetch dependencies (tasks this task depends on)
  const depRows = await db.select({
    id: tasks.id,
    title: tasks.title,
    status: tasks.status,
  })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
    .where(and(eq(taskDependencies.taskId, id), isNull(tasks.deletedAt)));

  // Fetch dependents (tasks that depend on this task)
  const dependentRows = await db.select({
    id: tasks.id,
    title: tasks.title,
    status: tasks.status,
  })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
    .where(and(eq(taskDependencies.dependsOnTaskId, id), isNull(tasks.deletedAt)));

  return NextResponse.json({
    ...task,
    subtasks,
    tags: tagRows,
    dependencies: depRows,
    dependents: dependentRows,
  });
});

// PATCH /api/domains/[domainId]/tasks/[id] — Update a task
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = updateTaskSchema.parse(body);

    // Verify task exists
    const [existing] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.domainId, domainId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existing) {
      return createErrorResponse('NOT_FOUND', 'Task not found', 404);
    }

    // Cycle detection for parentId (can't set parent to self or descendant)
    if (data.parentId && data.parentId === id) {
      return createErrorResponse('VALIDATION_ERROR', 'A task cannot be its own parent', 400);
    }
    if (data.parentId) {
      // Check for cycles in parent chain
      let currentParentId: string | null = data.parentId;
      const visited = new Set<string>([id]);
      while (currentParentId) {
        if (visited.has(currentParentId)) {
          return createErrorResponse('VALIDATION_ERROR', 'Circular parent reference detected', 400);
        }
        visited.add(currentParentId);
        const [parent] = await db.select({ parentId: tasks.parentId })
          .from(tasks)
          .where(eq(tasks.id, currentParentId))
          .limit(1);
        currentParentId = parent?.parentId ?? null;
      }
    }

    // Build update object
    const updateValues: Record<string, unknown> = {};
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
    if (data.customFields !== undefined) updateValues.customFields = data.customFields;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, id))
      .returning();

    // Record activity
    await recordActivity({
      actor: user.name,
      action: 'updated',
      entityType: 'task',
      entityId: id,
      changes: { ...data, previousStatus: existing.status },
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
    console.error('[tasks PATCH] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update task', 500);
  }
});

// DELETE /api/domains/[domainId]/tasks/[id] — Soft delete a task
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [existing] = await db.select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.domainId, domainId), isNull(tasks.deletedAt)))
    .limit(1);

  if (!existing) {
    return createErrorResponse('NOT_FOUND', 'Task not found', 404);
  }

  await db.update(tasks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, id));

  // Record activity
  await recordActivity({
    actor: user.name,
    action: 'deleted',
    entityType: 'task',
    entityId: id,
    changes: { title: existing.title },
    workspaceId: domainId,
  });

  return new NextResponse(null, { status: 204 });
});
