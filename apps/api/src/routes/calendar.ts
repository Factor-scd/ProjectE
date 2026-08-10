import { Hono } from "hono";
import { db, calendarEvents } from "@project-e/db";
import { and, asc, desc, eq, gte, lte, isNull } from "drizzle-orm";
import { requireAuth, createErrorResponse, resolveActiveDomain, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const calendarRoutes = new Hono();

const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional().default(false),
  color: z.string().optional().nullable(),
  domain: z.string().min(1, "Domain is required"),
  entityType: z.string().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  recurrenceRule: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
  color: z.string().optional().nullable(),
  entityType: z.string().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  recurrenceRule: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/calendar/events?from=...&to=... — List events in range
calendarRoutes.get("/events", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }
    await requireWorkspaceAccess(c, domainId);

    const conditions: any[] = [eq(calendarEvents.domainId, domainId)];
    if (from) conditions.push(gte(calendarEvents.startTime, new Date(from)));
    if (to) conditions.push(lte(calendarEvents.startTime, new Date(to)));

    const limitParam = parseInt(url.searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 500)) : null;

    const query = db.select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(asc(calendarEvents.startTime));
    const items = limit !== null ? await query.limit(limit) : await query;

    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[calendar] GET /events error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list events" } }, 500);
  }
});

// POST /api/calendar/events — Create
calendarRoutes.post("/events", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createEventSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    await requireWorkspaceAccess(c, data.domain);

    const [event] = await db.insert(calendarEvents).values({
      title: data.title,
      description: data.description ?? null,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : null,
      allDay: data.allDay,
      color: data.color ?? null,
      domainId: data.domain,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      recurrenceRule: data.recurrenceRule ?? null,
      customFields: data.customFields ?? {},
    }).returning();

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "calendar_event",
      entityId: event.id,
      changes: { title: event.title },
      workspaceId: data.domain,
    });

    return c.json(event, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[calendar] POST /events error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create event" } }, 500);
  }
});

// PATCH /api/calendar/events/:id — Update
calendarRoutes.patch("/events/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateEventSchema.parse(body);

    const [existing] = await db.select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Event not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

    const updateValues: Record<string, unknown> = {};
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.startTime !== undefined) updateValues.startTime = new Date(data.startTime);
    if (data.endTime !== undefined) updateValues.endTime = data.endTime ? new Date(data.endTime) : null;
    if (data.allDay !== undefined) updateValues.allDay = data.allDay;
    if (data.color !== undefined) updateValues.color = data.color;
    if (data.entityType !== undefined) updateValues.entityType = data.entityType;
    if (data.entityId !== undefined) updateValues.entityId = data.entityId;
    if (data.recurrenceRule !== undefined) updateValues.recurrenceRule = data.recurrenceRule;
    if (data.customFields !== undefined) updateValues.customFields = data.customFields;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(calendarEvents)
      .set(updateValues)
      .where(eq(calendarEvents.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "calendar_event",
      entityId: id,
      changes: { title: updated.title },
      workspaceId: existing.domainId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[calendar] PATCH /events/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update event" } }, 500);
  }
});

// DELETE /api/calendar/events/:id — Delete
calendarRoutes.delete("/events/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [existing] = await db.select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Event not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "calendar_event",
      entityId: id,
      changes: { title: existing.title },
      workspaceId: existing.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[calendar] DELETE /events/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete event" } }, 500);
  }
});

// GET /api/calendar/upcoming?days=7 — Next N days
calendarRoutes.get("/upcoming", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days") || "7")));
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }
    await requireWorkspaceAccess(c, domainId);

    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const items = await db.select()
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.domainId, domainId),
        gte(calendarEvents.startTime, now),
        lte(calendarEvents.startTime, end),
      ))
      .orderBy(asc(calendarEvents.startTime));

    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[calendar] GET /upcoming error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get upcoming events" } }, 500);
  }
});
