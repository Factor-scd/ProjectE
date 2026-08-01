import { Hono } from "hono";
import { stream } from "hono/streaming";

export const realtimeRoutes = new Hono();

// GET /api/realtime — SSE endpoint stub
realtimeRoutes.get("/realtime", (c) => {
  return stream(c, async (stream) => {
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");
    await stream.write("data: {\"event\":\"connected\"}\n\n");
    // Keep connection open
    while (true) {
      await stream.write(": heartbeat\n\n");
      await stream.sleep(30000);
    }
  });
});
