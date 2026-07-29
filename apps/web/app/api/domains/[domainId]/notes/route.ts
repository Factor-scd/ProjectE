// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, notes, noteTags, tags as tagsTable } from '@project-e/db';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { syncNoteLinks } from '@/lib/note-link-service';

const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional().nullable(),
  isPinned: z.boolean().optional().default(false),
  isArchived: z.boolean().optional().default(false),
  tagIds: z.array(z.string().uuid()).optional(),
});

type RouteContext = { params: Promise<{ domainId: string }> };

// GET /api/domains/[domainId]/notes — List notes with filtering
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const { searchParams } = new URL(request.url);
  const pinned = searchParams.get('pinned');
  const archived = searchParams.get('archived');
  const search = searchParams.get('search');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');
  const sort = searchParams.get('sort') || 'updated_at';
  const order = searchParams.get('order') || 'desc';

  const conditions: any[] = [
    eq(notes.domainId, domainId),
    isNull(notes.deletedAt),
  ];

  if (pinned === 'true') conditions.push(eq(notes.isPinned, true));
  if (archived === 'true') conditions.push(eq(notes.isArchived, true));
  else if (archived !== 'all') conditions.push(eq(notes.isArchived, false));
  if (search) conditions.push(ilike(notes.title, `%${search}%`));

  const orderFn = order === 'desc' ? desc : asc;
  let orderColumn;
  switch (sort) {
    case 'title': orderColumn = orderFn(notes.title); break;
    case 'created_at': orderColumn = orderFn(notes.createdAt); break;
    case 'is_pinned': orderColumn = orderFn(notes.isPinned); break;
    default: orderColumn = orderFn(notes.updatedAt); break;
  }

  const [items, countResult] = await Promise.all([
    db.select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset),
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

  return NextResponse.json({
    items: itemsWithTags,
    totalItems,
    limit,
    offset,
  });
});

// POST /api/domains/[domainId]/notes — Create a note
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = createNoteSchema.parse(body);

    const [note] = await db.insert(notes).values({
      title: data.title,
      content: data.content ?? null,
      domainId,
      isPinned: data.isPinned,
      isArchived: data.isArchived,
    }).returning();

    // Insert tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(noteTags).values(
        data.tagIds.map(tagId => ({ noteId: note.id, tagId }))
      );
    }

    // Sync wikilinks from content
    if (data.content) {
      await syncNoteLinks(note.id, data.content);
    }

    // Record activity
    await recordActivity({
      actor: user.name,
      action: 'created',
      entityType: 'note',
      entityId: note.id,
      changes: { title: note.title },
      workspaceId: domainId,
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[notes POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create note', 500);
  }
});
