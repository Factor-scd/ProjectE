// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { z } from 'zod';

const bulkCreateSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    due_date: z.string().optional(),
    project_id: z.string().optional(),
    domain: z.string(),
    tags: z.array(z.string()).optional(),
  })).min(1).max(100),
});

const bulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1),
  updates: z.object({
    status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    project_id: z.string().optional(),
    domain: z.string().optional(),
  }),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

// POST /api/tasks/bulk — Bulk create/update/delete
export const POST = withAuth(async (request: NextRequest, _user) => {
  const body = await request.json();
  const pb = createPocketBaseClient();

  // Determine operation from body shape
  if ('tasks' in body) {
    // Bulk create
    const data = bulkCreateSchema.parse(body);
    const created = [];
    for (const task of data.tasks) {
      const result = await pb.collection('tasks').create(task);
      created.push(result);
    }
    return NextResponse.json({ created: created.length, items: created }, { status: 201 });
  }

  if ('ids' in body && 'updates' in body) {
    // Bulk update
    const data = bulkUpdateSchema.parse(body);
    const updated = [];
    for (const id of data.ids) {
      const result = await pb.collection('tasks').update(id, data.updates);
      updated.push(result);
    }
    return NextResponse.json({ updated: updated.length, items: updated });
  }

  if ('ids' in body) {
    // Bulk delete
    const data = bulkDeleteSchema.parse(body);
    for (const id of data.ids) {
      await pb.collection('tasks').delete(id);
    }
    return NextResponse.json({ deleted: data.ids.length });
  }

  return createErrorResponse('INVALID_REQUEST', 'Must specify tasks, ids+updates, or ids', 400);
});
