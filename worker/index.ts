import { db, jobs, webhooks, webhookDeliveries, scheduledJobs, tasks, habits, habitCompletions } from '@project-e/db';
import { and, eq, lte, isNull, sql } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { RRule } from 'rrule';

const POLL_INTERVAL_BASE = 5000; // 5 seconds base
const POLL_INTERVAL_MAX = 60000; // 60 seconds max
const MAX_RETRIES = 6;

let currentPollInterval = POLL_INTERVAL_BASE;
let isProcessing = false;
let shutdownRequested = false;

// ── Job processing ───────────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  if (isProcessing || shutdownRequested) return;
  isProcessing = true;

  try {
    const now = new Date();

    // Get pending jobs that are due
    const pendingJobs = await db.select()
      .from(jobs)
      .where(and(
        eq(jobs.status, 'pending'),
        lte(jobs.nextRetryAt ?? sql`now()`, now),
      ))
      .orderBy(jobs.createdAt)
      .limit(10);

    if (pendingJobs.length > 0) {
      console.log(`[Worker] Processing ${pendingJobs.length} job(s)`);

      for (const job of pendingJobs) {
        if (shutdownRequested) break;
        await processJob(job);
      }

      // Reset poll interval on success
      currentPollInterval = POLL_INTERVAL_BASE;
    } else {
      // No jobs — increase poll interval (backoff)
      currentPollInterval = Math.min(currentPollInterval * 1.5, POLL_INTERVAL_MAX);
    }
  } catch (error) {
    console.error('[Worker] Poll error:', error);
  } finally {
    isProcessing = false;
  }

  if (!shutdownRequested) {
    setTimeout(poll, currentPollInterval);
  }
}

async function processJob(job: typeof jobs.$inferSelect): Promise<void> {
  // Mark as processing
  await db.update(jobs)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(jobs.id, job.id));

  try {
    switch (job.type) {
      case 'webhook_delivery':
        await handleWebhookDelivery(job);
        break;
      case 'recurring_spawn':
        await handleRecurringSpawn(job);
        break;
      case 'ai_dispatch':
        await handleAiDispatch(job);
        break;
      default:
        console.warn(`[Worker] Unknown job type: ${job.type}`);
        await db.update(jobs)
          .set({ status: 'failed', lastError: `Unknown job type: ${job.type}`, updatedAt: new Date() })
          .where(eq(jobs.id, job.id));
        return;
    }

    // Mark as completed
    await db.update(jobs)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(jobs.id, job.id));

    console.log(`[Worker] Job ${job.id} (${job.type}) completed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const attempts = (job.attempts || 0) + 1;

    if (attempts >= MAX_RETRIES) {
      // Max retries reached — mark as failed
      await db.update(jobs)
        .set({
          status: 'failed',
          attempts,
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));
      console.error(`[Worker] Job ${job.id} (${job.type}) failed after ${attempts} attempts: ${errorMessage}`);
    } else {
      // Schedule retry with exponential backoff
      const backoffMs = Math.min(2000 * Math.pow(2, attempts), 300000); // Max 5 minutes
      const nextRetry = new Date(Date.now() + backoffMs);

      await db.update(jobs)
        .set({
          status: 'pending',
          attempts,
          lastError: errorMessage,
          nextRetryAt: nextRetry,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));
      console.log(`[Worker] Job ${job.id} (${job.type}) retry ${attempts}/${MAX_RETRIES} scheduled for ${nextRetry.toISOString()}`);
    }
  }
}

// ── Webhook delivery ─────────────────────────────────────────────────────────────

async function handleWebhookDelivery(job: typeof jobs.$inferSelect): Promise<void> {
  const payload = job.payload as {
    webhook_id: string;
    event: string;
    entity_type: string;
    entity_id: string;
    data: unknown;
    timestamp: string;
    workspace_id: string;
  };

  const [webhook] = await db.select()
    .from(webhooks)
    .where(eq(webhooks.id, payload.webhook_id))
    .limit(1);

  if (!webhook) {
    throw new Error(`Webhook ${payload.webhook_id} not found`);
  }

  if (!webhook.active) {
    console.log(`[Worker] Webhook ${webhook.id} is inactive, skipping delivery`);
    return;
  }

  const deliveryPayload = {
    event: payload.event,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    data: payload.data,
    timestamp: payload.timestamp || new Date().toISOString(),
    workspace_id: payload.workspace_id,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Event-Type': payload.event,
  };

  if (webhook.secret) {
    const body = JSON.stringify(deliveryPayload);
    const signature = createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');
    headers['X-ProjectE-Signature'] = signature;
  }

  let responseStatus = 0;
  let responseBody = '';
  let success = false;

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(deliveryPayload),
      signal: AbortSignal.timeout(10000),
    });

    responseStatus = response.status;
    responseBody = await response.text();
    success = response.ok;
  } catch (error) {
    responseBody = error instanceof Error ? error.message : String(error);
    success = false;
  }

  // Record delivery
  await db.insert(webhookDeliveries).values({
    webhookId: webhook.id,
    event: payload.event,
    payload: deliveryPayload as Record<string, unknown>,
    status: success ? 'success' : 'failed',
    statusCode: responseStatus,
    responseBody: responseBody.substring(0, 1000),
    attempts: job.attempts || 0,
  });

  if (!success) {
    throw new Error(`Webhook delivery failed: ${responseStatus} ${responseBody}`);
  }
}

// ── Recurring spawn ──────────────────────────────────────────────────────────────

async function handleRecurringSpawn(job: typeof jobs.$inferSelect): Promise<void> {
  const payload = job.payload as {
    scheduled_job_id: string;
  };

  const [scheduled] = await db.select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.id, payload.scheduled_job_id))
    .limit(1);

  if (!scheduled) {
    throw new Error(`Scheduled job ${payload.scheduled_job_id} not found`);
  }

  const now = new Date();

  if (scheduled.entityType === 'task') {
    // Fetch the original task to clone
    const [originalTask] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, scheduled.entityId), isNull(tasks.deletedAt)))
      .limit(1);

    if (originalTask) {
      // Create a new task instance
      await db.insert(tasks).values({
        title: originalTask.title,
        description: originalTask.description,
        status: 'todo',
        priority: originalTask.priority,
        domainId: originalTask.domainId,
        projectId: originalTask.projectId,
        sectionId: originalTask.sectionId,
        dueDate: originalTask.dueDate,
        estimatedMinutes: originalTask.estimatedMinutes,
        recurrenceRule: originalTask.recurrenceRule,
        order: originalTask.order,
        customFields: originalTask.customFields,
      });
      console.log(`[Worker] Spawned new task instance for ${scheduled.entityId}`);
    }
  } else if (scheduled.entityType === 'habit') {
    // For habits, we just log — habit completions are user-driven
    console.log(`[Worker] Habit ${scheduled.entityId} recurrence tick (user-driven)`);
  }

  // Compute next occurrence using rrule
  try {
    const rule = RRule.fromString(scheduled.recurrenceRule);
    const nextOccurrence = rule.after(now);

    if (nextOccurrence) {
      await db.update(scheduledJobs)
        .set({
          nextOccurrenceAt: nextOccurrence,
          lastSpawnedAt: now,
        })
        .where(eq(scheduledJobs.id, scheduled.id));
      console.log(`[Worker] Next occurrence for ${scheduled.entityId} at ${nextOccurrence.toISOString()}`);
    } else {
      // No more occurrences — delete the scheduled job
      await db.delete(scheduledJobs).where(eq(scheduledJobs.id, scheduled.id));
      console.log(`[Worker] No more occurrences for ${scheduled.entityId}, removing scheduled job`);
    }
  } catch (error) {
    console.error(`[Worker] Failed to compute next occurrence for ${scheduled.entityId}:`, error);
    // If rrule parsing fails, just advance by 1 day as fallback
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await db.update(scheduledJobs)
      .set({
        nextOccurrenceAt: nextDay,
        lastSpawnedAt: now,
      })
      .where(eq(scheduledJobs.id, scheduled.id));
  }
}

// ── AI Dispatch (stub) ────────────────────────────────────────────────────────────

async function handleAiDispatch(job: typeof jobs.$inferSelect): Promise<void> {
  const payload = job.payload as {
    entity_type?: string;
    entity_id?: string;
    instruction?: string;
    user_id?: string;
  };

  console.log(`[Worker] AI dispatch received:`, JSON.stringify(payload));
  console.log(`[Worker] AI dispatch is a stub — future: connect to actual agent`);
  // Future: connect to actual AI agent
}

// ── Graceful shutdown ────────────────────────────────────────────────────────────

function setupGracefulShutdown(): void {
  process.on('SIGTERM', () => {
    console.log('[Worker] SIGTERM received, shutting down gracefully...');
    shutdownRequested = true;
    setTimeout(() => {
      console.log('[Worker] Forced exit after timeout');
      process.exit(0);
    }, 10000).unref();
  });

  process.on('SIGINT', () => {
    console.log('[Worker] SIGINT received, shutting down...');
    shutdownRequested = true;
    process.exit(0);
  });
}

// ── Start ────────────────────────────────────────────────────────────────────────

console.log('[Worker] Starting Project E worker...');
console.log('[Worker] PostgreSQL queue via Drizzle ORM');
console.log(`[Worker] Poll interval: ${POLL_INTERVAL_BASE}ms (base), ${POLL_INTERVAL_MAX}ms (max)`);

setupGracefulShutdown();

// Start polling
setTimeout(poll, POLL_INTERVAL_BASE);
