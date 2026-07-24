import { and, eq } from 'drizzle-orm';
import { db, records, sql } from '@project-e/db';

export const collectionNames = [
  'domains', 'tags', 'projects', 'project_settings', 'milestones',
  'milestone_dependencies', 'milestone_templates', 'milestone_history', 'tasks',
  'task_subtasks', 'task_dependencies', 'task_attachments', 'task_time_entries',
  'time_entries', 'habits', 'habit_logs', 'habit_skip_days', 'notes', 'note_links',
  'note_task_links', 'report_templates', 'reports', 'canvases', 'canvas_cards',
  'agents', 'agent_activity', 'webhooks', 'webhook_deliveries', 'agent_tasks',
  'notifications', 'error_logs', 'queue_jobs',
] as const;

type RecordData = Record<string, any>;
type ListOptions = { filter?: string; sort?: string };

function serialize(record: typeof records.$inferSelect): RecordData {
  return {
    ...record.data,
    id: record.id,
    created: record.createdAt.toISOString(),
    updated: record.updatedAt.toISOString(),
    collectionName: record.collection,
  };
}

function valueFor(record: RecordData, field: string): unknown {
  if (field === 'id' || field === 'created' || field === 'updated') return record[field];
  return record[field];
}

function parseValue(raw: string): unknown {
  const value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const number = Number(value);
  return Number.isNaN(number) ? value : number;
}

function matchesFilter(record: RecordData, filter?: string): boolean {
  if (!filter) return true;

  return filter.split('||').some((orPart) => orPart.split('&&').every((term) => {
    const match = term.trim().match(/^([a-zA-Z_][\w]*)\s*(=|!=|<=|>=|<|>)\s*(.+)$/);
    if (!match) return false;
    const [, field, operator, rawExpected] = match;
    const actual = valueFor(record, field);
    const expected = parseValue(rawExpected);

    switch (operator) {
      case '=': return actual === expected;
      case '!=': return actual !== expected;
      case '<': return String(actual ?? '') < String(expected ?? '');
      case '<=': return String(actual ?? '') <= String(expected ?? '');
      case '>': return String(actual ?? '') > String(expected ?? '');
      case '>=': return String(actual ?? '') >= String(expected ?? '');
      default: return false;
    }
  }));
}

function sortRecords(items: RecordData[], sort?: string): RecordData[] {
  if (!sort) return items;
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  return [...items].sort((a, b) => {
    const left = valueFor(a, field);
    const right = valueFor(b, field);
    const comparison = String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true });
    return descending ? -comparison : comparison;
  });
}

function cleanData(data: RecordData): RecordData {
  const { id: _id, created: _created, updated: _updated, collectionId: _collectionId, collectionName: _collectionName, ...clean } = data;
  return clean;
}

async function notify(action: 'create' | 'update' | 'delete', collection: string, record: RecordData) {
  await sql`select pg_notify('project_e_events', ${JSON.stringify({ type: action, collection, record })})`;
}

class CollectionRepository {
  constructor(private readonly collectionName: string) {}

  async getOne(id: string): Promise<RecordData> {
    const [record] = await db.select().from(records).where(and(eq(records.id, id), eq(records.collection, this.collectionName))).limit(1);
    if (!record) throw new Error(`Record ${id} not found in ${this.collectionName}`);
    return serialize(record);
  }

  async getFullList(options: ListOptions = {}): Promise<RecordData[]> {
    const rows = await db.select().from(records).where(eq(records.collection, this.collectionName));
    return sortRecords(rows.map(serialize).filter((record) => matchesFilter(record, options.filter)), options.sort);
  }

  async getList(page = 1, perPage = 50, options: ListOptions = {}) {
    const items = await this.getFullList(options);
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    return {
      items: items.slice((page - 1) * perPage, page * perPage),
      page,
      perPage,
      totalItems,
      totalPages,
    };
  }

  async create(data: RecordData): Promise<RecordData> {
    const [record] = await db.insert(records).values({ collection: this.collectionName, data: cleanData(data) }).returning();
    const result = serialize(record);
    await notify('create', this.collectionName, result);
    return result;
  }

  async update(id: string, data: RecordData): Promise<RecordData> {
    const existing = await this.getOne(id);
    const [record] = await db.update(records)
      .set({ data: cleanData({ ...existing, ...data }), updatedAt: new Date() })
      .where(and(eq(records.id, id), eq(records.collection, this.collectionName)))
      .returning();
    if (!record) throw new Error(`Record ${id} not found in ${this.collectionName}`);
    const result = serialize(record);
    await notify('update', this.collectionName, result);
    return result;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getOne(id);
    await db.delete(records).where(and(eq(records.id, id), eq(records.collection, this.collectionName)));
    await notify('delete', this.collectionName, existing);
    return true;
  }
}

export function createDatabaseClient() {
  return {
    collection(name: string) {
      if (!collectionNames.includes(name as (typeof collectionNames)[number])) {
        throw new Error(`Unknown collection: ${name}`);
      }
      return new CollectionRepository(name);
    },
  };
}

export function createAdminClient() {
  return createDatabaseClient();
}
