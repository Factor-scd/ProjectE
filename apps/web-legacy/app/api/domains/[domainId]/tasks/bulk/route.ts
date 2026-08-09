// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks } from '@project-e/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  updates: z.object({
    status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    order: z.number().int().optional(),
    projectId: z.string().uuid().optional().nullable(),
    sectionId: z.string().uuid().optional().nullable(),
  }),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

type RouteContext = { params: Promise<{ domainId: string }> };

// POST /api/domains/[domainId]/tasks/bulk — Bulk update tasks (order, status)
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = bulkUpdateSchema.parse(body);

    // Verify all tasks belong to this domain
    const existingTasks = await db.select({ id: tasks.id })
      .from(tasks)
      .where(and(inArray(tasks.id, data.ids), eq(tasks.domainId, domainId), isNull(tasks.deletedAt)));

    if (existingTasks.length !== data.ids.length) {
      return createErrorResponse('NOT_FOUND', 'One or more tasks not found', 404);
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (data.updates.status !== undefined) updateValues.status = data.updates.status;
    if (data.updates.priority !== undefined) updateValues.priority = data.updates.priority;
    if (data.updates.order !== undefined) updateValues.order = data.updates.order;
    if (data.updates.projectId !== undefined) updateValues.projectId = data.updates.projectId;
    if (data.updates.sectionId !== undefined) updateValues.sectionId = data.updates.sectionId;

    const updated = await db.update(tasks)
      .set(updateValues)
      .where(inArray(tasks.id, data.ids))
      .returning();

    // Record activity for each task
    for (const task of updated) {
      await recordActivity({
        actor: user.name,
        action: 'bulk_updated',
        entityType: 'task',
        entityId: task.id,
        changes: data.updates,
        workspaceId: domainId,
      });
    }

    return NextResponse.json({ updated: updated.length, items: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[tasks bulk POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to bulk update tasks', 500);
  }
});

// DELETE /api/domains/[domainId]/tasks/bulk — Bulk soft-delete tasks
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = bulkDeleteSchema.parse(body);

    // Verify all tasks belong to this domain
    const existingTasks = await db.select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(and(inArray(tasks.id, data.ids), eq(tasks.domainId, domainId), isNull(tasks.deletedAt)));

    if (existingTasks.length !== data.ids.length) {
      return createErrorResponse('NOT_FOUND', 'One or more tasks not found', 404);
    }

    // Soft delete
    await db.update(tasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(tasks.id, data.ids));

    // Record activity for each task
    for (const task of existingTasks) {
      await recordActivity({
        actor: user.name,
        action: 'bulk_deleted',
        entityType: 'task',
        entityId: task.id,
        changes: { title: task.title },
        workspaceId: domainId,
      });
    }

    return NextResponse.json({ deleted: existingTasks.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[tasks bulk DELETE] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to bulk delete tasks', 500);
  }
});
