import { db, jobs, webhooks } from "@project-e/db";
import { and, eq } from "drizzle-orm";

/**
 * Enqueue a single webhook delivery job for a specific webhook. Used directly by
 * the test endpoint and by `enqueueWebhooks` for every matching webhook. The
 * worker reads this job, signs the payload with the webhook secret, delivers it
 * via fetch, and records the delivery row.
 */
export async function enqueueWebhookDelivery({
  webhookId,
  event,
  entityType,
  entityId,
  data,
  workspaceId,
}: {
  webhookId: string;
  event: string;
  entityType: string;
  entityId: string;
  data?: Record<string, unknown>;
  workspaceId: string;
}): Promise<void> {
  await db.insert(jobs).values({
    type: "webhook_delivery",
    payload: {
      webhook_id: webhookId,
      event,
      entity_type: entityType,
      entity_id: entityId,
      data: data ?? {},
      timestamp: new Date().toISOString(),
      workspace_id: workspaceId,
    },
    status: "pending",
  });
}

/**
 * Enqueue webhook deliveries for every active webhook in a workspace that
 * subscribes to the given event. Never throws — failures are logged and the
 * caller's request proceeds, matching the activity-feed behavior.
 */
export async function enqueueWebhooks({
  workspaceId,
  event,
  entityType,
  entityId,
  data,
}: {
  workspaceId: string;
  event: string;
  entityType: string;
  entityId: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    const activeWebhooks = await db.select()
      .from(webhooks)
      .where(and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.active, true)));

    const matches = activeWebhooks.filter((webhook) =>
      (webhook.events ?? []).includes(event)
    );

    for (const webhook of matches) {
      await enqueueWebhookDelivery({
        webhookId: webhook.id,
        event,
        entityType,
        entityId,
        data,
        workspaceId,
      });
    }

    if (matches.length > 0) {
      console.log(`[webhooks] Enqueued ${matches.length} delivery job(s) for ${entityType}.${event}`);
    }
  } catch (error) {
    console.error(`[webhooks] Failed to enqueue webhook deliveries for ${entityType}.${event}:`, error);
  }
}
