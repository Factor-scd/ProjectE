import { Hono } from "hono";
import { db, tasks, taskTags, tags as tagsTable, taskDependencies, activityFeed, scheduledJobs, projects, sections, statusDefinitions } from "@project-e/db";
import { and, asc, desc, eq, exists, getTableColumns, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, createErrorResponse, resolveActiveDomain, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { notifyWorkspaceOwner } from "../lib/notify";
import { evaluateAutomations } from "../lib/automation-engine";
import { z } from "zod";
import { RRule } from "rrule";

export const taskRoutes = new Hono();

const STATUS_CATEGORIES = ["todo", "in_progress", "done", "cancelled"] as const;
const taskPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

// Columns of the status_definitions table flattened onto a task row as `status`
// (null when the task has no status or its status was deleted).
const statusColumns = {
  id: statusDefinitions.id,
  projectId: statusDefinitions.projectId,
  key: statusDefinitions.key,
  label: statusDefinitions.label,
  category: statusDefinitions.category,
  color: statusDefinitions.color,
  sortOrder: statusDefinitions.sortOrder,
  isDefault: statusDefinitions.isDefault,
};

type StatusRow = typeof statusDefinitions.$inferSelect;

async function getProjectStatuses(projectId: string | null | undefined): Promise<StatusRow[]> {
  if (!projectId) return [];
  return db.select().from(statusDefinitions)
    .where(eq(statusDefinitions.projectId, projectId))
    .orderBy(asc(statusDefinitions.sortOrder), asc(statusDefinitions.createdAt));
}

async function getDefaultStatusId(projectId: string | null | undefined): Promise<string | null> {
  if (!projectId) return null;
  const statuses = await getProjectStatuses(projectId);
  return statuses.find((s) => s.isDefault)?.id ?? statuses[0]?.id ?? null;
}

async function getStatusCategory(statusId: string | null | undefined): Promise<string | null> {
  if (!statusId) return null;
  const [status] = await db.select({ category: statusDefinitions.category })
    .from(statusDefinitions)
    .where(eq(statusDefinitions.id, statusId))
    .limit(1);
  return status?.category ?? null;
}

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  statusId: z.string().uuid().optional().nullable(),
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
  statusId: z.string().uuid().optional().nullable(),
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

// ── Recurring tasks ────────────────────────────────────────────────────────────────
// Keeps scheduled_jobs in sync with a task's recurrence_rule so the worker's
// recurring_spawn handler has work to do. A malformed rule must never fail the
// create/update — fall back to +1 day and log.

function computeNextOccurrenceAt(recurrenceRule: string): Date {
  try {
    const rule = RRule.fromString(recurrenceRule);
    const next = rule.after(new Date());
    if (next) return next;
  } catch {
    // fall through to fallback
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

async function syncScheduledJob(taskId: string, recurrenceRule: string | null): Promise<void> {
  try {
    await db.delete(scheduledJobs).where(and(eq(scheduledJobs.entityType, "task"), eq(scheduledJobs.entityId, taskId)));
    if (recurrenceRule) {
      await db.insert(scheduledJobs).values({
        entityType: "task",
        entityId: taskId,
        recurrenceRule,
        nextOccurrenceAt: computeNextOccurrenceAt(recurrenceRule),
      });
    }
  } catch (error) {
    console.error(`[tasks] Failed to sync scheduled job for task ${taskId}:`, error);
  }
}

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

    await requireWorkspaceAccess(c, domainId);

    // Build conditions
    const conditions: any[] = [
      eq(tasks.domainId, domainId),
      isNull(tasks.deletedAt),
    ];

    if (status) {
      // Filter by category name (todo/in_progress/...) or by status definition
      // id (uuid). Category filters match every project's statuses in that
      // category; id filters target one specific project status.
      const values = status.split(",").map((v) => v.trim()).filter(Boolean);
      const categoryValues = values.filter((v) => (STATUS_CATEGORIES as readonly string[]).includes(v));
      const idValues = values.filter((v) => isUuid(v));
      const statusConds: any[] = [];
      if (categoryValues.length > 0) statusConds.push(inArray(statusDefinitions.category, categoryValues as any));
      if (idValues.length > 0) statusConds.push(inArray(statusDefinitions.id, idValues));
      if (statusConds.length > 0) conditions.push(or(...statusConds));
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
    // Tag filter applied in SQL (EXISTS on the junction table) so it runs over
    // the full dataset before pagination — filtering in-memory after fetching a
    // page would miss tasks beyond the limit and report a wrong totalItems.
    if (tag) {
      const tagIds = tag.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagIds.length > 0) {
        conditions.push(
          exists(
            db.select({ one: sql`1` })
              .from(taskTags)
              .where(and(eq(taskTags.taskId, tasks.id), inArray(taskTags.tagId, tagIds)))
          )
        );
      }
    }

    // Build order
    const orderFn = order === "desc" ? desc : asc;
    const sortField = sort.replace(/^-/, "");
    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortColumns: Record<string, any> = {
      created: tasks.createdAt,
      updated: tasks.updatedAt,
      title: tasks.title,
      status: statusDefinitions.sortOrder,
      priority: tasks.priority,
      order: tasks.order,
      due_date: tasks.dueDate,
      created_at: tasks.createdAt,
      updated_at: tasks.updatedAt,
    };
    const orderColumn = sortDir === "asc"
      ? asc(sortColumns[sortField] || tasks.createdAt)
      : desc(sortColumns[sortField] || tasks.createdAt);

    const taskColumns = getTableColumns(tasks);
    const [items, countResult] = await Promise.all([
      db.select({ ...taskColumns, status: statusColumns })
        .from(tasks)
        .leftJoin(statusDefinitions, eq(tasks.statusId, statusDefinitions.id))
        .where(and(...conditions))
        .orderBy(orderColumn)
        .limit(limit || perPage)
        .offset(offset || (page - 1) * perPage),
      db.select({ count: sql<number>`count(*)` })
        .from(tasks)
        .leftJoin(statusDefinitions, eq(tasks.statusId, statusDefinitions.id))
        .where(and(...conditions)),
    ]);

    const totalItems = Number(countResult[0]?.count || 0);

    // Fetch tags for all tasks
    let taskTagMap = new Map<string, { id: string; name: string; color: string | null }[]>();
    if (items.length > 0) {
      const taskIds = items.map(t => t.id);
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

    const itemsWithTags = items.map(t => ({
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

    await requireWorkspaceAccess(c, data.domain);

    // Cycle detection for parentId (subtask)
    if (data.parentId) {
      const [parent] = await db.select({ id: tasks.id, domainId: tasks.domainId })
        .from(tasks)
        .where(and(eq(tasks.id, data.parentId), isNull(tasks.deletedAt)))
        .limit(1);
      if (!parent) {
        return c.json({ error: { code: "NOT_FOUND", message: "Parent task not found" } }, 404);
      }
      if (parent.domainId !== data.domain) {
        return c.json({ error: { code: "FORBIDDEN", message: "Parent task does not belong to this workspace" } }, 403);
      }
    }

    // A task's project/section must belong to the same workspace; otherwise a
    // task can be linked into another domain's project and leak across workspaces.
    if (data.projectId) {
      const [project] = await db.select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, data.projectId), isNull(projects.deletedAt)))
        .limit(1);
      if (!project) {
        return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
      }
      const [projectDomain] = await db.select({ domainId: projects.domainId }).from(projects).where(eq(projects.id, data.projectId)).limit(1);
      if (!projectDomain || projectDomain.domainId !== data.domain) {
        return c.json({ error: { code: "FORBIDDEN", message: "Project does not belong to this workspace" } }, 403);
      }
    }

    if (data.sectionId) {
      const [section] = await db.select({ id: sections.id, projectId: sections.projectId })
        .from(sections)
        .where(eq(sections.id, data.sectionId))
        .limit(1);
      if (!section) {
        return c.json({ error: { code: "NOT_FOUND", message: "Section not found" } }, 404);
      }
      if (data.projectId && section.projectId !== data.projectId) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Section does not belong to the selected project" } }, 400);
      }
      if (section.projectId) {
        const [sectionProject] = await db.select({ domainId: projects.domainId }).from(projects).where(eq(projects.id, section.projectId)).limit(1);
        if (!sectionProject || sectionProject.domainId !== data.domain) {
          return c.json({ error: { code: "FORBIDDEN", message: "Section does not belong to this workspace" } }, 403);
        }
      }
    }

    // Resolve the task's status definition. A status is per-project, so it may
    // only be set when the task belongs to a project, and the status must belong
    // to that project. When omitted, the project's default status is used.
    let statusId = data.statusId ?? null;
    if (data.statusId) {
      const [status] = await db.select({ id: statusDefinitions.id, projectId: statusDefinitions.projectId })
        .from(statusDefinitions)
        .where(eq(statusDefinitions.id, data.statusId))
        .limit(1);
      if (!status) {
        return c.json({ error: { code: "NOT_FOUND", message: "Status not found" } }, 404);
      }
      if (!data.projectId || status.projectId !== data.projectId) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Status does not belong to the selected project" } }, 400);
      }
    } else if (data.projectId) {
      statusId = await getDefaultStatusId(data.projectId);
    }
    const statusCategory = await getStatusCategory(statusId);

    const [task] = await db.insert(tasks).values({
      title: data.title,
      description: data.description ?? null,
      statusId,
      priority: data.priority,
      domainId: data.domain,
      projectId: data.projectId ?? null,
      sectionId: data.sectionId ?? null,
      parentId: data.parentId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      completedAt: statusCategory === "done" ? new Date() : null,
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
      changes: { title: task.title, statusId: task.statusId, priority: task.priority },
      workspaceId: data.domain,
    });

    await enqueueWebhooks({ workspaceId: data.domain, event: "task.created", entityType: "task", entityId: task.id, data: { title: task.title } });

    // MVP single-user: the workspace owner is the only assignee, so a new task
    // is treated as an assignment to them.
    try {
      await notifyWorkspaceOwner({
        workspaceId: data.domain,
        type: "assignment",
        title: "New task assigned to you",
        body: `"${task.title}" was created${user.name ? ` by ${user.name}` : ""}`,
        entityType: "task",
        entityId: task.id,
      });
    } catch (notifyError) {
      console.error(`[tasks] Failed to create assignment notification for task ${task.id}:`, notifyError);
    }

    if (data.recurrenceRule) {
      await syncScheduledJob(task.id, data.recurrenceRule);
    }

    // Fire "task created" automation rules (e.g. set a default priority/label).
    await evaluateAutomations({
      projectId: task.projectId,
      triggerType: "task_created",
      entity: task,
      changes: {},
      actor: user.name,
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

const reorderTasksSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1, "orderedIds is required"),
  domain: z.string().uuid().optional(),
});

// POST /api/tasks/reorder — Persist Kanban board column ordering
taskRoutes.post("/reorder", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const { orderedIds, domain } = reorderTasksSchema.parse(body);

    // Resolve the workspace: explicit domain, or the first task's domain
    let workspaceId = domain;
    if (!workspaceId) {
      const [firstTask] = await db.select({ domainId: tasks.domainId })
        .from(tasks)
        .where(eq(tasks.id, orderedIds[0]))
        .limit(1);
      if (!firstTask) {
        return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
      }
      workspaceId = firstTask.domainId;
    }
    await requireWorkspaceAccess(c, workspaceId);

    // Verify every task exists in this workspace and is not soft-deleted
    const existing = await db.select({ id: tasks.id })
      .from(tasks)
      .where(and(inArray(tasks.id, orderedIds), eq(tasks.domainId, workspaceId), isNull(tasks.deletedAt)));
    if (existing.length !== orderedIds.length) {
      return c.json({ error: { code: "NOT_FOUND", message: "One or more tasks not found" } }, 404);
    }

    // Update each task's order to its index in a transaction
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.update(tasks)
          .set({ order: i, updatedAt: new Date() })
          .where(eq(tasks.id, orderedIds[i]));
      }
    });

    await recordActivity({
      actor: user.name,
      action: "reordered",
      entityType: "task",
      entityId: orderedIds[0],
      changes: { orderedIds },
      workspaceId,
    });

    return c.json({ success: true, orderedIds });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[tasks] POST /reorder error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to reorder tasks" } }, 500);
  }
});

// GET /api/tasks/:id — Get a single task with subtasks + dependencies
taskRoutes.get("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const taskColumns = getTableColumns(tasks);
    const [task] = await db.select({ ...taskColumns, status: statusColumns })
      .from(tasks)
      .leftJoin(statusDefinitions, eq(tasks.statusId, statusDefinitions.id))
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, task.domainId);

    // Fetch subtasks
    const subtasks = await db.select({ ...taskColumns, status: statusColumns })
      .from(tasks)
      .leftJoin(statusDefinitions, eq(tasks.statusId, statusDefinitions.id))
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
      statusId: tasks.statusId,
      status: statusColumns,
    })
      .from(taskDependencies)
      .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
      .leftJoin(statusDefinitions, eq(tasks.statusId, statusDefinitions.id))
      .where(and(eq(taskDependencies.taskId, id), isNull(tasks.deletedAt)));

    // Fetch dependents (tasks that depend on this task)
    const dependentRows = await db.select({
      id: tasks.id,
      title: tasks.title,
      statusId: tasks.statusId,
      status: statusColumns,
    })
      .from(taskDependencies)
      .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
      .leftJoin(statusDefinitions, eq(tasks.statusId, statusDefinitions.id))
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
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateTaskSchema.parse(body);

    const [existing] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

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
    if (data.priority !== undefined) updateValues.priority = data.priority;
    if (data.projectId !== undefined) updateValues.projectId = data.projectId;
    if (data.sectionId !== undefined) updateValues.sectionId = data.sectionId;
    if (data.parentId !== undefined) updateValues.parentId = data.parentId;
    if (data.dueDate !== undefined) updateValues.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.estimatedMinutes !== undefined) updateValues.estimatedMinutes = data.estimatedMinutes;
    if (data.order !== undefined) updateValues.order = data.order;
    if (data.customFields !== undefined) updateValues.customFields = data.customFields;
    if (data.recurrenceRule !== undefined) updateValues.recurrenceRule = data.recurrenceRule;

    // Status change: validate the status belongs to the task's project and keep
    // completedAt in sync with the "done" category.
    let newStatusLabel: string | null = null;
    if (data.statusId !== undefined) {
      const statusId = data.statusId ?? null;
      if (statusId) {
        const finalProjectId = (data.projectId !== undefined ? data.projectId : existing.projectId) ?? null;
        const [status] = await db.select({ id: statusDefinitions.id, projectId: statusDefinitions.projectId, category: statusDefinitions.category, label: statusDefinitions.label })
          .from(statusDefinitions)
          .where(eq(statusDefinitions.id, statusId))
          .limit(1);
        if (!status) {
          return c.json({ error: { code: "NOT_FOUND", message: "Status not found" } }, 404);
        }
        if (!finalProjectId || status.projectId !== finalProjectId) {
          return c.json({ error: { code: "VALIDATION_ERROR", message: "Status does not belong to the task's project" } }, 400);
        }
        updateValues.completedAt = status.category === "done" ? new Date() : null;
        newStatusLabel = status.label;
      } else {
        updateValues.completedAt = null;
      }
      updateValues.statusId = statusId;
    }
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
      changes: { ...data, previousStatusId: existing.statusId },
      workspaceId: existing.domainId,
    });

    await enqueueWebhooks({ workspaceId: existing.domainId, event: "task.updated", entityType: "task", entityId: id, data: { ...data, previousStatusId: existing.statusId } });

    // Notify on actual status changes only (not unrelated field updates).
    if (data.statusId !== undefined && data.statusId !== existing.statusId) {
      try {
        await notifyWorkspaceOwner({
          workspaceId: existing.domainId,
          type: "status_change",
          title: `Task moved to ${newStatusLabel ?? "a new status"}`,
          body: `"${updated.title}" ${newStatusLabel ? `is now ${newStatusLabel}` : "changed status"}`,
          entityType: "task",
          entityId: id,
        });
      } catch (notifyError) {
        console.error(`[tasks] Failed to create status-change notification for task ${id}:`, notifyError);
      }
    }

    if (data.recurrenceRule !== undefined) {
      await syncScheduledJob(id, data.recurrenceRule);
    }

    // Fire "status changed" automation rules when the status actually moved
    // (e.g. when a status changes to Done, add a "shipped" label).
    if (data.statusId !== undefined && data.statusId !== existing.statusId) {
      await evaluateAutomations({
        projectId: updated.projectId,
        triggerType: "task_status_changed",
        entity: updated,
        changes: { previousStatusId: existing.statusId },
        actor: user.name,
      });
    }

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
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [existing] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

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

    await enqueueWebhooks({ workspaceId: existing.domainId, event: "task.deleted", entityType: "task", entityId: id, data: { title: existing.title } });

    // Stop recurring spawns for a deleted task
    await syncScheduledJob(id, null);

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[tasks] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete task" } }, 500);
  }
});

// POST /api/tasks/:id/tags — Assign a tag to a task
taskRoutes.post("/:id/tags", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const { tagId } = z.object({ tagId: z.string().uuid("Invalid tag id") }).parse(body);

    const [task] = await db.select({ id: tasks.id, domainId: tasks.domainId })
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);
    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, task.domainId);

    const [tag] = await db.select({ id: tagsTable.id, name: tagsTable.name })
      .from(tagsTable)
      .where(eq(tagsTable.id, tagId))
      .limit(1);
    if (!tag) {
      return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);
    }

    // Junction table has a composite PK — ignore re-assigns instead of erroring
    await db.insert(taskTags).values({ taskId: id, tagId }).onConflictDoNothing();

    await recordActivity({
      actor: user.name,
      action: "tagged",
      entityType: "task",
      entityId: id,
      changes: { tagId, tagName: tag.name },
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
    console.error("[tasks] POST /:id/tags error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to assign tag" } }, 500);
  }
});

// DELETE /api/tasks/:id/tags/:tagId — Remove a tag from a task
taskRoutes.delete("/:id/tags/:tagId", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const tagId = c.req.param("tagId");

    const [task] = await db.select({ id: tasks.id, domainId: tasks.domainId })
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);
    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, task.domainId);

    // Junction tables have no deleted_at — hard delete is correct here
    await db.delete(taskTags).where(and(eq(taskTags.taskId, id), eq(taskTags.tagId, tagId)));

    await recordActivity({
      actor: user.name,
      action: "untagged",
      entityType: "task",
      entityId: id,
      changes: { tagId },
      workspaceId: task.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[tasks] DELETE /:id/tags/:tagId error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove tag" } }, 500);
  }
});

// POST /api/tasks/:id/dependencies — Make this task depend on another task
taskRoutes.post("/:id/dependencies", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const { dependsOnTaskId } = z.object({
      dependsOnTaskId: z.string().uuid("Invalid task id"),
    }).parse(body);

    const [task] = await db.select({ id: tasks.id, domainId: tasks.domainId })
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);
    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, task.domainId);

    // A task cannot depend on itself
    if (dependsOnTaskId === id) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "A task cannot depend on itself" } }, 400);
    }

    const [depTask] = await db.select({ id: tasks.id, domainId: tasks.domainId })
      .from(tasks)
      .where(and(eq(tasks.id, dependsOnTaskId), isNull(tasks.deletedAt)))
      .limit(1);
    if (!depTask) {
      return c.json({ error: { code: "NOT_FOUND", message: "Dependency task not found" } }, 404);
    }
    if (depTask.domainId !== task.domainId) {
      return c.json({ error: { code: "FORBIDDEN", message: "Dependency task does not belong to this workspace" } }, 403);
    }

    // Cycle guard: walk the dependency chain (X depends on Y, Y on Z, ...) from
    // dependsOnTaskId; reaching id means adding this edge would create a cycle.
    let currentId: string | null = dependsOnTaskId;
    const visited = new Set<string>([id]);
    while (currentId) {
      if (visited.has(currentId)) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: "Circular dependency detected" } }, 400);
      }
      visited.add(currentId);
      const [next] = await db.select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
        .from(taskDependencies)
        .where(eq(taskDependencies.taskId, currentId))
        .limit(1);
      currentId = next?.dependsOnTaskId ?? null;
    }

    // Junction table has a composite PK — ignore duplicate edges
    await db.insert(taskDependencies).values({ taskId: id, dependsOnTaskId }).onConflictDoNothing();

    await recordActivity({
      actor: user.name,
      action: "dependency_added",
      entityType: "task",
      entityId: id,
      changes: { dependsOnTaskId },
      workspaceId: task.domainId,
    });

    await enqueueWebhooks({ workspaceId: task.domainId, event: "task.updated", entityType: "task", entityId: id, data: { dependsOnTaskId } });

    return c.json({ success: true }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[tasks] POST /:id/dependencies error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to add dependency" } }, 500);
  }
});

// DELETE /api/tasks/:id/dependencies/:depId — Remove a dependency
taskRoutes.delete("/:id/dependencies/:depId", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const depId = c.req.param("depId");

    const [task] = await db.select({ id: tasks.id, domainId: tasks.domainId })
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);
    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, task.domainId);

    // Junction table has no deleted_at — hard delete is correct here
    await db.delete(taskDependencies).where(and(eq(taskDependencies.taskId, id), eq(taskDependencies.dependsOnTaskId, depId)));

    await recordActivity({
      actor: user.name,
      action: "dependency_removed",
      entityType: "task",
      entityId: id,
      changes: { removedDependsOnTaskId: depId },
      workspaceId: task.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[tasks] DELETE /:id/dependencies/:depId error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove dependency" } }, 500);
  }
});

// POST /api/tasks/:id/status — Change task status (Kanban drag / completion)
taskRoutes.post("/:id/status", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const { statusId } = z.object({
      statusId: z.string().uuid("Invalid status id"),
    }).parse(body);

    const [existing] = await db.select()
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

    if (!existing.projectId) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Tasks without a project cannot have a status" } }, 400);
    }

    // The status must belong to the task's project.
    const [status] = await db.select({
      id: statusDefinitions.id,
      projectId: statusDefinitions.projectId,
      category: statusDefinitions.category,
      label: statusDefinitions.label,
    })
      .from(statusDefinitions)
      .where(eq(statusDefinitions.id, statusId))
      .limit(1);
    if (!status) {
      return c.json({ error: { code: "NOT_FOUND", message: "Status not found" } }, 404);
    }
    if (status.projectId !== existing.projectId) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Status does not belong to the task's project" } }, 400);
    }

    const isDone = status.category === "done";
    const updateValues: Record<string, unknown> = {
      statusId,
      completedAt: isDone ? new Date() : null,
      updatedAt: new Date(),
    };

    const [updated] = await db.update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: isDone ? "completed" : "updated",
      entityType: "task",
      entityId: id,
      changes: { previousStatusId: existing.statusId, newStatusId: statusId, newStatusLabel: status.label },
      workspaceId: existing.domainId,
    });

    await enqueueWebhooks({ workspaceId: existing.domainId, event: "task.updated", entityType: "task", entityId: id, data: { previousStatusId: existing.statusId, newStatusId: statusId } });

    // Fire "status changed" automation rules (Kanban drags and done checkboxes).
    await evaluateAutomations({
      projectId: updated.projectId,
      triggerType: "task_status_changed",
      entity: updated,
      changes: { previousStatusId: existing.statusId },
      actor: user.name,
    });

    // Notify the workspace owner (MVP single-user) of the status change.
    try {
      await notifyWorkspaceOwner({
        workspaceId: existing.domainId,
        type: "status_change",
        title: `Task moved to ${status.label}`,
        body: `"${existing.title}" is now ${status.label}`,
        entityType: "task",
        entityId: id,
      });
    } catch (notifyError) {
      console.error(`[tasks] Failed to create status-change notification for task ${id}:`, notifyError);
    }

    return c.json({ ...updated, status });
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
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [task] = await db.select({ id: tasks.id, domainId: tasks.domainId })
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, task.domainId);

    const history = await db.select()
      .from(activityFeed)
      .where(and(
        eq(activityFeed.entityId, id),
        eq(activityFeed.entityType, "task"),
        eq(activityFeed.workspaceId, task.domainId),
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

// GET /api/tasks/:id/attachments — File attachments metadata
taskRoutes.get("/:id/attachments", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [task] = await db.select({ id: tasks.id, domainId: tasks.domainId })
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      return c.json({ error: { code: "NOT_FOUND", message: "Task not found" } }, 404);
    }

    await requireWorkspaceAccess(c, task.domainId);

    // Attachments are stored in activity feed with entityType=attachment
    const attachments = await db.select()
      .from(activityFeed)
      .where(and(
        eq(activityFeed.entityId, id),
        eq(activityFeed.entityType, "attachment"),
        eq(activityFeed.workspaceId, task.domainId),
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
