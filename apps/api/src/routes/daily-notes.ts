import { Hono } from "hono";
import { db, dailyNotes } from "@project-e/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, resolveActiveDomain, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const dailyNoteRoutes = new Hono();

const createDailyNoteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  content: z.string().optional().nullable(),
  domain: z.string().min(1, "Domain is required"),
  mood: z.number().int().min(1).max(10).optional().nullable(),
  energy: z.number().int().min(1).max(10).optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const updateDailyNoteSchema = z.object({
  content: z.string().optional().nullable(),
  mood: z.number().int().min(1).max(10).optional().nullable(),
  energy: z.number().int().min(1).max(10).optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/daily-notes?date=YYYY-MM-DD — Read
dailyNoteRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const dateStr = c.req.query("date");
    let domainId = c.req.query("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    if (dateStr) {
      const startOfDay = new Date(dateStr + "T00:00:00.000Z");
      const endOfDay = new Date(dateStr + "T23:59:59.999Z");
      const [note] = await db.select()
        .from(dailyNotes)
        .where(and(
          eq(dailyNotes.domainId, domainId),
          eq(dailyNotes.date, startOfDay),
        ))
        .limit(1);
      return c.json(note || null);
    }

    // List all daily notes for domain
    const items = await db.select()
      .from(dailyNotes)
      .where(eq(dailyNotes.domainId, domainId))
      .orderBy(desc(dailyNotes.date));
    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[daily-notes] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get daily note" } }, 500);
  }
});

// POST /api/daily-notes — Create for a date
dailyNoteRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createDailyNoteSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    const [note] = await db.insert(dailyNotes).values({
      date: new Date(data.date + "T00:00:00.000Z"),
      content: data.content ?? null,
      domainId: data.domain,
      mood: data.mood ?? null,
      energy: data.energy ?? null,
      customFields: data.customFields ?? {},
    }).returning();

    await recordActivity({
      actor: user.name, action: "created", entityType: "daily_note", entityId: note.id,
      changes: { date: data.date }, workspaceId: data.domain,
    });

    return c.json(note, 201);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[daily-notes] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create daily note" } }, 500);
  }
});

// PATCH /api/daily-notes/:id — Update content
dailyNoteRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateDailyNoteSchema.parse(body);

    const [existing] = await db.select().from(dailyNotes).where(eq(dailyNotes.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Daily note not found" } }, 404);

    const updateValues: Record<string, unknown> = {};
    if (data.content !== undefined) updateValues.content = data.content;
    if (data.mood !== undefined) updateValues.mood = data.mood;
    if (data.energy !== undefined) updateValues.energy = data.energy;
    if (data.customFields !== undefined) updateValues.customFields = data.customFields;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(dailyNotes).set(updateValues).where(eq(dailyNotes.id, id)).returning();

    await recordActivity({
      actor: user.name, action: "updated", entityType: "daily_note", entityId: id,
      changes: { date: existing.date.toISOString() }, workspaceId: existing.domainId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[daily-notes] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update daily note" } }, 500);
  }
});
