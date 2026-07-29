// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, projects, projectTags, tags as tagsTable } from '@project-e/db';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const projectStatusEnum = z.enum(['active', 'paused', 'completed', 'archived']);

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  domain: z.string().min(1, 'Domain is required'),
  status: projectStatusEnum.optional().default('active'),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional(),
});

// GET /api/projects — List projects with filtering, sorting, pagination
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')));
  const filter = searchParams.get('filter') || undefined;
  const sort = searchParams.get('sort') || '-created';
  const domainId = searchParams.get('domain') || undefined;

  const sortDir = sort.startsWith('-') ? 'desc' : 'asc';
  const sortField = sort.replace(/^-/, '');
  const sortColumns: Record<string, any> = {
    created: projects.createdAt,
    updated: projects.updatedAt,
    name: projects.name,
    status: projects.status,
  };
  const orderBy = sortDir === 'asc'
    ? asc(sortColumns[sortField] || projects.createdAt)
    : desc(sortColumns[sortField] || projects.createdAt);

  const conditions: any[] = [isNull(projects.deletedAt)];
  if (domainId) conditions.push(eq(projects.domainId, domainId));
  if (filter) {
    conditions.push(ilike(projects.name, `%${filter}%`));
  }

  const offset = (page - 1) * perPage;

  const [items, countResult] = await Promise.all([
    db.select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(...conditions)),
  ]);

  const totalItems = Number(countResult[0]?.count || 0);

  return NextResponse.json({
    items,
    totalItems,
    totalPages: Math.ceil(totalItems / perPage),
    page,
    perPage,
  });
});

// POST /api/projects — Create a project
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json();
    const data = createProjectSchema.parse(body);

    const [project] = await db.insert(projects).values({
      name: data.name,
      description: data.description ?? null,
      domainId: data.domain,
      status: data.status,
      color: data.color ?? null,
      icon: data.icon ?? null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
    }).returning();

    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(projectTags).values(
        data.tagIds.map(tagId => ({ projectId: project.id, tagId }))
      );
    }

    await recordActivity({
      actor: user.name,
      action: 'created',
      entityType: 'project',
      entityId: project.id,
      changes: { name: project.name },
      workspaceId: data.domain,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    console.error('[projects POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create project', 500);
  }
});
