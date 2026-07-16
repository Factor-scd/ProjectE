import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { createMilestoneSchema } from '@project-e/shared';
import { z } from 'zod';

// GET /api/milestones — List milestones with filtering, sorting, pagination
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '50');
  const filter = searchParams.get('filter') || '';
  const sort = searchParams.get('sort') || '-created';

  const pb = createPocketBaseClient();
  const result = await pb.collection('milestones').getList(page, perPage, {
    filter,
    sort,
  });

  const response = NextResponse.json({
    items: result.items,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
    page: result.page,
    perPage: result.perPage,
  });

  response.headers.set(
    'Cache-Control',
    'private, max-age=60, stale-while-revalidate=300'
  );

  return response;
});

// POST /api/milestones — Create a milestone
export const POST = withAuth(async (request: NextRequest, _user) => {
  try {
    const body = await request.json();
    const data = createMilestoneSchema.parse(body);

    const pb = createPocketBaseClient();
    const milestone = await pb.collection('milestones').create(data);

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});
