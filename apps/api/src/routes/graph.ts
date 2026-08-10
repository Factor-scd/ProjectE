import { Hono } from "hono";
import { db, domains, notes, noteLinks, noteEntityLinks, tasks, taskDependencies, habits, projects, sections, tags as tagsTable } from "@project-e/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireAuth, requireWorkspaceAccess, AuthError } from "../middleware/auth";
import { recordActivity } from "../middleware/activity";
import { z } from "zod";

export const graphRoutes = new Hono();

const ENTITY_COLORS: Record<string, string> = {
  task: '#3b82f6',
  habit: '#10b981',
  project: '#8b5cf6',
  note: '#f59e0b',
  section: '#ec4899',
  tag: '#6b7280',
  domain: '#6366f1',
};

interface GraphNode { id: string; label: string; type: string; color: string; }
interface GraphEdge { source: string; target: string; type: string; }

async function getGraphData(domainId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  function addNode(id: string, label: string, type: string) {
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      nodes.push({ id, label, type, color: ENTITY_COLORS[type] || '#6b7280' });
    }
  }

  function addEdge(source: string, target: string, type: string) {
    if (source !== target) edges.push({ source, target, type });
  }

  const projectIds = (await db.select({ id: projects.id }).from(projects).where(eq(projects.domainId, domainId))).map(p => p.id);
  const [noteRows, taskRows, habitRows, projectRows, sectionRows, tagRows, domainRows] = await Promise.all([
    db.select({ id: notes.id, title: notes.title }).from(notes).where(and(eq(notes.domainId, domainId), isNull(notes.deletedAt))),
    db.select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId }).from(tasks).where(and(eq(tasks.domainId, domainId), isNull(tasks.deletedAt))),
    db.select({ id: habits.id, name: habits.name }).from(habits).where(and(eq(habits.domainId, domainId), isNull(habits.deletedAt))),
    db.select({ id: projects.id, name: projects.name }).from(projects).where(and(eq(projects.domainId, domainId), isNull(projects.deletedAt))),
    projectIds.length > 0
      ? db.select({ id: sections.id, name: sections.name, projectId: sections.projectId }).from(sections).where(inArray(sections.projectId, projectIds))
      : Promise.resolve([]),
    db.select({ id: tagsTable.id, name: tagsTable.name }).from(tagsTable),
    db.select({ id: domains.id, name: domains.name }).from(domains).where(eq(domains.id, domainId)),
  ]);

  for (const d of domainRows) addNode(d.id, d.name, 'domain');
  for (const n of noteRows) addNode(n.id, n.title, 'note');
  for (const t of taskRows) addNode(t.id, t.title, 'task');
  for (const h of habitRows) addNode(h.id, h.name, 'habit');
  for (const p of projectRows) addNode(p.id, p.name, 'project');
  for (const s of sectionRows) addNode(s.id, s.name, 'section');
  for (const t of tagRows) addNode(t.id, t.name, 'tag');

  const noteIds = noteRows.map(n => n.id);
  if (noteIds.length > 0) {
    const linkRows = await db.select().from(noteLinks).where(inArray(noteLinks.sourceNoteId, noteIds));
    for (const l of linkRows) addEdge(l.sourceNoteId, l.targetNoteId, 'note_link');
    const entityLinkRows = await db.select().from(noteEntityLinks).where(inArray(noteEntityLinks.noteId, noteIds));
    for (const l of entityLinkRows) addEdge(l.noteId, l.entityId, 'note_' + l.entityType);
  }

  const taskIds = taskRows.map(t => t.id);
  if (taskIds.length > 0) {
    const depRows = await db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, taskIds));
    for (const d of depRows) addEdge(d.taskId, d.dependsOnTaskId, 'depends_on');
  }

  for (const t of taskRows) { if (t.projectId) addEdge(t.id, t.projectId, 'task_project'); addEdge(t.id, domainId, 'task_domain'); }
  for (const h of habitRows) addEdge(h.id, domainId, 'habit_domain');
  for (const p of projectRows) addEdge(p.id, domainId, 'project_domain');
  for (const n of noteRows) addEdge(n.id, domainId, 'note_domain');
  for (const s of sectionRows) { if (s.projectId) addEdge(s.id, s.projectId, 'section_project'); }

  return { nodes, edges };
}

// Resolve the owning domain for a graph edge source. `type` may be an edge type
// (note_link / note_entity / task_dependency) or a source entity type (note / task).
async function resolveEdgeWorkspaceId(sourceId: string, type: string): Promise<string | null> {
  if (type === "note_link" || type === "note_entity" || type === "note") {
    const [row] = await db.select({ domainId: notes.domainId }).from(notes).where(eq(notes.id, sourceId)).limit(1);
    return row?.domainId ?? null;
  }
  if (type === "task_dependency" || type === "task") {
    const [row] = await db.select({ domainId: tasks.domainId }).from(tasks).where(eq(tasks.id, sourceId)).limit(1);
    return row?.domainId ?? null;
  }
  return null;
}

// GET /api/graph/nodes — All nodes
graphRoutes.get("/nodes", async (c) => {
  try {
    await requireAuth(c);
    const url = new URL(c.req.url);
    const domainId = url.searchParams.get("domain");
    if (!domainId) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "domain parameter is required" } }, 400);
    }
    await requireWorkspaceAccess(c, domainId);
    const data = await getGraphData(domainId);
    return c.json({ items: data.nodes, totalItems: data.nodes.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[graph] GET /nodes error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get graph nodes" } }, 500);
  }
});

// GET /api/graph/edges — All edges
graphRoutes.get("/edges", async (c) => {
  try {
    await requireAuth(c);
    const url = new URL(c.req.url);
    const domainId = url.searchParams.get("domain");
    if (!domainId) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "domain parameter is required" } }, 400);
    }
    await requireWorkspaceAccess(c, domainId);
    const data = await getGraphData(domainId);
    return c.json({ items: data.edges, totalItems: data.edges.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[graph] GET /edges error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to get graph edges" } }, 500);
  }
});

// POST /api/graph/edges — Create a relationship (note link)
graphRoutes.post("/edges", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const { sourceId, targetId, type } = z.object({
      sourceId: z.string().uuid(),
      targetId: z.string().uuid(),
      type: z.string().default("note_link"),
    }).parse(body);

    // Verify ownership before mutating anything. Both endpoints of the edge
    // must belong to the caller's domain.
    const workspaceId = await resolveEdgeWorkspaceId(sourceId, type);
    if (workspaceId) {
      await requireWorkspaceAccess(c, workspaceId);
    }
    const targetType = type === "note_link" ? "note" : (type === "note_entity" || type === "task_dependency") ? "task" : type;
    const targetWorkspaceId = await resolveEdgeWorkspaceId(targetId, targetType);
    if (targetWorkspaceId) {
      await requireWorkspaceAccess(c, targetWorkspaceId);
    }

    if (type === "note_link") {
      await db.insert(noteLinks).values({ sourceNoteId: sourceId, targetNoteId: targetId });
    } else if (type === "note_entity") {
      await db.insert(noteEntityLinks).values({ noteId: sourceId, entityType: "task", entityId: targetId });
    } else if (type === "task_dependency") {
      await db.insert(taskDependencies).values({ taskId: sourceId, dependsOnTaskId: targetId });
    } else {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Unknown edge type: " + type } }, 400);
    }

    if (!workspaceId) {
      console.warn(`[graph] POST /edges: could not resolve workspace for source ${sourceId} (type ${type}); skipping activity`);
    } else {
      await recordActivity({
        actor: user.name,
        action: "created",
        entityType: "graph_edge",
        entityId: sourceId + "-" + targetId,
        changes: { type, sourceId, targetId },
        workspaceId,
      });
    }

    return c.json({ success: true }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues } }, 400);
    }
    console.error("[graph] POST /edges error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to create edge" } }, 500);
  }
});

// DELETE /api/graph/edges/:id — Remove
graphRoutes.delete("/edges/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const [sourceId, targetId] = id.split("-");

    // The type isn't known at delete time, so resolve from the source entity:
    // it's either a note or a task. Verify ownership before mutating anything.
    let workspaceId = await resolveEdgeWorkspaceId(sourceId, "note");
    if (!workspaceId) {
      workspaceId = await resolveEdgeWorkspaceId(sourceId, "task");
    }
    if (workspaceId) {
      await requireWorkspaceAccess(c, workspaceId);
    }

    // Try deleting from note_links first
    const result = await db.delete(noteLinks)
      .where(and(eq(noteLinks.sourceNoteId, sourceId), eq(noteLinks.targetNoteId, targetId)))
      .returning();

    if (result.length === 0) {
      // Try note_entity_links (note → entity edges)
      const entityResult = await db.delete(noteEntityLinks)
        .where(and(eq(noteEntityLinks.noteId, sourceId), eq(noteEntityLinks.entityId, targetId)))
        .returning();
      if (entityResult.length === 0) {
        // Try task_dependencies
        await db.delete(taskDependencies)
          .where(and(eq(taskDependencies.taskId, sourceId), eq(taskDependencies.dependsOnTaskId, targetId)));
      }
    }

    if (!workspaceId) {
      console.warn(`[graph] DELETE /edges/${id}: could not resolve workspace for source ${sourceId}; skipping activity`);
    } else {
      await recordActivity({
        actor: user.name,
        action: "deleted",
        entityType: "graph_edge",
        entityId: id,
        changes: {},
        workspaceId,
      });
    }

    return c.body(null, 204);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status as any);
    }
    console.error("[graph] DELETE /edges/:id error:", error);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete edge" } }, 500);
  }
});
