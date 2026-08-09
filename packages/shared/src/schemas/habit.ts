import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const habitFrequencyEnum = z.enum(['daily', 'weekly', 'custom']);
export const habitDifficultyEnum = z.enum(['easy', 'medium', 'hard']);
export const habitCompletionModeEnum = z.enum(['quick', 'detailed']);

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const habitScoreConfigSchema = z.object({
  streak_weight: z.number().min(0).max(1).default(0.5),
  difficulty_weight: z.number().min(0).max(1).default(0.3),
  consistency_weight: z.number().min(0).max(1).default(0.2),
});

export const habitLogSchema = z.object({
  id: z.string(),
  habit_id: z.string(),
  completed: z.boolean(),
  notes: z.string().optional(),
  value: z.number().optional(),
  mood: z.number().int().min(1).max(5).optional(),
  skipped: z.boolean().default(false),
  logged_at: z.string().datetime(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createHabitLogSchema = habitLogSchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const habitSkipDaySchema = z.object({
  habit_id: z.string(),
  date: z.string().datetime(),
  reason: z.string().optional(),
});

// ── Habit Schema ─────────────────────────────────────────────────────────────

export const habitSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Habit name is required'),
  description: z.string().optional(),
  domain: z.string(),
  frequency: habitFrequencyEnum.default('daily'),
  custom_days: z.array(z.number().int().min(0).max(6)).optional(),
  difficulty: habitDifficultyEnum.default('medium'),
  completion_mode: habitCompletionModeEnum.default('quick'),
  goal_per_period: z.number().int().positive().default(1),
  icon: z.string().optional(),
  color: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  current_streak: z.number().int().nonnegative().default(0),
  best_streak: z.number().int().nonnegative().default(0),
  total_completions: z.number().int().nonnegative().default(0),
  score: z.number().default(0),
  score_config: habitScoreConfigSchema.optional(),
  active: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createHabitSchema = habitSchema.omit({
  id: true,
  current_streak: true,
  best_streak: true,
  total_completions: true,
  score: true,
  created: true,
  updated: true,
});

export const updateHabitSchema = createHabitSchema.partial();

// ── Types ────────────────────────────────────────────────────────────────────

export type Habit = z.infer<typeof habitSchema>;
export type CreateHabit = z.infer<typeof createHabitSchema>;
export type UpdateHabit = z.infer<typeof updateHabitSchema>;
export type HabitLog = z.infer<typeof habitLogSchema>;
export type CreateHabitLog = z.infer<typeof createHabitLogSchema>;
export type HabitSkipDay = z.infer<typeof habitSkipDaySchema>;
export type HabitScoreConfig = z.infer<typeof habitScoreConfigSchema>;
