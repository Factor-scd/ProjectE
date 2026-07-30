// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse, resolveActiveDomain } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { createCanvasSchema } from '@project-e/shared';
import { z } from 'zod';

// GET /api/canvases — List canvases with filtering, sorting, pagination
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '50');
  const filter = searchParams.get('filter') || undefined;
  const sort = searchParams.get('sort') || '-created';

  const pb = createPocketBaseClient();
  const result = await pb.collection('canvases').getList(page, perPage, {
    ...(filter ? { filter } : {}),
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

// POST /api/canvases — Create a canvas
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const data = createCanvasSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    const pb = createPocketBaseClient();
    const canvas = await pb.collection('canvases').create(data);

    return NextResponse.json(canvas, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});
