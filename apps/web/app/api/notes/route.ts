import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { createNoteSchema } from '@project-e/shared';
import { syncNoteLinks, syncNoteTasks } from '@/lib/services';
import { z } from 'zod';

// GET /api/notes — List notes with filtering, sorting, pagination
export const GET = withAuth(async (request: NextRequest, _user) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('perPage') || '50');
  const filter = searchParams.get('filter') || '';
  const sort = searchParams.get('sort') || '-created';

  const pb = createPocketBaseClient();
  const result = await pb.collection('notes').getList(page, perPage, {
    filter,
    sort,
  });

  const response = NextResponse.json({
    items: result.items,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
    page: result.page,
    perPage: result.perPage,
  });

  // Cache for 60 seconds with stale-while-revalidate
  response.headers.set(
    'Cache-Control',
    'private, max-age=60, stale-while-revalidate=300'
  );

  return response;
});

// POST /api/notes — Create a note, then sync links and tasks
export const POST = withAuth(async (request: NextRequest, _user) => {
  try {
    const body = await request.json();
    const data = createNoteSchema.parse(body);

    const pb = createPocketBaseClient();
    const note = await pb.collection('notes').create(data);

    // Sync wikilinks and checkbox tasks from content
    if (data.content) {
      await syncNoteLinks(note.id, data.content);
      await syncNoteTasks(note.id, data.content);
    }

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    throw error;
  }
});
