// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, notes, noteTags, tags as tagsTable } from '@project-e/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { syncNoteLinks, getBacklinks, getOutgoingLinks } from '@/lib/note-link-service';

const updateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional().nullable(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// GET /api/domains/[domainId]/notes/[id] — Get a single note with computed links
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [note] = await db.select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.domainId, domainId), isNull(notes.deletedAt)))
    .limit(1);

  if (!note) {
    return createErrorResponse('NOT_FOUND', 'Note not found', 404);
  }

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

  return NextResponse.json({
    ...note,
    tags: tagRows,
    backlinks,
    outgoingLinks,
  });
});

// PATCH /api/domains/[domainId]/notes/[id] — Update a note, re-parse wikilinks
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = updateNoteSchema.parse(body);

    const [existing] = await db.select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.domainId, domainId), isNull(notes.deletedAt)))
      .limit(1);

    if (!existing) {
      return createErrorResponse('NOT_FOUND', 'Note not found', 404);
    }

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
      action: 'updated',
      entityType: 'note',
      entityId: id,
      changes: { ...data, previousTitle: existing.title },
      workspaceId: domainId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[notes PATCH] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update note', 500);
  }
});

// DELETE /api/domains/[domainId]/notes/[id] — Soft delete a note
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const [existing] = await db.select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.domainId, domainId), isNull(notes.deletedAt)))
    .limit(1);

  if (!existing) {
    return createErrorResponse('NOT_FOUND', 'Note not found', 404);
  }

  await db.update(notes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(notes.id, id));

  await recordActivity({
    actor: user.name,
    action: 'deleted',
    entityType: 'note',
    entityId: id,
    changes: { title: existing.title },
    workspaceId: domainId,
  });

  return new NextResponse(null, { status: 204 });
});
