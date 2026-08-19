import { db, sql, jobs, webhooks, webhookDeliveries, scheduledJobs, tasks, statusDefinitions, projects, domains, notifications } from '@project-e/db';
import { and, asc, eq, gte, lte, isNotNull, isNull, or } from 'drizzle-orm';
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
    // Enqueue recurring_spawn jobs for due scheduled jobs before polling the
    // queue so they are picked up in the same iteration.
    const scheduledEnqueued = await processDueScheduledJobs();

    // Create due-soon notifications for tasks whose due date approaches. Runs
    // on every poll iteration but is deduped, so it is cheap in the steady state.
    await processDueSoonNotifications();

    const now = new Date();

    // Get pending jobs that are due.
    // nextRetryAt is NULL for freshly-queued jobs, which are due immediately.
    const pendingJobs = await db.select()
      .from(jobs)
      .where(and(
        eq(jobs.status, 'pending'),
        or(isNull(jobs.nextRetryAt), lte(jobs.nextRetryAt, now)),
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
    } else if (scheduledEnqueued > 0) {
      // Scheduled jobs were enqueued but their recurring_spawn jobs will be
      // processed next iteration — keep the poll fast.
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
    const maxAttempts = job.maxAttempts || MAX_RETRIES;

    if (attempts >= maxAttempts) {
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

// ── Recurring schedule advancement ───────────────────────────────────────────────

/**
 * Find scheduled jobs whose next occurrence is due, enqueue a `recurring_spawn`
 * job for each, and immediately advance (or remove) the scheduled job so it is
 * never enqueued twice. `handleRecurringSpawn` only spawns the entity — the
 * schedule bookkeeping happens here so the enqueue and the advance are atomic
 * within the same poll iteration.
 */
async function processDueScheduledJobs(): Promise<number> {
  try {
    const now = new Date();
    const dueScheduled = await db.select()
      .from(scheduledJobs)
      .where(lte(scheduledJobs.nextOccurrenceAt, now))
      .orderBy(scheduledJobs.nextOccurrenceAt)
      .limit(10);

    for (const scheduled of dueScheduled) {
      if (shutdownRequested) break;

      await db.insert(jobs).values({
        type: 'recurring_spawn',
        payload: { scheduled_job_id: scheduled.id },
        status: 'pending',
      });
      console.log(`[Worker] Enqueued recurring spawn for scheduled job ${scheduled.id} (${scheduled.entityType}:${scheduled.entityId})`);

      await advanceScheduledJob(scheduled);
    }

    return dueScheduled.length;
  } catch (error) {
    console.error('[Worker] processDueScheduledJobs error:', error);
    return 0;
  }
}

async function advanceScheduledJob(scheduled: typeof scheduledJobs.$inferSelect): Promise<void> {
  const now = new Date();
  try {
    const rule = RRule.fromString(scheduled.recurrenceRule);
    // Compute from the due occurrence so no occurrence is skipped even if the
    // spawned job is processed later than the original due time.
    const base = scheduled.nextOccurrenceAt > now ? scheduled.nextOccurrenceAt : now;
    const nextOccurrence = rule.after(base);

    if (nextOccurrence) {
      await db.update(scheduledJobs)
        .set({
          nextOccurrenceAt: nextOccurrence,
          lastSpawnedAt: now,
        })
        .where(eq(scheduledJobs.id, scheduled.id));
      console.log(`[Worker] Next occurrence for ${scheduled.entityId} at ${nextOccurrence.toISOString()}`);
    } else {
      // No more occurrences — remove the scheduled job
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

// ── Due-soon notifications ─────────────────────────────────────────────────────

const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000; // notify when due within 24h

/**
 * Create a `due_soon` notification for each incomplete task whose due date is
 * within the next 24 hours. Deduped per task: a task is skipped when a
 * `due_soon` notification for it was already created in the last 24 hours, so
 * the user is not nagged on every poll iteration.
 */
async function processDueSoonNotifications(): Promise<void> {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

    const dueTasks = await db.select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      domainId: tasks.domainId,
    })
      .from(tasks)
      .where(and(
        isNull(tasks.deletedAt),
        isNull(tasks.completedAt),
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, now),
        lte(tasks.dueDate, soon),
      ))
      .limit(50);

    for (const task of dueTasks) {
      const [domain] = await db.select({ ownerId: domains.ownerId })
        .from(domains)
        .where(eq(domains.id, task.domainId))
        .limit(1);
      if (!domain?.ownerId) continue;

      const [existing] = await db.select({ id: notifications.id })
        .from(notifications)
        .where(and(
          eq(notifications.userId, domain.ownerId),
          eq(notifications.type, 'due_soon'),
          eq(notifications.entityType, 'task'),
          eq(notifications.entityId, task.id),
          gte(notifications.createdAt, new Date(now.getTime() - DUE_SOON_WINDOW_MS)),
        ))
        .limit(1);
      if (existing) continue;

      const [notification] = await db.insert(notifications).values({
        userId: domain.ownerId,
        workspaceId: task.domainId,
        type: 'due_soon',
        title: 'Task due soon',
        body: `"${task.title}" is due within 24 hours`,
        entityType: 'task',
        entityId: task.id,
      }).returning({ id: notifications.id });

      const payload = JSON.stringify({ type: 'notification', action: 'created', id: notification.id, workspace_id: task.domainId });
      await sql`SELECT pg_notify('project_e_events', ${payload}::text)`;
      console.log(`[Worker] Due-soon notification created for task ${task.id}`);
    }
  } catch (error) {
    console.error('[Worker] processDueSoonNotifications error:', error);
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

  if (scheduled.entityType === 'task') {
    // Fetch the original task to clone
    const [originalTask] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, scheduled.entityId), isNull(tasks.deletedAt)))
      .limit(1);

    if (originalTask) {
      // Resolve the project's default status so spawned instances start in the
      // project's configured initial state instead of a hardcoded "todo".
      let statusId: string | null = null;
      if (originalTask.projectId) {
        const [defaultStatus] = await db.select({ id: statusDefinitions.id })
          .from(statusDefinitions)
          .where(and(
            eq(statusDefinitions.projectId, originalTask.projectId),
            eq(statusDefinitions.isDefault, true),
          ))
          .limit(1);
        if (defaultStatus) {
          statusId = defaultStatus.id;
        } else {
          const [firstStatus] = await db.select({ id: statusDefinitions.id })
            .from(statusDefinitions)
            .where(eq(statusDefinitions.projectId, originalTask.projectId))
            .orderBy(asc(statusDefinitions.sortOrder))
            .limit(1);
          statusId = firstStatus?.id ?? null;
        }
      }

      // Create a new task instance
      const [spawned] = await db.insert(tasks).values({
        title: originalTask.title,
        description: originalTask.description,
        statusId,
        priority: originalTask.priority,
        domainId: originalTask.domainId,
        projectId: originalTask.projectId,
        sectionId: originalTask.sectionId,
        dueDate: originalTask.dueDate,
        estimatedMinutes: originalTask.estimatedMinutes,
        recurrenceRule: originalTask.recurrenceRule,
        order: originalTask.order,
        customFields: originalTask.customFields,
      }).returning({ id: tasks.id });
      console.log(`[Worker] Spawned new task instance for ${scheduled.entityId}`);

      // Notify the workspace owner that a recurring task was spawned.
      const [domain] = await db.select({ ownerId: domains.ownerId })
        .from(domains)
        .where(eq(domains.id, originalTask.domainId))
        .limit(1);
      if (domain?.ownerId) {
        const [notification] = await db.insert(notifications).values({
          userId: domain.ownerId,
          workspaceId: originalTask.domainId,
          type: 'automation',
          title: 'Recurring task created',
          body: `"${originalTask.title}" was created by your recurring schedule`,
          entityType: 'task',
          entityId: spawned.id,
        }).returning({ id: notifications.id });

        const payload = JSON.stringify({ type: 'notification', action: 'created', id: notification.id, workspace_id: originalTask.domainId });
        await sql`SELECT pg_notify('project_e_events', ${payload}::text)`;
      }
    }
  } else if (scheduled.entityType === 'habit') {
    // For habits, we just log — habit completions are user-driven
    console.log(`[Worker] Habit ${scheduled.entityId} recurrence tick (user-driven)`);
  }
}

// ── AI Dispatch (disabled) ───────────────────────────────────────────────────────

async function handleAiDispatch(job: typeof jobs.$inferSelect): Promise<void> {
  const payload = job.payload as {
    entity_type?: string;
    entity_id?: string;
    instruction?: string;
    user_id?: string;
  };

  console.log(`[Worker] ai_dispatch is disabled — job ${job.id} completed without action`, JSON.stringify(payload));
  // DISABLED: ai_dispatch is not wired up yet. Jobs of this type are allowed to
  // complete (non-destructive) so the queue does not stall on them. Future:
  // connect to actual AI agent.
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
