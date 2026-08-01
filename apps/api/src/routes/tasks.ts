import { Hono } from "hono";
import { db, tasks, taskTags, tags as tagsTable, taskDependencies, activityFeed } from "@project-e/db";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { requireAuth, createErrorResponse, resolveActiveDomain, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const taskRoutes = new Hono();

const taskStatusEnum = z.enum(["todo", "in_progress", "done", "cancelled"]);
const taskPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  status: taskStatusEnum.optional().default("todo"),
  priority: taskPriorityEnum.optional().default("medium"),
  domain: z.string().min(1, "Domain is required"),
  projectId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  order: z.number().int().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  recurrenceRule: z.string().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  projectId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  order: z.number().int().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  recurrenceRule: z.string().optional().nullable(),
});

// GET /api/tasks — List tasks with filtering, sorting, pagination
taskRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "50")));
    const filter = url.searchParams.get("filter") || undefined;
    const sort = url.searchParams.get("sort") || "-created";
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const tag = url.searchParams.get("tag");
    const search = url.searchParams.get("search");
    const parentId = url.searchParams.get("parent_id");
    const projectId = url.searchParams.get("project_id");
    const sectionId = url.searchParams.get("section_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const order = url.searchParams.get("order") || "asc";

    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    // Build conditions
    const conditions: any[] = [
      eq(tasks.domainId, domainId),
      isNull(tasks.deletedAt),
    ];

    if (status) {
      const statuses = status.split(",");
      conditions.push(inArray(tasks.status, statuses as any));
    }
    if (priority) {
      const priorities = priority.split(",");
      conditions.push(inArray(tasks.priority, priorities as any));
    }
    if (search) {
      conditions.push(ilike(tasks.title, `%${search}%`));
    }
    if (filter) {
      conditions.push(
        or(
          ilike(tasks.title, `%${filter}%`),
          ilike(tasks.description, `%${filter}%`),
        )!
      );
    }
    if (parentId === "null") {
      conditions.push(isNull(tasks.parentId));
    } else if (parentId) {
      conditions.push(eq(tasks.parentId, parentId));
    }
    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId));
    }
    if (sectionId) {
      conditions.push(eq(tasks.sectionId, sectionId));
    }

    // Build order
    const orderFn = order === "desc" ? desc : asc;
    const sortField = sort.replace(/^-/, "");
    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortColumns: Record<string, any> = {
      created: tasks.createdAt,
      updated: tasks.updatedAt,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      order: tasks.order,
      due_date: tasks.dueDate,
      created_at: tasks.createdAt,
      updated_at: tasks.updatedAt,
    };
    const orderColumn = sortDir === "asc"
      ? asc(sortColumns[sortField] || tasks.createdAt)
      : desc(sortColumns[sortField] || tasks.createdAt);

    const [items, countResult] = await Promise.all([
      db.select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(orderColumn)
        .limit(limit || perPage)
        .offset(offset || (page - 1) * perPage),
      db.select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(and(...conditions)),
    ]);

    const totalItems = Number(countResult[0]?.count || 0);

    // If tag filter is specified, filter in-memory
    let filteredItems = items;
    if (tag) {
      const tagIds = tag.split(",");
      const taskTagRows = await db.select({ taskId: taskTags.taskId })
        .from(taskTags)
        .where(inArray(taskTags.tagId, tagIds));
      const matchingTaskIds = new Set(taskTagRows.map(r => r.taskId));
      filteredItems = items.filter(t => matchingTaskIds.has(t.id));
    }

    // Fetch tags for all tasks
    let taskTagMap = new Map<string, { id: string; name: string; color: string | null }[]>();
    if (filteredItems.length > 0) {
      const taskIds = filteredItems.map(t => t.id);
      const tagRows = await db.select({
        taskId: taskTags.taskId,
        id: tagsTable.id,
        name: tagsTable.name,
        color: tagsTable.color,
      })
        .from(taskTags)
        .innerJoin(tagsTable, eq(taskTags.tagId, tagsTable.id))
        .where(inArray(taskTags.taskId, taskIds));

      for (const row of tagRows) {
        if (!taskTagMap.has(row.taskId)) taskTagMap.set(row.taskId, []);
        taskTagMap.get(row.taskId)!.push({ id: row.id, name: row.name, color: row.color });
      }
    }

    const itemsWithTags = filteredItems.map(t => ({
      ...t,
      tags: taskTagMap.get(t.id) || [],
    }));

    return c.json({
      items: itemsWithTags,
      totalItems,
      totalPages: Math.ceil(totalItems / (limit || perPage)),
      page,
      perPage: limit || perPage,
      limit: limit || perPage,
      offset: offset || (page - 1) * perPage,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[tasks] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list tasks" } }, 500);
  }
});

// POST /api/tasks — Create a task
taskRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createTaskSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    // Cycle detection for parentId (subtask)
    if (data.parentId) {
      const [parent] = await db.select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, data.parentId), isNull(tasks.deletedAt)))
        .limit(1);
      if (!parent) {
        return c.json({ error: { code: "NOT_FOUND", message: "Parent task not found" } }, 404);
      }
    }

    const [task] = await db.insert(tasks).values({
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      domainId: data.domain,
      projectId: data.projectId ?? null,
      sectionId: data.sectionId ?? null,
      parentId: data.parentId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      order: data.order ?? 0,
      customFields: data.customFields ?? {},
      recurrenceRule: data.recurrenceRule ?? null,
    }).returning();

    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(taskTags).values(
        data.tagIds.map(tagId => ({ taskId: task.id, tagId }))
      );
    }

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "task",
      entityId: task.id,
      changes: { title: task.title, status: task.status, priority: task.priority },
      workspaceId: data.domain,
    });

    return c.json(task, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[tasks] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create task" } }, 500);
  }
});

// GET /api/tasks/:id — Get a single task with subtasks + dependencies
taskRoutes.get("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const [task] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    // Fetch subtasks
    const subtasks = await db.select()
      .from(tasks)
      .where(and(eq(tasks.parentId, id), isNull(tasks.deletedAt)))
      .orderBy(asc(tasks.order));

    // Fetch tags
    const tagRows = await db.select({
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
    })
      .from(taskTags)
      .innerJoin(tagsTable, eq(taskTags.tagId, tagsTable.id))
      .where(eq(taskTags.taskId, id));

    // Fetch dependencies (tasks this task depends on)
    const depRows = await db.select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
    })
      .from(taskDependencies)
      .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
      .where(and(eq(taskDependencies.taskId, id), isNull(tasks.deletedAt)));

    // Fetch dependents (tasks that depend on this task)
    const dependentRows = await db.select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
    })
      .from(taskDependencies)
      .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
      .where(and(eq(taskDependencies.dependsOnTaskId, id), isNull(tasks.deletedAt)));

    return c.json({
      ...task,
      subtasks,
      tags: tagRows,
      dependencies: depRows,
      dependents: dependentRows,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[tasks] GET/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get task" } }, 500);
  }
});

// PATCH /api/tasks/:id — Update a task
taskRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateTaskSchema.parse(body);

    const [existing] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    // Cycle detection for parentId
    if (data.parentId && data.parentId === id) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "A task cannot be its own parent" } }, 400);
    }
    if (data.parentId) {
      let currentParentId: string | null = data.parentId;
      const visited = new Set<string>([id]);
      while (currentParentId) {
        if (visited.has(currentParentId)) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "Circular parent reference detected" } }, 400);
        }
        visited.add(currentParentId);
        const [parent] = await db.select({ parentId: tasks.parentId })
          .from(tasks)
          .where(eq(tasks.id, currentParentId))
          .limit(1);
        currentParentId = parent?.parentId ?? null;
      }
    }

    const updateValues: Record<string, unknown> = {};
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.priority !== undefined) updateValues.priority = data.priority;
    if (data.projectId !== undefined) updateValues.projectId = data.projectId;
    if (data.sectionId !== undefined) updateValues.sectionId = data.sectionId;
    if (data.parentId !== undefined) updateValues.parentId = data.parentId;
    if (data.dueDate !== undefined) updateValues.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.estimatedMinutes !== undefined) updateValues.estimatedMinutes = data.estimatedMinutes;
    if (data.order !== undefined) updateValues.order = data.order;
    if (data.customFields !== undefined) updateValues.customFields = data.customFields;
    if (data.recurrenceRule !== undefined) updateValues.recurrenceRule = data.recurrenceRule;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "task",
      entityId: id,
      changes: { ...data, previousStatus: existing.status },
      workspaceId: existing.domainId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[tasks] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update task" } }, 500);
  }
});

// DELETE /api/tasks/:id — Soft delete a task
taskRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const [existing] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await db.update(tasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "task",
      entityId: id,
      changes: { title: existing.title },
      workspaceId: existing.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[tasks] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete task" } }, 500);
  }
});

// POST /api/tasks/:id/status — Change task status (Kanban drag)
taskRoutes.post("/:id/status", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const { status: newStatus } = z.object({
      status: taskStatusEnum,
    }).parse(body);

    const [existing] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    const updateValues: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };
    if (newStatus === "done") {
      updateValues.completedAt = new Date();
    }

    const [updated] = await db.update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: newStatus === "done" ? "completed" : "updated",
      entityType: "task",
      entityId: id,
      changes: { previousStatus: existing.status, newStatus },
      workspaceId: existing.domainId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[tasks] POST /:id/status error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update task status" } }, 500);
  }
});

// GET /api/tasks/:id/history — Status change log (from activity feed)
taskRoutes.get("/:id/history", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const history = await db.select()
      .from(activityFeed)
      .where(and(
        eq(activityFeed.entityId, id),
        eq(activityFeed.entityType, "task"),
      ))
      .orderBy(desc(activityFeed.createdAt))
      .limit(100);

    return c.json({ items: history, totalItems: history.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[tasks] GET /:id/history error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get task history" } }, 500);
  }
});

// GET /api/tasks/:id/comments — Comment thread (stored in activity feed as entityType=comment)
taskRoutes.get("/:id/comments", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const comments = await db.select()
      .from(activityFeed)
      .where(and(
        eq(activityFeed.entityId, id),
        eq(activityFeed.entityType, "comment"),
      ))
      .orderBy(asc(activityFeed.createdAt));

    return c.json({ items: comments, totalItems: comments.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[tasks] GET /:id/comments error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get comments" } }, 500);
  }
});

// POST /api/tasks/:id/comments — Add a comment
taskRoutes.post("/:id/comments", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const { content } = z.object({
      content: z.string().min(1, "Content is required"),
    }).parse(body);

    // Verify task exists
    const [task] = await db.select({ id: tasks.id, domainId: tasks.domainId })
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await recordActivity({
      actor: user.name,
      action: "commented",
      entityType: "comment",
      entityId: id,
      changes: { content },
      workspaceId: task.domainId,
    });

    return c.json({ success: true }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[tasks] POST /:id/comments error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to add comment" } }, 500);
  }
});

// GET /api/tasks/:id/attachments — File attachments metadata
taskRoutes.get("/:id/attachments", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    // Attachments are stored in activity feed with entityType=attachment
    const attachments = await db.select()
      .from(activityFeed)
      .where(and(
        eq(activityFeed.entityId, id),
        eq(activityFeed.entityType, "attachment"),
      ))
      .orderBy(desc(activityFeed.createdAt));

    return c.json({ items: attachments, totalItems: attachments.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[tasks] GET /:id/attachments error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get attachments" } }, 500);
  }
});
