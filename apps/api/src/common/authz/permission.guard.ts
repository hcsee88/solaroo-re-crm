import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthzService } from './authz.service';
import { PERMISSION_META_KEY, type PermissionMeta } from './require-permission.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { UserContext } from '@solaroo/types';

/**
 * Global guard that reads @RequirePermission metadata and checks user permissions.
 *
 * Operates in two modes controlled by the AUTHZ_ENFORCE env var:
 *   AUTHZ_ENFORCE=false  → audit-only: violations are logged but requests proceed
 *   AUTHZ_ENFORCE=true   → enforcing: violations throw 403 Forbidden
 *
 * Start with AUTHZ_ENFORCE=false to monitor violations, then flip to true.
 *
 * Scope enforcement (own/team/assigned/all) is NOT done here — it's done in
 * the service layer via AuthzService.requirePermission() with a ScopeContext.
 * This guard only validates that the user has *any* permission for the endpoint's
 * declared resource:action, regardless of scope.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);
  private readonly enforce: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthzService,
    config: ConfigService,
  ) {
    this.enforce = config.get<string>('AUTHZ_ENFORCE', 'false') === 'true';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Public routes bypass permission checks
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // No permission metadata = endpoint not annotated; allow through
    const required = this.reflector.getAllAndOverride<PermissionMeta>(PERMISSION_META_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as UserContext | undefined;

    // Unauthenticated requests are already handled by JwtAuthGuard before this runs
    if (!user) return true;

    const allowed = await this.authz.hasPermission(user, required.resource, required.action);

    if (!allowed) {
      const msg = `AUTHZ_VIOLATION: user=${user.id} role=${user.roleName} attempted ${required.action} on ${required.resource}`;

      if (this.enforce) {
        this.logger.warn(msg);
        throw new ForbiddenException(
          `You do not have permission to ${required.action} ${required.resource}`,
        );
      } else {
        // Audit-only mode: log and allow
        this.logger.warn(`[AUDIT-ONLY] ${msg}`);
        return true;
      }
    }

    return true;
  }
}
