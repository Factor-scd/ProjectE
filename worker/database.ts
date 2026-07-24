import { and, eq } from 'drizzle-orm';
import { db, records } from '@project-e/db';

type RecordData = Record<string, any>;

function serialize(record: typeof records.$inferSelect): RecordData {
  return {
    ...record.data,
    id: record.id,
    created: record.createdAt.toISOString(),
    updated: record.updatedAt.toISOString(),
  };
}

function matchesFilter(record: RecordData, filter?: string): boolean {
  if (!filter) return true;
  return filter.split('&&').every((term) => {
    const match = term.trim().match(/^([a-zA-Z_][\w]*)\s*(=|<=|<)\s*(.+)$/);
    if (!match) return false;
    const [, field, operator, rawExpected] = match;
    const expected = rawExpected.trim().replace(/^"|"$/g, '');
    const actual = record[field];
    if (operator === '=') return String(actual) === expected;
    if (operator === '<=') return String(actual ?? '') <= expected;
    return String(actual ?? '') < expected;
  });
}

export function createDatabaseClient() {
  return {
    collection(collection: string) {
      return {
        async getList(page = 1, perPage = 50, options: { filter?: string; sort?: string } = {}) {
          const rows = (await db.select().from(records).where(eq(records.collection, collection)))
            .map(serialize)
            .filter((record) => matchesFilter(record, options.filter));
          return {
            items: rows.slice((page - 1) * perPage, page * perPage),
            totalItems: rows.length,
            totalPages: Math.max(1, Math.ceil(rows.length / perPage)),
            page,
            perPage,
          };
        },
        async create(data: RecordData) {
          const [record] = await db.insert(records).values({ collection, data }).returning();
          return serialize(record);
        },
        async update(id: string, data: RecordData) {
          const [existing] = await db.select().from(records).where(and(eq(records.id, id), eq(records.collection, collection))).limit(1);
          if (!existing) throw new Error(`Record ${id} not found`);
          const [record] = await db.update(records)
            .set({ data: { ...existing.data, ...data }, updatedAt: new Date() })
            .where(and(eq(records.id, id), eq(records.collection, collection)))
            .returning();
          return serialize(record);
        },
        async delete(id: string) {
          await db.delete(records).where(and(eq(records.id, id), eq(records.collection, collection)));
          return true;
        },
      };
    },
  };
}
