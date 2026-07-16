import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/webhook-deliveries/[id]/retry — Manually retry a failed delivery
export const POST = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();

  // Get the failed delivery
  const delivery = await pb.collection('webhook_deliveries').getOne(id);

  if (delivery.status === 'success') {
    return createErrorResponse('INVALID_STATE', 'Cannot retry a successful delivery', 400);
  }

  // Get the webhook to get the URL
  const webhook = await pb.collection('webhooks').getOne(delivery.webhook_id);

  // Create a new queue job for retry
  await pb.collection('queue_jobs').create({
    queue: 'webhooks',
    type: 'webhook_delivery',
    payload: {
      webhook_id: webhook.id,
      webhook_url: webhook.url,
      webhook_secret: webhook.secret || '',
      event_type: delivery.event_type,
      event_payload: delivery.payload,
    },
    status: 'pending',
    retry_count: 0,
    max_attempts: 3,
    scheduled_at: new Date().toISOString(),
  });

  // Update the delivery status to pending
  await pb.collection('webhook_deliveries').update(id, {
    status: 'pending',
  });

  return NextResponse.json({ success: true, message: 'Retry queued' });
});
