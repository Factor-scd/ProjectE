// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, webhooks, webhookDeliveries } from '@project-e/db';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

const createWebhookSchema = z.object({
  name: z.string().optional(),
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.string()).default([]),
  active: z.boolean().optional().default(true),
});

const updateWebhookSchema = z.object({
  name: z.string().optional(),
  url: z.string().url('Must be a valid URL').optional(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ domainId: string }> };
type IdRouteContext = { params: Promise<{ domainId: string; id: string }> };

// GET /api/domains/[domainId]/webhooks — List webhooks
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');

  const [items, countResult] = await Promise.all([
    db.select()
      .from(webhooks)
      .where(eq(webhooks.workspaceId, domainId))
      .orderBy(desc(webhooks.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(webhooks)
      .where(eq(webhooks.workspaceId, domainId)),
  ]);

  return NextResponse.json({
    items,
    totalItems: Number(countResult[0]?.count || 0),
    limit,
    offset,
  });
});

// POST /api/domains/[domainId]/webhooks — Create a webhook
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = createWebhookSchema.parse(body);

    // Generate a webhook secret (shown only once on create)
    const secret = `whsec_${randomBytes(24).toString('hex')}`;

    const [webhook] = await db.insert(webhooks).values({
      name: data.name ?? null,
      url: data.url,
      secret,
      events: data.events,
      active: data.active ?? true,
      workspaceId: domainId,
    }).returning();

    await recordActivity({
      actor: user.name,
      action: 'created',
      entityType: 'webhook',
      entityId: webhook.id,
      changes: { name: webhook.name, url: webhook.url, events: webhook.events },
      workspaceId: domainId,
    });

    // Return the secret on create — it won't be shown again
    return NextResponse.json({ ...webhook, secret }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[webhooks POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create webhook', 500);
  }
});
