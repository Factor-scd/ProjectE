import { Hono } from "hono";
import { db, canvases, canvasCards, canvasConnections } from "@project-e/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireAuth, resolveActiveDomain, requireWorkspaceAccess, AuthError } from "../middleware/auth";
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

const createCardSchema = z.object({
  type: z.string().min(1).default("note"),
  content: z.string().optional().nullable().default(""),
  title: z.string().optional().nullable(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  rotation: z.number().int().optional(),
  color: z.string().optional().nullable(),
  zIndex: z.number().int().optional(),
});

const updateCardSchema = createCardSchema.partial();

const bulkSaveCardsSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string().uuid().optional(),
      type: z.string().min(1).default("note"),
      content: z.string().optional().nullable().default(""),
      title: z.string().optional().nullable(),
      x: z.number().int().optional(),
      y: z.number().int().optional(),
      width: z.number().int().optional(),
      height: z.number().int().optional(),
      rotation: z.number().int().optional(),
      color: z.string().optional().nullable(),
      zIndex: z.number().int().optional(),
    })
  ).default([]),
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
    await requireWorkspaceAccess(c, domainId);

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

    await requireWorkspaceAccess(c, data.domain);

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

    await requireWorkspaceAccess(c, canvas.domainId);

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

    await requireWorkspaceAccess(c, existing.domainId);

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

    await requireWorkspaceAccess(c, existing.domainId);

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

// POST /api/canvas/:id/cards — Create one card (new block)
canvasRoutes.post("/:id/cards", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = createCardSchema.parse(body);

    const [canvas] = await db.select().from(canvases).where(eq(canvases.id, id)).limit(1);
    if (!canvas) return c.json({ error: { code: "NOT_FOUND", message: "Canvas not found" } }, 404);

    await requireWorkspaceAccess(c, canvas.domainId);

    // New cards append to the end of the vertical document unless an explicit zIndex is given
    const [maxRow] = await db
      .select({ max: sql<number>`max(${canvasCards.zIndex})` })
      .from(canvasCards)
      .where(eq(canvasCards.canvasId, id));
    const zIndex = data.zIndex ?? Number(maxRow?.max ?? -1) + 1;

    const [card] = await db.insert(canvasCards).values({
      canvasId: id,
      type: data.type,
      content: data.content ?? "",
      title: data.title ?? null,
      x: data.x ?? 0,
      y: data.y ?? 0,
      width: data.width ?? 200,
      height: data.height ?? 150,
      rotation: data.rotation ?? 0,
      color: data.color ?? null,
      zIndex,
    }).returning();

    await recordActivity({
      actor: user.name, action: "created", entityType: "canvas_card", entityId: card.id,
      changes: { type: card.type, zIndex: card.zIndex }, workspaceId: canvas.domainId,
    });

    return c.json(card, 201);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[canvas] POST /:id/cards error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create canvas card" } }, 500);
  }
});

// PUT /api/canvas/:id/cards — Bulk replace all cards (primary save path)
canvasRoutes.put("/:id/cards", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = bulkSaveCardsSchema.parse(body);

    const [canvas] = await db.select().from(canvases).where(eq(canvases.id, id)).limit(1);
    if (!canvas) return c.json({ error: { code: "NOT_FOUND", message: "Canvas not found" } }, 404);

    await requireWorkspaceAccess(c, canvas.domainId);

    const cards = await db.transaction(async (tx) => {
      await tx.delete(canvasCards).where(eq(canvasCards.canvasId, id));
      if (data.cards.length === 0) return [];
      return tx.insert(canvasCards).values(
        data.cards.map((card, i) => ({
          ...(card.id ? { id: card.id } : {}),
          canvasId: id,
          type: card.type,
          content: card.content ?? "",
          title: card.title ?? null,
          x: card.x ?? 0,
          y: card.y ?? 0,
          width: card.width ?? 200,
          height: card.height ?? 150,
          rotation: card.rotation ?? 0,
          color: card.color ?? null,
          zIndex: card.zIndex ?? i,
        }))
      ).returning();
    });

    await recordActivity({
      actor: user.name, action: "updated", entityType: "canvas", entityId: id,
      changes: { name: canvas.name, cardCount: cards.length }, workspaceId: canvas.domainId,
    });

    return c.json({ ...canvas, cards });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[canvas] PUT /:id/cards error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to save canvas cards" } }, 500);
  }
});

// PATCH /api/canvas/cards/:cardId — Update one card
canvasRoutes.patch("/cards/:cardId", async (c) => {
  try {
    const user = await requireAuth(c);
    const cardId = c.req.param("cardId");
    const body = await c.req.json();
    const data = updateCardSchema.parse(body);

    const [card] = await db.select().from(canvasCards).where(eq(canvasCards.id, cardId)).limit(1);
    if (!card) return c.json({ error: { code: "NOT_FOUND", message: "Canvas card not found" } }, 404);

    // canvas_cards has no domain_id — resolve ownership through the parent canvas
    const [canvas] = await db.select().from(canvases).where(eq(canvases.id, card.canvasId)).limit(1);
    if (canvas) {
      await requireWorkspaceAccess(c, canvas.domainId);
    }

    const updateValues: Record<string, unknown> = {};
    if (data.type !== undefined) updateValues.type = data.type;
    if (data.content !== undefined) updateValues.content = data.content;
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.x !== undefined) updateValues.x = data.x;
    if (data.y !== undefined) updateValues.y = data.y;
    if (data.width !== undefined) updateValues.width = data.width;
    if (data.height !== undefined) updateValues.height = data.height;
    if (data.rotation !== undefined) updateValues.rotation = data.rotation;
    if (data.color !== undefined) updateValues.color = data.color;
    if (data.zIndex !== undefined) updateValues.zIndex = data.zIndex;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(canvasCards).set(updateValues).where(eq(canvasCards.id, cardId)).returning();

    await recordActivity({
      actor: user.name, action: "updated", entityType: "canvas_card", entityId: cardId,
      changes: { ...data }, workspaceId: canvas?.domainId ?? "",
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[canvas] PATCH /cards/:cardId error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update canvas card" } }, 500);
  }
});

// DELETE /api/canvas/cards/:cardId — Delete one card
canvasRoutes.delete("/cards/:cardId", async (c) => {
  try {
    const user = await requireAuth(c);
    const cardId = c.req.param("cardId");
    const [card] = await db.select().from(canvasCards).where(eq(canvasCards.id, cardId)).limit(1);
    if (!card) return c.json({ error: { code: "NOT_FOUND", message: "Canvas card not found" } }, 404);

    // canvas_cards has no domain_id — resolve ownership through the parent canvas
    const [canvas] = await db.select().from(canvases).where(eq(canvases.id, card.canvasId)).limit(1);
    if (canvas) {
      await requireWorkspaceAccess(c, canvas.domainId);
    }

    // Hard delete — canvas_cards has no deleted_at column
    await db.delete(canvasCards).where(eq(canvasCards.id, cardId));

    await recordActivity({
      actor: user.name, action: "deleted", entityType: "canvas_card", entityId: cardId,
      changes: { type: card.type }, workspaceId: canvas?.domainId ?? "",
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[canvas] DELETE /cards/:cardId error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete canvas card" } }, 500);
  }
});
