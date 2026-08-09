// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import postgres from 'postgres';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

// GET /api/realtime — SSE endpoint backed by PostgreSQL LISTEN/NOTIFY.
// Supports v2 entities: task, habit, project, note, domain, tag, section, habit_completion, activity
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspace_id');

  const encoder = new TextEncoder();
  const listener = postgres(process.env.DATABASE_URL!, { max: 1 });
  let unlisten: (() => Promise<void>) | undefined;
  let keepalive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      // Send connected event
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'connected', workspace_id: workspaceId })}\n\n`
        )
      );

      const subscription = await listener.listen('project_e_events', (payload) => {
        try {
          const event = JSON.parse(payload) as {
            type: string;
            action: string;
            id: string;
            workspace_id?: string;
          };

          // Filter by workspace_id if specified
          if (workspaceId && event.workspace_id !== workspaceId) {
            return;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Ignore malformed database notifications and closed streams.
        }
      });
      unlisten = subscription.unlisten;

      // Keepalive ping every 30 seconds
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':ping\n\n'));
        } catch {
          if (keepalive) clearInterval(keepalive);
        }
      }, 30000);
    },

    async cancel() {
      if (keepalive) clearInterval(keepalive);
      await unlisten?.();
      await listener.end({ timeout: 5 });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
