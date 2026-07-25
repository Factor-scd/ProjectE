/**
 * PocketBase Compatibility Layer
 *
 * This module was originally written for PocketBase. After the migration to
 * PostgreSQL + Drizzle ORM (commit 7333548), all functions now delegate to
 * the new `database.ts` module which uses the Drizzle ORM with postgres-js.
 *
 * The naming is preserved for backward compatibility — ALL API route files
 * import from this module. Do not rename the exports unless you also update
 * every file that imports them.
 *
 * @see ./database.ts for the actual Drizzle ORM implementation.
 */
import { createAdminClient as createDatabaseAdminClient, createDatabaseClient } from './database';

/** @deprecated Import from `@/lib/database` in new code. */
export function createPocketBaseClient(_token?: string) {
  return createDatabaseClient();
}

/** @deprecated PostgreSQL access is authenticated by the application session. */
export function getAdminToken(): string {
  return '';
}

/** @deprecated Import from `@/lib/database` in new code. */
export function createAdminClient() {
  return createDatabaseAdminClient();
}

/**
 * Generic helper to fetch a record by ID
 */
export async function getRecord<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  token?: string
): Promise<T> {
  const db = createPocketBaseClient(token);
  return db.collection(collection).getOne(id) as Promise<T>;
}

/**
 * Generic helper to list records with filters
 */
export async function listRecords<T extends Record<string, unknown>>(
  collection: string,
  options?: {
    filter?: string;
    sort?: string;
    page?: number;
    perPage?: number;
    token?: string;
  }
): Promise<{ items: T[]; totalItems: number; totalPages: number }> {
  const db = createPocketBaseClient(options?.token);
  const result = await db.collection(collection).getList(
    options?.page || 1,
    options?.perPage || 50,
    {
      filter: options?.filter,
      sort: options?.sort,
    }
  );
  return {
    items: result.items as unknown as T[],
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
}

/**
 * Generic helper to create a record
 */
export async function createRecord<T extends Record<string, unknown>>(
  collection: string,
  data: Partial<T>,
  token?: string
): Promise<T> {
  const db = createPocketBaseClient(token);
  return db.collection(collection).create(data) as Promise<T>;
}

/**
 * Generic helper to update a record
 */
export async function updateRecord<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  data: Partial<T>,
  token?: string
): Promise<T> {
  const db = createPocketBaseClient(token);
  return db.collection(collection).update(id, data) as Promise<T>;
}

/**
 * Generic helper to delete a record
 */
export async function deleteRecord(
  collection: string,
  id: string,
  token?: string
): Promise<boolean> {
  const db = createPocketBaseClient(token);
  return db.collection(collection).delete(id);
}
