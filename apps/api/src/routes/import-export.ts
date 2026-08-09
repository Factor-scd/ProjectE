import { Hono } from "hono";
import { db, tasks, habits, projects, notes, tags as tagsTable, agents, webhooks } from "@project-e/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, createErrorResponse, AuthError } from "../middleware/auth";
import { z } from "zod";

export const importExportRoutes = new Hono();

const COLLECTIONS = ['tasks', 'habits', 'projects', 'notes', 'tags', 'agents', 'webhooks'] as const;

// POST /api/import — Import data from JSON
importExportRoutes.post("/import", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();

    if (!body || typeof body !== 'object') {
      return c.json({ error: { code: "INVALID_DATA", message: "Invalid import data format" } }, 400);
    }

    if (!body.version) {
      return c.json({ error: { code: "INVALID_DATA", message: "Missing version field" } }, 400);
    }

    const results: Array<{ collection: string; imported: number; failed: number; errors: string[] }> = [];
    let totalImported = 0;
    let totalFailed = 0;

    for (const collection of COLLECTIONS) {
      const items = body[collection];
      if (!Array.isArray(items) || items.length === 0) continue;

      const result = { collection, imported: 0, failed: 0, errors: [] as string[] };

      for (const item of items) {
        try {
          const { id: _id, created: _created, updated: _updated, ...data } = item;
          // Map to the right table
          switch (collection) {
            case 'tasks':
              await db.insert(tasks).values({ ...data, domainId: data.domain_id || data.domainId });
              break;
            case 'habits':
              await db.insert(habits).values({ ...data, domainId: data.domain_id || data.domainId });
              break;
            case 'projects':
              await db.insert(projects).values({ ...data, domainId: data.domain_id || data.domainId });
              break;
            case 'notes':
              await db.insert(notes).values({ ...data, domainId: data.domain_id || data.domainId });
              break;
            case 'tags':
              await db.insert(tagsTable).values(data);
              break;
            case 'agents':
              await db.insert(agents).values({ ...data, domainId: data.domain_id || data.domainId });
              break;
            case 'webhooks':
              await db.insert(webhooks).values({ ...data, workspaceId: data.workspace_id || data.workspaceId || data.domain_id || data.domainId });
              break;
          }
          result.imported++;
        } catch (error) {
          result.failed++;
          const message = error instanceof Error ? error.message : String(error);
          if (result.errors.length < 5) result.errors.push(message);
        }
      }

      results.push(result);
      totalImported += result.imported;
      totalFailed += result.failed;
    }

    return c.json({ success: totalFailed === 0, imported: totalImported, failed: totalFailed, results });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[import] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Import failed" } }, 500);
  }
});

// GET /api/export — List available collections
importExportRoutes.get("/export", async (c) => {
  try {
    await requireAuth(c);
    return c.json({
      collections: COLLECTIONS.map(name => ({
        name,
        label: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[export] GET error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to list export collections" } }, 500);
  }
});

// POST /api/export — Export data as JSON
importExportRoutes.post("/export", async (c) => {
  try {
    const user = await requireAuth(c);
    let body: { collections?: string[] } = {};
    try { body = await c.req.json(); } catch { /* empty body is fine */ }

    const requestedCollections = body.collections && body.collections.length > 0
      ? body.collections.filter(c => COLLECTIONS.includes(c as typeof COLLECTIONS[number]))
      : [...COLLECTIONS];

    const exportData: Record<string, unknown> = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
    };

    for (const collection of requestedCollections) {
      try {
        let items: any[] = [];
        switch (collection) {
          case 'tasks': items = await db.select().from(tasks).where(isNull(tasks.deletedAt)); break;
          case 'habits': items = await db.select().from(habits).where(isNull(habits.deletedAt)); break;
          case 'projects': items = await db.select().from(projects).where(isNull(projects.deletedAt)); break;
          case 'notes': items = await db.select().from(notes).where(isNull(notes.deletedAt)); break;
          case 'tags': items = await db.select().from(tagsTable); break;
          case 'agents': items = await db.select().from(agents); break;
          case 'webhooks': items = await db.select().from(webhooks); break;
        }
        exportData[collection] = items;
      } catch (error) {
        console.error("Failed to export collection " + collection + ":", error);
        exportData[collection] = [];
      }
    }

    return c.json(exportData);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[export] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Export failed" } }, 500);
  }
});
