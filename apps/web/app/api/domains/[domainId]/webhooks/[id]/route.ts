// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, webhooks } from '@project-e/db';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const updateWebhookSchema = z.object({
  name: z.string().optional(),
  url: z.string().url('Must be a valid URL').optional(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// GET /api/domains/[domainId]/webhooks/[id] — Get a single webhook
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [webhook] = await db.select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.workspaceId, domainId)))
    .limit(1);

  if (!webhook) {
    return createErrorResponse('NOT_FOUND', 'Webhook not found', 404);
  }

  // Never return the secret on GET
  const { secret: _, ...safe } = webhook;
  return NextResponse.json(safe);
});

// PATCH /api/domains/[domainId]/webhooks/[id] — Update a webhook
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = updateWebhookSchema.parse(body);

    const [existing] = await db.select()
      .from(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.workspaceId, domainId)))
      .limit(1);

    if (!existing) {
      return createErrorResponse('NOT_FOUND', 'Webhook not found', 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.events !== undefined) updateData.events = data.events;
    if (data.active !== undefined) updateData.active = data.active;

    const [updated] = await db.update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: 'updated',
      entityType: 'webhook',
      entityId: updated.id,
      changes: updateData,
      workspaceId: domainId,
    });

    const { secret: _, ...safe } = updated;
    return NextResponse.json(safe);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[webhook PATCH] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update webhook', 500);
  }
});

// DELETE /api/domains/[domainId]/webhooks/[id] — Delete a webhook
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [existing] = await db.select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.workspaceId, domainId)))
    .limit(1);

  if (!existing) {
    return createErrorResponse('NOT_FOUND', 'Webhook not found', 404);
  }

  await db.delete(webhooks).where(eq(webhooks.id, id));

  await recordActivity({
    actor: user.name,
    action: 'deleted',
    entityType: 'webhook',
    entityId: id,
    workspaceId: domainId,
  });

  return new NextResponse(null, { status: 204 });
});
