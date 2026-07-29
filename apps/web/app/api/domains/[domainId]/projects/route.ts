// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, projects, tasks, sections, projectTags, tags as tagsTable } from '@project-e/db';
import { and, asc, desc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

const projectStatusEnum = z.enum(['active', 'paused', 'completed', 'archived']);

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  status: projectStatusEnum.optional().default('active'),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional(),
});

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/projects — List projects with filtering
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');
  const sort = searchParams.get('sort') || 'name';
  const order = searchParams.get('order') || 'asc';

  const conditions: any[] = [
    eq(projects.domainId, domainId),
    isNull(projects.deletedAt),
  ];

  if (status) {
    const statuses = status.split(',');
    conditions.push(inArray(projects.status, statuses as any));
  }
  if (search) conditions.push(ilike(projects.name, `%${search}%`));

  const orderFn = order === 'desc' ? desc : asc;
  let orderColumn;
  switch (sort) {
    case 'status': orderColumn = orderFn(projects.status); break;
    case 'target_date': orderColumn = orderFn(projects.targetDate); break;
    case 'created_at': orderColumn = orderFn(projects.createdAt); break;
    case 'updated_at': orderColumn = orderFn(projects.updatedAt); break;
    default: orderColumn = orderFn(projects.name); break;
  }

  const [items, countResult] = await Promise.all([
    db.select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(...conditions)),
  ]);

  const totalItems = Number(countResult[0]?.count || 0);

  // Fetch task counts and tags for all projects
  let projectTagMap = new Map<string, { id: string; name: string; color: string | null }[]>();
  let taskCountMap = new Map<string, { total: number; completed: number }>();

  if (items.length > 0) {
    const projectIds = items.map(p => p.id);

    // Tags
    const tagRows = await db.select({
      projectId: projectTags.projectId,
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
    })
      .from(projectTags)
      .innerJoin(tagsTable, eq(projectTags.tagId, tagsTable.id))
      .where(inArray(projectTags.projectId, projectIds));

    for (const row of tagRows) {
      if (!projectTagMap.has(row.projectId)) projectTagMap.set(row.projectId, []);
      projectTagMap.get(row.projectId)!.push({ id: row.id, name: row.name, color: row.color });
    }

    // Task counts
    for (const projectId of projectIds) {
      const [totalResult] = await db.select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));

      const [completedResult] = await db.select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.status, 'done'), isNull(tasks.deletedAt)));

      taskCountMap.set(projectId, {
        total: Number(totalResult?.count || 0),
        completed: Number(completedResult?.count || 0),
      });
    }
  }

  const itemsWithMeta = items.map(p => {
    const counts = taskCountMap.get(p.id) || { total: 0, completed: 0 };
    return {
      ...p,
      tags: projectTagMap.get(p.id) || [],
      taskCount: counts.total,
      completedCount: counts.completed,
      progress: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
    };
  });

  return NextResponse.json({
    items: itemsWithMeta,
    totalItems,
    limit,
    offset,
  });
});

// POST /api/domains/[domainId]/projects — Create a project
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = createProjectSchema.parse(body);

    const [project] = await db.insert(projects).values({
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      domainId,
      color: data.color ?? null,
      icon: data.icon ?? null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
    }).returning();

    // Insert tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(projectTags).values(
        data.tagIds.map(tagId => ({ projectId: project.id, tagId }))
      );
    }

    // Record activity
    await recordActivity({
      actor: user.name,
      action: 'created',
      entityType: 'project',
      entityId: project.id,
      changes: { name: project.name, status: project.status },
      workspaceId: domainId,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[projects POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create project', 500);
  }
});
