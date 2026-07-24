import { parseArgs, getFlag, getFlagNumber, hasFlag } from '../lib/args.js';
import { printTable, printJson, printSuccess, printError, printHeader } from '../lib/output.js';
import { db, records, eq, rawQuery } from '../lib/db.js';

async function checkHealth(): Promise<void> {
  printHeader('System Health Check');

  // Test DB connection
  try {
    const start = Date.now();
    await rawQuery('SELECT 1 as ok');
    const latency = Date.now() - start;
    printSuccess(`Database connection OK (${latency}ms)`);
  } catch (error) {
    printError(`Database connection FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Count records per collection
  const collections = [
    'users', 'domains', 'tags', 'projects', 'tasks', 'habits', 'habit_logs',
    'notes', 'agents', 'agent_tasks', 'webhooks', 'webhook_deliveries',
    'queue_jobs', 'error_logs', 'reports',
  ];

  console.log('\nCollection Status:');
  const stats: { name: string; count: number }[] = [];

  for (const name of collections) {
    const result = await rawQuery(
      'SELECT COUNT(*) as count FROM records WHERE collection = $1',
      [name]
    );
    const count = Number((result[0] as Record<string, unknown>).count);
    stats.push({ name, count });
  }

  printTable(stats, [
    { key: 'name', label: 'Collection' },
    { key: 'count', label: 'Count', align: 'right' },
  ]);

  // Check worker queue
  const pendingResult = await rawQuery(
    "SELECT COUNT(*) as count FROM records WHERE collection = 'queue_jobs' AND data->>'status' = 'pending'"
  );
  const pending = Number((pendingResult[0] as Record<string, unknown>).count);

  const failedResult = await rawQuery(
    "SELECT COUNT(*) as count FROM records WHERE collection = 'queue_jobs' AND data->>'status' = 'failed'"
  );
  const failed = Number((failedResult[0] as Record<string, unknown>).count);

  console.log('\nWorker Queue:');
  console.log(`  Pending jobs: ${pending}`);
  console.log(`  Failed jobs: ${failed}`);
}

async function listErrors(flags: Record<string, string | boolean>): Promise<void> {
  const limit = getFlagNumber(flags, 'limit', 50);
  const level = getFlag(flags, 'level');
  const json = flags.json === true;

  let rows = await db.select().from(records)
    .where(eq(records.collection, 'error_logs'));

  if (level) {
    rows = rows.filter((r) => (r.data as Record<string, unknown>).level === level);
  }

  // Sort by created descending (most recent first)
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  rows = rows.slice(0, limit);

  const items = rows.map((r) => ({
    id: r.id,
    ...(r.data as Record<string, unknown>),
    created: r.createdAt.toISOString(),
  }));

  if (json) {
    printJson(items);
  } else {
    printTable(items, [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'level', label: 'Level', width: 8 },
      { key: 'source', label: 'Source', width: 20 },
      { key: 'message', label: 'Message', width: 40 },
      { key: 'created', label: 'Created', width: 20 },
    ]);
    console.log(`\n${items.length} error(s)`);
  }
}

async function showStats(flags: Record<string, string | boolean>): Promise<void> {
  const json = flags.json === true;

  const totalResult = await rawQuery('SELECT COUNT(*) as count FROM records');
  const total = Number((totalResult[0] as Record<string, unknown>).count);

  const collectionsResult = await rawQuery(
    'SELECT collection, COUNT(*) as count FROM records GROUP BY collection ORDER BY count DESC'
  );
  const collections = (collectionsResult as Record<string, unknown>[]).map((r) => ({
    collection: r.collection as string,
    count: Number(r.count),
  }));

  const usersResult = await rawQuery(
    "SELECT COUNT(*) as count FROM records WHERE collection = 'users'"
  );
  const users = Number((usersResult[0] as Record<string, unknown>).count);

  if (json) {
    printJson({ total, users, collections });
  } else {
    printHeader('Database Statistics');
    console.log(`  Total records: ${total}`);
    console.log(`  Total users: ${users}`);
    console.log('\nRecords by collection:');
    printTable(collections, [
      { key: 'collection', label: 'Collection' },
      { key: 'count', label: 'Count', align: 'right' },
    ]);
  }
}

function showHelp(): void {
  console.log(`
Health & Diagnostics Commands:

  health check
      Test database connectivity and show system status

  health errors [--limit N] [--level error|warn] [--json]
      List recent error logs

  health stats [--json]
      Show database statistics (record counts by collection)
`);
}

export default async function main(): Promise<void> {
  const { subcommand, flags } = parseArgs(process.argv);

  switch (subcommand) {
    case 'check':
      await checkHealth();
      break;
    case 'errors':
      await listErrors(flags);
      break;
    case 'stats':
      await showStats(flags);
      break;
    default:
      showHelp();
  }
}
