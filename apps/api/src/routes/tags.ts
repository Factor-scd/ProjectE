import { Hono } from "hono";
import { db, tags as tagsTable } from "@project-e/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireAuth, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const tagRoutes = new Hono();

const createTagSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().optional().nullable(),
  scope: z.enum(["global", "tasks", "habits", "projects", "notes"]).optional().default("global"),
});

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional().nullable(),
  scope: z.enum(["global", "tasks", "habits", "projects", "notes"]).optional(),
});

// GET /api/tags — List
tagRoutes.get("/", async (c) => {
  try {
    await requireAuth(c);
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "50")));
    const sort = url.searchParams.get("sort") || "name";
    const filter = url.searchParams.get("filter");

    const conditions: any[] = [];
    if (filter) {
      conditions.push(eq(tagsTable.scope, filter as any));
    }

    const sortField = sort.replace(/^-/, "");
    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortColumns: Record<string, any> = { name: tagsTable.name, created: tagsTable.createdAt, updated: tagsTable.updatedAt };
    const orderColumn = sortDir === "asc" ? asc(sortColumns[sortField] || tagsTable.name) : desc(sortColumns[sortField] || tagsTable.name);

    const [items, countResult] = await Promise.all([
      db.select().from(tagsTable).where(and(...conditions)).orderBy(orderColumn).limit(perPage).offset((page - 1) * perPage),
      db.select({ count: sql<number>`count(*)` }).from(tagsTable).where(and(...conditions)),
    ]);

    return c.json({ items, totalItems: Number(countResult[0]?.count || 0), totalPages: Math.ceil(Number(countResult[0]?.count || 0) / perPage), page, perPage });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[tags] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list tags" } }, 500);
  }
});

// POST /api/tags — Create
tagRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createTagSchema.parse(body);

    const [tag] = await db.insert(tagsTable).values({
      name: data.name,
      color: data.color ?? null,
      scope: data.scope as any,
    }).returning();

    return c.json(tag, 201);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[tags] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create tag" } }, 500);
  }
});

// GET /api/tags/:id — Get single
tagRoutes.get("/:id", async (c) => {
  try {
    await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const [tag] = await db.select().from(tagsTable).where(eq(tagsTable.id, id)).limit(1);
    if (!tag) return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);
    return c.json(tag);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[tags] GET /:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get tag" } }, 500);
  }
});

// PATCH /api/tags/:id — Update
tagRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateTagSchema.parse(body);

    const [existing] = await db.select().from(tagsTable).where(eq(tagsTable.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.color !== undefined) updateValues.color = data.color;
    if (data.scope !== undefined) updateValues.scope = data.scope;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(tagsTable).set(updateValues).where(eq(tagsTable.id, id)).returning();
    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[tags] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update tag" } }, 500);
  }
});

// DELETE /api/tags/:id — Delete
tagRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const [existing] = await db.select().from(tagsTable).where(eq(tagsTable.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);

    await db.delete(tagsTable).where(eq(tagsTable.id, id));
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[tags] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete tag" } }, 500);
  }
});
