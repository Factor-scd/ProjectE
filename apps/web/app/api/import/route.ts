import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

const COLLECTIONS = [
  'tasks',
  'habits',
  'projects',
  'notes',
  'reports',
  'milestones',
  'domains',
  'tags',
  'agents',
  'webhooks',
] as const;

type ImportCollection = (typeof COLLECTIONS)[number];

interface ImportResult {
  collection: string;
  imported: number;
  failed: number;
  errors: string[];
}

// POST /api/import — Import data from JSON
export const POST = withAuth(async (request: NextRequest, _user) => {
  const body = await request.json();

  if (!body || typeof body !== 'object') {
    return createErrorResponse('INVALID_DATA', 'Invalid import data format', 400);
  }

  if (!body.version) {
    return createErrorResponse('INVALID_DATA', 'Missing version field — is this a valid Project E export?', 400);
  }

  const pb = createPocketBaseClient();
  const results: ImportResult[] = [];
  let totalImported = 0;
  let totalFailed = 0;

  for (const collection of COLLECTIONS) {
    const items = body[collection];
    if (!Array.isArray(items) || items.length === 0) continue;

    const result: ImportResult = {
      collection,
      imported: 0,
      failed: 0,
      errors: [],
    };

    for (const item of items) {
      try {
        // Strip id, created, updated to let PocketBase generate new ones
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created, updated, ...data } = item;
        await pb.collection(collection).create(data);
        result.imported++;
      } catch (error) {
        result.failed++;
        const message = error instanceof Error ? error.message : String(error);
        if (result.errors.length < 5) {
          result.errors.push(message);
        }
      }
    }

    results.push(result);
    totalImported += result.imported;
    totalFailed += result.failed;
  }

  return NextResponse.json({
    success: totalFailed === 0,
    imported: totalImported,
    failed: totalFailed,
    results,
  });
});
