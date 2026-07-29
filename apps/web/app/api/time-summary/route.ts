// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// GET /api/time-summary — Aggregated time by domain/project/tag
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = searchParams.get('end') || new Date().toISOString();

  const pb = createPocketBaseClient();

  const entries = await pb.collection('task_time_entries').getFullList({
    filter: `started_at >= "${startDate}" && started_at <= "${endDate}"`,
  });

  const byDomain: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  let totalMinutes = 0;

  for (const entry of entries) {
    const duration = (entry.duration_minutes as number) || (entry.duration as number) || 0;
    totalMinutes += duration;
    const startedAt = entry.started_at as string | undefined;
    if (startedAt) {
      const date = new Date(startedAt).toISOString().slice(0, 10);
      byDate[date] = (byDate[date] || 0) + duration;
    }

    // Get task for domain/project/tags
    const task = await pb.collection('tasks').getOne(entry.task_id as string);

    const domain = task.domain as string;
    byDomain[domain] = (byDomain[domain] || 0) + duration;

    const projectId = task.project_id as string | undefined;
    if (projectId) {
      byProject[projectId] = (byProject[projectId] || 0) + duration;
    }

    const tags = (task.tags as string[]) || [];
    for (const tag of tags) {
      byTag[tag] = (byTag[tag] || 0) + duration;
    }
  }

  return NextResponse.json({
    totalMinutes,
    byDomain,
    byDate,
    byProject,
    byTag,
    startDate,
    endDate,
  }, {
    headers: {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
    },
  });
});
