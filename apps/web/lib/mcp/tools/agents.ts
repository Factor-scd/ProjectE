import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerAgentTools(server: McpServer) {
  server.tool('create_agent', 'Create a new agent', {
    name: z.string(),
    description: z.string().optional(),
    domain: z.string(),
    status: z.enum(['active', 'disabled']).optional(),
    permission_tier: z.enum(['full_access', 'read_only', 'content_creator', 'task_manager', 'custom']).optional(),
    tags: z.array(z.string()).optional(),
  }, async (args) => {
    try {
      const agent = await pb.collection('agents').create({
        name: args.name,
        description: args.description || '',
        domain: args.domain,
        status: args.status || 'active',
        permission_tier: args.permission_tier || 'read_only',
        tags: args.tags || [],
        api_key: crypto.randomUUID(),
      });
      return textContent(JSON.stringify({ success: true, agent }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_agent', 'Get an agent by ID', {
    agent_id: z.string(),
  }, async (args) => {
    try {
      const agent = await pb.collection('agents').getOne(args.agent_id);
      return textContent(JSON.stringify({ success: true, agent }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_agents', 'List agents with optional filters', {
    status: z.enum(['active', 'disabled']).optional(),
    domain: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const filters: string[] = [];
      if (args.status) filters.push(`status = "${args.status}"`);
      if (args.domain) filters.push(`domain = "${args.domain}"`);

      const page = Math.floor((args.offset || 0) / (args.limit || 20)) + 1;
      const result = await pb.collection('agents').getList(page, args.limit || 20, {
        filter: filters.join(' && ') || '',
        sort: '-created',
      });
      return textContent(JSON.stringify({
        success: true,
        agents: result.items,
        total: result.totalItems,
        page: result.page,
        limit: args.limit || 20,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_agent', 'Update an existing agent', {
    agent_id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['active', 'disabled']).optional(),
    permission_tier: z.enum(['full_access', 'read_only', 'content_creator', 'task_manager', 'custom']).optional(),
    tags: z.array(z.string()).optional(),
  }, async (args) => {
    try {
      const { agent_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      const agent = await pb.collection('agents').update(agent_id, cleaned);
      return textContent(JSON.stringify({ success: true, agent }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_agent', 'Delete an agent', {
    agent_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('agents').delete(args.agent_id);
      return textContent(JSON.stringify({ success: true, deleted: args.agent_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
