import {
  db,
  sql,
  activityFeed,
  tasks,
  habits,
  projects,
  notes,
  dailyNotes,
  calendarEvents,
  webhooks,
  agents,
  customFields,
  dashboardWidgets,
} from "@project-e/db";
import { eq } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";

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

// ── recordActivityForEntity ────────────────────────────────────────────────────
// Variant that derives the workspaceId from the entity itself when the caller
// omits it. Keeps `recordActivity` unchanged so existing call sites compile as-is.

export interface RecordActivityForEntityParams {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  workspaceId?: string | null;
}

interface EntityWorkspaceLookup {
  table: AnyPgTable;
  idColumn: AnyPgColumn;
  workspaceColumn: AnyPgColumn;
}

// Maps an entityType (as recorded in activity_feed) to the table + column that
// holds its owning workspace/domain. Tables with domain_id use that; webhooks
// store it as workspace_id.
const entityWorkspaceLookups: Record<string, EntityWorkspaceLookup> = {
  task: { table: tasks, idColumn: tasks.id, workspaceColumn: tasks.domainId },
  habit: { table: habits, idColumn: habits.id, workspaceColumn: habits.domainId },
  project: { table: projects, idColumn: projects.id, workspaceColumn: projects.domainId },
  note: { table: notes, idColumn: notes.id, workspaceColumn: notes.domainId },
  daily_note: { table: dailyNotes, idColumn: dailyNotes.id, workspaceColumn: dailyNotes.domainId },
  calendar_event: { table: calendarEvents, idColumn: calendarEvents.id, workspaceColumn: calendarEvents.domainId },
  webhook: { table: webhooks, idColumn: webhooks.id, workspaceColumn: webhooks.workspaceId },
  agent: { table: agents, idColumn: agents.id, workspaceColumn: agents.domainId },
  custom_field: { table: customFields, idColumn: customFields.id, workspaceColumn: customFields.domainId },
  dashboard_widget: { table: dashboardWidgets, idColumn: dashboardWidgets.id, workspaceColumn: dashboardWidgets.domainId },
};

async function resolveEntityWorkspaceId(entityType: string, entityId: string): Promise<string | null> {
  const lookup = entityWorkspaceLookups[entityType];
  if (!lookup) return null;

  const [row] = await db
    .select({ workspaceId: lookup.workspaceColumn })
    .from(lookup.table)
    .where(eq(lookup.idColumn, entityId))
    .limit(1);

  // AnyPgColumn erases the concrete type, so the selected value is `unknown`.
  return (row?.workspaceId as string | undefined) ?? null;
}

/**
 * Record an activity event, deriving the workspaceId from the entity when not
 * provided (or empty). Unknown entity types or unresolvable entities are logged
 * and skipped rather than crashing the request.
 */
export async function recordActivityForEntity(params: RecordActivityForEntityParams): Promise<void> {
  let workspaceId = params.workspaceId;

  if (!workspaceId || workspaceId.trim() === "") {
    workspaceId = await resolveEntityWorkspaceId(params.entityType, params.entityId);
    if (!workspaceId) {
      console.warn(`[activity] Could not resolve workspace for ${params.entityType}:${params.entityId}; skipping activity`);
      return;
    }
  }

  await recordActivity({
    actor: params.actor,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    changes: params.changes,
    workspaceId,
  });
}
