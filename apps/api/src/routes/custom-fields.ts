import { Hono } from "hono";
import { db, customFields } from "@project-e/db";
import { and, asc, eq } from "drizzle-orm";
import { requireAuth, resolveActiveDomain, requireWorkspaceAccess, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const customFieldRoutes = new Hono();

const createFieldSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().optional().default("text"),
  entityType: z.string().min(1, "Entity type is required"),
  domain: z.string().min(1, "Domain is required"),
  required: z.boolean().optional().default(false),
  options: z.array(z.string()).optional().default([]),
  defaultValue: z.unknown().optional(),
  sortOrder: z.number().int().optional().default(0),
});

const updateFieldSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  defaultValue: z.unknown().optional(),
  sortOrder: z.number().int().optional(),
});

// GET /api/custom-fields?entity=... — List for an entity type
customFieldRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const entityType = c.req.query("entity");
    let domainId = c.req.query("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }
    await requireWorkspaceAccess(c, domainId);

    const conditions: any[] = [eq(customFields.domainId, domainId)];
    if (entityType) {
      conditions.push(eq(customFields.entityType, entityType));
    }

    const items = await db.select()
      .from(customFields)
      .where(and(...conditions))
      .orderBy(asc(customFields.sortOrder), asc(customFields.name));

    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[custom-fields] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list custom fields" } }, 500);
  }
});

// POST /api/custom-fields — Create
customFieldRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createFieldSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    await requireWorkspaceAccess(c, data.domain);

    const [field] = await db.insert(customFields).values({
      name: data.name,
      type: data.type,
      entityType: data.entityType,
      domainId: data.domain,
      required: data.required,
      options: data.options ?? [],
      defaultValue: data.defaultValue ?? null,
      sortOrder: data.sortOrder ?? 0,
    }).returning();

    await recordActivity({
      actor: user.name, action: "created", entityType: "custom_field", entityId: field.id,
      changes: { name: field.name, entityType: field.entityType }, workspaceId: data.domain,
    });

    return c.json(field, 201);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[custom-fields] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create custom field" } }, 500);
  }
});

// PATCH /api/custom-fields/:id — Update
customFieldRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateFieldSchema.parse(body);

    const [existing] = await db.select().from(customFields).where(eq(customFields.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Custom field not found" } }, 404);

    await requireWorkspaceAccess(c, existing.domainId);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.type !== undefined) updateValues.type = data.type;
    if (data.required !== undefined) updateValues.required = data.required;
    if (data.options !== undefined) updateValues.options = data.options;
    if (data.defaultValue !== undefined) updateValues.defaultValue = data.defaultValue;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(customFields).set(updateValues).where(eq(customFields.id, id)).returning();

    await recordActivity({
      actor: user.name, action: "updated", entityType: "custom_field", entityId: id,
      changes: { name: updated.name }, workspaceId: existing.domainId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[custom-fields] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update custom field" } }, 500);
  }
});

// DELETE /api/custom-fields/:id — Delete
customFieldRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const [existing] = await db.select().from(customFields).where(eq(customFields.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Custom field not found" } }, 404);

    await requireWorkspaceAccess(c, existing.domainId);

    await db.delete(customFields).where(eq(customFields.id, id));

    await recordActivity({
      actor: user.name, action: "deleted", entityType: "custom_field", entityId: id,
      changes: { name: existing.name }, workspaceId: existing.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[custom-fields] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete custom field" } }, 500);
  }
});
