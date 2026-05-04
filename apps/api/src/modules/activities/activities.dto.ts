import { z } from 'zod';

export const ACTIVITY_TYPES = [
  'CALL',
  'EMAIL',
  'WHATSAPP',
  'MEETING',
  'SITE_VISIT',
  'PROPOSAL_FOLLOW_UP',
  'GENERAL_NOTE',
  // Legacy values still allowed for backwards compatibility on read; create only uses the above.
  'NOTE',
  'TASK',
] as const;

export const CreateActivitySchema = z.object({
  type:          z.enum(ACTIVITY_TYPES),
  subject:       z.string().min(1).max(255),
  body:          z.string().max(5000).optional(),
  occurredAt:    z.coerce.date(),
  accountId:     z.string().cuid().optional(),
  contactId:     z.string().cuid().optional(),
  siteId:        z.string().cuid().optional(),
  opportunityId: z.string().cuid().optional(),
}).refine(
  (d) => !!(d.accountId || d.contactId || d.opportunityId || d.siteId),
  { message: 'Activity must be linked to at least one of account/contact/site/opportunity', path: ['accountId'] },
);
export type CreateActivityDto = z.infer<typeof CreateActivitySchema>;

export const UpdateActivitySchema = z.object({
  type:       z.enum(ACTIVITY_TYPES).optional(),
  subject:    z.string().min(1).max(255).optional(),
  body:       z.string().max(5000).nullable().optional(),
  occurredAt: z.coerce.date().optional(),
});
export type UpdateActivityDto = z.infer<typeof UpdateActivitySchema>;

export const ActivityQuerySchema = z.object({
  opportunityId: z.string().optional(),
  accountId:     z.string().optional(),
  contactId:     z.string().optional(),
  siteId:        z.string().optional(),
  ownerUserId:   z.string().optional(),
  type:          z.enum(ACTIVITY_TYPES).optional(),
  // Sales analytics filters
  loggedAfter:   z.coerce.date().optional(),
  loggedBefore:  z.coerce.date().optional(),
  page:          z.coerce.number().int().min(1).default(1),
  pageSize:      z.coerce.number().int().min(1).max(200).default(50),
  sortBy:        z.enum(['occurredAt', 'createdAt']).default('occurredAt'),
  sortDir:       z.enum(['asc', 'desc']).default('desc'),
});
export type ActivityQueryDto = z.infer<typeof ActivityQuerySchema>;
