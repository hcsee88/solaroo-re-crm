import { z } from 'zod';

export const CreateSiteSchema = z.object({
  name: z.string().min(1).max(255),
  accountId: z.string().cuid(),
  primaryContactId: z.string().cuid().optional(),
  gridCategory: z.enum(['OFF_GRID', 'WEAK_GRID', 'GRID_CONNECTED', 'HYBRID']),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  country: z.string().max(100).default('Malaysia'),
  region: z.string().max(100).optional(),
  operatingSchedule: z.string().max(50).optional(),
  accessConstraints: z.string().optional(),
  safetyConstraints: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateSiteSchema = CreateSiteSchema.partial();

export const SiteQuerySchema = z.object({
  search: z.string().optional(),
  accountId: z.string().optional(),
  gridCategory: z.enum(['OFF_GRID', 'WEAK_GRID', 'GRID_CONNECTED', 'HYBRID']).optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  sortBy: z.enum(['name', 'siteCode', 'createdAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateSiteDto = z.infer<typeof CreateSiteSchema>;
export type UpdateSiteDto = z.infer<typeof UpdateSiteSchema>;
export type SiteQueryDto = z.infer<typeof SiteQuerySchema>;
