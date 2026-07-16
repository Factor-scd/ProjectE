import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdminClient } from '@/lib/pocketbase';

const pb = createAdminClient();

function textContent(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerHabitTools(server: McpServer) {
  server.tool('create_habit', 'Create a new habit', {
    name: z.string(),
    description: z.string().optional(),
    domain: z.string(),
    frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    goal_per_period: z.number().optional(),
    tags: z.array(z.string()).optional(),
  }, async (args) => {
    try {
      const habit = await pb.collection('habits').create({
        name: args.name,
        description: args.description || '',
        domain: args.domain,
        frequency: args.frequency || 'daily',
        difficulty: args.difficulty || 'medium',
        completion_mode: 'quick',
        goal_per_period: args.goal_per_period || 1,
        tags: args.tags || [],
        active: true,
        current_streak: 0,
        best_streak: 0,
        total_completions: 0,
        score: 0,
      });
      return textContent(JSON.stringify({ success: true, habit }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_habit', 'Get a habit by ID', {
    habit_id: z.string(),
  }, async (args) => {
    try {
      const habit = await pb.collection('habits').getOne(args.habit_id);
      return textContent(JSON.stringify({ success: true, habit }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('list_habits', 'List habits with optional filters', {
    domain: z.string().optional(),
    frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
    active: z.boolean().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }, async (args) => {
    try {
      const filters: string[] = [];
      if (args.domain) filters.push(`domain = "${args.domain}"`);
      if (args.frequency) filters.push(`frequency = "${args.frequency}"`);
      if (args.active !== undefined) filters.push(`active = ${args.active}`);

      const page = Math.floor((args.offset || 0) / (args.limit || 20)) + 1;
      const result = await pb.collection('habits').getList(page, args.limit || 20, {
        filter: filters.join(' && ') || '',
        sort: '-created',
      });
      return textContent(JSON.stringify({
        success: true,
        habits: result.items,
        total: result.totalItems,
        page: result.page,
        limit: args.limit || 20,
      }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('update_habit', 'Update an existing habit', {
    habit_id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    domain: z.string().optional(),
    frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    active: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }, async (args) => {
    try {
      const { habit_id, ...updateData } = args;
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) cleaned[key] = value;
      }
      const habit = await pb.collection('habits').update(habit_id, cleaned);
      return textContent(JSON.stringify({ success: true, habit }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('delete_habit', 'Delete a habit', {
    habit_id: z.string(),
  }, async (args) => {
    try {
      await pb.collection('habits').delete(args.habit_id);
      return textContent(JSON.stringify({ success: true, deleted: args.habit_id }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('log_habit_completion', 'Log a habit completion', {
    habit_id: z.string(),
    completed: z.boolean().optional(),
    notes: z.string().optional(),
    value: z.number().optional(),
    mood: z.number().optional(),
    logged_at: z.string().optional(),
  }, async (args) => {
    try {
      const log = await pb.collection('habit_logs').create({
        habit_id: args.habit_id,
        completed: args.completed !== undefined ? args.completed : true,
        notes: args.notes || '',
        value: args.value,
        mood: args.mood,
        logged_at: args.logged_at || new Date().toISOString(),
        skipped: false,
      });

      // Update habit streak and count
      const habit = await pb.collection('habits').getOne(args.habit_id);
      const now = new Date();
      const lastUpdated = habit.updated ? new Date(habit.updated) : null;
      let newStreak = (habit as Record<string, unknown>).current_streak as number || 0;

      if (lastUpdated) {
        const daysDiff = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) newStreak += 1;
        else if (daysDiff > 1) newStreak = 1;
      } else {
        newStreak = 1;
      }

      const bestStreak = Math.max(newStreak, (habit as Record<string, unknown>).best_streak as number || 0);

      await pb.collection('habits').update(args.habit_id, {
        current_streak: newStreak,
        best_streak: bestStreak,
        total_completions: ((habit as Record<string, unknown>).total_completions as number || 0) + 1,
      });

      return textContent(JSON.stringify({ success: true, log, habit_id: args.habit_id, current_streak: newStreak }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });

  server.tool('get_habit_streaks', 'Get streak information for all active habits', {}, async () => {
    try {
      const habits = await pb.collection('habits').getFullList({
        filter: 'active = true',
        sort: '-current_streak',
      });
      const streaks = habits.map((h: Record<string, unknown>) => ({
        habit_id: h.id,
        name: h.name,
        current_streak: h.current_streak,
        best_streak: h.best_streak,
        total_completions: h.total_completions,
        score: h.score,
      }));
      return textContent(JSON.stringify({ success: true, streaks }));
    } catch (error) {
      return textContent(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
