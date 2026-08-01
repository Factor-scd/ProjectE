import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { mcpRoutes } from "./routes/mcp";
import { realtimeRoutes } from "./routes/realtime";
import { domainRoutes } from "./routes/domains";
import { taskRoutes } from "./routes/tasks";
import { habitRoutes } from "./routes/habits";
import { projectRoutes } from "./routes/projects";
import { noteRoutes } from "./routes/notes";
import { healthHandler } from "./routes/health";

const app = new Hono();

// Middleware
app.use("*", cors({ origin: "http://localhost:3000", credentials: true }));
app.use("*", logger());
app.use("*", authMiddleware);

// Health check — expanded with DB ping
app.get("/api/health", async (c) => {
  const result = await healthHandler();
  return c.json(result);
});

// Routes
app.route("/api/auth", authRoutes);
app.route("/api/domains", domainRoutes);
app.route("/api/tasks", taskRoutes);
app.route("/api/habits", habitRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/notes", noteRoutes);
app.route("/api", realtimeRoutes);
app.route("/mcp", mcpRoutes);

const port = parseInt(process.env.PORT || "3001", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`API server listening on :${port}`);
