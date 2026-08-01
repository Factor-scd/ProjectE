// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks } from '@project-e/db';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

const scheduleSchema = z.object({
  dueDate: z.string().datetime().nullable(),
});

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// PATCH /api/domains/[domainId]/tasks/[id]/schedule — Reschedule a task via drag
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = scheduleSchema.parse(body);

    // Verify task exists
    const [existing] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.domainId, domainId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existing) {
      return createErrorResponse('NOT_FOUND', 'Task not found', 404);
    }

    const [updated] = await db.update(tasks)
      .set({
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    // Record activity
    await recordActivity({
      actor: user.name,
      action: 'updated',
      entityType: 'task',
      entityId: id,
      changes: { dueDate: data.dueDate, previousDueDate: existing.dueDate?.toISOString() || null },
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
    console.error('[schedule PATCH] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to reschedule task', 500);
  }
});
