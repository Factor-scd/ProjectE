import { Hono } from "hono";
import { db, tasks, habits, habitCompletions } from "@project-e/db";
import { and, eq, gte, isNull } from "drizzle-orm";
import { requireAuth, resolveActiveDomain, AuthError } from "../middleware/auth";

export const analyticsRoutes = new Hono();

// GET /api/analytics/productivity?range=... — Task completion over time
analyticsRoutes.get("/productivity", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const range = parseInt(url.searchParams.get("range") || "30");
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    const allTasks = await db.select()
      .from(tasks)
      .where(and(
        eq(tasks.domainId, domainId),
        gte(tasks.createdAt, startDate),
        isNull(tasks.deletedAt),
      ));

    const completedTasks = allTasks.filter(t => t.status === "done");
    const taskCompletionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

    return c.json({
      taskCompletionRate,
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      period: range,
    }, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[analytics] GET /productivity error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get productivity analytics" } }, 500);
  }
});

// GET /api/analytics/habits?range=... — Habit completion rate
analyticsRoutes.get("/habits", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const range = parseInt(url.searchParams.get("range") || "30");
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    const allHabits = await db.select()
      .from(habits)
      .where(and(eq(habits.domainId, domainId), isNull(habits.deletedAt)));

    const allLogs = await db.select()
      .from(habitCompletions)
      .where(gte(habitCompletions.date, startDate));

    const habitConsistency = allHabits.length > 0
      ? Math.round((allLogs.length / (allHabits.length * range)) * 100)
      : 0;

    const activeStreaks = allHabits.filter(h => (h.streakCount || 0) > 0);
    const bestStreak = Math.max(...allHabits.map(h => h.bestStreak || 0), 0);

    return c.json({
      habitConsistency,
      totalHabits: allHabits.length,
      totalLogs: allLogs.length,
      activeStreaks: activeStreaks.length,
      bestStreak,
      period: range,
    }, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[analytics] GET /habits error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get habit analytics" } }, 500);
  }
});

// GET /api/analytics/projects?range=... — Project progress
analyticsRoutes.get("/projects", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const range = parseInt(url.searchParams.get("range") || "30");
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    const allTasks = await db.select()
      .from(tasks)
      .where(and(
        eq(tasks.domainId, domainId),
        gte(tasks.createdAt, startDate),
        isNull(tasks.deletedAt),
      ));

    const completedTasks = allTasks.filter(t => t.status === "done");
    const taskCompletionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

    return c.json({
      taskCompletionRate,
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      period: range,
    }, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[analytics] GET /projects error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get project analytics" } }, 500);
  }
});
