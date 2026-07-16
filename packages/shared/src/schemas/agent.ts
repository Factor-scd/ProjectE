import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const agentPermissionTierEnum = z.enum([
  'full_access',
  'read_only',
  'content_creator',
  'task_manager',
  'custom',
]);
export const agentStatusEnum = z.enum(['active', 'disabled']);

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const agentActivitySchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  action: z.string(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  success: z.boolean().default(true),
  error_message: z.string().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createAgentActivitySchema = agentActivitySchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const agentTaskSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  task_type: z.string(),
  input: z.record(z.unknown()),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  output: z.record(z.unknown()).optional(),
  error_message: z.string().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createAgentTaskSchema = agentTaskSchema.omit({
  id: true,
  status: true,
  output: true,
  error_message: true,
  started_at: true,
  completed_at: true,
  created: true,
  updated: true,
});

// ── Agent Schema ─────────────────────────────────────────────────────────────

export const agentSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().optional(),
  status: agentStatusEnum.default('active'),
  permission_tier: agentPermissionTierEnum.default('read_only'),
  custom_permissions: z.array(z.string()).optional(),
  api_key: z.string().optional(),
  last_active_at: z.string().datetime().optional(),
  domain: z.string(),
  tags: z.array(z.string()).default([]),
  config: z.record(z.unknown()).optional(),
  custom_fields: z.record(z.unknown()).optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createAgentSchema = agentSchema.omit({
  id: true,
  last_active_at: true,
  created: true,
  updated: true,
});

export const updateAgentSchema = createAgentSchema.partial();

// ── Types ────────────────────────────────────────────────────────────────────

export type Agent = z.infer<typeof agentSchema>;
export type CreateAgent = z.infer<typeof createAgentSchema>;
export type UpdateAgent = z.infer<typeof updateAgentSchema>;
export type AgentActivity = z.infer<typeof agentActivitySchema>;
export type CreateAgentActivity = z.infer<typeof createAgentActivitySchema>;
export type AgentTask = z.infer<typeof agentTaskSchema>;
export type CreateAgentTask = z.infer<typeof createAgentTaskSchema>;
