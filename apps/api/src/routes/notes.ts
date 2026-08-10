import { Hono } from "hono";
import { db, notes, noteTags, tags as tagsTable, activityFeed } from "@project-e/db";
import { and, asc, desc, eq, exists, ilike, inArray, isNull, sql } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, createErrorResponse, resolveActiveDomain, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { enqueueWebhooks } from "../middleware/webhook-queue";
import { syncNoteLinks, getBacklinks, getOutgoingLinks } from "./note-link-service";
import { z } from "zod";

export const noteRoutes = new Hono();

const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().optional().nullable(),
  domain: z.string().min(1, "Domain is required"),
  isPinned: z.boolean().optional().default(false),
  isArchived: z.boolean().optional().default(false),
  tagIds: z.array(z.string().uuid()).optional(),
});

const updateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional().nullable(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

// GET /api/notes — List notes with filtering, sorting, pagination
noteRoutes.get("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "50")));
    const filter = url.searchParams.get("filter") || undefined;
    const sort = url.searchParams.get("sort") || "-updated_at";
    const pinned = url.searchParams.get("pinned");
    const archived = url.searchParams.get("archived");
    const tag = url.searchParams.get("tag");
    const search = url.searchParams.get("search");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const order = url.searchParams.get("order") || "desc";

    let domainId = url.searchParams.get("domain") || undefined;
    if (!domainId) {
      const active = await resolveActiveDomain(user);
      domainId = active.id;
    }

    await requireWorkspaceAccess(c, domainId);

    const conditions: any[] = [
      eq(notes.domainId, domainId),
      isNull(notes.deletedAt),
    ];

    if (pinned === "true") conditions.push(eq(notes.isPinned, true));
    if (archived === "true") conditions.push(eq(notes.isArchived, true));
    else if (archived !== "all") conditions.push(eq(notes.isArchived, false));
    if (search) conditions.push(ilike(notes.title, `%${search}%`));
    if (filter) conditions.push(ilike(notes.title, `%${filter}%`));
    // Tag filter applied in SQL (EXISTS on the junction table) so it runs over
    // the full dataset before pagination.
    if (tag) {
      const tagIds = tag.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagIds.length > 0) {
        conditions.push(
          exists(
            db.select({ one: sql`1` })
              .from(noteTags)
              .where(and(eq(noteTags.noteId, notes.id), inArray(noteTags.tagId, tagIds)))
          )
        );
      }
    }

    const sortDir = sort.startsWith("-") ? "desc" : "asc";
    const sortField = sort.replace(/^-/, "");
    const sortColumns: Record<string, any> = {
      title: notes.title,
      created_at: notes.createdAt,
      updated_at: notes.updatedAt,
      is_pinned: notes.isPinned,
    };
    const orderColumn = sortDir === "asc"
      ? asc(sortColumns[sortField] || notes.updatedAt)
      : desc(sortColumns[sortField] || notes.updatedAt);

    const [items, countResult] = await Promise.all([
      db.select()
        .from(notes)
        .where(and(...conditions))
        .orderBy(orderColumn)
        .limit(limit || perPage)
        .offset(offset || (page - 1) * perPage),
      db.select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(and(...conditions)),
    ]);

    const totalItems = Number(countResult[0]?.count || 0);

    // Fetch tags for all notes
    let noteTagMap = new Map<string, { id: string; name: string; color: string | null }[]>();
    if (items.length > 0) {
      const noteIds = items.map(n => n.id);
      const tagRows = await db.select({
        noteId: noteTags.noteId,
        id: tagsTable.id,
        name: tagsTable.name,
        color: tagsTable.color,
      })
        .from(noteTags)
        .innerJoin(tagsTable, eq(noteTags.tagId, tagsTable.id))
        .where(inArray(noteTags.noteId, noteIds));

      for (const row of tagRows) {
        if (!noteTagMap.has(row.noteId)) noteTagMap.set(row.noteId, []);
        noteTagMap.get(row.noteId)!.push({ id: row.id, name: row.name, color: row.color });
      }
    }

    const itemsWithTags = items.map(n => ({
      ...n,
      tags: noteTagMap.get(n.id) || [],
    }));

    return c.json({
      items: itemsWithTags,
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
    console.error("[notes] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list notes" } }, 500);
  }
});

// POST /api/notes — Create a note
noteRoutes.post("/", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const data = createNoteSchema.parse({
      ...body,
      domain: body.domain || (await resolveActiveDomain(user)).id,
    });

    await requireWorkspaceAccess(c, data.domain);

    const [note] = await db.insert(notes).values({
      title: data.title,
      content: data.content ?? null,
      domainId: data.domain,
      isPinned: data.isPinned,
      isArchived: data.isArchived,
    }).returning();

    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(noteTags).values(
        data.tagIds.map(tagId => ({ noteId: note.id, tagId }))
      );
    }

    // Sync wikilinks from content
    if (data.content) {
      await syncNoteLinks(note.id, data.content);
    }

    await recordActivity({
      actor: user.name,
      action: "created",
      entityType: "note",
      entityId: note.id,
      changes: { title: note.title },
      workspaceId: data.domain,
    });

    await enqueueWebhooks({ workspaceId: data.domain, event: "note.created", entityType: "note", entityId: note.id, data: { title: note.title } });

    return c.json(note, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[notes] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create note" } }, 500);
  }
});

// GET /api/notes/:id — Get a single note with backlinks
noteRoutes.get("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const [note] = await db.select()
      .from(notes)
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
      .limit(1);

    if (!note) {
      return c.json({ error: { code: "NOT_FOUND", message: "Note not found" } }, 404);
    }

    await requireWorkspaceAccess(c, note.domainId);

    // Fetch tags
    const tagRows = await db.select({
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
    })
      .from(noteTags)
      .innerJoin(tagsTable, eq(noteTags.tagId, tagsTable.id))
      .where(eq(noteTags.noteId, id));

    // Fetch backlinks and outgoing links
    const [backlinks, outgoingLinks] = await Promise.all([
      getBacklinks(id),
      getOutgoingLinks(id),
    ]);

    return c.json({
      ...note,
      tags: tagRows,
      backlinks,
      outgoingLinks,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notes] GET/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get note" } }, 500);
  }
});

// PATCH /api/notes/:id — Update a note
noteRoutes.patch("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateNoteSchema.parse(body);

    const [existing] = await db.select()
      .from(notes)
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Note not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

    const updateValues: Record<string, unknown> = {};
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.content !== undefined) updateValues.content = data.content;
    if (data.isPinned !== undefined) updateValues.isPinned = data.isPinned;
    if (data.isArchived !== undefined) updateValues.isArchived = data.isArchived;
    updateValues.updatedAt = new Date();

    const [updated] = await db.update(notes)
      .set(updateValues)
      .where(eq(notes.id, id))
      .returning();

    // Re-sync wikilinks if content changed
    const content = data.content ?? existing.content;
    if (content) {
      await syncNoteLinks(id, content);
    }

    await recordActivity({
      actor: user.name,
      action: "updated",
      entityType: "note",
      entityId: id,
      changes: { ...data, previousTitle: existing.title },
      workspaceId: existing.domainId,
    });

    await enqueueWebhooks({ workspaceId: existing.domainId, event: "note.updated", entityType: "note", entityId: id, data: { ...data, previousTitle: existing.title } });

    return c.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[notes] PATCH error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to update note" } }, 500);
  }
});

// DELETE /api/notes/:id — Soft delete a note
noteRoutes.delete("/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const [existing] = await db.select()
      .from(notes)
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
      .limit(1);

    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Note not found" } }, 404);
    }

    await requireWorkspaceAccess(c, existing.domainId);

    await db.update(notes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(notes.id, id));

    await recordActivity({
      actor: user.name,
      action: "deleted",
      entityType: "note",
      entityId: id,
      changes: { title: existing.title },
      workspaceId: existing.domainId,
    });

    await enqueueWebhooks({ workspaceId: existing.domainId, event: "note.deleted", entityType: "note", entityId: id, data: { title: existing.title } });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notes] DELETE error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete note" } }, 500);
  }
});

// POST /api/notes/:id/tags — Assign a tag to a note
noteRoutes.post("/:id/tags", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const { tagId } = z.object({ tagId: z.string().uuid("Invalid tag id") }).parse(body);

    const [note] = await db.select({ id: notes.id, domainId: notes.domainId })
      .from(notes)
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
      .limit(1);
    if (!note) {
      return c.json({ error: { code: "NOT_FOUND", message: "Note not found" } }, 404);
    }

    await requireWorkspaceAccess(c, note.domainId);

    const [tag] = await db.select({ id: tagsTable.id, name: tagsTable.name })
      .from(tagsTable)
      .where(eq(tagsTable.id, tagId))
      .limit(1);
    if (!tag) {
      return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);
    }

    // Junction table has a composite PK — ignore re-assigns instead of erroring
    await db.insert(noteTags).values({ noteId: id, tagId }).onConflictDoNothing();

    await recordActivity({
      actor: user.name,
      action: "tagged",
      entityType: "note",
      entityId: id,
      changes: { tagId, tagName: tag.name },
      workspaceId: note.domainId,
    });

    return c.json({ success: true }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[notes] POST /:id/tags error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to assign tag" } }, 500);
  }
});

// DELETE /api/notes/:id/tags/:tagId — Remove a tag from a note
noteRoutes.delete("/:id/tags/:tagId", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const tagId = c.req.param("tagId");

    const [note] = await db.select({ id: notes.id, domainId: notes.domainId })
      .from(notes)
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
      .limit(1);
    if (!note) {
      return c.json({ error: { code: "NOT_FOUND", message: "Note not found" } }, 404);
    }

    await requireWorkspaceAccess(c, note.domainId);

    // Junction tables have no deleted_at — hard delete is correct here
    await db.delete(noteTags).where(and(eq(noteTags.noteId, id), eq(noteTags.tagId, tagId)));

    await recordActivity({
      actor: user.name,
      action: "untagged",
      entityType: "note",
      entityId: id,
      changes: { tagId },
      workspaceId: note.domainId,
    });

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notes] DELETE /:id/tags/:tagId error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove tag" } }, 500);
  }
});

// GET /api/notes/:id/backlinks — Notes that link TO this one
noteRoutes.get("/:id/backlinks", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const [note] = await db.select({ id: notes.id, domainId: notes.domainId })
      .from(notes)
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
      .limit(1);

    if (!note) {
      return c.json({ error: { code: "NOT_FOUND", message: "Note not found" } }, 404);
    }

    await requireWorkspaceAccess(c, note.domainId);

    const backlinks = await getBacklinks(id);

    return c.json({
      items: backlinks,
      totalItems: backlinks.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notes] GET /:id/backlinks error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get backlinks" } }, 500);
  }
});

// GET /api/notes/:id/versions — Edit history (from activity feed)
noteRoutes.get("/:id/versions", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");

    const [note] = await db.select({ id: notes.id, domainId: notes.domainId })
      .from(notes)
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
      .limit(1);

    if (!note) {
      return c.json({ error: { code: "NOT_FOUND", message: "Note not found" } }, 404);
    }

    await requireWorkspaceAccess(c, note.domainId);

    const versions = await db.select()
      .from(activityFeed)
      .where(and(
        eq(activityFeed.entityId, id),
        eq(activityFeed.entityType, "note"),
        eq(activityFeed.workspaceId, note.domainId),
      ))
      .orderBy(desc(activityFeed.createdAt))
      .limit(100);

    return c.json({ items: versions, totalItems: versions.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[notes] GET /:id/versions error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get versions" } }, 500);
  }
});
