// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks } from '@project-e/db';
import { and, eq, isNull } from 'drizzle-orm';
import { RRule } from 'rrule';

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

  // Auto-create next recurring instance if recurrenceRule is set
  if (existing.recurrenceRule) {
    try {
      const rule = RRule.fromString(existing.recurrenceRule);
      const nextOccurrence = rule.after(new Date(), true);

      if (nextOccurrence) {
        const [spawned] = await db.insert(tasks).values({
          title: existing.title,
          description: existing.description,
          status: 'todo',
          priority: existing.priority,
          domainId: existing.domainId,
          projectId: existing.projectId,
          sectionId: existing.sectionId,
          parentId: existing.parentId,
          dueDate: nextOccurrence,
          estimatedMinutes: existing.estimatedMinutes,
          order: existing.order,
          customFields: existing.customFields ?? {},
          recurrenceRule: existing.recurrenceRule,
        }).returning();

        await recordActivity({
          actor: user.name,
          action: 'created',
          entityType: 'task',
          entityId: spawned.id,
          changes: {
            title: spawned.title,
            note: 'Auto-created from recurring task',
            sourceTaskId: id,
          },
          workspaceId: domainId,
        });
      }
    } catch (err) {
      console.error('[tasks complete] Failed to spawn recurring instance:', err);
      // Don't fail the completion — the original task is already marked done
    }
  }

  return NextResponse.json(updated);
});
