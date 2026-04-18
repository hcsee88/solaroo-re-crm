import { z } from 'zod';

// ─── Contract milestone ───────────────────────────────────────────────────────

export const CreateContractMilestoneSchema = z.object({
  milestoneNo:      z.number().int().min(1),
  title:            z.string().min(1).max(200),
  description:      z.string().max(1000).optional(),
  percentValue:     z.number().min(0).max(100).optional(),
  amount:           z.number().nonnegative().optional(),
  triggerCondition: z.string().max(500).optional(),
  targetDate:       z.coerce.date().optional(),
});
export type CreateContractMilestoneDto = z.infer<typeof CreateContractMilestoneSchema>;

export const UpdateContractMilestoneSchema = z.object({
  title:            z.string().min(1).max(200).optional(),
  description:      z.string().max(1000).nullable().optional(),
  percentValue:     z.number().min(0).max(100).nullable().optional(),
  amount:           z.number().nonnegative().nullable().optional(),
  triggerCondition: z.string().max(500).nullable().optional(),
  targetDate:       z.coerce.date().nullable().optional(),
  achievedDate:     z.coerce.date().nullable().optional(),
  isAchieved:       z.boolean().optional(),
});
export type UpdateContractMilestoneDto = z.infer<typeof UpdateContractMilestoneSchema>;

// ─── Invoice ──────────────────────────────────────────────────────────────────

export const INVOICE_STATUSES = [
  'NOT_RAISED',
  'RAISED',
  'SUBMITTED',
  'PARTIALLY_PAID',
  'PAID',
  'DISPUTED',
] as const;

export const CreateInvoiceSchema = z.object({
  invoiceNo:    z.string().min(1).max(50),
  milestoneId:  z.string().cuid().optional(),
  amount:       z.number().nonnegative(),
  taxAmount:    z.number().nonnegative().optional(),
  totalAmount:  z.number().nonnegative(),
  currency:     z.string().min(3).max(3).default('MYR'),
  invoiceDate:  z.coerce.date().optional(),
  dueDate:      z.coerce.date().optional(),
  notes:        z.string().max(1000).optional(),
});
export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;

export const UpdateInvoiceStatusSchema = z.object({
  status:     z.enum(INVOICE_STATUSES),
  paidAmount: z.number().nonnegative().optional(),
  paidDate:   z.coerce.date().optional(),
  notes:      z.string().max(1000).optional(),
});
export type UpdateInvoiceStatusDto = z.infer<typeof UpdateInvoiceStatusSchema>;
