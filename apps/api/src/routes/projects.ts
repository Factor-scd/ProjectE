import { Hono } from "hono";
import { db, projects, tasks, sections, projectTags, tags as tagsTable, activityFeed, states } from "@project-e/db";
import { and, asc, desc, eq, ilike, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, createErrorResponse, resolveActiveDomain, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { z } from "zod";

export const projectRoutes = new Hono();

const projectStatusEnum = z.enum(["active", "paused", "completed", "archived"]);

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  domain: z.string().min(1, "Domain is required"),
  status: projectStatusEnum.optional().default("active"),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: projectStatusEnum.optional(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
});

const sectionKindEnum = z.enum(["section", "milestone"]);
const sectionStatusEnum = z.enum(["planned", "in_progress", "complete"]);

const createSectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  kind: sectionKindEnum.optional().default("section"),
  status: sectionStatusEnum.optional().default("planned"),
  targetDate: z.string().datetime().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const updateSectionSchema = z.object({
  name: z.string().min(1).optional(),
  kind: sectionKindEnum.optional(),
  status: sectionStatusEnum.optional(),
  targetDate: z.string().datetime().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

// GET /api/projects — List projects with filtering, sorting, pagination
projectRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "50")));
    const filter = url.searchParams.get("filter") || undefined;
    const sort = url.searchParams.get("sort") || "-created";
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const order = url.searchParams.get("order") || "asc";

    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    await requireWorkspaceAccess(c, domainId);

    const conditions: any[] = [
      eq(projects.domainId, domainId),
      isNull(projects.deletedAt),
    ];

    if (status) {
      const statuses = status.split(",");
      conditions.push(inArray(projects.status, statuses as any));
    }
    if (search) conditions.push(ilike(projects.name, `%${search}%`));
    if (filter) conditions.push(ilike(projects.name, `%${filter}%`));

    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortField = sort.replace(/^-/, "");
    const sortColumns: Record<string, any> = {
      created: projects.createdAt,
      updated: projects.updatedAt,
      name: projects.name,
      status: projects.status,
      target_date: projects.targetDate,
      created_at: projects.createdAt,
      updated_at: projects.updatedAt,
    };
    const orderColumn = sortDir === "asc"
      ? asc(sortColumns[sortField] || projects.createdAt)
      : desc(sortColumns[sortField] || projects.createdAt);

    const [items, countResult] = await Promise.all([
      db.select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(orderColumn)
        .limit(limit || perPage)
        .offset(offset || (page - 1) * perPage),
      db.select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(and(...conditions)),
    ]);

    const totalItems = Number(countResult[0]?.count || 0);

    // Fetch task counts and tags for all projects
    let projectTagMap = new Map<string, { id: string; name: string; color: string | null }[]>();
    let taskCountMap = new Map<string, { total: number; completed: number }>();

    if (items.length > 0) {
      const projectIds = items.map(p => p.id);

      // Tags
      const tagRows = await db.select({
        projectId: projectTags.projectId,
        id: tagsTable.id,
        name: tagsTable.name,
        color: tagsTable.color,
      })
        .from(projectTags)
        .innerJoin(tagsTable, eq(projectTags.tagId, tagsTable.id))
        .where(inArray(projectTags.projectId, projectIds));

      for (const row of tagRows) {
        if (!projectTagMap.has(row.projectId)) projectTagMap.set(row.projectId, []);
        projectTagMap.get(row.projectId)!.push({ id: row.id, name: row.name, color: row.color });
      }

      // Task counts
      for (const projectId of projectIds) {
        const [totalResult] = await db.select({ count: sql<number>`count(*)` })
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));

        const [completedResult] = await db.select({ count: sql<number>`count(*)` })
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), isNotNull(tasks.completedAt), isNull(tasks.deletedAt)));

        taskCountMap.set(projectId, {
          total: Number(totalResult?.count || 0),
          completed: Number(completedResult?.count || 0),
        });
      }
    }

    const itemsWithMeta = items.map(p => {
      const counts = taskCountMap.get(p.id) || { total: 0, completed: 0 };
      return {
        ...p,
        tags: projectTagMap.get(p.id) || [],
        taskCount: counts.total,
        completedCount: counts.completed,
        progress: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
      };
    });

    return c.json({
      items: itemsWithMeta,
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
    console.error("[projects] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list projects" } }, 500);
  }
});

// POST /api/projects — Create a project
projectRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createProjectSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    await requireWorkspaceAccess(c, data.domain);

    const [project] = await db.insert(projects).values({
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      domainId: data.domain,
      color: data.color ?? null,
      icon: data.icon ?? null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
    }).returning();

    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(projectTags).values(
        data.tagIds.map(tagId => ({ projectId: project.id, tagId }))
      );
    }

    // Seed 5 default workflow states for the new project (Decision 10)
    const defaultStates = [
      { name: 'Backlog', color: '#94a3b8', group: 'backlog' as const, sortOrder: 0 },
      { name: 'Todo', color: '#60a5fa', group: 'unstarted' as const, sortOrder: 1 },
      { name: 'In Progress', color: '#facc15', group: 'started' as const, sortOrder: 2 },
      { name: 'Done', color: '#4ade80', group: 'completed' as const, sortOrder: 3 },
      { name: 'Cancelled', color: '#f87171', group: 'cancelled' as const, sortOrder: 4 },
    ];
    await db.insert(states).values(
      defaultStates.map(s => ({
        name: s.name,
        color: s.color,
        group: s.group,
        sortOrder: s.sortOrder,
        projectId: project.id,
      }))
    );

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "project",
      entityId: project.id,
      changes: { name: project.name, status: project.status },
      workspaceId: data.domain,
    });

    await enqueueWebhooks({ workspaceId: data.domain, event: "project.created", entityType: "project", entityId: project.id, data: { name: project.name } });

    return c.json(project, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[projects] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create project" } }, 500);
  }
});

// GET /api/projects/:id — Get a single project with sections, task counts, progress
projectRoutes.get("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [project] = await db.select()
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    // Fetch sections
    const projectSections = await db.select()
      .from(sections)
      .where(eq(sections.projectId, id))
      .orderBy(asc(sections.sortOrder));

    // Fetch tasks
    const projectTasks = await db.select()
      .from(tasks)
      .where(and(eq(tasks.projectId, id), isNull(tasks.deletedAt)))
      .orderBy(asc(tasks.order));

    // Fetch tags
    const tagRows = await db.select({
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
    })
      .from(projectTags)
      .innerJoin(tagsTable, eq(projectTags.tagId, tagsTable.id))
      .where(eq(projectTags.projectId, id));

    const totalTasks = projectTasks.length;
    const completedTasks = projectTasks.filter(t => t.completedAt !== null).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return c.json({
      ...project,
      sections: projectSections,
      tasks: projectTasks,
      tags: tagRows,
      taskCount: totalTasks,
      completedCount: completedTasks,
      progress,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[projects] GET/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get project" } }, 500);
  }
});

// PATCH /api/projects/:id — Update a project
projectRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateProjectSchema.parse(body);

    const [existing] = await db.select()
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.color !== undefined) updateValues.color = data.color;
    if (data.icon !== undefined) updateValues.icon = data.icon;
    if (data.targetDate !== undefined) updateValues.targetDate = data.targetDate ? new Date(data.targetDate) : null;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(projects)
      .set(updateValues)
      .where(eq(projects.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "project",
      entityId: id,
      changes: { ...data, previousName: existing.name },
      workspaceId: existing.domainId,
    });

    await enqueueWebhooks({ workspaceId: existing.domainId, event: "project.updated", entityType: "project", entityId: id, data: { ...data, previousName: existing.name } });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[projects] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update project" } }, 500);
  }
});

// DELETE /api/projects/:id — Soft delete a project
projectRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [existing] = await db.select()
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

    await db.update(projects)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(projects.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "project",
      entityId: id,
      changes: { name: existing.name },
      workspaceId: existing.domainId,
    });

    await enqueueWebhooks({ workspaceId: existing.domainId, event: "project.deleted", entityType: "project", entityId: id, data: { name: existing.name } });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[projects] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete project" } }, 500);
  }
});

// GET /api/projects/:id/sections — List sections for a project
projectRoutes.get("/:id/sections", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("id");

    const [project] = await db.select({ id: projects.id, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    const items = await db.select()
      .from(sections)
      .where(eq(sections.projectId, projectId))
      .orderBy(asc(sections.sortOrder));

    return c.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[projects] GET /:id/sections error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list sections" } }, 500);
  }
});

// POST /api/projects/:id/sections — Create a section
projectRoutes.post("/:id/sections", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("id");
    const body = await c.req.json();
    const data = createSectionSchema.parse(body);

    const [project] = await db.select({ id: projects.id, name: projects.name, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(sections)
        .where(eq(sections.projectId, projectId));
      sortOrder = Number(maxOrder?.max || -1) + 1;
    }

    const [section] = await db.insert(sections).values({
      name: data.name,
      projectId,
      kind: data.kind,
      status: data.status,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      sortOrder,
    }).returning();

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "section",
      entityId: section.id,
      changes: { name: section.name, projectId, projectName: project.name, kind: section.kind },
      workspaceId: project.domainId,
    });

    return c.json(section, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[projects] POST /:id/sections error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create section" } }, 500);
  }
});

// GET /api/projects/:id/sections/:sid — Get a single section
projectRoutes.get("/:id/sections/:sid", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("id");
    const id = c.req.param("sid");

    const [project] = await db.select({ id: projects.id, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    const [section] = await db.select()
      .from(sections)
      .where(and(eq(sections.id, id), eq(sections.projectId, projectId)))
      .limit(1);

    if (!section) {
      return c.json({ error: { code: "NOT_FOUND", message: "Section not found" } }, 404);
    }

    return c.json(section);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[projects] GET /:id/sections/:sid error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get section" } }, 500);
  }
});

// PATCH /api/projects/:id/sections/:sid — Update a section
projectRoutes.patch("/:id/sections/:sid", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("id");
    const id = c.req.param("sid");
    const body = await c.req.json();
    const data = updateSectionSchema.parse(body);

    const [project] = await db.select({ id: projects.id, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    const [existing] = await db.select()
      .from(sections)
      .where(and(eq(sections.id, id), eq(sections.projectId, projectId)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Section not found" } }, 404);
    }

    // Get project's domainId for activity recording
    const [proj] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.kind !== undefined) updateValues.kind = data.kind;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.targetDate !== undefined) updateValues.targetDate = data.targetDate ? new Date(data.targetDate) : null;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(sections)
      .set(updateValues)
      .where(eq(sections.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "section",
      entityId: id,
      changes: { ...data, previousName: existing.name, projectId },
      workspaceId: proj?.domainId || projectId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[projects] PATCH /:id/sections/:sid error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update section" } }, 500);
  }
});

// DELETE /api/projects/:id/sections/:sid — Delete a section
projectRoutes.delete("/:id/sections/:sid", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("id");
    const id = c.req.param("sid");

    const [project] = await db.select({ id: projects.id, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    const [existing] = await db.select()
      .from(sections)
      .where(and(eq(sections.id, id), eq(sections.projectId, projectId)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Section not found" } }, 404);
    }

    // Get project's domainId for activity recording
    const [proj] = await db.select({ domainId: projects.domainId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    await db.delete(sections)
      .where(eq(sections.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "section",
      entityId: id,
      changes: { name: existing.name, projectId },
      workspaceId: proj?.domainId || projectId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[projects] DELETE /:id/sections/:sid error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete section" } }, 500);
  }
});

// GET /api/projects/:id/members — List members (via activity feed for now)
projectRoutes.get("/:id/members", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [project] = await db.select({ id: projects.id, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    // Members are stored in activity feed with entityType=member
    const members = await db.select()
      .from(activityFeed)
      .where(and(
        eq(activityFeed.entityId, id),
        eq(activityFeed.entityType, "member"),
      ))
      .orderBy(desc(activityFeed.createdAt));

    return c.json({ items: members, totalItems: members.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[projects] GET /:id/members error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list members" } }, 500);
  }
});

// POST /api/projects/:id/members — Add a member
projectRoutes.post("/:id/members", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const { userId, role } = z.object({
      userId: z.string().uuid(),
      role: z.string().optional().default("member"),
    }).parse(body);

    const [project] = await db.select({ id: projects.id, name: projects.name, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    await recordActivity({
      actor: user.name,
      action: "added",
      entityType: "member",
      entityId: id,
      changes: { userId, role },
      workspaceId: project.domainId,
    });

    return c.json({ success: true }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[projects] POST /:id/members error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to add member" } }, 500);
  }
});

// DELETE /api/projects/:id/members/:uid — Remove a member
projectRoutes.delete("/:id/members/:uid", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const userId = c.req.param("uid");

    const [project] = await db.select({ id: projects.id, name: projects.name, domainId: projects.domainId })
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
      .limit(1);

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    await requireWorkspaceAccess(c, project.domainId);

    await recordActivity({
      actor: user.name,
      action: "removed",
      entityType: "member",
      entityId: id,
      changes: { userId },
      workspaceId: project.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[projects] DELETE /:id/members/:uid error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove member" } }, 500);
  }
});
