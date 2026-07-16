import { z } from 'zod';

// ── Sub-schemas ──────────────────────────────────────────────────────────────

export const noteLinkSchema = z.object({
  id: z.string(),
  source_note_id: z.string(),
  target_note_id: z.string(),
  label: z.string().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createNoteLinkSchema = noteLinkSchema.omit({
  id: true,
  created: true,
  updated: true,
});

export const noteTaskLinkSchema = z.object({
  id: z.string(),
  note_id: z.string(),
  task_id: z.string(),
  label: z.string().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createNoteTaskLinkSchema = noteTaskLinkSchema.omit({
  id: true,
  created: true,
  updated: true,
});

// ── Note Schema ──────────────────────────────────────────────────────────────

export const noteSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Note title is required'),
  content: z.string().optional(),
  domain: z.string(),
  tags: z.array(z.string()).default([]),
  project_id: z.string().optional(),
  is_pinned: z.boolean().default(false),
  is_archived: z.boolean().default(false),
  word_count: z.number().int().nonnegative().default(0),
  links: z.array(noteLinkSchema).default([]),
  task_links: z.array(noteTaskLinkSchema).default([]),
  attachments: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    mime_type: z.string(),
    size: z.number(),
    url: z.string(),
  })).default([]),
  custom_fields: z.record(z.unknown()).optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export const createNoteSchema = noteSchema.omit({
  id: true,
  word_count: true,
  links: true,
  task_links: true,
  created: true,
  updated: true,
});

export const updateNoteSchema = createNoteSchema.partial();

// ── Types ────────────────────────────────────────────────────────────────────

export type Note = z.infer<typeof noteSchema>;
export type CreateNote = z.infer<typeof createNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;
export type NoteLink = z.infer<typeof noteLinkSchema>;
export type CreateNoteLink = z.infer<typeof createNoteLinkSchema>;
export type NoteTaskLink = z.infer<typeof noteTaskLinkSchema>;
export type CreateNoteTaskLink = z.infer<typeof createNoteTaskLinkSchema>;
