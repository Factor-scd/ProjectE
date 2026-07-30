import { z } from 'zod';

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const webhookDeliverySchema = z.object({
  id: z.string(),
  webhook_id: z.string(),
  event: z.string(),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(['success', 'failed', 'pending']).default('pending'),
  status_code: z.number().int().optional(),
  response_body: z.string().optional(),
  error_message: z.string().optional(),
  attempts: z.number().int().nonnegative().default(0),
  delivered_at: z.string().datetime().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

// ── Webhook Schema ───────────────────────────────────────────────────────────

export const webhookSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Webhook name is required'),
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  secret: z.string().optional(),
  active: z.boolean().default(true),
  domain: z.string(),
  headers: z.record(z.string()).optional(),
  retry_count: z.number().int().nonnegative().default(3),
  last_triggered_at: z.string().datetime().optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createWebhookSchema = webhookSchema.omit({
  id: true,
  last_triggered_at: true,
  created: true,
  updated: true,
});

export const updateWebhookSchema = createWebhookSchema.partial();

// ── Types ────────────────────────────────────────────────────────────────────

export type Webhook = z.infer<typeof webhookSchema>;
export type CreateWebhook = z.infer<typeof createWebhookSchema>;
export type UpdateWebhook = z.infer<typeof updateWebhookSchema>;
export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>;
