import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createPocketBaseClient, createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerTaskTools(server: McpServer) {
  server.tool('create_task', 'Create a new task', {
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    due_date: z.string().optional(),
    project_id: z.string().optional(),
    milestone_id: z.string().optional(),
    tags: z.array(z.string()).optional(),
    domain: z.string(),
    assignee: z.string().optional(),
    estimate: z.number().optional(),
  }, async (args) => {
    try {
      const task = await pb.collection('tasks').create({
        title: args.title,
        description: args.description || '',
        status: args.status || 'todo',
        priority: args.priority || 'medium',
        due_date: args.due_date || null,
        project_id: args.project_id || '',
        milestone_id: args.milestone_id || '',
        tags: args.tags || [],
        domain: args.domain,
        assignee: args.assignee || '',
        estimate: args.estimate || null,
        attachments: [],
        dependencies: [],
        subtasks: [],
      });
      return textContent(JSON.stringify({ success: true, task }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_task', 'Get a task by ID', {
    task_id: z.string(),
  }, async (args) => {
    try {
      const task = await pb.collection('tasks').getOne(args.task_id);
      return textContent(JSON.stringify({ success: true, task }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_tasks', 'List tasks with optional filters', {
    status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    project_id: z.string().optional(),
    milestone_id: z.string().optional(),
    domain: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const filters: string[] = [];
      if (args.status) filters.push(`status = "${args.status}"`);
      if (args.priority) filters.push(`priority = "${args.priority}"`);
      if (args.project_id) filters.push(`project_id = "${args.project_id}"`);
      if (args.milestone_id) filters.push(`milestone_id = "${args.milestone_id}"`);
      if (args.domain) filters.push(`domain = "${args.domain}"`);

      const page = Math.floor((args.offset || 0) / (args.limit || 20)) + 1;
      const result = await pb.collection('tasks').getList(page, args.limit || 20, {
        filter: filters.join(' && ') || '',
        sort: '-created',
      });
      return textContent(JSON.stringify({
        success: true,
        tasks: result.items,
        total: result.totalItems,
        page: result.page,
        limit: args.limit || 20,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_task', 'Update an existing task', {
    task_id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    due_date: z.string().optional(),
    project_id: z.string().optional(),
    milestone_id: z.string().optional(),
    tags: z.array(z.string()).optional(),
    domain: z.string().optional(),
    assignee: z.string().optional(),
    estimate: z.number().optional(),
  }, async (args) => {
    try {
      const { task_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      const task = await pb.collection('tasks').update(task_id, cleaned);
      return textContent(JSON.stringify({ success: true, task }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_task', 'Delete a task', {
    task_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('tasks').delete(args.task_id);
      return textContent(JSON.stringify({ success: true, deleted: args.task_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('bulk_create_tasks', 'Create multiple tasks at once', {
    tasks: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      due_date: z.string().optional(),
      project_id: z.string().optional(),
      domain: z.string(),
      tags: z.array(z.string()).optional(),
    })),
  }, async (args) => {
    try {
      const created = [];
      for (const taskData of args.tasks) {
        const task = await pb.collection('tasks').create({
          title: taskData.title,
          description: taskData.description || '',
          status: taskData.status || 'todo',
          priority: taskData.priority || 'medium',
          due_date: taskData.due_date || null,
          project_id: taskData.project_id || '',
          domain: taskData.domain,
          tags: taskData.tags || [],
          attachments: [],
          dependencies: [],
          subtasks: [],
        });
        created.push(task);
      }
      return textContent(JSON.stringify({ success: true, created, count: created.length }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('bulk_update_tasks', 'Update multiple tasks at once', {
    updates: z.array(z.object({
      task_id: z.string(),
      title: z.string().optional(),
      status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    })),
  }, async (args) => {
    try {
      const updated = [];
      for (const { task_id, ...data } of args.updates) {
        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) cleaned[key] = value;
        }
        const task = await pb.collection('tasks').update(task_id, cleaned);
        updated.push(task);
      }
      return textContent(JSON.stringify({ success: true, updated, count: updated.length }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('bulk_delete_tasks', 'Delete multiple tasks at once', {
    task_ids: z.array(z.string()),
  }, async (args) => {
    try {
      const deleted = [];
      for (const id of args.task_ids) {
        await pb.collection('tasks').delete(id);
        deleted.push(id);
      }
      return textContent(JSON.stringify({ success: true, deleted, count: deleted.length }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
