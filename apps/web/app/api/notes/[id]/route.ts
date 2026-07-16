import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { updateNoteSchema } from '@project-e/shared';
import { syncNoteLinks, syncNoteTasks, getBacklinks } from '@/lib/services';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/notes/[id] — Get a single note with backlinks
export const GET = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  const note = await pb.collection('notes').getOne(id);
  const backlinks = await getBacklinks(id);

  return NextResponse.json({
    ...note,
    backlinks,
  });
});

// PATCH /api/notes/[id] — Update a note, then re-sync links and tasks
export const PATCH = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const data = updateNoteSchema.parse(body);

    const pb = createPocketBaseClient();
    const note = await pb.collection('notes').update(id, data);

    // Re-sync wikilinks and checkbox tasks from content
    const content = data.content ?? note.content;
    if (content) {
      await syncNoteLinks(id, content);
      await syncNoteTasks(id, content);
    }

    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});

// DELETE /api/notes/[id] — Delete a note
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, _user, context) => {
  const { id } = await context!.params;

  const pb = createPocketBaseClient();
  await pb.collection('notes').delete(id);

  return new NextResponse(null, { status: 204 });
});
