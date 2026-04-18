import { z } from 'zod';

// ─── Query (paginated list) ───────────────────────────────────────────────────

export const NotificationListQuerySchema = z.object({
  page:             z.coerce.number().int().min(1).default(1),
  pageSize:         z.coerce.number().int().min(1).max(100).default(25),
  includeDismissed: z.coerce.boolean().default(false),
});
export type NotificationListQueryDto = z.infer<typeof NotificationListQuerySchema>;
