import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/webhooks/[id]/test — Send a test event to the webhook
export const POST = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();

  // Get the webhook
  const webhook = await pb.collection('webhooks').getOne(id);

  if (!webhook.active) {
    return createErrorResponse('WEBHOOK_DISABLED', 'Cannot test a disabled webhook', 400);
  }

  // Create a test payload
  const testPayload = {
    event: 'test.ping',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook delivery from Project E.',
      webhook_id: webhook.id,
      webhook_name: webhook.name,
    },
  };

  // Create HMAC signature if secret is provided
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Event-Type': 'test.ping',
  };

  if (webhook.secret) {
    const crypto = await import('node:crypto');
    const body = JSON.stringify(testPayload);
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');
    headers['X-Webhook-Signature'] = signature;
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
    await pb.collection('webhook_deliveries').create({
      webhook_id: webhook.id,
      event_type: 'test.ping',
      payload: testPayload as Record<string, unknown>,
      success: response.ok,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      attempts: 1,
    });

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      response: responseBody.substring(0, 500),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Record the failed delivery
    await pb.collection('webhook_deliveries').create({
      webhook_id: webhook.id,
      event_type: 'test.ping',
      payload: testPayload as Record<string, unknown>,
      success: false,
      response_status: 0,
      response_body: errorMessage,
      attempts: 1,
    });

    return NextResponse.json({
      success: false,
      status: 0,
      response: errorMessage,
    });
  }
});
