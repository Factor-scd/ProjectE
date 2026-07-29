// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// GET /api/analytics — Pre-computed analytics data
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30'; // days
  const days = parseInt(period);

  const pb = createPocketBaseClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString();

  // Task completion rate
  const tasks = await pb.collection('tasks').getFullList({
    filter: `created >= "${startStr}"`,
  });
  const completedTasks = tasks.filter((t: Record<string, unknown>) => t.status === 'done');
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  // Habit consistency
  const habits = await pb.collection('habits').getFullList();
  const habitLogs = await pb.collection('habit_logs').getFullList({
    filter: `logged_at >= "${startStr}"`,
  });
  const habitConsistency = habits.length > 0
    ? Math.round((habitLogs.length / (habits.length * days)) * 100)
    : 0;

  // Time tracked
  const timeEntries = await pb.collection('task_time_entries').getFullList({
    filter: `started_at >= "${startStr}"`,
  });
  const totalTimeMinutes = timeEntries.reduce(
    (sum: number, e: Record<string, unknown>) => sum + ((e.duration_minutes as number) || 0),
    0,
  );

  // Active streaks
  const activeStreaks = habits.filter(
    (h: Record<string, unknown>) => ((h.current_streak as number) || 0) > 0,
  );
  const bestStreak = Math.max(
    ...habits.map((h: Record<string, unknown>) => (h.best_streak as number) || 0),
    0,
  );

  return NextResponse.json({
    taskCompletionRate,
    habitConsistency,
    totalTimeMinutes,
    activeStreaks: activeStreaks.length,
    bestStreak,
    period: days,
  }, {
    headers: {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
    },
  });
});
