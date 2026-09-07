import { Hono } from "hono";
import { db, states, projects } from "@project-e/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { z } from "zod";

export const stateRoutes = new Hono();

const stateGroupEnum = z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]);

const createStateSchema = z.object({
  projectId: z.string().uuid("Invalid project id"),
  name: z.string().min(1, "Name is required"),
  color: z.string().optional().nullable(),
  group: stateGroupEnum.optional().default("unstarted"),
  sortOrder: z.number().int().optional(),
});

const updateStateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional().nullable(),
  group: stateGroupEnum.optional(),
  sortOrder: z.number().int().optional(),
});

// GET /api/states — List states filtered by projectId (exclude soft-deleted)
stateRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const projectId = url.searchParams.get("projectId") || url.searchParams.get("project_id");

    if (!projectId || !isUuid(projectId)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "projectId query parameter is required" } }, 400);
    }

    const [project] = await db.select({ id: projects.id, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    const items = await db.select()
      .from(states)
      .where(and(eq(states.projectId, projectId), isNull(states.deletedAt)))
      .orderBy(asc(states.sortOrder));

    return c.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[states] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list states" } }, 500);
  }
});

// POST /api/states — Create a state
stateRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createStateSchema.parse(body);

    const [project] = await db.select({ id: projects.id, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, data.projectId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(states)
        .where(eq(states.projectId, data.projectId));
      sortOrder = Number(maxOrder?.max || -1) + 1;
    }

    const [state] = await db.insert(states).values({
      name: data.name,
      color: data.color ?? null,
      group: data.group,
      sortOrder,
      projectId: data.projectId,
    }).returning();

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "state",
      entityId: state.id,
      changes: { name: state.name, group: state.group, projectId: data.projectId },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "state.created", entityType: "state", entityId: state.id, data: { name: state.name, group: state.group } });

    return c.json(state, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[states] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create state" } }, 500);
  }
});

// PATCH /api/states/:id — Update a state
stateRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateStateSchema.parse(body);

    const [existing] = await db.select()
      .from(states)
      .where(and(eq(states.id, id), isNull(states.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "State not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, existing.projectId))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.color !== undefined) updateValues.color = data.color;
    if (data.group !== undefined) updateValues.group = data.group;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(states)
      .set(updateValues)
      .where(eq(states.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "state",
      entityId: id,
      changes: { ...data, previousName: existing.name, projectId: existing.projectId },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "state.updated", entityType: "state", entityId: id, data: { ...data, previousName: existing.name } });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[states] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update state" } }, 500);
  }
});

// DELETE /api/states/:id — Soft-delete a state
stateRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [existing] = await db.select()
      .from(states)
      .where(and(eq(states.id, id), isNull(states.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "State not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, existing.projectId))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    await db.update(states)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(states.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "state",
      entityId: id,
      changes: { name: existing.name, projectId: existing.projectId },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "state.deleted", entityType: "state", entityId: id, data: { name: existing.name } });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[states] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete state" } }, 500);
  }
});
