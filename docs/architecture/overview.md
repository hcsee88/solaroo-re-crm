# Solaroo RE CRM — Architecture Overview

**Last reviewed:** 2026-05-08

## System type
Modular monolith. Single deployable application with clearly bounded domain modules. Future split to microservices is possible but not planned until the system matures and team scales significantly.

## Lifecycle this system covers
```
Account → Site → Opportunity → Proposal → Contract → Project → Commissioning → Asset Register → O&M
```

The sales segment of the lifecycle is now annotated with manual activity-logging discipline:

```
Account → Contact → Site → Opportunity → Activity / Next Action → Proposal → Contract → Project
```

Activities are CRM records (call / email / WhatsApp / meeting / site visit / proposal follow-up / general note). They are **not** integrated with email/WhatsApp/calendar/telephony in V1 — salespeople log them manually after the fact. Next-action due dates drive overdue + stale flags surfaced in dashboards and list filters.

> **Current direction (2026-05-08):** the next module is **Sales Pipeline Monitoring V1** — manual activity logging, next-action tracking, opportunity health indicators, list filters + saved views, sales pipeline dashboard, in-app notification hook points. O&M is deferred. See `docs/v1-product-direction.md` for full rationale.

## Layers

### Frontend (`/apps/web`)
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui component library
- Role-based dashboards
- Mobile-responsive site team pages (PWA for offline-capable forms)
- Server Components for data-heavy views, Client Components for interactive UI

### API (`/apps/api`)
- REST API (Next.js API routes or NestJS)
- Zod validation on all inputs
- Role-based authorization middleware on all routes
- Background job dispatch via BullMQ

### Data (`/packages/db`)
- PostgreSQL — primary system of record
- Prisma ORM — split schema files by domain
- S3-compatible object storage — all files/drawings/documents
- Audit log table — all critical state changes

### Shared packages
- `@solaroo/types` — shared TypeScript types and API contracts
- `@solaroo/workflows` — stage transition rules, gate checklist templates
- `@solaroo/ai-prompts` — domain-specific Claude AI prompt templates
- `@solaroo/ui` — shared shadcn/ui components

### Worker (`/services/worker`)
- BullMQ + Redis
- Handles: workflow triggers, notification dispatch, scheduled reminders, background AI jobs

## Key architectural decisions

| Decision | Choice | Reason |
|---|---|---|
| Architecture pattern | Modular monolith | Faster delivery, simpler consistency, lower DevOps overhead for team of 15 |
| Language | TypeScript everywhere | One language, shared types, no context switching |
| Database | PostgreSQL + Prisma | Strong relational model, type-safe queries, migration management |
| Schema strategy | Split Prisma schema files by domain | Keeps schema readable as it grows |
| State machines | Explicit transition maps | Opportunity stages and gate statuses are controlled, not arbitrary |
| File storage | S3-compatible object storage | Files never in DB; metadata + URL in DB |
| AI | Claude API (claude-sonnet-4-6) | Domain-specific prompts, no direct record mutation |
| Auth | Auth.js / Clerk | Role-based, team-aware, SSO-ready |
| Background jobs | BullMQ + Redis | Reliable queue, retry logic, scheduled jobs |

## Domain modules

Each module owns: route handlers → service → repository → zod schema → types → tests → permissions → workflow hooks

```
auth               Users, roles, permissions, teams
accounts           Client/partner/consultant company records
contacts           Individuals linked to accounts
sites              Physical project sites and baseline data
opportunities      Commercial pipeline with controlled stage transitions
technical-assessment  Site surveys, load profiles, engineering data
proposals          Proposal versions, assumptions, approval routing
contracts          Contract summary, milestones, invoicing
projects           Awarded project execution hub
gates              Gate tracker with checklists and approvals
procurement        Vendors, RFQs, POs, deliveries, serial tracking
documents          Version-controlled document control
assets             Installed asset register (post-commissioning)
maintenance        O&M plans, service tickets, warranty claims
reporting          Dashboards and analytics
ai                 Claude AI copilot service
admin              System configuration and user management
```

## Security model

- All API routes require authentication
- Role-based permissions checked server-side on every mutation
- Margin and commercial fields have field-level permission guards
- Signed URLs for file access (no public file URLs)
- Full audit trail on approvals, stage changes, and gate closures
- Row-level security (project team) enforced in service layer

## Deployment

- Frontend: Vercel
- API + Worker: Railway or Render (or same VPS)
- PostgreSQL: Supabase or Railway Postgres or self-hosted
- Redis: Upstash or Railway Redis
- Files: Cloudflare R2 or AWS S3

## Scale target
~30 concurrent users within 2 years. Single-company. Not multi-tenant. Monolith will handle this comfortably.
