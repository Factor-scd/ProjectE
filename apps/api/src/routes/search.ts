import { Hono } from "hono";
import { db, sql } from "@project-e/db";
import { requireAuth, AuthError } from "../middleware/auth";

export const searchRoutes = new Hono();

const entityConfigs: Record<string, { table: string; titleColumn: string; contentColumn: string | null; linkPrefix: string; workspaceColumn: string; deletedColumn: string | null }> = {
  task: { table: 'tasks', titleColumn: 'title', contentColumn: 'description', linkPrefix: '/tasks', workspaceColumn: 'domain_id', deletedColumn: 'deleted_at' },
  note: { table: 'notes', titleColumn: 'title', contentColumn: 'content', linkPrefix: '/notes', workspaceColumn: 'domain_id', deletedColumn: 'deleted_at' },
  project: { table: 'projects', titleColumn: 'name', contentColumn: 'description', linkPrefix: '/projects', workspaceColumn: 'domain_id', deletedColumn: 'deleted_at' },
  habit: { table: 'habits', titleColumn: 'name', contentColumn: 'description', linkPrefix: '/habits', workspaceColumn: 'domain_id', deletedColumn: 'deleted_at' },
  domain: { table: 'domains', titleColumn: 'name', contentColumn: null, linkPrefix: '/settings', workspaceColumn: 'id', deletedColumn: null },
};

// GET /api/search?q=...&type=... — Cross-entity full-text search
searchRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const types = url.searchParams.get('types')?.split(',').filter(Boolean) || ['task', 'note', 'project', 'habit', 'domain'];
    const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get('limit') || '20')));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

    if (!q) {
      return c.json({ results: [], totalCount: 0 });
    }

    const sanitized = q.replace(/['"\\]/g, '').trim();
    if (!sanitized) {
      return c.json({ results: [], totalCount: 0 });
    }

    const results: Array<{ id: string; type: string; title: string; snippet: string; score: number; workspaceId: string; link: string }> = [];

    for (const type of types) {
      const config = entityConfigs[type];
      if (!config) continue;

      const { table, titleColumn, contentColumn, linkPrefix, workspaceColumn, deletedColumn } = config;
      const escaped = sanitized.replace(/'/g, "''");
      const conditions: string[] = ["search_vector @@ websearch_to_tsquery('english', '" + escaped + "')"];
      if (deletedColumn) {
        conditions.push(deletedColumn + " IS NULL");
      }

      const whereClause = conditions.join(' AND ');
      const headlineColumn = contentColumn || titleColumn;

      const queryStr = `
        SELECT
          id,
          ${titleColumn} AS title,
          ts_headline('english', ${headlineColumn}, websearch_to_tsquery('english', '${escaped}'),
            'MaxWords=30, MinWords=15, ShortWord=3, HighlightAll=FALSE, StartSel=<mark>, StopSel=</mark>, FragmentDelimiter=...'
          ) AS snippet,
          ts_rank(search_vector, websearch_to_tsquery('english', '${escaped}')) AS score,
          ${workspaceColumn} AS workspace_id
        FROM ${table}
        WHERE ${whereClause}
        ORDER BY score DESC
        LIMIT 50
      `;

      const rows: any[] = await sql.unsafe(queryStr);

      for (const row of rows) {
        results.push({
          id: String(row.id),
          type,
          title: String(row.title || ''),
          snippet: String(row.snippet || ''),
          score: Number(row.score || 0),
          workspaceId: String(row.workspace_id || ''),
          link: linkPrefix + '/' + row.id,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    const totalCount = results.length;
    const paginated = results.slice(offset, offset + limit);

    return c.json({ results: paginated, totalCount, query: q });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error('[search] GET error:', error);
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Search failed' } }, 500);
  }
});

// GET /api/search/recent — Recent searches (stub)
searchRoutes.get("/recent", async (c) => {
  try {
    await requireAuth(c);
    return c.json({ items: [], totalItems: 0 });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error('[search] GET /recent error:', error);
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get recent searches' } }, 500);
  }
});

// POST /api/search/index — Reindex (admin stub)
searchRoutes.post("/index", async (c) => {
  try {
    await requireAuth(c);
    return c.json({ success: true, message: 'Reindex triggered' });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error('[search] POST /index error:', error);
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to reindex' } }, 500);
  }
});
