// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// GET /api/error-logs — List recent error logs
export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');

  const pb = createPocketBaseClient();
  const result = await pb.collection('error_logs').getList(1, limit, {
    sort: '-created',
  });

  return NextResponse.json({
    items: result.items,
    totalItems: result.totalItems,
  });
});

// DELETE /api/error-logs — Clear all error logs
export const DELETE = withAuth(async () => {
  const pb = createPocketBaseClient();

  // Get all error logs and delete them
  const logs = await pb.collection('error_logs').getFullList();

  for (const log of logs) {
    await pb.collection('error_logs').delete(log.id);
  }

  return NextResponse.json({ deleted: logs.length });
});
