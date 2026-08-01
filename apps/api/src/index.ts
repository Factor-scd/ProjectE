import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { mcpRoutes } from "./routes/mcp";
import { realtimeRoutes } from "./routes/realtime";

const app = new Hono();

// Middleware
app.use("*", cors({ origin: "http://localhost:3000", credentials: true }));
app.use("*", logger());

// Health check
app.get("/api/health", (c) => {
  return c.json({ status: "ok", version: "0.1.0", runtime: "bun" });
});

// Routes
app.route("/api/auth", authRoutes);
app.route("/mcp", mcpRoutes);
app.route("/api", realtimeRoutes);

const port = parseInt(process.env.PORT || "3001", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`API server listening on :${port}`);
