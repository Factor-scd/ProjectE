// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { db, domains } from '@project-e/db';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const createDomainSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

// GET /api/domains — List domains with filtering, sorting, pagination
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')));
  const sortParam = searchParams.get('sort') || 'sort_order';
  const filter = searchParams.get('filter') || undefined;

  // Build order by — whitelist safe column names
  const sortDir = sortParam.startsWith('-') ? 'desc' : 'asc';
  const sortField = sortParam.replace(/^-/, '');
  const sortColumns: Record<string, any> = {
    name: domains.name,
    slug: domains.slug,
    sort_order: domains.sortOrder,
    created_at: domains.createdAt,
    updated_at: domains.updatedAt,
  };
  const orderBy = sortDir === 'asc'
    ? asc(sortColumns[sortField] || domains.sortOrder)
    : desc(sortColumns[sortField] || domains.sortOrder);

  // Build where clause
  const conditions: any[] = [];
  if (filter) {
    conditions.push(
      or(
        ilike(domains.name, `%${filter}%`),
        ilike(domains.slug, `%${filter}%`),
      )!
    );
  }

  const offset = (page - 1) * perPage;

  const [items, countResult] = await Promise.all([
    db.select()
      .from(domains)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(domains)
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

// POST /api/domains — Create a domain
export const POST = withAuth(async (request: NextRequest, _user) => {
  try {
    const body = await request.json();
    const data = createDomainSchema.parse(body);

    const [domain] = await db.insert(domains)
      .values({
        name: data.name,
        slug: data.slug,
        color: data.color || null,
        icon: data.icon || null,
        parentId: data.parentId || null,
      })
      .returning();

    return NextResponse.json(domain, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});
