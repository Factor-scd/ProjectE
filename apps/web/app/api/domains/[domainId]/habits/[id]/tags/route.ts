// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse, ApiError } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { db, habits, habitTags, tags as tagsTable } from '@project-e/db';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

const tagActionSchema = z.object({
  tagId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ domainId: string; id: string }> };

// POST /api/domains/[domainId]/habits/[id]/tags — Add a tag to a habit
export const POST = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = tagActionSchema.parse(body);

    // Verify habit exists
    const [habit] = await db.select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.domainId, domainId), isNull(habits.deletedAt)))
      .limit(1);

    if (!habit) {
      return createErrorResponse('NOT_FOUND', 'Habit not found', 404);
    }

    // Verify tag exists
    const [tag] = await db.select()
      .from(tagsTable)
      .where(eq(tagsTable.id, data.tagId))
      .limit(1);

    if (!tag) {
      return createErrorResponse('NOT_FOUND', 'Tag not found', 404);
    }

    // Check if already tagged
    const [existing] = await db.select()
      .from(habitTags)
      .where(and(eq(habitTags.habitId, id), eq(habitTags.tagId, data.tagId)))
      .limit(1);

    if (existing) {
      return createErrorResponse('CONFLICT', 'Tag already added to this habit', 409);
    }

    await db.insert(habitTags).values({ habitId: id, tagId: data.tagId });

    await recordActivity({
      actor: user.name,
      action: 'tag_added',
      entityType: 'habit',
      entityId: id,
      changes: { tagId: data.tagId, tagName: tag.name },
      workspaceId: domainId,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[habit tags POST] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to add tag', 500);
  }
});

// DELETE /api/domains/[domainId]/habits/[id]/tags — Remove a tag from a habit
export const DELETE = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId, id } = await context!.params;
  await requireWorkspaceAccess(domainId);

  try {
    const body = await request.json();
    const data = tagActionSchema.parse(body);

    const [existing] = await db.select()
      .from(habitTags)
      .where(and(eq(habitTags.habitId, id), eq(habitTags.tagId, data.tagId)))
      .limit(1);

    if (!existing) {
      return createErrorResponse('NOT_FOUND', 'Tag not found on this habit', 404);
    }

    await db.delete(habitTags)
      .where(and(eq(habitTags.habitId, id), eq(habitTags.tagId, data.tagId)));

    await recordActivity({
      actor: user.name,
      action: 'tag_removed',
      entityType: 'habit',
      entityId: id,
      changes: { tagId: data.tagId },
      workspaceId: domainId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid input', 400, error.issues);
    }
    if (error instanceof ApiError) {
      return createErrorResponse(error.code, error.message, error.status);
    }
    console.error('[habit tags DELETE] error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to remove tag', 500);
  }
});
