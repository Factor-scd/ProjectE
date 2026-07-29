// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { createAgentSchema } from '@project-e/shared';
import { z } from 'zod';

// GET /api/agents — List agents with filtering, sorting, pagination
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '50');
  const filter = searchParams.get('filter') || undefined;
  const sort = searchParams.get('sort') || '-created';

  const pb = createPocketBaseClient();
  const result = await pb.collection('agents').getList(page, perPage, {
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

// POST /api/agents — Create an agent with auto-generated API key
export const POST = withAuth(async (request: NextRequest, _user) => {
  try {
    const body = await request.json();
    const data = createAgentSchema.parse(body);

    const pb = createPocketBaseClient();
    const agent = await pb.collection('agents').create({
      ...data,
      api_key: crypto.randomUUID(),
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});
