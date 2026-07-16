import { createAdminClient } from '../pocketbase';
import { eventBus, EVENTS } from '../events/event-bus';
import type { Webhook } from '@project-e/shared';

/**
 * Initialize webhook service — subscribe to all events
 * Call this once at app startup
 */
export function initializeWebhookService(): void {
  // Subscribe to all domain events
  eventBus.on(EVENTS.TASK_COMPLETED, (data) => {
    queueWebhookDelivery('task.completed', data);
  });

  eventBus.on(EVENTS.HABIT_COMPLETED, (data) => {
    queueWebhookDelivery('habit.completed', data);
  });

  eventBus.on(EVENTS.HABIT_STREAK_BROKEN, (data) => {
    queueWebhookDelivery('habit.streak_broken', data);
  });

  eventBus.on(EVENTS.MILESTONE_REACHED, (data) => {
    queueWebhookDelivery('milestone.reached', data);
  });

  eventBus.on(EVENTS.PROJECT_STATUS_CHANGED, (data) => {
    queueWebhookDelivery('project.status_changed', data);
  });

  eventBus.on(EVENTS.REPORT_GENERATED, (data) => {
    queueWebhookDelivery('report.generated', data);
  });

  eventBus.on(EVENTS.AGENT_TASK_COMPLETED, (data) => {
    queueWebhookDelivery('agent_task.completed', data);
  });
}

/**
 * Queue a webhook delivery for all matching webhooks
 */
async function queueWebhookDelivery(eventType: string, payload: unknown): Promise<void> {
  const pb = createAdminClient();

  try {
    // Get all active webhooks that subscribe to this event type
    const webhooks = await pb.collection('webhooks').getFullList({
      filter: 'active = true',
    }) as Webhook[];

    const matchingWebhooks = webhooks.filter((webhook) => {
      const events = webhook.events as string[];
      return events.includes(eventType) || events.includes('*');
    });

    // Queue delivery for each matching webhook
    for (const webhook of matchingWebhooks) {
      await pb.collection('queue_jobs').create({
        queue: 'webhooks',
        type: 'webhook_delivery',
        payload: {
          webhook_id: webhook.id,
          webhook_url: webhook.url,
          webhook_secret: webhook.secret || '',
          event_type: eventType,
          event_payload: payload,
        },
        status: 'pending',
        attempts: 0,
        max_attempts: webhook.retry_count || 3,
        scheduled_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Failed to queue webhook delivery:', error);
    // Log to error_logs collection
    await pb.collection('error_logs').create({
      level: 'error',
      source: 'webhook-service',
      message: 'Failed to queue webhook delivery',
      metadata: { eventType, payload, error: String(error) },
    }).catch(() => {
      // Ignore logging errors
    });
  }
}

/**
 * Deliver a webhook (called by the worker)
 */
export async function deliverWebhook(job: {
  webhook_id: string;
  webhook_url: string;
  webhook_secret: string;
  event_type: string;
  event_payload: unknown;
}): Promise<{ success: boolean; statusCode?: number; responseBody?: string }> {
  const { webhook_url, webhook_secret, event_type, event_payload } = job;

  try {
    // Create HMAC signature if secret is provided
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Event-Type': event_type,
    };

    if (webhook_secret) {
      const crypto = await import('node:crypto');
      const payload = JSON.stringify(event_payload);
      const signature = crypto
        .createHmac('sha256', webhook_secret)
        .update(payload)
        .digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(event_payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const responseBody = await response.text();

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody,
    };
  } catch (error) {
    return {
      success: false,
      responseBody: String(error),
    };
  }
}

/**
 * Record webhook delivery result
 */
export async function recordWebhookDelivery(
  webhookId: string,
  eventType: string,
  payload: unknown,
  result: { success: boolean; statusCode?: number; responseBody?: string },
  attempts: number
): Promise<void> {
  const pb = createAdminClient();

  await pb.collection('webhook_deliveries').create({
    webhook_id: webhookId,
    event: eventType,
    payload: payload as Record<string, unknown>,
    status: result.success ? 'success' : 'failed',
    status_code: result.statusCode || 0,
    response_body: result.responseBody || '',
    attempts,
  });
}
