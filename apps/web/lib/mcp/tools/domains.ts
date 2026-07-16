import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerDomainTools(server: McpServer) {
  server.tool('create_domain', 'Create a new domain', {
    name: z.string(),
    color: z.string().optional(),
    icon: z.string().optional(),
    sort_order: z.number().optional(),
  }, async (args) => {
    try {
      const domain = await pb.collection('domains').create({
        name: args.name,
        color: args.color || null,
        icon: args.icon || null,
        sort_order: args.sort_order || 0,
      });
      return textContent(JSON.stringify({ success: true, domain }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_domain', 'Get a domain by ID', {
    domain_id: z.string(),
  }, async (args) => {
    try {
      const domain = await pb.collection('domains').getOne(args.domain_id);
      return textContent(JSON.stringify({ success: true, domain }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_domains', 'List all domains', {
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const page = Math.floor((args.offset || 0) / (args.limit || 50)) + 1;
      const result = await pb.collection('domains').getList(page, args.limit || 50, {
        sort: 'sort_order',
      });
      return textContent(JSON.stringify({
        success: true,
        domains: result.items,
        total: result.totalItems,
        page: result.page,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_domain', 'Update an existing domain', {
    domain_id: z.string(),
    name: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    sort_order: z.number().optional(),
  }, async (args) => {
    try {
      const { domain_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      const domain = await pb.collection('domains').update(domain_id, cleaned);
      return textContent(JSON.stringify({ success: true, domain }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_domain', 'Delete a domain', {
    domain_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('domains').delete(args.domain_id);
      return textContent(JSON.stringify({ success: true, deleted: args.domain_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
