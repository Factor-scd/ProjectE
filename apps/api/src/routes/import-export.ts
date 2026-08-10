import { Hono } from "hono";
import { db, tasks, habits, projects, notes, tags as tagsTable, agents, webhooks, taskTags, habitTags, projectTags, noteTags } from "@project-e/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, resolveActiveDomain, createErrorResponse, AuthError } from "../middleware/auth";
import { z } from "zod";

export const importExportRoutes = new Hono();

const COLLECTIONS = ['tasks', 'habits', 'projects', 'notes', 'tags', 'agents', 'webhooks'] as const;
const JUNCTION_COLLECTIONS = ['task_tags', 'habit_tags', 'project_tags', 'note_tags'] as const;
const JUNCTION_PARENT: Record<string, string> = {
  task_tags: 'tasks',
  habit_tags: 'habits',
  project_tags: 'projects',
  note_tags: 'notes',
};

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

    // Every imported entity is forced into a single target domain that the
    // current user owns. Payload-supplied domain ids are never trusted.
    const targetDomain = body.domain || body.domain_id || (await resolveActiveDomain(user)).id;
    await requireWorkspaceAccess(c, targetDomain);

    const results: Array<{ collection: string; imported: number; failed: number; errors: string[] }> = [];
    let totalImported = 0;
    let totalFailed = 0;

    const runCollection = async (collection: string, items: any[]) => {
      const result = { collection, imported: 0, failed: 0, errors: [] as string[] };
      for (const item of items) {
        try {
          // Preserve the source id so cross-references (projectId, parentId,
          // sectionId, junction rows) survive the round-trip. Domain is always
          // forced to the target workspace.
          const { id, domain, domainId, workspaceId, created: _created, updated: _updated, ...data } = item;
          switch (collection) {
            case 'tasks':
              await db.insert(tasks).values({ ...data, id, domainId: targetDomain });
              break;
            case 'habits':
              await db.insert(habits).values({ ...data, id, domainId: targetDomain });
              break;
            case 'projects':
              await db.insert(projects).values({ ...data, id, domainId: targetDomain });
              break;
            case 'notes':
              await db.insert(notes).values({ ...data, id, domainId: targetDomain });
              break;
            case 'tags':
              await db.insert(tagsTable).values({ ...data, id });
              break;
            case 'agents':
              await db.insert(agents).values({ ...data, id, domainId: targetDomain });
              break;
            case 'webhooks':
              await db.insert(webhooks).values({ ...data, id, workspaceId: targetDomain });
              break;
            case 'task_tags':
              await db.insert(taskTags).values({ taskId: item.taskId, tagId: item.tagId }).onConflictDoNothing();
              break;
            case 'habit_tags':
              await db.insert(habitTags).values({ habitId: item.habitId, tagId: item.tagId }).onConflictDoNothing();
              break;
            case 'project_tags':
              await db.insert(projectTags).values({ projectId: item.projectId, tagId: item.tagId }).onConflictDoNothing();
              break;
            case 'note_tags':
              await db.insert(noteTags).values({ noteId: item.noteId, tagId: item.tagId }).onConflictDoNothing();
              break;
            default:
              continue;
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
    };

    // Entities first (tags too), then junctions so the FK targets exist.
    for (const collection of COLLECTIONS) {
      const items = body[collection];
      if (!Array.isArray(items) || items.length === 0) continue;
      await runCollection(collection, items);
    }
    for (const collection of JUNCTION_COLLECTIONS) {
      const items = body[collection];
      if (!Array.isArray(items) || items.length === 0) continue;
      await runCollection(collection, items);
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
    let body: { collections?: string[]; domain?: string } = {};
    try { body = await c.req.json(); } catch { /* empty body is fine */ }

    // Scope the entire export to one domain owned by the current user.
    // An optional `domain` in the body can override the active domain, but it
    // must still pass the ownership check.
    const domainId = body.domain || (await resolveActiveDomain(user)).id;
    await requireWorkspaceAccess(c, domainId);

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
          case 'tasks': items = await db.select().from(tasks).where(and(eq(tasks.domainId, domainId), isNull(tasks.deletedAt))); break;
          case 'habits': items = await db.select().from(habits).where(and(eq(habits.domainId, domainId), isNull(habits.deletedAt))); break;
          case 'projects': items = await db.select().from(projects).where(and(eq(projects.domainId, domainId), isNull(projects.deletedAt))); break;
          case 'notes': items = await db.select().from(notes).where(and(eq(notes.domainId, domainId), isNull(notes.deletedAt))); break;
          case 'tags': {
            // Tags are global (no domain_id); export only tags actually used by
            // this domain's entities via the four junction tables.
            const [taskTagIds, habitTagIds, projectTagIds, noteTagIds] = await Promise.all([
              db.select({ tagId: taskTags.tagId }).from(taskTags)
                .innerJoin(tasks, eq(taskTags.taskId, tasks.id))
                .where(and(eq(tasks.domainId, domainId), isNull(tasks.deletedAt))),
              db.select({ tagId: habitTags.tagId }).from(habitTags)
                .innerJoin(habits, eq(habitTags.habitId, habits.id))
                .where(and(eq(habits.domainId, domainId), isNull(habits.deletedAt))),
              db.select({ tagId: projectTags.tagId }).from(projectTags)
                .innerJoin(projects, eq(projectTags.projectId, projects.id))
                .where(and(eq(projects.domainId, domainId), isNull(projects.deletedAt))),
              db.select({ tagId: noteTags.tagId }).from(noteTags)
                .innerJoin(notes, eq(noteTags.noteId, notes.id))
                .where(and(eq(notes.domainId, domainId), isNull(notes.deletedAt))),
            ]);
            const tagIds = [...new Set([...taskTagIds, ...habitTagIds, ...projectTagIds, ...noteTagIds].map(r => r.tagId))];
            items = tagIds.length > 0 ? await db.select().from(tagsTable).where(inArray(tagsTable.id, tagIds)) : [];
            break;
          }
          case 'agents': items = await db.select().from(agents).where(eq(agents.domainId, domainId)); break;
          case 'webhooks': items = await db.select().from(webhooks).where(eq(webhooks.workspaceId, domainId)); break;
        }
        exportData[collection] = items;
      } catch (error) {
        console.error("Failed to export collection " + collection + ":", error);
        exportData[collection] = [];
      }
    }

    // Tag assignments ride along with their parent entity collection so an
    // export → import round-trip preserves all tag links.
    for (const junction of JUNCTION_COLLECTIONS) {
      const parent = JUNCTION_PARENT[junction];
      if (!requestedCollections.includes(parent as typeof COLLECTIONS[number])) continue;
      try {
        let items: any[] = [];
        switch (junction) {
          case 'task_tags':
            items = await db.select({ taskId: taskTags.taskId, tagId: taskTags.tagId }).from(taskTags)
              .innerJoin(tasks, eq(taskTags.taskId, tasks.id))
              .where(and(eq(tasks.domainId, domainId), isNull(tasks.deletedAt)));
            break;
          case 'habit_tags':
            items = await db.select({ habitId: habitTags.habitId, tagId: habitTags.tagId }).from(habitTags)
              .innerJoin(habits, eq(habitTags.habitId, habits.id))
              .where(and(eq(habits.domainId, domainId), isNull(habits.deletedAt)));
            break;
          case 'project_tags':
            items = await db.select({ projectId: projectTags.projectId, tagId: projectTags.tagId }).from(projectTags)
              .innerJoin(projects, eq(projectTags.projectId, projects.id))
              .where(and(eq(projects.domainId, domainId), isNull(projects.deletedAt)));
            break;
          case 'note_tags':
            items = await db.select({ noteId: noteTags.noteId, tagId: noteTags.tagId }).from(noteTags)
              .innerJoin(notes, eq(noteTags.noteId, notes.id))
              .where(and(eq(notes.domainId, domainId), isNull(notes.deletedAt)));
            break;
        }
        exportData[junction] = items;
      } catch (error) {
        console.error("Failed to export collection " + junction + ":", error);
        exportData[junction] = [];
      }
    }

    return c.json(exportData);
  } catch (error) {
    if (error instanceof AuthError) return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    console.error("[export] POST error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Export failed" } }, 500);
  }
});
