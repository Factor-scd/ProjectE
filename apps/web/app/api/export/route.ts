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

type ExportCollection = (typeof COLLECTIONS)[number];

// POST /api/export — Export all data as JSON
export const POST = withAuth(async (request: NextRequest, _user) => {
  let body: { collections?: ExportCollection[] } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — export everything
  }

  const requestedCollections = body.collections && body.collections.length > 0
    ? body.collections.filter((c): c is ExportCollection => COLLECTIONS.includes(c as ExportCollection))
    : [...COLLECTIONS];

  const pb = createPocketBaseClient();
  const exportData: Record<string, unknown> = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
  };

  for (const collection of requestedCollections) {
    try {
      const result = await pb.collection(collection).getList(1, 1000, {
        sort: 'created',
      });
      exportData[collection] = result.items;
    } catch (error) {
      console.error(`Failed to export collection ${collection}:`, error);
      exportData[collection] = [];
    }
  }

  return NextResponse.json(exportData);
});

// GET /api/export — List available collections for export
export const GET = withAuth(async (_request: NextRequest, _user) => {
  return NextResponse.json({
    collections: COLLECTIONS.map((name) => ({
      name,
      label: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
    })),
  });
});
