import { Hono } from "hono";
import { db, cycles, tasks, projects } from "@project-e/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { z } from "zod";

export const cycleRoutes = new Hono();

const createCycleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  active: z.boolean().optional().default(false),
});

const updateCycleSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  active: z.boolean().optional(),
});

// GET / — List cycles for a project
cycleRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const projectId = c.req.param("projectId") || url.searchParams.get("project_id");

    if (!projectId || !isUuid(projectId)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "project_id is required" } }, 400);
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
      .from(cycles)
      .where(eq(cycles.projectId, projectId))
      .orderBy(asc(cycles.createdAt));

    return c.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[cycles] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list cycles" } }, 500);
  }
});

// POST / — Create a cycle
cycleRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createCycleSchema.parse(body);

    const projectId = c.req.param("projectId");
    if (!projectId || !isUuid(projectId)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "project_id is required in URL path" } }, 400);
    }

    const [project] = await db.select({ id: projects.id, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    const [cycle] = await db.insert(cycles).values({
      name: data.name,
      projectId,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      active: data.active,
    }).returning();

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "cycle",
      entityId: cycle.id,
      changes: { name: cycle.name, projectId },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "cycle.created", entityType: "cycle", entityId: cycle.id, data: { name: cycle.name, projectId } });

    return c.json(cycle, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[cycles] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create cycle" } }, 500);
  }
});

// GET /:id — Get a single cycle with its tasks
cycleRoutes.get("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [cycle] = await db.select()
      .from(cycles)
      .where(eq(cycles.id, id))
      .limit(1);

    if (!cycle) {
      return c.json({ error: { code: "NOT_FOUND", message: "Cycle not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, cycle.projectId))
      .limit(1);

    await requireWorkspaceAccess(c, project?.domainId || "");

    const cycleTasks = await db.select()
      .from(tasks)
      .where(and(eq(tasks.cycleId, id), isNull(tasks.deletedAt)))
      .orderBy(asc(tasks.order));

    return c.json({ ...cycle, tasks: cycleTasks });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[cycles] GET/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get cycle" } }, 500);
  }
});

// PATCH /:id — Update a cycle
cycleRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateCycleSchema.parse(body);

    const [existing] = await db.select()
      .from(cycles)
      .where(eq(cycles.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Cycle not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, existing.projectId))
      .limit(1);

    await requireWorkspaceAccess(c, project?.domainId || "");

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.startDate !== undefined) updateValues.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updateValues.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.active !== undefined) updateValues.active = data.active;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(cycles)
      .set(updateValues)
      .where(eq(cycles.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "cycle",
      entityId: id,
      changes: { ...data, previousName: existing.name },
      workspaceId: project?.domainId || "",
    });

    await enqueueWebhooks({ workspaceId: project?.domainId || "", event: "cycle.updated", entityType: "cycle", entityId: id, data: { ...data } });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[cycles] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update cycle" } }, 500);
  }
});

// DELETE /:id — Delete a cycle
cycleRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [existing] = await db.select()
      .from(cycles)
      .where(eq(cycles.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Cycle not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, existing.projectId))
      .limit(1);

    const workspaceId = project?.domainId || "";
    await requireWorkspaceAccess(c, workspaceId);

    // Clear cycleId on tasks belonging to this cycle
    await db.update(tasks)
      .set({ cycleId: null, updatedAt: new Date() })
      .where(eq(tasks.cycleId, id));

    await db.delete(cycles).where(eq(cycles.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "cycle",
      entityId: id,
      changes: { name: existing.name, projectId: existing.projectId },
      workspaceId,
    });

    await enqueueWebhooks({ workspaceId, event: "cycle.deleted", entityType: "cycle", entityId: id, data: { name: existing.name } });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[cycles] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete cycle" } }, 500);
  }
});

// POST /:id/tasks — Add a task to this cycle
cycleRoutes.post("/:id/tasks", async (c) => {
  try {
    const user = await requireAuth(c);
    const cycleId = c.req.param("id");
    if (!isUuid(cycleId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const { taskId } = z.object({ taskId: z.string().uuid("Invalid task id") }).parse(body);

    const [cycle] = await db.select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1);

    if (!cycle) {
      return c.json({ error: { code: "NOT_FOUND", message: "Cycle not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, cycle.projectId))
      .limit(1);

    await requireWorkspaceAccess(c, project?.domainId || "");

    await db.update(tasks)
      .set({ cycleId, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    await recordActivity({
      actor: user.name,
      action: "added_task",
      entityType: "cycle",
      entityId: cycleId,
      changes: { taskId },
      workspaceId: project?.domainId || "",
    });

    return c.json({ success: true }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[cycles] POST /:id/tasks error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to add task to cycle" } }, 500);
  }
});

// DELETE /:id/tasks/:taskId — Remove a task from this cycle
cycleRoutes.delete("/:id/tasks/:taskId", async (c) => {
  try {
    const user = await requireAuth(c);
    const cycleId = c.req.param("id");
    const taskId = c.req.param("taskId");
    if (!isUuid(cycleId) || !isUuid(taskId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [cycle] = await db.select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1);

    if (!cycle) {
      return c.json({ error: { code: "NOT_FOUND", message: "Cycle not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, cycle.projectId))
      .limit(1);

    await requireWorkspaceAccess(c, project?.domainId || "");

    await db.update(tasks)
      .set({ cycleId: null, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    await recordActivity({
      actor: user.name,
      action: "removed_task",
      entityType: "cycle",
      entityId: cycleId,
      changes: { taskId },
      workspaceId: project?.domainId || "",
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[cycles] DELETE /:id/tasks/:taskId error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove task from cycle" } }, 500);
  }
});
