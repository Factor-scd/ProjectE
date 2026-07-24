import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import postgres from 'postgres';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const DEFAULT_COLLECTIONS = [
  'tasks',
  'habits',
  'projects',
  'notes',
  'reports',
  'milestones',
  'notifications',
];

// GET /api/realtime — Multiplexed SSE endpoint backed by PostgreSQL LISTEN/NOTIFY.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse subscription preferences from query params
  const { searchParams } = new URL(request.url);
  const collectionsParam = searchParams.get('collections') || '';
  const collections = collectionsParam
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  const subscribedCollections =
    collections.length > 0 ? collections : DEFAULT_COLLECTIONS;

  const encoder = new TextEncoder();
  const listener = postgres(process.env.DATABASE_URL!, { max: 1 });
  let unlisten: (() => Promise<void>) | undefined;
  let keepalive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      // Send connected event
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'connected', collections: subscribedCollections })}\n\n`
        )
      );

      const subscription = await listener.listen('project_e_events', (payload) => {
        try {
          const event = JSON.parse(payload) as { collection?: string };
          if (!event.collection || subscribedCollections.includes(event.collection)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
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
