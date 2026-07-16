import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const canvasModeEnum = z.enum(['freeform', 'graph']);
export const canvasCardTypeEnum = z.enum(['note', 'task', 'image', 'entity']);

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const canvasCardSchema = z.object({
  id: z.string(),
  canvas_id: z.string(),
  type: canvasCardTypeEnum,
  entity_id: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().positive().default(200),
  height: z.number().positive().default(150),
  rotation: z.number().default(0),
  color: z.string().optional(),
  z_index: z.number().int().default(0),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createCanvasCardSchema = canvasCardSchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const updateCanvasCardSchema = createCanvasCardSchema.partial();

// ── Canvas Schema ────────────────────────────────────────────────────────────

export const canvasSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Canvas name is required'),
  description: z.string().optional(),
  mode: canvasModeEnum.default('freeform'),
  domain: z.string(),
  tags: z.array(z.string()).default([]),
  cards: z.array(canvasCardSchema).default([]),
  connections: z.array(z.object({
    id: z.string(),
    source_card_id: z.string(),
    target_card_id: z.string(),
    label: z.string().optional(),
    style: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  })).default([]),
  viewport: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    zoom: z.number().positive().default(1),
  }).optional(),
  background: z.string().optional(),
  custom_fields: z.record(z.unknown()).optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createCanvasSchema = canvasSchema.omit({
  id: true,
  cards: true,
  connections: true,
  created: true,
  updated: true,
});

export const updateCanvasSchema = createCanvasSchema.partial();

// ── Types ────────────────────────────────────────────────────────────────────

export type Canvas = z.infer<typeof canvasSchema>;
export type CreateCanvas = z.infer<typeof createCanvasSchema>;
export type UpdateCanvas = z.infer<typeof updateCanvasSchema>;
export type CanvasCard = z.infer<typeof canvasCardSchema>;
export type CreateCanvasCard = z.infer<typeof createCanvasCardSchema>;
export type UpdateCanvasCard = z.infer<typeof updateCanvasCardSchema>;
