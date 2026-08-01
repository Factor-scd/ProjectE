// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse } from '@/lib/auth';
import { db, webhooks, webhookDeliveries } from '@project-e/db';
import { and, eq } from 'drizzle-orm';
import { createHmac } from 'node:crypto';

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// POST /api/domains/[domainId]/webhooks/[id]/test — Send a test event
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [webhook] = await db.select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.workspaceId, domainId)))
    .limit(1);

  if (!webhook) {
    return createErrorResponse('NOT_FOUND', 'Webhook not found', 404);
  }

  if (!webhook.active) {
    return createErrorResponse('WEBHOOK_DISABLED', 'Cannot test a disabled webhook', 400);
  }

  const testPayload = {
    event: 'test.ping',
    entity_type: 'test',
    entity_id: 'test-001',
    data: { message: 'This is a test webhook delivery from Project E.', webhook_id: webhook.id },
    timestamp: new Date().toISOString(),
    workspace_id: domainId,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Event-Type': 'test.ping',
  };

  if (webhook.secret) {
    const body = JSON.stringify(testPayload);
    const signature = createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');
    headers['X-ProjectE-Signature'] = signature;
  }

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = await response.text();

    // Record the delivery
    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      event: 'test.ping',
      payload: testPayload as Record<string, unknown>,
      status: response.ok ? 'success' : 'failed',
      statusCode: response.status,
      responseBody: responseBody.substring(0, 1000),
      attempts: 1,
    });

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      response: responseBody.substring(0, 500),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      event: 'test.ping',
      payload: testPayload as Record<string, unknown>,
      status: 'failed',
      statusCode: 0,
      responseBody: errorMessage,
      attempts: 1,
    });

    return NextResponse.json({
      success: false,
      status: 0,
      response: errorMessage,
    });
  }
});
