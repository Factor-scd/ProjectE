import { Hono } from "hono";
import {
  db,
  comments,
  tasks,
  projects,
  habits,
  notes,
  dailyNotes,
  calendarEvents,
} from "@project-e/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import { requireAuth, requireWorkspaceAccess, createErrorResponse, AuthError, isUuid } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const commentRoutes = new Hono();

// Entity types that support comments. Keep in sync with entityWorkspaceLookups.
const entityTypeEnum = z.enum(["task", "project", "habit", "note", "daily_note", "calendar_event"]);

interface EntityWorkspaceLookup {
  table: AnyPgTable;
  idColumn: AnyPgColumn;
  workspaceColumn: AnyPgColumn;
}

// Maps an entityType (as recorded in comments.entityType) to the table + column
// that holds its owning workspace/domain. All of these tables use domain_id.
const entityWorkspaceLookups: Record<string, EntityWorkspaceLookup> = {
  task: { table: tasks, idColumn: tasks.id, workspaceColumn: tasks.domainId },
  project: { table: projects, idColumn: projects.id, workspaceColumn: projects.domainId },
  habit: { table: habits, idColumn: habits.id, workspaceColumn: habits.domainId },
  note: { table: notes, idColumn: notes.id, workspaceColumn: notes.domainId },
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

const createCommentSchema = z.object({
  entityType: entityTypeEnum,
  entityId: z.string().uuid(),
  content: z.string().min(1, "Content is required"),
  parentId: z.string().uuid().optional(),
});

// GET /api/comments?entityType=&entityId= — Flat list of non-deleted comments
// for an entity, ordered oldest-first. The frontend assembles the reply tree
// from parentId.
commentRoutes.get("/", async (c) => {
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

    const items = await db.select()
      .from(comments)
      .where(and(
        eq(comments.entityType, entityType),
        eq(comments.entityId, entityId),
        eq(comments.workspaceId, domainId),
        isNull(comments.deletedAt),
      ))
      .orderBy(asc(comments.createdAt));

    return c.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[comments] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get comments" } }, 500);
  }
});

// POST /api/comments — Create a comment (or a reply via parentId).
commentRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createCommentSchema.parse(body);

    const domainId = await resolveEntityWorkspaceId(data.entityType, data.entityId);
    if (!domainId) {
      return c.json(createErrorResponse("NOT_FOUND", "Entity not found"), 404);
    }
    await requireWorkspaceAccess(c, domainId);

    if (data.parentId) {
      const [parent] = await db.select({
        id: comments.id,
        entityType: comments.entityType,
        entityId: comments.entityId,
        deletedAt: comments.deletedAt,
      })
        .from(comments)
        .where(eq(comments.id, data.parentId))
        .limit(1);

      if (!parent || parent.deletedAt !== null || parent.entityType !== data.entityType || parent.entityId !== data.entityId) {
        return c.json(createErrorResponse("VALIDATION_ERROR", "Parent comment not found or does not belong to this entity"), 400);
      }
    }

    const [newComment] = await db.insert(comments).values({
      entityType: data.entityType,
      entityId: data.entityId,
      workspaceId: domainId,
      parentId: data.parentId ?? null,
      author: user.name,
      content: data.content.trim(),
    }).returning();

    await recordActivity({
      actor: user.name,
      action: "commented",
      entityType: data.entityType,
      entityId: data.entityId,
      changes: { commentId: newComment.id },
      workspaceId: domainId,
    });

    return c.json(newComment, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[comments] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create comment" } }, 500);
  }
});

// DELETE /api/comments/:id — Soft-delete a comment and all of its descendants.
commentRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    if (!isUuid(id)) {
      return c.json(createErrorResponse("NOT_FOUND", "Resource not found"), 404);
    }

    const [comment] = await db.select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);

    if (!comment) {
      return c.json(createErrorResponse("NOT_FOUND", "Comment not found"), 404);
    }

    await requireWorkspaceAccess(c, comment.workspaceId);

    // Soft-delete the comment and every descendant. Comment volume is low, so a
    // loop over parentId is fine.
    const deletedAt = new Date();
    const idsToDelete = [id];
    let frontier: string[] = [id];
    while (frontier.length > 0) {
      const children = await db.select({ id: comments.id })
        .from(comments)
        .where(inArray(comments.parentId, frontier));
      frontier = children
        .map(child => child.id)
        .filter(childId => !idsToDelete.includes(childId));
      idsToDelete.push(...frontier);
    }

    await db.update(comments)
      .set({ deletedAt })
      .where(inArray(comments.id, idsToDelete));

    await recordActivity({
      actor: user.name,
      action: "deleted_comment",
      entityType: comment.entityType,
      entityId: comment.entityId,
      changes: { commentId: id },
      workspaceId: comment.workspaceId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[comments] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete comment" } }, 500);
  }
});
