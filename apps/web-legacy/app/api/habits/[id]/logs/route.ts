// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { logHabitCompletion } from '@/lib/services';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/habits/[id]/logs — List logs for a habit
export const GET = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '50');
  const filter = searchParams.get('filter') || undefined;
  const sort = searchParams.get('sort') || '-logged_at';

  const pb = createPocketBaseClient();
  const result = await pb.collection('habit_logs').getList(page, perPage, {
    filter: filter ? `habit_id = "${id}" && ${filter}` : `habit_id = "${id}"`,
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

// POST /api/habits/[id]/logs — Create a habit log entry
export const POST = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const data = z
      .object({
        logged_at: z.string().datetime().optional(),
        mood: z.number().int().min(1).max(5).optional(),
        value: z.number().optional(),
        notes: z.string().optional(),
      })
      .parse(body);

    const result = await logHabitCompletion(id, data);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});
