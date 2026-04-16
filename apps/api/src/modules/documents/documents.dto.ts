import { z } from 'zod';

export const DOC_CATEGORIES = [
  'Site Information',
  'Drawings',
  'Costing',
  'Proposal',
  'Contracts',
  'Other',
] as const;

export type DocCategory = typeof DOC_CATEGORIES[number];

// ─── Upload ──────────────────────────────────────────────────────────────────
// Either opportunityId OR projectId must be provided (not both required, but at least one).

export const UploadDocumentSchema = z.object({
  title:         z.string().min(1).max(255),
  docType:       z.enum(DOC_CATEGORIES),
  opportunityId: z.string().cuid().optional(),
  projectId:     z.string().cuid().optional(),
  notes:         z.string().max(1000).optional(),
  fileBase64:    z.string().min(1),
  fileName:      z.string().min(1).max(255),
  mimeType:      z.string().min(1).max(100),
  fileSizeBytes: z.coerce.number().int().positive(),
}).refine(
  (d) => !!(d.opportunityId || d.projectId),
  { message: 'Provide either opportunityId or projectId', path: ['opportunityId'] },
);

// ─── Query ───────────────────────────────────────────────────────────────────

export const DocumentQuerySchema = z.object({
  opportunityId: z.string().optional(),
  projectId:     z.string().optional(),
  docType:       z.string().optional(),
  status:        z.string().optional(),
  search:        z.string().optional(),
  sortBy:        z.enum(['createdAt', 'title', 'docCode', 'updatedAt']).default('createdAt'),
  sortDir:       z.enum(['asc', 'desc']).default('desc'),
  page:          z.coerce.number().int().min(1).default(1),
  pageSize:      z.coerce.number().int().min(1).max(100).default(20),
});

export type UploadDocumentDto = z.infer<typeof UploadDocumentSchema>;
export type DocumentQueryDto  = z.infer<typeof DocumentQuerySchema>;
