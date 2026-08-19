import { Hono } from "hono";
import { db, statusDefinitions, tasks, projects } from "@project-e/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { z } from "zod";

export const statusRoutes = new Hono();

const statusCategoryEnum = z.enum(["todo", "in_progress", "done", "cancelled"]);
const MAX_STATUSES_PER_PROJECT = 15;

const createStatusSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9_]+$/, "Key must be lowercase letters, numbers and underscores")
    .optional(),
  label: z.string().min(1, "Label is required").max(60),
  category: statusCategoryEnum.optional().default("todo"),
  color: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9_]+$/, "Key must be lowercase letters, numbers and underscores")
    .optional(),
  label: z.string().min(1).max(60).optional(),
  category: statusCategoryEnum.optional(),
  color: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});

const reorderStatusSchema = z.object({
  orderedIds: z.array(z.string().uuid("Invalid status id")).min(1, "orderedIds is required"),
});

function slugifyKey(label: string): string {
  const key = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return key || "status";
}

async function getProject(c: any, projectId: string) {
  const [project] = await db
    .select({ id: projects.id, name: projects.name, domainId: projects.domainId })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);
  if (!project) {
    throw new AuthError("Project not found", 404, "NOT_FOUND");
  }
  await requireWorkspaceAccess(c, project.domainId);
  return project;
}

// GET /api/projects/:projectId/statuses — List statuses for a project
statusRoutes.get("/:projectId/statuses", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("projectId");
    if (!isUuid(projectId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const project = await getProject(c, projectId);

    const items = await db.select()
      .from(statusDefinitions)
      .where(eq(statusDefinitions.projectId, projectId))
      .orderBy(asc(statusDefinitions.sortOrder), asc(statusDefinitions.createdAt));

    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[statuses] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list statuses" } }, 500);
  }
});

// POST /api/projects/:projectId/statuses — Create a status
statusRoutes.post("/:projectId/statuses", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("projectId");
    if (!isUuid(projectId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = createStatusSchema.parse(body);
    const project = await getProject(c, projectId);

    // Cap the number of statuses per project
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(statusDefinitions)
      .where(eq(statusDefinitions.projectId, projectId));
    if (Number(countResult?.count || 0) >= MAX_STATUSES_PER_PROJECT) {
      return c.json({
        error: { code: "VALIDATION_ERROR", message: `Maximum of ${MAX_STATUSES_PER_PROJECT} statuses per project`, details: { limit: MAX_STATUSES_PER_PROJECT } },
      }, 400);
    }

    // Uniqueness: the DB has a unique (project_id, key) index; reject up front
    // with a friendly error instead of surfacing a constraint violation.
    const key = data.key ?? slugifyKey(data.label);
    const [existing] = await db.select({ id: statusDefinitions.id })
      .from(statusDefinitions)
      .where(and(eq(statusDefinitions.projectId, projectId), eq(statusDefinitions.key, key)))
      .limit(1);
    if (existing) {
      return c.json({ error: { code: "CONFLICT", message: `A status with key "${key}" already exists` } }, 409);
    }

    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(statusDefinitions)
        .where(eq(statusDefinitions.projectId, projectId));
      sortOrder = Number(maxOrder?.max ?? -1) + 1;
    }

    const [status] = await db.insert(statusDefinitions).values({
      projectId,
      key,
      label: data.label,
      category: data.category,
      color: data.color ?? null,
      sortOrder,
      isDefault: data.isDefault ?? false,
    }).returning();

    if (status.isDefault) {
      await db.update(statusDefinitions)
        .set({ isDefault: false })
        .where(and(eq(statusDefinitions.projectId, projectId), eq(statusDefinitions.isDefault, true)));
      await db.update(statusDefinitions)
        .set({ isDefault: true })
        .where(eq(statusDefinitions.id, status.id));
    }

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "status",
      entityId: status.id,
      changes: { key: status.key, label: status.label, category: status.category, projectId, projectName: project.name },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "status.created", entityType: "status", entityId: status.id, data: { key: status.key, label: status.label } });

    return c.json(status, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[statuses] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create status" } }, 500);
  }
});

// POST /api/projects/:projectId/statuses/reorder — Batch update sortOrder
statusRoutes.post("/:projectId/statuses/reorder", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("projectId");
    if (!isUuid(projectId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const { orderedIds } = reorderStatusSchema.parse(body);
    const project = await getProject(c, projectId);

    const existing = await db.select({ id: statusDefinitions.id })
      .from(statusDefinitions)
      .where(and(eq(statusDefinitions.projectId, projectId), eq(statusDefinitions.isDefault, false)));
    const validIds = new Set(existing.map((s) => s.id));
    if (!orderedIds.every((id) => validIds.has(id))) {
      return c.json({ error: { code: "NOT_FOUND", message: "One or more statuses not found in this project" } }, 404);
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.update(statusDefinitions)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(statusDefinitions.id, orderedIds[i]));
      }
    });

    await recordActivity({
      actor: user.name,
      action: "reordered",
      entityType: "status",
      entityId: orderedIds[0],
      changes: { orderedIds, projectId },
      workspaceId: project.domainId,
    });

    return c.json({ success: true, orderedIds });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[statuses] POST /reorder error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to reorder statuses" } }, 500);
  }
});

// PATCH /api/projects/:projectId/statuses/:id — Update a status
statusRoutes.patch("/:projectId/statuses/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("projectId");
    const id = c.req.param("id");
    if (!isUuid(projectId) || !isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateStatusSchema.parse(body);
    const project = await getProject(c, projectId);

    const [existing] = await db.select()
      .from(statusDefinitions)
      .where(and(eq(statusDefinitions.id, id), eq(statusDefinitions.projectId, projectId)))
      .limit(1);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Status not found" } }, 404);
    }

    const updateValues: Record<string, unknown> = {};
    if (data.key !== undefined) updateValues.key = data.key;
    if (data.label !== undefined) updateValues.label = data.label;
    if (data.category !== undefined) updateValues.category = data.category;
    if (data.color !== undefined) updateValues.color = data.color;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;
    if (data.isDefault !== undefined) updateValues.isDefault = data.isDefault;
    updateValues.updatedAt = new Date();

    // Uniqueness check on the (project_id, key) pair
    if (data.key !== undefined && data.key !== existing.key) {
      const [conflict] = await db.select({ id: statusDefinitions.id })
        .from(statusDefinitions)
        .where(and(eq(statusDefinitions.projectId, projectId), eq(statusDefinitions.key, data.key)))
        .limit(1);
      if (conflict && conflict.id !== id) {
        return c.json({ error: { code: "CONFLICT", message: `A status with key "${data.key}" already exists` } }, 409);
      }
    }

    if (data.isDefault === true) {
      // Only one default per project
      await db.update(statusDefinitions)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(statusDefinitions.projectId, projectId), eq(statusDefinitions.isDefault, true)));
    }

    const [updated] = await db.update(statusDefinitions)
      .set(updateValues)
      .where(eq(statusDefinitions.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "status",
      entityId: id,
      changes: { ...data, projectId, previousLabel: existing.label },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "status.updated", entityType: "status", entityId: id, data: { ...data, projectId } });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[statuses] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update status" } }, 500);
  }
});

// DELETE /api/projects/:projectId/statuses/:id — Delete a status
statusRoutes.delete("/:projectId/statuses/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("projectId");
    const id = c.req.param("id");
    if (!isUuid(projectId) || !isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const project = await getProject(c, projectId);

    const [existing] = await db.select()
      .from(statusDefinitions)
      .where(and(eq(statusDefinitions.id, id), eq(statusDefinitions.projectId, projectId)))
      .limit(1);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Status not found" } }, 404);
    }

    // Never allow removing the last status — a project needs at least one.
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(statusDefinitions)
      .where(eq(statusDefinitions.projectId, projectId));
    if (Number(countResult?.count || 0) <= 1) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "A project must have at least one status" } }, 400);
    }

    // Reassign tasks using this status to the project's default before deleting.
    const [defaultStatus] = await db.select()
      .from(statusDefinitions)
      .where(and(
        eq(statusDefinitions.projectId, projectId),
        eq(statusDefinitions.isDefault, true),
      ))
      .limit(1);
    const fallbackId = defaultStatus?.id ?? null;
    const tasksUsingStatus = await db.select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.statusId, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (tasksUsingStatus.length > 0) {
      if (!fallbackId) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Cannot delete this status: no default status exists to reassign its tasks" } }, 400);
      }
      await db.update(tasks)
        .set({ statusId: fallbackId, updatedAt: new Date() })
        .where(eq(tasks.statusId, id));
    }

    // If the default is being deleted, promote the first remaining status.
    if (existing.isDefault) {
      const [nextDefault] = await db.select({ id: statusDefinitions.id })
        .from(statusDefinitions)
        .where(and(
          eq(statusDefinitions.projectId, projectId),
          eq(statusDefinitions.isDefault, false),
        ))
        .orderBy(asc(statusDefinitions.sortOrder))
        .limit(1);
      if (nextDefault) {
        await db.update(statusDefinitions)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(statusDefinitions.id, nextDefault.id));
      }
    }

    await db.delete(statusDefinitions).where(eq(statusDefinitions.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "status",
      entityId: id,
      changes: { key: existing.key, label: existing.label, projectId, reassignedToDefault: tasksUsingStatus.length > 0 },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "status.deleted", entityType: "status", entityId: id, data: { key: existing.key } });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[statuses] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete status" } }, 500);
  }
});