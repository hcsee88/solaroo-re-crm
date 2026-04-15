import { z } from 'zod';

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['CLIENT', 'PROSPECT', 'PARTNER', 'CONSULTANT', 'VENDOR']),
  industry: z.string().max(100).optional(),
  registrationNo: z.string().max(50).optional(),
  country: z.string().max(100).default('Malaysia'),
  region: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateAccountSchema = CreateAccountSchema.partial();

export const AccountQuerySchema = z.object({
  search: z.string().optional(),
  type: z.enum(['CLIENT', 'PROSPECT', 'PARTNER', 'CONSULTANT', 'VENDOR']).optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  sortBy: z.enum(['name', 'accountCode', 'createdAt', 'updatedAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateAccountDto = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountDto = z.infer<typeof UpdateAccountSchema>;
export type AccountQueryDto = z.infer<typeof AccountQuerySchema>;
