// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, projects, sections } from '@project-e/db';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

const sectionKindEnum = z.enum(['section', 'milestone']);
const sectionStatusEnum = z.enum(['planned', 'in_progress', 'complete']);

const updateSectionSchema = z.object({
  name: z.string().min(1).optional(),
  kind: sectionKindEnum.optional(),
  status: sectionStatusEnum.optional(),
  targetDate: z.string().datetime().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ domainId: string; projectId: string; id: string }> };

// GET /api/domains/[domainId]/projects/[projectId]/sections/[id] — Get a single section
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, projectId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [section] = await db.select()
    .from(sections)
    .where(and(eq(sections.id, id), eq(sections.projectId, projectId)))
    .limit(1);

  if (!section) {
    return createErrorResponse('NOT_FOUND', 'Section not found', 404);
  }

  return NextResponse.json(section);
});

// PATCH /api/domains/[domainId]/projects/[projectId]/sections/[id] — Update a section
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, projectId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = updateSectionSchema.parse(body);

    const [existing] = await db.select()
      .from(sections)
      .where(and(eq(sections.id, id), eq(sections.projectId, projectId)))
      .limit(1);

    if (!existing) {
      return createErrorResponse('NOT_FOUND', 'Section not found', 404);
    }

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.kind !== undefined) updateValues.kind = data.kind;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.targetDate !== undefined) updateValues.targetDate = data.targetDate ? new Date(data.targetDate) : null;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(sections)
      .set(updateValues)
      .where(eq(sections.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: 'updated',
      entityType: 'section',
      entityId: id,
      changes: { ...data, previousName: existing.name, projectId },
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
    console.error('[sections PATCH] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update section', 500);
  }
});

// DELETE /api/domains/[domainId]/projects/[projectId]/sections/[id] — Delete a section
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, projectId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [existing] = await db.select()
    .from(sections)
    .where(and(eq(sections.id, id), eq(sections.projectId, projectId)))
    .limit(1);

  if (!existing) {
    return createErrorResponse('NOT_FOUND', 'Section not found', 404);
  }

  await db.delete(sections)
    .where(eq(sections.id, id));

  await recordActivity({
    actor: user.name,
    action: 'deleted',
    entityType: 'section',
    entityId: id,
    changes: { name: existing.name, projectId },
    workspaceId: domainId,
  });

  return new NextResponse(null, { status: 204 });
});
