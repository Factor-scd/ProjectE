import { parseArgs, getFlag, getFlagNumber, hasFlag, requirePositional } from '../lib/args.js';
import { printTable, printJson, printSuccess, printError, printHeader } from '../lib/output.js';
import { db, records, eq, sql } from '../lib/db.js';
import { readFileSync, writeFileSync } from 'node:fs';

const COLLECTIONS = [
  'domains', 'tags', 'projects', 'project_settings', 'milestones',
  'milestone_dependencies', 'milestone_templates', 'milestone_history', 'tasks',
  'task_subtasks', 'task_dependencies', 'task_attachments', 'task_time_entries',
  'time_entries', 'habits', 'habit_logs', 'habit_skip_days', 'notes', 'note_links',
  'note_task_links', 'report_templates', 'reports', 'canvases', 'canvas_cards',
  'agents', 'agent_activity', 'webhooks', 'webhook_deliveries', 'agent_tasks',
  'notifications', 'error_logs', 'queue_jobs',
];

function validateCollection(name: string): void {
  if (!COLLECTIONS.includes(name)) {
    printError(`Unknown collection: ${name}`);
    console.log(`Valid collections: ${COLLECTIONS.join(', ')}`);
    process.exit(1);
  }
}

async function listRecords(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const collection = args[0];
  if (!collection) {
    printError('Usage: data list <collection> [--limit N] [--filter "..."] [--sort "field"]');
    process.exit(1);
  }
  validateCollection(collection);

  const limit = getFlagNumber(flags, 'limit', 50);
  const filter = getFlag(flags, 'filter');
  const sort = getFlag(flags, 'sort');
  const json = flags.json === true;

  let rows = await db.select().from(records)
    .where(eq(records.collection, collection));

  // Apply sorting
  if (sort) {
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    rows.sort((a, b) => {
      const aVal = String((a.data as Record<string, unknown>)[field] ?? '');
      const bVal = String((b.data as Record<string, unknown>)[field] ?? '');
      return desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    });
  }

  // Apply limit
  rows = rows.slice(0, limit);

  const items = rows.map((r) => ({
    id: r.id,
    ...r.data as Record<string, unknown>,
    created: r.createdAt.toISOString(),
    updated: r.updatedAt.toISOString(),
  }));

  if (json) {
    printJson(items);
  } else {
    // Auto-detect columns from first record
    if (items.length > 0) {
      const sampleKeys = Object.keys(items[0]);
      const columns = sampleKeys.slice(0, 8).map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        width: key === 'id' ? 36 : undefined,
      }));
      printTable(items, columns);
    } else {
      printTable(items, []);
    }
    console.log(`\n${items.length} record(s) in "${collection}"`);
  }
}

async function getRecord(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const collection = args[0];
  const id = args[1];

  if (!collection || !id) {
    printError('Usage: data get <collection> <id>');
    process.exit(1);
  }
  validateCollection(collection);

  const [row] = await db.select().from(records)
    .where(eq(records.id, id))
    .limit(1);

  if (!row) {
    printError(`Record ${id} not found in "${collection}"`);
    process.exit(1);
  }

  const item = {
    id: row.id,
    ...row.data as Record<string, unknown>,
    created: row.createdAt.toISOString(),
    updated: row.updatedAt.toISOString(),
  };

  if (flags.json === true) {
    printJson(item);
  } else {
    printHeader(`${collection} / ${id}`);
    for (const [key, value] of Object.entries(item)) {
      console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
  }
}

async function createRecord(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const collection = args[0];

  if (!collection) {
    printError('Usage: data create <collection> --data \'{"key":"val"}\'');
    process.exit(1);
  }
  validateCollection(collection);

  const dataStr = getFlag(flags, 'data');
  const dataFile = getFlag(flags, 'data-file');

  let data: Record<string, unknown>;
  if (dataFile) {
    data = JSON.parse(readFileSync(dataFile, 'utf-8'));
  } else if (dataStr) {
    data = JSON.parse(dataStr);
  } else {
    printError('Required: --data \'{"key":"val"}\' or --data-file <path>');
    process.exit(1);
  }

  const [record] = await db.insert(records).values({
    collection,
    data,
  }).returning();

  printSuccess(`Created: ${record.id} in "${collection}"`);
}

async function updateRecord(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const collection = args[0];
  const id = args[1];

  if (!collection || !id) {
    printError('Usage: data update <collection> <id> --data \'{"key":"val"}\'');
    process.exit(1);
  }
  validateCollection(collection);

  const dataStr = getFlag(flags, 'data');
  const dataFile = getFlag(flags, 'data-file');

  let data: Record<string, unknown>;
  if (dataFile) {
    data = JSON.parse(readFileSync(dataFile, 'utf-8'));
  } else if (dataStr) {
    data = JSON.parse(dataStr);
  } else {
    printError('Required: --data \'{"key":"val"}\' or --data-file <path>');
    process.exit(1);
  }

  // Get existing record to merge data
  const [existing] = await db.select().from(records)
    .where(eq(records.id, id))
    .limit(1);

  if (!existing) {
    printError(`Record ${id} not found in "${collection}"`);
    process.exit(1);
  }

  const [updated] = await db.update(records)
    .set({ data: { ...(existing.data as Record<string, unknown>), ...data }, updatedAt: new Date() })
    .where(eq(records.id, id))
    .returning();

  printSuccess(`Updated: ${updated.id} in "${collection}"`);
}

async function deleteRecord(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const collection = args[0];
  const id = args[1];

  if (!collection || !id) {
    printError('Usage: data delete <collection> <id>');
    process.exit(1);
  }
  validateCollection(collection);

  const deleted = await db.delete(records)
    .where(eq(records.id, id))
    .returning();

  if (deleted.length === 0) {
    printError(`Record ${id} not found in "${collection}"`);
    process.exit(1);
  }

  printSuccess(`Deleted: ${id} from "${collection}"`);
}

async function exportCollection(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const collection = args[0];

  if (!collection) {
    printError('Usage: data export <collection> [--output file.json]');
    process.exit(1);
  }
  validateCollection(collection);

  const rows = await db.select().from(records)
    .where(eq(records.collection, collection));

  const items = rows.map((r) => ({
    id: r.id,
    ...r.data as Record<string, unknown>,
    created: r.createdAt.toISOString(),
    updated: r.updatedAt.toISOString(),
  }));

  const output = getFlag(flags, 'output');
  if (output) {
    writeFileSync(output, JSON.stringify(items, null, 2));
    printSuccess(`Exported ${items.length} records to ${output}`);
  } else {
    printJson(items);
  }
}

async function importCollection(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const collection = args[0];
  const file = args[1];

  if (!collection || !file) {
    printError('Usage: data import <collection> <file.json> [--dry-run]');
    process.exit(1);
  }
  validateCollection(collection);

  const data = JSON.parse(readFileSync(file, 'utf-8'));
  if (!Array.isArray(data)) {
    printError('Import file must contain a JSON array of records');
    process.exit(1);
  }

  const dryRun = hasFlag(flags, 'dry-run');

  if (dryRun) {
    printHeader(`Dry Run: ${data.length} records to import into "${collection}"`);
    for (const item of data.slice(0, 10)) {
      console.log(`  - ${item.title || item.name || item.email || JSON.stringify(item).slice(0, 60)}`);
    }
    if (data.length > 10) console.log(`  ... and ${data.length - 10} more`);
    return;
  }

  let created = 0;
  let errors = 0;

  for (const item of data) {
    try {
      const { id: _id, created: _created, updated: _updated, ...rest } = item;
      await db.insert(records).values({ collection, data: rest });
      created++;
    } catch (error) {
      errors++;
      printError(`Failed to import record: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  printSuccess(`Imported ${created} records into "${collection}" (${errors} errors)`);
}

function showHelp(): void {
  console.log(`
Data Management Commands:

  data list <collection> [--limit N] [--sort "field"] [--json]
      List records in a collection

  data get <collection> <id> [--json]
      Get a single record by ID

  data create <collection> --data '{"key":"val"}'
      Create a new record

  data create <collection> --data-file path/to/data.json
      Create from a JSON file

  data update <collection> <id> --data '{"key":"val"}'
      Update an existing record

  data delete <collection> <id>
      Delete a record

  data export <collection> [--output file.json]
      Export all records to JSON (stdout if no output file)

  data import <collection> <file.json> [--dry-run]
      Import records from a JSON file

Valid collections:
  ${COLLECTIONS.join(', ')}
`);
}

export default async function main(): Promise<void> {
  const { subcommand, flags } = parseArgs(process.argv);

  switch (subcommand) {
    case 'list':
      await listRecords(flags);
      break;
    case 'get':
      await getRecord(flags);
      break;
    case 'create':
      await createRecord(flags);
      break;
    case 'update':
      await updateRecord(flags);
      break;
    case 'delete':
      await deleteRecord(flags);
      break;
    case 'export':
      await exportCollection(flags);
      break;
    case 'import':
      await importCollection(flags);
      break;
    default:
      showHelp();
  }
}
