import { db, sql, notifications, domains } from "@project-e/db";
import { eq } from "drizzle-orm";

export type NotificationType =
  | "mention"
  | "status_change"
  | "due_soon"
  | "automation"
  | "assignment";

export interface CreateNotificationParams {
  userId: string;
  workspaceId?: string | null;
  type: NotificationType | string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/**
 * Insert an in-app notification and fan it out over the realtime SSE stream so
 * open clients refresh their bell count and list without polling. The event
 * mirrors the pg_notify shape used by recordActivity: `{ type, action, id,
 * workspace_id }` with `type: "notification"`.
 */
export async function createNotification(params: CreateNotificationParams): Promise<typeof notifications.$inferSelect> {
  const { userId, workspaceId, type, title, body, entityType, entityId } = params;

  const [notification] = await db.insert(notifications).values({
    userId,
    workspaceId: workspaceId ?? null,
    type,
    title,
    body: body ?? null,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
  }).returning();

  if (workspaceId) {
    const payload = JSON.stringify({ type: "notification", action: "created", id: notification.id, workspace_id: workspaceId });
    await sql`SELECT pg_notify('project_e_events', ${payload}::text)`;
  }

  return notification;
}

/**
 * MVP convenience for the single-user app: resolve the workspace owner and send
 * them the notification. Returns null when the workspace has no owner, so
 * callers can rely on this never throwing for missing ownership.
 */
export async function notifyWorkspaceOwner(params: Omit<CreateNotificationParams, "userId">): Promise<typeof notifications.$inferSelect | null> {
  const { workspaceId, ...rest } = params;
  if (!workspaceId) return null;

  const [domain] = await db
    .select({ ownerId: domains.ownerId })
    .from(domains)
    .where(eq(domains.id, workspaceId))
    .limit(1);

  if (!domain?.ownerId) return null;
  return createNotification({ ...rest, workspaceId, userId: domain.ownerId });
}
