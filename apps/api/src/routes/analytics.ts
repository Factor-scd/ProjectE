import { Hono } from "hono";
import { db, tasks, habits, habitCompletions, projects } from "@project-e/db";
import { and, eq, gte, inArray, isNull, isNotNull, or } from "drizzle-orm";
import { requireAuth, resolveActiveDomain, requireWorkspaceAccess, AuthError } from "../middleware/auth";

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

    await requireWorkspaceAccess(c, domainId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    const allTasks = await db.select()
      .from(tasks)
      .where(and(
        eq(tasks.domainId, domainId),
        gte(tasks.createdAt, startDate),
        isNull(tasks.deletedAt),
      ));

    const completedTasks = allTasks.filter(t => t.completedAt !== null);
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

// GET /api/analytics/habits?range=... — Habit completion rate (fixed per-habit expected)
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

    await requireWorkspaceAccess(c, domainId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    const allHabits = await db.select()
      .from(habits)
      .where(and(eq(habits.domainId, domainId), isNull(habits.deletedAt)));

    const habitIds = allHabits.map((h) => h.id);

    const allLogs = habitIds.length > 0
      ? await db.select()
          .from(habitCompletions)
          .where(and(
            inArray(habitCompletions.habitId, habitIds),
            gte(habitCompletions.date, startDate),
          ))
      : [];

    const logsByHabit = new Map<string, number>();
    for (const lg of allLogs) logsByHabit.set(lg.habitId, (logsByHabit.get(lg.habitId) || 0) + 1);

    const expectedForHabit = (h: typeof allHabits[number]) => {
      if (!h.active) return 0;
      const skipSet = new Set(h.skipDays || []);
      if (h.frequency === "daily") {
        let expected = 0;
        const cursor = new Date(startDate);
        for (let i = 0; i < range; i++) {
          if (!skipSet.has(cursor.getUTCDay())) expected += h.goalPerPeriod || 1;
          cursor.setDate(cursor.getDate() + 1);
        }
        return expected;
      }
      if (h.frequency === "weekly") {
        const weeks = Math.ceil(range / 7);
        return weeks * (h.goalPerPeriod || 1);
      }
      return range * (h.goalPerPeriod || 1);
    };

    let totalExpected = 0;
    const perHabit: Array<{ id: string; name: string; completed: number; expected: number; consistency: number }> = [];
    for (const h of allHabits) {
      const expected = expectedForHabit(h);
      const completed = logsByHabit.get(h.id) || 0;
      totalExpected += expected;
      perHabit.push({
        id: h.id,
        name: h.name,
        completed,
        expected,
        consistency: expected > 0 ? Math.min(100, Math.round((completed / expected) * 100)) : 0,
      });
    }

    const habitConsistency = totalExpected > 0
      ? Math.min(100, Math.round((allLogs.length / totalExpected) * 100))
      : 0;

    const activeStreaks = allHabits.filter(h => (h.streakCount || 0) > 0);
    const bestStreak = Math.max(...allHabits.map(h => h.bestStreak || 0), 0);

    return c.json({
      habitConsistency,
      totalHabits: allHabits.length,
      totalLogs: allLogs.length,
      totalExpected,
      perHabit,
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

    await requireWorkspaceAccess(c, domainId);

    const allProjects = await db.select()
      .from(projects)
      .where(and(eq(projects.domainId, domainId), isNull(projects.deletedAt)));

    const projectIds = allProjects.map((p) => p.id);

    // Count tasks per project for the domain
    const taskRows = projectIds.length > 0
      ? await db.select({ projectId: tasks.projectId, completedAt: tasks.completedAt })
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
      if (t.completedAt) entry.completedTasks += 1;
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

// GET /api/analytics/velocity?range=... — Tasks completed per day (used by new dashboard)
analyticsRoutes.get("/velocity", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const range = parseInt(url.searchParams.get("range") || "30");
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }
    await requireWorkspaceAccess(c, domainId);
    const firstDay = new Date();
    firstDay.setDate(firstDay.getDate() - (range - 1));
    firstDay.setHours(0, 0, 0, 0);
    const domainTasks = await db.select().from(tasks).where(and(eq(tasks.domainId, domainId), isNull(tasks.deletedAt), gte(tasks.completedAt, firstDay)));
    const localDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const byDay = new Map<string, number>();
    for (const t of domainTasks) if (t.completedAt) {
      const k = localDateKey(t.completedAt);
      byDay.set(k, (byDay.get(k)||0)+1);
    }
    const items: Array<{ date: string; completed: number }> = [];
    const cursor = new Date(firstDay);
    for (let i=0;i<range;i++) {
      const k = localDateKey(cursor);
      items.push({ date: k, completed: byDay.get(k)||0 });
      cursor.setDate(cursor.getDate()+1);
    }
    const avg = items.reduce((s,i)=>s+i.completed,0)/range;
    return c.json({ items, avg: Math.round(avg*10)/10, period: range }, { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[analytics] GET /velocity error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get velocity" } }, 500);
  }
});

analyticsRoutes.get("/cycle", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const range = parseInt(url.searchParams.get("range") || "30");
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }
    await requireWorkspaceAccess(c, domainId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);
    const doneTasks = await db.select().from(tasks).where(and(eq(tasks.domainId, domainId), isNotNull(tasks.completedAt), gte(tasks.completedAt, startDate), isNull(tasks.deletedAt)));
    const durations: number[] = [];
    for (const t of doneTasks) if (t.completedAt) durations.push((t.completedAt.getTime() - t.createdAt.getTime()) / (1000*60*60*24));
    durations.sort((a,b)=>a-b);
    const median = durations.length ? durations[Math.floor(durations.length/2)] : 0;
    const avg = durations.length ? durations.reduce((s,v)=>s+v,0)/durations.length : 0;
    return c.json({ median: Math.round(median*10)/10, avg: Math.round(avg*10)/10, count: durations.length, period: range }, { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[analytics] GET /cycle error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get cycle" } }, 500);
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

    await requireWorkspaceAccess(c, domainId);

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
      if (t.completedAt) {
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
