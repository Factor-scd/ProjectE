import { Hono } from "hono";
import { db, dashboardWidgets } from "@project-e/db";
import { and, asc, eq } from "drizzle-orm";
import { requireAuth, resolveActiveDomain, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const dashboardRoutes = new Hono();

const createWidgetSchema = z.object({
  type: z.string().min(1, "Type is required"),
  title: z.string().optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  layout: z.object({
    x: z.number().int().default(0),
    y: z.number().int().default(0),
    w: z.number().int().default(2),
    h: z.number().int().default(2),
  }).optional().default({ x: 0, y: 0, w: 2, h: 2 }),
  domain: z.string().optional(),
});

const updateWidgetSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional(),
  layout: z.object({
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int(),
    h: z.number().int(),
  }).optional(),
});

// GET /api/dashboard/widgets — User's widget config + data
dashboardRoutes.get("/widgets", async (c) => {
  try {
    const user = await requireAuth(c);
    let domainId = c.req.query("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    const items = await db.select()
      .from(dashboardWidgets)
      .where(and(
        eq(dashboardWidgets.userId, user.id),
        eq(dashboardWidgets.domainId, domainId),
      ))
      .orderBy(asc(dashboardWidgets.createdAt));

    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[dashboard] GET /widgets error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list widgets" } }, 500);
  }
});

// POST /api/dashboard/widgets — Add widget
dashboardRoutes.post("/widgets", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createWidgetSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    const [widget] = await db.insert(dashboardWidgets).values({
      userId: user.id,
      type: data.type,
      title: data.title ?? null,
      config: data.config ?? {},
      layout: data.layout ?? { x: 0, y: 0, w: 2, h: 2 },
      domainId: data.domain!,
    }).returning();

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "dashboard_widget",
      entityId: widget.id,
      changes: { type: widget.type },
      workspaceId: data.domain!,
    });

    return c.json(widget, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[dashboard] POST /widgets error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create widget" } }, 500);
  }
});

// PATCH /api/dashboard/widgets/:id — Update layout
dashboardRoutes.patch("/widgets/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateWidgetSchema.parse(body);

    const [existing] = await db.select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Widget not found" } }, 404);
    }

    const updateValues: Record<string, unknown> = {};
    if (data.type !== undefined) updateValues.type = data.type;
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.config !== undefined) updateValues.config = data.config;
    if (data.layout !== undefined) updateValues.layout = data.layout;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(dashboardWidgets)
      .set(updateValues)
      .where(eq(dashboardWidgets.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "dashboard_widget",
      entityId: id,
      changes: { type: updated.type },
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
    console.error("[dashboard] PATCH /widgets/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update widget" } }, 500);
  }
});

// DELETE /api/dashboard/widgets/:id — Remove
dashboardRoutes.delete("/widgets/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const [existing] = await db.select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Widget not found" } }, 404);
    }

    await db.delete(dashboardWidgets).where(eq(dashboardWidgets.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "dashboard_widget",
      entityId: id,
      changes: { type: existing.type },
      workspaceId: existing.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[dashboard] DELETE /widgets/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete widget" } }, 500);
  }
});
