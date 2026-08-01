import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerProjectTools(server: McpServer) {
  server.tool('create_project', 'Create a new project', {
    name: z.string(),
    description: z.string().optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    domain: z.string(),
    color: z.string().optional(),
    icon: z.string().optional(),
    tags: z.array(z.string()).optional(),
    owner: z.string().optional(),
    start_date: z.string().optional(),
    target_date: z.string().optional(),
  }, async (args) => {
    try {
      const project = await pb.collection('projects').create({
        name: args.name,
        description: args.description || '',
        status: args.status || 'active',
        domain: args.domain,
        color: args.color || null,
        icon: args.icon || null,
        tags: args.tags || [],
        owner: args.owner || '',
        start_date: args.start_date || null,
        target_date: args.target_date || null,
      });
      return textContent(JSON.stringify({ success: true, project }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_project', 'Get a project by ID', {
    project_id: z.string(),
  }, async (args) => {
    try {
      const project = await pb.collection('projects').getOne(args.project_id);
      return textContent(JSON.stringify({ success: true, project }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_projects', 'List projects with optional filters', {
    status: z.enum(['active', 'paused', 'archived']).optional(),
    domain: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const filters: string[] = [];
      if (args.status) filters.push(`status = "${args.status}"`);
      if (args.domain) filters.push(`domain = "${args.domain}"`);

      const page = Math.floor((args.offset || 0) / (args.limit || 20)) + 1;
      const result = await pb.collection('projects').getList(page, args.limit || 20, {
        filter: filters.join(' && ') || '',
        sort: '-created',
      });
      return textContent(JSON.stringify({
        success: true,
        projects: result.items,
        total: result.totalItems,
        page: result.page,
        limit: args.limit || 20,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_project', 'Update an existing project', {
    project_id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    domain: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    tags: z.array(z.string()).optional(),
    owner: z.string().optional(),
  }, async (args) => {
    try {
      const { project_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      const project = await pb.collection('projects').update(project_id, cleaned);
      return textContent(JSON.stringify({ success: true, project }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_project', 'Delete a project', {
    project_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('projects').delete(args.project_id);
      return textContent(JSON.stringify({ success: true, deleted: args.project_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_project_progress', 'Get project progress based on task completion', {
    project_id: z.string(),
  }, async (args) => {
    try {
      const tasks = await pb.collection('tasks').getFullList({
        filter: `project_id = "${args.project_id}"`,
      });
      const total = tasks.length;
      const done = tasks.filter((t: Record<string, unknown>) => t.status === 'done').length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      return textContent(JSON.stringify({
        success: true,
        project_id: args.project_id,
        total_tasks: total,
        completed_tasks: done,
        progress,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
