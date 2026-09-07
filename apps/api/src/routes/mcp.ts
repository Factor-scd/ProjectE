import { Hono } from "hono";
import { createHash } from "node:crypto";
import { db, apiKeys, users, tasks, taskTags, tags as tagsTable, habits, habitCompletions, projects, notes, domains, activityFeed, webhooks, webhookDeliveries, states, modules, cycles, links } from "@project-e/db";
import { and, asc, desc, eq, exists, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { recordActivity } from "../middleware/activity";

export const mcpRoutes = new Hono();

// ── JSON-RPC 2.0 types ─────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id: string | number | null;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: JsonRpcError;
  id: string | number | null;
}

const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;
const JSONRPC_INTERNAL_ERROR = -32603;

// ── Auth ────────────────────────────────────────────────────────────────────────

async function authenticateApiKey(c: any): Promise<{ userId: string; userName: string } | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return null;

  const apiKey = authHeader.replace("Bearer ", "").trim();
  if (!apiKey) return null;

  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  const [keyRecord] = await db
    .select({
      userId: apiKeys.userId,
      userName: users.name,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
    .limit(1);

  if (!keyRecord) return null;

  await db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.keyHash, keyHash));

  return { userId: keyRecord.userId, userName: keyRecord.userName };
}

// ── Tool definitions ─────────────────────────────────────────────────────────────

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: Record<string, unknown>, auth: { userId: string; userName: string }) => Promise<unknown>;
}

const tools: ToolDefinition[] = [
  {
    name: "tasks.list",
    description: "List tasks with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string", description: "Workspace/domain ID" },
        state_id: { type: "string", description: "Filter by state UUID" },
        state_group: { type: "string", enum: ["backlog", "unstarted", "started", "completed", "cancelled"], description: "Filter by state group" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        project_id: { type: "string" },
        module_id: { type: "string", description: "Filter by module UUID" },
        cycle_id: { type: "string", description: "Filter by cycle UUID" },
        search: { type: "string" },
        limit: { type: "number", default: 50 },
        offset: { type: "number", default: 0 },
      },
      required: ["domain_id"],
    },
    handler: async (params) => {
      const conditions: any[] = [
        eq(tasks.domainId, params.domain_id as string),
        isNull(tasks.deletedAt),
      ];
      if (params.state_id) {
        const stateIds = (params.state_id as string).split(",");
        conditions.push(inArray(tasks.stateId, stateIds));
      }
      if (params.state_group) {
        const groups = (params.state_group as string).split(",") as any[];
        conditions.push(
          exists(
            db.select({ one: sql`1` })
              .from(states)
              .where(and(eq(states.id, tasks.stateId), inArray(states.group, groups)))
          )
        );
      }
      if (params.priority) conditions.push(eq(tasks.priority, params.priority as any));
      if (params.project_id) conditions.push(eq(tasks.projectId, params.project_id as string));
      if (params.module_id) conditions.push(eq(tasks.moduleId, params.module_id as string));
      if (params.cycle_id) conditions.push(eq(tasks.cycleId, params.cycle_id as string));
      if (params.search) conditions.push(ilike(tasks.title, `%${params.search}%`));

      const items = await db.select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(asc(tasks.order))
        .limit(Math.min(Number(params.limit) || 50, 200))
        .offset(Number(params.offset) || 0);

      return { items, total: items.length };
    },
  },
  {
    name: "tasks.create",
    description: "Create a new task",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string", description: "Workspace/domain ID" },
        title: { type: "string" },
        description: { type: "string" },
        state_id: { type: "string", description: "State UUID" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        due_date: { type: "string" },
        project_id: { type: "string" },
        module_id: { type: "string", description: "Module UUID" },
        cycle_id: { type: "string", description: "Cycle UUID" },
      },
      required: ["domain_id", "title"],
    },
    handler: async (params, auth) => {
      let completedAt: Date | null = null;
      if (params.state_id) {
        const [state] = await db.select({ id: states.id, group: states.group })
          .from(states)
          .where(eq(states.id, params.state_id as string))
          .limit(1);
        if (state?.group === "completed") {
          completedAt = new Date();
        }
      }

      const [task] = await db.insert(tasks).values({
        title: params.title as string,
        description: (params.description as string) ?? null,
        priority: (params.priority as any) ?? "medium",
        domainId: params.domain_id as string,
        projectId: (params.project_id as string) ?? null,
        stateId: (params.state_id as string) ?? null,
        moduleId: (params.module_id as string) ?? null,
        cycleId: (params.cycle_id as string) ?? null,
        dueDate: params.due_date ? new Date(params.due_date as string) : null,
        completedAt,
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "created",
        entityType: "task",
        entityId: task.id,
        changes: { title: task.title, stateId: task.stateId },
        workspaceId: params.domain_id as string,
      });

      return task;
    },
  },
  {
    name: "tasks.update",
    description: "Update an existing task",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        state_id: { type: "string", description: "State UUID" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        due_date: { type: "string" },
        module_id: { type: "string", description: "Module UUID" },
        cycle_id: { type: "string", description: "Cycle UUID" },
      },
      required: ["task_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt))).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Task not found");
      await verifyDomainAccess(existing.domainId, auth.userId);

      const updateData: Record<string, unknown> = {};
      if (params.title !== undefined) updateData.title = params.title;
      if (params.description !== undefined) updateData.description = params.description;
      if (params.priority !== undefined) updateData.priority = params.priority;
      if (params.due_date !== undefined) updateData.dueDate = params.due_date ? new Date(params.due_date as string) : null;
      if (params.module_id !== undefined) updateData.moduleId = params.module_id;
      if (params.cycle_id !== undefined) updateData.cycleId = params.cycle_id;

      // Handle state change + completedAt
      if (params.state_id !== undefined) {
        updateData.stateId = params.state_id;
        if (params.state_id) {
          const [state] = await db.select({ id: states.id, group: states.group })
            .from(states)
            .where(eq(states.id, params.state_id as string))
            .limit(1);
          if (!state) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "State not found");
          updateData.completedAt = state.group === "completed" ? new Date() : null;
        } else {
          updateData.completedAt = null;
        }
      }

      updateData.updatedAt = new Date();

      const [task] = await db.update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt)))
        .returning();

      await recordActivity({
        actor: auth.userName,
        action: "updated",
        entityType: "task",
        entityId: task.id,
        changes: updateData,
        workspaceId: task.domainId,
      });

      return task;
    },
  },
  {
    name: "tasks.delete",
    description: "Soft-delete a task",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt))).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Task not found");
      await verifyDomainAccess(existing.domainId, auth.userId);

      const [task] = await db.update(tasks)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt)))
        .returning();

      await recordActivity({
        actor: auth.userName,
        action: "deleted",
        entityType: "task",
        entityId: task.id,
        workspaceId: task.domainId,
      });

      return { deleted: true, id: task.id };
    },
  },
  {
    name: "tasks.complete",
    description: "Mark a task as done by setting its state to a completed group state",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        state_id: { type: "string", description: "Optional specific completed state UUID. If omitted, finds a completed-group state from the task's project." },
      },
      required: ["task_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt))).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Task not found");
      await verifyDomainAccess(existing.domainId, auth.userId);

      let completedStateId = params.state_id as string | undefined;
      if (!completedStateId && existing.projectId) {
        const [completedState] = await db.select({ id: states.id })
          .from(states)
          .where(and(eq(states.projectId, existing.projectId), eq(states.group, "completed"), isNull(states.deletedAt)))
          .limit(1);
        completedStateId = completedState?.id;
      }

      const updateData: Record<string, unknown> = {
        completedAt: new Date(),
        updatedAt: new Date(),
      };
      if (completedStateId) {
        updateData.stateId = completedStateId;
      }

      const [task] = await db.update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt)))
        .returning();

      await recordActivity({
        actor: auth.userName,
        action: "completed",
        entityType: "task",
        entityId: task.id,
        changes: { stateId: task.stateId },
        workspaceId: task.domainId,
      });

      return task;
    },
  },
  {
    name: "habits.list",
    description: "List habits",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string" },
        active: { type: "boolean" },
      },
      required: ["domain_id"],
    },
    handler: async (params) => {
      const conditions: any[] = [eq(habits.domainId, params.domain_id as string), isNull(habits.deletedAt)];
      if (params.active !== undefined) conditions.push(eq(habits.active, params.active as boolean));
      const items = await db.select().from(habits).where(and(...conditions)).orderBy(asc(habits.name));
      return { items };
    },
  },
  {
    name: "habits.create",
    description: "Create a new habit",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        frequency: { type: "string", enum: ["daily", "weekly", "custom"] },
        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
      },
      required: ["domain_id", "name"],
    },
    handler: async (params, auth) => {
      const [habit] = await db.insert(habits).values({
        name: params.name as string,
        description: (params.description as string) ?? null,
        domainId: params.domain_id as string,
        frequency: (params.frequency as any) ?? "daily",
        difficulty: (params.difficulty as any) ?? "medium",
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "created",
        entityType: "habit",
        entityId: habit.id,
        workspaceId: params.domain_id as string,
      });

      return habit;
    },
  },
  {
    name: "habits.complete",
    description: "Log a habit completion",
    inputSchema: {
      type: "object",
      properties: {
        habit_id: { type: "string" },
        date: { type: "string", description: "ISO date string" },
        value: { type: "number", default: 1 },
      },
      required: ["habit_id"],
    },
    handler: async (params, auth) => {
      const [habit] = await db.select().from(habits).where(and(eq(habits.id, params.habit_id as string), isNull(habits.deletedAt))).limit(1);
      if (!habit) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Habit not found");
      await verifyDomainAccess(habit.domainId, auth.userId);

      const [completion] = await db.insert(habitCompletions).values({
        habitId: params.habit_id as string,
        date: params.date ? new Date(params.date as string) : new Date(),
        value: Number(params.value) || 1,
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "completed",
        entityType: "habit",
        entityId: habit.id,
        workspaceId: habit.domainId,
      });

      return completion;
    },
  },
  {
    name: "projects.list",
    description: "List projects",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string" },
        status: { type: "string", enum: ["active", "paused", "completed", "archived"] },
      },
      required: ["domain_id"],
    },
    handler: async (params) => {
      const conditions: any[] = [eq(projects.domainId, params.domain_id as string), isNull(projects.deletedAt)];
      if (params.status) conditions.push(eq(projects.status, params.status as any));
      const items = await db.select().from(projects).where(and(...conditions)).orderBy(asc(projects.name));
      return { items };
    },
  },
  {
    name: "projects.create",
    description: "Create a new project",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["active", "paused", "completed", "archived"] },
        target_date: { type: "string" },
      },
      required: ["domain_id", "name"],
    },
    handler: async (params, auth) => {
      const [project] = await db.insert(projects).values({
        name: params.name as string,
        description: (params.description as string) ?? null,
        domainId: params.domain_id as string,
        status: (params.status as any) ?? "active",
        targetDate: params.target_date ? new Date(params.target_date as string) : null,
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "created",
        entityType: "project",
        entityId: project.id,
        workspaceId: params.domain_id as string,
      });

      return project;
    },
  },
  {
    name: "notes.list",
    description: "List notes",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string" },
        is_archived: { type: "boolean" },
      },
      required: ["domain_id"],
    },
    handler: async (params) => {
      const conditions: any[] = [eq(notes.domainId, params.domain_id as string), isNull(notes.deletedAt)];
      if (params.is_archived !== undefined) conditions.push(eq(notes.isArchived, params.is_archived as boolean));
      const items = await db.select().from(notes).where(and(...conditions)).orderBy(desc(notes.updatedAt));
      return { items };
    },
  },
  {
    name: "notes.create",
    description: "Create a new note",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["domain_id", "title"],
    },
    handler: async (params, auth) => {
      const [note] = await db.insert(notes).values({
        title: params.title as string,
        content: (params.content as string) ?? null,
        domainId: params.domain_id as string,
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "created",
        entityType: "note",
        entityId: note.id,
        workspaceId: params.domain_id as string,
      });

      return note;
    },
  },
  {
    name: "notes.update",
    description: "Update a note",
    inputSchema: {
      type: "object",
      properties: {
        note_id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["note_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(notes).where(and(eq(notes.id, params.note_id as string), isNull(notes.deletedAt))).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Note not found");
      await verifyDomainAccess(existing.domainId, auth.userId);

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (params.title !== undefined) updateData.title = params.title;
      if (params.content !== undefined) updateData.content = params.content;

      const [note] = await db.update(notes)
        .set(updateData)
        .where(and(eq(notes.id, params.note_id as string), isNull(notes.deletedAt)))
        .returning();

      await recordActivity({
        actor: auth.userName,
        action: "updated",
        entityType: "note",
        entityId: note.id,
        workspaceId: note.domainId,
      });

      return note;
    },
  },
  {
    name: "notes.search",
    description: "Search notes by title or content",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string" },
        query: { type: "string" },
      },
      required: ["domain_id", "query"],
    },
    handler: async (params) => {
      const query = params.query as string;
      const items = await db.select()
        .from(notes)
        .where(and(
          eq(notes.domainId, params.domain_id as string),
          isNull(notes.deletedAt),
          or(ilike(notes.title, `%${query}%`), ilike(notes.content, `%${query}%`))
        ))
        .orderBy(desc(notes.updatedAt))
        .limit(20);
      return { items };
    },
  },
  {
    name: "domains.list",
    description: "List the caller's domains/workspaces",
    inputSchema: { type: "object", properties: {} },
    handler: async (_params, auth) => {
      // Only the caller's own domains (plus legacy ownerless rows) — never every
      // domain in the database.
      const items = await db.select()
        .from(domains)
        .where(or(eq(domains.ownerId, auth.userId), isNull(domains.ownerId)))
        .orderBy(asc(domains.name));
      return { items };
    },
  },
  {
    name: "domains.create",
    description: "Create a new domain/workspace",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        color: { type: "string" },
      },
      required: ["name", "slug"],
    },
    handler: async (params, auth) => {
      const [domain] = await db.insert(domains).values({
        name: params.name as string,
        slug: params.slug as string,
        color: (params.color as string) ?? null,
        ownerId: auth.userId,
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "created",
        entityType: "domain",
        entityId: domain.id,
        workspaceId: domain.id,
      });

      return domain;
    },
  },
  {
    name: "search.query",
    description: "Full-text search across entities",
    inputSchema: {
      type: "object",
      properties: {
        domain_id: { type: "string" },
        query: { type: "string" },
        types: { type: "array", items: { type: "string" }, description: "Entity types: tasks, notes, projects, habits" },
        limit: { type: "number", default: 20 },
      },
      required: ["domain_id", "query"],
    },
    handler: async (params) => {
      const query = params.query as string;
      const domainId = params.domain_id as string;
      const types = (params.types as string[]) || ["tasks", "notes", "projects", "habits"];
      const limit = Math.min(Number(params.limit) || 20, 50);
      const results: Record<string, unknown[]> = {};

      if (types.includes("tasks")) {
        results.tasks = await db.select({ id: tasks.id, title: tasks.title, priority: tasks.priority }).from(tasks)
          .where(and(eq(tasks.domainId, domainId), isNull(tasks.deletedAt), ilike(tasks.title, `%${query}%`))).limit(limit);
      }
      if (types.includes("notes")) {
        results.notes = await db.select({ id: notes.id, title: notes.title }).from(notes)
          .where(and(eq(notes.domainId, domainId), isNull(notes.deletedAt), ilike(notes.title, `%${query}%`))).limit(limit);
      }
      if (types.includes("projects")) {
        results.projects = await db.select({ id: projects.id, name: projects.name, status: projects.status }).from(projects)
          .where(and(eq(projects.domainId, domainId), isNull(projects.deletedAt), ilike(projects.name, `%${query}%`))).limit(limit);
      }
      if (types.includes("habits")) {
        results.habits = await db.select({ id: habits.id, name: habits.name, frequency: habits.frequency }).from(habits)
          .where(and(eq(habits.domainId, domainId), isNull(habits.deletedAt), ilike(habits.name, `%${query}%`))).limit(limit);
      }

      return results;
    },
  },
  {
    name: "activity.list",
    description: "List recent activity feed entries",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        limit: { type: "number", default: 20 },
        offset: { type: "number", default: 0 },
      },
      required: ["workspace_id"],
    },
    handler: async (params) => {
      const items = await db.select()
        .from(activityFeed)
        .where(eq(activityFeed.workspaceId, params.workspace_id as string))
        .orderBy(desc(activityFeed.createdAt))
        .limit(Math.min(Number(params.limit) || 20, 100))
        .offset(Number(params.offset) || 0);
      return { items };
    },
  },
  // ── States ──────────────────────────────────────────────────────────────────────
  {
    name: "states.list",
    description: "List workflow states for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project UUID" },
      },
      required: ["project_id"],
    },
    handler: async (params) => {
      const items = await db.select()
        .from(states)
        .where(and(eq(states.projectId, params.project_id as string), isNull(states.deletedAt)))
        .orderBy(asc(states.sortOrder));
      return { items };
    },
  },
  {
    name: "states.create",
    description: "Create a workflow state",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        name: { type: "string" },
        color: { type: "string" },
        group: { type: "string", enum: ["backlog", "unstarted", "started", "completed", "cancelled"] },
        sort_order: { type: "number" },
      },
      required: ["project_id", "name"],
    },
    handler: async (params, auth) => {
      const [project] = await db.select().from(projects).where(eq(projects.id, params.project_id as string)).limit(1);
      if (!project) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Project not found");
      await verifyDomainAccess(project.domainId, auth.userId);

      const [state] = await db.insert(states).values({
        name: params.name as string,
        color: (params.color as string) ?? null,
        group: (params.group as any) ?? "unstarted",
        projectId: params.project_id as string,
        sortOrder: (params.sort_order as number) ?? 0,
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "created",
        entityType: "state",
        entityId: state.id,
        changes: { name: state.name, group: state.group },
        workspaceId: project.domainId,
      });

      return state;
    },
  },
  {
    name: "states.update",
    description: "Update a workflow state",
    inputSchema: {
      type: "object",
      properties: {
        state_id: { type: "string" },
        name: { type: "string" },
        color: { type: "string" },
        group: { type: "string", enum: ["backlog", "unstarted", "started", "completed", "cancelled"] },
        sort_order: { type: "number" },
      },
      required: ["state_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(states).where(and(eq(states.id, params.state_id as string), isNull(states.deletedAt))).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "State not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, existing.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (params.name !== undefined) updateData.name = params.name;
      if (params.color !== undefined) updateData.color = params.color;
      if (params.group !== undefined) updateData.group = params.group;
      if (params.sort_order !== undefined) updateData.sortOrder = params.sort_order;

      const [state] = await db.update(states)
        .set(updateData)
        .where(eq(states.id, params.state_id as string))
        .returning();

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "updated",
          entityType: "state",
          entityId: state.id,
          changes: updateData,
          workspaceId: project.domainId,
        });
      }

      return state;
    },
  },
  {
    name: "states.delete",
    description: "Soft-delete a workflow state",
    inputSchema: {
      type: "object",
      properties: { state_id: { type: "string" } },
      required: ["state_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(states).where(and(eq(states.id, params.state_id as string), isNull(states.deletedAt))).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "State not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, existing.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      await db.update(states)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(states.id, params.state_id as string));

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "deleted",
          entityType: "state",
          entityId: params.state_id as string,
          changes: { name: existing.name },
          workspaceId: project.domainId,
        });
      }

      return { deleted: true, id: params.state_id };
    },
  },
  // ── Modules ─────────────────────────────────────────────────────────────────────
  {
    name: "modules.list",
    description: "List modules for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
      },
      required: ["project_id"],
    },
    handler: async (params) => {
      const items = await db.select()
        .from(modules)
        .where(and(eq(modules.projectId, params.project_id as string), isNull(modules.deletedAt)))
        .orderBy(asc(modules.sortOrder));
      return { items };
    },
  },
  {
    name: "modules.create",
    description: "Create a module",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["planned", "in_progress", "completed", "cancelled"] },
        start_date: { type: "string" },
        target_date: { type: "string" },
      },
      required: ["project_id", "name"],
    },
    handler: async (params, auth) => {
      const [project] = await db.select().from(projects).where(eq(projects.id, params.project_id as string)).limit(1);
      if (!project) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Project not found");
      await verifyDomainAccess(project.domainId, auth.userId);

      const [mod] = await db.insert(modules).values({
        name: params.name as string,
        description: (params.description as string) ?? null,
        projectId: params.project_id as string,
        status: (params.status as any) ?? "planned",
        startDate: params.start_date ? new Date(params.start_date as string) : null,
        targetDate: params.target_date ? new Date(params.target_date as string) : null,
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "created",
        entityType: "module",
        entityId: mod.id,
        changes: { name: mod.name },
        workspaceId: project.domainId,
      });

      return mod;
    },
  },
  {
    name: "modules.update",
    description: "Update a module",
    inputSchema: {
      type: "object",
      properties: {
        module_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["planned", "in_progress", "completed", "cancelled"] },
        start_date: { type: "string" },
        target_date: { type: "string" },
      },
      required: ["module_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(modules).where(and(eq(modules.id, params.module_id as string), isNull(modules.deletedAt))).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Module not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, existing.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (params.name !== undefined) updateData.name = params.name;
      if (params.description !== undefined) updateData.description = params.description;
      if (params.status !== undefined) updateData.status = params.status;
      if (params.start_date !== undefined) updateData.startDate = params.start_date ? new Date(params.start_date as string) : null;
      if (params.target_date !== undefined) updateData.targetDate = params.target_date ? new Date(params.target_date as string) : null;

      const [mod] = await db.update(modules)
        .set(updateData)
        .where(eq(modules.id, params.module_id as string))
        .returning();

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "updated",
          entityType: "module",
          entityId: mod.id,
          changes: updateData,
          workspaceId: project.domainId,
        });
      }

      return mod;
    },
  },
  {
    name: "modules.delete",
    description: "Soft-delete a module and clear module_id on its tasks",
    inputSchema: {
      type: "object",
      properties: { module_id: { type: "string" } },
      required: ["module_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(modules).where(and(eq(modules.id, params.module_id as string), isNull(modules.deletedAt))).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Module not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, existing.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      await db.update(tasks)
        .set({ moduleId: null, updatedAt: new Date() })
        .where(eq(tasks.moduleId, params.module_id as string));

      await db.update(modules)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(modules.id, params.module_id as string));

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "deleted",
          entityType: "module",
          entityId: params.module_id as string,
          changes: { name: existing.name },
          workspaceId: project.domainId,
        });
      }

      return { deleted: true, id: params.module_id };
    },
  },
  {
    name: "modules.add-task",
    description: "Add a task to a module",
    inputSchema: {
      type: "object",
      properties: {
        module_id: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["module_id", "task_id"],
    },
    handler: async (params, auth) => {
      const [mod] = await db.select().from(modules).where(and(eq(modules.id, params.module_id as string), isNull(modules.deletedAt))).limit(1);
      if (!mod) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Module not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, mod.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      const [task] = await db.select().from(tasks).where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt))).limit(1);
      if (!task) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Task not found");

      await db.update(tasks)
        .set({ moduleId: params.module_id as string, updatedAt: new Date() })
        .where(eq(tasks.id, params.task_id as string));

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "added_task",
          entityType: "module",
          entityId: params.module_id as string,
          changes: { taskId: params.task_id, taskTitle: task.title },
          workspaceId: project.domainId,
        });
      }

      return { success: true };
    },
  },
  {
    name: "modules.remove-task",
    description: "Remove a task from a module",
    inputSchema: {
      type: "object",
      properties: {
        module_id: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["module_id", "task_id"],
    },
    handler: async (params, auth) => {
      const [mod] = await db.select().from(modules).where(and(eq(modules.id, params.module_id as string), isNull(modules.deletedAt))).limit(1);
      if (!mod) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Module not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, mod.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      await db.update(tasks)
        .set({ moduleId: null, updatedAt: new Date() })
        .where(and(eq(tasks.id, params.task_id as string), eq(tasks.moduleId, params.module_id as string)));

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "removed_task",
          entityType: "module",
          entityId: params.module_id as string,
          changes: { taskId: params.task_id },
          workspaceId: project.domainId,
        });
      }

      return { success: true };
    },
  },
  // ── Cycles ──────────────────────────────────────────────────────────────────────
  {
    name: "cycles.list",
    description: "List cycles for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
      },
      required: ["project_id"],
    },
    handler: async (params) => {
      const items = await db.select()
        .from(cycles)
        .where(eq(cycles.projectId, params.project_id as string))
        .orderBy(desc(cycles.createdAt));
      return { items };
    },
  },
  {
    name: "cycles.create",
    description: "Create a cycle",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        name: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        active: { type: "boolean" },
      },
      required: ["project_id", "name"],
    },
    handler: async (params, auth) => {
      const [project] = await db.select().from(projects).where(eq(projects.id, params.project_id as string)).limit(1);
      if (!project) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Project not found");
      await verifyDomainAccess(project.domainId, auth.userId);

      const [cycle] = await db.insert(cycles).values({
        name: params.name as string,
        projectId: params.project_id as string,
        startDate: params.start_date ? new Date(params.start_date as string) : null,
        endDate: params.end_date ? new Date(params.end_date as string) : null,
        active: (params.active as boolean) ?? false,
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "created",
        entityType: "cycle",
        entityId: cycle.id,
        changes: { name: cycle.name },
        workspaceId: project.domainId,
      });

      return cycle;
    },
  },
  {
    name: "cycles.update",
    description: "Update a cycle",
    inputSchema: {
      type: "object",
      properties: {
        cycle_id: { type: "string" },
        name: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        active: { type: "boolean" },
      },
      required: ["cycle_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(cycles).where(eq(cycles.id, params.cycle_id as string)).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Cycle not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, existing.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (params.name !== undefined) updateData.name = params.name;
      if (params.start_date !== undefined) updateData.startDate = params.start_date ? new Date(params.start_date as string) : null;
      if (params.end_date !== undefined) updateData.endDate = params.end_date ? new Date(params.end_date as string) : null;
      if (params.active !== undefined) updateData.active = params.active;

      const [cycle] = await db.update(cycles)
        .set(updateData)
        .where(eq(cycles.id, params.cycle_id as string))
        .returning();

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "updated",
          entityType: "cycle",
          entityId: cycle.id,
          changes: updateData,
          workspaceId: project.domainId,
        });
      }

      return cycle;
    },
  },
  {
    name: "cycles.delete",
    description: "Delete a cycle and clear cycle_id on its tasks",
    inputSchema: {
      type: "object",
      properties: { cycle_id: { type: "string" } },
      required: ["cycle_id"],
    },
    handler: async (params, auth) => {
      const [existing] = await db.select().from(cycles).where(eq(cycles.id, params.cycle_id as string)).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Cycle not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, existing.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      await db.update(tasks)
        .set({ cycleId: null, updatedAt: new Date() })
        .where(eq(tasks.cycleId, params.cycle_id as string));

      await db.delete(cycles).where(eq(cycles.id, params.cycle_id as string));

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "deleted",
          entityType: "cycle",
          entityId: params.cycle_id as string,
          changes: { name: existing.name },
          workspaceId: project.domainId,
        });
      }

      return { deleted: true, id: params.cycle_id };
    },
  },
  {
    name: "cycles.add-task",
    description: "Add a task to a cycle",
    inputSchema: {
      type: "object",
      properties: {
        cycle_id: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["cycle_id", "task_id"],
    },
    handler: async (params, auth) => {
      const [cycle] = await db.select().from(cycles).where(eq(cycles.id, params.cycle_id as string)).limit(1);
      if (!cycle) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Cycle not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, cycle.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      const [task] = await db.select().from(tasks).where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt))).limit(1);
      if (!task) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Task not found");

      await db.update(tasks)
        .set({ cycleId: params.cycle_id as string, updatedAt: new Date() })
        .where(eq(tasks.id, params.task_id as string));

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "added_task",
          entityType: "cycle",
          entityId: params.cycle_id as string,
          changes: { taskId: params.task_id, taskTitle: task.title },
          workspaceId: project.domainId,
        });
      }

      return { success: true };
    },
  },
  {
    name: "cycles.remove-task",
    description: "Remove a task from a cycle",
    inputSchema: {
      type: "object",
      properties: {
        cycle_id: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["cycle_id", "task_id"],
    },
    handler: async (params, auth) => {
      const [cycle] = await db.select().from(cycles).where(eq(cycles.id, params.cycle_id as string)).limit(1);
      if (!cycle) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Cycle not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, cycle.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      await db.update(tasks)
        .set({ cycleId: null, updatedAt: new Date() })
        .where(and(eq(tasks.id, params.task_id as string), eq(tasks.cycleId, params.cycle_id as string)));

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "removed_task",
          entityType: "cycle",
          entityId: params.cycle_id as string,
          changes: { taskId: params.task_id },
          workspaceId: project.domainId,
        });
      }

      return { success: true };
    },
  },
  {
    name: "cycles.transfer-task",
    description: "Transfer a task from one cycle to another",
    inputSchema: {
      type: "object",
      properties: {
        from_cycle_id: { type: "string" },
        to_cycle_id: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["from_cycle_id", "to_cycle_id", "task_id"],
    },
    handler: async (params, auth) => {
      const [fromCycle] = await db.select().from(cycles).where(eq(cycles.id, params.from_cycle_id as string)).limit(1);
      if (!fromCycle) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Source cycle not found");

      const [project] = await db.select().from(projects).where(eq(projects.id, fromCycle.projectId)).limit(1);
      if (project) await verifyDomainAccess(project.domainId, auth.userId);

      const [task] = await db.select().from(tasks).where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt))).limit(1);
      if (!task) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Task not found");

      await db.update(tasks)
        .set({ cycleId: params.to_cycle_id as string, updatedAt: new Date() })
        .where(eq(tasks.id, params.task_id as string));

      if (project) {
        await recordActivity({
          actor: auth.userName,
          action: "transferred_task",
          entityType: "cycle",
          entityId: params.from_cycle_id as string,
          changes: { taskId: params.task_id, fromCycleId: params.from_cycle_id, toCycleId: params.to_cycle_id },
          workspaceId: project.domainId,
        });
      }

      return { success: true };
    },
  },
  // ── Links ───────────────────────────────────────────────────────────────────────
  {
    name: "links.list",
    description: "List links for an entity (bidirectional)",
    inputSchema: {
      type: "object",
      properties: {
        source_type: { type: "string", description: "Entity type (e.g. task, project)" },
        source_id: { type: "string", description: "Entity UUID" },
        target_type: { type: "string" },
        target_id: { type: "string" },
        link_type: { type: "string", enum: ["relates", "blocks", "parent-child", "created-from"] },
        limit: { type: "number", default: 50 },
      },
    },
    handler: async (params) => {
      const conditions: any[] = [];
      if (params.source_type && params.source_id) {
        conditions.push(
          or(
            and(eq(links.sourceType, params.source_type as string), eq(links.sourceId, params.source_id as string)),
            and(eq(links.targetType, params.source_type as string), eq(links.targetId, params.source_id as string)),
          )!
        );
      } else if (params.target_type && params.target_id) {
        conditions.push(
          or(
            and(eq(links.sourceType, params.target_type as string), eq(links.sourceId, params.target_id as string)),
            and(eq(links.targetType, params.target_type as string), eq(links.targetId, params.target_id as string)),
          )!
        );
      }
      if (params.link_type) {
        conditions.push(eq(links.linkType, params.link_type as any));
      }

      const items = await db.select()
        .from(links)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(links.createdAt))
        .limit(Math.min(Number(params.limit) || 50, 200));

      return { items, total: items.length };
    },
  },
  {
    name: "links.create",
    description: "Create a link between two entities",
    inputSchema: {
      type: "object",
      properties: {
        source_type: { type: "string" },
        source_id: { type: "string" },
        target_type: { type: "string" },
        target_id: { type: "string" },
        link_type: { type: "string", enum: ["relates", "blocks", "parent-child", "created-from"] },
        direction: { type: "string" },
      },
      required: ["source_type", "source_id", "target_type", "target_id", "link_type"],
    },
    handler: async (params) => {
      const [existing] = await db.select()
        .from(links)
        .where(and(
          eq(links.sourceType, params.source_type as string),
          eq(links.sourceId, params.source_id as string),
          eq(links.targetType, params.target_type as string),
          eq(links.targetId, params.target_id as string),
          eq(links.linkType, params.link_type as any),
        ))
        .limit(1);

      if (existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Link already exists");

      const [link] = await db.insert(links).values({
        sourceType: params.source_type as string,
        sourceId: params.source_id as string,
        targetType: params.target_type as string,
        targetId: params.target_id as string,
        linkType: params.link_type as any,
        direction: (params.direction as string) ?? null,
      }).returning();

      return link;
    },
  },
  {
    name: "links.delete",
    description: "Delete a link",
    inputSchema: {
      type: "object",
      properties: { link_id: { type: "string" } },
      required: ["link_id"],
    },
    handler: async (params) => {
      const [existing] = await db.select().from(links).where(eq(links.id, params.link_id as string)).limit(1);
      if (!existing) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Link not found");

      await db.delete(links).where(eq(links.id, params.link_id as string));
      return { deleted: true, id: params.link_id };
    },
  },
];

// ── Error helper ─────────────────────────────────────────────────────────────────

class JsonRpcErrorResponse extends Error {
  constructor(public code: number, message: string, public data?: unknown) {
    super(message);
    this.name = "JsonRpcErrorResponse";
  }
}

function makeError(code: number, message: string, data?: unknown, id: string | number | null = null): JsonRpcResponse {
  return { jsonrpc: "2.0", error: { code, message, data }, id };
}

function makeResult(result: unknown, id: string | number | null): JsonRpcResponse {
  return { jsonrpc: "2.0", result, id };
}

// Validate that every field listed in the tool's inputSchema `required` array is
// present. Prevents silent empty-result queries (e.g. a missing domain_id) from
// reaching the database.
function validateParams(tool: ToolDefinition, args: Record<string, unknown>): string | null {
  const schema = tool.inputSchema as { required?: string[] } | undefined;
  for (const field of schema?.required || []) {
    const value = args[field];
    if (value === undefined || value === null || value === "") {
      return `Missing required parameter: ${field}`;
    }
  }
  return null;
}

// Domain/workspace ownership check for tools that receive a domain_id or
// workspace_id. Mirrors requireWorkspaceAccess but works without a Hono context:
// legacy domains with a NULL ownerId pass through the existence check only.
async function verifyDomainAccess(domainId: string, userId: string): Promise<void> {
  if (!domainId || domainId.trim() === "") {
    throw new JsonRpcErrorResponse(JSONRPC_INVALID_PARAMS, "domain_id is required");
  }
  const [domain] = await db
    .select({ id: domains.id, ownerId: domains.ownerId })
    .from(domains)
    .where(eq(domains.id, domainId))
    .limit(1);
  if (!domain) {
    throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, `Domain not found: ${domainId}`);
  }
  if (domain.ownerId !== null && domain.ownerId !== userId) {
    throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, `No access to domain: ${domainId}`);
  }
}

async function handleRequest(body: JsonRpcRequest, auth: { userId: string; userName: string }): Promise<JsonRpcResponse> {
  const { method, params, id } = body;

  // MCP initialize
  if (method === "initialize") {
    return makeResult({
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {},
      },
      serverInfo: {
        name: "project-e",
        version: "1.0.0",
      },
    }, id);
  }

  // MCP tools/list
  if (method === "tools/list") {
    return makeResult({
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }, id);
  }

  // MCP tools/call
  if (method === "tools/call") {
    const callParams = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    if (!callParams?.name) {
      return makeError(JSONRPC_INVALID_PARAMS, "Missing tool name", undefined, id);
    }

    const tool = tools.find(t => t.name === callParams.name);
    if (!tool) {
      return makeError(JSONRPC_METHOD_NOT_FOUND, `Unknown tool: ${callParams.name}`, undefined, id);
    }

    try {
      const args = callParams.arguments || {};

      const missing = validateParams(tool, args);
      if (missing) {
        return makeError(JSONRPC_INVALID_PARAMS, missing, undefined, id);
      }

      // Scope to the caller's domains when a domain/workspace is passed.
      const domainId = (args.domain_id as string | undefined) ?? (args.workspace_id as string | undefined);
      if (domainId) {
        await verifyDomainAccess(domainId, auth.userId);
      }

      const result = await tool.handler(args, auth);
      return makeResult({ content: [{ type: "text", text: JSON.stringify(result) }] }, id);
    } catch (error) {
      if (error instanceof JsonRpcErrorResponse) {
        return makeError(error.code, error.message, error.data, id);
      }
      console.error(`[MCP] Tool ${callParams.name} error:`, error);
      return makeError(JSONRPC_INTERNAL_ERROR, error instanceof Error ? error.message : "Internal error", undefined, id);
    }
  }

  // MCP resources/list
  if (method === "resources/list") {
    return makeResult({
      resources: [
        {
          uri: "project-e://tasks",
          name: "Tasks",
          description: "Access to task entities",
          mimeType: "application/json",
        },
        {
          uri: "project-e://notes",
          name: "Notes",
          description: "Access to note entities",
          mimeType: "application/json",
        },
        {
          uri: "project-e://projects",
          name: "Projects",
          description: "Access to project entities",
          mimeType: "application/json",
        },
        {
          uri: "project-e://habits",
          name: "Habits",
          description: "Access to habit entities",
          mimeType: "application/json",
        },
      ],
    }, id);
  }

  // MCP resources/read
  if (method === "resources/read") {
    const readParams = params as { uri?: string } | undefined;
    if (!readParams?.uri) {
      return makeError(JSONRPC_INVALID_PARAMS, "Missing resource URI", undefined, id);
    }
    return makeResult({
      contents: [
        {
          uri: readParams.uri,
          mimeType: "application/json",
          text: JSON.stringify({ message: `Resource ${readParams.uri} accessed. Use tools/call for data operations.` }),
        },
      ],
    }, id);
  }

  // Legacy server/discover
  if (method === "server/discover") {
    return makeResult({
      name: "project-e",
      version: "1.0.0",
      capabilities: { tools: {} },
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }, id);
  }

  return makeError(JSONRPC_METHOD_NOT_FOUND, `Unknown method: ${method}`, undefined, id);
}

// ── Route handler ────────────────────────────────────────────────────────────────

mcpRoutes.post("/", async (c) => {
  const auth = await authenticateApiKey(c);
  if (!auth) {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized. Provide a valid API key in Authorization: Bearer ***" }, id: null },
      401
    );
  }

  let body: JsonRpcRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json(makeError(JSONRPC_PARSE_ERROR, "Parse error: invalid JSON"), 400);
  }

  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return c.json(makeError(JSONRPC_INVALID_REQUEST, "Invalid Request: must be valid JSON-RPC 2.0 with method"), 400);
  }

  const response = await handleRequest(body, auth);
  return c.json(response);
});

mcpRoutes.get("/", async (c) => {
  return c.json(
    makeError(JSONRPC_METHOD_NOT_FOUND, "MCP server only accepts POST requests"),
    405
  );
});
