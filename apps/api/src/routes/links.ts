import { Hono } from "hono";
import { db, links, tasks, notes, projects } from "@project-e/db";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const linkRoutes = new Hono();

const createLinkSchema = z.object({
  sourceType: z.string().min(1),
  sourceId: z.string().uuid(),
  targetType: z.string().min(1),
  targetId: z.string().uuid(),
  linkType: z.enum(["relates", "blocks", "parent-child", "created-from"]),
  direction: z.string().optional().nullable(),
});

async function resolveWorkspaceId(entityType: string, entityId: string): Promise<string | null> {
  if (entityType === "task") {
    const [row] = await db.select({ domainId: tasks.domainId }).from(tasks).where(eq(tasks.id, entityId)).limit(1);
    return row?.domainId ?? null;
  }
  if (entityType === "note") {
    const [row] = await db.select({ domainId: notes.domainId }).from(notes).where(eq(notes.id, entityId)).limit(1);
    return row?.domainId ?? null;
  }
  return null;
}

// GET /api/links — List links for an entity (either source OR target)
linkRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");

    if (!entityType || !entityId) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "entityType and entityId query parameters are required" } }, 400);
    }

    const workspaceId = await resolveWorkspaceId(entityType, entityId);
    if (workspaceId) {
      await requireWorkspaceAccess(c, workspaceId);
    }

    const items = await db.select()
      .from(links)
      .where(or(
        and(eq(links.sourceType, entityType), eq(links.sourceId, entityId)),
        and(eq(links.targetType, entityType), eq(links.targetId, entityId)),
      ));

    return c.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[links] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list links" } }, 500);
  }
});

// POST /api/links — Create a link between two entities
linkRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createLinkSchema.parse(body);

    // Prevent self-links
    if (data.sourceId === data.targetId) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot link an entity to itself" } }, 400);
    }

    // Check for duplicate link
    const [existing] = await db.select({ id: links.id })
      .from(links)
      .where(and(
        eq(links.sourceId, data.sourceId),
        eq(links.targetId, data.targetId),
        eq(links.linkType, data.linkType),
      ))
      .limit(1);

    if (existing) {
      return c.json({ error: { code: "CONFLICT", message: "Link already exists" } }, 409);
    }

    const workspaceId = await resolveWorkspaceId(data.sourceType, data.sourceId);
    if (workspaceId) {
      await requireWorkspaceAccess(c, workspaceId);
    }

    const [link] = await db.insert(links).values({
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      targetType: data.targetType,
      targetId: data.targetId,
      linkType: data.linkType,
      direction: data.direction ?? null,
    }).returning();

    if (workspaceId) {
      await recordActivity({
        actor: user.name,
        action: "created",
        entityType: "link",
        entityId: link.id,
        changes: { sourceType: data.sourceType, sourceId: data.sourceId, targetType: data.targetType, targetId: data.targetId, linkType: data.linkType },
        workspaceId,
      });
    }

    return c.json(link, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[links] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create link" } }, 500);
  }
});

// DELETE /api/links/:id — Remove a link
linkRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [existing] = await db.select()
      .from(links)
      .where(eq(links.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Link not found" } }, 404);
    }

    const workspaceId = await resolveWorkspaceId(existing.sourceType, existing.sourceId);
    if (workspaceId) {
      await requireWorkspaceAccess(c, workspaceId);
    }

    await db.delete(links).where(eq(links.id, id));

    if (workspaceId) {
      await recordActivity({
        actor: user.name,
        action: "deleted",
        entityType: "link",
        entityId: id,
        changes: { sourceType: existing.sourceType, sourceId: existing.sourceId, targetType: existing.targetType, targetId: existing.targetId },
        workspaceId,
      });
    }

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[links] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete link" } }, 500);
  }
});
