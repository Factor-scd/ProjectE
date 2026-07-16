import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerMilestoneTools(server: McpServer) {
  server.tool('create_milestone', 'Create a new milestone', {
    name: z.string(),
    description: z.string().optional(),
    project_id: z.string(),
    domain: z.string(),
    status: z.enum(['planned', 'in_progress', 'complete']).optional(),
    target_date: z.string().optional(),
    sort_order: z.number().optional(),
    tags: z.array(z.string()).optional(),
  }, async (args) => {
    try {
      const milestone = await pb.collection('milestones').create({
        name: args.name,
        description: args.description || '',
        project_id: args.project_id,
        domain: args.domain,
        status: args.status || 'planned',
        target_date: args.target_date || null,
        sort_order: args.sort_order || 0,
        tags: args.tags || [],
        tasks: [],
        dependencies: [],
      });
      return textContent(JSON.stringify({ success: true, milestone }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_milestone', 'Get a milestone by ID', {
    milestone_id: z.string(),
  }, async (args) => {
    try {
      const milestone = await pb.collection('milestones').getOne(args.milestone_id);
      return textContent(JSON.stringify({ success: true, milestone }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_milestones', 'List milestones with optional filters', {
    project_id: z.string().optional(),
    status: z.enum(['planned', 'in_progress', 'complete']).optional(),
    domain: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const filters: string[] = [];
      if (args.project_id) filters.push(`project_id = "${args.project_id}"`);
      if (args.status) filters.push(`status = "${args.status}"`);
      if (args.domain) filters.push(`domain = "${args.domain}"`);

      const page = Math.floor((args.offset || 0) / (args.limit || 20)) + 1;
      const result = await pb.collection('milestones').getList(page, args.limit || 20, {
        filter: filters.join(' && ') || '',
        sort: 'sort_order',
      });
      return textContent(JSON.stringify({
        success: true,
        milestones: result.items,
        total: result.totalItems,
        page: result.page,
        limit: args.limit || 20,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_milestone', 'Update an existing milestone', {
    milestone_id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['planned', 'in_progress', 'complete']).optional(),
    target_date: z.string().optional(),
    sort_order: z.number().optional(),
    tags: z.array(z.string()).optional(),
  }, async (args) => {
    try {
      const { milestone_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      if (cleaned.status === 'complete') {
        cleaned.completed_at = new Date().toISOString();
      }
      const milestone = await pb.collection('milestones').update(milestone_id, cleaned);
      return textContent(JSON.stringify({ success: true, milestone }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_milestone', 'Delete a milestone', {
    milestone_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('milestones').delete(args.milestone_id);
      return textContent(JSON.stringify({ success: true, deleted: args.milestone_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
