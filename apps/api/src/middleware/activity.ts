import { db, sql, activityFeed } from "@project-e/db";

export interface RecordActivityParams {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  workspaceId: string;
}

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

  const payload = JSON.stringify({ type: entityType, action, id: entityId, workspace_id: workspaceId });
  await sql`SELECT pg_notify('project_e_events', ${payload}::text)`;
}
