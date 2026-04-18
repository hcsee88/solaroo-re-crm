import { z } from 'zod';

// Modules a saved view can belong to. Add as the UI grows.
export const SAVED_VIEW_MODULES = [
  'contracts',
  'opportunities',
  'projects',
  'proposals',
  'documents',
  'procurement',
  'audit',
] as const;

export const SavedViewQuerySchema = z.object({
  module: z.enum(SAVED_VIEW_MODULES),
});
export type SavedViewQueryDto = z.infer<typeof SavedViewQuerySchema>;

// `filters` is opaque JSON — the consuming page interprets it.
export const CreateSavedViewSchema = z.object({
  module:    z.enum(SAVED_VIEW_MODULES),
  name:      z.string().min(1).max(100),
  filters:   z.record(z.unknown()),
  columns:   z.array(z.string()).optional(),
  sortBy:    z.string().max(50).optional(),
  sortDir:   z.enum(['asc', 'desc']).optional(),
  isDefault: z.boolean().default(false),
});
export type CreateSavedViewDto = z.infer<typeof CreateSavedViewSchema>;
