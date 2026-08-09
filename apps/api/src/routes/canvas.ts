import { Hono } from "hono";
import { db, canvases, canvasCards, canvasConnections } from "@project-e/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireAuth, resolveActiveDomain, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const canvasRoutes = new Hono();

const createCanvasSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  mode: z.enum(["freeform", "graph"]).optional().default("freeform"),
  domain: z.string().min(1, "Domain is required"),
  tags: z.array(z.string()).optional().default([]),
  viewport: z.object({ x: z.number().default(0), y: z.number().default(0), zoom: z.number().positive().default(1) }).optional(),
  background: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const updateCanvasSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  mode: z.enum(["freeform", "graph"]).optional(),
  tags: z.array(z.string()).optional(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number().positive() }).optional(),
  background: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/canvas — List canvases
canvasRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "50")));
    const sort = url.searchParams.get("sort") || "-created";
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    const conditions: any[] = [eq(canvases.domainId, domainId)];
    const sortField = sort.replace(/^-/, "");
    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortColumns: Record<string, any> = { created: canvases.createdAt, updated: canvases.updatedAt, name: canvases.name };
    const orderColumn = sortDir === "asc" ? asc(sortColumns[sortField] || canvases.createdAt) : desc(sortColumns[sortField] || canvases.createdAt);

    const [items, countResult] = await Promise.all([
      db.select().from(canvases).where(and(...conditions)).orderBy(orderColumn).limit(perPage).offset((page - 1) * perPage),
      db.select({ count: sql<number>`count(*)` }).from(canvases).where(and(...conditions)),
    ]);

    return c.json({ items, totalItems: Number(countResult[0]?.count || 0), totalPages: Math.ceil(Number(countResult[0]?.count || 0) / perPage), page, perPage });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[canvas] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list canvases" } }, 500);
  }
});

// POST /api/canvas — Create
canvasRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createCanvasSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    const [canvas] = await db.insert(canvases).values({
      name: data.name,
      description: data.description ?? null,
      mode: data.mode,
      domainId: data.domain,
      tags: data.tags ?? [],
      viewport: data.viewport ?? { x: 0, y: 0, zoom: 1 },
      background: data.background ?? null,
      customFields: data.customFields ?? {},
    }).returning();

    await recordActivity({
      actor: user.name, action: "created", entityType: "canvas", entityId: canvas.id,
      changes: { name: canvas.name }, workspaceId: data.domain,
    });

    return c.json(canvas, 201);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[canvas] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create canvas" } }, 500);
  }
});

// GET /api/canvas/:id — Read one (full block tree)
canvasRoutes.get("/:id", async (c) => {
  try {
    await requireAuth(c);
    const id = c.req.param("id");
    const [canvas] = await db.select().from(canvases).where(eq(canvases.id, id)).limit(1);
    if (!canvas) return c.json({ error: { code: "NOT_FOUND", message: "Canvas not found" } }, 404);

    const [cards, connections] = await Promise.all([
      db.select().from(canvasCards).where(eq(canvasCards.canvasId, id)).orderBy(asc(canvasCards.zIndex)),
      db.select().from(canvasConnections).where(eq(canvasConnections.canvasId, id)),
    ]);

    return c.json({ ...canvas, cards, connections });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[canvas] GET /:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get canvas" } }, 500);
  }
});

// PATCH /api/canvas/:id — Update blocks
canvasRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateCanvasSchema.parse(body);

    const [existing] = await db.select().from(canvases).where(eq(canvases.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Canvas not found" } }, 404);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.mode !== undefined) updateValues.mode = data.mode;
    if (data.tags !== undefined) updateValues.tags = data.tags;
    if (data.viewport !== undefined) updateValues.viewport = data.viewport;
    if (data.background !== undefined) updateValues.background = data.background;
    if (data.customFields !== undefined) updateValues.customFields = data.customFields;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(canvases).set(updateValues).where(eq(canvases.id, id)).returning();

    await recordActivity({
      actor: user.name, action: "updated", entityType: "canvas", entityId: id,
      changes: { name: updated.name }, workspaceId: existing.domainId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[canvas] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update canvas" } }, 500);
  }
});

// DELETE /api/canvas/:id — Delete
canvasRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const [existing] = await db.select().from(canvases).where(eq(canvases.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Canvas not found" } }, 404);

    await db.delete(canvases).where(eq(canvases.id, id));

    await recordActivity({
      actor: user.name, action: "deleted", entityType: "canvas", entityId: id,
      changes: { name: existing.name }, workspaceId: existing.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[canvas] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete canvas" } }, 500);
  }
});
