import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const reportTypeEnum = z.enum(['weekly', 'monthly', 'project', 'habit', 'custom']);

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const reportTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  type: reportTypeEnum,
  sections: z.array(z.object({
    title: z.string(),
    type: z.enum(['summary', 'chart', 'table', 'list', 'text']).default('text'),
    config: z.record(z.unknown()).optional(),
    sort_order: z.number().int().nonnegative().default(0),
  })).default([]),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createReportTemplateSchema = reportTemplateSchema.omit({
  id: true,
  created: true,
  updated: true,
});

// ── Report Schema (matches frontend field names) ────────────────────────────

export const reportSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Report title is required').default('Untitled report'),
  content: z.string().optional().default(''),
  report_type: reportTypeEnum.default('custom'),
  date_range_start: z.string().datetime().optional(),
  date_range_end: z.string().datetime().optional(),
  domain: z.string().default('personal'),
  project_id: z.string().optional(),
  is_draft: z.boolean().default(true),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createReportSchema = reportSchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const updateReportSchema = createReportSchema.partial();

// ── Types ────────────────────────────────────────────────────────────────────

export type Report = z.infer<typeof reportSchema>;
export type CreateReport = z.infer<typeof createReportSchema>;
export type UpdateReport = z.infer<typeof updateReportSchema>;
export type ReportTemplate = z.infer<typeof reportTemplateSchema>;
export type CreateReportTemplate = z.infer<typeof createReportTemplateSchema>;