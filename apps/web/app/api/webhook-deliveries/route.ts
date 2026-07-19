import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// GET /api/webhook-deliveries — List webhook deliveries with filtering
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '50');
  const filter = searchParams.get('filter') || undefined;
  const sort = searchParams.get('sort') || '-created';
  const webhookId = searchParams.get('webhook_id') || '';

  const pb = createPocketBaseClient();

  let combinedFilter = filter;
  if (webhookId) {
    combinedFilter = combinedFilter
      ? `${combinedFilter} && webhook_id = "${webhookId}"`
      : `webhook_id = "${webhookId}"`;
  }

  const result = await pb.collection('webhook_deliveries').getList(page, perPage, {
    filter: combinedFilter,
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
