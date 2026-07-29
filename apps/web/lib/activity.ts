import { db, sql, activityFeed } from '@project-e/db';

export interface RecordActivityParams {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  workspaceId: string;
}

/**
 * Record an activity feed entry and fire a pg_notify event.
 * Every write API route MUST call this after every INSERT/UPDATE/DELETE.
 */
export async function recordActivity(params: RecordActivityParams): Promise<void> {
  const { actor, action, entityType, entityId, changes, workspaceId } = params;

  await db.insert(activityFeed).values({
    actor,
    action,
    entityType,
    entityId,
    changes: changes ?? null,
    workspaceId,
  });

  // Notify SSE subscribers
  await sql.unsafe(
    `SELECT pg_notify('project_e_events', ${JSON.stringify(
      JSON.stringify({
        type: entityType,
        action,
        id: entityId,
        workspace_id: workspaceId,
      })
    )})`
  );
}
