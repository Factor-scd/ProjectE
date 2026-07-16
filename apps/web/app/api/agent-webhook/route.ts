import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/pocketbase';
import { emitEvent, EVENTS } from '@/lib/events/event-bus';

// POST /api/agent-webhook — Receive async agent results
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_task_id, result, status } = body;

    if (!agent_task_id) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'agent_task_id is required' } },
        { status: 400 },
      );
    }

    const pb = createAdminClient();

    // Update agent task with result
    await pb.collection('agent_tasks').update(agent_task_id, {
      status: status || 'completed',
      output: result || {},
    });

    // Get the agent task to emit event
    const agentTask = await pb.collection('agent_tasks').getOne(agent_task_id);

    // Emit completion event
    emitEvent(EVENTS.AGENT_TASK_COMPLETED, {
      agentTaskId: agent_task_id,
      agentId: agentTask.agent_id as string,
      entityType: (agentTask.entity_type as string) || '',
      entityId: (agentTask.entity_id as string) || '',
      userId: 'agent',
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to process agent webhook' } },
      { status: 500 },
    );
  }
}
