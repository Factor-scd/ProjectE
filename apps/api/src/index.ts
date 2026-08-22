import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db, errorLogs } from "@project-e/db";
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
import { commentRoutes } from "./routes/comments";
import { dailyNoteRoutes } from "./routes/daily-notes";
import { tagRoutes } from "./routes/tags";
import { customFieldRoutes } from "./routes/custom-fields";
import { errorLogRoutes } from "./routes/error-log";
import { analyticsRoutes } from "./routes/analytics";
import { activityRoutes } from "./routes/activity";
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
app.route("/api/comments", commentRoutes);
app.route("/api/daily-notes", dailyNoteRoutes);
app.route("/api/tags", tagRoutes);
app.route("/api/custom-fields", customFieldRoutes);
app.route("/api/error-log", errorLogRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/activity", activityRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api", importExportRoutes);
app.route("/api", realtimeRoutes);
app.route("/api/mcp", mcpRoutes);

// Persist uncaught server errors so the Settings → Error Log tab shows real
// diagnostics instead of always being empty. Errors already caught by route
// handlers (which return 500 JSON themselves) still log to the console.
app.onError((err, c) => {
  console.error("[api] uncaught error:", err);
  try {
    void db.insert(errorLogs).values({
      level: "error",
      source: c.req.path,
      message: err instanceof Error ? err.message : String(err),
      stackTrace: err instanceof Error ? err.stack ?? null : null,
      metadata: { method: c.req.method },
    });
  } catch {
    // Logging must never break the error response.
  }
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
});

const port = parseInt(process.env.PORT || "3001", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log("API server listening on :" + port);
