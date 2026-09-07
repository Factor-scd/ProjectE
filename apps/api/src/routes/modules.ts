import { Hono } from "hono";
import { db, modules, tasks, projects } from "@project-e/db";
import { and, asc, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { z } from "zod";

export const moduleRoutes = new Hono();

const moduleStatusEnum = z.enum(["planned", "in_progress", "completed", "cancelled"]);

const createModuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  status: moduleStatusEnum.optional().default("planned"),
  startDate: z.string().datetime().optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const updateModuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: moduleStatusEnum.optional(),
  startDate: z.string().datetime().optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

// GET / — List modules for a project
moduleRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status");
    const sort = url.searchParams.get("sort") || "-created";

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

    const conditions: any[] = [
      eq(modules.projectId, projectId),
      isNull(modules.deletedAt),
    ];

    if (search) {
      conditions.push(ilike(modules.name, `%${search}%`));
    }
    if (status) {
      const statuses = status.split(",");
      conditions.push(inArray(modules.status, statuses as any));
    }

    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortField = sort.replace(/^-/, "");
    const sortColumns: Record<string, any> = {
      created: modules.createdAt,
      updated: modules.updatedAt,
      name: modules.name,
      status: modules.status,
      sort_order: modules.sortOrder,
      created_at: modules.createdAt,
      updated_at: modules.updatedAt,
    };
    const orderColumn = sortDir === "asc"
      ? asc(sortColumns[sortField] || modules.createdAt)
      : desc(sortColumns[sortField] || modules.createdAt);

    const [items, countResult] = await Promise.all([
      db.select()
        .from(modules)
        .where(and(...conditions))
        .orderBy(orderColumn)
        .limit(limit)
        .offset(offset || (page - 1) * limit),
      db.select({ count: sql<number>`count(*)` })
        .from(modules)
        .where(and(...conditions)),
    ]);

    const totalItems = Number(countResult[0]?.count || 0);

    return c.json({
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      page,
      perPage: limit,
      limit,
      offset: offset || (page - 1) * limit,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[modules] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list modules" } }, 500);
  }
});

// POST / — Create a module (projectId from URL path)
moduleRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createModuleSchema.parse(body);

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

    const [mod] = await db.insert(modules).values({
      name: data.name,
      description: data.description ?? null,
      projectId,
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      sortOrder: data.sortOrder ?? 0,
    }).returning();

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "module",
      entityId: mod.id,
      changes: { name: mod.name, status: mod.status, projectId },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "module.created", entityType: "module", entityId: mod.id, data: { name: mod.name, projectId } });

    return c.json(mod, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[modules] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create module" } }, 500);
  }
});

// GET /:id — Get a single module
moduleRoutes.get("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [mod] = await db.select()
      .from(modules)
      .where(and(eq(modules.id, id), isNull(modules.deletedAt)))
      .limit(1);

    if (!mod) {
      return c.json({ error: { code: "NOT_FOUND", message: "Module not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, mod.projectId))
      .limit(1);

    await requireWorkspaceAccess(c, project?.domainId || "");

    const moduleTasks = await db.select()
      .from(tasks)
      .where(and(eq(tasks.moduleId, id), isNull(tasks.deletedAt)))
      .orderBy(asc(tasks.order));

    return c.json({ ...mod, tasks: moduleTasks });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[modules] GET/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get module" } }, 500);
  }
});

// PATCH /:id — Update a module
moduleRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateModuleSchema.parse(body);

    const [existing] = await db.select()
      .from(modules)
      .where(and(eq(modules.id, id), isNull(modules.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Module not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, existing.projectId))
      .limit(1);

    await requireWorkspaceAccess(c, project?.domainId || "");

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.startDate !== undefined) updateValues.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.targetDate !== undefined) updateValues.targetDate = data.targetDate ? new Date(data.targetDate) : null;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(modules)
      .set(updateValues)
      .where(eq(modules.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "module",
      entityId: id,
      changes: { ...data, previousName: existing.name },
      workspaceId: project?.domainId || "",
    });

    await enqueueWebhooks({ workspaceId: project?.domainId || "", event: "module.updated", entityType: "module", entityId: id, data: { ...data } });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[modules] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update module" } }, 500);
  }
});

// DELETE /:id — Soft delete a module (also clears moduleId on tasks)
moduleRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [existing] = await db.select()
      .from(modules)
      .where(and(eq(modules.id, id), isNull(modules.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Module not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, existing.projectId))
      .limit(1);

    const workspaceId = project?.domainId || "";
    await requireWorkspaceAccess(c, workspaceId);

    // Clear moduleId on tasks belonging to this module
    await db.update(tasks)
      .set({ moduleId: null, updatedAt: new Date() })
      .where(eq(tasks.moduleId, id));

    await db.update(modules)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(modules.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "module",
      entityId: id,
      changes: { name: existing.name, projectId: existing.projectId },
      workspaceId,
    });

    await enqueueWebhooks({ workspaceId, event: "module.deleted", entityType: "module", entityId: id, data: { name: existing.name } });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[modules] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete module" } }, 500);
  }
});

// POST /:id/tasks — Add a task to this module
moduleRoutes.post("/:id/tasks", async (c) => {
  try {
    const user = await requireAuth(c);
    const moduleId = c.req.param("id");
    if (!isUuid(moduleId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const { taskId } = z.object({ taskId: z.string().uuid("Invalid task id") }).parse(body);

    const [mod] = await db.select()
      .from(modules)
      .where(and(eq(modules.id, moduleId), isNull(modules.deletedAt)))
      .limit(1);

    if (!mod) {
      return c.json({ error: { code: "NOT_FOUND", message: "Module not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, mod.projectId))
      .limit(1);

    await requireWorkspaceAccess(c, project?.domainId || "");

    const [task] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    // Single-module constraint: if the task is already in another module, remove it first
    if (task.moduleId && task.moduleId !== moduleId) {
      await db.update(tasks)
        .set({ moduleId: null, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));
    }

    // Assign task to this module
    await db.update(tasks)
      .set({ moduleId, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    await recordActivity({
      actor: user.name,
      action: "added_task",
      entityType: "module",
      entityId: moduleId,
      changes: { taskId, taskTitle: task.title, previousModuleId: task.moduleId },
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
    console.error("[modules] POST /:id/tasks error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to add task to module" } }, 500);
  }
});

// DELETE /:id/tasks/:taskId — Remove a task from this module
moduleRoutes.delete("/:id/tasks/:taskId", async (c) => {
  try {
    const user = await requireAuth(c);
    const moduleId = c.req.param("id");
    const taskId = c.req.param("taskId");
    if (!isUuid(moduleId) || !isUuid(taskId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [mod] = await db.select()
      .from(modules)
      .where(and(eq(modules.id, moduleId), isNull(modules.deletedAt)))
      .limit(1);

    if (!mod) {
      return c.json({ error: { code: "NOT_FOUND", message: "Module not found" } }, 404);
    }

    const [project] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, mod.projectId))
      .limit(1);

    await requireWorkspaceAccess(c, project?.domainId || "");

    const [task] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    if (task.moduleId !== moduleId) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Task is not in this module" } }, 400);
    }

    await db.update(tasks)
      .set({ moduleId: null, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    await recordActivity({
      actor: user.name,
      action: "removed_task",
      entityType: "module",
      entityId: moduleId,
      changes: { taskId, taskTitle: task.title },
      workspaceId: project?.domainId || "",
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[modules] DELETE /:id/tasks/:taskId error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove task from module" } }, 500);
  }
});
