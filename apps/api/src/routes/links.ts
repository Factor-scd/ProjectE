import { Hono } from "hono";
import { db, links, tasks, projects } from "@project-e/db";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { z } from "zod";

export const linkRoutes = new Hono();

const linkTypeEnum = z.enum(["relates", "blocks", "parent-child", "created-from"]);

const createLinkSchema = z.object({
  sourceType: z.string().min(1, "Source type is required"),
  sourceId: z.string().uuid("Invalid source id"),
  targetType: z.string().min(1, "Target type is required"),
  targetId: z.string().uuid("Invalid target id"),
  linkType: linkTypeEnum,
  direction: z.string().optional().nullable(),
});

// GET / — List links for an entity (bidirectional)
// Filters: source_type+source_id OR target_type+target_id (at least one pair required)
linkRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const sourceType = url.searchParams.get("source_type");
    const sourceId = url.searchParams.get("source_id");
    const targetType = url.searchParams.get("target_type");
    const targetId = url.searchParams.get("target_id");
    const linkType = url.searchParams.get("link_type");
    const sort = url.searchParams.get("sort") || "-created";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Need at least one filter pair
    if ((!sourceType || !sourceId) && (!targetType || !targetId)) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "Provide at least source_type+source_id or target_type+target_id" } },
        400
      );
    }

    if (sourceId && !isUuid(sourceId)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid source_id" } }, 400);
    }
    if (targetId && !isUuid(targetId)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid target_id" } }, 400);
    }

    // Resolve workspace access from the entity referenced
    const resolveEntityDomainId = async (entityType: string, entityId: string): Promise<string | null> => {
      if (entityType === "task") {
        const [task] = await db.select({ domainId: tasks.domainId })
          .from(tasks)
          .where(eq(tasks.id, entityId))
          .limit(1);
        return task?.domainId ?? null;
      }
      if (entityType === "project") {
        const [project] = await db.select({ domainId: projects.domainId })
          .from(projects)
          .where(eq(projects.id, entityId))
          .limit(1);
        return project?.domainId ?? null;
      }
      return null;
    };

    const filterEntityType = sourceType || targetType || "task";
    const filterEntityId = sourceId || targetId || "";
    const domainId = await resolveEntityDomainId(filterEntityType, filterEntityId);

    if (domainId) {
      await requireWorkspaceAccess(c, domainId);
    }

    // Bidirectional: if filtering by source, also find links where entity is target
    const conditions: any[] = [];

    if (sourceType && sourceId) {
      conditions.push(
        or(
          and(eq(links.sourceType, sourceType), eq(links.sourceId, sourceId)),
          and(eq(links.targetType, sourceType), eq(links.targetId, sourceId)),
        )!
      );
    } else if (targetType && targetId) {
      conditions.push(
        or(
          and(eq(links.sourceType, targetType), eq(links.sourceId, targetId)),
          and(eq(links.targetType, targetType), eq(links.targetId, targetId)),
        )!
      );
    }

    if (linkType) {
      const types = linkType.split(",");
      conditions.push(inArray(links.linkType, types as any));
    }

    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortField = sort.replace(/^-/, "");
    const sortColumns: Record<string, any> = {
      created: links.createdAt,
      created_at: links.createdAt,
    };
    const orderColumn = sortDir === "asc"
      ? asc(sortColumns[sortField] || links.createdAt)
      : desc(sortColumns[sortField] || links.createdAt);

    const [items, countResult] = await Promise.all([
      db.select()
        .from(links)
        .where(and(...conditions))
        .orderBy(orderColumn)
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(links)
        .where(and(...conditions)),
    ]);

    const totalItems = Number(countResult[0]?.count || 0);

    return c.json({
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[links] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list links" } }, 500);
  }
});

// POST / — Create a link
linkRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createLinkSchema.parse(body);

    // Enforce unique constraint on (sourceType, sourceId, targetType, targetId, linkType)
    const [existing] = await db.select()
      .from(links)
      .where(
        and(
          eq(links.sourceType, data.sourceType),
          eq(links.sourceId, data.sourceId),
          eq(links.targetType, data.targetType),
          eq(links.targetId, data.targetId),
          eq(links.linkType, data.linkType),
        )
      )
      .limit(1);

    if (existing) {
      return c.json(
        { error: { code: "CONFLICT", message: "Link already exists with this combination" } },
        409
      );
    }

    // Resolve workspace access from the source entity
    let domainId: string | null = null;
    if (data.sourceType === "task") {
      const [task] = await db.select({ domainId: tasks.domainId })
        .from(tasks)
        .where(eq(tasks.id, data.sourceId))
        .limit(1);
      domainId = task?.domainId ?? null;
    } else if (data.sourceType === "project") {
      const [project] = await db.select({ domainId: projects.domainId })
        .from(projects)
        .where(eq(projects.id, data.sourceId))
        .limit(1);
      domainId = project?.domainId ?? null;
    }

    if (domainId) {
      await requireWorkspaceAccess(c, domainId);
    }

    const [link] = await db.insert(links).values({
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      targetType: data.targetType,
      targetId: data.targetId,
      linkType: data.linkType,
      direction: data.direction ?? null,
    }).returning();

    if (domainId) {
      await recordActivity({
        actor: user.name,
        action: "created",
        entityType: "link",
        entityId: link.id,
        changes: {
          sourceType: link.sourceType,
          sourceId: link.sourceId,
          targetType: link.targetType,
          targetId: link.targetId,
          linkType: link.linkType,
        },
        workspaceId: domainId,
      });

      await enqueueWebhooks({
        workspaceId: domainId,
        event: "link.created",
        entityType: "link",
        entityId: link.id,
        data: {
          sourceType: link.sourceType,
          sourceId: link.sourceId,
          targetType: link.targetType,
          targetId: link.targetId,
          linkType: link.linkType,
        },
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

// DELETE /:id — Delete a link (hard delete, links have no deletedAt)
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

    // Resolve workspace access from the source entity
    let domainId: string | null = null;
    if (existing.sourceType === "task") {
      const [task] = await db.select({ domainId: tasks.domainId })
        .from(tasks)
        .where(eq(tasks.id, existing.sourceId))
        .limit(1);
      domainId = task?.domainId ?? null;
    } else if (existing.sourceType === "project") {
      const [project] = await db.select({ domainId: projects.domainId })
        .from(projects)
        .where(eq(projects.id, existing.sourceId))
        .limit(1);
      domainId = project?.domainId ?? null;
    }

    if (domainId) {
      await requireWorkspaceAccess(c, domainId);
    }

    // Hard delete — junction rows with no deletedAt column
    await db.delete(links).where(eq(links.id, id));

    if (domainId) {
      await recordActivity({
        actor: user.name,
        action: "deleted",
        entityType: "link",
        entityId: id,
        changes: {
          sourceType: existing.sourceType,
          sourceId: existing.sourceId,
          targetType: existing.targetType,
          targetId: existing.targetId,
          linkType: existing.linkType,
        },
        workspaceId: domainId,
      });

      await enqueueWebhooks({
        workspaceId: domainId,
        event: "link.deleted",
        entityType: "link",
        entityId: id,
        data: {
          sourceType: existing.sourceType,
          sourceId: existing.sourceId,
          targetType: existing.targetType,
          targetId: existing.targetId,
          linkType: existing.linkType,
        },
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
