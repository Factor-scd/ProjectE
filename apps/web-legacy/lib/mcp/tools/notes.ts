import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerNoteTools(server: McpServer) {
  server.tool('create_note', 'Create a new note', {
    title: z.string(),
    content: z.string().optional(),
    domain: z.string(),
    tags: z.array(z.string()).optional(),
    project_id: z.string().optional(),
    is_pinned: z.boolean().optional(),
  }, async (args) => {
    try {
      const content = args.content || '';
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const note = await pb.collection('notes').create({
        title: args.title,
        content,
        domain: args.domain,
        tags: args.tags || [],
        project_id: args.project_id || '',
        is_pinned: args.is_pinned || false,
        is_archived: false,
        word_count: wordCount,
      });
      return textContent(JSON.stringify({ success: true, note }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_note', 'Get a note by ID', {
    note_id: z.string(),
  }, async (args) => {
    try {
      const note = await pb.collection('notes').getOne(args.note_id);
      return textContent(JSON.stringify({ success: true, note }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_notes', 'List notes with optional filters', {
    domain: z.string().optional(),
    project_id: z.string().optional(),
    is_archived: z.boolean().optional(),
    is_pinned: z.boolean().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const filters: string[] = [];
      if (args.domain) filters.push(`domain = "${args.domain}"`);
      if (args.project_id) filters.push(`project_id = "${args.project_id}"`);
      if (args.is_archived !== undefined) filters.push(`is_archived = ${args.is_archived}`);
      if (args.is_pinned !== undefined) filters.push(`is_pinned = ${args.is_pinned}`);

      const page = Math.floor((args.offset || 0) / (args.limit || 20)) + 1;
      const result = await pb.collection('notes').getList(page, args.limit || 20, {
        filter: filters.join(' && ') || '',
        sort: '-created',
      });
      return textContent(JSON.stringify({
        success: true,
        notes: result.items,
        total: result.totalItems,
        page: result.page,
        limit: args.limit || 20,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_note', 'Update an existing note', {
    note_id: z.string(),
    title: z.string().optional(),
    content: z.string().optional(),
    domain: z.string().optional(),
    tags: z.array(z.string()).optional(),
    project_id: z.string().optional(),
    is_pinned: z.boolean().optional(),
    is_archived: z.boolean().optional(),
  }, async (args) => {
    try {
      const { note_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      if (typeof cleaned.content === 'string') {
        cleaned.word_count = cleaned.content.split(/\s+/).filter(Boolean).length;
      }
      const note = await pb.collection('notes').update(note_id, cleaned);
      return textContent(JSON.stringify({ success: true, note }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_note', 'Delete a note', {
    note_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('notes').delete(args.note_id);
      return textContent(JSON.stringify({ success: true, deleted: args.note_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_note_graph', 'Get the note graph showing connections between notes', {}, async () => {
    try {
      const notes = await pb.collection('notes').getFullList();
      const links = await pb.collection('note_links').getFullList();

      const nodes = notes.map((n: Record<string, unknown>) => ({
        id: n.id,
        title: n.title,
        domain: n.domain,
      }));

      const edges = links.map((l: Record<string, unknown>) => ({
        source: l.source_note_id,
        target: l.target_note_id,
        label: l.label || '',
      }));

      return textContent(JSON.stringify({ success: true, graph: { nodes, edges } }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
