import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { db, reports } from '@project-e/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

function mapReport(report: Record<string, any>) {
  return {
    id: report.id,
    title: report.title,
    content: report.content || '',
    report_type: report.reportType || report.report_type || 'custom',
    date_range_start: report.dateRangeStart?.toISOString?.() || report.date_range_start || null,
    date_range_end: report.dateRangeEnd?.toISOString?.() || report.date_range_end || null,
    domain: report.domain || 'personal',
    is_draft: report.isDraft ?? report.is_draft ?? false,
    created: report.createdAt?.toISOString?.() || report.created || new Date().toISOString(),
    updated: report.updatedAt?.toISOString?.() || report.updated || new Date().toISOString(),
  };
}


const updateReportSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  content: z.string().optional(),
  report_type: z.enum(['weekly', 'monthly', 'project', 'habit', 'custom']).optional(),
  date_range_start: z.string().optional(),
  date_range_end: z.string().optional(),
  domain: z.string().optional(),
  is_draft: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/reports/[id] — Get a single report
export const GET = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const [report] = await db.select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);

  if (!report) {
    return createErrorResponse('NOT_FOUND', 'Report not found', 404);
  }

  return NextResponse.json(mapReport(report));
});

// PATCH /api/reports/[id] — Update a report
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const data = updateReportSchema.parse(body);

    const updateValues: Record<string, any> = {};
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.content !== undefined) updateValues.content = data.content;
    if (data.report_type !== undefined) updateValues.reportType = data.report_type;
    if (data.date_range_start !== undefined) updateValues.dateRangeStart = new Date(data.date_range_start);
    if (data.date_range_end !== undefined) updateValues.dateRangeEnd = new Date(data.date_range_end);
    if (data.domain !== undefined) updateValues.domain = data.domain;
    if (data.is_draft !== undefined) updateValues.isDraft = data.is_draft;
    updateValues.updatedAt = new Date();

    const [report] = await db.update(reports)
      .set(updateValues)
      .where(eq(reports.id, id))
      .returning();

    if (!report) {
      return createErrorResponse('NOT_FOUND', 'Report not found', 404);
    }

    return NextResponse.json(mapReport(report));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});

// DELETE /api/reports/[id] — Delete a report
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const [deleted] = await db.delete(reports)
    .where(eq(reports.id, id))
    .returning({ id: reports.id });

  if (!deleted) {
    return createErrorResponse('NOT_FOUND', 'Report not found', 404);
  }

  return new NextResponse(null, { status: 204 });
});
