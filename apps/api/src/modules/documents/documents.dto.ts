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

export const UploadDocumentSchema = z.object({
  title:         z.string().min(1).max(255),
  docType:       z.enum(DOC_CATEGORIES),
  opportunityId: z.string().cuid(),
  notes:         z.string().optional(),
  fileBase64:    z.string().min(1),
  fileName:      z.string().min(1).max(255),
  mimeType:      z.string().min(1).max(100),
  fileSizeBytes: z.coerce.number().int().positive(),
});

export const DocumentQuerySchema = z.object({
  opportunityId: z.string().optional(),
  projectId:     z.string().optional(),
  docType:       z.string().optional(),
  page:          z.coerce.number().int().min(1).default(1),
  pageSize:      z.coerce.number().int().min(1).max(200).default(100),
});

export type UploadDocumentDto  = z.infer<typeof UploadDocumentSchema>;
export type DocumentQueryDto   = z.infer<typeof DocumentQuerySchema>;
