import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// GET /api/habit-logs — List habit logs with date filtering
export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const habitId = searchParams.get('habit_id');

  let filter = '';
  if (start && end) {
    filter = `logged_at >= "${start}" && logged_at <= "${end}"`;
  } else if (start) {
    filter = `logged_at >= "${start}"`;
  } else if (habitId) {
    filter = `habit_id = "${habitId}"`;
  }

  const pb = createPocketBaseClient();
  const result = await pb.collection('habit_logs').getList(1, 1000, {
    ...(filter ? { filter } : {}),
    sort: '-logged_at',
  });

  return NextResponse.json({
    items: result.items,
    totalItems: result.totalItems,
  });
});
