// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess } from '@/lib/auth';
import { db, tasks, projects, sections } from '@project-e/db';
import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/dashboard/widgets/upcoming-calendar
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Tasks due in next 7 days
  const upcomingTasks = await db.select({
    id: tasks.id,
    title: tasks.title,
    dueDate: tasks.dueDate,
    priority: tasks.priority,
    status: tasks.status,
  })
    .from(tasks)
    .where(and(
      eq(tasks.domainId, domainId),
      isNull(tasks.deletedAt),
      gte(tasks.dueDate, today),
      lte(tasks.dueDate, nextWeek),
    ))
    .orderBy(asc(tasks.dueDate))
    .limit(10);

  // Projects with target dates in next 7 days
  const upcomingProjects = await db.select({
    id: projects.id,
    name: projects.name,
    targetDate: projects.targetDate,
    status: projects.status,
    color: projects.color,
  })
    .from(projects)
    .where(and(
      eq(projects.domainId, domainId),
      isNull(projects.deletedAt),
      gte(projects.targetDate, today),
      lte(projects.targetDate, nextWeek),
    ))
    .orderBy(asc(projects.targetDate))
    .limit(5);

  return NextResponse.json({
    tasks: upcomingTasks,
    projects: upcomingProjects,
  });
});
