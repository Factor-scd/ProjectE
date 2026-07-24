import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';

// Load .env.local from project root
const envPaths = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
];

for (const p of envPaths) {
  if (existsSync(p)) {
    config({ path: p });
    break;
  }
}

// Default DATABASE_URL for local development
const defaultUrl = 'postgresql://project_e:development-password@localhost:5432/project_e';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = defaultUrl;
}

// Import db package after env is set
const { db, sql: drizzleSql } = await import('@project-e/db');
const { records } = await import('@project-e/db/schema');

// Re-export everything
export { db, records, and, eq };

// Export a raw SQL function for direct queries
export async function rawQuery(query: string, params?: unknown[]): Promise<unknown[]> {
  const result = await drizzleSql.unsafe(query, params);
  return result;
}

export type RecordData = Record<string, unknown>;

export function serializeRecord(record: typeof records.$inferSelect): RecordData {
  return {
    ...(record.data as RecordData),
    id: record.id,
    created: record.createdAt.toISOString(),
    updated: record.updatedAt.toISOString(),
  };
}
