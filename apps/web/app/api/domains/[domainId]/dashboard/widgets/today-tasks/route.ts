// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess } from '@/lib/auth';
import { db, tasks, habits, habitCompletions, projects, notes, activityFeed, domains } from '@project-e/db';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/dashboard/widgets/today-tasks
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const items = await db.select()
    .from(tasks)
    .where(and(
      eq(tasks.domainId, domainId),
      isNull(tasks.deletedAt),
      gte(tasks.dueDate, today),
      lte(tasks.dueDate, tomorrow),
    ))
    .orderBy(asc(tasks.priority))
    .limit(10);

  return NextResponse.json({ items });
});
