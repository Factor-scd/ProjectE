import { Hono } from "hono";
import { db, domains, notes, tasks, habits, projects, sections, tags as tagsTable, links } from "@project-e/db";
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

  // Read links from the canonical links table
  const allIds = [...noteRows.map(n => n.id), ...taskRows.map(t => t.id)];
  if (allIds.length > 0) {
    const linkRows = await db.select().from(links)
      .where(inArray(links.sourceId, allIds));
    for (const l of linkRows) addEdge(l.sourceId, l.targetId, l.linkType);
  }

  for (const t of taskRows) { if (t.projectId) addEdge(t.id, t.projectId, 'task_project'); addEdge(t.id, domainId, 'task_domain'); }
  for (const h of habitRows) addEdge(h.id, domainId, 'habit_domain');
  for (const p of projectRows) addEdge(p.id, domainId, 'project_domain');
  for (const n of noteRows) addEdge(n.id, domainId, 'note_domain');
  for (const s of sectionRows) { if (s.projectId) addEdge(s.id, s.projectId, 'section_project'); }

  return { nodes, edges };
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

// POST /api/graph/edges — Create a relationship via the links table
graphRoutes.post("/edges", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const { sourceId, targetId, type, sourceType, targetType } = z.object({
      sourceId: z.string().uuid(),
      targetId: z.string().uuid(),
      type: z.string().default("relates"),
      sourceType: z.string().default("note"),
      targetType: z.string().default("note"),
    }).parse(body);

    const workspaceId = await resolveEdgeWorkspaceId(sourceId, sourceType);
    if (workspaceId) {
      await requireWorkspaceAccess(c, workspaceId);
    }

    await db.insert(links).values({
      sourceType,
      sourceId,
      targetType,
      targetId,
      linkType: type as any,
    });

    if (!workspaceId) {
      console.warn(`[graph] POST /edges: could not resolve workspace for source ${sourceId} (type ${sourceType}); skipping activity`);
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

// DELETE /api/graph/edges/:id — Remove via links table
graphRoutes.delete("/edges/:id", async (c) => {
  try {
    const user = await requireAuth(c);
    const id = c.req.param("id");
    const [sourceId, targetId] = id.split("-");

    const workspaceId = await resolveEdgeWorkspaceId(sourceId, "note") || await resolveEdgeWorkspaceId(sourceId, "task");
    if (workspaceId) {
      await requireWorkspaceAccess(c, workspaceId);
    }

    await db.delete(links)
      .where(and(eq(links.sourceId, sourceId), eq(links.targetId, targetId)));

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

async function resolveEdgeWorkspaceId(sourceId: string, type: string): Promise<string | null> {
  if (type === "note") {
    const [row] = await db.select({ domainId: notes.domainId }).from(notes).where(eq(notes.id, sourceId)).limit(1);
    return row?.domainId ?? null;
  }
  if (type === "task") {
    const [row] = await db.select({ domainId: tasks.domainId }).from(tasks).where(eq(tasks.id, sourceId)).limit(1);
    return row?.domainId ?? null;
  }
  return null;
}
