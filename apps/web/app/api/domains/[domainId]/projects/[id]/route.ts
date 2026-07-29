// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, projects, tasks, sections, projectTags, tags as tagsTable } from '@project-e/db';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

const projectStatusEnum = z.enum(['active', 'paused', 'completed', 'archived']);

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: projectStatusEnum.optional(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
});

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// GET /api/domains/[domainId]/projects/[id] — Get a single project with sections, task counts, progress
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [project] = await db.select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.domainId, domainId), isNull(projects.deletedAt)))
    .limit(1);

  if (!project) {
    return createErrorResponse('NOT_FOUND', 'Project not found', 404);
  }

  // Fetch sections
  const projectSections = await db.select()
    .from(sections)
    .where(eq(sections.projectId, id))
    .orderBy(asc(sections.sortOrder));

  // Fetch tasks grouped by section
  const projectTasks = await db.select()
    .from(tasks)
    .where(and(eq(tasks.projectId, id), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.order));

  // Fetch tags
  const tagRows = await db.select({
    id: tagsTable.id,
    name: tagsTable.name,
    color: tagsTable.color,
  })
    .from(projectTags)
    .innerJoin(tagsTable, eq(projectTags.tagId, tagsTable.id))
    .where(eq(projectTags.projectId, id));

  // Compute counts
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter(t => t.status === 'done').length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return NextResponse.json({
    ...project,
    sections: projectSections,
    tasks: projectTasks,
    tags: tagRows,
    taskCount: totalTasks,
    completedCount: completedTasks,
    progress,
  });
});

// PATCH /api/domains/[domainId]/projects/[id] — Update a project
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = updateProjectSchema.parse(body);

    const [existing] = await db.select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.domainId, domainId), isNull(projects.deletedAt)))
      .limit(1);

    if (!existing) {
      return createErrorResponse('NOT_FOUND', 'Project not found', 404);
    }

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.color !== undefined) updateValues.color = data.color;
    if (data.icon !== undefined) updateValues.icon = data.icon;
    if (data.targetDate !== undefined) updateValues.targetDate = data.targetDate ? new Date(data.targetDate) : null;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(projects)
      .set(updateValues)
      .where(eq(projects.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: 'updated',
      entityType: 'project',
      entityId: id,
      changes: { ...data, previousName: existing.name },
      workspaceId: domainId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[projects PATCH] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update project', 500);
  }
});

// DELETE /api/domains/[domainId]/projects/[id] — Soft delete a project
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [existing] = await db.select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.domainId, domainId), isNull(projects.deletedAt)))
    .limit(1);

  if (!existing) {
    return createErrorResponse('NOT_FOUND', 'Project not found', 404);
  }

  await db.update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, id));

  await recordActivity({
    actor: user.name,
    action: 'deleted',
    entityType: 'project',
    entityId: id,
    changes: { name: existing.name },
    workspaceId: domainId,
  });

  return new NextResponse(null, { status: 204 });
});
