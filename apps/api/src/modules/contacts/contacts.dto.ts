import { z } from 'zod';

export const CreateContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  jobTitle: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
  // Account linkage
  accountId: z.string().cuid().optional(),
  isPrimary: z.boolean().default(false),
  relationship: z.string().max(100).optional(),
});

export const UpdateContactSchema = CreateContactSchema.partial();

export const UpdateAccountLinkSchema = z.object({
  isPrimary: z.boolean().optional(),
  relationship: z.string().max(100).nullable().optional(),
});

export const ContactQuerySchema = z.object({
  search: z.string().optional(),
  accountId: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  sortBy: z.enum(['firstName', 'lastName', 'email', 'createdAt']).default('lastName'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;
export type UpdateAccountLinkDto = z.infer<typeof UpdateAccountLinkSchema>;
export type ContactQueryDto = z.infer<typeof ContactQuerySchema>;
