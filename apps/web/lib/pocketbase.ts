import PocketBase from 'pocketbase';

const pocketbaseUrl = process.env.POCKETBASE_URL || 'http://localhost:8090';

/**
 * Create a PocketBase client instance
 * @param token - Optional auth token for authenticated requests
 */
export function createPocketBaseClient(token?: string): PocketBase {
  const pb = new PocketBase(pocketbaseUrl);
  if (token) {
    pb.authStore.save(token, null);
  }
  return pb;
}

/**
 * Get admin token from environment
 */
export function getAdminToken(): string {
  return process.env.POCKETBASE_ADMIN_TOKEN || '';
}

/**
 * Create an admin-authenticated PocketBase client
 * Used for server-side operations that need admin privileges
 */
export function createAdminClient(): PocketBase {
  const pb = new PocketBase(pocketbaseUrl);
  const adminToken = getAdminToken();
  if (adminToken) {
    pb.authStore.save(adminToken, null);
  }
  return pb;
}

/**
 * Generic helper to fetch a record by ID
 */
export async function getRecord<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  token?: string
): Promise<T> {
  const pb = createPocketBaseClient(token);
  return pb.collection(collection).getOne(id) as Promise<T>;
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
  const pb = createPocketBaseClient(options?.token);
  const result = await pb.collection(collection).getList(
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
  const pb = createPocketBaseClient(token);
  return pb.collection(collection).create(data) as Promise<T>;
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
  const pb = createPocketBaseClient(token);
  return pb.collection(collection).update(id, data) as Promise<T>;
}

/**
 * Generic helper to delete a record
 */
export async function deleteRecord(
  collection: string,
  id: string,
  token?: string
): Promise<boolean> {
  const pb = createPocketBaseClient(token);
  return pb.collection(collection).delete(id);
}
