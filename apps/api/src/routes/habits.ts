import { Hono } from "hono";
import { db, habits, habitCompletions, habitTags, tags as tagsTable } from "@project-e/db";
import { and, asc, desc, eq, exists, gte, ilike, inArray, isNull, lte, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, createErrorResponse, resolveActiveDomain, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { z } from "zod";

export const habitRoutes = new Hono();

const habitFrequencyEnum = z.enum(["daily", "weekly", "custom"]);
const habitDifficultyEnum = z.enum(["easy", "medium", "hard"]);

const createHabitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  domain: z.string().min(1, "Domain is required"),
  frequency: habitFrequencyEnum.optional().default("daily"),
  difficulty: habitDifficultyEnum.optional().default("medium"),
  goalPerPeriod: z.number().int().positive().optional().default(1),
  unit: z.string().optional().nullable(),
  reminderTime: z.string().optional().nullable(),
  skipDays: z.array(z.number().int().min(0).max(6)).optional().default([]),
  moodTracking: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  tagIds: z.array(z.string().uuid()).optional(),
});

const updateHabitSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  frequency: habitFrequencyEnum.optional(),
  difficulty: habitDifficultyEnum.optional(),
  goalPerPeriod: z.number().int().positive().optional(),
  unit: z.string().optional().nullable(),
  reminderTime: z.string().optional().nullable(),
  skipDays: z.array(z.number().int().min(0).max(6)).optional(),
  moodTracking: z.boolean().optional(),
  active: z.boolean().optional(),
});

const completeHabitSchema = z.object({
  value: z.number().int().positive().optional().default(1),
  mood: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Calculate the current streak for a habit.
 */
async function calculateStreak(habitId: string, skipDays: number[]): Promise<number> {
  const completions = await db.select({ date: habitCompletions.date })
    .from(habitCompletions)
    .where(eq(habitCompletions.habitId, habitId))
    .orderBy(desc(habitCompletions.date));

  if (completions.length === 0) return 0;

  const completionDates = new Set(
    completions.map(c => c.date.toISOString().split("T")[0])
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(today);

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split("T")[0];
    const dayOfWeek = checkDate.getDay();

    if (skipDays.includes(dayOfWeek)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }

    if (completionDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// GET /api/habits — List habits with filtering, sorting, pagination
habitRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "50")));
    const filter = url.searchParams.get("filter") || undefined;
    const sort = url.searchParams.get("sort") || "-created";
    const active = url.searchParams.get("active");
    const frequency = url.searchParams.get("frequency");
    const difficulty = url.searchParams.get("difficulty");
    const tag = url.searchParams.get("tag");
    const search = url.searchParams.get("search");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const order = url.searchParams.get("order") || "asc";

    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    await requireWorkspaceAccess(c, domainId);

    const conditions: any[] = [
      eq(habits.domainId, domainId),
      isNull(habits.deletedAt),
    ];

    if (active === "true") conditions.push(eq(habits.active, true));
    else if (active === "false") conditions.push(eq(habits.active, false));
    if (frequency) conditions.push(eq(habits.frequency, frequency as any));
    if (difficulty) conditions.push(eq(habits.difficulty, difficulty as any));
    if (search) conditions.push(ilike(habits.name, `%${search}%`));
    if (filter) conditions.push(ilike(habits.name, `%${filter}%`));
    // Tag filter applied in SQL (EXISTS on the junction table) so it runs over
    // the full dataset before pagination.
    if (tag) {
      const tagIds = tag.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagIds.length > 0) {
        conditions.push(
          exists(
            db.select({ one: sql`1` })
              .from(habitTags)
              .where(and(eq(habitTags.habitId, habits.id), inArray(habitTags.tagId, tagIds)))
          )
        );
      }
    }

    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortField = sort.replace(/^-/, "");
    const sortColumns: Record<string, any> = {
      created: habits.createdAt,
      updated: habits.updatedAt,
      name: habits.name,
      frequency: habits.frequency,
      difficulty: habits.difficulty,
      streak_count: habits.streakCount,
      created_at: habits.createdAt,
      updated_at: habits.updatedAt,
    };
    const orderColumn = sortDir === "asc"
      ? asc(sortColumns[sortField] || habits.createdAt)
      : desc(sortColumns[sortField] || habits.createdAt);

    const [items, countResult] = await Promise.all([
      db.select()
        .from(habits)
        .where(and(...conditions))
        .orderBy(orderColumn)
        .limit(limit || perPage)
        .offset(offset || (page - 1) * perPage),
      db.select({ count: sql<number>`count(*)` })
        .from(habits)
        .where(and(...conditions)),
    ]);

    const totalItems = Number(countResult[0]?.count || 0);

    // Fetch tags for all habits
    let habitTagMap = new Map<string, { id: string; name: string; color: string | null }[]>();
    if (items.length > 0) {
      const habitIds = items.map(h => h.id);
      const tagRows = await db.select({
        habitId: habitTags.habitId,
        id: tagsTable.id,
        name: tagsTable.name,
        color: tagsTable.color,
      })
        .from(habitTags)
        .innerJoin(tagsTable, eq(habitTags.tagId, tagsTable.id))
        .where(inArray(habitTags.habitId, habitIds));

      for (const row of tagRows) {
        if (!habitTagMap.has(row.habitId)) habitTagMap.set(row.habitId, []);
        habitTagMap.get(row.habitId)!.push({ id: row.id, name: row.name, color: row.color });
      }
    }

    const itemsWithTags = items.map(h => ({
      ...h,
      tags: habitTagMap.get(h.id) || [],
    }));

    return c.json({
      items: itemsWithTags,
      totalItems,
      totalPages: Math.ceil(totalItems / (limit || perPage)),
      page,
      perPage: limit || perPage,
      limit: limit || perPage,
      offset: offset || (page - 1) * perPage,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[habits] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list habits" } }, 500);
  }
});

// POST /api/habits — Create a habit
habitRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createHabitSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    await requireWorkspaceAccess(c, data.domain);

    const [habit] = await db.insert(habits).values({
      name: data.name,
      description: data.description ?? null,
      domainId: data.domain,
      frequency: data.frequency,
      difficulty: data.difficulty,
      goalPerPeriod: data.goalPerPeriod,
      unit: data.unit ?? null,
      reminderTime: data.reminderTime ?? null,
      skipDays: data.skipDays,
      moodTracking: data.moodTracking,
      active: data.active,
    }).returning();

    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(habitTags).values(
        data.tagIds.map(tagId => ({ habitId: habit.id, tagId }))
      );
    }

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "habit",
      entityId: habit.id,
      changes: { name: habit.name, frequency: habit.frequency, difficulty: habit.difficulty },
      workspaceId: data.domain,
    });

    await enqueueWebhooks({ workspaceId: data.domain, event: "habit.created", entityType: "habit", entityId: habit.id, data: { name: habit.name } });

    return c.json(habit, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[habits] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create habit" } }, 500);
  }
});

// GET /api/habits/:id — Get a single habit with streak + recent completions
habitRoutes.get("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const [habit] = await db.select()
      .from(habits)
      .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
      .limit(1);

    if (!habit) {
      return c.json({ error: { code: "NOT_FOUND", message: "Habit not found" } }, 404);
    }

    await requireWorkspaceAccess(c, habit.domainId);

    // Fetch recent completions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCompletions = await db.select()
      .from(habitCompletions)
      .where(and(
        eq(habitCompletions.habitId, id),
        gte(habitCompletions.date, thirtyDaysAgo),
      ))
      .orderBy(desc(habitCompletions.date));

    // Fetch tags
    const tagRows = await db.select({
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
    })
      .from(habitTags)
      .innerJoin(tagsTable, eq(habitTags.tagId, tagsTable.id))
      .where(eq(habitTags.habitId, id));

    return c.json({
      ...habit,
      recentCompletions,
      tags: tagRows,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[habits] GET/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get habit" } }, 500);
  }
});

// PATCH /api/habits/:id — Update a habit
habitRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateHabitSchema.parse(body);

    const [existing] = await db.select()
      .from(habits)
      .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Habit not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.frequency !== undefined) updateValues.frequency = data.frequency;
    if (data.difficulty !== undefined) updateValues.difficulty = data.difficulty;
    if (data.goalPerPeriod !== undefined) updateValues.goalPerPeriod = data.goalPerPeriod;
    if (data.unit !== undefined) updateValues.unit = data.unit;
    if (data.reminderTime !== undefined) updateValues.reminderTime = data.reminderTime;
    if (data.skipDays !== undefined) updateValues.skipDays = data.skipDays;
    if (data.moodTracking !== undefined) updateValues.moodTracking = data.moodTracking;
    if (data.active !== undefined) updateValues.active = data.active;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(habits)
      .set(updateValues)
      .where(eq(habits.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "habit",
      entityId: id,
      changes: { ...data, previousName: existing.name },
      workspaceId: existing.domainId,
    });

    await enqueueWebhooks({ workspaceId: existing.domainId, event: "habit.updated", entityType: "habit", entityId: id, data: { ...data, previousName: existing.name } });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[habits] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update habit" } }, 500);
  }
});

// DELETE /api/habits/:id — Soft delete a habit
habitRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const [existing] = await db.select()
      .from(habits)
      .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Habit not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

    await db.update(habits)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(habits.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "habit",
      entityId: id,
      changes: { name: existing.name },
      workspaceId: existing.domainId,
    });

    await enqueueWebhooks({ workspaceId: existing.domainId, event: "habit.deleted", entityType: "habit", entityId: id, data: { name: existing.name } });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[habits] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete habit" } }, 500);
  }
});

// POST /api/habits/:id/tags — Assign a tag to a habit
habitRoutes.post("/:id/tags", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const { tagId } = z.object({ tagId: z.string().uuid("Invalid tag id") }).parse(body);

    const [habit] = await db.select({ id: habits.id, domainId: habits.domainId })
      .from(habits)
      .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
      .limit(1);
    if (!habit) {
      return c.json({ error: { code: "NOT_FOUND", message: "Habit not found" } }, 404);
    }

    await requireWorkspaceAccess(c, habit.domainId);

    const [tag] = await db.select({ id: tagsTable.id, name: tagsTable.name })
      .from(tagsTable)
      .where(eq(tagsTable.id, tagId))
      .limit(1);
    if (!tag) {
      return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);
    }

    // Junction table has a composite PK — ignore re-assigns instead of erroring
    await db.insert(habitTags).values({ habitId: id, tagId }).onConflictDoNothing();

    await recordActivity({
      actor: user.name,
      action: "tagged",
      entityType: "habit",
      entityId: id,
      changes: { tagId, tagName: tag.name },
      workspaceId: habit.domainId,
    });

    return c.json({ success: true }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[habits] POST /:id/tags error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to assign tag" } }, 500);
  }
});

// DELETE /api/habits/:id/tags/:tagId — Remove a tag from a habit
habitRoutes.delete("/:id/tags/:tagId", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const tagId = c.req.param("tagId");

    const [habit] = await db.select({ id: habits.id, domainId: habits.domainId })
      .from(habits)
      .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
      .limit(1);
    if (!habit) {
      return c.json({ error: { code: "NOT_FOUND", message: "Habit not found" } }, 404);
    }

    await requireWorkspaceAccess(c, habit.domainId);

    // Junction tables have no deleted_at — hard delete is correct here
    await db.delete(habitTags).where(and(eq(habitTags.habitId, id), eq(habitTags.tagId, tagId)));

    await recordActivity({
      actor: user.name,
      action: "untagged",
      entityType: "habit",
      entityId: id,
      changes: { tagId },
      workspaceId: habit.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[habits] DELETE /:id/tags/:tagId error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove tag" } }, 500);
  }
});

// POST /api/habits/:id/complete — Complete a habit for today
habitRoutes.post("/:id/complete", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = completeHabitSchema.parse(body);

    const [habit] = await db.select()
      .from(habits)
      .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
      .limit(1);

    if (!habit) {
      return c.json({ error: { code: "NOT_FOUND", message: "Habit not found" } }, 404);
    }

    await requireWorkspaceAccess(c, habit.domainId);

    const [completion] = await db.insert(habitCompletions).values({
      habitId: id,
      date: new Date(),
      value: data.value,
      mood: data.mood ?? null,
      notes: data.notes ?? null,
    }).returning();

    // Recalculate streak
    const skipDays = habit.skipDays || [];
    const newStreak = await calculateStreak(id, skipDays);

    const updateData: Record<string, unknown> = {
      streakCount: newStreak,
      updatedAt: new Date(),
    };

    if (newStreak > (habit.bestStreak || 0)) {
      updateData.bestStreak = newStreak;
    }

    await db.update(habits)
      .set(updateData)
      .where(eq(habits.id, id));

    await recordActivity({
      actor: user.name,
      action: "completed",
      entityType: "habit",
      entityId: id,
      changes: { value: data.value, mood: data.mood, streak: newStreak },
      workspaceId: habit.domainId,
    });

    return c.json({
      completion,
      streakCount: newStreak,
      bestStreak: Math.max(newStreak, habit.bestStreak || 0),
    }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[habits] POST /:id/complete error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to complete habit" } }, 500);
  }
});

// GET /api/habits/:id/completions — Completion history + streak calc
habitRoutes.get("/:id/completions", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const url = new URL(c.req.url);

    const [habit] = await db.select({ id: habits.id, domainId: habits.domainId })
      .from(habits)
      .where(and(eq(habits.id, id), isNull(habits.deletedAt)))
      .limit(1);

    if (!habit) {
      return c.json({ error: { code: "NOT_FOUND", message: "Habit not found" } }, 404);
    }

    await requireWorkspaceAccess(c, habit.domainId);

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "365"), 1000);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const order = url.searchParams.get("order") || "desc";

    const conditions: any[] = [eq(habitCompletions.habitId, id)];

    if (from) conditions.push(gte(habitCompletions.date, new Date(from)));
    if (to) conditions.push(lte(habitCompletions.date, new Date(to)));

    const orderFn = order === "asc" ? asc : desc;

    const [items, countResult] = await Promise.all([
      db.select()
        .from(habitCompletions)
        .where(and(...conditions))
        .orderBy(orderFn(habitCompletions.date))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(habitCompletions)
        .where(and(...conditions)),
    ]);

    return c.json({
      items,
      totalItems: Number(countResult[0]?.count || 0),
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[habits] GET /:id/completions error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get completions" } }, 500);
  }
});
