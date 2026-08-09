// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, projects, sections } from '@project-e/db';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

const sectionKindEnum = z.enum(['section', 'milestone']);
const sectionStatusEnum = z.enum(['planned', 'in_progress', 'complete']);

const createSectionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  kind: sectionKindEnum.optional().default('section'),
  status: sectionStatusEnum.optional().default('planned'),
  targetDate: z.string().datetime().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ domainId: string; projectId: string }> };

// GET /api/domains/[domainId]/projects/[projectId]/sections — List sections for a project
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, projectId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  // Verify project exists and belongs to domain
  const [project] = await db.select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.domainId, domainId), isNull(projects.deletedAt)))
    .limit(1);

  if (!project) {
    return createErrorResponse('NOT_FOUND', 'Project not found', 404);
  }

  const items = await db.select()
    .from(sections)
    .where(eq(sections.projectId, projectId))
    .orderBy(asc(sections.sortOrder));

  return NextResponse.json({ items });
});

// POST /api/domains/[domainId]/projects/[projectId]/sections — Create a section
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, projectId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = createSectionSchema.parse(body);

    // Verify project exists
    const [project] = await db.select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.domainId, domainId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return createErrorResponse('NOT_FOUND', 'Project not found', 404);
    }

    // Determine sort order if not provided
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(sections)
        .where(eq(sections.projectId, projectId));
      sortOrder = Number(maxOrder?.max || -1) + 1;
    }

    const [section] = await db.insert(sections).values({
      name: data.name,
      projectId,
      kind: data.kind,
      status: data.status,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      sortOrder,
    }).returning();

    await recordActivity({
      actor: user.name,
      action: 'created',
      entityType: 'section',
      entityId: section.id,
      changes: { name: section.name, projectId, projectName: project.name, kind: section.kind },
      workspaceId: domainId,
    });

    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[sections POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create section', 500);
  }
});
