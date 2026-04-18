import { z } from 'zod';

export const AuditQuerySchema = z.object({
  resource:   z.string().optional(),
  resourceId: z.string().optional(),
  userId:     z.string().optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditQueryDto = z.infer<typeof AuditQuerySchema>;

export const UserQuerySchema = z.object({
  search:   z.string().optional(),
  roleId:   z.string().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const CreateUserSchema = z.object({
  email:    z.string().email('Invalid email'),
  name:     z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleId:   z.string().cuid('Invalid role'),
  isActive: z.boolean().default(true),
});

export const UpdateUserSchema = z.object({
  name:     z.string().min(1).optional(),
  email:    z.string().email().optional(),
  roleId:   z.string().cuid().optional(),
  isActive: z.boolean().optional(),
});

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type UserQueryDto       = z.infer<typeof UserQuerySchema>;
export type CreateUserDto      = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto      = z.infer<typeof UpdateUserSchema>;
export type ResetPasswordDto   = z.infer<typeof ResetPasswordSchema>;
