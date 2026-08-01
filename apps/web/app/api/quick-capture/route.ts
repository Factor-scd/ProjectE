// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse, resolveActiveDomain } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, tasks, habits, notes, projects } from '@project-e/db';
import { z } from 'zod';

const quickCaptureSchema = z.object({
  type: z.enum(['task', 'habit', 'note', 'project']),
  text: z.string().min(1, 'Text is required'),
  description: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  domain: z.string().optional(),
});

// POST /api/quick-capture — Create an entity from quick text input
// Forwards to the appropriate create logic after resolving the active domain.
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const data = quickCaptureSchema.parse(body);
    const domainId = data.domain || (await resolveActiveDomain(user)).id;

    let result;

    switch (data.type) {
      case 'task': {
        const [task] = await db.insert(tasks).values({
          title: data.text,
          description: data.description ?? null,
          domainId,
          priority: data.priority,
        }).returning();
        result = task;
        await recordActivity({
          actor: user.name,
          action: 'created',
          entityType: 'task',
          entityId: task.id,
          changes: { title: task.title },
          workspaceId: domainId,
        });
        break;
      }
      case 'habit': {
        const [habit] = await db.insert(habits).values({
          name: data.text,
          description: data.description ?? null,
          domainId,
        }).returning();
        result = habit;
        await recordActivity({
          actor: user.name,
          action: 'created',
          entityType: 'habit',
          entityId: habit.id,
          changes: { name: habit.name },
          workspaceId: domainId,
        });
        break;
      }
      case 'note': {
        const [note] = await db.insert(notes).values({
          title: data.text,
          content: data.description ?? null,
          domainId,
        }).returning();
        result = note;
        await recordActivity({
          actor: user.name,
          action: 'created',
          entityType: 'note',
          entityId: note.id,
          changes: { title: note.title },
          workspaceId: domainId,
        });
        break;
      }
      case 'project': {
        const [project] = await db.insert(projects).values({
          name: data.text,
          description: data.description ?? null,
          domainId,
        }).returning();
        result = project;
        await recordActivity({
          actor: user.name,
          action: 'created',
          entityType: 'project',
          entityId: project.id,
          changes: { name: project.name },
          workspaceId: domainId,
        });
        break;
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    console.error('[quick-capture POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create', 500);
  }
});
