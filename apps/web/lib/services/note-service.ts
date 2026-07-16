import { createPocketBaseClient, createAdminClient } from '../pocketbase';
import type { Note, NoteLink, NoteTaskLink, Task } from '@project-e/shared';

/** Cast a PocketBase RecordModel to a typed domain model */
function asNote(record: Record<string, unknown>): Note {
  return record as unknown as Note;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asNoteLink(record: Record<string, unknown>): NoteLink {
  return record as unknown as NoteLink;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asNoteTaskLink(record: Record<string, unknown>): NoteTaskLink {
  return record as unknown as NoteTaskLink;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asTask(record: Record<string, unknown>): Task {
  return record as unknown as Task;
}

/**
 * Extract wikilinks from note content
 * Matches [[Note Title]] syntax
 */
export function extractWikilinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }

  return [...new Set(links)]; // Deduplicate
}

/**
 * Update note_links when a note is saved
 * Re-syncs all outbound wikilinks from the note content
 */
export async function syncNoteLinks(
  noteId: string,
  content: string,
  token?: string
): Promise<void> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  // Extract wikilinks from content
  const linkTitles = extractWikilinks(content);

  // Get existing links from this note
  const existingResults = await pb.collection('note_links').getFullList({
    filter: `source_note_id = "${noteId}"`,
  });
  const existingLinks = existingResults.map((r) =>
    asNoteLink(r as unknown as Record<string, unknown>)
  );

  // Delete existing links
  for (const link of existingLinks) {
    await pb.collection('note_links').delete(link.id);
  }

  // Create new links
  for (const title of linkTitles) {
    // Find target note by title
    const targetNotes = await pb.collection('notes').getFullList({
      filter: `title = "${title}"`,
    });

    if (targetNotes.length > 0) {
      await pb.collection('note_links').create({
        source_note_id: noteId,
        target_note_id: targetNotes[0].id,
        label: title,
      });
    }
  }
}

/**
 * Get backlinks for a note (notes that link TO this note)
 */
export async function getBacklinks(
  noteId: string,
  token?: string
): Promise<Note[]> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  // Find all note_links where this note is the target
  const linkResults = await pb.collection('note_links').getFullList({
    filter: `target_note_id = "${noteId}"`,
  });
  const links = linkResults.map((r) =>
    asNoteLink(r as unknown as Record<string, unknown>)
  );

  // Get the source notes
  const backlinks: Note[] = [];
  for (const link of links) {
    const note = asNote(
      await pb
        .collection('notes')
        .getOne(link.source_note_id) as unknown as Record<string, unknown>
    );
    backlinks.push(note);
  }

  return backlinks;
}

/**
 * Sync checkboxes in note content with tasks
 * Maps checkboxes to tasks via note_task_links
 */
export async function syncNoteTasks(
  noteId: string,
  content: string,
  token?: string
): Promise<void> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  // Extract checkbox patterns: - [ ] Task title or - [x] Task title
  const checkboxRegex = /^- \[([ x])\] (.+)$/gm;
  const checkboxes: Array<{
    done: boolean;
    title: string;
    position: number;
  }> = [];
  let match;
  let position = 0;

  while ((match = checkboxRegex.exec(content)) !== null) {
    checkboxes.push({
      done: match[1] === 'x',
      title: match[2].trim(),
      position: position++,
    });
  }

  // Get existing note_task_links
  const existingResults = await pb.collection('note_task_links').getFullList({
    filter: `note_id = "${noteId}"`,
  });
  const existingLinks = existingResults.map((r) =>
    asNoteTaskLink(r as unknown as Record<string, unknown>)
  );

  // Match checkboxes to existing links by index position
  for (let i = 0; i < checkboxes.length; i++) {
    const checkbox = checkboxes[i];
    const existingLink = existingLinks.find(
      (l) => l.label === `checkbox_${i}` || (!l.label && existingLinks.indexOf(l) === i)
    );

    if (existingLink) {
      // Update existing task
      const task = asTask(
        await pb
          .collection('tasks')
          .getOne(existingLink.task_id) as unknown as Record<string, unknown>
      );

      // Update title if changed
      if (task.title !== checkbox.title) {
        await pb.collection('tasks').update(existingLink.task_id, {
          title: checkbox.title,
        });
      }

      // Update done status if changed
      const taskDone = task.status === 'done';
      if (taskDone !== checkbox.done) {
        await pb.collection('tasks').update(existingLink.task_id, {
          status: checkbox.done ? 'done' : 'todo',
          ...(checkbox.done && { completed_at: new Date().toISOString() }),
        });
      }
    } else {
      // Create new task for this checkbox
      const note = asNote(
        await pb
          .collection('notes')
          .getOne(noteId) as unknown as Record<string, unknown>
      );

      const newTask = await pb.collection('tasks').create({
        title: checkbox.title,
        description: '',
        status: checkbox.done ? 'done' : 'todo',
        priority: 'medium',
        domain: note.domain,
        tags: [],
        ...(checkbox.done && { completed_at: new Date().toISOString() }),
      });

      // Create mapping
      await pb.collection('note_task_links').create({
        note_id: noteId,
        task_id: newTask.id,
        label: `checkbox_${i}`,
      });
    }
  }

  // Remove links for checkboxes that no longer exist
  for (const link of existingLinks) {
    const matchIndex = parseInt(
      (link.label || '').replace('checkbox_', ''),
      10
    );
    if (isNaN(matchIndex) || matchIndex >= checkboxes.length) {
      await pb.collection('note_task_links').delete(link.id);
    }
  }
}

/**
 * Parse frontmatter from note content
 * Frontmatter is YAML between --- delimiters at the top
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  contentWithoutFrontmatter: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, contentWithoutFrontmatter: content };
  }

  // Simple YAML parsing (key: value pairs)
  const yamlText = match[1];
  const frontmatter: Record<string, unknown> = {};

  for (const line of yamlText.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      // Try to parse as JSON for arrays/objects
      try {
        frontmatter[key] = JSON.parse(value);
      } catch {
        frontmatter[key] = value;
      }
    }
  }

  return {
    frontmatter,
    contentWithoutFrontmatter: match[2],
  };
}

/**
 * Get graph data for note visualization
 */
export async function getNoteGraph(
  token?: string
): Promise<{
  nodes: Array<{
    id: string;
    title: string;
    domain: string;
    connectionCount: number;
  }>;
  edges: Array<{ source: string; target: string }>;
}> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  const noteResults = await pb.collection('notes').getFullList();
  const notes = noteResults.map((r) => asNote(r as unknown as Record<string, unknown>));

  const linkResults = await pb.collection('note_links').getFullList();
  const links = linkResults.map((r) =>
    asNoteLink(r as unknown as Record<string, unknown>)
  );

  // Count connections per note
  const connectionCounts: Record<string, number> = {};
  for (const link of links) {
    connectionCounts[link.source_note_id] =
      (connectionCounts[link.source_note_id] || 0) + 1;
    connectionCounts[link.target_note_id] =
      (connectionCounts[link.target_note_id] || 0) + 1;
  }

  const nodes = notes.map((n) => ({
    id: n.id,
    title: n.title,
    domain: n.domain,
    connectionCount: connectionCounts[n.id] || 0,
  }));

  const edges = links.map((l) => ({
    source: l.source_note_id,
    target: l.target_note_id,
  }));

  return { nodes, edges };
}
