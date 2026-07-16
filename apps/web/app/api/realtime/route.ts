import { NextRequest } from 'next/server';
import { getAuthUser, getAuthToken } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

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

// GET /api/realtime — Multiplexed SSE endpoint for PocketBase realtime subscriptions
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

  const token = getAuthToken(request);
  const pb = createPocketBaseClient(token || undefined);
  const encoder = new TextEncoder();
  const unsubscribeFns: Array<() => Promise<void>> = [];

  const stream = new ReadableStream({
    async start(controller) {
      // Send connected event
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'connected', collections: subscribedCollections })}\n\n`
        )
      );

      // Subscribe to each collection
      for (const collection of subscribedCollections) {
        try {
          const unsub = await pb.collection(collection).subscribe('*', (e) => {
            try {
              const event = {
                type: e.action,
                collection,
                record: e.record,
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
              );
            } catch {
              // Controller might be closed
            }
          });
          unsubscribeFns.push(unsub);
        } catch {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'subscription_error', collection })}\n\n`
            )
          );
        }
      }

      // Keepalive ping every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':ping\n\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 30000);
    },

    async cancel() {
      // Client disconnected — cleanup all subscriptions
      for (const unsub of unsubscribeFns) {
        try {
          await unsub();
        } catch {
          // Ignore cleanup errors
        }
      }
      unsubscribeFns.length = 0;
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
