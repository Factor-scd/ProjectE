import { Hono } from "hono";
import { db, notifications } from "@project-e/db";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { requireAuth, createErrorResponse, AuthError, isUuid } from "../middleware/auth";

export const notificationRoutes = new Hono();

// Notifications are per-user rows, so every route is scoped to the current
// user via requireAuth (not requireWorkspaceAccess). The optional
// workspace_id filter is safe against IDOR because the WHERE clause always
// pins notifications.userId to the authenticated user.

const PAGE_SIZE_DEFAULT = 30;

// GET /api/notifications — List the current user's notifications, newest
// first. Query params: workspace_id (filter), unread=true (unread only),
// limit/offset or page/perPage for pagination.
notificationRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const workspaceId = c.req.query("workspace_id");
    const unreadOnly = c.req.query("unread") === "true";

    const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "0", 10) || 0, 1), 100);
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
    const perPage = Math.min(Math.max(parseInt(c.req.query("perPage") || "0", 10) || 0, 1), 100);
    const effectiveLimit = limit || perPage || PAGE_SIZE_DEFAULT;
    const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0) || (page - 1) * effectiveLimit;

    const conditions: any[] = [eq(notifications.userId, user.id), isNull(notifications.deletedAt)];
    if (workspaceId) conditions.push(eq(notifications.workspaceId, workspaceId));
    if (unreadOnly) conditions.push(isNull(notifications.readAt));

    const [items, totalResult, unreadResult] = await Promise.all([
      db.select().from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(effectiveLimit)
        .offset(offset),
      db.select({ value: count() }).from(notifications).where(and(...conditions)),
      db.select({ value: count() }).from(notifications)
        .where(and(...conditions, isNull(notifications.readAt))),
    ]);

    const totalItems = Number(totalResult[0]?.value ?? 0);
    return c.json({
      items,
      totalItems,
      unreadCount: Number(unreadResult[0]?.value ?? 0),
      page,
      perPage: effectiveLimit,
      limit: effectiveLimit,
      offset,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notifications] GET error:", error);
    return c.json(createErrorResponse("INTERNAL_ERROR", "Failed to list notifications"), 500);
  }
});

// GET /api/notifications/count — Unread count for the bell badge.
notificationRoutes.get("/count", async (c) => {
  try {
    const user = await requireAuth(c);
    const workspaceId = c.req.query("workspace_id");

    const conditions: any[] = [eq(notifications.userId, user.id), isNull(notifications.readAt), isNull(notifications.deletedAt)];
    if (workspaceId) conditions.push(eq(notifications.workspaceId, workspaceId));

    const [result] = await db.select({ value: count() }).from(notifications).where(and(...conditions));
    return c.json({ count: Number(result?.value ?? 0) });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notifications] GET /count error:", error);
    return c.json(createErrorResponse("INTERNAL_ERROR", "Failed to get unread count"), 500);
  }
});

// PATCH /api/notifications/:id — Mark a notification as read.
notificationRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json(createErrorResponse("NOT_FOUND", "Resource not found"), 404);
    }

    const [existing] = await db.select({ id: notifications.id, userId: notifications.userId, deletedAt: notifications.deletedAt })
      .from(notifications)
      .where(and(eq(notifications.id, id), isNull(notifications.deletedAt)))
      .limit(1);
    if (!existing || existing.userId !== user.id) {
      return c.json(createErrorResponse("NOT_FOUND", "Notification not found"), 404);
    }

    await db.update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, id));

    return c.json({ success: true, id });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notifications] PATCH error:", error);
    return c.json(createErrorResponse("INTERNAL_ERROR", "Failed to update notification"), 500);
  }
});

// POST /api/notifications/read-all — Mark every notification in the workspace
// (or all notifications when no workspace_id is given) as read.
notificationRoutes.post("/read-all", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json().catch(() => ({}));
    const workspaceId = (body as { workspace_id?: string }).workspace_id ?? c.req.query("workspace_id");

    const conditions: any[] = [eq(notifications.userId, user.id), isNull(notifications.readAt), isNull(notifications.deletedAt)];
    if (workspaceId) conditions.push(eq(notifications.workspaceId, workspaceId));

    const result = await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(...conditions))
      .returning({ id: notifications.id });

    return c.json({ success: true, updated: result.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notifications] POST /read-all error:", error);
    return c.json(createErrorResponse("INTERNAL_ERROR", "Failed to mark all notifications as read"), 500);
  }
});

// DELETE /api/notifications/:id — Soft-delete a notification.
notificationRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json(createErrorResponse("NOT_FOUND", "Resource not found"), 404);
    }

    const [existing] = await db.select({ id: notifications.id, userId: notifications.userId, deletedAt: notifications.deletedAt })
      .from(notifications)
      .where(and(eq(notifications.id, id), isNull(notifications.deletedAt)))
      .limit(1);
    if (!existing || existing.userId !== user.id) {
      return c.json(createErrorResponse("NOT_FOUND", "Notification not found"), 404);
    }

    await db.update(notifications)
      .set({ deletedAt: new Date() })
      .where(eq(notifications.id, id));

    return c.json({ success: true, id });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notifications] DELETE error:", error);
    return c.json(createErrorResponse("INTERNAL_ERROR", "Failed to delete notification"), 500);
  }
});
