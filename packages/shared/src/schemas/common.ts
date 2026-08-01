import { z } from 'zod';

// ── Tag ──────────────────────────────────────────────────────────────────────

export const tagSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Tag name is required'),
  color: z.string().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createTagSchema = tagSchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const updateTagSchema = createTagSchema.partial();

export type Tag = z.infer<typeof tagSchema>;
export type CreateTag = z.infer<typeof createTagSchema>;
export type UpdateTag = z.infer<typeof updateTagSchema>;

// ── Domain ───────────────────────────────────────────────────────────────────

export const domainSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Domain name is required'),
  color: z.string().optional(),
  icon: z.string().optional(),
  sort_order: z.number().int().nonnegative().default(0),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createDomainSchema = domainSchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const updateDomainSchema = createDomainSchema.partial();

export type Domain = z.infer<typeof domainSchema>;
export type CreateDomain = z.infer<typeof createDomainSchema>;
export type UpdateDomain = z.infer<typeof updateDomainSchema>;

// ── Time Entry ───────────────────────────────────────────────────────────────

export const timeEntrySourceEnum = z.enum(['manual', 'timer', 'pomodoro']);

export const timeEntrySchema = z.object({
  id: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  source: timeEntrySourceEnum,
  duration_minutes: z.number().int().positive(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  notes: z.string().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createTimeEntrySchema = timeEntrySchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const updateTimeEntrySchema = createTimeEntrySchema.partial();

export type TimeEntry = z.infer<typeof timeEntrySchema>;
export type CreateTimeEntry = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntry = z.infer<typeof updateTimeEntrySchema>;

// ── Notification ─────────────────────────────────────────────────────────────

export const notificationTypeEnum = z.enum(['info', 'success', 'warning', 'error']);

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeEnum,
  title: z.string().min(1),
  message: z.string(),
  read: z.boolean().default(false),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  action_url: z.string().url().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createNotificationSchema = notificationSchema.omit({
  id: true,
  read: true,
  created: true,
  updated: true,
});

export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotification = z.infer<typeof createNotificationSchema>;

// ── Error Log ────────────────────────────────────────────────────────────────

export const errorLogSchema = z.object({
  id: z.string(),
  level: z.enum(['warn', 'error', 'critical']),
  source: z.string(),
  message: z.string(),
  stack_trace: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  resolved: z.boolean().default(false),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createErrorLogSchema = errorLogSchema.omit({
  id: true,
  resolved: true,
  created: true,
  updated: true,
});

export type ErrorLog = z.infer<typeof errorLogSchema>;
export type CreateErrorLog = z.infer<typeof createErrorLogSchema>;

// ── Queue Job ────────────────────────────────────────────────────────────────

export const queueJobStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'failed']);

export const queueJobSchema = z.object({
  id: z.string(),
  queue: z.string(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  status: queueJobStatusEnum.default('pending'),
  attempts: z.number().int().nonnegative().default(0),
  max_attempts: z.number().int().positive().default(3),
  result: z.record(z.string(), z.unknown()).optional(),
  error_message: z.string().optional(),
  scheduled_at: z.string().datetime().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createQueueJobSchema = queueJobSchema.omit({
  id: true,
  attempts: true,
  result: true,
  error_message: true,
  started_at: true,
  completed_at: true,
  created: true,
  updated: true,
});

export type QueueJob = z.infer<typeof queueJobSchema>;
export type CreateQueueJob = z.infer<typeof createQueueJobSchema>;
