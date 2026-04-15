import { z } from 'zod';

// ─── Query ─────────────────────────────────────────────────────────────────────

export const ProjectQuerySchema = z.object({
  search:    z.string().optional(),
  status:    z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  accountId: z.string().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  pageSize:  z.coerce.number().int().min(1).max(500).default(20),
  sortBy:    z.enum(['createdAt', 'projectNumber', 'name', 'startDate', 'updatedAt']).default('createdAt'),
  sortDir:   z.enum(['asc', 'desc']).default('desc'),
});
export type ProjectQueryDto = z.infer<typeof ProjectQuerySchema>;

// ─── Create ────────────────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  projectCode:       z.string().min(1).max(50)
    .regex(/^[A-Z]{2,5}\d{2}-[A-Z0-9]{2,10}$/, 'Project code must match format e.g. SRE26-PSO002'),
  name:              z.string().min(1).max(200),
  opportunityId:     z.string().cuid(),
  accountId:         z.string().cuid(),
  siteId:            z.string().cuid(),
  projectManagerId:  z.string().cuid(),
  designLeadId:      z.string().cuid().optional(),
  procurementLeadId: z.string().cuid().optional(),
  startDate:         z.coerce.date().optional(),
  targetCod:         z.coerce.date().optional(),
  budgetBaseline:    z.number().positive().optional(),
  notes:             z.string().max(2000).optional(),
});
export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

// ─── Update ────────────────────────────────────────────────────────────────────

export const UpdateProjectSchema = z.object({
  name:              z.string().min(1).max(200).optional(),
  projectManagerId:  z.string().cuid().optional(),
  designLeadId:      z.string().cuid().nullable().optional(),
  procurementLeadId: z.string().cuid().nullable().optional(),
  startDate:         z.coerce.date().nullable().optional(),
  targetCod:         z.coerce.date().nullable().optional(),
  actualCod:         z.coerce.date().nullable().optional(),
  budgetBaseline:    z.number().positive().nullable().optional(),
  budgetUpdated:     z.number().positive().nullable().optional(),
  status:            z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  notes:             z.string().max(2000).nullable().optional(),
  // V1 RAG / blocker fields
  ragStatus:         z.enum(['GREEN', 'AMBER', 'RED']).optional(),
  currentBlocker:    z.string().max(500).nullable().optional(),
  blockerOwnerId:    z.string().cuid().nullable().optional(),
  blockerDueDate:    z.coerce.date().nullable().optional(),
  // PMO governance fields
  pmoStatusNote:     z.string().max(1000).nullable().optional(),
  lastPmoReviewAt:   z.coerce.date().nullable().optional(),
});
export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;

// ─── Gate status update ────────────────────────────────────────────────────────

export const UpdateGateStatusSchema = z.object({
  status:     z.enum(['IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED']),
  remarks:    z.string().max(1000).optional(),
  targetDate: z.coerce.date().optional(),
  // PMO review fields
  pmoFlagged:  z.boolean().optional(),
  pmoComment:  z.string().max(1000).nullable().optional(),
  pmoReviewAt: z.coerce.date().nullable().optional(),
});
export type UpdateGateStatusDto = z.infer<typeof UpdateGateStatusSchema>;

// ─── Deliverable update ────────────────────────────────────────────────────────

export const UpdateDeliverableSchema = z.object({
  status: z.enum(['PENDING', 'UPLOADED', 'SUBMITTED', 'APPROVED', 'NOT_REQUIRED']),
  notes:  z.string().max(1000).nullable().optional(),
});
export type UpdateDeliverableDto = z.infer<typeof UpdateDeliverableSchema>;
