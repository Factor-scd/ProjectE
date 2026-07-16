import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { updateWebhookSchema } from '@project-e/shared';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/webhooks/[id] — Get a single webhook
export const GET = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  const webhook = await pb.collection('webhooks').getOne(id);

  return NextResponse.json(webhook);
});

// PATCH /api/webhooks/[id] — Update a webhook
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const data = updateWebhookSchema.parse(body);

    const pb = createPocketBaseClient();
    const webhook = await pb.collection('webhooks').update(id, data);

    return NextResponse.json(webhook);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});

// DELETE /api/webhooks/[id] — Delete a webhook
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  await pb.collection('webhooks').delete(id);

  return new NextResponse(null, { status: 204 });
});
