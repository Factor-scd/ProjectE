// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/agent-activity/[id]/undo — Undo an agent action
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    const pb = createPocketBaseClient();

    // Get the activity record
    const activity = await pb.collection('agent_activity').getOne(id);

    if (!activity.before_state) {
      return createErrorResponse('CANNOT_UNDO', 'This action cannot be undone', 400);
    }

    // Restore the previous state
    const entityType = activity.entity_type;
    const entityId = activity.entity_id;
    const beforeState = activity.before_state;

    await pb.collection(entityType).update(entityId, beforeState);

    return NextResponse.json({ success: true, message: 'Action undone' });
  } catch (error) {
    console.error('Failed to undo activity:', error);
    return createErrorResponse('UNDO_FAILED', 'Failed to undo action', 500);
  }
}
