import { z } from 'zod';

// ─── Create proposal + first version ─────────────────────────────────────────

export const CreateProposalSchema = z.object({
  opportunityId:      z.string().cuid(),
  title:              z.string().min(1).max(255),           // e.g. "Option A – CAPEX Sale"
  estimatedCapex:     z.number().positive().optional(),
  marginPercent:      z.number().min(0).max(100).optional(),
  estimatedSavings:   z.number().positive().optional(),
  paybackYears:       z.number().positive().max(99).optional(),
  technicalSummary:   z.string().optional(),
  commercialSummary:  z.string().optional(),
});

// ─── Create a new version (cloned from prior) ────────────────────────────────

export const CreateVersionSchema = z.object({
  title:              z.string().min(1).max(255),
  estimatedCapex:     z.number().positive().optional(),
  marginPercent:      z.number().min(0).max(100).optional(),
  estimatedSavings:   z.number().positive().optional(),
  paybackYears:       z.number().positive().max(99).optional(),
  technicalSummary:   z.string().optional(),
  commercialSummary:  z.string().optional(),
});

// ─── Update a draft version ───────────────────────────────────────────────────

export const UpdateVersionSchema = CreateVersionSchema.partial();

// ─── Record an approval decision ─────────────────────────────────────────────

export const RecordDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'RETURNED']),
  comments: z.string().optional(),
}).superRefine((data, ctx) => {
  if ((data.decision === 'REJECTED' || data.decision === 'RETURNED') && !data.comments?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['comments'], message: 'Comments are required when rejecting or returning' });
  }
});

// ─── Query ────────────────────────────────────────────────────────────────────

export const ProposalQuerySchema = z.object({
  opportunityId: z.string().optional(),
  accountId:     z.string().optional(),
  status:        z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED']).optional(),
  page:          z.coerce.number().int().min(1).default(1),
  pageSize:      z.coerce.number().int().min(1).max(200).default(25),
  sortBy:        z.enum(['createdAt', 'updatedAt', 'proposalCode']).default('updatedAt'),
  sortDir:       z.enum(['asc', 'desc']).default('desc'),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateProposalDto   = z.infer<typeof CreateProposalSchema>;
export type CreateVersionDto    = z.infer<typeof CreateVersionSchema>;
export type UpdateVersionDto    = z.infer<typeof UpdateVersionSchema>;
export type RecordDecisionDto   = z.infer<typeof RecordDecisionSchema>;
export type ProposalQueryDto    = z.infer<typeof ProposalQuerySchema>;
