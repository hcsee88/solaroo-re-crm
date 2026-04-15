import { SetMetadata } from '@nestjs/common';
import type { Resource, Action } from '@solaroo/types';

export const PERMISSION_META_KEY = 'required_permission';

export type PermissionMeta = { resource: Resource; action: Action };

/**
 * Declare the minimum permission required to call this endpoint.
 * The PermissionGuard reads this metadata and checks the authenticated user's permissions.
 * Scope enforcement (own / team / assigned / all) happens inside the service layer
 * via AuthzService.requirePermission().
 *
 * @example @RequirePermission('opportunity', 'edit')
 */
export const RequirePermission = (resource: Resource, action: Action) =>
  SetMetadata(PERMISSION_META_KEY, { resource, action });
