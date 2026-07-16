import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { updateTaskSchema } from '@project-e/shared';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/tasks/[id] — Get a single task
export const GET = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  const task = await pb.collection('tasks').getOne(id);

  return NextResponse.json(task);
});

// PATCH /api/tasks/[id] — Update a task
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const data = updateTaskSchema.parse(body);

    const pb = createPocketBaseClient();
    const task = await pb.collection('tasks').update(id, data);

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});

// DELETE /api/tasks/[id] — Delete a task
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  await pb.collection('tasks').delete(id);

  return new NextResponse(null, { status: 204 });
});
