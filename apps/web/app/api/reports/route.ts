import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { db, reports } from '@project-e/db';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const createReportSchema = z.object({
  title: z.string().min(1, 'Title is required').default('Untitled report'),
  content: z.string().optional().default(''),
  report_type: z.enum(['weekly', 'monthly', 'project', 'habit', 'custom']).default('custom'),
  date_range_start: z.string().optional(),
  date_range_end: z.string().optional(),
  domain: z.string().default('personal'),
});

// GET /api/reports — List reports
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')));
  const sortParam = searchParams.get('sort') || '-created';
  const filter = searchParams.get('filter') || undefined;

  const sortDir = sortParam.startsWith('-') ? 'desc' : 'asc';
  const sortField = sortParam.replace(/^-/, '');
  const sortColumns: Record<string, any> = {
    title: reports.title,
    report_type: reports.reportType,
    domain: reports.domain,
    created: reports.createdAt,
    updated: reports.updatedAt,
  };
  const orderBy = sortDir === 'asc'
    ? asc(sortColumns[sortField] || reports.createdAt)
    : desc(sortColumns[sortField] || reports.createdAt);

  const conditions: any[] = [];
  if (filter) {
    conditions.push(
      or(
        ilike(reports.title, `%${filter}%`),
      )!
    );
  }

  const offset = (page - 1) * perPage;

  const [items, countResult] = await Promise.all([
    db.select()
      .from(reports)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(reports)
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

// POST /api/reports — Create a report
export const POST = withAuth(async (request: NextRequest, _user) => {
  try {
    const body = await request.json();
    const data = createReportSchema.parse(body);

    const [report] = await db.insert(reports)
      .values({
        title: data.title,
        content: data.content || '',
        reportType: data.report_type,
        dateRangeStart: data.date_range_start ? new Date(data.date_range_start) : null,
        dateRangeEnd: data.date_range_end ? new Date(data.date_range_end) : null,
        domain: data.domain,
      })
      .returning();

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});
