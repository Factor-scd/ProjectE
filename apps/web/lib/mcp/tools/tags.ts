import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerTagTools(server: McpServer) {
  server.tool('create_tag', 'Create a new tag', {
    name: z.string(),
    color: z.string().optional(),
  }, async (args) => {
    try {
      const tag = await pb.collection('tags').create({
        name: args.name,
        color: args.color || null,
      });
      return textContent(JSON.stringify({ success: true, tag }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_tag', 'Get a tag by ID', {
    tag_id: z.string(),
  }, async (args) => {
    try {
      const tag = await pb.collection('tags').getOne(args.tag_id);
      return textContent(JSON.stringify({ success: true, tag }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_tags', 'List all tags', {
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const page = Math.floor((args.offset || 0) / (args.limit || 50)) + 1;
      const result = await pb.collection('tags').getList(page, args.limit || 50, {
        sort: 'name',
      });
      return textContent(JSON.stringify({
        success: true,
        tags: result.items,
        total: result.totalItems,
        page: result.page,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_tag', 'Update an existing tag', {
    tag_id: z.string(),
    name: z.string().optional(),
    color: z.string().optional(),
  }, async (args) => {
    try {
      const { tag_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      const tag = await pb.collection('tags').update(tag_id, cleaned);
      return textContent(JSON.stringify({ success: true, tag }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_tag', 'Delete a tag', {
    tag_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('tags').delete(args.tag_id);
      return textContent(JSON.stringify({ success: true, deleted: args.tag_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
