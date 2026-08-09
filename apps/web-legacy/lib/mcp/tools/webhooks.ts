import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerWebhookTools(server: McpServer) {
  server.tool('create_webhook', 'Create a new webhook', {
    name: z.string(),
    url: z.string(),
    events: z.array(z.string()),
    domain: z.string(),
    secret: z.string().optional(),
    active: z.boolean().optional(),
    retry_count: z.number().optional(),
  }, async (args) => {
    try {
      const webhook = await pb.collection('webhooks').create({
        name: args.name,
        url: args.url,
        events: args.events,
        domain: args.domain,
        secret: args.secret || '',
        active: args.active !== undefined ? args.active : true,
        retry_count: args.retry_count || 3,
      });
      return textContent(JSON.stringify({ success: true, webhook }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_webhook', 'Get a webhook by ID', {
    webhook_id: z.string(),
  }, async (args) => {
    try {
      const webhook = await pb.collection('webhooks').getOne(args.webhook_id);
      return textContent(JSON.stringify({ success: true, webhook }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_webhooks', 'List webhooks with optional filters', {
    domain: z.string().optional(),
    active: z.boolean().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const filters: string[] = [];
      if (args.domain) filters.push(`domain = "${args.domain}"`);
      if (args.active !== undefined) filters.push(`active = ${args.active}`);

      const page = Math.floor((args.offset || 0) / (args.limit || 20)) + 1;
      const result = await pb.collection('webhooks').getList(page, args.limit || 20, {
        filter: filters.join(' && ') || '',
        sort: '-created',
      });
      return textContent(JSON.stringify({
        success: true,
        webhooks: result.items,
        total: result.totalItems,
        page: result.page,
        limit: args.limit || 20,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_webhook', 'Update an existing webhook', {
    webhook_id: z.string(),
    name: z.string().optional(),
    url: z.string().optional(),
    events: z.array(z.string()).optional(),
    domain: z.string().optional(),
    active: z.boolean().optional(),
    retry_count: z.number().optional(),
  }, async (args) => {
    try {
      const { webhook_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      const webhook = await pb.collection('webhooks').update(webhook_id, cleaned);
      return textContent(JSON.stringify({ success: true, webhook }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_webhook', 'Delete a webhook', {
    webhook_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('webhooks').delete(args.webhook_id);
      return textContent(JSON.stringify({ success: true, deleted: args.webhook_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
