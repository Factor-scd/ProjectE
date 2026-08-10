import { Hono } from "hono";
import {
  db,
  activityFeed,
  tasks,
  projects,
  habits,
  notes,
  canvases,
  dailyNotes,
  calendarEvents,
} from "@project-e/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import { requireAuth, requireWorkspaceAccess, createErrorResponse, AuthError, isUuid } from "../middleware/auth";
import { z } from "zod";

export const activityRoutes = new Hono();

// Entity types that participate in the generic activity feed / comments API.
// The comments table stores the same entityType strings, so keep this enum and
// the entityWorkspaceLookups map below in sync.
const entityTypeEnum = z.enum(["task", "project", "habit", "note", "canvas", "daily_note", "calendar_event"]);

interface EntityWorkspaceLookup {
  table: AnyPgTable;
  idColumn: AnyPgColumn;
  workspaceColumn: AnyPgColumn;
}

// Maps an entityType (as recorded in activity_feed) to the table + column that
// holds its owning workspace/domain. All of these tables use domain_id.
const entityWorkspaceLookups: Record<string, EntityWorkspaceLookup> = {
  task: { table: tasks, idColumn: tasks.id, workspaceColumn: tasks.domainId },
  project: { table: projects, idColumn: projects.id, workspaceColumn: projects.domainId },
  habit: { table: habits, idColumn: habits.id, workspaceColumn: habits.domainId },
  note: { table: notes, idColumn: notes.id, workspaceColumn: notes.domainId },
  canvas: { table: canvases, idColumn: canvases.id, workspaceColumn: canvases.domainId },
  daily_note: { table: dailyNotes, idColumn: dailyNotes.id, workspaceColumn: dailyNotes.domainId },
  calendar_event: { table: calendarEvents, idColumn: calendarEvents.id, workspaceColumn: calendarEvents.domainId },
};

async function resolveEntityWorkspaceId(entityType: string, entityId: string): Promise<string | null> {
  const lookup = entityWorkspaceLookups[entityType];
  if (!lookup) return null;

  const [row] = await db
    .select({ workspaceId: lookup.workspaceColumn })
    .from(lookup.table)
    .where(eq(lookup.idColumn, entityId))
    .limit(1);

  // AnyPgColumn erases the concrete column type, so the selected value is unknown.
  return (row?.workspaceId as string | undefined) ?? null;
}

// GET /api/activity?entityType=&entityId=&limit= — Activity feed for one entity.
activityRoutes.get("/", async (c) => {
  try {
    await requireAuth(c);
    const entityType = c.req.query("entityType") || "";
    const entityId = c.req.query("entityId") || "";

    const entityTypeResult = entityTypeEnum.safeParse(entityType);
    if (!entityTypeResult.success) {
      return c.json(createErrorResponse("VALIDATION_ERROR", "Invalid entityType"), 400);
    }
    if (!isUuid(entityId)) {
      return c.json(createErrorResponse("NOT_FOUND", "Resource not found"), 404);
    }

    const domainId = await resolveEntityWorkspaceId(entityType, entityId);
    if (!domainId) {
      return c.json(createErrorResponse("NOT_FOUND", "Entity not found"), 404);
    }
    await requireWorkspaceAccess(c, domainId);

    const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "50", 10) || 50, 1), 200);
    const conditions = [
      eq(activityFeed.entityType, entityType),
      eq(activityFeed.entityId, entityId),
      eq(activityFeed.workspaceId, domainId),
    ];

    const [items, countResult] = await Promise.all([
      db.select()
        .from(activityFeed)
        .where(and(...conditions))
        .orderBy(desc(activityFeed.createdAt))
        .limit(limit),
      db.select({ count: sql<number>`count(*)` })
        .from(activityFeed)
        .where(and(...conditions)),
    ]);

    return c.json({ items, totalItems: Number(countResult[0]?.count || 0) });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[activity] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get activity" } }, 500);
  }
});
