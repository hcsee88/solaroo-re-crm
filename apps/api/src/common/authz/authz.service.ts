import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { UserContext } from '@solaroo/types';
import type { Resource, Action, Scope } from '@solaroo/types';
import { SENSITIVE_FIELD_POLICY, type SensitiveField } from './sensitive-fields';

export type ScopeContext = {
  /** ownerUserId or createdByUserId of the record being accessed */
  ownerId?: string;
  /** owner's role name — used for team-scope matching */
  ownerRoleName?: string;
  /** for project-scoped resources */
  projectId?: string;
  /** for opportunity-scoped resources */
  opportunityId?: string;
};

// Simple in-memory cache keyed by userId, expires every 60s.
// Cleared explicitly when user permissions change.
type CacheEntry = { perms: Set<string>; expiresAt: number };

@Injectable()
export class AuthzService {
  private readonly logger = new Logger(AuthzService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  // ─── Core checks ─────────────────────────────────────────────────────────────

  /**
   * Returns true if the user has ANY permission for (resource, action) at any scope.
   * Pass scopeCtx to also verify the matching scope covers the target record.
   */
  async hasPermission(
    user: UserContext,
    resource: Resource,
    action: Action,
    scopeCtx?: ScopeContext,
  ): Promise<boolean> {
    const userPerms = await this.loadUserPermissions(user.id);

    // Find all permissions for this resource:action at any scope
    const matchingScopes: Scope[] = [];
    for (const key of userPerms) {
      const [r, a, s] = key.split(':');
      if (r === resource && a === action) {
        matchingScopes.push(s as Scope);
      }
    }

    if (matchingScopes.length === 0) return false;

    // No scope context means caller only wants to know if any permission exists
    if (!scopeCtx) return true;

    // Check if any matching scope covers this record
    for (const scope of matchingScopes) {
      if (await this.scopeCoversRecord(user, scope, scopeCtx)) return true;
    }

    return false;
  }

  /**
   * Throws ForbiddenException if the user lacks the required permission.
   * Use this inside service methods for record-level scope enforcement.
   */
  async requirePermission(
    user: UserContext,
    resource: Resource,
    action: Action,
    scopeCtx?: ScopeContext,
  ): Promise<void> {
    const allowed = await this.hasPermission(user, resource, action, scopeCtx);
    if (!allowed) {
      this.logger.warn(
        `AUTHZ_DENIED: user=${user.id} role=${user.roleName} resource=${resource} action=${action}`,
      );
      throw new ForbiddenException(
        `You do not have permission to ${action} ${resource}`,
      );
    }
  }

  /**
   * Returns true if the user has the required permission to view a sensitive field.
   */
  async canViewField(user: UserContext, field: SensitiveField): Promise<boolean> {
    const policy = SENSITIVE_FIELD_POLICY[field];
    return this.hasPermission(user, policy.resource, policy.action);
  }

  /**
   * Strips sensitive fields from an object that the user is not permitted to see.
   * Call this before returning sensitive records to the client.
   */
  async stripSensitiveFields<T extends Record<string, unknown>>(
    obj: T,
    user: UserContext,
  ): Promise<Partial<T>> {
    const result = { ...obj } as Record<string, unknown>;
    for (const field of Object.keys(SENSITIVE_FIELD_POLICY) as SensitiveField[]) {
      if (field in result) {
        const allowed = await this.canViewField(user, field);
        if (!allowed) delete result[field];
      }
    }
    return result as Partial<T>;
  }

  /**
   * Returns the highest scope the user has for a given resource:action.
   * Precedence: all > team > assigned > own > null (no permission).
   * Use this in service list methods to determine which WHERE clause to apply.
   */
  async getBestScope(
    user: UserContext,
    resource: Resource,
    action: Action,
  ): Promise<Scope | null> {
    const userPerms = await this.loadUserPermissions(user.id);
    const SCOPE_RANK: Record<Scope, number> = { all: 4, team: 3, assigned: 2, own: 1 };

    let best: Scope | null = null;
    let bestRank = 0;

    for (const key of userPerms) {
      const [r, a, s] = key.split(':');
      if (r === resource && a === action) {
        const scope = s as Scope;
        const rank = SCOPE_RANK[scope] ?? 0;
        if (rank > bestRank) {
          bestRank = rank;
          best = scope;
        }
      }
    }

    return best;
  }

  // ─── Scope resolution ─────────────────────────────────────────────────────

  private async scopeCoversRecord(
    user: UserContext,
    scope: Scope,
    ctx: ScopeContext,
  ): Promise<boolean> {
    switch (scope) {
      case 'all':
        return true;

      case 'own':
        return !!ctx.ownerId && ctx.ownerId === user.id;

      case 'team':
        if (ctx.ownerId === user.id) return true;
        // If ownerRoleName is provided, verify same team (role).
        if (ctx.ownerRoleName) return ctx.ownerRoleName === user.roleName;
        // V1 fallback: no Team model yet. List queries already treat team as
        // all (no extra WHERE). Record-level checks must match: if ownerRoleName
        // is not passed, grant access to preserve that parity.
        return true;

      case 'assigned': {
        if (ctx.ownerId === user.id) return true;
        if (ctx.projectId) {
          const member = await this.prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId: ctx.projectId, userId: user.id } },
          });
          if (member) return true;
        }
        if (ctx.opportunityId) {
          const member = await this.prisma.opportunityMember.findUnique({
            where: { opportunityId_userId: { opportunityId: ctx.opportunityId, userId: user.id } },
          });
          if (member) return true;
        }
        return false;
      }
    }
  }

  // ─── Permission loader ────────────────────────────────────────────────────

  private async loadUserPermissions(userId: string): Promise<Set<string>> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.perms;

    // Load role-based permissions
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { role: { users: { some: { id: userId } } } },
      include: { permission: true },
    });

    // Load user-specific overrides (grants or explicit denies)
    const userPerms = await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });

    const perms = new Set<string>();

    for (const rp of rolePerms) {
      const { resource, action, scope } = rp.permission;
      perms.add(`${resource}:${action}:${scope}`);
    }

    for (const up of userPerms) {
      const key = `${up.permission.resource}:${up.permission.action}:${up.permission.scope}`;
      if (up.granted) {
        perms.add(key);
      } else {
        perms.delete(key); // explicit deny overrides role grant
      }
    }

    this.cache.set(userId, { perms, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return perms;
  }

  /** Call this after changing a user's permissions to invalidate their cache. */
  invalidateCache(userId: string): void {
    this.cache.delete(userId);
  }
}
