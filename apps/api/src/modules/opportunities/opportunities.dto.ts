import { z } from 'zod';

const STAGES = [
  'LEAD', 'QUALIFIED', 'DATA_COLLECTION', 'SITE_ASSESSMENT_PENDING',
  'CONCEPT_DESIGN', 'BUDGETARY_PROPOSAL', 'FIRM_PROPOSAL', 'NEGOTIATION',
  'CONTRACTING', 'WON', 'LOST', 'ON_HOLD',
] as const;

const COMMERCIAL_MODELS = [
  'CAPEX_SALE', 'LEASE', 'PPA', 'HYBRID_CAPEX_PPA', 'EPC_ONLY', 'DESIGN_AND_SUPPLY',
] as const;

const NEXT_ACTION_TYPES = [
  'FOLLOW_UP', 'SITE_SURVEY', 'REVISED_QUOTATION', 'CLIENT_MEETING', 'INTERNAL_REVIEW', 'OTHER',
] as const;

// Stored statuses on Opportunity. CANCELLED added in V1 sales pipeline (2026-05-08)
// for explicit "won't do" closure separate from COMPLETED.
const NEXT_ACTION_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
// Effective status (computed): adds OVERDUE = (PENDING && due in past),
// and NONE for opps with no next action set (or CANCELLED).
const NEXT_ACTION_EFFECTIVE_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED', 'OVERDUE', 'NONE'] as const;

export const CreateOpportunitySchema = z.object({
  title: z.string().min(1).max(255),
  accountId: z.string().cuid(),
  siteId: z.string().cuid(),
  ownerUserId: z.string().cuid(),
  designEngineerId: z.string().cuid().nullable().optional(),
  commercialModel: z.enum(COMMERCIAL_MODELS).optional(),
  estimatedValue: z.number().positive().optional(),
  estimatedPvKwp: z.number().positive().optional(),
  estimatedBessKw: z.number().positive().optional(),
  estimatedBessKwh: z.number().positive().optional(),
  probabilityPercent: z.number().int().min(0).max(100).optional(),
  expectedAwardDate: z.string().datetime().optional(),
  summary: z.string().optional(),
  risks: z.string().optional(),
  competitors: z.string().optional(),
  // V1 tracking fields — nullable so the edit form can clear them
  nextAction:        z.string().max(500).nullable().optional(),
  nextActionDueDate: z.string().datetime().nullable().optional(),
  nextActionType:    z.enum(NEXT_ACTION_TYPES).nullable().optional(),
  nextActionOwnerId: z.string().cuid().nullable().optional(),
  lastStatusNote:    z.string().max(1000).nullable().optional(),
});

export const UpdateOpportunitySchema = CreateOpportunitySchema.partial();

export const TransitionStageSchema = z.object({
  toStage: z.enum(STAGES),
  reason: z.string().optional(),
  // Required when toStage === 'WON' — triggers auto project creation
  projectCode:       z.string().regex(/^[A-Z]{2,5}\d{2}-[A-Z0-9]{2,10}$/).optional(),
  projectManagerId:  z.string().cuid().optional(),
  projectName:       z.string().min(1).max(200).optional(),
  budgetBaseline:    z.number().positive().optional(),
  startDate:         z.coerce.date().optional(),
  targetCod:         z.coerce.date().optional(),
}).superRefine((data, ctx) => {
  if (data.toStage === 'WON') {
    if (!data.projectCode) ctx.addIssue({ code: 'custom', path: ['projectCode'], message: 'projectCode is required when marking WON' });
    if (!data.projectManagerId) ctx.addIssue({ code: 'custom', path: ['projectManagerId'], message: 'projectManagerId is required when marking WON' });
    if (!data.projectName) ctx.addIssue({ code: 'custom', path: ['projectName'], message: 'projectName is required when marking WON' });
  }
});

export const OpportunityQuerySchema = z.object({
  search: z.string().optional(),
  accountId: z.string().optional(),
  siteId: z.string().optional(),
  ownerUserId: z.string().optional(),
  designEngineerId: z.string().optional(),
  stage: z.enum(STAGES).optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  overdue: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  // ── Sales pipeline V1 filter chips ─────────────────────────────────────
  // All boolean-coerced flags. Combinable.
  myOnly:                      z.coerce.boolean().optional(),  // ownerUserId = current user
  mineAsDesignEngineer:        z.coerce.boolean().optional(),  // designEngineerId = current user
  closingThisMonth:            z.coerce.boolean().optional(),  // expectedAwardDate within current month
  closingThisQuarter:          z.coerce.boolean().optional(),  // expectedAwardDate within current quarter
  noNextAction:                z.coerce.boolean().optional(),  // nextAction is null/empty
  overdueNextAction:           z.coerce.boolean().optional(),  // nextActionStatus=PENDING && due<now
  noActivity14d:               z.coerce.boolean().optional(),  // no activity within 14 days
  noActivity30d:               z.coerce.boolean().optional(),  // no activity within 30 days
  proposalSubmitted:           z.coerce.boolean().optional(),  // stage in {BUDGETARY_PROPOSAL, FIRM_PROPOSAL}
  highValue:                   z.coerce.boolean().optional(),  // estimatedValue >= 1,000,000 (configurable later)
  wonThisMonth:                z.coerce.boolean().optional(),  // stage=WON && updatedAt this month
  lostThisMonth:               z.coerce.boolean().optional(),  // stage=LOST && updatedAt this month
  // All-time stage filters (Sales Pipeline Lite, 2026-05-08).
  won:                         z.coerce.boolean().optional(),  // stage=WON (all time)
  lost:                        z.coerce.boolean().optional(),  // stage=LOST (all time)
  nextActionStatus:            z.enum(NEXT_ACTION_EFFECTIVE_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  sortBy: z.enum(['title', 'opportunityCode', 'stage', 'estimatedValue', 'expectedAwardDate', 'nextActionDueDate', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

// Dedicated next-action update endpoint — finer permission than full opportunity edit
export const UpdateNextActionSchema = z.object({
  nextAction:        z.string().min(1).max(500).optional(),
  nextActionType:    z.enum(NEXT_ACTION_TYPES).optional(),
  nextActionDueDate: z.coerce.date().nullable().optional(),
  nextActionOwnerId: z.string().cuid().nullable().optional(),
  nextActionStatus:  z.enum(NEXT_ACTION_STATUSES).optional(),
});
export type UpdateNextActionDto = z.infer<typeof UpdateNextActionSchema>;

export type CreateOpportunityDto = z.infer<typeof CreateOpportunitySchema>;
export type UpdateOpportunityDto = z.infer<typeof UpdateOpportunitySchema>;
export type TransitionStageDto = z.infer<typeof TransitionStageSchema>;
export type OpportunityQueryDto = z.infer<typeof OpportunityQuerySchema>;
