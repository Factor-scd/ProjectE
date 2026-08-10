import { Hono } from "hono";
import { db, agents, agentActivity, agentTasks } from "@project-e/db";
import { and, asc, desc, eq, gte, ilike, isNull, lte, sql } from "drizzle-orm";
import { requireAuth, createErrorResponse, resolveActiveDomain, requireWorkspaceAccess, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const agentRoutes = new Hono();

const createAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "disabled"]).optional().default("active"),
  permissionTier: z.enum(["full_access", "read_only", "content_creator", "task_manager", "custom"]).optional().default("read_only"),
  customPermissions: z.array(z.string()).optional().default([]),
  domain: z.string().min(1, "Domain is required"),
  tags: z.array(z.string()).optional().default([]),
  config: z.record(z.string(), z.unknown()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "disabled"]).optional(),
  permissionTier: z.enum(["full_access", "read_only", "content_creator", "task_manager", "custom"]).optional(),
  customPermissions: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

// ── Activity filter helpers ──────────────────────────────────────────────────
// GET /activity and GET /:id/activity honor the `action`, `from`, `to` and
// `limit` query params the frontend activity page sends. Invalid dates are
// ignored rather than erroring; a bare "YYYY-MM-DD" bounds the whole day for
// the `to` filter so a date-picker value doesn't silently drop that day.

function parseActivityDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
  return date;
}

function parseActivityFilters(c: any): { conditions: any[]; limit: number } {
  const conditions: any[] = [];
  const action = c.req.query("action");
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (action) conditions.push(eq(agentActivity.action, action));
  const fromDate = from ? parseActivityDate(from) : null;
  if (fromDate) conditions.push(gte(agentActivity.createdAt, fromDate));
  const toDate = to ? parseActivityDate(to) : null;
  if (toDate) conditions.push(lte(agentActivity.createdAt, toDate));
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "100", 10) || 100, 1), 500);
  return { conditions, limit };
}

// GET /api/agents — List agents
agentRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "50")));
    const sort = url.searchParams.get("sort") || "-created";
    const q = url.searchParams.get("q")?.trim();
    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }
    await requireWorkspaceAccess(c, domainId);

    const conditions: any[] = [eq(agents.domainId, domainId)];
    if (q) conditions.push(ilike(agents.name, `%${q}%`));
    const sortField = sort.replace(/^-/, "");
    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortColumns: Record<string, any> = { created: agents.createdAt, updated: agents.updatedAt, name: agents.name };
    const orderColumn = sortDir === "asc" ? asc(sortColumns[sortField] || agents.createdAt) : desc(sortColumns[sortField] || agents.createdAt);

    const [items, countResult] = await Promise.all([
      db.select().from(agents).where(and(...conditions)).orderBy(orderColumn).limit(perPage).offset((page - 1) * perPage),
      db.select({ count: sql<number>`count(*)` }).from(agents).where(and(...conditions)),
    ]);

    return c.json({ items, totalItems: Number(countResult[0]?.count || 0), totalPages: Math.ceil(Number(countResult[0]?.count || 0) / perPage), page, perPage });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[agents] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list agents" } }, 500);
  }
});

// POST /api/agents — Create
agentRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createAgentSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    await requireWorkspaceAccess(c, data.domain);

    const [agent] = await db.insert(agents).values({
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      permissionTier: data.permissionTier,
      customPermissions: data.customPermissions ?? [],
      apiKey: crypto.randomUUID(),
      domainId: data.domain,
      tags: data.tags ?? [],
      config: data.config ?? {},
      customFields: data.customFields ?? {},
    }).returning();

    await recordActivity({
      actor: user.name, action: "created", entityType: "agent", entityId: agent.id,
      changes: { name: agent.name }, workspaceId: data.domain,
    });

    return c.json(agent, 201);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[agents] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create agent" } }, 500);
  }
});


// GET /api/agents/activity — All activity (bare path, no agent filter)
agentRoutes.get("/activity", async (c) => {
  try {
    const user = await requireAuth(c);
    // agent_activity has no domain_id — scope through the owning agent
    const domainId = c.req.query("domain") || (await resolveActiveDomain(user)).id;
    await requireWorkspaceAccess(c, domainId);
    const { conditions: filterConditions, limit } = parseActivityFilters(c);
    const items = await db.select({
      id: agentActivity.id,
      agentId: agentActivity.agentId,
      action: agentActivity.action,
      entityType: agentActivity.entityType,
      entityId: agentActivity.entityId,
      details: agentActivity.details,
      success: agentActivity.success,
      errorMessage: agentActivity.errorMessage,
      createdAt: agentActivity.createdAt,
    })
      .from(agentActivity)
      .innerJoin(agents, eq(agentActivity.agentId, agents.id))
      .where(and(eq(agents.domainId, domainId), ...filterConditions))
      .orderBy(desc(agentActivity.createdAt))
      .limit(limit);
    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[agents] GET /activity error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get activity" } }, 500);
  }
});


// GET /api/agents/:id — Read
agentRoutes.get("/:id", async (c) => {
  try {
    await requireAuth(c);
    const id = c.req.param("id");
    // Guard: /:id must be a UUID. Hono matches /:id before /activity when the
    // param path was registered first; without this guard we get a Postgres
    // "invalid input syntax for type uuid" 500 on /api/agents/activity.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, 404);
    }
    const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (!agent) return c.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, 404);
    await requireWorkspaceAccess(c, agent.domainId);
    return c.json(agent);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[agents] GET /:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get agent" } }, 500);
  }
});

// PATCH /api/agents/:id — Update
agentRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateAgentSchema.parse(body);

    const [existing] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, 404);

    await requireWorkspaceAccess(c, existing.domainId);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.permissionTier !== undefined) updateValues.permissionTier = data.permissionTier;
    if (data.customPermissions !== undefined) updateValues.customPermissions = data.customPermissions;
    if (data.tags !== undefined) updateValues.tags = data.tags;
    if (data.config !== undefined) updateValues.config = data.config;
    if (data.customFields !== undefined) updateValues.customFields = data.customFields;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(agents).set(updateValues).where(eq(agents.id, id)).returning();

    await recordActivity({
      actor: user.name, action: "updated", entityType: "agent", entityId: id,
      changes: { name: updated.name }, workspaceId: existing.domainId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[agents] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update agent" } }, 500);
  }
});

// DELETE /api/agents/:id — Delete
agentRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const [existing] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, 404);

    await requireWorkspaceAccess(c, existing.domainId);

    await db.delete(agents).where(eq(agents.id, id));

    await recordActivity({
      actor: user.name, action: "deleted", entityType: "agent", entityId: id,
      changes: { name: existing.name }, workspaceId: existing.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[agents] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete agent" } }, 500);
  }
});

// POST /api/agents/:id/permissions — Set permissions
agentRoutes.post("/:id/permissions", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const { permissionTier, customPermissions } = z.object({
      permissionTier: z.enum(["full_access", "read_only", "content_creator", "task_manager", "custom"]),
      customPermissions: z.array(z.string()).optional().default([]),
    }).parse(body);

    const [existing] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (!existing) return c.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, 404);
    await requireWorkspaceAccess(c, existing.domainId);

    const [updated] = await db.update(agents)
      .set({ permissionTier, customPermissions: customPermissions ?? [], updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();

    await recordActivity({
      actor: user.name, action: "updated", entityType: "agent", entityId: id,
      changes: { permissionTier }, workspaceId: updated.domainId,
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    if (error instanceof z.ZodError) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    console.error("[agents] POST /:id/permissions error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to set permissions" } }, 500);
  }
});

// GET /api/agents/:id/permissions — Get permissions
agentRoutes.get("/:id/permissions", async (c) => {
  try {
    await requireAuth(c);
    const id = c.req.param("id");
    const [agent] = await db.select({
      id: agents.id, permissionTier: agents.permissionTier, customPermissions: agents.customPermissions, domainId: agents.domainId,
    }).from(agents).where(eq(agents.id, id)).limit(1);

    if (!agent) return c.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, 404);
    await requireWorkspaceAccess(c, agent.domainId);
    return c.json({ id: agent.id, permissionTier: agent.permissionTier, customPermissions: agent.customPermissions });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[agents] GET /:id/permissions error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get permissions" } }, 500);
  }
});

// GET /api/agents/:id/activity — Agent activity log (or all if id=_all)
agentRoutes.get("/:id/activity", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    if (id === "_all") {
      // agent_activity has no domain_id — scope through the owning agent
      const domainId = c.req.query("domain") || (await resolveActiveDomain(user)).id;
      await requireWorkspaceAccess(c, domainId);
      const { conditions: filterConditions, limit } = parseActivityFilters(c);
      const items = await db.select({
        id: agentActivity.id,
        agentId: agentActivity.agentId,
        action: agentActivity.action,
        entityType: agentActivity.entityType,
        entityId: agentActivity.entityId,
        details: agentActivity.details,
        success: agentActivity.success,
        errorMessage: agentActivity.errorMessage,
        createdAt: agentActivity.createdAt,
      })
        .from(agentActivity)
        .innerJoin(agents, eq(agentActivity.agentId, agents.id))
        .where(and(eq(agents.domainId, domainId), ...filterConditions))
        .orderBy(desc(agentActivity.createdAt))
        .limit(limit);
      return c.json({ items, totalItems: items.length });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, 404);
    }

    const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    if (!agent) return c.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, 404);
    await requireWorkspaceAccess(c, agent.domainId);

    const { conditions: filterConditions, limit } = parseActivityFilters(c);
    const items = await db.select()
      .from(agentActivity)
      .where(and(eq(agentActivity.agentId, id), ...filterConditions))
      .orderBy(desc(agentActivity.createdAt))
      .limit(limit);
    return c.json({ items, totalItems: items.length });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[agents] GET /:id/activity error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get agent activity" } }, 500);
  }
});
