import { Hono } from "hono";
import { db, activityFeed } from "@project-e/db";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { requireAuth, resolveActiveDomain, requireWorkspaceAccess, AuthError } from "../middleware/auth";

export const notificationRoutes = new Hono();

// The bell in the topbar shows a badge for activity_feed events from the last
// 7 days. There is no read/unread state yet, so "count" doubles as the unread
// badge. graph_edge rows are workspace-internal graph plumbing, not user-facing
// activity, so they are excluded from both the count and the feed.
const NOTIFICATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// GET /api/notifications?workspace_id=&limit= — Recent activity for a workspace.
notificationRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    let workspaceId = c.req.query("workspace_id");
    if (!workspaceId) {
      const active = await resolveActiveDomain(user);
      workspaceId = active.id;
    }
    await requireWorkspaceAccess(c, workspaceId);

    const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 100);
    const since = new Date(Date.now() - NOTIFICATION_WINDOW_MS);
    const conditions = [
      eq(activityFeed.workspaceId, workspaceId),
      gte(activityFeed.createdAt, since),
      ne(activityFeed.entityType, "graph_edge"),
    ];

    const [items, countResult] = await Promise.all([
      db.select().from(activityFeed).where(and(...conditions)).orderBy(desc(activityFeed.createdAt)).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(activityFeed).where(and(...conditions)),
    ]);

    return c.json({ items, count: Number(countResult[0]?.count || 0) });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[notifications] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get notifications" } }, 500);
  }
});
