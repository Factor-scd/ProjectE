import { Hono } from "hono";
import { db, automationRules, projects } from "@project-e/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { z } from "zod";

export const automationRoutes = new Hono();

const TRIGGER_TYPES = ["task_status_changed", "task_created", "due_date_approaching"] as const;
const ACTION_TYPES = ["set_status", "set_priority", "add_label", "create_notification"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const triggerSchema = z.object({
  type: z.enum(TRIGGER_TYPES),
  params: z.record(z.string(), z.unknown()).optional(),
});

const conditionSchema = z.object({
  field: z.enum(["project", "status", "priority", "label"]),
  op: z.string().min(1),
  value: z.unknown(),
});

const actionSchema = z.object({
  type: z.enum(ACTION_TYPES),
  params: z.record(z.string(), z.unknown()).optional(),
});

const createAutomationSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  active: z.boolean().optional(),
  trigger: triggerSchema,
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1, "At least one action is required"),
});

const updateAutomationSchema = createAutomationSchema.partial();

// Validate action params against what the evaluation engine expects, so a bad
// rule surfaces at save time instead of silently doing nothing at run time.
function validateActionParams(actions: { type: string; params?: Record<string, unknown> }[]): string | null {
  for (const action of actions) {
    const params = action.params ?? {};
    switch (action.type) {
      case "set_status":
        if (!params.statusKey) return "set_status action requires a statusKey param";
        break;
      case "set_priority":
        if (!params.priority || !PRIORITIES.includes(params.priority as any)) {
          return "set_priority action requires a priority param (low, medium, high or urgent)";
        }
        break;
      case "add_label":
        if (!params.label || typeof params.label !== "string" || params.label.trim() === "") {
          return "add_label action requires a label param";
        }
        break;
      case "create_notification":
        if (!params.message || typeof params.message !== "string" || params.message.trim() === "") {
          return "create_notification action requires a message param";
        }
        break;
    }
  }
  return null;
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

// GET /api/projects/:projectId/automations — List rules for a project
automationRoutes.get("/:projectId/automations", async (c) => {
  try {
    await requireAuth(c);
    const projectId = c.req.param("projectId");
    if (!isUuid(projectId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    await getProject(c, projectId);

    const items = await db.select()
      .from(automationRules)
      .where(eq(automationRules.projectId, projectId))
      .orderBy(asc(automationRules.createdAt));

    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[automations] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list automation rules" } }, 500);
  }
});

// POST /api/projects/:projectId/automations — Create a rule
automationRoutes.post("/:projectId/automations", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("projectId");
    if (!isUuid(projectId)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = createAutomationSchema.parse(body);
    const project = await getProject(c, projectId);

    const actionError = validateActionParams(data.actions);
    if (actionError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: actionError } }, 400);
    }

    const [rule] = await db.insert(automationRules).values({
      projectId,
      name: data.name,
      active: data.active ?? true,
      trigger: data.trigger,
      conditions: (data.conditions ?? []) as any,
      actions: data.actions as any,
    }).returning();

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "automation_rule",
      entityId: rule.id,
      changes: { name: rule.name, trigger: rule.trigger.type, projectId, projectName: project.name },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "automation.created", entityType: "automation_rule", entityId: rule.id, data: { name: rule.name } });

    return c.json(rule, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[automations] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create automation rule" } }, 500);
  }
});

// PATCH /api/projects/:projectId/automations/:id — Update a rule
automationRoutes.patch("/:projectId/automations/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("projectId");
    const id = c.req.param("id");
    if (!isUuid(projectId) || !isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateAutomationSchema.parse(body);
    const project = await getProject(c, projectId);

    const [existing] = await db.select()
      .from(automationRules)
      .where(and(eq(automationRules.id, id), eq(automationRules.projectId, projectId)))
      .limit(1);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Automation rule not found" } }, 404);
    }

    if (data.actions !== undefined) {
      const actionError = validateActionParams(data.actions);
      if (actionError) {
        return c.json({ error: { code: "VALIDATION_ERROR", message: actionError } }, 400);
      }
    }

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.active !== undefined) updateValues.active = data.active;
    if (data.trigger !== undefined) updateValues.trigger = data.trigger;
    if (data.conditions !== undefined) updateValues.conditions = data.conditions;
    if (data.actions !== undefined) updateValues.actions = data.actions;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(automationRules)
      .set(updateValues)
      .where(eq(automationRules.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "automation_rule",
      entityId: id,
      changes: { name: updated.name, projectId, previousName: existing.name },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "automation.updated", entityType: "automation_rule", entityId: id, data: { name: updated.name } });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[automations] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update automation rule" } }, 500);
  }
});

// DELETE /api/projects/:projectId/automations/:id — Delete a rule
automationRoutes.delete("/:projectId/automations/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("projectId");
    const id = c.req.param("id");
    if (!isUuid(projectId) || !isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const project = await getProject(c, projectId);

    const [existing] = await db.select()
      .from(automationRules)
      .where(and(eq(automationRules.id, id), eq(automationRules.projectId, projectId)))
      .limit(1);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Automation rule not found" } }, 404);
    }

    // Rules are configuration, not user data — hard delete is correct.
    await db.delete(automationRules).where(eq(automationRules.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "automation_rule",
      entityId: id,
      changes: { name: existing.name, projectId },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "automation.deleted", entityType: "automation_rule", entityId: id, data: { name: existing.name } });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[automations] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete automation rule" } }, 500);
  }
});

// POST /api/projects/:projectId/automations/:id/toggle — Flip active/inactive
automationRoutes.post("/:projectId/automations/:id/toggle", async (c) => {
  try {
    const user = await requireAuth(c);
    const projectId = c.req.param("projectId");
    const id = c.req.param("id");
    if (!isUuid(projectId) || !isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const project = await getProject(c, projectId);

    const [existing] = await db.select()
      .from(automationRules)
      .where(and(eq(automationRules.id, id), eq(automationRules.projectId, projectId)))
      .limit(1);
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Automation rule not found" } }, 404);
    }

    const [updated] = await db.update(automationRules)
      .set({ active: !existing.active, updatedAt: new Date() })
      .where(eq(automationRules.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: updated.active ? "enabled" : "disabled",
      entityType: "automation_rule",
      entityId: id,
      changes: { active: updated.active, projectId },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({ workspaceId: project.domainId, event: "automation.toggled", entityType: "automation_rule", entityId: id, data: { active: updated.active } });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[automations] POST /toggle error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to toggle automation rule" } }, 500);
  }
});
