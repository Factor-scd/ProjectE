import { parseArgs, getFlag, getFlagNumber } from '../lib/args.js';
import { printTable, printJson, printSuccess, printError, printHeader } from '../lib/output.js';
import { db, records, eq, sql } from '../lib/db.js';

async function listWebhooks(flags: Record<string, string | boolean>): Promise<void> {
  const limit = getFlagNumber(flags, 'limit', 50);
  const json = flags.json === true;

  const rows = await db.select().from(records)
    .where(eq(records.collection, 'webhooks'))
    .limit(limit);

  const webhooks = rows.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      id: r.id,
      name: data.name || '',
      url: String(data.url || '').slice(0, 50),
      active: data.active,
      events: Array.isArray(data.events) ? data.events.join(', ') : '',
      created: r.createdAt.toISOString().slice(0, 19),
    };
  });

  if (json) {
    printJson(webhooks);
  } else {
    printTable(webhooks, [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'name', label: 'Name', width: 20 },
      { key: 'url', label: 'URL', width: 40 },
      { key: 'active', label: 'Active', width: 8 },
      { key: 'events', label: 'Events', width: 30 },
    ]);
    console.log(`\n${webhooks.length} webhook(s)`);
  }
}

async function testWebhook(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const webhookId = args[0];

  if (!webhookId) {
    printError('Usage: webhook test <id>');
    process.exit(1);
  }

  const [row] = await db.select().from(records)
    .where(eq(records.id, webhookId))
    .limit(1);

  if (!row) {
    printError(`Webhook ${webhookId} not found`);
    process.exit(1);
  }

  const data = row.data as Record<string, unknown>;
  const url = data.url as string;

  if (!url) {
    printError('Webhook has no URL configured');
    process.exit(1);
  }

  console.log(`Testing webhook: ${data.name || webhookId}`);
  console.log(`URL: ${url}`);

  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Event-Type': 'test.ping',
      },
      body: JSON.stringify({
        event: 'test.ping',
        timestamp: new Date().toISOString(),
        data: { message: 'Test delivery from Project E CLI' },
      }),
      signal: AbortSignal.timeout(10000),
    });

    const latency = Date.now() - start;
    const body = await response.text();

    if (response.ok) {
      printSuccess(`Webhook responded: ${response.status} (${latency}ms)`);
    } else {
      printError(`Webhook failed: ${response.status} (${latency}ms)`);
    }

    if (body) {
      console.log(`Response: ${body.slice(0, 200)}`);
    }
  } catch (error) {
    const latency = Date.now() - start;
    printError(`Webhook request failed (${latency}ms): ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function listDeliveries(flags: Record<string, string | boolean>): Promise<void> {
  const limit = getFlagNumber(flags, 'limit', 50);
  const webhookId = getFlag(flags, 'webhook-id');
  const status = getFlag(flags, 'status');
  const json = flags.json === true;

  let rows = await db.select().from(records)
    .where(eq(records.collection, 'webhook_deliveries'));

  if (webhookId) {
    rows = rows.filter((r) => (r.data as Record<string, unknown>).webhook_id === webhookId);
  }
  if (status) {
    rows = rows.filter((r) => (r.data as Record<string, unknown>).status === status);
  }

  // Sort by created descending
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  rows = rows.slice(0, limit);

  const deliveries = rows.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      id: r.id,
      webhook_id: String(data.webhook_id || '').slice(0, 36),
      event: data.event,
      status: data.status,
      status_code: data.status_code,
      created: r.createdAt.toISOString().slice(0, 19),
    };
  });

  if (json) {
    printJson(deliveries);
  } else {
    printTable(deliveries, [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'event', label: 'Event', width: 20 },
      { key: 'status', label: 'Status', width: 10 },
      { key: 'status_code', label: 'HTTP', width: 6, align: 'right' },
      { key: 'created', label: 'Created', width: 20 },
    ]);
    console.log(`\n${deliveries.length} delivery(ies)`);
  }
}

async function retryDelivery(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const deliveryId = args[0];

  if (!deliveryId) {
    printError('Usage: webhook retry <deliveryId>');
    process.exit(1);
  }

  const [row] = await db.select().from(records)
    .where(eq(records.id, deliveryId))
    .limit(1);

  if (!row) {
    printError(`Delivery ${deliveryId} not found`);
    process.exit(1);
  }

  const data = row.data as Record<string, unknown>;

  // Create a new queue job for retry
  const [job] = await db.insert(records).values({
    collection: 'queue_jobs',
    data: {
      type: 'webhook_delivery',
      queue: 'webhooks',
      payload: {
        webhook_id: data.webhook_id,
        webhook_url: data.webhook_url || '',
        webhook_secret: data.webhook_secret || '',
        event_type: data.event,
        event_payload: data.payload,
      },
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      scheduled_at: new Date().toISOString(),
    },
  }).returning();

  printSuccess(`Retry queued: job ${job.id}`);
}

function showHelp(): void {
  console.log(`
Webhook Management Commands:

  webhook list [--limit N] [--json]
      List all webhooks

  webhook test <id>
      Send a test ping to a webhook URL

  webhook deliveries [--webhook-id <id>] [--status success|failed] [--limit N] [--json]
      List webhook delivery records

  webhook retry <deliveryId>
      Re-queue a failed delivery as a new job
`);
}

export default async function main(): Promise<void> {
  const { subcommand, flags } = parseArgs(process.argv);

  switch (subcommand) {
    case 'list':
      await listWebhooks(flags);
      break;
    case 'test':
      await testWebhook(flags);
      break;
    case 'deliveries':
      await listDeliveries(flags);
      break;
    case 'retry':
      await retryDelivery(flags);
      break;
    default:
      showHelp();
  }
}
