import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { createTagSchema } from '@project-e/shared';
import { z } from 'zod';

// GET /api/tags — List tags with filtering, sorting, pagination
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '50');
  const filter = searchParams.get('filter') || '';
  const sort = searchParams.get('sort') || 'name';

  const pb = createPocketBaseClient();
  const result = await pb.collection('tags').getList(page, perPage, {
    filter,
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

// POST /api/tags — Create a tag
export const POST = withAuth(async (request: NextRequest, _user) => {
  try {
    const body = await request.json();
    const data = createTagSchema.parse(body);

    const pb = createPocketBaseClient();
    const tag = await pb.collection('tags').create(data);

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});
