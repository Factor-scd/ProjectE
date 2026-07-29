// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess } from '@/lib/auth';
import { db, projects, tasks } from '@project-e/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/dashboard/widgets/project-progress
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const activeProjects = await db.select()
    .from(projects)
    .where(and(
      eq(projects.domainId, domainId),
      inArray(projects.status, ['active', 'paused']),
      isNull(projects.deletedAt),
    ));

  // Compute progress for each project
  const items = [];
  for (const project of activeProjects) {
    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.projectId, project.id), isNull(tasks.deletedAt)));

    const [completedResult] = await db.select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.projectId, project.id), eq(tasks.status, 'done'), isNull(tasks.deletedAt)));

    const total = Number(totalResult?.count || 0);
    const completed = Number(completedResult?.count || 0);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    items.push({
      id: project.id,
      name: project.name,
      status: project.status,
      color: project.color,
      targetDate: project.targetDate,
      taskCount: total,
      completedCount: completed,
      progress,
    });
  }

  return NextResponse.json({ items });
});
