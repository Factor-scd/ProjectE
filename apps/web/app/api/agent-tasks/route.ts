import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// GET /api/agent-tasks — List agent tasks
export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '50');
  const sort = searchParams.get('sort') || '-created';

  const pb = createPocketBaseClient();
  const result = await pb.collection('agent_tasks').getList(page, perPage, {
    sort,
  });

  return NextResponse.json({
    items: result.items,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
    page: result.page,
    perPage: result.perPage,
  });
});
