import { Hono } from "hono";
import { db, tasks, habits, habitCompletions, projects } from "@project-e/db";
import { and, eq, gte, inArray, isNull, or } from "drizzle-orm";
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

    const habitIds = allHabits.map((h) => h.id);

    // Only count completions belonging to habits in this domain (not all completions globally)
    const allLogs = habitIds.length > 0
      ? await db.select()
          .from(habitCompletions)
          .where(and(
            inArray(habitCompletions.habitId, habitIds),
            gte(habitCompletions.date, startDate),
          ))
      : [];

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

// GET /api/analytics/projects?range=... — Per-project progress
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

    const allProjects = await db.select()
      .from(projects)
      .where(and(eq(projects.domainId, domainId), isNull(projects.deletedAt)));

    const projectIds = allProjects.map((p) => p.id);

    // Count tasks per project (any status, including non-done) for the domain
    const taskRows = projectIds.length > 0
      ? await db.select({ projectId: tasks.projectId, status: tasks.status })
          .from(tasks)
          .where(and(
            isNull(tasks.deletedAt),
            inArray(tasks.projectId, projectIds),
          ))
      : [];

    const counts = new Map<string, { totalTasks: number; completedTasks: number }>();
    for (const t of taskRows) {
      if (!t.projectId) continue;
      const entry = counts.get(t.projectId) ?? { totalTasks: 0, completedTasks: 0 };
      entry.totalTasks += 1;
      if (t.status === "done") entry.completedTasks += 1;
      counts.set(t.projectId, entry);
    }

    const projectsData = allProjects.map((p) => {
      const stats = counts.get(p.id) ?? { totalTasks: 0, completedTasks: 0 };
      const progress = stats.totalTasks > 0
        ? Math.round((stats.completedTasks / stats.totalTasks) * 100) / 100
        : 0;
      return {
        id: p.id,
        name: p.name,
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        progress,
      };
    });

    return c.json({
      projects: projectsData,
      totalProjects: allProjects.length,
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

// GET /api/analytics/daily?range=... — Daily task creation & completion time series
analyticsRoutes.get("/daily", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const range = parseInt(url.searchParams.get("range") || "30");
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    // Buckets cover the last `range` days ending today, matching the frontend's expectation.
    const firstDay = new Date();
    firstDay.setDate(firstDay.getDate() - (range - 1));
    firstDay.setHours(0, 0, 0, 0);

    const domainTasks = await db.select()
      .from(tasks)
      .where(and(
        eq(tasks.domainId, domainId),
        isNull(tasks.deletedAt),
        or(
          gte(tasks.createdAt, firstDay),
          gte(tasks.completedAt, firstDay),
        ),
      ));

    // Bucket by local calendar date (yyyy-MM-dd) so keys line up with the frontend's
    // date-fns day generation (which uses local time as well).
    const localDateKey = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const createdByDay = new Map<string, number>();
    const completedByDay = new Map<string, number>();
    for (const t of domainTasks) {
      const createdKey = localDateKey(t.createdAt);
      createdByDay.set(createdKey, (createdByDay.get(createdKey) || 0) + 1);
      if (t.status === "done" && t.completedAt) {
        const completedKey = localDateKey(t.completedAt);
        completedByDay.set(completedKey, (completedByDay.get(completedKey) || 0) + 1);
      }
    }

    const items: Array<{ date: string; created: number; completed: number }> = [];
    const cursor = new Date(firstDay);
    for (let i = 0; i < range; i++) {
      const key = localDateKey(cursor);
      items.push({
        date: key,
        created: createdByDay.get(key) || 0,
        completed: completedByDay.get(key) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return c.json({
      items,
      period: range,
    }, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[analytics] GET /daily error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get daily analytics" } }, 500);
  }
});
