/**
 * Note Link Service
 *
 * Handles wikilink resolution and note_links / note_entity_links management.
 * On note save, parses content for [[wikilinks]], resolves each to a note_id or entity_id,
 * and diffs the existing links to produce idempotent deletes+inserts.
 */

import { db, noteLinks, noteEntityLinks, notes, tasks, habits, projects, sections, tags as tagsTable } from '@project-e/db';
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { extractLinkTargets } from './wikilink-parser';

/**
 * Resolve a single link target to its entity ID.
 * Returns null if no match found.
 */
async function resolveTarget(entityType: string, title: string): Promise<{ entityId: string; entityType: string } | null> {
  const trimmedTitle = title.trim();

  if (!entityType) {
    // Resolve as a note
    const [note] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.title, trimmedTitle), isNull(notes.deletedAt)))
      .limit(1);
    if (note) return { entityId: note.id, entityType: 'note' };
    return null;
  }

  switch (entityType) {
    case 'note': {
      const [note] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.title, trimmedTitle), isNull(notes.deletedAt)))
        .limit(1);
      if (note) return { entityId: note.id, entityType: 'note' };
      return null;
    }
    case 'task': {
      const [task] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.title, trimmedTitle), isNull(tasks.deletedAt)))
        .limit(1);
      if (task) return { entityId: task.id, entityType: 'task' };
      return null;
    }
    case 'habit': {
      const [habit] = await db
        .select({ id: habits.id })
        .from(habits)
        .where(and(eq(habits.name, trimmedTitle), isNull(habits.deletedAt)))
        .limit(1);
      if (habit) return { entityId: habit.id, entityType: 'habit' };
      return null;
    }
    case 'project': {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.name, trimmedTitle), isNull(projects.deletedAt)))
        .limit(1);
      if (project) return { entityId: project.id, entityType: 'project' };
      return null;
    }
    case 'section': {
      const [section] = await db
        .select({ id: sections.id })
        .from(sections)
        .where(eq(sections.name, trimmedTitle))
        .limit(1);
      if (section) return { entityId: section.id, entityType: 'section' };
      return null;
    }
    case 'tag': {
      const [tag] = await db
        .select({ id: tagsTable.id })
        .from(tagsTable)
        .where(eq(tagsTable.name, trimmedTitle))
        .limit(1);
      if (tag) return { entityId: tag.id, entityType: 'tag' };
      return null;
    }
    default:
      return null;
  }
}

/**
 * Sync wikilinks for a note: parse content, resolve targets, diff existing links.
 * Idempotent — deletes stale links, inserts new ones.
 */
export async function syncNoteLinks(noteId: string, content: string): Promise<void> {
  const targets = extractLinkTargets(content);

  // Resolve all targets to entity IDs
  const resolvedTargets: { entityType: string; entityId: string }[] = [];
  for (const target of targets) {
    const resolved = await resolveTarget(target.entityType, target.title);
    if (resolved) {
      resolvedTargets.push(resolved);
    }
  }

  // Separate into note-to-note links and entity links
  const noteToNoteLinks = resolvedTargets.filter(t => t.entityType === 'note');
  const entityLinks = resolvedTargets.filter(t => t.entityType !== 'note');

  // --- Sync note_links ---
  const existingNoteLinks = await db
    .select({ targetNoteId: noteLinks.targetNoteId })
    .from(noteLinks)
    .where(eq(noteLinks.sourceNoteId, noteId));

  const existingTargetIds = new Set(existingNoteLinks.map(l => l.targetNoteId));
  const newTargetIds = new Set(noteToNoteLinks.map(l => l.entityId));

  // Delete stale links
  const staleTargetIds = [...existingTargetIds].filter(id => !newTargetIds.has(id));
  if (staleTargetIds.length > 0) {
    await db
      .delete(noteLinks)
      .where(and(
        eq(noteLinks.sourceNoteId, noteId),
        inArray(noteLinks.targetNoteId, staleTargetIds),
      ));
  }

  // Insert new links
  const missingTargetIds = [...newTargetIds].filter(id => !existingTargetIds.has(id));
  if (missingTargetIds.length > 0) {
    await db.insert(noteLinks).values(
      missingTargetIds.map(targetNoteId => ({ sourceNoteId: noteId, targetNoteId }))
    );
  }

  // --- Sync note_entity_links ---
  const existingEntityLinks = await db
    .select({ entityType: noteEntityLinks.entityType, entityId: noteEntityLinks.entityId })
    .from(noteEntityLinks)
    .where(eq(noteEntityLinks.noteId, noteId));

  const existingEntityKeySet = new Set(existingEntityLinks.map(l => `${l.entityType}:${l.entityId}`));
  const newEntityKeySet = new Set(entityLinks.map(l => `${l.entityType}:${l.entityId}`));

  // Delete stale entity links
  const staleEntityLinks = existingEntityLinks.filter(l => !newEntityKeySet.has(`${l.entityType}:${l.entityId}`));
  for (const link of staleEntityLinks) {
    await db
      .delete(noteEntityLinks)
      .where(and(
        eq(noteEntityLinks.noteId, noteId),
        eq(noteEntityLinks.entityType, link.entityType),
        eq(noteEntityLinks.entityId, link.entityId),
      ));
  }

  // Insert new entity links
  const missingEntityLinks = entityLinks.filter(l => !existingEntityKeySet.has(`${l.entityType}:${l.entityId}`));
  if (missingEntityLinks.length > 0) {
    await db.insert(noteEntityLinks).values(
      missingEntityLinks.map(l => ({ noteId, entityType: l.entityType, entityId: l.entityId }))
    );
  }
}

/**
 * Get backlinks for a note — notes that link to this note.
 */
export async function getBacklinks(noteId: string): Promise<{ id: string; title: string; excerpt: string }[]> {
  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
    })
    .from(noteLinks)
    .innerJoin(notes, eq(noteLinks.sourceNoteId, notes.id))
    .where(and(
      eq(noteLinks.targetNoteId, noteId),
      isNull(notes.deletedAt),
    ));

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    excerpt: extractExcerpt(row.content || '', noteId),
  }));
}

/**
 * Extract a short excerpt around the first mention of a note title in content.
 */
function extractExcerpt(content: string, noteId: string): string {
  // Try to find [[Title]] pattern
  const linkMatch = content.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
  if (linkMatch) {
    const idx = content.indexOf(linkMatch[0]);
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + linkMatch[0].length + 40);
    let excerpt = content.slice(start, end).replace(/\n/g, ' ');
    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';
    return excerpt;
  }

  // Fallback: first 100 chars
  return content.slice(0, 100).replace(/\n/g, ' ') + (content.length > 100 ? '...' : '');
}

/**
 * Get all outgoing links for a note.
 */
export async function getOutgoingLinks(noteId: string): Promise<{
  noteLinks: { id: string; title: string }[];
  entityLinks: { entityType: string; entityId: string; title: string | null }[];
}> {
  // Note-to-note links
  const noteLinkRows = await db
    .select({ id: notes.id, title: notes.title })
    .from(noteLinks)
    .innerJoin(notes, eq(noteLinks.targetNoteId, notes.id))
    .where(and(
      eq(noteLinks.sourceNoteId, noteId),
      isNull(notes.deletedAt),
    ));

  // Entity links
  const entityLinkRows = await db
    .select({ entityType: noteEntityLinks.entityType, entityId: noteEntityLinks.entityId })
    .from(noteEntityLinks)
    .where(eq(noteEntityLinks.noteId, noteId));

  // Resolve entity titles
  const entityLinksWithTitles: { entityType: string; entityId: string; title: string | null }[] = [];
  for (const link of entityLinkRows) {
    let title: string | null = null;
    switch (link.entityType) {
      case 'task': {
        const [t] = await db.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, link.entityId)).limit(1);
        title = t?.title ?? null;
        break;
      }
      case 'habit': {
        const [h] = await db.select({ name: habits.name }).from(habits).where(eq(habits.id, link.entityId)).limit(1);
        title = h?.name ?? null;
        break;
      }
      case 'project': {
        const [p] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, link.entityId)).limit(1);
        title = p?.name ?? null;
        break;
      }
      case 'section': {
        const [s] = await db.select({ name: sections.name }).from(sections).where(eq(sections.id, link.entityId)).limit(1);
        title = s?.name ?? null;
        break;
      }
      case 'tag': {
        const [t] = await db.select({ name: tagsTable.name }).from(tagsTable).where(eq(tagsTable.id, link.entityId)).limit(1);
        title = t?.name ?? null;
        break;
      }
    }
    entityLinksWithTitles.push({ entityType: link.entityType, entityId: link.entityId, title });
  }

  return {
    noteLinks: noteLinkRows,
    entityLinks: entityLinksWithTitles,
  };
}
