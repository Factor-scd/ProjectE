// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse, resolveActiveDomain } from '@/lib/auth';
import { searchEntities } from '@/lib/search-service';

// GET /api/search?q=&type=&domain=&limit=&offset=
// Full-text search across all entity types using PostgreSQL tsvector/tsquery
export const GET = withAuth(async (request: NextRequest, user) => {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const types = searchParams.get('types')?.split(',').filter(Boolean) || ['task', 'note', 'project', 'habit', 'domain'];
  let domain = searchParams.get('domain') || undefined;
  if (!domain) {
    const active = await resolveActiveDomain(user);
    domain = active.id;
  }
  const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20')));
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

  if (!q) {
    return NextResponse.json({ results: [], totalCount: 0 });
  }

  try {
    const { results, totalCount } = await searchEntities({
      query: q,
      types,
      domainId: domain,
      limit,
      offset,
    });

    return NextResponse.json({
      results,
      totalCount,
      query: q,
    });
  } catch (error) {
    console.error('[search GET] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Search failed', 500);
  }
});
