import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// GET /api/search — Cross-entity full-text search
//
// Implementation note: the underlying data layer (`lib/database.ts`) uses a
// JavaScript filter parser that only supports `=, !=, <=, >=, <, >` — it does
// NOT understand PocketBase's `~` (contains) or `||` (or) operators. To make
// search actually return results we fetch each collection's full list and
// filter in-process with a case-insensitive substring match on the searchable
// fields. This is fine at the current data scale and avoids the silent
// zero-result bug.
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const types = (
    searchParams.get('types')?.split(',') || ['tasks', 'habits', 'projects', 'notes', 'reports']
  ).filter((t) =>
    ['tasks', 'habits', 'projects', 'notes', 'reports'].includes(t)
  );
  const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '10')));

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const needle = query.toLowerCase();
  const pb = createPocketBaseClient();
  const results: Array<{ type: string; items: unknown[] }> = [];

  type Searchable = Record<string, unknown> & { id: string };
  const matches = (record: Searchable, fields: string[]): boolean => {
    for (const f of fields) {
      const value = record[f];
      if (typeof value === 'string' && value.toLowerCase().includes(needle)) {
        return true;
      }
    }
    return false;
  };

  const searchableFields: Record<string, string[]> = {
    tasks: ['title', 'description'],
    habits: ['name', 'description'],
    projects: ['name', 'description'],
    notes: ['title', 'content'],
    reports: ['title', 'content'],
  };

  for (const type of types) {
    try {
      const items = (await pb.collection(type).getFullList()) as Searchable[];
      const filtered = items
        .filter((record) => matches(record, searchableFields[type] || []))
        .slice(0, limit)
        .map((record) => ({ id: record.id, title: getTitle(record, type) }));
      results.push({ type, items: filtered });
    } catch {
      // Skip collections that fail (e.g. missing or inaccessible)
    }
  }

  return NextResponse.json({ results });
});

function getTitle(record: Record<string, unknown>, type: string): string {
  const title = record.title ?? record.name;
  if (typeof title === 'string' && title.length > 0) return title;
  return `Untitled ${type.slice(0, -1)}`;
}
