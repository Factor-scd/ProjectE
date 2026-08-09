import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerAnalyticsTools(server: McpServer) {
  server.tool('get_analytics', 'Get analytics data for a given period', {
    period_days: z.number().optional(),
  }, async (args) => {
    try {
      const days = args.period_days || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startStr = startDate.toISOString();

      // Task completion rate
      const tasks = await pb.collection('tasks').getFullList({
        filter: `created >= "${startStr}"`,
      });
      const completedTasks = tasks.filter((t: Record<string, unknown>) => t.status === 'done');
      const taskCompletionRate = tasks.length > 0
        ? Math.round((completedTasks.length / tasks.length) * 100)
        : 0;

      // Habit consistency
      const habits = await pb.collection('habits').getFullList();
      const habitLogs = await pb.collection('habit_logs').getFullList({
        filter: `logged_at >= "${startStr}"`,
      });
      const habitConsistency = habits.length > 0
        ? Math.round((habitLogs.length / (habits.length * days)) * 100)
        : 0;

      // Time tracked
      const timeEntries = await pb.collection('task_time_entries').getFullList({
        filter: `started_at >= "${startStr}"`,
      });
      const totalTimeMinutes = timeEntries.reduce(
        (sum: number, e: Record<string, unknown>) => sum + ((e.duration_minutes as number) || 0),
        0,
      );

      // Active streaks
      const activeStreaks = habits.filter(
        (h: Record<string, unknown>) => ((h.current_streak as number) || 0) > 0,
      );
      const bestStreak = Math.max(
        ...habits.map((h: Record<string, unknown>) => (h.best_streak as number) || 0),
        0,
      );

      return textContent(JSON.stringify({
        success: true,
        analytics: {
          taskCompletionRate,
          habitConsistency,
          totalTimeMinutes,
          activeStreaks: activeStreaks.length,
          bestStreak,
          period: days,
        },
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_time_summary', 'Get aggregated time tracking summary', {
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  }, async (args) => {
    try {
      const startDate = args.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = args.end_date || new Date().toISOString();

      const entries = await pb.collection('task_time_entries').getFullList({
        filter: `started_at >= "${startDate}" && started_at <= "${endDate}"`,
      });

      const byDomain: Record<string, number> = {};
      const byProject: Record<string, number> = {};
      const byTag: Record<string, number> = {};
      let totalMinutes = 0;

      for (const entry of entries) {
        const duration = (entry as Record<string, unknown>).duration_minutes as number || 0;
        totalMinutes += duration;

        const taskId = (entry as Record<string, unknown>).task_id as string;
        if (taskId) {
          try {
            const task = await pb.collection('tasks').getOne(taskId);
            const taskRecord = task as unknown as Record<string, unknown>;
            const domain = taskRecord.domain as string;
            if (domain) {
              byDomain[domain] = (byDomain[domain] || 0) + duration;
            }

            const projectId = taskRecord.project_id as string | undefined;
            if (projectId) {
              byProject[projectId] = (byProject[projectId] || 0) + duration;
            }

            const tags = (taskRecord.tags as string[]) || [];
            for (const tag of tags) {
              byTag[tag] = (byTag[tag] || 0) + duration;
            }
          } catch {
            // Skip if task not found
          }
        }
      }

      return textContent(JSON.stringify({
        success: true,
        time_summary: {
          totalMinutes,
          byDomain,
          byProject,
          byTag,
          startDate,
          endDate,
        },
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('search', 'Search across tasks, habits, projects, notes, and reports', {
    query: z.string(),
    types: z.array(z.string()).optional(),
    limit: z.number().optional(),
  }, async (args) => {
    try {
      const types = args.types || ['tasks', 'habits', 'projects', 'notes', 'reports'];
      const limit = args.limit || 10;
      const safeQuery = args.query.replace(/"/g, '\\"');
      const results: Array<{ type: string; items: unknown[] }> = [];

      for (const type of types) {
        try {
          let filter = '';
          switch (type) {
            case 'tasks':
              filter = `title ~ "${safeQuery}" || description ~ "${safeQuery}"`;
              break;
            case 'habits':
              filter = `name ~ "${safeQuery}" || description ~ "${safeQuery}"`;
              break;
            case 'projects':
              filter = `name ~ "${safeQuery}" || description ~ "${safeQuery}"`;
              break;
            case 'notes':
              filter = `title ~ "${safeQuery}" || content ~ "${safeQuery}"`;
              break;
            case 'reports':
              filter = `title ~ "${safeQuery}" || summary ~ "${safeQuery}"`;
              break;
            default:
              continue;
          }

          const items = await pb.collection(type).getList(1, limit, { filter });
          results.push({ type, items: items.items });
        } catch {
          // Skip collections that fail
        }
      }

      return textContent(JSON.stringify({ success: true, results }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_agent_activity', 'Get recent agent activity', {
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const page = Math.floor((args.offset || 0) / (args.limit || 20)) + 1;
      const result = await pb.collection('agent_activity').getList(page, args.limit || 20, {
        sort: '-created',
      });
      return textContent(JSON.stringify({
        success: true,
        activity: result.items,
        total: result.totalItems,
        page: result.page,
        limit: args.limit || 20,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
