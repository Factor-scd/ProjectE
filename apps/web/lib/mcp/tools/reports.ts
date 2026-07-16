import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerReportTools(server: McpServer) {
  server.tool('create_report', 'Create a new report', {
    title: z.string(),
    type: z.enum(['weekly', 'monthly', 'project', 'habit', 'custom']),
    domain: z.string(),
    date_range_start: z.string(),
    date_range_end: z.string(),
    summary: z.string().optional(),
    tags: z.array(z.string()).optional(),
    is_draft: z.boolean().optional(),
  }, async (args) => {
    try {
      const report = await pb.collection('reports').create({
        title: args.title,
        type: args.type,
        domain: args.domain,
        date_range: {
          start: args.date_range_start,
          end: args.date_range_end,
        },
        sections: [],
        summary: args.summary || '',
        tags: args.tags || [],
        is_draft: args.is_draft !== undefined ? args.is_draft : true,
      });
      return textContent(JSON.stringify({ success: true, report }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_report', 'Get a report by ID', {
    report_id: z.string(),
  }, async (args) => {
    try {
      const report = await pb.collection('reports').getOne(args.report_id);
      return textContent(JSON.stringify({ success: true, report }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_reports', 'List reports with optional filters', {
    type: z.enum(['weekly', 'monthly', 'project', 'habit', 'custom']).optional(),
    domain: z.string().optional(),
    is_draft: z.boolean().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const filters: string[] = [];
      if (args.type) filters.push(`type = "${args.type}"`);
      if (args.domain) filters.push(`domain = "${args.domain}"`);
      if (args.is_draft !== undefined) filters.push(`is_draft = ${args.is_draft}`);

      const page = Math.floor((args.offset || 0) / (args.limit || 20)) + 1;
      const result = await pb.collection('reports').getList(page, args.limit || 20, {
        filter: filters.join(' && ') || '',
        sort: '-created',
      });
      return textContent(JSON.stringify({
        success: true,
        reports: result.items,
        total: result.totalItems,
        page: result.page,
        limit: args.limit || 20,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_report', 'Update an existing report', {
    report_id: z.string(),
    title: z.string().optional(),
    summary: z.string().optional(),
    is_draft: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }, async (args) => {
    try {
      const { report_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      const report = await pb.collection('reports').update(report_id, cleaned);
      return textContent(JSON.stringify({ success: true, report }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_report', 'Delete a report', {
    report_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('reports').delete(args.report_id);
      return textContent(JSON.stringify({ success: true, deleted: args.report_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
