import { Hono } from "hono";
import { createHash } from "node:crypto";
import { db, apiKeys, users, tasks, taskTags, tags as tagsTable, habits, habitCompletions, projects, notes, noteLinks, domains, activityFeed, webhooks, webhookDeliveries } from "@project-e/db";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
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
        status: { type: "string", enum: ["todo", "in_progress", "done", "cancelled"] },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        project_id: { type: "string" },
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
      if (params.status) conditions.push(eq(tasks.status, params.status as any));
      if (params.priority) conditions.push(eq(tasks.priority, params.priority as any));
      if (params.project_id) conditions.push(eq(tasks.projectId, params.project_id as string));
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
        status: { type: "string", enum: ["todo", "in_progress", "done", "cancelled"] },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        due_date: { type: "string" },
        project_id: { type: "string" },
      },
      required: ["domain_id", "title"],
    },
    handler: async (params, auth) => {
      const [task] = await db.insert(tasks).values({
        title: params.title as string,
        description: (params.description as string) ?? null,
        status: (params.status as any) ?? "todo",
        priority: (params.priority as any) ?? "medium",
        domainId: params.domain_id as string,
        projectId: (params.project_id as string) ?? null,
        dueDate: params.due_date ? new Date(params.due_date as string) : null,
      }).returning();

      await recordActivity({
        actor: auth.userName,
        action: "created",
        entityType: "task",
        entityId: task.id,
        changes: { title: task.title, status: task.status },
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
        status: { type: "string", enum: ["todo", "in_progress", "done", "cancelled"] },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        due_date: { type: "string" },
      },
      required: ["task_id"],
    },
    handler: async (params, auth) => {
      const updateData: Record<string, unknown> = {};
      if (params.title !== undefined) updateData.title = params.title;
      if (params.description !== undefined) updateData.description = params.description;
      if (params.status !== undefined) updateData.status = params.status;
      if (params.priority !== undefined) updateData.priority = params.priority;
      if (params.due_date !== undefined) updateData.dueDate = params.due_date ? new Date(params.due_date as string) : null;
      updateData.updatedAt = new Date();

      const [task] = await db.update(tasks)
        .set(updateData)
        .where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt)))
        .returning();

      if (!task) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Task not found");

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
      const [task] = await db.update(tasks)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt)))
        .returning();

      if (!task) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Task not found");

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
    description: "Mark a task as done",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
    handler: async (params, auth) => {
      const [task] = await db.update(tasks)
        .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(tasks.id, params.task_id as string), isNull(tasks.deletedAt)))
        .returning();

      if (!task) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Task not found");

      await recordActivity({
        actor: auth.userName,
        action: "completed",
        entityType: "task",
        entityId: task.id,
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
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (params.title !== undefined) updateData.title = params.title;
      if (params.content !== undefined) updateData.content = params.content;

      const [note] = await db.update(notes)
        .set(updateData)
        .where(and(eq(notes.id, params.note_id as string), isNull(notes.deletedAt)))
        .returning();

      if (!note) throw new JsonRpcErrorResponse(JSONRPC_INTERNAL_ERROR, "Note not found");

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
          or(ilike(notes.title, `%${query}%`), ilike(notes.content ?? sql``, `%${query}%`))
        ))
        .orderBy(desc(notes.updatedAt))
        .limit(20);
      return { items };
    },
  },
  {
    name: "domains.list",
    description: "List domains/workspaces",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const items = await db.select().from(domains).orderBy(asc(domains.name));
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
        results.tasks = await db.select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority }).from(tasks)
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
];

// ── Error helper ─────────────────────────────────────────────────────────────────

class JsonRpcErrorResponse extends Error {
  constructor(public code: number, message: string, public data?: unknown) {
    super(message);
    this.name = "JsonRpcErrorResponse";
  }
}

function makeError(code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", error: { code, message, data }, id: null };
}

function makeResult(result: unknown, id: string | number | null): JsonRpcResponse {
  return { jsonrpc: "2.0", result, id };
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
      return makeError(JSONRPC_INVALID_PARAMS, "Missing tool name", id);
    }

    const tool = tools.find(t => t.name === callParams.name);
    if (!tool) {
      return makeError(JSONRPC_METHOD_NOT_FOUND, `Unknown tool: ${callParams.name}`, id);
    }

    try {
      const result = await tool.handler(callParams.arguments || {}, auth);
      return makeResult({ content: [{ type: "text", text: JSON.stringify(result) }] }, id);
    } catch (error) {
      if (error instanceof JsonRpcErrorResponse) {
        return makeError(error.code, error.message, error.data);
      }
      console.error(`[MCP] Tool ${callParams.name} error:`, error);
      return makeError(JSONRPC_INTERNAL_ERROR, error instanceof Error ? error.message : "Internal error", id);
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
      return makeError(JSONRPC_INVALID_PARAMS, "Missing resource URI", id);
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

  return makeError(JSONRPC_METHOD_NOT_FOUND, `Unknown method: ${method}`, id);
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
