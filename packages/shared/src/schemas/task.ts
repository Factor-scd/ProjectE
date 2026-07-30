import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const taskStatusEnum = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
export const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const recurringConfigSchema = z.object({
  rule: z.string().min(1, 'Recurrence rule is required'),
  next_due: z.string().datetime().optional(),
});

export const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mime_type: z.string(),
  size: z.number().int().nonnegative(),
  url: z.string(),
});

export const subtaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Subtask title is required'),
  done: z.boolean().default(false),
  sort_order: z.number().int().nonnegative().default(0),
});

// ── Task Schema ──────────────────────────────────────────────────────────────

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: taskStatusEnum.default('todo'),
  priority: taskPriorityEnum.default('medium'),
  due_date: z.string().datetime().optional().nullable(),
  project_id: z.string().optional(),
  milestone_id: z.string().optional(),
  tags: z.array(z.string()).default([]),
  domain: z.string(),
  assignee: z.string().optional(),
  estimate: z.number().int().positive().optional(),
  time_spent: z.number().int().nonnegative().default(0),
  recurring_config: recurringConfigSchema.optional(),
  attachments: z.array(attachmentSchema).default([]),
  dependencies: z.array(z.string()).default([]),
  subtasks: z.array(subtaskSchema).default([]),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  completed_at: z.string().datetime().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createTaskSchema = taskSchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const updateTaskSchema = createTaskSchema.partial();

// ── Types ────────────────────────────────────────────────────────────────────

export type Task = z.infer<typeof taskSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type RecurringConfig = z.infer<typeof recurringConfigSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type Subtask = z.infer<typeof subtaskSchema>;
