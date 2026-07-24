import { parseArgs, getFlag, getFlagNumber, hasFlag } from '../lib/args.js';
import { printTable, printJson, printSuccess, printError, printHeader } from '../lib/output.js';
import { db, records, eq, rawQuery } from '../lib/db.js';

async function showStatus(flags: Record<string, string | boolean>): Promise<void> {
  const json = flags.json === true;

  const rows = await db.select().from(records)
    .where(eq(records.collection, 'queue_jobs'));

  const statusCounts: Record<string, number> = {};
  for (const row of rows) {
    const status = (row.data as Record<string, unknown>).status as string || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  const stats = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  if (json) {
    printJson({ total: rows.length, byStatus: statusCounts });
  } else {
    printHeader('Worker Queue Status');
    printTable(stats, [
      { key: 'status', label: 'Status' },
      { key: 'count', label: 'Count', align: 'right' },
    ]);
    console.log(`\nTotal jobs: ${rows.length}`);
  }
}

async function listJobs(flags: Record<string, string | boolean>): Promise<void> {
  const limit = getFlagNumber(flags, 'limit', 50);
  const status = getFlag(flags, 'status');
  const type = getFlag(flags, 'type');
  const json = flags.json === true;

  let rows = await db.select().from(records)
    .where(eq(records.collection, 'queue_jobs'));

  if (status) {
    rows = rows.filter((r) => (r.data as Record<string, unknown>).status === status);
  }
  if (type) {
    rows = rows.filter((r) => (r.data as Record<string, unknown>).type === type);
  }

  // Sort by created descending
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  rows = rows.slice(0, limit);

  const jobs = rows.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      id: r.id,
      type: data.type,
      status: data.status,
      queue: data.queue,
      retry_count: data.retry_count ?? 0,
      max_retries: data.max_retries ?? 3,
      error: data.error ? String(data.error).slice(0, 50) : '',
      scheduled_at: data.scheduled_at ? String(data.scheduled_at).slice(0, 19) : '',
      created: r.createdAt.toISOString().slice(0, 19),
    };
  });

  if (json) {
    printJson(jobs);
  } else {
    printTable(jobs, [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'type', label: 'Type', width: 20 },
      { key: 'status', label: 'Status', width: 12 },
      { key: 'retry_count', label: 'Retries', width: 8, align: 'right' },
      { key: 'error', label: 'Error', width: 30 },
    ]);
    console.log(`\n${jobs.length} job(s)`);
  }
}

async function retryJob(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const jobId = args[0];

  if (!jobId) {
    printError('Usage: worker retry <jobId>');
    process.exit(1);
  }

  const [existing] = await db.select().from(records)
    .where(eq(records.id, jobId))
    .limit(1);

  if (!existing) {
    printError(`Job ${jobId} not found`);
    process.exit(1);
  }

  const data = existing.data as Record<string, unknown>;
  if (data.status !== 'failed') {
    printError(`Job ${jobId} is not in "failed" status (current: ${data.status})`);
    process.exit(1);
  }

  await db.update(records)
    .set({
      data: { ...data, status: 'pending', error: null, retry_count: 0 },
      updatedAt: new Date(),
    })
    .where(eq(records.id, jobId));

  printSuccess(`Job ${jobId} reset to pending`);
}

async function triggerJob(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const type = args[0];

  if (!type) {
    printError('Usage: worker trigger <type> [--payload \'{"key":"val"}\'] [--queue <name>]');
    process.exit(1);
  }

  const payloadStr = getFlag(flags, 'payload');
  const queue = getFlag(flags, 'queue', 'default');
  const payload = payloadStr ? JSON.parse(payloadStr) : {};

  const [record] = await db.insert(records).values({
    collection: 'queue_jobs',
    data: {
      type,
      queue,
      payload,
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      scheduled_at: new Date().toISOString(),
    },
  }).returning();

  printSuccess(`Job created: ${record.id} (type: ${type}, queue: ${queue})`);
}

function showHelp(): void {
  console.log(`
Worker/Queue Management Commands:

  worker status [--json]
      Show queue status (counts by status)

  worker jobs [--status <status>] [--type <type>] [--limit N] [--json]
      List queue jobs with optional filters

  worker retry <jobId>
      Reset a failed job to pending status

  worker trigger <type> [--payload '{"key":"val"}'] [--queue <name>]
      Create and queue a new job
`);
}

export default async function main(): Promise<void> {
  const { subcommand, flags } = parseArgs(process.argv);

  switch (subcommand) {
    case 'status':
      await showStatus(flags);
      break;
    case 'jobs':
      await listJobs(flags);
      break;
    case 'retry':
      await retryJob(flags);
      break;
    case 'trigger':
      await triggerJob(flags);
      break;
    default:
      showHelp();
  }
}
