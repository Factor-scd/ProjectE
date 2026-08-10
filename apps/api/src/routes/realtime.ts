import { Hono } from "hono";
import postgres from "postgres";
import { requireWorkspaceAccess, AuthError } from "../middleware/auth";

export const realtimeRoutes = new Hono();

// GET /api/realtime — SSE endpoint backed by PostgreSQL LISTEN/NOTIFY
realtimeRoutes.get("/realtime", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(c.req.url);
  const workspaceId = url.searchParams.get("workspace_id");

  // IDOR guard: if a workspace is requested, verify the current user actually
  // owns it before subscribing to the event stream. Without this check any
  // authenticated user could tail another workspace's events.
  if (workspaceId) {
    try {
      await requireWorkspaceAccess(c, workspaceId);
    } catch (error) {
      if (error instanceof AuthError) {
        return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
      }
      console.error("[realtime] workspace validation error:", error);
      return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to validate workspace" } }, 500);
    }
  }

  const encoder = new TextEncoder();
  const listener = postgres(process.env.DATABASE_URL!, { max: 1 });
  let unlisten: (() => Promise<void>) | undefined;
  let keepalive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", workspace_id: workspaceId })}\n\n`
        )
      );

      const subscription = await listener.listen("project_e_events", (payload) => {
        try {
          const event = JSON.parse(payload) as {
            type: string;
            action: string;
            id: string;
            workspace_id?: string;
          };

          if (workspaceId && event.workspace_id !== workspaceId) {
            return;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Ignore malformed notifications
        }
      });
      unlisten = subscription.unlisten;

      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":ping\n\n"));
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

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  return c.newResponse(stream);
});
