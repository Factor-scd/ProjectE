import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// GET /api/search — Cross-entity full-text search
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const types = searchParams.get('types')?.split(',') || ['tasks', 'habits', 'projects', 'notes', 'reports'];
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  // Escape double quotes in query to prevent filter injection
  const safeQuery = query.replace(/"/g, '\\"');

  const pb = createPocketBaseClient();
  const results: Array<{ type: string; items: unknown[] }> = [];

  for (const type of types) {
    try {
      let filter = '';

      switch (type) {
        case 'tasks':
          filter = `title ~ "${safeQuery}" || description ~ "${safeQuery}"`;
          break;
        case 'habits':
          filter = `name ~ "${safeQuery}" || description ~ "${safeQuery}"`;
          break;
        case 'projects':
          filter = `name ~ "${safeQuery}" || description ~ "${safeQuery}"`;
          break;
        case 'notes':
          filter = `title ~ "${safeQuery}" || content ~ "${safeQuery}"`;
          break;
        case 'reports':
          filter = `title ~ "${safeQuery}" || content ~ "${safeQuery}"`;
          break;
        default:
          continue;
      }

      const items = await pb.collection(type).getList(1, limit, { filter });
      results.push({ type, items: items.items });
    } catch {
      // Skip collections that fail (e.g. missing or inaccessible)
    }
  }

  return NextResponse.json({ results });
});
