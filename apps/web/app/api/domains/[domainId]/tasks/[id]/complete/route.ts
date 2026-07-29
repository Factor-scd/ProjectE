// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks } from '@project-e/db';
import { and, eq, isNull } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// POST /api/domains/[domainId]/tasks/[id]/complete — Mark task as done
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [existing] = await db.select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.domainId, domainId), isNull(tasks.deletedAt)))
    .limit(1);

  if (!existing) {
    return createErrorResponse('NOT_FOUND', 'Task not found', 404);
  }

  const [updated] = await db.update(tasks)
    .set({
      status: 'done',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();

  await recordActivity({
    actor: user.name,
    action: 'completed',
    entityType: 'task',
    entityId: id,
    changes: { previousStatus: existing.status },
    workspaceId: domainId,
  });

  return NextResponse.json(updated);
});
