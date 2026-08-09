import { Hono } from "hono";
import { db, errorLogs } from "@project-e/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, AuthError } from "../middleware/auth";

export const errorLogRoutes = new Hono();

// GET /api/error-log?level=...&from=... — List recent errors
errorLogRoutes.get("/", async (c) => {
  try {
    await requireAuth(c);
    const url = new URL(c.req.url);
    const level = url.searchParams.get("level");
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));

    const conditions: any[] = [];
    if (level) {
      conditions.push(eq(errorLogs.level, level));
    }

    const items = await db.select()
      .from(errorLogs)
      .where(and(...conditions))
      .orderBy(desc(errorLogs.createdAt))
      .limit(limit);

    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[error-log] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list error logs" } }, 500);
  }
});

// DELETE /api/error-log — Clear all error logs
errorLogRoutes.delete("/", async (c) => {
  try {
    await requireAuth(c);
    const allLogs = await db.select({ id: errorLogs.id }).from(errorLogs);
    await db.delete(errorLogs);
    return c.json({ deleted: allLogs.length });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[error-log] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to clear error logs" } }, 500);
  }
});
