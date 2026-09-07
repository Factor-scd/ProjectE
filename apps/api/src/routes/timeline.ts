import { Hono } from "hono";
import { db, projects, sections, statusDefinitions, taskDependencies, tasks } from "@project-e/db";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";

export const timelineRoutes = new Hono();

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

// GET /api/domains/:domainId/projects/:projectId/timeline — Gantt data for a project:
// task bars (with status + dependencies) and milestone sections. Tasks without a
// startDate field use createdAt as the bar start.
timelineRoutes.get("/domains/:domainId/projects/:projectId/timeline", async (c) => {
  try {
    const user = await requireAuth(c);
    void user;
    const domainId = c.req.param("domainId");
    const projectId = c.req.param("projectId");
    if (!isUuid(domainId) || !isUuid(projectId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    await requireWorkspaceAccess(c, domainId);

    const [project] = await db.select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.domainId, domainId), isNull(projects.deletedAt)))
      .limit(1);
    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    const [taskRows, milestoneRows] = await Promise.all([
      db.select({
        id: tasks.id,
        title: tasks.title,
        statusId: tasks.statusId,
        sectionId: tasks.sectionId,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
        status: statusColumns,
      })
        .from(tasks)
        .leftJoin(statusDefinitions, eq(tasks.statusId, statusDefinitions.id))
        .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
        .orderBy(asc(tasks.createdAt)),
      db.select({
        id: sections.id,
        name: sections.name,
        targetDate: sections.targetDate,
        sortOrder: sections.sortOrder,
      })
        .from(sections)
        .where(and(
          eq(sections.projectId, projectId),
          eq(sections.kind, "milestone"),
          isNotNull(sections.targetDate),
        ))
        .orderBy(asc(sections.targetDate), asc(sections.sortOrder)),
    ]);

    // Dependency map: taskId → ids of tasks it depends on. Only edges between
    // tasks in this project are kept so arrows never point outside the chart.
    const depsByTask = new Map<string, string[]>();
    if (taskRows.length > 0) {
      const taskIds = taskRows.map((t) => t.id);
      const depRows = await db.select({
        taskId: taskDependencies.taskId,
        dependsOnTaskId: taskDependencies.dependsOnTaskId,
      })
        .from(taskDependencies)
        .where(and(
          inArray(taskDependencies.taskId, taskIds),
          inArray(taskDependencies.dependsOnTaskId, taskIds),
        ));
      for (const dep of depRows) {
        const list = depsByTask.get(dep.taskId) ?? [];
        list.push(dep.dependsOnTaskId);
        depsByTask.set(dep.taskId, list);
      }
    }

    return c.json({
      tasks: taskRows.map((t) => ({
        id: t.id,
        title: t.title,
        startDate: t.createdAt,
        dueDate: t.dueDate,
        statusId: t.statusId,
        status: t.status,
        sectionId: t.sectionId,
        dependencies: depsByTask.get(t.id) ?? [],
      })),
      milestones: milestoneRows.map((m) => ({
        id: m.id,
        name: m.name,
        targetDate: m.targetDate,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[timeline] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to load timeline" } }, 500);
  }
});
