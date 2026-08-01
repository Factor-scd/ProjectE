/**
 * Graph Service
 *
 * Builds graph data (nodes + edges) for the D3 force-directed graph view.
 * Includes all entity types: task, habit, project, note, section, tag.
 * Edges come from: note_links, note_entity_links, task dependencies,
 * task→project, task→section, task→domain, habit→domain, project→domain.
 */

import { db, notes, noteLinks, noteEntityLinks, tasks, taskDependencies, habits, projects, sections, tags as tagsTable, domains } from '@project-e/db';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

export interface GraphNode {
  id: string;
  label: string;
  type: 'task' | 'habit' | 'project' | 'note' | 'section' | 'tag' | 'domain';
  color: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const ENTITY_COLORS: Record<string, string> = {
  task: '#3b82f6',      // blue
  habit: '#10b981',     // green
  project: '#8b5cf6',   // purple
  note: '#f59e0b',      // amber
  section: '#ec4899',   // pink
  tag: '#6b7280',       // gray
  domain: '#6366f1',    // indigo
};

/**
 * Get graph data for a single domain.
 */
export async function getGraphData(domainId: string): Promise<GraphData> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  function addNode(id: string, label: string, type: GraphNode['type']) {
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      nodes.push({ id, label, type, color: ENTITY_COLORS[type] || '#6b7280' });
    }
  }

  function addEdge(source: string, target: string, type: string) {
    if (source !== target) {
      edges.push({ source, target, type });
    }
  }

  // Fetch all entities in this domain
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

  // Add domain node
  for (const d of domainRows) {
    addNode(d.id, d.name, 'domain');
  }

  // Add note nodes
  for (const n of noteRows) {
    addNode(n.id, n.title, 'note');
  }

  // Add task nodes
  for (const t of taskRows) {
    addNode(t.id, t.title, 'task');
  }

  // Add habit nodes
  for (const h of habitRows) {
    addNode(h.id, h.name, 'habit');
  }

  // Add project nodes
  for (const p of projectRows) {
    addNode(p.id, p.name, 'project');
  }

  // Add section nodes
  for (const s of sectionRows) {
    addNode(s.id, s.name, 'section');
  }

  // Add tag nodes
  for (const t of tagRows) {
    addNode(t.id, t.name, 'tag');
  }

  // --- Edges ---

  // Note-to-note links
  const noteIds = noteRows.map(n => n.id);
  if (noteIds.length > 0) {
    const linkRows = await db.select()
      .from(noteLinks)
      .where(inArray(noteLinks.sourceNoteId, noteIds));
    for (const l of linkRows) {
      addEdge(l.sourceNoteId, l.targetNoteId, 'note_link');
    }
  }

  // Note-to-entity links
  if (noteIds.length > 0) {
    const entityLinkRows = await db.select()
      .from(noteEntityLinks)
      .where(inArray(noteEntityLinks.noteId, noteIds));
    for (const l of entityLinkRows) {
      addEdge(l.noteId, l.entityId, `note_${l.entityType}`);
    }
  }

  // Task dependencies
  const taskIds = taskRows.map(t => t.id);
  if (taskIds.length > 0) {
    const depRows = await db.select()
      .from(taskDependencies)
      .where(inArray(taskDependencies.taskId, taskIds));
    for (const d of depRows) {
      addEdge(d.taskId, d.dependsOnTaskId, 'depends_on');
    }
  }

  // Task → project
  for (const t of taskRows) {
    if (t.projectId) {
      addEdge(t.id, t.projectId, 'task_project');
    }
  }

  // Task → domain
  for (const t of taskRows) {
    addEdge(t.id, domainId, 'task_domain');
  }

  // Habit → domain
  for (const h of habitRows) {
    addEdge(h.id, domainId, 'habit_domain');
  }

  // Project → domain
  for (const p of projectRows) {
    addEdge(p.id, domainId, 'project_domain');
  }

  // Note → domain
  for (const n of noteRows) {
    addEdge(n.id, domainId, 'note_domain');
  }

  // Section → project
  for (const s of sectionRows) {
    if (s.projectId) {
      addEdge(s.id, s.projectId, 'section_project');
    }
  }

  return { nodes, edges };
}

/**
 * Get global graph data (all domains).
 */
export async function getGlobalGraphData(): Promise<GraphData> {
  const allDomains = await db.select({ id: domains.id }).from(domains);
  const allNodes: GraphNode[] = [];
  const allEdges: GraphEdge[] = [];
  const seenNodeIds = new Set<string>();

  for (const d of allDomains) {
    const domainGraph = await getGraphData(d.id);
    for (const node of domainGraph.nodes) {
      if (!seenNodeIds.has(node.id)) {
        seenNodeIds.add(node.id);
        allNodes.push(node);
      }
    }
    allEdges.push(...domainGraph.edges);
  }

  return { nodes: allNodes, edges: allEdges };
}
