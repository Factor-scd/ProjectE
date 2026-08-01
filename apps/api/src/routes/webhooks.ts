import { Hono } from "hono";
import { db, webhooks, webhookDeliveries } from "@project-e/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireAuth, resolveActiveDomain, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const webhookRoutes = new Hono();

const createWebhookSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Invalid URL"),
  events: z.array(z.string()).min(1, "At least one event is required"),
  secret: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
  domain: z.string().min(1, "Domain is required"),
  headers: z.record(z.string(), z.string()).optional(),
  retryCount: z.number().int().nonnegative().optional().default(3),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  secret: z.string().optional().nullable(),
  active: z.boolean().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  retryCount: z.number().int().nonnegative().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/webhooks — List
webhookRoutes.get("/", async (c) => {
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

    const conditions: any[] = [eq(webhooks.workspaceId, domainId)];
    const sortField = sort.replace(/^-/, "");
    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortColumns: Record<string, any> = { created: webhooks.createdAt, updated: webhooks.updatedAt, name: webhooks.name };
    const orderColumn = sortDir === "asc" ? asc(sortColumns[sortField] || webhooks.createdAt) : desc(sortColumns[sortField] || webhooks.createdAt);

    const [items, countResult] = await Promise.all([
      db.select().from(webhooks).where(and(...conditions)).orderBy(orderColumn).limit(perPage).offset((page - 1) * perPage),
      db.select({ count: sql<number>`count(*)` }).from(webhooks).where(and(...conditions)),
    ]);

    return c.json({ items, totalItems: Number(countResult[0]?.count || 0), totalPages: Math.ceil(Number(countResult[0]?.count || 0) / perPage), page, perPage });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[webhooks] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list webhooks" } }, 500);
  }
});

// POST /api/webhooks — Create
webhookRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createWebhookSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    const [webhook] = await db.insert(webhooks).values({
      name: data.name,
      url: data.url,
      secret: data.secret ?? null,
      events: data.events,
      active: data.active,
      workspaceId: data.domain,
    }).returning();

    await recordActivity({
      actor: user.name, action: "created", entityType: "webhook", entityId: webhook.id,
      changes: { name: webhook.name, url: webhook.url }, workspaceId: data.domain,
    });

    return c.json(webhook, 201);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[webhooks] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create webhook" } }, 500);
  }
});

// PATCH /api/webhooks/:id — Update
webhookRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateWebhookSchema.parse(body);

    const [existing] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Webhook not found" } }, 404);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.url !== undefined) updateValues.url = data.url;
    if (data.secret !== undefined) updateValues.secret = data.secret;
    if (data.events !== undefined) updateValues.events = data.events;
    if (data.active !== undefined) updateValues.active = data.active;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(webhooks).set(updateValues).where(eq(webhooks.id, id)).returning();

    await recordActivity({
      actor: user.name, action: "updated", entityType: "webhook", entityId: id,
      changes: { name: updated.name }, workspaceId: existing.workspaceId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[webhooks] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update webhook" } }, 500);
  }
});

// DELETE /api/webhooks/:id — Delete
webhookRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const [existing] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Webhook not found" } }, 404);

    await db.delete(webhooks).where(eq(webhooks.id, id));

    await recordActivity({
      actor: user.name, action: "deleted", entityType: "webhook", entityId: id,
      changes: { name: existing.name }, workspaceId: existing.workspaceId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[webhooks] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete webhook" } }, 500);
  }
});

// POST /api/webhooks/:id/test — Test fire
webhookRoutes.post("/:id/test", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
    if (!webhook) return c.json({ error: { code: "NOT_FOUND", message: "Webhook not found" } }, 404);

    const testPayload = { event: "test", data: { message: "This is a test webhook from Project E", timestamp: new Date().toISOString() } };

    await db.insert(webhookDeliveries).values({
      webhookId: id,
      event: "test",
      payload: testPayload,
      status: "pending",
    });

    return c.json({ success: true, message: "Test webhook queued" });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[webhooks] POST /:id/test error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to test webhook" } }, 500);
  }
});
