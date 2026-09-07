import { Hono } from "hono";
import { db, states, projects } from "@project-e/db";
import { asc, eq, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { z } from "zod";

export const stateRoutes = new Hono();

const stateGroupEnum = z.enum(["backlog", "unstarted", "started", "completed", "cancelled"]);

const createStateSchema = z.object({
  projectId: z.string().uuid("Invalid project id"),
  name: z.string().min(1, "Name is required"),
  group: stateGroupEnum.optional().default("unstarted"),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateStateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  group: stateGroupEnum.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  projectId: z.string().uuid("Invalid project id"),
  orderedIds: z.array(z.string().uuid("Invalid state id")),
});

/**
 * Resolve a project and verify the user has access to the owning workspace.
 * Returns the project row on success, throws AuthError otherwise.
 */
async function resolveProject(c: any, projectId: string, user: { name: string }) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new AuthError("Project not found", 404, "NOT_FOUND");
  }

  await requireWorkspaceAccess(c, project.domainId);
  return project;
}

// POST /api/states/reorder — bulk reorder states within a project
// This MUST be registered before /:id routes to avoid route conflicts.
stateRoutes.post("/reorder", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = reorderSchema.parse(body);

    const project = await resolveProject(c, data.projectId, user);

    // Verify all state IDs belong to this project
    const existingStates = await db
      .select({ id: states.id })
      .from(states)
      .where(eq(states.projectId, data.projectId));

    const validIds = new Set(existingStates.map((s) => s.id));
    const invalidIds = data.orderedIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: `Invalid state ids: ${invalidIds.join(", ")}` } },
        400
      );
    }

    // Assign sortOrder 0..n-1 in one transaction
    await db.transaction(async (tx) => {
      for (let i = 0; i < data.orderedIds.length; i++) {
        await tx
          .update(states)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(eq(states.id, data.orderedIds[i]));
      }
    });

    await recordActivity({
      actor: user.name,
      action: "reordered",
      entityType: "state",
      entityId: data.projectId,
      changes: { orderedIds: data.orderedIds },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({
      workspaceId: project.domainId,
      event: "state.reordered",
      entityType: "state",
      entityId: data.projectId,
      data: { orderedIds: data.orderedIds },
    });

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[states] POST /reorder error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to reorder states" } }, 500);
  }
});

// GET /api/states?projectId=<uuid> — list states for a project
stateRoutes.get("/", async (c) => {
  try {
    await requireAuth(c);
    const url = new URL(c.req.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId || !isUuid(projectId)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "A valid projectId query parameter is required" } }, 400);
    }

    const project = await resolveProject(c, projectId, { name: "" });

    const items = await db
      .select()
      .from(states)
      .where(eq(states.projectId, projectId))
      .orderBy(asc(states.sortOrder));

    return c.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[states] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list states" } }, 500);
  }
});

// POST /api/states — create a state
stateRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createStateSchema.parse(body);

    const project = await resolveProject(c, data.projectId, user);

    // If no sortOrder provided, default to max+1 within the project
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const [result] = await db
        .select({ maxSort: sql<number>`coalesce(max(${states.sortOrder}), -1) + 1` })
        .from(states)
        .where(eq(states.projectId, data.projectId));
      sortOrder = result.maxSort;
    }

    const [state] = await db
      .insert(states)
      .values({
        name: data.name,
        group: data.group,
        color: data.color ?? null,
        projectId: data.projectId,
        sortOrder,
      })
      .returning();

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "state",
      entityId: state.id,
      changes: { name: state.name, group: state.group, color: state.color },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({
      workspaceId: project.domainId,
      event: "state.created",
      entityType: "state",
      entityId: state.id,
      data: { name: state.name, group: state.group },
    });

    return c.json(state, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[states] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create state" } }, 500);
  }
});

// GET /api/states/:id — get a single state
stateRoutes.get("/:id", async (c) => {
  try {
    await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [state] = await db
      .select()
      .from(states)
      .where(eq(states.id, id))
      .limit(1);

    if (!state) {
      return c.json({ error: { code: "NOT_FOUND", message: "State not found" } }, 404);
    }

    await resolveProject(c, state.projectId, { name: "" });

    return c.json(state);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[states] GET/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get state" } }, 500);
  }
});

// PATCH /api/states/:id — update a state
stateRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    const body = await c.req.json();
    const data = updateStateSchema.parse(body);

    const [existing] = await db
      .select()
      .from(states)
      .where(eq(states.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "State not found" } }, 404);
    }

    const project = await resolveProject(c, existing.projectId, user);

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.color !== undefined) updateValues.color = data.color;
    if (data.group !== undefined) updateValues.group = data.group;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;
    updateValues.updatedAt = new Date();

    const [updated] = await db
      .update(states)
      .set(updateValues)
      .where(eq(states.id, id))
      .returning();

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "state",
      entityId: id,
      changes: { ...data, previousName: existing.name },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({
      workspaceId: project.domainId,
      event: "state.updated",
      entityType: "state",
      entityId: id,
      data: { ...data, previousName: existing.name },
    });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[states] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update state" } }, 500);
  }
});

// DELETE /api/states/:id — delete a state
// NOTE: The states table has no deleted_at column, so this is a hard delete.
stateRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }

    const [existing] = await db
      .select()
      .from(states)
      .where(eq(states.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "State not found" } }, 404);
    }

    const project = await resolveProject(c, existing.projectId, user);

    await db.delete(states).where(eq(states.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "state",
      entityId: id,
      changes: { name: existing.name, group: existing.group },
      workspaceId: project.domainId,
    });

    await enqueueWebhooks({
      workspaceId: project.domainId,
      event: "state.deleted",
      entityType: "state",
      entityId: id,
      data: { name: existing.name },
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[states] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete state" } }, 500);
  }
});
