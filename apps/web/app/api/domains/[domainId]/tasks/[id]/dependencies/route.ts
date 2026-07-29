// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks, taskDependencies } from '@project-e/db';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

const addDependencySchema = z.object({
  taskId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

/**
 * Cycle detection: check if adding dep (taskId -> dependsOnTaskId) would create a cycle.
 * Uses BFS from dependsOnTaskId following the dependency chain.
 */
async function wouldCreateCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  if (taskId === dependsOnTaskId) return true;

  // BFS: follow dependencies from dependsOnTaskId to see if we reach taskId
  const visited = new Set<string>();
  const queue = [dependsOnTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await db.select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, current));

    for (const dep of deps) {
      if (!visited.has(dep.dependsOnTaskId)) {
        queue.push(dep.dependsOnTaskId);
      }
    }
  }

  return false;
}

// POST /api/domains/[domainId]/tasks/[id]/dependencies — Add a dependency
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = addDependencySchema.parse(body);

    // Verify both tasks exist
    const [task] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.domainId, domainId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      return createErrorResponse('NOT_FOUND', 'Task not found', 404);
    }

    const [depTask] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, data.taskId), eq(tasks.domainId, domainId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!depTask) {
      return createErrorResponse('NOT_FOUND', 'Dependency task not found', 404);
    }

    // Cycle detection
    const cycle = await wouldCreateCycle(id, data.taskId);
    if (cycle) {
      return createErrorResponse('CONFLICT', 'Adding this dependency would create a cycle', 400);
    }

    // Check if dependency already exists
    const [existing] = await db.select()
      .from(taskDependencies)
      .where(and(eq(taskDependencies.taskId, id), eq(taskDependencies.dependsOnTaskId, data.taskId)))
      .limit(1);

    if (existing) {
      return createErrorResponse('CONFLICT', 'Dependency already exists', 409);
    }

    await db.insert(taskDependencies).values({
      taskId: id,
      dependsOnTaskId: data.taskId,
    });

    await recordActivity({
      actor: user.name,
      action: 'dependency_added',
      entityType: 'task',
      entityId: id,
      changes: { dependsOnTaskId: data.taskId, dependsOnTitle: depTask.title },
      workspaceId: domainId,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[dependencies POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to add dependency', 500);
  }
});

// DELETE /api/domains/[domainId]/tasks/[id]/dependencies — Remove a dependency
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = addDependencySchema.parse(body);

    const [existing] = await db.select()
      .from(taskDependencies)
      .where(and(eq(taskDependencies.taskId, id), eq(taskDependencies.dependsOnTaskId, data.taskId)))
      .limit(1);

    if (!existing) {
      return createErrorResponse('NOT_FOUND', 'Dependency not found', 404);
    }

    await db.delete(taskDependencies)
      .where(and(eq(taskDependencies.taskId, id), eq(taskDependencies.dependsOnTaskId, data.taskId)));

    await recordActivity({
      actor: user.name,
      action: 'dependency_removed',
      entityType: 'task',
      entityId: id,
      changes: { dependsOnTaskId: data.taskId },
      workspaceId: domainId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[dependencies DELETE] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to remove dependency', 500);
  }
});
