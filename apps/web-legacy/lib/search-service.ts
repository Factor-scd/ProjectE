import { db, sql } from '@project-e/db';

export interface SearchResult {
  id: string;
  type: 'task' | 'note' | 'project' | 'habit' | 'domain';
  title: string;
  snippet: string;
  score: number;
  workspaceId: string;
  link: string;
}

export interface SearchOptions {
  query: string;
  types?: string[];
  domainId?: string;
  limit?: number;
  offset?: number;
}

interface EntityConfig {
  table: string;
  titleColumn: string;
  contentColumn: string | null;
  linkPrefix: string;
  workspaceColumn: string;
  deletedColumn: string | null;
}

const entityConfigs: Record<string, EntityConfig> = {
  task: {
    table: 'tasks',
    titleColumn: 'title',
    contentColumn: 'description',
    linkPrefix: '/tasks',
    workspaceColumn: 'domain_id',
    deletedColumn: 'deleted_at',
  },
  note: {
    table: 'notes',
    titleColumn: 'title',
    contentColumn: 'content',
    linkPrefix: '/notes',
    workspaceColumn: 'domain_id',
    deletedColumn: 'deleted_at',
  },
  project: {
    table: 'projects',
    titleColumn: 'name',
    contentColumn: 'description',
    linkPrefix: '/projects',
    workspaceColumn: 'domain_id',
    deletedColumn: 'deleted_at',
  },
  habit: {
    table: 'habits',
    titleColumn: 'name',
    contentColumn: 'description',
    linkPrefix: '/habits',
    workspaceColumn: 'domain_id',
    deletedColumn: 'deleted_at',
  },
  domain: {
    table: 'domains',
    titleColumn: 'name',
    contentColumn: null,
    linkPrefix: '/settings',
    workspaceColumn: 'id',
    deletedColumn: null,
  },
};

/**
 * Full-text search across all entity types using PostgreSQL tsvector/tsquery.
 * Uses websearch_to_tsquery for user-friendly query syntax.
 * Generates snippets via ts_headline for highlighted matches.
 */
export async function searchEntities(options: SearchOptions): Promise<{
  results: SearchResult[];
  totalCount: number;
}> {
  const { query, types = ['task', 'note', 'project', 'habit', 'domain'], domainId, limit = 20, offset = 0 } = options;

  if (!query.trim()) {
    return { results: [], totalCount: 0 };
  }

  // Sanitize query for websearch
  const sanitized = query.replace(/['"\\]/g, '').trim();
  if (!sanitized) {
    return { results: [], totalCount: 0 };
  }

  const results: SearchResult[] = [];

  for (const type of types) {
    const config = entityConfigs[type];
    if (!config) continue;

    const { table, titleColumn, contentColumn, linkPrefix, workspaceColumn, deletedColumn } = config;

    // Build conditions
    const conditions: string[] = [`search_vector @@ websearch_to_tsquery('english', '${sanitized.replace(/'/g, "''")}')`];
    if (domainId && workspaceColumn !== 'id') {
      conditions.push(`${workspaceColumn} = '${domainId}'::uuid`);
    }
    if (deletedColumn) {
      conditions.push(`${deletedColumn} IS NULL`);
    }

    const whereClause = conditions.join(' AND ');

    // Use the content column for headline if available, otherwise use title
    const headlineColumn = contentColumn || titleColumn;

    const queryStr = `
      SELECT
        id,
        ${titleColumn} AS title,
        ts_headline('english', ${headlineColumn}, websearch_to_tsquery('english', '${sanitized.replace(/'/g, "''")}'),
          'MaxWords=30, MinWords=15, ShortWord=3, HighlightAll=FALSE, StartSel=<mark>, StopSel=</mark>, FragmentDelimiter=...'
        ) AS snippet,
        ts_rank(search_vector, websearch_to_tsquery('english', '${sanitized.replace(/'/g, "''")}')) AS score,
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
        type: type as SearchResult['type'],
        title: String(row.title || ''),
        snippet: String(row.snippet || ''),
        score: Number(row.score || 0),
        workspaceId: String(row.workspace_id || ''),
        link: `${linkPrefix}/${row.id}`,
      });
    }
  }

  // Sort by score descending, then apply pagination
  results.sort((a, b) => b.score - a.score);
  const totalCount = results.length;
  const paginated = results.slice(offset, offset + limit);

  return { results: paginated, totalCount };
}
