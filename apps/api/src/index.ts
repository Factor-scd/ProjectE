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
import { searchRoutes } from "./routes/search";
import { calendarRoutes } from "./routes/calendar";
import { graphRoutes } from "./routes/graph";
import { dashboardRoutes } from "./routes/dashboard";
import { agentRoutes } from "./routes/agents";
import { webhookRoutes } from "./routes/webhooks";
import { canvasRoutes } from "./routes/canvas";
import { dailyNoteRoutes } from "./routes/daily-notes";
import { tagRoutes } from "./routes/tags";
import { customFieldRoutes } from "./routes/custom-fields";
import { errorLogRoutes } from "./routes/error-log";
import { analyticsRoutes } from "./routes/analytics";
import { importExportRoutes } from "./routes/import-export";
import { notificationRoutes } from "./routes/notifications";
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
app.route("/api/search", searchRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/graph", graphRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/agents", agentRoutes);
app.route("/api/webhooks", webhookRoutes);
app.route("/api/canvas", canvasRoutes);
app.route("/api/daily-notes", dailyNoteRoutes);
app.route("/api/tags", tagRoutes);
app.route("/api/custom-fields", customFieldRoutes);
app.route("/api/error-log", errorLogRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api", importExportRoutes);
app.route("/api", realtimeRoutes);
app.route("/api/mcp", mcpRoutes);

const port = parseInt(process.env.PORT || "3001", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log("API server listening on :" + port);
