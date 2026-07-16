import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
const ADMIN_TOKEN = process.env.POCKETBASE_ADMIN_TOKEN || '';
const POLL_INTERVAL_BASE = 5000; // 5 seconds base
const POLL_INTERVAL_MAX = 60000; // 60 seconds max

interface QueueJob {
  id: string;
  queue: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  retry_count: number;
  max_retries: number;
  scheduled_at: string;
  error?: string;
}

let currentPollInterval = POLL_INTERVAL_BASE;
let isProcessing = false;

function createAdminClient(): PocketBase {
  const pb = new PocketBase(POCKETBASE_URL);
  if (ADMIN_TOKEN) {
    pb.authStore.save(ADMIN_TOKEN, null);
  }
  return pb;
}

/**
 * Main poll loop with backoff
 */
async function poll(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pb = createAdminClient();
    
    // Get pending jobs
    const now = new Date().toISOString();
    const jobs = await pb.collection('queue_jobs').getList(1, 10, {
      filter: `status = "pending" && scheduled_at <= "${now}"`,
      sort: 'created',
    }) as { items: QueueJob[] };

    if (jobs.items.length > 0) {
      console.log(`[Worker] Processing ${jobs.items.length} job(s)`);
      
      for (const job of jobs.items) {
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

  // Schedule next poll
  setTimeout(poll, currentPollInterval);
}

/**
 * Process a single job
 */
async function processJob(job: QueueJob): Promise<void> {
  const pb = createAdminClient();

  try {
    // Mark as in_progress
    await pb.collection('queue_jobs').update(job.id, {
      status: 'in_progress',
    });

    switch (job.type) {
      case 'webhook_delivery':
        await handleWebhookDelivery(job);
        break;
      case 'agent_mention':
        await handleAgentMention(job);
        break;
      case 'report_generation':
        await handleReportGeneration(job);
        break;
      case 'recurring_task':
        await handleRecurringTask(job);
        break;
      case 'cleanup':
        await handleCleanup(job);
        break;
      default:
        console.warn(`[Worker] Unknown job type: ${job.type}`);
        await pb.collection('queue_jobs').update(job.id, {
          status: 'failed',
          error: `Unknown job type: ${job.type}`,
        });
        return;
    }

    // Mark as completed
    await pb.collection('queue_jobs').update(job.id, {
      status: 'completed',
    });
    
    console.log(`[Worker] Job ${job.id} (${job.type}) completed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const retryCount = (job.retry_count || 0) + 1;
    const maxRetries = job.max_retries || 3;

    if (retryCount >= maxRetries) {
      // Max retries reached — mark as failed
      await pb.collection('queue_jobs').update(job.id, {
        status: 'failed',
        retry_count: retryCount,
        error: errorMessage,
      });
      console.error(`[Worker] Job ${job.id} (${job.type}) failed after ${retryCount} attempts: ${errorMessage}`);
    } else {
      // Schedule retry with exponential backoff
      const backoffMs = Math.min(5000 * Math.pow(2, retryCount), 300000); // Max 5 minutes
      const nextAttempt = new Date(Date.now() + backoffMs).toISOString();
      
      await pb.collection('queue_jobs').update(job.id, {
        status: 'pending',
        retry_count: retryCount,
        error: errorMessage,
        scheduled_at: nextAttempt,
      });
      console.log(`[Worker] Job ${job.id} (${job.type}) retry ${retryCount}/${maxRetries} scheduled for ${nextAttempt}`);
    }
  }
}

/**
 * Handle webhook delivery job
 */
async function handleWebhookDelivery(job: QueueJob): Promise<void> {
  const payload = job.payload as {
    webhook_id: string;
    webhook_url: string;
    webhook_secret: string;
    event_type: string;
    event_payload: unknown;
  };

  const { webhook_url, webhook_secret, event_type, event_payload } = payload;

  // Create HMAC signature if secret provided
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Event-Type': event_type,
  };

  if (webhook_secret) {
    const crypto = await import('node:crypto');
    const body = JSON.stringify(event_payload);
    const signature = crypto
      .createHmac('sha256', webhook_secret)
      .update(body)
      .digest('hex');
    headers['X-Webhook-Signature'] = signature;
  }

  const response = await fetch(webhook_url, {
    method: 'POST',
    headers,
    body: JSON.stringify(event_payload),
    signal: AbortSignal.timeout(10000),
  });

  const responseBody = await response.text();

  // Record delivery
  const pb = createAdminClient();
  await pb.collection('webhook_deliveries').create({
    webhook_id: payload.webhook_id,
    event: event_type,
    payload: event_payload as Record<string, unknown>,
    status: response.ok ? 'success' : 'failed',
    status_code: response.status,
    response_body: responseBody,
    retry_count: job.retry_count || 0,
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.status} ${responseBody}`);
  }
}

/**
 * Handle agent @mention dispatch
 */
async function handleAgentMention(job: QueueJob): Promise<void> {
  const payload = job.payload as {
    agent_task_id: string;
    agent_id: string;
    agent_webhook_url: string;
    agent_api_key: string;
    entity_type: string;
    entity_id: string;
    instruction: string;
    user_id: string;
  };

  // Update agent task to in_progress
  const pb = createAdminClient();
  await pb.collection('agent_tasks').update(payload.agent_task_id, {
    status: 'in_progress',
  });

  // Update agent last_activity
  await pb.collection('agents').update(payload.agent_id, {
    last_activity_at: new Date().toISOString(),
  });

  // POST to agent webhook
  const response = await fetch(payload.agent_webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${payload.agent_api_key}`,
      'X-Agent-Task-Id': payload.agent_task_id,
    },
    body: JSON.stringify({
      task_id: payload.agent_task_id,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      instruction: payload.instruction,
      user_id: payload.user_id,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Agent mention delivery failed: ${response.status} ${body}`);
  }
}

/**
 * Handle report generation (data collection)
 */
async function handleReportGeneration(job: QueueJob): Promise<void> {
  const payload = job.payload as {
    report_id: string;
    report_type: string;
    date_range_start: string;
    date_range_end: string;
  };

  // This would collect data and populate the report content
  // For now, just mark as complete — full implementation in Phase 5
  console.log(`[Worker] Report generation for ${payload.report_id} (${payload.report_type})`);
}

/**
 * Handle recurring task spawning
 */
async function handleRecurringTask(job: QueueJob): Promise<void> {
  const payload = job.payload as {
    task_id: string;
    rule: string;
  };

  // This would use rrule to compute next due date and spawn
  // For now, just log — full implementation uses task-service
  console.log(`[Worker] Recurring task spawn for ${payload.task_id}`);
}

/**
 * Handle data retention cleanup
 */
async function handleCleanup(job: QueueJob): Promise<void> {
  const pb = createAdminClient();
  const now = new Date();

  // Purge webhook deliveries older than 90 days
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const oldDeliveries = await pb.collection('webhook_deliveries').getList(1, 100, {
    filter: `created < "${ninetyDaysAgo}"`,
  });
  
  for (const delivery of oldDeliveries.items) {
    await pb.collection('webhook_deliveries').delete(delivery.id);
  }

  // Purge error logs older than 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const oldErrors = await pb.collection('error_logs').getList(1, 100, {
    filter: `created < "${thirtyDaysAgo}"`,
  });
  
  for (const error of oldErrors.items) {
    await pb.collection('error_logs').delete(error.id);
  }

  console.log(`[Worker] Cleanup: purged ${oldDeliveries.items.length} webhook deliveries, ${oldErrors.items.length} error logs`);
}

/**
 * Schedule recurring cleanup job (daily)
 */
async function scheduleCleanup(): Promise<void> {
  const pb = createAdminClient();
  
  // Check if a cleanup job is already scheduled
  const existing = await pb.collection('queue_jobs').getList(1, 1, {
    filter: 'type = "cleanup" && status = "pending"',
  });
  
  if (existing.items.length === 0) {
    // Schedule cleanup for tomorrow
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await pb.collection('queue_jobs').create({
      type: 'cleanup',
      queue: 'default',
      payload: {},
      status: 'pending',
      retry_count: 0,
      max_retries: 1,
      scheduled_at: tomorrow,
    });
    console.log('[Worker] Scheduled daily cleanup');
  }
}

// Start the worker
console.log('[Worker] Starting Project E worker...');
console.log(`[Worker] PocketBase URL: ${POCKETBASE_URL}`);
console.log(`[Worker] Poll interval: ${POLL_INTERVAL_BASE}ms (base), ${POLL_INTERVAL_MAX}ms (max)`);

// Initial cleanup schedule
scheduleCleanup().catch(console.error);

// Start polling
setTimeout(poll, POLL_INTERVAL_BASE);
