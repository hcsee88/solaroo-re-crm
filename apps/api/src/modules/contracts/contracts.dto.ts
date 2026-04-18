import { z } from 'zod';

// ─── Status enums (mirror Prisma) ─────────────────────────────────────────────

export const CONTRACT_STATUSES = [
  'DRAFT',
  'UNDER_REVIEW',
  'AWARDED',
  'SIGNED',
  'ACTIVE',
  'CLOSED',
  'DISPUTED',
  'TERMINATED',
] as const;

export const HANDOVER_STATUSES = [
  'NOT_STARTED',
  'READY',
  'IN_PROGRESS',
  'COMPLETED',
] as const;

// ─── Query ────────────────────────────────────────────────────────────────────

export const ContractQuerySchema = z.object({
  search:        z.string().optional(),
  status:        z.enum(CONTRACT_STATUSES).optional(),
  handoverStatus: z.enum(HANDOVER_STATUSES).optional(),
  accountId:     z.string().optional(),
  opportunityId: z.string().optional(),
  page:          z.coerce.number().int().min(1).default(1),
  pageSize:      z.coerce.number().int().min(1).max(200).default(25),
  sortBy:        z.enum(['createdAt', 'awardedDate', 'contractNo', 'title', 'targetCod', 'updatedAt']).default('createdAt'),
  sortDir:       z.enum(['asc', 'desc']).default('desc'),
});
export type ContractQueryDto = z.infer<typeof ContractQuerySchema>;

// ─── Create ───────────────────────────────────────────────────────────────────

export const CreateContractSchema = z.object({
  contractNo:                z.string().min(1).max(50),
  title:                     z.string().min(1).max(255),
  accountId:                 z.string().cuid(),
  opportunityId:             z.string().cuid().optional(),
  siteId:                    z.string().cuid().optional(),
  proposalVersionId:         z.string().cuid().optional(),
  projectManagerCandidateId: z.string().cuid().optional(),
  scopeSummary:              z.string().max(2000).optional(),
  paymentTerms:              z.string().max(500).optional(),
  retentionPercent:          z.number().min(0).max(100).optional(),
  contractValue:             z.number().nonnegative(),
  currency:                  z.string().min(3).max(3).default('MYR'),
  awardedDate:               z.coerce.date().optional(),
  signedDate:                z.coerce.date().optional(),
  commencementDate:          z.coerce.date().optional(),
  targetCod:                 z.coerce.date().optional(),
  defectsLiabilityMonths:    z.number().int().min(0).max(120).optional(),
  notes:                     z.string().max(2000).optional(),
});
export type CreateContractDto = z.infer<typeof CreateContractSchema>;

// ─── Update ───────────────────────────────────────────────────────────────────

export const UpdateContractSchema = z.object({
  title:                     z.string().min(1).max(255).optional(),
  siteId:                    z.string().cuid().nullable().optional(),
  proposalVersionId:         z.string().cuid().nullable().optional(),
  projectManagerCandidateId: z.string().cuid().nullable().optional(),
  scopeSummary:              z.string().max(2000).nullable().optional(),
  paymentTerms:              z.string().max(500).nullable().optional(),
  retentionPercent:          z.number().min(0).max(100).nullable().optional(),
  contractValue:             z.number().nonnegative().optional(),
  currency:                  z.string().min(3).max(3).optional(),
  awardedDate:               z.coerce.date().nullable().optional(),
  signedDate:                z.coerce.date().nullable().optional(),
  commencementDate:          z.coerce.date().nullable().optional(),
  targetCod:                 z.coerce.date().nullable().optional(),
  defectsLiabilityMonths:    z.number().int().min(0).max(120).nullable().optional(),
  notes:                     z.string().max(2000).nullable().optional(),
});
export type UpdateContractDto = z.infer<typeof UpdateContractSchema>;

// ─── Status transition ────────────────────────────────────────────────────────

export const TransitionStatusSchema = z.object({
  toStatus: z.enum(CONTRACT_STATUSES),
  reason:   z.string().max(500).optional(),
});
export type TransitionStatusDto = z.infer<typeof TransitionStatusSchema>;

// ─── Handover ────────────────────────────────────────────────────────────────

export const StartHandoverSchema = z.object({
  // Optional: caller may override the default checklist with a custom one
  checklist: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        label: z.string().min(1).max(255),
      }),
    )
    .optional(),
});
export type StartHandoverDto = z.infer<typeof StartHandoverSchema>;

export const UpdateChecklistItemSchema = z.object({
  key:  z.string().min(1).max(100),
  done: z.boolean(),
});
export type UpdateChecklistItemDto = z.infer<typeof UpdateChecklistItemSchema>;

export const CompleteHandoverSchema = z.object({
  // Allow overriding the auto-generated project code; otherwise derived.
  projectCode: z
    .string()
    .regex(/^[A-Z]{2,5}\d{2}-[A-Z0-9]{2,10}$/, 'Project code must match format e.g. SRE26-PSO002')
    .optional(),
  projectName: z.string().min(1).max(200).optional(),
  // PMO can re-assign the PM at handover time (overrides projectManagerCandidateId on the contract)
  projectManagerId: z.string().cuid().optional(),
});
export type CompleteHandoverDto = z.infer<typeof CompleteHandoverSchema>;
