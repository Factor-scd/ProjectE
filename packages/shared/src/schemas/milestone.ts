import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const milestoneStatusEnum = z.enum(['planned', 'in_progress', 'complete']);

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const milestoneDependencySchema = z.object({
  id: z.string(),
  milestone_id: z.string(),
  depends_on_id: z.string(),
  type: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish']).default('finish_to_start'),
  lag_days: z.number().int().default(0),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createMilestoneDependencySchema = milestoneDependencySchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const milestoneTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  domain: z.string(),
  default_duration_days: z.number().int().positive().default(14),
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    estimate: z.number().int().positive().optional(),
    sort_order: z.number().int().nonnegative().default(0),
  })).default([]),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createMilestoneTemplateSchema = milestoneTemplateSchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const milestoneHistorySchema = z.object({
  id: z.string(),
  milestone_id: z.string(),
  field: z.string(),
  old_value: z.string().optional(),
  new_value: z.string().optional(),
  changed_by: z.string().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

// ── Milestone Schema ─────────────────────────────────────────────────────────

export const milestoneSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Milestone name is required'),
  description: z.string().optional(),
  status: milestoneStatusEnum.default('planned'),
  project_id: z.string(),
  domain: z.string(),
  tags: z.array(z.string()).default([]),
  sort_order: z.number().int().nonnegative().default(0),
  target_date: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  tasks: z.array(z.string()).default([]),
  dependencies: z.array(milestoneDependencySchema).default([]),
  custom_fields: z.record(z.unknown()).optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createMilestoneSchema = milestoneSchema.omit({
  id: true,
  completed_at: true,
  dependencies: true,
  created: true,
  updated: true,
});

export const updateMilestoneSchema = createMilestoneSchema.partial();

// ── Types ────────────────────────────────────────────────────────────────────

export type Milestone = z.infer<typeof milestoneSchema>;
export type CreateMilestone = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestone = z.infer<typeof updateMilestoneSchema>;
export type MilestoneDependency = z.infer<typeof milestoneDependencySchema>;
export type CreateMilestoneDependency = z.infer<typeof createMilestoneDependencySchema>;
export type MilestoneTemplate = z.infer<typeof milestoneTemplateSchema>;
export type CreateMilestoneTemplate = z.infer<typeof createMilestoneTemplateSchema>;
export type MilestoneHistory = z.infer<typeof milestoneHistorySchema>;
