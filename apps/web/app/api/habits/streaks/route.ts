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
