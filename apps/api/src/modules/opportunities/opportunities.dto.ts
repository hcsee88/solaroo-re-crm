import { z } from 'zod';

const STAGES = [
  'LEAD', 'QUALIFIED', 'DATA_COLLECTION', 'SITE_ASSESSMENT_PENDING',
  'CONCEPT_DESIGN', 'BUDGETARY_PROPOSAL', 'FIRM_PROPOSAL', 'NEGOTIATION',
  'CONTRACTING', 'WON', 'LOST', 'ON_HOLD',
] as const;

const COMMERCIAL_MODELS = [
  'CAPEX_SALE', 'LEASE', 'PPA', 'HYBRID_CAPEX_PPA', 'EPC_ONLY', 'DESIGN_AND_SUPPLY',
] as const;

export const CreateOpportunitySchema = z.object({
  title: z.string().min(1).max(255),
  accountId: z.string().cuid(),
  siteId: z.string().cuid(),
  ownerUserId: z.string().cuid(),
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
  // V1 tracking fields
  nextAction:        z.string().max(500).optional(),
  nextActionDueDate: z.string().datetime().optional(),
  lastStatusNote:    z.string().max(1000).optional(),
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
  stage: z.enum(STAGES).optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  overdue: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  sortBy: z.enum(['title', 'opportunityCode', 'stage', 'estimatedValue', 'expectedAwardDate', 'nextActionDueDate', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateOpportunityDto = z.infer<typeof CreateOpportunitySchema>;
export type UpdateOpportunityDto = z.infer<typeof UpdateOpportunitySchema>;
export type TransitionStageDto = z.infer<typeof TransitionStageSchema>;
export type OpportunityQueryDto = z.infer<typeof OpportunityQuerySchema>;
