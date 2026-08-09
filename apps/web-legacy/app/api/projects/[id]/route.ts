// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { updateProjectSchema } from '@project-e/shared';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/projects/[id] — Get a single project with computed stats
export const GET = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  const project = await pb.collection('projects').getOne(id);

  // Compute task stats from related tasks
  const tasksResult = await pb.collection('tasks').getFullList({
    filter: 'project_id=' + id,
  });

  const taskCount = tasksResult.length;
  const completedCount = tasksResult.filter((t: any) => t.status === 'done').length;
  const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

  return NextResponse.json({
    ...project,
    progress,
    task_count: taskCount,
    completed_count: completedCount,
  });
});

// PATCH /api/projects/[id] — Update a project
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const data = updateProjectSchema.parse(body);

    const pb = createPocketBaseClient();
    const project = await pb.collection('projects').update(id, data);

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});

// DELETE /api/projects/[id] — Delete a project
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  await pb.collection('projects').delete(id);

  return new NextResponse(null, { status: 204 });
});
