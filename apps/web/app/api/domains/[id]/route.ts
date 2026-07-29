// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { updateDomainSchema } from '@project-e/shared';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/domains/[id] — Get a single domain
export const GET = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  const domain = await pb.collection('domains').getOne(id);

  return NextResponse.json(domain);
});

// PATCH /api/domains/[id] — Update a domain
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const data = updateDomainSchema.parse(body);

    const pb = createPocketBaseClient();
    const domain = await pb.collection('domains').update(id, data);

    return NextResponse.json(domain);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});

// DELETE /api/domains/[id] — Delete a domain
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  await pb.collection('domains').delete(id);

  return new NextResponse(null, { status: 204 });
});
