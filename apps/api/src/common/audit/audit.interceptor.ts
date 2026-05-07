import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import type { UserContext } from '@solaroo/types';

/**
 * AuditInterceptor — automatically captures CRUD activity on top-level resources.
 *
 * Why: services already call AuditService.record() for state transitions, approvals,
 * and other rich actions (with metadata). This interceptor fills the gap for the
 * everyday "Sales Engineer edited the opportunity title" class of edits — so every
 * detail page can show a definitive "Last edited by X · Y minutes ago" line.
 *
 * What it captures:
 *   POST  /api/{resource}        → action: "created"
 *   PATCH /api/{resource}/:id    → action: "updated"
 *
 * What it deliberately SKIPS (to avoid double-auditing the rich service-layer events):
 *   - Sub-routes: /api/{resource}/:id/{anything-else}
 *   - DELETE: rare in this CRM and the few places it happens already audit themselves
 *
 * Field-level diff is NOT captured here in v1 — only the list of fields the client
 * submitted (in `metadata.fields`). Adding before/after values is a future extension
 * (would require a per-resource SELECT before the write).
 */

type RouteMatcher = {
  resource: string;
  method: 'POST' | 'PATCH';
  pattern: RegExp;
  /** Position in the regex match where the resourceId is captured (PATCH only). */
  idGroup?: number;
};

// Top-level routes only — skip nested /api/X/:id/sub. Order doesn't matter (only one matches).
const ROUTES: RouteMatcher[] = [
  { resource: 'opportunity', method: 'POST',  pattern: /^\/api\/opportunities\/?$/ },
  { resource: 'opportunity', method: 'PATCH', pattern: /^\/api\/opportunities\/([^/]+)\/?$/, idGroup: 1 },

  { resource: 'account',     method: 'POST',  pattern: /^\/api\/accounts\/?$/ },
  { resource: 'account',     method: 'PATCH', pattern: /^\/api\/accounts\/([^/]+)\/?$/, idGroup: 1 },

  { resource: 'site',        method: 'POST',  pattern: /^\/api\/sites\/?$/ },
  { resource: 'site',        method: 'PATCH', pattern: /^\/api\/sites\/([^/]+)\/?$/, idGroup: 1 },

  { resource: 'contact',     method: 'POST',  pattern: /^\/api\/contacts\/?$/ },
  { resource: 'contact',     method: 'PATCH', pattern: /^\/api\/contacts\/([^/]+)\/?$/, idGroup: 1 },

  { resource: 'project',     method: 'POST',  pattern: /^\/api\/projects\/?$/ },
  { resource: 'project',     method: 'PATCH', pattern: /^\/api\/projects\/([^/]+)\/?$/, idGroup: 1 },

  { resource: 'contract',    method: 'POST',  pattern: /^\/api\/contracts\/?$/ },
  { resource: 'contract',    method: 'PATCH', pattern: /^\/api\/contracts\/([^/]+)\/?$/, idGroup: 1 },

  { resource: 'proposal',         method: 'POST',  pattern: /^\/api\/proposals\/?$/ },
  { resource: 'proposal',         method: 'PATCH', pattern: /^\/api\/proposals\/([^/]+)\/?$/, idGroup: 1 },
  { resource: 'proposal_version', method: 'POST',  pattern: /^\/api\/proposals\/[^/]+\/versions\/?$/ },

  { resource: 'activity',    method: 'POST',  pattern: /^\/api\/activities\/?$/ },
  { resource: 'activity',    method: 'PATCH', pattern: /^\/api\/activities\/([^/]+)\/?$/, idGroup: 1 },
];

function matchRoute(method: string, urlPath: string): { route: RouteMatcher; resourceId?: string } | null {
  for (const r of ROUTES) {
    if (r.method !== method) continue;
    const m = urlPath.match(r.pattern);
    if (!m) continue;
    return {
      route: r,
      resourceId: r.idGroup ? m[r.idGroup] : undefined,
    };
  }
  return null;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{ method: string; url: string; body?: unknown; user?: UserContext }>();

    // Quick bail — only POST/PATCH are interesting.
    if (req.method !== 'POST' && req.method !== 'PATCH') {
      return next.handle();
    }

    // Strip query string before matching.
    const urlPath = (req.url || '').split('?')[0] ?? '';
    const matched = matchRoute(req.method, urlPath);
    if (!matched) return next.handle();

    const user = req.user;
    if (!user) return next.handle();

    const action = matched.route.method === 'POST' ? 'created' : 'updated';
    const fields = req.body && typeof req.body === 'object'
      ? Object.keys(req.body as Record<string, unknown>)
      : [];

    return next.handle().pipe(
      tap((response) => {
        // For POST, the resourceId comes from the response body (the newly-created record's id).
        // For PATCH, the resourceId is captured from the URL.
        let resourceId = matched.resourceId;
        if (!resourceId && response && typeof response === 'object') {
          const r = response as Record<string, unknown>;
          if (typeof r['id'] === 'string') resourceId = r['id'];
        }
        if (!resourceId) return;

        this.audit
          .record({
            actor: user,
            resource: matched.route.resource,
            resourceId,
            action,
            metadata: fields.length > 0 ? { fields } : null,
          })
          .catch((err) =>
            this.logger.warn(`AuditInterceptor record failed: ${(err as Error).message}`),
          );
      }),
    );
  }
}
