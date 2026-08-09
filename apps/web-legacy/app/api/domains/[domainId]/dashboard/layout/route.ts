// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, domains } from '@project-e/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

type RouteContext = { params: Promise<{ domainId: string }> };

const layoutItemSchema = z.object({
  widgetId: z.string(),
  order: z.number().int(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const updateLayoutSchema = z.object({
  layout: z.array(layoutItemSchema),
});

// PUT /api/domains/[domainId]/dashboard/layout — Update dashboard layout
export const PUT = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = updateLayoutSchema.parse(body);

    const [domain] = await db.select({ id: domains.id, customFields: domains.customFields })
      .from(domains)
      .where(eq(domains.id, domainId))
      .limit(1);

    if (!domain) {
      return createErrorResponse('NOT_FOUND', 'Domain not found', 404);
    }

    // Store layout in domain's custom_fields
    const existingFields = (domain.customFields as Record<string, unknown>) || {};
    await db.update(domains)
      .set({
        customFields: { ...existingFields, dashboard_layout: data.layout },
        updatedAt: new Date(),
      })
      .where(eq(domains.id, domainId));

    await recordActivity({
      actor: user.name,
      action: 'updated',
      entityType: 'domain',
      entityId: domainId,
      changes: { dashboardLayout: data.layout },
      workspaceId: domainId,
    });

    return NextResponse.json({ layout: data.layout });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[dashboard/layout PUT] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update dashboard layout', 500);
  }
});
