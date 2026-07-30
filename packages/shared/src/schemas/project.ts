import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const projectStatusEnum = z.enum(['active', 'paused', 'archived']);

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const projectSettingsSchema = z.object({
  default_domain: z.string().optional(),
  default_priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  auto_archive_days: z.number().int().nonnegative().optional(),
  pomodoro_enabled: z.boolean().default(false),
  pomodoro_focus_minutes: z.number().int().positive().default(25),
  pomodoro_break_minutes: z.number().int().positive().default(5),
  notifications_enabled: z.boolean().default(true),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

// ── Project Schema ───────────────────────────────────────────────────────────

export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  status: projectStatusEnum.default('active'),
  domain: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
  owner: z.string().optional(),
  start_date: z.string().datetime().optional(),
  target_date: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  settings: projectSettingsSchema.optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createProjectSchema = projectSchema.omit({
  id: true,
  completed_at: true,
  created: true,
  updated: true,
});

export const updateProjectSchema = createProjectSchema.partial();

// ── Types ────────────────────────────────────────────────────────────────────

export type Project = z.infer<typeof projectSchema>;
export type CreateProject = z.infer<typeof createProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;
