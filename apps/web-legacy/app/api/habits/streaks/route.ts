// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { getHabitStreaks } from '@/lib/services/habit-service';

// GET /api/habits/streaks — Get all habit streaks
export const GET = withAuth(async () => {
  const streaks = await getHabitStreaks();
  return NextResponse.json({ streaks }, {
    headers: {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    },
  });
});
