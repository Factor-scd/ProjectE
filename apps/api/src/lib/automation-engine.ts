import { db, automationRules, tasks, taskTags, tags as tagsTable, statusDefinitions } from "@project-e/db";
import { and, eq, isNull } from "drizzle-orm";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { notifyWorkspaceOwner } from "./notify";

export const TRIGGER_TYPES = ["task_status_changed", "task_created", "due_date_approaching"] as const;
export const ACTION_TYPES = ["set_status", "set_priority", "add_label", "create_notification"] as const;

// Safety limit: cap the number of actions executed per trigger event so a
// misconfigured rule can never cascade into runaway writes.
const MAX_ACTIONS_PER_EVENT = 10;

export interface EvaluateAutomationsParams {
  projectId: string | null | undefined;
  triggerType: string;
  /** The affected entity row (e.g. the task after its mutation). */
  entity: Record<string, any>;
  /** Diff of the mutation, e.g. { previousStatusId } for status changes. */
  changes?: Record<string, any>;
  /** Display name of the user who triggered the event. Defaults to "Automation". */
  actor?: string;
}

type AutomationRuleRow = typeof automationRules.$inferSelect;
type StatusRow = typeof statusDefinitions.$inferSelect;

interface RuleContext {
  projectId: string;
  statusKey: string | null;
  previousStatusKey: string | null;
  priority: string | null;
  labels: string[];
  /** The affected entity row (e.g. the task after its mutation). */
  entity: Record<string, any>;
  statusById: Map<string, StatusRow>;
  idByKey: Map<string, string>;
  categoryById: Map<string, string>;
}

function matchesCondition(
  condition: { field: string; op: string; value: any },
  ctx: RuleContext
): boolean {
  const value = condition.value;
  switch (condition.field) {
    case "project":
      return ctx.projectId === value;
    case "status": {
      // `to`/`from` are status-change semantics; everything else compares the
      // task's current status key.
      if (condition.op === "to") return ctx.statusKey === value;
      if (condition.op === "from") return ctx.previousStatusKey === value;
      if (condition.op === "neq") return ctx.statusKey !== value;
      return ctx.statusKey === value;
    }
    case "priority":
      if (condition.op === "in") {
        return Array.isArray(value) && value.includes(ctx.priority);
      }
      if (condition.op === "neq") return ctx.priority !== value;
      return ctx.priority === value;
    case "label":
      if (condition.op === "not_has") return !ctx.labels.includes(value);
      return ctx.labels.includes(value);
    default:
      return true;
  }
}

/**
 * Execute a single automation action immediately. Returns true when the action
 * actually ran (i.e. it should count against the per-event limit), false when it
 * was a no-op (e.g. status key no longer exists in the project).
 */
async function executeAction(
  action: { type: string; params: Record<string, any> },
  ctx: RuleContext,
  actor: string
): Promise<boolean> {
  const params = action.params ?? {};
  const entity = ctx.entity;

  switch (action.type) {
    case "set_status": {
      const statusId = ctx.idByKey.get(params.statusKey as string);
      if (!statusId) return false;
      const category = ctx.categoryById.get(statusId) ?? "todo";
      await db.update(tasks)
        .set({
          statusId,
          completedAt: category === "done" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, entity.id), isNull(tasks.deletedAt)));

      await recordActivity({
        actor,
        action: "updated",
        entityType: "task",
        entityId: entity.id,
        changes: {
          previousStatusId: entity.statusId,
          newStatusId: statusId,
          viaAutomation: true,
          automation: params.statusKey,
        },
        workspaceId: entity.domainId,
      });
      await enqueueWebhooks({
        workspaceId: entity.domainId,
        event: "task.updated",
        entityType: "task",
        entityId: entity.id,
        data: { previousStatusId: entity.statusId, newStatusId: statusId, viaAutomation: true },
      });
      return true;
    }

    case "set_priority": {
      const priority = params.priority as string;
      await db.update(tasks)
        .set({ priority: priority as any, updatedAt: new Date() })
        .where(and(eq(tasks.id, entity.id), isNull(tasks.deletedAt)));

      await recordActivity({
        actor,
        action: "updated",
        entityType: "task",
        entityId: entity.id,
        changes: { previousPriority: entity.priority, newPriority: priority, viaAutomation: true },
        workspaceId: entity.domainId,
      });
      await enqueueWebhooks({
        workspaceId: entity.domainId,
        event: "task.updated",
        entityType: "task",
        entityId: entity.id,
        data: { previousPriority: entity.priority, newPriority: priority, viaAutomation: true },
      });
      return true;
    }

    case "add_label": {
      const label = (params.label as string).trim();
      if (!label) return false;

      // Find-or-create a tag so rules can attach labels that don't exist yet.
      let tagId: string | null = null;
      const [existingTag] = await db.select({ id: tagsTable.id })
        .from(tagsTable)
        .where(eq(tagsTable.name, label))
        .limit(1);
      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const [created] = await db.insert(tagsTable).values({ name: label, scope: "tasks" }).returning({ id: tagsTable.id });
        tagId = created.id;
      }

      await db.insert(taskTags).values({ taskId: entity.id, tagId }).onConflictDoNothing();

      await recordActivity({
        actor,
        action: "tagged",
        entityType: "task",
        entityId: entity.id,
        changes: { tagId, tagName: label, viaAutomation: true },
        workspaceId: entity.domainId,
      });
      return true;
    }

    case "create_notification": {
      const message = (params.message as string).trim();
      if (!message) return false;

      // Create a real in-app notification so it lands in the bell's unread
      // badge and the notification sheet (single-user MVP: goes to the
      // workspace owner). The activity row is kept for the audit trail.
      await notifyWorkspaceOwner({
        workspaceId: entity.domainId,
        type: "automation",
        title: message,
        body: `Automation fired on "${entity.title ?? "task"}"`,
        entityType: "task",
        entityId: entity.id,
      });

      await recordActivity({
        actor,
        action: "notified",
        entityType: "task",
        entityId: entity.id,
        changes: { message, viaAutomation: true },
        workspaceId: entity.domainId,
      });
      return true;
    }

    default:
      return false;
  }
}

/**
 * Find every active rule for a project whose trigger matches `triggerType`,
 * check their conditions, and run the matching rules' actions immediately.
 *
 * Never throws: automation failures must not fail the user's request. All errors
 * are logged. The total number of actions executed per event is capped at
 * `MAX_ACTIONS_PER_EVENT`.
 */
export async function evaluateAutomations({
  projectId,
  triggerType,
  entity,
  changes = {},
  actor = "Automation",
}: EvaluateAutomationsParams): Promise<void> {
  if (!projectId || !entity?.id) return;

  try {
    const rules = await db.select()
      .from(automationRules)
      .where(and(
        eq(automationRules.projectId, projectId),
        eq(automationRules.active, true),
      ));

    const matching = rules.filter((rule: AutomationRuleRow) => rule.trigger.type === triggerType);
    if (matching.length === 0) return;

    // Build the context maps once per event: status definitions for the project
    // (key <-> id) and the task's current labels for condition matching.
    const statuses = await db.select()
      .from(statusDefinitions)
      .where(eq(statusDefinitions.projectId, projectId));

    const statusById = new Map(statuses.map((s) => [s.id, s]));
    const idByKey = new Map<string, string>();
    const categoryById = new Map<string, string>();
    for (const status of statuses) {
      idByKey.set(status.key, status.id);
      categoryById.set(status.id, status.category);
    }

    const tagRows = await db.select({ name: tagsTable.name })
      .from(taskTags)
      .innerJoin(tagsTable, eq(taskTags.tagId, tagsTable.id))
      .where(eq(taskTags.taskId, entity.id));

    const statusKey = entity.statusId ? (statusById.get(entity.statusId)?.key ?? null) : null;
    const previousStatusKey = changes.previousStatusId
      ? (statusById.get(changes.previousStatusId)?.key ?? null)
      : null;

    const ctx: RuleContext = {
      projectId,
      statusKey,
      previousStatusKey,
      priority: entity.priority ?? null,
      labels: tagRows.map((r) => r.name),
      entity,
      statusById,
      idByKey,
      categoryById,
    };

    let executedActions = 0;
    for (const rule of matching) {
      if (executedActions >= MAX_ACTIONS_PER_EVENT) break;

      const conditionsMatch = (rule.conditions ?? []).every((condition) =>
        matchesCondition(condition, ctx)
      );
      if (!conditionsMatch) continue;

      for (const action of rule.actions ?? []) {
        if (executedActions >= MAX_ACTIONS_PER_EVENT) {
          console.warn(`[automations] Hit safety limit of ${MAX_ACTIONS_PER_EVENT} actions for event ${triggerType} in project ${projectId}`);
          break;
        }
        const ran = await executeAction(action, ctx, actor);
        if (ran) executedActions += 1;
      }
    }
  } catch (error) {
    console.error(`[automations] evaluateAutomations failed for ${triggerType} in project ${projectId}:`, error);
  }
}
